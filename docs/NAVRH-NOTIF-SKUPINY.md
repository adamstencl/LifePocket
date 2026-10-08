# Návrh: upozornění na změny ve skupině + „Co je nového“

Stav ke dni 2026-10-08. Čísla řádků platí pro aktuální pracovní kopii. `app.js` teď upravuje koder kvůli i18n, takže se řádky posunou. Proto u každého místa uvádím i název funkce, podle kterého ho najdeš.

---

## 0. Jak to funguje dnes

| Co | Kde | Poznámka |
|---|---|---|
| `notifyFamily` (callable) | `functions/index.js:424` | Ručně volaný push všem členům kromě odesílatele. Tag `fam-<type>`, text ze 200 znaků od klienta. Nerespektuje žádné preference ani noční klid. |
| Volání z appky | `app.js:26` `notifyFamilyFn`, `app.js:8921` `notifyShopFamily()`, tlačítko `index.html:671` „📣 Informovat ostatní…“ | Jediný zdroj upozornění ze skupiny. Bez kliknutí se nikdo nic nedozví. |
| Cron | `functions/index.js:501` `sendScheduledNotifications` | Prochází uživatele (dávky po 20), čte `profile/main`, `notifSettings` (`morning`, `evening`, `*Digest`, `habits`). `famCache` čte dokument skupiny jednou za běh. Tagy `morning`, `evening`, `habit-<id>`, `ev-…`, `bday-…`. Okno `isTimeMatch` = 5 min (`:282`). |
| `sendPush` | `functions/index.js:289` | `data.tag` = `webpush.notification.tag`, `renotify:true`, `fcmOptions.link` = `/`. Kliknutí v `sw.js:112` jen otevře nebo zaostří appku. |
| Nastavení v appce | `app.js:3636` `NOTIF_DEFAULTS`, `:3812` `loadNotifSettings`, `:3836` `saveNotifSettings`; HTML `index.html:895–950` | Uloženo v `profile/main.notifSettings` a záloha v `lp_notif`. |
| Skupiny | hlavní `familyId` + vedlejší `extraGroupIds` (`app.js:5168+`) | Vedlejší skupiny sdílí **jen kalendář**. Nákupy, jídelníček, checklist a zásoby jsou jen v hlavní skupině. Zásoby jsou ve skupině vždy (bez přepínače). |
| Pravidla | `firestore.rules` (v pracovní kopii rozpracovaná změna jiného agenta: role admin a člen) | `families/{id}/{sub}/{doc}` = čtení i zápis pro libovolného člena, bez kontroly obsahu. |

---

## 1. Datový model

### 1a) `families/{gid}/activity/{autoId}`

```js
{
  ts:       Timestamp,   // serverTimestamp(); pravidlo vyžaduje == request.time
  uid:      string,      // autor, == request.auth.uid
  name:     string,      // přezdívka autora ≤ 40 (jen záloha, server bere jméno z members)
  g:        'f'?,        // jen u žen, kvůli tvaru „přidala“ (members pohlaví nemá)
  module:   'shop'|'cal'|'meal'|'check'|'pantry',
  action:   'add'|'edit'|'del'|'done'|'clear'|'plan'|'share',
  title:    string,      // ≤ 60: 1 až n názvů spojených „, “ (celé názvy, nic se nezkracuje uprostřed)
  n:        int,         // kolik názvů je v title
  count:    int,         // celkový počet položek (1–500); „a N další“ = count − n
  expireAt: Timestamp    // now + 7 dní, TTL politika
}
```

Formát `title` podle modulu (klient ho skládá při zápisu):
- nákup a zásoby: `banány`;
- kalendář: `Zubař · 12. 10.`;
- jídelníček: `Svíčková · út oběd`;
- checklist: `Plavky · Dovolená` (položka · název seznamu).

**TTL** (jednorázově, spouští uživatel):
`gcloud firestore fields ttls update expireAt --collection-group=activity --enable-ttl --project=lifepocket-d8f0e`

TTL maže se zpožděním až 24 h, proto klient i server filtrují `ts > now − 7 d`. Index navíc netřeba: dotaz `where ts > X orderBy ts` nad jednou kolekcí stačí automatickému indexu.

### 1b) Preference: `users/{uid}/profile/main.groupNotif`

```js
groupNotif: {
  shop:'instant', cal:'instant', meal:'evening', check:'evening', pantry:'evening', // 'instant'|'q15'|'evening'|'off'
  quiet: {from:'22:00', to:'07:00'},   // null = noční klid vypnutý
  notifyChecked: false                 // hlásit „koupeno“ a odškrtnutí v checklistu
}
```

Chybějící klíč = výchozí hodnota. Výchozí hodnoty musí být stejné na serveru i v klientu (`GROUP_NOTIF_DEFAULTS`).

### 1c) Stav odeslání: `profile/main.groupNotifSent`

```js
groupNotifSent: { [gid]: { instant: ms, q15: ms, evening: ms } }
```

**Kurzor je potřeba pro každý režim zvlášť.** Při jednom kurzoru na skupinu by okamžitý push nákupu posunul kurzor a večerní souhrn checklistu by změny z dopoledne ztratil.

