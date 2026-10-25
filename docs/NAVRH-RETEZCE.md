# Návrh: řetězení návyků 🔗 (rutina, „habit stacking“)

Zadání (Adam): „Návyk je třeba čištění zubů. Jakmile si vyčistím zuby, následuje protažení, pak 20 kliků, pak otužování. Takový follow-up, workflow, kdy jeden návyk navazuje na druhý.“

Výchozí stav: verze 4.88, cíl MVP **4.89**. Čísla řádků jsou orientační, koder ať hledá podle názvu funkce.

## 0. Co jsem v kódu zjistil

| Zjištění | Místo | Důsledek |
|---|---|---|
| Návyk patří do jedné skupiny `group` (morning/day/evening, bez skupiny = day), pořadí je `order` v rámci skupiny. Přetažení (`enableDragReorder` → `saveHabitOrder`) i šipky ▲▼ (`moveHabit`) přečíslují celou skupinu jednou dávkou. | `renderHabits`, `saveHabitOrder`, `moveHabit` | Pořadí ve skupině už **je** sekvence. Řetěz nepotřebuje vlastní seznam ID, stačí příznak „navazuje na návyk nad sebou“. |
| Formulář umí jen založení. Úprava existujícího návyku se dělá v detailu po sekcích (připomínka, štíty, pauza, sdílení, archiv). | `saveHabitImpl`, `renderHabitDetail` | Nastavení navázání patří do detailu jako další sekce, ne do formuláře. |
| Typy: ano/ne (`toggleHabit`: prázdno → splněno → nesplněno → prázdno) a počítaný (`adjustHabit`, `directInput`, splněno = `value >= goal`). Přeskočení `skipHabitDay` (log `skipped`). | ~3068–3165 | Krok je splněný přes `hDone()`. Přeskočený i nesplněný krok je vyřízený a řetěz pokračuje. |
| `isHabitPending(h, ds)` vrací „dnes na řadě a nic neoznačeno“ (řeší frekvenci, pauzu, týdenní cíl, start). | ~2636 | Stejná funkce určí **další krok**. Žádná nová logika frekvencí. |
| Filtr „Jen nevyřízené“ (`lp_hb_pending`) skryje vyřízené a vypne přetahování. | `renderHabits` | Řetěz musí fungovat i na podmnožině. |
| Připomínka = `reminderTime` u návyku. Server (`sendScheduledNotifications`) nepošle `habit.nag`, když log má `done/failed/skipped`, nebo když je návyk propojený s vodou. Notifikace má akci „Hotovo“ → `handleNotifHabitDone`. | functions/index.js ~1408 | MVP bez změny serveru, viz §4. |
| Body (`dayXP`) a série (`habitStreak`) se počítají po návycích. | ~7805, ~2364 | Řetěz body ani série nemění. |
| Propojení s vodou zapisuje log `src:'water'` automaticky. | `wtHabitSync` | Automatické splnění nesmí vyskočit s nabídkou dalšího kroku. |
| Domů: widget návyků (`mw.habits`, prvních 4) a v jednoduchém režimu karta „Co teď“ (`coTedHTML`, 3 nevyřízené ano/ne). | ~16662, ~7554 | MVP: jen „Co teď“ ukazuje u řetězu aktuální krok. |
| Pravidla: `users/{uid}/**` jen vlastník, pole návyku se nevalidují. | firestore.rules | Nové pole v `habits/{id}` **bez změny pravidel**. |

## 1. Model: rutina = souvislý úsek ve skupině

Varianty:

| | A) Rutina jako entita (`routines: [{name, ids[]}]`) | B) `after: habitId` u návyku | **C) Příznak `chain: true` u návyku (doporučuji)** |
|---|---|---|---|
| Data | nový seznam v profilu, synchronizace s `order` | ukazatele, možné cykly, větvení (2 návyky po jednom), osiřelá ID po smazání | jedno pole `chain: true` = „navazuji na návyk **nad sebou** ve skupině“ |
| Pořadí | dvojí (rutina vs. skupina), mohou se rozjet | dvojí | jediné: stávající `order` |
| Smazání / archiv | nutný úklid ID | nutný úklid, jinak se řetěz přetrhne | nic: řetěz se „zacelí“ (soused nad se stane předchozím) |
| Pro uživatele | nová obrazovka, nový pojem | srozumitelné, ale pořadí se ukazuje jinak než seznam | **vidí to, co nastavil**: návyky pod sebou spojené čarou |

