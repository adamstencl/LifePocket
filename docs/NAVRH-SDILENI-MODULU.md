# Návrh: sdílení osobních modulů ve skupině + reakce

Stav ke dni 2026-10-08. Navazuje na `docs/NAVRH-NOTIF-SKUPINY.md` (dál jen **NOTIF**): kolekce `activity`, `logGroupActivity`, režimy `instant | q15 | evening | off`, noční klid, feed „Co je nového“. Čísla řádků platí pro pracovní kopii a posouvají se (`app.js` teď mění koder kvůli i18n). Proto u každého místa uvádím i název funkce. Nové texty v UI patří do `i18n/cs.js` a `i18n/en.js` přes `t('…')`. Níže je uvádím česky.

---

## 0. Výchozí stav (co návrh mění)

| Co | Kde | Pozn. |
|---|---|---|
| Návyky | `users/{uid}/habits`, `habitLogs` (`{habitId}_{YYYY-MM-DD}`); `subHabits` `app.js:~1197`, karta `buildHabitCard` `:~1229` (série se počítá uvnitř), detail `renderHabitDetail` `:~1508` | Zápis logu je na **13 místech**: `toggleHabit` `:~1753`, `adjustHabit`, `toggleHabitDay` `:~1825`, `directInput`, `deleteHabit` `:~1986`, `handleNotifHabitDone` `:~4069`, `logHabitFromEntry` `:~10408`, `createHabitFromEntry` … |
| Série | `getStreak` `:~5091` (bez `skipped`) × výpočet v `buildHabitCard` (se `skipped`) | Dvě různé logiky, sjednotit (viz 3a) |
| Cíle | `users/{uid}/goals` + `goals/{id}/subgoals`; `subGoals` `:~7834`, `saveG`, `togSubDone` `:~7944`, `updateGoalProgress` `:~7859`, `archiveGoal` `:~7995`, karta `buildGoalCard` `:~8045` | **Cíl má jen `progress` 0–100 %**, žádnou cílovou hodnotu ani jednotku (viz otázka 1) |
| Poznámky | `users/{uid}/entries` (`title`, `text`, `mood`, `photo`); `saveEntry` `:~955`, `deleteEntry` `:~993`, seznam `renderEntryList` `:~812` | Stránka „📒 Poznámky“ = zápisky i deník v jednom |
| Recepty | `users/{uid}/savedRecipes`; `saveRecipe` `:~9691`, `deleteSavedRecipe`, `renderRecipe` `:~9563`, `renderSavedRecipes` `:~9727` | |
| Skupiny | `familyId` + `extraGroupIds`; `buildGroupCard` `:~6115`, `toggleFamilyModule` `:~5632`, `leaveFamily` `:~5461`, `leaveExtraGroup` `:~5735`, `removeFamilyMember` `:~5958`, `subscribeFamily` `:~5995`, `subscribeExtraGroup` `:~5972` | **Chyba dnes:** karta vedlejší skupiny ukazuje přepínače Nákupy/Jídelníček/Checklist, ty ale nic nedělají (funguje jen kalendář) |
| Server | `deleteAccount` `functions/index.js:~825` (+ `leaveGroupForDelete` `:~797`), `rotateGroupCode` `:~1045` (`copySubcollections` `:~928`, `copyDelta` `:~956`) | Rotace kopíruje **všechny** podkolekce skupiny se stejnými ID dokumentů |
| Pravidla | `firestore.rules`: `families/{id}/{sub}/{doc}` = libovolný člen čte i zapisuje cokoli | Nové kolekce se musí z obecného pravidla vyjmout (jako `activity` v NOTIF 1e) |

---

## 1. Datový model

### 1a) Varianty

| | A: zrcadlo ve skupině `families/{gid}/shared/{type}_{uid}_{itemId}` | B: samostatné kolekce `sharedHabits`, `sharedGoals`… | C: přímé čtení `users/{uid}/…` přes pravidla |
|---|---|---|---|
| Pravidla | 1 blok, `isFamMember(gid)` = 1 `get()` na dotaz (u `list` se pravidlo vyhodnotí jednou za dotaz, ne za dokument) | 4 téměř stejné bloky | Pravidlo musí ověřit členství čtenáře **i** vlastníka a sdílení položky: 2–3 `get()`; navíc rozbije jednoduché a dnes bezpečné `users/** = jen vlastník` |
| Náklady čtení | 1 listener na skupinu (návyky+cíle), poznámky a recepty na vyžádání | 2–4 listenery na skupinu | 1 listener **na každého člena a modul**. K tomu `habitLogs` kvůli sérii (stovky dokumentů) |
| Soukromí | Ven odchází jen výslovně vybraný souhrn. Logy, nálady a popisy cíle zůstávají doma | stejné jako A | Čtenář by musel mít přístup k `habitLogs`, a tím k celé historii |
| Rotace kódu | Kopíruje se samo (podkolekce skupiny) | samo | nic se nekopíruje, ale musí se přepsat `sharedIn` u všech položek všech členů |
| Úklid | smazat dokumenty `where ownerUid==uid` v jedné kolekci | 4 kolekce | změnit pole u položek |

**Doporučuji A: jedna kolekce `shared` se zrcadlem.** ID je deterministické (`h_<uid>_<habitId>`), takže zápis je vždy celý `setDoc` (bez merge). Zrcadlo se tak samo opraví a nevzniknou duplicity.

**Zdroj pravdy o tom, co sdílím, je zrcadlo samo, ne pole u položky.** Klient si mapu `mySharedIn[itemKey] = Set(gid)` sestaví z listeneru `shared` dané skupiny (`ownerUid == CU.uid`). Díky tomu:
- po `rotateGroupCode` se nic nepřepisuje (zrcadla se zkopírují pod nový kód a listener nové skupiny je najde);
- není co rozbít v `profile/main` (riziko přepsání přes `merge` z NOTIF 1c).

### 1b) `families/{gid}/shared/{sid}`

`sid = type + '_' + ownerUid + '_' + itemId`, kde `type ∈ h | g | n | r`.

```js
// společné
{ type:'h', ownerUid, itemId, updatedAt: serverTimestamp(), arch: false }

// h – návyk (≈ 300 B)
{ name ≤ 60, emoji, freq:{type:'daily'|'weekly'|'days', times?, days?},
  htype:'check'|'count', goal: int,          // u count: „50 dřepů“ = goal 50
  doneDate: 'YYYY-MM-DD' | '',               // poslední den splnění (lokální datum vlastníka, toDS)
  value: int,                                // dnešní hodnota u count
  streak: int, best: int,                    // série k doneDate, nejlepší
  last7: '1101101',                          // 7 znaků, nejstarší → dnes; 1 splněno, 0 ne, - pauza/skip
  paused: bool, ms: {v:30, d:'2026-10-08'} } // poslední ohlášený milník (proti dvojímu hlášení)

// g – cíl (≈ 1 kB)
{ name ≤ 60, emoji, color, progress: 0–100, deadline: 'YYYY-MM-DD' | '',
  target?: {start, goal, current, unit ≤ 8},  // jen když cíl bude měřitelný (otázka 1)
  subs: [{n ≤ 60, d: bool}] (max 20), doneAt: 'YYYY-MM-DD' | '' }
// NEsdílí se: description, category, priority, propojené návyky, úkoly podcílů

// n – poznámka (jen výslovně sdílená)
{ title ≤ 100, text ≤ 20 000 }               // NE mood, NE photo (otázka 4)

// r – recept
{ name, time, portions, mealType, ingredients[], steps[], tips? }   // ≤ 50 kB, totéž co renderRecipe
```

