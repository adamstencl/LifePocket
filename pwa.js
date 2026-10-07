// ── PWA: Service Worker ────────────────────────────────
// Manifest je statický (/manifest.json v index.html) — nepřepisovat blob URL.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {scope: '/'})
    .then(() => {})
    .catch(() => {});

  // Zprava ze SW — uzivatel klikl "Splneno" v notifikaci
  navigator.serviceWorker.addEventListener('message', async ev => {
    if (ev.data && ev.data.type === 'HABIT_DONE_FROM_NOTIF') {
      let handled = false;
      try {
        if (typeof window.handleNotifHabitDone === 'function') handled = await window.handleNotifHabitDone(ev.data);
      } catch (e) { /* handler selhal — akce se odloží */ }
      // Handler ji nezpracoval (appka se ještě nenačetla / nikdo přihlášený) — ulož stejně jako SW, zpracuje se při startu
      if (handled === false) savePendingAction(ev.data);
    }
  });
}

// Odloží akci "Splněno" do cache lp-pending (jen známá pole); klient ji zpracuje při příštím startu
function savePendingAction(d) {
  if (!('caches' in window)) return;
  const msg = {type: d.type, habitId: d.habitId, reminderId: d.reminderId, date: d.date,
    uid: typeof window.lpUid === 'function' ? window.lpUid() || undefined : undefined};
  caches.open('lp-pending')
    .then(c => c.put('pending-action', new Response(JSON.stringify(msg))))
    .catch(() => {});
}

// ── PWA: Install prompt ────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  hideInstallBanner();
  deferredPrompt = null;
});

function showInstallBanner() {
  // Nezobrazuj pokud je již nainstalováno
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  // Nezobrazuj na desktopu — banner je určen jen pro mobil
  if (!navigator.maxTouchPoints && window.innerWidth > 768) return;
  // Uživatel banner už zavřel — znovu ho nenabízet
  try { if (localStorage.getItem('pwa-dismissed')) return; } catch (e) { /* bez úložiště — ukaž */ }
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.style.display = 'flex';
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.style.display = 'none';
}

window.installPWA = async () => {
  if (!deferredPrompt) return;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  try {
    promptEvent.prompt();
    await promptEvent.userChoice;
  } catch (e) {
    console.warn('Instalace PWA selhala', e?.name);
  }
  hideInstallBanner();
};

window.dismissInstall = () => {
  hideInstallBanner();
  try { localStorage.setItem('pwa-dismissed', Date.now()); } catch (e) { /* bez úložiště — banner se může ukázat znovu */ }
};

// ── PWA: iOS návod (Safari nevyvolává beforeinstallprompt) ──
// Notifikace fungují na iPhonu jen v aplikaci přidané na plochu, proto se návod ukáže jednorázově.
function lpIsIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ se hlásí jako Macintosh, ale má dotykový displej
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function showIosBanner() {
  if (!lpIsIOS()) return;
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return;
  try { if (localStorage.getItem('ios-dismissed')) return; } catch (e) { /* bez úložiště — ukaž */ }
  const banner = document.getElementById('ios-banner');
  if (banner) banner.style.display = 'block';
}

window.dismissIosBanner = () => {
  const banner = document.getElementById('ios-banner');
  if (banner) banner.style.display = 'none';
  try { localStorage.setItem('ios-dismissed', '1'); } catch (e) { /* bez úložiště — ukáže se znovu */ }
};

window.addEventListener('load', () => setTimeout(showIosBanner, 3000));
