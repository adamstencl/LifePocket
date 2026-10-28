# Návrh: modul 🐾 Mazlíček (mobil 390×844, všechna témata)

Zadání (uživatelé): sekce pro kočku, psa a další zvířata s kartou info (jméno, druh, plemeno, narození, váha, čip, kontakt na veterinu, alergie, poznámky); veterina v kalendáři (očkování, odčervení, antiparazitika) s opakováním a připomínkou; výpočet, kdy dojdou granule, upozornění X dní předem a tlačítko „Přidat do nákupu“; checklist na cestu (vlak, auto, túra) z předpřipravených šablon podle druhu zvířete. Rodina má společného psa → sdílení ve skupině.

Výchozí stav: verze 4.93 (HEAD 0997e41), MVP cílí na 4.94. Čísla řádků jsou orientační, koder ať místa hledá grepem podle názvu funkce nebo ID. `app.js` jsem neměnil.

---

## 0. Co jsem v kódu zjistil (rozhoduje o návrhu)

| Zjištění | Místo | Důsledek pro Mazlíčka |
|---|---|---|
| Registr modulů je pole `MODS` (`{id, emoji}`), název a popis přes i18n `mod.<id>` a `mod.<id>.desc` | app.js ~1031, `modName/modDesc` ~1584 | Stačí přidat `{id:'pets',emoji:'🐾'}` a klíče. Onboarding mřížka (`rMods`), Nastavení (`rSetMods`) i panel Více (`renderBnMore`) ho pak ukážou samy. |
| Lišta ukazuje jen moduly v `hasUI` | `buildNav` ~16721 | `'pets'` do `hasUI`. |
| Panel Více řadí vypnuté moduly do kategorií `MORE_CATS` | ~16750 | `'pets'` do kategorie `home`. |
| Listenery se zapínají jen pro zapnuté moduly v `subModules()` | ~16699 | Přidat `if(on('pets')) subPets();`. |
| Přepínání stránek `sp(id)` | ~16819 | `if(id==='pets') renderPets();` |
| Domů: `DASH_CARDS` + `dashEditAvail()` + sběr do `mw` v `rDash` | ~17034, ~17225 | Nová karta `pets`, výchozí větev `dashEditAvail` (`mods.includes(id)`) funguje bez úprav. |
| Průvodce: `TOUR_MODULES` z pole id, texty `tour.<id>.t/x` | ~21654 | Přidat `'pets'`, krok se ukáže jen se zapnutým modulem a existující `#p-pets`. |
| Kalendář: typy `EV_ICONS/EV_LABELS` (`birthday`, `event`) + vlastní `c_…`; opakování umí jen „každý rok“ (`repeat:'yes'`) | ~3980, `getEventsForDate` ~4049 | Měsíční / čtvrtletní opakování kalendář **neumí**. Řešíme to tak, že plán péče drží mazlíček a v kalendáři je vždy jen **nejbližší termín** (zrcadlo). Po „Hotovo“ se termín posune. |
| Server posílá upozornění na událost s časem **hodinu předem** pro všechny typy kromě narozenin, osobní i skupinové (`shareCal`) | functions/index.js ~1565 | Typ `vet` s časem má připomínku hned, bez úprav serveru. Na „den předem“ a „ráno v den“ je potřeba malé rozšíření stávajícího cronu (§6). |
| Starší klient zobrazí neznámý typ přes `typeLabel/typeEmoji` uložené v události | `getEvLabel` ~3986 | Události `vet` ukládat i s `typeLabel` a `typeEmoji`, aby je viděli i členové se starší verzí. |
| `saveEventImpl` při úpravě maže `typeLabel/typeEmoji` u typů bez `c_` | ~4754 | Výjimku pro `vet` musí koder doplnit, nebo úpravu `vet` z kalendáře přesměrovat do Mazlíčka (doporučuji, §5.3). |
| Checklisty: `users/{uid}/checklists/{id}` = `{id, name, items:[{id,text,done}], shared, createdAt}`, sdílení po seznamech do skupin (`shareChecklistTo`) | ~16259, ~11407 | **Šablony checklistů v kódu nejsou**, je jen výchozí prázdný seznam. Šablony na cestu proto vzniknou v modulu Mazlíček a vytvoří běžný checklist. |
| Nákup: `addShopEntry({name, category, qty})` zapisuje do právě zobrazeného seznamu (`shopGid()`) a sám loguje aktivitu skupiny | ~19380 | Pro sdíleného psa chceme seznam jeho skupiny → `addShopEntry` dostane nepovinné `gid` (§5.5). |
| Kategorie nákupu jsou pevné (`SHOP_CATS`, poslední Ostatní) | ~19208 | Granule jdou do „Ostatní“. Kategorie „Mazlíčci“ až později. |
| Pravidla: `families/{id}/{subcollection}/{docId}` smí číst a psát každý člen, kromě `activity/shared/reactions/challenges` | firestore.rules ~128 | `families/{gid}/pets/{petId}` funguje **bez změny pravidel**, ale jen o **jednu úroveň** hluboko. Historie péče musí být v dokumentu mazlíčka, ne v podkolekci. |
| Aktivita skupiny povoluje jen `module` z výčtu (`shop, cal, check, …`) | firestore.rules ~141 | Žádné `module:'pet'`. Logujeme jako `cal` (péče), `shop` (granule), `check` (cesta). |
| Běžný člen smí v dokumentu skupiny měnit jen `groupName, shareShop, shareCal, shareMeal, shareChecklist, members` | firestore.rules `isFamilyMemberUpdate` | **Žádný nový přepínač `sharePets`.** Sdílí se po jednotlivých mazlíčcích, stejně jako checklisty. |
| `rotateGroupCode` kopíruje všechny podkolekce přes `listCollections()` | functions/index.js ~1899 | `pets` se při změně kódu přesune bez úprav. |
| `deleteAccount` maže `users/{uid}` rekurzivně | functions | `users/{uid}/pets` se smaže sám. Do exportu dat (`exp.col` ~5041) ale `pets` přidat. |
| Při odchodu ze skupiny `copyGroupToPersonal` kopíruje události, nákupy a checklisty | ~10159 | Doplnit kopii mazlíčků, jinak by odcházející člen přišel o kartu psa (§5.7). |
| Otevření z notifikace: SW pouští jen `open` z výčtu `habit, habits, cal, water` | sw.js ~214, `consumePendingOpen` ~15399 | Pro `open:'pets'` doplnit výčet v SW a větev v `consumePendingOpen` (+ bump `CACHE`). |
| Nabídky z fronty (`NUDGES`, např. sdílený checklist ve skupině) | ~16928 | Vzor pro nabídku „Ve skupině je sdílený mazlíček“ (fáze 2). |

---

## 1. Rozsah MVP (jedna verze, jeden koder)

