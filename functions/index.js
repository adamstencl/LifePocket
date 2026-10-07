const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue, FieldPath} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// ── Claude Proxy ──────────────────────────────────────────────────────────────
// Volání Claude API ze serveru — klíč nikdy neopustí backend
exports.claudeProxy = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  // 1. Auth check
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;

  // 2. Rate limiting — max 50 AI volání za den (atomicky přes transakci,
  // aby paralelní requesty nemohly limit obejít)
  // Den počítáme v čase Europe/Prague (limit se nuluje o naší půlnoci, ne v UTC)
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Prague'}).format(new Date());
  const rateRef = db.doc(`rateLimits/${uid}`);
  const DAILY_LIMIT = 50;
  const todayCount = await db.runTransaction(async (tx) => {
    const rateSnap = await tx.get(rateRef);
    const rateData = rateSnap.exists ? rateSnap.data() : {};
    const count = rateData.date === today ? (rateData.count || 0) : 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', `Denní limit ${DAILY_LIMIT} AI dotazů byl dosažen. Limit se obnoví zítra.`);
    }
    tx.set(rateRef, {date: today, count: count + 1});
    return count;
  });

  // 3. Načti Claude API klíč z Firestore (admin přístup, klient to nemůže číst)
  const secretsSnap = await db.doc('config/secrets').get();
  if (!secretsSnap.exists) throw new HttpsError('not-found', 'Konfigurace AI není dostupná.');
  const secrets = secretsSnap.data();
  const claudeKey = secrets.claudeKey || secrets.cladeKey || secrets.ClaudeKey || secrets.claude_key;
  if (!claudeKey) throw new HttpsError('not-found', 'Claude API klíč není nastaven.');

  // 4. Validace vstupu
  const {messages, maxTokens = 500} = request.data;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpsError('invalid-argument', 'Chybí messages.');
  }
  if (maxTokens > 2000) throw new HttpsError('invalid-argument', 'maxTokens příliš vysoké.');

  // 5. Zavolej Claude API
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');
  const https = require('https');
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system: systemMsg?.content || '',
    messages: userMsgs
  });

  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(data)}); }
        catch(e) { reject(new Error('Nelze parsovat odpověď Claude API')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  if (result.status !== 200) {
    const msg = result.body?.error?.message || `Claude API chyba: ${result.status}`;
    throw new HttpsError('internal', msg);
  }
  const content = result.body.content?.[0]?.text;
  if (!content) throw new HttpsError('internal', 'Claude API: prázdná odpověď');

  return {text: content, remaining: DAILY_LIMIT - todayCount - 1};
});

// ── Helpers ──────────────────────────────────────────────
function isTimeMatch(h, m, timeStr) {
  if (!timeStr) return false;
  const [th, tm] = timeStr.split(':').map(Number);
  return h === th && m >= tm && m < tm + 5;
}

async function sendPush(token, title, body, tag = 'lifepocket', options = {}) {
  const notif = {
    title, body,
    icon: 'https://lifepocket.app/icon-192.png',
    badge: 'https://lifepocket.app/icon-192.png',
    tag, renotify: true,
  };
  if (options.data)    notif.data = options.data;
  if (options.actions?.length) { notif.actions = options.actions; notif.requireInteraction = true; }
  // Top-level data (jen řetězce): SW z nich skládá tag, akce a data kliknutí, protože
  // Firebase SDK je z webpush.notification do onBackgroundMessage nepředá
  const data = {tag: String(tag)};
  for (const [k, v] of Object.entries(options.data || {})) data[k] = String(v);
  if (options.actions?.length) data.actions = JSON.stringify(options.actions);
  await getMessaging().send({
    token,
    data,
    webpush: { notification: notif, fcmOptions: {link: 'https://lifepocket.app/'} }
  });
  // Titulek ani text se neloguje (obsahuje jména, názvy návyků apod.)
  console.log('[LP] Push odeslan');
}

// Všechny tokeny uživatele: mapa fcmTokens (zařízení → {token, platform, updatedAt})
// + legacy pole fcmToken (poslední registrované zařízení), bez duplicit
function collectTokens(prof) {
  const byToken = new Map();
  const add = (token, mapKey) => {
    if (typeof token !== 'string' || !token) return;
    const e = byToken.get(token) || {token, mapKeys: [], legacy: false};
    if (mapKey) e.mapKeys.push(mapKey); else e.legacy = true;
    byToken.set(token, e);
  };
  const map = prof && prof.fcmTokens;
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map)) add(v && v.token, k);
  }
  add(prof && prof.fcmToken, null);
  return [...byToken.values()];
}

