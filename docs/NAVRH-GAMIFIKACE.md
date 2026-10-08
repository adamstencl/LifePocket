# Návrh: gamifikace (body, úrovně, Rex, štíty série, mezníky cílů, odznaky, výzvy)

Autor: ux-designer · 2026-10-08 · stav: NÁVRH (nic není implementováno)

Navazuje na `docs/NAVRH-FUNKCE-2.md` (dál **F2-DOC**: 2a zamrazení série, 2b týdenní cíl, 3 týdenní karta) a `docs/NAVRH-SDILENI-MODULU.md` (dál **SDIL**: zrcadla, aktivita, reakce). Čísla řádků platí pro `app.js` verze 4.39 a posouvají se, proto je u každého místa i název funkce. Nové texty patří do `i18n/cs.js` a `i18n/en.js` přes `t('…')`.

**Zásada: odměňovat, nikdy netrestat.**
- Body se nikdy nestrhávají za nesplnění. Odškrtnutí omylem jen vrátí stav dne (viz 2c), žádná ztráta se neoznamuje.
- Žádné zahanbování: žádná červená, žádné „ztratil jsi“, žádné odpočty („série vyprší za 2 h!“), žádné poslední místo.
- Žádné peníze, měna, obchod, loot boxy ani náhodné odměny. Vše se odemyká předvídatelně úrovní nebo výkonem.
- Žádné temné vzorce: žádná push notifikace kvůli bodům, žádné FOMO, gamifikace jde v Nastavení vypnout.
- Přerušená série: „Nová série začíná dnes 🌱 Tvůj rekord 21 dní zůstává.“

Společné zásady pro kodera: text do HTML přes `esc()`, parametry handlerů přes `data-aN`, datum přes `toDS()` a nový `addDays(ds,n)` (poledne, ne `Date.now()-864e5`, který kolem změny času přeskočí den), barvy jen přes proměnné, dotykové cíle min. 44×44 px, animace vypnout při `prefers-reduced-motion`.

---

## 0. Výchozí stav (zjištění)

| Co | Kde | Stav |
|---|---|---|
| Avatar | `AVS` app.js:438 (rex ⚔️, sage 🌿, ash 🔥, nora 🏡, rio 🌊), `prof.avatarId` | Pevné emoji. „Rex“ = libovolný zvolený společník. Pozor: `MEMBER_AV` app.js:~6450 má pro skupiny jiná emoji (rex 🐺, sage 🦉, nora 🌸). Sjednotit (backlog). |
| Energie Rexe (Tamagotchi) | `getRexEnergy` app.js:3442, `getRexState` :3479, `rAvPage` :3584, widget v `rDash` :~8466 | Denní stav 0–100 %. **Ponechat**, úroveň je dlouhodobý rozměr vedle denní energie. |
| Milníky a oslavy | `checkAvatarReactions` app.js:~5139 (série 3/7/14/30, „Perfektní den“), `showAvReaction` + `spawnConfetti` :~5102 | Jen zobrazení, nic se neukládá. Oslava se po odškrtnutí a zaškrtnutí zopakuje. `spawnConfetti` ignoruje `prefers-reduced-motion`. Zavírací × u `.av-reaction` má asi 24 px. |
| Série | `habitStreak(hid,ds)` app.js:1279 (4.39), `getStreak` :5137 | Jedna funkce, `skipped` je neutrální. Pauzy (`pausedUntil`) zatím ignoruje, F2-DOC 2a (`habitDayState`, `pauses`, ruční zamrazení 🧊 2×/měsíc) **není implementované**. |
| Zápis logu | `putHabitLog` / `delHabitLog` app.js:1221 → `onHabitLogChanged` :~6584 | Jediné místo zápisu (4.39). `await setDoc` offline čeká na server, proto se na něj gamifikace **neváže** (viz 2d). |
| Index logů | `hLog`, `hDone` app.js:1184, okno `HL_WINDOW=400` dní | Listener `habitLogs` drží 400 dní. |
| Cíle | `users/{uid}/goals` (`progress` 0–100), `subgoals` s `tasks[]`; `updateGoalProgress` :~8903, `togSubDone`, `saveG`, `archiveGoal` | **Žádná měřitelná hodnota.** Bez podcílů je pokrok ruční posuvník. |
| Profil | `profile/main` se čte jednou `getDoc` (app.js:627), na více místech se zapisuje celý `prof` s `merge` (:637, :3403) | Riziko přepsání starším stavem, proto gamifikace nejde do profilu. |
| Firestore cache | `getFirestore` bez persistence | Offline zápisy žijí jen v paměti do zavření appky. |
| Aktivita a reakce skupiny | `logGroupActivity` app.js:6375, `RX` (clap, fire, heart, strong), `toggleReaction` :~6865 | Sdílí se zatím jen návyky (SDIL fáze 1). Pravidla `activity` nepovolují modul `goal` ani akci `progress`. |
| Týdenní report | `checkAutoWeeklyReport` :4648 (AI text) | Karta k sdílení (F2-DOC 3) zatím není. |

---

## 1. Datový model

### 1a) Kde co žije

| Data | Kde | Proč |
|---|---|---|
| XP po dnech, jednorázové odměny, odznaky, výběr vzhledu Rexe, nastavení | **`users/{uid}/game/main`** (nový dokument) | Mimo `profile/main` (riziko přepsání přes `merge` celého `prof`). Pravidla `users/**` ho už pokrývají. Smazání účtu (`recursiveDelete`) ho smaže samo. |
| Úroveň | **odvozená** z XP (`levelOf(xp)`), neukládá se. `xp` v dokumentu je jen cache. | Nejde rozbít nesouladem. |
| Štíty série | **odvozené z logů** (`habitShields`), použitý štít je log `{skipped:true, frozen:true, shield:true}` | Žádný čítač, žádné dvojí připsání, stejné na všech zařízeních. |
| Mezníky cíle | `goals/{id}.msHit: [25,50]` (jen přibývá) + `metric`, `mlog` | Idempotence oslav napříč zařízeními, sdílí se zrcadlem `g`. |
| Čas splnění (pro „Ranní ptáče“) | nové pole `at:'07:42'` v logu návyku, zapisuje `putHabitLog` jen při `done` pro dnešek | Bez něj nejde odznak spočítat. Zpětně se nedopočítá. |
| Úroveň ve skupině, příspěvek do výzvy | `families/{gid}.members.<uid>.lvl`, `.ch` (jen když uživatel sdílí nebo se přidá) | Jede na existujícím listeneru skupiny. |

### 1b) `users/{uid}/game/main`

```js
{
  v: 1,                                   // verze schématu; chybí = ještě neproběhl backfill
  off: false,                             // gamifikace vypnutá v Nastavení
  base: 0,                                // XP ze dnů starších než 400 dní (zhuštěno, viz níže)
  days: { '2026-10-08': 50, ... },        // XP z návyků za den (přepočítává se jen dnes a včera)
  once: {                                 // jednorázové odměny: klíč = důvod, nikdy se nepřipíšou dvakrát
    'sg_<subgoalId>':        {d:'2026-10-08', x:15},   // splněný podcíl
    'tk_<taskId>':           {d, x:5},                 // splněný úkol podcíle
    'gm_<goalId>_50':        {d, x:25},                // mezník cíle
    'mv_<goalId>_<date>':    {d, x:5},                 // zapsaná hodnota cíle (1× denně)
    'st_<habitId>_30_<date>':{d, x:75},                // milník série (date = den dosažení)
    'pr_<date>':             {d, x:15, n:3},           // pochvaly za den (n = počet různých položek)
    'bd_<badgeId>':          {d, x:25},                // odznak (F2)
    'ch_<challengeId>':      {d, x:50}                 // splněná výzva skupiny (F3)
  },
  badges: { first_week: '2026-10-08', ... },  // F2, jen přibývají
  lvlSeen: 7,                             // poslední oslavená úroveň (oslava jen jednou)
  xp: 4210,                               // cache = base + Σdays + Σonce.x, přepočet při načtení
  rex: { acc: 'scarf', ring: 'mint' },    // vybraný doplněk a barva kruhu
  share: { lvl: false, wins: false },     // úroveň a úspěchy ve skupině (výchozí vypnuto)
  ch: { '<gid>': { id: '<challengeId>', hids: ['<habitId>'] } }   // F3: které moje návyky se počítají do výzvy (skupina nevidí)
}
```

