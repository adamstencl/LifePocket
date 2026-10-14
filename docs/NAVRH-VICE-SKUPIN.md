# Návrh: rovnocenné skupiny (víc skupin, každá sdílí své moduly)

Stav ke dni 2026-10-13, `origin/main` = 9db0048 (verze 4.47). Čísla řádků platí pro tento commit a posunou se. Proto u každého místa uvádím i název funkce, podle které ho koder najde grepem. Nové texty patří do `i18n/cs.js` a `i18n/en.js` přes `t('…')`, tady je uvádím česky.

Podnět uživatele: „Napadla mě možnost mít víc skupin, dává smysl?“

**Odpověď: dává, a polovina už existuje.** Appka umí hlavní skupinu (`profile.familyId`) a vedlejší skupiny (`profile.extraGroupIds`). Vedlejší skupina ale sdílí jen Kalendář a osobní položky (návyky, cíle, poznámky, recepty, výzvy), a v Nastavení vypadá stejně těžkopádně jako hlavní, takže o ní uživatel skoro neví. Návrh z ní dělá plnohodnotnou skupinu. Každá skupina si sama zvolí moduly a v modulu se přepíná „Moje / 🏠 Rodina / 💼 Tým“.

**Nejdůležitější zjištění:** cílový stav jde postavit **bez migrace dat a bez nasazení pravidel Firestore**. Dokument skupiny už nese příznaky `shareShop/shareCal/shareMeal/shareChecklist`, a to i u vedlejších skupin (`createExtraGroup` je zakládá). Pravidla povolují libovolnou podkolekci pod `families/{gid}` každému členovi. Mění se jen klient (kde se dnes ptá na `familyId`) a funkce `groupNotifs`.

---

## 1. Současný stav v kódu

### 1a) Kde je hlavní skupina natvrdo

| Oblast | Místo (origin/main) | Dnes |
|---|---|---|
| Stav | `app.js:6510` `extraGroupIds`, `extraGroupsData`, `extraGroupEvents`, `unsubExtraGroupDocs/Cals`; hlavní skupina má samostatné `familyId`, `familyData`, `familyShopItems`, `familyMealPlan`, `familyChecklists`, `unsubFamily*` | dva paralelní světy |
| Odběr hlavní | `subscribeFamily` `:7556` → `subscribeSharedShop` `:7597`, `subscribeSharedCal`, `subscribeSharedMeal`, `subscribeSharedChecklist` (vše s `familyId`) | 11 listenerů (doc, shopItems, shopStats/freq, events, mealplan, checklists, pantry, activity, shared, reactions, challenges) |
| Odběr vedlejší | `subscribeExtraGroup` `:7529` | 6 listenerů (doc, events, activity, shared, reactions, challenges) |
| Je modul sdílený? | `groupModShared` `:7937`: osobní moduly a výzvy ve všech skupinách, `shop/meal/check/pantry` **jen** `gid === familyId`, ve vedlejší jen `cal` | pravidlo „ostatní jen hlavní“ |
| Nákupy | `isShopShared` `:6504` (`familyId && shareShop && shopViewMode==='shared'`), `shopViewMode` `:6491`, přepínač `#shop-view-toggle` v `index.html:649` („Rodina / Moje“), zápisy `addDoc(collection(db,'families',familyId,'shopItems'))` `:13003`, `:13032`, `:13915`, frekvence `:12830`, `:12953` | jen hlavní |
| Jídelníček | `isMealShared` `:9961`, `isMealAdmin` `:9963` (role v `familyData`), `renderMealPlan` `:9990`, `mealViewMode` `:6489`, přepínač `index.html:831` | jen hlavní |
| Checklisty | `subscribeSharedChecklist`, `syncChecklistToFamily`, `toggleChecklistShare` `:7671` (`list.shared` = bool, cíl vždy `familyId`), `gaCheck` `:7958` | jen hlavní |
| Zásoby | `initPantry` `:13734`: s `familyId` jen `families/{familyId}/pantry`, bez skupiny `localStorage lp_pantry` | hlavní = domácnost |
| Kalendář | `isCalShared` `:6505`, `getCalShareGroups` `:6521`, `updateEvShareUI` `:6537` (Ano/Ne + `<select>` skupiny) | **už funguje pro všechny skupiny** |
| Osobní sdílení | `startGroupSocial` `:8075` (kolekce `shared`, `reactions`), přepínač „Moje / Od skupiny (n)“ `:9061` | **už funguje pro všechny skupiny** |
| Výzvy, feed | `chGroupHTML`, `_chUnsub[gid]` `:8503`; `startGroupUnread` `:9558`, `gfPickGroup` `:9627`, `myGroupIds` `:9547` | **už funguje pro všechny skupiny** |
| Karta skupiny | `buildGroupCard` `:7691`: u vedlejší filtr `isPrimary \|\| m.key==='shareCal'`; přejmenování `renameFamilyGroup` jen u hlavní | dlouhá karta (kód, členové, moduly, feed, výzvy) × počet skupin |
| Nastavení | `renderFamilySettings` `:7762`, formulář „➕ Přidat skupinu“ | žádný limit počtu skupin |
| Přepnutí modulu | `toggleFamilyModule` `:7169` (umí `gid`) | funguje pro obě |
| Limity členů | `joinFamily` `:6702` `>= 6`, `joinExtraGroup` `:7253` `>= 8`; pravidla `firestore.rules:52` `size() <= 8` | 6 / 8 |
| Domů | widget Nákupy `:11282` čte jen osobní `shopItems` | **chyba:** kdo nakupuje v Rodině, vidí na Domů prázdný nebo cizí seznam |
| AI kontext | `buildChatContext` `:12107`, `famOk` jen hlavní skupina | vedlejší skupiny AI nevidí |