Proč `doneDate` a ne `doneToday`: kdyby vlastník appku druhý den neotevřel, zůstalo by v zrcadle „dnes splněno“. Čtenář si proto stav dopočítá sám:
- splněno dnes = `doneDate === toDS()`;
- série platí = `doneDate >= včera`, jinak se ukáže „naposledy 3. 10.“.

Časová pásma se v CZ prakticky neliší, u cizích pásem jde o posun ±1 den. To beru jako přijatelné.

### 1c) Reakce: `families/{gid}/reactions/{rid}`

```js
// emoji: rid = `${target}_${uid}_${em}` → přepínač = set/delete, nejde dát 2× totéž
{ kind:'e', target:'s_h_UID_HID' | 'a_<activityId>', to: ownerUid, uid, em:'clap'|'fire'|'heart'|'strong',
  ts: serverTimestamp(), expireAt: now+30 d }
// komentář: rid = autoId
{ kind:'c', target, to, uid, text: 1–200 znaků, ts, expireAt: now+30 d }
```

- Plochá kolekce stačí na 1 listener na skupinu: `where('ts','>',now−30d)` (automatický index). Seskupení podle `target` se dělá v paměti.
- **Proč ne podkolekce pod `shared/{sid}`:** reakce na aktivitu (feed) by neměly kam patřit a `deleteAccount` by musel procházet každou položku zvlášť.
- `em` se ukládá jako klíč, ne jako emoji: ID dokumentu je pak čisté ASCII a pravidlo kontroluje výčet.
- `EM = {clap:'👏', fire:'🔥', heart:'❤️', strong:'💪'}`.
- TTL `expireAt` 30 dní: `gcloud firestore fields ttls update expireAt --collection-group=reactions --enable-ttl --project=lifepocket-d8f0e` (spouští uživatel).

### 1d) Aktivita: rozšíření `families/{gid}/activity` z NOTIF 1a

Typy ze zadání se mapují na stávající dvojici `module` + `action`. Server, feed i debounce tak zůstávají stejné.

| Typ ze zadání | `module` | `action` | `title` | navíc |
|---|---|---|---|---|
| `habit_done` | `habit` | `done` | `50 dřepů` (jen název, emoji v `title` ne) | `ref: sid` |
| `habit_streak` | `habit` | `streak` | název | `val: 7 \| 30 \| 100`, `ref` |
| `goal_progress` | `goal` | `progress` | `Zhubnout 10 kg` nebo `Zhubnout 10 kg: Běhat 3× týdně` (splněný podcíl) | `val: %`, `ref` |
| `goal_done` | `goal` | `done` | název | `ref` |
| `note_shared` | `note` | `share` | titulek | `ref` |
| `recipe_shared` | `recipe` | `share` | název | `ref` |
| `reaction` | `react` | `add` | název cílové položky (≤ 60) | `to: uid`, `em: 'clap,fire'` nebo `msg ≤ 200` (komentář), `ref: target` |

Nová pole: `ref ≤ 200`, `val` int, `to` uid, `em` řetězec, `msg ≤ 200`. Pravidlo z NOTIF 1e rozšířit o tyto klíče a výčty modulů a akcí (kapitola 2).

**Debounce** (`logGroupActivity`, NOTIF 2a):
- klíč `gid|module|action` platí dál, takže 3 návyky během 4 s dají 1 záznam (`title:'dřepy, voda, čtení', n:3`);
- `ref` u sloučeného záznamu = první položka;
- `streak` a `goal/done` se **neslučují**: klíč doplnit o `ref`, ať má každý milník vlastní řádek a vlastní reakce;
- `react` slučovat podle `gid|react|to`: emoji se spojí do `em`;
- komentář se neslučuje, zapíše se hned.

**Zpětné vzetí:** zrušení odškrtnutí do 4 s zavolá `unlogGroupActivity(gid,'habit','done',name)`. Po odeslání záznam zůstane, feed ho ale u návyku s `doneDate !== ts den` ukáže přeškrtnutě. To je kosmetika, netřeba řešit hned.

### 1e) Kdy a jak se zrcadlo zapisuje

Nové funkce dát do bloku „SDÍLENÍ POLOŽEK“ v `app.js` za `logGroupActivity`:

```js
// ── SDÍLENÍ OSOBNÍCH POLOŽEK (zrcadlo families/{gid}/shared) ──
const SH_TYPES = {h:'habit', g:'goal', n:'note', r:'recipe'};
const mySharedIn = new Map();               // 'h_<itemId>' → Set(gid); plní listener shared
const sharedByGroup = {};                   // gid → [mirror] cizích členů (h, g)
const shSid = (type, itemId) => `${type}_${CU.uid}_${itemId}`;
function sharedGids(type, itemId) { return [...(mySharedIn.get(type+'_'+itemId) || [])]; }

const _shTimers = new Map();
function syncShared(type, itemId, extra) {   // debounce 1,5 s: tlačítka +/− nepíšou 10×
  if(!CU || !sharedGids(type,itemId).length) return;
  clearTimeout(_shTimers.get(type+itemId));
  _shTimers.set(type+itemId, setTimeout(() => writeMirror(type, itemId, extra), 1500));
}
async function writeMirror(type, itemId, extra = {}) {
  const data = buildMirror(type, itemId);   // habit/goal/note/recipe → objekt 1b; null = položka neexistuje
  for(const gid of sharedGids(type, itemId)) {
    if(!data) { unshareItem(type, itemId, gid); continue; }
    setDoc(doc(db,'families',gid,'shared',shSid(type,itemId)),
      {...data, type, ownerUid:CU.uid, itemId, updatedAt:serverTimestamp()})
      .catch(e => console.warn('[LP] zrcadlo', e?.code || e?.name));
    if(extra.activity) logGroupActivity(gid, SH_TYPES[type], extra.activity, data.name||data.title, 1, {ref:shSid(type,itemId), val:extra.val});
  }
}
```

Volání:

| Položka | Kde (`app.js`) | Co |
|---|---|---|
| Návyk – log | **Nový obal `putHabitLog(log)` / `delHabitLog(logId)`**. Nahradí všech 13 přímých `setDoc/deleteDoc(…'habitLogs'…)`. Ci-check grepem hlídá, že jinde už nejsou | po zápisu `onHabitLogChanged(hid, date, wasDone, isDone)`: když `date === toDS()` a `!wasDone && isDone` → `syncShared('h',hid,{activity:'done'})` a kontrola milníku; jinak jen `syncShared('h',hid)` |
| Návyk – milník | v `onHabitLogChanged` | `s = habitStreak(h, today)`. Když `s ∈ {7,30,100}` a `mirror.ms.v !== s \|\| ms.d !== today` → `logGroupActivity(…,'habit','streak', name, 1, {ref, val:s})`, do zrcadla `ms:{v:s,d:today}` |
| Návyk – definice | `saveHabit` (úprava), `archiveHabit` `:~2002`, `pauseHabit`, `saveHabitReminder` ne | `syncShared('h',id)`; archivace → `arch:true` |
| Návyk – smazání | `deleteHabit` `:~1986` | `unshareAll('h',id)` **před** smazáním |
| Cíl | `saveG`, `togSubDone`, `saveSubG`, `delSubG`, `archiveGoal`/`unarchiveGoal` | `syncShared('g',gid, act)`: `act` = `done`, když progress přešel na 100; `progress`, když `floor(new/10) > floor(old/10)` nebo se splnil podcíl; jinak nic. `delG` → `unshareAll` |
| Poznámka | `saveEntry` `:~955` | jen `syncShared('n',id)`; úprava aktivitu nevytváří. `deleteEntry` → `unshareAll` |
| Recept | recepty se neupravují; `deleteSavedRecipe` → `unshareAll` | — |

