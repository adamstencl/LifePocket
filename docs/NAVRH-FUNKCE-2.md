# Návrh funkcí 2: Nákupy, Návyky, Sdílení týdne

Autor: ux-designer · 2026-10-08 · stav: NÁVRH (nic není implementováno)

Čísla řádků jsou ověřená v pracovním stromu 2026-10-08 včetně necommitnutých změn jiného agenta v `app.js` (index záznamů návyků `hLog`/`hDoneHD`, okno `HL_WINDOW=400`). Ten soubor se právě mění, proto se čísla mohou posunout o desítky řádků. U každého místa je uvedená i funkce, podle které ho lze najít.

Společné zásady pro kodera: uživatelský text vždy přes `esc()`, parametry handlerů přes `data-aN` a `this.dataset.aN`, nové handlery na `window`, datum přes `toDS()`, přepínače `.seg` a `.seg-btn` se `syncSeg()`, aktivní prvky s barvou `var(--accent)` a textem `var(--on-accent)`, dotykové cíle min. 44×44 px, barvy jen přes proměnné, aby fungovala všechna 4 témata (`:root`/dark-gold, sunshine, tangerine).

---

## 1a. Nákupy: „Rychle přidat“ (často nakupované)

### Co dnes existuje (zjištění)

| Co | Kde | Stav |
|---|---|---|
| `lp_fav_shop`, oblíbené ⭐ | app.js:8359–8395 (`getFavShopItems`, `toggleFavShopItem`, `addFavToShop`, `renderFavShop`), index.html:682–685 | Jen localStorage: nepřenáší se mezi zařízeními ani do rodiny a při přihlášení jiného účtu se maže (app.js:631, 637). Hvězdička v každém řádku má plochu asi 22 px. |
| Pravidelný nákup 🔄 | app.js:8400–8533 (`subRecurringShop`, `checkRecurringShop`, `openAddRecurringModal`), `users/{uid}/recurringShop` | Funguje. Řeší automatické přidávání podle kalendáře, ne „co kupuju často“. Nechat beze změny. |
| `quickAddShopItem` | app.js:8535–8547 | **Mrtvá funkce.** Grep v app.js i index.html nenašel žádné volání a je to kopie `addFavToShop`. Smazat. |
| Historie nákupů | – | Neexistuje. `clearDoneItems` (app.js:8719) koupené položky natrvalo maže. |

### Jak počítat frekvenci

- **Signál = odškrtnutí položky jako koupené** (`toggleShopItem`, app.js:8549, přechod `wasDone=false` na `true`). Samotné přidání je slabší signál (napíšu, nekoupím) a smazání bez odškrtnutí znamená „nekupuju“, proto se nepočítá. Vrácení odškrtnutí (`true` na `false`) odečte 1.
- **Skóre** = `k × 0,5^(dní od posledního nákupu / 45)`, tedy poločas 45 dní. Co jsem kupoval loni, postupně vypadne.
- Zobrazit položky s `k ≥ 2` nebo připnuté, které **nejsou** v aktivním seznamu jako nekoupené. Nejvýš 10 čipů.
- Klíč = normalizovaný název: malá písmena, bez diakritiky, ostatní znaky nahradí `_`, max. 40 znaků. „Mléko“ a „mleko“ se tak sloučí. Zobrazuje se naposledy napsaný tvar.

### Datový model

```
users/{uid}/shopStats/freq            (osobní seznam + moje připnuté)
families/{fid}/shopStats/freq         (sdílený seznam, společná frekvence)
{
  items: {
    "mleko": { n:"Mléko", c:"Mléčné výrobky", q:"2 l", k:14, last:"2026-10-06", pin:true }
  },
  v: 1
}
```
- `q` = poslední množství. Čip pak přidá i „2 l“.
- `pin` (připnutí) žije jen v osobním dokumentu. V rodinném režimu se zobrazí moje připnuté a pod nimi frekvence rodiny.
- Zápis: `setDoc(ref,{items:{[key]:{n,c,q,last,k:increment(1)}}},{merge:true})`. Je atomický, takže současné odškrtnutí od dvou členů nic nepřepíše. **Pozor:** `increment` dnes není v importu na app.js:3, je potřeba ho doplnit.
- Strop 300 klíčů (asi 25 kB). Při překročení klient smaže 50 nejslabších přes `deleteField()`.
- Jednorázová migrace: při prvním načtení se `lp_fav_shop` zapíše jako `pin:true` a klíč `lp_fav_shop` se odstraní ze `LOCAL_PERSONAL_KEYS` až v další verzi. Současně odškrtnuté položky v seznamu se započtou jako `k:1`.

**Firestore rules: beze změny.** `users/{uid}/**` pokrývá osobní dokument a `families/{id}/{sub}/{doc}` (firestore.rules:60–64) pokrývá rodinný. Při ručním mazání uživatele je potřeba mazat i podkolekci `shopStats`.

### UI

Sekce **„⚡ Rychle přidat“** nahradí blok `#fav-shop-wrap` (index.html:682–685) mezi řádkem pro přidání a seznamem. Má jeden vodorovně posuvný řádek, aby nezabíral výšku na telefonu.

Před (dnes):
```
⭐ Oblíbené:
[Mléko] [Chleba]            ← 24 px vysoké čipy, jen z tohoto zařízení
```
Po:
```
⚡ Rychle přidat                                  
[⭐ Mléko · 2 l] [⭐ Chleba] [Banány] [Máslo] [Vejce · 10 ks] →
```
- Klepnutí přidá položku (s `q` a `c`), čip zmizí a objeví se toast „✓ Mléko přidáno“. Duplicitu hlídá stejná podmínka jako `addFavToShop`.
- Připnutí a odepnutí jde z editačního listu položky (viz 1b), ne z drobné hvězdičky v řádku.
- Prázdná sekce (bez historie) se skryje. Žádné vysvětlování.

