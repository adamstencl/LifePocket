# Návrh: Úkoly (položka checklistu s termínem)

Základ: HEAD `98e2ec5`, verze 5.14.1, `CACHE` v115. Cílová verze 5.15.0.
Autor: ux-designer. Stav: návrh k předání koderovi, kód se zatím nemění.

## 0. Rozhodnutí v kostce

| Otázka | Rozhodnutí |
|---|---|
| Kde leží úkol | Položka checklistu (`items[]` v `users/{uid}/checklists/{id}` nebo `families/{gid}/checklists/{id}`) + nepovinná pole `due`, `dueT`, `star`, `doneAt`. Nic dalšího se nekopíruje. |
| Kam padá rychlé přidání | Do seznamu „Úkoly“ (výchozí checklist `cl.defName` už tak dnes jmenuje). Id v `prof.taskList`. |
| Karta na Domů | Nová karta `tasks` (✅ Úkoly) **nahrazuje** kartu `focus` (🎯 Hlavní úkol). Hlavní úkol dne = úkol s hvězdou `star`. |
| Kalendář | Čte úkoly z paměti (stejná pole jako checklist), v buňce značka ✅, v detailu dne sekce Úkoly s odškrtnutím. `getEventsForDate` se nemění. |
| Připomínka | Přes stávající cron `sendScheduledNotifications`, index připomínek v profilu (`prof.taskRem`). **0 čtení navíc na běh**, 1 čtení + 1 zápis jen v okamžiku připomínky. Bez push tokenu lokálně (stejné rozdělení jako u návyků). |
| Rozpoznání data | Čistá funkce `parseTaskText()` bez AI, cs i en vždy, náhled pod polem s možností zrušit. |
| Pravidla Firestore | **Beze změny.** `users/{uid}/**` vlastník, `families/{gid}/checklists` členové. Žádné nové indexy. |
| Nové Cloud Functions | Žádné. Rozšíří se jen tělo `sendScheduledNotifications` (nasadí se samo po pushi `functions/**`). |
| Přiřazení „pro koho“, opakování | Fáze 2. |

---

## 1. Obrazovky (mobil 390 px)

Šířka karty na 390 px = 390 − 2×16 (okraj stránky) = 358 px, vnitřek 326 px. Řádek úkolu má výšku min. 44 px, zaškrtávací tlačítko 44×44 px (vizuálně čtverec 22 px se zaoblením 6 px, jako `.cl-check`, aby se úkol na první pohled lišil od kulatého kroužku návyku).

### 1.1 Domů – před / po

**Před (5.14.1)** – karta `focus` (`focusWidgetHTML`):

```
┌──────────────────────────────────────┐
│ 🎯 Dnes   Dokončit prezentaci   ☐ ✏️ │
├──────────────────────────────────────┤
│ 📅 Zítra  Nastav zítřejší prioritu ＋│
├──────────────────────────────────────┤
│ ● ● ● ○ · · ·          3 nastaveno/2 │
│ ⚡ 3 dny v řadě                       │
└──────────────────────────────────────┘
```

**Po (5.15.0)** – karta `tasks` (`tkDashHTML`):

```
┌──────────────────────────────────────┐
│ ✅ ÚKOLY                 2/4 dnes  → │  ← → otevře Checklist na seznamu Úkoly
│ ┌──────────────────────────────┐ ┌──┐│
│ │ Přidej úkol… třeba „zítra“   │ │＋││  ← jedno pole, Enter = přidat
│ └──────────────────────────────┘ └──┘│
│                                      │
│ PO TERMÍNU · 1          Vše na dnes ↻│  ← červený nadpis, akce v hlavičce
│ [ ] Zaplatit pojistku     📅 po 9. 11.│
│                                      │
│ DNES                                 │
│ [ ] 🎯 Dokončit prezentaci           │  ← star = hlavní úkol, první, akcent
│ [ ] Koupit žárovky          ⏰ 18:00 🔔│
│ [✓] ~~Vrátit knihu~~                 │  ← hotové zůstává na místě do konce relace
│ [✓] ~~Zavolat mámě~~          🏠     │  ← 🏠 = emoji skupiny (úkol ze sdíleného seznamu)
│                                      │
│ ZÍTRA                                │
│ [ ] Vyzvednout balík                 │
│                                      │
│ POZDĚJI                              │
│ [ ] Narozeniny Jany – dárek  pá 13.11.│
│ [ ] Vyměnit pneumatiky               │  ← bez termínu (jen ze seznamu Úkoly)
│            + 3 další                 │  ← rozbalí kartu (jako „+ N další“ u návyků)
└──────────────────────────────────────┘
```

Pravidla obsahu karty:
- **Po termínu**: nesplněné s `due < dnes`, nejstarší nahoře, nejvýš 3 + „+ N“. Sekce se ukáže, jen když něco obsahuje. Tlačítko „Vše na dnes“ přesune všechny po termínu na dnešek (jedna akce, toast se Zpět).
- **Dnes**: `due == dnes` + všechno odškrtnuté dnes (`doneAt` dnes), řazení: `star` → s časem vzestupně → bez času v pořadí seznamu. Nejvýš 5 + „+ N“.
- **Zítra**: `due == zítra`, nejvýš 3.
- **Později**: `due > zítra` (do 14 dní ukázat datum, dál jen „+ N později“) a potom nesplněné **bez termínu jen ze seznamu Úkoly** (položky jiných checklistů bez termínu na Domů nepatří, jinak by tam padalo balení na dovolenou). Nejvýš 3.
- Položky ze všech seznamů s termínem (osobní i skupinové) se ukazují všechny. U skupinové položky emoji skupiny (`grpEmoji(gid)`, pro čtečku `grpName`).
- Pořadí řádků se v rámci dne a relace nemění (stejný princip jako `_dwHOrd` u návyků 5.10), aby druhé klepnutí netrefilo jiný řádek. Nové úkoly jdou nahoru do své sekce.
- Klepnutí na čtvereček = hotovo / zpět. Klepnutí na text = list úpravy (1.4). Karta jako celek **nemá** `onclick` na `sp()` (na rozdíl od `.dw`), protože obsahuje pole; navigace jen přes `→` v hlavičce (44×44 px).

### 1.2 Rychlé přidání s náhledem

```
│ ┌──────────────────────────────┐ ┌──┐│
│ │ koupit žárovky zítra v 18:00│ │＋││
│ └──────────────────────────────┘ └──┘│
│ (📅 zítra · čt 12. 11.  ✕) (⏰ 18:00 ✕)│  ← čipy náhledu, aria-live="polite"
│ (📋 Úkoly ▾)                          │  ← cíl; jen když má uživatel víc seznamů
```

