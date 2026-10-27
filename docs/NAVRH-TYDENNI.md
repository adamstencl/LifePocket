# Návrh: týdenní návyky („3× týdně“)

Stav 4.90. Navazuje na NAVRH-FUNKCE-2 §2b (`habitWeekStat`, `calcWeekStreak`) a NAVRH-GAMIFIKACE §2e (štíty jen pro denní). Řeší položku z BACKLOG „Týdenní návyky: série a procenta po dnech“.

## Problém (zjištěno v kódu)
- `habitDayState` (app.js:2360) nezná `freq.type==='weekly'`. Každý den bez splnění vrací `'miss'`.
- Důsledky: `habitStreak` počítá dny („🔥 1 den“), `calcPct` a graf v detailu (app.js:3125–3160) vychází na ~43 % i při splněném plánu, měsíční přehled (app.js:3962) je červený, milníky `XP.streak` 7/30/… a reakce avatara 3/7/14/30 nepřijdou nikdy.
- Co už funguje a zůstane: `perfDue`/`habitsDue` týdenní vynechávají, `calcWeekSummaryRaw` počítá týdenní přes `min(splněno, cíl)`, štíty týdenní vynechávají, `isHabitPending` a `checkAndRemindHabits` znají splněný týden.
- Frekvenci nejde po založení změnit (jen v `saveHabitImpl`). Změna frekvence je tedy zatím jen okrajový případ (import, budoucí úprava).

## 1. Týdenní série
**Pravidlo:** série = počet týdnů po sobě (po–ne), kdy byl splněný cíl. Zobrazení `🔥 3 týdny`.

- **Probíhající týden** se započítá, jakmile je cíl splněný. Dokud splněný není, sérii **nepřeruší**. Rozhodne se až po půlnoci z neděle na pondělí.
- **Neutrální týden** (celý v pauze nebo celý před založením) sérii nepřeruší ani nepřičte.
- **Cíl týdne** = `min(active, max(1, ceil(times × active / 7)))`, kde `active` = dny týdne od založení a mimo pauzu (budoucí dny se počítají). Návyk založený ve čtvrtek se cílem 3× týdně má v prvním týdnu cíl 2. Pokud je pauza 3 dny, cíl je 2.
- **Rozdíl proti F2-DOC:** „Přeskočit“ a „Nesplněno“ cíl **nesnižují**. U týdenního návyku znamenají jen „dnes ne“ (den se uzavře a zmizí z „Jen nevyřízené“). Jinak by šlo přeskočením 5 dnů stáhnout cíl na 1.

Karta návyku (u `weekly` vždy dva údaje, pilulka z F2-DOC §2b):
```
Před:  🔥 1 den                         3× týdně
Po:    [2/3 tento týden]  🔥 4 týdny    3× týdně
       [✓ 3/3 tento týden]   ← zelená, cíl splněn
```
Odznak série podle týdnů: 1 = prostý text, 2+ `s-normal`, 4+ `s-week` 🔥, 12+ `s-two-week` 🏆, 52+ `s-month` 👑. Série 0: jen pilulka (místo „Začni dnes“).

## 2. Stav dne u týdenního návyku
`habitDayState` u `weekly` **nikdy nevrací `'miss'`**. Vrací `'done' | 'neutral' | 'future'`. Pro vzhled slouží nová funkce `habitWeekDay(h, ds)`:

| Situace (den bez splnění) | `habitDayState` | `habitWeekDay` | Vzhled |
|---|---|---|---|
| týden už má cíl splněný | neutral | `rest` | klidný, jako volný den |
| týden ještě běží, cíl nesplněný | neutral | `open` | šedý jako dnes „miss“ (dá se doplnit) |
| týden skončil a cíl nesplnil | neutral | `wmiss` | šedý den, **celý týden jemně podbarvený** |
| pauza, před založením | neutral | `null` | jako dnes |

**Doporučení: nebarvit jednotlivé dny červeně, ale podbarvit celý týden.** Cíl je týdenní, žádný konkrétní den nebyl povinný. Červený den by říkal „tady jsi selhal“, což není pravda. U měsíčního kalendáře v detailu jsou řádky po–ne, takže podbarvení řádku sedí přesně.