- Proč v `profile/main`: cron ho čte stejně, takže nevzniká žádné čtení navíc.
- Zápis: jen server přes `update(new FieldPath('groupNotifSent', gid, mode), ms)`.
- **Riziko:** klient na dvou místech zapisuje celý profil s `merge:true` (`app.js:622`, `:3355` přes `profNoTokens`). Starý stav kurzoru by se tak mohl vrátit a notifikace by přišly dvakrát. Oprava: v `profNoTokens` (`app.js:761`) mazat i `groupNotifSent` a `groupFeedSeen`.
- Varianta, pokud vedoucí nechce sahat do profilu: samostatný dokument `users/{uid}/profile/groupNotifState`. Stojí 1 čtení navíc na uživatele a běh, když má skupina novou aktivitu.

### 1d) Přečtení feedu: `profile/main.groupFeedSeen = {[gid]: ms}`

Zapisuje klient (merge) při otevření feedu. Synchronizuje se mezi zařízeními.

### 1e) Pravidla (jen popis, nasazuje uživatel)

Obecné pravidlo pro podkolekce dnes povolí členovi cokoli, i přepsat nebo smazat cizí aktivitu. Pravidla ve Firestore se sčítají (stačí jedno `allow`), proto se `activity` musí z obecného pravidla vyjmout.

```
function isFamMember(fid) {
  return request.auth != null
    && exists(/databases/$(database)/documents/families/$(fid))
    && request.auth.uid in get(/databases/$(database)/documents/families/$(fid)).data.members;
}

match /families/{familyId}/activity/{actId} {
  allow read: if isFamMember(familyId);
  allow create: if isFamMember(familyId)
    && request.resource.data.keys().hasOnly(['ts','uid','name','g','module','action','title','n','count','expireAt'])
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.ts == request.time
    && request.resource.data.module in ['shop','cal','meal','check','pantry']
    && request.resource.data.action in ['add','edit','del','done','clear','plan','share']
    && request.resource.data.title is string && request.resource.data.title.size() <= 60
    && request.resource.data.name is string && request.resource.data.name.size() <= 40
    && request.resource.data.n is int && request.resource.data.count is int
    && request.resource.data.n >= 0 && request.resource.data.n <= request.resource.data.count
    && request.resource.data.count >= 1 && request.resource.data.count <= 500
    && request.resource.data.expireAt is timestamp
    && request.resource.data.expireAt < request.time + duration.value(8, 'd');
  allow update, delete: if false;   // maže jen TTL
}

// stávající obecné pravidlo: doplnit podmínku
match /families/{familyId}/{subcollection}/{docId} {
  allow read, write: if subcollection != 'activity' && /* … beze změny … */;
}
```

Pozor na rozpracovanou změnu `firestore.rules` jiného agenta. Doplnění udělat až po jejím commitu a nasadit jedním `firebase deploy --only firestore:rules`, se souhlasem uživatele.

---

## 2. Klient: kde zapisovat aktivitu

### 2a) Funkce (vložit k sdíleným nákupům, za `deleteFamilyShopItem`, `app.js:~6245`)

Do importu Firestore (`app.js:3`) přidat `serverTimestamp, Timestamp`.

```js
// ── AKTIVITA SKUPINY (feed + push ostatním) ──
// Rychlé změny se slučují: stejná skupina+modul+akce do 4 s od poslední, nejdéle 20 s → 1 záznam
const GA_MODS = new Set(['shop','cal','meal','check','pantry']);
const GA_ACTS = new Set(['add','edit','del','done','clear','plan','share']);
const _gaBuf = new Map();
function logGroupActivity(gid, module, action, title, count = 1) {
  if(!CU || !gid || !okFamilyCode(gid) || !GA_MODS.has(module) || !GA_ACTS.has(action)) return;
  const key = gid+'|'+module+'|'+action;
  let b = _gaBuf.get(key);
  if(!b) { b = {gid, module, action, titles:[], count:0, t0:Date.now(), timer:0}; _gaBuf.set(key, b); }
  const t = cutName(title, 60);
  if(t && !b.titles.includes(t)) b.titles.push(t);
  b.count += Math.max(1, count|0);
  clearTimeout(b.timer);
  b.timer = setTimeout(() => flushGroupActivity(key), Math.max(0, Math.min(4000, 20000 - (Date.now() - b.t0))));
}
// Zpětné vzetí (odškrtnutí → hned zrušení): vyjmout z čekajícího záznamu, ať se nehlásí omyl
function unlogGroupActivity(gid, module, action, title) {
  const b = _gaBuf.get(gid+'|'+module+'|'+action); if(!b) return;
  const i = b.titles.indexOf(cutName(title,60)); if(i < 0) return;
  b.titles.splice(i,1); b.count--;
  if(b.count <= 0) { clearTimeout(b.timer); _gaBuf.delete(gid+'|'+module+'|'+action); }
}
function flushGroupActivity(key) {
  const b = _gaBuf.get(key); if(!b || !CU) return;
  _gaBuf.delete(key); clearTimeout(b.timer);
  let title = '', n = 0;
  for(const t of b.titles) { const nx = title ? title+', '+t : t; if(nx.length > 60) break; title = nx; n++; }
  const data = {
    ts: serverTimestamp(), uid: CU.uid, name: cutName(prof?.prezdivka||prof?.nickname||'', 40),
    module: b.module, action: b.action, title, n, count: Math.min(Math.max(b.count, n, 1), 500),
    expireAt: Timestamp.fromMillis(Date.now() + 7*86400000)
  };
  if(prof?.gender === 'f') data.g = 'f';
  addDoc(collection(db,'families',b.gid,'activity'), data)
    .catch(e => console.warn('[LP] aktivita skupiny', e?.code || e?.name));
}
function flushAllGroupActivity() { for(const k of [..._gaBuf.keys()]) flushGroupActivity(k); }
addEventListener('pagehide', flushAllGroupActivity);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flushAllGroupActivity(); });
```

