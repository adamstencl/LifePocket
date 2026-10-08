# Návrh vícejazyčnosti CZ / EN

Autor: analýza pro kodéra · 2026-10-08 · stav: návrh, nic není implementováno. Výchozí verze: `APP_VERSION 4.36`, `CACHE lifepocket-v30`. Čísla řádků v `functions/index.js` odpovídají pracovní kopii s rozpracovanými (necommitnutými) změnami.

Cíl: appka umí češtinu a angličtinu. Každá fáze je samostatná nasaditelná verze a čeští uživatelé po celou dobu nic nepoznají. Angličtina je do poslední fáze dostupná jen přes `?lang=en` (beta). Automatická volba podle prohlížeče se zapne až nakonec, kdy je přeložené všechno.

---

## 1. Inventura textů

Čísla jsou odhady skriptem: fragmenty řetězců s českou diakritikou mimo komentáře. Texty bez diakritiky („Ahoj“, „Checklist“) v nich nejsou, skutečný počet je asi o 15–20 % vyšší.

| Oblast | Kde | Rozsah | Poznámka |
|---|---|---|---|
| Statické HTML | `index.html` (1 187 ř.) | ~310 unikátních textových uzlů, ~1 200 slov | landing `index.html:96-131`, přihlášení `:138-178`, onboarding `:181-255`, stránky `p-*` od `:264`, nastavení `:841+` |
| Atributy v HTML | `index.html` | 21× `placeholder`, 8× `aria-label`, 5× `title`, 3× `alt` | např. `:155` `placeholder="E-mail"` |
| Inline handlery s českým textem | `index.html` | 15× | texty v `onclick="…"`, při převodu přesunout do JS |
| Šablony v app.js | `app.js` (10 764 ř.) | ~1 450 unikátních fragmentů, ~1 300 řádků (bez CHANGELOG ~1 230) | rozpad níže |
| Toasty | `app.js:709` `toast()` | 229 volání | většina s pevným textem |
| Potvrzení a dotazy | `app.js` | 16× `confirm()`, 4× `prompt()` | např. `:942`, `:2842`, `:5407`, `:6170`, `:7128` |
| Chybové hlášky | `userErr()` `app.js:534`, `AUTH_MSGS` `:540`, Auth mapy `:3038`, `:3202`, `:3222` | ~40 | mapa kód → text, snadno převoditelné |
| placeholder / aria-label / title v šablonách | `app.js` | 29 / 15 / 27 | např. `:6273` `aria-label="Smazat ${meal}…"` |
| AI prompty | `app.js` | 16 systémových promptů | `:3472`, `:4439`, `:4528`, `:4577`, `:6320`, `:6511`, `:6535`, `:7262`, `:8259`, `:8613`, `:8653`, `:9351`, `:9435`, `:9916`, `:10207`, `:10249`; kontext chatu `buildChatContext()` `:8321`, `CTX_DOW*` `:8287-8288` |
| CHANGELOG | `app.js:45-385` | 63 verzí, 213 položek | uživatel vidí jen záznam aktuální verze (`checkChangelog()` `:386`) |
| Lokální notifikace | `app.js` `sendNotif()` (12×), obsah `:4263+` | ~30 | připomínky, narozeniny |
| Notifikace na serveru | `functions/index.js` | ~15 textů push + 36× `HttpsError` | `testPush` `:415`, `notifyFamily` `:460`, cron `:562-657`, ruční skloňování `:562` |
| E-maily / Auth šablony | Firebase konzole (ne v repu) | 2 šablony | `sendEmailVerification` `app.js:3219`, `sendPasswordResetEmail` `:3233`, `auth.languageCode` se dnes nenastavuje |
| privacy / terms | `privacy.html` (190 ř.), `terms.html` (121 ř.) | ~160 a ~60 odstavců | `lang="cs"`, právní text |
| manifest.json | `manifest.json` | `name`/`short_name` = značka, `description` „Osobní tracker pro celou rodinu“, `lang:"cs"` | změna = reinstalace PWA |
| Meta / OG | `index.html:3-33` | `<html lang="cs">`, title, description, 4× og, 2× twitter, `og:locale cs_CZ` | crawlery JS nespouští |
| Rozpoznávání řeči | `app.js:975`, `:8192`, `:8235` | 3× `lang='cs-CZ'` | |
| pwa.js, sw.js | | texty jen v komentářích, fallback titulek `'LifePocket'` | instalační bannery jsou v `index.html:42-66` |

Rozpad app.js podle modulů (fragmenty): jádro a onboarding 111 · poznámky 18 · návyky 96 · kalendář 44 · účet, přihlášení a paměť chatu 102 · téma a notifikace 137 · rychlý start a avatar 42 · rodina, landing a skupiny 86 · checklist 25 · jídelníček a statistiky 119 · dashboard a citáty 102 · vize a cíle 63 · kontext AI chatu 116 · nákupy 198 · vaření a recepty 88 · zásoby 48 · AI nad poznámkami a průvodce 115.

### České zvláštnosti (stav dnes)

