# Návrh: Vaření → Recepty, horní část (mobil 360 px)

Podnět: stísněný řádek „pole + 2 tlačítka“, jiný font placeholderu, filtr RECEPT se zalamuje, filtr JÍDLO je useknutý bez náznaku scrollu a jeho čipy jsou vyšší (emoji nad textem).

## Příčiny (proč to vypadá divně)

| Problém | Příčina | Místo |
|---|---|---|
| Placeholder v systémovém fontu | `input` nedědí font z `body`, `.cook-what-input` nemá `font-family` | style.css:1055 |
| Navíc 15px → iOS při ťuknutí zoomuje | `font-size:15px` (< 16 px) | style.css:1055 |
| Stísněný řádek akcí | `.cook-top-row` je jeden flex řádek s `overflow:hidden` | style.css:1054, index.html:545–549 |
| „Navrhnout“ má špatný kontrast | `color:#fff` na `--accent` (sunshine #d4870a ≈ 2,6:1, tmavé #f5c842 ≈ 1,5:1) | style.css:1057 |
| „Levné“ samo na druhém řádku | `.cook-filter-row{flex-wrap:wrap}` | style.css:1064 |
| Emoji nad textem v JÍDLO | řádek je `nowrap`, čipy se smrští na min-content a text se zalomí v mezeře za emoji (chybí `white-space:nowrap; flex-shrink:0`) | style.css:1066, 1076 |
| Žádný náznak scrollu | skrytý scrollbar, žádný fade | style.css:1066–1067 |
| Málo šířky | karta v kartě: `.cook-prompt-wrap` (pad 12) + `.cook-filter-box` (pad 10 + rámeček) → na 360 px zbývá ~292 px | style.css:1051, 1063 |
| Aktivní čip je v světlém tématu málo čitelný | `color:var(--accent)` na `rgba(…,.08)` | style.css:1078 |
| Čipy menší než 44 px | `padding:5px 12px` (mobil 7px 14px) | style.css:1076, 1110 |

Uncommitted diff jiných agentů v `index.html`/`style.css` se těchto řádků netýká (ověřeno grepem), ale koder ať čísla řádků ověří před úpravou.

---

## 1. Řádek akcí: pole přes celou šířku, pod ním 2 tlačítka

**Před:** `[Co chceš vařit?____][🔮 Navrhnout][✏️ Vlastní]`
**Po:**
```
[ Co chceš vařit?                      ]
[ 🔮 Navrhnout      ][ ✏️ Vlastní recept ]
```
Platí pro mobil i desktop (na desktopu to je klidnější a pole je delší; max-width stránky je 900 px, nevadí).

### HTML – index.html:545–549 (nahradit)
```html
<div class="cook-top-row">
  <input class="cook-what-input" type="text" id="cook-inp" placeholder="Co chceš vařit? Třeba „rychlá večeře z kuřete“" enterkeyhint="go" autocomplete="off" aria-label="Co chceš vařit" onkeydown="if(event.key===&#39;Enter&#39;)askRecipe()">
  <div class="cook-btn-row">
    <button class="btn-cook-gen" onclick="askRecipe()">🔮 Navrhnout</button>
    <button class="btn-cook-gen btn-cook-gen--ghost" onclick="openManualRecipe()">✏️ Vlastní recept</button>
  </div>
</div>
```
(Inline `style` u „Vlastní“ zmizí do třídy. Pokud je placeholder s příkladem na 360 px moc dlouhý, stačí „Co chceš vařit?“ – useknutí konce placeholderu nevadí.)

### CSS – style.css:1054–1058 (nahradit)
```css
.cook-top-row{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.cook-what-input{width:100%;min-height:46px;border:1px solid var(--border2);border-radius:12px;padding:10px 14px;font-family:'Crimson Pro',Georgia,serif;font-size:16px;background:var(--bg);color:var(--text);outline:none;transition:border-color .2s}
.cook-what-input::placeholder{color:var(--text3);font-family:inherit;opacity:1}
.cook-what-input:focus{border-color:var(--accent)}
.cook-btn-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn-cook-gen{min-height:44px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);border-radius:12px;padding:0 12px;font-family:'Crimson Pro',serif;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn-cook-gen--ghost{background:var(--card2);border-color:var(--border2);color:var(--text)}
.btn-cook-gen:active{transform:scale(.98)}
```
Smazat řádek 1058 (`@media(max-width:400px){.btn-cook-gen…}`), už není potřeba.

Pozor:
- `--on-accent` existuje (style.css:86–87): #1a1a1a pro dark-gold/sunshine, #fff pro tangerine → kontrast ≥ 4,5:1 ve všech tématech.
- `font-size:16px` je záměrně kvůli iOS (nezoomuje).
- `--bg` jako pozadí pole: v sunshine je karta bílá (style.css:1348) a pole #faf8f0 → jemně odlišené; v tmavém #0c0c10 na #16161c. Placeholder `--text3`: v tmavém je slabší, ale pro placeholder přijatelné.
- Ghost tlačítko má `--text` (ne `--text2`) kvůli kontrastu.

---

## 2. Filtry: jednotné čipy, jeden řádek, vodorovný scroll s fadem

Rozhodnutí: **dva řádky ponechat** (nesloučit do jednoho). Každý řádek má jiný význam: „Recept“ jen ladí AI návrh, „Jídlo“ navíc filtruje uložené recepty (app.js:8784). Sloučení by dalo dvakrát „Vše“ a nejasné kombinace. Popisky přesunout **nad řádek** (malé, ale čitelné) a přejmenovat na srozumitelnější:
- „Recept“ → **„Styl“**
- „Jídlo“ → **„Typ jídla“**

Zrušit vnořenou kartu `.cook-filter-box` (rámeček a pozadí), získá se ~22 px šířky a zmizí „krabice v krabici“.

**Před:**
```
RECEPT [Vše][⚡ Rychlé][🥗 Zdravé]
       [💰 Levné]
JÍDLO  [Vše][🌅  ][🍎   ][☀️ Ob…      <- čipy dvouřádkové
            Snídaně Svačina
```
**Po:**
```
STYL
[Vše][⚡ Rychlé][🥗 Zdravé][💰 Lev░   ->
TYP JÍDLA
[Vše][🌅 Snídaně][🍎 Svačina][☀️ O░   ->
```
(░ = fade, čipy 44 px vysoké, emoji vedle textu.)

### HTML – index.html:550–568 (nahradit blok `.cook-filter-box`)
```html
<div class="cook-filter-box">
  <div class="cook-filter-label" id="cook-lbl-type">Styl</div>
  <div class="cook-chip-scroll" role="group" aria-labelledby="cook-lbl-type">
    <button class="cook-opt-btn active" aria-pressed="true" data-t="any" onclick="setCookType(&#39;any&#39;,this)">Vše</button>
    <button class="cook-opt-btn" aria-pressed="false" data-t="quick" onclick="setCookType(&#39;quick&#39;,this)">⚡ Rychlé</button>
    <button class="cook-opt-btn" aria-pressed="false" data-t="healthy" onclick="setCookType(&#39;healthy&#39;,this)">🥗 Zdravé</button>
    <button class="cook-opt-btn" aria-pressed="false" data-t="cheap" onclick="setCookType(&#39;cheap&#39;,this)">💰 Levné</button>
  </div>
  <div class="cook-filter-label" id="cook-lbl-meal">Typ jídla</div>
  <div class="cook-chip-scroll" role="group" aria-labelledby="cook-lbl-meal">
    <button class="cook-opt-btn active" aria-pressed="true" data-m="any" onclick="setCookMealType(&#39;any&#39;,this)">Vše</button>
    <button class="cook-opt-btn" aria-pressed="false" data-m="Snídaně" onclick="setCookMealType(&#39;Snídaně&#39;,this)">🌅 Snídaně</button>
    <button class="cook-opt-btn" aria-pressed="false" data-m="Svačina" onclick="setCookMealType(&#39;Svačina&#39;,this)">🍎 Svačina</button>
    <button class="cook-opt-btn" aria-pressed="false" data-m="Oběd" onclick="setCookMealType(&#39;Oběd&#39;,this)">☀️ Oběd</button>
    <button class="cook-opt-btn" aria-pressed="false" data-m="Večeře" onclick="setCookMealType(&#39;Večeře&#39;,this)">🌙 Večeře</button>
    <button class="cook-opt-btn" aria-pressed="false" data-m="Dezert" onclick="setCookMealType(&#39;Dezert&#39;,this)">🍰 Dezert</button>
  </div>
</div>
```
Atributy `data-t`/`data-m` a hodnoty zůstávají (JS na ně spoléhá). Inline handlery mají jen konstanty, `esc()` se tu neřeší. `.cook-filter-sep-h` odpadá.

### CSS – style.css:1059–1068 a 1076–1078 (nahradit)
Smazat duplicitní definice `.cook-filter-label` (1060 i 1068), `.cook-filter-row`, `.cook-filter-sep-h`, `.cook-meal-scroll` a nahradit:
```css
.cook-filter-box{display:flex;flex-direction:column;gap:4px}
.cook-filter-label{font-size:12px;color:var(--text2);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:4px 2px 0}
.cook-chip-scroll{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;
  padding:3px 28px 3px 3px;margin:0 -3px;scroll-padding-inline:3px;
  -webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);
          mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}
.cook-chip-scroll::-webkit-scrollbar{display:none}
.cook-chip-scroll.is-end{-webkit-mask-image:none;mask-image:none}
.cook-opt-btn{flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 14px;
  background:var(--card2);border:1px solid var(--border2);border-radius:22px;
  font-family:'Crimson Pro',serif;font-size:15px;color:var(--text2);cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.cook-opt-btn:hover{border-color:var(--accent)}
.cook-opt-btn.active{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:700}
```
V mobilním bloku style.css:1110 smazat `.cook-opt-btn{padding:7px 14px;font-size:14px}` (přebíjel by `padding:0 14px`).

Styl aktivního čipu je stejný jako `.cal-fchip.sel` (style.css:855), jen s `--on-accent` → konzistentní s kalendářem a čitelný ve všech tématech.

### JS – app.js:8428–8438 (doplnit `aria-pressed` + fade)
```js
window.setCookType=(t,btn)=>{
  cookType=t;
  document.querySelectorAll('[data-t]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  btn.classList.add('active');btn.setAttribute('aria-pressed','true');
};
window.setCookMealType=(t,btn)=>{
  cookMealType=t;
  document.querySelectorAll('[data-m]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  btn.classList.add('active');btn.setAttribute('aria-pressed','true');
  renderSavedRecipes();
};
// Fade vpravo jen pokud je ještě co scrollovat
function cookChipFade(el){el.classList.toggle('is-end',el.scrollLeft+el.clientWidth>=el.scrollWidth-4);}
document.querySelectorAll('.cook-chip-scroll').forEach(el=>{
  el.addEventListener('scroll',()=>cookChipFade(el),{passive:true});
  cookChipFade(el);
});
window.addEventListener('resize',()=>document.querySelectorAll('.cook-chip-scroll').forEach(cookChipFade));
```
Pozor: `cookChipFade` při skryté stránce (`display:none`) dostane `scrollWidth=0` → nastaví `is-end` a fade zmizí. Proto zavolat `document.querySelectorAll('.cook-chip-scroll').forEach(cookChipFade)` i při zobrazení stránky Vaření (v `sp('cooking')` / tam, kde se volá `renderSavedRecipes()` při vstupu) a v `switchCookTab('recipes')` (app.js:~8810). Bez JS funguje fade i tak (padding-right 28 px dovolí poslední čip vyscrollovat mimo fade), JS jen fade schová na konci.

Další pozor:
- `padding:3px` + `margin:0 -3px` v `.cook-chip-scroll` je kvůli focus-visible outline (style.css:534), jinak ho ořízne `overflow-x:auto`.
- `[data-t]`/`[data-m]` se nikde jinde v DOM nepoužívají (ověřit grepem po úpravě, `data-p` u porcí je jiný selektor).
- Na desktopu se čipy vejdou, `is-end` fade schová.

---

## 3. Drobná vylepšení zbytku obrazovky (max. 3)

### 3a) Karta uloženého receptu: velký koš, žádné „?“ v metadatech
app.js:8790–8803 (`renderSavedRecipes`). Problém: 🗑️ má `padding:4px` (cíl ~26 px, snadno se trefí omylem/netrefí), tlačítko „📖 Otevřít recept“ dělá totéž co ťuknutí na kartu a přidává výšku, meta ukazuje „⏱ ? · 🍽 ?“.

```js
list.innerHTML=filtered.map(r=>{
  const meta=[r.time?`⏱ ${esc(r.time)}`:'',(r.mealType||r.difficulty)?`🍽 ${esc(r.mealType||r.difficulty)}`:'',
    `${Number(r.portions)||2} porcí`].filter(Boolean).join(' · ');
  return `<div class="saved-recipe-card" role="button" tabindex="0" data-a0="${esc(r.id)}" onclick="openSavedRecipe(this.dataset.a0)" onkeydown="if(event.key==='Enter')openSavedRecipe(this.dataset.a0)">
    <div class="saved-recipe-top">
      <div class="saved-recipe-ico" aria-hidden="true">🍽️</div>
      <div style="flex:1;min-width:0">
        <div class="saved-recipe-name">${esc(r.name)}</div>
        <div class="saved-recipe-meta">${meta}</div>
      </div>
      <button class="saved-recipe-del" data-a0="${esc(r.id)}" onclick="deleteSavedRecipe(this.dataset.a0,event)" aria-label="Smazat recept" title="Smazat">🗑️</button>
    </div>
  </div>`;}).join('');
```
CSS (přidat za style.css:1153; duplicitní starší `.saved-recipe-*` na 1089–1092 smazat, platí pozdější 1148–1153):
```css
.saved-recipe-ico{font-size:24px;flex-shrink:0}
.saved-recipe-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.saved-recipe-del{width:44px;height:44px;margin:-8px -8px -8px 0;flex-shrink:0;background:none;border:none;border-radius:10px;font-size:18px;color:var(--text3);cursor:pointer}
.saved-recipe-del:active{background:var(--card2)}
```
Datum „Uloženo …“ vypustit (na 360 px zalamuje meta na 2 řádky a není podstatné). `deleteSavedRecipe` už bere `event` → `stopPropagation` ověřit, že tam je. Pokud se tlačítko „Otevřít“ nechá, `.saved-recipe-actions` zůstane beze změny.

### 3b) Prázdný stav filtru: rovnou nabídnout „Zobrazit vše“
app.js:8785–8788. Když filtr „Typ jídla“ nic nenajde, uživatel neví, že to způsobil filtr nahoře.
```js
if(!filtered.length){
  list.innerHTML=savedRecipes.length
    ? `<div class="cook-empty">Pro „${esc(cookMealType)}“ zatím nemáš uložený recept.
         <button class="cook-empty-btn" onclick="setCookMealType('any',document.querySelector('[data-m=&quot;any&quot;]'))">Zobrazit všechny</button></div>`
    : `<div class="cook-empty">Zatím tu nic není. Nech si navrhnout recept a ťukni na 🔖 Uložit.</div>`;
  return;
}
```
```css
.cook-empty{font-size:15px;color:var(--text2);font-style:italic;padding:8px 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cook-empty-btn{min-height:44px;padding:0 14px;background:none;border:1px solid var(--border2);border-radius:22px;font-family:'Crimson Pro',serif;font-size:14px;font-style:normal;color:var(--accent);cursor:pointer}
```
(`cookMealType` je vždy jedna z konstant, `esc()` je tu jen pojistka.) Pozor na `--text2` místo `--text3`: v tmavém tématu je `--text3` #52526a na #0c0c10 pod 3:1.

### 3c) Akce pod receptem: 1 hlavní + mřížka 2×2 místo 5 plných řádků
index.html:584–590 a style.css:1111–1112. Na mobilu je teď 5 tlačítek pod sebou přes celou šířku (~280 px výšky). Návrh: hlavní „🛒 Přidat chybějící do nákupu“ přes celou šířku, zbylé 4 ve 2 sloupcích.
```css
@media(max-width:640px){
  .cook-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .cook-actions button{width:100%!important;min-height:44px;padding:10px 8px!important;font-size:14px!important}
  .cook-actions .btn-p{grid-column:1/-1;font-size:16px!important}
}
```
(Nahrazuje řádky 1111–1112. Popisky upravit, aby se vešly do ~150 px: „🔖 Uložit“, „📅 Do jídelníčku“, „📋 Nákupy“, „🔄 Jiný návrh“.)

---

## Kontrolní seznam pro kodera
- [ ] Ověřit čísla řádků (v repu jsou cizí necommitnuté změny).
- [ ] Témata: dark-gold, sunshine, tangerine – aktivní čip a „Navrhnout“ přes `--on-accent`.
- [ ] 360 px: žádný vodorovný scroll stránky, fade vpravo u obou řádků, poslední čip jde vyscrollovat celý.
- [ ] Všechny dotykové cíle ≥ 44 px (čipy, tlačítka, koš, „Zobrazit všechny“).
- [ ] Uživatelský text jen přes `esc()`, handlery přes `data-aN`.
- [ ] `APP_VERSION` + `CHANGELOG` („Vaření: přehlednější vyhledávání receptů a filtry“) + bump `CACHE` v sw.js.