Po přidání: pole se vyprázdní, fokus v něm zůstane, nový řádek „Koupit žárovky“ v sekci Zítra krátce zvýrazněný (pozadí `--card2` 1,2 s, bez animace při `prefers-reduced-motion`). Toast jen když úkol padl do sekce, která je sbalená („Přidáno na pá 13. 11.“).

- Čip data/času `✕` = „nerozpoznávat“: text se uloží doslova a úkol nemá termín. Platí, dokud se rozpoznaná část textu nezmění.
- Klepnutí na čip data otevře výběr termínu (stejné čipy jako v 1.4).
- Čip `📋 Úkoly ▾` otevře spodní list se seznamy (osobní, pak skupinové s emoji). Volba se pamatuje v relaci (`lp_tk_list` v localStorage, per-viewer pohodlí), výchozí je vždy `prof.taskList`.
- Text bez rozpoznaného data = úkol bez termínu → sekce Později. Žádné „automaticky dnes“, jinak by se karta zanášela úkoly po termínu.

### 1.3 Stavy karty

**Prázdný (žádný úkol nikde)** – učí syntaxi, nic nezakládá samo:
```
┌──────────────────────────────────────┐
│ ✅ ÚKOLY                           → │
│ [ Přidej úkol… třeba „zítra“   ] [＋]│
│ Napiš úkol a kdy ho chceš udělat.    │
│ Zkus třeba:                          │
│ (Koupit žárovky zítra)               │  ← klepnutí vloží text do pole
│ (Zavolat mámě v pátek v 18:00)       │     (neuloží; uživatel vidí náhled)
│ (Zaplatit nájem 15. 11.)             │
└──────────────────────────────────────┘
```

**Dnes hotovo** (všechno s `due == dnes` splněné, nic po termínu):
```
│ DNES                                 │
│ Na dnešek máš hotovo 🎉              │
│ [✓] ~~Koupit žárovky~~               │
```

**Na dnešek nic, ale něco později**:
```
│ DNES                                 │
│ Na dnešek nic. Další: pá 13. 11.     │
```

**Po termínu** (viz 1.1): červený nadpis `var(--red)`, datum v řádku červeně, akce „Vše na dnes“. Žádné vyčítání, žádné červené pozadí celé karty.

**Načítání seznamu skupiny** (`clGrp[g].ready === false`): řádky z osobních seznamů hned, pod nimi jeden šedý řádek „Načítám úkoly skupiny…“, žádný skeleton.

**Offline**: chová se jako checklist dnes (`clOfflineWrite`), bez zvláštního stavu.

### 1.4 List úpravy úkolu (`#m-task`, `.moverlay`)

```
┌──────────────────────────────────────┐
│ Úkol                              ✕  │
│ ┌──────────────────────────────────┐ │
│ │ Koupit žárovky                   │ │  ← textarea 2 řádky
│ └──────────────────────────────────┘ │
│ KDY                                  │
│ (Dnes) (Zítra) (Víkend) (Po 16. 11.) │  ← čipy 44 px, zalamují se
│ (📅 Jiné datum…) (Bez termínu)       │  ← „Jiné“ = <input type="date">
│ ⏰ Čas  [ 18:00 ]  (✕)               │  ← data-time-picker jako u návyků
│ 🔔 Připomenout          [  ●──]      │  ← přepínač; text pod ním:
│    V 18:00 v den úkolu.              │     bez času „Ráno v 8:00 v den úkolu.“
│ 🎯 Hlavní úkol dne      [──○  ]      │  ← jen jeden na den (zapnutí jinde vypne)
│ 📋 Seznam: Úkoly · 🏠 Domácnost       │  ← jen informace (přesun = fáze 2)
│                                      │
│ [🗑 Smazat]          [  Uložit  ]    │
└──────────────────────────────────────┘
```

- „Víkend“ = nejbližší sobota (v sobotu a neděli dnešek). „Po 16. 11.“ = příští pondělí.
- Připomínka bez povolených notifikací: přepínač zapne, uloží a zavolá `notifAskNow('task')` (stávající fronta, okno se ukáže až po zavření listu přes `whenUiFree`). Na iPhonu mimo plochu se ukáže stávající nápověda k přidání na plochu.
- Přepínač připomínky je osobní: ve skupinovém seznamu ho ostatní členové nevidí (index je v mém profilu).

### 1.5 Checklist – řádek s termínem

```
┌──────────────────────────────────────┐
│ [Úkoly] [🏠 Nákup] [Dovolená] [+]    │
│ Úkoly                     3/7  ✓ 🏠  │
│ [ Přidat položku… třeba „zítra“ ][Přidat]│
│ (📅 zítra · čt 12. 11. ✕)            │  ← stejný náhled jako na Domů
│ [ ] Koupit žárovky                ✏️ ×│
│     📅 zítra · ⏰ 18:00 · 🔔           │  ← čip pod textem, 12 px, --text2
│ [ ] Zaplatit pojistku             ✏️ ×│
│     📅 po 9. 11. (po termínu)         │  ← --red
│ [ ] Plavky                        ✏️ ×│  ← položka bez termínu beze změny
└──────────────────────────────────────┘
```
V rozbaleném řádku (✏️) přibude do `.cl-item-tools` tlačítko `📅 Termín`, které otevře list 1.4 (jeden editor pro všechna místa).

### 1.6 Kalendář

Měsíc (buňka ~48 px):
```
 Po   Út   St   Čt   Pá   So   Ne
  9   10  [11]  12   13   14   15
 ✅        🎂   ✅   📌✅
```
- Buňka s otevřeným úkolem dostane `has-task` a značku ✅ (nejvýš dvě značky: ikona první události + ✅). Jen hotové úkoly značku nemají. Minulý den s nesplněným úkolem: značka ✅ s červenou tečkou (`.cal-cell.task-over`).
- `getEventsForDate` zůstává jen pro události; úkoly přes nové `getTasksForDate(ds)`.

Detail dne (`showDayEventsModal` → rozšířit na `showDaySheet(ds)`):
```
┌──────────────────────────────────────┐
│ 📅 čtvrtek 12. listopadu 2026        │
│ UDÁLOSTI                             │
│ 🎂 Jana                     ✏️  🗑️   │
│ ÚKOLY                                │
│ [ ] Koupit žárovky   ⏰ 18:00         │  ← odškrtnutí = totéž co na Domů
│ [✓] ~~Vrátit knihu~~       🏠        │
│                                      │
│ [Zavřít] [+ Úkol] [+ Událost]        │
└──────────────────────────────────────┘
```
- „+ Úkol“ přidá do seznamu Úkoly s `due = ds` (inline pole v listu, bez dalšího okna).
- Prázdný den dál otevírá formulář události (rychlost pro stávající uživatele), ale ve formuláři `#m-event` přibude pod názvem odkaz: „Je to spíš úkol? ✅ Přidat jako úkol“ – vezme rozepsaný název a datum a založí úkol.
- Seznam „nadcházející“ (`renderEvList`, 14 dní) a karta kalendáře na Domů zůstávají jen s událostmi. Úkoly má na Domů vlastní karta (bez duplicity).