Velikost: `days` ~22 B na den (8 kB za rok), `once` ~40 B na klíč (stovky ročně). **Zhuštění:** dny starší než `HL_WINDOW` se při načtení sečtou do `base` a smažou (`deleteField`), protože už se stejně nepřepočítávají.

### 1c) Odolnost proti dvojímu připsání

- **Návyky se nepřičítají, ale přepočítávají.** `days[ds] = dayXP(ds)` je funkce stavu logů. Zaškrtnout, odškrtnout a zaškrtnout dá vždy stejné číslo. Na „farmení“ odškrtáváním není prostor.
- **Okno přepočtu je dnes a včera.** Dny starší než včerejšek jsou zamrzlé v obou směrech. Zpětné odškrtání 30 dní body nepřidá, oprava starého záznamu body nevezme.
- **Jednorázové odměny mají deterministický klíč.** Zápis je `updateDoc(ref, {'once.<klíč>': {d,x}})`. Dvě zařízení offline zapíšou stejný klíč a výsledek je stejný (přepis, ne přičtení). Proto se nikde nepoužívá `increment()`.
- **Celkové XP je součet**, ne čítač. Cache `xp` se po načtení dokumentu vždy přepočítá.
- **Oslava úrovně** se ukáže jen když `level > lvlSeen`, a `lvlSeen` se hned zapíše. Na dvou současně otevřených zařízeních se může ukázat dvakrát. To je přijatelné.
- **Strop jednorázových bonusů 200 XP za den** (`XP.bonusCap`). Proti založení 10 cílů a posunutí posuvníku na 100 %. Oslava proběhne i nad stropem, jen bez bodů. XP za mezníky cíle až u cíle starého aspoň 24 h.
- **Štíty** jsou funkce historie logů (2e). Použitý štít je log s deterministickým ID `hid_date`.

### 1d) Offline

- Bez persistence cache: `game/main` se načte `getDoc` při přihlášení (1 čtení). Offline start nemá data a gamifikace se do načtení nezobrazí (žádný „0 XP“ záblesk: komponenty jsou skryté, dokud `game === null`).
- Zápisy jdou bez `await` (`.catch(console.warn)`). Když se ztratí (appka zavřená offline), **příští `gameSync` je dopočítá znovu**, protože `days` jsou odvozené. Ztratit se může jen jednorázová odměna, jejíž zdroj (podcíl) se ztratil také.
- Oslavy se spouští z lokálního stavu, ne z potvrzení serveru.

### 1e) Dokument neexistuje

První `gameLoad` (chybí `v`) udělá **backfill** a `setDoc(ref, {...}, {merge:true})`. Další zápisy jsou `updateDoc` s tečkovou cestou. Když `updateDoc` vrátí `not-found` (smazaný dokument), znovu backfill.

---

## 2. F1: body, úrovně, Rex, štíty série, mezníky cílů

### 2a) Bodování

| Za co | XP | Limit | Klíč / výpočet |
|---|---|---|---|
| Splněný návyk (i počítaný po dosažení cíle) | **10** | max. 10 návyků za den (100 XP) | `days[ds]` |
| Perfektní den (všechny dnešní návyky na řadě, aspoň 2) | **+20** | 1× za den | `days[ds]` |
| Milník série 7 / 30 / 100 / 365 dní | **+25 / +75 / +200 / +500** | 1× za běh série | `st_<hid>_<n>_<date>` |
| Splněný podcíl | **+15** | strop bonusů | `sg_<sid>` |
| Splněný úkol podcíle | **+5** | max. 10 za den | `tk_<tid>` |
| Zapsaná hodnota měřitelného cíle | **+5** | 1× za den na cíl | `mv_<gid>_<date>` |
| Mezník cíle 25 / 50 / 75 % | **+25** každý | 1× navždy | `gm_<gid>_<m>` |
| Cíl splněn (100 %) | **+100** | 1× navždy | `gm_<gid>_100` |
| Pochvala druhému (první reakce 👏🔥❤️💪 nebo komentář na cizí položku za den) | **+5** | max. 3 různé položky za den | `pr_<date>` (max z lokálního výpočtu a uložené hodnoty, nikdy neklesá) |
| Odznak (F2) | **+25** | 1× | `bd_<id>` |
| Splněná výzva skupiny (F3) | **+50** | 1× | `ch_<cid>` |

Body za **pochvalu dávají, ne dostávají** (nejde je domluvit mezi dvěma lidmi). Typický den (4 návyky, perfektní den) = 60 XP.

```js
const XP = {habit:10, habitCap:10, perfect:20, streak:{7:25,30:75,100:200,365:500},
  sub:15, task:5, taskCap:10, metric:5, gms:{25:25,50:25,75:25,100:100},
  praise:5, praiseCap:3, badge:25, chDone:50, bonusCap:200};

// Den: splněné návyky + perfektní den. Týdenní návyky se do „perfektního dne“ nepočítají.
function dayXP(ds){
  const act = habits.filter(h => !h.archived);
  const done = act.filter(h => hDone(h.id, ds)).length;
  const due = act.filter(h => h.freq?.type !== 'weekly' && habitDayState(h, ds) !== 'neutral');
  const perfect = due.length >= 2 && due.every(h => hDone(h.id, ds));
  return Math.min(done, XP.habitCap) * XP.habit + (perfect ? XP.perfect : 0);
}
```
`habitDayState` je z F2-DOC 2a (je to předpoklad F1, viz kapitola 9). Do té doby stačí `isHabitDueToday` rozšířený o datum.

### 2b) Křivka úrovní 1–50

Na postup z úrovně L na L+1 je potřeba `50 + 25·(L−1)` XP. Celkem:

```js
const lvlXP = L => 50*(L-1) + 12.5*(L-1)*(L-2);          // XP potřebné pro úroveň L (L1 = 0)
function levelOf(xp){ let L = 1; while(L < 50 && xp >= lvlXP(L+1)) L++; return L; }
```

| Úroveň | Celkem XP | Při 60 XP/den | Název (cs / en) |
|---|---|---|---|
| 1 | 0 | start | 🌱 Semínko / Seed |
| 2 | 50 | 1. den | 🌱 Semínko |
| 5 | 350 | ~6 dní | 🌿 Klíček / Sprout |
| 10 | 1 350 | ~3 týdny | 🍃 Výhonek / Shoot |
| 15 | 2 975 | ~7 týdnů | 🌷 Poupě / Bud |
| 20 | 5 225 | ~3 měsíce | 🌸 Květ / Blossom |
| 25 | 8 100 | ~4,5 měsíce | 🌲 Stromek / Sapling |
| 30 | 11 600 | ~6,5 měsíce | 🌳 Strom / Tree |
| 35 | 15 725 | ~9 měsíců | 🌳 Mohutný strom / Mighty tree |
| 40 | 20 475 | ~11 měsíců | 🏞️ Háj / Grove |
| 45 | 25 850 | ~14 měsíců | 🌲 Les / Forest |
| 50 | 31 850 | ~18 měsíců | ✨ Legenda / Legend |

Název se mění každých 5 úrovní: `LVL_NAMES[Math.floor(L/5)]` (1–4 Semínko, 5–9 Klíček, …, 45–49 Les, 50 Legenda). Metafora růstu je **bez rodu** (žádné „Mistr/Mistryně“) a sedí ke všem pěti společníkům.

### 2c) Odškrtnutí

Odškrtnutí dnešního nebo včerejšího návyku přepočítá den, takže XP lišta se tiše vrátí. **Nezobrazuje se „−10“**, žádný toast, žádná animace. Jde o opravu omylu, ne trest. Úroveň klesnout nemůže: `levelOf` z nižšího XP se v UI zobrazí jako `max(level, lvlSeen)`, takže už oslavená úroveň zůstane, jen lišta ukáže, kolik chybí.