**MVP (verze 4.94, odhad 900–1100 řádků JS, ~200 CSS, ~120 klíčů i18n na jazyk, ~40 řádků v cronu):**

1. Modul `pets` v registru, liště, Více, Nastavení, onboardingu, průvodci, cs/en.
2. Více mazlíčků: přidat, upravit, smazat, karta s info (všechna pole ze zadání), tlačítko Zavolat veterináři.
3. Plán péče: očkování, odčervení, klíšťata a blechy, prohlídka, jiné; opakování (měsíc / 3 měsíce / rok / vlastní); „Hotovo“ posune termín; historie (posledních 30 záznamů).
4. Zrcadlo péče v kalendáři: typ `vet` (🩺 Veterina) s `petId`, připomínka hodinu předem (už funguje), ráno v den / den předem (rozšíření cronu).
5. Granule: balení, denní dávka, kdy dojdou, upozornění X dní předem (Domů + push ráno), „Přidat do nákupu“, „Otevřel/a jsem nové balení“.
6. Na cestu: 3 šablony (vlak, auto, túra) × druh (pes, kočka, jiné) → nový checklist.
7. Sdílení mazlíčka do skupiny (přesun do `families/{gid}/pets`), události péče do kalendáře skupiny, kopie při odchodu ze skupiny.
8. Karta na Domů (`pets`) a řádek v kontextu parťáka (`buildChatContext`).

**Později (fáze 2+):** viz §9.

---

## 2. Datový model

### 2.1 Mazlíček: `users/{uid}/pets/{petId}` nebo `families/{gid}/pets/{petId}`

Stejný tvar na obou místech. Mazlíček leží **buď** u mě, **nebo** ve skupině (sdílení = přesun, žádné dvě kopie jako u checklistů 4.53; jednodušší a bez slučování).

```js
{
  name: 'Bára',                 // 1–40 znaků, povinné
  kind: 'dog',                  // 'dog' | 'cat' | 'other'
  emoji: '🐕',                  // u 'other' z nabídky (🐇 🐹 🐦 🐠 🐢 🦎 🐾), max 4 znaky
  breed: 'Labrador',            // ≤ 60
  sex: 'f',                     // 'f' | 'm' | '' (nepovinné, kvůli textům „ji/ho“ jen v UI)
  birth: '2021-06-14',          // 'YYYY-MM-DD' nebo '' (stačí i odhad, UI nabídne jen rok a měsíc → den 01)
  weight: 28.4,                 // kg, číslo 0.05–150, nebo null
  weightAt: '2026-10-20',       // kdy zváženo
  chip: '203098100123456',      // ≤ 20 znaků (číslice), bez validace délky (staré čipy mají 10 znaků)
  vet: { name: 'MVDr. Nováková', phone: '+420 777 123 456', addr: 'Lipová 12, Brno' }, // každé ≤ 80
  allergies: 'kuřecí maso',     // ≤ 200
  notes: 'Bojí se bouřky.',     // ≤ 1000
  care: {                       // MAPA podle id (ne pole): úprava jedné položky = updateDoc('care.<id>.next', …) bez transakce
    'c8f2k1': { kind:'vacc', name:'Očkování', every:{n:1,u:'y'}, next:'2026-12-03', time:'16:30', remind:'day1', last:'2025-12-03' },
    'q1z9d0': { kind:'worm', name:'Odčervení', every:{n:3,u:'m'}, next:'2026-11-20', time:null, remind:'day0', last:'2026-08-20' }
  },
  log: [                        // historie, arrayUnion; ořez na 30 při zápisu „Hotovo“ (nejstarší pryč)
    { id:'l1', d:'2026-08-20', kind:'worm', name:'Odčervení', by:'uid…' }
  ],
  food: {                       // null = granule nesleduji
    name: 'Granule Brit Adult',  // ≤ 60, výchozí „Granule“
    packKg: 12,                  // 0.1–50
    dailyG: 320,                 // 1–5000
    openedAt: '2026-10-10',      // od kdy se jí z aktuálního balení
    spare: 0,                    // neotevřená balení navíc (0–20)
    warnDays: 5,                 // 1–30, výchozí 5
    inShopAt: null               // 'YYYY-MM-DD', kdy bylo přidáno do nákupu (tlačítko pak ukáže ✓)
  },
  owner: 'uid…',                // kdo mazlíčka založil (mazání a vrácení ze skupiny)
  order: 0, createdAt: 1730000000000, updatedAt: 1730000000000
}
```

Pozn.:
- `care` jako mapa: dva členové rodiny mohou souběžně odškrtnout odčervení a změnit granule bez přepsání (field path update). Pole objektů by vyžadovalo transakci jako u checklistů.
- `every.u`: `'d' | 'w' | 'm' | 'y'`, `n` 1–60; `every:null` = jednorázově (po Hotovo se položka smaže z plánu a zůstane v historii).
- `remind`: `'day1'` (ráno den předem), `'day0'` (ráno v den), `'none'`. Výchozí: prohlídka a očkování `day1`, odčervení a antiparazitika `day0`.
- Výpočet měsíců: `addMonths` s ořezem na konec měsíce (31. 1. + 1 měsíc = 28./29. 2.), datum vždy přes `toDS()` (lokální čas).
- Fotka mazlíčka není v MVP (velikost dokumentu, komprese); avatar je emoji.

### 2.2 Zrcadlo v kalendáři: `…/events/pet_{petId}_{careId}` a `…/events/pet_{petId}_food`

ID je **deterministické**, takže zápis je idempotentní, při přesunu do skupiny i zpět jde smazat bez ukládání `evId`, a dvě zařízení nevytvoří duplicitu.

```js
{
  name: 'Odčervení – Bára',     // bez emoji, ikona jde z typu
  date: '2026-11-20', repeat: 'no', type: 'vet',
  time: '16:30',                // jen pokud je u péče čas → server pošle připomínku hodinu předem (stávající cron)
  typeLabel: 'Veterina', typeEmoji: '🪱',   // pro starší klienty a pro getEvIcon (§5.3)
  petId: 'p7…', care: 'worm', careId: 'q1z9d0',   // care:'food' u granulí
  remind: 'day0',               // čte rozšíření cronu (§6)
  addedBy: 'uid…', createdAt: '…ISO…'
}
```

Kam se zapisuje:
- mazlíček u mě → `users/{uid}/events/…`
- mazlíček ve skupině → `families/{gid}/events/…`. Do skupiny jde mazlíček sdílet **jen tehdy, když skupina sdílí kalendář** (`groupModShared(gid,'cal')`), jinak by se připomínky ztratily. U skupiny bez kalendáře list sdílení řekne proč (§4.6).

Granule jako událost: datum = `dojde − warnDays`, `care:'food'`, `remind:'day0'`, bez času. V kalendáři: „🥣 Koupit granule – Bára“.

