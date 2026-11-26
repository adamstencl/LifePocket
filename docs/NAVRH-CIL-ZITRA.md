# Návrh: Cíl na zítra (večerní chvilka)

Základ: `main` 14170e2, verze 5.17.1, `CACHE` v123. Cílová verze 5.18.0.
Autor: ux-designer. Stav: návrh k předání koderovi, kód se zatím nemění.
Navazuje na `docs/NAVRH-UKOLY.md` (kap. 5, sloučení Hlavního úkolu do Úkolů) a sekci „✅ ÚKOLY (5.15)“ v app.js.

## 0. Rozhodnutí v kostce

| Otázka | Rozhodnutí |
|---|---|
| Co je cíl dne | **Úkol s 🎯 (`star`) na daný den v osobním seznamu.** Žádný nový druh záznamu, žádná kopie textu. Hvězda 🎯 se v UI přejmenuje z „Hlavní úkol dne“ na „🎯 Cíl dne“. |
| Kolik cílů na den | Jeden osobní (jako dnes hvězda: `tkUnstar`). |
| Kde se cíl ukazuje | Nová karta Domů `goal` (🎯 Cíl dne) **nad** kartou Úkoly, nahoře na Domů. Ve dne „🎯 Dnešní cíl“, večer navíc „🌙 Co chceš zítra dokázat?“. V kartě Úkoly zůstává cíl jako řádek s 🎯 (je to pořád úkol). |
| Hranice dne | Logický den začíná ve **04:00**. Mezi 00:00 a 03:59 je večer pořád „dnešní večer“ a „zítra“ znamená kalendářní dnešek. |
| Večerní karta | Od `goalEve.t` (výchozí 18:00, volba 15:00–23:30) do 03:59. |
| Připomínka | Volitelná, výchozí vypnutá. Push přes cron `sendScheduledNotifications` v čase `goalEve.pt` (výchozí 21:00). **0 čtení navíc na běh** (rozhoduje se jen z profilu). Když ve stejnou minutu odchází večerní shrnutí návyků, přidá se k němu jedna věta místo druhé notifikace. |
| Ranní souhrn | Když existuje dnešní cíl, ranní push začíná „🎯 Dnešní cíl: …“. Text se čte z checklistu jen v ranní minutu (1 čtení na uživatele s cílem za den). Bez návyků přijde samostatný ranní push s cílem. |
| Tečky a série | Z nového indexu `goalLog` v profilu (datum → nastaveno / splněno, bez textu). Zobrazení volitelné, výchozí zapnuto od druhého nastaveného cíle. |
| Bez modulu Úkoly | Funguje. Data leží v checklistu stejně jako dnes u karty Úkoly (seznam „Úkoly“ se založí sám, nikde se nemusí ukazovat). |
| Skupiny | Cíl je vždy osobní. Nikdy se nezakládá ve skupinovém ani do skupiny sdíleném seznamu; 🎯 u položek skupinových seznamů se od 5.18 nenabízí. |
| Pravidla Firestore | **Beze změny** (vše v `users/{uid}/**`). Žádné nové indexy, žádná nová Cloud Function. |

---

## 1. Obrazovky (mobil 390 px)

Karta má šířku 358 px (vnitřek 326 px), styl `.dw` jako ostatní karty. Všechny dotykové plochy min. 44×44 px. Pole je jednořádkové `input`, `maxlength="120"` (cíl má být krátký; úkol jinak unese 500).

### 1.1 Domů ve dne – před / po

**Před (5.17.1)** – cíl je jen řádek uprostřed karty Úkoly:
```
┌──────────────────────────────────────┐
│ ✅ ÚKOLY                 1/4 dnes  → │
│ [ Přidej úkol… třeba „zítra“   ] [＋]│
│ DNES                                 │
│ [ ] 🎯 Dokončit prezentaci           │
│ [ ] Koupit žárovky          ⏰ 18:00 │
│ …                                    │
└──────────────────────────────────────┘
```

**Po (5.18.0)** – cíl má vlastní místo nahoře (stav A):
```
┌──────────────────────────────────────┐
│ 🎯 DNEŠNÍ CÍL                     ⋯  │  ← ⋯ = menu karty (1.6)
│ ┌──┐                                 │
│ │☐ │  Dokončit prezentaci            │  ← čtvereček 44×44 (jako .tk-chk), text 17 px tučně
│ └──┘                                 │     klepnutí na text = list úpravy úkolu (#m-task)
│ Po Út St Čt Pá So Ne     ⚡ 3 dny    │  ← tečky týdne + série (1.5), volitelné
│ ●  ●  ○  ◉  ·  ·  ·                  │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ✅ ÚKOLY                 1/4 dnes  → │  ← beze změny; cíl tu zůstává jako řádek s 🎯
│ …                                    │
└──────────────────────────────────────┘
```

Splněno (stav A✓):
```
┌──────────────────────────────────────┐
│ 🎯 DNEŠNÍ CÍL                     ⋯  │
│ [✓]  ~~Dokončit prezentaci~~         │  ← zelený čtvereček (--green), text --text3
│ Máš to! 🎉                           │  ← jednou, krátce; bez konfet
│ ●  ●  ○  ●  ·  ·  ·      ⚡ 4 dny    │
└──────────────────────────────────────┘
```
- Odškrtnutí volá stávající `tkToggle(l, id)`: jedno místo pravdy pro kartu Cíl, kartu Úkoly, checklist i kalendář.
- Hotový cíl se nezahazuje, karta zůstává do konce logického dne (pak ji vystřídá večerní stav nebo nic).
- **Ve dne bez cíle se karta neukazuje** (žádné připomínání toho, co člověk nenastavil). Výjimka: otázka Q4.

