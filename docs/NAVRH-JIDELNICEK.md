# Návrh: Jídelníček (mobil 360 px, všechna témata)

Podnět: přepínač Rodina/Moje vypadá jinak než v Nákupech, modul působí jako slepenec (tlačítko nákupu, volné pole s cílem kcal, karta kalorií, pod ní týden). Prošel jsem HTML, CSS i logiku.

> **Čísla řádků** odpovídají pracovnímu stromu 2026-10-07, kde jsou necommitnuté změny jiného agenta (zápisník, výběr času) v `app.js`, `index.html`, `style.css`. Jídelníčku se netýkají, ale posouvají řádky. Jiný agent soubor během psaní dál měnil: `renderMealPlan` byl na ř. 5383 (HEAD), pak 5425 a nakonec ~5590. Čísla v `app.js` ber jako orientační. Koder ať místa vždy najde grepem podle názvu funkce nebo ID (`renderMealPlan`, `renderKcalToday`, `openMealPicker`, `saveKcalGoal` …). Čísla v `index.html` a `style.css` jsou přesná k uvedenému dni.
>
> Výchozí téma appky je `sunshine` (světlé, `app.js:2987`), takže kontrast řeším hlavně pro něj.

## Příčiny (proč to vypadá divně)

| Problém | Příčina | Místo |
|---|---|---|
| Přepínač má systémový font a tvrdé rámečky | `<button>` v appce nedědí font (žádný globální `font:inherit`), inline styl bez `font-family`; JS přepisuje `style.cssText` a nastavuje `color:var(--tc)`, ale proměnná `--tc` neexistuje | index.html:800–803, app.js:5434–5446 |
| Nákupy používají jinou komponentu | `.shop-seg`/`.shop-seg-btn` + `classList`, navíc inline `display:none` přebíjí `.shop-seg{display:flex}` | style.css:1128–1130, index.html:626, app.js:7875–7885 |
| Neaktivní segment je nečitelný | `.shop-seg-btn{color:var(--text3)}` na `--card2`: 2,2:1 tmavé, 2,8:1 sunshine | style.css:1129 |
| Aktivní segment v tangerine | `color:#1a1a1a` na `#c94800` = 3,7:1 (existuje `--on-accent`, bílá = 4,8:1) | style.css:1130, 86–87 |
| Monospace v kartě kcal | inline `font-family:monospace` (pilulka, osa, makra, nadpis „Dnešní jídla“, popisky v modalu) | app.js:5584, 5591, 5600, 5605, 5610, 5616, 5634, 5647 |
| Cíl kcal visí volně | samostatný `div` mezi hlavičkou a kartou | index.html:807–813 |
| Přepínač Rodina/Moje v hlavičce mění jen plán, ne kalorie | kalorie jsou vždy osobní, ale stojí pod přepínačem | index.html:800, 815 |
| Názvy dnů nečitelné ve světlém tématu | `color:var(--accent)` na kartě: sunshine 2,9:1 | app.js:~5474 |
| Malé dotykové plochy | slot `min-height:34px`, ✕ 12 px s paddingem 2 px, × u čipu, segmenty ~26 px, `.cook-tab` ~36 px | app.js:5480–5484, 5571, index.html:801–802, style.css:1167 |
| „—“ bez vysvětlení | neadmin ve sdíleném plánu nevidí nic než pomlčky, žádná věta proč | app.js:5483 |

---

## 1. Jednotný segmentový přepínač `.seg`

Jediná komponenta pro všechny přepínače Rodina/Moje. Grep (`view-toggle`, `toggle-shared`, `ViewMode`) našel jen dva: Nákupy a Jídelníček. Kalendář a checklisty přepínač nemají.

**Před:** dvě tlačítka v rámečku, systémový font, 12px, ~26 px výška, aktivní barva z neexistující `--tc`.
**Po:** zlatá pilulka jako v Nákupech, Crimson Pro 15px, tlačítko 44 px, čitelný neaktivní stav, `--on-accent` na aktivním.

Texty bez emoji („Rodina“ / „Moje“): stejně jako v Nákupech. ZWJ emoji 👨‍👩‍👧 se na části Androidů rozpadá na tři postavy a na 360 px zbytečně zabírá místo.

