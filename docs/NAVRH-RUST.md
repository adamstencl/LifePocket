# Návrh UI pro růst (k bodům ze STRATEGIE.md)

Autor: ux-designer · 2026-10-07 · stav: návrh, nic není implementováno.

Výchozí stav, ze kterého návrh vychází (ověřeno v kódu):
- Nový návštěvník má téma **sunshine** (světlé), viz `loadTheme()` v app.js (`lp_theme || 'sunshine'`). Landing proto uvidí většina lidí **světlý**. Všechno níže používá jen tokeny `var(--…)`, takže funguje ve všech třech tématech (dark-gold, sunshine, tangerine).
- `meta theme-color` je teď `#faf8f0` a za běhu ho přepisuje `setTheme()` přes `querySelector('meta[name="theme-color"]')`, tedy **jen první** takovou značku. Druhou značku (např. s `media=`) nepřidávat.
- Přihlašovací obrazovka `#s-login` má jednu `.card` (ikona, `.logo-name`, `.logo-tag`, mřížka `.feats`, Google, e-mail, chyba, odkazy).
- Pozvánky: `shareGroupInvite(gid)` posílá `https://lifepocket.app/?join=KÓD`, `capturePendingJoin()` si kód uloží do `lp_pending_join` už před přihlášením.

Společná pravidla pro kodéra:
- Uživatelský text (název skupiny, jméno) do HTML vždy přes `esc()`, do handlerů přes `data-aN` / `data-gid`.
- Dotykové plochy alespoň 44×44 px. Vstupy na mobilu `font-size:16px` (pod 16 px iOS při fokusu zoomuje).
- Tlačítka s textem na `var(--accent)`: v tangerine má `#1a1a1a` na `#c94800` kontrast jen 3,7 : 1. Zavádím token `--on-accent` (níže) a v nových prvcích ho používám.
- Verze: `APP_VERSION` 4.26 → 4.27, záznam v `CHANGELOG`, `CACHE` v sw.js `lifepocket-v20` → `v21`.

Nový token (style.css, ke každému tématu):
```css
:root,[data-theme="dark-gold"],[data-theme="sunshine"]{--on-accent:#1a1a1a}
[data-theme="tangerine"]{--on-accent:#ffffff}
[hidden]{display:none!important}
```
Řádek s `[hidden]` je pojistka: nové sekce se přepínají atributem `hidden` a nesmí ho přebít žádné `display:flex`.

---

## 1. Landing pro nepřihlášené (uvnitř `#s-login`)

### Princip
Jedna obrazovka, dva stavy ve stejné `.card`:
1. **`#lp-landing`**: krátké představení a dvě tlačítka.
2. **`#auth-panel`**: stávající přihlášení (Google a e-mail) beze změny ID a handlerů.

„Začít zdarma“ otevře panel v režimu registrace, „Mám účet“ v režimu přihlášení. Kdo appku už zná, landing nevidí: když v `localStorage` je `lp_owner_uid` (někdy se tu přihlásil) nebo běží appka z plochy (`isStandaloneApp()`), otevře se rovnou `#auth-panel` v režimu přihlášení. Po odhlášení (`doLogout` → reload) tak člověk skončí rovnou u přihlášení.

Pořadí bloků vědomě měním oproti zadání: **tlačítka jsou hned pod hero větou, výhody až pod nimi.** Na 360×640 (reálně asi 360×560 s lištou prohlížeče) by se při pořadí hero → 4 výhody → tlačítka dostalo „Začít zdarma“ pod okraj obrazovky. Takhle je hlavní akce vidět bez scrollu a v dosahu palce, výhody si přečte ten, kdo scrolluje.

### Před / po (schéma mobilu 360 px)
```
PŘED                          PO (landing)                 PO („Začít zdarma“)
┌──────────────────────┐      ┌──────────────────────┐     ┌──────────────────────┐
│      [ikona 96]      │      │      [ikona 64]      │     │      [ikona 64]      │
│     LifePocket       │      │     LifePocket       │     │     LifePocket       │
│ Jedna appka místo…   │      │ Jedna appka místo    │     │ ← Zpět               │
│ ─────────────────    │      │ deseti. (H1)         │     │   ✨ Nový účet        │
│ [✨ ][🎯 ][🍽️]  3 sl. │      │ Návyky, kalendář…    │     │ [G Pokračovat přes G]│
│ [G Přihlásit přes G] │      │ (Zdarma, bez reklam) │     │ ── nebo e-mailem ──  │
│ ── nebo emailem ──   │      │ [  Začít zdarma   ]  │     │ [E-mail           ]  │
│ 🔑 Přihlásit se      │      │ [    Mám účet     ]  │     │ [Heslo         👁️ ]  │
│ [Email] [Heslo]      │      │ ─ Co v appce najdeš ─│     │ [  Vytvořit účet  ]  │
│ [Přihlásit se]       │      │ 🛒 Nákup pro rodinu  │     │ ← Zpět na přihlášení │
│ Zapomenuté… Regist.→ │      │ 🔥 Návyky a cíle     │     │ 🔒 Zdarma · Firebase │
│ 🔒 Zdarma · …        │      │ ✨ AI společník      │     │ Ochrana · Podmínky   │
│ Ochrana · Podmínky   │      │ 🗓️ Kalendář…         │     └──────────────────────┘
└──────────────────────┘      │ Ochrana · Podmínky   │
                              └──────────────────────┘
```