### 2d) Napojení (bez nových listenerů)

```js
// ── GAMIFIKACE (users/{uid}/game/main) ──
let game = null, _gTimer = 0;
async function gameLoad(){ /* getDoc; když !v → gameBackfill(); zhuštění dnů do base; přepočet xp */ }
function gameQueue(){ clearTimeout(_gTimer); _gTimer = setTimeout(gameSync, 800); }
function gameSync(){
  if(!CU || !game || game.off) return;
  const patch = {}, today = toDS(), y = addDays(today, -1), before = gameTotal();
  for(const ds of [y, today]){ const v = dayXP(ds); if((game.days[ds]||0) !== v){ game.days[ds] = v; patch['days.'+ds] = v; } }
  gameStreakAwards(patch, today);   // milníky série pro dnes splněné návyky
  if(!Object.keys(patch).length) return;
  game.xp = gameTotal(); patch.xp = game.xp;
  updateDoc(doc(db,'users',CU.uid,'game','main'), patch).catch(gameWriteErr);
  gameAfter(before, game.xp);       // XP lišta, případně oslava úrovně
}
function gameAward(key, x){          // jednorázová odměna, vrací true jen poprvé
  if(!game || game.off || game.once[key]) return false;
  x = Math.max(0, Math.min(x, XP.bonusCap - bonusToday()));
  game.once[key] = {d: toDS(), x};
  const before = gameTotal() - x; game.xp = gameTotal();
  updateDoc(doc(db,'users',CU.uid,'game','main'), {['once.'+key]: game.once[key], xp: game.xp}).catch(gameWriteErr);
  gameAfter(before, game.xp); return true;
}
```

| Událost | Kde volat | Co |
|---|---|---|
| Změna logů návyků | **listener `habitLogs` v `subHabits`** (app.js:~1258), po `hlIndex()` | `gameQueue()`. Snapshot přijde i offline s lokálním zápisem, takže to nečeká na `await setDoc`. |
| Okamžitá odezva „+10“ | `toggleHabit`, `adjustHabit` při přechodu na `done` (před `await`) | jen vizuální `xpPop(btn, 10)`, nic neukládá |
| Podcíl / úkol | `togSubDone`, `togTask` (jen přechod na `done`) | `gameAward('sg_'+sid, XP.sub)` / `tk_` |
| Změna pokroku cíle | nová `goalProgressChanged(g, oldP, newP)`, volat z `updateGoalProgress`, `saveG`, `logGoalValue`, `delSubG` | mezníky 2g |
| Pochvala | `toggleReaction` (`.then` po zápisu) a odeslání komentáře | `gamePraise(target)` → `pr_<date>` s `n = min(3, různé cíle dnes)` |
| Start a nový den | po `habitsReady` a ve `visibilitychange`, když se změnil `toDS()` | `gameAutoShield()`, pak `gameSync()` |

`checkAvatarReactions` zůstává pro milníky 3/7/14/30. Doplní se jen hláška o štítu u 7 (2e) a „Perfektní den“ se ukáže jen jednou za den (`lp_perfect_day` = datum v localStorage).

### 2e) Štít série ❄️ (sjednocení s F2-DOC 2a a `habitStreak`)

**Jedno pravidlo místo dvou:** ruční „zamrazení 🧊 2× za měsíc“ z F2-DOC 2a **nahrazuje štít**. Pauza (nemoc, dovolená) z 2a zůstává beze změny a bez limitu.

- Za každých **7 splněných dní v řadě** u návyku dostaneš 1 štít, držet jdou **max. 2** na návyk.
- Když den vynecháš, štít **sám** podrží sérii. Použije se jen tehdy, když pokryje celou mezeru (1–2 dny). Na 3 vynechané dny se štíty nespálí zbytečně.
- Chrání sérii od 3 dnů výš.
- Platí pro denní návyky a návyky na konkrétní dny. Týdenní návyky mají týdenní sérii (F2-DOC 2b) a štíty zatím ne.
- Použitý štít je log `{skipped:true, frozen:true, shield:true}`. `habitStreak` (4.39) ho jako `skipped` bere neutrálně **beze změny kódu**. Karta a kalendář ho zobrazí jako ❄️ (třída `.frozen` z F2-DOC 2a).

```js
const SHIELD_EVERY = 7, SHIELD_MAX = 2;
// Štíty návyku k datu: deterministicky z historie (stejně na všech zařízeních, nejde připsat dvakrát)
function habitShields(h, upTo = toDS()){
  let sh = 0, run = 0;
  const from = String(h.createdAt||'').slice(0,10) > _hlCutoff ? String(h.createdAt).slice(0,10) : _hlCutoff;
  for(let ds = from; ds <= upTo; ds = addDays(ds, 1)){
    if(hLog(h.id+'_'+ds)?.shield){ sh = Math.max(0, sh-1); continue; }   // použitý štít: sérii nepřeruší ani nepřičte
    const st = habitDayState(h, ds);
    if(st === 'done'){ if(++run % SHIELD_EVERY === 0) sh = Math.min(SHIELD_MAX, sh+1); }
    else if(st === 'miss' && ds < toDS()) run = 0;                       // dnešek ještě není zmeškaný
  }
  return sh;
}
// Start appky a nový den: zalepit mezeru, jen když na ni štíty stačí
function gameAutoShield(){
  const today = toDS(), saved = [];
  for(const h of habits.filter(h => !h.archived && h.freq?.type !== 'weekly')){
    const gap = []; let ds = addDays(today, -1);
    while(gap.length <= SHIELD_MAX && habitDayState(h, ds) === 'miss'){ gap.push(ds); ds = addDays(ds, -1); }
    if(!gap.length || gap.length > SHIELD_MAX) continue;
    if(habitStreak(h.id, ds) < 3 || habitShields(h, ds) < gap.length) continue;
    gap.forEach(d => putHabitLog({id:h.id+'_'+d, habitId:h.id, date:d, skipped:true, frozen:true, shield:true}, true));
    saved.push(h);
  }
  if(saved.length) toast(t('game.shield.used', {n: saved.length, name: cutName(saved[0].name, 30)}));
}
```
- `merge:true`: případné ruční ✗ (`failed`) zůstane zapsané, štít jen přidá neutralitu.
- Zrušení ⏭ na dni se štítem (`skipHabitDay`) log smaže a štít se tím vrátí (výpočet je z logů).
- Cena: max. 400 iterací na návyk přes index `hLog`. Výsledek cachovat do další změny logů (`_hlVer`).
- **Ověřit v F2-DOC 2a:** `freezesLeft`, `freezeHabitDay`, `FREEZE_PER_MONTH` a nabídka „🧊 Zachránit“ na kartě se **neimplementují**. Zbytek 2a (`habitDayState`, `pauses`, sjednocení výpočtů) platí.
- Server se nemění: štít se týká jen minulých dnů.

### 2f) Rex roste s úrovní

Rex zůstává emoji zvoleného společníka. Růst se ukazuje **kruhem kolem avatara** (zároveň ukazatel XP do další úrovně), číslem úrovně a doplňky. Nic se nekupuje, vše se odemkne úrovní.

| Úroveň | Odemkne | Typ |
|---|---|---|
| 1 | tenký kruh v barvě `--accent` | vzhled |
| 5 | 🧣 Šála | doplněk |
| 10 | Mátový kruh, kruh je silnější | barva + stupeň 2 |
| 15 | 🕶️ Brýle | doplněk |
| 20 | Levandulový kruh, jemná záře | barva + stupeň 3 |
| 25 | 🎧 Sluchátka | doplněk |
| 30 | Polární záře (přechod) | barva + stupeň 4 |
| 35 | 🎓 Čepice | doplněk |
| 40 | Zlatý kruh | barva + stupeň 5 |
| 45 | 🌟 Hvězda | doplněk |
| 50 | 👑 Koruna a kruh „Legenda“ | doplněk + barva |