### 1.2 Večer – zítřejší cíl ještě není (stav C)

```
┌──────────────────────────────────────┐
│ 🌙 CO CHCEŠ ZÍTRA DOKÁZAT?        ⋯  │
│ Jedna věc, která zítřek udělá        │  ← --text2, 14 px
│ dobrým dnem.                         │
│ ┌──────────────────────────────┐ ┌──┐│
│ │ Třeba: Dokončit prezentaci   │ │✓ ││  ← Enter nebo ✓ = uložit; prázdné pole = ✓ neaktivní
│ └──────────────────────────────┘ └──┘│
│ Nebo vyber z úkolů na zítra:         │  ← jen když má na zítra úkoly bez 🎯
│ (Vyzvednout balík) (Zavolat do školy)│  ← max. 3 čipy, klepnutí = dá mu 🎯
│ ─────────────────────────────────────│
│ Dnes: [☐] Dokončit prezentaci        │  ← jen když dnešní cíl existuje a není hotový
│                          (Dnes ne)   │  ← skryje kartu do zítřejšího večera
└──────────────────────────────────────┘
```
- Pole nemá rozpoznávání data (`parseTaskText` se nevolá): text se uloží doslova, termín je vždy „zítra“ podle 0.4.
- „Dnes:“ řádek dává možnost večer odškrtnout dnešek, bez otevírání dalších obrazovek. Hotový dnešek se ukáže jen jako „Dnes: ✓ Dokončit prezentaci“ šedě.
- „Dnes ne“ je textové tlačítko (44 px výška), ukládá `lp_goal_skip = <logický den>` (localStorage, jen pohodlí v zařízení). Na jiném zařízení se karta ukáže dál; to je v pořádku.

### 1.3 Večer – po uložení (stav D)

```
┌──────────────────────────────────────┐
│ 🌙 ZÍTRA                          ⋯  │
│ 🎯 Dokončit prezentaci               │  ← 17 px tučně
│ Uloženo. Ráno ti to připomenu ☀️     │  ← s pushem; bez něj: „Uloženo. Ráno to najdeš tady.“
│ [ ✏️ Upravit ]                       │  ← otevře pole s textem (stav C s předvyplněním)
│ ─────────────────────────────────────│
│ 🔔 Připomínat mi to každý večer?     │  ← jen jednou po prvním uložení (1.4)
│ [ Ano, ve 21:00 ]   [ Ne, díky ]     │
└──────────────────────────────────────┘
```
- Po uložení toast se Zpět není potřeba (karta sama ukazuje výsledek a „Upravit“).
- „Upravit“ mění **text téže položky** (`clOps.set(id, {text})`), nové id nevzniká.
- Smazání textu v úpravě a ✓ = cíl zrušit: položka se smaže (byla založená kartou) nebo jen ztratí 🎯 (když vznikla v Úkolech, viz 2.4). Toast „Cíl na zítra zrušen“ se Zpět (`clUndoNote`).
- Stav D zůstává do 03:59; ráno ho vystřídá stav A.

### 1.4 Nabídka připomínky (jednou)

Po **prvním** uloženém cíli se ve stavu D ukáže řádek „🔔 Připomínat mi to každý večer?“:
- „Ano, ve 21:00“ → `goalEve.push = true`, `goalEve.asked = 1`, a když notifikace nejsou povolené, `notifAskNow('goal')` (stávající fronta oken, `whenUiFree`). Na iPhonu mimo plochu stávající nápověda k přidání na plochu.
- „Ne, díky“ → `goalEve.asked = 1`. Zapnout jde kdykoli v ⋯ nebo v Nastavení.

### 1.5 Tečky týdne a série

```
Po Út St Čt Pá So Ne     ⚡ 4 dny
●  ●  ○  ◉  ·  ·  ·
```
| Značka | Význam | Styl | Čtečka |
|---|---|---|---|
| ● | cíl splněný | `--green`, 10 px | „pondělí: splněno“ |
| ○ | cíl nastavený, nesplněný | obrys 2 px `--text3` | „úterý: nesplněno“ |
| ◉ | dnešek (nastavený, ještě běží) | obrys `--accent` | „dnes: čeká“ |
| · | bez cíle / budoucí den | `--border` | „středa: bez cíle“ |

- Celý řádek je jeden prvek `role="img"` s `aria-label` složeným z výše uvedeného (ne 7 fokusovatelných bodů).
- Série = počet po sobě jdoucích **splněných** cílů do včerejška, plus dnešek, když je splněný. Den bez cíle nebo nesplněný sérii ukončí. Nesplněný dnešek sérii neruší, dokud den neskončí.
- Série se ukazuje od 2 dnů („⚡ 2 dny“), pod tím nic. Žádné texty typu „přišel/a jsi o sérii“.
- Tečky a série se ukazují, když `goalEve.dots !== false` a `goalLog` má aspoň 2 záznamy (nováček neuvidí řadu prázdných teček).
- Data: `goalLog` (3.2), ne historie checklistu (hotové položky lze smazat).