### HTML (index.html, nahrazuje obsah `<div class="screen" id="s-login">`)
```html
<div class="screen" id="s-login">
  <div class="card lp-card">
    <!-- ZACHOVAT beze změny: ikona (base64 img) a název -->
    <div class="app-icon-wrap"><img class="app-icon" src="data:image/png;base64,…" alt=""></div>
    <div class="logo-name">LifePocket</div>

    <!-- ── LANDING ── -->
    <section id="lp-landing" aria-labelledby="lp-hero-t">
      <h1 class="lp-hero" id="lp-hero-t">Jedna appka místo deseti.</h1>
      <p class="lp-sub">Návyky, kalendář, nákupy i poznámky na jednom místě. A celá rodina vidí, co je potřeba.</p>

      <div class="lp-invite" id="lp-invite" hidden>
        <span aria-hidden="true">🔗</span>
        <span>Máš pozvánku do skupiny. Založ si účet nebo se přihlas a hned se připojíš.</span>
      </div>

      <div class="lp-free">Zdarma, bez reklam, česky</div>

      <div class="lp-ctas">
        <button type="button" class="btn-p" id="lp-start-btn" onclick="showAuthPanel('register')">Začít zdarma</button>
        <button type="button" class="btn-s lp-have" onclick="showAuthPanel('login')">Mám účet</button>
      </div>

      <h2 class="lp-sec">Co v appce najdeš</h2>
      <ul class="lp-benefits">
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🛒</span>
          <div><div class="lp-b-t">Nákup pro celou rodinu</div>
          <div class="lp-b-d">Jeden seznam pro všechny. Co koupí partner, tobě se hned odškrtne.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🔥</span>
          <div><div class="lp-b-t">Návyky a cíle</div>
          <div class="lp-b-d">Sleduj série, plň malé kroky a koukej, jak se posouváš.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">✨</span>
          <div><div class="lp-b-t">AI společník</div>
          <div class="lp-b-d">Rex, Nora nebo jiný parťák ti poradí recept, naplánuje týden a podrží tě, když se nedaří.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🗓️</span>
          <div><div class="lp-b-t">Kalendář a připomínky</div>
          <div class="lp-b-d">Narozeniny, kroužky i schůzky. Upozornění ti přijde do telefonu.</div></div>
        </li>
      </ul>

      <div class="lp-legal">
        <a href="privacy.html" target="_blank" rel="noopener">Ochrana osobních údajů</a> ·
        <a href="terms.html" target="_blank" rel="noopener">Podmínky použití</a>
      </div>
    </section>

    <!-- ── PŘIHLÁŠENÍ (stávající prvky) ── -->
    <section id="auth-panel" hidden aria-labelledby="auth-mode-lbl">
      <button type="button" class="lp-back" onclick="showLanding()">← Zpět</button>
      <!-- auth-mode-lbl přesunut NAHORU panelu, jinak beze změny -->
      <div id="auth-mode-lbl" tabindex="-1" style="…stávající…">🔑 Přihlásit se</div>

      <button class="google-btn" id="login-btn" onclick="window.doLogin()" style="margin-bottom:14px">
        <svg …stávající…></svg>
        Pokračovat přes Google
      </button>
      <!-- oddělovač: text „nebo e-mailem“ -->
      <div id="email-login-form" …>
        <input id="email-inp" type="email" placeholder="E-mail" aria-label="E-mail" autocomplete="email" inputmode="email" …>
        <div …>
          <input id="pass-inp" type="password" placeholder="Heslo" aria-label="Heslo" autocomplete="current-password" …>
          <button type="button" id="pass-eye-btn" aria-label="Zobrazit heslo" …>👁️</button>
        </div>
        <button class="btn-p" id="email-login-btn" onclick="window.doEmailLogin()" …>Přihlásit se</button>
        <div id="email-register-fields" style="display:none;…">…beze změny…</div>
        <div class="lp-auth-links">
          <button type="button" class="lp-link" id="login-forgot" onclick="window.doPasswordReset()">Zapomenuté heslo?</button>
          <button type="button" class="lp-link" id="login-toggle-reg" onclick="window.toggleLoginMode('register')">Registrovat se →</button>
          <button type="button" class="lp-link" id="login-toggle-login" style="display:none" onclick="window.toggleLoginMode('login')">← Zpět na přihlášení</button>
        </div>
      </div>
      <div class="err" id="login-err" role="alert"></div>
      <div class="privacy">🔒 Zdarma · Data ve Firebase · AI přes Anthropic</div>
      <div class="lp-legal">…stejné dva odkazy…</div>
    </section>
  </div>
</div>
```

### Co se MUSÍ zachovat (jinak se rozbije přihlášení)
| Prvek | Proč |
|---|---|
| `#s-login` (id a třída `screen`) | `ss('s-login')` v `onAuthStateChanged` a v tlačítku „← Zpět“ na `#s-step1`. |
| `#login-btn` a `onclick="window.doLogin()"` | `doLogin()` a `resetLoginBtn()` ho hledají podle id a přepisují mu `innerHTML`. |
| `#email-inp`, `#pass-inp` | čtou je `doEmailLogin`, `doEmailRegister`, `doPasswordReset`, `togglePassVis`. |
| `#pass-eye-btn` | `togglePassVis()` mění text. |
| `#email-login-btn` | `toggleLoginMode()` mu mění text a `onclick`, `doEmail*` ho zakazují. |
| `#email-register-fields` | zůstává (i když je skrytý). |
| `#login-forgot`, `#login-toggle-reg`, `#login-toggle-login` | `toggleLoginMode()` přepíná `style.display` (`block`/`none`). Funguje i na `<button>`. |
| `#auth-mode-lbl` | `toggleLoginMode()` přepisuje text. |
| `#login-err` (třída `err`, `.show`) | všechny chybové hlášky. |
| `.app-icon`, `.logo-name` | jen vzhled, ale ponechat kvůli značce. |

