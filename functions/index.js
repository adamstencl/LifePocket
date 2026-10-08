const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue, FieldPath} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// ── Claude Proxy ──────────────────────────────────────────────────────────────
// Volání Claude API ze serveru — klíč nikdy neopustí backend
const DAILY_LIMIT = 50;
// Strop vstupu (ochrana nákladů). Chat = systém (~2 000 + paměť 6 000 + kontext 7 000) + 10 zpráv;
// souhrn paměti posílá celou starší konverzaci v jedné zprávě, proto znaky s rezervou
const MAX_MESSAGES = 22;          // včetně systémové zprávy
const MAX_INPUT_CHARS = 60000;    // součet všech textů včetně systému
const DEFAULT_MAX_TOKENS = 500;
const MAX_TOKENS_CAP = 2000;
const CLAUDE_TIMEOUT_MS = 45000;

// Klíč z config/secrets: načte se jednou za instanci, neúspěch se necachuje (příště znovu)
let cachedClaudeKey = null;
async function getClaudeKey() {
  if (cachedClaudeKey) return cachedClaudeKey;
  const secretsSnap = await db.doc('config/secrets').get();
  if (!secretsSnap.exists) throw new HttpsError('not-found', 'Konfigurace AI není dostupná.');
  const secrets = secretsSnap.data();
  const claudeKey = secrets.claudeKey || secrets.cladeKey || secrets.ClaudeKey || secrets.claude_key;
  if (!claudeKey) throw new HttpsError('not-found', 'Claude API klíč není nastaven.');
  cachedClaudeKey = claudeKey;
  return claudeKey;
}

// Obsah zprávy: řetězec, nebo pole textových bloků {type:'text', text}. Vrací {content, chars} nebo null.
function normContent(c) {
  if (typeof c === 'string') return {content: c, chars: c.length};
  if (!Array.isArray(c) || c.length === 0) return null;
  const blocks = [];
  let chars = 0;
  for (const b of c) {
    if (!b || typeof b !== 'object' || b.type !== 'text' || typeof b.text !== 'string') return null;
    blocks.push({type: 'text', text: b.text});
    chars += b.text.length;
  }
  return {content: blocks, chars};
}

// Validace vstupu z klienta. Klient (callClaude v app.js) posílá systémový prompt jako zprávu
// s rolí 'system' (nejvýš jednu); ostatní role jen user/assistant. Vrací {system, messages, maxTokens}.
function validateClaudeInput(data) {
  const bad = (msg) => new HttpsError('invalid-argument', msg);
  const {messages, maxTokens} = data || {};
  if (!Array.isArray(messages) || messages.length === 0) throw bad('Chybí zprávy pro AI.');
  if (messages.length > MAX_MESSAGES) throw bad(`Příliš mnoho zpráv (max. ${MAX_MESSAGES}).`);
  let system = '';
  let hasSystem = false;
  let total = 0;
  const out = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') throw bad('Neplatná zpráva pro AI.');
    const norm = normContent(m.content);
    if (!norm) throw bad('Neplatný obsah zprávy (jen text).');
    total += norm.chars;
    if (m.role === 'system') {
      if (hasSystem) throw bad('Povolena je jen jedna systémová zpráva.');
      hasSystem = true;
      system = norm.content;
    } else if (m.role === 'user' || m.role === 'assistant') {
      out.push({role: m.role, content: norm.content});
    } else {
      throw bad('Neplatná role zprávy.');
    }
  }
  if (!out.length) throw bad('Chybí zpráva uživatele.');
  if (total > MAX_INPUT_CHARS) throw bad('Text pro AI je příliš dlouhý. Zkrať ho prosím.');
  const mt = (Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= MAX_TOKENS_CAP) ? maxTokens : DEFAULT_MAX_TOKENS;
  return {system, messages: out, maxTokens: mt};
}

// Vrácení odečteného dotazu (výpadek Anthropicu) — jen ve stejný den a nikdy pod 0
async function refundRate(rateRef, today) {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const d = snap.exists ? snap.data() : null;
      if (!d || d.date !== today || !(d.count > 0)) return;
      tx.update(rateRef, {count: FieldValue.increment(-1)});
    });
  } catch(e) { console.error('[LP] Vrácení AI limitu selhalo:', e.code || e.message); }
}

