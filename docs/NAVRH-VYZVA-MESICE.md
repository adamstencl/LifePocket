# Návrh: 🏆 Výzva měsíce / týdne (veřejná výzva pro všechny uživatele)

Mobil 390×844, všechna tři témata (`sunshine` světlé výchozí, `tangerine`, `dark-gold`). Výchozí stav: verze 4.62, větev `claude/awesome-hypatia-72pnwx`. Čísla řádků jsou orientační, koder ať místa hledá grepem podle názvu funkce nebo ID.

Schválená rozhodnutí (Adam): (1) měsíc + volitelně týden, jeden systém; (2) denní odškrtnutí „splnil/a jsem dnes“; (3) žebříček top 20 + vlastní pozice, shoda → dřív přihlášený výš; (4) filtr „jen moje skupina“; (5) výzvy zakládá jen Adam v appce; (6) v žebříčku jen přezdívka zvolená při přihlášení, filtr sprostých slov, admin může odebrat; (7) odznak za dokončení.

---

## 0. Co jsem v kódu zjistil (důležité pro rozhodnutí)

| Zjištění | Místo | Důsledek |
|---|---|---|
| Skupinové výzvy (`families/{gid}/challenges/{cid}`) drží příspěvky v mapě `p` v jednom dokumentu, dny jako seznam `d` (max 28), `n == d.size()`, `j` = den přidání | firestore.rules (blok „Společné výzvy skupiny“), app.js `chNorm`, `chPartDays` ~10230 | Pro veřejnou výzvu **nejde** použít jeden dokument (tisíce lidí, limit 1 MiB, kolize zápisů). Převezmeme ale stejný tvar dat (`d`, `n`, `j`) a stejnou logiku „Dnes / Včera“ (`ch-days`, `ch-day`). |
| Skupinová výzva nehlídá, *který* den se zapisuje (jen `n <= prevN + 1000`, obsah `d` filtruje klient) | rules `validChallengePart` | U veřejného žebříčku to nestačí: podvod by viděli všichni. Nová pravidla hlídají **přesně +1 den a jen dnes/včera podle `request.time`** (§2.3). |
| `config/**` je zavřené, admin účet appky dnes neexistuje (role `admin` je jen správce skupiny) | rules, app.js `isAdmin` ~9257 | Admin appky = **custom claim `admin`** v tokenu (§3). |
| `families/{id}` get ano, list ne; kód skupiny = ID dokumentu = tajemství pro vstup | rules | ID skupiny **nikdy** neukládat do veřejného dokumentu účastníka (ani hash: kód má jen ~1,4·10¹⁰ kombinací, hash jde dohledat). Filtr skupiny proto jde přes uid členů, které klient zná (§1.4). |
| Fronta oken `whenUiFree(fn)`, oslava přes `m-gwin` + `spawnConfetti()` | app.js ~614, `celebrateChallenge` ~10678 | Oslavu dokončení výzvy pustit přes `whenUiFree`, okno `m-gwin` znovu použít. |
| Gamifikace: `game.once[key] = {d, x}`, `gameAward(key, x)`, odznaky `BADGES` vyhodnocené z kontextu `badgeCtx()` | app.js ~6287, ~6580 | Odměna `once.pc_<cid>` + nové odznaky počítané z klíčů `pc_` (§5.6). Bez změny pravidel (game je pod `users/{uid}`). |
| Cron `sendScheduledNotifications` čte každých 5 min `profile/main` každého uživatele | functions/index.js ~811 | Večerní připomínka a ohlášení nové výzvy **bez čtení navíc na uživatele**: stav účasti do profilu (`prof.pc`), seznam výzev 1× za běh (§6). |
| `deleteAccount` maže `users/{uid}` rekurzivně a skupinová data; veřejné kolekce nezná | functions/index.js ~1316 | Přidat krok: smazat `publicChallenges/*/participants/{uid}` a `blocked/{uid}` (§7). |
| Export `exportMyData` bere jen podkolekce `users/{uid}` (`EXPORT_COLS`) | app.js ~3582 | Přidat sekci `publicChallenges` (§7). |
| Na Domů je pořadí: Začínáme → fokus → voda → … → týdenní souhrn → `#ch-dash` (skupinové výzvy) | app.js `rDash` ~13190–13207 | Nová karta `#pc-dash` **těsně nad `#ch-dash`** (§4.1). |
| `firestore.indexes.json` neexistuje, `firebase.json` nemá klíč `indexes` | kořen repa | Vytvořit soubor + klíč, nasazení indexů dělá Adam (§9). |
| Workflow `deploy-rules.yml` nasazuje jen `firestore:rules` | .github/workflows | Indexy nasadit ručně, nebo workflow rozšířit na `firestore:rules,firestore:indexes` (doporučuji rozšířit, potvrzení „ANO“ zůstává). |

---

## 1. Datový model

### 1.1 Výzva `publicChallenges/{cid}`

`cid` = čitelné ID, které appka vygeneruje: `m-2026-11` (měsíc), `w-2026-W46` (týden). Díky tomu nejde omylem založit dvě výzvy na stejné období a cron/odkazy jsou přehledné.

| Pole | Typ | Popis |
|---|---|---|
| `title` | string 1–60 | „30 dní bez sladkého“ |
| `desc` | string ≤ 300 | krátké pravidlo, co se počítá |
| `emoji` | string ≤ 16 | „🍬“ |
| `en` | map `{title, desc}` volitelně | anglická verze (UI v en ji použije, jinak čeština) |
| `kind` | `'month'` \| `'week'` | |
| `start`, `end` | `'YYYY-MM-DD'` | včetně; měsíc 1.–poslední den, týden Po–Ne |
| `days` | int 1–31 | počet dní výzvy (týden = 7) |
| `goal` | int 1–`days` | kolik dní je potřeba na odznak (výchozí = `days`, admin smí snížit, např. 25 z 30) |
| `active` | bool | `false` = koncept nebo skrytá; čtou ji jen admini |
| `createdBy`, `createdAt`, `updatedAt` | uid, timestamp | |

### 1.2 Účastník `publicChallenges/{cid}/participants/{uid}`

ID dokumentu = uid (levná vlastní pozice, jednoduché mazání, admin). **Jiná pole se tu neukládají** (žádné jméno účtu, e-mail, skupiny, avatar).

| Pole | Typ | Popis |
|---|---|---|
| `nick` | string 3–20 | přezdívka pro tuto výzvu (§2.4) |
| `joinedAt` | timestamp = `request.time` | rozhoduje shodu v žebříčku (dřív přihlášený výš) |
| `j` | `'YYYY-MM-DD'` | den přihlášení (informace pro UI, „od 5. 11.“) |
| `d` | list dat, max 31, bez duplicit | odškrtnuté dny |
| `n` | int `== d.size()` | podle něj se řadí |
| `upAt` | timestamp = `request.time` | poslední změna |