Dál je potřeba volat `flushAllGroupActivity()` v odhlášení před `signOut` a v `resetFamilyLocal` (`app.js:701`). Záznam píše `addDoc` bez `await`. Funguje i offline, `serverTimestamp` se doplní při odeslání.

**Výsledek:** 3 položky rychle za sebou dají 1 záznam (`title:'banány, mléko, chléb', n:3, count:3`). Pomalé přidávání dá nejvýš 1 záznam za 4 s.

### 2b) Místa volání

`fid` = `familyId`, u kalendáře konkrétní skupina. Volat **až po úspěšném zápisu** (za `await`).

| Modul | Funkce (`app.js:řádek`) | Volání |
|---|---|---|
| Nákup | `addShopItem` `:8974` (větev `isShopShared`) | `add`, `name` |
| | `addShopItemToFamily` `:6227` (z `addFavToShop` `:9012`) | `add`, `name` |
| | `addFromRecurring` `:9098`, `checkRecurringShop` `:9051` | `add`, `item.name` |
| | `toggleFamilyShopItem` `:6237` | `!done` → `done`, název; zpětné zrušení → `unlogGroupActivity(…,'done',name)` |
| | `editShopQty` `:9225` (sdílená větev) | `edit`, `${name} (${qty})` |
| | `deleteFamilyShopItem` `:6242` | `del`, název (dohledat ve `familyShopItems` před smazáním) |
| | `clearDoneItems` `:9344` | jednou: `clear`, první název, `count=done.length` |
| | `moveShopToFamily` `:8940`, `aiShopAddAll` `:10003`, `confirmRecipeToShop` `:8740`, `addRecipeToShop` `:9319`, `mealplanToShopping` `:6637` | po smyčce jednou `add` s prvním názvem a `count=added` (smyčka by jinak volala 20×; debounce by to sloučil, ale explicitní počet je přesnější) |
| | změna kategorie `:~8897` (`updateDoc … {category}`) | **nelogovat** (šum) |
| Kalendář | `saveEvent` `:2646`: nová sdílená (`selEvShareGroupId`), úprava (`inFamily && editGroupId`) | `add` / `edit` do příslušného gid, `${name} · ${d. m.}` |
| | `delEvent` `:2686` | maže naslepo ve všech skupinách. Před mazáním `getAllFamilyEvents().find(e=>e.id===id)` → `del` jen do jeho `groupId` |
| | `migrateCalEvents` `:2449` | jednou `add`, `count=ok` |
| Jídelníček | `saveMealPlanItem` `:6331` (větev `shared`) | `val` ? `edit` : `del`, `${val} · ${den} ${jídlo}` |
| | `generateMealPlanAI` `:6357` (sdílená větev) | `plan`, `'celý týden'` |
| Checklist | `addCheckItem` `:7045`, `toggleCheckItem` `:7074`, `saveExpandedCheckItem` `:7092`, `deleteCheckItem` `:7106`, `clearDoneChecklistItems` `:7168` | jen když `list._family && familyId`: `add` / `done` (zpět = unlog) / `edit` / `del` / `clear`, `${text} · ${list.name}` |
| | `toggleChecklistShare` `:6092` (zapnutí) | `share`, `list.name`; vypnutí a `deleteChecklist` `:7184` (rodinný) → `del` |
| | `moveCheckItem`, fotky, `syncChecklistToFamily` | **nelogovat** |
| Zásoby | `savePantryItem` `:9887` (při `familyId`) | `existingId` ? `edit` : `add` |
| | `changePantryQty` `:9917` | `edit`, název (tlačítka ± se díky debounce sloučí) |
| | `deletePantryItem` `:9930` | `del` |
| | `deductPantryIngredients` `:10063` | jednou `edit`, `count=matched` |
| | automatické přidání po nákupu (`:~9210` v `offerPantryUpdate`) | **nelogovat**: je to ozvěna „koupeno“ |

Návrh na později: vyčlenit `shopItemsRef()` a podobné pomocníky, ať logování nejde obejít novým místem zápisu. Ci-check může grepem hlídat, že každý `collection(db,'families',…,'shopItems')` v zápisu má v okolí `logGroupActivity`.

---

## 3. Server: rozšíření cronu

Do `processUser` v `sendScheduledNotifications` (`functions/index.js:~530`) přidat blok „Skupiny“ **za** večerní shrnutí, aby skupinový souhrn přišel hned po něm.

