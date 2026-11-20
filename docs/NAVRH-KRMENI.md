# Návrh: 🍖 Krmení mazlíčka („Nakrmeno“, „Je se mnou“, ochrana proti dvojímu krmení)

Výchozí stav: verze 5.16 (větev `claude/awesome-hypatia-72pnwx` = `main` ca6ee05). Cíl: 5.17. Mobil 390×844, všechna témata.
`app.js` jsem neměnil. Čísla řádků jsou orientační, koder ať místa hledá grepem podle názvu funkce.

Zadání (nápad kamaráda, uživatel schválil všechny tři body):
1. Tlačítko **„Nakrmeno 🍖“** u mazlíčka, sdílené ve skupině. Ostatní hned vidí „Nakrmila Jana v 7:40“, volitelně push.
2. **„Je se mnou“**: člen si přepne, že má psa u sebe (víkend / do data / dokud nevypne). Připomínky krmení pak chodí jen jemu. Mazlíček bez skupiny funguje jako dnes.
3. **Ochrana proti dvojímu krmení**: „Jana už krmila v 7:40. Opravdu znovu?“

Mimo rozsah: čtení čipu z telefonu (134,2 kHz, NFC to neumí), chytré misky, odečítání granulí podle krmení.

---

## 0. Co je v kódu dnes (rozhoduje o návrhu)

| Zjištění | Místo | Důsledek |
|---|---|---|
| Mazlíček leží buď v `users/{uid}/pets/{id}`, nebo v `families/{gid}/pets/{id}` (sdílení = přesun). Zdroj pravdy je dokument mazlíčka. | `subPets`, `subscribeGroupPets`, `petRef` (~20290) | Krmení patří **do dokumentu mazlíčka**. Listener už existuje u všech členů, žádný nový odběr. |
| `petNorm` čte jen známá pole, `petDataOut` zapisuje jen známá pole (sdílení, vrácení, kopie při odchodu, Zpět po smazání). | ~20252, ~20281 | `feed` a `with` se musí přidat do obou, jinak se při přesunu ztratí. **Klient 5.16** je při sdílení/vrácení zahodí (edge case §8.10). |
| Historie péče `log` je pole v dokumentu (max 30), zápis „Hotovo“ přes transakci `petDoneWrite` s offline větví přes `arrayUnion`. | ~20401 | Stejný vzor pro záznamy krmení (transakce online, offline fallback). |
| Pravidla: `families/{gid}/{sub}/{doc}` čte a píše každý člen, jen **1 úroveň**. `users/{uid}/**` jen vlastník, bez kontroly polí. | firestore.rules ~128, ~23 | Pole v dokumentu mazlíčka a index v mém profilu jdou **bez změny pravidel**. Podkolekce `pets/{id}/feeds` by nešla. |
| Aktivita skupiny: `module` jen z výčtu (`cal`, `shop`, …, žádné `pet`), volitelné `ref` (≤ 200 znaků), `val`, `em`. | firestore.rules ~141 | Krmení zapisujeme jako `module:'cal', action:'done', ref:'feed:…'`. Žádná změna pravidel. |
| Push ze skupiny chodí přes cron `groupNotifs` (feed aktivity + preference `groupNotif` v profilu, noční klid, „Hned“ = 2–10 min). `notifyFamily` je starší ruční tlačítko jen pro **hlavní** skupinu, s limitem 1× za 2 min. | functions/index.js ~1691, ~1027 | Potvrzení „nakrmeno“ posílá **cron přes aktivitu**, ne `notifyFamily` (vedlejší skupiny, limit 2 min, žádné preference). |
| Připomínky úkolů: index `profile/main.taskRem` bez textu, cron ho čte z už načteného profilu (0 čtení), dokument checklistu čte až v okamžiku připomínky. | functions/index.js ~2033, app.js `taskRemSync` ~20008 | Stejný vzor: index **`profile/main.petFeed`**, pet dokument se čte jen v čase krmení. |
| Termíny péče se zrcadlí do kalendáře (`pet_{id}_{cid}`, typ `vet`). | `petEvSync` | Krmení se do kalendáře **nezrcadlí** (2–4 události denně by kalendář zahltily). |
| Karta na Domů `petsWidgetHTML` ukazuje péči a granule; v jednoduchém režimu je prvních 14 dní skrytá (`simpleDash`). | ~20940, `petRefresh` | Na kartu přidat řádek krmení s tlačítkem. Viz §5.4 pro jednoduchý režim. |
| AI kontext mazlíčků (`aip.ctx.s.pets`) posílá jméno, druh, péči, granule. | ~24927 | Přidat krátký stav krmení dnes (§9). |

---

## 1. Rozsah (jedna verze, jeden koder)

**MVP 5.17**
1. Nastavení krmení u mazlíčka: kolikrát denně (1–4×) a v kolik. Tlačítko „Nakrmit“ i bez nastavení (pak bez připomínek a s ochranou jen „před chvílí“).
2. Tlačítko **🍖 Nakrmeno** na stránce mazlíčka a na kartě Domů. Stav dne „ráno ✓ Jana 7:40 · večer zatím ne“.
3. Ochrana proti dvojímu krmení (dotaz) + souběh dvou lidí (transakce).
4. **Je se mnou** (jen mazlíček ve skupině se 2+ členy).
5. Serverové připomínky krmení (index v profilu, 0 čtení navíc na běh). Připomínka se nepošle, když už někdo nakrmil, nebo když je mazlíček u jiného člena.
6. Push ostatním „Jana nakrmila Báru“ přes feed skupiny podle preference příjemce (výchozí: jen místo připomínky, §4.4).
7. Historie krmení 14 dní (týdenní přehled na stránce mazlíčka).
8. Zpět po klepnutí, oprava času („Krmil/a jsem dřív“), smazání vlastního záznamu.
9. Řádek do AI kontextu, texty cs/en, privacy, CHANGELOG.

**Fáze 2 (ne teď):** tlačítko „🍖 Nakrmeno“ přímo v notifikaci (nový `onRequest` jako `habitSnooze`), druhá připomínka „ještě nikdo nenakrmil“ po 60 min, porce v gramech a napojení na výpočet granulí, statistika „kdo krmí nejčastěji“.