### 1.7 Notifikace

```
┌──────────────────────────────────────┐
│ LifePocket                           │
│ ✅ Koupit žárovky                    │
│ Úkol na dnes v 18:00                 │
└──────────────────────────────────────┘
```
Bez času (ranní připomínka): „✅ Dnes tě čeká: Koupit žárovky“ / „Today: Koupit žárovky“. Klepnutí otevře Domů s rozbalenou kartou Úkoly a krátce zvýrazněným řádkem (`open: 'tasks'`, `id: itemId`). Tlačítko „✓ Hotovo“ přímo v notifikaci je fáze 2 (potřebovalo by podepsaný endpoint jako `habitSnooze`, tedy novou funkci).

---

## 2. Toky

### 2.1 Rychlé přidání (Domů nebo Checklist)
1. Uživatel píše → `tkInput()` (debounce 120 ms) → `parseTaskText(value)` → čipy náhledu.
2. Enter / ＋ → `tkAdd()`: `{id: genId(), text: parsed.text, done: false, due?, dueT?}`.
3. Cílový seznam `tkTargetList()` (`lp_tk_list` → `prof.taskList` → založit). Zápis `clSave(list, clOps.add(item), item)` + `gaCheck(list,'add',text)` (skupina dostane aktivitu jako dnes).
4. Pole se vyprázdní, karta se překreslí přes `tkDashRefresh()` (ne celé `rDash`).

### 2.2 Odškrtnutí (jedno místo pravdy)
Domů, kalendář i checklist volají jednu funkci `tkToggle(listId, itemId)`:
`clEditFind(listId)` → `clSave(list, clOps.set(id, done ? {done:false, doneAt:undefined} : {done:true, doneAt:Date.now()}))` → `gaCheck`/`unlogGroupActivity` jako dnes → `clChanged()` překreslí všechna místa. Stávající `toggleCheckItem(itemId)` se změní na tenký obal `tkToggle(activeChecklist, itemId)`.

### 2.3 Termín a připomínka
List 1.4 → `tkSave()` → `clOps.set(id, {text, due, dueT, star})` → pokud se mění připomínka nebo termín položky s připomínkou: `taskRemSet(list, item, on)` (zápis do profilu, viz 3.2).

### 2.4 Připomínka v čase
- Zařízení s push tokenem: server (cron, 5 min) najde v `prof.taskRem` splatnou položku → ověří úkol → smaže klíč → pošle push.
- Zařízení bez tokenu: `checkTaskReminders()` v minutovém intervalu vedle `checkPerHabitReminders` → `sendNotif` → smaže klíč.

### 2.5 Převod hlavního úkolu (jednorázově)
Viz kap. 5.

---

## 3. Datový model

### 3.1 Položka checklistu (rozšíření, zpětně kompatibilní)

```js
{
  id: 'k3j9…',            // beze změny (genId)
  text: 'Koupit žárovky', // beze změny
  done: false,            // beze změny
  photos: [...],          // beze změny, nepovinné
  // NOVÉ, vše nepovinné:
  due: '2026-11-12',      // YYYY-MM-DD, místní den (toDS), validace isDS
  dueT: '18:00',          // HH:MM s nulami (okEvTime), jen spolu s due
  star: true,             // hlavní úkol dne; jen u položky s due
  doneAt: 1762963200000   // ms, nastaví se při odškrtnutí, při zrušení se klíč odstraní
}
```

- Starší klient (5.14.x) neznámá pole zachová: `clCopyItems` i `clOps.set` pracují s celými objekty (`{...i}`, `Object.assign`), `saveExpandedCheckItem` mění jen `text`. Ověřit ještě kopii seznamů při odchodu ze skupiny (`families/{gid}/checklists`, kolem ř. 11721) – musí kopírovat položky celé.
- `clOps.set` doplnit: hodnota `undefined` v patchi = smazat klíč (`delete it[k]`), Firestore v poli `undefined` neuloží.
- Velikost: +~40 B na položku. Hlídá stávající `CL_MAX_LEN` (900 kB). Úkoly se v seznamu hromadí jako hotové → u seznamu Úkoly ukázat „Smazat hotové (N)“ výrazněji, když N > 30. Automatické mazání ne (nevratné).

### 3.2 Index připomínek v profilu

`users/{uid}/profile/main.taskRem` – mapa podle `itemId`, nejvýš 50 klíčů:

```js
taskRem: {
  'k3j9…': {
    l: 'listId',          // id seznamu
    g: 'DOMA-K7M2QX',     // skupina, kde leží zdroj pravdy (kopie sdíleného seznamu); '' = osobní
    d: '2026-11-12',      // due v okamžiku nastavení
    t: '18:00',           // dueT nebo '' (pak ranní čas)
    at: 1762966800000     // okamžik odeslání v ms (spočítá klient z místního času; bez času = ns.morning)
  }
}
```

Proč profil:
- Cron profil čte v každém běhu pro každého uživatele už dnes (`processUser`) → **0 čtení navíc**. Stejně fungují `waterSent` a `mealRemindDecide` („jen z profilu“).
- Žádný text úkolu v profilu: server si ho přečte až v okamžiku připomínky z dokumentu seznamu (aktuální text, ověří, že úkol není hotový ani přesunutý).
- Připomínka je osobní i ve skupinovém seznamu (každý člen si ji zapíná sám, do svého profilu – pravidla jiný zápis ani nedovolí).
- Zápis klientem: `updateDoc(profile, {['taskRem.' + id]: {...}})` / `deleteField()`; jednotlivé klíče se nepřepisují navzájem mezi zařízeními.

Alternativy (zamítnuté):
| Varianta | Proč ne |
|---|---|
| Cron čte všechny checklisty uživatele | N dokumentů × 288 běhů denně × uživatelé; dokumenty s fotkami až 900 kB. |
| Kolekce `users/{uid}/taskRem` + dotaz na čas (jako `loadTimedEvents`) | Každý dotaz stojí min. 1 čtení i bez výsledku → +288 čtení/uživatel/den. |
| Jen lokální připomínky | Na iPhonu PWA v pozadí neběží, připomínka by nepřišla, dokud appku neotevře. Pro „koupit žárovky v 18:00“ nepoužitelné. |
| Nová Cloud Function / Cloud Tasks | Zadání: bez nových funkcí; složitější nasazení i oprávnění. |

### 3.3 Profil – další pole

