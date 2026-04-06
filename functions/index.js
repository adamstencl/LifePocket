const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// ── Claude Proxy ──────────────────────────────────────────────────────────────
// Volání Claude API ze serveru — klíč nikdy neopustí backend
exports.claudeProxy = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  // 1. Auth check
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;

  // 2. Rate limiting — max 50 AI volání za den
  const today = new Date().toISOString().slice(0, 10);
  const rateRef = db.doc(`users/${uid}/rateLimits/aiCalls`);
  const rateSnap = await rateRef.get();
  const rateData = rateSnap.exists ? rateSnap.data() : {};
  const todayCount = rateData.date === today ? (rateData.count || 0) : 0;
  const DAILY_LIMIT = 50;
  if (todayCount >= DAILY_LIMIT) {
    throw new HttpsError('resource-exhausted', `Denní limit ${DAILY_LIMIT} AI dotazů byl dosažen. Limit se obnoví zítra.`);
  }
  // Inkrementuj počítadlo
  await rateRef.set({date: today, count: todayCount + 1});

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

async function sendPush(token, title, body, tag = 'lifepocket') {
  try {
    await getMessaging().send({
      token,
      webpush: {
        notification: {
          title,
          body,
          icon: 'https://lifepocket.app/icon-192.png',
          badge: 'https://lifepocket.app/icon-192.png',
          tag,
          renotify: true,
        },
        fcmOptions: {link: 'https://lifepocket.app/'}
      }
    });
    console.log(`[LP] Push odeslan: ${title}`);
  } catch (e) {
    console.error(`[LP] sendPush chyba (${title}):`, e.message);
  }
}

// ── Test Push — ověření že FCM funguje ───────────────────────────────────────
exports.testPush = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;
  const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!profileSnap.exists) throw new HttpsError('not-found', 'Profil nenalezen.');
  const fcmToken = profileSnap.data().fcmToken;
  if (!fcmToken) throw new HttpsError('failed-precondition', 'FCM token není uložen. Znovu povol notifikace v nastavení.');
  await sendPush(fcmToken, '🧪 Test push', 'Server → telefon funguje! Notifikace při zavřené appce jsou aktivní.', 'test-push');
  return {ok: true};
});

// ── Notify Family ─────────────────────────────────────────────────────────────
// Pošle push notifikaci všem členům rodinné skupiny (kromě odesílatele)
exports.notifyFamily = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Přihlašte se prosím.');
  const uid = request.auth.uid;

  const {message, type} = request.data || {};
  if (!message) throw new HttpsError('invalid-argument', 'Chybí zpráva.');

  // Načti profil odesílatele — potřebujeme familyId a jméno
  const senderSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!senderSnap.exists) throw new HttpsError('not-found', 'Profil nenalezen.');
  const senderProf = senderSnap.data();
  const familyId = senderProf.familyId;
  if (!familyId) throw new HttpsError('failed-precondition', 'Nejsi v rodinné skupině.');

  const senderName = senderProf.prezdivka || senderProf.nickname || 'Člen rodiny';

  // Načti členy skupiny
  const familySnap = await db.doc(`families/${familyId}`).get();
  if (!familySnap.exists) throw new HttpsError('not-found', 'Skupina nenalezena.');
  const members = familySnap.data().members || {};

  // Pošli notifikaci všem členům kromě odesílatele
  const promises = [];
  for (const memberUid of Object.keys(members)) {
    if (memberUid === uid) continue;
    const memberSnap = await db.doc(`users/${memberUid}/profile/main`).get();
    if (!memberSnap.exists) continue;
    const fcmToken = memberSnap.data().fcmToken;
    if (!fcmToken) continue;
    promises.push(sendPush(fcmToken, `📣 ${senderName}`, message, type || 'family-notify'));
  }

  await Promise.allSettled(promises);
  return {sent: promises.length};
});