```html
<!-- index.html: místo #fav-shop-wrap -->
<div id="quick-shop-wrap" class="quick-shop" hidden>
  <div class="quick-shop-lbl">⚡ Rychle přidat</div>
  <div id="quick-shop-chips" class="quick-shop-row" role="list"></div>
</div>
```
```css
.quick-shop{margin-bottom:12px}
.quick-shop[hidden]{display:none}
.quick-shop-lbl{font-size:12px;color:var(--text3);margin:0 2px 6px}
.quick-shop-row{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.quick-shop-row::-webkit-scrollbar{display:none}
.quick-chip{flex:none;scroll-snap-align:start;min-height:44px;padding:0 14px;border-radius:22px;background:var(--card2);border:1px solid var(--border);color:var(--text);font-family:'Crimson Pro',serif;font-size:15px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}
.quick-chip small{color:var(--text3);font-size:13px;margin-left:4px}
.quick-chip:active{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.quick-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
```
```js
// ── RYCHLE PŘIDAT ──  (místo app.js:8359–8395 a mrtvé quickAddShopItem 8535–8547)
let shopFreqMine = {}, shopFreqFam = {};
function shopKey(name){
  return String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);
}
function shopFreqRef(shared){
  return shared ? doc(db,'families',familyId,'shopStats','freq') : doc(db,'users',CU.uid,'shopStats','freq');
}
// volat z toggleShopItem: delta +1 při odškrtnutí, -1 při vrácení
async function bumpShopFreq(item, delta){
  const key = shopKey(item?.name); if(!key) return;
  const shared = isShopShared();
  const data = {n:cutName(item.name,40), c:item.category||'Ostatní', k:increment(delta)};
  if(delta>0){ data.last = toDS(); data.q = String(item.qty||'').slice(0,15); }
  try{ await setDoc(shopFreqRef(shared), {items:{[key]:data}}, {merge:true}); }
  catch(e){ console.warn('bumpShopFreq', e); }
}
function quickShopList(){
  const shared = isShopShared();
  const active = (shared?familyShopItems:shopItems).filter(i=>!i.done).map(i=>shopKey(i.name));
  const src = shared ? shopFreqFam : shopFreqMine;
  const now = Date.now();
  const score = e => (Number(e.k)||0) * Math.pow(.5, (now-new Date((e.last||'2000-01-01')+'T12:00:00'))/864e5/45);
  const pins = Object.entries(shopFreqMine).filter(([,e])=>e&&e.pin);
  const freq = Object.entries(src).filter(([,e])=>e&&!e.pin&&(Number(e.k)||0)>=2)
    .sort((a,b)=>score(b[1])-score(a[1]));
  const seen = new Set(active);
  return [...pins,...freq].filter(([k])=>!seen.has(k)&&seen.add(k)).slice(0,10);
}
function renderQuickShop(){
  const wrap=document.getElementById('quick-shop-wrap'), row=document.getElementById('quick-shop-chips');
  if(!wrap||!row) return;
  const list = quickShopList();
  wrap.hidden = !list.length;
  row.innerHTML = list.map(([k,e])=>`<button class="quick-chip" role="listitem" data-a0="${esc(k)}"
    onclick="quickAddShop(this.dataset.a0)">${e.pin?'⭐ ':''}${esc(e.n)}${e.q?`<small>· ${esc(e.q)}</small>`:''}</button>`).join('');
}
window.quickAddShop = async key => {
  const e = shopFreqMine[key] || shopFreqFam[key]; if(!e) return;
  await addShopEntry({name:e.n, category:e.c||guessShopCategory(e.n), qty:e.q||''}); // společná funkce, viz 1b
  toast(`✓ ${e.n} přidáno`);
};
```
- Odběr: `createFireSub('shopFreq', shopFreqRef(false), …)` vedle `subRecurringShop`. Rodinný odběr se zakládá a ruší spolu s `unsubFamilyShop` (app.js:5389). `renderQuickShop()` volat na konci `renderShop()` (app.js:8223) místo `renderFavShop()`.
- V řádku položky (app.js:8218) odstranit tlačítko `.shop-item-fav`.

### Rizika
- Zápis navíc při každém odškrtnutí: jeden `setDoc` (zanedbatelné).
- Ve sdíleném seznamu odškrtává obvykle ten, kdo nakupuje, takže frekvence je rodinná. To je správně.
- Normalizace sloučí „Rohlík“ a „Rohlíky“ jen tehdy, když se liší jen diakritikou. Ohýbání neřešíme (backlog).

---

## 1b. Nákupy: množství u položky

### Zjištění
- `qty` je volný řetězec (`addShopItem` app.js:8335–8357, recepty app.js:6023 a 8112 píšou „200 g“). Zpracovává ho `parseIngQty` (app.js:9398) pro zásoby. **Formát řetězce ponecháme** kvůli zpětné kompatibilitě, AI kontextu (app.js:7834), sdílení textem (`shareShoppingList`, app.js:8653) a zásobám.
- Dnes má řádek pro přidání samostatné pole „Qty“ šířky 60 px (index.html:669), které na telefonu tlačí výběr kategorie. Úprava množství nahradí `<span>` inputem šířky 70 px (`editShopQty` app.js:8600). Text „+qty“ je anglicky a cíl je malý.
- Řádek položky má 6 dotykových prvků (✓ 22 px, množství, ✏️ kategorie, ⭐, ×). Na telefonu jsou to malé terče hned vedle sebe.

### Návrh

**A) Parser při psaní.** Jedno pole „Přidat položku…“ pochopí:

| Napíšu | Název | Množství |
|---|---|---|
| `2× mléko`, `2x mléko`, `mléko 2x`, `mléko x2` | Mléko | 2 ks |
| `3 rohlíky` | Rohlíky | 3 ks |
| `1,5 l mléko`, `mléko 1,5 l` | Mléko | 1,5 l |
| `500 g sýr`, `sýr 50 dkg` | Sýr | 500 g / 50 dkg |
| `vitamín B12`, `7up` | beze změny | – |

Pod polem se při psaní ukáže náhled toho, co se uloží: `➕ Mléko · 2 ks` (místo dnešního `#shop-pantry-hint` se zobrazí oba řádky). Uživatel tak hned vidí, jak appka text pochopila. **Pole „Qty“ z řádku zmizí.**

**B) Zobrazení v řádku**, před a po:
```
Před:  [□] Mléko                 2 l  ✏️  ☆  ×
Po:    [□] Mléko              [ 2 l ]      ×
       [□] Chleba         [+ množství]      ×
```
- Štítek množství je tlačítko vysoké 44 px. Klepnutí otevře **spodní list „Upravit položku“**, ne input v řádku.
- ✏️ kategorie a ⭐ připnutí se přesunou do tohoto listu. V řádku zůstanou jen ✓, název, množství a ×, všechno s plochou 44 px.

**C) Spodní list (krokovač):**
```
┌──────────────────────────────┐
│ Mléko                        │
│   [ − ]     2 l      [ + ]   │   tlačítka 56×56
│ ( ks | kg | g | l | ml )     │   .seg.seg--block
│ Kategorie  [Mléčné výrobky ▾]│
│ ⭐ Připnout do Rychle přidat [⏻]│   .togrow + .togswitch
│ [ Hotovo ]                   │   .btn-p
└──────────────────────────────┘
```
Kroky podle jednotky: ks 1, kg 0,5, g 100, l 0,5, ml 100. Mínus pod nejmenší krok smaže množství. Ukládá se při „Hotovo“ jedním `updateDoc({qty, category})`, ne při každém klepnutí (sdílený seznam by jinak blikal ostatním).