| Pole | Typ | Účel |
|---|---|---|
| `taskList` | string | id osobního seznamu „Úkoly“ (cíl rychlého přidání) |
| `taskRem` | map | index připomínek (3.2) |
| `focusMig` | `1` | převod hlavního úkolu proběhl (kap. 5) |
| `notifSettings.tasks` | bool | vypínač „Připomínky úkolů“ (undefined = zapnuto) |

`focusToday`, `focusNext`, `focusHistory` zůstávají (nic se nemaže), nové verze je už jen čtou při převodu.

### 3.4 Pravidla Firestore a indexy
**Beze změny.** Vše leží v `users/{uid}/**` (vlastník) a `families/{gid}/checklists/*` (obecné pravidlo podkolekcí pro členy, ř. 128–130). Žádný nový dotaz → žádný index.

---

## 4. Rozpoznání data v textu (`parseTaskText`)

Čistá funkce bez DOM, aby šla testovat v node:

```js
// → {text, due: 'YYYY-MM-DD'|null, dueT: 'HH:MM'|null, hits: [{kind:'date'|'time', from, to, src}]}
function parseTaskText(raw, now = new Date())
```

Postup:
1. `s = raw.normalize('NFC')`, pracovní kopie `n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')`. U předsložených českých znaků zachová délku → indexy v `n` platí i pro `s`.
2. Hranice slova: `(?<=^|[\s,(])` a `(?=$|[\s,.!?)])`.
3. Nejdřív datum (první shoda vyhrává), pak čas. Datum s tečkou `15.11.` se hledá dřív než čas, aby se nepletlo s `15.11` jako časem.
4. Rozpoznaná část se z textu odstraní i s předložkou (`v`, `ve`, `na`, `do`, `on`, `at`, `by`), mezery se sloučí, okrajová interpunkce se ořízne. Když by zbyl prázdný text („zítra“), uloží se původní text bez termínu.
5. cs i en platí vždy (uživatelé míchají), konflikty nevznikají.

Vzory (na `n`, bez diakritiky):

| Druh | cs | en | Výsledek |
|---|---|---|---|
| dnes | `dnes`, `dneska` | `today` | dnes |
| zítra | `zitra`, `zejtra` | `tomorrow`, `tmrw` | +1 |
| pozítří | `pozitri` | `day after tomorrow` | +2 |
| den v týdnu | `(v\|ve\|na\|do\|tento\|tuto\|pristi)? (pondeli\|utery\|stred[auy]\|ctvrt(ek\|ka)\|pat(ek\|ku)\|sobot[auy]\|nedel[ie])` | `(on\|this\|next\|by)? (monday\|…\|sunday)` | nejbližší **budoucí** takový den (dnes = pátek → „v pátek“ = za 7 dní); `pristi`/`next` = den v příštím kalendářním týdnu |
| za N dní | `za (\d{1,2}) (den\|dny\|dni)`, `za tyden` | `in (\d{1,2}) days?`, `in a week` | +N / +7 |
| datum číslem | `(\d{1,2})\. ?(\d{1,2})\.( ?\d{4})?` | totéž | den.měsíc; bez roku: letos, a pokud už minul, příští rok; neplatné (31. 2.) se ignoruje |
| datum slovem | `(\d{1,2})\. (ledna\|unora\|brezna\|dubna\|kvetna\|cervence\|cervna\|srpna\|zari\|rijna\|listopadu\|prosince)` | `(\d{1,2}) (jan\|feb\|…)[a-z]*`, `(jan\|…)[a-z]* (\d{1,2})` | jako výše (`cervence` před `cervna`) |
| čas | `(v\|ve\|od\|do)? (\d{1,2}):(\d{2})`, `(v\|ve) (\d{1,2})\.(\d{2})`, `(v\|ve) (\d{1,2}) ?(h\|hod)` | `(at )?(\d{1,2})(:\d{2})? ?(am\|pm)`, `at (\d{1,2}):(\d{2})`, `at (\d{1,2})` | HH:MM; 0–23 / 0–59 |

Záměrně **ne**: zkratky dnů (`po` = „po obědě“, `sun`), lomítko `11/15` (US × EU), „ráno/večer/odpoledne“, „příští týden“, opakování. To je fáze 2.

Čas bez data: dnes, pokud čas ještě nenastal, jinak zítra (náhled to ukáže).

Testovací tabulka pro testera (`now = 2026-11-11 (st) 10:00`):

| Vstup | text | due | dueT |
|---|---|---|---|
| `Koupit žárovky zítra` | Koupit žárovky | 2026-11-12 | – |
| `koupit zarovky zitra` | koupit zarovky | 2026-11-12 | – |
| `Zavolat mámě v pátek v 18:00` | Zavolat mámě | 2026-11-13 | 18:00 |
| `Zaplatit nájem 15. 11.` | Zaplatit nájem | 2026-11-15 | – |
| `Zaplatit nájem 10. 11.` | Zaplatit nájem | 2027-11-10 | – |
| `Dárek do pátku` | Dárek | 2026-11-13 | – |
| `Porada ve středu` | Porada | 2026-11-18 | – |
| `Porada příští pondělí ve 13.30` | Porada | 2026-11-16 | 13:30 |
| `Vynést koš v 9:00` | Vynést koš | 2026-11-12 | 09:00 |
| `Pivo v 18 h` | Pivo | 2026-11-11 | 18:00 |
| `Call mom tomorrow at 6pm` | Call mom | 2026-11-12 | 18:00 |
| `Pay rent on Nov 15` | Pay rent | 2026-11-15 | – |
| `zítra` | zítra | null | null |
| `Koupit 2 rohlíky po obědě` | beze změny | null | null |
| `Verze 5.14 hotová` | beze změny | null | null |
| `31. 2. něco` | beze změny | null | null |
| `pozítří ráno` | ráno | 2026-11-13 | – |

---

## 5. Sloučení s „Hlavním úkolem dne“

**Doporučení: sloučit.** Dvě karty „Dnes/Zítra“ vedle sebe by byly matoucí a karta Hlavní úkol umí jen jeden text bez vazby na cokoli. Myšlenka „jedné hlavní věci“ zůstane jako hvězda 🎯 (`star`) u úkolu.

Co se ztratí: týdenní tečky a série dní s nastaveným fokusem (`focusStatsHTML`, `calcFocusStreak`). Podle mě malá cena; série v appce mají návyky. Kdyby vedoucí chtěl zachovat, lze v kartě Úkoly v hlavičce ukázat „🎯 3 dny v řadě“ počítané z hotových úkolů se `star` (fáze 2).

