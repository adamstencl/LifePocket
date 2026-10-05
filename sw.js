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
if (fmsg) fmsg.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const opts = {
    body: n.body || '',
    icon: n.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: n.tag || payload.data?.tag || 'lifepocket',
    renotify: true,
    data: n.data || payload.data || {},
  };
  if (n.actions?.length) { opts.actions = n.actions; opts.requireInteraction = true; }
  self.registration.showNotification(n.title || 'LifePocket', opts);
});

const CACHE = 'lifepocket-v14';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png'
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
    // Lokální datum (ne UTC) — SW nemůže importovat toDS() z app.js
    const now = new Date();
    const localDate = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
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