`habitStreak(h, ds)` vyjmout z `buildHabitCard` (výpočet se `skipped`) a použít i v `getStreak`/`checkAvatarReactions`. Ty dnes počítají jinak, takže by „7 dní“ ve skupině a u avatara mohlo nesedět.

**Půlnoc:** `last7` a `streak` se počítají při zápisu. Když vlastník dnes nic neodškrtne, zrcadlo zůstane včerejší a čtenář si stav dopočítá z `doneDate` (1b). Při startu appky (po `habitsReady`) navíc proběhne jednorázový `syncShared` všech sdílených návyků, max. jednou za den (`lp_sh_day`).

### 1f) Sdílení, zrušení, odchod, smazání účtu, rotace

| Událost | Kdo | Co se stane |
|---|---|---|
| **Sdílet** do gid | vlastník | `writeMirror` + `mySharedIn` + aktivita: `note/share` a `recipe/share` vždy; u návyku a cíle žádná (není to výkon). |
| **Zrušit sdílení** | vlastník | `unshareItem(type,id,gid)`: smazat zrcadlo, `activity where ref==sid` (jen vlastní; pravidlo povolí autorovi delete) a reakce `where target=='s_'+sid` (pravidlo povolí `to == auth.uid`). Feed tak neukazuje mrtvé odkazy. |
| **Odchod** (`leaveFamily`, `leaveExtraGroup`) | odcházející | **Před** `updateDoc(members.uid → deleteField)`: `unshareAllInGroup(gid)` = `getDocs(where ownerUid==uid)` + batch delete. Reakce a komentáře, které dal ostatním, zůstávají jako ostatní obsah skupiny (privacy §5) a zmizí přes TTL. |
| **Odebrání správcem** | správce | `removeFamilyMember` `:~5958`: po odebrání smaže `shared where ownerUid==uid` (pravidlo povolí správci). Pojistka: odebraný klient v `isRemovedFromGroup` větvi (`subscribeFamily`) zkusí smazat sám (pravidlo povolí vlastníkovi i bez členství). A čtenáři **filtrují** zrcadla, jejichž `ownerUid` už není v `members`. |
| **Smazání položky** | vlastník | `unshareAll(type,id)` ve všech skupinách. |
| **`deleteAccount`** | server | V `leaveGroupForDelete` **před** transakcí (admin SDK pravidla neřeší): `families/{gid}/shared where ownerUid==uid` → `recursiveDelete`/batch; `reactions where uid==uid` a `activity where uid==uid` → delete (komentáře a jména jsou osobní údaj, nečekat na TTL). Automatické jednopólové indexy stačí. |
| **`rotateGroupCode`** | server | Bez změny: `shared`, `reactions` i `activity` se zkopírují se stejnými ID, takže `target 'a_<id>'` i `'s_<sid>'` zůstanou platné. **Pozor:** NOTIF §3 doporučuje `activity` při kopii přeskočit. Kvůli reakcím na aktivitu doporučuji kopírovat (je jí málo, TTL 7 d). Klient: listener nové skupiny naplní `mySharedIn` znovu. Offline zápis zrcadla do starého kódu selže (`permission-denied`, dokument skupiny už neexistuje) a další `syncShared` zapíše do nového. |

---

## 2. Pravidla (jen popis, nasazuje uživatel, sloučit s NOTIF 1e a rozpracovanou změnou rolí)

```
function isFamMember(fid) { … jako NOTIF 1e … }
function isFamAdmin(fid) { return get(/…/families/$(fid)).data.members[request.auth.uid].get('role','') == 'admin'; }

match /families/{fid}/shared/{sid} {
  allow read: if isFamMember(fid);
  allow create, update: if isFamMember(fid)
    && request.resource.data.ownerUid == request.auth.uid
    && (resource == null || resource.data.ownerUid == request.auth.uid)
    && request.resource.data.type in ['h','g','n','r']
    && sid == request.resource.data.type + '_' + request.auth.uid + '_' + request.resource.data.itemId
    && request.resource.data.updatedAt == request.time
    && request.resource.data.keys().hasOnly([...povolená pole podle 1b...])
    && (request.resource.data.get('name','') is string && request.resource.data.get('name','').size() <= 60)
    && (request.resource.data.type != 'n' || request.resource.data.text.size() <= 20000);
  // vlastník smí smazat i po odchodu (úklid); správce kvůli odebraným členům
  allow delete: if request.auth != null
    && (resource.data.ownerUid == request.auth.uid || isFamAdmin(fid));
}

match /families/{fid}/reactions/{rid} {
  allow read: if isFamMember(fid);
  allow create: if isFamMember(fid)
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.ts == request.time
    && request.resource.data.to is string && request.resource.data.to != request.auth.uid   // na sebe ne
    && request.resource.data.target.matches('^(a|s)_[A-Za-z0-9_-]{1,200}$')
    && request.resource.data.expireAt < request.time + duration.value(31,'d')
    && ( (request.resource.data.kind == 'e'
          && request.resource.data.em in ['clap','fire','heart','strong']
          && rid == request.resource.data.target + '_' + request.auth.uid + '_' + request.resource.data.em
          && request.resource.data.keys().hasOnly(['kind','target','to','uid','em','ts','expireAt']))
      || (request.resource.data.kind == 'c'
          && request.resource.data.text is string
          && request.resource.data.text.size() >= 1 && request.resource.data.text.size() <= 200
          && request.resource.data.keys().hasOnly(['kind','target','to','uid','text','ts','expireAt'])) );
  allow update: if false;
  // autor; adresát (může smazat komentář pod svou položkou); správce (moderace)
  allow delete: if request.auth != null && (resource.data.uid == request.auth.uid
    || resource.data.to == request.auth.uid || isFamAdmin(fid));
}

// activity (NOTIF 1e) rozšířit:
//  module in [..., 'habit','goal','note','recipe','react'], action in [..., 'streak','progress']
//  keys().hasOnly([... , 'ref','val','to','em','msg'])
//  ref ≤ 200, val int 0–1000, em ≤ 40, msg ≤ 200
//  allow delete: if resource.data.uid == request.auth.uid   (úklid při zrušení sdílení)

// obecné pravidlo: subcollection not in ['activity','shared','reactions']
```

**Pravost `to`:** u `target 's_…'` lze ověřit bez `get()`: `to == target.split('_')[2]` (`sid = type_uid_itemId`; uid z Firebase Auth ani autoId podtržítko neobsahují). U `a_…` by to stálo `get()` aktivity. Doporučuji **neověřovat**: lživé `to` může jen poslat upozornění jinému členovi téže skupiny. Server stejně bere jména z `members`.

---

## 3. UI

Společné:
- dotykové plochy ≥ 44 px;
- barvy jen z tokenů (`--card2`, `--border`, `--accent`, `--on-accent`, `--text*`), takže motivy `dark-gold`, `sunshine` a `tangerine` fungují bez úprav;
- bottom sheet = `.moverlay` + `.tp-sheet` přes `om()` / `cm()`, aby fungoval systémový Zpět.

