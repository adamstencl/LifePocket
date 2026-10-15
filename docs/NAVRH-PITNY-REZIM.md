# Návrh: modul 💧 Pitný režim (mobil 390×844, všechna témata)

Zadání (Adam): „Nastavím si, že chci vypít 2 litry denně. Nastavím si šálky, které piju (např. 3 dl a 2 dl). Když jsem dlouho nic nezapsal (např. 1,5–2 h), appka mi připomene, ať se napiju. Kliknu na šálek 2 dl a naplní se láhev. Přes den takhle plním láhev.“

Výchozí stav: verze 4.61, větev `claude/awesome-hypatia-72pnwx`. Čísla řádků jsou orientační, koder ať místa hledá grepem podle názvu funkce nebo ID.

## 0. Co jsem v kódu zjistil (důležité pro rozhodnutí)

| Zjištění | Místo | Důsledek |
|---|---|---|
| **Starý widget vody se nikde nezobrazuje.** `renderWaterInDash()` hledá `#water-widget`, ten ale není v `index.html` ani v `rDash()`. | app.js ~5454, `rDash` ~12731 | Uživatelé vodu na Domů dnes nevidí. Jediné místo je položka „Dej si první sklenici vody“ v kartě Začínáme (`quickStartHTML`, `addWater()` jen ukáže toast). Starý kód lze bez náhrady smazat. |
| `lp_water` = `{date: Date.toDateString(), count, goal: 8}`, jen localStorage, jednotka „sklenice“ | app.js ~5422–5475 | Migrace: sklenice × 250 ml, jen dnešek (viz §4.4). |
| AI kontext čte `waterToday/waterGoal` (sklenice) a `healthLogs[ds].water` (starý modul Zdraví bez UI) | app.js ~13976–13987 | Řádek „Voda dnes (počítadlo na Domů)“ nahradit ml z nového modulu. `healthLogs.water` nechat, jak je. |
| Server už umí akční tlačítko (`actions`) a SW ho předá do appky (`HABIT_DONE_FROM_NOTIF`, odložená akce v cache `lp-pending`) | sw.js ~119–144, app.js `handleNotifHabitDone` ~4810 | „+2 dl“ z notifikace je proveditelné stejným vzorem (§3.5). |
| `sendPush` při `actions` vždy nastaví `requireInteraction:true` | functions/index.js ~328 | U vody by notifikace „visela“ a otravovala. Potřeba volba `sticky:false`. |
| Noční klid existuje jen u skupin (`profile.groupNotif.quiet`, výchozí 22:00–07:00); osobní připomínky ho neznají | functions/index.js ~472, ~512 `inQuiet` | Voda má vlastní „aktivní hodiny“ a navíc respektuje `groupNotif.quiet`, pokud je zapnutý. |
| Cron čte `profile/main` u každého uživatele každých 5 min | functions/index.js ~990 | Stav dne (ml, čas posledního zápisu) dáme do profilu → připomínky **bez jediného čtení navíc**. |
| `profNoTokens()` vyřazuje pole, která se nesmí přepsat starou kopií profilu | app.js ~1157 | Nové pole `waterDay` přidat do výjimek. |
| Výchozí téma je světlé `sunshine`, další `tangerine` a `dark-gold` | style.css 1–50 | Barvu vody řešíme tokenem pro všechna tři témata. |
| Pravidla: `users/{uid}/**` jen vlastník | firestore.rules | Nová podkolekce `water` i pole v profilu fungují **bez změny pravidel**. |
| `deleteAccount` maže `users/{uid}` přes `recursiveDelete` | functions/index.js ~1352 | Smazání účtu pokryje i `water` samo. Do exportu dat (`exp.col`, app.js ~3548) ale `water` přidat. |

---

## 1. Obrazovka modulu `#p-water`

### 1.1 Rozložení (390×844, dolní lišta 59 px)

```
┌──────────────────────────────────────┐
│ 💧 Pitný režim                 [⚙️]  │  hlavička 56 px, ⚙️ 44×44 → nastavení (sheet)
│                                      │
│            ╭───╮                     │
│           ╭┘   └╮                    │  láhev SVG 120×200, voda stoupá
│           │~~~~~│                    │  vlnka (4 s smyčka, bez pohybu při reduced-motion)
│           │█████│   1,2 l            │  velké číslo vpravo od láhve (Playfair 40 px)
│           │█████│   z 2 l · 60 %     │
│           ╰─────╯   Zbývá 0,8 l      │  „≈ 4× 🥛 2 dl“ (nejčastější šálek)
│                                      │
│  ┌──────┐┌──────┐┌──────┐┌──────┐    │  šálky: 1 řádek, max 5, každý ≥ 64×72 px
│  │  🥛  ││  ☕  ││  🍶  ││  ＋  │    │  ＋ = přidat šálek (zmizí při 5 šálcích)
│  │ 2 dl ││ 3 dl ││ 5 dl ││      │    │
│  └──────┘└──────┘└──────┘└──────┘    │  řádek je sticky nad dolní lištou při scrollu
│  [ ↩ Vrátit 2 dl (14:10) ]           │  pilulka, 44 px, jen když dnes je zápis
├──────────────────────────────────────┤
│ DNES                                 │
│ 14:10  🥛 2 dl                   ✕   │  řádky 48 px, ✕ = 44×44
│ 12:35  ☕ 3 dl                   ✕   │
│ 09:02  🥛 2 dl                   ✕   │
├──────────────────────────────────────┤
│ TENTO TÝDEN            splněno 4/7   │
│  ▂  ▅  █  ▇  ▃  █  ▁   - - - cíl     │  7 sloupců, přerušovaná čára = cíl
│ Po Út St Čt Pá So Ne                 │
├──────────────────────────────────────┤
│ 🔔 Připomínky: 8:00–21:00, po 1,5 h →│  řádek otevře nastavení na sekci připomínek
└──────────────────────────────────────┘
```