```css
/* Týdenní návyk: den bez splnění ve splněném týdnu (volno) */
.hd-day-cell.rest,.htd-dot.rest{background:transparent;color:var(--text3);opacity:.55}
/* Nesplněný uzavřený týden: jemný podklad celého řádku (i splněné dny si nechají zelenou) */
.hd-day-cell.wk-miss:not(.done){background:rgba(255,107,107,.10);color:var(--text2)}
[data-theme="sunshine"] .hd-day-cell.wk-miss:not(.done),[data-theme="tangerine"] .hd-day-cell.wk-miss:not(.done){background:rgba(198,40,40,.08)}
```
- Text `--text2` na 10% podkladu má kontrast nad 4,5:1 v tmavém i světlém tématu. Barva je jen doplněk: dny nesplněného týdne dostanou `title`/`aria-label` „Týden nesplněn (2/3)“, dny splněného týdne „Týden splněn (3/3)“.
- **Tabulka 7 dní na kartě** u `weekly` ukáže **aktuální týden po–ne** (týden `habitDay`) místo posledních 7 dní. Odpovídá to pilulce „2/3 tento týden“. Budoucí dny jsou prázdné (`future`), dny bez splnění `open` nebo `rest`.

## 3. Úspěšnost v detailu
Úspěšnost = **splněné týdny / hodnocené týdny**. Hodnocený týden je uzavřený a ne-neutrální. Probíhající týden se počítá, jen když už je splněný (stejně jako série).

Mřížka `hd-stat-grid` u `weekly` (6 dlaždic místo denních):
```
[ 2/3 ]           [ 4 ]               [ 9 ]
Tento týden       🔥 Týdenní série     🏆 Nejlepší série
[ 9/12 ]          [ 75 % ]            [ 37 ]
Splněné týdny     Úspěšnost           Splnění celkem
```
- Hlavní okno: **posledních 12 týdnů** (nebo od založení, když je kratší).
- Řádek 30/60/90 dní se nahradí řádkem **4 / 12 / 26 týdnů**.
- „Celkový výkon“ (app.js:3266, `totalDone/daysSince`) u `weekly` = splněné týdny od založení. Starší historii dotáhne `hlNeedHistory` (jako `calcBestStreak`).
- Graf „📈 Plnění po týdnech“: u `weekly` týdny po–ne, sloupec `min(done, cíl)/cíl` a titulek „2/3 · 67 %“. Barvy zůstávají.
- Měsíční přehled (`renderHabitsMonthly`, app.js:3950): u `weekly` místo 30 dní **poslední 4 hodnocené týdny**. Řádek ukáže „3/4 týdny“ a % = splněné/hodnocené. Do „Celkového výkonu“ nahoře přispěje stejnými čísly (týden = jedna položka).

## 4. Body, štíty a milníky
- **Body za dny se nemění.** `dayXP` počítá splnění bez ohledu na stav dne a `isPerfectDay` přes `perfDue` týdenní vynechává. Nová logika `habitDayState` se tedy `game.days` ani `base` nedotkne. `gameSync` navíc přepočítává jen dnešek a včerejšek. **Podmínka pro kodéra:** `perfDue` musí týdenní dál vynechávat.
- **Milníky série v bodech (nové):** `XP.wstreak = {4:25, 12:75, 26:200, 52:500}` (odpovídá 7/30/100/365 dnům). Klíč `sw_<hid>_<n>_<pondělí>`, přidělí se v `gameSync` v týdnu, kdy série dosáhne `n`. Jde jen o nové záznamy v `once`, existující součet se zpětně nemění. Denní větev (`st_…`) týdenní přeskočí.
- **Reakce avatara:** týdenní milníky 4 / 12 / 26 / 52 při splnění, které týden dokončí. Klíč do `lp_avr` je `hid_w_n`. Denní milníky 3/7/14/30 se pro `weekly` nespouští.
- **Štíty ❄️:** týdenní je zatím **nemají** (shodně s GAMIFIKACE §2e). Nemoc a dovolenou řeší pauza, která zmenší cíl nebo udělá týden neutrálním. `gameAutoShield`, `habitShieldState` i sekce štítů v detailu dál `weekly` vynechávají.
- **Odznaky:** `badgeLogCtx.best` a `S.best` ve weekly reportu zůstávají denní (týdenní vynechané). Bez změny.
- Řádek „Jak získat body“: doplnit `game.how.wstreak`.