Odstraňuje se: `.logo-tag`, `.divider` a mřížka `.feats` (nahrazuje je landing). CSS pro `.feats` může zůstat, nikde jinde se nepoužívá, smazat až při úklidu.

### JS (app.js, hned za `loadTheme();` kolem ř. 2645)
```js
// ── Landing / přihlášení ──
function showAuthPanel(mode){
  const l=document.getElementById('lp-landing'), a=document.getElementById('auth-panel');
  if(!l||!a) return;
  l.hidden=true; a.hidden=false;
  window.toggleLoginMode(mode==='register'?'register':'login');
  window.scrollTo(0,0);
  document.getElementById('auth-mode-lbl')?.focus({preventScroll:true}); // čtečka ohlásí „Nový účet“
}
window.showAuthPanel=showAuthPanel;
window.showLanding=()=>{
  document.getElementById('auth-panel').hidden=true;
  document.getElementById('lp-landing').hidden=false;
  document.getElementById('login-err')?.classList.remove('show');
  document.getElementById('lp-start-btn')?.focus({preventScroll:true});
};
function initLoginScreen(){
  let known=false; try{ known=!!localStorage.getItem('lp_owner_uid'); }catch(e){}
  if(known || isStandaloneApp()) showAuthPanel('login');
  const inv=document.getElementById('lp-invite');
  if(inv) inv.hidden=!readPendingJoin();
}
initLoginScreen();
```
- `readPendingJoin` a `isStandaloneApp` jsou deklarace funkcí v modulu, volání po nich funguje. `capturePendingJoin()` ale musí proběhnout **dřív** než `initLoginScreen()` (je na ř. ~4419). Volání `initLoginScreen()` proto dej **za** `capturePendingJoin();`, ne za `loadTheme()`.
- `toggleLoginMode()` doplnit o dvě věci: `pass-inp.autocomplete = isReg ? 'new-password' : 'current-password'` a u `#login-toggle-*` ponechat `display:'block'`.
- `resetLoginBtn()`: text `Přihlásit se přes Google` → `Pokračovat přes Google` (stejně jako ve statickém HTML, platí pro registraci i přihlášení).
- `togglePassVis()`: kromě textu měnit i `aria-label` („Zobrazit heslo“ / „Skrýt heslo“).
- Inline `onclick` v HTML volá `showAuthPanel` a `showLanding` přes `window`, proto přiřazení do `window`.

### CSS (style.css, za blok `/* LOGIN */`)
```css
/* LANDING */
.lp-hero{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:28px;line-height:1.2;color:var(--text);text-align:center;margin:14px 0 8px}
.lp-sub{font-size:17px;line-height:1.45;color:var(--text2);text-align:center;margin:0 auto 14px;max-width:34ch}
.lp-free{display:block;width:max-content;margin:0 auto 16px;padding:6px 14px;border:1px solid var(--border2);border-radius:50px;font-size:14px;font-weight:600;color:var(--green)}
.lp-ctas{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
.lp-ctas .btn-p{min-height:52px}
.lp-have{width:100%;min-height:48px;font-size:16px;color:var(--text);font-weight:600}
.lp-sec{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--text2);text-align:center;margin:0 0 10px}
.lp-benefits{list-style:none;display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.lp-benefit{display:flex;gap:12px;align-items:flex-start;background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
.lp-b-em{width:40px;height:40px;flex-shrink:0;border-radius:12px;background:var(--card3);display:flex;align-items:center;justify-content:center;font-size:22px}
.lp-b-t{font-size:16px;font-weight:700;color:var(--text);line-height:1.3}
.lp-b-d{font-size:14px;color:var(--text2);line-height:1.4;margin-top:2px}
.lp-invite{display:flex;gap:8px;align-items:flex-start;background:var(--card2);border:1px solid var(--accent);border-radius:12px;padding:10px 12px;font-size:15px;color:var(--text);margin-bottom:14px}
.lp-legal{text-align:center;font-size:13px;color:var(--text2);margin-top:10px}
.lp-legal a{color:var(--text2);text-decoration:underline;display:inline-block;padding:10px 4px}
.lp-back{background:none;border:none;color:var(--text2);font-family:'Crimson Pro',serif;font-size:15px;min-height:44px;padding:0 8px 0 0;cursor:pointer;margin:6px 0 2px}
.lp-auth-links{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px}
.lp-link{background:none;border:none;color:var(--accent);font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;min-height:44px;padding:0 4px;cursor:pointer}
.lp-card :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#s-login .card{width:440px}
#email-inp,#pass-inp{font-size:16px!important}
@media(max-width:480px){
  .screen>.card{padding:24px 18px;border-radius:24px}
  #s-login .app-icon{width:64px;height:64px;border-radius:16px}
  #s-login .logo-name{font-size:30px}
  .lp-hero{font-size:26px}
}
@media(prefers-reduced-motion:reduce){.app-icon{animation:none}.screen.active{animation:none}}
[data-theme="tangerine"] .logo-name{background:linear-gradient(135deg,#c94800,#b03a0a);-webkit-background-clip:text;background-clip:text}
```