### 1.6 Menu karty ⋯ (spodní list, `.moverlay`)

```
┌──────────────────────────────────────┐
│ 🎯 Cíl dne                        ✕  │
│ 🌙 Večerní otázka od   [ 18:00 ]     │  ← data-time-picker, 15:00–23:30
│ 🔔 Večerní připomínka   [──○  ]      │
│    Ve 21:00 se zeptám na zítřek.     │  ← čas připomínky: [ 21:00 ] (jen když je zapnuto)
│ ⚡ Ukazovat tečky a sérii [  ●──]    │
│ 🙈 Schovat kartu z Domů              │  ← stejné jako editor Domů (dashLayout.hidden)
└──────────────────────────────────────┘
```
Totéž je v Nastavení → Upozornění (1.8), aby to šlo najít i bez karty.

### 1.7 Notifikace

Večerní připomínka (`tag: 'goal-eve'`, `data: {open: 'goal'}`):
```
┌──────────────────────────────────────┐
│ LifePocket                           │
│ Co chceš zítra dokázat? 🌙           │
│ Napiš si jednu věc na zítřek.        │
└──────────────────────────────────────┘
```
Spojená s večerním shrnutím (stejná minuta, `tag: 'evening'`): tělo shrnutí + „ 🌙 Co chceš zítra dokázat?“, `data.open: 'goal'`.

Ranní souhrn (`tag: 'morning'`), s návyky:
```
│ ☀️ Dobré ráno, Adame!                │
│ 🎯 Dnešní cíl: Dokončit prezentaci.  │
│ Dnes tě čekají 4 návyky.             │
```
Bez návyků (nebo modul Návyky vypnutý), ranní přehled zapnutý: titulek „☀️ Dobré ráno, Adame!“, tělo „🎯 Dnešní cíl: Dokončit prezentaci. Držím palce!“, `data.open: 'goal'`.

Klepnutí s `open: 'goal'` → `sp('dashboard')`, posun na `#dw-goal`, ve stavu C fokus do pole (na iOS se klávesnice bez gesta neotevře; pak jen posun).

### 1.8 Nastavení → Upozornění (index.html, `#notif-toggles`)

Nový řádek za „✅ Připomínky úkolů“:
```
☐ 🌙 Večer se zeptat na cíl na zítra
```
a v části „⏰ Časy připomínek“ třetí pole „🌙 Cíl na zítra“ (čas `goalEve.pt`), viditelné jen se zapnutou volbou. Čas zobrazení karty (`goalEve.t`) je jen v ⋯ karty (s notifikacemi nesouvisí).

### 1.9 List úpravy úkolu (`#m-task`) – změna textu

- Přepínač „🎯 Hlavní úkol dne“ → „🎯 Cíl dne“, pod ním 13 px `--text2`: „Jen jeden na den. Ukáže se nahoře na Domů.“
- U položky ze skupinového nebo do skupiny sdíleného seznamu se přepínač **neukazuje**; místo něj (jen když už položka hvězdu má ze starší verze) text „🎯 Cíl dne je osobní. Tady zůstane jen jako značka.“ a přepínač jen pro vypnutí.

### 1.10 Barvy a styl (jen tokeny, světlý i tmavý motiv)

```css
.gl-card{cursor:default}
.gl-card.eve{border-left:3px solid var(--blue)}              /* večer: odlišení bez nového pozadí */
.gl-card.day{border-left:3px solid var(--accent)}
.gl-txt{font-size:17px;font-weight:700;color:var(--text);overflow-wrap:anywhere}
.gl-sub{font-size:14px;color:var(--text2);margin:2px 0 10px}
.gl-dots{display:grid;grid-template-columns:repeat(7,1fr) auto;gap:2px;align-items:center;font-size:11px;color:var(--text3)}
.gl-dot{width:10px;height:10px;border-radius:50%;border:2px solid var(--border);justify-self:center}
.gl-dot.ok{background:var(--green);border-color:var(--green)}
.gl-dot.set{border-color:var(--text3)}
.gl-dot.now{border-color:var(--accent)}
.gl-skip{min-height:44px;background:none;border:none;color:var(--text3);font-size:14px}
```
Čtvereček, pole a čipy přebírají `.tk-chk`, `.tk-box`, `.finp`, `.tk-addbtn`, `.tk-chip`. Žádná animace kromě stávajícího `tk-row.flash` (respektuje `prefers-reduced-motion`).

---

## 2. Toky

### 2.1 Logický den a okno
```js
// 04:00 = začátek dne pro cíl (po půlnoci je pořád „dnešní večer“)
function glDay(d = new Date()) { const x = new Date(d); if (x.getHours() < 4) x.setDate(x.getDate() - 1); return toDS(x); }
const glTmrw = () => addDays(glDay(), 1);
function glIsEve(now = new Date()) {          // od goalEve.t do 03:59
  const [h, m] = (TP_RE.test(prof?.goalEve?.t || '') ? prof.goalEve.t : '18:00').split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 240 || mins >= h * 60 + m;
}
```
Karta se při `visibilitychange` / návratu na Domů a v minutovém intervalu Domů překreslí jen přes `glDashRefresh()` (vzor `tkDashRefresh`, rozepsaný text zůstane).