### CSS – style.css:1127–1130 (nahradit blok `/* SHOP SEGMENT TOGGLE */`)
```css
/* SEGMENTOVÝ PŘEPÍNAČ (Rodina / Moje) – Nákupy, Jídelníček */
.seg{display:inline-flex;gap:2px;padding:3px;background:var(--card2);border:1px solid var(--border);border-radius:24px}
.seg[hidden]{display:none}
.seg--block{display:flex;width:100%;margin-bottom:12px}
.seg--block .seg-btn{flex:1}
.seg-btn{min-height:44px;padding:0 18px;border:none;border-radius:21px;background:transparent;color:var(--text2);font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s,color .2s;-webkit-tap-highlight-color:transparent}
.seg-btn.active{background:var(--accent);color:var(--on-accent)}
.seg-btn:not(.active):hover{color:var(--text)}
```
Kontrast: neaktivní `--text2` na `--card2` = 5,3:1 (tmavé), 5,6:1 (sunshine), 6,1:1 (tangerine). Aktivní: 6,0:1 (sunshine), 4,8:1 (tangerine bílá).

### HTML
Nákupy, index.html:626 (jen obal přepínače uvnitř hlavičky):
```html
<div class="seg" id="shop-view-toggle" role="group" aria-label="Čí seznam zobrazit" hidden>
  <button class="seg-btn" data-mode="shared" onclick="setShopView(this.dataset.mode)">Rodina</button>
  <button class="seg-btn" data-mode="personal" onclick="setShopView(this.dataset.mode)">Moje</button>
</div>
```
Jídelníček: viz bod 2 (`seg seg--block`, `id="meal-view-toggle"`). Mrtvý `#meal-shared-badge` (index.html:799, JS ho vždy skrývá) smazat.

### JS – sdílený pomocník (vložit k `setMealView`, app.js:~4567)
```js
// Segmentový přepínač: zobrazí/skryje a označí aktivní volbu (bez inline stylů)
function syncSeg(id, show, mode) {
  const w = document.getElementById(id);
  if(!w) return;
  w.hidden = !show;
  w.querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
```
- `renderMealPlan` (app.js:5431–5450): celý blok `badge`/`toggle`/`selStyle` nahradit `syncSeg('meal-view-toggle', canShareMeal, mealViewMode);`
- `renderShop` (app.js:7874–7889): obdobně `syncSeg('shop-view-toggle', canShareShop, shopViewMode);` a smazat řádky s `shop-shared-badge` (badge je vždy skrytý).

Pozor: `setMealView`/`setShopView` už jsou na `window` (app.js:4568, 4570). `data-mode` jsou konstanty, `esc()` netřeba. Hodnotu z `dataset` ve `setMealView` ověřit (`mode==='personal'?'personal':'shared'`), ať se z DOM nedá podstrčit jiný řetězec.

---

## 2. Uspořádání: dvě záložky „Plán týdne“ / „Kalorie dnes“ (doporučuji)

| Varianta | Pro | Proti |
|---|---|---|
| **A. Dvě záložky** (`.cook-tabs` jako Vaření a Nákupy) | Oddělí dva úkony: jednou týdně plánuji, denně zapisuji. Přepínač Rodina/Moje patří jen k plánu, takže je jasné, že kalorie jsou osobní. Na 360 px žádná dlouhá stránka. Známý vzor z appky. | O jedno klepnutí víc ke kaloriím. |
| B. Kalorie přesunout jinam (Zdraví, Nastavení, dashboard) | Jídelníček by byl jen plán. | Proti NAPADY („Denní kalorický příjem by měl být vidět přímo u jídelníčku, ne v nastavení“). Zápis jídla z dnešního plánu by byl v jiném modulu. |
| C. Jedna stránka, jen přeskládat | Nejmenší zásah. | Na mobilu ~2 000 px, kalorie odsunou plán pod ohyb (nebo naopak), přepínač zůstane matoucí. |

**Doporučuji A.** Splňuje NAPADY (kalorie zůstávají u jídelníčku), opakuje vzor Recepty/Zásoby a Seznam/Zásoby a řeší nejasnost, k čemu se Rodina/Moje vztahuje. Poslední otevřenou záložku si pamatovat v `localStorage` (`lp_meal_tab`, čtení i zápis v try/catch), takže kdo denně zapisuje, otevře rovnou kalorie.