### 2.3 Firestore pravidla: **beze změny** ✅

| Cesta | Pravidlo | OK |
|---|---|---|
| `users/{uid}/pets/{petId}` | `users/{userId}/{document=**}` jen vlastník | ✅ |
| `users/{uid}/events/pet_…` | dtto | ✅ |
| `families/{gid}/pets/{petId}` | `families/{familyId}/{subcollection}/{docId}`, `pets` není ve výjimkách → člen čte i píše | ✅ (jen 1 úroveň; žádné `pets/{id}/log/{x}`) |
| `families/{gid}/events/pet_…` | dtto, už se používá | ✅ |
| `families/{gid}/checklists/{id}` | dtto | ✅ |
| `families/{gid}/activity` | `module` jen z výčtu | ✅ pokud logujeme jako `cal / shop / check`, **nikdy `pet`** |
| `families/{gid}` (dokument) | člen nesmí přidat nové pole | ✅ žádné `sharePets` |
| profil | žádné nové pole v MVP | ✅ |

Riziko, které pravidla nepokryjí: smazat mazlíčka ve skupině smí podle pravidel každý člen (stejně jako u nákupů a checklistů). Klient smazání ukáže jen vlastníkovi (`owner`) a správci skupiny.

### 2.4 Server (Cloud Functions): **žádná nová funkce**

- `sendScheduledNotifications`: přidat ranní upozornění pro `type=='vet'` (§6). Je to úprava existující funkce, nasadí se sama po push (GitHub Actions).
- `rotateGroupCode`, `deleteAccount`: beze změny (obecné kopírování a rekurzivní mazání).
- `functions/i18n-server.js`: 4 nové klíče cs/en.

---

## 3. Navigace a vstupní místa

| Místo | Co se ukáže |
|---|---|
| Spodní lišta / Více | 🐾 Mazlíček (kategorie „Domácnost“ mezi vypnutými moduly) |
| Nastavení → Moduly | řádek „🐾 Mazlíček – Očkování, odčervení, granule a sbalení na cestu.“ |
| Onboarding (mřížka „Vyberu si moduly sám/a“) | ve „Více modulů“ automaticky z `MODS` |
| Domů | karta 🐾 Mazlíčci (jen s modulem a aspoň jedním zvířetem) |
| Kalendář | události 🩺/💉/🪱/🛡️/🥣, klepnutí vede do Mazlíčka |
| Parťák | ví, kdy je očkování a kdy dojdou granule |
| Notifikace | „🩺 Zítra: Očkování – Bára“, „🥣 Bára: granule docházejí“ |

---

## 4. Obrazovky (390 px)

Všechny prvky používají existující tokeny (`--card`, `--card2`, `--border2`, `--text*`, `--accent`, `--green`, `--red`) a komponenty (`.dw`, `.modal`, `.mtitle`, `.fg/.flbl/.finp`, `.macts`, `.btn-p/.btn-s`, `.seg-btn`). Nové třídy mají prefix `pet-`.

### 4.1 Prázdný stav (žádný mazlíček)

```
┌──────────────────────────────────────┐
│ 🐾 Mazlíček                          │  hlavička jako u ostatních modulů (.ptitle)
│                                      │
│               🐾                     │  64 px
│     Přidej svého mazlíčka            │  Playfair 22 px
│  Pohlídám očkování, odčervení        │  text2, 15 px, max 2 řádky
│  i to, kdy dojdou granule.           │
│                                      │
│  ┌──────────┐┌──────────┐┌──────────┐│  3 dlaždice 1/3 šířky, výška 88 px
│  │    🐕    ││    🐈    ││    🐾    ││  emoji 32 px, popisek 15 px tučně
│  │   Pes    ││  Kočka   ││  Jiné    ││
│  └──────────┘└──────────┘└──────────┘│
└──────────────────────────────────────┘
```
Klepnutí na dlaždici otevře formulář (§4.3) s předvybraným druhem.

### 4.2 Detail mazlíčka `#p-pets`

```
┌──────────────────────────────────────┐
│ 🐾 Mazlíček                     [＋] │  ＋ 44×44 = přidat dalšího
│ [🐕 Bára] [🐈 Mourek]                │  přepínač: pilulky 44 px, vodorovný scroll; jen při 2+ zvířatech
├──────────────────────────────────────┤
│ ╭────╮ Bára                    [✏️]  │  avatar 56 px (kruh, --card2), jméno Playfair 24 px, ✏️ 44×44
│ │ 🐕 │ Pes · labrador · 5 let        │  text2 15 px; věk z birth (tN: rok/roky/let, u mláďat měsíce)
│ ╰────╯ 28,4 kg · 🏠 Rodina           │  štítek skupiny jen u sdíleného
│ ⚠️ Alergie: kuřecí maso              │  řádek jen s vyplněnou alergií (pozadí --card2, levý okraj --red 3 px)
│ [ 📞 Zavolat veterináři ]            │  .btn-s plná šířka 48 px, tel: odkaz; bez telefonu se neukáže
├──────────────────────────────────────┤
│ PÉČE                                 │  .dw-title
│ 🪱 Odčervení              [✓ Hotovo] │  řádek 56 px; Hotovo 44 px výška, min. 88 px šířka
│    za 3 dny · 20. 11. · co 3 měsíce  │  stav barevnou tečkou + textem (ne jen barvou)
│ 💉 Očkování                [✓ Hotovo]│
│    3. 12. v 16:30 · každý rok        │
│ 🛡️ Klíšťata a blechy      [✓ Hotovo] │
│    ● dnes · každý měsíc              │  dnes / po termínu = červená tečka + tučně
│ [ ＋ Naplánovat péči ]               │  .btn-s, 48 px
├──────────────────────────────────────┤
│ GRANULE                              │
│ Brit Adult · 12 kg · 320 g denně     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  vystačí do 21. 11.│ pruh 8 px: zbytek aktuálního balení
│ Ještě asi 24 dní                     │  15 px tučně; při ≤ warnDays „Dochází! Ještě 4 dny“
│ [🛒 Přidat do nákupu] [📦 Nové balení]│  2 tlačítka vedle sebe 48 px; „Přidat“ je .btn-p jen při docházení
│ Upozornit 5 dní předem ›             │  řádek 44 px → nastavení granulí
├──────────────────────────────────────┤
│ NA CESTU                             │
│ ┌──────────┐┌──────────┐┌──────────┐ │  3 dlaždice 1/3 šířky, výška 76 px
│ │   🚆     ││   🚗     ││   🥾     │ │
│ │  Vlak    ││  Auto    ││  Túra    │ │
│ └──────────┘└──────────┘└──────────┘ │
├──────────────────────────────────────┤
│ ▸ Údaje a veterina                   │  <details>, zavřené; uvnitř čip (📋 kopírovat 44×44),
│ ▸ Historie péče                      │  veterina (jméno, telefon, adresa → odkaz do map), poznámky
│ [⇄ Sdílet se skupinou]               │  text tlačítko 44 px; u sdíleného „Sdíleno: 🏠 Rodina · Vzít zpět jen ke mně“
└──────────────────────────────────────┘
```