```js
const GROUP_NOTIF_DEFAULTS = {shop:'instant', cal:'instant', meal:'evening', check:'evening', pantry:'evening',
  quiet:{from:'22:00', to:'07:00'}, notifyChecked:false};
const INSTANT_SETTLE = 2 * 60000, INSTANT_MAX_WAIT = 10 * 60000;

// v rámci běhu: nejnovější aktivita skupiny (1 čtení / skupinu / běh)
const latestAct = (fid) => lazy(famEntry(fid), 'latest', async () => {
  const s = await db.collection(`families/${fid}/activity`).orderBy('ts','desc').limit(1).get();
  return s.empty ? 0 : s.docs[0].get('ts').toMillis();
});
```

Postup pro uživatele a každou jeho skupinu (`prof.familyId` a `prof.extraGroupIds`, jen když je opravdu v `members`):

1. `gp = {...GROUP_NOTIF_DEFAULTS, ...prof.groupNotif}`, `cur = prof.groupNotifSent?.[gid] || {}`.
   - Chybí-li kurzor režimu, nastaví se na `now` a nic se neposílá. Po nasazení tedy nepřijde příval staré historie a nový člen nedostane historii skupiny.
2. `latest = await latestAct(gid)`. Platí-li `latest <= min(kurzorů aktivních režimů)`, je konec. Takhle dopadne 99 % běhů.
3. `quiet = inQuiet(h, m, gp.quiet)` (rozsah může přecházet přes půlnoc: `from > to`).
4. Režimy, které jsou na řadě:
   - `instant`: `!quiet && latest > cur.instant && (now − latest ≥ INSTANT_SETTLE || now − cur.instant ≥ INSTANT_MAX_WAIT)`. Když někdo přidává 10 minut v kuse, přijde průběžná zpráva, ne až na konci.
   - `q15`: `!quiet && m % 15 < 5 && latest > cur.q15`. Běh v :00, :15, :30 a :45 v okně cronu.
   - `evening`: `isTimeMatch(h, m, ns.evening || '21:00') && latest > cur.evening`. **Noční klid se na večer nevztahuje.** Čas si uživatel zvolil sám a posílá se i při vypnutém `eveningDigest`.
   - Po skončení klidu je první běh (07:00) „na řadě“ sám od sebe (`latest > cur`). Přijde tedy jeden ranní souhrn na modul, ne lavina.
5. Pro každý režim na řadě: `upTo = now` a dotaz
   `activity.where('ts','>',Timestamp(cur[mode])).where('ts','<=',Timestamp(upTo)).orderBy('ts').limit(200)`.
   Výsledek se filtruje v paměti:
   - `a.uid !== uid` (autor nedostane nic);
   - `gp[a.module] === mode`;
   - `a.action !== 'done' || gp.notifyChecked`;
   - u `cal` jen `famData.shareCal`, u ostatních jen hlavní skupina.
6. Seskupení podle modulu:
   - `instant` a `q15` pošlou 1 push na modul, tag `grp-<gid>-<module>`, data `{open:'grpfeed', gid, module}`;
   - `evening` pošle **1 push na skupinu** se všemi moduly, tag `grp-<gid>-evening`.
   - Tag stejný jako dřív znamená, že nová notifikace starou nahradí (`renotify:true`). Přehled v textu je kumulativní za interval, nic se neztratí. Celou historii ukáže feed.
7. Posunout kurzor `groupNotifSent.<gid>.<mode> = upTo`, i když filtr nic nenechal nebo push selhal. Jinak by se backlog opakoval.

**Jméno autora:** `famData.members[a.uid]?.name`. Pole `a.name` z dokumentu je jen záloha pro bývalé členy. Server tak neposílá jméno, které si klient vymyslel.

### Text notifikace

```js
const GN_MOD = {shop:['🧺','Nákupy'], cal:['🗓️','Kalendář'], meal:['🥗','Jídelníček'], check:['📋','Checklist'], pantry:['🧊','Zásoby']};
// [sloveso, zbytek]; ženský tvar = sloveso + 'a'
const GN_VERB = {
  shop:  {add:['přidal','do nákupu'], edit:['upravil','v nákupu'], del:['smazal','z nákupu'], done:['koupil',''], clear:['vyčistil','koupené položky']},
  cal:   {add:['přidal','do kalendáře'], edit:['změnil','událost'], del:['zrušil','událost']},
  meal:  {edit:['naplánoval',''], del:['vymazal','z jídelníčku'], plan:['vygeneroval','nový jídelníček']},
  check: {add:['přidal','do checklistu'], edit:['upravil','v checklistu'], del:['smazal','z checklistu'], done:['odškrtl',''], clear:['vyčistil','hotové položky'], share:['začal sdílet','checklist']},
  pantry:{add:['přidal','do zásob'], edit:['upravil','zásoby'], del:['smazal','ze zásob']},
};
const dalsi = (k) => `a ${k} ${k >= 5 ? 'dalších' : 'další'}`;
```

- Pravidlo: autor → akce. Názvy ze všech jeho záznamů stejné akce se spojí, unikátní, nejvýš 3, a zbytek jde do „a N další“.
- Ukázky:
  - 1 autor, 1 akce: **„Adam přidal do nákupu: banány, mléko a 3 další“**;
  - 1 autor, víc akcí: „Jana přidala do nákupu: chléb; smazala z nákupu: máslo“;
  - víc autorů: řádky se spojí „ · “;
  - text přes 180 znaků: „Adam a Jana: 9 změn v nákupu“.