Na co si dát pozor:
- `.card` se používá i pro widget Focus na dashboardu. Mobilní pravidlo proto cílí jen na `.screen>.card` (platí pro login a onboarding, kde se padding 44/40 px na 360 px stejně nevejde).
- `.lp-link` v sunshine: `#d4870a` na bílé má kontrast asi 3 : 1. Je to stejné jako dnes, ale tlačítka jsou nově 15px tučně a mají plochu 44 px. Pokud to revizor bude chtít řešit, změnit barvu na `var(--text)` s podtržením (backlog, neblokuje).
- Staré odkazy `color:#6a6a88` jsou nahrazené `var(--text2)` (na tmavé kartě měly kontrast pod 4,5 : 1).
- `.err` má natvrdo `#ff8080`, na bílé kartě je kontrast nízký. Doporučení (stačí jeden řádek): `[data-theme="sunshine"] .err,[data-theme="tangerine"] .err{color:var(--red)}`.
- Plovoucí banner „Nainstaluj LifePocket“ (`#pwa-banner`, `bottom:76px`) může na landingu překrýt výhody. Tlačítka jsou nahoře, takže to nevadí, jen ověřit, že banner nepřekryje „Mám účet“ na malém displeji.
- Text „AI společník“: mluvím o „Rexovi, Noře nebo jiném parťákovi“, protože si uživatel společníka vybírá v kroku 2 (`AVS`). Jen „Rex“ by sliboval něco, co si člověk pak přepne.

---

## 2. Meta a OG značky (index.html, `<head>`)

Stávající `<meta name="theme-color" content="#faf8f0">` **ponechat jako jedinou** (viz úvod). Ostatní přidat pod `<title>`:

```html
<title>LifePocket – návyky, kalendář a sdílené nákupy pro rodinu</title>
<meta name="description" content="Sdílený nákupní seznam pro rodinu, návyky, cíle, kalendář s připomínkami a AI společník. Česky, zdarma a bez reklam. Funguje v telefonu jako aplikace.">
<link rel="canonical" href="https://lifepocket.app/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="LifePocket">
<meta property="og:locale" content="cs_CZ">
<meta property="og:url" content="https://lifepocket.app/">
<meta property="og:title" content="LifePocket – jedna appka místo deseti">
<meta property="og:description" content="Společný nákup pro celou rodinu, návyky, kalendář a AI společník. Česky, zdarma, bez reklam.">
<meta property="og:image" content="https://lifepocket.app/og-image.png?v=1">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="LifePocket – jedna appka místo deseti. Sdílený nákup, návyky, kalendář a AI společník.">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LifePocket – jedna appka místo deseti">
<meta name="twitter:description" content="Společný nákup pro celou rodinu, návyky, kalendář a AI společník. Česky, zdarma, bez reklam.">
<meta name="twitter:image" content="https://lifepocket.app/og-image.png?v=1">
```
- URL obrázku musí být **absolutní**. Při každé změně obrázku zvýšit `?v=` (Facebook a WhatsApp náhledy dlouho cachují). Po nasazení ověřit ve Facebook Sharing Debuggeru.
- Odkaz `?join=KÓD` dostane stejný náhled, což je v pořádku.
- `title` je delší kvůli vyhledávačům. Název ikony na ploše se bere z `apple-mobile-web-app-title` a z manifestu, takže se nezmění.
- `og-image.png` nepatří do precache v sw.js.

### Náhledový obrázek 1200×630 (`/og-image.png`)
Tmavé pozadí se zlatou, stejně jako ikona appky. V tmavém i světlém feedu působí výrazně. Bez screenshotů, vpravo vektorová ilustrace sdíleného seznamu (ukazuje hlavní důvod sdílení).

```
0,0 ───────────────────────────────────────────────────────────── 1200
│  [ikona 120×120 @ (80,72), rx 28]                                 │
│                                                ┌───────────────┐  │
│  LifePocket            (y=300)                 │ 🧺 Nákup·Rodina│  │
│  Jedna appka místo deseti.  (y=372)            │ ✓ Mléko     (M)│  │
│                                                │ ✓ Rohlíky   (T)│  │
│  [🛒 Sdílený nákup] [🔥 Návyky a cíle] (y=420) │ ○ Jablka    (M)│  │
│  [🗓️ Kalendář    ] [✨ AI společník ] (y=492)  │ ○ Káva      (T)│  │
│                                                └───────────────┘  │
│  Zdarma · bez reklam · lifepocket.app   (y=588)                   │
└──────────────────────────────────────────────────────────────── 630
```

Přesné hodnoty pro SVG:
| Prvek | Pozice a velikost | Styl |
|---|---|---|
| Pozadí | 0,0 1200×630 | `#0c0c10` |
| Záře 1 | kruh cx 1080 cy 40 r 420 | `#f5c842`, opacity .16, `feGaussianBlur stdDeviation=120` |
| Záře 2 | kruh cx 80 cy 640 r 360 | `#e0954a`, opacity .12, stejný blur |
| Ikona | `<image href="icon-512.png">` x 80 y 72 w/h 120, clipPath rect rx 28 | jemný stín `#f5c842` opacity .25 |
| Název | text „LifePocket“, x 80, baseline y 300 | Playfair Display Italic 700, 88 px, výplň lineární gradient `#f5c842` → `#e0954a` → `#f5c842` (45°) |
| Hero | „Jedna appka místo deseti.“, x 80, baseline y 372 | Crimson Pro 600, 48 px, `#f0f0f5` |
| Čipy (2×2) | řádek 1 y 420, řádek 2 y 492, výška 56, rx 28; sloupec 1 x 80, sloupec 2 x 80+šířka1+16; šířka podle textu, vnitřní okraj 24 px | výplň `rgba(245,200,66,.08)`, obrys `rgba(245,200,66,.35)` 2 px, text Crimson Pro 600 28 px `#f0f0f5`, baseline +38 od horní hrany čipu |
| Texty čipů | „🛒 Sdílený nákup“, „🔥 Návyky a cíle“, „🗓️ Kalendář“, „✨ AI společník“ | |
| Patička | x 80, baseline y 588: „Zdarma · bez reklam · “ + „lifepocket.app“ | Crimson Pro 600 30 px, první část `#9090a8`, doména `#f5c842` |
| Karta seznamu | rect x 760 y 120 w 360 h 400, rx 28 | výplň `#16161c`, obrys `#252532` 2 px, stín `rgba(0,0,0,.5)` blur 40 |
| Hlavička karty | „🧺 Nákup · Rodina“, x 792 baseline y 176 | Playfair Display Italic 700, 30 px, `#f5c842` |
| Oddělovač | čára x 792–1088, y 200 | `#252532` 2 px |
| Položky (4) | řádky baseline y 260, 326, 392, 458; x 792 značka, x 836 text | značka: hotovo = kruh r 14 vyplněný `#3dd68c` s ✓ `#0c0c10`; nehotovo = kruh r 14 obrys `#52526a` 2 px. Text Crimson Pro 600 30 px: hotové `#9090a8` přeškrtnuté, nehotové `#f0f0f5` |
| Iniciály (kdo přidal) | kruh r 18 cx 1072, cy = baseline −10; M = `#5b9cf6`, T = `#e0954a` | písmeno Crimson Pro 700 20 px `#0c0c10`, na střed |