Proč seznam `d` a ne jen počet: umožní opravu překliku (odškrtnout zpět), „Včera“ po „Dnes“ v libovolném pořadí a mřížku dní v detailu. Pravidla přesto pustí jen +1/−1 den v okně dnes/včera, takže veřejné datum odškrtnutí je to jediné, co o člověku navíc víme. To uvedeme v privacy.html.

### 1.3 Moderace `publicChallenges/{cid}/blocked/{uid}`

Prázdný dokument `{at: timestamp}`. Admin při odebrání smaže účastníka a založí blokaci, takže se odebraný nemůže hned přihlásit znovu. Čte a píše jen admin. Pravidla účastníka ji kontrolují přes `exists()` jen při přihlášení (1 čtení navíc jednou za výzvu).

### 1.4 Profil `users/{uid}/profile/main` → nové pole `pc`

```js
pc: { 'm-2026-11': { r: true, last: '2026-11-14' }, 'w-2026-W46': { r: false, last: '' } }
```
- `r` = večerní připomínka zapnutá, `last` = poslední odškrtnutý den (max ze seznamu `d`).
- Slouží **jen** cronu (připomínka bez čtení navíc) a exportu. Klient ho přepíše při přihlášení, odškrtnutí, odhlášení. Při startu appky smaže klíče výzev, které skončily před víc než 30 dny.
- Pole `pc` přidat do výjimek v `profNoTokens()` stejně jako `waterDay` (aby ho nepřepsala stará kopie profilu).

### 1.5 Žebříček: levně a bezpečně

**Doporučení pro MVP: přímý dotaz z klienta, bez serverového souhrnu.**

| Co | Dotaz | Cena (čtení) |
|---|---|---|
| Top 20 | `participants` `orderBy('n','desc')`, `orderBy('joinedAt','asc')`, `limit(20)` | 20 (méně, když je účastníků méně) |
| Moje pozice | `count(n > myN)` + `count(n == myN && joinedAt < myJoinedAt)` + 1 přes `getCountFromServer` | 2 agregace = 1 čtení za každých započatých 1 000 záznamů indexu |
| Počet účastníků | `getCountFromServer(participants)` | 1 za 1 000 |
| Můj záznam | `getDoc(participants/{uid})` (nebo `onSnapshot` jen na vlastní dokument) | 1 |
| Moje skupina | `where(documentId(), 'in', uidsČlenů)`, `limit(30)`, po 30 uid | = počet přihlášených členů (max ~40) |

- Žebříček se načítá **`getDocs`, ne `onSnapshot`** (živý posluchač by při každém odškrtnutí kohokoli v top 20 účtoval další čtení všem, kdo ho mají otevřený). Načte se při otevření detailu, při návratu do appky po > 5 min a tlačítkem „↻ Obnovit“. Cache v paměti 2 min.
- Na kartě na Domů žebříček **není** (jen můj počet dní), takže běžné spuštění appky stojí jen ~3 čtení (seznam výzev + můj záznam).
- Odhad: 5 000 aktivních uživatelů, 3 spuštění/den, 20 % otevře detail → ~45 000 + ~25 000 = ~70 000 čtení/den, tj. ~20 000 nad denní volný limit 50 000 ≈ jednotky korun měsíčně. Zápisy: 1–2 za účastníka a den.
- **Fáze 3 (až při >20 000 účastnících na výzvu):** cron každých 10 min zapíše `publicChallenges/{cid}/meta/board` `{top: [{nick, n}], total, at}` a klient čte 1 dokument místo 20. Pozice zůstane přes `count`. Tvar dat to umožní bez migrace.

**Filtr „Jen moje skupina“ bez prozrazení cizích uživatelů:** klient zná uid členů svých skupin (`groupDataOf(gid).members`, max 5 skupin × 8). Načte jen jejich dokumenty účastníka (`documentId() in [...]`). Nic se nikam neukládá, ID skupin se nikde neobjeví a cizí lidé ve výsledku být nemohou. V tomto filtru zobrazit **jméno člena ze skupiny + avatar** (to už si členové navzájem vidí) a přezdívku drobně pod ním. Při přihlášení to bude napsané otevřeně („Lidé z tvých skupin tě v žebříčku skupiny poznají.“), protože kdo zná uid, technicky přečte i dokument účastníka. Přepínač filtru se ukáže jen tomu, kdo má skupinu s dalším členem.

---

## 2. Pravidla Firestore (kompletní blok)

Vložit na konec `match /databases/{database}/documents { … }`. Nic stávajícího se nemění.