```
┌ 🥗 Jídelníček ───────────────────┐
│ [ 📅 Plán týdne ][ 🔥 Kalorie dnes ]│   .cook-tabs
├── záložka Plán ───────────────────┤
│ [   Rodina   |    Moje    ]       │   .seg.seg--block (jen ve skupině)
│ 👀 Rodinný plán upravuje správce… │   jen neadmin ve sdíleném
│ [✨ Navrhnout AI][🛒 Do nákupu]    │   .mp-actions (2 sloupce, 44 px)
│ ┌ Pondělí ─────────────── Dnes ┐  │
│ │ 🌅 Snídaně  [ Ovesná kaše  ✕ ]│  │
│ │ ☀️ Oběd     [ + Přidat oběd   ]│  │
│ …                                 │
├── záložka Kalorie ────────────────┤
│ 1 240 kcal          [ 62 % ]      │
│ z 2 000 kcal · zbývá 760 kcal     │
│ ▓▓▓▓▓▓▓▓░░░░░                     │
│ 🎯 Cíl 2 000 kcal  [Změnit]        │
│ Bílkoviny ▓▓░░  48 g …            │
│ Dnešní jídla                       │
│  Ovesná kaše · 8:10   320 kcal  ✕ │
│ [ + Přidat jídlo ]                 │
└───────────────────────────────────┘
```

### HTML – index.html:794–816 (nahradit celý `#p-mealplan`)
```html
<div class="page" id="p-mealplan">
  <div class="gh">
    <div class="mp-head"><span class="mp-head-em" aria-hidden="true">🥗</span><div class="ptitle">Jídelníček</div></div>
  </div>
  <div class="cook-tabs" role="tablist">
    <button class="cook-tab active" id="mp-tab-plan" role="tab" onclick="switchMealTab('plan')">📅 Plán týdne</button>
    <button class="cook-tab" id="mp-tab-kcal" role="tab" onclick="switchMealTab('kcal')">🔥 Kalorie dnes</button>
  </div>

  <div id="mp-section-plan">
    <div class="seg seg--block" id="meal-view-toggle" role="group" aria-label="Čí jídelníček zobrazit" hidden>
      <button class="seg-btn" data-mode="shared" onclick="setMealView(this.dataset.mode)">Rodina</button>
      <button class="seg-btn" data-mode="personal" onclick="setMealView(this.dataset.mode)">Moje</button>
    </div>
    <p class="mp-note" id="mp-readonly-note" hidden>👀 Rodinný jídelníček upravuje správce skupiny. Svůj vlastní si můžeš vést v „Moje“.</p>
    <div class="mp-actions">
      <button class="btn-s mp-act" id="mp-ai-btn" onclick="generateMealPlanAI()">✨ Navrhnout AI</button>
      <button class="btn-s mp-act" onclick="mealplanToShopping()">🛒 Do nákupu</button>
    </div>
    <div id="mealplan-content"></div>
  </div>

  <div id="mp-section-kcal" hidden>
    <div id="kcal-today-section"></div>
  </div>
</div>
```
Pole `#set-kcalgoal` z HTML zmizí, cíl se edituje v kartě kalorií (bod 3).

### CSS (nový blok za `.cook-tab.active`, style.css:~1168)
```css
/* JÍDELNÍČEK */
.mp-head{display:flex;align-items:center;gap:10px}
.mp-head-em{font-size:26px}
.mp-note{margin:0 0 12px;padding:10px 14px;background:var(--card2);border:1px solid var(--border);border-radius:12px;font-size:15px;line-height:1.4;color:var(--text2)}
.mp-note[hidden],#mp-section-kcal[hidden],#mp-section-plan[hidden]{display:none}
.mp-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.mp-act{min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;color:var(--text);font-weight:600;white-space:nowrap}
.mp-act[hidden]{display:none}
.mp-actions:has(.mp-act[hidden]){grid-template-columns:1fr}
/* dotykové plochy záložek všude (Vaření, Nákupy, Jídelníček) */
.cook-tab{min-height:44px}
```
`:has` mají všechny cílové prohlížeče (Chrome 105+, iOS 15.4+). Jako zálohu může JS přidat třídu `.mp-actions--one`.