Výběr je v sekci „Šatník“ (2h). Nově odemčený doplněk se nabídne rovnou v oslavě úrovně tlačítkem „Obléknout“.

### 2g) Cíle s mezníky 25/50/75/100 %

**Měřitelný cíl** (volitelný, stávající cíle fungují dál):
```js
goals/{id}: {
  ...,
  metric: { start: 92, target: 82, unit: 'kg', cur: 87.5 },   // unit ≤ 8 znaků; směr dolů i nahoru
  mlog: [ {d:'2026-10-08', v:87.5} ],                          // max. 60 posledních zápisů (graf)
  msHit: [25, 50],                                             // dosažené mezníky, jen přibývají
  progress: 45                                                 // dál jediný zdroj pro UI, AI kontext i zrcadlo
}
const goalPct = m => Math.round(Math.max(0, Math.min(1, (m.cur - m.start) / (m.target - m.start))) * 100);
```
- U měřitelného cíle se `progress` počítá z hodnoty. Podcíle zůstanou jako checklist a na pokrok nemají vliv.
- **Mezníky platí pro všechny cíle** (posuvník, podcíle i hodnota):

```js
const GOAL_MS = [25, 50, 75, 100];
function goalProgressChanged(g, oldP, newP){
  const hit = Array.isArray(g.msHit) ? g.msHit : [];
  const fresh = GOAL_MS.filter(m => newP >= m && !hit.includes(m));
  if(!fresh.length) return;
  g.msHit = [...hit, ...fresh];
  updateDoc(doc(db,'users',CU.uid,'goals',g.id), {msHit: arrayUnion(...fresh)}).catch(console.warn);
  const old = Date.now() - Date.parse(g.createdAt||0) > 864e5;      // XP až u cíle staršího 24 h
  fresh.forEach(m => old && gameAward(`gm_${g.id}_${m}`, XP.gms[m]));
  celebrateGoal(g, Math.max(...fresh));                              // jen nejvyšší nový mezník
  if(sharedGids('g', g.id).length) announceGoal(g, Math.max(...fresh));   // skupina, viz 2i
}
```
- Kolísání hodnoty (váha 87 → 88 → 87) mezník neopakuje, protože `msHit` jen přibývá.
- Backfill: existujícím cílům se při prvním spuštění `msHit` nastaví potichu podle aktuálního `progress` (bez oslav, XP ano, viz 2j).

**Oslavy:**

| Mezník | Forma | Text (cs) |
|---|---|---|
| 25 % | `.av-reaction` + konfety | „Čtvrtina za tebou! 🎯“ · Rex: „Rozjeto. Teď už jen držet tempo.“ |
| 50 % | `.av-reaction` + konfety | „Půlka hotová! 💪“ |
| 75 % | `.av-reaction` + konfety | „Tři čtvrtiny! Cíl už je na dohled. 🔭“ |
| 100 % | modal `m-gwin` + konfety | „🏆 Cíl splněn!“ + hláška společníka + [📤 Pochlubit se skupině] (jen když je cíl sdílený) + [Archivovat] + [Hotovo] |

Hlášky jsou **podle společníka** (`game.say.goal.<av>`, 5×), pevné texty, ne AI.

### 2h) UI F1 (mobil 360 px)

**Dashboard: banner avatara** (`index.html:274`, `.avbanner`, plní `rDash`)
```
Před:
┌──────────────────────────────────────┐
│ ⚔️   Rex                           → │
│      Dobré ráno, Adame! Dnes 2/4.     │
└──────────────────────────────────────┘
Po:
┌──────────────────────────────────────┐
│ ╭───╮  Rex · Úroveň 7 🌿 Klíček    → │
│ │⚔️🧣│  Dobré ráno, Adame! Dnes 2/4.   │
│ ╰─7─╯  ▓▓▓▓▓▓▓░░░░  180 / 250 XP      │
└──────────────────────────────────────┘
```
Kruh (64 px) = podíl XP do další úrovně. Celý banner zůstává jedno tlačítko → stránka avatara. Na 360 px má text šířku ~220 px, název úrovně se zalomí pod jméno (`flex-wrap`).

**Stránka avatara** (`#av-chat-header`, `rAvPage`): stejná komponenta 56 px místo `#av-em`, pod jménem řádek `Úroveň 7 · 🌿 Klíček` a tlačítko **„🌱 Můj růst“** (`.btn-s`, 44 px) → sheet `m-game`. Energie zůstává pod tím beze změny.

**Sheet „Můj růst“** (`.moverlay` + `.modal.gf-sheet`, hlavička `.gf-head` jako `m-grpfeed`):
```
┌ 🌱 Můj růst                     ✕ ┐
│ ( 🌱 Růst | 🏅 Odznaky )           │ .seg.seg--block (Odznaky až v F2)
│        ╭─────╮                     │
│        │ ⚔️🧣 │  96 px              │
│        ╰──7──╯                     │
│   Úroveň 7 · 🌿 Klíček             │
│   ▓▓▓▓▓▓▓░░░░ 180 / 250 XP          │
│   Do úrovně 8 zbývá 70 XP           │
│ ─ Tento týden ─────────────────────│
│ [ +310 XP ] [ ⭐ 3 perfektní dny ]  │ 2 dlaždice .sth-card
│ ─ Šatník ──────────────────────────│
│ [🧣][🕶️🔒][🎧🔒][🎓🔒] …             │ 44×44, zamčené: „od úrovně 15“
│ Barva kruhu                         │
│ [●][●🔒][●🔒][●🔒]                    │
│ ─ Jak získat body ─────────────────│
│ ✅ Splněný návyk +10 · ⭐ Perfektní │
│ den +20 · 🎯 Mezník cíle +25 …       │ složené <details>
└────────────────────────────────────┘
```
Zamčená položka je `<button disabled aria-label="Brýle, odemkneš na úrovni 15">`, emoji s `filter:grayscale(1);opacity:.45`, text `--text2` (kontrast textu zůstává).

**Karta návyku** (`buildHabitCard` app.js:~1293): vedle série čip štítů.
```
Před:  🔥 12 dní
Po:    🔥 12 dní  ❄️ 2
```
Čip není tlačítko (jen info, `aria-label="2 štíty série"`). Při 0 štítech se nezobrazí.

**Detail návyku** (`renderHabitDetail`): sekce nad „Pauza“ (F2-DOC 2a):
```
❄️ Štíty série
┌───────────────────────────────────────┐
│ ❄️ ❄️   Máš 2 ze 2.                    │
│ Když jeden den vynecháš, štít sérii    │
│ podrží sám.                            │
│ Další štít za 3 dny v řadě.  (jen <2)  │
└───────────────────────────────────────┘
```

**Oslava úrovně** (`m-lvlup`, modal, fokus na „Super!“, Esc zavře):
```
┌────────────────────────────┐
│                          ✕ │
│          ╭─────╮           │
│          │ ⚔️  │  96 px     │
│          ╰──5──╯           │
│        Úroveň 5!           │  Playfair italic 28
│        🌿 Klíček            │
│ „Rosteme spolu. Tohle je   │
│  teprve začátek.“ — Rex     │  Crimson italic, --text2
│ ┌ Odemčeno ──────────────┐ │
│ │ 🧣 Šála   [Obléknout]   │ │  .btn-s 44 px
│ └────────────────────────┘ │
│ [         Super!         ] │  .btn-p
└────────────────────────────┘
```
Více oslav najednou (úroveň + mezník cíle): fronta, max. 1 modal na akci, ostatní jako `.av-reaction`.