Proč takhle: láhev a šálky jsou v horní polovině obrazovky, ale řádek šálků je `position:sticky` nad dolní lištou. Jakmile uživatel posune seznam, šálky zůstanou v dosahu palce. Hlavní akce (ťuk na šálek) je vždy jedním dotykem.

Po splnění cíle: láhev plná, pod číslem zelená pilulka „✓ Dnešní cíl splněn“, nad cílem se ukazuje „+0,3 l navíc“. Láhev nepřetéká, šálky fungují dál.

Zpětná vazba po ťuknutí: voda vystoupá (transition 0,6 s), nad láhví vyletí „+2 dl“ (stejný vzor jako `.xp-pop`), `navigator.vibrate?.(12)`. Při splnění cíle jednou toast `wt.goalDone` a XP pop (viz §5.4).

### 1.2 HTML (index.html, nová stránka vedle `#p-habits`)

```html
<div class="page" id="p-water">
  <div class="wt-head">
    <h1 class="pt" data-i18n="wt.title">💧 Pitný režim</h1>
    <button class="wt-icon-btn" onclick="openWaterSettings()" data-i18n-aria="wt.settings" aria-label="Nastavení pitného režimu">⚙️</button>
  </div>

  <section class="wt-hero" aria-live="polite">
    <div id="wt-bottle"><!-- SVG z waterBottleSVG(pct, 'lg') --></div>
    <div class="wt-stat">
      <div class="wt-num" id="wt-num">1,2 l</div>
      <div class="wt-of" id="wt-of">z 2 l · 60 %</div>
      <div class="wt-left" id="wt-left">Zbývá 0,8 l · ≈ 4× 🥛 2 dl</div>
    </div>
  </section>

  <div class="wt-cups" id="wt-cups" role="group" aria-label="Přidat vypité">
    <!-- renderWaterCups(): <button class="wt-cup" data-a0="200" onclick="drinkWater(+this.dataset.a0)"> -->
  </div>
  <div class="wt-undo-row"><button class="wt-undo" id="wt-undo" onclick="undoWater()" hidden></button></div>

  <section class="dw wt-card" aria-labelledby="wt-today-h">
    <div class="dw-head"><h2 class="dw-title" id="wt-today-h" data-i18n="wt.today">Dnes</h2></div>
    <ul class="wt-list" id="wt-list"></ul>
  </section>

  <section class="dw wt-card" aria-labelledby="wt-week-h">
    <div class="dw-head"><h2 class="dw-title" id="wt-week-h" data-i18n="wt.week">Tento týden</h2><span class="wt-week-sum" id="wt-week-sum"></span></div>
    <div class="wt-week" id="wt-week" role="img"></div>
  </section>

  <button class="wt-rem-row" id="wt-rem-row" onclick="openWaterSettings('rem')"></button>
</div>
```

Pozn. pro kodera: uživatelská data (emoji šálku) přes `esc()`, handlery přes `data-aN` (pravidla v CLAUDE.md). Emoji šálku je z pevného seznamu, ale stejně escapovat.

### 1.3 Láhev (SVG, jedna funkce pro modul i widget)

```js
// pct 0–1 (oříznuto), size 'lg' (modul 120×200) | 'sm' (widget 40×66)
function waterBottleSVG(pct, size='lg'){
  const p=Math.max(0,Math.min(1,pct||0));
  const H=170, top=36;                         // vnitřní výška těla láhve ve viewBoxu 0 0 120 210
  const y=top+(1-p)*H;                          // hladina
  const id='wb'+size;                           // dvě láhve na jedné stránce nemají kolidovat (Domů je jiná stránka, ale pro jistotu)
  return `<svg class="wt-bottle wt-bottle--${size}" viewBox="0 0 120 210" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="M44 6h32v18c0 6 4 9 10 13 9 6 14 13 14 24v126c0 10-8 18-18 18H38c-10 0-18-8-18-18V61c0-11 5-18 14-24 6-4 10-7 10-13z"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect x="0" y="0" width="120" height="210" class="wt-glass"/>
      <g class="wt-level" style="transform:translateY(${y.toFixed(1)}px)">
        <path class="wt-wave" d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 T150 6 T180 6 T210 6 T240 6 V220 H0Z"/>
      </g>
    </g>
    <path class="wt-outline" d="M44 6h32v18c0 6 4 9 10 13 9 6 14 13 14 24v126c0 10-8 18-18 18H38c-10 0-18-8-18-18V61c0-11 5-18 14-24 6-4 10-7 10-13z"/>
    <rect class="wt-cap" x="42" y="0" width="36" height="10" rx="3"/>
  </svg>`;
}
```

Při překreslení neměnit celé SVG, jen `style.transform` na `.wt-level`, jinak se transition nespustí (vlnka i stoupání by „skočily“).

### 1.4 CSS (nový blok, nahradí `.water-*` v style.css ~1506–1513 a ~1627–1628)