**Rozhodnutí: C.**
- Rutina je souvislý úsek návyků v jedné skupině. První krok má `chain` nepravdivé nebo chybějící, každý další má `chain: true`.
- Ve skupině může být víc rutin. Úsek končí u prvního návyku bez `chain`.
- `chain: true` u prvního aktivního návyku skupiny se ignoruje, protože nad ním nic není.
- Archivované návyky se do úseku nepočítají. Řetěz se počítá jen z aktivních (`!archived`) seřazených podle `order`.
- Název rutiny se neukládá. Hlavička se odvodí ze skupiny: „Ranní rutina“, „Denní rutina“, „Večerní rutina“.
- Jeden návyk nemůže být ve dvou rutinách. Model to vylučuje sám, viz §5.

Data: `users/{uid}/habits/{id}.chain` (boolean, chybí = false). Nic v profilu, žádná podkolekce, žádná změna pravidel ani indexů. Odvozená struktura jen v paměti: `chainOf(h)` vrací pole návyků úseku, nebo null, když je návyk sám.

## 2. Nastavení (telefon, palec)

### 2.1 Hlavní cesta: tlačítko „🔗 Rutina“ vedle filtru

```
┌──────────────────────────────────────┐
│ [⏳ Jen nevyřízené] [🔗 Rutina]      │  dva čipy v .hb-filter, výška 44 px
```

Klepnutí otevře okno (`.moverlay` + `.modal`):

```
┌──────────────────────────────────────┐
│ 🔗 Spojit návyky do rutiny        ×  │
│ Klepej v pořadí, jak je děláš.       │
│ [🌅 Ráno] [☀️ Přes den] [🌙 Večer]   │  přednastavená skupina podle času (jako formulář)
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ (1) 🪥 Čištění zubů              │ │  řádek 52 px, celý klepací
│ │ (2) 🧘 Protažení                 │ │  číslo v kroužku = pořadí v rutině
│ │ ( ) 📖 Čtení                     │ │  nevybrané: prázdný kroužek
│ │ (3) 💪 20 kliků                  │ │  opětovné klepnutí krok odebere, ostatní se přečíslují
│ │ (4) 🧊 Otužování                 │ │
│ └──────────────────────────────────┘ │
│ 🔔 Připomene ti ji 1. krok (7:00).   │  jen když má 1. krok připomínku
│                                      │
│ [ Zrušit ]        [ Uložit rutinu ]  │  Uložit aktivní od 2 vybraných
└──────────────────────────────────────┘
```

Proč klepání v pořadí a ne přetahování: jde to jednou rukou, nehrozí, že se omylem posune stránka, a pořadí je vidět hned. Přetahování zůstává v seznamu pro jemné úpravy.

Co se uloží (`chainSave(group, ids)`, jedna dávka `writeBatch`):
1. Vybrané návyky se ve skupině seřadí za sebe na místo prvního vybraného, ostatní si zachovají vzájemné pořadí.
2. Vybraný 1. krok dostane `chain: false`, kroky 2 až N `chain: true`.
3. Pokud první nevybraný návyk pod rutinou měl `chain: true`, dostane `false`, jinak by se přilepil.
4. Kroky 2 až N, které měly `reminderTime`, ho ztratí a appka to oznámí toastem (§4).
5. Okno nabízí jen aktivní návyky vybrané skupiny. Pokud už ve skupině rutina je, otevře se s jejími kroky předvybranými (úprava i rozpojení na jednom místě). Při víc rutinách ve skupině se předvybere ta první.

Čip „🔗 Rutina“ se ukáže, až má uživatel v některé skupině aspoň 2 aktivní návyky.

### 2.2 Detail návyku: sekce „🔗 Rutina“ (nad připomínkou)