```js
const SHOP_UNIT_RE = '(×|x|ks|kus[yů]?|kg|dkg|g|ml|l|bal(?:ení)?)';
function shopNum(s){ return Math.round(parseFloat(String(s).replace(',','.'))*1000)/1000; }
function shopUnit(u){ u=String(u||'').toLowerCase(); return (u==='×'||u==='x'||u.startsWith('kus'))?'ks':u.startsWith('bal')?'bal':u; }
function fmtQty(n,unit){ return n ? String(n).replace('.',',')+' '+(unit||'ks') : ''; }
function parseShopInput(raw){
  const s = String(raw||'').trim().replace(/\s+/g,' ');
  let m;
  if((m = s.match(new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*'+SHOP_UNIT_RE+'\\.?\\s+(.+)$','i'))))
    return {name:m[3], qty:fmtQty(shopNum(m[1]),shopUnit(m[2]))};
  if((m = s.match(/^(\d{1,2})\s+(\p{L}.*)$/u)))                       // „3 rohlíky“
    return {name:m[2], qty:fmtQty(shopNum(m[1]),'ks')};
  if((m = s.match(new RegExp('^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*'+SHOP_UNIT_RE+'\\.?$','i'))))
    return {name:m[1], qty:fmtQty(shopNum(m[2]),shopUnit(m[3]))};
  if((m = s.match(/^(.+?)\s+[x×](\d{1,3})$/i)))                       // „mléko x2“
    return {name:m[1], qty:fmtQty(shopNum(m[2]),'ks')};
  return {name:s, qty:''};
}
// název s velkým písmenem jen pokud ho uživatel psal celý malými
const capFirst = s => s && s===s.toLowerCase() ? s[0].toUpperCase()+s.slice(1) : s;
```
- `addShopItem` (app.js:8335): `const {name,qty} = parseShopInput(inp.value)`. Pole `shop-qty-inp` odstranit. Zápis sjednotit do `addShopEntry({name,category,qty})`, který používají `addShopItem`, `quickAddShop`, `addFromRecurring` (app.js:8459) i `addShopItemToFamily` (app.js:5583, dnes `qty` nezapisuje).
- `onShopInpKey` (app.js:8267) doplní náhled `➕ ${esc(name)} · ${esc(qty)}`.
- Krokovač pracuje s `parseIngQty(qty)` (app.js:9398), kterému je potřeba rozšířit regex o `dkg|bal`.

```css
.shop-check{position:relative}
.shop-check::after{content:'';position:absolute;inset:-11px}          /* 22 px vizuál, 44 px dotyk */
.shop-qty-btn{min-height:44px;min-width:44px;padding:0 12px;border-radius:22px;border:1px solid var(--border);background:var(--card2);color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0}
.shop-qty-btn.empty{color:var(--text3);border-style:dashed;font-weight:400}
.shop-item-del{min-width:44px;min-height:44px}
.moverlay.sheet{align-items:flex-end;padding:0}
.moverlay.sheet .modal{width:100%;max-width:520px;border-radius:20px 20px 0 0;padding-bottom:calc(22px + env(safe-area-inset-bottom))}
.qty-stepper{display:flex;align-items:center;justify-content:center;gap:20px;margin:8px 0 16px}
.qty-step{width:56px;height:56px;border-radius:50%;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-size:26px;cursor:pointer}
.qty-step:active{background:var(--accent);color:var(--on-accent)}
.qty-val{min-width:110px;text-align:center;font-family:'Playfair Display',serif;font-size:30px;font-weight:700;color:var(--text)}
```
Řádek (app.js:8212–8221, nahradit části s qty, ✏️ a ⭐):
```js
`<button class="shop-qty-btn ${i.qty?'':'empty'}" data-a0="${esc(i.id)}" onclick="openShopItemSheet(this.dataset.a0)"
   aria-label="Množství: ${esc(i.qty||'nezadáno')}">${i.qty?esc(i.qty):'+ množství'}</button>
 <button class="shop-item-del" data-a0="${esc(i.id)}" onclick="delShopItem(this.dataset.a0)" aria-label="Smazat">×</button>`
```
Text nápovědy „✏️ Klikni na množství pro úpravu“ (app.js:8205) zrušit. Štítek je sám dost zřetelný.

### Rizika
- Parser chybuje u názvů s číslem („Pivo 10“ se uloží jako „Pivo“, 10 ks). Zmírňuje to náhled pod polem a možnost množství opravit v listu.
- Odebrání ⭐ a ✏️ z řádku je změna zvyku. Toast při prvním otevření listu není potřeba, list je samovysvětlující.

---

## 2a. Návyky: zamrazení série (nemoc, dovolená)

### Zjištění (bug)
- `pausedUntil` (nastavuje `pauseHabit`, app.js:1897–1913) obsahuje **jen datum konce**, bez začátku. Používají ho jen `isHabitDueToday` (klient app.js:3618, server functions/index.js:474) a odznak na kartě (app.js:1129, 1263).
- **Výpočty série pauzu ignorují**, takže CHANGELOG (app.js:186) i text v detailu (app.js:1574) „Streak se nezlomí“ **neplatí**. Den pauzy bez záznamu sérii přeruší.
- Série se počítá na **7 místech**, a to pokaždé jinak:

| Místo | Přeskočené (`skipped`) | Konkrétní dny (`freq.days`) | Dnešek nesplněný |
|---|---|---|---|
| `buildHabitCard` app.js:1131 | ano | ne | od `habitDay`, nesplněný přeruší |
| `renderHabitDetail` aktuální, app.js:1394 | ne | ne | přeruší (série je přes den 0) |
| `renderHabitDetail` nejlepší, app.js:1404 | ne | ne | – |
| `getStreak` app.js:4603 (milníky Rexe) | ne | ne | – |
| widget návyků na dashboardu app.js:6810 | ne | ne | přeruší |
| widget „Aktivní streaky“ app.js:6991 | ne | ne | přeruší |
| AI kontext app.js:7778 | ano | ano | nepřeruší ✓ |

Navrhuji **jednu sdílenou funkci**. Opraví to i nesoulad mezi kartou, detailem a dashboardem.

### Datový model
```
habits/{id}:
  pausedUntil: "2026-10-12" | null          // ponechat, synchronní s aktivní pauzou (server ho čte)
  pauses: [ { from:"2026-10-05", to:"2026-10-12", reason:"sick"|"vacation"|"other" } ]   // max 12 posledních
habitLogs/{hid_date}:
  { done:false, failed:false, skipped:true, frozen:true, value:0 }   // zamrazený den
```
- **Pauza** = plánovaný rozsah, začátek „dnes“ nebo „včera“, délka 3, 7, 14 nebo 30 dní. Bez měsíčního limitu, protože je záměrná a viditelná.
- **Zamrazení dne** 🧊 = zpětná záchrana jednoho zmeškaného dne (max. 3 dny zpět). **Limit 2 za kalendářní měsíc na návyk** (`FREEZE_PER_MONTH = 2`). Ukládá se jako log se `skipped:true` a `frozen:true`, takže ho stávající logika „přeskočeno“ (karta, AI kontext) automaticky chápe jako neutrální den.
- Legacy: návyk s `pausedUntil >= dnes` a bez `pauses` se při načtení převede na `pauses:[{from:dnes, to:pausedUntil, reason:'other'}]`. Starší dny pauzy nelze zpětně zjistit, to je přijatelná ztráta.
- **Firestore rules: beze změny** (`users/{uid}/**`). Limit hlídá jen klient. Obejít ho může jen uživatel sám ve svých datech.