### 2.2 Uložení cíle z večerní karty
1. `glSave()`: text `cutName(trim, 120)`, prázdný → nic.
2. `D = glTmrw()`. Hledá se existující osobní cíl na D (`glFind(D)`, 3.4).
   - existuje a uživatel je v „Upravit“ → `clOps.set(id, {text})`.
   - existuje a uživatel píše nový (nemělo by nastat, stav C se ukazuje jen bez cíle; ochrana pro dvě zařízení) → stejné jako „Upravit“ (přepíše text, žádná druhá 🎯).
   - neexistuje → nová položka `{id: 'gl' + D.replace(/-/g,''), text, done: false, due: D, star: true}` do `glListId()` přes `tkAddItems([item], listId, true)`. Deterministické id = dvě zařízení najednou nevytvoří duplicitu (stejný princip jako `fz` v `tkMigrateFocus`). Když id `glYYYYMMDD` už v seznamu je (cíl založený, pak zrušený jen odhvězdičkováním), přepíše se jeho text a vrátí `star: true`.
3. `tkUnstar(D, list, id)` – jen osobní seznamy (2.6).
4. `glLogSet(D, 1)` a `glPtrSet(D, list, id)` jedním `updateDoc` profilu (3.2).
5. Karta → stav D, `tkViewsRefresh()`.

### 2.3 Výběr z úkolů na zítra (čip)
Klepnutí na čip = `clOps.set(id, {star: true})` u té položky + `tkUnstar` + `glLogSet` + `glPtrSet`. Text se nekopíruje. Čipy nabízí jen nesplněné úkoly s `due == D` z **osobních** seznamů (bez `gid`).

### 2.4 Když uživatel dá 🎯 jinému úkolu (z Úkolů, checklistu, kalendáře)
- `tkSave` se `star: true` na osobní položce s `due == D` → stávající `tkUnstar` vypne hvězdu původního cíle (původní položka **zůstává jako běžný úkol**, nemaže se ani karta‑založená `gl…`). Navíc `glPtrSet(D, l, id)` a `glLogSet(D, 1 nebo 2 podle done)`.
- Toast (jen když měl den už jiný cíl): „🎯 Cíl na {kdy} je teď: {nový}“ / „🎯 Your goal for {when} is now: {new}“. Bez Zpět (vrátit jde stejným přepínačem).
- Vypnutí 🎯 v úpravě (a žádný jiný cíl ten den) → `glLogDel(D)`, `glPtrSet` vyčistit, pokud ukazoval na tuto položku.
- Změna termínu cíle z D na jiný den → hvězda jde s ním (stávající chování), index: `glLogDel(D)`, `glLogSet(nový, …)`, ukazatel přepsat. Když nový den už cíl má, platí `tkUnstar` (vyhraje právě upravovaný).

### 2.5 Když už úkol s 🎯 na zítra existuje
Večerní karta ho najde (`glFind(glTmrw())`) a rovnou ukáže stav D „🌙 Zítra: …“ s „Upravit“. Nabídka připomínky (1.4) se tu neukazuje, pokud ji uživatel už viděl. Ukazatel a `goalLog` se při tom doplní, když chybí (cíl vznikl v Úkolech na zařízení se starší verzí).

### 2.6 `tkUnstar` jen v osobních seznamech
Dnes vypíná hvězdu ve všech seznamech včetně skupinových (zapisuje do `families/…`, ostatní členové to vidí). Od 5.18: filtr `!e.gid`. Hvězdy ve skupinových seznamech ze starších verzí zůstávají, jen se nepočítají jako cíl.

### 2.7 Odškrtnutí
`tkToggle` beze změny logiky, na konci háček `glOnToggle(listId, item)`: je‑li položka osobní, `star`, `isDS(due)` → `glLogSet(due, done ? 2 : 1)`. Platí z kterékoli obrazovky.

### 2.8 Smazání cíle
`tkDel` (a mazání položek v checklistu včetně „smazat hotové“) u osobní položky se `star` → `glLogDel(due)` jen tehdy, když den nemá jiný cíl a cíl **nebyl splněný** (splněný den v tečkách zůstává, i když si někdo hotové úkoly uklidí). Ukazatel vyčistit.

### 2.9 Nevyplnění
- Večer nic → karta zmizí ve 04:00. Ráno žádná karta, žádný push o cíli, žádné „zapomněl/a jsi“.
- Nesplněný cíl → po skončení dne zůstane v Úkolech jako úkol **po termínu** (stávající sekce „Po termínu“ s „Vše na dnes“). Hvězda přesunem na dnešek zůstane jen tehdy, když dnešek cíl nemá (`tkAllToToday` volá `tkUnstar` jen pro tento případ; jinak se hvězda u přesouvané položky zruší). V tečkách den zůstane ○.
- Push: když uživatel 3 večery po sobě připomínku dostal a cíl nevyplnil, server další připomínky neposílá, dokud cíl znovu nenastaví (klient `goalEve.quiet`; viz 4.2). Do karty ⋯ se pak ukáže věta „Připomínky jsem ztišil, ozvu se zase, až si cíl nastavíš.“

### 2.10 Odhlášení, druhé zařízení, offline
- Vše jde přes `clSave` (offline fronta jako u checklistu) a `updateDoc` profilu. Offline uložený cíl se ukáže hned; ukazatel se dopíše po připojení.
- Dvě zařízení: deterministické id `gl…`, ukazatel „poslední zápis vyhrává“, `goalLog` se srovnává při vykreslení karty z položek v paměti za posledních 7 dní (`glReconcile`, nejvýš 1 zápis za relaci).

