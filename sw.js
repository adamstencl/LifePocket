// LifePocket Service Worker
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

const fmsg = firebase.messaging();

// Zpracování push notifikací na pozadí (appka zavřená)
fmsg.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'LifePocket', {
    body: n.body || '',
    icon: n.icon || '/LifePocket/icon-192.png',
    badge: '/LifePocket/icon-192.png',
    tag: payload.data?.tag || 'lifepocket',
  });
});

const CACHE = 'lifepocket-v2';
const OFFLINE_URLS = [
  '/LifePocket/',
  '/LifePocket/index.html',
  '/LifePocket/app.js',
  '/LifePocket/style.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── Klik na tlačítko v notifikaci ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  if (e.action === 'done') {
    const msg = {
      type: 'HABIT_DONE_FROM_NOTIF',
      habitId: data.habitId,
      reminderId: data.reminderId,
      date: new Date().toISOString().slice(0, 10)
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
        return self.clients.openWindow('/LifePocket/');
      })
    );
  }
});

// ── Push notifikace (Web Push API) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    e.waitUntil(
      self.registration.showNotification(data.title || 'LifePocket', {
        body: data.body || '',
        icon: data.icon || '/LifePocket/icon-192.png',
        badge: '/LifePocket/icon-192.png',
        tag: data.tag || 'lifepocket',
        data: data.data || {},
        actions: data.actions || []
      })
    );
  } catch(err) { /* ignore */ }
});