**Cíl, měřitelná hodnota** (`buildGoalCard`, modal `m-goal`):
```
Karta:
┌───────────────────────────────────────┐
│ 🏃 Zhubnout 10 kg                   ⋯ │
│ 92 kg ━━━━━━━━●───────────── 82 kg     │
│ Teď 87,5 kg · 45 %   ◆25 ◆50 ◇75 ◇🏆   │ mezníky jen symbol, aria-label v textu
│ [ ➕ Zapsat hodnotu ]                   │ .btn-s, 44 px, plná šířka
└───────────────────────────────────────┘
Modal cíle, nové pole nad posuvníkem:
Jak měříš pokrok?
( 📊 Procenta | 🔢 Hodnota )             .seg.seg--block
Hodnota: [Začínám na: 92] [Cíl: 82] [Jednotka: kg]
         rychlé čipy jednotek: kg · km · Kč · stran · min
Zapsat hodnotu (sheet):
[ 87,5 ] kg      inputmode="decimal", čárka i tečka
Datum: (Dnes | Včera)                    .seg
[ Uložit ]
```

**Odezva „+10“:** malý text `+10` vyletí nad tlačítkem návyku (0,9 s, `aria-hidden`). Při `prefers-reduced-motion` se jen krátce ukáže bez pohybu.

**Nastavení → Vzhled a chování:** `.togrow` „🌱 Body a úrovně“ (zapnuto). Vypnutí skryje kruh, XP, oslavy úrovní a odznaky. Data zůstávají a výpočty se nezastaví (po zapnutí nic nechybí). Štíty a mezníky cílů fungují i vypnuté, protože nejsou soutěž, ale pomoc.

### 2i) Skupina (napojení na SDIL fáze 2)

- Mezník cíle se ohlásí jen u **sdíleného cíle** (zrcadlo `g`, SDIL 1b) aktivitou `goal/progress` s `val: 25|50|75` a `goal/done`.
- **Doporučení:** ohlašovat jen 25/50/75/100, ne každých 10 % (SDIL 1e). Méně šumu a každý záznam je důvod k 👏.
- Reakce na milník fungují beze změny (`target: 'a_<activityId>'`).
- Zrcadlo `g` dostane `msHit`, aby karta cíle u ostatních ukázala mezníky.
- Bez sdílení cíle se do skupiny nedostane nic.

### 2j) První spuštění (backfill)

1. `gameLoad` nenajde `v` → spočítá `days` ze všech načtených logů (400 dní), `msHit` a `gm_` odměny z aktuálního pokroku cílů a `lvlSeen` = výsledná úroveň (žádná vlna oslav).
2. Na dashboardu jednorázová karta (vzor `groupNotifIntroHTML`, klíč `lp_game_intro`):
```
┌ 🌱 NOVĚ: RŮST S REXEM ───────────────┐
│ ⚔️ Spočítal jsem tvoji dosavadní práci: │
│ 312 splněných návyků. Jsi na úrovni 9! │
│ Za každý splněný návyk teď sbíráš body │
│ a já s tebou rostu.                    │
│ [ Ukaž mi to ]        [ Později ]       │
└───────────────────────────────────────┘
```

---

## 3. F2: odznaky a týdenní souhrn

### 3a) Sbírka odznaků

Odznaky se vyhodnocují v `gameSync` (lokální data, žádné čtení navíc). Zápis `badges.<id> = datum` a `gameAward('bd_'+id, 25)`. **Žádné tajné odznaky**: zamčené ukazují postup.

| ID | Odznak | Podmínka | Zdroj |
|---|---|---|---|
| `first_step` | 🌱 První krok | první splněný návyk | logy |
| `first_week` | 📅 První týden | série 7 dní u libovolného návyku | `habitStreak` |
| `month` | 🔥 Měsíc v kuse | série 30 | 〃 |
| `hundred` | 💯 Stovka | série 100 | 〃 |
| `perfect` | ⭐ Perfektní den | první perfektní den | `days` + `dayXP` |
| `perfect_week` | 🌟 Perfektní týden | 7 perfektních dní v řadě | 〃 |
| `early_bird` | 🐦 Ranní ptáče | 10 dní se splněným návykem před 9:00 | `at` v logu (nové, jen od F1) |
| `shield` | ❄️ Záchrana | štít poprvé podržel sérii | logy `shield` |
| `comeback` | 🔁 Návrat | splněný návyk po pauze 7+ dní | logy (pozitivní formulace: „Vítej zpátky!“) |
| `half_goal` | 🏁 Na půli cesty | první mezník 50 % | `once.gm_*_50` |
| `goal_done` | 🏆 Cíl splněn | první cíl na 100 % | `once.gm_*_100` |
| `goals_3` | 🎯 Střelec | 3 splněné cíle | 〃 |
| `team_support` | 🤝 Podpora týmu | 10 pochval (součet `once.pr_*.n`) | `pr_` |
| `team_player` | 🧩 Týmový hráč | splněná výzva skupiny (F3) | `ch_` |
| `writer` | 📒 Pisálek | 10 poznámek | `entries` |
| `lvl_10` / `lvl_25` / `lvl_50` | 🍃 / 🌲 / ✨ | úroveň | `levelOf` |

18 odznaků. Nové se přidávají jen do pole `BADGES` (id, emoji, podmínka `(ctx) => {done, cur, max}`).

**UI** (sheet „Můj růst“, karta „🏅 Odznaky“):
```
( 🌱 Růst | 🏅 Odznaky )
Odznaky · 6 z 18
┌────────┐┌────────┐┌────────┐
│   🌱   ││   📅   ││  🔥░   │  mřížka 3 sloupce, gap 8 px
│ První  ││ První  ││ Měsíc  │  dlaždice = <button>, min-height 104 px
│ krok   ││ týden  ││ 12/30  │  zamčená: emoji šedé, postup
└────────┘└────────┘└────────┘
```
```css
.bdg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.bdg{min-height:104px;padding:10px 6px;border-radius:14px;background:var(--card2);border:1px solid var(--border);
  color:var(--text);font-family:'Crimson Pro',serif;font-size:13px;line-height:1.25;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.bdg-em{font-size:32px;line-height:1}
.bdg.locked .bdg-em{filter:grayscale(1);opacity:.45}
.bdg.locked{color:var(--text2)}
.bdg-new{box-shadow:0 0 0 2px var(--accent)}
```
Klepnutí → sheet detailu: velké emoji, název, popis, „Získáno 8. 10. 2026“ nebo postup s lištou a tipem, **[📤 Sdílet jako obrázek]** (jen získané).

**Obrázek odznaku:** stejný renderer jako F2-DOC 3 (canvas 1080×1350, tmavý brand, `document.fonts.load`, sdílení přes `navigator.share({files})`, záloha stažení). Obsah: logo, velké emoji odznaku v kruhu, název, „Získáno 8. 10. 2026“, úroveň a avatar, `lifepocket.app`. Jméno jen volitelně (výchozí vypnuto). Renderer z F2-DOC 3 je proto vhodné postavit jako obecné `drawShareCard(spec)`.

### 3b) Týdenní souhrn od Rexe

Navazuje na F2-DOC 3 (karta k sdílení počítaná čistě z čísel). Gamifikace přidá **kartu na dashboardu v pondělí a úterý** (do zavření, klíč `lp_week_card` = pondělí týdne):
```
┌ 🗓️ TVŮJ TÝDEN S REXEM ────────────────┐
│ ⚔️ „Pět perfektních dní. Makáš jak     │
│     stroj!“                            │
│ [ +420 XP ] [ ✅ 23× ]                  │ 2×2 dlaždice .sth-card
│ [ ⭐ 5 dní ] [ ❄️ 1 štít ]              │
│ 🏅 Nové: První týden                    │
│ [ 📤 Sdílet týden ]  [ Zavřít ]         │ .btn-s 44 px
└───────────────────────────────────────┘
```
- Data za minulý týden po–ne: XP (`Σdays + once` s `d` v týdnu), počet splnění, perfektní dny, použité štíty, nové odznaky a úrovně, nejdelší série.
- Hláška podle % splnění (`game.week.say.<0|1|2|3>`, pevné texty). Tón: i slabý týden je „Každý krok se počítá. Tento týden začneme zlehka.“
- „Sdílet týden“ = karta z F2-DOC 3 s jedním řádkem navíc: `Úroveň 9 · +420 XP`.
- AI report (`checkAutoWeeklyReport`) zůstává a karta na něj odkazuje „Celý report →“, pokud existuje.
- Žádná push notifikace.