```
    // ── Veřejné výzvy (Výzva měsíce / týdne, 4.63) ──
    // Zakládá a moderuje jen admin appky (custom claim admin == true, nastaví scripts/set-admin.js).
    // Účastník: dokument = uid, jen přezdívka + odškrtnuté dny. Den jde přidat/odebrat jen po jednom
    // a jen „dnes nebo včera“ v nějakém časovém pásmu (UTC−12 až UTC+14) podle request.time.
    function isAppAdmin() {
      return request.auth != null && request.auth.token.get('admin', false) == true;
    }
    function pcDs(ds) {
      return ds is string && ds.matches('^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
    }
    // Den ds platí jako „dnes nebo včera“: od začátku dne v UTC+14 (t0 − 14 h)
    // do konce následujícího dne v UTC−12 (t0 + 60 h)
    function pcNowish(ds) {
      let p = ds.split('-');
      let t0 = timestamp.date(int(p[0]), int(p[1]), int(p[2]));
      return request.time > t0 - duration.value(14, 'h')
        && request.time < t0 + duration.value(60, 'h');
    }
    // Přezdívka: 3–20 znaků, písmena (včetně češtiny a slovenštiny), číslice, mezera, _ a -; začíná písmenem nebo číslicí.
    // Bez tečky a @ (žádné e-maily ani odkazy). Pojistka na nejhrubší slova; hlavní filtr je v klientu (pcNickBad).
    function pcNickOk(n) {
      return n is string && n.size() >= 3 && n.size() <= 20
        && n.matches('^[0-9A-Za-zÁČĎÉĚÍĹĽŇÓÔŔŘŠŤÚŮÝŽÄÖÜáčďéěíĺľňóôŕřšťúůýžäöü][0-9A-Za-zÁČĎÉĚÍĹĽŇÓÔŔŘŠŤÚŮÝŽÄÖÜáčďéěíĺľňóôŕřšťúůýžäöü _-]*$')
        && !n.lower().matches('.*(admin|lifepocket|moderat|kurv|kurev|píč|pič|pic[aeiou]|kokot|čurák|curak|zmrd|šuk|suk[aá]|prdel|hovn|debil|fuck|shit|bitch|cunt|nigg|hitler|nazi).*');
    }
    function validPubCh() {
      let d = request.resource.data;
      return d.keys().hasOnly(['title', 'desc', 'emoji', 'en', 'kind', 'start', 'end', 'days', 'goal', 'active',
             'createdBy', 'createdAt', 'updatedAt'])
        && d.keys().hasAll(['title', 'kind', 'start', 'end', 'days', 'goal', 'active', 'createdBy', 'createdAt', 'updatedAt'])
        && d.title is string && d.title.size() >= 1 && d.title.size() <= 60
        && (!('desc' in d) || (d.desc is string && d.desc.size() <= 300))
        && (!('emoji' in d) || (d.emoji is string && d.emoji.size() <= 16))
        && (!('en' in d) || (d.en is map && d.en.keys().hasOnly(['title', 'desc'])
             && d.en.get('title', '') is string && d.en.get('title', '').size() <= 60
             && d.en.get('desc', '') is string && d.en.get('desc', '').size() <= 300))
        && d.kind in ['month', 'week']
        && pcDs(d.start) && pcDs(d.end) && d.start <= d.end
        && d.days is int && d.days >= 1 && d.days <= 31 && (d.kind != 'week' || d.days == 7)
        && d.goal is int && d.goal >= 1 && d.goal <= d.days
        && d.active is bool
        && d.updatedAt == request.time;
    }
    match /publicChallenges/{cid} {
      // Koncept (active false) vidí jen admin; dotaz klienta proto musí mít where('active','==',true)
      allow get: if request.auth != null && (resource.data.active == true || isAppAdmin());
      allow list: if request.auth != null
        && (isAppAdmin() || (resource.data.active == true && request.query.limit <= 10));
      allow create: if isAppAdmin() && validPubCh()
        && cid.matches('^(m-20[0-9]{2}-(0[1-9]|1[0-2])|w-20[0-9]{2}-W[0-5][0-9])$')
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.createdAt == request.time;
      allow update: if isAppAdmin() && validPubCh()
        && request.resource.data.createdBy == resource.data.createdBy
        && request.resource.data.createdAt == resource.data.createdAt;
      // Mazat jen koncepty (dokument s účastníky by po smazání nechal podkolekci bez výzvy)
      allow delete: if isAppAdmin() && resource.data.active == false;

      function pc() { return get(/databases/$(database)/documents/publicChallenges/$(cid)).data; }
      // Den patří do výzvy a je „dnes nebo včera“
      function pcDayOk(x) { return pcDs(x) && x >= pc().start && x <= pc().end && pcNowish(x); }
      function pcPartBase() {
        let d = request.resource.data;
        return d.keys().hasOnly(['nick', 'joinedAt', 'j', 'd', 'n', 'upAt'])
          && d.keys().hasAll(['nick', 'joinedAt', 'j', 'd', 'n', 'upAt'])
          && pcNickOk(d.nick)
          && d.d is list && d.d.size() <= 31 && d.d.toSet().size() == d.d.size()
          && d.n is int && d.n == d.d.size()
          && d.upAt == request.time;
      }

      match /participants/{uid} {
        allow get: if request.auth != null;
        // Top 20, skupina (in po 30 uid), počty přes count(); admin stránkuje bez omezení
        allow list: if request.auth != null && (isAppAdmin() || request.query.limit <= 30);
        // Přihlášení: jen sám za sebe, do aktivní výzvy, ne zablokovaný, j = dnes, nejvýš 1 den (dnes nebo včera)
        allow create: if request.auth != null && request.auth.uid == uid
          && pc().active == true
          && !exists(/databases/$(database)/documents/publicChallenges/$(cid)/blocked/$(uid))
          && pcPartBase()
          && request.resource.data.joinedAt == request.time
          && pcDayOk(request.resource.data.j)
          && request.resource.data.d.size() <= 1
          && (request.resource.data.d.size() == 0 || pcDayOk(request.resource.data.d[0]));
        // Změna: přezdívka, nebo přesně +1 den, nebo přesně −1 den (oprava překliku); vždy jen dnes/včera
        allow update: if request.auth != null && request.auth.uid == uid
          && pc().active == true
          && pcPartBase()
          && request.resource.data.joinedAt == resource.data.joinedAt
          && request.resource.data.j == resource.data.j
          && (request.resource.data.d == resource.data.d
            || (request.resource.data.d.size() == resource.data.d.size() + 1
                && request.resource.data.d.hasAll(resource.data.d)
                && pcDayOk(request.resource.data.d.removeAll(resource.data.d)[0]))
            || (request.resource.data.d.size() == resource.data.d.size() - 1
                && resource.data.d.hasAll(request.resource.data.d)
                && pcNowish(resource.data.d.removeAll(request.resource.data.d)[0])));
        // Odhlášení z výzvy (smaže i dny) nebo odebrání adminem
        allow delete: if request.auth != null && (request.auth.uid == uid || isAppAdmin());
      }
      match /blocked/{uid} {
        allow read, write: if isAppAdmin();
      }
    }
```

Poznámky ke koderovi a revizorovi:
- **Proti podvádění:** 30 dní najednou nejde (+1 den na zápis, jen den v okně „dnes/včera“). Kdo by posílal zápisy ručně, získá v Praze nejvýš: dnešek, včerejšek a od poledne i zítřek (okno je široké kvůli časovým pásmům). Za celou výzvu tedy nejvýš o 1 den víc než poctivý uživatel. Mazat a znovu přidávat staré dny nejde (staré datum neprojde `pcNowish`). Lež „splnil jsem“ pravidla neodhalí, to řeší jen admin odebráním.
- `pc()` je stejný `get()` několikrát v jednom vyhodnocení, účtuje se jako 1 čtení.
- `pcNickOk` se kontroluje při každé změně. Když admin později rozšíří seznam slov, účastník s nevhodnou přezdívkou nemůže odškrtnout, dokud ji nezmění. Klient na chybu `permission-denied` při odškrtnutí nejdřív zkontroluje přezdívku a nabídne změnu.
- `int('08')` = 8 a `timestamp.date(y, m, d)` = půlnoc UTC. Koder ať ověří v Rules Playground v konzoli (Adam, 2 min), než se pravidla nasadí: přidání dneška ✓, přidání dne před 3 dny ✗, +2 dny naráz ✗, cizí uid ✗, přezdívka „a.b@c“ ✗.
- Regex s diakritikou: Rules používají RE2 nad UTF-8, výčet znaků je bezpečnější než `\p{L}` (nemusí se escapovat).

### 2.1 Indexy `firestore.indexes.json` (nový soubor) + `firebase.json`

```json
{
  "indexes": [
    { "collectionGroup": "participants", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "n", "order": "DESCENDING" }, { "fieldPath": "joinedAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "participants", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "n", "order": "ASCENDING" }, { "fieldPath": "joinedAt", "order": "ASCENDING" } ] },
    { "collectionGroup": "publicChallenges", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "active", "order": "ASCENDING" }, { "fieldPath": "end", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": []
}
```
Do `firebase.json` → `"firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }`. Druhý index (n ASC) je pro počet „stejně dní, ale přihlášen dřív“. Pokud ho Firestore obslouží prvním indexem, nevadí, je levný.