```css
/* ── PITNÝ REŽIM (4.62) ── */
:root,[data-theme="dark-gold"]{--water:#5b9cf6;--water-text:#7db3ff;--water-glass:rgba(91,156,246,.08)}
[data-theme="sunshine"],[data-theme="tangerine"]{--water:#1e7ad8;--water-text:#1565c0;--water-glass:rgba(21,101,192,.06)}

.wt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.wt-icon-btn{min-width:44px;min-height:44px;border-radius:12px;background:var(--card2);border:1px solid var(--border);font-size:20px;cursor:pointer}

.wt-hero{display:flex;align-items:center;justify-content:center;gap:20px;padding:8px 0 16px}
.wt-bottle--lg{width:120px;height:210px}
.wt-bottle--sm{width:40px;height:70px;flex-shrink:0}
.wt-glass{fill:var(--water-glass)}
.wt-outline{fill:none;stroke:var(--border2);stroke-width:3}
.wt-cap{fill:var(--border2)}
.wt-level{transition:transform .6s cubic-bezier(.16,1,.3,1)}
.wt-wave{fill:var(--water);animation:wtWave 4s linear infinite}
@keyframes wtWave{to{transform:translateX(-60px)}}
.wt-bottle--sm .wt-wave{animation:none}
@media (prefers-reduced-motion:reduce){.wt-wave{animation:none}.wt-level{transition:none}}

.wt-stat{min-width:0}
.wt-num{font-family:'Playfair Display',serif;font-size:40px;line-height:1;color:var(--water-text)}
.wt-of{font-size:15px;color:var(--text2);margin-top:4px}
.wt-left{font-size:15px;color:var(--text);margin-top:8px}
.wt-done-pill{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:20px;background:rgba(61,214,140,.14);color:var(--green);font-weight:600;font-size:14px}

/* Šálky: sticky nad dolní lištou, ať jsou při scrollu pod palcem */
.wt-cups{position:sticky;bottom:calc(var(--bn-h) + 8px);z-index:5;display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px;padding:8px;margin:0 -8px;background:var(--bg);border-radius:16px}
.wt-cup{font:inherit;min-height:72px;border-radius:16px;background:var(--card);border:1.5px solid var(--border2);color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:transform .12s,border-color .2s}
.wt-cup .em{font-size:26px;line-height:1}
.wt-cup .ml{font-size:15px;font-weight:700}
.wt-cup:active{transform:scale(.94);border-color:var(--water)}
.wt-cup:focus-visible{outline:3px solid var(--water);outline-offset:2px}
.wt-cup--add{border-style:dashed;color:var(--text2)}

.wt-undo-row{display:flex;justify-content:center;margin:4px 0 12px}
.wt-undo{font:inherit;min-height:44px;padding:0 18px;border-radius:22px;background:var(--card2);border:1px solid var(--border2);color:var(--text2);font-size:15px;cursor:pointer}

.wt-list{list-style:none}
.wt-list li{display:flex;align-items:center;gap:12px;min-height:48px;border-bottom:1px solid var(--border)}
.wt-list li:last-child{border-bottom:none}
.wt-list .tm{font-variant-numeric:tabular-nums;color:var(--text2);width:48px}
.wt-list .wh{flex:1;color:var(--text)}
.wt-list .rm{font:inherit;min-width:44px;min-height:44px;background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer}
.wt-empty{color:var(--text2);font-style:italic;padding:8px 0}

/* Týdenní graf: 7 sloupců, čára cíle */
.wt-week{position:relative;display:grid;grid-template-columns:repeat(7,1fr);gap:6px;height:120px;align-items:end;padding-top:8px}
.wt-goal-line{position:absolute;left:0;right:0;border-top:2px dashed var(--border2);pointer-events:none}
.wt-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;min-height:44px}
.wt-bar{width:100%;max-width:28px;border-radius:6px 6px 2px 2px;background:var(--border2);min-height:3px;transition:height .4s}
.wt-bar.met{background:var(--water)}
.wt-col.today .wt-dl{color:var(--text);font-weight:700}
.wt-dl{font-size:12px;color:var(--text2)}
.wt-week-sum{font-size:13px;color:var(--text2)}

.wt-rem-row{font:inherit;width:100%;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 16px;margin:4px 0 16px;border-radius:14px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:15px;cursor:pointer;text-align:left}
```

Kontrast (ověřit nástrojem při implementaci, hodnoty orientační):
- Text čísla `--water-text`: `#1565c0` na bílé kartě ≈ 5,8:1 (sunshine/tangerine), `#7db3ff` na `#16161c` ≈ 8:1 (dark-gold).
- Pomocný text vždy `--text2`, nikdy `--text3` (v tmavém tématu `--text3` na kartě ≈ 2,5:1 nevyhoví).
- Sloupce grafu jsou grafický prvek: `--water` proti kartě ≥ 3:1 ve všech tématech; nesplněný den `--border2` doplňuje číselný údaj v `aria-label`, takže informace nestojí jen na barvě.

### 1.5 Týdenní graf (CSS, bez knihovny)

- Posledních 7 dní končících dneškem (ne pondělí–neděle; v neděli i v pondělí ukazuje celý týden dat).
- Výška sloupce = `ml / max(cíl, nejvyšší den) × 100 %`, čára cíle ve stejném měřítku.
- `role="img"` a `aria-label`: „Posledních 7 dní: Po 1,8 l, Út 2,1 l, … Cíl splněn 4 dny ze 7.“
- Ťuk na sloupec: pod grafem řádek „Čt 14. 10.: 2,1 l z 2 l ✓“ (bez tooltipu, ten se na dotyku špatně ovládá).

### 1.6 Nastavení (bottom sheet ve stylu `.tp-sheet`)

```
┌──────────────────────────────────────┐
│ ⚙️ Pitný režim                   ✕   │
│ DENNÍ CÍL                            │
│ (1,5 l) (2 l●) (2,5 l) (3 l)         │  čipy 44 px
│ [ − ]        2,0 l        [ + ]      │  krok 250 ml, rozsah 0,5–6 l
│                                      │
│ MOJE ŠÁLKY (max 5)                   │
│ 🥛  [ − ] 2 dl [ + ]             ✕   │  krok 50 ml, 50–1500 ml
│ ☕  [ − ] 3 dl [ + ]             ✕   │  ťuk na emoji = výběr z 10 ikon
│ 🍶  [ − ] 5 dl [ + ]             ✕   │
│ [ ＋ Přidat šálek ]                  │
│                                      │
│ 🔔 PŘIPOMÍNKY                 [●──]  │  přepínač
│ Kdy:   [ 8:00 ] – [ 21:00 ]          │  stávající data-time-picker
│ Když jsem nepil(a):                  │  ↓ segmentový přepínač .seg
│ (1 h) (1,5 h●) (2 h) (3 h)           │
│ ☐ Jen když nestíhám tempo            │
│   Připomenu se jen, když jsi pod     │
│   plánem na tuhle denní dobu.        │
│                                      │
│ 🔗 PROPOJIT S NÁVYKEM                │  (4.63)
│ [ 💧 Vypít 2 litry           ▾ ]     │
│ Když splníš cíl, návyk se odškrtne.  │
│                                      │
│ [        Uložit        ]  (.btn-p)   │
└──────────────────────────────────────┘
```