### 1b) Server (`functions/index.js`)

| Funkce | Místo | Dnes |
|---|---|---|
| `groupNotifs` (v `sendScheduledNotifications`) | `:852`, mapa `shared` `:874` | `shop/meal/check/pantry` jen `isMain`, `GN_MAX_GROUPS = 10` `:449` |
| Připomínky událostí a narozeniny | `:1051` | **jen `prof.familyId`**. Události z vedlejších skupin nepřipomíná (díra už dnes) |
| `notifyFamily` | `:686` | jen `senderProf.familyId` |
| `deleteAccount`, `rotateGroupCode`, `restoreGroup` | `:1282`, `:1511`, `:1704` | už pracují s `familyId` i `extraGroupIds`, rotace kopíruje všechny podkolekce (`copySubcollections` `:1391`) |

### 1c) Pravidla (`firestore.rules`)

- `families/{id}`: `get` každý přihlášený, `list` nikdo, `create` s ID `WORD-XXXXXX`, ostatní pole se při vytvoření neomezují. Členové max. 8 (`:52`).
- Běžný člen smí měnit jen `groupName, shareShop, shareCal, shareMeal, shareChecklist, members` (`isFamilyMemberUpdate` `:67`), správce cokoli.
- `families/{id}/{sub}/{doc}` (`:108`): člen čte i zapisuje cokoli kromě `activity/shared/reactions/challenges`, které mají vlastní pravidla.

**Závěr:** pravidla rozlišují jen „člen skupiny“, ne hlavní nebo vedlejší. Nákupy, jídelníček i checklist ve vedlejší skupině projdou už dnes.

---

## 2. Cílový model a migrace

### 2a) Model

Všechny skupiny jsou si rovné. **Hlavní skupina zůstává jako „⭐ Hlavní“**: výchozí cíl pro Domů, AI a rychlé přidání a jediné místo pro Zásoby (fyzická lednice je jedna). Technicky se dál drží v `profile.familyId`. Díky tomu starší verze appky dál fungují beze změny.