- Titulek:
  - `instant` a `q15`: `🧺 Nákupy · Rodina` (`groupName`, max 30 znaků);
  - `evening`: `👨‍👩‍👧 Dnes ve skupině Rodina`, tělo „🧺 5 změn · 🗓️ 1 nová událost · 📋 2 změny“.

### Náklady čtení

- Sonda: 1 čtení na skupinu a běh, tj. 288 za den. U 50 skupin je to 14 400 za den (limit zdarma je 50 000).
- Dotaz `ts > kurzor` stojí jen nové dokumenty × počet členů, kterým je něco „na řadě“.
- Volitelná úspora: klient zapíše `families/{gid}.lastActivityAt` a cron ho má zdarma v už načteném dokumentu skupiny. Potřebuje ale úpravu pravidla update (`isFamilyMemberUpdate` povolit i tohle pole). **Doporučuji zatím nedělat.**

### `notifyFamily`

- **Fáze 1:** ponechat kvůli starým klientům. Navíc příjemce přeskočit, když má `groupNotif.shop === 'off'` nebo je v nočním klidu. Odesílateli omezit volání na 1× za 10 min, poslední čas v paměti nebo v `rateLimits`.
- **Fáze 2 (klient):** tlačítko „📣 Informovat ostatní…“ (`index.html:671`) a `notifyShopFamily` odstranit. Na jejich místě nenápadný řádek „🔔 Ostatní dostanou upozornění automaticky · Nastavit“, odkaz do Nastavení → Notifikace.
- **Fáze 3** (za cca 2 měsíce, až staré verze vymřou): `notifyFamily` smazat.

### Ostatní dopady na server

- `rotateGroupCode` kopíruje všechny podkolekce (`listCollections`, `:929`), tedy i `activity`. Je to v pořádku, kurzory nové skupiny začnou na `now`.
- Šetrnější je ale `activity` při kopírování přeskočit.
- `deleteAccount`: aktivita smazaného uživatele zmizí přes TTL do 7 dní, stačí uvést v privacy.

---

## 4. UI

### 4a) Nastavení → Notifikace → „Ze skupin“

Kam: do `index.html` za blok „Které připomínky chceš?“ (za `#notif-toggles`, `:~945`), před 💡 nápovědu. Zobrazit jen, když je uživatel ve skupině (`familyId || extraGroupIds.length`). Moduly bez sdílení ve všech skupinách skrýt; kalendář se počítá i z vedlejších skupin.

**Před**: žádná volba. Upozornění jen ručním tlačítkem v Nákupech.
**Po**:

```
👨‍👩‍👧 Upozornění ze skupin
Kdy ti dát vědět, že někdo jiný něco změnil.

🧺 Nákupy
[  Hned  | 15 min | Večer  | Vyp.  ]
🗓️ Kalendář
[  Hned  | 15 min | Večer  | Vyp.  ]
🥗 Jídelníček …  📋 Checklist …  🧊 Zásoby …

☐ Hlásit i odškrtnuté položky („koupeno“, hotovo)

🌙 Noční klid   [● zapnuto]
  Od [22:00]   Do [07:00]
  V noci tě nebudíme, změny ti pošleme ráno najednou.

💡 „Hned“ = do pár minut, víc změn v jedné zprávě. „Večer“ = s večerním shrnutím.
   Celou historii najdeš ve skupině pod „Co je nového“.
```

HTML:

```html
<div id="gn-box" style="margin-top:16px" hidden>
  <div style="font-size:13px;color:var(--text2);font-weight:600;margin-bottom:4px">👨‍👩‍👧 Upozornění ze skupin</div>
  <div style="font-size:13px;color:var(--text3);margin-bottom:10px">Kdy ti dát vědět, že někdo jiný něco změnil.</div>
  <div id="gn-rows"></div>
  <label class="gn-check"><input type="checkbox" id="gn-checked" onchange="setGroupNotif('notifyChecked',this.checked)"> Hlásit i odškrtnuté položky („koupeno“, hotovo)</label>
  <label class="gn-check"><input type="checkbox" id="gn-quiet-on" onchange="setGroupQuiet()"> 🌙 Noční klid</label>
  <div class="setrow" id="gn-quiet-times" style="gap:12px;flex-wrap:wrap">
    <div class="fg"><label class="flbl" for="gn-quiet-from">Od</label>
      <input class="time-picker-inp" type="text" readonly inputmode="none" data-time-picker role="button" aria-haspopup="dialog" data-time-clear="0" autocomplete="off" id="gn-quiet-from" value="22:00" onchange="setGroupQuiet()"></div>
    <div class="fg"><label class="flbl" for="gn-quiet-to">Do</label>
      <input class="time-picker-inp" type="text" readonly inputmode="none" data-time-picker role="button" aria-haspopup="dialog" data-time-clear="0" autocomplete="off" id="gn-quiet-to" value="07:00" onchange="setGroupQuiet()"></div>
  </div>
  <div style="font-size:13px;color:var(--text3);margin-top:6px">V noci tě nebudíme, změny ti pošleme ráno najednou.</div>
</div>
```

Řádky (JS, vedle `loadNotifSettings`). Používá existující `.seg`, `.seg--block` a `.seg-btn` (`style.css:1141–1147`, `min-height:44px`, `--on-accent` funguje ve všech motivech):