- **Návyk v rutině:** „Ranní rutina · krok 2 ze 4“ a pod tím kroky jako malé čipy (aktuální zvýrazněný). Dvě tlačítka:
  - `[Upravit rutinu]`: otevře okno z §2.1;
  - `[Odpojit tento krok]`: `chain: false` u kroku i u návyku pod ním, když měl `true` a tímto by začal novou rutinu. Výsledek: krok je samostatný a zbytek se zacelí. Odpojený krok se přesune na konec skupiny, ať neleží uprostřed.
- **Samostatný návyk:** jeden řádek „Navázat na: [🪥 Čištění zubů ▾]“. Výběr nabízí návyky stejné skupiny. Návyk se přesune hned pod vybraný a dostane `chain: true`.

### 2.3 Přetahování a šipky (pravidlo, ať se rutina nerozpadne omylem)

V `saveHabitOrder` dostane přesunutý návyk `chain` podle místa, kam dopadl:
- `true`, když dopadl dovnitř rutiny (návyk pod ním má `chain: true`);
- jinak `false`.

Návyk, který byl pod ním na původním místě, svůj příznak nemění, takže se mezera zacelí. Návyk puštěný přímo pod poslední krok se k rutině **nepřipojí**, připojení je jen vědomá volba (okno, detail).

## 3. Používání během dne

### 3.1 Seznam návyků (MVP)

Před (dnes):
```
🌅 Ráno                       1/5  20%
┌ 🪥 Čištění zubů         ✓ ┐
┌ 🧘 Protažení            ○ ┐
┌ 📖 Čtení                ○ ┐
```

Po:
```
🌅 Ráno                       1/5  20%
  🔗 Ranní rutina · 1/4            ← řádek 28 px, text --text2, číslo --accent
┃┌ 🪥 Čištění zubů         ✓ ┐     ← svislá spojnice vlevo mezi kartami (2 px)
┃┌ 🧘 Protažení            ○ ┐  ◀ DALŠÍ: rámeček --accent + štítek „Další“
┃┌ 💪 20 kliků        − 0/20 + ┐
 └ 🧊 Otužování            ○ ┘
┌ 📖 Čtení                ○ ┐     ← mimo rutinu, beze změny
```

- Hlavička rutiny ukazuje počet hotových ze dnešních kroků. Do jmenovatele jde splněno + nesplněno + čeká. Přeskočené kroky a kroky mimo frekvenci se nepočítají, stejně jako u statistik (`habitDayState` neutral).
- **Další krok** = první krok rutiny v pořadí, pro který platí `isHabitPending`. Dostane `.hb-next`. Štítek „Další“ je text, ne jen barva (přístupnost).
- Hotové kroky se v MVP nesbalují (karta dál ukazuje 7denní tabulku jako ostatní).
- Filtr „Jen nevyřízené“: hlavička rutiny zůstane („🔗 Ranní rutina · 2/4“), vidět jsou jen nevyřízené kroky, spojnice jen mezi nimi.
- Jiný den než dnes (šipky dne): hlavička i zvýraznění podle zvoleného dne, lišta z §3.2 se nezobrazí.

### 3.2 Lišta „Další krok“ (MVP, jádro funkce)

Když uživatel **dnes** splní nebo přeskočí krok rutiny a v rutině ještě něco čeká:

```
┌────────────────────────────────────┐
│ ✓ Hotovo! Další: 🧘 Protažení      │   .cta-ask (bottom 136 px, nad lištou)
│        [⏭] [ ✓ Hotovo ]  [×]       │   tlačítka 44×44, Hotovo = --accent
└────────────────────────────────────┘
```

- `✓ Hotovo` splní další krok a lišta se hned přepíše na následující. Celou rutinu tak jde odklikat palcem na jednom místě.
- U počítaného kroku je text tlačítka „✓ 20/20“ a nastaví `value = goal`. Kdo chce zapsat jen část, klepne do karty.
- `⏭` = přeskočit dnes (`skipHabitDay`), lišta posune na další krok.
- `×` lištu zavře. Sama zmizí po 15 s (pauza při focusu, stejně jako `wtLinkOffer`).
- Poslední krok: místo lišty toast „🎉 Ranní rutina hotová (4/4)“, jen když jsou aspoň 2 kroky splněné.
- Zobrazuje se jen po akci uživatele na tomto zařízení: klepnutí v seznamu, detailu, kartě „Co teď“ nebo akce „Hotovo“ z notifikace. Nezobrazuje se po automatickém splnění vodou (`src:'water'`), po změně z druhého zařízení ani při zpětném zápisu minulého dne.
- Když je otevřené okno nebo už svítí jiná `.cta-ask` (nabídka sdílení, vody, instalace; `naCovered()`), ukáže se místo lišty jen toast „Další: 🧘 Protažení“.