### 3c) Volitelné ohlášení úspěchů ve skupině

- Přepínač `game.share.wins` (výchozí **vypnuto**). Při první oslavě úrovně nebo odznaku, když je uživatel ve skupině, se v oslavě jednou zeptáme: „Pochlubit se skupině, když dosáhneš nové úrovně nebo odznaku?“ [Ano] [Ne, díky].
- Aktivita `module:'game'`, `action:'level'` (`val` = úroveň) nebo `'badge'` (`ref` = id odznaku). Název odznaku si čtenář přeloží sám (`t('game.badge.'+ref)`), takže funguje cs i en.
- **Jen feed, žádná push** (server tyto záznamy v cronu přeskočí).
- `game.share.lvl` zapíše `members.<uid>.lvl` do skupiny. Karta člena pak ukáže „🌿 7“.

---

## 4. F3: společné výzvy skupiny

**Týmové, ne soupeřivé.** Skupina má jednu aktivní výzvu. Kdo se přidá, přispívá svými návyky do společného čísla.

### 4a) Data (bez nového listeneru)

```js
families/{gid}: {
  ...,
  challenge: { id:'c7k2', title:'Společně 100× pohyb', emoji:'🏃', target:100,
               from:'2026-10-13', to:'2026-10-26', by:'<uid>', board:false } | null,
  chLast: { title, emoji, n:104, target:100 },          // výsledek poslední výzvy
  members: { '<uid>': { ..., ch:{id:'c7k2', n:12}, lvl:7 } }   // příspěvek (n) a úroveň jen u těch, kdo se přidali nebo sdílí
}
users/{uid}/game/main.ch['<gid>'] = { id:'c7k2', hids:['<habitId>', ...] }   // které moje návyky se počítají (skupina nevidí)
```
- `n` = počet splnění vybraných návyků v období `from–to`. **Zapisuje se celé číslo (`set`), ne `increment`**, takže odškrtnutí ho opraví a zařízení se nepřepočítají dvakrát. Zápis jen při změně, debounce 5 s.
- Vše čte existující listener skupiny (`subscribeFamily`, `subscribeExtraGroup`). **Nový listener 0.** Každý zápis příspěvku = 1 zápis + N čtení u členů (max. 8). Při 5 zápisech denně na člena je to zanedbatelné.
- Konec: `sum(n) >= target` → každý klient jednou oslaví (`gameAward('ch_'+id, 50)`, odznak 🧩). Po `to` zapíše první klient `chLast` a `challenge:null`.
- Nesplněná výzva: „Dali jste dohromady 82 ze 100 💪 Skvělá týmová práce.“ Žádné „nepodařilo se“.

### 4b) UI (karta skupiny `buildGroupCard`)
```
🎯 Společná výzva
┌───────────────────────────────────────┐
│ 🏃 Společně 100× pohyb · do 26. 10.    │
│ ▓▓▓▓▓▓▓░░░  68 / 100                   │
│ 🐺 🦉 🌸 přispěli                       │ jen avatary, bez čísel (board:false)
│ [ Přidat se ]                          │ .btn-p
│  nebo: Můj příspěvek: 12 · [Upravit]   │
└───────────────────────────────────────┘
Žebříček (jen když board:true):
│ Příspěvky: Adam 24 · Jana 22 · Petr 12 │ řazeno podle jména, ne podle výkonu (otázka 12)
```
**Nová výzva** (sheet): název s čipy předvoleb („100× pohyb“, „50× čtení“, „Každý den voda“), cíl (číslo), délka `( 1 týden | 2 týdny | 4 týdny )` `.seg`, přepínač **„Ukázat příspěvky jednotlivě“ (výchozí vypnuto)**, [Spustit výzvu]. **Přidat se** = výběr vlastních návyků (checkboxy 44 px), nic víc.

### 4c) Pravidla (nasazuje uživatel)

Dnes smí běžný člen ve svém klíči `members.<uid>` zapsat libovolná pole (kontroluje se jen role, `joinedAt` a délka jména), takže `ch` a `lvl` projdou **bez změny pravidel**. Pole `challenge` ale smí měnit jen správce. Doporučené rozšíření `isFamilyMemberUpdate`:
```
&& request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['groupName', 'shareShop', 'shareCal', 'shareMeal', 'shareChecklist', 'members', 'challenge', 'chLast'])
&& (!('challenge' in request.resource.data) || validChallenge(request.resource.data.challenge))
// zpevnění: vlastní záznam člena jen se známými poli a omezeným ch/lvl
&& (!(request.auth.uid in request.resource.data.members)
    || (request.resource.data.members[request.auth.uid].keys().hasOnly(['name', 'avatar', 'joinedAt', 'role', 'ch', 'lvl'])
        && (!('lvl' in request.resource.data.members[request.auth.uid])
            || (request.resource.data.members[request.auth.uid].lvl is int && request.resource.data.members[request.auth.uid].lvl <= 50))))

function validChallenge(c) {
  return c == null || (c is map
    && c.keys().hasOnly(['id', 'title', 'emoji', 'target', 'from', 'to', 'by', 'board'])
    && c.title is string && c.title.size() >= 1 && c.title.size() <= 60
    && c.target is int && c.target >= 1 && c.target <= 10000
    && c.from is string && c.from.size() == 10 && c.to is string && c.to.size() == 10
    && c.board is bool && c.by is string);
}
```
Před nasazením `hasOnly` u `members` ověřit grepem všechny zápisy `members.<uid>` (založení, join, změna jména a avatara), jestli nepíšou jiná pole.

---

## 5. Pravidla Firestore: souhrn

| Fáze | Změna pravidel |
|---|---|
| F1 | **žádná** (`users/{uid}/game/main` a nová pole v `goals`, `habitLogs` spadají pod `users/**`) |
| F1 + SDIL fáze 2 | zrcadlo `g` (+ `msHit`, `target` podle SDIL 1b), `activity`: modul `goal`, akce `progress`. Patří do deploye SDIL fáze 2, ne zvlášť. |
| F2 (jen s ohlášením úspěchů) | `activity`: modul `game`, akce `level`, `badge`. Sloučit s deployem SDIL fáze 2. |
| F3 | `isFamilyMemberUpdate` + `validChallenge` (4c) |

Všechny deploye pravidel spouští uživatel (`firebase deploy --only firestore:rules`). Server (`functions/index.js`): cron upozornění musí přeskočit `module:'game'` a dostat texty pro `goal/progress` s `val`. To je součást SDIL fáze 2.

---

## 6. Náklady

| | Čtení | Zápisy | Listenery |
|---|---|---|---|
| F1 | +1 `getDoc` (`game/main`) při přihlášení | ~1 na změnu dne (debounce 0,8 s), odměny, `msHit`. Typicky 5–15 za den na uživatele. | **0 nových** (navázáno na existující `habitLogs` a `goals`) |
| F2 | 0 (odznaky ze stejného dokumentu a lokálních dat) | odznak = součást zápisu `gameSync` | 0 |
| F3 | 0 navíc u autora, N čtení u členů na zápis příspěvku (existující listener skupiny) | příspěvek jen při změně, debounce 5 s | 0 |
| Cloud Functions | žádná nová funkce, žádná AI | | |

---

## 7. Soukromí

**Co vidí skupina (jen to, co uživatel výslovně sdílí):**

| Data | Vidí skupina? |
|---|---|
| XP, úroveň, odznaky, štíty, doplňky | **Ne.** Úroveň jen s přepínačem „Ukázat úroveň ve skupině“ (`members.<uid>.lvl`). |
| Mezník cíle | Jen u cíle sdíleného do této skupiny (aktivita 7 dní). |
| Nová úroveň nebo odznak | Jen s přepínačem „Pochlubit se úspěchy“ (aktivita 7 dní, bez push). |
| Výzva | Jen když se přidáš: tvůj počet splnění v období výzvy. Které návyky to jsou, skupina nevidí. Jednotlivá čísla jen při zapnutém žebříčku, jinak jen to, že jsi přispěl/a. |