### JS
```js
window.switchMealTab = (tab) => {
  tab = tab === 'kcal' ? 'kcal' : 'plan';
  document.getElementById('mp-tab-plan')?.classList.toggle('active', tab === 'plan');
  document.getElementById('mp-tab-kcal')?.classList.toggle('active', tab === 'kcal');
  const ps = document.getElementById('mp-section-plan'), ks = document.getElementById('mp-section-kcal');
  if(ps) ps.hidden = tab !== 'plan';
  if(ks) ks.hidden = tab !== 'kcal';
  try { localStorage.setItem('lp_meal_tab', tab); } catch(e) {}
};
```
- Při otevření stránky (`sp`, app.js:6337, větev `id==='mealplan'`) zavolat `switchMealTab(savedTab)`, kde `savedTab` se čte v try/catch, výchozí `'plan'`.
- V `renderMealPlan`: `document.getElementById('mp-readonly-note').hidden = !(isShared && !canEdit);` a `mp-ai-btn.hidden = !canEdit || !hasAnyMeal` (prázdný plán má AI v uvítací kartě).
- Konec `renderMealPlan` (app.js:5489, spodní `btn-p` „Navrhnout jídelníček pomocí AI“) smazat, nahrazuje ho `#mp-ai-btn`.
- `generateMealPlanAI` (app.js:5509): pokud plán už něco obsahuje, nejdřív `if(!confirm('AI přepíše celý týden. Pokračovat?')) return;` Teď přepíše bez varování.
- Uvítací karta (app.js:5460–5467): beze změny obsahu, jen inline styly do třídy `.mp-empty`. Barva nadpisu `--text`, ne `--accent` (kontrast).

---

## 3. Typografie, barvy, kontrast, karta kalorií

Pravidla pro celý modul: žádné `monospace` ani systémové písmo. Text a čísla Crimson Pro s `font-variant-numeric:tabular-nums` (čísla se při změně neposouvají). Nadpisy Playfair Display jako `.ptitle`/`.stats-sec-title`. Barvy jen z proměnných, `--accent` jako barva textu jen na velkém písmu (≥ 18 px tučně), jinak `--text`/`--text2`. Text `--text3` nepoužívat pro informace, které je potřeba přečíst (sunshine 3,2:1, tmavé 2,4:1).

### Karta kalorií – nahradit tělo `renderKcalToday` (app.js:5555–5622)
**Před:** `0 kcal` / „z cíle 2 000 kcal · zbývá 2000“ / pilulka „0 % splněno“ (monospace, zelená i při 0) / osa 0–500–1000–1500–2000 (monospace) / makra s barevnými čísly v monospace / „DNEŠNÍ JÍDLA“ monospace prostrkané / čipy s × 13 px.
**Po:**
```js
const fmt = n => Math.round(n).toLocaleString('cs-CZ');
const pctRaw = goal ? Math.round(totalKcal / goal * 100) : 0;
const pill = over
  ? `<span class="kc-pill kc-pill--over">+${fmt(totalKcal - goal)} kcal</span>`
  : `<span class="kc-pill">${pctRaw} %</span>`;
const sub = over
  ? `Cíl ${fmt(goal)} kcal je překročený`
  : `z ${fmt(goal)} kcal · zbývá ${fmt(remaining)} kcal`;
const macro = (emoji, label, val, max, cls) => `
  <div class="kc-macro">
    <span class="kc-macro-l">${emoji} ${label}</span>
    <span class="kc-bar"><span class="kc-bar-fill ${cls}" style="width:${Math.min(Math.round(val/max*100),100)}%"></span></span>
    <span class="kc-macro-v">${fmt(val)} g</span>
  </div>`;
const rows = todayLogs.sort((a,b)=>(a.time||'').localeCompare(b.time||'')).map(l => `
  <li class="kc-log">
    <span class="kc-log-name">${esc(l.name)}${l.time ? `<small>${esc(l.time)}</small>` : ''}</span>
    <span class="kc-log-kcal">${fmt(Number(l.kcal)||0)} kcal</span>
    <button class="kc-del" data-a0="${esc(l.id)}" onclick="deleteFoodLog(this.dataset.a0)" aria-label="Smazat ${esc(l.name)}">✕</button>
  </li>`).join('');

sec.innerHTML = `
<div class="kc-card">
  <div class="kc-top">
    <div><div class="kc-big">${fmt(totalKcal)}<span>kcal</span></div><div class="kc-sub">${sub}</div></div>
    ${pill}
  </div>
  <div class="kc-bar kc-bar--main" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${totalKcal}" aria-label="Snědeno kcal">
    <span class="kc-bar-fill ${over?'kc-red':'kc-gold'}" style="width:${pct}%"></span>
  </div>
  <div class="kc-goal" id="kc-goal-row">
    <span>🎯 Cíl ${fmt(goal)} kcal</span>
    <button class="kc-link" onclick="editKcalGoal()">Změnit</button>
  </div>
  ${macro('💪','Bílkoviny',totalP,150,'kc-blue')}
  ${macro('🍞','Sacharidy',totalC,250,'kc-orange')}
  ${macro('🥑','Tuky',totalF,80,'kc-green')}
  <h3 class="kc-h">Dnešní jídla</h3>
  ${rows ? `<ul class="kc-logs">${rows}</ul>` : `<p class="kc-empty">Zatím nic. Přidej první jídlo, třeba z dnešního plánu.</p>`}
  <button class="btn-s kc-add" onclick="openAddFoodLog()">+ Přidat jídlo</button>