**Pohlaví.** Profil má `prof.gender` (`'m'`/`'f'`, volba `index.html:189-190`, `app.js:3266`). Ve kódu se řeší třemi způsoby:
- přípona `${prof?.gender==='f'?'a':''}`: `app.js:4254`, `:4287`, `:8877-8878`, server `functions/index.js:546` (`const a = …`);
- lomítko „přidal/a“, „byl/a“, „odešel/odešla“: `app.js:3065`, `index.html:83`;
- tabulka `AVGREET[av][m|f]` `app.js:460`, volá se v `rDash()` `:7279`.

Asi 10 míst je natvrdo v mužském rodě: `:460` „Připraven?“, `:5061` „neporazitelný“, `:5119` „Chyběl jsi mi“, `:5426` „Opustil jsi“, `:5925`, `:5960` „Byl jsi“. Angličtina rod nepotřebuje.

**Skloňování čísel.** Správně jen 3 místa a každé ručně: `app.js:4878` (den/dny/dní), `:9746` (položka/položky/položek), `functions/index.js:562` (návyk/y/ů; pro 0 by vrátilo „návyky“). Jinde je pevný tvar, takže vznikají chyby typu „1 dní“, „2 položek“, „3 členů“: `:1224-1230`, `:2211`, `:3961`, `:4292-4296`, `:5116-5130`, `:7533`, `:8670` (porcí), `:8773`, `:8877`, `:8882`, `:8915`, `:9225`, `:9303`, `:9906`, `:9963`, `:10035`. Fáze 2 je opraví i pro češtinu.

**Datum a dny.** 28× `toLocaleDateString('cs-CZ', …)` / `toLocaleString('cs-CZ')`. Ručně psaná pole: `DAY_NAMES` `:1240`, `DAY_NAMES_SHORT` `:1546`, `DAYS_CS`/`MEALS_CS` `:6199-6200`, `MEAL_ACC` `:6263` (4. pád), `CTX_DOW`/`CTX_DOW_FULL` `:8287-8288`. Pozdrav podle hodiny `:7282`. Interní klíče dne `toDS()` `:1078` a `pragueDS()` `:621` zůstávají beze změny, nejsou to texty.

**`FAMILY_WORDS`** `app.js:5225` a `functions/index.js:895` (ADAM, ANNA, DOMA…) jsou jen tokeny v kódu skupiny a fungují i v angličtině. **Neměnit**: změna by vyžadovala nasazení `firestore.rules` a starší kódy by přestaly sedět.

**Hodnoty uložené jako český text (detail v kap. 4):**
- kategorie nákupu `SHOP_CATS` `:8830` a `catOrder` `:8788`, ve Firestore `shopItems.category`, `recurringShop.category`, v localStorage `lp_fav_shop`;
- kategorie cílů: `<select id="g-cat">` `index.html:1064-1068` s hodnotami `zdraví`, `práce`… se ukládá do `goals.category`, zobrazení přes `esc(g.category)` `app.js:8059`;
- oblasti vize `AREAS[].id` `:419-428` (`'zdraví'`, `'osobní rozvoj'`) jsou klíče `prof.visionAreas`;
- typ jídla receptu `mealType` (`'Oběd'`, `<select id="mr-diff">` `:9396-9397`, AI JSON `:8655`, `:9356`);
- jednotka `'ks'` v zásobách (`parseIngQty` `:9966`).

Už dnes stabilní klíče mají skupiny návyků (`morning/day/evening` `:1372`), jídelníček (`d0..d6`/`m0..m2`), typy událostí (`birthday/event` `:2018`), nálady (emoji) a moduly (`MODS[].id`).

**Recepty, šablony a citáty.** Ukázkové návyky `ONB_TPLS` `:442` se zapíšou do DB česky a pak jsou to data uživatele. `FALLBACK_QUOTES` `:7240`, `AVMSGS` `:461`, `MOODS` `:462`, `AVS[].vibe` `:412`, popisy `MODS` `:429`, `TOUR_MODULES` `:10480`. Recepty generované AI a uložené recepty jsou obsah uživatele a nepřekládají se.

---

## 2. Architektura

### 2.1 Soubory

```
i18n.js          // runtime: LANG, LOCALE, t(), tH(), tp(), fmt*, applyI18n()
i18n/cs.js       // export default { 'landing.hero': '…', … }
i18n/en.js       // stejné klíče
functions/i18n.js // malý slovník serveru (CommonJS), ~25 klíčů
```

**Doporučení: ES moduly, ne JSON.** Odpadá `fetch` a `JSON.parse`, plurály jsou objekty, jdou komentáře (kontext pro překladatele) a ci-check je načte přes `import()`. Klíče jsou plochá tečková jména `modul.místo.význam`, protože se dobře hledají grepem a kontrolují.