### 3.3 Domů

- Karta „Co teď“ (jednoduchý režim): ze seznamu nevyřízených se u každé rutiny nechá **jen aktuální krok**, ostatní kroky rutiny vypadnou. Po odškrtnutí se objeví další krok.
- Widget návyků: v MVP beze změny.

### 3.4 Na později (4.90+)

| Funkce | Proč až potom |
|---|---|
| ▶ „Spustit rutinu“: celá obrazovka, jeden krok, velké tlačítko, Přeskočit, ukazatel 2/4 | Lišta pokryje 80 % potřeby. Režim je samostatná obrazovka (historie Zpět, zámek displeje, časovač). |
| Sbalení hotových kroků do řádku „✓ 🪥 🧘“ | Až podle zpětné vazby, mění vzhled karet. |
| Řádek rutiny ve widgetu Domů („🔗 Ranní rutina 2/4 · Další: 🧘“) | Widget má pevný limit 4 řádků. |
| Řetězová připomínka na serveru (§4.3) | Změna funkcí a nasazení. |
| Odznak „Rutina 7 dní v kuse“, body za celou rutinu | Riziko „farmení“, potřeba sladit s `NAVRH-GAMIFIKACE.md`. |
| AI kontext: „Ranní rutina: 🪥 → 🧘 → 💪 → 🧊“ v `buildChatContext` | Drobnost, pár znaků navíc z limitu ~7000. |
| Ukázková rutina v šabloně onboardingu, jednorázový tip | Až se ověří, že funkce je srozumitelná. |

## 4. Připomínky

### 4.1 Pravidlo

**Rutina má jednu připomínku, a to připomínku prvního kroku.** Navazující kroky vlastní `reminderTime` nemají. Lišta „Další“ je připomínka v okamžiku, kdy dává smysl, takže další notifikace by jen otravovaly.

### 4.2 MVP bez změny serveru

- Při navázání (okno, detail, přetažení dovnitř rutiny) se krokům 2 až N smaže `reminderTime`. Toast: „🔔 Připomínku 7:30 u Protažení jsem vypnul, rutinu připomene první krok.“
- Detail navazujícího kroku místo nastavení připomínky ukáže: „🔔 Připomíná první krok rutiny (🪥 Čištění zubů, 7:00).“ Klepnutí otevře jeho detail.
- Server se nemění. Navazující kroky nemají `reminderTime`, a tak nic nepošle. 1. krok se chová jako dnes: splněný, nesplněný nebo přeskočený se nepřipomíná (pravidlo 4.80 zůstává).
- Akce „Hotovo“ v notifikaci 1. kroku splní krok. Po otevření appky (`handleNotifHabitDone`) se ukáže lišta „Další“.
- Mezera MVP: když uživatel 1. krok přeskočí nebo splní a zbytek nechá ležet, připomínka nepřijde. Je to vědomé, protože rutina se dělá v jednom zátahu.

### 4.3 Později (server, 4.90+)

V `sendScheduledNotifications` v čase připomínky 1. kroku: když je 1. krok vyřízený, ale rutina ne, připomenout **první čekající krok** textem `habit.chainNag` („Ranní rutina čeká: další je 🧘 Protažení“). Data jsou v `getDueHabits()` už načtená, žádné čtení navíc. Logika `chainOf` se musí shodovat s klientem (jako `isHabitDueToday`), hlídat v ci-check.

## 5. Okrajové případy

