// LifePocket Service Worker

// Klik na notifikaci: registrovat PŘED Firebase messaging. Notifikaci s payloadem "notification" zobrazí SDK
// (data má pod FCM_MSG) a jeho vlastní handler by jen otevřel odkaz; tenhle běží první a zastaví ho.
self.addEventListener('notificationclick', onNotifClick);

// Firebase pro push notifikace — obaleno v try-catch aby SW přežil výpadek CDN
let fmsg = null;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:"AIzaSyAwI761FoCCd6vWhXANRbOOQrVih_JDz0w",
    authDomain:"lifepocket-d8f0e.firebaseapp.com",
    projectId:"lifepocket-d8f0e",
    storageBucket:"lifepocket-d8f0e.firebasestorage.app",
    messagingSenderId:"763710336120",
    appId:"1:763710336120:web:84085b690117f605f8918d"
  });
  fmsg = firebase.messaging();
} catch(e) {
  console.warn('[SW] Firebase init failed (push notifikace nebudou fungovat):', e.message);
}

// Zpracování push notifikací na pozadí (appka zavřená)
// Payload s "notification" (webpush.notification ze serveru) zobrazí Firebase SDK samo, včetně tagu, akcí,
// zvuku/vibrace (silent:false, vibrate, renotify) a dat; dřív se tu ihned nahrazovala stejným tagem
// s renotify:false, což na některých Androidech (Samsung) notifikaci ztišilo. Proto se už nenahrazuje.
// Bez "notification" (jen data) ji složíme tady. Handler vždy vrací Promise (iOS ruší subscription u "tichých" pushů,
// u payloadu s notification ji ale SDK zobrazilo samo).
if (fmsg) fmsg.onBackgroundMessage(payload => {
  if (payload.notification) return Promise.resolve();
  const d = payload.data || {};
  let actions = [];
  try { actions = d.actions ? JSON.parse(d.actions) : []; } catch(e) { /* neplatné akce — bez tlačítek */ }
  const {tag, actions: _a, ...clickData} = d;
  const opts = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'lifepocket',
    // Zvuk a vibrace podle telefonu; souhrn ze skupiny (quiet) při nahrazení nezvoní znovu
    renotify: d.quiet !== '1',
    silent: false,
    vibrate: [200, 100, 200],
    data: clickData,
  };
  if (Array.isArray(actions) && actions.length) { opts.actions = actions; opts.requireInteraction = true; }
  return self.registration.showNotification(d.title || 'LifePocket', opts);
});

const CACHE = 'lifepocket-v43';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/i18n.js',
  '/i18n/cs.js',
  '/i18n/en.js', // oba slovníky kvůli přepnutí jazyka offline
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/img/qr-podpora.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 'lp-pending' drží čekající akce z notifikací — nesmí se smazat při updatu SW
  const KEEP = [CACHE, 'lp-pending'];
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(res => {
    if (res) return res;
    // Navigace bez cache zásahu — spadni na hlavní stránku appky
    if (e.request.mode === 'navigate') return caches.match('/index.html');
    return new Response('', {status: 503, statusText: 'Offline'});
  })));
});

// ── Klik na notifikaci nebo její tlačítko (registrováno nahoře, před Firebase) ──
// Okno appky: přednostně viditelné / zaměřené, jinak první
function pickClient(clients) {
  return clients.find(c => c.focused) || clients.find(c => c.visibilityState === 'visible') || clients[0];
}
// Zpráva do běžící appky a fokus, jinak nové okno s parametry v URL
function openInApp(msg, url) {
  return self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
    const c = pickClient(clients);
    if (c) {
      if (msg) c.postMessage(msg);
      return c.focus();
    }
    return self.clients.openWindow(url);
  });
}
function onNotifClick(e) {
  const raw = e.notification.data || {};
  // Notifikace zobrazená Firebase SDK: data serveru jsou v FCM_MSG.data; SDK handler se nespustí
  const fcm = raw.FCM_MSG;
  if (fcm) e.stopImmediatePropagation();
  const data = (fcm && fcm.data) || raw;
  e.notification.close();
  if (e.action === 'done') {
    // Datum z notifikace (den, pro který připomínka platí); jinak lokální dnešek (ne UTC).
    // Tady jen kontrola tvaru, rozsah (ne budoucnost, max. 14 dní) ověří app.js přes validNotifDate().
    const now = new Date();
    const localDate = (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date))
      ? data.date
      : now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const msg = {
      type: 'HABIT_DONE_FROM_NOTIF',
      habitId: data.habitId,
      reminderId: data.reminderId,
      date: localDate
    };
    e.waitUntil(
      self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
        const c = pickClient(clients);
        if (c) {
          c.postMessage(msg);
          c.focus();
        } else {
          return caches.open('lp-pending').then(c =>
            c.put('pending-action', new Response(JSON.stringify(msg)))
          );
        }
      })
    );
  } else if (data.open === 'grpfeed' && typeof data.gid === 'string' && /^[A-Z]{3,8}-[A-Z0-9]{4,8}$/.test(data.gid)) {
    // Upozornění ze skupiny → „Co je nového“: otevřené okno dostane zprávu, jinak se otevře s parametry v URL
    const mod = ['shop', 'cal', 'meal', 'check', 'pantry', 'habit', 'goal', 'react'].includes(data.module) ? data.module : '';
    e.waitUntil(openInApp({type: 'OPEN_GRPFEED', gid: data.gid, module: mod},
      '/?open=grpfeed&gid=' + encodeURIComponent(data.gid) + (mod ? '&m=' + mod : '')));
  } else if (['habit', 'habits', 'cal'].includes(data.open) || (!data.open && typeof data.habitId === 'string' && data.habitId)) {
    // Připomínka návyku → detail návyku, ranní/večerní přehled → Návyky, událost / narozeniny → Kalendář
    const open = data.open || 'habit';
    const id = open === 'habit' && typeof data.habitId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(data.habitId) ? data.habitId : '';
    e.waitUntil(openInApp({type: 'OPEN_TARGET', open, id},
      '/?open=' + open + (id ? '&id=' + encodeURIComponent(id) : '')));
  } else {
    e.waitUntil(openInApp(null, '/'));
  }
}

// Poznámka: Firebase onBackgroundMessage (výše) již zpracovává všechny FCM push notifikace.
// Ruční 'push' listener zde není potřeba — způsoboval by dvojité notifikace při zavřené appce.