```js
// i18n/cs.js
export default {
  'landing.hero': 'Jedna appka místo deseti.',
  'nav.home': 'Domů',
  'habits.streak': { one: '{n} den v řadě', few: '{n} dny v řadě', many: '{n} dne v řadě', other: '{n} dní v řadě' },
  'notif.habitNag':   '{name}, ještě jsi dnes nesplnil „{habit}“.',
  'notif.habitNag#f': '{name}, ještě jsi dnes nesplnila „{habit}“.',
  'shop.cat.produce': 'Zelenina & ovoce',
};
// i18n/en.js
export default {
  'habits.streak': { one: '{n} day streak', other: '{n} day streak' },
  'notif.habitNag': '{name}, you haven’t done “{habit}” yet today.',
  // '#f' varianta v en není potřeba, t() spadne na základní klíč
};
```

### 2.2 Runtime `i18n.js`

```js
export const SUPPORTED = ['cs', 'en'];
export let LANG = 'cs', LOCALE = 'cs-CZ';
let D = {}, PR;
const missing = new Set();

export function resolveLang() {
  const q = new URLSearchParams(location.search).get('lang');   // 1. ?lang= (nejvyšší priorita)
  if (SUPPORTED.includes(q)) { try { localStorage.setItem('lp_lang', q); } catch(e){} return q; }
  let ls = null; try { ls = localStorage.getItem('lp_lang'); } catch(e){} // 2. profile.lang (cache z posledního přihlášení)
  if (SUPPORTED.includes(ls)) return ls;
  if (!AUTO_DETECT) return 'cs';                                   // do fáze 7 vypnuto
  const nav = (navigator.languages || [navigator.language || '']).map(x => String(x).slice(0,2).toLowerCase());
  return nav.find(l => l === 'cs' || l === 'sk') ? 'cs' : 'en';   // 3. navigator.language
}

export async function initI18n(appVersion) {
  LANG = resolveLang();
  LOCALE = LANG === 'en' ? 'en-GB' : 'cs-CZ';    // en-GB: týden od pondělí, 24 h, „8 Oct“
  document.documentElement.lang = LANG;
  D = (await import(`./i18n/${LANG}.js?v=${appVersion}`)).default; // jen aktivní jazyk
  PR = new Intl.PluralRules(LANG);
}

// t(): prostý text (textContent, toast, confirm). vars.g = 'f' zkusí klíč '#f'.
export function t(key, vars = {}) {
  let v = (vars.g === 'f' && D[key + '#f']) || D[key];
  if (v && typeof v === 'object') v = v[PR.select(Number(vars.n) || 0)] ?? v.other;
  if (v == null) { if (!missing.has(key)) { missing.add(key); console.warn('[i18n] chybí', key); } return key; }
  return v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
// tH(): do innerHTML; proměnné projdou esc(), slovník je důvěryhodný
export const tH = (key, vars = {}) =>
  t(key, Object.fromEntries(Object.entries(vars).map(([k, x]) => [k, k === 'n' || k === 'g' ? x : esc(x)])));
```

Pravidla pro kodéra:
- `tH()` do `innerHTML`, `t()` do `textContent`, toastů a `confirm()`. Pravidlo „uživatelský text vždy přes `esc()`“ tím platí dál. `esc()` se přesune z `app.js:715` do `i18n.js`, nebo se tam předá.
- Rod: `t('notif.habitNag', {name, habit, g: prof.gender})`. Kde to jde, píše se neutrálně („Dnes ještě není splněno“), aby `#f` varianty byly jen výjimka. Lomítka „přidal/a“ se nahradí `#f` variantou.
- Plurál: vždy `{n}` a objekt tvarů. Pro `cs` dává `Intl.PluralRules` `one` (1), `few` (2–4), `many` (desetinná čísla) a `other` (0, 5+), pro `en` `one` a `other`. Ruční `x===1?…:x<5?…` už nepsat (ci-check, kap. 2.8).

### 2.3 Načtení bez zpomalení startu

- `app.js` je modul (`index.html:1181`), takže na začátku stačí `await initI18n(APP_VERSION);`. Moduly umí top-level await (Safari 15+, Chrome 89+). Slovník musí být načtený dřív, než se cokoli vykreslí. Dnes se nejdřív ukáže `#s-loading` bez textu (`index.html:69`), takže uživatel nic neuvidí a nebliká.
- Abychom se vyhnuli vodopádu (app.js → i18n.js → slovník), přidá se do `<head>` hned za `pwa.js` (`index.html:38`) malý inline skript s preloadem:
  ```html
  <script>(function(){var l='cs';try{var q=new URLSearchParams(location.search).get('lang');l=q==='en'||q==='cs'?q:(localStorage.getItem('lp_lang')||'cs');}catch(e){}
  var k=document.createElement('link');k.rel='modulepreload';k.href='/i18n/'+(l==='en'?'en':'cs')+'.js';document.head.appendChild(k);})();</script>
  ```
  `?v=` v preloadu nebude, proto import v `initI18n` musí použít stejnou URL bez verze. Druhá možnost je verzi do inline skriptu nepsat a spoléhat na network-first SW. Doporučuji URL **bez** `?v=` (jednodušší, SW a CACHE bump to pokryjí).
- Velikost: ~2 000 klíčů × ~50 znaků ≈ 100 kB surově, po gzipu z GitHub Pages ~25–30 kB. Načítá se jen aktivní jazyk.
- Čeština je výchozí a české texty **zůstávají v `index.html`**. Pro `cs` se DOM nepřepisuje vůbec (nulová cena) a vyhledávače dál vidí češtinu.