Proč takhle: nahoře je to, co člověk dělá nejčastěji (Hotovo, Přidat do nákupu), dole to, co jen čte (údaje). Telefon na veterinu je vidět hned, protože ho člověk hledá ve stresu. Akční tlačítka jsou vpravo pod palcem.

Stavy péče (text i barva, aby šlo rozlišit i bez barev):

| Stav | Podmínka | Text | Tečka |
|---|---|---|---|
| po termínu | `next < dnes` | „● po termínu (2 dny)“ tučně | `--red` |
| dnes / zítra | 0–1 den | „● dnes“, „● zítra“ tučně | `--red` / `--pet-warn` |
| brzy | 2–7 dní | „za 3 dny · 20. 11.“ | `--pet-warn` |
| v pořádku | > 7 dní | „20. 11. · co 3 měsíce“ | `--green` |

**„Hotovo“** otevře malý list (ne modal přes celou obrazovku):
```
┌──────────────────────────────────────┐
│ 🪱 Odčervení – Bára                  │
│ Kdy? [ Dnes ▾ ]                      │  date input, výchozí dnes (u Hotovo po termínu taky dnes)
│ Příště: 20. 2. 2027 (za 3 měsíce)    │  živě se přepočítá z data
│ [Zpět]                [✓ Uložit]     │
└──────────────────────────────────────┘
```
Po uložení: záznam do `log`, `last = kdy`, `next = kdy + every`, zrcadlo v kalendáři se přepíše na nový termín, toast „✓ Odčervení zapsáno. Příště 20. 2.“, `navigator.vibrate?.(12)`.

### 4.3 Formulář mazlíčka (modal `#m-pet`)

```
┌──────────────────────────────────────┐
│ 🐕 Nový mazlíček                     │  .mtitle
│ [🐕 Pes] [🐈 Kočka] [🐾 Jiné]        │  .seg-btn, 44 px
│   (u Jiné: řádek emoji 🐇🐹🐦🐠🐢🦎🐾, 44×44)
│ Jméno *        [Bára              ]  │  autofocus, enterkeyhint="next"
│ Plemeno        [Labrador          ]  │
│ Narození       [14. 6. 2021       ]  │  type=date; pod tím „Nevíš přesně? Stačí odhad.“
│ Váha (kg)      [28,4              ]  │  inputmode=decimal, čárka i tečka
│ Číslo čipu     [203098100123456   ]  │  inputmode=numeric
│ ── Veterina ──                       │  .flbl jako mezititulek
│ Název          [MVDr. Nováková    ]  │
│ Telefon        [+420 777 123 456  ]  │  type=tel
│ Adresa         [Lipová 12, Brno   ]  │
│ ── Zdraví ──                         │
│ Alergie        [kuřecí maso       ]  │
│ Poznámky       [                  ]  │  textarea 3 řádky
│ [Zrušit]            [Uložit]         │  .macts; na mobilu pod sebou (stávající media query)
│ 🗑️ Smazat mazlíčka                   │  jen u úpravy a jen vlastník/správce; potvrzení confirm()
└──────────────────────────────────────┘
```
Povinné je jen jméno. Po prvním uložení se rovnou otevře **„Naplánujeme péči?“** (§4.4).

### 4.4 Plán péče po založení (sheet `#m-petplan`)

```
┌──────────────────────────────────────┐
│ Naplánujeme Báře péči?               │
│ Vyplň, kdy má být příště. Řiď se     │  text2 14 px
│ doporučením svého veterináře.        │
│ ☑ 💉 Očkování · každý rok            │  řádek 56 px, checkbox 24 px v ploše 44×44
│     Příště [            ]            │  date; prázdné datum = položka se neuloží
│ ☑ 🪱 Odčervení · co 3 měsíce         │
│     Příště [            ]            │
│ ☑ 🛡️ Klíšťata a blechy · každý měsíc │
│     Příště [            ]            │
│ ☐ 🥣 Sledovat granule                │  zaškrtnutí rozbalí 2 pole: balení (kg), denní dávka (g)
│ [Teď ne]          [Uložit plán]      │
└──────────────────────────────────────┘
```

Výchozí sady (`PET_CARE_PRESETS`):

| Druh | Péče |
|---|---|
| pes | 💉 Očkování (každý rok), 🪱 Odčervení (co 3 měsíce), 🛡️ Klíšťata a blechy (každý měsíc) |
| kočka | 💉 Očkování (každý rok), 🪱 Odčervení (co 3 měsíce), 🛡️ Blechy (každý měsíc) |
| jiné | 🩺 Prohlídka (každý rok) |

### 4.5 Péče: přidat / upravit (modal `#m-petcare`)

```
│ Co?   [💉 Očkování][🪱 Odčervení][🛡️ Klíšťata a blechy][🩺 Prohlídka][✏️ Jiné]  │ chips, zalamují se
│ Název        [Očkování – vzteklina   ]  │ předvyplní se z typu
│ Příště *     [3. 12. 2026            ]  │
│ Čas          [16:30                  ]  │ nepovinné, „Připomenu se hodinu předem.“ (stávající time picker)
│ Opakovat     [Ne][Měsíc][3 měsíce][Rok][Jinak…] │ seg; Jinak = číslo + jednotka (dny/týdny/měsíce/roky)
│ Připomenout  [Den předem][Ráno v den][Ne]       │ seg
│ [Smazat]  [Zrušit]  [Uložit]                     │
```

### 4.6 Sdílení se skupinou (list `openGrpChoiceSheet`)

- Ve výběru jen skupiny se sdíleným kalendářem. Je-li jich víc, stávající `openGrpChoiceSheet`; jedna skupina rovnou.
- Žádná vhodná skupina: toast „Mazlíčka můžeš sdílet ve skupině, která sdílí kalendář. Zapni ho v Nastavení → Skupiny.“
- Potvrzení přesunu: „Bára bude ve skupině 🏠 Rodina. Uvidí ji a upraví všichni členové, kteří mají zapnutého Mazlíčka.“
- Toast po přesunu: „🐕 Bára je teď ve skupině 🏠 Rodina“.
- Vrátit jen ke mně (vlastník nebo správce): „Bára zmizí ostatním ve skupině 🏠 Rodina. Pokračovat?“

### 4.7 Na cestu (šablony → checklist)