Technické poznámky ke skriptu (SVG → PNG):
- Renderer (resvg/sharp) **nestahuje webové fonty**. Fonty Crimson Pro a Playfair Display (TTF z Google Fonts) musí ležet lokálně a být předané rendereru.
- **Emoji:** bez nainstalovaného *Noto Color Emoji* se vykreslí prázdné čtverečky. Buď font přidat, nebo emoji v čipech a v hlavičce karty vynechat (layout funguje i bez nich, šířku čipů pak spočítat bez nich).
- Šířku čipů měřit až s načteným fontem, ne odhadem.
- Výsledné PNG držet **pod 300 kB** (WhatsApp větší náhledy někdy nezobrazí). Případně použít `pngquant`.
- Důležitý text je vlevo do x 700. WhatsApp na úzkém náhledu ořízne čtverec ze středu, logo a název tam zůstanou aspoň částečně, karta seznamu doplní obsah. Okraj 72 px od hran je bezpečný.
- Zdroj SVG uložit vedle skriptu (např. `scripts/og-image.svg`), PNG do kořene repa jako `og-image.png`.

---

## 3. „Sdílet LifePocket“ v Nastavení

### Umístění
Sekce „👨‍👩‍👧 Skupiny & sdílení“ (`index.html`, `.setsec` kolem ř. 864) obsahuje i podporu, dokumenty, kontakt a odhlášení. Nový blok vlož **těsně před nadpis `☕ Podpořit projekt`**: doporučení je nejlevnější forma podpory a dává smysl hned pod skupinami.

```html
<div class="setsec-t" style="margin-top:20px">💛 Doporuč LifePocket</div>
<div class="setsec-d">Nejvíc pomůžeš, když o appce řekneš kamarádům. Stačí jedno klepnutí.</div>
<button type="button" class="share-app-btn" onclick="shareApp()">📤 Sdílet LifePocket</button>
```
```css
.share-app-btn{width:100%;min-height:48px;background:var(--accent);color:var(--on-accent);border:none;border-radius:12px;font-family:'Crimson Pro',serif;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:20px}
.share-app-btn:focus-visible{outline:2px solid var(--text);outline-offset:2px}
```

### Text a logika (app.js, vedle `shareGroupInvite`, ř. ~4387)
```js
window.shareApp = async () => {
  const url  = 'https://lifepocket.app/';
  const text = 'Používám LifePocket: návyky, kalendář, poznámky a společný nákupní seznam pro celou rodinu v jedné appce. Česky, zdarma a bez reklam.';
  if (navigator.share) {
    try { await navigator.share({ title: 'LifePocket', text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; } // NotAllowedError apod. → kopírování
  }
  try { await navigator.clipboard.writeText(text + '\n' + url); toast('📋 Zkopírováno, vlož to kamarádům'); }
  catch (e) { prompt('Zkopíruj si odkaz:', url); }
};
```
- URL **nedávat do `text`**. Android jinak v některých aplikacích (WhatsApp) zobrazí odkaz dvakrát.
- Žádná uživatelská data, takže `esc()` není potřeba. Pokud se později přidá jméno („Adam tě zve…“), jde jen do textu pro `navigator.share` a schránku, nikdy do `innerHTML`.
- Zrušení sdílení (`AbortError`) je tiché, žádný toast.

---

## 4. Výraznější pozvánka do skupiny (Nákupy a Kalendář)

### Stavy
| Stav | Podmínka | Karta |
|---|---|---|
| `nogroup` | `!familyId` | „Nakupujete ve více lidech? / Plánujete ve více lidech?“ + **Pozvat rodinu** |
| `pending` | `familyId && !familyData` (skupina se právě zakládá) | stejná karta, tlačítko vypnuté „⏳ Chystám skupinu…“ |
| `alone` | ve skupině je 1 člen (`Object.keys(familyData.members).length <= 1`) a modul je sdílený (`shareShop` / `shareCal`) | „Ve skupině „{název}“ jsi zatím jen ty“ + **📤 Poslat pozvánku** |
| žádná karta | 2 a více členů, nebo skupina modul nesdílí (uživatel to tak chtěl), nebo karta zavřená pro tento stav | – |

Zavření se pamatuje **pro stav**: v `lp_ih_shop` / `lp_ih_cal` je uložený stav, ve kterém uživatel kartu zavřel (`'nogroup'` nebo `'alone'`). Když se stav změní (založí skupinu), karta se jednou ukáže znovu s novou výzvou. Klíče přidat do `LOCAL_PERSONAL_KEYS` (app.js ř. 480), ať se při přihlášení jiného účtu na stejném zařízení resetují.