### 2.4 Statické HTML: `data-i18n`

```html
<h1 class="lp-hero" id="lp-hero-t" data-i18n="landing.hero">Jedna appka místo deseti.</h1>
<input id="email-inp" type="email" placeholder="E-mail" aria-label="E-mail"
       data-i18n-attr="placeholder:auth.email;aria-label:auth.email">
<button class="google-btn" id="login-btn" …><svg>…</svg><span data-i18n="auth.google">Pokračovat přes Google</span></button>
<a href="privacy.html" data-i18n="legal.privacy" data-i18n-attr="href:legal.privacyUrl">Ochrana osobních údajů</a>
```

```js
export function applyI18n(root = document) {
  if (LANG === 'cs') return;                       // HTML je česky už ze souboru
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el =>
    el.dataset.i18nAttr.split(';').forEach(p => { const [a, k] = p.split(':'); el.setAttribute(a.trim(), t(k.trim())); }));
}
```

- Prvky, kde je text smíchaný s ikonou nebo SVG, dostanou obalový `<span data-i18n>`.
- `data-i18n-html` nezavádět. Text s tučným písmem se rozdělí na víc spanů.
- `applyI18n()` se volá jednou po `initI18n()`, pak `document.title = t('meta.title')` a `meta[name=description]`. Šablony vytvářené v JS volají rovnou `t()`.
- 15 inline handlerů s českým textem v `index.html` se přepíše na volání funkce, která text vezme z `t()`.

### 2.5 Datum a čísla přes `Intl`

```js
const _dtf = new Map();
export function fmtDate(d, preset) {           // preset: 'dm' | 'dmy' | 'wdm' | 'wdmy' | 'my' | 'wShortDm'
  const P = { dm:{day:'numeric',month:'short'}, dmy:{day:'numeric',month:'short',year:'numeric'},
    wdm:{weekday:'long',day:'numeric',month:'long'}, wdmy:{weekday:'long',day:'numeric',month:'long',year:'numeric'},
    my:{month:'long',year:'numeric'}, wShortDm:{weekday:'short',day:'numeric',month:'short'} };
  if (!_dtf.has(preset)) _dtf.set(preset, new Intl.DateTimeFormat(LOCALE, P[preset]));
  return _dtf.get(preset).format(d instanceof Date ? d : new Date(d + 'T12:00:00'));
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Názvy dnů od pondělí (UI je pondělní); cs 'short' vrací „po“, proto cap()
export function weekdayNames(style = 'short') {
  const f = new Intl.DateTimeFormat(LOCALE, { weekday: style });
  return [...Array(7)].map((_, i) => cap(f.format(new Date(2024, 0, 1 + i)))); // 1. 1. 2024 = pondělí
}
export const fmtNum = n => new Intl.NumberFormat(LOCALE).format(n);
```

- Nahradit 28 výskytů `'cs-CZ'` (grep `'cs-CZ'`) a pole `:1240`, `:1546`, `:6199`, `:8287-8288`.
- `CTX_DOW_FULL` pro AI kontext jde přes `fmtDate(now, …)` v jazyce odpovědi.
- `MEALS_CS` a `MEAL_ACC` (4. pád „Přidat snídani“) jsou klíče `meal.0..2` a `meal.add.0..2`. Intl pády neumí, proto slovník.
- Rozpoznávání řeči `:975`, `:8192`, `:8235`: `rec.lang = LOCALE`.
- `en-GB` místo `en-US` drží týden od pondělí a 24h čas, takže se nemusí sahat do mřížek kalendáře. US formát můžeme probrat později.

### 2.6 Volba a přepnutí jazyka

Pořadí od nejvyšší priority: `?lang=` → `profile.lang` (cache `lp_lang`) → `navigator.language` (od fáze 7, do té doby výchozí `cs`).

Po přihlášení (`onAuthStateChanged` `app.js:646`, po načtení profilu):
```js
if (prof.lang && prof.lang !== LANG && !sessionStorage.getItem('lp_lang_reload')) {
  sessionStorage.setItem('lp_lang_reload', '1'); localStorage.setItem('lp_lang', prof.lang); location.reload(); return;
}
if (!prof.lang) updateDoc(doc(db,'users',CU.uid,'profile','main'), { lang: LANG }); // server pak ví jazyk notifikací
```

**Přepnutí: doporučuji s reloadem.** Uloží se `profile.lang` a `lp_lang`, pak `location.reload()`.
- Proč: app.js má stovky šablon, které vkládají `innerHTML` jednou (modály, `buildNav()` `:7183`, cache v proměnných, `MODS`, `AVS`). Překreslení bez reloadu by vyžadovalo znovu vyvolat všechny `render*()` a otevřené modály, a zapomenuté místo by zůstalo ve starém jazyce. Přepíná se zřídka a reload trvá pod sekundu (SW cache).
- Přepínač bude v Nastavení vedle Vzhledu (`index.html:859`) jako `<select id="set-lang">` a na landingu malý odkaz „English / Česky“ (`?lang=en`).
- Pozor: `MODS`, `AVS`, `AREAS`, `AVGREET`… jsou konstanty vytvořené při načtení modulu. Musí se vytvořit až po `await initI18n()`, nebo jejich texty brát lazy přes funkci či getter (`name: () => t('mod.habits')`). Nejjednodušší je nechat konstanty s `id` a texty dohledávat při renderu: `t('mod.'+m.id+'.name')`.