```js
const GROUP_NOTIF_DEFAULTS = {shop:'instant',cal:'instant',meal:'evening',check:'evening',pantry:'evening',quiet:{from:'22:00',to:'07:00'},notifyChecked:false};
const GN_MODS = [['shop','🧺','Nákupy'],['cal','🗓️','Kalendář'],['meal','🥗','Jídelníček'],['check','📋','Checklist'],['pantry','🧊','Zásoby']];
const GN_OPTS = [['instant','Hned'],['q15','15 min'],['evening','Večer'],['off','Vyp.']];
function groupNotif() { return {...GROUP_NOTIF_DEFAULTS, ...(prof?.groupNotif||{})}; }
function renderGroupNotifSettings() {
  const box = document.getElementById('gn-box'); if(!box) return;
  box.hidden = !(familyId || extraGroupIds.length);
  const gp = groupNotif();
  document.getElementById('gn-rows').innerHTML = GN_MODS.map(([k,em,lbl]) =>
    `<div class="gn-row"><div class="gn-lbl">${em} ${lbl}</div>
     <div class="seg seg--block" role="radiogroup" aria-label="${lbl}: kdy upozornit">${GN_OPTS.map(([v,t]) =>
       `<button type="button" class="seg-btn${gp[k]===v?' active':''}" role="radio" aria-checked="${gp[k]===v}" data-a0="${k}" data-a1="${v}" onclick="setGroupNotif(this.dataset.a0,this.dataset.a1)">${t}</button>`).join('')}</div></div>`).join('');
  document.getElementById('gn-checked').checked = !!gp.notifyChecked;
  document.getElementById('gn-quiet-on').checked = !!gp.quiet;
  document.getElementById('gn-quiet-times').hidden = !gp.quiet;
  if(gp.quiet) { document.getElementById('gn-quiet-from').value = gp.quiet.from; document.getElementById('gn-quiet-to').value = gp.quiet.to; }
}
window.setGroupNotif = (key, val) => {
  const ok = key === 'notifyChecked' ? typeof val === 'boolean' : GN_MODS.some(m=>m[0]===key) && GN_OPTS.some(o=>o[0]===val);
  if(!ok || !CU) return;
  prof.groupNotif = {...(prof.groupNotif||{}), [key]: val};
  setDoc(doc(db,'users',CU.uid,'profile','main'), {groupNotif:{[key]:val}}, {merge:true}).catch(e=>toast('❌ '+userErr(e,'nastavení')));
  renderGroupNotifSettings();
};
window.setGroupQuiet = () => {
  const on = document.getElementById('gn-quiet-on').checked;
  const f = document.getElementById('gn-quiet-from').value, t = document.getElementById('gn-quiet-to').value;
  const q = on ? {from: TP_RE.test(f)?f:'22:00', to: TP_RE.test(t)?t:'07:00'} : null;
  prof.groupNotif = {...(prof.groupNotif||{}), quiet:q};
  setDoc(doc(db,'users',CU.uid,'profile','main'), {groupNotif:{quiet:q}}, {merge:true}).catch(()=>{});
  renderGroupNotifSettings();
};
```

Volání `renderGroupNotifSettings()` přidat do `loadNotifSettings` (`:3812`).

CSS (do `style.css` k `.seg`):

```css
.gn-row{margin-bottom:10px}
.gn-lbl{font-size:15px;color:var(--text);margin-bottom:4px}
.gn-row .seg--block{margin-bottom:0}
.gn-row .seg-btn{padding:0 6px;font-size:14px}           /* 4 segmenty se vejdou na 320 px */
.gn-check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-size:15px}
.gn-check input{width:18px;height:18px;accent-color:var(--accent)}
```

Šířka: na 320 px (−32 px okraje, −6 px padding `.seg`) vychází jeden segment na cca 70 px. Delší popisky jako „Každých 15 min“ by se nevešly, proto jsou krátké a vysvětlení je v 💡 pod volbami.

### 4b) Feed „Co je nového“

**Vstupy:**
1. **Karta skupiny** (`buildGroupCard` `app.js:6109`): pod název skupiny tlačítko přes celou šířku `🔔 Co je nového` se štítkem počtu (`3`, nejvýš `9+`).
2. **Hlavička sdíleného modulu**: ikona 🔔 44×44 vpravo v `.gh` u Nákupů (`index.html:638`, jen v režimu „Rodina“), Kalendáře (`:438`), Jídelníčku (`:809`, jen v režimu „Rodina“), Checklistu (`:837`, jen u rodinného seznamu). Otevře feed předfiltrovaný na modul. Tečka se zobrazí, když je v modulu nepřečtená změna od jiných.
3. **Kliknutí na push**: `data.open='grpfeed'` + `gid` + `module`. V `sw.js:112` otevřít `/?open=grpfeed&gid=…&m=…` nebo poslat zprávu do otevřeného okna. App při startu zavolá `openGroupFeed(gid, m)`. Je to změna `sw.js`, takže bump `CACHE`.

**Vzhled:** bottom sheet ve stylu `.tp-sheet` (zaoblený nahoře, `safe-area`) uvnitř `.moverlay`, otevírá se přes `om()`, takže funguje i tlačítko Zpět.