### 2.2 Klientský filtr přezdívky `pcNickBad(nick)` (app.js)

1. `trim`, víc mezer → jedna; délka 3–20; povolené znaky jako v pravidlech (jinak hláška „Jen písmena, číslice, mezera, _ a -“).
2. Normalizace pro kontrolu: malá písmena, bez diakritiky (`normalize('NFD').replace(/\p{M}/gu,'')`), leetspeak `0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s`, bez mezer/_/-, opakovaná písmena sloučit (`kuuurva` → `kurva`).
3. Shoda na kořeny ze seznamu `PC_BAD` (cs + sk + en, ~60 kořenů: kurv, pič/pic, kokot, čurák, zmrd, šuk, prdel, hovn, debil, mrd, jebat/jeb, chuj, fuck, shit, bitch, cunt, nigg, hitler, nazi …) **a** rezervovaná slova (`admin`, `lifepocket`, `moderator`, `rex`, `podpora`, `support`). Pozor na falešné shody: `pic` testovat jen jako `pic[aeiouy]`, ne v „picnic“; seznam výjimek `PC_OK` (např. „Kokotice“ není potřeba, přezdívky jsou krátké, stačí pár výjimek).
4. Chyba přezdívky v UI: „Tahle přezdívka nejde použít. Zkus jinou 🙂“ (nevysvětlovat, které slovo).
Seznam v pravidlech je jen pojistka pro obejití klienta; admin odebrání řeší zbytek.

---

## 3. Kdo je admin

**Doporučení: custom claim `admin: true`** (ne pevné uid v pravidlech).

| | Custom claim | Pevné uid v pravidlech |
|---|---|---|
| Nastavení | jednorázově skriptem `node scripts/set-admin.js --email=adam.stencl@gmail.com` (Admin SDK, klíč jako u `stats-report.js`) | Adam pošle uid, koder ho vloží do pravidel |
| Změna adminů | skriptem, bez nasazení pravidel | nové nasazení pravidel (vždy se ptáme) |
| Klient pozná admina | `CU.getIdTokenResult()` → `claims.admin` | musel by mít uid natvrdo i v app.js (veřejný kód) |
| Riziko | žádné nové (claim nastaví jen držitel klíče servisního účtu) | žádné velké, ale uid je ve veřejném repu |

Skript `scripts/set-admin.js` (napíše koder podle `stats-report.js`): `--email=` nebo `--uid=`, `--remove` pro odebrání, vypíše výsledek a upozorní: „Odhlas se a přihlas znovu (nebo počkej hodinu), token se obnoví.“ Klient si po přihlášení jednou zavolá `getIdTokenResult()` a výsledek drží v `_isAppAdmin`. Žádná Cloud Function na nastavení adminů (zbytečná plocha pro útok).

---

## 4. UI

Nové prvky používají stávající tokeny (`--card2`, `--border2`, `--accent`, `--green`, `--text2`), komponenty `.dw`, `.ch-card`, `.ch-day`, `.seg`, `.btn-p`, `.btn-s`, `.ch-link` a sheet `.moverlay`. Všechna dotyková místa ≥ 44×44 px, hlavní akce 52 px.

### 4.1 Karta na Domů `#pc-dash` (nad `#ch-dash`)

**Před:** na Domů není nic, co by spojovalo všechny uživatele. **Po:** jedna karta, nejvýš dvě výzvy (měsíc nahoře, týden kompaktně pod ním). Když žádná výzva neběží ani nezačíná do 3 dní, karta **vůbec není** (prázdný stav na Domů nemá smysl).

```
Stav A – nepřihlášen/a                    Stav B – přihlášen/a, dnes ještě ne
┌────────────────────────────────────┐    ┌────────────────────────────────────┐
│ 🏆 Výzva měsíce · listopad      ✕  │    │ 🏆 Výzva měsíce · listopad         │
│ ┌────────────────────────────────┐ │    │ ┌────────────────────────────────┐ │
│ │ 🍬 30 dní bez sladkého         │ │    │ │ 🍬 30 dní bez sladkého         │ │
│ │ Žádné sladkosti ani slazené    │ │    │ │ ▓▓▓▓▓▓▓▓░░░░░░░░░░  12 / 30 dní│ │
│ │ pití. Ovoce je v pohodě.       │ │    │ │ Zbývá 16 dní · 🔥 5 v řadě     │ │
│ │ Do 30. 11. · přidalo se 1 284  │ │    │ │ ┌────────────────────────────┐ │ │
│ │ ┌────────────────────────────┐ │ │    │ │ │   ⬜  Splněno dnes          │ │ │ 52 px
│ │ │       Jdu do toho 💪        │ │ │    │ │ └────────────────────────────┘ │ │
│ │ └────────────────────────────┘ │ │    │ │  Žebříček a moje pozice →      │ │ 44 px
│ │  Ukázat žebříček →             │ │    │ └────────────────────────────────┘ │
│ └────────────────────────────────┘ │    │ 📅 Výzva týdne: 10 000 kroků       │ kompaktní řádek
└────────────────────────────────────┘    │    3 / 7 dní           [ ⬜ Dnes ] │ 44 px
                                          └────────────────────────────────────┘
Stav C – dnes splněno                     Stav D – výzva skončila (7 dní po konci)
│ │ ┌────────────────────────────┐ │ │    │ 🏆 Výzva měsíce skončila           │
│ │ │   ✅  Dnes splněno          │ │ │    │ 🍬 30 dní bez sladkého             │
│ │ └────────────────────────────┘ │ │    │ Zvládl/a jsi 27 z 30 dní 🎖️       │
│ │  Zítra zase! · 37. místo →     │ │    │ Skončil/a jsi 41. z 1 284.         │
                                          │  Zobrazit výsledky →                │
Stav E – výzva začne do 3 dní             └────────────────────────────────────┘
│ 🏆 Od 1. 12. nová výzva: 🚶 …       │
│ [ Přihlásit se předem ]              │
```

Chování:
- **Jdu do toho** otevře sheet přihlášení (§4.2), ne rovnou zápis (je potřeba přezdívka).
- **Splněno dnes** = přepínač `aria-pressed` jako stávající `.ch-day`. Druhé klepnutí den vrátí (oprava překliku), toast „Vráceno“. Zápis optimisticky, při chybě vrátit stav a toast „Nepodařilo se uložit, zkus to znovu“.
- V den po konci výzvy (do poledne) se místo „Splněno dnes“ ukáže „⬜ Splněno včera (poslední den)“, stejná logika jako `chLate`.
- ✕ ve stavu A skryje kartu jen pro tuto výzvu (`lp_pc_hide_<cid>` v localStorage, zařazeno v `LOCAL_PERSONAL_KEYS`). Jakmile se objeví nová výzva, karta je zpět.
- „37. místo“ se ukáže, jen když je pozice v paměti z posledního otevření detailu (na Domů se kvůli ceně nepočítá).
- Série „🔥 5 v řadě“ = počet po sobě jdoucích dní v `d` končících dneškem nebo včerejškem. Když je 0, nepsat nic.