**`privacy.html` §3** do seznamu „Profil“ přidat samostatnou odrážku:
> **Body a úrovně**: body za splněné návyky a cíle po dnech, úroveň, odznaky, štíty série, mezníky cílů, vybrané doplňky avatara a nastavení sdílení úspěchů. Počítáme je z tvých záznamů a můžeš je v Nastavení vypnout. U splněného návyku ukládáme i čas splnění (kvůli odznaku „Ranní ptáče“).

**§5 Skupiny** přidat:
> **úroveň a úspěchy**, jen pokud to zapneš: tvoje úroveň, nově získané odznaky a dosažené mezníky sdílených cílů. Záznamy o úspěších se mažou po 7 dnech.
> **společné výzvy**, ke kterým se přidáš: kolikrát jsi v době výzvy splnil/a vybrané návyky (které návyky to jsou, ostatní nevidí). Jednotlivé příspěvky ostatní vidí, jen pokud je zakladatel výzvy zobrazí.

**`privacy-en.html`** (stejná místa):
> **Points and levels**: points for completed habits and goals per day, your level, badges, streak shields, goal milestones, chosen avatar accessories and your achievement-sharing settings. They are calculated from your records and you can turn them off in Settings. For a completed habit we also store the time of completion (for the “Early bird” badge).
> **level and achievements**, only if you turn this on: your level, newly earned badges and milestones of shared goals. Achievement entries are deleted after 7 days.
> **group challenges** you join: how many times you completed your chosen habits during the challenge (other members do not see which habits). Individual contributions are visible only if the challenge creator shows them.

**Export** (`EXPORT_COLS` app.js:2941): přidat `['game','body a odznaky']`. **Smazání účtu:** beze změny (`recursiveDelete(users/{uid})`). Příspěvek ve výzvě zmizí s odchodem ze skupiny (smaže se klíč `members.<uid>`).

---

## 8. i18n (cs + en)

Plurály ve formátu `{one, few, many, other}`. Rod není potřeba, texty jsou formulované neutrálně.

| Klíč | cs | en |
|---|---|---|
| `game.lvl` | `Úroveň {n}` | `Level {n}` |
| `game.lvl.seed` … `game.lvl.legend` (11) | Semínko, Klíček, Výhonek, Poupě, Květ, Stromek, Strom, Mohutný strom, Háj, Les, Legenda | Seed, Sprout, Shoot, Bud, Blossom, Sapling, Tree, Mighty tree, Grove, Forest, Legend |
| `game.xp` | `{cur} / {max} XP` | `{cur} / {max} XP` |
| `game.toNext` | `Do úrovně {n} zbývá {xp} XP` | `{xp} XP to level {n}` |
| `game.growth` | `🌱 Můj růst` | `🌱 My growth` |
| `game.tab.grow` / `game.tab.badges` | `🌱 Růst` / `🏅 Odznaky` | `🌱 Growth` / `🏅 Badges` |
| `game.lvlUp.title` | `Úroveň {n}!` | `Level {n}!` |
| `game.lvlUp.ok` | `Super!` | `Awesome!` |
| `game.unlocked` / `game.wear` | `Odemčeno` / `Obléknout` | `Unlocked` / `Put on` |
| `game.locked` | `Odemkneš na úrovni {n}` | `Unlocks at level {n}` |
| `game.wardrobe` / `game.ring` | `Šatník` / `Barva kruhu` | `Wardrobe` / `Ring colour` |
| `game.acc.scarf` … `game.acc.crown` (6) | Šála, Brýle, Sluchátka, Čepice, Hvězda, Koruna | Scarf, Glasses, Headphones, Cap, Star, Crown |
| `game.ring.accent` … `game.ring.legend` (6) | Základní, Mátová, Levandulová, Polární záře, Zlatá, Legenda | Classic, Mint, Lavender, Aurora, Gold, Legend |
| `game.say.lvl.<av>` (5) | např. rex: `Rosteme spolu. Tohle je teprve začátek.` | `We grow together. This is just the beginning.` |
| `game.say.goal.<av>` (5) | např. rex: `Rozjeto. Teď už jen držet tempo.` | `Rolling. Now just keep the pace.` |
| `game.goal.ms25` / `ms50` / `ms75` | `Čtvrtina za tebou! 🎯` / `Půlka hotová! 💪` / `Tři čtvrtiny! Cíl už je na dohled. 🔭` | `A quarter done! 🎯` / `Halfway there! 💪` / `Three quarters! The goal is in sight. 🔭` |
| `game.goal.done` | `🏆 Cíl splněn!` | `🏆 Goal achieved!` |
| `game.goal.brag` | `📤 Pochlubit se skupině` | `📤 Share with your group` |
| `game.goal.how` / `.pct` / `.val` | `Jak měříš pokrok?` / `📊 Procenta` / `🔢 Hodnota` | `How do you measure progress?` / `📊 Percent` / `🔢 Value` |
| `game.goal.start` / `.target` / `.unit` | `Začínám na` / `Cíl` / `Jednotka` | `Starting at` / `Target` / `Unit` |
| `game.goal.log` | `➕ Zapsat hodnotu` | `➕ Log a value` |
| `game.goal.now` | `Teď {v} {unit} · {pct} %` | `Now {v} {unit} · {pct}%` |
| `game.shield.title` | `❄️ Štíty série` | `❄️ Streak shields` |
| `game.shield.have` | `Máš {n} ze 2.` | `You have {n} of 2.` |
| `game.shield.how` | `Když jeden den vynecháš, štít sérii podrží sám.` | `If you miss a day, a shield keeps your streak automatically.` |
| `game.shield.next` | plurál: `Další štít za {n} den / dny / dní v řadě.` | `Next shield in {n} day / days in a row.` |
| `game.shield.used` | plurál: `❄️ Štít podržel sérii „{name}“. Nevadí, jedeme dál!` / `❄️ Štíty podržely série {n} návyků.` | `❄️ A shield kept your “{name}” streak. No worries, keep going!` / `❄️ Shields kept {n} streaks.` |
| `game.shield.earned` | `❄️ Máš nový štít série!` | `❄️ You earned a streak shield!` |
| `game.shield.aria` | plurál: `{n} štít / štíty / štítů série` | `{n} streak shield(s)` |
| `game.streak.restart` | `Nová série začíná dnes 🌱 Tvůj rekord {n} dní zůstává.` | `A new streak starts today 🌱 Your record of {n} days stays.` |
| `game.badges.count` | `Odznaky · {n} z {total}` | `Badges · {n} of {total}` |
| `game.badge.<id>` + `game.badge.<id>.d` (18 + 18) | název a popis podmínky | name and condition |
| `game.badge.got` | `Získáno {date}` | `Earned {date}` |
| `game.badge.share` | `📤 Sdílet jako obrázek` | `📤 Share as image` |
| `game.week.title` | `🗓️ Tvůj týden s {av}` | `🗓️ Your week with {av}` |
| `game.week.say.0` … `.3` | 4 hlášky podle % (od „Každý krok se počítá…“ po „Makáš jak stroj!“) | 4 lines by % |
| `game.week.new` | `🏅 Nové: {list}` | `🏅 New: {list}` |
| `game.intro.title` / `.text` | `🌱 Nově: růst s {av}` / `Spočítal jsem tvoji dosavadní práci: {n} splněných návyků. Jsi na úrovni {lvl}!` | `🌱 New: grow with {av}` / `I counted your progress so far: {n} completed habits. You are level {lvl}!` |
| `game.set.toggle` / `.desc` | `🌱 Body a úrovně` / `Body, úrovně, odznaky a oslavy. Štíty série fungují vždy.` | `🌱 Points and levels` / `Points, levels, badges and celebrations. Streak shields always work.` |
| `game.set.shareLvl` / `game.set.shareWins` | `Ukázat úroveň ve skupině` / `Pochlubit se úspěchy ve skupině` | `Show my level in groups` / `Share achievements with groups` |
| `game.ask.share` | `Pochlubit se skupině, když dosáhneš nové úrovně nebo odznaku?` | `Share with your group when you reach a new level or badge?` |
| `gf.game.level` / `gf.game.badge` / `gf.goal.ms` | `{name}: úroveň {n} 🌱` / `{name}: nový odznak {badge}` / `{name}: {title} na {n} % 🎯` | `{name}: level {n} 🌱` / `{name}: new badge {badge}` / `{name}: {title} at {n}% 🎯` |
| `ch.*` (F3, ~15 klíčů) | `🎯 Společná výzva`, `Přidat se`, `Můj příspěvek: {n}`, `{sum} / {target}`, `přispěli`, `Ukázat příspěvky jednotlivě`, `Dali jste dohromady {sum} z {target} 💪 Skvělá týmová práce.`, … | ekvivalenty |