### Texty
| | `nogroup` | `alone` |
|---|---|---|
| Nákupy, nadpis | Nakupujete ve více lidech? | Ve skupině „{esc(název)}“ jsi zatím jen ty |
| Nákupy, popis | Pozvi rodinu a budete mít jeden společný seznam. Co jeden koupí, druhému se hned odškrtne. | Pošli pozvánku a nákup uvidíte společně. |
| Kalendář, nadpis | Plánujete ve více lidech? | Ve skupině „{esc(název)}“ jsi zatím jen ty |
| Kalendář, popis | Pozvi rodinu a narozeniny, kroužky i návštěvy uvidíte všichni v jednom kalendáři. | Pošli pozvánku a události uvidíte společně. |
| Tlačítko | 👨‍👩‍👧 Pozvat rodinu | 📤 Poslat pozvánku |

(Záměrně „jsi zatím jen ty“, ne „jsi sám/sama“: bez rodu.)

### HTML sloty (index.html)
- Nákupy: `<div id="shop-invite-slot"></div>` hned **za** `#shop-empty` (konec `#shop-section-list`). Karta je pod seznamem nebo pod prázdným stavem, nikdy nepřekáží přidávání položek. V záložce Zásoby se schová sama.
- Kalendář: `<div id="cal-invite-slot"></div>` hned **za** `<div id="cal-events-list"></div>` v `.cal-right`.

### Komponenta (generuje JS)
```html
<div class="invite-hint" role="region" aria-label="Pozvánka pro rodinu">
  <span class="invite-hint-em" aria-hidden="true">👨‍👩‍👧</span>
  <div class="invite-hint-body">
    <div class="invite-hint-t">Nakupujete ve více lidech?</div>
    <div class="invite-hint-d">Pozvi rodinu a budete mít jeden společný seznam…</div>
    <button type="button" class="invite-hint-btn" onclick="inviteHintAction()">👨‍👩‍👧 Pozvat rodinu</button>
  </div>
  <button type="button" class="invite-hint-x" aria-label="Skrýt nabídku" data-a0="shop" onclick="dismissInviteHint(this.dataset.a0)">×</button>
</div>
```
```css
.invite-hint{display:flex;gap:12px;align-items:flex-start;background:var(--card2);border:1px dashed var(--border2);border-radius:var(--radius);padding:14px 4px 14px 14px;margin-top:16px}
.invite-hint-em{font-size:26px;line-height:1;flex-shrink:0;margin-top:2px}
.invite-hint-body{flex:1;min-width:0}
.invite-hint-t{font-size:16px;font-weight:700;color:var(--text);line-height:1.3;overflow-wrap:anywhere}
.invite-hint-d{font-size:14px;color:var(--text2);line-height:1.45;margin-top:3px}
.invite-hint-btn{margin-top:10px;min-height:44px;padding:10px 18px;border:none;border-radius:10px;background:var(--accent);color:var(--on-accent);font-family:'Crimson Pro',serif;font-size:15px;font-weight:700;cursor:pointer}
.invite-hint-btn:disabled{opacity:.6;cursor:default}
.invite-hint-x{flex-shrink:0;width:44px;height:44px;margin-top:-10px;background:none;border:none;border-radius:10px;color:var(--text2);font-size:22px;cursor:pointer}
.invite-hint-btn:focus-visible,.invite-hint-x:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
```
Proč plné tlačítko a ne obrysové: text v barvě `--accent` na `--card2` má v sunshine kontrast jen asi 3 : 1. Plné tlačítko s `--on-accent` projde ve všech třech tématech.

### JS (app.js, sekce skupin, kolem ř. 4400)
```js
function inviteHintState(where){
  if(!familyId) return 'nogroup';
  if(!familyData) return 'pending';
  const shared = where==='shop' ? familyData.shareShop : familyData.shareCal;
  if(!shared) return null;
  return Object.keys(familyData.members||{}).length <= 1 ? 'alone' : null;
}
function renderInviteHints(){ ['shop','cal'].forEach(renderInviteHint); }
function renderInviteHint(where){
  const slot=document.getElementById(where+'-invite-slot'); if(!slot) return;
  const st=inviteHintState(where);
  if(!st || lsGet('lp_ih_'+where)===st){ slot.innerHTML=''; return; }
  // texty z tabulky výše; název skupiny: esc(cutName(familyData.groupName,40)||'Skupina')
  slot.innerHTML = …;
}
window.dismissInviteHint = where => {
  if(where!=='shop' && where!=='cal') return;
  const st=inviteHintState(where); if(st && st!=='pending') lsSave('lp_ih_'+where, st);
  renderInviteHint(where);
};
window.inviteHintAction = async () => {
  if(!familyId){                               // 1. klepnutí: založ skupinu „Rodina“
    document.querySelectorAll('.invite-hint-btn').forEach(b=>{b.disabled=true;b.textContent='⏳ Chystám skupinu…';});
    await window.createFamily('Rodina');
    renderInviteHints();
    return;                                    // sdílení až dalším klepnutím (viz níže)
  }
  if(familyData) window.shareGroupInvite(familyId); // stávající odkaz ?join=
};
```
Napojení:
- `renderShop()`: zavolat `renderInviteHint('shop')` na začátku (před `if(!activeItems.length)…return`), aby se karta ukázala i u prázdného seznamu.
- `renderEvList()` (nebo konec `renderCal()`): `renderInviteHint('cal')`.
- Snapshot skupiny v `subscribeFamily` (ř. ~4690, za `renderFamilySettings();`): přidat `renderInviteHints();`. Jinak by po připojení druhého člena karta „jsi zatím jen ty“ visela dál, protože snapshot dnes přerenderuje jen Nastavení.
- `renderAfterFamilyChange()` volá `renderShop` i `renderCal`, takže odchod ze skupiny je pokrytý.
- `createFamily` rozšířit o volitelný parametr: `window.createFamily = async (presetName) => { … const groupName = cutName(typeof presetName==='string' ? presetName : nameInp?.value, 40) || 'Moje skupina'; …`. Inline `onclick="createFamily()"` v Nastavení dál funguje. Pozor: z inline handleru může přijít jako argument objekt události, proto `typeof === 'string'`.