---

## 3. Datový model

### 3.1 Položka checklistu
Beze změny. Cíl dne D = osobní položka s `star: true` a `due: D`. Karta zakládá id `gl` + `YYYYMMDD` (platí `TASK_ID_RE`). Pole `goal` se **nepřidává**: kdyby hvězda a „cíl“ byly dvě různé věci, uživatel by je nerozlišil.

### 3.2 Profil `users/{uid}/profile/main` – nová pole
```js
goalEve: {            // nastavení, vše nepovinné
  t: '18:00',         // od kdy se ukazuje večerní otázka (HH:MM, 15:00–23:30)
  push: false,        // večerní připomínka
  pt: '21:00',        // čas připomínky (HH:MM)
  dots: true,         // tečky a série
  asked: 1,           // nabídka připomínky už proběhla
  quiet: 0            // počet po sobě jdoucích připomínek bez nastaveného cíle (píše server)
},
goal: {               // ukazatel na poslední nastavený cíl (dnešní nebo zítřejší), bez textu
  d: '2026-11-27',    // den cíle
  l: 'k3j9…',         // id seznamu (vždy osobní: users/{uid}/checklists/{l})
  id: 'gl20261127'    // id položky
},
goalLog: {            // historie pro tečky a sérii, bez textu, nejvýš 60 dní (starší klíče klient maže)
  '2026-11-25': 2,    // 2 = splněno
  '2026-11-26': 1     // 1 = nastaveno, nesplněno
},
goalList: 'p8x…'      // jen když je seznam Úkoly sdílený do skupiny (3.3)
```
Zápisy přes `updateDoc` s cestou pole (`'goalLog.2026-11-27'`), mazání `deleteField()`. Velikost ~1,5 kB v nejhorším případě; profil čte cron každých 5 min, cena zanedbatelná.

### 3.3 Kam se cíl zakládá (`glListId()`)
1. `tkListId()`, když je to **osobní a nesdílený** seznam (`!clSharedGid(own)` a není `_family`).
2. Jinak `prof.goalList`, když existuje a je osobní.
3. Jinak se založí osobní seznam „🎯 Moje cíle“ / „🎯 My goals“ (`tkCreateList`), id do `prof.goalList`. Týká se jen lidí, kteří si seznam Úkoly sdílí do skupiny.

### 3.4 Hledání cíle (`glFind(ds)`)
`getTasksForDate(ds).filter(e => !e.gid && e.it.star)`; při více (starší data, dvě zařízení) vyhrává ta podle ukazatele `prof.goal`, jinak nejdřív založená. Ostatním se hvězda tiše nevypíná (žádné zápisy při čtení); úprava kterékoli z nich zavolá `tkUnstar`.

### 3.5 localStorage (jen pohodlí)
`lp_goal_skip` – logický den, kdy uživatel klepl „Dnes ne“. Čtení/zápis přes `lsGet`/`lsSave` (try/catch).

### 3.6 Pravidla Firestore
Beze změny. Vše je v `users/{uid}/**` (vlastník). Server zapisuje jen `goalEve.quiet` Admin SDK.

---

## 4. Server (`functions/index.js`, `processUser`)

### 4.1 Ranní souhrn
V bloku „Ranní notifikace“ (`isTimeMatch(h, m, morningTime)`), před výpočtem těla:
```js
let goalTxt = '';
const gp = prof.goal;
if (ns.morningDigest !== false && gp && gp.d === today && TASK_ID_RE.test(gp.l || '') && TASK_ID_RE.test(gp.id || '')) {
  try {
    const ls = await db.doc(`users/${uid}/checklists/${gp.l}`).get();          // 1 čtení, jen v ranní minutu
    const it = ls.exists && Array.isArray(ls.data().items) ? ls.data().items.find(i => i && i.id === gp.id) : null;
    if (it && it.star && it.due === today && !it.done) goalTxt = String(it.text || '').slice(0, 80);
  } catch(e) { console.error(`[LP] cíl ráno uid=${uid}:`, e.code || e.message); }
}
```
- S návyky: `body = [goalTxt ? tS(L,'goal.am', {goal}) : '', …stávající věty].join(' ')`, `data.open` zůstává `habits`, když návyky jsou, jinak `goal`.
- Podmínka odeslání se rozšíří: `(habitsOn && (total > 0 || yd > 0)) || goalTxt`. Bez návyků: titulek `morning.t`, tělo `goal.am` + `goal.am.cheer`.
- Uživatel bez návyků se dosud v ranní minutu vůbec nedotkl čtení; teď 1 čtení jen s nastaveným cílem na dnešek.