```
┌──────────────────────────────────────┐
│ 🔔 Co je nového          Rodina ▾  ✕ │  ← výběr skupiny jen při více skupinách (seg)
│ [Vše] [🧺] [🗓️] [🥗] [📋] [🧊]         │  ← čipy, 44 px, vodorovný posun
│ DNES                                 │
│▌🧺 Adam · před 5 min                  │  ← nepřečtené: levý pruh var(--accent)
│▌   Přidáno do nákupu: banány, mléko  │
│▌   a 3 další                         │
│  🗓️ Jana · 9:12                       │
│     Nová událost: Zubař · 12. 10.    │
│ VČERA                                │
│  📋 Ty · 20:40                        │
│     Odškrtnuto: Plavky · Dovolená    │
│ ─────────────────────────────────    │
│ Ukazujeme posledních 7 dní.          │
└──────────────────────────────────────┘
```

- Text ve feedu je **neosobní** („Přidáno do nákupu:“), takže nevadí rod a funguje i pro „Ty“.
- Jméno a modul jsou na prvním řádku, `esc()` všude.
- Řádek feedu je informativní a nic neotvírá. Klepnutí na emoji modulu otevře modul přes `showPage`.

Popisky akcí ve feedu:

| | add | edit | del | done | clear | plan / share |
|---|---|---|---|---|---|---|
| shop | Přidáno do nákupu | Upraveno v nákupu | Smazáno z nákupu | Koupeno | Vyčištěny koupené položky | |
| cal | Nová událost | Změněná událost | Zrušená událost | | | |
| meal | | Naplánováno | Vymazáno z jídelníčku | | | Nový jídelníček na týden |
| check | Přidáno do checklistu | Upraveno v checklistu | Smazáno z checklistu | Odškrtnuto | Vyčištěny hotové položky | Nový sdílený checklist |
| pantry | Přidáno do zásob | Upravené zásoby | Smazáno ze zásob | | | |

**Prázdný stav:**

> 🌿 **Zatím klid**
> Tady uvidíš, co ostatní ve skupině přidali nebo změnili. Historie se drží 7 dní.

Při filtru na modul: „V nákupu se za posledních 7 dní nic nezměnilo.“

**Načítání a přečtení:**
- Otevření feedu: `getDocs(query(activity, where('ts','>',now−7d), orderBy('ts','desc'), limit(100)))`. Jednorázově, bez onSnapshot.
- Štítek a tečky: jeden listener na skupinu `query(activity, where('ts','>',seen), orderBy('ts','desc'), limit(20))`, počítají se jen `uid !== CU.uid`. Po změně `seen` se listener přepojí. Odhlásit v `resetFamilyLocal` a `forgetExtraGroupLocal`.
- Označení přečteného: po vykreslení feedu `groupFeedSeen.<gid> = Date.now()` (merge do profilu a `prof`). Položky novější než předchozí `seen` mají v této relaci pruh. Přečte se jen otevřením, žádné tlačítko „Označit vše“ netřeba.

CSS:

```css
.gf-sheet{max-height:85dvh;overflow-y:auto}
.gf-chips{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;scrollbar-width:none}
.gf-chip{flex:none;min-width:44px;min-height:44px;padding:0 12px;border-radius:22px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-size:15px;cursor:pointer}
.gf-chip.active{background:var(--accent);color:var(--on-accent);border-color:transparent}
.gf-day{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin:12px 0 6px}
.gf-item{display:flex;gap:10px;padding:10px 12px;border-radius:12px;background:var(--card2);margin-bottom:6px;border-left:3px solid transparent}
.gf-item.unread{border-left-color:var(--accent)}
.gf-em{font-size:20px;line-height:1.2;flex:none}
.gf-who{font-size:14px;color:var(--text2)}.gf-who b{color:var(--text)}
.gf-what{font-size:15px;color:var(--text);line-height:1.35;overflow-wrap:anywhere}
.gf-bell{position:relative;min-width:44px;min-height:44px;border-radius:12px;border:1px solid var(--border);background:var(--card2);font-size:18px;cursor:pointer}
.gf-bell[data-dot]::after{content:'';position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--card2)}
.gf-count{display:inline-block;min-width:20px;padding:0 6px;border-radius:10px;background:var(--red);color:#fff;font-size:12px;font-weight:700;margin-left:6px}
```

Tlačítko v hlavičce: `<button class="gf-bell" aria-label="Co je nového ve skupině" data-a0="shop" onclick="openGroupFeed(null,this.dataset.a0)">🔔</button>`. Tečka nese jen doplňkovou informaci, nepřečtený stav je i v `aria-label` („… – 3 nové“).

**Nesoulad emoji:** karta skupiny má 🛒 a 📅, hlavičky stránek 🧺 a 🗓️. Ve feedu a notifikacích použít emoji z hlaviček stránek a v `buildGroupCard` je sjednotit.

---

## 5. Soukromí

- **Ukládáme:** u každé změny ve sdíleném modulu skupiny autora (ID a přezdívku), čas, modul, druh změny a název položky (max. 60 znaků). Vidí to jen členové skupiny. Automaticky se maže po 7 dnech, a to i po odchodu ze skupiny nebo smazání účtu.
- V profilu je navíc nastavení upozornění ze skupin, čas posledního odeslaného upozornění a čas posledního otevření „Co je nového“.
- Do textu notifikace jde jméno autora a názvy položek. Přes FCM putuje stejně jako dnešní notifikace a server ho neloguje (viz `sendPush` `:308`).