```
users/{uid}/profile/main
  familyId: 'HANA-K7M2QX'          // ⭐ hlavní (beze změny)
  extraGroupIds: ['ADAM-…','NORA-…'] // ostatní (beze změny), celkem max. 5 skupin

families/{gid}                      // beze změny + 1 volitelné pole
  groupName, members{…}, createdBy, code
  shareShop, shareCal, shareMeal, shareChecklist   // platí NOVĚ v každé skupině
  emoji: '🏠'                       // NOVÉ, volitelné, nastaví zakladatel/správce
```

Sémantika příznaků je pro všechny skupiny stejná: `shareShop/shareCal/shareMeal` = `true`, `shareChecklist` = `!== false` (výchozí zapnuto jako dnes u hlavní, vedlejší ho mají uložené explicitně `false`). Zásoby = jen hlavní.

Klient: jeden registr místo dvou světů.

```js
// app.js – nový stav (nahradí familyData/extraGroupsData, familyShopItems…)
const GRP = {};  // gid → { data, main:bool, unsub:{doc,act,sh,rx,ch,shop,cal,meal,check}, shop:[], events:[], meal:{}, checks:[] }
function grpIds()        { return myGroupIds(); }                    // hlavní první
function modGroups(mod)  { return grpIds().filter(g => groupModShared(g, mod)); }
function groupModShared(gid, mod) {                                    // stejná logika i na serveru
  const d = GRP[gid]?.data; if(!d) return false;
  if(GA_PERSONAL.includes(mod) || mod === 'challenge') return true;
  return { cal: !!d.shareCal, shop: !!d.shareShop, meal: !!d.shareMeal,
           check: d.shareChecklist !== false, pantry: gid === familyId }[mod] || false;
}
let viewGid = { shop: null, meal: null };  // null = Moje; pamatuje se v localStorage lp_view_<mod>
```

`familyId` a `familyData` zůstanou jako alias (`familyData = GRP[familyId]?.data`). Koder je nemusí přepsat najednou, stačí po modulech, viz fáze.

### 2b) Migrace: žádná

- Data se nikam nepřesouvají. Nákupy hlavní skupiny jsou dál v `families/{familyId}/shopItems`.
- Nové verze začnou u vedlejších skupin respektovat `shareShop/shareMeal/shareChecklist`. Ty jsou dnes `false` (zakládá je tak `createExtraGroup`), takže se po aktualizaci nic samo nezapne.
- Pole `emoji` chybí → zobrazí se výchozí `👥`.

### 2c) Zpětná kompatibilita (starší verze na jiném zařízení)

| Situace | Co se stane | Hodnocení |
|---|---|---|
| Starší verze, hlavní skupina | vše jako dnes | OK |
| Starší verze, vedlejší skupina se zapnutými Nákupy | karta ukáže jen přepínač Kalendář, nákupy vedlejší skupiny neuvidí | přijatelné. Data nemizí, po aktualizaci (network-first SW = při příštím otevření) je vidí |
| Starší verze přepne hlavní a vedlejší („Nastavit jako hlavní“ z nové verze) | čte `familyId` z profilu a změnu převezme | OK |
| Starší verze připojí 6. člena do hlavní | odmítne (`>= 6`), nová pustí do 8 | OK, pravidla mají 8 |
| Starší verze přidá 6. skupinu kódem | projde (klient limit nezná) | nevadí, limit je kvůli nákladům, ne bezpečnosti. Nová verze ukáže všechny, jen nedovolí přidat další |

---

## 3. UI na mobilu (360 px, všechna témata)

Komponenty, které už existují a použiju je: `.seg` + `.seg-btn` (44 px, `style.css:1147`), `.fshare-mod-row` + `.fshare-toggle` (`:160`), `.family-member`, `.family-code-box`, `.moverlay` + `.modal` (sheet), `.gf-open` + `.gf-count`. Sekundární texty dávám do `--text2`. `--text3` na `--card2` má ve `sunshine` nedostatečný kontrast (viz NAVRH-JIDELNICEK).