// ── Hlavní cron — každých 5 minut ────────────────────────
exports.sendScheduledNotifications = onSchedule(
  {schedule: 'every 5 minutes', timeZone: 'Europe/Prague', region: 'europe-west1'},
  async () => {
    const now = new Date();
    const pragueStr = now.toLocaleString('en-US', {timeZone: 'Europe/Prague'});
    const prague = new Date(pragueStr);
    const h = prague.getHours();
    const m = prague.getMinutes();
    const today = `${prague.getFullYear()}-${String(prague.getMonth()+1).padStart(2,'0')}-${String(prague.getDate()).padStart(2,'0')}`;

    console.log(`[LP] Cron: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}, datum: ${today}`);

    const usersSnap = await db.collection('users').get();
    const promises = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
      if (!profileSnap.exists) continue;

      const prof = profileSnap.data();
      const fcmToken = prof.fcmToken;
      if (!fcmToken) continue;

      const ns = prof.notifSettings || {};
      const nickname = prof.prezdivka || prof.nickname || 'příteli';
      const a = prof.gender === 'f' ? 'a' : '';

      // ── Ranní notifikace ──
      if (ns.morningDigest !== false) {
        const morningTime = ns.morning || '08:00';
        if (isTimeMatch(h, m, morningTime)) {
          const habitsSnap = await db.collection(`users/${uid}/habits`).get();
          const total = habitsSnap.size;
          const body = total > 0
            ? `Čeká tě ${total} návyk${total === 1 ? '' : total < 5 ? 'y' : 'ů'} na dnes. Pojď na to! ☀️`
            : 'Nový den, nová šance. Otevři LifePocket a nastav si cíle! ☀️';
          promises.push(sendPush(fcmToken, `☀️ Dobré ráno, ${nickname}!`, body, 'morning'));
        }
      }

      // ── Večerní shrnutí ──
      if (ns.eveningDigest !== false) {
        const eveningTime = ns.evening || '21:00';
        if (isTimeMatch(h, m, eveningTime)) {
          const habitsSnap = await db.collection(`users/${uid}/habits`).get();
          const total = habitsSnap.size;
          const logsSnap = await db.collection(`users/${uid}/habitLogs`)
            .where('date', '==', today).where('done', '==', true).get();
          const done = logsSnap.size;

          let body;
          if (total === 0) {
            body = 'Přidej si první návyk a začni budovat lepší rutinu!';
          } else if (done === total) {
            body = `🏆 Perfektní den! Splnil${a} jsi všech ${total} návyků!`;
          } else if (done === 0) {
            body = `Dnes jsi nesplnil${a} žádný návyk. Zítra to vyjde! 💪`;
          } else {
            body = `Splnil${a} jsi ${done} z ${total} návyků. Ještě ${total - done} zbývají!`;
          }
          promises.push(sendPush(fcmToken, '🌙 Večerní shrnutí', body, 'evening'));
        }
      }

      // ── Připomínky návyků ──
      if (ns.habits !== false) {
        const habitsSnap = await db.collection(`users/${uid}/habits`).get();
        for (const habitDoc of habitsSnap.docs) {
          const habit = habitDoc.data();
          if (!habit.reminderTime) continue;
          if (!isTimeMatch(h, m, habit.reminderTime)) continue;

          const logId = `${habit.id}_${today}`;
          const logSnap = await db.doc(`users/${uid}/habitLogs/${logId}`).get();
          if (logSnap.exists && logSnap.data().done) continue;

          promises.push(sendPush(
            fcmToken,
            `${habit.emoji || '🔔'} ${habit.name}`,
            `${nickname}, ještě jsi dnes nesplnil${a} "${habit.name}". Teď je správný čas! 💪`,
            `habit-${habit.id}`
          ));
        }
      }

      // ── Narozeniny + Události z kalendáře ──
      const eventsSnap = await db.collection(`users/${uid}/events`).get();
      const morningTime = ns.morning || '08:00';
      const todayMD = today.slice(5);
      const tmrwDate = new Date(prague);
      tmrwDate.setDate(tmrwDate.getDate() + 1);
      const tmrwMD = `${String(tmrwDate.getMonth()+1).padStart(2,'0')}-${String(tmrwDate.getDate()).padStart(2,'0')}`;

      for (const evDoc of eventsSnap.docs) {
        const ev = evDoc.data();
        if (!ev.date) continue;

        // Narozeniny — ráno
        if (ev.type === 'birthday' && isTimeMatch(h, m, morningTime)) {
          const bday = ev.date.slice(5);
          if (bday === todayMD) {
            promises.push(sendPush(fcmToken, '🎂 Dnes jsou narozeniny!', `${nickname}, nezapomeň popřát: ${ev.name} 🎉`, `bday-${evDoc.id}`));
          } else if (bday === tmrwMD) {
            promises.push(sendPush(fcmToken, '🎂 Zítra jsou narozeniny!', `${ev.name} slaví zítra — čas na přání nebo dárek! 🎁`, `bday-tmrw-${evDoc.id}`));
          }
        }

        // Události s časem — hodinu předem
        if (ev.type === 'event' && ev.time) {
          const evDate = ev.repeat === 'yes' ? today.slice(0,5) + ev.date.slice(5) : ev.date;
          if (evDate !== today) continue;
          const evTime = new Date(`${today}T${ev.time}:00`);
          const diffMin = Math.round((evTime - prague) / 60000);
          if (diffMin >= 55 && diffMin <= 65) {
            promises.push(sendPush(fcmToken, `📌 Za hodinu: ${ev.name}`, `${nickname}, za hodinu tě čeká: ${ev.name} v ${ev.time}`, `ev-${evDoc.id}-${today}`));
          }
        }
      }
    }

    await Promise.allSettled(promises);
    console.log(`[LP] Cron hotovo, odesláno ${promises.length} notifikací`);
  }
);