---

## 2. Datový model

### 2.1 Dokument mazlíčka (`users/{uid}/pets/{id}` i `families/{gid}/pets/{id}`), nová pole

```js
feed: {
  times: ['07:30', '18:00'],   // 0–4 časy 'HH:MM', seřazené, unikátní; [] = bez plánu (tlačítko funguje, připomínky ne)
  log: [                       // posledních 14 dní, nejvýš 80 záznamů (4× denně × 14 + rezerva na dvojí krmení)
    { id: 'k3x9', d: '2026-11-20', t: '07:40', s: 0, by: 'uid…', n: 'Jana', g: 'f' }
    // d+t = místní čas toho, kdo krmil (toDS / HH:MM), s = index času krmení (slot) v okamžiku zápisu,
    // n = přezdívka ≤ 40 (jen záloha pro bývalé členy, jinak jméno z members), g = 'f' kvůli „nakrmila“
  ],
  upd: 1732080000000           // ms poslední změny časů (jen pro ladění)
},
with: {                        // null / chybí = mazlíček není u nikoho konkrétního
  uid: 'uid…', n: 'Jana', g: 'f',
  until: '2026-11-23',         // poslední den včetně; null = dokud to nevypnu
  at: 1732080000000
}
```

Proč v dokumentu mazlíčka a ne jinde:
- `families/{gid}/pets/{id}/feeds/{x}` pravidla nepovolují (jen 1 úroveň).
- Samostatná kolekce `families/{gid}/petFeeds/{petId}` by pravidla povolila, ale znamená druhý listener u každého člena a druhé čtení na serveru. Dokument mazlíčka už všichni poslouchají.
- Velikost: 80 záznamů × ~90 B ≈ 7 KB. S historií péče (30) a zbytkem karty pod 15 KB. Limit dokumentu je 1 MB.

Ořez: při každém zápisu se zahodí záznamy s `d` starším než dnes − 13 dní a pak nejstarší nad 80.

Úpravy časů jdou přes field path `feed.times` (nepřepíše `log`), záznamy přes transakci nad `feed.log` (nepřepíše `times`, `care`, `log` péče). `with` je samostatné pole nejvyšší úrovně, zapisuje se přes `updateDoc({with: …})`.

**`petNorm`**: `feed.times` jen platné `okEvTime`, max 4, seřadit; `log` jen záznamy s `isDS(d)`, `t` HH:MM, `s` 0–3, `by` ≤ 128; `with` jen s `uid` string a `until` `isDS` nebo null. **`petDataOut`**: přidat `feed` a `with`.

### 2.2 Index připomínek v mém profilu: `users/{uid}/profile/main.petFeed`

```js
petFeed: {
  'p7aB…': { g: 'RODINA-AB12CD', t: ['07:30', '18:00'], on: true },  // g '' = můj osobní mazlíček
  'q1zZ…': { g: '', t: ['08:00'], on: false }                         // on:false = připomínky si vypnul/a
}
```

- Bez jména mazlíčka (jako `taskRem` bez textu úkolu). Jméno server přečte z dokumentu mazlíčka až při odeslání.
- Píše jen můj klient (`users/{uid}/**`), field path `petFeed.<petId>` (jako `tkRemWrite`). Pravidla beze změny.
- Max 10 mazlíčků (server zpracuje prvních 10).
- `on` je osobní volba každého člena („Připomínat mi krmení“). Výchozí `true`.

**Synchronizace (`petFeedSync`, vzor `taskRemSync`)**: po každém snapshotu mazlíčků (osobních i skupinových, debounce 1,5 s) klient spočítá požadovaný index:
- jen se zapnutým modulem Mazlíček (vypnutý modul = smazat všechny klíče),
- jen mazlíčci s neprázdným `feed.times`, ve skupině jen tam, kde jsem člen a skupina sdílí kalendář,
- `on` převzít z existujícího záznamu (nová položka = `true`),

a zapíše jen rozdíl (`petFeed.<id>` nebo `deleteField()`). Nastavení `on` mění přepínač v okně krmení (§5.3).

### 2.3 Firestore pravidla: **beze změny** ✅

| Zápis | Pravidlo | OK |
|---|---|---|
| `feed`, `with` v `families/{gid}/pets/{id}` | obecné pravidlo podkolekcí skupiny (člen) | ✅ |
| `feed`, `with` v `users/{uid}/pets/{id}` | `users/{uid}/**` | ✅ |
| `petFeed.*` v `users/{uid}/profile/main` | `users/{uid}/**` | ✅ |
| `groupNotif.feed` (preference) v profilu | `users/{uid}/**` | ✅ |
| aktivita `module:'cal', action:'done', ref:'feed:…'` | výčet `module` a `action` obsahuje `cal` a `done`, `ref` ≤ 200 | ✅ |

Riziko, které pravidla nepokryjí (stejné jako dnes u celého mazlíčka): člen skupiny může technicky přepsat cizí záznam krmení nebo `with`. V UI smí smazat/opravit jen svůj záznam; `with` může převzít každý (s dotazem, §3.3).

Indexy `firestore.indexes.json`: žádné nové.

---

## 3. Toky

### 3.1 Časy krmení a okno pro dvojí krmení

Výchozí časy podle počtu (uživatel je v okně upraví):

| Počet | Výchozí časy | Hranice slotů (polovina mezi časy) | Okno pro dotaz |
|---|---|---|---|
| 1× | 07:30 | celý den | jakékoli krmení dnes |
| 2× | 07:30, 18:00 | 12:45 | ráno 0:00–12:45, večer 12:45–24:00 |
| 3× | 07:30, 12:30, 18:00 | 10:00, 15:15 | podle slotu |
| 4× | 07:00, 11:00, 15:00, 19:00 | 9:00, 13:00, 17:00 | podle slotu |
| bez plánu | – | – | jen pravidlo „před méně než 60 min“ |