- Ikony šálků (pevný seznam): 🥛 ☕ 🍵 🫖 🧃 🥤 🧋 🍶 💧 🍼. Výběr = mřížka 5×2 tlačítek 48×48.
- Šálky se v modulu řadí podle velikosti. Nejde smazat poslední šálek (✕ je skrytý).
- Pohlaví v textu: „Když jsem nepil(a)“ obejít neutrálně: **„Připomenout po“** (1 h / 1,5 h / 2 h / 3 h). Bez rodu, krátké.
- Zapnutí připomínek bez povolení notifikací spustí stávající tok žádosti o povolení (jako u návyků). Bez tokenu ukáže řádek „Upozornění máš vypnutá v telefonu – zapni je v Nastavení“.
- Nastavení → Upozornění dostane řádek „💧 Pitný režim → nastavit v modulu“ (jeden zdroj pravdy: `profile.water.rem`).

### 1.7 První otevření modulu (mini průvodce, 1 obrazovka)

Místo prázdné láhve karta nad láhví:

> **Kolik chceš denně vypít?**
> (1,5 l) (2 l●) (2,5 l) (3 l)
> Šálky máš připravené: 🥛 2 dl · ☕ 3 dl · 🍶 5 dl. Změníš je v ⚙️.
> ☑ Připomeň mi, když dlouho nepiju
> **[ Začít ]**

Uloží `profile.water` s výchozími hodnotami a, pokud je zaškrtnuto, spustí žádost o notifikace. Uživatel s návykem, jehož název odpovídá `/vod|pít|pit[ií]|litr|water|drink/i`, uvidí navíc: „Mám propojit s návykem 💧 Vypít 2 litry?“ (4.63).

---

## 2. Widget na Domů (náhrada starého)

```
┌──────────────────────────────────────┐
│ 💧 PITNÝ REŽIM                    →  │  .dw-head (stávající)
│ ╭╮                                   │
│ ││ 1,2 / 2 l      ┌──────┐┌──────┐   │  mini láhev 40×70, text, 2 šálky 56×56
│ ││ zbývá 0,8 l    │🥛 2dl││☕ 3dl│   │
│ ╰╯                └──────┘└──────┘   │
└──────────────────────────────────────┘
```

```js
function waterWidgetHTML(){
  if(!(prof.modules||[]).includes('water')||!waterCfg()) return '';
  const {ml,goal}=waterToday(), cups=waterTopCups(2);           // 2 nejčastější za 14 dní, jinak 2 nejmenší
  const done=ml>=goal;
  return `<div class="dw wt-dw" onclick="sp('water')">
    <div class="dw-head"><div class="dw-title">${tH('wt.title')}</div><div class="dw-arrow">→</div></div>
    <div class="wt-dw-row">
      <span class="wt-dw-b">${waterBottleSVG(ml/goal,'sm')}</span>
      <div class="wt-dw-txt"><div class="wt-dw-num">${esc(fmtMl(ml))} / ${esc(fmtMl(goal))}</div>
        <div class="wt-dw-sub">${done?tH('wt.doneShort'):tH('wt.left',{v:fmtMl(goal-ml)})}</div></div>
      ${cups.map(c=>`<button class="wt-cup wt-cup--sm" data-a0="${c.ml}" onclick="event.stopPropagation();drinkWater(+this.dataset.a0)" aria-label="${tH('wt.addAria',{v:fmtMl(c.ml)})}"><span class="em">${esc(c.em)}</span><span class="ml">${esc(fmtMl(c.ml))}</span></button>`).join('')}
    </div></div>`;
}
```

```css
.wt-dw-row{display:flex;align-items:center;gap:12px}
.wt-dw-txt{flex:1;min-width:0}
.wt-dw-num{font-size:18px;font-weight:700;color:var(--text)}
.wt-dw-sub{font-size:14px;color:var(--text2)}
.wt-cup--sm{min-height:56px;min-width:56px;border-radius:14px;padding:4px}
.wt-cup--sm .em{font-size:20px}.wt-cup--sm .ml{font-size:13px}
```

- Umístění v `rDash()`: hned za `focusWidgetHTML()` (před jednorázové karty). Je to denní, opakovaná akce, má být vysoko.
- Ťuk na šálek zapíše bez odchodu z Domů a překreslí jen widget (nevolat celé `rDash()`, kvůli denní hlášce a citátu).
- Malý undo: po ťuku na 5 s toast „+2 dl · **Vrátit**“ (stávající toast s tlačítkem, pokud existuje; jinak jen toast a undo v modulu).
- Karta Začínáme: položka `water` jen při zapnutém modulu, akce = `sp('water')`, hotovo = dnes `ml > 0`.

---

## 3. Připomínky (server)

### 3.1 Princip: deterministické, bez zápisů a čtení navíc

Cron už čte `profile/main`. Klient při každém zápisu vody uloží do profilu malé pole `waterDay = {d:'2026-10-15', ml:1200, last:'14:10'}` (lokální čas zařízení). Server tedy ví vše bez dalšího čtení a **nic nezapisuje** (žádný kurzor). Kdy poslat se počítá z času posledního pití:

```
kotva = max(začátek aktivních hodin, čas posledního zápisu dnes)
n     = minut od kotvy
k     = floor(n / interval)            // kolikátá připomínka od posledního pití
pošli, když  k ∈ {1,2,3}  a  n % interval < 5   (5min okno cronu, stejně jako isTimeMatch)
```