| Případ | Chování |
|---|---|
| Krok dnes není na řadě (dny v týdnu, týdenní cíl splněný, pauza, před založením) | Přeskočí se: není „další“, nepočítá se do X/Y, spojnice zůstává. Řeší `isHabitPending` a `habitDayState`. |
| Krok archivovaný | Z rutiny vypadne, zbytek se zacelí. Po obnovení se vrátí na své `order` s původním `chain`, takže se do rutiny vrátí, pokud tam místo zůstalo. |
| Krok smazaný | Stejné jako archiv, úklid není potřeba (žádná ID jinde). |
| 1. krok archivovaný nebo smazaný | Prvním krokem se stane další. Jeho `chain: true` se ignoruje, protože nad ním v úseku nic není. Připomínku nemá (smazaná při navázání), proto po archivaci 1. kroku toast „Rutina teď začíná krokem 🧘 Protažení. Chceš nastavit připomínku?“ s tlačítkem do detailu. |
| Počítaný krok (20 kliků) | Povolený. Hotovo = `value >= goal`, částečná hodnota krok nechá jako další. Lišta nastaví plný cíl. |
| Ano/ne cyklus (splněno → klepnutí → nesplněno) | Lišta se ukáže jen při přechodu na splněno (nebo přeskočeno). Nesplněno je vyřízené, další krok se zvýrazní, lišta ne. |
| Propojení s vodou | Návyk může být krokem. Automatické splnění lištu nevyvolá, krok se jen označí hotový. |
| Sdílení ve skupině | Rutina je osobní. Zrcadla (`myMirrors`) nesou jednotlivé návyky jako dnes, `chain` se nesdílí. Sdílené návyky ostatních (`renderSharedHabits`) rutiny nemají. |
| Návyk ve dvou rutinách | **Ne.** Model to nedovolí (jedna pozice ve skupině). Ranní a večerní čištění zubů jsou stejně dva návyky. |
| Offline | Zápisy přes dávku Firestore (lokálně hned, server po připojení). Lišta a zvýraznění se počítají z paměti, fungují. |
| Dvě zařízení | `chain` a `order` jsou v dokumentech návyků, synchronizují se. Lišta je jen na zařízení, kde se klepalo. Druhé po snapshotu zvýrazní správný další krok. Souběžná úprava: vyhraje poslední zápis. Struktura je odvozená, takže nevzniknou cykly ani osiřelá ID, nanejvýš jiný tvar rutiny. |
| Po půlnoci (`habitDayRoll`) | Nový den, rutina začíná od 1. kroku, lišta se zavře. |
| Měsíční pohled | Beze změny (bez rutin). |
| Kroky v různých skupinách | Nejde. Rutina je vždy v jedné skupině, okno nabízí jen jednu skupinu. |
| Starý klient (bez 4.89) | Pole `chain` ignoruje, vidí obyčejné návyky ve stejném pořadí. Nic se nerozbije. |

## 6. Jednoduchý režim a nováčci

- **Jednoduchý režim:** čip „🔗 Rutina“ a sekce v detailu se skryjí (`isSimple()`), dokud není odemčený modul návyků (`unl('habits')`). Pokud rutinu už uživatel má (založil ji v plném režimu), zobrazení i lišta fungují dál, protože pomáhají. Karta „Co teď“ ukazuje jen aktuální krok (§3.3).
- **Nováčci:** v MVP nic nového se nenabízí, aby první dny nebyly přeplněné.
- Na později jednorázový tip (`ctaListTipHTML` styl): až má uživatel ve skupině aspoň 3 návyky a účet starší 7 dní. Text: „💡 Tip: Spoj ranní návyky do rutiny. Po každém ti appka hned nabídne další.“

## 7. Pro kodéra (4.89, MVP)

### 7.1 Data a logika (app.js)