Pravidlo pro dotaz „Opravdu znovu?“ (čistá funkce `feedClash(p, now)`, stejná logika na serveru pro rozhodnutí o připomínce):
1. Slot teď = `feedSlot(times, HH:MM)`: první slot, jehož horní hranice je > teď (hranice = půlka mezi sousedními časy; první slot začíná 0:00, poslední končí 24:00).
2. Dotaz, když dnes existuje záznam se stejným `s` (bez ohledu na to, kdo krmil, i já sám),
3. **nebo** když poslední záznam (kdykoli, kdokoli) je mladší než 60 min (zachytí krmení těsně přes hranici slotu, např. 12:40 a 12:50).

Proč půlka mezi časy: pro laika „ranní krmení“ = krmení dopoledne, i když se opozdí. Pevné okno (např. ±2 h) by u 1× denně pustilo druhé krmení odpoledne, u 4× by se okna překrývala.

Slot se počítá v okamžiku zápisu a ukládá do záznamu (`s`). Když se později změní časy, staré záznamy se znovu nepřepočítávají (týdenní přehled je ukazuje podle `t`).

### 3.2 Nakrmeno (hlavní tok)

```
klepnutí 🍖 Nakrmeno
  └─ feedClash? ── ano ─► dotaz (lpConfirm): „Jana už krmila v 7:40. Opravdu znovu?“
  │                         [Nekrmit] (výchozí fokus)   [Ano, znovu]
  │                         └─ Nekrmit → nic
  └─ zápis záznamu {id, d: toDS(), t: HH:MM, s, by, n, g}
       online: runTransaction nad dokumentem mazlíčka
         – čerstvý log: přibyl mezitím cizí záznam ve stejném slotu nebo < 2 min?
             → nezapisovat, zavřít transakci a ukázat dotaz znovu s čerstvým jménem
               („Bára je už nakrmená – právě teď ji nakrmil Adam (7:41). Přesto zapsat?“)
         – jinak přidat, ořezat (§2.1), tx.update({'feed.log': …, updatedAt})
       offline: updateDoc s arrayUnion(entry) (jako petDoneWrite), kontrola jen proti lokálnímu logu
  ├─ toast s Zpět (undoNote, 6 s): „🍖 Bára nakrmená v 7:40“  [Zpět]
  ├─ ve skupině: logGroupActivity(gid, 'cal', 'done', gaTitle(p.name), 1, {ref: 'feed:<petId>:<d>:<s>[:w]'})
  │    (:w = krmil ten, u koho mazlíček je → ostatním se nic nepushuje, §4.4)
  └─ haptika navigator.vibrate?.(15) jako u odškrtnutí návyku
```

- Zpět = transakce, která odebere záznam podle `id` + `unlogGroupActivity` (aktivita je v bufferu, takže se většinou vůbec nezapíše). `gaKey` musí pro `ref` začínající `feed:` přidat `|ref`, aby se krmení dvou mazlíčků nesloučilo do jednoho záznamu.
- Pojistka proti dvojímu klepnutí (jako `_petFoodBusy`): 1,5 s se druhé klepnutí ignoruje.
- „Krmil/a jsem dřív“ (odkaz pod tlačítkem): okno s časem (time picker appky, max teď, jen dnes). Slot podle zadaného času, stejná kontrola `feedClash` k zadanému času.
- Smazání vlastního záznamu: klepnutí na svůj řádek v „Dnes“ → malý sheet „Smazat záznam 7:40?“ [Zrušit] [Smazat] + Zpět. Cizí záznam smazat nejde (ukáže se jen kdo a kdy).

### 3.3 Je se mnou

Jen mazlíček ve skupině, kde jsou aspoň 2 členové. U osobního mazlíčka a ve skupině s 1 členem se řádek neukáže (chování jako dnes).

```
řádek „🏠 Je doma (u všech)“  [Mám ho u sebe]
  └─ sheet „Bára je u mě…“
       ( ) Do neděle            → until = nejbližší neděle (v neděli = dnes)
       ( ) Do data… [datum]     → until = vybrané datum (min dnes, max dnes + 60)
       ( ) Dokud to nevypnu      → until = null
       [Zrušit] [Potvrdit]
  └─ updateDoc({with: {uid, n, g, until, at}})
     + aktivita 'cal','edit', title „🐕 Bára je u: Jana“ (jedna řádka ve feedu, push podle preference Kalendáře)

Stav ve skupině:   „🐕 Bára je u: Jana · do ne 23. 11.“            (všichni)
                   „🐕 Bára je u tebe do ne 23. 11.  [Vrátit domů]“ (držitel)
Převzetí:          jiný člen klepne „Mám u sebe“ → dotaz „Bára je teď u: Jana. Vzít k sobě?“
Vrátit domů:       updateDoc({with: null}) + toast „Bára je zase doma, připomínky dostanou všichni“
```

Platnost: `with` platí, když `until == null || until >= toDS()` **a** `with.uid` je stále členem skupiny. Prošlé nebo neplatné `with` klient i server berou jako „u nikoho“. Úklid: první klient, který vidí prošlé `with`, ho zapíše jako `null` (nejde o nic kritického, jen aby se v dokumentu nehromadilo).

Co `with` ovlivní: **jen připomínky krmení** (chodí jen držiteli) a push „nakrmeno“ (od držitele se ostatním neposílá). Tlačítko Nakrmeno mají dál všichni (můžou být spolu), péče o veterinu a granule se nemění.

### 3.4 Připomínky krmení (server, 0 čtení navíc na běh)

V `sendScheduledNotifications` za blok úkolů (`taskRem`), stejný styl:

```
pf = prof.petFeed (objekt), ns.feed !== false, modul 'pets' zapnutý
pro [pid, r] z prvních 10 položek:
  přeskoč neplatné (PET_ID_RE, r.t pole HH:MM max 4, r.on !== true)
  pro každý čas s indexem s: isTimeMatch(h, m, time) → splatná (přes půlnoc den = včera jako mealRemindDecide)
splatné → přečti dokument mazlíčka (1 čtení, jen teď; ve skupině přes cache běhu lazy(famEntry(g), 'pet|'+pid))
  – skupina: fam.members[uid] a fam.shareCal, jinak smazat petFeed.<pid> (odebraný člen, zrušené sdílení)
  – dokument neexistuje → smazat petFeed.<pid>
  – feed.times[s] !== time → přeskočit (zastaralý index, klient ho přepíše po otevření)
  – with platné a with.uid !== uid → nic (mazlíček je u jiného)
  – v log je dnes záznam se slotem s, nebo záznam mladší než 60 min → nic (už nakrmeno)
  – jinak push
```