### 2.7 Service worker

- `sw.js:58` `OFFLINE_URLS` doplnit o `'/i18n.js', '/i18n/cs.js', '/i18n/en.js'` (oba slovníky kvůli offline přepnutí, dohromady ~60 kB gzip). Strategie zůstává network-first.
- Každá změna slovníku znamená bump `CACHE` (pravidlo z CLAUDE.md).
- ci-check: v `checkCacheBump()` (`.github/scripts/ci-check.js:146`) rozšířit `WATCHED` o `'i18n.js', 'i18n/cs.js', 'i18n/en.js'`. Kontrola existence souborů v `OFFLINE_URLS` (`:59-73`) je už hotová.

### 2.8 Kontroly v `ci-check.js` (nová sekce „i18n“)

```js
console.log('i18n slovníky');
(async () => {
  const load = f => import(require('url').pathToFileURL(p(f)).href).then(m => m.default);
  const cs = await load('i18n/cs.js'), en = await load('i18n/en.js');
  const base = k => k.replace(/#f$/, '');
  // 1) stejné klíče (bez '#f' variant, ty smí být jen v cs)
  const kc = new Set(Object.keys(cs).map(base)), ke = new Set(Object.keys(en).map(base));
  [...kc].filter(k => !ke.has(k)).forEach(k => fail('en chybí klíč ' + k));
  [...ke].filter(k => !kc.has(k)).forEach(k => fail('cs chybí klíč ' + k));
  // 2) plurály: cs má one/few/other, en one/other; 3) stejné {proměnné} v obou jazycích
  const vars = v => JSON.stringify([...new Set(String(typeof v === 'object' ? Object.values(v).join(' ') : v).match(/\{\w+\}/g) || [])].sort());
  for (const k of kc) if (ke.has(k) && vars(cs[k]) !== vars(en[k])) fail('proměnné se liší: ' + k);
  // 4) každý použitý klíč existuje: t('…'), tH('…'), data-i18n="…", data-i18n-attr
  const used = [...appSrc.matchAll(/\bt[H]?\(\s*'([\w.#-]+)'/g), ...read('index.html').matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)]
    .flatMap(m => m[1].split(';').map(s => s.split(':').pop().trim()));
  used.filter(k => !(k in cs)).forEach(k => fail('klíč neexistuje: ' + k));
  // dynamické klíče (t('shop.cat.'+key)) jen s prefixem z allowlistu DYNAMIC_PREFIXES
})();
```

Další kontroly:
- **Ráčna na české literály** (stejně jako `FORBIDDEN` `:184`): spočítat fragmenty s diakritikou v řetězcích `app.js` mimo komentáře a mimo `CHANGELOG`. Na startu allowlist ~1 230. Nový výskyt shodí CI a každá fáze číslo sníží. To je hlavní ochrana proti zapomenutým textům.
- Totéž pro textové uzly v `index.html` bez `data-i18n` (start ~310).
- Zakázat nový ruční plurál `/===\s*1\s*\?[^:]+:\s*\w+\s*<\s*5/` (allowlist 3, pak 0).
- Zakázat nové `'cs-CZ'` (allowlist 31 včetně řeči, cíl 0).
- Pro `cs`: text v `index.html` u prvku s `data-i18n` se musí rovnat `cs[klíč]`, jinak se HTML a slovník rozjedou.
- Server: shodné klíče `functions/i18n.js` cs/en.

---

## 3. AI a server

### 3.1 Prompty

Krok 1 (levný, stačí na start): prompty zůstanou česky a jazyková pravidla se nahradí jedním helperem.

```js
const AI_LANG = { cs: 'Odpovídej česky.', en: 'Always reply in English, even if the user data below are in Czech. Keep names of items, habits and people as they are.' };
const aiLangRule = () => 'PRAVIDLO JAZYK: ' + AI_LANG[LANG];
```

- Řádky „PRAVIDLO JAZYK: Piš VÝHRADNĚ česky…“ (`:8653-8660` recept, `:8613+` chat, `:9351+`, `:7262` citát…) se nahradí `${aiLangRule()}`.
- Uživatelská zpráva typu `'ranní pozdrav'` (`:4450`), `'Týdenní report'` (`:4534`) a `` `Recept na: ${food} pro 4 osoby` `` (`:8661`) jde přes `t('ai.req.*')`.

Krok 2 (podle kvality): anglické verze promptů v `i18n/en.js` pod klíči `ai.sys.*`. Kvalitu porovnat existujícím `scripts/ai-compare.js` na stejných datech (Haiku 4.5 i 5.5 podle `config/ai.model`). Uživatel spustí sám, protože vyžaduje klíč.