### 4.2 Sheet přihlášení `#m-pc` (režim „join“)

```
┌────────────────────────────────────┐
│ 🏆 Výzva měsíce                 ✕  │
│ 🍬 30 dní bez sladkého              │
│ 1.–30. 11. · na odznak 30 dní       │
│ Žádné sladkosti ani slazené pití.   │
│                                    │
│ Jak to funguje                      │
│ Každý den, kdy to dáš, si odškrtni  │
│ „Splněno dnes“. Zapomněl/a jsi?     │
│ Včerejšek jde dopsat ještě dnes.    │
│                                    │
│ Tvoje přezdívka v žebříčku          │
│ ┌──────────────────────────┐┌────┐ │
│ │ Vytrvalá vydra 42        ││ 🎲 │ │  48 px, 🎲 44×44 = nový návrh
│ └──────────────────────────┘└────┘ │
│ Uvidí ji ostatní. Nepiš sem své     │
│ jméno ani e-mail.          19 / 20  │
│                                    │
│ [✓] Večer mi připomeň, když dnešek  │  44 px řádek, výchozí zapnuto
│     ještě nemám (ve 20:00)          │
│                                    │
│ Lidé z tvých skupin tě v žebříčku   │  jen když má skupinu
│ skupiny poznají.                    │
│ ┌────────────────────────────────┐ │
│ │       Přihlásit se 💪           │ │  .btn-p
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```
- Přezdívka je předvyplněná náhodně (přídavné jméno + zvíře + číslo, ženský rod kvůli shodě: vytrvalá, statečná, veselá, klidná, odvážná, zvídavá, šikovná, rychlá × vydra, veverka, sova, liška, žirafa, panda, lama, želva, včela, kočka; en: Brave Otter 42). Tím vede lidi, aby nepsali svá jména.
- Při další výzvě se předvyplní poslední použitá přezdívka (`lp_pc_nick`).
- Chyba přezdívky se ukáže pod polem (`aria-describedby`), tlačítko zůstane aktivní, fokus do pole.
- Když je dnes první den výzvy nebo později, zápis rovnou nabídne i „Splněno dnes“? **Ne**, jeden krok = jedna věc. Po přihlášení se sheet přepne do detailu (§4.3), kde je velké tlačítko.

### 4.3 Detail výzvy (stejný sheet `#m-pc`, režim „detail“, na výšku celé obrazovky)

```
┌────────────────────────────────────┐
│ 🏆 Výzva měsíce                 ⋯ ✕│  ⋯ = Změnit přezdívku / Odhlásit se z výzvy
│ 🍬 30 dní bez sladkého              │
│ 1.–30. 11. · zbývá 16 dní           │
│ ┌──────────────┐┌──────────────┐   │
│ │ ✅ Dnes      ││ ⬜ Včera      │   │  .ch-days / .ch-day 52 px
│ └──────────────┘└──────────────┘   │
│ Po Út St Čt Pá So Ne                │
│  ·  ·  ✓  ✓  ✗  ✓  ✓               │  mřížka dní 7 sloupců, jen ke čtení,
│  ✓  ✓  ✓  ✗  ✓  ✓ (✓)              │  aria-hidden + text „Splněno 12 z 30 dní“
│  ○  ○  ○  ○  ○  ○  ○               │
│ Splněno 12 z 30 dní · 🔥 5 v řadě   │
│ ───────────────────────────────────│
│ Žebříček                            │
│ ┌ Všichni ┐┌ Moje skupina ┐         │  .seg, jen když má skupinu s dalším členem
│ 🥇  Statečná sova        14 dní     │  řádek 48 px
│ 🥈  Klidná panda 7       14 dní     │
│ 🥉  Žirafa z Brna        13 dní     │
│  4. Veselá včela         13 dní     │
│  …                                 │
│ 20. Odvážná lama 3       11 dní     │
│  ⋯                                 │
│┃37. Ty · Vytrvalá vydra  12 dní    ┃│  zvýrazněno (rámeček --accent), vždy viditelné
│ Přidalo se 1 284 lidí  [ ↻ Obnovit ]│
│ Při stejném počtu dní je výš ten,   │  .ch-note
│ kdo se přidal dřív.                 │
└────────────────────────────────────┘
```
- Jsem-li v top 20, zvýrazní se můj řádek v seznamu a spodní řádek „⋯ / 37.“ se nezobrazí.
- Filtr **Moje skupina:** řádky „👩 Jana · Statečná sova · 14 dní“, pořadí stejné (n, joinedAt), bez čísla celkové pozice. Prázdný stav: „Z tvých skupin se zatím nikdo nepřidal. Řekni jim o tom 😉“.
- Prázdný žebříček: „Zatím nikdo. Buď první! 🚀“. Offline: „Žebříček se načte, až budeš online.“ (data z cache, pokud jsou, s „naposledy v 14:05“).
- Skončená výzva: místo tlačítek Dnes/Včera výsledek („Zvládl/a jsi 27 z 30 dní 🎖️“ nebo pozitivně „Dal/a jsi 18 dní. Příště to dáš celé 💪“), žebříček zůstává.
- Nepřihlášený uživatel vidí v detailu žebříček (motivace) a dole tlačítko „Jdu do toho 💪“.
- Menu ⋯: **Změnit přezdívku** (inline pole, stejná validace), **Večerní připomínka** (přepínač), **Odhlásit se z výzvy** (potvrzení: „Opravdu? Tvoje odškrtnuté dny se smažou a zmizíš ze žebříčku.“ → `deleteDoc` + smazat `prof.pc[cid]`).

### 4.4 Konec výzvy, odznak a oslava

- Jakmile `n >= goal` (i před koncem výzvy), klient 1× zavolá `gameAward('pc_' + cid, XP.pcMonth | XP.pcWeek)` a přes `whenUiFree` ukáže `m-gwin`: velké emoji výzvy, „Výzva splněna! 🎖️“, název, „+50 XP · odznak Vytrvalec“, citát avatara, konfety. Jen když je gamifikace vypnutá, oslava bez XP.
- Po konci výzvy (bez dosažení cíle) žádné „prohrál/a jsi“: karta D na Domů 7 dní s pozitivním textem a umístěním.

### 4.5 Administrace (jen `_isAppAdmin`)