// Je chyba z FCM důkazem, že token je mrtvý? (invalid-argument jen když se týká tokenu —
// stejný kód může znamenat i vadný payload a ten nesmí mazat platná zařízení)
function isDeadTokenError(e) {
  const code = e && e.code;
  // mismatched-credential / sender-id-mismatch tu NEJSOU: Admin SDK je mapuje i na 403 PERMISSION_DENIED
  // (vypnuté FCM API, IAM) — to je chyba konfigurace serveru, ne mrtvý token
  if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') return true;
  return code === 'messaging/invalid-argument' && /token/i.test(e.message || '');
}

// Smaž neplatný token z profilu (mapa i legacy pole) — jen pokud tam ještě je, mezitím ho klient mohl obnovit
async function removeDeadToken(uid, prof, entry, expectedUpdatedAt) {
  const ref = db.doc(`users/${uid}/profile/main`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const d = snap.data();
    const args = [];
    for (const k of entry.mapKeys) {
      if (d.fcmTokens && d.fcmTokens[k] && d.fcmTokens[k].token === entry.token
        && (expectedUpdatedAt === undefined || d.fcmTokens[k].updatedAt === expectedUpdatedAt)) args.push(new FieldPath('fcmTokens', k), FieldValue.delete());
    }
    if (entry.legacy && d.fcmToken === entry.token) args.push('fcmToken', FieldValue.delete());
    if (args.length) tx.update(ref, ...args);
  });
  // Ať další push ve stejném běhu mrtvý token nezkouší znovu
  if (prof) {
    for (const k of entry.mapKeys) if (prof.fcmTokens) delete prof.fcmTokens[k];
    if (entry.legacy && prof.fcmToken === entry.token) delete prof.fcmToken;
  }
}

// Čištění mapy fcmTokens: záznamy starší než 60 dní pryč a nejvýše 10 nejnovějších (podle updatedAt)
const TOKEN_MAX_AGE_MS = 60 * 24 * 3600 * 1000;
const TOKEN_MAX_COUNT = 10;
async function pruneTokens(uid, prof) {
  const map = prof && prof.fcmTokens;
  if (!map || typeof map !== 'object') return;
  const ts = (v) => { const t = Date.parse(v && v.updatedAt); return isNaN(t) ? 0 : t; };
  const sorted = Object.entries(map).sort((a, b) => ts(b[1]) - ts(a[1]));
  const now = Date.now();
  const drop = sorted.filter(([, v], i) => i >= TOKEN_MAX_COUNT || now - ts(v) > TOKEN_MAX_AGE_MS);
  for (const [k, v] of drop) {
    const token = v && v.token;
    const entry = {token, mapKeys: [k], legacy: !!token && prof.fcmToken === token};
    try { await removeDeadToken(uid, prof, entry, v && v.updatedAt); }
    catch(e) { console.error(`[LP] Čištění tokenů selhalo uid=${uid}:`, e.message); }
  }
}

// Pošli push na všechna zařízení uživatele. Vrací {sent, lastError}; sent = počet zařízení, kam push odešel.
async function sendPushToUser(uid, prof, title, body, tag = 'lifepocket', options = {}) {
  await pruneTokens(uid, prof);
  const entries = collectTokens(prof);
  const results = await Promise.allSettled(entries.map(t => sendPush(t.token, title, body, tag, options)));
  let sent = 0;
  let lastError = null;
  // Pojistka: selžou-li VŠECHNY tokeny stejným kódem jiným než not-registered, jde nejspíš o chybu
  // serveru/konfigurace (ne o mrtvé tokeny) — nic nemažeme, jen logujeme kód
  const failed = results.filter(r => r.status === 'rejected');
  const failCodes = new Set(failed.map(r => r.reason && r.reason.code));
  const allFailedSameCode = entries.length > 0 && failed.length === entries.length && failCodes.size === 1
    && !failCodes.has('messaging/registration-token-not-registered');
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') { sent++; continue; }
    const e = results[i].reason;
    lastError = e;
    if (isDeadTokenError(e) && !allFailedSameCode) {
      try { await removeDeadToken(uid, prof, entries[i]); console.log(`[LP] Smazán neplatný token uid=${uid} (${e.code})`); }
      catch(delErr) { console.error(`[LP] Mazání tokenu selhalo uid=${uid}:`, delErr.message); }
    } else {
      console.error(`[LP] Push chyba uid=${uid}: ${e && e.code || ''} ${e && e.message || ''}`);
    }
  }
  return {sent, lastError};
}

