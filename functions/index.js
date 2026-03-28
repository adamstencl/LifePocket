const {onSchedule} = require('firebase-functions/v2/scheduler');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

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
          icon: 'https://adamstencl.github.io/LifePocket/icon-192.png',
          badge: 'https://adamstencl.github.io/LifePocket/icon-192.png',
          tag,
          renotify: true,
        },
        fcmOptions: {link: 'https://adamstencl.github.io/LifePocket/'}
      }
    });
    console.log(`[LP] Push odeslan: ${title}`);
  } catch (e) {
    console.error(`[LP] sendPush chyba (${title}):`, e.message);
  }
}

// ── Hlavní cron — každých 5 minut ────────────────────────
exports.sendScheduledNotifications = onSchedule(
  {schedule: 'every 5 minutes', timeZone: 'Europe/Prague'},
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
          if (!habit.notifTime) continue;
          if (!isTimeMatch(h, m, habit.notifTime)) continue;

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

      // ── Narozeniny ──
      const morningTime = ns.morning || '08:00';
      if (isTimeMatch(h, m, morningTime)) {
        const eventsSnap = await db.collection(`users/${uid}/events`).get();
        const todayMD = today.slice(5);
        const tmrwDate = new Date(prague);
        tmrwDate.setDate(tmrwDate.getDate() + 1);
        const tmrwMD = `${String(tmrwDate.getMonth()+1).padStart(2,'0')}-${String(tmrwDate.getDate()).padStart(2,'0')}`;

        for (const evDoc of eventsSnap.docs) {
          const ev = evDoc.data();
          if (ev.type !== 'birthday' || !ev.date) continue;
          const bday = ev.date.slice(5);
          if (bday === todayMD) {
            promises.push(sendPush(fcmToken, '🎂 Dnes jsou narozeniny!', `${nickname}, nezapomeň popřát: ${ev.name} 🎉`, `bday-${evDoc.id}`));
          } else if (bday === tmrwMD) {
            promises.push(sendPush(fcmToken, '🎂 Zítra jsou narozeniny!', `${ev.name} slaví zítra — čas na přání nebo dárek! 🎁`, `bday-tmrw-${evDoc.id}`));
          }
        }
      }
    }

    await Promise.allSettled(promises);
    console.log(`[LP] Cron hotovo, odesláno ${promises.length} notifikací`);
  }
);