Klepnutí na 🚆 Vlak vytvoří osobní checklist „🚆 Vlak – Bára“ s položkami podle druhu, otevře Checklist (`activeChecklist = id; sp('checklist')`) a ukáže toast „Seznam je připravený. Uprav si ho podle sebe.“ Je-li mazlíček ve skupině, která sdílí checklisty, seznam se rovnou sdílí do ní (`shareChecklistTo`). Když modul Checklist není zapnutý, zapne se stejně jako z panelu Více (`bnmOn('checklist')` / `nudgeModOn`).

Šablony (`PET_PACK_TPLS`, texty v i18n `pet.pack.<trip>.<kind>.<n>`):

| | 🐕 Pes | 🐈 Kočka | 🐾 Jiné |
|---|---|---|---|
| **🚆 Vlak** | Náhubek (ve vlaku povinný) · Vodítko · Jízdenka pro psa · Očkovací průkaz / pas · Voda a skládací miska · Pamlsky · Sáčky na hovínka · Deka nebo podložka · Ručník | Přepravka · Absorpční podložka do přepravky · Náhradní podložka a sáčky · Očkovací průkaz / pas · Voda a miska · Pamlsky · Deka s vůní domova · Postroj s vodítkem | Přepravka nebo klec · Podložka / stelivo · Voda a krmení na cestu · Deka přes přepravku · Doklady (je-li potřeba) |
| **🚗 Auto** | Bezpečnostní postroj s pásem nebo přepravní box · Voda a miska · Deka do kufru · Pamlsky · Sáčky na hovínka · Ručník · Lék na nevolnost (bere-li ho) · Pauza každé 2 hodiny | Přepravka připoutaná pásem · Podložka do přepravky · Malý záchodek a stelivo (delší cesta) · Voda a miska · Deka s vůní domova · Lék na nevolnost (bere-li ho) | Přepravka připoutaná pásem · Voda a krmení · Stín, nenechávat v autě samotné |
| **🥾 Túra** | Voda a skládací miska · Pamlsky · Sáčky na hovínka · Vodítko · Pinzeta na klíšťata · Obvaz a dezinfekce · Reflexní obojek nebo světýlko · Ručník | Postroj s vodítkem · Batoh nebo přepravka · Voda a miska · Pamlsky · Pinzeta na klíšťata | Přepravka nebo batoh · Voda · Krmení |

Společná položka k vlaku a autu u psa i kočky: „Pas zvířete (jedeš-li do zahraničí)“.

### 4.8 Karta na Domů (`pets`)

```
┌──────────────────────────────────────┐
│ 🐾 MAZLÍČCI                       →  │  .dw, celá karta → sp('pets')
│ 🐕 Bára · 🪱 Odčervení zítra         │  max. 3 řádky, seřazené podle naléhavosti
│ 🐈 Mourek · 🥣 granule na 4 dny [🛒] │  🛒 44×44, stopPropagation → Přidat do nákupu
│ 🐕 Bára · 💉 Očkování 3. 12.          │
└──────────────────────────────────────┘
```
Bez ničeho do 14 dní: jeden řádek „✓ Vše v pořádku · další: 💉 Očkování 3. 12.“. Karta se nevykreslí, když nejsou mazlíčci (v editoru Domů ale je, protože `dashEditAvail` jde podle modulu).

### 4.9 CSS (nové, v duchu stávajících; tokeny pro všechna 3 témata)

```css
/* Varovná barva s kontrastem ≥ 4,5:1 na --card ve všech tématech (--accent2 na sunshine nestačí) */
:root,[data-theme="dark-gold"]{--pet-warn:#f0a050}
[data-theme="sunshine"]{--pet-warn:#9a4a10}
[data-theme="tangerine"]{--pet-warn:#963400}

.pet-switch{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}
.pet-pill{flex-shrink:0;min-height:44px;padding:0 16px;border-radius:22px;border:1.5px solid var(--border2);background:var(--card);color:var(--text);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.pet-pill[aria-current="true"]{border-color:var(--accent);background:var(--card2)}
.pet-hero{display:flex;gap:14px;align-items:center}
.pet-av{width:56px;height:56px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:30px;flex-shrink:0}
.pet-name{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--text)}
.pet-sub{font-size:15px;color:var(--text2)}
.pet-allergy{margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--card2);border-left:3px solid var(--red);font-size:15px;color:var(--text)}
.pet-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 0;border-bottom:1px solid var(--border)}
.pet-row:last-child{border-bottom:none}
.pet-row-em{font-size:24px;width:32px;text-align:center}
.pet-row-main{flex:1;min-width:0}
.pet-row-n{font-size:16px;font-weight:600;color:var(--text)}
.pet-row-d{font-size:14px;color:var(--text2)}
.pet-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
.pet-due--late .pet-dot,.pet-due--now .pet-dot{background:var(--red)}
.pet-due--soon .pet-dot{background:var(--pet-warn)}
.pet-due--ok .pet-dot{background:var(--green)}
.pet-due--late .pet-row-d,.pet-due--now .pet-row-d{color:var(--text);font-weight:700}
.pet-done{min-height:44px;min-width:88px;border-radius:12px;border:1.5px solid var(--green);background:transparent;color:var(--text);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.pet-done:active{transform:scale(.96)}
.pet-food-bar{height:8px;border-radius:4px;background:var(--card2);overflow:hidden;margin:8px 0}
.pet-food-fill{height:100%;background:var(--green);transition:width .4s}
.pet-food--warn .pet-food-fill{background:var(--pet-warn)}
.pet-food--out .pet-food-fill{background:var(--red)}
.pet-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pet-tile{min-height:76px;border-radius:14px;border:1.5px solid var(--border2);background:var(--card);color:var(--text);font:inherit;font-size:15px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}
.pet-tile .em{font-size:28px;line-height:1}
.pet-tile:focus-visible,.pet-pill:focus-visible,.pet-done:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pet-food-fill{transition:none}.pet-done:active{transform:none}}
```

Před/po: stávající styly se nemění, jen přibývají třídy `pet-*` a token `--pet-warn`.

---

## 5. Napojení v app.js (konkrétní místa)

### 5.1 Registr a navigace
| Místo | Změna |
|---|---|
| `MODS` ~1031 | `{id:'pets',emoji:'🐾'}` za `checklist` |
| `buildNav` → `hasUI` ~16721 | přidat `'pets'` |
| `MORE_CATS` ~16750 | `home: ['shopping','mealplan','cooking','checklist','pets']` |
| `subModules()` ~16699 | `if(on('pets')) subPets();` |
| `window.sp` ~16819 | `if(id==='pets') renderPets();` |
| `TOUR_MODULES` ~21654 | přidat `'pets'` do pole |
| `ONB_*` | beze změny (modul je v „Více modulů“); otázka „Mazlíček“ ve startu až ve fázi 2 |
| `index.html` | `<div class="page" id="p-pets">` (vedle `#p-checklist` ~993), modaly `#m-pet`, `#m-petcare` (vzor `#m-event` ~1531) |
| `exp.col` ~5041 | přidat `'pets'` + klíč `exp.col.pets` |
| `LOCAL_PERSONAL_KEYS` ~1722 | `lp_pet_sel` (naposledy otevřený mazlíček), je-li použit |