### Výpočet (jedna funkce pro všech 7 míst)
```js
// Stav dne návyku: 'done' | 'miss' | 'neutral' (přeskočeno, zamraženo, pauza, není na řadě) | 'future'
const FREEZE_PER_MONTH = 2;
// Index záznamů: používá existující hLog() (app.js:1054), žádná vlastní mapa
function isHabitPausedOn(h, ds){
  if((Array.isArray(h.pauses)?h.pauses:[]).some(p=>p&&p.from<=ds&&ds<=p.to)) return true;
  return !!(h.pausedUntil && ds===toDS() && h.pausedUntil>=ds);   // legacy záloha pro dnešek
}
function habitDayState(h, ds, today=toDS()){
  if(ds>today) return 'future';
  const l = hLog(h.id+'_'+ds);
  if(l&&l.done) return 'done';
  if(l&&l.skipped) return 'neutral';                       // včetně frozen
  if(isHabitPausedOn(h,ds)) return 'neutral';
  const f=(h.freq&&typeof h.freq==='object')?h.freq:{type:'daily'};
  if(f.type==='days' && !(Array.isArray(f.days)?f.days:[]).includes(new Date(ds+'T12:00:00').getDay())) return 'neutral';
  if(h.createdAt && ds < String(h.createdAt).slice(0,10)) return 'neutral';
  return 'miss';
}
// Aktuální série ve dnech; nesplněný dnešek ji nepřeruší
function calcHabitStreak(h, endDS=toDS()){
  const today=toDS(); let n=0; const d=new Date(endDS+'T12:00:00');
  if(endDS===today && habitDayState(h,endDS)!=='done') d.setDate(d.getDate()-1);
  for(let i=0;i<HL_WINDOW;i++){
    const st=habitDayState(h,toDS(d),today);
    if(st==='done') n++; else if(st==='miss') break;
    d.setDate(d.getDate()-1);
  }
  return n;
}
function calcBestStreak(h){
  const dates=habitLogs.filter(l=>l&&l.habitId===h.id&&l.done).map(l=>l.date).sort();
  if(!dates.length) return 0;
  let best=0,cur=0; const d=new Date(dates[0]+'T12:00:00'), today=toDS();
  for(let i=0;i<1500 && toDS(d)<=today;i++){
    const st=habitDayState(h,toDS(d),today);
    if(st==='done'){cur++; if(cur>best)best=cur;} else if(st==='miss') cur=0;
    d.setDate(d.getDate()+1);
  }
  return best;
}
function freezesLeft(h, month=toDS().slice(0,7)){
  return Math.max(0, FREEZE_PER_MONTH - habitLogs.filter(l=>l&&l.habitId===h.id&&l.frozen&&String(l.date).startsWith(month)).length);
}
window.freezeHabitDay = async (hid, ds) => {
  const h=habits.find(x=>x.id===hid); if(!h||!CU) return;
  if(!freezesLeft(h, ds.slice(0,7))){ toast('Tento měsíc už jsi zamrazil 2 dny'); return; }
  if(habitDayState(h,ds)!=='miss') return;
  const log={id:hid+'_'+ds,habitId:hid,date:ds,done:false,failed:false,skipped:true,frozen:true,value:0};
  await setDoc(doc(db,'users',CU.uid,'habitLogs',log.id),log);
  const ex=habitLogs.find(l=>l.id===log.id); if(ex)Object.assign(ex,log); else habitLogs.push(log);
  toast(`🧊 Den zamrazen, série drží (${calcHabitStreak(h)} dní)`);
  renderHabits(); if(detailHabitId===hid) renderHabitDetail(h);
};
```
Pozor: `skipHabitDay` (app.js:1727) při zrušení přeskočení log maže. U zamraženého dne musí tlačítko ⏭ na kartě zobrazit 🧊 a zrušení vrátí slot zamrazení.

Nahradit:
- app.js:1130–1141 (karta), 1393–1416 (detail), 4603–4613 (`getStreak` = `calcHabitStreak(habits.find(...))`), 6810–6811, 6991–7002 a 7778–7786 (AI kontext) za volání `calcHabitStreak` / `calcBestStreak`.
- `calcPct` (app.js:1427), týdenní graf (app.js:1444) a `renderHabitMonth` (app.js:2097): **neutrální dny se nepočítají do jmenovatele** (`habitDayState(...)==='neutral'` je stejné jako `active=false`). Stejně i „% tento měsíc“ (app.js:1418).
- Měsíční kalendář v detailu (app.js:1496) a 7denní tabulka na kartě (app.js:1199): nové třídy `.frozen` (🧊) a `.paused` (⏸).
- `pauseHabit` (app.js:1897): zapisuje `pauses` (`arrayUnion` je již importováno, ale kvůli zkrácení na 12 a ukončení pauzy je lepší zapisovat celé pole) a zároveň `pausedUntil`. Ukončení pauzy nastaví `to` na včerejšek (nebo rozsah smaže, pokud `from` je dnes) a `pausedUntil` na `null`.

### Notifikace a server
- Klient `isHabitDueToday` (app.js:3620): `if (isHabitPausedOn(h, today)) return false;`.
- **Server (jen popis, neměnit teď):** functions/index.js:476 má stejnou kontrolu přes `pausedUntil`. Protože klient drží `pausedUntil` synchronně s aktivní pauzou (budoucí začátek neumožňujeme), **server funguje beze změny**. Pro robustnost později doplnit stejnou kontrolu rozsahů `pauses` (`habit.pauses.some(p => p.from <= today && today <= p.to)`). Zamrazení se týká jen minulých dnů, na notifikace vliv nemá. Večerní souhrn (functions/index.js:~584) počítá jen návyky na řadě, pozastavené tedy nezapočte.
- Rex: `checkAvatarReactions` dostane správnou sérii přes `getStreak`, čímž zmizí falešné milníky po pauze.

### UI v detailu návyku
Nahradí sekci „⏸ Pauza návyku“ (app.js:1572–1587).

Před:
```
⏸ Pauza návyku
Pozastav návyk na dobu nemoci nebo dovolené. Streak se nezlomí.
[3 dny] [1 týden] [2 týdny] [Měsíc]
```
Po:
```
🧊 Pauza a záchrana série
┌───────────────────────────────────────────┐
│ Jsi nemocný nebo na dovolené? Pozastav    │
│ návyk, série se nezlomí.                  │
│ ( 🤒 Nemoc | 🏖️ Dovolená | ✨ Jiné )        │  .seg.seg--block
│ Od  ( Dnes | Včera )                      │  .seg.seg--block
│ [3 dny] [Týden] [2 týdny] [Měsíc]         │  .btn-s, 44 px, mřížka 2×2 na mobilu
├───────────────────────────────────────────┤
│ Zapomněl jsi den? Zamraž ho.               │
│ [🧊 Zamrazit út 6. 10.]                    │  jen zmeškané dny z posledních 3
│ Zbývá 2 ze 2 zamrazení tento měsíc         │
└───────────────────────────────────────────┘
Při aktivní pauze:
│ 🤒 Pauza do 12. října · série čeká na tebe │
│ [▶️ Ukončit pauzu]                         │
```
**Na kartě návyku** (app.js:1263) se objeví nabídka jen ve chvíli, kdy dává smysl: včera stav `miss`, série před ním aspoň 3 dny, `freezesLeft>0` a dnes je `habitDay`:
```html
<button class="habit-freeze-offer" data-a0="${esc(h.id)}" data-a1="${esc(yesterdayDS)}"
  onclick="freezeHabitDay(this.dataset.a0,this.dataset.a1)">🧊 Včera ti vypadl den. Zachránit ${prevStreak} dní?</button>
```
```css
.habit-freeze-offer{display:block;width:100%;min-height:44px;margin-top:8px;padding:8px 12px;border-radius:12px;border:1px dashed var(--blue);background:transparent;color:var(--blue);font-family:'Crimson Pro',serif;font-size:14px;cursor:pointer;text-align:left}
.hd-day-cell.frozen{background:transparent;box-shadow:inset 0 0 0 1px var(--blue);color:var(--blue)}
.hd-day-cell.paused{background:var(--card3);color:var(--text3)}
.hd-pause-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.hd-pause-grid .btn-s{min-height:44px;padding:0 6px}
@media(max-width:640px){.hd-pause-grid{grid-template-columns:repeat(2,1fr)}}
```
`--blue` existuje ve všech tématech, takže kontrast vychází i ve světlých (sunshine `#1565c0`).