// ── Test Push — ověření že FCM funguje ───────────────────────────────────────
exports.testPush = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;
  const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!profileSnap.exists) throw new HttpsError('not-found', 'Profil nenalezen.');
  const prof = profileSnap.data();
  if (!collectTokens(prof).length) throw new HttpsError('failed-precondition', 'FCM token není uložen. Znovu povol notifikace v nastavení.');
  const {sent, lastError} = await sendPushToUser(uid, prof, '🧪 Test push', 'Server → telefon funguje! Notifikace při zavřené appce jsou aktivní.', 'test-push');
  if (sent === 0) {
    throw new HttpsError('internal', 'FCM chyba: ' + (lastError && lastError.message || 'push se nepodařilo odeslat') + ' — zkus kliknout "Obnovit token" a test opakovat.');
  }
  return {ok: true, sent};
});

// ── Notify Family ─────────────────────────────────────────────────────────────
// Pošle push notifikaci všem členům rodinné skupiny (kromě odesílatele)
exports.notifyFamily = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;

  const {message: rawMessage, type: rawType} = request.data || {};
  if (!rawMessage || typeof rawMessage !== 'string') throw new HttpsError('invalid-argument', 'Chybí zpráva.');
  const message = rawMessage.slice(0, 200);
  // Typ z klienta jen z whitelistu a tag vždy s prefixem fam-, ať nejde přepsat cizí notifikaci (morning, habit-<id>…)
  const type = ['shop-update', 'family-notify'].includes(rawType) ? rawType : 'family-notify';

  // Načti profil odesílatele — potřebujeme familyId a jméno
  const senderSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!senderSnap.exists) throw new HttpsError('not-found', 'Profil nenalezen.');
  const senderProf = senderSnap.data();
  const familyId = senderProf.familyId;
  if (!familyId) throw new HttpsError('failed-precondition', 'Nejsi v rodinné skupině.');

  const senderName = String(senderProf.prezdivka || senderProf.nickname || 'Člen rodiny').slice(0, 40);

  // Načti členy skupiny
  const familySnap = await db.doc(`families/${familyId}`).get();
  if (!familySnap.exists) throw new HttpsError('not-found', 'Skupina nenalezena.');
  const members = familySnap.data().members || {};
  // Odesílatel musí být členem skupiny (familyId v profilu si může nastavit sám)
  if (!Object.prototype.hasOwnProperty.call(members, uid)) throw new HttpsError('permission-denied', 'Nejsi členem této skupiny.');

  // Pošli notifikaci všem zařízením všech členů kromě odesílatele
  let sent = 0;
  let membersReached = 0;
  for (const memberUid of Object.keys(members)) {
    if (memberUid === uid) continue;
    try {
      const memberSnap = await db.doc(`users/${memberUid}/profile/main`).get();
      if (!memberSnap.exists) continue;
      const memberProf = memberSnap.data();
      if (!collectTokens(memberProf).length) continue;
      const res = await sendPushToUser(memberUid, memberProf, `📣 ${senderName}`, message, `fam-${type}`);
      sent += res.sent;
      if (res.sent > 0) membersReached++;
    } catch(e) {
      console.error(`[LP] notifyFamily člen uid=${memberUid}:`, e.message);
    }
  }

  // sent = počet zařízení (kompatibilita se starým klientem), members = počet členů, kterým něco odešlo
  return {sent, members: membersReached};
});

// Je návyk dnes na řadě? Shodně s klientem (app.js): archivovaný a pozastavený ne,
// frekvence „konkrétní dny“ jen ve vybrané dny (dow = den v týdnu v Europe/Prague, 0 = neděle)
function isHabitDueToday(habit, today, dow) {
  if (habit.archived) return false;
  if (habit.pausedUntil && habit.pausedUntil >= today) return false;
  const freq = (typeof habit.freq === 'object' && habit.freq) ? habit.freq : {type: 'daily'};
  if (freq.type === 'days') return (Array.isArray(freq.days) ? freq.days : []).includes(dow);
  return true;
}