### 5.2 Data a listenery (nový blok `// ── MAZLÍČEK (4.94) ──`)
- `subPets()`: `createFireSub('pets', collection(db,'users',CU.uid,'pets'), …)` + pro každou `myGroupIds()` listener `families/{gid}/pets` podle vzoru `subscribeGroupChecklist` (`petGrp[gid] = {pets, ready, unsub, err}`, `grpSubBlocked`, `familyListenErr`). Odhlášení při odchodu ze skupiny / odhlášení stejně jako `unsubAllGroupChecks`.
- `allPets()` = osobní + skupinové (`_gid`), řazení podle `order`, pak `createdAt`.
- Zápis: `petRef(p)` → `doc(db,'users',uid,'pets',id)` nebo `doc(db,'families',p._gid,'pets',id)`. Bez `await` (offline), chyba toastem `userErr`, jako jinde.
- Péče: `updateDoc(ref, {['care.'+cid]: {...}, updatedAt})`; Hotovo: `updateDoc(ref, {['care.'+cid+'.last']:d, ['care.'+cid+'.next']:nx, log: arrayUnion(entry), updatedAt})`; ořez logu na 30 jen u vlastních dat jednou za čas (nekritické).
- Granule: `updateDoc(ref, {'food.openedAt':…, 'food.spare':…})`.

### 5.3 Kalendář
| Místo | Změna |
|---|---|
| `EV_ICONS / EV_LABELS` ~3980 | `vet:'🩺'`, `vet:'cal.type.vet'` |
| `getEvIcon` | pro `type==='vet'` vrátit `ev.typeEmoji` (💉/🪱/🛡️/🥣), jinak 🩺 |
| `getEvLabel` | `vet` + `ev.care==='food'` → `t('pet.title')` („Mazlíček“), jinak „Veterina“ |
| `openEditEvent` ~4598 | na začátku: `if(ev.type==='vet'&&ev.petId){ openPetFromEvent(ev); return; }` → otevře Mazlíčka a péči `#m-petcare` (zdroj pravdy je mazlíček, ne událost) |
| `delEvent` ~4782 | u `vet` s `petId`: confirm „Smazat i z plánu péče Báry?“ → smaže položku `care` (granule: `food=null`) i událost |
| `saveEventImpl` ~4754 | větev úpravy `vet` se díky přesměrování nespustí; pro jistotu `else if(!startsWith('c_') && type!=='vet')` u mazání `typeLabel` |
| `showDayEventsModal` ~4549, `renderEvList` ~4082 | beze změny (ikona a popisek přes getEvIcon/Label); volitelně řádek „🐾 Otevřít u mazlíčka“ |
| Typová tlačítka v `#m-event` | **nepřidávat** `vet` (událost veteriny vzniká jen u mazlíčka; jinak by chyběl `petId`) |

`petEvSync(pet, cid)` (jedna funkce pro péči i granule, `cid==='food'`):
1. cesta = `pet._gid ? families/{gid}/events : users/{uid}/events`, id `pet_{petId}_{cid}`;
2. bez termínu (`care` smazána, `every:null` po Hotovo, `food:null`) → `deleteDoc`;
3. jinak `setDoc(…, ev, {merge:true})` a bez času `time: deleteField()`;
4. aktivita jen u skupiny a jen při založení nebo Hotovo: `logGroupActivity(gid,'cal','add'|'done'?…)` — pozor, `done` u `cal` pravidla povolují (výčet akcí je společný), ale feed ho pro `cal` možná neumí vykreslit; jistější je `add` s novým termínem.

### 5.4 Domů
| Místo | Změna |
|---|---|
| `DASH_CARDS` ~17034 | `{id:'pets',em:'🐾'}` za `shopping` |
| `dashEditAvail` | beze změny (default `mods.includes(id)`) |
| `rDash` | `if(mods.includes('pets')&&allPets().length) mw.pets=petsWidgetHTML();` u ostatních karet modulů |
| i18n | `dash.card.pets` |
| `DASH_MODCARDS` | nepřidávat (jen pro pořadí v jednoduchém režimu; nová karta se zařadí sama podle `dashMerged`) |

### 5.5 Nákupy
- `addShopEntry({name, category, qty, gid})`: nepovinné `gid` má přednost před `shopGid()`; `undefined` = jako dnes. Malá změna, jen tento parametr.
- `petAddFood(pet)`: `gid = pet._gid && groupModShared(pet._gid,'shop') ? pet._gid : null`; název `food.name || t('pet.food.def')`, `qty` = `'1× ' + fmtKg(packKg)`, kategorie `'Ostatní'`. Kontrola duplicity: když v cílovém seznamu už je nekoupená položka se stejným názvem, jen toast „Granule už v nákupu jsou“. Potom `food.inShopAt = dnes`.
- Toast: „🛒 Granule přidány do nákupu (🏠 Rodina)“.
- Zásoby (`pantry`) v MVP nepropojujeme.

### 5.6 Checklisty
- `petPackList(pet, trip)`: `{id: genId(), name: '🚆 Vlak – Bára', items: tpl.map(text=>({id:genId(), text, done:false})), shared:false, createdAt: Date.now(), fromPet: pet.id}` → `saveChecklistDoc(list)`; ve skupině s `groupModShared(gid,'check')` pak `shareChecklistTo(list.id, gid)` (počká na `clGrp[gid].ready`, jinak zůstane osobní a toast to řekne).
- Žádné nové šablony do modulu Checklist (to je samostatná funkce na později).

### 5.7 Skupiny
- `copyGroupToPersonal` ~10159: nový blok `pets` (bez podmínky na příznak skupiny): `mode==='mine'` → jen `owner===uid`, `'all'` → všichni. Do `users/{uid}/pets/{nové id}` s `copiedFrom`, bez `_gid`. Zrcadla péče se po přenosu vytvoří samy (`petEvSync` při prvním vykreslení, když chybí – nebo jednorázově v `copyGroupToPersonal`).
- `leaveCopyText`: přidat „mazlíčky“ do výčtu, když ve skupině nějací jsou (`petGrp[gid]?.pets.length`).
- Přesun do skupiny `petShareTo(petId, gid)`: `setDoc(families/gid/pets/id, data)` → po potvrzení smazat zrcadla v `users/{uid}/events` a vytvořit ve skupině → `deleteDoc(users/uid/pets/id)`. Zpět `petUnshare`: opačně, jen `owner` nebo `isFamAdmin`.
- `rotateGroupCode`: data se přesunou serverem; klient si `_gid` bere z listeneru, nic neremapuje (nic nemá uložené gid).