Na co si dát pozor:
- **Proč dvě klepnutí** (založit, pak poslat): `navigator.share` vyžaduje čerstvé gesto uživatele. Po `await` na zápis do Firestore ho iOS Safari už nemusí uznat (`NotAllowedError`). Proto první klepnutí skupinu založí a karta se přepne na „Poslat pozvánku“.
- V `shareGroupInvite` je teď při `NotAllowedError` jen toast „Sdílení selhalo“. Doporučuji stejný fallback jako v bodě 3: při chybě jiné než `AbortError` zkopírovat do schránky. Je to malá změna ve stejném místě.
- Název skupiny je uživatelský text, takže vždy `esc()`. Do `onclick` nic dynamického, jen `data-a0` s pevnou hodnotou `shop`/`cal`.
- Po zavření karty se fokus ztratí (prvek zmizí). Stačí `document.getElementById('shop-inp')?.focus({preventScroll:true})` u Nákupů, u Kalendáře nic.
- Karta se nezobrazuje v Nastavení ani na dashboardu: tam už je úkol „Připoj se k rodině nebo pozvi blízkého“ v Quick Startu.

---

## 5. Onboarding šablony (Rodina / Student / Zdraví)

### Umístění
Žádná nová obrazovka. Do **kroku 3** (`#s-step3`, „Co chceš sledovat?“) přidat nad `#mods-primary` řádek šablon. Výběr šablony přepíše předvybrané moduly (dnes podle avatara přes `AVMODS`) a nabídne ukázkové návyky. Bez výběru se nic nemění, takže stávající cesta zůstává.

```html
<div class="slabel">🧩 Začni podle šablony</div>
<div class="tpl-row" role="radiogroup" aria-label="Šablona">
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="family" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">👨‍👩‍👧</span><span class="tpl-nm">Rodina</span><span class="tpl-ds">Nákupy, jídlo, kalendář</span>
  </button>
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="student" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">🎓</span><span class="tpl-nm">Student</span><span class="tpl-ds">Učení, rozvrh, cíle</span>
  </button>
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="health" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">💪</span><span class="tpl-nm">Zdraví</span><span class="tpl-ds">Pohyb, jídlo, spánek</span>
  </button>
</div>
<label class="tpl-samples" id="tpl-samples" hidden>
  <input type="checkbox" id="tpl-samples-chk" checked>
  <span>Přidat ukázkové návyky: <span id="tpl-samples-list"></span></span>
</label>
<button type="button" class="lp-link" id="tpl-clear" hidden onclick="pickTpl(null)">Bez šablony</button>
```
```css
.tpl-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.tpl-card{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:88px;padding:12px 6px;background:var(--card2);border:2px solid var(--border);border-radius:14px;cursor:pointer;font-family:'Crimson Pro',serif;color:var(--text);text-align:center}
.tpl-card[aria-checked="true"]{border-color:var(--accent);background:var(--card3)}
.tpl-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tpl-em{font-size:26px;line-height:1}
.tpl-nm{font-size:15px;font-weight:700}
.tpl-ds{font-size:13px;color:var(--text2);line-height:1.25}
.tpl-samples{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text2);margin:4px 0 12px;min-height:44px;cursor:pointer}
.tpl-samples input{width:20px;height:20px;margin-top:2px;accent-color:var(--accent);flex-shrink:0}
@media(max-width:380px){.tpl-ds{display:none}}
```
Vybraná karta se pozná rámečkem a pozadím, ne jen barvou (`aria-checked` pro čtečky). Ve 360 px vychází karta asi na 90 px šířky, proto se popisek pod 380 px skryje.

### Data šablon (app.js, za `AVMODS`, ř. 352)
Moduly odpovídají `MODS` (id: `rex, habits, journal, calendar, goals, cooking, shopping, mealplan, checklist`). `rex` a `checklist` přidá `finishOnboard` vždy sám. Návyky odpovídají polím ze `saveHabit()`: `type` `'yesno'|'count'`, `freq` `{type:'daily'}` / `{type:'weekly',times}` / `{type:'days',days:[0–6, 0 = neděle]}`, `group` `'morning'|'day'|'evening'`.

```js
const ONB_TPLS = {
  family: { mods:['shopping','mealplan','cooking','calendar','habits'], habits:[
    {name:'Společná večeře',   emoji:'🍽️', type:'yesno', goal:1, freq:{type:'daily'},          group:'evening'},
    {name:'Čas venku spolu',   emoji:'🌳', type:'yesno', goal:1, freq:{type:'weekly',times:3}, group:'day'},
    {name:'Hodina bez mobilu', emoji:'📵', type:'yesno', goal:1, freq:{type:'daily'},          group:'evening'},
  ]},
  student: { mods:['habits','calendar','goals','journal'], habits:[
    {name:'Učení 30 minut',    emoji:'📚', type:'yesno', goal:1,  freq:{type:'days',days:[1,2,3,4,5]}, group:'day'},
    {name:'Přečtené stránky',  emoji:'📖', type:'count', goal:10, freq:{type:'daily'},                 group:'evening'},
    {name:'Spát do 23:00',     emoji:'😴', type:'yesno', goal:1,  freq:{type:'daily'},                 group:'evening'},
  ]},
  health: { mods:['habits','goals','mealplan','cooking','journal'], habits:[
    {name:'Procházka 30 minut',emoji:'🚶', type:'yesno', goal:1, freq:{type:'daily'},          group:'day'},
    {name:'Porce zeleniny',    emoji:'🥗', type:'count', goal:3, freq:{type:'daily'},          group:'day'},
    {name:'Protažení',         emoji:'🧘', type:'yesno', goal:1, freq:{type:'weekly',times:3}, group:'morning'},
  ]},
};
```
Pitný režim do šablony Zdraví záměrně nedávám: vodu už řeší widget na dashboardu (`lp_water`), návyk by byl duplicitní.

