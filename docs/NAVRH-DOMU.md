# Návrh: přizpůsobení Domů (4.86)

Cíl: každý si na Domů seřadí a schová karty podle sebe. Jedno místo na úpravu, synchronizace přes profil a žádná nová pravidla Firestore (`users/{uid}/**` už pokrývá vlastník).

## 1. Které karty se dají upravit

Dnes `rDash()` skládá karty do `#d-widgets` v pevném pořadí. Návrh je rozdělí do dvou pásem.

**Pevné pásmo nahoře, nehýbe se a neschovává se.** Jsou to dočasné karty, které samy zmizí:

| Karta | Funkce | Proč pevná |
|---|---|---|
| Banner parťáka (Rex) a pozdrav | mimo `#d-widgets` | hlavička Domů |
| Začínáme / „Co teď“ | `quickStartHTML()` | nováček, sama zmizí po 21 dnech nebo po zavření |
| Nabídky a novinky | `nudgeForDash()`, `wtIntroSlot()`, `groupNotifIntroHTML()`, `gameIntroHTML()` | jednorázové, mají vlastní ×, limit nabídek |
| Týdenní souhrn (po a út) | `weekCardHTML()` | platí dva dny |
| Nápověda „Zapni si moduly“ | `!mods.length` | stav bez modulů |

**Pásmo upravitelných karet.** U každé jde měnit pořadí i schovat ji. Výchozí pořadí odpovídá dnešnímu stavu:

| id | Karta | Ukáže se, jen když |
|---|---|---|
| `focus` | 🎯 Hlavní úkol (Dnes/Zítra) | `unlD('focus')` |
| `water` | 💧 Pitný režim | modul `water` |
| `pc` | 🏅 Výzva měsíce | `unlD('pc') \|\| pcJoined()` |
| `ch` | 🤝 Výzvy ve skupině | vždy, obsah podle stavu |
| `energy` | ⭐ Energie parťáka | `rexEnergyVisible()` |
| `quote` | 💬 Citát dne | vždy |
| `habits` | 🔥 Návyky dnes | modul `habits` a aspoň 1 návyk |
| `journal` | 📒 Zápisník | modul `journal` |
| `goals` | 🏆 Cíle | modul `goals` a aspoň 1 cíl |
| `calendar` | 🗓️ Nadcházející události | modul `calendar` a nějaké události |
| `cooking` | 👨‍🍳 Vaření | modul `cooking` |
| `shopping` | 🧺 Nákupy | modul `shopping` a položky |
| `mood` | 😊 Nálada | starší modul `mood` |
| `report` | 📊 Týdenní report | uložený report ≤ 7 dní |
| `streaks` | 🔥 Série | modul `habits` a série ≥ 2 |

Pravidla:
- Úprava mění **jen pořadí a viditelnost**. Podmínky zobrazení (odkrytí, prázdná data, moduly) platí dál. Schovaná karta se nevykreslí ani tehdy, když má data.
- Karta vypnutého modulu se nevykreslí a v editoru chybí. Po zapnutí modulu se vrátí na uložené místo, nebo na výchozí, pokud tam ještě nikdy nebyla. Schovaná zůstane schovaná.
- `mealplan` a `checklist` dnes na Domů kartu nemají, proto nejsou ani v seznamu.

## 2. Kde se upravuje

**Vstupy (dva, oba otevřou stejný editor `openDashEdit()`):**
1. Tlačítko úplně dole na Domů, pod poslední kartou: `✏️ Upravit Domů`. Je nenápadné (styl odkazu, `--text3`), na středu a vysoké 44 px. Ukáže se, jen když jsou v editoru aspoň 2 karty.
2. Nastavení → sekce „📱 Moduly“, pod přepínači modulů: řádek `🏠 Upravit Domů →`. Moduly a Domů spolu souvisí, proto patří k sobě.

**Editor** je bottom sheet ve stávajícím `.moverlay` + `.modal`, ovládání palcem je u spodního okraje.

```
┌──────────────────────────────────┐
│ Uprav si Domů                  × │
│ Podrž ≡ a přetáhni, nebo použij  │
│ šipky. 👁 kartu schová.          │
│ ┌──────────────────────────────┐ │
│ │ ≡  🎯 Hlavní úkol   ▲ ▼  👁  │ │
│ │ ≡  🔥 Návyky dnes   ▲ ▼  👁  │ │
│ │ ≡  🗓️ Události      ▲ ▼  👁  │ │
│ │ ≡  💬 Citát dne     ▲ ▼  🙈  │ │ ← schovaná: řádek ztlumený, text „schovaná“
│ │ …                            │ │
│ └──────────────────────────────┘ │
│ Tipy a karta Začínáme jsou vždy  │
│ nahoře a zmizí samy.             │
│ [Obnovit výchozí]   [  Hotovo  ] │
└──────────────────────────────────┘
```