### 3a) Akce „Sdílet“ a indikátor: čip stavu

Jeden prvek pro všechny čtyři moduly: **čip, který ukazuje stav a po klepnutí otevře výběr skupin.** Není tak potřeba zvláštní tlačítko a zároveň je pořád vidět, co je soukromé.

```
🔒 Soukromé  ›             (výchozí, tlumené)
👨‍👩‍👧 Rodina  ›              (sdíleno v 1 skupině, zvýrazněné)
👨‍👩‍👧 Rodina +1  ›           (víc skupin)
```

Kde:

| Modul | Umístění | Pozn. |
|---|---|---|
| Návyk | `renderHabitDetail`: nová sekce **nad** „⚙️ Správa návyku“: `<div class="hd-section-title">👨‍👩‍👧 Sdílení</div>` + čip přes celou šířku | V kartě návyku jen indikátor, ne akce (karta je plná tlačítek) |
| Cíl | rozbalený cíl (`.gsubs` v `buildGoalCard`), poslední řádek; a v modalu `m-goal` pod termínem | `.btn-xs` ✏️ 🗑️ mají pod 44 px, další ikonu tam nepřidávat |
| Poznámka | editor: řádek `.j-meta` vedle data (`#j-date`) | Horní lišta `j-edit-top` je na 360 px plná (Zpět, název, 🎤, Smazat, Uložit) |
| Recept | `renderRecipe`: do `.cook-actions` vedle „🔖 Uložit“ tlačítko `👨‍👩‍👧 Sdílet` | Neuložený recept se při sdílení nejdřív uloží (zrcadlo potřebuje `itemId`), toast „Recept uložen a nasdílen“ |

Indikátor v seznamech je malý odznak `👨‍👩‍👧` za názvem:
- v `buildHabitCard`, `buildGoalCard` (`.gnm`), `renderEntryList` (`.j-item-title`, vedle 📷) a `renderSavedRecipes`;
- `aria-label="Sdíleno: Rodina"`.

Bez skupiny: čip se nezobrazí vůbec, žádné lákání na prázdno.

**Sheet „Sdílet se skupinou“**

```
┌──────────────────────────────────────┐
│ 👨‍👩‍👧 Sdílet návyk                   ✕ │
│ 🏋️ 50 dřepů                           │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 👨‍👩‍👧 Rodina · 3 členové      [●══] │ │  ← .fshare-mod-row + .fshare-toggle
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 💼 Obchodní tým · 6 členů   [══○] │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 👀 Ostatní uvidí: název, jak často,  │
│ jestli máš dnes splněno a sérii.     │
│ Můžou ti poslat 👏 a krátký vzkaz.   │
│ Upravovat nic nemůžou.               │
│                                      │
│ [            Hotovo            ]     │
└──────────────────────────────────────┘
```

Text „Ostatní uvidí“ podle typu:
- **cíl:** „název, pokrok v %, termín a podcíle. Popis a úkoly ne.“;
- **poznámka:** „celý text a nadpis, jen ke čtení. Náladu a fotku ne.“;
- **recept:** „celý recept.“

Přepínač se uloží hned a ukáže toast:
- zapnutí: „✓ Sdíleno se skupinou Rodina“;
- vypnutí: „Už se nesdílí se skupinou Rodina“. Vypnutí nepotřebuje potvrzení, je vratné.

```html
<div class="moverlay sheet-bottom" id="m-share"><div class="tp-sheet" role="dialog" aria-modal="true" aria-labelledby="sh-title">
  <div class="sh-head"><h2 id="sh-title" class="sh-title"></h2>
    <button type="button" class="sh-x" onclick="cm('m-share')" aria-label="Zavřít">✕</button></div>
  <div class="sh-item" id="sh-item"></div>
  <div id="sh-groups"></div>
  <p class="sh-note" id="sh-note"></p>
  <button type="button" class="btn-p" style="min-height:48px" onclick="cm('m-share')">Hotovo</button>
</div></div>
```

```js
// řádek skupiny (gid jen přes data-*, viz CLAUDE.md)
`<div class="fshare-mod-row" role="switch" tabindex="0" aria-checked="${on}" data-a0="${esc(gid)}"
   onclick="toggleItemShare(this.dataset.a0)" style="min-height:52px;cursor:pointer">
   <span style="font-size:18px">👨‍👩‍👧</span>
   <span style="flex:1;font-size:15px;color:var(--text)">${esc(name)} <span class="sh-cnt">· ${n} ${plural}</span></span>
   <div class="fshare-toggle ${on?'on':''}"><div class="fshare-thumb"></div></div></div>`
```

```css
.share-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-family:'Crimson Pro',serif;font-size:15px;cursor:pointer;max-width:100%}
.share-chip.on{border-color:var(--accent);color:var(--text)}
.share-chip .sc-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
.sh-badge{font-size:13px;margin-left:4px;opacity:.85}
.sh-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.sh-title{font-size:18px;margin:0;color:var(--text)}
.sh-x{min-width:44px;min-height:44px;border:none;background:none;color:var(--text2);font-size:20px;cursor:pointer}
.sh-item{font-size:15px;color:var(--text2);margin-bottom:12px}
.sh-cnt{color:var(--text3);font-size:13px}
.sh-note{font-size:14px;color:var(--text2);line-height:1.45;background:var(--card2);border-radius:12px;padding:10px 12px;margin:10px 0 14px}
```

### 3b) Kde ostatní sdílené položky uvidí

**Doporučení: sekce „Sdíleno ve skupině“ přímo v Návycích a Cílech.** Poznámky a recepty dostanou přepínač `.seg` „Moje | Od skupiny“. Žádnou novou stránku skupiny se záložkami nedělat.
- Uživatel je v kontextu, kde návyky už řeší. Nové místo v navigaci by se muselo vysvětlovat.
- Feed „Co je nového“ (NOTIF 4b) už plní roli „stránky skupiny“ pro dění a stačí ho rozšířit.

Návyky (`index.html` za `#habits-list`, render v `renderHabits`):

```
🔥 Návyky                     ‹ Dnes ›
… moje karty …

👨‍👩‍👧 SDÍLENO VE SKUPINĚ            ▾      ← sbalitelné, stav v lp_open_groups
[Všichni] [Jana] [Petr]                   ← .gf-chip, jen když >1 člen sdílí
🌸 Jana
┌────────────────────────────────────┐
│ 🏋️ 50 dřepů            ✓ Dnes hotovo│
│ každý den · 🔥 12 dní               │
│ ●●○●●●●                    7 dní   │
│ [👏 2][🔥][❤️ 1][💪]        💬 1    │
└────────────────────────────────────┘
```

- Sekce se zobrazí jen když `sharedByGroup` obsahuje cizí `h`. Pořadí: dnes nesplněné nahoře? **Ne:** pořadí podle vlastníka a `name`, ať karty neskáčou.
- Při navigaci na jiný den (`habitPrevDay`) se sekce skryje. Zrcadlo zná jen dnešek a 7 dní.
- Cíle: stejně pod `#goals-list`, nad „+ Přidat nový cíl“.
- Poznámky: v `.journal-sidebar-top` pod nadpis `.seg` „Moje | Od skupiny (2)“. Sdílená poznámka se otevře v editoru **jen ke čtení**: `readonly`, schované 🎤/Smazat/Uložit/nálada, nahoře řádek „👨‍👩‍👧 Od Jany · Rodina · jen ke čtení“ a pod textem lišta reakcí.
- Recepty: v `#saved-recipes-section` `.seg` „Moje | Od skupiny“. Sdílený recept se otevře v `renderRecipe` a místo „🔖 Uložit“ má „🔖 Uložit k sobě“ (kopie do vlastních `savedRecipes`) a lištu reakcí.