Texty pushe (tag `feed-<pid>-<den>-<s>`, `data: {open: 'pets', id: pid}`, TTL 3600):

| Situace | Titulek | Text |
|---|---|---|
| osobní mazlíček | 🍖 Čas nakrmit Báru | Večer · 18:00 |
| ve skupině, u nikoho | 🍖 Čas nakrmit Báru | Večer · 18:00 · zatím nikdo nekrmil |
| je u mě | 🍖 Čas nakrmit Báru | Bára je u tebe · večer 18:00 |

Názvy slotů podle času: do 10:59 „ráno“, 11:00–13:59 „v poledne“, 14:00–16:59 „odpoledne“, od 17:00 „večer“ (jen text, logika jede přes index).

Noční klid skupiny se na připomínky krmení **nevztahuje** (čas si uživatel nastavil sám, jako u úkolů a návyků).

Pozn. ke skloňování jména v titulku („nakrmit Báru“): jméno mazlíčka neskloňujeme (riziko „nakrmit Bára“ zní hůř než chyba v pádu). Titulek proto zní **„🍖 Krmení: Bára“** a text „Je čas, večer 18:00 · zatím nikdo nekrmil“. V appce stejně: „Krmení: Bára“, ne „Nakrmit Báru“. (Platí pro všechny texty v §6.)

### 3.5 Potvrzení „nakrmeno“ ostatním (server, feed skupiny)

Nová preference v `groupNotif`: `feed: 'rem' | 'instant' | 'off'`, výchozí **`'rem'`** (klient `GROUP_NOTIF_DEFAULTS` i server stejně).

V `groupNotifs`:
- `gnIsFeed(a) = a.module === 'cal' && a.action === 'done' && /^feed:[A-Za-z0-9_-]{1,40}:\d{4}-\d{2}-\d{2}:[0-3](:w)?$/.test(a.ref)`.
- `gnModeOf`: pro `gnIsFeed` vrací `'instant'`, pokud `gp.feed !== 'off'`, jinak `'off'` (nezávisle na nastavení Kalendáře).
- `wanted`: feed akce se ':w' (krmil držitel) nikomu; při `gp.feed === 'rem'` jen tomu, kdo má v `prof.petFeed[pid]` `on` a čas slotu `s` už dnes minul (tj. připomínka mu odešla nebo měla odejít). Rozhoduje se jen z načteného profilu, 0 čtení.
- Odeslání zvlášť (jako milníky): titulek „🍖 Bára je nakrmená“, text „Jana nakrmila v 7:40“ (čas z ref slotu nestačí → čas vezme z `ts` aktivity v zóně příjemce), **tag `feed-<pid>-<d>-<s>`** = stejný jako připomínka, `quiet: true`. Připomínka na zamknuté obrazovce se tak tiše přepíše na „už je hotovo“ a nezvoní znovu.
- Večerní souhrn feed akce nepočítá (krmení je rutina, souhrn by zahltilo).
- Noční klid platí (jako u všech „Hned“ ze skupiny).

Proč ne `notifyFamily`: posílá jen do hlavní skupiny, má limit 1× za 2 min na skupinu (dvě krmení dvou mazlíčků by druhé zahodily), nerespektuje preference ani tag připomínky.

### 3.6 Feed skupiny „Co je nového“ v appce

Řádek: „🍖 Jana nakrmila Báru · 7:40“ → kvůli skloňování „🍖 Jana nakrmila: Bára · 7:40“ (stejný vzor „autor akce: název“ jako ostatní řádky). Klient 5.16 bez nového klíče ukáže obecné „Jana upravila v kalendáři: Bára“ (přijatelné).

Klíče serveru: `gn.act.cal.done` by změnil text i pro jiné „done“ v kalendáři, proto feed akce dostanou vlastní větev s klíčem `gn.feed.*`.

---

## 4. Rozhodnutí v kostce

| Otázka | Návrh |
|---|---|
| Kde jsou data | Dokument mazlíčka (`feed`, `with`) + index `profile/main.petFeed` |
| Změna pravidel | **Ne** |
| Nové Cloud Functions | **Ne**, úprava `sendScheduledNotifications` (+ texty v `functions/i18n-server.js`). Nasadí se samo po push (GitHub Actions). |
| Čtení navíc na běh cronu | 0. Jen v čase krmení 1 čtení dokumentu mazlíčka na splatný čas (sdílené v rámci běhu pro členy jedné skupiny). Rodina 4 lidí, 2 krmení = max 8 čtení denně. |
| Historie | 14 dní, max 80 záznamů, v dokumentu mazlíčka |
| Kalendář | Krmení se nezrcadlí |
| Push „nakrmeno“ | Feed skupiny, preference příjemce `feed`, výchozí „jen místo připomínky“ |
| `sw.js` | Beze změny (`open:'pets'` už povolené). `CACHE` bump kvůli verzi. |

---

## 5. Obrazovky (390 px)

Komponenty a tokeny existující: `.pet-sec`, `.dw-title`, `.pet-row`, `.pet-done`, `.btn-p/.btn-s`, `.pet-link`, `.pet-note`, `.seg/.seg-btn`, `.pet-pill`, `petSheet`, `lpConfirm`, `undoNote`, time picker (`data-time-picker`). Nové třídy s prefixem `pet-feed-`. Barvy jen přes `--card`, `--card2`, `--text*`, `--accent`, `--green`, `--border2` → fungují ve světlém i tmavém tématu. Stav nikdy jen barvou (vždy ✓ / text).

### 5.1 Stránka mazlíčka: PŘED / PO

**Před (5.16)**
```
┌──────────────────────────────────────┐
│ 🐾 Mazlíček                     [＋] │
│ [🐕 Bára] [🐈 Mourek]                │
├──────────────────────────────────────┤
│ (🐕) Bára                       [✏️] │
│      Pes · labrador · 5 let          │
│ [ 📞 Zavolat veterináři ]            │
├──────────────────────────────────────┤
│ PÉČE                                 │
│ 🪱 Odčervení            [✓ Hotovo]   │
│ …                                    │
│ GRANULE …                            │
```