V Nastavení úplně dole sekce **🛠️ Správa výzev** (ostatní ji nevidí ani v HTML). Otevře sheet `#m-pcadmin`:

```
Seznam                                   Formulář (nová / úprava)
┌────────────────────────────────────┐   ┌────────────────────────────────────┐
│ 🛠️ Správa výzev                  ✕ │   │ ← Nová výzva                    ✕ │
│ [ ➕ Nová výzva měsíce ]            │   │ Typ  [ Měsíc ][ Týden ]            │ .seg
│ [ ➕ Nová výzva týdne ]             │   │ Období  [ prosinec 2026 ▾ ]         │ měsíc: výběr měsíce, týden: pondělí
│ Běží                                │   │  → 1.–31. 12. (31 dní)              │ dopočteno, needitovatelné
│ 🍬 30 dní bez sladkého  1 284 lidí  │   │ Nápady: 🍬 💧 🚶 📵 🧘 📚 🥦 😴       │ chipy předvyplní název/popis/emoji
│ 🚶 10 000 kroků (týden)   312 lidí  │   │ Ikona [🍬]  Název [____________]    │
│ Připravené (koncepty)               │   │ Popis (co se počítá) [__________]   │ ≤ 300
│ 💧 2 litry denně · prosinec         │   │ Na odznak dní [ 31 ] z 31           │ výchozí = počet dní
│ Skončené                            │   │ ▸ Anglická verze (nepovinné)        │ rozbalovací
│ 📵 Bez mobilu v posteli · říjen     │   │ [ Uložit jako koncept ]             │ .btn-s
└────────────────────────────────────┘   │ [ Zveřejnit ]                       │ .btn-p + potvrzení
                                         └────────────────────────────────────┘
Detail výzvy (admin)
│ 🍬 30 dní bez sladkého · běží        │
│ [ Upravit ] [ Skrýt výzvu ]          │ skrýt = active:false (zmrazí zápisy)
│ Účastníci (1 284)  [ Hledat… ]       │ hledání podle začátku přezdívky (klient, načtené stránky)
│ Statečná sova · 14 dní · 2. 11.  [✕] │ ✕ 44×44 → potvrzení „Odebrat „Statečná sova“? Zmizí ze
│ Klidná panda 7 · 14 dní · 1. 11. [✕] │   žebříčku a do této výzvy se už nepřihlásí.“
│ [ Načíst dalších 50 ]                │ stránkování orderBy(joinedAt), 50 na stránku
```
- Období a `cid` se dopočítají (`m-2026-12`, `w-2026-W49`), admin nepíše data ručně. Pokud výzva s tímto `cid` existuje, formulář ji otevře k úpravě.
- Po zveřejnění jde měnit název, popis, ikonu a anglickou verzi. Období a `goal` se po startu nemění (formulář je zamkne s vysvětlivkou „Výzva už běží“).
- Odebrání = `writeBatch`: `delete(participants/{uid})` + `set(blocked/{uid}, {at})`.

### 4.6 CSS (nové třídy, vše na tokenech, funguje ve všech třech tématech)

```css
/* ── Výzva měsíce / týdne (4.63) ── */
.pc-dw .dw-title{display:flex;align-items:center;gap:6px}
.pc-x{margin-left:auto;min-width:44px;min-height:44px;border:none;background:none;color:var(--text2);font-size:18px;cursor:pointer}
.pc-desc{font-size:14px;color:var(--text2);line-height:1.45;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-check{width:100%;min-height:52px;margin-top:10px;border-radius:12px;border:2px solid var(--green);background:transparent;color:var(--text);font-family:'Crimson Pro',serif;font-size:17px;font-weight:700;cursor:pointer}
.pc-check[aria-pressed="true"]{background:rgba(61,214,140,.14)}
[data-theme="sunshine"] .pc-check[aria-pressed="true"],[data-theme="tangerine"] .pc-check[aria-pressed="true"]{background:rgba(46,125,50,.12)}
.pc-check:focus-visible,.pc-row:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pc-week{display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.pc-week .pc-check{width:auto;min-height:44px;margin:0 0 0 auto;padding:0 14px;font-size:15px}
.pc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:12px 0 4px;text-align:center;font-size:12px;color:var(--text3)}
.pc-cell{aspect-ratio:1;max-width:40px;margin:0 auto;width:100%;border-radius:8px;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:14px}
.pc-cell.on{background:var(--green);border-color:var(--green);color:#fff}
.pc-cell.miss{background:var(--card3)}
.pc-cell.today{box-shadow:0 0 0 2px var(--accent)}
.pc-lb{list-style:none;margin:8px 0 0;padding:0}
.pc-row{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:8px;min-height:48px;padding:0 10px;border-radius:10px;font-size:16px;color:var(--text)}
.pc-row:nth-child(odd){background:var(--card2)}
.pc-rank{font-weight:700;color:var(--text2);text-align:center}
.pc-nick{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-sub{display:block;font-size:13px;color:var(--text2)}
.pc-n{font-weight:700;white-space:nowrap}
.pc-row.me{border:2px solid var(--accent);background:var(--card3)}
.pc-gap{text-align:center;color:var(--text3);min-height:24px}
.pc-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;font-size:14px;color:var(--text2)}
.pc-foot .btn-s{min-height:44px}
.pc-nickrow{display:flex;gap:8px}
.pc-nickrow .finp{flex:1;min-width:0;min-height:48px}
.pc-dice{flex:none;min-width:48px;min-height:48px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);font-size:20px;cursor:pointer}
.pc-cnt{font-size:13px;color:var(--text3);text-align:right}
```
Kontrast: text `--text` na `--card2`/`--card3` ve všech tématech > 7:1; `--text2` > 4.5:1. Zelený rámeček `.pc-check` je dekorativní, stav nese i ikona ✅/⬜ a `aria-pressed`. Animace naplnění lišty stávající (`.ch-fill` transition), u `prefers-reduced-motion` vypnout (již platí globálně? ověřit, jinak přidat).

### 4.7 Přístupnost a texty

- `aria-pressed` u „Splněno dnes“, `role="progressbar"` jako `.ch-bar`, žebříček `<ol class="pc-lb">` s `aria-label="Žebříček, top 20"`, můj řádek `aria-current="true"`.
- Emoji medailí `aria-hidden`, pořadí čtečka čte jako číslo („1. místo“).
- Klíče i18n s prefixem `pc.` v `i18n/cs.js` a `i18n/en.js` (koder až po dokončení práce druhého kodera v i18n). Ukázky (cs):