### 3a) Nastavení → Skupiny

**Před:** každá skupina je plná karta (název, „Co je nového“, výzvy, kód s třemi tlačítky, všichni členové, moduly, „Opustit“). Na 360 px to je zhruba 900–1100 px na skupinu, při 3 skupinách 3 obrazovky scrollu. Vedlejší skupina má jen přepínač Kalendář.

**Po:** seznam krátkých karet (jedna skupina = 72 px). Klepnutí otevře detail v sheetu.

```
┌──────────────────────────────────────┐
│ 👥 Skupiny                    3 z 5  │
│ ┌──────────────────────────────────┐ │
│ │ 🏠 Rodina ⭐            🔔 3   ›  │ │  ← 1. řádek: emoji, název, hvězda u hlavní, nepřečtené
│ │ 4 členové · 🧺 🗓️ 🥗 📋 🧊        │ │  ← 2. řádek: počet + emoji sdílených modulů
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 💼 Tým Alfa                   ›  │ │
│ │ 6 členů · 🗓️ 📋                  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 🎉 Kamarádi              🔔 1  › │ │
│ │ 3 členové · 🗓️                   │ │
│ └──────────────────────────────────┘ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   ➕ Přidat skupinu                  │  ← při 5 z 5: disabled + „Máš maximum 5 skupin“
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│      Obnovit dřívější skupinu        │
└──────────────────────────────────────┘
```

```html
<div class="grp-list" role="list">
  <button type="button" class="grp-card" role="listitem" data-gid="HANA-K7M2QX" onclick="openGroupSheet(this.dataset.gid)">
    <span class="grp-em" aria-hidden="true">🏠</span>
    <span class="grp-main">
      <span class="grp-name">Rodina <span class="grp-star" title="Hlavní skupina">⭐</span></span>
      <span class="grp-sub">4 členové · <span aria-label="Sdílí: Nákupy, Kalendář, Jídelníček, Checklisty, Zásoby">🧺 🗓️ 🥗 📋 🧊</span></span>
    </span>
    <span class="gf-count" aria-label="3 novinky">3</span>
    <span class="grp-chev" aria-hidden="true">›</span>
  </button>
</div>
```

```css
.grp-list{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
.grp-card{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 14px;
  background:var(--card2);border:1px solid var(--border);border-radius:14px;color:var(--text);
  font-family:'Crimson Pro',serif;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.grp-card:active{background:var(--card3)}
.grp-em{font-size:26px;line-height:1;flex-shrink:0}
.grp-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.grp-name{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grp-star{font-size:12px}
.grp-sub{font-size:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grp-chev{font-size:22px;color:var(--text2);flex-shrink:0}
```

**Detail skupiny (sheet `m-group`, celá výška, zavírací ✕ 44 px):** pořadí podle četnosti použití.

1. Hlavička: `🏠 Rodina` + ✏️ (název a emoji, jen správce). Pod ní `🔔 Co je nového (3)` (stávající `.gf-open`).
2. **Co skupina sdílí:** `.fshare-mod-row` pro 🧺 Nákupy, 🗓️ Kalendář, 🥗 Jídelníček, 📋 Checklisty. Zásoby jen u hlavní, jako needitovatelný řádek „🧊 Zásoby · jen v hlavní skupině“. Pod nimi jedna věta v `--text2`: „Návyky, cíle, poznámky a recepty sdílíš u každé položky zvlášť.“
3. Výzvy (stávající `chGroupHTML`).
4. Členové (stávající `.family-member`, ✕ pro správce zvětšit na 44×44).
5. Pozvat: kód + 📋 Kopírovat + 📤 Sdílet (+ 🔄 Nový kód pro správce).
6. Dole odděleně: `⭐ Nastavit jako hlavní` (u nehlavní skupiny) a `Opustit skupinu` (červený obrys).