Příklad (interval 90 min, 8:00–21:00): bez pití → 9:30, 11:00, 12:30, pak ticho. Napije se ve 12:40 → 14:10, 15:40, 17:10. Po třech nevyslyšených připomínkách appka **mlčí až do dalšího zápisu** (ochrana proti otravování; uživatel, který si vodu nezapisuje, nedostane 8 notifikací denně).

### 3.2 Podmínky (vše musí platit)

1. `prof.water.rem.on === true` a uživatel má modul `water` v `prof.modules`.
2. Čas v zóně uživatele (`zoneNow(prof.tz)`) je v `[from, to − 15 min)`.
3. Není noční klid skupin: `!inQuiet(h, m, groupNotifPrefs(prof).quiet)` (když ho má uživatel zapnutý, platí i pro vodu).
4. Dnes nesplněno: `ml < goal` (`waterDay.d !== today` ⇒ `ml = 0`, `last = null`).
5. Pravidlo z §3.1 (k = 1–3, okno 5 min).
6. Režim „Jen když nestíhám tempo“: plán = `goal × clamp((now − from) / (to − from − 60), 0, 1)` (cíl rozložený do aktivních hodin, s hodinovou rezervou před koncem). Poslat jen když `ml < plán − 150 ml`.

### 3.3 Pseudokód (functions/index.js, v `processUser` za připomínkami návyků)

```js
// ── Pitný režim (4.62) ──
const W = prof.water;
if (W && W.rem && W.rem.on === true && Array.isArray(prof.modules) && prof.modules.includes('water')) {
  try {
    const toMin = (s) => { const [a, b] = String(s).split(':').map(Number); return a * 60 + b; };
    const from = HHMM_RE.test(W.rem.from) ? toMin(W.rem.from) : 480;
    const to   = HHMM_RE.test(W.rem.to)   ? toMin(W.rem.to)   : 1260;
    const every = [60, 90, 120, 180].includes(W.rem.every) ? W.rem.every : 90;
    const goal = Math.min(6000, Math.max(500, Number(W.goal) || 2000));
    const wd = prof.waterDay && prof.waterDay.d === today ? prof.waterDay : null;
    const ml = wd ? Math.max(0, Number(wd.ml) || 0) : 0;
    const now = h * 60 + m;
    const quietG = inQuiet(h, m, groupNotifPrefs(prof).quiet); // výchozí 22:00–07:00, null = vypnuto
    if (from < to && now >= from && now < to - 15 && !quietG && ml < goal) {
      const last = wd && HHMM_RE.test(wd.last) ? toMin(wd.last) : null;
      const anchor = Math.max(from, last ?? from);
      const n = now - anchor, k = Math.floor(n / every);
      if (n >= 0 && k >= 1 && k <= 3 && (n % every) < 5) {
        const plan = goal * Math.min(1, Math.max(0, (now - from) / Math.max(60, to - from - 60)));
        const behind = ml < plan - 150;
        if (W.rem.pace !== true || behind) {
          const cup = waterTopCup(W);                     // nejčastější šálek z W.cups (ml), jinak 200
          const {title, body} = waterText(L, {ml, goal, plan, cup, k, behind, now, to, dayIdx: dayOfYear(wall), nickname});
          await push(title, body, 'water', {
            data: {open: 'water', ml: String(cup), date: today},
            actions: [{action: 'drink', title: tS(L, 'wt.n.act', {v: fmtMlS(L, cup)})}],
            sticky: false,                                // bez requireInteraction (viz 3.6)
          });
        }
      }
    }
  } catch(e) { console.error(`[LP] water push uid=${uid}:`, e.message); }
}
```

Validace vstupů z profilu na serveru je nutná (profil zapisuje klient). Do logu nic z obsahu.

### 3.4 Texty notifikací (functions/i18n-server.js, cs + en)

Bez slovesa v minulém čase, takže **bez rodových tvarů** (`#f`/`#x` netřeba). Výběr: nejdřív podle situace, jinak rotace `(dayIdx + k) % 5`, takže se texty během dne ani mezi dny neopakují stejně.

| Klíč | Kdy | cs titulek / text | en title / body |
|---|---|---|---|
| `wt.n.near` | zbývá ≤ největší šálek | 🏁 Skoro hotovo / Už jen {left} a máš dnešní cíl! | 🏁 Almost there / Just {left} to go and today's goal is done! |
| `wt.n.behind` | `behind` | 💧 Trochu zaostáváš / Touhle dobou by to chtělo kolem {plan}, máš {ml}. Dáš si {cup}? | 💧 Falling a bit behind / By now you'd be around {plan}, you're at {ml}. Fancy {cup}? |
| `wt.n.last` | poslední okno před `to` | 🌙 Poslední doušek dne? / Do cíle chybí {left}. Ještě sklenka před večerem? | 🌙 Last sip of the day? / {left} left to your goal. One more glass this evening? |
| `wt.n.r0` | rotace | 💧 Dáš si vodu? / {name}, je čas na doušek. Stačí ťuknout na šálek. | 💧 Time for water? / {name}, time for a sip. Just tap a cup. |
| `wt.n.r1` | rotace | 🚰 Láhev čeká / Je naplněná na {pct} %. Doplníš ji? | 🚰 Your bottle is waiting / It's {pct}% full. Top it up? |
| `wt.n.r2` | rotace | 💧 Malá pauza na pití / Do cíle zbývá {left}. Jeden šálek a jsi blíž. | 💧 Quick water break / {left} left to your goal. One cup brings you closer. |
| `wt.n.r3` | rotace | 💧 Napij se / Hlava i soustředění ti poděkují. | 💧 Have a drink / Your head and focus will thank you. |
| `wt.n.r4` | rotace | 💧 Jak jsi na tom s pitím? / Dnes zatím {ml} z {goal}. | 💧 How's your water going? / So far today: {ml} of {goal}. |
| `wt.n.act` | tlačítko | +{v} | +{v} |