### 5.8 Parťák (`buildChatContext` ~18481)
Nová sekce na úrovni 1 (zkracuje se jako běžná), za checklisty:
```js
add(tA('aip.ctx.s.pets'),1,()=>allPets().slice(0,4).map(p=>{
  // „- Bára (pes, labrador, 5 let, 28,4 kg; alergie: kuřecí maso) · granule do 21. 11. · péče: odčervení 20. 11., očkování 3. 12.“
}));
```
Max. 4 zvířata × ~200 znaků, texty přes `ctxT()`, poznámky ne (jen v detailu). Data jsou v promptu označená jako data, stejně jako ostatní sekce. Klíče `aip.ctx.s.pets`, `aip.ctx.pet.*` v `i18n/ai-cs.js` a `ai-en.js`.

### 5.9 Notifikace v appce
- `sw.js` ~214: do výčtu `'pets'`; `consumePendingOpen` ~15399: `if(p.open==='pets'){ if(!_fireSubs['pets']) subPets(); window.sp('pets'); if(p.id) petSelect(p.id); return; }` (id ověřit regexem `^[A-Za-z0-9_-]{1,40}$`). Bump `CACHE`.

### 5.10 i18n (cs.js / en.js), výběr klíčů
```
mod.pets            Mazlíček                      / Pets
mod.pets.desc       Očkování, odčervení, granule a sbalení na cestu. / Vaccinations, deworming, food and travel packing.
dash.card.pets      Mazlíčci                      / Pets
tour.pets.t         Mazlíček 🐾                   / Pets 🐾
tour.pets.x         Přidej psa nebo kočku. Pohlídám očkování, odčervení i to, kdy dojdou granule, a připomenu ti je. / …
cal.type.vet        Veterina                      / Vet
pet.empty.t         Přidej svého mazlíčka
pet.empty.d         Pohlídám očkování, odčervení i to, kdy dojdou granule.
pet.kind.dog/cat/other   Pes / Kočka / Jiné
pet.care.vacc/worm/para/visit/other   Očkování / Odčervení / Klíšťata a blechy / Prohlídka / Jiné
pet.every.m1/m3/y1  každý měsíc / co 3 měsíce / každý rok
pet.due.late        po termínu ({n} d.)
pet.due.today/tmrw  dnes / zítra
pet.due.in          za {n} dny            (tN: den/dny/dní)
pet.done            ✓ Hotovo
pet.done.toast      ✓ {care} zapsáno. Příště {date}.
pet.food.t          Granule
pet.food.def        Granule
pet.food.until      Vystačí do {date}
pet.food.left       Ještě asi {n} dní        (tN)
pet.food.warn       Dochází! Ještě {n} dny   (tN)
pet.food.out        Podle výpočtu už došly
pet.food.add        🛒 Přidat do nákupu
pet.food.inShop     ✓ V nákupu
pet.food.newPack    📦 Nové balení
pet.food.added      🛒 Granule přidány do nákupu{to}
pet.trip.train/car/hike  Vlak / Auto / Túra
pet.trip.made       Seznam je připravený. Uprav si ho podle sebe.
pet.vet.call        📞 Zavolat veterináři
pet.share           ⇄ Sdílet se skupinou
pet.shareNoCal      Mazlíčka můžeš sdílet ve skupině, která sdílí kalendář. Zapni ho v Nastavení → Skupiny.
pet.shared          {em} {name} je teď ve skupině {to}
pet.plan.t          Naplánujeme {name} péči?    (pozor na skloňování: radši „Naplánujeme péči?“ + jméno v podtitulku)
pet.plan.d          Vyplň, kdy má být příště. Řiď se doporučením svého veterináře.
```
Skloňování jmen zvířat (Báře, Mourkovi) nepoužívat, jméno vždy v 1. pádě nebo za pomlčkou („Odčervení – Bára“).

---

## 6. Rozšíření cronu (jediná změna na serveru, bez nové funkce)

V `sendScheduledNotifications` u narozenin (~1530) se v ranním čase uživatele (`bdayRun`) už čtou události. Přidat obdobu:

```js
// Mazlíček (4.94): péče a granule ráno v den nebo den předem; typ vet z osobních i skupinových kalendářů
const vetGroups = bdayRun ? [await loadVet(`users/${uid}/events`)] : [];
// ve smyčce calGroupIds (fam.members[uid] && fam.shareCal):
//   if (bdayRun) vetGroups.push(await lazy(fe, 'vet', () => loadVet(`families/${fid}/events`)));
for (const evDoc of vetGroups.flat()) {
  const ev = evDoc.data();
  if (typeof ev.date !== 'string' || ev.repeat === 'yes') continue;
  const when = ev.date === today ? 'day0' : ev.date === tomorrow ? 'day1' : null;
  if (!when || ev.remind !== when) continue;
  const key = ev.care === 'food' ? 'pet.food' : (when === 'day1' ? 'pet.tmrw' : 'pet.today');
  await push(tS(L, key + '.t', {ev: ev.name}), tS(L, key + '.b', {name: nickname, ev: ev.name}),
    `vet-${evDoc.id}-${ev.date}`, {data: {open: 'pets', id: typeof ev.petId === 'string' ? ev.petId : ''}});
}
async function loadVet(path) { return (await db.collection(path).where('type', '==', 'vet').get()).docs; }
```
- Jeden dotaz na kolekci jednou denně na uživatele (jako narozeniny), jednopolový index vzniká automaticky.
- `tag` shodný s `data.tag` (pravidlo v CLAUDE.md), vzor jako `ev-…`.
- Texty `functions/i18n-server.js`:
  - `pet.tmrw.t` „🩺 Zítra: {ev}“, `pet.tmrw.b` „{name}, zítra tě čeká {ev}.“
  - `pet.today.t` „🩺 Dnes: {ev}“, `pet.today.b` „{name}, dnes je na řadě {ev}. Po splnění klepni na Hotovo.“
  - `pet.food.t` „🥣 Granule docházejí“, `pet.food.b` „{ev}. Klepni a přidej je do nákupu.“
- Události s časem dostanou navíc stávající připomínku hodinu předem. U prohlídky s časem je to žádoucí; u domácí péče doporučuji čas nevyplňovat.
- Ve skupině dostanou upozornění všichni členové se zapnutým upozorněním na kalendář. Pro rodinu se psem je to v pořádku; vypnutí po členech až ve fázi 2.

**Bez úpravy cronu (záložní varianta):** připomínka funguje jen u péče s vyplněným časem (hodinu předem), granule jen na Domů. Doporučuji cron upravit, je to malá změna stávající funkce, nasadí se sama.

---

## 7. Výpočty (pro kodera a testera)