1. Pole `chain` (boolean) v `habits/{id}`. Při zakládání (`saveHabitImpl`, šablony, AI) se nenastavuje.
2. `chainOf(h)`: aktivní návyky skupiny seřazené podle `order` (stejný řadič jako `renderHabits`). Úsek obsahující `h` (start = nejbližší návyk nad bez `chain`, konec = před dalším bez `chain`). Délka < 2 → null. Cache po dobu renderu (reset v snapshotu návyků).
3. `chainNextStep(steps, ds)`: první krok s `isHabitPending`. `chainProgress(steps, ds)` vrátí `{done, total}`, kde total = kroky s `habitDayState` ≠ neutral.
4. `renderHabits`: uvnitř `.habit-group-body` obalit kroky rutiny do `<div class="hb-chain">` s hlavičkou. Další krok dostane `.hb-next` a štítek. Ve filtru jen nevyřízené kroky. **Pozor:** `enableDragReorder` bere `.habit-card` jako potomky `.habit-group-body`, takže obal je nutné ověřit (selektor hledá `querySelectorAll`, mělo by fungovat i vnořeně, otestovat přetažení přes hranici rutiny).
5. `saveHabitOrder(ids, movedId)`: přidat výpočet `chain` přesunutého návyku (§2.3) do stejné dávky. `enableDragReorder` musí předat ID taženého řádku (nový třetí argument callbacku). `moveHabit` předá `id`.
6. `chainSave(group, ids)`: okno z §2.1, jedna dávka (`order`, `chain`, smazání `reminderTime` u kroků 2 až N, oprava `chain` souseda pod). Ochrana proti dvojímu uložení přes `guardSave`.
7. `chainDetach(hid)`, `chainAttach(hid, afterId)`: detail §2.2.
8. `chainAfter(hid, ds, how)`: volat po akci uživatele, když krok přešel na splněno nebo přeskočeno a `ds === toDS()`. Volat z `toggleHabit` (empty → done), `adjustHabit` a `directInput` (přechod přes cíl), `skipHabitDay` (zapnutí), `ctHabit`, `handleNotifHabitDone`, `hdToggleToday`. **Nevolat** z `putHabitLog` obecně (voda, AI z poznámek, zpětné dny). Volat synchronně po změně paměti, ne až po `await` zápisu, protože offline by se čekalo na server.
9. Lišta `#chain-next` (`.cta-ask chn-ask`): sestavení jako `wtLinkOffer`, časovač 15 s, `naCovered()` → toast. Akce `chainNextDone(hid)` a `chainNextSkip(hid)` přes `quickOnce` (dvojklik).
10. `coTedHTML` (kind `habits`): odfiltrovat kroky rutiny, které nejsou `chainNextStep`.
11. Detail: sekce rutiny nad připomínkou. U navazujícího kroku místo připomínky věta s odkazem na 1. krok.
12. `archiveHabit`: po archivaci 1. kroku toast s nabídkou připomínky (§5).
13. Zavřít lištu v `habitDayRoll` a při odhlášení.

### 7.2 i18n (i18n/cs.js + en.js, tykání, rod přes `#f`/`#x`, kde je sloveso)

`hb.chain.chip` („🔗 Rutina“), `hb.chain.title` („🔗 Spojit návyky do rutiny“), `hb.chain.hint` („Klepej v pořadí, jak je děláš.“), `hb.chain.save` („Uložit rutinu“), `hb.chain.min` („Vyber aspoň 2 návyky“), `hb.chain.saved` („Rutina uložená 🔗“), `hb.chain.name.morning|day|evening` („Ranní / Denní / Večerní rutina“), `hb.chain.head` („{name} · {done}/{total}“), `hb.chain.next` („Další“), `hb.chain.nextBar` („✓ Hotovo! Další: {habit}“), `hb.chain.nextBarSkip` („⏭ Přeskočeno. Další: {habit}“), `hb.chain.doneBtn`, `hb.chain.cntBtn` („✓ {goal}/{goal}“), `hb.chain.skipAria`, `hb.chain.closeAria`, `hb.chain.allDone` („🎉 {name} hotová ({n}/{n})“), `hb.chain.remOff` („🔔 Připomínku {time} u {habit} jsem vypnul, rutinu připomene první krok.“ + `#f` „vypnula“ podle rodu avatara, nebo neutrálně „je vypnutá“; doporučuji neutrální), `hb.chain.remFirst` („🔔 Připomíná první krok rutiny ({habit}, {time})“), `hb.chain.remNone` („Rutinu zatím nic nepřipomíná. Nastav připomínku u prvního kroku.“), `hd.chain.sec` („🔗 Rutina“), `hd.chain.step` („{name} · krok {n} ze {total}“), `hd.chain.edit` („Upravit rutinu“), `hd.chain.detach` („Odpojit tento krok“), `hd.chain.attach` („Navázat na:“), `hd.chain.attachNone` („— samostatně —“), `hb.chain.newHead` („Rutina teď začíná krokem {habit}. Nastavit připomínku?“), `hb.chain.newHeadBtn` („Nastavit“). Změna také v `CHANGELOG` 4.89.