exports.claudeProxy = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  // 1. Auth check
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;

  // 2. Validace vstupu — před odečtem limitu, neplatný dotaz limit nespotřebuje
  const input = validateClaudeInput(request.data);

  // 3. Claude API klíč (cache v instanci; admin přístup, klient config/** číst nemůže)
  const claudeKey = await getClaudeKey();

  // 4. Rate limiting — max 50 AI volání za den (atomicky přes transakci,
  // aby paralelní requesty nemohly limit obejít)
  // Den počítáme v čase Europe/Prague (limit se nuluje o naší půlnoci, ne v UTC)
  const today = pragueDS(new Date());
  const rateRef = db.doc(`rateLimits/${uid}`);
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

  // 5. Zavolej Claude API
  const https = require('https');
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: input.maxTokens,
    system: input.system,
    messages: input.messages
  });

  let result;
  try {
    result = await new Promise((resolve, reject) => {
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
          // Neparsovatelné tělo (např. HTML stránka brány při 502) → body null, rozhodne status
          let parsed = null;
          try { parsed = JSON.parse(data); } catch(e) { /* nic */ }
          resolve({status: res.statusCode, body: parsed});
        });
        res.on('error', reject);
      });
      req.setTimeout(CLAUDE_TIMEOUT_MS, () => {
        const err = new Error('Claude API timeout');
        err.lpTimeout = true;
        req.destroy(err);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch(e) {
    // Timeout nebo síťová chyba = dotaz neproběhl → vrať odečtený limit
    await refundRate(rateRef, today);
    if (e && e.lpTimeout) throw new HttpsError('deadline-exceeded', 'AI neodpověděla včas. Zkus to prosím znovu.');
    throw new HttpsError('unavailable', 'AI je teď nedostupná. Zkus to prosím za chvíli.');
  }

  if (result.status !== 200) {
    const errType = result.body?.error?.type;
    const overloaded = result.status >= 500 || result.status === 529 || errType === 'overloaded_error';
    if (overloaded) {
      await refundRate(rateRef, today);
      throw new HttpsError('unavailable', 'AI je teď přetížená. Zkus to prosím za chvíli (dotaz se nezapočítal).');
    }
    // Neplatný klíč → příště načíst config/secrets znovu (klíč mohl být vyměněn)
    if (result.status === 401 || result.status === 403) cachedClaudeKey = null;
    const msg = result.body?.error?.message || `Claude API chyba: ${result.status}`;
    throw new HttpsError('internal', msg);
  }
  const content = result.body?.content?.[0]?.text;
  if (!content) throw new HttpsError('internal', 'Claude API: prázdná odpověď');

  return {text: content, remaining: DAILY_LIMIT - todayCount - 1};
});

// ── Helpers ──────────────────────────────────────────────
// Pražské datum YYYY-MM-DD pro daný okamžik
function pragueDS(date) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Prague'}).format(date);
}

// Pražský „nástěnný“ čas bez sekund: {prague (Date v lokální reprezentaci), h, m, today, dow, tmrwMD}
function pragueNow(date = new Date()) {
  const prague = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Prague'}));
  // Bez sekund: kolísavé zpoždění startu cronu nesmí posunout výpočet diffMin u událostí
  prague.setSeconds(0, 0);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const tmrw = new Date(prague);
  tmrw.setDate(tmrw.getDate() + 1);
  return {
    prague, h: prague.getHours(), m: prague.getMinutes(),
    today: ymd(prague), dow: prague.getDay(), // den v týdnu v Europe/Prague
    tmrwMD: ymd(tmrw).slice(5),
  };
}