### 4.2 Večerní připomínka (0 čtení navíc)
Nový blok za Úkoly:
```js
const ge = prof.goalEve && typeof prof.goalEve === 'object' ? prof.goalEve : null;
const tmrw = addDaysDS(today, 1);
const goalEveDue = !!(ge && ge.push === true && (ge.quiet || 0) < 3
  && isTimeMatch(h, m, HHMM_RE.test(ge.pt || '') ? ge.pt : '21:00')
  && !(prof.goal && prof.goal.d === tmrw));
```
- Když ve stejné minutě odchází večerní shrnutí (`eveningRun` a shrnutí se posílá): k tělu se přidá `tS(L,'goal.eve.add')` a `data.open = 'goal'`; samostatná notifikace se neposílá.
- Jinak samostatně: `push(tS(L,'goal.eve.t'), tS(L,'goal.eve.b'), 'goal-eve', {data: {open: 'goal'}, ttl: 3 * 3600})`.
- Po odeslání `update({'goalEve.quiet': FieldValue.increment(1)})` (jediný zápis, jen v minutu připomínky). Klient při uložení cíle nastaví `goalEve.quiet = 0` ve stejném `updateDoc`.
- Neděle: týdenní souhrn nahrazuje večerní shrnutí (`weeklySent`); připomínka cíle pak jde samostatně (jiný tag, jiný obsah). Když `pt` == čas týdenního souhrnu, přidá se věta k němu.
- Zóna: `zoneNow(prof.tz)` už dává lokální `today`; logický den 04:00 server neřeší (připomínka chodí jen večer).

### 4.3 i18n-server.js
| Klíč | cs | en |
|---|---|---|
| `goal.am` | 🎯 Dnešní cíl: {goal}. | 🎯 Today's goal: {goal}. |
| `goal.am.cheer` | Držím palce! | Fingers crossed! |
| `goal.eve.t` | Co chceš zítra dokázat? 🌙 | What do you want to achieve tomorrow? 🌙 |
| `goal.eve.b` | Napiš si jednu věc na zítřek. | Write down one thing for tomorrow. |
| `goal.eve.add` | 🌙 Co chceš zítra dokázat? | 🌙 What do you want to achieve tomorrow? |

### 4.4 Bez push tokenu
Klient: `scheduleDaily(pt, glLocalEve)` vedle `sendEveningNotif`, jen s otevřenou appkou, stejné podmínky (`push`, `quiet < 3`, zítřek bez cíle). Ranní lokální `sendMorningNotif` dostane stejnou první větu z paměti (bez čtení).

---

## 5. Jednoduchý režim, moduly, Domů

- **Bez modulu Úkoly (checklist)**: cíl funguje. Karta `goal` nepotřebuje `hasMod('checklist')`; volá `tkEnsureSubs()` (odběr checklistu jako karta Úkoly). Položka cíle leží v seznamu Úkoly, který uživatel nemusí nikdy vidět. Klepnutí na text cíle otevře `#m-task` (funguje bez modulu). Karta Úkoly se kvůli cíli **nezapíná**.
- **Plný režim**: `DASH_CARDS` dostane `{id:'goal', em:'🎯'}` na **první** místo. `dashMerged` vloží novou kartu na pozici 0 i do uložených rozvržení. `dashEditAvail`: `case 'goal': return true`. Karta se vykresluje jen ve stavech A/A✓/C/D, jinak prázdný řetězec (editor Domů ji nabízí vždy).
- **Jednoduchý režim**: karta **nezabírá slot** (jako krmení mazlíčka v 5.17) a jde hned pod „Co teď“ / nákup pozvaného. Ukazuje se od 3. dne (`accDay() >= 2`) nebo dřív po `unl('focus')`. Nudge `focus` (dnes „Máš něco na zítra?“) se přepíše na večerní chvilku: zobrazuje se večer, „Ano“ = `unlock('focus')` a fokus do pole karty. Viz Q2.
- **Skupiny**: cíl je osobní vždy. Nezakládá se ve skupinovém seznamu, nepíše `gaCheck` (žádná aktivita do skupiny, žádné „Co je nového“), skupina ho nevidí. Karta nemá emoji skupiny.
- **Kalendář**: beze změny; cíl je úkol, v detailu dne je řádek s 🎯.

---

## 6. AI kontext (`buildChatContext`)
Do sekce ÚKOLY jedna řádka (~120 znaků, v limitu 7000 se nemění priorita): 
`Cíl dne: „Dokončit prezentaci“ (nesplněno). Cíl na zítra: „…“ / nenastaven. Série splněných cílů: 4 dny.`
Text cíle přes `ctxT(…, 60)` (data, ne instrukce). Parťák tak večer může přirozeně navázat („Co si dáš na zítra?“), ale sám nic neukládá. Nové klíče `aip.ctx.goal.*` v `i18n/ai-cs.js` a `ai-en.js`.

---

## 7. Soukromí (`privacy.html`, `privacy-en.html`)

Bod 2 (Profil) – doplnit za `taskRem`:
> nastavení večerní otázky na cíl dne (`goalEve`: čas zobrazení, zapnutá připomínka a její čas, zobrazení teček, zda už proběhla nabídka připomínky a počet večerních připomínek bez nastaveného cíle), odkaz na poslední nastavený cíl (`goal`: datum, id seznamu a položky, bez textu), přehled cílů za posledních 60 dní (`goalLog`: datum a zda byl cíl splněný, bez textu) a případně id osobního seznamu pro cíle (`goalList`)

Bod 7 (server) – doplnit:
> Pro ranní přehled s cílem dne server v ranní čas přečte z tvého osobního checklistu text a stav položky, na kterou ukazuje `goal`, jen když je cíl na dnešek. Pro večerní připomínku cíle čte jen nastavení a odkaz v profilu; po odeslání si do profilu zapíše počet připomínek bez nastaveného cíle (`goalEve.quiet`), aby po třech večerech přestal připomínat.

Úložiště zařízení: `lp_goal_skip` (den, kdy jsi klepl/a „Dnes ne“). Anglická verze stejně.