**Po (5.17)** – sekce KRMENÍ hned pod kartou, nad Péčí (nejčastější akce = nejvýš, v dosahu palce po scrollu o kus)
```
┌──────────────────────────────────────┐
│ (🐕) Bára                       [✏️] │
│      Pes · labrador · 5 let          │
│ [ 📞 Zavolat veterináři ]            │
├──────────────────────────────────────┤
│ KRMENÍ                       [⚙︎ 2×] │  .dw-title + vpravo odkaz na nastavení (44×44, text „2× denně ›“)
│ ┌──────────────────────────────────┐ │
│ │ ☀️ Ráno 7:30   ✓ Jana · 7:40     │ │  slot: ikona + název + čas; stav vpravo
│ │ 🌙 Večer 18:00   zatím ne        │ │  aktuální slot zvýrazněn (levý okraj 3 px --accent)
│ └──────────────────────────────────┘ │
│ [        🍖 Nakrmeno         ]       │  .btn-p plná šířka, výška 56 px, text 17 px tučně
│      Krmil/a jsem dřív ›             │  .pet-link, 44 px vysoký cíl
│ 🏠 Je doma (u všech)  [Mám ji u sebe]│  jen skupina 2+ členů; tlačítko .btn-s 44 px
├──────────────────────────────────────┤
│ PÉČE …                               │
│ GRANULE …                            │
│ ▸ Údaje  ▸ Historie péče             │
│ ▸ Krmení za poslední týden           │  nové <details>, §5.5
```

Stavy tlačítka:
- Aktuální slot nenakrmený: `.btn-p` „🍖 Nakrmeno“.
- Aktuální slot nakrmený: `.btn-s` „🍖 Nakrmeno“ (stále klikatelné, vede na dotaz), nad ním zelené „✓ Na teď je nakrmeno“.
- Bez plánu (`times: []`): sekce ukazuje „Naposledy: Jana dnes 7:40“ + tlačítko + odkaz „Nastavit, kolikrát denně krmíte ›“.

Je se mnou, varianty řádku:
```
│ 🐕 Bára je u: Jana · do ne 23. 11.   │  ostatní (text --text2, bez tlačítka „Vrátit“, s „Vzít k sobě“ jako .pet-link)
│ 🐕 Bára je u tebe do ne 23. 11.      │  držitel
│              [ Vrátit domů ]         │
```
Rod: pole `sex` v 5.16 není → neutrálně **„Mám u sebe“** a „Bára je u: Jana“ (2. pád jména člena neumíme).

### 5.2 Karta na Domů: PŘED / PO

**Před**
```
┌ 🐾 Mazlíčci                       → ┐
│ 🐕 Bára · 🪱 Odčervení · zítra       │
│ 🐕 Bára · 🥣 granule na 3 dny   [🛒] │
└──────────────────────────────────────┘
```
**Po** (řádek krmení vždy první, když má mazlíček `feed.times` nebo dnes záznam)
```
┌ 🐾 Mazlíčci                       → ┐
│ 🐕 Bára · ✓ ráno Jana 7:40      [🍖] │  🍖 = 44×44, .pet-dw-cart styl, aria-label „Nakrmeno – Bára“
│ 🐈 Mourek · večer zatím ne      [🍖] │  nenakrmený aktuální slot: tlačítko se zvýrazněným okrajem --accent
│ 🐕 Bára · 🪱 Odčervení · zítra       │
└──────────────────────────────────────┘
```
Max 3 řádky jako dnes: řádky krmení mají přednost před péčí za víc než 1 den. Klik na tlačítko `event.stopPropagation()` (jako 🛒), stejný tok jako §3.2 včetně dotazu a Zpět.

### 5.3 Okno „Krmení – Bára“ (#m-petfeed)

```
┌──────────────────────────────────────┐
│ 🍖 Krmení – Bára                     │  .mtitle
│ Kolikrát denně krmíte?               │
│ [ 1× ][ 2× ][ 3× ][ 4× ][ Volně ]    │  .seg seg--block, 44 px; Volně = bez plánu (times: [])
│ ☀️ Ráno         [ 07:30 ]            │  time picker appky; popisek slotu se mění podle času
│ 🌙 Večer        [ 18:00 ]            │
│ ─────────────────────────────────    │
│ [✓] Připomínat mi krmení             │  osobní (index petFeed.on); ve skupině pod tím hint:
│     Připomínka nepřijde, když už     │  .pet-hint
│     někdo nakrmil.                   │
│ [Zrušit]                  [Uložit]   │  .macts
└──────────────────────────────────────┘
```
Validace: časy unikátní (toast „Dva stejné časy – uprav jeden“), min. 30 min od sebe. Uložení: `updateDoc({'feed.times': times, 'feed.upd': now})` (`log` se nemění) + `petFeedSync`. Ve skupině aktivita 'cal','edit' „🍖 Krmení: Bára 2× denně“ jen při změně počtu.

### 5.4 Jednoduchý režim

- Sekce Krmení na stránce mazlíčka: stejná, jen bez „Krmil/a jsem dřív“ a bez týdenního přehledu (`unl`-styl skrytí). Okno nastavení bez „Volně“.
- Karta Domů: dnes je v jednoduchém režimu prvních 14 dní skrytá. Návrh: **ukázat ji, když má aspoň jeden mazlíček nastavené krmení**, ale jen s řádky krmení (bez péče a granulí). Je to jedno tlačítko bez vysvětlování a pro rodinu se psem je to hlavní důvod appku otevírat. (Otázka pro uživatele č. 4.)

### 5.5 Týdenní přehled (<details> „Krmení za poslední týden“)

```
          Ráno   Večer
Dnes       ✓J     ·
Čt 19.     ✓A     ✓J
St 18.     ✓J     ✓✓  ← dvakrát (podbarvení --card2 + text „2×“, ne jen barva)
Út 17.     ✓A     –   ← vynecháno
…
```
Buňka = iniciála krmícího (`aria-label` „Jana, 7:40“). Klepnutí na buňku = tooltip/řádek s časy. 7 řádků, data 14 dní drží rezervu pro „minulý týden“ ve fázi 2. Pro osobního mazlíčka jen ✓ bez iniciál.