Formát jednotek: cs `2 dl`, `0,8 l`; en `200 ml`, `0.8 l` (anglicky mluvící dl nepoužívají).

### 3.5 Klik na notifikaci a tlačítko „+2 dl“

| Akce | Android | iOS (PWA na ploše) |
|---|---|---|
| Ťuk na notifikaci | otevře modul (`open:'water'`) | otevře modul |
| Tlačítko „+2 dl“ | otevře appku a zapíše 2 dl (viz níže) | tlačítka web push na iOS nejsou, jen ťuk |

**Proveditelnost tlačítka:** SW nemá přihlášení k Firestore, sám zapsat nemůže. Možnosti:

1. **Doporučeno (4.63, S):** SW při `e.action === 'drink'` zavolá `openInApp({type:'WATER_ADD', ml, at: Date.now(), date}, '/?open=water&drink=' + ml + '&at=' + at)`. Běžící appka dostane zprávu, jinak se otevře s parametry. Appka zapíše vodu s časem `at` (ne časem otevření) a ukáže, jak se láhev plní. Výhoda: okamžitě se aktualizuje `waterDay` → server nepošle další připomínku zbytečně. Uživatel vidí výsledek.
2. Odložená akce v `lp-pending` bez otevření (jako u návyků): zápis proběhne až při dalším otevření appky. **Nedoporučuji:** server o pití neví a za interval připomene znovu, i když se uživatel napil.
3. **Později (L, volitelné):** HTTPS funkce `waterQuickAdd` s jednorázovým podepsaným tokenem v datech notifikace (HMAC z uid + datum + čas odeslání, platnost 3 h). SW pošle POST, funkce zapíše přes Admin SDK, appka se neotevře. Vyžaduje tajný klíč ve Functions (zadává Adam) a novou veřejnou funkci, proto až podle zájmu.

Bezpečnost `?drink=` (varianta 1): odkaz může kdokoli poslat, škoda je malá (cizí zápis vody), ale ošetřit:
- `ml` jen 50–1500 a celé násobky 50, `at` max. 6 h staré a ne v budoucnu, `date === toDS()`.
- Každé `at` jen jednou (posledních 20 v `lp_wt_seen`, LOCAL_PERSONAL_KEYS).
- Po zápisu toast „💧 +2 dl zapsáno · Vrátit“, takže omyl jde hned vrátit.

### 3.6 Změny v `sendPush` a SW

- `sendPush`: `if (options.actions?.length) { notif.actions = …; notif.requireInteraction = options.sticky !== false; }`. Ostatní volání se nemění.
- Tag `water` je jediný, nová připomínka nahradí starou (nehromadí se), `renotify:true` = zazvoní. `data.tag === webpush.notification.tag` zajišťuje `sendPush` už dnes.
- sw.js: `'water'` přidat do seznamu `open` (větev `OPEN_TARGET`), nová větev `e.action === 'drink'`.
- app.js: `OPEN_TARGETS` + `'water'`, `consumePendingOpen` → `sp('water')`; `captureOpenTargetLink` načte i `drink`, `at`.
- Notifikace přijde, když je appka v popředí (onMessage): u tagu `water` jen jemný toast s tlačítkem šálku, ne systémová notifikace.

---

## 4. Data ve Firestore (bez změny pravidel)

### 4.1 Nastavení: `users/{uid}/profile/main.water`

```js
water: {
  v: 1,
  goal: 2000,                                   // ml, 500–6000
  cups: [ {id:'c1', ml:200, em:'🥛'}, {id:'c2', ml:300, em:'☕'}, {id:'c3', ml:500, em:'🍶'} ], // 1–5
  rem: { on: false, from: '08:00', to: '21:00', every: 90, pace: false },
  habitId: null,                                // 4.63: propojený návyk
  since: '2026-10-15'                           // první den modulu (graf a statistiky nezačínají nulami)
}
```

Zápis přesnými cestami: `updateDoc(profileRef, {'water.goal': 2000})` nebo celé `water` při uložení sheetu. Protože jde o běžné pole profilu, které mění jen nastavení, smí zůstat i v plných zápisech profilu.

### 4.2 Stav dne pro server: `profile/main.waterDay`

```js
waterDay: { d: '2026-10-15', ml: 1200, last: '14:10' }   // last = čas nejnovějšího zbývajícího zápisu (po undo přepočítat)
```

- Píše jen kód vody: `updateDoc(profileRef, {waterDay: {...}})`.
- **Přidat do `profNoTokens()`** (`delete c.waterDay`), jinak by ho jiný plný zápis profilu přepsal starou kopií z jiného zařízení.
- Zápis profilu při každém pití je 1 zápis navíc (vedle dokumentu dne). Za den cca 8–12 zápisů, zanedbatelné.

### 4.3 Den: `users/{uid}/water/{YYYY-MM-DD}`

```js
{
  date: '2026-10-15',
  goal: 2000,                                   // cíl platný ten den (změna cíle nepřepíše historii)
  ml: 1200,                                     // součet (increment)
  entries: [ {at: 1760530200000, t:'09:02', ml:200, em:'🥛'}, … ],  // max 40 záznamů/den
  updatedAt: serverTimestamp()
}
```

- Přidání: `setDoc(ref, {date, goal, ml: increment(x), entries: arrayUnion(e), updatedAt}, {merge:true})`. Funguje offline i na dvou zařízeních zároveň (transformace se sloučí, `at` dělá záznam jedinečným).
- Vrácení: `updateDoc(ref, {ml: increment(-e.ml), entries: arrayRemove(e)})` (přesně stejný objekt, proto ho držet z lokálních dat).
- Načítání: jeden `onSnapshot` na `where('date','>=', dnes − 27)` (graf, nejčastější šálky, XP za včerejšek). Max 28 dokumentů.
- Čas `t` je lokální `HH:MM` zařízení, datum přes `toDS()` (nikdy `toISOString`).
- Limit 40 zápisů za den (pak toast „Na dnešek už toho bylo hodně 🙂“), `ml` záznamu 50–1500.