- **Přetažení:** stejný vzor jako u návyků a checklistu, `enableDragReorder(list, '.dl-row', onDrop)`. Řádek má `data-drag-id`, podržení 350 ms ho zvedne, funguje automatický posun i vibrace. Tlačítka v řádku tah nespustí (už je v `DRAG_SKIP`). Úchyt ≡ je jen vizuální nápověda, chytit jde celý řádek, tak jako u návyků.
- **Přístupná alternativa:** ▲▼ jako samostatná tlačítka 44×44, `aria-label` „Posunout Návyky výš/níž“. Na prvním a posledním řádku je příslušná šipka `disabled`. Po posunu zůstane fokus na stejném tlačítku přesunutého řádku.
- **👁 / 🙈:** `<button aria-pressed>` 44×44, `aria-label` „Schovat Citát dne“ nebo „Ukázat Citát dne“. Schovaný řádek má `opacity:.55` a pod názvem drobné „schovaná“, takže stav nepoznáš jen podle barvy.
- **Ukládání:** každá změna se hned propíše do `prof.dashLayout` a Domů se překreslí na pozadí. Do Firestore se zapisuje po 800 ms klidu, při zavření editoru hned. Tlačítko Hotovo jen zavře editor, nic se nepotvrzuje.
- **Obnovit výchozí:** zeptá se přes stávající potvrzovací dialog („Vrátit Domů do původní podoby?“), pak `dashLayout` smaže (`deleteField()`) a ukáže toast „Domů je zase jako na začátku 👍“.

### Před / po (Domů)

```
PŘED (pevně)                   PO (příklad: Návyky nahoru, citát schovaný)
[Rex banner]                   [Rex banner]
[Začínáme / tipy]              [Začínáme / tipy]     ← pevné pásmo
[🎯 Hlavní úkol]               [🔥 Návyky dnes]
[💧 Pitný režim]               [🎯 Hlavní úkol]
[🏅 Výzva] [🤝 Skupina]        [🗓️ Události]
[⭐ Energie] [💬 Citát]         [💧 Pitný režim] …
[🔥 Návyky] [📒] [🏆] [🗓️] …   (citát schovaný)
                               ┄┄ ✏️ Upravit Domů ┄┄
```

## 3. Uložení

```js
prof.dashLayout = { order: ['habits','focus','calendar', …], hidden: ['quote'] }
```
- Ukládá se do `users/{uid}/profile/main` přes `updateDoc(…, {dashLayout})`, celý objekt naráz. Synchronizuje se mezi zařízeními a pravidla Firestore se nemění.
- **Nejde-li o úpravu, pole neexistuje.** Kdo nic neupravil, má vždy aktuální výchozí pořadí, včetně budoucích změn výchozího pořadí.
- **Sloučení (`dashOrder()`):** z uloženého `order` se vezmou známá id bez duplicit. Každé známé id, které v něm chybí (nová karta v nové verzi), se vloží hned za nejbližšího předchůdce z výchozího pořadí. Když předchůdce chybí, jde na začátek. Nové karty se tak objeví tam, kam patří, a ne až na konci.
- **Neznámá id** (karta z novější verze uložená na jiném zařízení) se při vykreslení přeskočí, ale **při uložení se zachovají** na konci `order`, případně v `hidden`. Starší verze tak nesmaže nastavení novější verze.
- Vypnutí modulu na `dashLayout` nesahá. Karta zmizí, protože se nevykreslí (bod 1).
- Validace při čtení: `order` a `hidden` musí být pole řetězců (max. 40 položek, každý ≤ 20 znaků), jinak se berou jako prázdná.

## 4. Výchozí pořadí

**Doporučuju: výchozí = dnešní pořadí, bez další „chytrosti“.**
- Stávajícím uživatelům se Domů po aktualizaci nezmění, takže je nic nepřekvapí.
- Chytré řazení podle šablony už existuje tam, kde dává smysl: v jednoduchém režimu `simpleModOrder()`. Další automatika by se tloukla s ručním pořadím („proč se mi to přeskládalo?“).
- Kdo chce jinak, má na to ✏️. Uložené pořadí má vždy přednost a nic ho automaticky nepřepíše.

## 5. Jednoduchý režim a nováčci

- **Prvních 14 dní jednoduchého režimu (`simpleDash()`, sloty s max. 3 kartami): bez úprav.** Tlačítko dole ani řádek v Nastavení se neukážou. Sloty jsou řízené záměrně a ruční pořadí by je rozbilo. Uložený `dashLayout` (třeba z jiného zařízení) se v tomhle období ignoruje.
- **Po 14 dnech, nebo mimo jednoduchý režim:** úpravy jsou dostupné všem. Výchozí pořadí karet modulů v jednoduchém režimu je `simpleModOrder()` (lišta), ostatní karty podle tabulky.
- Nováček mimo jednoduchý režim vidí tlačítko až dole pod kartami. Nic nevyskakuje a do limitu nabídek se nepočítá.

## 6. Kroky pro kodéra