// ── Hlavní cron — každých 5 minut ────────────────────────
exports.sendScheduledNotifications = onSchedule(
  {schedule: 'every 5 minutes', timeZone: 'Europe/Prague', region: 'europe-west1'},
  async () => {
    const now = new Date();
    const pragueStr = now.toLocaleString('en-US', {timeZone: 'Europe/Prague'});
    const prague = new Date(pragueStr);
    // Bez sekund: kolísavé zpoždění startu cronu nesmí posunout výpočet diffMin u událostí
    prague.setSeconds(0, 0);
    const h = prague.getHours();
    const m = prague.getMinutes();
    const today = `${prague.getFullYear()}-${String(prague.getMonth()+1).padStart(2,'0')}-${String(prague.getDate()).padStart(2,'0')}`;
    const dow = prague.getDay(); // den v týdnu v Europe/Prague

    console.log(`[LP] Cron: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}, datum: ${today}`);

    // Klient zapisuje jen podkolekce (users/{uid}/profile/main …), kořenový dokument
    // neexistuje → get() by nic nevrátil. listDocuments() vrací i „chybějící“ rodiče.
    const userRefs = await db.collection('users').listDocuments();
    let sentTotal = 0; // počet skutečně odeslaných notifikací (zařízení)

    for (const userRef of userRefs) {
      const uid = userRef.id;
      try {
        const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
        if (!profileSnap.exists) continue;

        const prof = profileSnap.data();
        if (!collectTokens(prof).length) continue;
        const push = async (title, body, tag, options) => {
          const res = await sendPushToUser(uid, prof, title, body, tag, options);
          sentTotal += res.sent;
        };

        const ns = prof.notifSettings || {};
        const nickname = prof.prezdivka || prof.nickname || 'příteli';
        const a = prof.gender === 'f' ? 'a' : '';
        const morningTime = ns.morning || '08:00';
        // Dnešní návyky načteme nejvýš jednou na uživatele (sdílí ranní, večerní i připomínky)
        let dueCache = null;
        const getDueHabits = async () => {
          if (!dueCache) {
            const habitsSnap = await db.collection(`users/${uid}/habits`).get();
            dueCache = habitsSnap.docs.filter(d => isHabitDueToday(d.data(), today, dow));
          }
          return dueCache;
        };

        // ── Ranní notifikace ──
        if (ns.morningDigest !== false && isTimeMatch(h, m, morningTime)) {
          const total = (await getDueHabits()).length;
          const body = total > 0
            ? `Čeká tě ${total} návyk${total === 1 ? '' : total < 5 ? 'y' : 'ů'} na dnes. Pojď na to! ☀️`
            : 'Nový den, nová šance. Otevři LifePocket a nastav si cíle! ☀️';
          try { await push(`☀️ Dobré ráno, ${nickname}!`, body, 'morning'); }
          catch(e) { console.error(`[LP] ranní push uid=${uid}:`, e.message); }
        }

        // ── Večerní shrnutí ──
        if (ns.eveningDigest !== false) {
          const eveningTime = ns.evening || '21:00';
          if (isTimeMatch(h, m, eveningTime)) {
            const dueDocs = await getDueHabits();
            const total = dueDocs.length;
            const dueIds = new Set(dueDocs.map(d => d.id));
            const logsSnap = await db.collection(`users/${uid}/habitLogs`)
              .where('date', '==', today).where('done', '==', true).get();
            // Počítej jen splnění dnešních návyků (ne archivovaných / pozastavených)
            const done = logsSnap.docs.filter(l => {
              const hid = l.data().habitId || l.id.slice(0, -(today.length + 1));
              return dueIds.has(hid);
            }).length;
            let body;
            if (total === 0) body = 'Přidej si první návyk a začni budovat lepší rutinu!';
            else if (done === total) body = `🏆 Perfektní den! Splnil${a} jsi všech ${total} návyků!`;
            else if (done === 0) body = `Dnes jsi nesplnil${a} žádný návyk. Zítra to vyjde! 💪`;
            else body = `Splnil${a} jsi ${done} z ${total} návyků. Ještě ${total - done} zbývají!`;
            try { await push('🌙 Večerní shrnutí', body, 'evening'); }
            catch(e) { console.error(`[LP] večerní push uid=${uid}:`, e.message); }
          }
        }

        // ── Připomínky návyků ──
        if (ns.habits !== false) {
          for (const habitDoc of await getDueHabits()) {
            const habit = habitDoc.data();
            if (!habit.reminderTime) continue;
            if (!isTimeMatch(h, m, habit.reminderTime)) continue;
            // ID logu = ID dokumentu návyku (pole habit.id v datech není)
            const logId = `${habitDoc.id}_${today}`;
            const logSnap = await db.doc(`users/${uid}/habitLogs/${logId}`).get();
            if (logSnap.exists && logSnap.data().done) continue;
            try {
              await push(
                `${habit.emoji || '🔔'} ${habit.name}`,
                `${nickname}, ještě jsi dnes nesplnil${a} "${habit.name}". Teď je správný čas! 💪`,
                `habit-${habitDoc.id}`,
                { data: {habitId: habitDoc.id, date: today}, actions: [{action:'done', title:'✅ Splněno'}] }
              );
            } catch(e) { console.error(`[LP] habit push uid=${uid}:`, e.message); }
          }
        }

        // ── Narozeniny + Události — osobní i rodinné ──
        const todayMD = today.slice(5);
        const tmrwDate = new Date(prague);
        tmrwDate.setDate(tmrwDate.getDate() + 1);
        const tmrwMD = `${String(tmrwDate.getMonth()+1).padStart(2,'0')}-${String(tmrwDate.getDate()).padStart(2,'0')}`;

        // Sbírej události z osobního i rodinného kalendáře
        const evSnaps = [await db.collection(`users/${uid}/events`).get()];
        if (prof.familyId) {
          try {
            // Události skupiny jen skutečnému členovi (odebraný člen může mít v profilu staré familyId)
            const famSnap = await db.doc(`families/${prof.familyId}`).get();
            if (famSnap.exists && famSnap.data().members?.[uid]) {
              evSnaps.push(await db.collection(`families/${prof.familyId}/events`).get());
            }
          } catch(e) { /* rodina nemusí existovat */ }
        }
        const allEvDocs = evSnaps.flatMap(s => s.docs);

        for (const evDoc of allEvDocs) {
          const ev = evDoc.data();
          if (!ev.date) continue;

          // Narozeniny — ráno
          if (ev.type === 'birthday' && isTimeMatch(h, m, morningTime)) {
            const bday = ev.date.slice(5);
            if (bday === todayMD) {
              try { await push('🎂 Dnes jsou narozeniny!', `${nickname}, nezapomeň popřát: ${ev.name} 🎉`, `bday-${evDoc.id}`); }
              catch(e) { console.error(`[LP] bday push:`, e.message); }
            } else if (bday === tmrwMD) {
              try { await push('🎂 Zítra jsou narozeniny!', `${ev.name} slaví zítra — čas na přání nebo dárek! 🎁`, `bday-tmrw-${evDoc.id}`); }
              catch(e) { console.error(`[LP] bday-tmrw push:`, e.message); }
            }
          }

          // Události s časem — hodinu předem
          if (ev.type === 'event' && ev.time) {
            const evDate = ev.repeat === 'yes' ? today.slice(0,5) + ev.date.slice(5) : ev.date;
            if (evDate !== today) continue;
            const evTime = new Date(`${today}T${ev.time}:00`);
            const diffMin = Math.round((evTime - prague) / 60000);
            // Okno 5 minut = jeden běh cronu → upozornění jen jednou
            if (diffMin >= 58 && diffMin < 63) {
              try { await push(`📌 Za hodinu: ${ev.name}`, `${nickname}, za hodinu tě čeká: ${ev.name} v ${ev.time}`, `ev-${evDoc.id}-${today}`); }
              catch(e) { console.error(`[LP] event push:`, e.message); }
            }
          }
        }
      } catch(userErr) {
        console.error(`[LP] Chyba při zpracování uid=${uid}:`, userErr.message);
      }
    }

    console.log(`[LP] Cron hotovo, odesláno ${sentTotal} notifikací`);
  }
);