Vypnutí modulu, ve kterém jsou data, se potvrzuje: „Vypnout Nákupy pro skupinu Rodina? Seznam zůstane uložený, jen ho přestanete vidět.“ (Data se nemažou.)

**Nová skupina (sheet):** název, výběr emoji (8 tlačítek 44×44: 🏠 💼 🎉 ⚽ 🏡 🎓 ✈️ 👥) a šablona, která předvyplní přepínače:

| Šablona | Zapne |
|---|---|
| 🏠 Domácnost | Nákupy, Kalendář, Jídelníček, Checklisty |
| 💼 Tým / práce | Kalendář, Checklisty |
| 🎉 Kamarádi | Kalendář |

Pod šablonou jsou rovnou vidět přepínače, takže šablona je jen zkratka. Pod oddělovačem „— nebo se připoj kódem —“ zůstává stávající pole s kódem.

### 3b) Přepínač skupin v modulu

**Před (Nákupy, Jídelníček):** `[ Rodina | Moje ]`. Text „Rodina“ je natvrdo, i když se skupina jmenuje „Spolubydlící“.

**Po:** volby = `Moje` + skupiny, kde je modul zapnutý (`modGroups(mod)`). Pořadí: Moje, hlavní, ostatní podle `extraGroupIds`.

- **1 volba (jen Moje):** přepínač skryt (jako dnes).
- **2–3 volby:** `.seg.seg--block` přes celou šířku pod nadpisem modulu. Šířka segmentu ≈ (328 − 6) / 3 ≈ 107 px, text se ořízne elipsou.

```
 🧺 Nákupy
┌────────────────────────────────────┐
│ ( 🙂 Moje ) ( 🏠 Rodina ) ( 💼 Tým… )│  ← 44 px, aktivní = --accent / --on-accent
└────────────────────────────────────┘
```

- **4 a víc voleb:** jedno tlačítko `.grp-pick` „🏠 Rodina ▾“ přes celou šířku. Otevře sheet se seznamem (řádek 52 px, ✓ u vybrané).

```html
<div class="seg seg--block" role="group" aria-label="Čí seznam zobrazit">
  <button type="button" class="seg-btn" data-gid="" aria-pressed="false" onclick="setModView('shop',this.dataset.gid)">🙂 Moje</button>
  <button type="button" class="seg-btn active" data-gid="HANA-K7M2QX" aria-pressed="true" onclick="setModView('shop',this.dataset.gid)">🏠 Rodina</button>
  <button type="button" class="seg-btn" data-gid="ADAM-P4R7TT" aria-pressed="false" onclick="setModView('shop',this.dataset.gid)">💼 Tým Alfa</button>
</div>
<!-- 4+ voleb -->
<button type="button" class="grp-pick" aria-haspopup="dialog" onclick="openModViewSheet('shop')">
  <span>🏠 Rodina</span><span aria-hidden="true">▾</span>
</button>
```

```css
.seg--block .seg-btn{min-width:0;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grp-pick{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;margin-bottom:12px;
  padding:0 16px;background:var(--card2);border:1px solid var(--border);border-radius:24px;color:var(--text);
  font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;cursor:pointer}
```

Názvy skupin jdou do HTML přes `esc()`, `gid` přes `data-gid` a `this.dataset.gid`.

**Podle modulu:**

| Modul | Zobrazení | Kam se přidává |
|---|---|---|
| 🧺 Nákupy | přepínač (jeden seznam naráz) | do vybraného seznamu |
| 🥗 Jídelníček | přepínač; „upravovat smí jen správce“ (`isMealAdmin`) se počítá pro vybranou skupinu | do vybraného plánu |
| 🗓️ Kalendář | **sloučený** pohled jako dnes, u sdílené události emoji skupiny před názvem (`🏠 Večeře u babičky`) | modal události: místo „Sdílet Ano/Ne + select“ jeden řádek čipů `🙂 Jen já · 🏠 Rodina · 💼 Tým` (`.seg--block`, při 4+ `.grp-pick`) |
| 📋 Checklisty | sloučený seznam, sdílený list má štítek `🏠 Rodina` | „Sdílet“ u listu otevře sheet s výběrem skupiny (list patří do jedné skupiny) |
| 🧊 Zásoby | beze změny (jen hlavní) | |
| Návyky, cíle, poznámky, recepty | beze změny („Moje / Od skupiny (n)“ a výběr skupin u položky už existují) | |