### 3c) Karta sdíleného návyku a cíle

```html
<article class="shc" aria-label="Návyk Jany: 50 dřepů">
  <div class="shc-top">
    <span class="shc-em" aria-hidden="true">🏋️</span>
    <div class="shc-nm">50 dřepů</div>
    <span class="shc-st done">✓ Dnes hotovo</span>            <!-- nebo .shc-st „Dnes zatím ne“ -->
  </div>
  <div class="shc-meta">každý den · 🔥 12 dní</div>          <!-- série neplatná → „naposledy 3. 10.“ -->
  <div class="shc-week" aria-label="Posledních 7 dní: 6 splněno">
    <i class="on"></i><i class="on"></i><i></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i>
  </div>
  <div class="rx-bar" data-target="s_h_UID_HID"> … 3d … </div>
</article>
```

Cíl: místo týdne progress bar (stávající `.gpbar`, `.gpfill` s barvou cíle) a řádek `🏁 31. 12. · 📌 3/5`. Klepnutí na `📌 3/5` rozbalí podcíle (`✓`/`○` + název, jen ke čtení). Měřitelný cíl (otázka 1): `78 / 75 kg · zbývá 3 kg`. Splněný cíl: štítek `🎉 Splněno!` (`.gtag.gcompleted`).

```css
.shc{background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:8px}
.shc-top{display:flex;align-items:center;gap:10px}
.shc-em{font-size:22px;flex:none}
.shc-nm{flex:1;min-width:0;font-size:16px;color:var(--text);font-weight:600;overflow-wrap:anywhere}
.shc-st{flex:none;font-size:13px;padding:2px 10px;border-radius:12px;background:var(--card3);color:var(--text2)}
.shc-st.done{background:var(--accent);color:var(--on-accent)}
.shc-meta{font-size:14px;color:var(--text2);margin:4px 0 6px}
.shc-week{display:flex;gap:4px;margin-bottom:8px}
.shc-week i{width:14px;height:14px;border-radius:4px;background:var(--card3);border:1px solid var(--border)}
.shc-week i.on{background:var(--green);border-color:transparent}
.shc-owner{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text2);margin:12px 0 6px}
.shc-sec{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin:20px 0 8px}
```

Stav „hotovo“ nenese jen barva, je u něj i text a ✓. Týdenní čtverečky mají souhrn v `aria-label`.

### 3d) Reakce

Lišta je stejná na kartě sdílené položky, ve feedu (řádky `habit`/`goal`/`note`/`recipe`) a v otevřené poznámce či receptu.

```
[👏 2] [🔥] [❤️ 1] [💪]          [💬 1]
```

- 4 tlačítka 44×44 + komentáře vpravo. Na 360 px: 4×44 + 3×6 + 64 = 258 px, vejde se i s okraji.
- Moje reakce = `.on` (obrys `--accent`) + `aria-pressed="true"`. Klepnutí přepíná (set/delete dokumentu `rid`).
- Ve vlastní položce lišta reakcí není, je tam jen souhrn „👏 Adam, Jana · 💬 1“ (tlačítko `.rx-sum`). Ten otevře sheet „Reakce“ se seznamem a komentáři.
- Reagovat na sebe nejde (pravidlo `to != uid`), proto se u vlastních řádků ve feedu lišta skryje.
- Malá odezva: po klepnutí emoji krátce „vyskočí“ (`transform:scale(1.2)`, 150 ms, vypnuté při `prefers-reduced-motion`). Toast ne, byl by to šum.

**Sheet komentářů** (`m-rx`):

```
┌──────────────────────────────────────┐
│ 💬 50 dřepů · Jana                 ✕ │
│ 👏 Adam  🔥 Adam  ❤️ Petr             │  ← kdo reagoval
│ ──────────────────────────────────── │
│ 🐺 Adam · před 2 h                    │
│    Jsi borec, jen tak dál! 💪       ✕│  ← ✕ jen autor / adresát
│ 🦉 Petr · včera                       │
│    Zítra jdu s tebou!                │
│ ──────────────────────────────────── │
│ [Napiš povzbuzení…        ] [Poslat] │  ← maxlength=200, počítadlo od 160 znaků
└──────────────────────────────────────┘
```

Prázdný stav: „Zatím nikdo nic nenapsal. Pošli první povzbuzení 💪“. Odeslání: `Enter` nebo tlačítko, ořez mezer, prázdné nejde. Limit v klientu je 1 komentář za 3 s a 20 reakcí za minutu.

```js
const RX = [['clap','👏','Potlesk'],['fire','🔥','Oheň'],['heart','❤️','Srdce'],['strong','💪','Síla']];
function rxBar(gid, target, to, title) {
  const mine = rxIndex(gid, target);             // {clap:{n:2, me:true}, …, c:1}
  return `<div class="rx-bar">${RX.map(([k,e,l]) => {
      const r = mine[k] || {n:0};
      return `<button type="button" class="rx-btn${r.me?' on':''}" aria-pressed="${!!r.me}" aria-label="${l}${r.n?' ('+r.n+')':''}"
        data-a0="${esc(gid)}" data-a1="${esc(target)}" data-a2="${esc(to)}" data-a3="${k}" data-a4="${esc(title)}"
        onclick="toggleReaction(this.dataset.a0,this.dataset.a1,this.dataset.a2,this.dataset.a3,this.dataset.a4)">${e}${r.n?`<span>${r.n}</span>`:''}</button>`;
    }).join('')}
    <button type="button" class="rx-btn rx-c" aria-label="Komentáře (${mine.c||0})" data-a0="${esc(gid)}" data-a1="${esc(target)}" data-a2="${esc(to)}" data-a3="${esc(title)}"
      onclick="openReactions(this.dataset.a0,this.dataset.a1,this.dataset.a2,this.dataset.a3)">💬${mine.c?`<span>${mine.c}</span>`:''}</button></div>`;
}
```

```css
.rx-bar{display:flex;gap:6px;align-items:center}
.rx-btn{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:44px;min-height:44px;padding:0 8px;border-radius:22px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:18px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rx-btn span{font-size:13px;color:var(--text2);font-family:'Crimson Pro',serif}
.rx-btn.on{border-color:var(--accent);background:var(--card3)}
.rx-btn.rx-c{margin-left:auto}
.rx-btn.pop{animation:rxPop .15s ease}
@keyframes rxPop{50%{transform:scale(1.2)}}
@media (prefers-reduced-motion:reduce){.rx-btn.pop{animation:none}}
.rx-sum{min-height:44px;background:none;border:none;color:var(--text2);font-size:14px;cursor:pointer;padding:0}
.rx-cm{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}
.rx-cm-t{font-size:15px;color:var(--text);overflow-wrap:anywhere;line-height:1.35}
.rx-form{display:flex;gap:8px;margin-top:10px}
.rx-form input{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);color:var(--text);padding:0 12px;font-size:16px} /* 16 px = iOS nezoomuje */
```

Data: jeden listener na skupinu `reactions where ts > now−30 d` (+ `limit(500)`). Pro feed i karty `rxIndex` z paměti. Odhlásit v `resetFamilyLocal` a `forgetExtraGroupLocal`.

### 3e) Feed „Co je nového“ (rozšíření NOTIF 4b)