### 5.6 Notifikace a Nastavení

- Nastavení → Upozornění: nový řádek „🍖 Krmení mazlíčka“ (`ns.feed`, výchozí zapnuto), jen se zapnutým modulem Mazlíček.
- Nastavení → Upozornění ze skupiny: nový řádek „🍖 Když jiný nakrmí“ se třemi volbami **Jen místo připomínky / Vždy / Nikdy** (`groupNotif.feed`: `rem` / `instant` / `off`). Jen když je ve skupině sdílený mazlíček.

---

## 6. Texty (cs / en)

Tykání, jména mazlíčků v 1. pádu (bez skloňování). `{name}` mazlíček, `{who}` člen, `{time}` HH:MM, `{date}` datum.

| Klíč | cs | en |
|---|---|---|
| pet.feed.t | Krmení | Feeding |
| pet.feed.btn | 🍖 Nakrmeno | 🍖 Fed |
| pet.feed.btnAria | Nakrmeno – {name} | Mark {name} as fed |
| pet.feed.earlier | Krmil jsem dřív › / Krmila jsem dřív › (podle `prof.gender`) | I fed earlier › |
| pet.feed.nowOk | ✓ Na teď je nakrmeno | ✓ Fed for now |
| pet.feed.notYet | zatím ne | not yet |
| pet.feed.byAt | ✓ {who} · {time} | ✓ {who} · {time} |
| pet.feed.byMe | ✓ ty · {time} | ✓ you · {time} |
| pet.feed.last | Naposledy: {who} {when} {time} | Last fed: {who} {when} {time} |
| pet.feed.setup | Nastavit, kolikrát denně krmíte › | Set how often you feed › |
| pet.feed.perDay | {n}× denně › | {n}× a day › |
| pet.feed.slot.am / noon / pm / eve | Ráno / V poledne / Odpoledne / Večer | Morning / Noon / Afternoon / Evening |
| pet.feed.toast | 🍖 Zapsáno: {name} v {time} | 🍖 Logged: {name} at {time} |
| pet.feed.undone | Krmení smazáno | Feeding removed |
| pet.feed.clashQ | {who} už krmil(a) v {time}. Opravdu znovu? (tvar podle `g` záznamu: krmil / krmila) | {who} already fed at {time}. Feed again? |
| pet.feed.clashMe | Už jsi krmil(a) v {time}. Opravdu znovu? (tvar podle `prof.gender`) | You already fed at {time}. Feed again? |
| pet.feed.clashRace | Právě teď nakrmil(a) {who} ({time}). Přesto zapsat? (tvar podle `g`) | {who} just fed ({time}). Log it anyway? |
| pet.feed.clashNo | Nekrmit | Don’t feed |
| pet.feed.clashYes | Ano, znovu | Yes, again |
| pet.feed.offline | Zapíšu, až budeš online. Ostatní to zatím neuvidí. | I’ll save it when you’re online. Others won’t see it yet. |
| pet.feed.delQ | Smazat krmení v {time}? | Delete feeding at {time}? |
| pet.feed.sheetT | 🍖 Krmení – {name} | 🍖 Feeding – {name} |
| pet.feed.howMany | Kolikrát denně krmíte? | How many times a day? |
| pet.feed.free | Volně | No schedule |
| pet.feed.remind | Připomínat mi krmení | Remind me to feed |
| pet.feed.remindHint | Připomínka nepřijde, když už někdo nakrmil. | No reminder if someone already fed. |
| pet.feed.dupTime | Dva stejné časy – uprav jeden. | Two identical times – change one. |
| pet.feed.gap | Časy krmení musí být aspoň 30 min od sebe. | Feeding times must be at least 30 min apart. |
| pet.feed.week | Krmení za poslední týden | Feeding this past week |
| pet.feed.twice | 2× | 2× |
| pet.with.home | 🏠 Je doma (u všech) | 🏠 At home (with everyone) |
| pet.with.take | Mám u sebe | I have them |
| pet.with.sheetT | {name} je u mě… | {name} is with me… |
| pet.with.sun | Do neděle | Until Sunday |
| pet.with.date | Do data… | Until… |
| pet.with.forever | Dokud to nevypnu | Until I turn it off |
| pet.with.hint | Připomínky krmení budou chodit jen tobě. | Feeding reminders will go only to you. |
| pet.with.atOther | {name} je u: {who} · do {date} (bez data jen „{name} je u: {who}“) | {name} is with {who} until {date} |
| pet.with.atMe | {name} je u tebe do {date} | {name} is with you until {date} |
| pet.with.back | Vrátit domů | Back home |
| pet.with.backDone | {name} je zase doma, připomínky dostanou všichni. | {name} is back home, everyone gets reminders again. |
| pet.with.takeQ | {name} je teď u: {who}. Vzít k sobě? | {name} is with {who} now. Take over? |
| set.notif.feed | 🍖 Krmení mazlíčka | 🍖 Pet feeding |
| gn.pref.feed | 🍖 Když jiný nakrmí | 🍖 When someone else feeds |
| gn.pref.feed.rem / instant / off | Jen místo připomínky / Vždy / Nikdy | Only instead of a reminder / Always / Never |
| aip.ctx.pet.feed | krmení dnes {done}/{total}, naposledy {time} ({who}){with} | fed today {done}/{total}, last {time} ({who}){with} |

Pozn.: „u {who}“ vyžaduje 2. pád jména člena („u Jany“), ten neumíme. Proto tvar **„je u: Jana“** v UI, v pushi „Bára je u tebe“ (to jde vždy).

Server (`functions/i18n-server.js`):