### 4.4 Migrace z `lp_water` (jednorázově při prvním načtení 4.62)

```js
const old = lsGet('lp_water', null);
if (old) {
  const g = Number(old.goal);
  const goalMl = Number.isFinite(g) && g > 0 && g !== 8 ? Math.min(6000, Math.max(500, g * 250)) : 2000;
  // jen pokud ještě nemá nastavení modulu: předvyplní cíl v průvodci
  if (!prof.water) _wtSuggestGoal = goalMl;
  // dnešní sklenice → jeden zápis, jen když dnes ještě nic v novém modulu není
  if (old.date === new Date().toDateString() && old.count > 0 && !waterTodayDoc())
    addWaterEntry({ml: Math.min(1500 * 2, old.count * 250), em: '💧', mig: true});
  localStorage.removeItem('lp_water');
}
```

Vzhledem k tomu, že starý widget nebyl vidět, se migrace týká jen pár lidí (karta Začínáme). Postačí jednoduše, bez historie. Klíč `lp_water` z `LOCAL_PERSONAL_KEYS` po migraci nemazat (úklid při odhlášení ho stejně smaže).

---

## 5. Zařazení do appky

### 5.1 Moduly a šablony

- `MODS`: `{id:'water', emoji:'💧'}` (za `habits`). `buildNav` → `hasUI` + `'water'`.
- i18n: `mod.water` „Pitný režim“ / „Water“, `mod.water.desc` „Láhev, která se plní, a připomínka, když zapomeneš pít“ / „A bottle that fills up and a nudge when you forget to drink“.
- `ONB_TPLS.health.mods`: přidat `'water'` (Zdraví ano). Rodina a Student ne (lze zapnout ručně).
- `NAV_TPL.health`: **`['habits','water']`** místo `['habits','goals']`. Pití je akce mnohokrát denně, Cíle týdně. Cíle zůstanou v „Více“. (Sporné, viz otázky.)
- `ONB_BASE_MODS` beze změny (vlastní výběr má 4 moduly, víc by přehltilo).

### 5.2 Stávající uživatelé

Jednorázová karta na Domů (vzor `groupNotifIntroHTML`), klíč `lp_wt_intro` v `LOCAL_PERSONAL_KEYS`:

> **💧 Novinka: Pitný režim**
> Nastav si cíl a šálky, ťukáním plníš láhev. Když dlouho nepiješ, připomenu se.
> **[ Zapnout ]**  [ Teď ne ]

Zobrazit uživatelům se šablonou `health` nebo s návykem o vodě (regex z §1.7) jako první, ostatním až po nich (stačí jedna podmínka priority, ne A/B).

### 5.3 Propojení s návykem (4.63)

- `profile.water.habitId` = ID návyku (výběr v nastavení, nabídka v průvodci).
- Při každé změně dne:
  - návyk `yesno`: `ml ≥ goal` → `putHabitLog({id, habitId, date, done:true, value:1, src:'water'})`. Pokud undo sníží pod cíl a log má `src:'water'`, log smazat. Ručně odškrtnutý návyk (bez `src`) **nikdy nerušit**.
  - návyk `count` (např. 8 sklenic): `value = floor(ml / goal × habit.goal)`, `done = value ≥ habit.goal`, také s `src:'water'`.
- Na kartě návyku malý štítek „💧 z pitného režimu“, ťuk na kartu dál funguje ručně (uživatel má poslední slovo).
- Připomínka propojeného návyku (`reminderTime`) by se s vodou zdvojila: v nastavení návyku u propojeného ukázat „Připomínky řeší Pitný režim“ a server připomínku návyku přeskočí, pokud `prof.water.habitId === habitDoc.id && prof.water.rem.on`.

### 5.4 Body (XP)

- S propojeným návykem body přicházejí přes návyk (`dayXP` je počítá ze splněných návyků) a nic dalšího se nepřidává.
- Bez propojení: `XP.water = 10` za splněný denní cíl, přičíst v `dayXP(ds)` (přepočet dneška a včerejška v `gameSync` je idempotentní, undo body zase odebere). Pozor: `gameSync` nesmí běžet s vodou dřív, než dorazí první snapshot (`waterReady`), jinak by dnešní body na chvíli zmizely a zase přibyly.
- Do „perfektního dne“ voda nevstupuje (pravidlo je o návycích).
- Později odznak „💧 Týden vody“ (7 dní v řadě splněno).

### 5.5 AI kontext (`buildChatContext`, sekce zdraví)

Nahradit řádek `aip.ctx.h.waterToday`:

```
cs: 'Pitný režim dnes: {ml} z {goal} ({n} zápisů, poslední v {t}). Posledních 7 dní: cíl splněn {k}/7, průměr {avg}.'
en: 'Water today: {ml} of {goal} ({n} entries, last at {t}). Last 7 days: goal met {k}/7, average {avg}.'
```

Jen při zapnutém modulu, ~150 znaků, vejde se do limitu 7000. Data jsou čísla a časy, žádný text uživatele.

### 5.6 Týdenní souhrn a statistiky

- `analyzeWeekPatterns` / tichý nedělní report: řádek „Pitný režim: cíl splněn {k}/7 dní“ (při k ≤ 3 i nejslabší den), ať ho společník může pochválit nebo povzbudit.
- `weekCardHTML`: malý řádek „💧 4/7 dní“ (4.64).
- `dailyStats`: počet uživatelů s modulem `water` a se zapnutými připomínkami (z profilu, který funkce čte), bez dalších dat (4.64).
- Skupinová výzva `water` (už existuje jako denní předvolba): později automaticky odškrtnout den, když je cíl splněn.

### 5.7 i18n (cs + en, prefix `wt.`)

