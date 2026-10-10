// LifePocket Service Worker

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
// Firebase SDK při payloadu s "notification" zobrazí notifikaci samo (tag/akce/data z webpush.notification),
// ale do tohoto handleru předá jen title/body/icon. Tag, akce a data proto server posílá i v top-level "data"
// a tady z nich notifikaci složíme znovu se stejným tagem — nahradí tu od SDK (žádný duplikát).
// Handler vždy vrací showNotification (iOS ruší subscription u "tichých" pushů).
if (fmsg) fmsg.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const d = payload.data || {};
  let actions = [];
  try { actions = d.actions ? JSON.parse(d.actions) : []; } catch(e) { /* neplatné akce — bez tlačítek */ }
  const {tag, actions: _a, ...clickData} = d;
  const opts = {
    body: n.body || d.body || '',
    icon: n.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'lifepocket',
    // Když už notifikaci ukázalo SDK, náhrada nesmí zapípat podruhé
    renotify: !payload.notification,
    data: clickData,
  };
  if (Array.isArray(actions) && actions.length) { opts.actions = actions; opts.requireInteraction = true; }
  return self.registration.showNotification(n.title || d.title || 'LifePocket', opts);
});

const CACHE = 'lifepocket-v37';
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

// ── Klik na tlačítko v notifikaci ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
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
        if (clients.length > 0) {
          clients[0].postMessage(msg);
          clients[0].focus();
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
    const msg = {type: 'OPEN_GRPFEED', gid: data.gid, module: mod};
    e.waitUntil(
      self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage(msg);
          return clients[0].focus();
        }
        return self.clients.openWindow('/?open=grpfeed&gid=' + encodeURIComponent(data.gid) + (mod ? '&m=' + mod : ''));
      })
    );
  } else {
    e.waitUntil(
      self.clients.matchAll({type: 'window'}).then(clients => {
        if (clients.length > 0) { clients[0].focus(); return; }
        return self.clients.openWindow('/');
      })
    );
  }
});

// Poznámka: Firebase onBackgroundMessage (výše) již zpracovává všechny FCM push notifikace.
// Ruční 'push' listener zde není potřeba — způsoboval by dvojité notifikace při zavřené appce.