| Klíč | cs | en |
|---|---|---|
| feed.rem.t | 🍖 Krmení: {pet} | 🍖 Feeding: {pet} |
| feed.rem.b | Je čas – {slot} {time} | Time to feed – {slot} {time} |
| feed.rem.bGrp | Je čas – {slot} {time} · zatím nikdo nekrmil | Time to feed – {slot} {time} · nobody has fed yet |
| feed.rem.bWith | Je čas – {slot} {time} · {pet} je u tebe | Time to feed – {slot} {time} · {pet} is with you |
| feed.done.t | 🍖 {pet}: nakrmeno | 🍖 {pet}: fed |
| feed.done.b | {who} krmil(a) v {time} (tvar podle `g`, jako `gn.act.*`) | {who} fed at {time} |
| feed.slot.am / noon / pm / eve | ráno / v poledne / odpoledne / večer | morning / noon / afternoon / evening |
| gn.feed.line | nakrmil(a): {pet} (tvar podle `g`) | fed: {pet} |

---

## 7. Offline

- Nakrmeno offline: zápis `arrayUnion` (dorazí po připojení), toast `pet.feed.offline`. Kontrola dvojího krmení jen proti lokálním datům. Aktivita skupiny se zapíše po připojení (Firestore fronta), server ji pošle s reálným `ts`.
- Ořez historie offline neproběhne (arrayUnion), udělá ho další online zápis.
- Je se mnou a nastavení časů offline: `updateDoc` do fronty, jako zbytek modulu. Sdílení/vrácení mazlíčka offline dál zakázané (beze změny).
- Pokud po připojení vznikne dvojí záznam ve stejném slotu, přehled ho ukáže jako „2×“ (§5.5) – žádné automatické mazání.

---

## 8. Edge cases

1. **Dva lidé naráz (souběh)**: transakce čte čerstvý `feed.log`; když mezitím přibyl cizí záznam ve stejném slotu nebo < 2 min, nezapíše a ukáže `clashRace` s jménem. Druhý člověk rozhoduje vědomě. `maxAttempts: 3` jako `petDoneWrite`.
2. **Já sám dvakrát** (dvě zařízení / dvojí klepnutí): pojistka 1,5 s + stejný dotaz s `clashMe`.
3. **Krmení přes půlnoc / pozdě**: slot podle místního času zápisu; krmení v 0:30 patří k dnešnímu prvnímu slotu. Připomínka 23:58 → běh 0:00 bere den jako včera (vzor `mealRemindDecide`).
4. **Různá časová pásma členů**: `d` a `t` jsou v čase toho, kdo krmil; server porovnává se dnem příjemce. Rodina v jednom pásmu = bez problému. Rozdílná pásma: ve vzácném případě přijde připomínka navíc. Přijatelné, poznámka do backlogu.
5. **Změna časů krmení**: staré záznamy mají původní `s`; přehled je řadí podle `t` do sloupců nových časů (nejbližší slot). Index u ostatních členů je zastaralý, dokud neotevřou appku; server pozná nesoulad (`feed.times[s] !== time`) a připomínku nepošle. Nové časy jim začnou chodit po otevření appky (stejné omezení jako u `taskRem`). Uvést v hintu okna? Ne, zbytečně technické.
6. **Odebraný člen**: jeho klient ztratí přístup (listener error → mazlíček zmizí, `petFeedSync` smaže klíče). Když appku neotevře, server při první splatné připomínce ověří `fam.members[uid]` a klíč smaže. Jeho záznamy krmení zůstanou v historii se jménem z `n`. Byl-li držitelem (`with.uid`), `with` se bere jako neplatné → připomínky zase všem; první klient ho vynuluje.
7. **Odchod ze skupiny s kopií mazlíčka** (`copyGroupToPersonal`): kopie dostane `feed.times`, **ne** `log` a `with` (jsou to záznamy skupiny). Nové ID → index se přepíše.
8. **Sdílení / vrácení mazlíčka**: ID zůstává, mění se `g` v indexu (sync). `with` se při vrácení k sobě maže, `log` zůstává.
9. **Změna kódu skupiny** (`rotateGroupCode`): kolekce se přesunou, index má starý `g` → server dokument nenajde a klíč smaže; po otevření appky se znovu zapíše s novým kódem. Stejně jako `taskRem` dnes. Volitelně: `rotateGroupCode` přepíše `petFeed.*.g` členům (fáze 2).
10. **Člen se starší verzí (5.16)**: Nakrmeno nevidí; `petNorm` neznámá pole ignoruje, `updateDoc` je nesmaže. **Ale** sdílení/vrácení mazlíčka a Zpět po smazání ve 5.16 zapisují celý dokument přes `petDataOut` → `feed` a `with` zmizí. Riziko malé (akce jsou vzácné, appka se aktualizuje sama přes network-first SW). Do CHANGELOG nic, do backlogu poznámka.
11. **Smazání mazlíčka**: index se uklidí sync; Zpět vrátí i `feed` a `with` (nový `petDataOut`).
12. **Modul Mazlíček vypnutý**: index se smaže, server navíc kontroluje `prof.modules.includes('pets')`. Člen bez modulu připomínky ani potvrzení nedostane (u `rem` preference nemá `on` v indexu).
13. **Skupina bez sdíleného kalendáře** (vypnul ho správce po sdílení mazlíčka): aktivita `cal` se nezapíše (`groupModShared`), server připomínky ve skupině nepošle (`fam.shareCal`). Stránka mazlíčka už dnes ukazuje `pet.grpNoCal`; doplnit do textu „…ani připomínky krmení“.
14. **Mazlíček jen u mě, ale jsem ve skupině**: chová se jako dnes, „Je se mnou“ se neukáže, aktivita se nezapisuje.
15. **Víc mazlíčků**: každý má vlastní plán i tlačítko. Hromadné „Nakrmit všechny“ ne (dvě kočky se často krmí zvlášť); ve fázi 2 podle zpětné vazby.
16. **Zpět po 6 s neproběhlo a uživatel se spletl**: smaže svůj záznam v sekci Dnes (§3.2).
17. **Do neděle v neděli**: `until` = dnešek (platí do půlnoci). Popisek v sheetu ukáže konkrétní datum („Do neděle 23. 11.“), ať je jasné, co se stane.
18. **Prošlé `with`**: připomínky jdou všem hned další slot, i když dokument ještě nikdo neuklidil.

---

## 9. AI kontext