### Statistiky
- „🔥 Aktuální série“ a „🏆 Nejlepší série“ přes nové funkce. Pod čísly malý řádek `🧊 1 zamrazený den · ⏸ 7 dní pauzy` (za 90 dní), aby statistika byla upřímná.
- Procenta 30, 60 a 90 dní a „Celkový výkon“ bez neutrálních dnů.

### Rizika
- Změna 7 výpočtů najednou: série se uživatelům může po nasazení změnit (typicky prodloužit, u `days` frekvencí výrazně). Do CHANGELOGu napsat „🔥 Série teď správně počítá pauzy a přeskočené dny“.
- `calcBestStreak` prochází až 1500 dní na návyk. S indexem `hLog` je to O(dny), tedy v řádu ms.
- `habitLogs` drží jen posledních `HL_WINDOW=400` dní (app.js:1035, listener app.js:1099, rozpracováno jiným agentem). Aktuální série a týdny stačí. `calcBestStreak` v detailu musí počkat na dotažení celé historie, kterou detail už dotahuje (`_hlOldHabits`, app.js:1037). Do té doby zobrazit „…“.

---

## 2b. Návyky: týdenní cíl ve statistikách

### Zjištění
- Frekvence `{type:'weekly', times}` existuje (app.js:672). Karta počítá `weeklyStatus` (app.js:1143–1155), ale **zobrazí ho jen při sérii 0** (app.js:1177). Jinak týdenní návyk ukazuje denní sérii, která u „3× týdně“ nedává smysl (vždy 0–2).
- Detail návyku nemá nic týdenního. Graf (app.js:1444) počítá týdny jako posledních 7 dní a jmenovatel bere jako 7, takže 3/3 vychází jako 43 %.

### Výpočet
```js
function weekStartDS(ds){ const d=new Date(ds+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return toDS(d); }
// Týden po–ne: cíl se krátí podle dnů pauzy, plně pozastavený týden je neutrální
function habitWeekStat(h, mondayDS, today=toDS()){
  const times=Number(h.freq?.times)||3; let done=0, active=0;
  const d=new Date(mondayDS+'T12:00:00');
  for(let i=0;i<7;i++){ const ds=toDS(d); const st=habitDayState(h,ds,today);
    if(st==='done'){done++;active++;} else if(st!=='neutral') active++;   // future se počítá jako aktivní
    d.setDate(d.getDate()+1); }
  if(!active) return {done,target:0,met:false,neutral:true};
  const target=Math.max(1,Math.ceil(times*active/7));
  return {done,target,met:done>=target,neutral:false};
}
function calcWeekStreak(h){
  const today=toDS(); let n=0; const d=new Date(weekStartDS(today)+'T12:00:00');
  const cur=habitWeekStat(h,toDS(d),today);
  if(cur.met) n++;                                   // probíhající nesplněný týden sérii nepřeruší
  for(let i=0;i<104;i++){ d.setDate(d.getDate()-7);
    const w=habitWeekStat(h,toDS(d),today);
    if(w.neutral) continue; if(!w.met) break; n++; }
  return n;
}
const tydnu = n => n===1?'týden':n>=2&&n<=4?'týdny':'týdnů';
```

### Karta návyku (app.js:1143–1179)
U `weekly` vždy dva údaje:
```
Před:  🔥 1 den        3× týdně
Po:    [2/3 tento týden]  🔥 4 týdny v řadě   3× týdně
       [✓ 3/3 tento týden] ← zelená, když je splněno
```
```css
.habit-week-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border-radius:12px;background:var(--card2);border:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2);margin-right:6px}
.habit-week-pill.met{background:var(--green);border-color:var(--green);color:#0c0c10}
[data-theme="sunshine"] .habit-week-pill.met,[data-theme="tangerine"] .habit-week-pill.met{color:#fff}
```
Tmavý text na zelené `#3dd68c` (výchozí téma) a bílý text na `#2e7d32` (světlá témata) vycházejí oba nad 4,5:1.

### Detail návyku: týdenní blok a heatmapa
U `weekly` nahradí první řádek `hd-stat-grid` (app.js:1522–1535):
```
[ 2/3 ]            [ 4 ]                 [ 9 ]
Tento týden        🔥 Týdenní série       🏆 Nejlepší týdenní
```
Pod mřížkou **heatmapa 16 týdnů** (pro všechny typy návyků; u `weekly` s řádkem splněných týdnů). Sloupec = týden, řádek = Po až Ne. Čte se jako GitHub. Je jen pro čtení, proto se na ni nevztahuje 44px pravidlo. Shrnutí pro čtečky je v `aria-label`.
```
     ▢▢■▢■■▢▢■■■▢■■■■
Po   ...
Ne   ...
     ✓ ✓ · ✓ ✓ ✓ ✗ ✓ …   ← jen weekly: splněný týden
```
```js
function habitHeatmapHtml(h, weeks=16){
  const today=toDS(); const start=new Date(weekStartDS(today)+'T12:00:00'); start.setDate(start.getDate()-7*(weeks-1));
  let cells='', marks='', met=0, total=0; const d=new Date(start);
  for(let w=0;w<weeks;w++){
    const mon=toDS(d);
    for(let i=0;i<7;i++){ const ds=toDS(d); const st=habitDayState(h,ds,today);
      cells+=`<i class="hm-c ${st}" title="${esc(ds)}"></i>`; d.setDate(d.getDate()+1); }
    if(h.freq?.type==='weekly'){ const s=habitWeekStat(h,mon,today);
      if(!s.neutral&&mon!==weekStartDS(today)){total++; if(s.met)met++;}
      marks+=`<span class="hm-m ${s.neutral?'':s.met?'met':'miss'}">${s.neutral?'·':s.met?'✓':''}</span>`; }
  }
  const lbl = h.freq?.type==='weekly' ? `Splněno ${met} z ${total} týdnů` : `Přehled posledních ${weeks} týdnů`;
  return `<div class="hd-section-title">🗓️ Posledních ${weeks} týdnů</div>
    <div class="hm" role="img" aria-label="${esc(lbl)}"><div class="hm-grid">${cells}</div>${marks?`<div class="hm-marks">${marks}</div>`:''}</div>`;
}
```
```css
.hm{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px}
.hm-grid{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);grid-auto-columns:1fr;gap:3px}
.hm-c{aspect-ratio:1;border-radius:3px;background:var(--card3);display:block}
.hm-c.done{background:var(--green)}
.hm-c.miss{background:var(--card3)}
.hm-c.neutral{background:transparent;box-shadow:inset 0 0 0 1px var(--border2)}
.hm-c.future{background:transparent}
.hm-marks{display:grid;grid-template-columns:repeat(16,1fr);gap:3px;margin-top:6px;text-align:center;font-size:11px;font-weight:700}
.hm-m.met{color:var(--green)}.hm-m.miss{color:var(--text3)}
```
Šířka na 360px telefonu: 16 sloupců + mezery se vejdou do ~300 px (buňka ~16 px). Graf „📈 Plnění po týdnech“ (app.js:1444) přepočítat na týdny po–ne a u `weekly` počítat `%=min(done,target)/target`.

