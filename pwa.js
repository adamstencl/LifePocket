// ── PWA: Service Worker ────────────────────────────────
// Manifest je statický (/manifest.json v index.html) — nepřepisovat blob URL.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {scope: '/'})
    .then(() => {})
    .catch(() => {});

  // Zprava ze SW — uzivatel klikl "Splneno" v notifikaci
  navigator.serviceWorker.addEventListener('message', async ev => {
    if (ev.data && ev.data.type === 'HABIT_DONE_FROM_NOTIF') {
      if (typeof handleNotifHabitDone === 'function') {
        await handleNotifHabitDone(ev.data);
      }
    }
  });
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
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.style.display = 'flex';
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.style.display = 'none';
}

window.installPWA = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.result;
  deferredPrompt = null;
  hideInstallBanner();
};

window.dismissInstall = () => {
  hideInstallBanner();
  localStorage.setItem('pwa-dismissed', Date.now());
};