### 7.3 CSS (style.css, jen tokeny, funguje ve všech tématech)

```css
.hb-filter{gap:8px;flex-wrap:wrap} /* doplnit ke stávajícímu pravidlu, [hidden] už existuje */
.hb-chain{position:relative;padding-left:12px;margin-bottom:8px}
.hb-chain::before{content:"";position:absolute;left:3px;top:30px;bottom:24px;width:2px;border-radius:2px;background:var(--accent);opacity:.55}
.hb-chain-head{display:flex;align-items:center;gap:6px;min-height:28px;font-size:13px;color:var(--text2)}
.hb-chain-head b{color:var(--accent);font-weight:700}
.hb-chain .habit-card{margin-bottom:6px}
.habit-card.hb-next{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.hb-next-tag{font-size:11px;font-weight:700;color:var(--on-accent);background:var(--accent);border-radius:6px;padding:1px 6px;margin-left:6px}
.chn-ask{flex-wrap:wrap;justify-content:flex-end;padding:8px 8px 8px 16px}
.chn-ask .cta-ask-t{flex:1 1 180px}
.chn-ask button{min-width:44px;min-height:44px}
.chn-pick{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 12px;background:var(--card2);border:1px solid var(--border);border-radius:12px;margin-bottom:6px;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.chn-pick.sel{border-color:var(--accent)}
.chn-num{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid var(--border2);display:grid;place-items:center;font-weight:700;font-size:14px}
.chn-pick.sel .chn-num{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
@media (prefers-reduced-motion:no-preference){.habit-card.hb-next{transition:border-color .25s,box-shadow .25s}}
```

Kontrast ověřit u světlých témat sunshine a tangerine, kde je `--accent` tmavší oranžová: štítek „Další“ musí mít bílý text na `--accent` aspoň 4,5 : 1 (`--on-accent`). Okno: standardní `.moverlay`/`.modal`, zavření přes `cm()`/Zpět jako ostatní.

### 7.4 Verze

`APP_VERSION` 4.89, `CHANGELOG`: „🔗 Rutiny: spoj návyky, které děláš po sobě (třeba zuby → protažení → kliky). Po každém ti appka hned nabídne další krok.“ Bump `CACHE` v `sw.js`. Server, pravidla ani manifest se nemění.

### 7.5 Rizika

1. **Přetahování s obalem `.hb-chain`**: `enableDragReorder` a `scrollAnchorSave` počítají s `.habit-card` v `.habit-group-body`. Ověřit, že `rows()` i výpočet cílové pozice fungují přes vnořený obal. Jinak kreslit spojnici jen třídami na kartách (`.hb-in-chain`, `.hb-chain-first`, `.hb-chain-last`) bez obalu (bezpečnější varianta, doporučuji ji zvážit jako první).
2. **Úbytek připomínek**: smazání `reminderTime` u kroků je změna dat bez ptaní. Vždy toast s časem, aby uživatel věděl, co se stalo.
3. **Kolize plovoucích lišt** (`cta-ask` sdílení, voda, instalace, toast na 80 px): jen jedna naráz, jinak toast.
4. **Dvojí spuštění lišty**: `toggleHabit` volaný z `hdToggleToday` i z `ctHabit` (přes `toggleHabitDay`). `chainAfter` volat na jednom místě na akci, chránit `quickOnce`.
5. **Výkon renderu**: `chainOf` pro každou kartu je O(n²). Spočítat úseky jednou na skupinu v `renderHabits`.
6. **Souběh s jiným koderem v app.js**: platí pravidlo jednoho kodera.

### 7.6 Testy (statické + simulace v node)

- `chainOf`: archiv uprostřed, `chain:true` u prvního, dvě rutiny ve skupině, jediný krok → null.
- Další krok: dny v týdnu, týdenní cíl, pauza, přeskočeno, nesplněno, počítaný částečně.
- `saveHabitOrder`: přetažení dovnitř, ven, pod poslední krok.
- Lišta se neukáže pro `src:'water'`, minulý den a nesplněno.
- `node --check app.js`, i18n klíče v cs i en (ci-check).