**Výchozí skupina pro přidávání = co je právě vidět.** Uživatel nemusí nic nastavovat. Volba se pamatuje na zařízení (`lp_view_shop`, `lp_view_meal`, try/catch). Při prvním otevření: hlavní skupina, pokud v ní modul sdílí, jinak Moje. Zmizí-li vybraná skupina (odchod, vypnutí modulu), spadne volba na výchozí a ukáže se toast „Seznam skupiny Tým už není sdílený, ukazuju Moje“.

Rychlé přidání mimo modul (Domů, AI chat „přidej mléko“, „Doplnit z jídelníčku“, zásoby → nákup) jde do **naposledy zobrazeného** seznamu. Toast vždy řekne kam: „✓ Mléko → 🏠 Rodina“.

### 3c) Domů

- Widget 🧺 Nákupy ukáže **seznam naposledy vybraný v Nákupech**, v hlavičce s názvem: `🧺 Nákupy · 🏠 Rodina`. Klepnutí otevře Nákupy na stejném seznamu. Tím se opraví i dnešní chyba, kdy widget čte jen osobní `shopItems`.
- Přepínač skupin na Domů **nedávat**. Domů má být klidný.
- Kalendář na Domů už slučuje všechny skupiny. Stačí doplnit emoji skupiny.
- Nepřečtené ze všech skupin jsou dál v `🔔 Co je nového` (feed už má výběr skupiny `gfPickGroup`).

---

## 4. Náklady

### 4a) Listenery

| | dnes hlavní | dnes vedlejší | cíl: každá skupina (eager) | cíl: líně (doporučeno) |
|---|---|---|---|---|
| doc, activity (limit 20), shared, reactions, challenges (limit 10) | 5 | 5 | 5 | 5 |
| events | 1 | 1 | 1 | 1 (kalendář je sloučený) |
| shopItems + shopStats | 2 | – | 2 | jen u **zobrazené** skupiny |
| mealplan | 1 | – | 1 | jen u zobrazené |
| checklists | 1 | – | 1 | při otevření Checklistů, pak drží |
| pantry | 1 | – | – | jen hlavní |
| **součet při 5 skupinách** | | | **≈ 51** | **≈ 31 + 2–4** |

**Doporučení „líně a držet“:** modulový listener skupiny se založí při prvním zobrazení dané skupiny v modulu a drží do konce relace (neruší se při přepnutí). Přepínání tam a zpět tak nic nestojí a počet čtení roste jen s tím, co uživatel opravdu otevřel.

### 4b) Čtení

Start listeneru přečte celou kolekci, další změny jsou po jednom dokumentu. Hrubý odhad na jedno otevření appky:

- skupina bez modulů (doc + activity 20 + shared ~10 + reactions ~10 + challenges ≤ 10) ≈ 50 čtení,
- events: **celá kolekce bez omezení data** (`subscribeSharedCal`), po roce používání stovky dokumentů na skupinu. Tohle je největší položka.

5 skupin × ~50 + kalendáře ≈ 300–800 čtení na otevření. Při 5 otevřeních denně je to 1,5–4 tis. čtení na uživatele a den. Bezplatná kvóta je 50 tis. denně na projekt, potom řádově 0,03–0,06 USD za 100 tis. čtení. Při stovkách uživatelů jsou to haléře, ale **limit 5 skupin** je rozumná pojistka.