## 5. Další místa v appce
| Místo | Teď | Nově |
|---|---|---|
| **Domů – widget návyků** (app.js:17005) | `🔥N` z denní série | u `weekly` místo ohníčku `2/3` (týden), při splněném týdnu zeleně `✓3/3`. „Dnes x/y“ beze změny (`habitsDue` týdenní nepočítá). |
| **Domů – nejdelší série** (app.js:17212) | dny | `weekly` s ≥ 2 týdny: „🔥 3 týdny“ (`dash.streaks.weeks`), řadit podle `týdny×7`. |
| **Rex – kontext** (app.js:18245) | týden c/x, bez série | `týden 2/3 · týdenní série 4` (`aip.ctx.hab.wstreak`). Značka ⬜ jen když `isHabitPending`, při splněném týdnu `➖`. Souhrn „dnes x/n“ počítá `weekly` jen pending nebo dnes splněné. |
| **Co teď** (`coTedHTML`) | `isHabitPending` | beze změny chování. Řadit denní před týdenní (týdenní počká). |
| **Rutiny 4.89** | `chainProgress` počítá `miss` | týdenní krok se do celku počítá, jen když je dnes splněný nebo `isHabitPending`. Krok ve splněném týdnu je neutrální (rutina může být 100 %). `chainNextStep` beze změny. |
| **Jen nevyřízené** (`isHabitPending`) | spoléhá na `'miss'` | u `weekly` podmínka `habitWeekDay(h,ds)==='open'` a den bez záznamu. Vlastní výpočet týdne nahradit `habitWeekStat`. |
| **Zrcadlo ve skupině** (`buildHabitMirror`) | `streak`, `best` ve dnech | u `weekly` týdny. Příjemce pozná jednotku z `freq.type` (pole už v pravidlech je), text `sh.wstreak`. `last7`: `-` pro `rest`. **Aktivitu „streak“ pro `weekly` zatím neposílat** (pravidla `activity` nemají pole pro jednotku, nechceme nasazovat pravidla). |
| **Server** (`isHabitDueToday`) | `weekly` vždy na řadě | beze změny. Backlog: serverová připomínka po splněném týdnu. |

## 6. Kroky pro kodéra
1. **Nové pomocné funkce** (u `habitDayState`, `weekStartDS` přesunout nahoru z app.js:8778):
   - `habitWeekStat(h, mon, today=toDS())` → `{done, target, active, state:'met'|'open'|'miss'|'none'}`. `active` = dny ≥ `habitStartDS` a mimo `isHabitPausedOn`. `done` = `hDone` za 7 dní. Cache `h.id|mon|today` v mapě, kterou maže `shieldCacheReset()`.
   - `habitWeekDay(h, ds)` → `'rest'|'open'|'wmiss'|null`.
   - `habitWeekStreak(h, ds=toDS())`: týden s `ds` +1 jen když `met`, dál zpět: `none` přeskočit, `met` +1, `miss` konec. Před `_hlCutoff` volat `hlNeedHistory`. Strop 520 týdnů.
   - `calcBestWeekStreak(h)`, `isWeekly(h)`, `fmtStreak(h, n)` → `tNH('pl.days'|'pl.weeks', n)`.