| Klíč | Text |
|---|---|
| `pc.month` / `pc.week` | Výzva měsíce / Výzva týdne |
| `pc.join` | Jdu do toho 💪 |
| `pc.joinBtn` | Přihlásit se 💪 |
| `pc.today` / `pc.todayDone` | Splněno dnes / Dnes splněno |
| `pc.yesterdayLast` | Splněno včera (poslední den) |
| `pc.progress` | {n} / {goal} dní |
| `pc.streak` | 🔥 {n} v řadě |
| `pc.left` | Zbývá {n} dní |
| `pc.joined` | Přidalo se {n} lidí |
| `pc.board` / `pc.all` / `pc.mine` | Žebříček / Všichni / Moje skupina |
| `pc.me` | Ty · {nick} |
| `pc.tie` | Při stejném počtu dní je výš ten, kdo se přidal dřív. |
| `pc.nickL` / `pc.nickHint` | Tvoje přezdívka v žebříčku / Uvidí ji ostatní. Nepiš sem své jméno ani e-mail. |
| `pc.nickBad` | Tahle přezdívka nejde použít. Zkus jinou 🙂 |
| `pc.nickChars` | Jen písmena, číslice, mezera, _ a - (3–20 znaků). |
| `pc.remind` | Večer mi připomeň, když dnešek ještě nemám (ve 20:00) |
| `pc.grpNote` | Lidé z tvých skupin tě v žebříčku skupiny poznají. |
| `pc.empty` / `pc.emptyGrp` | Zatím nikdo. Buď první! 🚀 / Z tvých skupin se zatím nikdo nepřidal. Řekni jim o tom 😉 |
| `pc.leaveQ` | Opravdu? Tvoje odškrtnuté dny se smažou a zmizíš ze žebříčku. |
| `pc.win.t` | Výzva splněna! 🎖️ |
| `pc.resGood` / `pc.resTry` | Zvládl/a jsi {n} z {days} dní 🎖️ / Dal/a jsi {n} dní. Příště to dáš celé 💪 |
| `pc.soon` | Od {d} nová výzva: {title} |
| `pc.blocked` | Do této výzvy se přihlásit nejde. |

Rod („Zvládl/a“) držet stejně jako zbytek appky (lomítko, appka rod uživatele nezná).

---

## 5. Logika klienta (pro kodera)

### 5.1 Načtení
- Po přihlášení a pak 1× za hodinu / při návratu do appky po >1 h: `query(publicChallenges, where('active','==',true), orderBy('end','desc'), limit(6))` → v paměti jen výzvy s `end >= dnes − 7` a `start <= dnes + 3`. Cache v `localStorage` `lp_pc_list` (rychlé první vykreslení).
- Pro každou z nich (max 2 běžící + 2 nedávno skončené) `getDoc(participants/{uid})`; u běžících, kde jsem přihlášen/a, místo toho `onSnapshot` na vlastní dokument (synchronizace mezi zařízeními, 1 čtení + změny).

### 5.2 Odškrtnutí
- `updateDoc(ref, {d: nové pole, n: nové.length, upAt: serverTimestamp(), nick: stávající})` — nikdy `arrayUnion` bez `n` (pravidla chtějí `n == d.size()`). Kvůli souběhu dvou zařízení použít `runTransaction` (přečte aktuální `d`, přidá den), offline fallback `updateDoc` s lokálním stavem.
- Zároveň `setDoc(profile/main, {pc: {[cid]: {r, last}}}, {merge: true})`.
- Datum vždy `toDS()` / `addDays(toDS(), -1)`.

### 5.3 Pozice
`getCountFromServer` 2× podle §1.5, jen při otevření detailu, cache 2 min. Pro nepřihlášeného se nepočítá.

### 5.4 Skupina
`uids = unique(myGroupIds().flatMap(g => Object.keys(groupDataOf(g)?.members || {})))`, po 30 `query(participants, where(documentId(),'in',chunk), limit(30))`, seřadit klientsky (n desc, joinedAt asc).

### 5.5 Data ze serveru jsou data
`pcNorm()` jako `chNorm()`: ověřit typy, oříznout `nick` na 20, `title` na 60, `desc` na 300, všechno do HTML přes `esc()`, do handlerů jen přes `data-aN`.

### 5.6 Gamifikace
- `XP.pcMonth = 50`, `XP.pcWeek = 20` (koder ať porovná s `XP.chDone`, aby měsíční výzva byla nejvyšší jednorázová odměna mimo úrovně). Klíč `pc_` **nepatří** do `GAME_CAPPED` (1× za výzvu, farmit nejde).
- Do `game.once['pc_' + cid]` přidat `t` (název, ≤ 60) → seznam „Moje splněné výzvy“ v Herní sekci bez dalšího čtení.
- Nové odznaky v `BADGES` (počet klíčů `pc_` v `badgeCtx()` jako `c.pcN`):
  - `pc_1` 🎖️ „Vytrvalec“ – první dokončená výzva
  - `pc_3` 🏅 „Sběratel výzev“ – 3 dokončené
  - `pc_12` 👑 „Rok výzev“ – 12 dokončených

### 5.7 AI kontext (fáze 2)
Do `buildChatContext()` řádek „Výzva měsíce: {title}, splněno {n}/{goal} dní, dnes {ano/ne}“ (~80 znaků).

---

## 6. Notifikace (Cloud Functions, nasadí se samy po pushi)

V `sendScheduledNotifications`:
1. Na začátku běhu 1 dotaz na aktivní výzvy (stejný jako klient), cache v proměnné modulu na 15 min → ~100 čtení denně celkem.
2. U každého uživatele (profil už je načtený, **0 čtení navíc**), jen když má push token a `notifSettings.pc !== false` (nový přepínač v Nastavení → Upozornění: „🏆 Výzvy měsíce“):
   - **Start nové výzvy:** den `start` (v zóně uživatele) v čase ranního souhrnu (`ns.morning`, `isTimeMatch`), jen když ještě není v `prof.pc[cid]`. Titulek „🏆 Nová výzva měsíce“, text „{emoji} {title} — jdeš do toho?“, tag `pc-<cid>`, `data.open = 'pc'`, `data.cid`. Týdenní výzva jen přihlášeným v minulé týdenní výzvě (aby týden nespamoval všechny), měsíční všem.
   - **Večerní připomínka:** `prof.pc[cid].r === true`, dnes v rozsahu výzvy, `prof.pc[cid].last !== dnes`, čas 20:00 v zóně uživatele, ne v nočním klidu. „🍬 Dnešek ještě nemáš odškrtnutý“ / „Splnil/a jsi dnes {title}? Klepni a odškrtni.“, tag `pc-<cid>-eve`. Při dvou výzvách jedna notifikace („Dnešek máš ještě ve 2 výzvách“).
3. Klik na notifikaci → `open: 'pc'` otevře detail výzvy (rozšířit stávající zpracování `data.open` v sw.js/app.js).
4. Texty v `functions/i18n-server.js` (`pc.start.t`, `pc.start.b`, `pc.eve.t`, `pc.eve.b`, `pc.eve.multi`).
5. Fáze 2 (volitelně): akční tlačítko „✅ Splněno“ přímo v notifikaci podle vzoru `HABIT_DONE_FROM_NOTIF`.