Úspora navíc (samostatný úkol, neblokuje): sdílené události načítat od `dnes − 60 dní` + narozeniny zvlášť (`type == 'birthday'`).

### 4c) Limity

- **Max. 5 skupin na uživatele** (hlavní + 4). Hlídá klient v `createExtraGroup`, `joinExtraGroup` a v odkazu s pozvánkou `:7164` („Máš už 5 skupin. Nejdřív nějakou opusť.“). Server má pojistku `GN_MAX_GROUPS = 10`, tu nechat.
- **Max. 8 členů v každé skupině** (sjednotit, pravidla už mají 8). Hlavní 6 byl historický limit, technický důvod nemá.

---

## 5. Pravidla Firestore a functions

### 5a) Pravidla: pro fáze 1–3 beze změny

Nákupy, jídelníček a checklisty ve vedlejší skupině pravidla už pustí (obecný blok `:108`). Příznaky `share*` mění člen i správce. `emoji` zapíše zakladatel při `create` (pole se neomezují) a správce kdykoli.

Volitelné zpřísnění (jedno ruční nasazení, **zeptat se uživatele**): v `create` a `update` dokumentu skupiny `groupName.size() <= 40`, `emoji is string && emoji.size() <= 8`. Totéž pro `isFamilyMemberUpdate`, pokud by emoji měl měnit i běžný člen (doporučuji ne).

### 5b) Functions (nasadí se samy po pushi)

1. `groupNotifs` `:874`: mapa `shared` podle příznaků v každé skupině, stejná jako klientské `groupModShared`:
   ```js
   const shared = {cal: !!fam.shareCal, shop: !!fam.shareShop, meal: !!fam.shareMeal,
     check: fam.shareChecklist !== false, pantry: isMain, habit: true, goal: true,
     react: true, challenge: true, note: true, recipe: true};
   ```
   Pozor: vedlejší skupiny mají `shareChecklist:false` explicitně, takže `!== false` je bezpečné. Hlavní skupiny bez pole zůstanou zapnuté jako dnes.
2. Připomínky událostí a narozeniny `:1051`: projít `[familyId, ...extraGroupIds]` se `shareCal` a členstvím (`famEntry` už cachuje). Opraví i dnešní díru.
3. `notifyFamily` `:686`: volitelný parametr `gid`, ověřit `members[uid]`, bez něj `familyId` (starší klienti). Rate limit `famNotify[gid]` už je po skupinách.
4. `dailyStats`: přidat histogram „počet skupin na uživatele“ (0/1/2/3+), abychom viděli, jestli se funkce používá. Volitelné.
5. `deleteAccount`, `rotateGroupCode`, `restoreGroup`: beze změny (už pracují s oběma poli a kopírují všechny podkolekce). `restoreGroup` musí respektovat limit 5: když je plno, vrátit `failed-precondition` s českou zprávou.

---

## 6. Fáze implementace

**Fáze 1: Nákupy ve všech skupinách** (nejmenší užitečný krok, 1 verze, bez pravidel)

- `groupModShared` podle příznaků pro všechny skupiny, `modGroups()`.
- `buildGroupCard`: zrušit filtr `isPrimary || shareCal`, aby měla vedlejší skupina přepínač Nákupy (a zatím i Kalendář). Ostatní přepínače skrýt až do fáze 3.
- Nákupy: `viewGid.shop` místo `shopViewMode`, přepínač `Moje / skupiny` (3a), listener `shopItems` + `shopStats` po skupinách (líně). Všechna místa s `families/{familyId}/shopItems` → `viewGid.shop` (grep `'shopItems'`, `isShopShared`, `shopFid`). Funkce `moveShopToFamily` `:12734` → „Přesunout do…“ s výběrem skupiny.
- Widget Nákupy na Domů (3c).
- Limit 5 skupin, limit 8 členů.
- Server: bod 1 z 5b.
- Hodnota: rodina + spolubydlící nebo chata už mají každý svůj nákupní seznam.