</div>`;
```
Osu 0/500/1000/1500/2000 vypouštím: na 360 px je to šum a stejnou informaci nese „zbývá … kcal“ a procento.

Úprava cíle (místo volného pole, index.html:807–813, a `saveKcalGoal`, app.js:7315):
```js
window.editKcalGoal = () => {
  const row = document.getElementById('kc-goal-row');
  if(!row) return;
  row.innerHTML = `<label class="kc-goal-edit">🎯 Cíl
      <input id="set-kcalgoal" class="finp" type="number" inputmode="numeric" min="500" max="9999" value="${Number(prof.kcalGoal)||2000}"> kcal</label>
    <button class="btn-s kc-save" onclick="saveKcalGoal(this)">Uložit</button>`;
  document.getElementById('set-kcalgoal')?.focus();
};
window.saveKcalGoal = async (btn) => {
  const v = parseInt(document.getElementById('set-kcalgoal')?.value, 10);
  if(!v || v < 500 || v > 9999) { toast('⚠️ Zadej cíl mezi 500 a 9 999 kcal'); return; }
  if(btn) btn.disabled = true;
  try {
    await setDoc(doc(db,'users',CU.uid,'profile','main'), {kcalGoal:v}, {merge:true});
    prof.kcalGoal = v;
    toast('✓ Cíl uložen');
    renderKcalToday();
  } catch(e) { if(btn) btn.disabled = false; toast('❌ '+userErr(e,'cíl kalorií')); }
};
```
V `renderMealPlan` smazat řádky 5427–5428 (`kg.value = …`). Teď přepisují rozepsané číslo při každém snapshotu rodinného plánu.

### CSS (kalorie)
```css
.kc-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px 16px;box-shadow:var(--shadow);font-variant-numeric:tabular-nums}
.kc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.kc-big{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:40px;line-height:1;color:var(--text)}
.kc-big span{font-family:'Crimson Pro',serif;font-style:normal;font-weight:400;font-size:16px;color:var(--text2);margin-left:6px}
.kc-sub{font-size:15px;color:var(--text2);margin-top:4px}
.kc-pill{flex-shrink:0;padding:6px 12px;border-radius:20px;background:var(--card2);border:1px solid var(--border);font-size:15px;font-weight:700;color:var(--text);white-space:nowrap}
.kc-pill--over{color:var(--red);border-color:var(--red)}
.kc-bar{display:block;height:8px;background:var(--card3);border-radius:6px;overflow:hidden}
.kc-bar--main{height:10px;margin-bottom:12px}
.kc-bar-fill{display:block;height:100%;border-radius:inherit;transition:width .5s ease}
.kc-gold{background:linear-gradient(90deg,var(--accent),var(--accent2))}
.kc-red{background:var(--red)}.kc-blue{background:var(--blue)}.kc-orange{background:var(--accent2)}.kc-green{background:var(--green)}
.kc-goal{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;margin-bottom:10px;font-size:15px;color:var(--text2)}
.kc-goal-edit{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--text2)}
.kc-goal-edit .finp{width:96px;font-size:16px;text-align:center;min-height:44px}
.kc-link,.kc-save{min-height:44px;padding:0 14px}
.kc-link{background:none;border:none;color:var(--text);font-family:'Crimson Pro',serif;font-size:15px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.kc-macro{display:grid;grid-template-columns:96px 1fr 52px;align-items:center;gap:10px;margin-bottom:10px}
.kc-macro-l{font-size:15px;color:var(--text2);white-space:nowrap}
.kc-macro-v{font-size:15px;font-weight:700;color:var(--text);text-align:right}
.kc-h{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:var(--text);margin:18px 0 8px}
.kc-logs{list-style:none;margin:0 0 10px;padding:0}
.kc-log{display:flex;align-items:center;gap:8px;min-height:48px;border-bottom:1px solid var(--border)}
.kc-log-name{flex:1;min-width:0;font-size:16px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kc-log-name small{margin-left:6px;font-size:13px;color:var(--text2)}
.kc-log-kcal{font-size:15px;font-weight:700;color:var(--text);white-space:nowrap}
.kc-del{width:44px;height:44px;flex-shrink:0;background:none;border:none;color:var(--text2);font-size:16px;cursor:pointer;border-radius:10px}
.kc-empty{font-size:15px;color:var(--text2);margin:0 0 10px}
.kc-add{width:100%;min-height:48px;border-style:dashed;color:var(--text);font-weight:600}
```
Výpočet šířky na 360 px: stránka 340 (padding 10, style.css:790), karta 308, makra 96+52+20 = 168, takže pruh ~140 px. Nic nepřetéká.