Věta do `privacy.html` §5, nová odrážka v „Co vidí ostatní členové skupiny“ (nahradí odrážku o ručním upozornění):
> **historii změn ve skupině**: kdo co přidal, upravil, odškrtl nebo smazal ve sdílených modulech (tvé jméno, druh změny a název položky, nejvýše 60 znaků). Historie se automaticky maže po 7 dnech, i když skupinu opustíš nebo smažeš účet.

Do §6 Push notifikace:
> Podle tvého nastavení ti posíláme upozornění na změny, které ve skupině udělali ostatní. Kvůli tomu si v profilu pamatujeme, kdy jsme ti poslali poslední upozornění.

Stejné věty dát do `privacy-en.html` (i18n). V přehledu profilu (§3, `:57`) doplnit „nastavení upozornění ze skupin“.

---

## 6. Fáze implementace

| Fáze | Co | Závislosti | Riziko |
|---|---|---|---|
| **A: server** (koder, `functions/index.js`) | blok skupin v cronu, `notifyFamily` respektuje `off` a klid + rate limit | žádné. Aktivita zatím neexistuje, sonda vrací 0 | nízké; push jen od nových klientů |
| **B: klient** (koder, po dokončení i18n v `app.js`) | `logGroupActivity` + místa volání, Nastavení → Ze skupin, feed, `profNoTokens`, odstranění tlačítka 📣, `sw.js` deep link | A nasazeno. Funguje i se **starými pravidly**: obecné pravidlo zápis členům povolí | střední: hodně míst zápisu. Tester grepem ověří každý zápis do `families/…` |
| **C: pravidla + TTL** (uživatel) | `activity` zpřísnit, obecné pravidlo vyjmout, TTL `expireAt` | B nasazeno a ověřeno; sloučit s rozpracovanou změnou rolí | nasazení pravidel = otázka na uživatele |
| **D: úklid** (za cca 2 měsíce) | smazat `notifyFamily` a `notifyFamilyFn` | | |

- Zpětná kompatibilita: starý klient aktivitu nezapisuje, takže jeho změny nikoho neupozorní (stejně jako dnes bez kliknutí). Ruční tlačítko u něj dál funguje přes `notifyFamily`.
- Nový klient bez `groupNotif` dostane výchozí hodnoty.
- Viditelná změna znamená `APP_VERSION`, `CHANGELOG` a `CACHE` v `sw.js`. Text do changelogu: „🔔 Ostatní ve skupině ti teď dají vědět o změnách samy. Jak často, si nastavíš v Nastavení → Notifikace. Novinka: přehled Co je nového ve skupině.“

---

## 7. Rizika

1. **Výchozí „Hned“** u nákupů a kalendáře zapne nové notifikace všem bez dotazu. Velká rodina přidávající nákup ráno = několik pushů za hodinu. Zmírňuje to seskupení, nahrazování tagem a noční klid.
2. **Přepsání kurzoru klientem** (viz 1c). Bez úpravy `profNoTokens` hrozí dvojité notifikace.
3. **Opomenuté místo zápisu**: tichá díra (změna se nenahlásí). Pomůže checklist v 2b a grep v ci-check.
4. **Hodiny klienta**: `expireAt` je z hodin klienta, pravidlo ho shora omezí na 8 dní. Řazení podle `ts` je ze serveru.
5. **Offline zápisy** se odešlou později s pozdějším `ts`. Notifikace pak může přijít se zpožděním, nic se ale neztratí.
6. **Zpoždění „Hned“**: cron běží po 5 min a k tomu 2 min na ustálení, reálně tedy 2–7 min. V UI proto stojí „Hned“ s vysvětlením „do pár minut“.
7. **Limit 200** na dotaz: při hromadném přesunu (`moveShopToFamily`) jde o 1 záznam s `count`, takže v praxi nehrozí.

## 8. Otázky pro vedoucího (doporučení je výchozí)

1. **Kurzory v `profile/main`** (+ úprava `profNoTokens`), nebo samostatný dokument? → **profile/main** (0 čtení navíc).
2. **Noční klid a večerní souhrn**: platí klid i pro „Večer“? → **Ne.** Večer přijde v čase, který si uživatel zvolil.
3. **Skupinový souhrn při vypnutém `eveningDigest`**: posílat? → **Ano.** Jsou to dvě různé volby.
4. **Preference** pro každý modul globálně, nebo pro každou skupinu? → **Globálně** (zadání). Pro každou skupinu až podle zpětné vazby.
5. **Tlačítko 📣 „Informovat ostatní“** zrušit hned ve fázi B? → **Ano**, nahradit řádkem s odkazem do nastavení.
6. **`families/{gid}.lastActivityAt`** jako úspora sondy? → **Zatím ne**, sonda stojí cca 288 čtení za den na skupinu.
7. **Jednorázová info karta** po aktualizaci („Nově ti skupina dá vědět sama · Nastavit“)? → **Ano**, kvůli riziku 1. Stačí changelog plus jednorázový toast při prvním pushi? Doporučuji kartu na Domů, zavíratelnou.