Klíče klienta: `wt.title, wt.settings, wt.today, wt.week, wt.weekSum, wt.left, wt.leftCups, wt.of, wt.doneShort, wt.goalDone, wt.extra, wt.undo, wt.add, wt.addAria, wt.addCup, wt.empty, wt.limit, wt.goal, wt.cups, wt.cupsMax, wt.rem, wt.remFrom, wt.remEvery, wt.remPace, wt.remPaceHint, wt.remRow, wt.remOff, wt.noPerm, wt.habit, wt.habitHint, wt.habitTag, wt.onb.q, wt.onb.cups, wt.onb.rem, wt.onb.start, wt.intro.t, wt.intro.b, wt.intro.on, wt.intro.later, wt.notifAdded, mod.water, mod.water.desc, exp.col.water`.

Ukázky textů (tykání, emoji střídmě):
- `wt.goalDone`: „💧 Hotovo! Dnešní cíl máš splněný.“ / „💧 Done! Today's goal is reached.“
- `wt.empty`: „Zatím nic. Ťukni na šálek, až se napiješ.“ / „Nothing yet. Tap a cup when you drink.“
- `wt.remPaceHint`: „Připomenu se jen, když jsi pod plánem na tuhle denní dobu.“ / „I'll only nudge you when you're behind for this time of day.“
- `wt.limit`: „Na dnešek už toho bylo hodně 🙂“ / „That's a lot for today 🙂“

Staré klíče `water.title/count/add/done` po nasazení odstranit. `qs.water` a `ch.pre.water` zůstávají.

---

## 6. Rozfázování

| Verze | Obsah | Náročnost |
|---|---|---|
| **4.62 MVP** | Modul `#p-water` (láhev, šálky výchozí + vlastní do 5, undo, dnešní seznam, týdenní graf), průvodce prvním otevřením, nastavení (cíl, šálky, připomínky vč. tempa), data `water/{den}` + `waterDay` + `profile.water`, migrace `lp_water`, widget na Domů, MODS/šablona Zdraví/NAV_TPL, karta Novinka, AI kontext, export, i18n cs+en. Server: připomínky (§3.1–3.4), ťuk otevře modul, `sticky:false`. Smazat starý kód vody. | **L** (klient ~400 ř. app.js, ~120 ř. CSS, ~40 ř. HTML), server **S** (~70 ř. + texty) |
| **4.63** | Tlačítko „+2 dl“ v notifikaci (varianta 1), propojení s návykem (+ přeskočení zdvojené připomínky), XP za splněný cíl, foreground toast místo notifikace. | **M** |
| **4.64** | Týdenní karta a nedělní report, odznak „Týden vody“, `dailyStats`, automatické odškrtnutí skupinové výzvy `water`. | **S–M** |
| Později | Zkratka na ploše „💧 Napít se 2 dl“ přes `manifest.json` `shortcuts` (vyžaduje reinstalaci PWA), návrh cíle podle váhy (~35 ml/kg), zápis vody přes AI chat („vypil jsem 2 dl“), tichý zápis z notifikace přes podepsanou HTTPS funkci (§3.5 var. 3), včerejší dopsání. | S / S / M / L / S |

Paralelizace 4.62: serverová část (functions/index.js, i18n-server.js, `sendPush`) a sw.js se nedotýkají `app.js` → může je dělat druhý koder souběžně. `app.js` + `index.html` + `style.css` jeden koder. Verze: `APP_VERSION` 4.62, záznam v `CHANGELOG`, bump `CACHE` v sw.js. Funkce se nasadí samy po pushi (GitHub Actions). Pravidla Firestore se nemění.

---

## 7. Na co si dát pozor (koder, tester)

- `waterDay` do `profNoTokens()`, jinak se stav dne přepisuje starou kopií.
- Undo: `arrayRemove` potřebuje přesně stejný objekt (všechna pole). `waterDay.last` po undo přepočítat z nejnovějšího zbývajícího záznamu, ne jen vymazat.
- Přechod přes půlnoc: při návratu do appky (visibilitychange) a v 00:00 přepnout den (vzor `_foodDayTimer`). Widget nesmí ukazovat včerejší láhev.
- Nevolat celé `rDash()` po ťuku ve widgetu (mění náhodnou hlášku a znovu načítá citát).
- SVG `clipPath` ID unikátní pro modul a widget.
- Server: validovat všechna pole `prof.water` a `prof.waterDay` (rozsahy, `HHMM_RE`, seznam intervalů), `from ≥ to` = vypnuto.
- Statický test: simulace v node pro funkci „poslat?“ (kotva, k ≤ 3, okno 5 min, tempo, půlnoc, `from ≥ to`, chybějící `waterDay`, jiný den v `waterDay.d`).
- Žádný uživatelský text v push logu (stávající konvence).

---

## 8. Otázky pro vedoucího (výchozí = moje doporučení)

1. **Šablona Zdraví v liště:** Návyky + Pitný režim (Cíle do „Více“)? **Výchozí: ano.**
2. **Připomínky po zapnutí modulu:** v průvodci předzaškrtnuté? **Výchozí: ano, předzaškrtnuté** (je to jádro Adamova zadání), interval 1,5 h, 8:00–21:00, tempo vypnuté.
3. **Tlačítko „+2 dl“ v notifikaci otevře appku** (ne tichý zápis na pozadí)? **Výchozí: ano, otevře** (spolehlivé, server hned ví, uživatel vidí láhev). Tichý zápis až podle zájmu.
4. **Max. 3 připomínky po posledním pití, pak ticho do dalšího zápisu?** **Výchozí: ano.**
5. **XP za splněnou vodu bez propojeného návyku 10 bodů?** **Výchozí: ano** (stejně jako jeden návyk), s návykem nic navíc.
6. **Jednotky:** cs dl/l, en ml/l, bez přepínače (oz až při zájmu). **Výchozí: ano.**
7. **Všechny nápoje se počítají stejně** (káva = voda), bez koeficientů. **Výchozí: ano** – jednoduché, uživatel si šálek kávy prostě nepřidá.