**Funkce (app.js, u `rDash`):**
1. `const DASH_CARDS = [{id:'focus', em:'🎯'}, …]` ve výchozím pořadí, názvy přes `t('dash.card.'+id)`.
2. `dashLayout()` vrátí validované `{order, hidden}`. `dashOrder(avail)` provede sloučení podle bodu 3 a vrátí id k vykreslení (bez schovaných, jen z `avail`).
3. Refaktor `rDash()` v části `!slots`: místo `html+=` po sobě se karty sbírají do mapy `C[id]` (`mw` už to dělá u modulů). Pak `html = pevnéPásmo + dashOrder(Object.keys(C)).map(id => C[id]).join('') + tlačítkoUpravit`. Obaly `#pc-dash` a `#ch-dash` zůstávají, protože se aktualizují na místě.
4. Schovaný `quote` nevolá `loadDailyQuote()` (ušetří volání), schovaný `shopping` nevolá `subscribeGroupShop`.
5. `openDashEdit()`, `dashEditRender()`, `dashMove(id, dir)`, `dashToggle(id)`, `dashReset()`, `dashSave()` (debounce 800 ms, `flush` při zavření). V řádcích `data-a0` a `this.dataset.a0`, žádné `onclick="fn('${id}')"`.
6. Editor ukazuje karty, které by se mohly vykreslit podle modulů a odkrytí. Nezohledňuje, jestli mají právě data, takže v seznamu jsou i Události bez událostí.
7. Nastavení: řádek v `#set-mods` (nebo hned pod ním) s `onclick="openDashEdit()"`, skrytý při `simpleDash()`.

**i18n (cs.js i en.js):**
`dash.edit.btn` „✏️ Upravit Domů“, `dash.edit.title` „Uprav si Domů“, `dash.edit.hint` „Podrž ≡ a přetáhni, nebo použij šipky. 👁 kartu schová.“, `dash.edit.fixed` „Tipy a karta Začínáme jsou vždy nahoře a zmizí samy.“, `dash.edit.up` / `dash.edit.down` „Posunout {name} výš/níž“, `dash.edit.hide` / `dash.edit.show` „Schovat/Ukázat {name}“, `dash.edit.hidden` „schovaná“, `dash.edit.done` „Hotovo“, `dash.edit.reset` „Obnovit výchozí“, `dash.edit.resetQ` „Vrátit Domů do původní podoby?“, `dash.edit.resetOk` „Domů je zase jako na začátku 👍“, `dash.edit.allHidden` „Všechny karty máš schované. Vrátíš je přes ✏️ Upravit Domů.“, `set.mods.dash` „🏠 Upravit Domů“, `dash.card.<id>` pro 15 karet.

**CSS (style.css, jen tokeny, takže funguje v tmavém i světlém motivu):**
```css
.dash-edit{display:block;margin:4px auto 8px;min-height:44px;padding:0 18px;background:none;border:none;color:var(--text3);font-family:'Crimson Pro',serif;font-size:15px;cursor:pointer}
.dl-list{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto}
.dl-row{display:flex;align-items:center;gap:4px;min-height:52px;padding:0 4px 0 10px;background:var(--card2);border:1px solid var(--border);border-radius:12px}
.dl-row.off{opacity:.55}
.dl-grip{color:var(--text3);font-size:18px;width:20px}
.dl-nm{flex:1;font-size:15px;color:var(--text)}
.dl-sub{display:block;font-size:12px;color:var(--text3)}
.dl-btn{min-width:44px;min-height:44px;background:none;border:none;color:var(--text2);font-size:16px;cursor:pointer;border-radius:10px}
.dl-btn:disabled{opacity:.25;cursor:default}
.dl-btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
```
Tah využije existující `.lp-drag-lift`, `.lp-drag-shift` a `.lp-drag-on`.

**Okrajové případy:**
- *Offline:* `updateDoc` se zařadí do fronty SDK a lokálně se změna projeví hned. Při chybě toast `common.saveFailed` a lokální stav zůstane.
- *Dvě zařízení:* vyhrává poslední zápis celého objektu, což u pořadí stačí. Profil se nenačítá živě, takže druhé zařízení změnu uvidí po dalším spuštění appky.
- *Neznámá a duplicitní id:* viz bod 3 (přeskočit, zachovat, odstranit duplicity).
- *Všechno schované:* místo prázdna se ukáže karta `dash.edit.allHidden` a tlačítko ✏️ dole zůstane.
- *Překreslení během editoru* (snapshot dat): editor má vlastní seznam a `enableDragReorder` se po každém renderu volá znovu (je to bezpečné, stávající příznak brání zdvojení).
- *Rozepsaný text v kartě „Co teď“:* zůstává v pevném pásmu, stávající obnova `#ct-inp` funguje dál.

**Verze:** `APP_VERSION` 4.86, `CHANGELOG` („Domů si teď můžeš uspořádat po svém: ✏️ Upravit Domů úplně dole.“), bump `CACHE` v `sw.js`. Pravidla Firestore beze změny.