Dává smysl jen krátce (otázky typu „Krmil už někdo Báru?“, „Kdo má psa o víkendu?“). Do řádku mazlíčka v `aip.ctx.s.pets` přidat jen u mazlíčka s plánem nebo dnešním záznamem:

```
- Bára (pes, labrador, 5 let) · krmení dnes 1/2, naposledy 7:40 (Jana) · je u: Jana do 2026-11-23 · …
```
Bez historie a bez časů ostatních dní. Jména členů už kontext obsahuje (autor sdílených událostí). Limit ~7000 znaků: +~60 znaků na mazlíčka, max 4 mazlíčci.

---

## 10. Privacy dopad

Nová data: kdo a kdy krmil (14 dní), u koho mazlíček právě je a do kdy, plán časů krmení, index připomínek v profilu.
- Ve skupině je vidí všichni členové (jako zbytek mazlíčka). Prozrazuje denní rytmus člena (kdy je doma) a krátkodobě, kdo má psa u sebe. Neukládá se poloha.
- Server čte index z profilu (už načteného) a v čase krmení dokument mazlíčka; text pushe se nikam neukládá ani neloguje (jako dnes).
- `privacy.html` a `privacy-en.html` doplnit:
  - bod Mazlíček (ř. ~63): „…plán a historie krmení (časy krmení, kdo a kdy krmil, posledních 14 dní) a informace, u kterého člena skupiny mazlíček právě je a do kdy.“
  - bod 5 skupiny (ř. ~98): „…včetně historie krmení se jmény členů, kteří krmili.“
  - bod notifikace (ř. ~128): „Pro připomínky krmení čte seznam nastavených časů krmení z profilu (`petFeed`, bez jména mazlíčka); dokument mazlíčka (jméno, časy, záznamy krmení, u koho je) přečte až v čase krmení. Neplatný záznam (smazaný mazlíček, odchod ze skupiny) z profilu smaže.“
  - AI (ř. ~83): „…mazlíčci (… stav krmení dnes a u koho je)“.
- Export dat: `pets` už je v exportu, nová pole jdou s ním. `petFeed` je v profilu (export profilu ho obsahuje).
- Smazání účtu: `petFeed` v profilu se smaže s účtem; záznamy krmení ve skupině zůstanou se jménem (`n`) jako ostatní příspěvky ve skupině (již popsáno v bodě 11, doplnit „záznamy krmení“ do výčtu).

---

## 11. Odhad rozsahu

| Část | Odhad |
|---|---|
| `app.js` – model (`petNorm`, `petDataOut`, `feedSlot`, `feedClash`, ořez) | ~90 řádků |
| `app.js` – zápis (transakce, offline, Zpět, smazání, „dřív“), aktivita, `gaKey` | ~130 |
| `app.js` – UI (sekce Krmení, okno nastavení, Je se mnou sheet, týdenní přehled, karta Domů, jednoduchý režim) | ~200 |
| `app.js` – `petFeedSync` (index), Nastavení (ns.feed, groupNotif.feed), feed skupiny, AI kontext, CHANGELOG | ~90 |
| `style.css` | ~60 řádků (`pet-feed-*`) |
| i18n | ~55 klíčů na jazyk (cs, en) |
| `functions/index.js` | ~110 řádků (připomínky ~70, potvrzení ve `groupNotifs` ~40) + 12 klíčů `i18n-server.js` |
| privacy cs/en | 4 odstavce |
| `sw.js` | jen `CACHE` bump |
| Pravidla, indexy | beze změny |

Celkem ~520 řádků JS klienta, ~110 serveru. Jeden koder, 1 verze (5.17). Testy: simulace `feedSlot`/`feedClash` v node (1×–4×, hranice, půlnoc, < 60 min), simulace serverového rozhodnutí (držitel, prošlé `with`, zastaralý index, odebraný člen), `node --check`, ci-check.

---

## 12. Návrh CHANGELOG (5.17)

cs:
```
'🍖 Krmení mazlíčka: tlačítko Nakrmeno u mazlíčka i na Domů, celá rodina hned vidí, kdo a kdy krmil',
'⏰ Nastav, kolikrát denně krmíte, a appka připomene – jen když ještě nikdo nenakrmil',
'🛑 Pojistka proti dvojímu krmení: když už někdo krmil, appka se zeptá, jestli opravdu znovu',
'🐕 „Mám u sebe“: na víkend nebo do data si vezmeš mazlíčka k sobě a připomínky krmení chodí jen tobě'
```
en:
```
'🍖 Pet feeding: a Fed button on the pet page and on Home, the whole family sees who fed and when',
'⏰ Set how many times a day you feed and get a reminder – only if nobody has fed yet',
'🛑 Double-feeding guard: if someone already fed, the app asks whether to feed again',
'🐕 “I have them”: take your pet for the weekend or until a date and feeding reminders go only to you'
```

---

## 13. Otázky pro uživatele (doporučení = výchozí volba)

1. **Push, když nakrmí někdo jiný** – a) jen místo připomínky (tiše ji přepíše na „Bára: nakrmeno“) **← doporučuji**; b) vždy; c) nikdy. Každý si to stejně může změnit v Nastavení.
2. **Okno pro dotaz „Opravdu znovu?“** – a) podle počtu krmení (polovina mezi časy, u 1× celý den) + vždy, když se krmilo před méně než hodinou **← doporučuji**; b) pevně 3 hodiny.
3. **Historie krmení** – a) 14 dní (týdenní přehled) **← doporučuji**; b) 30 dní (dokument mazlíčka bude větší, přehled stejně ukáže týden).
4. **Jednoduchý režim** – a) karta mazlíčka na Domů se ukáže hned, když je nastavené krmení (jen řádky krmení) **← doporučuji**; b) jako dnes až po 14 dnech.
5. **Připomínky krmení ve skupině** – a) dostane je každý člen se zapnutým modulem Mazlíček, kdo si je nevypne **← doporučuji**; b) jen ten, kdo krmení nastavil, ostatní si je zapnou sami.
6. **Tlačítko Nakrmeno přímo v notifikaci** – a) až ve fázi 2 (potřebuje novou serverovou funkci) **← doporučuji**; b) hned teď (+~1 den práce).