### Rizika
- Uživatelé s `weekly` uvidí místo denní série týdenní. To je záměr, zapsat do CHANGELOGu.
- AI kontext (app.js:7790) už „týden c/x“ posílá. Doplnit „týdenní série N“.

---

## 3. Týdenní karta k sdílení (canvas 1080×1350)

### Zjištění
- `checkAutoWeeklyReport` (app.js:4093) každou neděli volá `generateWeeklyReportSilent` (app.js:4107) a AI text uloží do `lp_weekly_report` `{text,date,avatar,avatarName}`. Widget na dashboardu je na app.js:6967–6988. `getRexWeeklyReport` (app.js:4050) to dělá z chatu.
- **AI text na kartu nepatří**: vzniká ze zápisků a může obsahovat citlivé věci. Karta se proto **počítá čistě z čísel** a na AI nezávisí. Funguje i bez AI a bez sítě.
- Fonty se načítají z Google Fonts (index.html:36): Playfair Display a Crimson Pro. Čeština je v podmnožině `latin-ext`, kterou prohlížeč stáhne, až když ji potřebuje. Proto `document.fonts.load(font, ukázkovýText)`.
- Avatar je emoji (`AVS` app.js:378, Rex = ⚔️). Logo je `/icon-512.png` ze stejného originu, takže canvas zůstane netainted.
- Sdílení textem již existuje (app.js:5011, 8653). Soubor se zatím nesdílí nikde.

### Obsah karty (bez citlivých dat)
- Hlavička: logo, „LifePocket“, rozsah „2.–8. října“.
- Avatar (emoji v kruhu) + „Týden v kostce“ + **jméno jen volitelně** (výchozí vypnuto).
- Velké číslo: **% splněných návyků** (dny na řadě, bez neutrálních; `weekly` přes `min(done,target)/target`).
- 7 sloupců Po až Ne (% za den).
- Tři dlaždice: **🔥 nejlepší série** (dní), **nálada týdne** (nejčastější emoji z `entries[].mood`, jen z whitelistu app.js:9597, žádný text), **✅ počet splnění**.
- Hláška avatara podle % (pevné texty, ne AI). **Názvy návyků jen volitelně** (výchozí vypnuto): „Nejlíp ti šlo: 🏃 Běh“.
- Patička: `lifepocket.app`.
- Karta je **vždy v tmavém brandu** (`#0f0f12`) bez ohledu na téma, aby byla v sociálních sítích konzistentní.

```
┌──────────── 1080 × 1350 ────────────┐
│ [logo] LifePocket        2.–8. října │  y 80–160
│                                      │
│               ( ⚔️ )                 │  kruh r=110, střed y=330
│          Týden v kostce              │  y 510, Playfair italic 56
│               Adam                   │  y 560, volitelné
│               82 %                   │  y 740, Playfair 700 180, zlatá
│         splněných návyků             │  y 795
│   „Makáš jak stroj 💪“ — Rex          │  y 850, Crimson italic 38
│   ▇  ▅  █  ▃  ▇  █  ▆                │  sloupce y 880–1010
│   Po Út St Čt Pá So Ne               │  y 1050
│ [🔥 14 dní] [😄 nálada] [✅ 23×]       │  dlaždice y 1090–1230
│            lifepocket.app            │  y 1295
└──────────────────────────────────────┘
```

### Kde
- Widget týdenního reportu (app.js:6985): vedle „Zobrazit celý report →“ tlačítko **„📤 Sdílet týden“** (`.btn-s`, 44 px).
- Návyky: v hlavičce stránky ikona 📤 s `aria-label="Sdílet týden"`, viditelná v neděli a pondělí. Viz otázku 4.

### Modal
```
┌ 📤 Tvůj týden ───────────────┐
│ [náhled 4:5, šířka 100 %]      │
│ Ukázat moje jméno        [⏻]   │  .togrow (celý řádek je <label>, 44 px+)
│ Ukázat názvy návyků      [⏻]   │
│ [ 📤 Sdílet ]  [ ⬇️ Uložit ]    │  .btn-p / .btn-s
└──────────────────────────────┘
```
Text tlačítka „Sdílet“ je „Připravuju…“ (disabled), dokud není hotový PNG. **Karta se vyrenderuje hned při otevření modalu a po každé změně přepínače**, takže klik na „Sdílet“ volá `navigator.share` synchronně v gestu. Safari na iOS jinak gesto ztratí a vyhodí `NotAllowedError`.