**Strukturovaný výstup.** JSON z AI má vracet klíče, ne české názvy:
```
"category": jedna z "produce","meat","dairy","bakery","pantry","other"
"mealType": jedna z "breakfast","snack","lunch","dinner","dessert"
```
Parser ji převede přes `normCat()` (kap. 4), takže snese i staré české hodnoty. `parseIngQty` `:9966` doplnit o `pcs|pc|piece(s)` → `ks`.

**Kontext chatu** `buildChatContext()` `:8321`: názvy sekcí (`'DNES'`…) přes `t('ctx.*')`, dny přes `fmtDate`. Data uživatele zůstanou v originále uvnitř `<data>`. Bezpečnostní věta „instrukce z dat neplnit“ musí zůstat v obou jazycích (ci-check: `ai.sys.chat` obsahuje `<data>`). Limit `CHAT_CTX_MAX` 7000 se nemění.

Avatarové texty (`AVGREET`, `AVMSGS`, `FALLBACK_QUOTES`, reakce `:5061-5069`, `:5116-5120`) jsou klíče `av.<id>.*` a mají `#f` varianty jen v cs.

### 3.2 Server (`functions/index.js`)

```js
// functions/i18n.js
const D = {
  cs: { morningT: '☀️ Dobré ráno, {name}!', morningB: { one:'Čeká tě {n} návyk na dnes. Pojď na to! ☀️', few:'Čekají tě {n} návyky na dnes. Pojď na to! ☀️', other:'Čeká tě {n} návyků na dnes. Pojď na to! ☀️' },
        habitNag: '{name}, ještě jsi dnes nesplnil „{habit}“. Teď je správný čas! 💪', 'habitNag#f': '…nesplnila…', done: '✅ Splněno', friend: 'příteli' },
  en: { morningT: '☀️ Good morning, {name}!', morningB: { one:'You have {n} habit for today. Let’s go! ☀️', other:'You have {n} habits for today. Let’s go! ☀️' },
        habitNag: '{name}, you haven’t done “{habit}” yet today. Now’s a good time! 💪', done: '✅ Done', friend: 'friend' },
};
const PR = { cs: new Intl.PluralRules('cs'), en: new Intl.PluralRules('en') };
function tS(lang, key, vars = {}) {
  const L = D[lang] ? lang : 'cs';
  let v = (vars.g === 'f' && D[L][key + '#f']) || D[L][key] || D.cs[key] || key;
  if (typeof v === 'object') v = v[PR[L].select(vars.n || 0)] ?? v.other;
  return v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
module.exports = { tS };
```

- V cronu `:520-660`: `const L = prof.lang === 'en' ? 'en' : 'cs';` a všechny texty `push(...)` přes `tS(L, …, {g: prof.gender})`. Tím zmizí ruční plurál `:562` a přípona `a` `:546`.
- `notifyFamily` `:424`: titulek `📣 {sender}` je jazykově neutrální. Text zprávy píše klient odesílatele v jeho jazyce (`app.js:8877`). Doporučuji posílat `type` + `count` a text skládat na serveru podle `memberProf.lang` příjemce, protože ve smíšené rodině každý dostane svůj jazyk. Klient pošle `{type:'shop-update', count}` a server zachová fallback na `message` pro staré klienty.
- `HttpsError` (36×): zprávy nepřekládat na serveru. Klient je mapuje podle `code` v `userErr()` `:534`. Kde server vrací specifický text (např. `rotateGroupCode`), přidá se `details: {reason:'…'}` a klient ho přeloží.
- `data.tag` a `webpush.notification.tag` se nemění (pravidlo proti dvojitým notifikacím).
- Volitelně: `dailyStats` může počítat `langs: {cs, en}`.
- Mimo i18n, do backlogu: cron počítá v `Europe/Prague`, takže zahraniční uživatelé dostanou ranní notifikaci podle pražského času. Řešení je `profile.tz`, je to samostatný úkol.

### 3.3 Auth e-maily

- Před `sendEmailVerification` (`:3219`), `sendPasswordResetEmail` (`:3233`) a `signInWithPopup` nastavit `auth.languageCode = LANG;`.
- **Úkol pro uživatele (konzole):** Firebase → Authentication → Templates. Ověřit, jestli jsou šablony upravené jen česky. Upravená šablona se posílá ve zvoleném jazyce šablony a `languageCode` vybírá lokalizovanou výchozí verzi. Je potřeba zkontrolovat, že anglická verze (odesílatel, předmět) dává smysl.

---

## 4. Kategorie a hodnoty v databázi

**Doporučení: žádná migrace dat.** Dnešní české hodnoty prohlásíme za kanonické klíče a pro zobrazení je mapujeme.

Důvody:
- Sdílené `families/{id}/shopItems` mohou mít členy s různým jazykem.
- Na zařízeních běží starší verze PWA, které by klíč `produce` zobrazily jako text a řadily ho špatně (`catOrder` `:8788`).
- Migrace sdílených dokumentů by byla zápis do cizích dat bez možnosti návratu.