Převod `tkMigrateFocus()` – jednou na účet, spouští se po prvním snapshotu checklistu **ze serveru** (`!snap.metadata.fromCache`) a po `initFocus()`:
1. Když `prof.focusMig === 1` → konec.
2. `dnes = new Date().toDateString()` (formát, který fokus používá).
3. `prof.focusToday.date === dnes && text` → položka `{id: 'fz' + YYYYMMDD, text, due: toDS(), star: true, done, doneAt?}`.
4. `prof.focusNext.date` = zítřek → položka `{id: 'fz' + YYYYMMDD(zítra), text, due: zítra, star: true}`.
5. Zápis do `tkTargetList()` přes `clOps.add` – **deterministické id** zajistí, že dvě zařízení najednou nevytvoří duplicitu (`clOps.add` filtruje stejné id).
6. `updateDoc(profile, {focusMig: 1})`.
7. Když se něco převedlo: `popToast('🎯 Hlavní úkol je teď v Úkolech')` (fronta oken, žádné okno navíc).

Starší historie (`focusHistory`, `lp_focus*`) se nepřevádí ani nemaže. Starší klient na jiném zařízení dál zapisuje `focusToday`; changelog žádá aktualizaci (SW je network-first, takže to proběhne samo při dalším otevření).

Navazující místa:
- `DASH_CARDS`: `{id:'focus',em:'🎯'}` → `{id:'tasks',em:'✅'}` na stejné pozici. V `dashLayout()` jednorázově v paměti přemapovat `focus` → `tasks` v `order`. Pro `hidden`: `focus` **nepřebírat** (nová karta se ukáže, uživatel ji může schovat; viz otázka Q3).
- `dashEditAvail`: `case 'tasks': return unlD('focus') || hasMod('checklist')`.
- Jednoduchý režim: `unl('focus')?focusWidgetHTML()` → `unl('focus')?tkDashHTML()`. Id odkrytí `focus` v `UNL_IDS` zůstane (nemění se `prof.unl`).
- `NUDGES` `focus`: texty `nd.focus.*` přepsat na úkoly („Máš něco na zítra? Zapiš si to jako úkol“), `yes` = `unlock('focus')` + fokus do `#tk-inp`.
- Rychlý start `qs.focus` → „Přidej první úkol“, `done: tkAll().length > 0`, akce = fokus do `#tk-inp`.
- `openFocusModal`, `saveFocus`, `saveTomorrowFocus`, `markFocusDone`, `focus*HTML` po převodu nikdo nevolá → smazat v téže verzi (méně kódu), `initFocus` ponechat jen kvůli čtení pro převod.

---

## 6. Napojení v kódu (app.js, pokud není uvedeno jinak)

### 6.1 Nové funkce

| Funkce | Co dělá |
|---|---|
| `parseTaskText(raw, now)` | kap. 4, čistá funkce |
| `tkDueLabel(due, dueT, today)` | „dnes“, „zítra“, „pá 13. 11.“, „po 9. 11.“ + čas; cs/en přes `fmtDate`/`t()` |
| `tkTaskList()` | id seznamu Úkoly: `prof.taskList`, jinak první vlastní seznam se jménem `Úkoly`/`Tasks`, jinak založí (`setDoc` jako výchozí checklist v `subChecklist`) a zapíše `prof.taskList` |
| `tkTargetList()` | `lp_tk_list` (když seznam pořád existuje) → `tkTaskList()`; vrací seznam přes `clEditFind` |
| `tkAll()` | memo: `[{l, it, gid}]` ze `checklists` (data přes `clFind`) + `groupChecklists()`; přepočet jen při změně `_tkVer` |
| `getTasksForDate(ds)` | z indexu `Map(ds → [...])` uvnitř `tkAll` memo |
| `tkSections(today)` | {over, today, tmrw, later} podle 1.1 |
| `tkDashHTML()` / `tkDashRefresh()` | karta; refresh přepíše jen `#dw-tasks` (jako `renderFocusInDash`), zachová fokus a hodnotu `#tk-inp` |
| `tkInput()` / `tkAdd()` | náhled a přidání (2.1) |
| `tkToggle(listId, itemId)` | jediné odškrtnutí (2.2) |
| `tkOpen(listId, itemId)` / `tkSave()` / `tkDel()` | list `#m-task` (1.4); smazání přes `clOps.del` + `clUndoNote` |
| `tkAllToToday()` | „Vše na dnes“: jedna `clSave` na seznam, toast se Zpět |
| `clChanged()` | volá se ze snapshotu `subChecklist` a `subscribeGroupChecklist` místo holého `renderChecklist()`: `_tkVer++`, `renderChecklist()`, `tkDashRefresh()`, `renderCal()` když je kalendář aktivní, `taskRemSync()` |
| `taskRemSet(list, item, on)` | zapíše/smaže `taskRem.<id>`; `g` = `list._gid` nebo `clSharedGid(list)`; `at` z místního data a času, bez času z `notifSettings.morning \|\| '08:00'`; minulost → nezapisovat, toast „Čas už minul“ |
| `taskRemSync()` | jen když jsou všechny potřebné seznamy `ready` a data jsou ze serveru: klíč bez položky / hotová → smazat; změněné `due`/`dueT` (např. upravil člen skupiny) → přepočítat `at`; změněná skupina (sdílení/zrušení) → opravit `g`. Zápisy sloučit do jednoho `updateDoc`. |
| `checkTaskReminders()` | lokální záloha bez push tokenu: splatné `at <= now && at > now − 30 min`, `lp_tknotif_<id>_<d>` proti dvojímu odeslání, `sendNotif(..., {open:'tasks', id}, [], 'task-' + id)`, pak smazat klíč |
| `tkMigrateFocus()` | kap. 5 |
| `showDaySheet(ds)` | náhrada `showDayEventsModal` s částí Úkoly |

### 6.2 Změny stávajících funkcí

| Kde | Změna |
|---|---|
| `clOps.set` | `undefined` v patchi smaže klíč |
| `addCheckItem` | text přes `parseTaskText` (respektuje ✕ náhledu), do položky `due/dueT` |
| `renderChecklist` | čip termínu pod textem, `📅 Termín` v `.cl-item-tools`, náhled pod `#cl-new-inp`, placeholder `cl.itemPh` → „Přidat položku… třeba „zítra““ |
| `toggleCheckItem` | obal `tkToggle(activeChecklist, id)` |
| `subChecklist`, `subscribeGroupChecklist` | `renderChecklist()` → `clChanged()` |
| `subModules` | `subChecklist()` i bez modulu, když je karta Úkoly viditelná (`dashOrder` obsahuje `tasks`) |
| `renderCal` | značka ✅ a třídy `has-task` / `task-over` z `getTasksForDate` |
| `calDayClick` | otevře `showDaySheet`, když má den události **nebo** úkoly |
| `#m-event` (index.html) + `addEventForDay` | odkaz „Je to spíš úkol?“ |
| `rDash` | `mw.tasks = tkDashHTML()` místo `mw.focus`; ve slotech totéž |
| `DASH_CARDS`, `dashLayout`, `dashEditAvail`, `NUDGES`, rychlý start | kap. 5 |
| `buildChatContext` | sekce `aip.ctx.s.focus` → `aip.ctx.s.tasks` (kap. 8) |
| `notifTimers` interval (u `checkPerHabitReminders`) | přidat `checkTaskReminders` |
| `consumePendingOpen` | `p.open === 'tasks'` → `sp('dashboard')`, rozbalit kartu, zvýraznit `p.id` |
| `captureOpenTargetLink` / `okNotifHabitId` | `id` pro `tasks` stejný formát `[A-Za-z0-9_-]{1,128}` |
| `loadNotifSettings` / `saveNotifSettings` | přepínač `nt-tasks` → `notifSettings.tasks` |
| `notifAskShow(why)` | text pro `why === 'task'` |
| `CHANGELOG`, `APP_VERSION` | 5.15.0 |