Modal „Přidat jídlo“ (`openAddFoodLog`, app.js:5625–5660): popisky „Z dnešního plánu“ / „Zadat ručně“ bez `monospace` a `uppercase`, `font-size:15px;color:var(--text2)`. Čtyři čísla místo jednoho řádku do mřížky 2×2 (`display:grid;grid-template-columns:1fr 1fr;gap:8px`). Inputy `font-size:16px` (iOS jinak zoomuje), `inputmode="numeric"`. Tlačítko „Přidat“ `color:var(--on-accent)` místo `#1a1a1a`.

---

## 4. Týdenní plán

**Před:** 7 karet, název dne zlatě (sunshine 2,9:1), řádek 34 px, prázdné pole „Klikni pro výběr…“ (desktopové slovo) nebo „—“, ✕ 12 px, inline `onmouseover`, `onclick="openMealPicker('${dayKey}',…,'${day}','${meal}')"`.
**Po:** dnešní den zvýrazněný (rámeček `--accent` a štítek „Dnes“). Slot je tlačítko 48 px. Prázdný slot u editora ukazuje „+ Přidat snídani / oběd / večeři“ s čárkovaným okrajem, u čtenáře „Zatím nic“. ✕ je samostatné tlačítko 44 × 44 px.

### JS – nahradit mapování dnů v `renderMealPlan` (app.js:5469–5489)
```js
const todayIdx = (new Date().getDay() + 6) % 7; // 0 = pondělí (lokální čas)
const MEAL_EMOJI = ['🌅','☀️','🌙'];
const MEAL_ACC = ['snídani','oběd','večeři'];
el.innerHTML = welcomeBanner + DAYS_CS.map((day, di) => {
  const dayKey = 'd'+di, dayData = plan[dayKey] || {}, isToday = di === todayIdx;
  return `<section class="mp-day${isToday?' mp-day--today':''}" ${isToday?'id="mp-today"':''}>
    <h3 class="mp-day-h">${day}${isToday?'<span class="mp-today">Dnes</span>':''}</h3>
    ${MEALS_CS.map((meal, mi) => {
      const mealKey = 'm'+mi, val = (dayData[mealKey] || '').trim();
      const label = `<span class="mp-slot-l">${MEAL_EMOJI[mi]} ${meal}</span>`;
      if(!canEdit) return `<div class="mp-row">${label}<div class="mp-slot mp-slot--ro${val?'':' is-empty'}">${val?esc(val):'Zatím nic'}</div></div>`;
      return `<div class="mp-row">${label}
        <button class="mp-slot${val?'':' is-empty'}" data-a0="${dayKey}" data-a1="${mealKey}"
          onclick="openMealPicker(this.dataset.a0,this.dataset.a1)">
          ${val ? esc(val) : `+ Přidat ${MEAL_ACC[mi]}`}</button>
        ${val ? `<button class="mp-del" data-a0="${dayKey}" data-a1="${mealKey}" onclick="clearMealSlot(this.dataset.a0,this.dataset.a1)" aria-label="Smazat ${meal}">✕</button>` : ''}
      </div>`;
    }).join('')}
  </section>`;
}).join('');
```
Inline handler v modulu nevidí `const DAYS_CS`, proto `openMealPicker` dostane jen klíče. Popisky si dohledá sám: změnit signaturu (app.js:5831) na `(dayKey, mealKey)`, ověřit `/^d[0-6]$/` a `/^m[0-2]$/` (jinak `return`) a pak `const dayLabel = DAYS_CS[+dayKey[1]], mealLabel = MEALS_CS[+mealKey[1]];`. Jiný volající `openMealPicker` není (ověřeno grepem). V modalu přepsat i `pickMealManual('${dayKey}','${mealKey}')` (app.js:~5865, Enter i tlačítko) na `data-a0/a1` podle pravidla repa.