Čipy:
```
[Vše] [🔥] [🏆] [📒] [👨‍🍳] [👏] [🧺] [🗓️] [🥗] [📋] [🧊]
```
- Osobní moduly jsou vlevo (častější), `👏` = „Reakce na mě“.
- Zobrazit jen čipy modulů, které ve skupině mají data, jinak je řádek moc dlouhý.

| | done | streak | progress | share | react |
|---|---|---|---|---|---|
| habit | Splněno: 50 dřepů | 🔥 30 dní v řadě: 50 dřepů | | | |
| goal | 🎉 Splněný cíl: Zhubnout 10 kg | | Pokrok 60 %: Zhubnout 10 kg | | |
| note | | | | Sdílená poznámka: Tipy na výlet | |
| recipe | | | | Nový recept: Svíčková | |
| react | | | | | 👏🔥 k „50 dřepů“ / 💬 „Jsi borec!“ k „50 dřepů“ |

- Řádky osobních modulů mají pod textem `rxBar` (target `a_<id>`). Klepnutí na text otevře položku: návyk/cíl sjede na kartu v sekci „Sdíleno“, poznámka a recept se otevřou jen ke čtení.
- Milník je řádek se zvýrazněním `.gf-item.ms` (`border-left-color:var(--accent)`, emoji 🎉 větší).
- Reakce „na mě“ mají vlastní čip a ve feedu se ukazují jen adresátovi. Reakce mezi jinými lidmi feed **nezobrazuje**, byl by to šum. Počty jsou vidět u položky.

```css
.gf-item.ms{border-left-color:var(--accent);background:var(--card3)}
.gf-item .rx-bar{margin-top:8px}
```

### 3f) Nastavení → Notifikace → „Ze skupin“ (rozšíření NOTIF 4a)

```
👨‍👩‍👧 Upozornění ze skupin
🧺 Nákupy … 🧊 Zásoby                  (beze změny)

SDÍLENÉ POLOŽKY
🔥 Návyky          [Hned|15 min|●Večer|Vyp.]
🏆 Cíle            [●Hned|15 min|Večer|Vyp.]
📒 Poznámky        [●Hned|15 min|Večer|Vyp.]
👨‍🍳 Recepty         [Hned|15 min|●Večer|Vyp.]
👏 Reakce na mě     [●Hned|15 min|Večer|Vyp.]

☑ 🎉 Milníky hned (série 7, 30, 100 dní a splněný cíl)
☐ Hlásit i odškrtnuté položky („koupeno“, hotovo)
🌙 Noční klid …
```

Výchozí volby a důvod:

| Řádek | Výchozí | Proč |
|---|---|---|
| Návyky | **Večer** | Denní splnění je časté. Jeden večerní souhrn („Jana dnes splnila 3 návyky“) stačí na pochvalu a neruší. Kdo chce každé splnění hned (příklad ze zadání), přepne si to jedním klepnutím. |
| Cíle | **Hned** | Vzácné a důležité. Pokrok se hlásí po 10 %. |
| Poznámky | **Hned** | Sdílení poznámky je záměrný krok autora („tohle si přečti“). |
| Recepty | **Večer** | Inspirace, ne naléhavé. |
| Reakce na mě | **Hned** | Smysl pochvaly je dostat ji, dokud to má cenu. |
| Milníky hned | **zapnuto** | Výjimka z režimu modulu: série a splněný cíl přijdou hned i při „Večer“. Při „Vyp.“ nepřijde nic. Noční klid platí. |

Kód: `GN_MODS` rozšířit, `GROUP_NOTIF_DEFAULTS` (klient **i** server) doplnit o `habit:'evening', goal:'instant', note:'instant', recipe:'evening', react:'instant', msInstant:true`. Nadpis „SDÍLENÉ POLOŽKY“ jako `.gf-day`. Řádky osobních modulů se ukážou, když je uživatel v jakékoli skupině. „Reakce na mě“ jen když sám něco sdílí nebo už nějakou reakci dostal (komentář dostane i za aktivitu).

Popisek checkboxu „Hlásit i odškrtnuté“ zůstává jen pro nákup a checklist (viz 4, oprava filtru).

---

## 4. Notifikace (napojení na cron z NOTIF §3)

Změny v bloku „Skupiny“ v `processUser` (`functions/index.js`, `sendScheduledNotifications`):

1. **Filtr skupin:**
   - NOTIF má „u ostatních jen hlavní skupina“, to se mění: `habit | goal | note | recipe | react` projdou v **každé** skupině;
   - `shop | meal | check | pantry` dál jen v hlavní (dokud nebude kapitola 7).
2. **Oprava filtru `done`:** `a.action !== 'done' || gp.notifyChecked` platí jen pro `shop` a `check`. Jinak by se `habit/done` a `goal/done` při výchozím nastavení zahodily.
3. **Reakce:** `module === 'react'` → jen když `a.to === uid`.
4. **Režim záznamu** místo `gp[a.module]`:
   ```js
   const isMs = (a) => (a.module==='habit' && a.action==='streak') || (a.module==='goal' && a.action==='done');
   const modeOf = (a, gp) => gp[a.module]==='off' ? 'off' : (isMs(a) && gp.msInstant ? 'instant' : gp[a.module]);
   ```
   Zrychlení pro milníky: `instant` čeká na ustálení `INSTANT_SETTLE` 2 min. Milník a reakce stačí ustálit 1 min.
5. **Tag a seskupení:**
   - `instant` a `q15`: 1 push na modul a skupinu, tag `grp-<gid>-<module>`;
   - **milník má vlastní tag** `grp-<gid>-ms-<ref>`, ať ho další souhrn návyků nepřepíše;
   - reakce mají tag `grp-<gid>-react`;
   - data `{open:'grpfeed', gid, module}`. U milníku a reakce navíc `ref`, feed pak odroluje a zvýrazní řádek.
6. **Noční klid** platí pro všechno kromě `evening` (beze změny NOTIF). Ranní běh pošle 1 souhrn na modul. Milníky z noci přijdou ráno jako souhrn („🎉 Jana: 30 dní v řadě“), ne každý zvlášť.

### Texty (server, `GN_MOD` a `GN_VERB` rozšířit)

```js
GN_MOD.habit=['🔥','Návyky']; GN_MOD.goal=['🏆','Cíle']; GN_MOD.note=['📒','Poznámky'];
GN_MOD.recipe=['👨‍🍳','Recepty']; GN_MOD.react=['👏','Reakce'];
GN_VERB.habit={done:['splnil','']};  GN_VERB.goal={progress:['posunul','cíl'], done:['splnil','cíl']};
GN_VERB.note={share:['sdílí','poznámku']}; GN_VERB.recipe={share:['přidal','recept']};
const navyk = (k) => k===1 ? 'návyk' : k<5 ? 'návyky' : 'návyků';
```