```js
// app.js, nákupy
const SHOP_CAT_KEYS = { 'Zelenina & ovoce':'produce', 'Maso & ryby':'meat', 'Mléčné výrobky':'dairy',
                        'Pečivo':'bakery', 'Trvanlivé':'pantry', 'Ostatní':'other' };
const SHOP_CAT_BY_KEY = Object.fromEntries(Object.entries(SHOP_CAT_KEYS).map(([v,k]) => [k,v]));
// Zápis: vždy kanonická (česká) hodnota, odkudkoli přijde vstup (UI klíč, AI klíč, starý text)
const normCat = c => SHOP_CAT_BY_KEY[c] || (c in SHOP_CAT_KEYS ? c : 'Ostatní');
// Zobrazení: překlad známé kategorie, neznámou (vlastní/AI) ukázat jak je
const catLabel = c => SHOP_CAT_KEYS[c] ? t('shop.cat.' + SHOP_CAT_KEYS[c]) : c;
```

Stejný vzor použít pro:
- `goals.category` (`zdraví` → `goal.cat.health`, zobrazení `:8059`, select `index.html:1064`: `value` zůstane české, text přes `data-i18n`);
- `AREAS[].id` / `prof.visionAreas` (klíč zůstává `'zdraví'`, popisek `t('area.'+a.key)`, `a.key` už existuje: `zdravi`, `prace`…);
- `mealType` (`'Oběd'` → `meal.type.lunch`);
- jednotku `'ks'` (zobrazení `t('unit.ks')` = „pcs“).

Data, která napsal uživatel (názvy položek, návyků, vlastní kategorie `customEvTypes`, `customAreaLabels`, recepty, zápisky), se nepřekládají. Ukázkové návyky `ONB_TPLS` se při onboardingu vytvoří v jazyce uživatele (klíče `tpl.family.h1`…) a pak jsou to jeho data.

Až budou za rok všechny klienty nové, můžeme zvážit přechod na anglické klíče. Pro tento projekt to ale není potřeba.

---

## 5. Fáze

Každá fáze = `APP_VERSION` + `CHANGELOG` (pokud je viditelná) + bump `CACHE`. Odhad zahrnuje práci kodéra a jedno kolo testu a review.

| # | Fáze | Obsah | Rozsah | Viditelné pro CZ |
|---|---|---|---|---|
| **0** | Základ (neviditelný) | `i18n.js`, `i18n/cs.js`, `i18n/en.js` (pár klíčů), `await initI18n()` na začátku app.js, preload v `<head>`, `OFFLINE_URLS`, `WATCHED`, ci-check sekce i18n a ráčny, `profile.lang` se zapisuje. `AUTO_DETECT = false`. | ~250 ř. nového kódu, 1 sezení | ne (jen CACHE bump) |
| **1** | **Landing + přihlášení + navigace** (první viditelný krok) | `#s-loading`, `#s-deleted`, landing `index.html:96-131`, `#auth-panel` `:138-178` včetně placeholderů a aria, Auth chyby (`AUTH_MSGS` `:540`, `:3038`, `:3202`, `:3222`), `auth.languageCode`, `buildNav()` `:7183` (popisky z `MODS` přes klíče), instalační bannery `index.html:42-66`, `document.title`/description, přepínač na landingu a v Nastavení, odkazy na privacy/terms podle jazyka (zatím obě vedou na CZ) | ~120 klíčů, 1–2 sezení | ne (EN jen přes `?lang=en`) |
| **2** | Datum, čísla, plurály | `fmtDate`/`weekdayNames`/`fmtNum`, 28× `'cs-CZ'`, pole dnů, řeč `LOCALE`, oprava ~20 chybných plurálů z kap. 1 přes `t(…,{n})` | ~60 klíčů, 1 sezení | **ano**: opravené „1 den / 2 dny / 5 dní“ |
| **3** | Onboarding, dashboard, nastavení, obecné | `#s-step1-3`, `AVS`, `MODS` popisy, `ONB_TPLS`, `rDash()`, `AVGREET`, citáty, nastavení `index.html:841+`, `userErr()`, `confirm/prompt` (20×), changelog modal | ~300 klíčů, 2 sezení | ne |
| **4a** | Návyky + kalendář + poznámky | `app.js:742-2843` + stránky `p-habits`, `p-habit-detail`, `p-calendar`, `p-journal` | ~250 klíčů, 2 sezení | ne |
| **4b** | Nákupy, zásoby, vaření, jídelníček, recepty | `app.js:6198-7064`, `:8717-10037` + `p-shopping`, `p-cooking`, `p-mealplan`; `normCat`/`catLabel`, `mealType`, jednotky | ~450 klíčů, 2–3 sezení | ne |
| **4c** | Cíle, vize, checklist, rodina a skupiny, notifikace v klientu, průvodce | `:5137-6197`, `:7642-8281`, `:3544-4919`, `:10478+` | ~400 klíčů, 2–3 sezení | ne |
| **5** | AI | `aiLangRule()`, požadavky `ai.req.*`, JSON klíče kategorií, `buildChatContext()` popisky, test v `scripts/ai-compare.js` (spouští uživatel) | ~40 klíčů + 16 promptů, 1–2 sezení | ne |
| **6** | Server | `functions/i18n.js`, cron, `testPush`, `notifyFamily` podle jazyka příjemce, ci-check parita. Nasazení proběhne samo přes GitHub Actions po push do `functions/**`. | ~30 klíčů, 1 sezení | ne |
| **7** | Spuštění EN | `privacy-en.html`, `terms-en.html` (s větou „závazná je česká verze“), CHANGELOG s `en`, `AUTO_DETECT = true`, `hreflang`, volitelně statická `/en/` stránka s anglickými OG tagy pro sdílení, popis v Google Play (`docs/GOOGLE-PLAY.md`) | 2 právní texty + ~20 klíčů, 1–2 sezení | ne |