**Fáze 2: Nastavení**: krátké karty + detail ve sheetu, emoji, šablony, „⭐ Nastavit jako hlavní“ (prohození `familyId` a `extraGroupIds` v jedné transakci profilu; přesun Zásob = jen jiná skupina, data zůstanou, upozornit „Zásoby se teď budou brát ze skupiny X“).

**Fáze 3: Jídelníček a Checklisty** ve všech skupinách (přepínač, `isMealAdmin(gid)`, `toggleChecklistShare` s výběrem skupiny, `gaCheck` s `gid` listu). Kalendář: čipy v modalu a emoji u událostí. Server: body 2 a 3.

**Fáze 4: dokončení**: `buildChatContext` uvádí názvy skupin a sdílené nákupy a události ze všech skupin (v limitu ~7000 znaků, hlavní má přednost). **Hotovo v 4.54:** hlavní skupina v běžných sekcích s názvem (⭐), každá další skupina má vlastní zkrácenou sekci (nákupy 8 položek, jídelníček dnes + 2 dny, 3 checklisty po 6 položkách), události s názvem skupiny; při překročení limitu se nejdřív zkracují další skupiny (zůstanou aspoň 2 řádky), pak ostatní sekce. Chat při první zprávě přihlásí listenery nákupů, jídelníčku a checklistů všech skupin (čeká max. 1,5 s). Postupně nahradit `familyData/familyShopItems…` registrem `GRP` (refaktor bez viditelné změny). Okno kalendáře (4b).

Každá fáze = `APP_VERSION` + `CHANGELOG` + bump `CACHE`. Návrh changelogu pro fázi 1: „🧺 Nákupní seznam teď můžeš sdílet v každé skupině, třeba zvlášť s rodinou a se spolubydlícími. Přepneš ho nahoře v Nákupech.“

---

## 7. Otevřená rozhodnutí (doporučení je výchozí volba)

1. **Ponechat pojem „⭐ Hlavní skupina“?** Doporučuji **ano**: výchozí pro Domů a AI, jediné místo pro Zásoby, technicky `familyId`, takže starší verze fungují. Alternativa „všechny úplně stejné“ by vyžadovala nové pole v profilu a rozbila starší verze.
2. **Limit počtu skupin:** doporučuji **5** (hlavní + 4).
3. **Limit členů:** doporučuji **sjednotit na 8** (pravidla už to mají).
4. **Zásoby:** doporučuji **jen v hlavní skupině**. Lednice je jedna a navazuje na jídelníček a nákup.
5. **Checklist:** doporučuji **sdílet do jedné skupiny**. Víc skupin by znamenalo kopie a rozjeté odškrtávání.
6. **Kalendář:** doporučuji **sloučený pohled + emoji skupiny**, bez přepínače (přepínač by schoval důležité události).
7. **Přepínač při 4+ volbách:** doporučuji **tlačítko se sheetem**. Vodorovně posuvné čipy na 360 px schovávají volby za okraj.
8. **Kdo zapíná a vypíná moduly skupiny:** doporučuji **nechat jako dnes (každý člen)** s potvrzením při vypnutí. Omezit na správce = změna pravidel a ruční nasazení.
9. **Emoji skupiny:** doporučuji **ano, mění ho jen správce**, bez změny pravidel.
10. **Domů:** doporučuji **jen naposledy zobrazený seznam**, bez přepínače a bez souhrnu všech skupin.
11. **Zpřísnění pravidel (`groupName`, `emoji` délka):** doporučuji **odložit do backlogu**. Až se bude nasazovat jiná změna pravidel, přibalit (vyžaduje souhlas uživatele).
12. **Začít fází 1 (Nákupy)?** Doporučuji **ano**: nejvíc viditelné, bez pravidel a migrace, a hned ověří, jestli o víc skupin je zájem (histogram v `dailyStats`).