| Situace | Titulek | Tělo |
|---|---|---|
| 1 návyk | `🔥 Návyky · Rodina` | Jana splnila: 50 dřepů 💪 |
| víc návyků | `🔥 Návyky · Rodina` | **Jana splnila 3 návyky:** 50 dřepů, voda, čtení |
| víc lidí | `🔥 Návyky · Rodina` | Jana splnila 3 návyky · Adam splnil 1 návyk |
| série | `🎉 Jana: 30 dní v řadě!` | 50 dřepů – celý měsíc bez přerušení. Pošli jí 👏 |
| (7 / 100) | `🔥 Jana: týden v řadě!` / `👑 Jana: 100 dní v řadě!` | … |
| cíl splněn | `🏆 Jana splnila cíl!` | Zhubnout 10 kg 🎉 Pogratuluj jí. |
| pokrok | `🏆 Cíle · Rodina` | Jana posunula cíl Zhubnout 10 kg na 60 % |
| poznámka | `📒 Jana sdílí poznámku` | Tipy na výlet · Rodina |
| recept | `👨‍🍳 Recepty · Rodina` | Jana přidala recept: Svíčková |
| reakce (emoji) | `👏 Adam ti tleská` | za 50 dřepů |
| reakce víc | `👏 Reakce · Rodina` | Adam 👏🔥 a Petr ❤️ k 50 dřepů |
| komentář | `💬 Adam:` | „Jsi borec, jen tak dál!“ · k 50 dřepů |
| večerní souhrn | `👨‍👩‍👧 Dnes ve skupině Rodina` | 🔥 Jana 3 návyky · 🏆 1 cíl 60 % · 🧺 5 změn |

- Titulek reakce podle `em`: clap „ti tleská“, fire „ti posílá 🔥“, heart „ti posílá ❤️“, strong „tě povzbuzuje 💪“.
- Ženský tvar `+a` podle `a.g` (NOTIF). Jména bere server z `members`.
- `msg` komentáře v push se ořízne na 120 znaků.
- Večerní souhrn pro osobní moduly počítá **lidi a počty**, ne názvy, aby zůstal krátký.

**Na později (fáze 5):** akce v notifikaci `👏 Pochválit` (`actions` ve `webpush.notification`, obsluha v `sw.js` vedle stávající akce „splněno“ a v `handleNotifHabitDone`). Zapíše reakci bez otevření appky. Mění `sw.js`, takže bump `CACHE`.

### Náklady
- Žádná nová sonda: osobní moduly i reakce jdou přes stejnou `activity`.
- Zápisy:
  - splnění sdíleného návyku = 1 zrcadlo + 1 aktivita (na skupinu);
  - reakce = 1 reakce + 1 aktivita.
- Čtení u člena: 1 listener `shared` (h+g) + 1 `reactions` na skupinu. Poznámky a recepty se načtou `getDocs` až po otevření „Od skupiny“. U 8 členů s 10 sdílenými položkami to je zanedbatelné.

---

## 5. Soukromí

**Co přesně vidí ostatní členové (a jen v té skupině, kterou vybereš):**

| | Vidí | Nevidí |
|---|---|---|
| Návyk | název, emoji, frekvenci, typ a cílový počet, zda je dnes splněno a dnešní hodnotu, sérii (aktuální a nejlepší), posledních 7 dní, pauzu | připomínky, propojený cíl, starší historii, poznámky ke dni |
| Cíl | název, emoji, barvu, pokrok, cílovou hodnotu (je-li), termín, názvy a stav podcílů | popis, kategorii, prioritu, úkoly podcílů, propojené návyky, vizi |
| Poznámka | nadpis a text výslovně sdílené poznámky, jen ke čtení | náladu, fotku, ostatní poznámky a deník |
| Recept | celý recept | |
| Vždy | tvé jméno u sdílené položky, reakce a komentáře, které dáš nebo dostaneš | vše nesdílené; AI chat, zdraví, jídlo |

**Aktivita:** splnění, série, pokrok, sdílení a reakce ve feedu, 7 dní (NOTIF).
**Reakce a komentáře:** 30 dní.

### `privacy.html` §5

Do „Co vidí ostatní členové skupiny“ přidat odrážku:
> **položky, které výslovně nasdílíš**: u návyku název, jak často ho děláš, zda je dnes splněný a tvou sérii (posledních 7 dní); u cíle název, pokrok, termín a podcíle; u poznámky její nadpis a text; u receptu celý recept. Sdílení zapneš u každé položky zvlášť a můžeš ho kdykoli vypnout. Ostatní členové tvé položky nemůžou upravovat.

> **reakce a komentáře** (👏 🔥 ❤️ 💪 a krátký vzkaz do 200 znaků), které dáš nebo dostaneš u sdílené položky. Mažou se automaticky po 30 dnech.

Větu „Tvoje osobní data (zápisky, návyky, cíle, …) členové skupiny nevidí.“ nahradit:
> Ostatní tvoje osobní data (zápisky a deník, nesdílené návyky a cíle, nálady, zdraví, chat s AI a další) členové skupiny nevidí.

K „Odchod ze skupiny“ doplnit:
> Při odchodu nebo odebrání ze skupiny se tvé sdílené položky ze skupiny odstraní. Reakce a komentáře, které jsi dal ostatním, zůstanou nejdéle 30 dní.

§10 (smazání účtu):
> Se smazáním účtu odstraníme i tvé sdílené položky, reakce, komentáře a historii změn ve všech skupinách.

§3 (profil) beze změny, sdílení se v profilu neukládá.

### `privacy-en.html` (stejná místa)
> **items you explicitly share**: for a habit its name, how often you do it, whether it is done today and your streak (last 7 days); for a goal its name, progress, deadline and sub-goals; for a note its title and text; for a recipe the full recipe. You turn sharing on for each item separately and can turn it off at any time. Other members cannot edit your items.
> **reactions and comments** (👏 🔥 ❤️ 💪 and a short message up to 200 characters) you give or receive on a shared item. They are deleted automatically after 30 days.
> When you leave or are removed from a group, your shared items are removed from it. Reactions and comments you gave to others remain for up to 30 days.
> When you delete your account, we also delete your shared items, reactions, comments and change history in all groups.

### Export (`EXPORT_COLS` `app.js:~2899`)
Zrcadla jsou kopie, proto se znovu neexportují. Do JSON přidat sekci `sdileni`:
- `[{skupina, typ, polozka}]` z `mySharedIn`;
- `reakce`: tvé reakce a komentáře z načtených skupin (`reactions where uid==me`, `getDocs` na skupinu).

Do popisu exportu doplnit „a co sdílíš ve skupinách“.

---

## 6. Fáze implementace (každá samostatně nasaditelná)

| Fáze | Obsah | Kdo / soubory | Odhad | Závislost |
|---|---|---|---|---|
| **0** | NOTIF fáze A+B (aktivita, cron, feed, nastavení) | koder | (NOTIF) | — |
| **1: Návyky + reakce** | `putHabitLog`/`delHabitLog` (13 míst) + `habitStreak`; zrcadlo `h`, sheet sdílení, čip, odznak; sekce „Sdíleno ve skupině“ v Návycích; `reactions` + lišta + sheet komentářů; aktivita `habit/done`, `habit/streak`, `react`; feed řádky; nastavení Návyky / Reakce na mě / Milníky; úklid při odchodu a smazání | koder (`app.js`, `index.html`, `style.css`, i18n), druhý koder `functions/index.js` (filtr, texty, `deleteAccount`) | 3–4 dny | 0 |
| **1R: pravidla** | `shared`, `reactions`, rozšíření `activity`, výjimky z obecného pravidla; TTL `reactions` | uživatel (deploy pravidel = otázka) | 0,5 dne | 1 ověřeno. **Do té doby to funguje i se starým obecným pravidlem** (člen smí zapisovat do podkolekcí), takže 1 jde nasadit dřív. Bezpečnostní okno je stejné jako dnes. |
| **2: Cíle** | zrcadlo `g`, sekce v Cílech, `goal/progress`, `goal/done`; volitelně měřitelný cíl (otázka 1) | koder | 1,5 dne (+1 den měřitelný cíl) | 1 |
| **3: Poznámky + recepty** | zrcadla `n`, `r`, `.seg` „Moje / Od skupiny“, náhled jen ke čtení, „Uložit k sobě“ | koder | 1,5–2 dny | 1 |
| **4: Privacy, export, changelog** | texty 5, export | koder | 0,5 dne | s fází 1 (privacy musí jít ven **spolu s 1**) |
| **5: Akce v notifikaci „👏 Pochválit“** | `functions` + `sw.js` + `CACHE` | koder | 1 den | 1 |
| **6: Společné moduly ve vedlejších skupinách** | kapitola 7 | koder | 3–4 dny | nezávislé |