---

## 8. Texty UI (i18n/cs.js, i18n/en.js)

| Klíč | cs | en |
|---|---|---|
| `dash.card.goal` | Cíl dne | Goal of the day |
| `gl.day.t` | 🎯 Dnešní cíl | 🎯 Today's goal |
| `gl.eve.t` | 🌙 Co chceš zítra dokázat? | 🌙 What do you want to achieve tomorrow? |
| `gl.eve.sub` | Jedna věc, která zítřek udělá dobrým dnem. | One thing that will make tomorrow a good day. |
| `gl.ph` | Třeba: Dokončit prezentaci | E.g. Finish the presentation |
| `gl.saveAria` | Uložit cíl na zítra | Save tomorrow's goal |
| `gl.pick` | Nebo vyber z úkolů na zítra: | Or pick one of tomorrow's tasks: |
| `gl.today` | Dnes: | Today: |
| `gl.skip` | Dnes ne | Not tonight |
| `gl.tmrw.t` | 🌙 Zítra | 🌙 Tomorrow |
| `gl.saved.push` | Uloženo. Ráno ti to připomenu ☀️ | Saved. I'll remind you in the morning ☀️ |
| `gl.saved` | Uloženo. Ráno to najdeš tady. | Saved. You'll find it here in the morning. |
| `gl.edit` | ✏️ Upravit | ✏️ Edit |
| `gl.done` | Máš to! 🎉 | You did it! 🎉 |
| `gl.ask.t` | 🔔 Připomínat mi to každý večer? | 🔔 Remind me every evening? |
| `gl.ask.yes` | Ano, ve {time} | Yes, at {time} |
| `gl.ask.no` | Ne, díky | No, thanks |
| `gl.streak` | ⚡ {n} {n, dny} | ⚡ {n}-day streak |
| `gl.dotsAria` | Tento týden: {list} | This week: {list} |
| `gl.dot.ok` / `.set` / `.now` / `.none` | {day}: splněno / nesplněno / čeká / bez cíle | {day}: done / not done / pending / no goal |
| `gl.cleared` | Cíl na zítra zrušen | Tomorrow's goal removed |
| `gl.moved` | 🎯 Cíl na {when} je teď: {name} | 🎯 Your goal for {when} is now: {name} |
| `gl.menu.t` | 🎯 Cíl dne | 🎯 Goal of the day |
| `gl.menu.from` | 🌙 Večerní otázka od | 🌙 Evening question from |
| `gl.menu.push` | 🔔 Večerní připomínka | 🔔 Evening reminder |
| `gl.menu.pushHint` | Ve {time} se zeptám na zítřek. | At {time} I'll ask about tomorrow. |
| `gl.menu.dots` | ⚡ Ukazovat tečky a sérii | ⚡ Show dots and streak |
| `gl.menu.hide` | 🙈 Schovat kartu z Domů | 🙈 Hide card from Home |
| `gl.menu.quiet` | Připomínky jsem ztišil, ozvu se zase, až si cíl nastavíš. | I've paused reminders – they'll come back once you set a goal. |
| `gl.listName` | 🎯 Moje cíle | 🎯 My goals |
| `set.notif.goal` | 🌙 Večer se zeptat na cíl na zítra | 🌙 Ask about tomorrow's goal in the evening |
| `set.notif.goalTime` | 🌙 Cíl na zítra | 🌙 Tomorrow's goal |
| `tk.star` (změna) | 🎯 Cíl dne | 🎯 Goal of the day |
| `tk.starHint` | Jen jeden na den. Ukáže se nahoře na Domů. | Only one per day. Shown at the top of Home. |
| `tk.starGrp` | 🎯 Cíl dne je osobní. Tady zůstane jen jako značka. | 🎯 The goal of the day is personal. Here it stays just as a mark. |
| `nd.focus.t` (přepis) | 🌙 Chceš si večer říct, co zítra dokážeš? | 🌙 Want to set one goal for tomorrow each evening? |

Rod: texty jsou bez tvarů podle pohlaví („Máš to!“, „klepl/a“ jen v privacy). „ztišil“ mluví parťák/appka v 1. osobě jako jinde v appce (`av.*` tvary netřeba).

---

## 9. Napojení v kódu (pro kodera)

**app.js – nové** (sekce „🎯 CÍL DNE (5.18)“ hned za „✅ ÚKOLY (5.15)“): `glDay`, `glTmrw`, `glIsEve`, `glListId`, `glFind`, `glState` (A/A✓/C/D/none), `glDashHTML`, `glDashRefresh`, `glSave`, `glEditOpen`, `glPick(l,id)`, `glSkip`, `glAsk(yes)`, `glMenuOpen`, `glLogSet/glLogDel/glPtrSet` (jeden `updateDoc`, ořez na 60 klíčů), `glOnToggle`, `glReconcile`, `glDotsHTML`, `glStreak`, `glLocalEve`, `glOpenFromNotif`.

**app.js – změny**: `tkToggle` (háček), `tkSave` (ukazatel, toast `gl.moved`, skrytý přepínač ve skupině), `tkDel` + mazání v checklistu (`glLogDel`), `tkUnstar` (`!e.gid`), `tkAllToToday` (hvězda jen když dnešek cíl nemá), `DASH_CARDS`/`dashEditAvail`, `rDash` (plný i jednoduchý režim), nudge `focus`, `sendMorningNotif` (první věta), `scheduleNotifs` (lokální večer), obsluha `open: 'goal'` v kliknutí na notifikaci, `saveNotifSettings`/načtení (`nt-goal`, `notif-goal`), `buildChatContext`. Uživatelský text vždy `esc()`, handlery přes `data-aN`.