```js
// ── TÝDENNÍ KARTA ──
const WC_W=1080, WC_H=1350, WC = {bg:'#0f0f12',card:'#1e1e26',gold:'#f5c842',gold2:'#e0954a',text:'#f0f0f5',text2:'#9090a8',green:'#3dd68c',line:'#32323f'};
const WC_MOODS=['😄','🙂','😐','😔','😤','😴'];
let _wcFile=null, _wcUrl=null;

async function ensureCardFonts(){
  if(!document.fonts?.load) return;
  const t='Týden v kostce ěščřžýáíéůúň 0123456789 %–„“';
  const all=Promise.all([
    document.fonts.load('italic 700 56px "Playfair Display"',t),
    document.fonts.load('700 180px "Playfair Display"',t),
    document.fonts.load('600 40px "Crimson Pro"',t),
    document.fonts.load('italic 400 38px "Crimson Pro"',t),
  ]).then(()=>document.fonts.ready);
  await Promise.race([all.catch(()=>{}), new Promise(r=>setTimeout(r,3000))]); // offline: záloha Georgia
}
function calcWeekSummary(){
  const today=toDS(), days=[];
  const act=habits.filter(h=>h&&!h.archived);
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(toDS(d)); }
  let due=0, done=0; const perDay=days.map(ds=>{
    let dd=0,dn=0; act.filter(h=>h.freq?.type!=='weekly').forEach(h=>{ const st=habitDayState(h,ds,today);
      if(st==='done'){dd++;dn++;} else if(st==='miss') dd++; });
    due+=dd; done+=dn; return dd?Math.round(dn/dd*100):null; });
  act.filter(h=>h.freq?.type==='weekly').forEach(h=>{ const s=habitWeekStat(h,weekStartDS(today),today);
    if(!s.neutral){ due+=s.target; done+=Math.min(s.done,s.target); } });
  const streaks=act.map(h=>({h,s:calcHabitStreak(h)})).sort((a,b)=>b.s-a.s);
  const moods=entries.filter(e=>days.includes(entryDS(e))&&WC_MOODS.includes(e.mood)).map(e=>e.mood);
  const mood=moods.sort((a,b)=>moods.filter(x=>x===b).length-moods.filter(x=>x===a).length)[0]||'';
  const completions=habitLogs.filter(l=>l&&l.done&&days.includes(l.date)&&act.some(h=>h.id===l.habitId)).length;
  return {days, perDay, pct: due?Math.round(done/due*100):0, best:streaks[0]||null,
          top:streaks.filter(x=>x.s>0).slice(0,2).map(x=>x.h), mood, completions, hasData: due>0};
}
function wcQuote(p){ return p>=90?'Tohle je forma! 🏆':p>=70?'Makáš jak stroj 💪':p>=40?'Dobrý základ, jedeme dál 🔥':'Každý týden je nový start 🌱'; }
function wcFit(ctx,text,font,size,maxW){ let s=size; do{ ctx.font=font.replace('{s}',s); }while(ctx.measureText(text).width>maxW && (s-=2)>16); return text; }
function wcRange(days){ const a=new Date(days[0]+'T12:00:00'), b=new Date(days[6]+'T12:00:00');
  const m=b.toLocaleDateString('cs-CZ',{month:'long'});
  return a.getMonth()===b.getMonth() ? `${a.getDate()}.–${b.getDate()}. ${m}` : `${a.getDate()}. ${a.getMonth()+1}. – ${b.getDate()}. ${b.getMonth()+1}.`; }
function wcRound(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : ctx.rect(x,y,w,h); }

async function drawWeekCard(canvas, opt){
  await ensureCardFonts();
  const S=calcWeekSummary(), av=AVS.find(a=>a.id===prof?.avatarId)||AVS[0];
  canvas.width=WC_W; canvas.height=WC_H; const c=canvas.getContext('2d');
  // pozadí + zlatý „orb“ jako v appce
  c.fillStyle=WC.bg; c.fillRect(0,0,WC_W,WC_H);
  const g=c.createRadialGradient(900,140,0,900,140,520); g.addColorStop(0,'rgba(245,200,66,.16)'); g.addColorStop(1,'rgba(245,200,66,0)');
  c.fillStyle=g; c.fillRect(0,0,WC_W,WC_H);
  // hlavička
  try{ const img=await new Promise((ok,ko)=>{const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src='/icon-512.png';});
       c.save(); wcRound(c,80,80,72,72,16); c.clip(); c.drawImage(img,80,80,72,72); c.restore(); }catch(e){}
  const lg=c.createLinearGradient(172,0,460,0); lg.addColorStop(0,WC.gold); lg.addColorStop(1,WC.gold2);
  c.fillStyle=lg; c.font='italic 700 44px "Playfair Display", Georgia, serif'; c.textBaseline='middle'; c.fillText('LifePocket',172,118);
  c.fillStyle=WC.text2; c.font='600 32px "Crimson Pro", Georgia, serif'; c.textAlign='right'; c.fillText(wcRange(S.days),1000,118);
  // avatar
  c.textAlign='center'; c.beginPath(); c.arc(540,330,110,0,Math.PI*2); c.fillStyle=WC.card; c.fill();
  c.lineWidth=4; c.strokeStyle=WC.gold; c.stroke();
  c.font='120px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.fillText(av.emoji||'⭐',540,338);
  // nadpis + jméno
  c.fillStyle=WC.text; c.font='italic 700 56px "Playfair Display", Georgia, serif'; c.fillText('Týden v kostce',540,510);
  const nick=cutName(prof?.prezdivka||prof?.nickname||'',24);
  if(opt.name && nick){ c.fillStyle=WC.text2; wcFit(c,nick,'600 {s}px "Crimson Pro", Georgia, serif',36,800); c.fillText(nick,540,562); }
  // hlavní číslo
  c.fillStyle=WC.gold; c.font='700 180px "Playfair Display", Georgia, serif'; c.fillText(S.hasData?`${S.pct} %`:'–',540,700);
  c.fillStyle=WC.text2; c.font='600 40px "Crimson Pro", Georgia, serif'; c.fillText('splněných návyků',540,795);
  c.fillStyle=WC.text; c.font='italic 400 38px "Crimson Pro", Georgia, serif';
  c.fillText(opt.habits && S.top.length ? 'Nejlíp ti šlo: '+S.top.map(h=>(h.emoji||'')+' '+cutName(h.name,18)).join(', ') : `„${wcQuote(S.pct)}“ — ${av.name}`,540,850);
  // 7 sloupců
  const DN=['Ne','Po','Út','St','Čt','Pá','So'];
  S.perDay.forEach((p,i)=>{ const x=160+i*120, h=p==null?6:Math.max(8,p/100*130);
    c.fillStyle=p==null?WC.line:p>=80?WC.green:p>=50?WC.gold:WC.gold2; wcRound(c,x-30,1010-h,60,h,10); c.fill();
    c.fillStyle=WC.text2; c.font='600 30px "Crimson Pro", Georgia, serif'; c.fillText(DN[new Date(S.days[i]+'T12:00:00').getDay()],x,1050); });
  // dlaždice
  const tiles=[['🔥',S.best?`${S.best.s} dní`:'0 dní','nejlepší série'],
               S.mood?[S.mood,'','nálada týdne']:null, ['✅',`${S.completions}×`,'splněno']].filter(Boolean);
  const tw=280, gap=40, x0=(WC_W-(tiles.length*tw+(tiles.length-1)*gap))/2;
  tiles.forEach(([em,val,lbl],i)=>{ const x=x0+i*(tw+gap);
    c.fillStyle=WC.card; wcRound(c,x,1090,tw,140,24); c.fill();
    c.font='44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.fillText(em,x+tw/2,1130);
    if(val){ c.fillStyle=WC.text; c.font='700 40px "Playfair Display", Georgia, serif'; c.fillText(val,x+tw/2,1180); }
    c.fillStyle=WC.text2; c.font='600 26px "Crimson Pro", Georgia, serif'; c.fillText(lbl,x+tw/2,val?1214:1190); });
  // patička
  c.fillStyle=WC.text2; c.font='600 34px "Crimson Pro", Georgia, serif'; c.fillText('lifepocket.app',540,1295);
  return new Promise(r=>canvas.toBlob(r,'image/png'));
}

window.openWeekCard = async () => {
  document.getElementById('wc-modal')?.remove();
  const m=document.createElement('div'); m.id='wc-modal'; m.className='moverlay open';
  m.innerHTML=`<div class="modal" style="max-width:420px">
    <div class="mtitle">📤 Tvůj týden</div>
    <img id="wc-prev" class="wc-prev" alt="Náhled karty tvého týdne">
    <label class="togrow wc-tog"><div class="toginf"><div class="tognm">Ukázat moje jméno</div></div>
      <span class="togswitch"><input type="checkbox" id="wc-name" onchange="renderWeekCard()"><span class="togsl"></span></span></label>
    <label class="togrow wc-tog"><div class="toginf"><div class="tognm">Ukázat názvy návyků</div></div>
      <span class="togswitch"><input type="checkbox" id="wc-habits" onchange="renderWeekCard()"><span class="togsl"></span></span></label>
    <div class="wc-actions">
      <button class="btn-p" id="wc-share" onclick="shareWeekCard()" disabled>Připravuju…</button>
      <button class="btn-s" onclick="downloadWeekCard()">⬇️ Uložit</button>
      <button class="lp-link" onclick="closeWeekCard()">Zavřít</button>
    </div></div>`;
  m.addEventListener('click',e=>{ if(e.target===m) closeWeekCard(); });
  document.body.appendChild(m);
  await renderWeekCard();
};
window.renderWeekCard = async () => {
  const btn=document.getElementById('wc-share'); if(btn){btn.disabled=true;btn.textContent='Připravuju…';}
  const blob=await drawWeekCard(document.createElement('canvas'),{
    name:!!document.getElementById('wc-name')?.checked, habits:!!document.getElementById('wc-habits')?.checked});
  if(!blob){ toast('❌ Obrázek se nepodařilo vytvořit'); return; }
  _wcFile=new File([blob],`lifepocket-tyden-${toDS()}.png`,{type:'image/png'});
  if(_wcUrl) URL.revokeObjectURL(_wcUrl); _wcUrl=URL.createObjectURL(blob);
  const img=document.getElementById('wc-prev'); if(img) img.src=_wcUrl;
  if(btn){ btn.disabled=false; btn.textContent=(navigator.canShare&&navigator.canShare({files:[_wcFile]}))?'📤 Sdílet':'⬇️ Stáhnout obrázek'; }
};
window.shareWeekCard = () => {   // bez await před share: zachová gesto (iOS)
  if(!_wcFile) return;
  if(navigator.canShare && navigator.canShare({files:[_wcFile]})){
    navigator.share({files:[_wcFile], title:'Můj týden v LifePocket'})
      .catch(e=>{ if(e?.name!=='AbortError') downloadWeekCard(); });
  } else downloadWeekCard();
};
window.downloadWeekCard = () => {
  if(!_wcUrl) return;
  const a=document.createElement('a'); a.href=_wcUrl; a.download=_wcFile.name; document.body.appendChild(a); a.click(); a.remove();
  toast('⬇️ Obrázek uložen');
};
window.closeWeekCard = () => { document.getElementById('wc-modal')?.remove(); if(_wcUrl){URL.revokeObjectURL(_wcUrl);_wcUrl=null;} _wcFile=null; };
```
```css
.wc-prev{display:block;width:100%;aspect-ratio:4/5;border-radius:14px;background:#0f0f12;border:1px solid var(--border);margin-bottom:12px;object-fit:cover}
label.wc-tog{cursor:pointer;min-height:48px}
.wc-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.wc-actions .btn-s,.wc-actions .lp-link{min-height:44px;width:100%}
.wc-actions .btn-p:disabled{opacity:.6;cursor:default}
```
Do widgetu (app.js:6985) přidat:
```js
<button class="btn-s" style="margin-top:10px;min-height:44px" onclick="openWeekCard()">📤 Sdílet týden</button>
```
Volitelně si přepínače pamatovat v `lp_wc_opts` (localStorage, jen pohodlí). Pokud se zavede, přidat klíč do `LOCAL_PERSONAL_KEYS` (app.js:631).