### Logika
```js
let selTpl = null;
window.pickTpl = id => {
  selTpl = ONB_TPLS[id] ? id : null;
  selMods = new Set(selTpl ? ONB_TPLS[selTpl].mods : (AVMODS[selAv]||[]));
  rMods();
  document.querySelectorAll('.tpl-card').forEach(b => b.setAttribute('aria-checked', String(b.dataset.a0===selTpl)));
  const s=document.getElementById('tpl-samples'), c=document.getElementById('tpl-clear');
  if(s) s.hidden=!selTpl; if(c) c.hidden=!selTpl;
  const l=document.getElementById('tpl-samples-list');
  if(l && selTpl) l.textContent = ONB_TPLS[selTpl].habits.map(h=>h.emoji+' '+h.name).join(', '); // textContent, ne innerHTML
};
```
- `gS3()` (vstup do kroku 3) resetuje `selTpl=null` a `aria-checked`, aby šablona nezůstala viset po návratu „← Zpět“.
- V **původním** `finishOnboard` (ř. 2302) za `await setDoc(…profile…)` a **před** `initApp()`:
  ```js
  if(selTpl && document.getElementById('tpl-samples-chk')?.checked && selMods.has('habits')){
    prof.template = selTpl;
    const now = new Date().toISOString();
    await Promise.all(ONB_TPLS[selTpl].habits.map((h,i)=>addDoc(collection(db,'users',CU.uid,'habits'),
      {...h, freq:{...h.freq}, reminderTime:null, goalId:null, order:i+1, createdAt:now})));
  }
  ```
  Zápis do `users/{uid}/habits` pravidla povolují (vlastník). Pole `prof.template` je volitelné (do budoucna, např. pro tipy), uložit ho v témže `setDoc` jako zbytek profilu, tedy nastavit `prof.template` ještě před ním.
- Když uživatel v šabloně ručně vypne modul Návyky, ukázkové návyky se nepřidají (podmínka `selMods.has('habits')`).
- Chyba zápisu návyků nesmí zablokovat dokončení onboardingu: `try/catch` kolem `Promise.all`, při chybě jen `console.warn` a pokračovat na `initApp()`.
- U šablony Rodina se po startu sama ukáže karta „Nakupujete ve více lidech?“ z bodu 4 (uživatel ještě nemá skupinu), další krok tedy není potřeba.
- Uvítací průvodce (`startWelcomeTour` přes obal `finishOnboard` na ř. 9245) zůstává beze změny.

---

## Shrnutí pro kodéra: soubory a místa

| Bod | index.html | style.css | app.js |
|---|---|---|---|
| 1 Landing | obsah `#s-login` (ř. 58–117) | nové `.lp-*`, `.screen>.card` mobil, `--on-accent`, `[hidden]`, tangerine `.logo-name`, `.err` ve světlých tématech | `showAuthPanel`, `showLanding`, `initLoginScreen` (za `capturePendingJoin()`), `toggleLoginMode` (autocomplete), `resetLoginBtn` (text), `togglePassVis` (aria-label) |
| 2 Meta/OG | `<head>` | – | – (+ nový `og-image.png`, skript a SVG ve `scripts/`) |
| 3 Sdílet appku | blok před „☕ Podpořit projekt“ (ř. ~889) | `.share-app-btn` | `window.shareApp` u `shareGroupInvite` |
| 4 Pozvánka | sloty `#shop-invite-slot`, `#cal-invite-slot` | `.invite-hint*` | `renderInviteHint(s)`, `dismissInviteHint`, `inviteHintAction`, `createFamily(presetName)`, volání z `renderShop`, `renderEvList`, snapshotu skupiny, `LOCAL_PERSONAL_KEYS`, fallback v `shareGroupInvite` |
| 5 Šablony | řádek šablon v `#s-step3` | `.tpl-*` | `ONB_TPLS`, `pickTpl`, reset v `gS3`, přidání návyků v `finishOnboard` |

Pořadí implementace podle dopadu: 2 → 1 → 3 → 4 → 5. Body 2 a 3 jsou malé a nezávislé, bod 1 mění přihlášení, proto ho testovat zvlášť: Google, e-mail přihlášení, registrace, reset hesla, odkaz `?join=` u nepřihlášeného, odhlášení → návrat rovnou na přihlášení.

Otevřené otázky pro vedoucího (výchozí volba = moje doporučení):
1. Landing přeskakovat i v nainstalované PWA? **Ano** (kdo appku nainstaloval, ji zná).
2. Tlačítko „Pozvat rodinu“ zakládá skupinu rovnou s názvem „Rodina“, nebo nejdřív posílá do Nastavení? **Rovnou zakládat** (jedno klepnutí, přejmenovat jde kdykoli).
3. Barva podkladu OG obrázku: tmavá se zlatou, nebo světlá jako výchozí téma? **Tmavá** (sedí k ikoně a ve feedu je výraznější).