### 6.3 sw.js
V `notificationclick` přidat `'tasks'` do seznamu `['habit','habits','cal',…]` a `id` validovat jako u návyku. Bump `CACHE` v116. (Mění se jen `sw.js`, ne `manifest.json` ani `pwa.js` → reinstalace PWA není potřeba.)

### 6.4 functions/index.js – `processUser`, za blok jídelníčku

```js
// ── Úkoly (5.15): index v profilu, 0 čtení navíc; seznam se čte jen u splatné připomínky ──
const tr = prof.taskRem && typeof prof.taskRem === 'object' ? prof.taskRem : null;
if (tr && ns.tasks !== false) {
  const nowMs = runDate.getTime(), del = [], due = [];
  for (const [id, r] of Object.entries(tr).slice(0, 60)) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !r || typeof r.at !== 'number') { del.push(id); continue; }
    if (r.at > nowMs) continue;                         // ještě ne
    del.push(id);                                       // splatné i propadlé se vždy odeberou
    if (nowMs - r.at <= TASK_STALE) due.push([id, r]);  // TASK_STALE = 30 min
  }
  const send = [];
  for (const [id, r] of due.slice(0, 5)) {
    try {
      let path;
      if (r.g) {                                        // skupina: jen člen a se sdíleným checklistem
        const fam = (await famEntry(r.g).doc); const f = fam.exists ? fam.data() : null;
        if (!f || !f.members?.[uid] || f.shareChecklist === false) continue;
        path = `families/${r.g}/checklists/${r.l}`;
      } else path = `users/${uid}/checklists/${r.l}`;
      const ls = await db.doc(path).get();              // 1 čtení, jen teď
      const it = (ls.data()?.items || []).find(i => i && i.id === id);
      if (!it || it.done || it.due !== r.d || (it.dueT || '') !== (r.t || '')) continue;
      send.push([id, String(it.text || '').slice(0, 80), r]);
    } catch(e) { console.error(`[LP] úkol uid=${uid}:`, e.code || e.message); }
  }
  if (del.length) {
    // Klíče dřív než push (jako waterSent): když zápis selže, nic se neposílá → nikdy dvakrát
    try { await db.doc(`users/${uid}/profile/main`).update(...del.flatMap(id => [new FieldPath('taskRem', id), FieldValue.delete()])); }
    catch(e) { console.error(`[LP] taskRem uid=${uid}:`, e.message); send.length = 0; }
  }
  for (const [id, text, r] of send) {
    try { await push(r.t ? tS(L,'task.t',{task:text}) : tS(L,'task.am.t',{task:text}),
                     r.t ? tS(L,'task.b',{time:r.t}) : tS(L,'task.am.b'),
                     `task-${id}`, {data: {open: 'tasks', id}, ttl: TTL_EVENT}); }
    catch(e) { console.error(`[LP] úkol push uid=${uid}:`, e.message); }
  }
}
```
Texty do `functions/i18n-server.js` (cs/en). `FieldValue` i `FieldPath` už jsou v souboru importované (ř. 4). Tag `task-<id>` shodný s `data.tag` řeší `sendPushToUser`.

### 6.5 index.html
- `#m-task` (`.moverlay`) s prvky z 1.4, ids `tk-text`, `tk-date`, `tk-time` (`data-time-picker`), `tk-rem`, `tk-star`.
- Přepínač `nt-tasks` v Nastavení → Upozornění vedle návyků.

### 6.6 style.css (nové třídy, jen tokeny motivů)

```css
/* Úkoly (5.15) – karta na Domů, čipy, kalendář */
.tk-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px}
.tk-add{display:flex;gap:8px;margin-bottom:6px}
.tk-inp{flex:1;min-width:0;min-height:44px;font-size:16px} /* 16 px = iOS nezoomuje */
.tk-addbtn{width:44px;height:44px;flex-shrink:0;border-radius:12px;background:var(--accent);color:var(--on-accent);border:none;font-size:22px}
.tk-prev{display:flex;flex-wrap:wrap;gap:6px;min-height:0;margin-bottom:6px}
.tk-chip{display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:0 4px 0 10px;border-radius:16px;
  background:var(--card2);border:1px solid var(--border);color:var(--text2);font-size:13px}
.tk-chip button{width:32px;height:32px;border:none;background:none;color:var(--text3);font-size:14px} /* + 6 px okolí ≥ 44 px plochy přes padding řádku */
.tk-sec{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);
  margin:12px 0 2px;display:flex;justify-content:space-between;align-items:center}
.tk-sec.over{color:var(--red)}
.tk-row{display:flex;align-items:center;gap:4px;min-height:44px;border-bottom:1px solid var(--border)}
.tk-row:last-child{border-bottom:none}
.tk-chk{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:none;border:none;margin-left:-11px}
.tk-box{width:22px;height:22px;border-radius:6px;border:2px solid var(--text3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.tk-row.done .tk-box{background:var(--green);border-color:var(--green);color:var(--on-green)}
.tk-txt{flex:1;min-width:0;min-height:44px;display:flex;align-items:center;text-align:left;background:none;border:none;
  color:var(--text);font-size:15px;overflow-wrap:anywhere;padding:0}
.tk-row.done .tk-txt{text-decoration:line-through;color:var(--text3)}
.tk-row.star .tk-txt{font-weight:700}
.tk-meta{font-size:12px;color:var(--text2);white-space:nowrap;flex-shrink:0}
.tk-meta.over{color:var(--red)}
.tk-row.flash{background:var(--card2);transition:background 1.2s}
@media (prefers-reduced-motion:reduce){.tk-row.flash{transition:none}}
.cl-due{display:block;font-size:12px;color:var(--text2);margin-top:2px}
.cl-due.over{color:var(--red)}
.cal-cell.has-task .cal-cell-tk{font-size:10px;line-height:1}
.cal-cell.task-over .cal-cell-tk::after{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--red);margin-left:1px;vertical-align:top}
```
Kontrasty (text proti pozadí karty): `--text2` 5,3:1 (dark-gold), 5,7:1 (sunshine), 5,9:1 (tangerine); `--red` 6,0:1 / 5,6:1 / 5,3:1; zelený čtvereček s `--on-green` je v motivech už definovaný. Žádné nové barvy.