// Čas spadá do 5min okna běhu cronu; porovnání v minutách dne, ať okno přechází přes hodinu i půlnoc (07:58, 23:57)
function isTimeMatch(h, m, timeStr) {
  if (!timeStr) return false;
  const [th, tm] = timeStr.split(':').map(Number);
  const t = th * 60 + tm, n = h * 60 + m;
  return ((n - t + 1440) % 1440) < 5;
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

// Události kolekce potřebné pro cron (místo celé kolekce):
// dnešní (date == today) + každoročně opakované (repeat == 'yes'); narozeniny zvlášť a jen když jsou potřeba.
// Vrací dokumenty bez duplicit, seřazené podle ID (stejné pořadí jako dřív celá kolekce).
async function loadTimedEvents(path, today) {
  const [todaySnap, repSnap] = await Promise.all([
    db.collection(path).where('date', '==', today).get(),
    db.collection(path).where('repeat', '==', 'yes').get(),
  ]);
  const byId = new Map();
  for (const d of [...todaySnap.docs, ...repSnap.docs]) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
async function loadBirthdays(path) {
  return (await db.collection(path).where('type', '==', 'birthday').get()).docs;
}

const CRON_BATCH = 20;

// ── Hlavní cron — každých 5 minut ────────────────────────
exports.sendScheduledNotifications = onSchedule(
  {schedule: 'every 5 minutes', timeZone: 'Europe/Prague', region: 'europe-west1', timeoutSeconds: 240},
  async () => {
    const {prague, h, m, today, dow, tmrwMD} = pragueNow();
    const todayMD = today.slice(5);

    console.log(`[LP] Cron: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}, datum: ${today}`);

    // Klient zapisuje jen podkolekce (users/{uid}/profile/main …), kořenový dokument
    // neexistuje → get() by nic nevrátil. listDocuments() vrací i „chybějící“ rodiče.
    const userRefs = await db.collection('users').listDocuments();
    let sentTotal = 0; // počet skutečně odeslaných notifikací (zařízení)

    // Skupiny: dokument a události čteme jednou za běh pro všechny členy (cache slibů podle familyId)
    const famCache = new Map();
    const famEntry = (fid) => {
      let e = famCache.get(fid);
      if (!e) {
        e = {doc: db.doc(`families/${fid}`).get(), events: null, bdays: null};
        e.doc.catch(() => {}); // chybu řeší každý člen sám (jako dřív), ne unhandled rejection
        famCache.set(fid, e);
      }
      return e;
    };
    const lazy = (e, key, fn) => {
      // Zamítnutý slib z cache smazat, ať další člen skupiny zkusí čtení znovu
      if (!e[key]) { const p = fn(); e[key] = p; p.catch(() => { if (e[key] === p) delete e[key]; }); }
      return e[key];
    };

    const processUser = async (uid) => {
      try {
        const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
        if (!profileSnap.exists) return;

        const prof = profileSnap.data();
        // Bez tokenu nemá smysl nic dalšího číst
        if (!collectTokens(prof).length) return;
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
        // Narozeniny se posílají jen v ranním čase uživatele → jen tehdy je čteme
        const bdayRun = isTimeMatch(h, m, morningTime);

        // Osobní kalendář
        const evGroups = [await loadTimedEvents(`users/${uid}/events`, today)];
        const bdayGroups = bdayRun ? [await loadBirthdays(`users/${uid}/events`)] : [];
        if (prof.familyId) {
          try {
            // Události skupiny jen skutečnému členovi (odebraný člen může mít v profilu staré familyId)
            const fid = prof.familyId;
            const fe = famEntry(fid);
            const famSnap = await fe.doc;
            if (famSnap.exists && famSnap.data().members?.[uid]) {
              evGroups.push(await lazy(fe, 'events', () => loadTimedEvents(`families/${fid}/events`, today)));
              if (bdayRun) bdayGroups.push(await lazy(fe, 'bdays', () => loadBirthdays(`families/${fid}/events`)));
            }
          } catch(e) { /* rodina nemusí existovat */ }
        }

        // Narozeniny — ráno
        for (const evDoc of bdayGroups.flat()) {
          const ev = evDoc.data();
          if (!ev.date || ev.type !== 'birthday') continue;
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
        for (const evDoc of evGroups.flat()) {
          const ev = evDoc.data();
          if (!ev.date || ev.type !== 'event' || !ev.time) continue;
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
      } catch(userErr) {
        console.error(`[LP] Chyba při zpracování uid=${uid}:`, userErr.message);
      }
    };

    // Dávky po 20 uživatelích paralelně; chyba jednoho neshodí běh
    for (let i = 0; i < userRefs.length; i += CRON_BATCH) {
      const res = await Promise.allSettled(userRefs.slice(i, i + CRON_BATCH).map(r => processUser(r.id)));
      res.forEach(r => { if (r.status === 'rejected') console.error('[LP] Cron uživatel selhal:', r.reason && r.reason.message); });
    }

    console.log(`[LP] Cron hotovo, odesláno ${sentTotal} notifikací`);
  }
);

// ── Denní anonymní statistiky pro správce ────────────────────────────────────
// Běží v 03:10 (Europe/Prague) a zapisuje jen souhrnná čísla do config/stats_daily/days/{den}.
// {den} = pražské datum VČEREJŠKA (poslední celý den). Okna active1d/7d/30d, newUsers a
// errorLogs24h se počítají od okamžiku běhu dozadu (24 h, 7 dní, 30 dní).
// aiCallsToday = součet rateLimits.count s date == {den}; kdo použil AI už po půlnoci, má
// v rateLimits nový den, takže jeho včerejší volání chybí (malé podhodnocení, přijatelné).
// Nikam se nezapisují ani nelogují uid, e-maily, jména ani texty. config/** je pro klienty zavřené.
const STATS_BATCH = 20;

// Čas v ms z ISO řetězce, Firestore Timestamp, Date nebo čísla; jinak null
function toMillis(v) {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v.toMillis === 'function') { try { return v.toMillis(); } catch(e) { return null; } }
  return null;
}

exports.dailyStats = onSchedule(
  {schedule: '10 3 * * *', timeZone: 'Europe/Prague', region: 'europe-west1', timeoutSeconds: 540},
  async () => {
    const now = Date.now();
    const DAY = 86400000;
    const statDay = pragueDS(new Date(now - DAY)); // včerejšek v Praze (03:10 − 24 h je vždy včera i přes změnu času)
    const s = {
      usersTotal: 0, active1d: 0, active7d: 0, active30d: 0,
      newUsers1d: 0, newUsers7d: 0, withPushToken: 0,
      familiesTotal: 0, familyMembersAvg: 0, aiCallsToday: 0,
      errorLogs24h: null, errorLogsTotal: null, profileErrors: 0,
    };

    // 1) Uživatelé a profily (paralelně po dávkách; chyba u jednoho neshodí běh)
    const userRefs = await db.collection('users').listDocuments();
    s.usersTotal = userRefs.length;
    const missingCreated = new Set(); // uid jen v paměti, pro dohledání v Auth; nikam se neukládá
    for (let i = 0; i < userRefs.length; i += STATS_BATCH) {
      const chunk = userRefs.slice(i, i + STATS_BATCH);
      const res = await Promise.allSettled(chunk.map(r => db.doc(`users/${r.id}/profile/main`).get()));
      res.forEach((r, j) => {
        if (r.status !== 'fulfilled') { s.profileErrors++; return; }
        if (!r.value.exists) { missingCreated.add(chunk[j].id); return; }
        const p = r.value.data() || {};
        const seen = toMillis(p.lastSeen);
        if (seen !== null) {
          const age = now - seen;
          if (age <= DAY) s.active1d++;
          if (age <= 7 * DAY) s.active7d++;
          if (age <= 30 * DAY) s.active30d++;
        }
        const created = toMillis(p.createdAt);
        if (created === null) missingCreated.add(chunk[j].id);
        else {
          if (now - created <= DAY) s.newUsers1d++;
          if (now - created <= 7 * DAY) s.newUsers7d++;
        }
        if (collectTokens(p).length) s.withPushToken++;
      });
    }

    // 2) Profil bez createdAt (starší účty, nedokončený onboarding) → datum vytvoření z Firebase Auth
    if (missingCreated.size) {
      try {
        const {getAuth} = require('firebase-admin/auth');
        let pageToken;
        do {
          const page = await getAuth().listUsers(1000, pageToken);
          for (const u of page.users) {
            if (!missingCreated.has(u.uid)) continue;
            const created = toMillis(u.metadata && u.metadata.creationTime);
            if (created === null) continue;
            if (now - created <= DAY) s.newUsers1d++;
            if (now - created <= 7 * DAY) s.newUsers7d++;
          }
          pageToken = page.pageToken;
        } while (pageToken);
      } catch(e) { console.error('[LP] dailyStats Auth:', e.code || e.message); }
    }
    missingCreated.clear();

    // 3) Rodinné skupiny
    try {
      const famSnap = await db.collection('families').get();
      s.familiesTotal = famSnap.size;
      let members = 0;
      famSnap.forEach(d => { const m = d.data().members; if (m && typeof m === 'object') members += Object.keys(m).length; });
      s.familyMembersAvg = famSnap.size ? Math.round(members / famSnap.size * 10) / 10 : 0;
    } catch(e) { console.error('[LP] dailyStats families:', e.code || e.message); }

    // 4) AI volání za den statistiky
    try {
      const rl = await db.collection('rateLimits').where('date', '==', statDay).get();
      rl.forEach(d => { const c = Number(d.data().count); if (c > 0) s.aiCallsToday += c; });
    } catch(e) { console.error('[LP] dailyStats rateLimits:', e.code || e.message); }

    // 5) Chyby: errorLogs.ts je ISO řetězec (UTC). Filtr na collection group potřebuje index
    // (single-field index pro rozsah collection group); bez něj spadneme na celkový počet.
    try {
      const since = new Date(now - DAY).toISOString();
      const agg = await db.collectionGroup('errorLogs').where('ts', '>=', since).count().get();
      s.errorLogs24h = agg.data().count;
    } catch(e) {
      console.error('[LP] dailyStats errorLogs24h bez indexu:', e.code || e.message);
      try { s.errorLogsTotal = (await db.collectionGroup('errorLogs').count().get()).data().count; }
      catch(e2) { console.error('[LP] dailyStats errorLogs:', e2.code || e2.message); }
    }

    await db.doc(`config/stats_daily/days/${statDay}`).set({
      ...s, date: statDay, generatedAt: new Date().toISOString(), version: 1,
    });
    console.log(`[LP] dailyStats ${statDay}: users=${s.usersTotal} a1=${s.active1d} a7=${s.active7d} a30=${s.active30d} `
      + `new1=${s.newUsers1d} new7=${s.newUsers7d} push=${s.withPushToken} fam=${s.familiesTotal} famAvg=${s.familyMembersAvg} `
      + `ai=${s.aiCallsToday} err24=${s.errorLogs24h} errAll=${s.errorLogsTotal} profErr=${s.profileErrors}`);
  }
);