Nová funkce (řeší i chybu 3 v bodě 5):
```js
window.clearMealSlot = async (dayKey, mealKey) => {
  await saveMealPlanItem(dayKey, mealKey, '');
  renderMealPlan();
};
```

Posun na dnešek: jednou při otevření stránky, ne při každém snapshotu. V `sp` větvi `mealplan` po `renderMealPlan()`:
```js
if(todayIdx > 1) requestAnimationFrame(() => document.getElementById('mp-today')?.scrollIntoView({block:'start', behavior:'smooth'}));
```
Pondělí a úterý jsou nahoře, tam není kam posouvat. Při `prefers-reduced-motion` použít `behavior:'auto'`.

### CSS
```css
.mp-day{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:12px;margin-bottom:10px;scroll-margin-top:70px}
.mp-day--today{border:2px solid var(--accent);padding:11px}
.mp-day-h{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:var(--text)}
.mp-today{font-family:'Crimson Pro',serif;font-size:13px;font-weight:700;padding:2px 10px;border-radius:12px;background:var(--accent);color:var(--on-accent)}
.mp-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.mp-row:last-child{margin-bottom:0}
.mp-slot-l{width:76px;flex-shrink:0;font-size:14px;color:var(--text2);white-space:nowrap}
.mp-slot{flex:1;min-width:0;min-height:48px;display:flex;align-items:center;padding:8px 12px;text-align:left;background:var(--card2);border:1px solid var(--border);border-radius:10px;font-family:'Crimson Pro',serif;font-size:16px;color:var(--text);cursor:pointer;overflow-wrap:anywhere}
.mp-slot.is-empty{background:transparent;border:1px dashed var(--border2);color:var(--text2);font-weight:600}
.mp-slot--ro{cursor:default}
.mp-slot--ro.is-empty{border-style:solid;font-weight:400;font-style:italic}
.mp-slot:not(.mp-slot--ro):active{border-color:var(--accent)}
@media(hover:hover){.mp-slot:not(.mp-slot--ro):hover{border-color:var(--accent)}}
.mp-del{width:44px;height:44px;flex-shrink:0;background:none;border:none;border-radius:10px;color:var(--text2);font-size:16px;cursor:pointer}
```
Na 360 px: karta 340 − 2×12 = 316, popisek 76 + mezery 16 + ✕ 44 = 136, takže slot má ~180 px a dlouhý název se zalomí (`overflow-wrap`). Den zabere ~190 px, celý týden ~1 400 px. Proto jednorázový posun na dnešek.

---

## 5. Chyby v logice (max. 3)

1. **Neadmin stejně přepíše sdílený plán (přes Vaření).** `confirmAddToMealplan` (app.js:5932) volá `saveMealPlanItem` bez `canEditMealPlan()` a ta nekontroluje nic (app.js:5492). Pravidla povolují zápis všem členům (`firestore.rules:60–63`). Tlačítko „📅 Přidat do jídelníčku“ ve Vaření (index.html:~588) tak zapíše do rodinného plánu, i když ho člen nesmí měnit. Navíc nikde neuvidí, kam se jídlo uložilo.
   Oprava: na začátek `saveMealPlanItem` dát `if(!canEditMealPlan()) { toast('⚠️ Rodinný jídelníček upravuje správce. Ulož si jídlo do „Moje“.'); return false; }` a v modalu `openAddToMealplan` ve skupině zobrazit `.seg` Rodina/Moje (výchozí „Moje“ pro neadmina). Pravidla neměnit, je to UX ochrana. Zpřísnění rules je otázka pro vedoucího a vyžaduje souhlas uživatele.