### 6.7 i18n (cs / en, výběr)

| klíč | cs | en |
|---|---|---|
| `dash.card.tasks` | Úkoly | Tasks |
| `tk.ph` | Přidej úkol… třeba „zítra“ | Add a task… e.g. “tomorrow” |
| `tk.addAria` | Přidat úkol | Add task |
| `tk.sec.over` | Po termínu · {n} | Overdue · {n} |
| `tk.sec.today` / `tk.sec.tmrw` / `tk.sec.later` | Dnes / Zítra / Později | Today / Tomorrow / Later |
| `tk.allToday` | Vše na dnes | All to today |
| `tk.doneToday` | Na dnešek máš hotovo 🎉 | All done for today 🎉 |
| `tk.nothingToday` | Na dnešek nic. Další: {when} | Nothing today. Next: {when} |
| `tk.es.t` | Napiš úkol a kdy ho chceš udělat. Zkus třeba: | Write a task and when you want to do it. Try: |
| `tk.es.ex1..3` | Koupit žárovky zítra / Zavolat mámě v pátek v 18:00 / Zaplatit nájem 15. 11. | Buy light bulbs tomorrow / Call mom on Friday at 6pm / Pay rent on Nov 15 |
| `tk.prevAria` | Rozpoznáno: {when} | Recognised: {when} |
| `tk.ignore` | Nerozpoznávat | Don’t use |
| `tk.when` | Kdy | When |
| `tk.weekend` / `tk.noDate` / `tk.otherDate` | Víkend / Bez termínu / Jiné datum… | Weekend / No date / Other date… |
| `tk.remind` | Připomenout | Remind me |
| `tk.remAt` / `tk.remAm` | V {time} v den úkolu. / Ráno v {time} v den úkolu. | At {time} on the day. / In the morning at {time} on the day. |
| `tk.star` | Hlavní úkol dne | Main task of the day |
| `tk.list` | Seznam: {name} | List: {name} |
| `tk.added` | Přidáno na {when} | Added for {when} |
| `tk.pastTime` | Ten čas už minul, připomínku jsem nenastavil. | That time has passed, no reminder set. |
| `tk.focusMoved` | 🎯 Hlavní úkol je teď v Úkolech | 🎯 Your main task now lives in Tasks |
| `tk.calHint` | Je to spíš úkol? ✅ Přidat jako úkol | More of a to-do? ✅ Add as task |
| `nt.tasks` | Připomínky úkolů | Task reminders |
| server `task.t` / `task.b` | ✅ {task} / Úkol na dnes v {time} | ✅ {task} / Task for today at {time} |
| server `task.am.t` / `task.am.b` | ✅ Dnes tě čeká: {task} / Klepni a odškrtni, až bude hotovo. | ✅ Today: {task} / Tap and tick it off when done. |

---

## 7. Výkon

| Oblast | Dopad |
|---|---|
| Listenery | Žádný nový. Úkoly čtou stávající `subChecklist` a `subscribeGroupChecklist`. Bez modulu Checklist se `subChecklist` zapne kvůli kartě (typicky 1–3 dokumenty při startu, pak jen změny). |
| Vedlejší skupiny | Dnes se jejich checklisty odebírají až při otevření Checklistu. Doporučení: s viditelnou kartou Úkoly odebírat i je (max. 5 skupin × počet seznamů, jednorázově za relaci) – jinak by úkoly z vedlejší skupiny chyběly. Viz Q4. |
| Výpočet | `tkAll()` memo podle `_tkVer` (zvýší se jen ve snapshotu nebo lokálním zápisu); index podle dne O(počet položek). `tkDashRefresh` přepisuje jen kartu, ne celé `rDash`. |
| Kalendář | 0 čtení; `getTasksForDate` z indexu. |
| Cron | 0 čtení na běh navíc (profil se čte už teď). U splatné připomínky 1 čtení seznamu (+ dokument skupiny z `famEntry` cache) a 1 zápis (smazání klíče). Profil roste nejvýš o ~50 × 90 B. |
| Zápisy | Odškrtnutí = 1 transakce (jako dnes). Nastavení připomínky = +1 `updateDoc` profilu. `taskRemSync` slučuje opravy do jednoho zápisu a běží jen po změně dat. |
| Velikost dokumentu | Seznam Úkoly se plní hotovými položkami → výraznější „Smazat hotové“ (3.1). |

---

## 8. Soukromí

- **Kde jsou data:** jen v položkách checklistů (osobní: `users/{uid}`, sdílené: `families/{gid}`) a index `taskRem` (id + čas, bez textu) v profilu.
- **Skupina:** úkol ve sdíleném seznamu vidí všichni členové (termín i hvězdu), jako dnes položku. Moji připomínku nevidí. Aktivita do feedu skupiny jako dnes (`gaCheck`).
- **Export:** beze změny kódu – `checklists` i `profile` už jsou v `EXPORT_COLS` (položky s `due` i `taskRem` se exportují). Skupinové seznamy se neexportují (stávající pravidlo).
- **Smazání účtu:** `deleteAccount` maže `users/{uid}` rekurzivně → `taskRem`, `taskList` i osobní úkoly zmizí. Úkoly ve skupinových seznamech zůstávají skupině (stávající chování obsahu skupiny).
- **AI (`buildChatContext`):** sekci Fokus nahradí sekce Úkoly (úroveň 1): po termínu (počet + nejvýš 5), dnes, zítra a dalších 7 dní, každý `ctxT(text,60)` + den (`ctxDay`) + čas, 🎯 u hlavního; skupinové jen ze skupin, které už v kontextu jsou (`famOk`, `groupModShared`). Do ~600 znaků. V řádcích checklistu (`clLine`) vynechat položky s `due`, ať se nic neposílá dvakrát. Data dál označená jako data. Fotky nikdy.
- **privacy.html / privacy-en.html:** v bodě o AI nahradit „fokus“ za „úkoly s termínem (text, datum, čas)“; v seznamu dat doplnit „termín, čas a označení hlavního úkolu u položek checklistu; v profilu seznam nastavených připomínek úkolů (id položky a čas, bez textu)“. Server čte text úkolu jen v okamžiku odeslání připomínky.

---

## 9. MVP pro jednoho kodera (5.15.0)