Ci-check už hlídá shodu klíčů cs/en.

---

## 9. Fáze implementace

| Fáze | Obsah | Soubory | Rules | Odhad | Závislost |
|---|---|---|---|---|---|
| **F0** | F2-DOC 2a **bez ručního zamrazení** (`habitDayState`, `pauses`, sjednocení výpočtů série) + `addDays` | app.js | ne | 1 den | — |
| **F1** | `game/main`, `gameLoad`/backfill, `dayXP`, `gameSync`, `gameAward`, úrovně a názvy, kruh avatara (dashboard, stránka avatara), sheet „Můj růst“ (Růst + Šatník), oslava úrovně, „+10“; štíty (`habitShields`, `gameAutoShield`, čip na kartě, sekce v detailu); měřitelný cíl, `msHit`, `goalProgressChanged`, oslavy 25/50/75/100; pochvaly XP; přepínač v Nastavení; úvodní karta; `at` v logu; export; privacy §3; oprava `spawnConfetti` (reduced motion) | app.js, index.html, style.css, i18n, privacy*.html | ne | 4–5 dní | F0 |
| **F1S** | ohlášení mezníků sdílených cílů ve skupině | s SDIL fáze 2 | ano (SDIL 2) | +0,5 dne | SDIL 2 |
| **F2** | odznaky (`BADGES`, tab, detail), obrázek odznaku a týdenní karta přes `drawShareCard` (F2-DOC 3), týdenní souhrn na dashboardu, volitelné ohlášení úspěchů a úrovně ve skupině, privacy §5 | app.js, index.html, style.css, i18n, privacy*.html, functions (přeskočit `game` v cronu) | ano (sloučit s SDIL 2) | 3 dny | F1, F2-DOC 3 |
| **F3** | výzvy skupiny, žebříček, odznak 🧩, privacy §5 | app.js, index.html, style.css, i18n, privacy*.html, firestore.rules | ano (4c) | 3 dny | F1 |

Každá fáze = `APP_VERSION` + `CHANGELOG` + bump `CACHE`. Bez změn v `manifest.json` a `pwa.js` (reinstalace PWA netřeba). Changelog F1:
> 🌱 Rex teď roste s tebou! Za splněné návyky a cíle sbíráš body, postupuješ úrovněmi a odemykáš Rexovi doplňky. ❄️ Nové štíty série: za 7 dní v řadě získáš štít, který tvou sérii podrží, když jeden den vynecháš. 🎯 Cíle umí měřitelnou hodnotu (třeba kila nebo kilometry) a slaví každou čtvrtinu cesty.

**Testy (statické):** simulace v node pro `lvlXP`/`levelOf` (hranice 1, 2, 49, 50), `dayXP` (zaškrtnout, odškrtnout, zaškrtnout = stejné XP), `habitShields` (7 dní → 1, 14 → 2, 21 → 2, štít −1, mezera 3 dny = nic), `goalPct` (cíl dolů i nahoru, mimo rozsah), `goalProgressChanged` (kolísání kolem 50 % = 1 oslava), `addDays` přes změnu času (29. 3. a 25. 10.).

---

## 10. Rizika

- **Série se po F0 změní** (pauzy a dny frekvence se začnou počítat správně), typicky se prodlouží. Uvést v changelogu (F2-DOC 2a).
- **Backfill** dá dlouholetým uživatelům hned vysokou úroveň. To je záměr (ocenit dosavadní práci). Oslava se nespouští, jen úvodní karta.
- **Logy starší než 400 dní** se do backfillu nedostanou. Přijatelné.
- **Kolize zápisu** `game/main` ze dvou zařízení: tečkové cesty se slučují po polích, `xp` je jen cache. Nic se neztratí.
- **Výkon:** `habitShields` a `dayXP` přes index `hLog`, výsledky cachované do další změny logů. Bez měřitelného dopadu.
- **Motivace přes body:** kdo body nechce, vypne je v Nastavení. Štíty a mezníky zůstanou.
- **„Neomezené přeskočení“:** ⏭ je dnes neutrální bez limitu, takže štít je pro toho, kdo přeskočení nepoužívá. Viz otázka 15.

---

## 11. Otevřená rozhodnutí (výchozí = moje doporučení)

1. **Odškrtnutí vrátí body dne** (jen dnes a včera, tiše, bez „−10“)? **ANO.** Bez toho by šlo body farmit odškrtáváním.
2. **Body za pochvalu dávají, ne dostávají** (5 XP, max. 3 za den)? **ANO** (nejde domluvit mezi dvěma lidmi).
3. **Štíty na návyk** (každý návyk má své, max. 2), ne jeden globální? **ANO**, protože série jsou v appce na návyk.
4. **Štít nahradí ruční „zamrazení 2× za měsíc“ z F2-DOC 2a**, pauza zůstane? **ANO.** Jedno pravidlo, žádné dva limity.
5. **Štít se použije sám** a jen když pokryje celou mezeru (1–2 dny, série ≥ 3)? **ANO.**
6. **Týdenní návyky bez štítů** v F1? **ANO**, mají týdenní sérii (F2-DOC 2b). Vrátit se k tomu po F1.
7. **Backfill z historie** (400 dní) při prvním spuštění? **ANO**, s tichou úvodní kartou bez oslav.
8. **Přepínač „Body a úrovně“ v Nastavení**, výchozí zapnuto, štíty a mezníky fungují vždy? **ANO.**
9. **Úroveň a úspěchy ve skupině výchozí vypnuto** s jednorázovou otázkou při první oslavě? **ANO** (soukromí na prvním místě).
10. **Mezníky cíle ve skupině jen 25/50/75/100**, ne každých 10 % (mění SDIL 1e)? **ANO.**
11. **Měřitelný cíl:** start, cíl, jednotka, historie max. 60 zápisů, podcíle pak pokrok neovlivňují? **ANO.**
12. **Žebříček ve výzvě:** výchozí vypnuto, zapíná zakladatel, řazení podle jména (ne podle výkonu), bez zvýraznění posledního? **ANO.** Alternativa: řadit podle příspěvku (víc soutěžení).
13. **Výzvu může založit kdokoli ze skupiny** (vyžaduje pravidla 4c), ne jen správce (bez změny pravidel)? **ANO**, týmovost. Pokud se má F3 nasadit bez deploye pravidel, pak dočasně jen správce.
14. **Názvy úrovní z růstu rostlin** (bez rodu): Semínko → Legenda? **ANO.** Alternativa z NAPADY.md „Mladý bojovník → Legenda“ sedí jen k Rexovi ⚔️, ne k Sage nebo Noře.
15. **Přeskočení ⏭ zůstane neomezené** (je to vědomé rozhodnutí, ne podvod)? **ANO**, řešit až podle zpětné vazby (backlog).
16. **Žádná push notifikace kvůli bodům, úrovním a odznakům**, jen feed a oslava v appce? **ANO.**
17. **Týdenní souhrn jako karta na dashboardu v pondělí a úterý**, bez push? **ANO.**
18. **Sjednotit emoji avatarů ve skupině** (`MEMBER_AV` 🐺🦉🌸 vs. `AVS` ⚔️🌿🏡)? **ANO, v F1**, protože kruh úrovně se ve skupině ukáže s avatarem. Volba emoji je na vedoucím (doporučuji `AVS`).