Celkem ~1 700–1 900 klíčů a zhruba 15–20 sezení kodéra.

Pořadí 4a, 4b a 4c lze prohodit, protože každý modul je samostatný. `app.js` je ale sdílený, takže **vždy jen jeden koder naráz** (CLAUDE.md). Slovníky se mezi fázemi neslučují, každá fáze přidá svůj blok klíčů s prefixem modulu.

**CHANGELOG.** Nové záznamy od fáze 3 dostanou tvar `{ v:'4.40', items:['…'], en:['…'] }`. `checkChangelog()` `:392` pro `en` použije `entry.en`, a když chybí, modal neukáže (žádná čeština v EN). Historii (62 verzí) nepřekládat, uživatel stejně vidí jen záznam aktuální verze. ci-check od verze zavedení vyžaduje `en` u prvního záznamu.

**manifest.json.** Neměnit (`name` je značka, změna znamená reinstalaci PWA). Dynamický manifest nepoužívat (`pwa.js:2`). Případná změna `description` na neutrální anglickou až ve fázi 7, nejlépe spolu s jinou plánovanou změnou manifestu.

**Meta/OG.** Index zůstane česky (`og:locale cs_CZ`) a za běhu se mění jen `document.title`. Pro sdílení anglického odkazu je potřeba statická stránka `/en/index.html` (jen OG a přesměrování na `/?lang=en`) a `<link rel="alternate" hreflang="en" href="https://lifepocket.app/en/">`.

---

## 6. Rizika a hlídání

| Riziko | Dopad | Ochrana |
|---|---|---|
| Pomalejší start | +1 požadavek (~30 kB gzip) | modulepreload v `<head>`, jen aktivní jazyk, SW cache, pro `cs` žádný průchod DOM |
| Zapomenuté texty (míchaná EN/CZ) | EN uživatel vidí češtinu | ráčny v ci-check (české literály v app.js, uzly v index.html, `'cs-CZ'`); EN schované za `?lang=en` až do fáze 7; `t()` loguje chybějící klíč (`console.warn`, volitelně do `errorLogs` přes existující zapisovač `:496`, max. 1× za klíč) |
| Regrese v češtině při přepisu šablon | špatný text nebo rozbité HTML | česká hodnota ve slovníku = původní text (kopírovat, nepřepisovat); ci-check porovná text v HTML s `cs[klíč]`; tester grepem ověří, že počet `data-a0`/`esc(` v diffu neklesl |
| XSS přes proměnné ve slovníku | vložení HTML z uživatelských dat | `tH()` escapuje proměnné; review hlídá `t()` v `innerHTML` s uživatelskou proměnnou |
| Konstanty vytvořené před načtením slovníku | texty v jiném jazyce nebo `undefined` | `await initI18n()` jako první příkaz po importech; texty v konstantách brát lazy přes `t()` při renderu |
| Nesoulad app.js a slovníku (cache) | chybějící klíč, zobrazí se jeho název | network-first SW, bump `CACHE`, `t()` vrací klíč (nespadne); nové klíče přidávat ve stejném commitu jako kód |
| Smyčka reloadu při `profile.lang` | appka se točí | pojistka `sessionStorage.lp_lang_reload` |
| Kategorie ve sdílených seznamech | různé jazyky ve skupině | ukládat kanonickou hodnotu (`normCat`), překládat jen při zobrazení |
| AI odpovídá česky EN uživateli (nebo naopak) | špatný jazyk | `aiLangRule()` na konci system promptu, test v `ai-compare.js`; AI výstup s kategoriemi jako klíče |
| Plurály a rod | „1 dní“, mužský rod u žen | povinné `{n}` + `Intl.PluralRules`, `#f` varianty, ráčna na ruční plurál |
| Server a klient se rozjedou | notifikace v jiném jazyce než appka | `profile.lang` je jediný zdroj pravdy, zapisuje se při každém přepnutí |
| Velikost slovníku a duplicity | stejný text pod více klíči | sdílené klíče `common.save`, `common.cancel`, `common.delete`…; ci-check INFO na nepoužité klíče |

Co ověří uživatel v prohlížeči (agenti ne): `?lang=en` na landingu a po přihlášení, přepnutí v Nastavení (reload), push notifikace v EN (testovací účet s `profile.lang:'en'`), e-mail pro reset hesla v EN, chování offline po přepnutí jazyka.