Pořadí práce (vše v `app.js` jedním koderem, server a sw.js lze v tomtéž commitu):
1. `parseTaskText` + `tkDueLabel` (testovatelné v node, tabulka z kap. 4).
2. Datový model: `clOps.set` s mazáním klíčů, `tkToggle`, `clChanged`, `tkAll`/`getTasksForDate`.
3. Checklist: náhled v přidávání, čip termínu, `📅 Termín` → `#m-task`.
4. Karta Úkoly na Domů + `DASH_CARDS`/`dashLayout`/slots/nabídka/rychlý start.
5. Kalendář: značka v buňce, `showDaySheet`, odkaz „Je to spíš úkol?“.
6. Převod fokusu (`tkMigrateFocus`), odstranění UI fokusu.
7. Připomínky: `taskRemSet`/`taskRemSync`/`checkTaskReminders`, cron blok, `sw.js`, nastavení `nt-tasks`.
8. AI kontext, i18n cs/en (app + server), privacy, changelog, `APP_VERSION` 5.15.0, `CACHE` v116.

Odhad: app.js ~600–750 řádků, index.html ~40, style.css ~40, functions ~50, i18n ~2×70 klíčů.

**Do MVP nepatří (fáze 2):**
- Přiřazení „pro koho“: pole `who: uid` u položky skupinového seznamu, avatar člena v řádku, filtr karty „Moje / Všechny“, oznámení adresátovi přes aktivitu s `to` (pravidlo `activity` pole `to` už povoluje, ověřit `gnModeOf`/`wanted` na serveru). Připomínku si adresát zapíná sám (cizí profil zapsat nejde), případně ji jeho klient nabídne při prvním zobrazení.
- Opakované úkoly: `rep: 'd'|'wd'|'w'|'m'`; odškrtnutí = hotová položka zůstane a vznikne nová s dalším `due` (v kalendáři jen nejbližší výskyt). Stav „opakovaný“ = ikonka 🔁 v čipu.
- „Hotovo“ přímo v notifikaci, odložení o 15 min (potřebuje podepsaný endpoint → nová funkce).
- „Ráno / večer / příští týden“ v parseru, přesun úkolu mezi seznamy, týdenní pohled úkolů v kalendáři, úkoly v seznamu „nadcházející“.
- Založení úkolu z AI chatu („připomeň mi zítra…“).
- Série hlavních úkolů 🎯.
- Body a odznaky za úkoly (riziko „farmaření“ bodů; zatím ne).

---

## 10. Rizika

| Riziko | Opatření |
|---|---|
| `taskRemSync` smaže připomínku, protože seznam skupiny ještě není načtený | Spouštět jen když jsou `ready` všechny skupiny z `taskRem.g` a osobní snapshot není z cache. |
| Starší klient na jiném zařízení dál píše `focusToday` | Changelog; SW network-first; převod jen jednou, další data starého klienta se ignorují. |
| Falešné rozpoznání („Verze 5.14“, „po obědě“) | Konzervativní vzory, náhled vždy viditelný, ✕ = doslovný text. |
| Záměna názvu s „úkoly“ v Cílech (úkoly pod podcílem) | V Cílech zůstává „úkol“ v kontextu podcíle; na Domů a v kalendáři jsou úkoly jen z checklistů. Do budoucna zvážit přejmenování v Cílech na „kroky“ (Q6). |
| Kolize úprav ve skupině (dva členové mění termín) | Transakce `clSave` jako dnes; poslední zápis vyhrává po položce. |
| Růst seznamu Úkoly k limitu 1 MiB | Výraznější „Smazat hotové“; fotky u úkolů se nedoporučují v nápovědě. |
| Časové pásmo: `at` počítá klient | Absolutní ms → server nepotřebuje zónu; po změně zóny se `due` jako místní den nemění, `at` se přepočítá v `taskRemSync` jen při změně položky (přijatelné). |
| Dvojí připomínka (lokální + server) | Stejné rozdělení jako u návyků (`hasPushToken`); klíč se po odeslání maže na obou stranách. |
| Karta bez modulu Checklist | `→` otevře `sp('checklist')`, stránka funguje i mimo lištu (stejně jako otevření z notifikace). Ověřit v jednoduchém režimu. |

---

## 11. Otázky (výchozí volba = moje doporučení)

1. **Q1 Sloučit Hlavní úkol do Úkolů a zrušit tečky/sérii fokusu?** Výchozí: **ano**, hvězda 🎯 místo samostatné karty.
2. **Q2 Kam rychlé přidání bez výběru seznamu?** Výchozí: **seznam Úkoly** (`prof.taskList`); čip pro jiný seznam jen při víc seznamech.
3. **Q3 Uživatel měl kartu Hlavní úkol schovanou – ukázat Úkoly?** Výchozí: **ukázat** (nová funkce, schovat jde jedním klepnutím v Upravit Domů).
4. **Q4 Úkoly z vedlejších skupin na Domů (víc listenerů)?** Výchozí: **ano**, odebírat checklisty všech skupin se sdíleným checklistem, když je karta vidět (max. 5 skupin).
5. **Q5 Připomínka bez času – kdy?** Výchozí: **v čase ranního souhrnu** (`notifSettings.morning`, jinak 8:00) v den úkolu.
6. **Q6 Přejmenovat „úkoly“ v Cílech na „kroky“?** Výchozí: **ne teď**, jen do backlogu.
7. **Q7 „v pátek“ řečeno v pátek = dnes, nebo za týden?** Výchozí: **za týden** (pro dnešek se říká „dnes“; náhled datum ukáže).
8. **Q8 Úkoly v kalendáři u minulých dnů s nesplněným úkolem červeně?** Výchozí: **ano**, jen malá červená tečka u ✅.

---

## Shrnutí

Úkol je obyčejná položka checklistu s nepovinným termínem (`due`), časem (`dueT`), hvězdou hlavního úkolu (`star`) a časem splnění (`doneAt`). Data leží jen v checklistu. Domů, kalendář i checklist je čtou z paměti a odškrtávají jednou funkcí `tkToggle`. Na Domů nahradí kartu „Hlavní úkol“ nová karta ✅ Úkoly se sekcemi Po termínu / Dnes / Zítra / Později a jedním polem, které bez AI rozpozná „zítra“, „pozítří“, „v pátek“, „15. 11.“ a „v 18:00“ (cs i en) a ukáže náhled, který jde zrušit. Dnešní a zítřejší hlavní úkol se jednorázově převede na úkol s 🎯 a deterministickým id, takže nevzniknou duplicity. Připomínky jdou přes stávající cron s indexem v profilu: 0 čtení navíc na běh, 1 čtení a 1 zápis jen v okamžiku připomínky. Bez push tokenu běží lokálně. Pravidla Firestore, indexy a Cloud Functions se nemění, mění se jen tělo cronu a `sw.js` (bump `CACHE`). MVP zvládne jeden koder ve verzi 5.15.0. Přiřazení členovi, opakování a „Hotovo“ přímo v notifikaci jsou fáze 2.