2. **`habitDayState`:** pro `weekly` po kontrolách done/future/skipped/pauza/start vracet `'neutral'` místo `'miss'`.
3. **`habitStreak(hid, ds)`** pro `weekly` vrací `habitWeekStreak` (jediný vstup pro kartu, detail, Domů, Rex i zrcadlo). **Každé volání projít** a zobrazovat přes `fmtStreak`: karta (2485, 2510–2520), detail (3110), `gameSync` (8191), `checkAvatarReactions` (9050–9080), zrcadlo (11970, 12101), Domů (17016, 17212), Rex (18258). `calcBestStreak` pro `weekly` → `calcBestWeekStreak`.
4. **Grep kontrola:** každé `habitDayState(`, `habitDayCounts(` a `=== 'miss'` musí mít větev pro `weekly`, jinak vyjde 100 % (žádný `miss`). Seznam: `calcPct`, `pctMonth`, graf týdnů, „Celkový výkon“, `renderHabitsMonthly`, `chainProgress`, `isHabitPending`, `habitShieldState` (už vynechává), `calcWeekSummaryRaw` (už má větev).
5. **UI:** pilulka týdne na kartě (CSS `.habit-week-pill` z F2-DOC §2b), tabulka po–ne, třídy `rest`/`wk-miss` v kalendáři detailu, dlaždice detailu, měsíční přehled.
6. **Body:** `XP.wstreak`, klíč `sw_…`, `game.how.wstreak`. `perfDue` a `dayXP` neměnit.
7. **i18n (cs + en):**
   - `pl.weeks`: cs `{one:'{n} týden', few:'{n} týdny', many:'{n} týdne', other:'{n} týdnů'}`, en `{one:'{n} week', other:'{n} weeks'}`.
   - `dash.streaks.weeks` (s 🔥), `sh.wstreak`.
   - `hd.wk.this` „Tento týden“, `hd.wk.streak` „🔥 Týdenní série“, `hd.wk.best` „🏆 Nejlepší série“, `hd.wk.met` „Splněné týdny“, `hd.wk.rate` „Úspěšnost“, `hd.nWeeks` „{n} týdnů“.
   - `hd.wk.missTitle` „Týden nesplněn ({done}/{n})“, `hd.wk.metTitle` „Týden splněn ({done}/{n})“.
   - `hb.m.weeks` „{met}/{total} týdnů“ (plurál).
   - `aip.ctx.hab.wstreak`.
   - `game.how.wstreak` „🔥 Týdenní série 4 / 12 / 26 / 52 týdnů +25 / +75 / +200 / +500“.
   - `avr.w4t/w4`, `avr.w12t/w12`, `avr.w26t/w26`, `avr.w52t/w52` (např. „4 týdny v řadě!“ / „{av}: {h} držíš už měsíc. Paráda!“).
8. **Okrajové případy (simulace v node):**
   - **Týden po–ne v místním čase** přes `toDS`/`addDays`/`weekStartDS` (`T12:00`, odolné vůči změně času). Telefon v Praze = Europe/Prague. Neděle 23:59 je pořád `open`, pondělí 00:00 týden uzavře.
   - **Založení uprostřed týdne:** čt → cíl 2 (3×), ne → cíl 1. Splnění před `createdAt` (import) se počítají a den bere jako aktivní.
   - **Pauza:** částečná zmenší cíl, celý týden = `none` (sérii nepřeruší). Legacy `pausedUntil` řeší `isHabitPausedOn`.
   - **Denní → týdenní a zpět** (dnes jen import nebo budoucí úprava): historie se přehodnotí podle aktuální frekvence (stejně jako u `days`). Série se může změnit, body ne (`game.days` jsou uložené). Bez nového pole.
   - `times` 7 = cíl 7 (jako denní, ale v týdnech). `times` mimo 1–7 → `clampInt`, chybí → 3.
   - Archivovaný návyk nikde. Počítaný návyk (`count`): `done` = `hDone` (cíl dne dosažen).
   - Historie > 400 dní (`HL_WINDOW`): série > 57 týdnů dotáhne `hlNeedHistory`, do té doby nejvýš okno.
   - Milník se nepřidělí dvakrát: odškrtnutí a nové zaškrtnutí ve stejném týdnu = stejný klíč `sw_…_<pondělí>`.
9. **Verze:** `APP_VERSION` 4.91, `CACHE` v `sw.js`. CHANGELOG: „🔥 Návyky „× týdně“ teď počítají sérii v týdnech a úspěšnost podle splněných týdnů. Dny, kdy máš volno, už nejsou nesplněné.“

## Mimo rozsah
Štíty pro týdenní návyky, heatmapa 16 týdnů (F2-DOC §2b), serverová připomínka po splněném týdnu, aktivita „týdenní série“ ve skupině (potřebuje pravidla).