2. **Dvě funkce berou špatný plán.** `mealplanToShopping` (app.js:5750–5752) počítá `isShared` bez `mealViewMode`, takže v „Moje“ pošle do nákupu ingredience z rodinného plánu. `openAddFoodLog` (app.js:5625–5630) naopak bere vždy `prof.mealPlan`, takže „Z dnešního plánu“ nenabídne nic, když rodina plánuje společně.
   Oprava: jeden zdroj pravdy `function currentMealPlan(){ return isMealShared() ? familyMealPlan : (prof.mealPlan||{}); }` použitý v `renderMealPlan`, `mealplanToShopping` i `openAddFoodLog`. V `openAddFoodLog` vzít den přes `(new Date().getDay()+6)%7`, ten už je správně.
3. **Osobní plán se po smazání nebo ručním přidání nepřekreslí.** Pro profil neexistuje `onSnapshot` (ověřeno grepem, `createFireSub` jen pro entries, events, foodLogs …). `saveMealPlanItem` v osobní větvi jen upraví `prof.mealPlan`. ✕ ve slotu (app.js:5484) a `pickMealManual` (app.js:5885) tedy nevolají `renderMealPlan`: smazané jídlo zůstane vidět a ručně zadané se neobjeví, dokud uživatel neodejde ze stránky. Ve sdíleném režimu to maskuje snapshot rodiny.
   Oprava: `clearMealSlot` z bodu 4 a `renderMealPlan()` na konec `pickMealManual`. Do `saveMealPlanItem` doplnit try/catch s `toast('❌ '+userErr(e,'jídelníček'))`, teď chyba spadne tiše.

Drobnosti do backlogu (push neblokují): makra mají pevné maximum 150/250/80 g bez ohledu na cíl. Uvítací karta ani spodní AI tlačítko nepoužívají `--on-accent`, `.btn-p` má natvrdo `#1a1a1a` (tangerine 3,7:1, style.css:251).

---

## Na co si dát pozor (koder)

- **Témata:** žádné `#1a1a1a`, `#f5c842`, `rgba(245,200,66,…)` v nových stylech. Na akcentu vždy `--on-accent`. Projít `dark-gold`, `sunshine` (výchozí) a `tangerine`.
- **`esc()`:** názvy jídel (`val`, `l.name`, `l.time`, `r.name`) vždy přes `esc()`, i v `aria-label`.
- **`data-aN`:** všechny nové handlery přes `this.dataset.aN`. Žádné `onclick="fn('${x}')"`, ani s konstantami.
- **`window`:** nové `switchMealTab`, `editKcalGoal`, `clearMealSlot` přiřadit na `window` (app.js je modul). `saveKcalGoal` už na `window` je, jen přepsat.
- **`hidden` + `display:flex`:** třída s `display` přebije atribut `hidden`, proto pravidla `[hidden]{display:none}` v CSS výše.
- **`localStorage`:** `lp_meal_tab` číst i zapisovat v try/catch, výchozí `'plan'`.
- **Datum:** dnešek přes `toDS()` u logů, index dne přes `(getDay()+6)%7`, nikdy `toISOString()`.
- **Verze:** `APP_VERSION` (app.js:24) + záznam v `CHANGELOG`, např. „🥗 Jídelníček má záložky Plán týdne a Kalorie dnes, přehlednější týden a stejný přepínač Rodina/Moje jako Nákupy“. Bump `CACHE` v `sw.js:45`.
- `.cook-tab{min-height:44px}` zvětší záložky i ve Vaření a Nákupech. To je záměr, jen zkontrolovat, že se tam nic nerozbije.

## Otázky pro vedoucího (výchozí = moje doporučení)

1. **Struktura:** dvě záložky Plán týdne / Kalorie dnes s pamatováním poslední záložky? **Doporučuji ano** (varianta A).
2. **Texty přepínače:** „Rodina“ / „Moje“ bez emoji v obou modulech? **Doporučuji ano**, ZWJ emoji se na Androidu rozpadá.
3. **Ochrana sdíleného plánu:** jen v UI (bod 5.1), nebo i ve `firestore.rules`? **Doporučuji teď jen UI.** Pravidla pro role vyžadují souhlas uživatele a nasazení „ANO“.
4. **Přepínač v Nákupech:** jen výměna tříd na místě, nebo také řádek `seg--block` pod hlavičkou jako v Jídelníčku? **Doporučuji teď jen výměnu tříd**, přesun až s redesignem Nákupů.
5. **Osa 0/500/…/2000 a pevné cíle maker:** osu vypustit, makra nechat a cíle maker dát do backlogu? **Doporučuji ano.**
