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
  if (Array.isArray(actions) && actions.length) { opts.actions = actions; opts.requireInteraction = d.sticky !== '0'; }
  return self.registration.showNotification(d.title || 'LifePocket', opts);
});

const CACHE = 'lifepocket-v72';
// Neměnné soubory z CDN (Firebase SDK s verzí v adrese, soubory fontů): cache-first, přežije update SW (4.74)
const CDN_CACHE = 'lp-cdn-v1';
const isImmutableCdn = u => u.startsWith('https://www.gstatic.com/firebasejs/') || u.startsWith('https://fonts.gstatic.com/');
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/i18n.js',
  '/i18n/cs.js',
  '/i18n/en.js', // oba slovníky kvůli přepnutí jazyka offline
  '/i18n/ai-cs.js', // prompty AI (fáze 5)
  '/i18n/ai-en.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/img/app-icon.jpg', // ikona na úvodní stránce
  '/img/ln-qr.jpg'     // QR v Nastavení (dřív base64 v index.html)
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 'lp-pending' drží čekající akce z notifikací — nesmí se smazat při updatu SW
  // Smaže i starší CDN cache (lp-cdn-*) kromě aktuální CDN_CACHE (4.75)
  const KEEP = [CACHE, 'lp-pending', CDN_CACHE];
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (isImmutableCdn(e.request.url)) { e.respondWith(cdnFirst(e.request)); return; }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(res => {
    if (res) return res;
    // Navigace bez cache zásahu — spadni na hlavní stránku appky
    if (e.request.mode === 'navigate') return caches.match('/index.html');
    return new Response('', {status: 503, statusText: 'Offline'});
  })));
});

// Z cache, jinak ze sítě a uložit (jen úspěšnou CORS odpověď, neprůhledné se neukládají)
// Nedostupná Cache API (soukromý režim apod.) nesmí požadavek shodit → rovnou síť
function cdnFirst(req) {
  return caches.open(CDN_CACHE).then(c => c.match(req)).catch(() => null).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok && res.type === 'cors') {
      const copy = res.clone();
      caches.open(CDN_CACHE).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  }));
}

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
// Zápis pití přes funkci (4.71): POST s podpisem, pak krátké tiché potvrzení (tag water) a zpráva běžící appce
const WQ_URL = 'https://europe-west1-lifepocket-d8f0e.cloudfunctions.net/waterQuickAdd';
const WQ_TIMEOUT = 5000;  // pak fallback na otevření appky
const WQ_SHOW = 4000;     // potvrzení samo zmizí
function waterQuick(data, ml, at) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = ac ? setTimeout(() => ac.abort(), WQ_TIMEOUT) : 0;
  return fetch(WQ_URL, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store', credentials: 'omit',
    body: JSON.stringify({u: data.u, at, ml, wt: data.wt}), signal: ac ? ac.signal : undefined,
  }).then(r => {
    clearTimeout(tm);
    if (!r.ok) throw new Error('wq ' + r.status);
    const title = typeof data.wtok === 'string' && data.wtok ? data.wtok.slice(0, 80) : '💧 +' + ml + ' ml';
    return self.registration.showNotification(title, {
      tag: 'water', silent: true, renotify: false, icon: '/icon-192.png', badge: '/icon-192.png',
      data: {open: 'water', wq: at},
    }).then(() => self.clients.matchAll({type: 'window', includeUncontrolled: true}))
      .then(clients => {
        // Appka data dostane ze snapshotu; zpráva uloží at do lp_wt_seen (dedup) a ukáže toast
        clients.forEach(c => c.postMessage({type: 'WATER_SYNCED', ml, at}));
        return new Promise(res => setTimeout(res, WQ_SHOW));
      })
      .then(() => self.registration.getNotifications({tag: 'water'}))
      .then(ns => ns.forEach(n => { if (n.data && n.data.wq === at) n.close(); })) // novější připomínku nechat
      .catch(() => {}); // zápis proběhl → potvrzení je jen doplněk, žádný fallback
  }, err => { clearTimeout(tm); throw err; });
}
function onNotifClick(e) {
  const raw = e.notification.data || {};
  // Notifikace zobrazená Firebase SDK: data serveru jsou v FCM_MSG.data; SDK handler se nespustí
  const fcm = raw.FCM_MSG;
  if (fcm) e.stopImmediatePropagation();
  const data = (fcm && fcm.data) || raw;
  e.notification.close();
  if (e.action === 'drink') {
    // Tlačítko „+2 dl“ u připomínky pití (4.67): s podpisem zapíše server (waterQuickAdd), jinak appka (zpráva / URL).
    // Tady jen tvar čísel; rozsah (50–1000 ml, max. 6 h zpět, dnešní den) a jednorázovost hlídá server i app.js
    const ml = /^\d{2,4}$/.test(String(data.drink)) ? Number(data.drink) : 0;
    const at = /^\d{12,14}$/.test(String(data.at)) ? Number(data.at) : 0;
    const open = () => openInApp({type: 'WATER_ADD', ml, at}, '/?open=water&drink=' + ml + '&at=' + at);
    // 4.71: s podpisem zapíše waterQuickAdd bez otevření appky; při chybě (offline, timeout, 4xx/5xx, 410 = včerejší) otevře appku
    if (ml && at && typeof data.wt === 'string' && typeof data.u === 'string') e.waitUntil(waterQuick(data, ml, at).catch(open));
    else if (ml && at) e.waitUntil(open());
    else e.waitUntil(openInApp({type: 'OPEN_TARGET', open: 'water', id: ''}, '/?open=water'));
  } else if (e.action === 'done') {
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
  } else if (data.open === 'pc') {
    // Výzva měsíce / týdne (4.63) → detail výzvy
    const cid = typeof data.cid === 'string' && /^(m-20\d{2}-(0[1-9]|1[0-2])|w-20\d{2}-W[0-5]\d)$/.test(data.cid) ? data.cid : '';
    e.waitUntil(openInApp({type: 'OPEN_TARGET', open: 'pc', id: cid}, '/?open=pc' + (cid ? '&id=' + encodeURIComponent(cid) : '')));
  } else if (['habit', 'habits', 'cal', 'water'].includes(data.open) || (!data.open && typeof data.habitId === 'string' && data.habitId)) {
    // Připomínka návyku → detail návyku, ranní/večerní přehled → Návyky, událost / narozeniny → Kalendář,
    // připomínka pití → Pitný režim
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