**Firestore rules: beze změny** (nic se neukládá).

### Rizika
- **Emoji v canvasu** kreslí systémový font, takže vzhled se liší podle OS. Na starém Androidu bez barevných emoji může být zobrazení černobílé. Je to přijatelné.
- **Gesto na iOS:** `share()` se musí volat bez předchozího `await`, proto je PNG připravený dopředu. iOS PWA v režimu standalone `a[download]` zobrazí náhled místo uložení. To nevadí, protože iOS 15+ umí `canShare({files})`, a tlačítko „Sdílet“ tam proto bude vždy.
- **Fonty offline:** pokud Google Fonts nejsou v cache, po 3 s se použije Georgia. Karta je pořád čitelná.
- `ctx.roundRect` chybí ve starším Safari (<16), proto je v kódu záloha `rect`.
- Některé aplikace (WhatsApp) při sdílení souboru ignorují `text`, proto je `lifepocket.app` přímo na obrázku.
- Velikost PNG je asi 300–600 kB. To je v pořádku.

---

## Verze a souhrn dopadu

| Funkce | Soubory | Rules | Server | Reinstalace PWA |
|---|---|---|---|---|
| 1a Rychle přidat | app.js (+import `increment`), index.html, style.css | ne | ne | ne |
| 1b Množství | app.js, index.html, style.css | ne | ne | ne |
| 2a Zamrazení | app.js, style.css | ne | volitelně později (`pauses`) | ne |
| 2b Týdenní cíl | app.js, style.css | ne | ne | ne |
| 3 Karta | app.js, style.css | ne | ne | ne |

Každá dávka = `APP_VERSION`, záznam v `CHANGELOG`, bump `CACHE` v `sw.js`. Doporučené pořadí: **2a+2b** (oprava bugu se sérií a sdílené funkce, které využívá i karta) → **3** → **1b** → **1a**.

## Otázky pro vedoucího (výchozí = moje doporučení)

1. **Řádek nákupu:** přesunout ⭐ a ✏️ kategorie z řádku do spodního listu (řádek = ✓, název, množství, ×)? **Doporučuji ANO** (44px cíle, méně omylů).
2. **Pole „Qty“ v řádku přidání:** odstranit a nahradit ho parserem s náhledem? **Doporučuji ANO.** Alternativa: nechat ho jen na desktopu (>640 px).
3. **Limit zamrazení:** 2 dny za měsíc na návyk, zpětně max. 3 dny, pauzy bez limitu (max. 30 dní na jednu)? **Doporučuji ANO.**
4. **Kde nabízet kartu:** jen widget týdenního reportu, nebo i hlavička Návyků v neděli a pondělí? **Doporučuji obojí**, protože widget je vidět jen 7 dní po AI reportu.
5. **Jméno a názvy návyků na kartě:** výchozí stav vypnuto? **Doporučuji ANO** (soukromí na prvním místě).
6. **Karta vždy tmavá** bez ohledu na téma? **Doporučuji ANO** (jednotný brand na sítích).
7. **Sjednocení 7 výpočtů série** jako součást 2a (série se uživatelům po nasazení změní)? **Doporučuji ANO**, s CHANGELOG záznamem. Bez toho zamrazení nefunguje konzistentně.
8. **Server `isHabitDueToday` s rozsahy `pauses`:** odložit, protože `pausedUntil` zůstává synchronní? **Doporučuji odložit** do backlogu.
9. **Smazat mrtvou `quickAddShopItem`** (app.js:8535) v rámci 1a? **Doporučuji ANO.**