**functions/index.js**: 4.1 a 4.2. **i18n-server.js**: 4.3. **index.html**: řádek a čas v Upozorněních. **style.css**: 1.10. **sw.js**: `CACHE` v124. **privacy*.html**: kap. 7.

## 10. Edge cases (souhrn)

| Situace | Chování |
|---|---|
| Uloženo ve 23:59, otevřeno v 00:05 | Logický den je pořád včerejšek → stav D se stejným cílem. |
| Večerní karta v 01:30 | „Co chceš zítra dokázat?“ ukládá na kalendářní dnešek (ráno po spánku). |
| Uživatel otevře appku poprvé až v 05:00 bez cíle | Žádná karta (ve dne bez cíle nic). |
| `goalEve.t` později než 04:00 další den | Nelze, výběr času 15:00–23:30. |
| Cíl nastaven v Úkolech na starším zařízení | Karta ho najde přes `glFind`, ukazatel a `goalLog` doplní `glReconcile`. |
| 🎯 na úkol ze skupinového seznamu (starší data) | Na kartě Cíl se neukáže; v Úkolech zůstává značka. |
| Úkoly sdílené do skupiny | Cíl jde do osobního „🎯 Moje cíle“ (3.3). |
| Dva cíle na stejný den (dvě zařízení) | Vyhrává ukazatel; druhá hvězda zůstane, dokud uživatel nic neupraví. |
| Smazání splněného cíle | V tečkách zůstává ●. |
| Smazání nesplněného cíle | Den v tečkách zmizí (·). |
| Odchod ze skupiny / smazání účtu | Nic zvláštního; vše je v profilu a osobním checklistu. `deleteAccount` maže profil celý. |
| Notifikace zakázané | Karta funguje, nabídka 1.4 vede přes `notifAskNow`. |
| Cesta do jiné zóny | Klient `toDS()` lokálně, server `prof.tz`; nejhůř připomínka v původní zóně (stejně jako ostatní připomínky). |
| Offline uložení | Viditelné hned, zápis profilu po připojení. |
| Ranní push, cíl mezitím splněn nebo smazán | Server ho vynechá (kontrola `!it.done`, `it.due === today`, `it.star`). |

## 11. Odhad rozsahu

| Část | Rozsah |
|---|---|
| app.js | ~300 řádků nových, ~40 změněných |
| functions/index.js | ~45 řádků |
| i18n cs/en + server + ai | ~45 klíčů × 2 |
| style.css | ~15 řádků |
| index.html, privacy cs/en | ~12 řádků + 2 odstavce × 2 |
| Celkem | 1 koder, 1 pracovní den; test statický + simulace `glDay`/`glStreak`/server bloku v node; 1 kolo review |

Rizika: (1) háčky do mazání v checklistu (víc míst, kde se položky mažou) – pokrýt `glReconcile`; (2) `tkUnstar` přestane zapisovat do skupin – změna chování, ale bezpečnější; (3) jednoduchý režim – karta mimo sloty nesmí odsunout „Co teď“ pod přehyb (karta ve dne bez cíle se neukazuje, večer je kompaktní).

Fáze 2 (backlog): ranní varianta „Co chceš dnes dokázat?“ při chybějícím cíli (Q4), převod `focusHistory` do `goalLog`, týdenní souhrn s počtem splněných cílů, tlačítko „✓ Hotovo“ přímo v notifikaci.

## 12. CHANGELOG (5.18)

```js
{ v:'5.18', items:[
  '🌙 Večerní chvilka: na Domů se tě večer zeptám, co chceš zítra dokázat – jedna věc, jedno pole',
  '🎯 Ráno najdeš svůj cíl nahoře na Domů a odškrtneš ho jedním klepnutím; tečky za týden ukážou, jak se ti daří',
  '🔔 Když chceš, připomenu se večer notifikací a ranní přehled začne tvým cílem'
], en:[
  '🌙 Evening moment: on Home I\'ll ask what you want to achieve tomorrow – one thing, one field',
  '🎯 In the morning your goal waits at the top of Home, tick it off with one tap; weekly dots show how you\'re doing',
  '🔔 If you like, I\'ll remind you in the evening and the morning summary starts with your goal'
]},
```

## 13. Otázky pro uživatele (výchozí = doporučení)

1. **Kdy má chodit večerní připomínka?** Doporučuji **ve 21:00** (před spaním, spojí se s večerním shrnutím do jedné notifikace); karta na Domů se ukáže už od 18:00. Alternativa: připomínka hned v 18:00.
2. **Jednoduchý režim:** ukázat večerní otázku samo od 3. dne? Doporučuji **ano** (je to jedno pole a jde schovat). Alternativa: až když řekne „Ano“ v nabídce.
3. **Tečky a série:** ukazovat automaticky od druhého cíle? Doporučuji **ano** (vypne se v ⋯).
4. **Ráno bez cíle:** nic neukazovat, nebo do 11:00 nabídnout „☀️ Co chceš dnes dokázat?“? Doporučuji **nic** (méně připomínání; přidat jde ve fázi 2).