```js
// Granule: kdy dojdou
const perPack = packKg*1000/dailyG;                       // dní na jedno balení
const runOut  = addDays(openedAt, Math.floor(perPack*(1+spare)));   // první den bez granulí
const left    = daysBetween(toDS(), runOut);              // může být záporné
const pct     = clamp((addDays(openedAt, perPack) - dnes)/perPack, 0, 1);  // pruh = aktuální balení
state = left<=0 ? 'out' : left<=warnDays ? 'warn' : 'ok';
eventDate = addDays(runOut, -warnDays);  // je-li v minulosti → dnes (a remind 'day0' pošle ráno příští den? ne: při změně v minulosti push už nepřijde, Domů ukáže stav)
```
Příklad: 12 kg, 320 g/den → 37,5 dne → otevřeno 10. 10. → dojde 16. 11.; s 1 balením navíc 23. 12.; upozornění 5 dní předem 11. 11.

- „📦 Nové balení“: `openedAt = dnes`, `spare = max(0, spare-1)`, `inShopAt = null`, přepočet + `petEvSync(pet,'food')`.
- „🛒 Přidat do nákupu“ nemění výpočet (granule ještě nejsou doma). Po označení položky jako koupené se nic automaticky neděje (MVP); uživatel klepne „Nové balení“, až pytel otevře.
- Věk: z `birth`, pod 1 rok v měsících („7 měsíců“), jinak roky („5 let“). Neplatné datum = bez věku.
- Opakování: `addInterval(ds, {n,u})`, měsíce s ořezem na konec měsíce; „Hotovo“ počítá od skutečného data, ne od plánovaného (odčervení o týden později = příště o týden později).

---

## 8. Přístupnost a texty
- Všechna tlačítka min. 44×44 px, hlavní akce 48 px, mezi tlačítky v řádku ≥ 8 px.
- Stav péče vždy textem i barvou; tečky `aria-hidden`.
- `Hotovo` má `aria-label="Hotovo: Odčervení – Bára"`.
- Přepínač mazlíčků `role="tablist"`-free: obyčejná tlačítka s `aria-current="true"`.
- Uživatelský text vždy přes `esc()`, handlery přes `data-aN` (`data-a0="${esc(pet.id)}" onclick="petSelect(this.dataset.a0)"`).
- `tel:` odkaz jen z číslic, `+`, mezer (`replace(/[^\d+]/g,'')`); adresa do map přes `encodeURIComponent`.
- Datum přes `toDS()`, nikdy `toISOString().slice(0,10)`.
- Tykání, emoji jen jako ikona řádku, ne v každé větě.

---

## 9. Co nechat na později
| Fáze | Co | Proč později |
|---|---|---|
| 2 | Nabídka členům skupiny „Ve skupině 🏠 Rodina je mazlíček Bára. Zapnout modul?“ (vzor `NUDGES` checklist) | potřebuje jednorázové čtení `pets` i bez zapnutého modulu |
| 2 | Fotka mazlíčka (komprese `compressImage`, ≤ 60 kB) | velikost dokumentu, sdílení |
| 2 | Historie váhy s grafem | MVP stačí poslední váha |
| 2 | Vypnutí upozornění na péči po členech skupiny | nová preference v profilu |
| 2 | Kategorie nákupu „Mazlíčci“, propojení se Zásobami (granule jako zásoba) | zásah do `SHOP_CATS` a pantry |
| 2 | Otázka „Mazlíček“ v jednoduchém startu a šablona Rodina s Mazlíčkem | onboarding je citlivý na pořadí |
| 2 | Návyk „Venčení“ jedním klepnutím (stávající návyky) | drobnost, ne v zadání |
| 3 | „Karta pro hlídání“: sdílení textu s údaji, krmením a kontaktem na veterinu (Web Share) | nice-to-have |
| 3 | Více druhů krmiva, společné krmivo pro více zvířat | složitější výpočet |
| 3 | Fotka očkovacího průkazu / dokumenty | úložiště souborů |
| 3 | Šablony v modulu Checklist obecně | samostatná funkce |
| 3 | Parťák umí „Zapiš odčervení“ akcí | rozšíření akcí parťáka |

---

## 10. Testy (statické, pro testera)
1. `node --check app.js`, `node --check functions/index.js`, `node --check sw.js`.
2. Simulace v node: `runOut` (příklad v §7), `addInterval` (31. 1. + 1 m, 29. 2. + 1 r), věk.
3. grep: žádné `module:'pet'` v `logGroupActivity`; žádné `sharePets`; každé `${pet.` v HTML přes `esc(`.
4. Zrcadlo: id `pet_{petId}_{cid}`, mazání při `every:null` po Hotovo a při smazání mazlíčka (všechny `care` + `food`).
5. Starší klient: událost `vet` má `typeLabel` a `typeEmoji`.
6. Pravidla: nic se nemění (`git diff firestore.rules` prázdné).
7. Ruční test (uživatel, testovací účty): dva členové skupiny, sdílený pes, Hotovo z obou telefonů souběžně, granule do nákupu skupiny, ranní push den předem.

---

## Shrnutí

**Rozsah MVP (4.94):** modul 🐾 Mazlíček pro víc zvířat s kartou (všechna pole ze zadání, tlačítko Zavolat veterináři); plán péče s opakováním a tlačítkem Hotovo; termíny jako události typu 🩺 Veterina v kalendáři; výpočet granulí s upozorněním a „Přidat do nákupu“; 3 šablony na cestu × druh zvířete vytvoří běžný checklist; sdílení mazlíčka do skupiny; karta na Domů a řádek pro parťáka.

**Napojení:** `MODS`, `hasUI`, `MORE_CATS`, `subModules`, `sp`, `TOUR_MODULES`, `DASH_CARDS` + `rDash`, `EV_ICONS/getEvIcon/getEvLabel`, `openEditEvent`/`delEvent` (přesměrování na mazlíčka), `addShopEntry` (+ `gid`), `saveChecklistDoc`/`shareChecklistTo`, `copyGroupToPersonal`, `buildChatContext`, `exp.col`, `consumePendingOpen` + `sw.js`, i18n cs/en/ai/server. Data v `users/{uid}/pets` a `families/{gid}/pets`, **pravidla Firestore beze změny**, **žádná nová Cloud Function** (jen ~40 řádků v cronu pro ranní připomínky).

**Rizika:** (1) kalendář umí opakovat jen ročně, proto je zdrojem pravdy mazlíček a v kalendáři je jen nejbližší termín; úpravy z kalendáře se musí přesměrovat do Mazlíčka, jinak se data rozejdou. (2) Sdílet jde jen do skupiny se sdíleným kalendářem; když ho skupina později vypne, připomínky přestanou chodit (modul to musí ukázat). (3) Mazat sdíleného mazlíčka smí podle pravidel každý člen, hlídá to jen klient. (4) Rozsah je na hraně jedné verze; když bude potřeba škrtat, jako první jde do další verze sdílení do skupiny a karta na Domů, jádro (karta, péče, granule, cesta) zůstane.