Každá fáze = `APP_VERSION` + `CHANGELOG` + `CACHE`. Changelog fáze 1:
> 👨‍👩‍👧 Nově můžeš sdílet návyky se skupinou. Ostatní uvidí, jak se ti daří, a můžou ti poslat 👏 nebo krátký vzkaz. Sdílení zapneš v detailu návyku.

---

## 7. Společné moduly ve vedlejších skupinách

Dnes platí, že nákupy, jídelníček, checklist a zásoby existují jen v hlavní skupině. Kód je postavený na jediném `familyId`: `isShopShared`, `familyShopItems`, `subscribeSharedShop`, `mealViewMode`, `list._family`; `familyId` je v `app.js` 126×.

**Návrh:** přepínač režimu v modulu se z „Moje | Rodina“ změní na „Moje | Rodina | Tým“. Zobrazí se jen skupiny, které mají daný modul zapnutý. `shopViewMode` se tak mění z `'shared'|'personal'` na `'personal'|<gid>`.
- **Nákupy:** `shopGroupId`. Jen 1 listener na **zvolenou** skupinu (líně), ne na všechny.
- **Checklist:** sdílený seznam nese `list._gid` místo `_family`. V sheetu sdílení checklistu jde vybrat skupinu (stejný sheet jako 3a).
- **Jídelníček:** `mealGroupId`. Role správce (`isMealAdmin`) se bere ze zvolené skupiny.
- **Zásoby: nechat jen v hlavní skupině.** Zásoby jsou jeden fyzický sklad domácnosti a dnes se ukládají do skupiny automaticky. Druhý sklad by mátl.

Dopady:
- **Jednoduchost:** na 360 px se vejdou 3 segmenty („Moje | Rodina | Tým“). Při 4+ skupinách se `.seg` nahradí výběrem (`<select>` stylovaný jako čip). Dlouhé názvy zkracovat na 10 znaků s `…`.
- **Pravidla:** beze změny. Obecné pravidlo už členům vedlejší skupiny podkolekce povoluje.
- **Notifikace:** filtr cronu „jen hlavní skupina“ odpadne pro moduly, které skupina sdílí (`famData.shareShop` atd.). Nastavení zůstává globální podle modulu.
- **AI kontext** (`buildChatContext`): bere nákup ze zvolené skupiny, ne ze všech (limit 7000 znaků).
- **Riziko regrese:** vysoké. Všechna místa s `familyId` v nákupu, jídelníčku a checklistu se musí přepsat na `shopGid()` a podobné. Tester grepem.
- **Rychlá oprava hned (malá změna):** v `buildGroupCard` u vedlejší skupiny ukazovat jen přepínač Kalendář. Dnešní přepínače Nákupy, Jídelníček a Checklist tam nic nedělají a matou.

Doporučení: **samostatná fáze 6 až po fázích 1–3**. Přínos je menší (obchodní tým sdílí hlavně kalendář a cíle) a riziko vyšší.

---

## 8. Rizika

1. **Opomenutý zápis logu návyku:** zrcadlo pak neodpovídá. Řeší obal `putHabitLog` + grep v ci-check + denní resync při startu.
2. **Dvě logiky série** (`getStreak` × `buildHabitCard`): bez sjednocení ukáže skupina jinou sérii než karta. Sjednotit ve fázi 1.
3. **Zastaralé zrcadlo po půlnoci:** čtenář počítá z `doneDate`, takže se nikdy neukáže falešné „dnes splněno“.
4. **Hodiny a pásmo vlastníka:** `doneDate` je lokální datum vlastníka. U cest do zahraničí může být posun o den. Přijatelné.
5. **Únik přes zrcadlo po odebrání** (vlastník appku neotevře): správce maže při odebrání a čtenáři filtrují podle `members`.
6. **Spam reakcí a komentářů:** limit v klientu, seskupení na serveru, tag nahrazuje starou notifikaci, adresát může komentář smazat a správce moderuje. Nahlášení komentáře zatím ne (otázka 6).
7. **Citlivý obsah poznámky:** sdílí se jen výslovně, sheet ukáže „Ostatní uvidí celý text“, nálada a fotka se nesdílí. Úprava sdílené poznámky se propisuje ostatním hned, a to musí být v sheetu napsané.
8. **Souběh s NOTIF a cizími změnami:** `functions/index.js` (notifikace) a `app.js` (i18n) mění jiní kodeři. Fáze 1 začne až po jejich commitu. Pravidla se sloučí s rozpracovanou změnou rolí do jednoho nasazení.
9. **Rotace kódu:** NOTIF doporučuje `activity` nekopírovat, tento návrh doporučuje kopírovat (reakce na ni odkazují). Rozhodnout jednou (otázka 5).
10. **Velikost receptu nebo poznámky:** pravidlo omezí text na 20 000 znaků. Recept z AI má do 10 kB.

---

## 9. Otázky pro vedoucího (doporučení = výchozí)

1. **Cílová hodnota u cíle:** dnes je jen `progress` v %. Pro „zhubnout 10 kg“ přidat volitelný měřitelný cíl (`start`, `goal`, `current`, `unit`; modal „Měřitelný cíl: z [85] na [75] [kg]“, progress se dopočítá)? → **Ano, ale jako fáze 2b.** Fáze 2 sdílí %, termín a podcíle.
2. **Výchozí upozornění pro Návyky:** „Večer“ + milníky hned, nebo „Hned“ (příklad ze zadání)? → **Večer + milníky hned.** Každé splnění hned by v rodině se 4 lidmi a 5 návyky dělalo až 20 pushů denně.
3. **Archivace sdílené položky:** nechat ve skupině jako „archivováno“, nebo sdílení zrušit? → **Nechat s `arch:true`** a ukázat ve sbaleném řádku „Splněné a archivované“. Splněný cíl se tak dá pochválit i po archivaci.
4. **Fotka u sdílené poznámky:** sdílet? → **Ne** (velikost dokumentu, citlivost). Na požádání později.
5. **`activity` při `rotateGroupCode`:** kopírovat (kvůli reakcím na feed), nebo přeskočit (NOTIF)? → **Kopírovat.**
6. **Nahlášení nevhodného komentáře:** stačí smazání adresátem a správcem? → **Ano**, skupiny jsou uzavřené a na pozvání.
7. **Reakce mezi ostatními ve feedu:** ukazovat i „Adam pochválil Janu“? → **Ne**, jen počty u položky. Ve feedu jen reakce na mě.
8. **Vedlejší skupiny a společné moduly:** fáze 6 až po 1–3, ale rychlou opravu přepínačů v kartě vedlejší skupiny udělat hned? → **Ano.**
9. **Pořadí:** fáze 1 až po nasazení NOTIF A+B? → **Ano**, osobní moduly stojí na `activity` a cronu z NOTIF.