`dailyStats`: přidat anonymní čísla `pcParticipants` a `pcCheckedYesterday` (2× `count()` na běžící výzvu, ~2 čtení).

---

## 7. Soukromí, smazání účtu, export

- **deleteAccount** (functions/index.js), nový krok po (b): projít `publicChallenges` (`listDocuments()`, desítky dokumentů) a pro každý `batch.delete(participants/{uid})` + `batch.delete(blocked/{uid})` (smazání neexistujícího dokumentu nevadí, dávky po 200). Chyba kroku smazání účtu nezastaví, jen zaloguje (jako aktivita skupin). `prof.pc` zmizí s `users/{uid}`.
- **Odhlášení z výzvy** v appce smaže dokument účastníka okamžitě.
- **Export** (`exportMyData`): po kolekcích přidat `"publicChallenges": {cid: {title, nick, j, d, n, joinedAt}}` pro klíče z `prof.pc` + `getDoc` vlastního dokumentu; stav do `setExportStatus` („Výzvy…“).
- **privacy.html / privacy-en.html** – nový bod (za „5. Skupiny“, ostatní přečíslovat), návrh textu:
  > **Výzva měsíce a týdne.** Když se přihlásíš do veřejné výzvy, uložíme přezdívku, kterou si pro výzvu zvolíš, den přihlášení a dny, které si odškrtneš. Přezdívku a počet dní uvidí v žebříčku všichni přihlášení uživatelé LifePocket; tvé jméno ani e-mail nikdy. Lidé z tvých skupin tě v žebříčku skupiny poznají. Z výzvy se můžeš kdykoli odhlásit, tím se tvoje údaje o výzvě smažou. Nevhodné přezdívky může správce aplikace odebrat. Údaje o výzvě se smažou i se smazáním účtu.
  
  Do bodu „Jak dlouho data uchováváme“: „Údaje o výzvách uchováváme po dobu existence účtu nebo do odhlášení z výzvy.“ (fáze 2: úklid starých výzev po 13 měsících skriptem).
- **terms.html**: věta o slušných přezdívkách a právu správce účastníka odebrat.

---

## 8. Rozfázování a náročnost

| Fáze | Obsah | Náročnost (koder) |
|---|---|---|
| **1 – MVP (verze 4.63)** | pravidla + indexy, `scripts/set-admin.js`, admin sheet (založit, upravit, skrýt, odebrat účastníka), karta na Domů (stavy A–E), sheet přihlášení s přezdívkou a filtrem, detail s Dnes/Včera, mřížkou, top 20, vlastní pozicí, filtrem skupiny, oslava + XP + 3 odznaky, export, privacy/terms, i18n cs+en, deleteAccount | 2,5–3 dny + 0,5 dne pravidla a testy pravidel |
| **1b (hned po MVP, jen functions)** | notifikace start + večerní připomínka, přepínač v Upozorněních, čísla v `dailyStats` | 0,5–1 den |
| **2** | „Nahlásit přezdívku“ (`reports` jen create, admin vidí v sheetu), AI kontext, propojení s návykem / pitným režimem (volitelný odkaz `prof.pc[cid].link = habitId` → odškrtnutí návyku odškrtne i výzvu), akční tlačítko v notifikaci, sdílení výsledku (obrázek), seznam „Moje výzvy“ | 2 dny |
| **3 (až při růstu)** | serverový souhrn `meta/board` (cron 10 min), úklid starých účastníků, případně náhodné ID účastníka místo uid | 1 den |

Revizor: hlavní riziko je v pravidlech (§2), proto testovat simulací v node (fixní `request.time`, výpočet okna `pcNowish` pro UTC−12/+1/+14) a Rules Playground (Adam).

---

## 9. Co musí udělat Adam

1. **Admin účet:** po dodání skriptu spustit `node scripts/set-admin.js --email=adam.stencl@gmail.com` (klíč servisního účtu už máš lokálně kvůli `stats-report.js`), pak se v appce odhlásit a znovu přihlásit.
2. **Nasadit pravidla a indexy:** `firebase deploy --only firestore:rules,firestore:indexes` (nebo workflow s „ANO“, pokud se rozšíří o indexy). Indexy se staví pár minut; do té doby žebříček hlásí chybu, proto nasadit **před** vydáním verze appky.
3. **Rules Playground** (konzole Firebase → Firestore → Pravidla): 5 rychlých testů ze §2 před nasazením.
4. **Založit první výzvu** v appce (Nastavení → 🛠️ Správa výzev), ideálně pár dní před 1. dnem měsíce, aby fungovalo ohlášení „Od 1. 12. …“ a push v den startu.
5. Přečíst text do privacy.html a terms.html (§7).

---

## 10. Doporučená výchozí rozhodnutí (k odsouhlasení vedoucím)

1. **Žebříček přímo z Firestore (top 20 přes index + pozice přes `count()`), bez serverového souhrnu.** Serverový souhrn až ve fázi 3.
2. **Admin = custom claim `admin`** nastavený skriptem, ne pevné uid v pravidlech.
3. **Účastník = dokument s ID uid**, jen `nick, joinedAt, j, d, n, upAt`. Žádné ID skupin ve veřejných datech; filtr skupiny přes uid členů na klientu, v něm jména ze skupiny + otevřené upozornění při přihlášení.
4. **Proti podvádění:** pravidla povolí jen ±1 den na zápis a jen den v okně „dnes/včera“ podle `request.time` (přesah nejvýš 1 den za výzvu); lež řeší admin odebráním + blokací.
5. **Přezdívka 3–20 znaků**, jen písmena/číslice/mezera/_/-, předvyplněná náhodně; filtr sprostých slov hlavně v klientu, hrubá pojistka v pravidlech, rezervovaná slova (admin, lifepocket…).
6. **Odznak při dosažení `goal` dní** (výchozí = všechny dny, admin může snížit), hned, ne až po konci. XP 50 za měsíc, 20 za týden, odznaky 🎖️ 1 / 🏅 3 / 👑 12 výzev.
7. **Karta na Domů jen když výzva běží nebo začíná do 3 dní**, nad skupinovými výzvami; nepřihlášený ji může ✕ skrýt pro danou výzvu.
8. **Večerní připomínka ve 20:00, při přihlášení předzaškrtnutá**, ohlášení nové měsíční výzvy push všem s povoleným přepínačem „🏆 Výzvy měsíce“ (výchozí zapnuto), týdenní jen účastníkům minulé týdenní výzvy (podle `prof.pc`).
9. **„Splněno včera“ jde dopsat** (stejně jako skupinové výzvy), i ráno po posledním dni do poledne.
10. **Mazat výzvu jde jen jako koncept**; běžící se „skryje“ (`active:false`), zápisy se tím zmrazí.
