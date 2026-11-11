# Návrh UI pro růst

Autor: ux-designer · 2026-11-11 · výchozí verze 5.15 (větev `claude/awesome-hypatia-72pnwx`) · stav: **návrh, nic není implementováno**.

Kolo 2 (tento dokument nahoře): 1. landing kolem jedné věty, 2. pozvání do skupiny odkazem, 3. krátký dotazník po 7 dnech.
Kolo 1 (4.27, implementováno) je níže v části **Archiv**.

Cílovka: české rodiny a domácnosti. Odlišnost, kterou musí landing i pozvánka říct během 3 sekund:
1. **Celá domácnost na jednom místě** (česky, zdarma, bez reklam),
2. **sdílí se jen to, co si vyberete** (nákup ano, deník ne),
3. **AI parťák vidí souvislosti** napříč moduly (kalendář + jídelníček + nákup).

**Pravidla Firestore:** žádný ze tří bodů nevyžaduje změnu `firestore.rules` ani `firestore.indexes.json`. Volitelný bod 2.6 (push „X se připojil/a“) potřebuje jen novou Cloud Function.

Společné pro kodéra:
- Uživatelský text do HTML přes `esc()` / `textContent`, do handlerů přes `data-aN`.
- Dotykové plochy min. 44×44 px, vstupy `font-size:16px`.
- Barvy jen přes `var(--…)` (sunshine, dark-gold, tangerine). Text na `var(--accent)` přes `--on-accent` (zavedeno v kole 1).
- Klíče `cs.js` a `en.js` musí sedět 1:1 (hlídá `.github/scripts/ci-check.js`).
- Verze: `APP_VERSION` 5.15 → 5.16, záznam v `CHANGELOG`, bump `CACHE` v sw.js. Kódovat body 1, 2 a 3 jako tři oddělené úkoly (všechny sahají do app.js, jen jeden koder naráz).

---

## 1. Úvodní stránka (landing)

### 1.1 Co je dnes špatně (5.15)
Stávající pořadí v `#lp-landing`: ikona 96 px → `LifePocket` → H1 „Jedna appka místo deseti.“ → podtitulek o 2 větách (≈ 150 znaků, na 360 px 5 řádků) → štítek „Zdarma, bez reklam, česky“ → 2 tlačítka → „Co v appce najdeš“ (5 karet) → snímky → druhé CTA → slib → právní odkazy → jazyk.

- **H1 neříká, pro koho appka je.** „Jedna appka místo deseti“ je chytlavé, ale nezazní v ní domácnost/rodina, tedy hlavní odlišnost. Ta je až v podtitulku a v 1. kartě.
- **Podtitulek dělá práci H1 i seznamu funkcí** (vyjmenovává moduly a ještě vysvětluje sdílení). Na mobilu odsune tlačítko „Začít zdarma“ pod ohyb (ikona 96 + logo 34 px + H1 2 řádky + 5 řádků podtitulku + štítek ≈ 520 px při výšce okna 560 px).
- **AI parťák s „vidí souvislosti“ chybí úplně.** Karta 3 říká jen „poradí recept“, to umí každý chatbot.
- 5 karet funkcí míchá odlišnosti (sdílený nákup, soukromí) s běžnými věcmi (návyky, kalendář). Odlišnosti zaniknou.

### 1.2 Varianty H1

| | CS | EN | Pro | Proti |
|---|---|---|---|---|
| A | **Celá domácnost v jedné appce.** | **Your whole household in one app.** | Říká *pro koho* i *co* (jedno místo); krátká (29 znaků, na 360 px 2 řádky) | „domácnost“ zní trochu úředně |
| B | Jedna appka místo deseti. Pro celou rodinu. | One app instead of ten. For the whole family. | Navazuje na dosavadní značku, OG obrázek a meta | Dvě věty, 3 řádky na mobilu; „deset appek“ je slib bez obsahu |
| C | Nákup, kalendář i večeře. Konečně společně. | Shopping, calendar and dinner. Finally together. | Konkrétní, emoční | Vyjmenovává jen 3 moduly (návyky, cíle, AI vypadnou); „konečně“ je klišé |

**Doporučuji A.** Je nejkratší, říká hlavní odlišnost hned a podtitulek pak může nést zbylé dvě (výběrové sdílení + AI). „Jedna appka místo deseti“ nezahazujeme: zůstává v OG obrázku a v `og:title` (sdílené odkazy ji už nesou, změna obrázku = nový obrázek a cache WhatsAppu, nestojí to za to).

### 1.3 Finální texty

| Klíč | CS | EN |
|---|---|---|
| `landing.hero` (změna) | Celá domácnost v jedné appce. | Your whole household in one app. |
| `landing.sub` (změna) | Nákupy, kalendář, jídelníček i návyky. S rodinou sdílíš jen to, co si vybereš. | Shopping, calendar, meal plan and habits. You share with your family only what you choose. |
| `landing.trust` (nový, nahrazuje `landing.free`) | Zdarma · bez reklam · česky | Free · no ads · made in Czechia |
| `landing.start` | Začít zdarma | Get started free |
| `landing.haveAccount` | Mám účet | I have an account |
| `landing.why` (nový H2) | Proč LifePocket | Why LifePocket |
| `landing.w1t` | 🏠 Pro celou domácnost | 🏠 For the whole household |
| `landing.w1d` | Jeden nákupní seznam, společný kalendář a plán jídel. Co koupí partner, tobě se hned odškrtne. | One shopping list, a shared calendar and a meal plan. When your partner buys something, it’s ticked off for you too. |
| `landing.w2t` | 🔒 Sdílíš jen to, co chceš | 🔒 Share only what you want |
| `landing.w2d` | Nákup se skupinou ano, deník a návyky jen pro tebe. Nic se nesdílí samo. | Shopping with your group, journal and habits just for you. Nothing is shared automatically. |
| `landing.w3t` | ✨ Parťák, který vidí souvislosti | ✨ A companion who connects the dots |
| `landing.w3d` | AI parťák zná tvůj kalendář, jídelníček i nákup. Na nabitý čtvrtek ti navrhne rychlou večeři a suroviny přidá do seznamu. | Your AI companion knows your calendar, meal plan and shopping list. For a busy Thursday it suggests a quick dinner and adds the ingredients to your list. |
| `landing.preview` | Jak appka vypadá | A look inside |
| `landing.features` (změna) | A k tomu | And there’s more |
| (čipy modulů) | stávající klíče `mod.habits`, `mod.goals`, `mod.journal`, `mod.cooking`, `mod.water`, `mod.pets`, `mod.finance`, `mod.checklist` | (stejné klíče) |
| `landing.try` | Vyzkoušet LifePocket zdarma → | Try LifePocket for free → |
| `landing.promise` (zkrácení) | Žádné reklamy ani placený tarif. Začni jedním modulem, další přidáš kdykoli. | No ads, no paid plan. Start with one module and add more any time. |

Poznámky k textům:
- `w3d` slibuje jen to, co appka umí (ověřeno): kontext AI obsahuje kalendář, jídelníček i nákup (`buildChatContext`) a z chatu jde vložit suroviny do nákupu (`chat.ingAdded`, app.js ř. ~24337).
- EN „made in Czechia“ místo „česky“ (pro anglického čtenáře je čeština jako jazyk UI nezajímavá, původ ano).
- Klíče `landing.b1t`–`b5d` a `landing.free` smazat z obou slovníků (ci-check hlídá jen shodu, ne nepoužité klíče; mrtvé klíče nenechávat).

### 1.4 Pořadí sekcí (před / po, telefon 360×560 viditelné plochy)

```
PŘED (5.15)                          PO (5.16)
┌────────────────────────────┐      ┌────────────────────────────┐
│        [ikona 96]          │      │   [ikona 56] LifePocket    │  ← ikona a logo v jednom řádku
│        LifePocket          │      │                            │
│ Jedna appka místo deseti.  │      │  Celá domácnost            │  H1
│ Návyky, kalendář, nákupy   │      │  v jedné appce.            │
│ i deník na jednom místě.   │      │  Nákupy, kalendář, jídel-  │  sub (2–3 řádky)
│ Plánuj svůj den a s rodi-  │      │  níček i návyky. S rodinou │
│ nou sdílej jen to, co…     │      │  sdílíš jen to, co si vy-  │
│ …kalendář, úkoly.          │      │  bereš.                    │
│ (Zdarma, bez reklam, česky)│      │  [     Začít zdarma     ]  │  ← nad ohybem, palcem
│ [     Začít zdarma     ]   │ ohyb │  [       Mám účet       ]  │
├────────────────────────────┤──────│  Zdarma · bez reklam · česky│
│ [       Mám účet       ]   │      ├────────────────────────────┤
│ Co v appce najdeš          │      │ Proč LifePocket            │  3 karty odlišností
│ 🛒 Nákup pro celou rodinu  │      │ 🏠 Pro celou domácnost     │
│ 🔥 Návyky a cíle           │      │ 🔒 Sdílíš jen to, co chceš │
│ ✨ AI společník            │      │ ✨ Parťák, který vidí sou… │
│ 🗓️ Kalendář a připomínky   │      │ Jak appka vypadá           │
│ 🔒 Soukromé, dokud…        │      │ [snímek][snímek][snímek]   │  beze změny
│ Jak appka vypadá [snímky]  │      │ A k tomu                   │  čipy modulů (2–3 řádky)
│ [Vyzkoušet zdarma →]       │      │ 🔥Návyky 🏆Cíle 📒Deník …  │
│ Bez reklam. Bez placeného… │      │ [Vyzkoušet LifePocket →]   │
│ Ochrana · Podmínky         │      │ Žádné reklamy ani placený… │
│ Čeština · English          │      │ Ochrana · Podmínky         │
└────────────────────────────┘      │ Čeština · English          │
                                    └────────────────────────────┘
```

Co **vyhodit / zkrátit**:
- Karty „Návyky a cíle“ a „Kalendář a připomínky“ jako samostatné karty pryč → do čipů „A k tomu“ (kalendář je v kartě 🏠).
- Štítek `.lp-free` jako samostatný „pill“ nad tlačítky pryč → jedna řádka `.lp-trust` **pod** tlačítky (tlačítko je pak o ~44 px výš).
- Ikona 96 px → 56 px vedle loga (ušetří ~80 px). Animace `float` u malé ikony vypnout (`prefers-reduced-motion` už respektuje, ale u 56 px vedle textu působí neklidně).
- Promise o polovinu kratší.

Co **zůstává beze změny**: všechna ID (`lp-landing`, `lp-hero-t`, `lp-start-btn`, `lp-try-btn`, `lp-try-wrap`, `lp-invite`, `lp-invite-t`, `auth-panel` …), rychlý start v inline skriptu, výměna `lp-try-wrap` ve vestavěném prohlížeči (`initInAppBrowser`), třída `lp-inapp-on`, snímky, právní odkazy, volba jazyka.

### 1.5 HTML (index.html, náhrada části `#lp-landing` od ikony po `lp-legal`)

```html
<!-- Hlavička: ikona + jméno v řádku (5.16). .app-icon-wrap a .logo-name zůstávají kvůli lp-inapp-on a auth panelu -->
<div class="lp-brand">
  <div class="app-icon-wrap"><img class="app-icon" width="96" height="96" src="img/app-icon.jpg" alt=""></div>
  <div class="logo-name">LifePocket</div>
</div>

<section id="lp-landing" aria-labelledby="lp-hero-t">
  <h1 class="lp-hero" id="lp-hero-t" data-i18n="landing.hero">Celá domácnost v jedné appce.</h1>
  <p class="lp-sub" data-i18n="landing.sub">Nákupy, kalendář, jídelníček i návyky. S rodinou sdílíš jen to, co si vybereš.</p>
  <div class="lp-invite" id="lp-invite" hidden>…beze změny…</div>
  <div class="lp-ctas">
    <button type="button" class="btn-p" id="lp-start-btn" onclick="showAuthPanel('register')" data-i18n="landing.start">Začít zdarma</button>
    <button type="button" class="btn-s lp-have" onclick="showAuthPanel('login')" data-i18n="landing.haveAccount">Mám účet</button>
  </div>
  <p class="lp-trust" data-i18n="landing.trust">Zdarma · bez reklam · česky</p>

  <h2 class="lp-sec" data-i18n="landing.why">Proč LifePocket</h2>
  <ul class="lp-benefits">
    <li class="lp-benefit"><div><div class="lp-b-t" data-i18n="landing.w1t">🏠 Pro celou domácnost</div>
      <div class="lp-b-d" data-i18n="landing.w1d">Jeden nákupní seznam, společný kalendář a plán jídel. Co koupí partner, tobě se hned odškrtne.</div></div></li>
    <li class="lp-benefit"><div><div class="lp-b-t" data-i18n="landing.w2t">🔒 Sdílíš jen to, co chceš</div>
      <div class="lp-b-d" data-i18n="landing.w2d">Nákup se skupinou ano, deník a návyky jen pro tebe. Nic se nesdílí samo.</div></div></li>
    <li class="lp-benefit"><div><div class="lp-b-t" data-i18n="landing.w3t">✨ Parťák, který vidí souvislosti</div>
      <div class="lp-b-d" data-i18n="landing.w3d">AI parťák zná tvůj kalendář, jídelníček i nákup. Na nabitý čtvrtek ti navrhne rychlou večeři a suroviny přidá do seznamu.</div></div></li>
  </ul>

  <h2 class="lp-sec" data-i18n="landing.preview">Jak appka vypadá</h2>
  <div class="lp-shots">…beze změny…</div>

  <h2 class="lp-sec" data-i18n="landing.features">A k tomu</h2>
  <ul class="lp-mods" role="list">
    <li><span aria-hidden="true">🔥</span> <span data-i18n="mod.habits">Návyky</span></li>
    <li><span aria-hidden="true">🏆</span> <span data-i18n="mod.goals">Cíle</span></li>
    <li><span aria-hidden="true">📒</span> <span data-i18n="mod.journal">Deník</span></li>
    <li><span aria-hidden="true">👨‍🍳</span> <span data-i18n="mod.cooking">Vaření</span></li>
    <li><span aria-hidden="true">✅</span> <span data-i18n="mod.checklist">Checklist</span></li>
    <li><span aria-hidden="true">💧</span> <span data-i18n="mod.water">Pitný režim</span></li>
    <li><span aria-hidden="true">💰</span> <span data-i18n="mod.finance">Finance</span></li>
    <li><span aria-hidden="true">🐾</span> <span data-i18n="mod.pets">Mazlíček</span></li>
  </ul>

  <div class="lp-ctas lp-ctas2" id="lp-try-wrap">…beze změny…</div>
  <p class="lp-promise" data-i18n="landing.promise">Žádné reklamy ani placený tarif. Začni jedním modulem, další přidáš kdykoli.</p>
  …lp-legal, lp-lang beze změny…
</section>
```

Pozor: `.lp-brand` obaluje ikonu a jméno **i pro `#auth-panel`** (jsou nad oběma sekcemi). V auth panelu to tak chceme taky (formulář je výš). Emoji ve `w1t`–`w3t` jsou součástí textu (překládá se celé), proto starý `<span class="lp-b-em">` odpadá. Pokud vedoucí chce emoji mimo text kvůli čtečkám: vrátit `lp-b-em` s `aria-hidden` a emoji z textů vyjmout.

`mod.finance` existuje v obou slovnících (cs „Finance“, en „Budget“).

### 1.6 CSS (style.css, blok LOGIN)

```css
/* 5.16 hlavička landingu: ikona 56 px vedle jména */
.lp-brand{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:4px}
.lp-brand .app-icon-wrap{margin:0}
.lp-brand .app-icon{width:56px;height:56px;border-radius:14px;animation:none;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.lp-brand .logo-name{margin-top:0;font-size:28px}
.lp-trust{text-align:center;font-size:14px;font-weight:600;color:var(--text2);margin:-12px 0 24px}
.lp-mods{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.lp-mods li{background:var(--card2);border:1px solid var(--border);border-radius:50px;padding:8px 14px;font-size:15px;color:var(--text)}
.lp-hero{font-size:30px}   /* kratší věta unese o 2 px víc */
@media (max-width:380px){ .lp-hero{font-size:27px} }
```
- `.lp-mods li` nejsou klikací (jen výčet), proto 44 px výšku nepotřebují.
- `.lp-sub` nechat 17 px / `--text2`; v sunshine má `--text2` na `--card` kontrast ≥ 4,5 : 1 (ověřeno v kole 1).
- `lp-inapp-on`: stávající pravidla dál skrývají ikonu (`.lp-inapp-on .app-icon-wrap{display:none}`) a zmenší logo; s `.lp-brand` to funguje beze změny.

### 1.7 Meta (volitelné, stejná změna)
`<title>` a `meta.title`: „LifePocket – celá domácnost v jedné appce“ / „LifePocket – your whole household in one app“. `og:*` a OG obrázek nechat.

### 1.8 Edge cases
- **Pozvánka (`?join=`)**: na landingu se H1 a podtitulek mění, viz 2.3. Normální landing nesmí probliknout: přepnutí dělá už inline rychlý start (čte `lp_pending_join` / URL), ne až app.js.
- **Anglický landing** se překládá až po `import('/i18n.js')`; delší EN H1 („Your whole household in one app.“, 32 znaků) se na 360 px vejde na 2 řádky při 27 px.
- **Nainstalovaná PWA a známý uživatel** landing nevidí (beze změny).

### 1.9 Rozsah
**S**: index.html, style.css, cs.js, en.js, bez app.js (kromě případně `CHANGELOG`/`APP_VERSION`). Zhruba 2–3 h vč. kontroly obou jazyků a tří témat.

---

## 2. Pozvání do skupiny odkazem

### 2.1 Co už funguje (5.15, ověřeno v kódu)
Většina toku je hotová, návrh ho **dotahuje**, nestaví znovu:
- `groupInviteUrl(gid)` → `https://lifepocket.app/?join=KÓD&od=Jméno`; `shareGroupInvite` → Web Share API, jinak schránka. Text „Jana tě zve do společného nákupu a kalendáře v LifePocket (zdarma)“ podle sdílených modulů.
- `capturePendingJoin()` při startu (i bez přihlášení) uloží `{code, ts, od}` do `localStorage.lp_pending_join` (platnost 7 dní) a smaže parametry z adresy; jméno z `od` čistí `cleanInviter()` (žádné „LifePocket“, „podpora“, max. 30 znaků).
- Landing i auth panel ukážou pruh `#lp-invite` „Jana tě zve do skupiny…“ (bez názvu skupiny, bez kódu).
- Onboarding s pozvánkou: předvybraná šablona Rodina, tlačítko „Hotovo, ke skupině →“, po dokončení hned `checkPendingJoin()`.
- Po přihlášení `checkPendingJoin()` → `getDoc(families/KÓD)` (pravidla: `get` povolen přihlášenému u nového formátu kódu) → okno „Chceš se připojit do skupiny **Rodina**?“ → `joinFamily` / `joinExtraGroup` (limit 8 členů, 5 skupin, změněný kód = „Pozvánka už neplatí“).
- Vestavěný prohlížeč Messengeru/Instagramu: odkaz se zachová pro „Otevřít v Chrome/Safari“.

**Soukromí je v pořádku a zůstává:** bez přihlášení se nic z Firestore nečte (pravidla `get` vyžadují `request.auth`), název skupiny ani jména členů se před přihlášením neukážou. Jediné, co nepřihlášený vidí, je jméno z odkazu `od`, které tam dal sám odesílatel.

### 2.2 Mezery, které návrh řeší

| # | Problém | Dopad |
|---|---|---|
| a | Landing s pozvánkou je stejný jako bez ní, pozvánka je jen malý pruh nad tlačítky. Příjemce z WhatsAppu neví, *k čemu* se připojuje. | velký (konverze pozvaných) |
| b | Okno před připojením neříká, co se sdílí a co zůstane soukromé. Přesně tady se rozhoduje „dám tam svoje data?“. | velký |
| c | Plná skupina (8/8) a limit 5 skupin se ukážou až chybovým toastem **po** klepnutí na „Připojit se“. | střední |
| d | Po připojení člověk zůstane, kde byl. Společný nákup nenajde, a když nemá zapnutý modul Nákupy, sdílený seznam vůbec nevidí. | velký |
| e | V Nastavení skupiny je hlavní tlačítko „📤 Sdílet“ až vedle kódu; kód (který většina lidí nepotřebuje) je největší prvek. Chybí QR pro pozvání „u stolu“. | střední |
| f | „Zrušit“ v okně pozvánku smaže; kdo si jen chce nejdřív appku prohlédnout, o ni přijde. | malý |
| g | Zvoucí se nedozví, že se někdo připojil. | střední (volitelné, 2.6) |

### 2.3 Příjemce bez účtu (landing v režimu pozvánky)

Odkaz rozšířit o **co se sdílí**: `&co=` z písmen `s` (nákup, `shareShop`), `c` (kalendář, `shareCal`), `m` (jídelníček, `shareMeal`), `l` (úkoly, `shareChecklist`). Příklad: `https://lifepocket.app/?join=DOMA-K7PX4Q&od=Jana&co=sc`.
- Je to jen nápověda z odkazu, nic tajného (příznaky sdílení nejsou citlivé, název skupiny ani členové v odkazu nejsou). Neznámá písmena a víc než 4 znaky se zahodí.
- `capturePendingJoin` uloží `co` do `lp_pending_join` (`{code, ts, od, co}`), `stripJoinParam` maže i `co`, `inAppLink` ho přenáší.

Landing s pozvánkou (přepíná inline rychlý start podle `lp_pending_join`, app.js pak `initLoginScreen` stejně):

```
┌────────────────────────────┐
│   [ikona 56] LifePocket    │
│                            │
│  Jana tě zve do LifePocket │  H1 (landing.invH1 / invH1A)
│                            │
│  Do společného nákupu      │  sub (landing.invSub.{co})
│  a kalendáře. Tvoje další  │
│  věci zůstanou jen tvoje.  │
│  [  Přijmout pozvánku   ]  │  → showAuthPanel('register')
│  [     Už mám účet      ]  │  → showAuthPanel('login')
│  Zdarma · bez reklam · česky│
├────────────────────────────┤
│ Co je LifePocket?          │  landing.invWhat (místo „Proč LifePocket“)
│ 🏠 … 🔒 … ✨ …             │  dál normální landing
```
- Pruh `#lp-invite` se v režimu pozvánky **neukazuje** (informace je v H1), v auth panelu `#auth-invite` zůstává.
- Bez `od` (staré odkazy, jméno neprošlo čištěním): „Máš pozvánku do LifePocket“.
- Bez `co`: obecný podtitulek „Do společné skupiny. Tvoje další věci zůstanou jen tvoje.“

Texty:

| Klíč | CS | EN |
|---|---|---|
| `landing.invH1` | {who} tě zve do LifePocket | {who} invited you to LifePocket |
| `landing.invH1A` | Máš pozvánku do LifePocket | You’ve got an invite to LifePocket |
| `landing.invSub` | Do {what}. Tvoje další věci zůstanou jen tvoje. | To {what}. Everything else stays yours alone. |
| `landing.invAccept` | Přijmout pozvánku | Accept invite |
| `landing.invHave` | Už mám účet | I already have an account |
| `landing.invWhat` | Co je LifePocket? | What is LifePocket? |
| `{what}` | stávající `grp.inv.w.shop` / `cal` / `shopCal` / `meal` / `group` („společného nákupu“ …) | (stávající EN) |

`{what}` vybírat stejně jako `groupInviteText` (shop+cal → `shopCal`, jinak první z shop, cal, meal, jinak `group`). Rychlý start v index.html slovník nemá: CS texty pro 5 variant `{what}` dát do inline skriptu jako malou mapu (EN přeloží `applyI18n` po importu i18n.js; pro `{who}` je potřeba předat proměnné, proto v EN nastaví H1 až `initLoginScreen` přes `textContent`, jako dnes `landing.inviteFrom`).

Jméno `{who}` jde vždy přes `textContent`, nikdy `innerHTML`.

### 2.4 Po přihlášení / registraci

**Okno „Pozvánka do skupiny“** (rozšíření `showJoinInviteModal`; data z `getDoc(families/KÓD)`, které už dnes proběhne):

```
┌──────────────────────────────┐
│             🔗               │
│     Pozvánka do skupiny      │
│      👋 Zve tě Jana.         │  (createdBy → jméno, jako dnes)
│                              │
│   🏠 Rodina Novákových       │  název skupiny (esc), až po přihlášení
│   Je vás tam 3 z 8           │  jen počet, žádná jména členů
│                              │
│   Ve skupině se sdílí:       │
│   [🧺 Nákup] [🗓️ Kalendář]   │  podle shareShop/Cal/Meal/Checklist z dokumentu
│   🔒 Návyky, deník a ostatní │
│   moduly zůstanou jen tvoje. │
│                              │
│  [       Připojit se       ] │  btn-p, plná šířka, 48 px
│  [         Teď ne          ] │  btn-s → laterPendingJoin (pozvánka zůstane 7 dní)
│        Odmítnout pozvánku    │  textový odkaz (44 px vysoký) → cancelPendingJoin
└──────────────────────────────┘
```

Stavy okna:

| Stav (zjištěný z dokumentu před klepnutím) | Obsah | Tlačítka |
|---|---|---|
| normální | viz výše | Připojit se · Teď ne · Odmítnout |
| plná: `members` ≥ 8 a já v ní nejsem | „Skupina **{name}** je plná (8 z 8). Napiš {who}, ať tě přidá, až se uvolní místo.“ (bez `{who}`: „…Napiš tomu, kdo tě zval…“) | Rozumím (pozvánka zůstane, při dalším spuštění se zkusí znovu; po 7 dnech vyprší) |
| limit: `groupCount() ≥ 5` | „Už jsi v 5 skupinách, víc nejde. Odejdi z některé a pozvánka tu na tebe počká.“ | Otevřít skupiny · Zavřít (pozvánka zůstane) |
| už jsem členem | stávající toast `grp.already`, okno se neotevře | – |
| kód neexistuje (rotace, smazání) | stávající `grp.inv.gone` | Zavřít |
| stará skupina WORD-NNNN (pravidla nepustí) | stávající toast `grp.codeOld` | – |

Texty:

| Klíč | CS | EN |
|---|---|---|
| `grp.inv.count` | Je vás tam {n} z 8 | {n} of 8 members |
| `grp.inv.sharedH` | Ve skupině se sdílí: | Shared in this group: |
| `grp.inv.private` | 🔒 Návyky, deník a ostatní moduly zůstanou jen tvoje. | 🔒 Your habits, journal and other modules stay private. |
| `grp.inv.later` | Teď ne | Not now |
| `grp.inv.decline` | Odmítnout pozvánku | Decline invite |
| `grp.inv.fullT` | Skupina {name} je plná (8 z 8). Napiš {who}, ať tě přidá, až se uvolní místo. | {name} is full (8 of 8). Ask {who} to add you once there’s room. |
| `grp.inv.fullTA` | Skupina {name} je plná (8 z 8). Napiš tomu, kdo tě zval, ať tě přidá, až se uvolní místo. | {name} is full (8 of 8). Ask whoever invited you to add you once there’s room. |
| `grp.inv.limitT` | Už jsi v 5 skupinách, víc nejde. Odejdi z některé a pozvánka tu na tebe počká. | You’re already in 5 groups, that’s the maximum. Leave one and this invite will wait for you. |
| `grp.inv.openGroups` | Otevřít skupiny | Open groups |
| `grp.inv.ok` | Rozumím | Got it |
| `grp.inv.welcome` | 🧺 Tohle je váš společný nákup. Co přidáš, uvidí hned všichni ve skupině. | 🧺 This is your shared shopping list. Anything you add shows up for everyone in the group. |
| `grp.inv.welcomeCal` | 🗓️ Tohle je váš společný kalendář. Události skupiny tu vidíš u svých. | 🗓️ This is your shared calendar. Group events show up next to yours. |
| `grp.inv.modsOn` | Zapnuto: {mods}, ať vidíš, co skupina sdílí. | Turned on: {mods}, so you can see what the group shares. |

- `{name}` = `cutName(groupName,40)` přes `esc()`; `{who}` stejně jako dnes.
- Ve větě „Napiš {who}“ by jméno muselo být ve 3. pádě, z dokumentu ale máme 1. pád („Napiš Jana“ je špatně). Proto **v CS „Napiš tomu, kdo tě zval“ vždy** (varianta `fullTA`) a `fullT` použít jen v EN. Kodér: v cs.js nechat `grp.inv.fullT` se stejným textem jako `fullTA` (klíče musí sedět).

**Po úspěšném připojení** (`confirmPendingJoin` po `res === true`):
1. Moduly, které skupina sdílí a uživatel je nemá (`shareShop` → `shopping`, `shareCal` → `calendar`, `shareMeal` → `mealplan`, `shareChecklist` → `checklist`), **zapnout** přes `togModSet(id, true)` a toastem `grp.inv.modsOn` oznámit. Uživatel pozvánku přijal právě kvůli nim. (Otázka 3 pro vedoucího.)
2. Přejít do prvního sdíleného modulu (nákup → kalendář → jídelníček → checklist) a v něm jednou ukázat řádek `grp.inv.welcome` / `welcomeCal` ve stylu nápovědy modulu (řádek ve stránce, nic nepřekrývá; `lsSave('lp_inv_welcome', 1)`).
3. Stávající toast `grp.joined` a `notifAskSoon('group')` zůstávají. Průvodce (`tourAfterJoin`) pokračuje jako dnes, ale **až po** přechodu do modulu.

### 2.5 Strana zvoucího (Nastavení → Skupiny → detail skupiny)

```
PŘED                                   PO
Pozvat do skupiny                      Pozvat do skupiny
┌─────────────────────────────┐        ┌──────────────────────────────┐
│        DOMA-K7PX4Q          │        │ [ 📤 Poslat pozvánku       ] │ btn-p, plná šířka, 48 px
│ Pošli tento kód nebo odkaz… │        │   WhatsApp, Messenger, SMS…  │ podpis 14 px --text2
│ [Kopírovat][📤 Sdílet][🔄]  │        │ [ 📷 Ukázat QR kód ]         │ btn-s, plná šířka
└─────────────────────────────┘        │ Nebo nadiktuj kód:           │
                                       │ DOMA-K7PX4Q   [Kopírovat]    │ kód 20 px, ne 28
                                       │ 3 z 8 míst obsazeno          │
                                       │ 🔄 Nový kód (jen správce)    │ textové tlačítko 44 px
                                       └──────────────────────────────┘
```
- **QR** (`grp.inv.qr`): okno s `qrSvg(groupInviteUrl(gid), 240)` (generátor už je v app.js u příspěvku), pod ním „Ať si to Jana naskenuje foťákem.“ Bílé pozadí QR i v tmavém tématu (čtečky jinak selhávají): `background:#fff;padding:12px;border-radius:12px`.
- U plné skupiny (8/8) tlačítka Poslat a QR **zakázat** s textem „Skupina je plná. Někoho odeber, ať se uvolní místo.“
- U staré skupiny WORD-NNNN (odkaz nefunguje, pravidla nepustí self-join): místo Poslat jen výzva „Pro pozvání odkazem potřebuje skupina nový kód“ + tlačítko Nový kód (správce), ostatním „Požádej správce o nový kód“. Dnes `shareGroupInvite` pošle odkaz i pro starý kód a příjemce dostane jen „kód už neplatí“.
- Dialog „Nový kód“ (rotateGroupCode) doplnit větou: „Dřív poslané odkazy a QR kódy přestanou fungovat.“

Texty:

| Klíč | CS | EN |
|---|---|---|
| `grp.inv.send` | 📤 Poslat pozvánku | 📤 Send invite |
| `grp.inv.sendHint` | WhatsApp, Messenger, SMS… | WhatsApp, Messenger, text… |
| `grp.inv.qr` | 📷 Ukázat QR kód | 📷 Show QR code |
| `grp.inv.qrHint` | Ať si to naskenuje foťákem v telefonu. | Let them scan it with their phone camera. |
| `grp.inv.dictate` | Nebo nadiktuj kód: | Or read out the code: |
| `grp.inv.seats` | {n} z 8 míst obsazeno | {n} of 8 spots taken |
| `grp.inv.fullOwn` | Skupina je plná. Někoho odeber, ať se uvolní místo. | The group is full. Remove someone to free up a spot. |
| `grp.inv.legacy` | Pro pozvání odkazem potřebuje skupina nový kód. | This group needs a new code before you can invite by link. |
| `grp.inv.legacyAsk` | Požádej správce skupiny o nový kód. | Ask the group admin for a new code. |
| `grp.rot.linksDie` | Dřív poslané odkazy a QR kódy přestanou fungovat. | Links and QR codes you sent before will stop working. |

`grp.share` / `grp.copy` / `grp.codeLbl` po přestavbě ověřit grepem a nepoužité smazat.

### 2.6 Volitelně: „Petr se připojil“ (push zvoucímu)
Nová Cloud Function `onDocumentUpdated('families/{fid}')`: když `members` přibyl klíč s `role:'member'`, poslat push správcům skupiny (stejná infrastruktura tokenů jako `sendScheduledNotifications`, `data.tag` = `webpush.notification.tag` = `join-{fid}`), text „👋 Petr se připojil/a do skupiny Rodina“ / „👋 Petr joined Rodina“. Respektovat nastavení upozornění skupin (nová kategorie „Nový člen“, výchozí zapnuto). Bez změny pravidel, nasazení funkcí jde samo přes Actions. Rozsah **S–M**, doporučuji jako samostatný úkol až po 2.3–2.5.

### 2.7 Edge cases
- **Odkaz otevřený přihlášeným** (appka v prohlížeči): landing se neukáže, okno 2.4 hned po startu (dnes stejně).
- **Odkaz otevřený na iPhonu, appka je na ploše**: iOS otevře Safari, ne PWA (jiné úložiště). Pozvánka se uloží v Safari; po přihlášení v Safari projde. V PWA ne. Do auth panelu pro iOS v režimu pozvánky přidat poznámku: „Máš LifePocket na ploše? Přihlas se tady v Safari, připojíš se a pak už můžeš pokračovat v appce.“ (`auth.invIosPwa` / EN „Have LifePocket on your home screen? Sign in here in Safari to join, then carry on in the app.“). Android Chrome s nainstalovanou PWA odkaz otevře v PWA (rozsah manifestu `/`), tam to funguje.
- **Podvržené `od`** (kdokoli může do odkazu napsat jakékoli jméno): proto „{who} tě zve“ před přihlášením, ale po přihlášení okno ukazuje **jméno zakladatele z dokumentu** (dnešní chování) a skutečný název skupiny. Kdo by se vydával za někoho jiného, prozradí ho okno ještě před připojením.
- **Podvržené `co`**: nejhůř landing slíbí „společný nákup“ a skupina sdílí jen kalendář; okno 2.4 ukáže pravdu z dokumentu. Přijatelné.
- **Kód rotovaný mezi odesláním a otevřením**: `getDoc` vrátí neexistující dokument → `grp.inv.gone`.
- **Registrace přes Google v jiném okně / tabu**: `lp_pending_join` je v localStorage stejného původu, přežije.
- **Pozvánka a dotazník (bod 3) ve stejný den**: dotazník se v den připojení neukáže (viz 3.2).
- **Odkaz přeposlaný dál** (Jana → Petr → Petrova kamarádka): chování správné, limit 8 a rotace kódu jsou pojistka. Žádná nová.

### 2.8 Rozsah
- 2.3 landing v režimu pozvánky + parametr `co`: **S** (index.html inline skript, app.js `capturePendingJoin`/`stripJoinParam`/`inAppLink`/`initLoginScreen`/`groupInviteUrl`, i18n).
- 2.4 okno + po připojení: **M** (≈ 0,5–1 den, hlavně stavy a zapnutí modulů).
- 2.5 strana zvoucího + QR: **S**.
- 2.6 push: **S–M**, funkce.
- Celkem bez 2.6 ≈ 1–1,5 dne kodéra. **Bez změny `firestore.rules` a indexů.**

---

## 3. Krátký dotazník po 7 dnech

### 3.1 Kde a jak se ukáže
**Karta na Domů ve stylu nabídek** (`.invite-hint.nudge`, stejná komponenta jako `nudgeCardHTML`), ne vyskakovací okno při startu. Klepnutím na „Odpovědět“ se otevře okno s otázkami. Kdo nechce, kartu přejde nebo ji zavře.

```
Domů
┌──────────────────────────────────────┐
│ 💬  Jak se ti zatím daří?         ×  │  × = Neukazovat (aria-label)
│     Máš za sebou týden s LifePocket. │
│     Pomůžeš nám třemi rychlými       │
│     otázkami? Zabere to minutu.      │
│     [ Odpovědět ]  [ Teď ne ]        │
└──────────────────────────────────────┘
```

### 3.2 Kdy (podmínky, vše musí platit)
1. Přihlášený, `prof` načtený, online (`navigator.onLine !== false`), Domů je aktivní stránka.
2. `accDay() >= 7` (týden od založení účtu) **a** aspoň 4 aktivní dny: v jednoduchém režimu `actN('all') >= 4`; mimo něj (starší účty, kde se aktivní dny nepočítají) stačí `accDay() >= 7`. Tím dotazník jednou dostanou i stávající uživatelé, což je pro první vlnu žádoucí.
3. Stav `prof.svy.s7`: chybí, nebo `later:YYYY-MM-DD` starší než 7 dní. Ne `done`, ne `no`.
4. Ne ve stejný den jako: připojení do skupiny (`lp_inv_welcome` dnes), changelog, jiná nabídka z fronty (`nudgeSt().last === toDS()`); v jednoduchém režimu musí projít `nudgeFree()` a ukázání se zapíše `nudgeMark()` (bez id, počítá se do limitu 1 za 3 dny).
5. Ne při startu: karta se zařadí nejdřív **30 s po `initApp`**, nebo po první akci v relaci (`actDay`/`installUnlock` volání), podle toho, co nastane dřív, a pak přes `whenUiFree()` (nic jiného otevřené, žádný průvodce, souhlas se zdravím, toast z fronty).
6. Pokud je ten den na Domů už nabídka z fronty (`nudgeForDash()` vrátila kartu), dotazník počká na jiný den.

### 3.3 Odmítnutí
- **„Teď ne“** → `prof.svy.s7 = 'later:<dnes>'`, `prof.svy.n += 1`. Znovu nejdřív za 7 dní. Po **2.** „Teď ne“ se karta už neukáže (jako `no`). Nikdo nemá být otravován třikrát.
- **×** (aria-label „Neukazovat“) → `prof.svy.s7 = 'no'`, konec.
- **Zavření okna s otázkami bez odeslání** (×, Zpět, klepnutí vedle) = jako „Teď ne“; rozepsaný text se drží v paměti do konce relace.
- Stav je v profilu (`users/{uid}/profile/main.svy`), tedy stejný na všech zařízeních. Zápis `updateDoc(... {'svy.s7': v, 'svy.n': increment(1)})`.
- Kartu zobrazit jen v den prvního ukázání a dál, dokud neodpoví (jako `nudge.cur`), aby nezmizela při každém překreslení.

### 3.4 Okno s otázkami

```
┌──────────────────────────────────────┐
│ 💬 Tři rychlé otázky             ×   │
│                                      │
│ 1. Co ti v LifePocket nejvíc pomáhá? │
│    Vyber nejvýš dvě.                 │
│  [🧺 Nákupy] [🗓️ Kalendář] [🔥 Návyky]│  čipy 44 px, aria-pressed
│  [🥗 Jídelníček] [🤝 Sdílení s rodinou]│
│  [🤖 AI parťák] [✏️ Něco jiného]     │
│                                      │
│ 2. Co ti chybí nebo co tě štve?      │
│  ┌────────────────────────────────┐  │
│  │ Třeba: chybí mi sdílené        │  │  textarea 16 px, 3 řádky, max 500
│  │ poznámky…                      │  │
│  └────────────────────────────────┘  │
│                                      │
│ 3. Jak se ti LifePocket zatím líbí?  │  bez rodu (ne „spokojený/á“)
│    (nepovinné)                       │
│   [😣] [😕] [😐] [🙂] [😍]           │  5 × 48 px, role=radiogroup
│   vůbec              moc             │
│                                      │
│  [            Odeslat             ]  │  aktivní, jakmile je cokoli vyplněné
│  Odpovědi čte autor appky. Jméno ani │  14 px --text2
│  e-mail se k nim neukazují.          │
└──────────────────────────────────────┘
```

Čipy otázky 1: jen **zapnuté moduly** (`hasMod`) z `shopping`, `calendar`, `habits`, `mealplan`, `goals`, `cooking`, `journal`, `checklist`, `water`, `finance`, `pets`, dále „🤝 Sdílení s rodinou“ jen když `myGroupIds().length > 0`, „🤖 {jméno parťáka}“ když je zapnutý `rex`, a vždy „✏️ Něco jiného“. Pořadí: sdílení a parťák (naše odlišnosti) hned za prvními třemi moduly, ať nezapadnou. Třetí čip: automatické odznačení prvního by mátlo, proto **třetí klepnutí nic nevybere a pod čipy se ukáže „Vyber nejvýš dvě“** (`aria-live="polite"`).

Hodnocení: tlačítka `role="radio"`, `aria-label` „1 z 5, vůbec“ … „5 z 5, moc“, vybrané má `border:2px solid var(--accent)` a `aria-checked="true"`; druhé klepnutí na vybrané hodnocení zruší.

CSS:
```css
.svy-q{font-weight:700;color:var(--text);margin:16px 0 8px;font-size:16px}
.svy-chips{display:flex;flex-wrap:wrap;gap:8px}
.svy-chip{min-height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-size:15px}
.svy-chip[aria-pressed="true"]{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
.svy-rate{display:flex;justify-content:space-between;gap:6px;max-width:320px}
.svy-rate button{width:48px;height:48px;border-radius:50%;border:1px solid var(--border2);background:var(--card2);font-size:24px}
.svy-rate button[aria-checked="true"]{border:2px solid var(--accent);transform:scale(1.08)}
.svy-ends{display:flex;justify-content:space-between;max-width:320px;font-size:13px;color:var(--text2)}
.svy-note{font-size:14px;color:var(--text2);text-align:center;margin-top:10px}
#svy-txt{width:100%;min-height:84px;font-size:16px;border-radius:10px;border:1px solid var(--border);background:var(--card2);color:var(--text);padding:10px 12px;box-sizing:border-box}
```
Okno: stávající `.moverlay` + `.modal` (id `svy-modal`); `uiBusy()` ho chytí přes `.moverlay.open`.

**Po odeslání** (obsah okna se vymění, nezavírá se samo):
- vždy „Díky moc! 💛 Každou odpověď čteme.“
- hodnocení 4–5: navíc „Pomůže nám, když LifePocket pošleš někomu, komu by se hodil.“ + tlačítko „📤 Doporučit LifePocket“ (`shareApp()`) a „Zavřít“. Tady je přirozená chvíle na doporučení.
- hodnocení 1–2: „Mrzí nás to. Chceš nám napsat víc? Odpovíme ti.“ + tlačítko „✉️ Napsat nám“ (otevře stávající formulář „Napiš nám“ v Nastavení, text otázky 2 předvyplní) a „Zavřít“.
- jinak jen „Zavřít“.

### 3.5 Texty

| Klíč | CS | EN |
|---|---|---|
| `svy.card.t` | Jak se ti zatím daří? | How’s it going so far? |
| `svy.card.d` | Máš za sebou týden s LifePocket. Pomůžeš nám třemi rychlými otázkami? Zabere to minutu. | You’ve had LifePocket for a week. Could you help us with three quick questions? It takes a minute. |
| `svy.card.btn` | Odpovědět | Answer |
| `svy.later` | Teď ne | Not now |
| `svy.never` | Neukazovat | Don’t show again |
| `svy.title` | Tři rychlé otázky | Three quick questions |
| `svy.q1` | Co ti v LifePocket nejvíc pomáhá? | What helps you most in LifePocket? |
| `svy.q1h` | Vyber nejvýš dvě. | Pick up to two. |
| `svy.q1max` | Vyber nejvýš dvě. | Pick up to two. |
| `svy.o.share` | 🤝 Sdílení s rodinou | 🤝 Sharing with family |
| `svy.o.ai` | 🤖 {av} | 🤖 {av} |
| `svy.o.other` | ✏️ Něco jiného | ✏️ Something else |
| `svy.q2` | Co ti chybí nebo co tě štve? | What’s missing or bugging you? |
| `svy.q2ph` | Třeba: chybí mi sdílené poznámky… | E.g. I’d love shared notes… |
| `svy.q3` | Jak se ti LifePocket zatím líbí? | How do you like LifePocket so far? |
| `svy.opt` | (nepovinné) | (optional) |
| `svy.r1`…`svy.r5` | 1 z 5, vůbec · 2 z 5 · 3 z 5 · 4 z 5 · 5 z 5, moc | 1 of 5, not at all · 2 of 5 · 3 of 5 · 4 of 5 · 5 of 5, a lot |
| `svy.lo` / `svy.hi` | vůbec / moc | not at all / a lot |
| `svy.send` | Odeslat | Send |
| `svy.sending` | Odesílám… | Sending… |
| `svy.note` | Odpovědi čte autor appky. Jméno ani e-mail se k nim neukazují. | Answers are read by the app’s author. Your name and email aren’t shown with them. |
| `svy.thanks` | Díky moc! 💛 Každou odpověď čteme. | Thanks a lot! 💛 We read every answer. |
| `svy.shareQ` | Pomůže nám, když LifePocket pošleš někomu, komu by se hodil. | It really helps if you send LifePocket to someone who’d find it useful. |
| `svy.shareBtn` | 📤 Doporučit LifePocket | 📤 Recommend LifePocket |
| `svy.sorry` | Mrzí nás to. Chceš nám napsat víc? Odpovíme ti. | Sorry to hear that. Want to tell us more? We’ll get back to you. |
| `svy.writeBtn` | ✉️ Napsat nám | ✉️ Write to us |
| `svy.fail` | Odeslání se nepovedlo. Zkus to prosím za chvíli. | Couldn’t send. Please try again in a moment. |
| `svy.aria` | Krátký dotazník | Short survey |

Moduly v čipech: stávající `mod.*` s emoji z `MODS`. (`svy.q1max` = stejný text jako nápověda, ale samostatný klíč pro `aria-live`.)

### 3.6 Kam se ukládá (bez změny pravidel i indexů)

**Doporučení: `users/{uid}/feedback/survey7`** (pevné ID dokumentu).
- Pravidlo `users/{userId}/{document=**}` (jen vlastník) zápis pustí, **pravidla se nemění**.
- Kolekce `feedback` už existuje pro „Napiš nám“: je v exportu dat, maže se s účtem (`recursiveDelete`), **collection-group index na `createdAt` už je nasazený** (`firestore.indexes.json`), `adminOverview` ji čte a `ADM_FB_PATH_RE` ID `survey7` projde. Dotazník tak Adam uvidí v appce **hned bez nasazení funkcí** (záložka Zprávy), agregace je jen bonus.
- Pevné ID: druhé zařízení nebo opakované odeslání dokument přepíše, žádné duplicity.
- Top-level `feedback/{id}` by potřeboval nové pravidlo (`config/**` i ostatní kořeny jsou zavřené) → **nedoporučuji**.

Dokument:
```js
{
  createdAt: serverTimestamp(),  // kvůli indexu a řazení v adminOverview
  kind: 'survey7',
  v: APP_VERSION, lang: LANG,
  accDay: accDay(),              // kolikátý den účtu
  helps: ['shopping','share'],   // max 2, jen ID z allowlistu: moduly z MODS + 'share' + 'ai' + 'other'
  missing: '…',                  // max 500 znaků, trim
  rating: 4,                     // 1–5 nebo null
  grp: true,                     // je ve skupině (bez ID skupiny)
  msg: '⭐ 4/5 · Pomáhá: Nákupy, Sdílení · Chybí: …'  // lidsky čitelné shrnutí (max 2000) pro stávající seznam Zpráv
}
```
`msg` skládat **v češtině vždy** (čte ho Adam), ne v jazyce uživatele. Zápis s timeoutem 10 s jako u „Napiš nám“; při chybě `svy.fail`, stav `svy.s7` se nemění (karta zůstane). Po úspěchu `svy.s7 = 'done'`.

Soukromí: `privacy.html` bod o `feedback` doplnit větou: „Stejně se uloží i odpovědi z krátkého dotazníku po prvním týdnu (co ti pomáhá, co chybí, hodnocení 1–5); slouží ke zlepšování aplikace a vidí je jen správce aplikace.“ (+ stejná věta anglicky v `privacy-en.html`).

### 3.7 Jak to Adam uvidí

**Hned (bez změny funkcí):** Nastavení → 📊 Přehled (adminOverview) → záložka Zprávy: řádky „⭐ 4/5 · Pomáhá: …“ mezi zprávami „Napiš nám“.

**Po úpravě funkcí (doporučeno, nasadí se samo po pushi):**
1. `dailyStats` krok 7: `db.collectionGroup('feedback').where('createdAt','>=', Timestamp.fromMillis(now - DAY)).get()` (existující index), v paměti filtr `kind === 'survey7'`, zapsat do `config/stats_daily/days/{den}`:
   - `svyN` (počet odpovědí), `svyRatingN`, `svyRatingSum` (průměr si spočítá přehled), `svyTextN` (kolik vyplnilo otázku 2),
   - `svyHelps`: mapa `{shopping: 3, share: 2, ai: 1, …}` jen s klíči z allowlistu (cizí klíče zahodit).
   - Nikdy texty, uid ani jména (v souladu s komentářem u dailyStats).
2. `adminOverview`: `ADM_STAT_KEYS` + `svyN`, `svyRatingN`, `svyRatingSum`; `svyHelps` sečíst za 14 dní na serveru do `out.survey = {n, avg, helps:{…}, textN}`; do `select()` u feedback přidat `kind` a `rating`, ať klient umí filtrovat.
3. Klient (admin přehled): čtvrtá záložka **„Dotazník“**: nahoře souhrn za 14 dní („23 odpovědí · průměr 4,2 · nejvíc pomáhá: Nákupy 14, Sdílení 9, Parťák 6“ jako vodorovné pruhy, ne graf), pod tím posledních 30 textů „Co chybí“ (z existujícího seznamu feedback s `kind === 'survey7'`), u každého hodnocení, verze a zkrácené uid. V záložce Zprávy pak `survey7` nezobrazovat.

### 3.8 Edge cases
- **Offline při odeslání**: tlačítko Odeslat zakázat s „Jsi offline“ (stávající `err.offline`), nic nezapisovat.
- **Dvě zařízení**: stav v profilu; karta se před ukázáním opírá o čerstvý `prof` (v jednoduchém režimu `nudgeSync()`), `survey7` s pevným ID.
- **Účet smazaný**: dokument zmizí s `recursiveDelete`, v `stats_daily` zůstanou jen počty.
- **Jazyk EN**: čipy a otázky přeložené; `msg` pro Adama česky.
- **Admin sám**: vidí dotazník jako ostatní (otestuje ho).
- **Ukázkový / testovací účet** (Google Play recenze apod.): neřešit, počty jsou malé.
- **Nová verze dotazníku** později: nové ID (`survey30` po 30 dnech), stav `svy.s30`; tento návrh nic nepředjímá.

### 3.9 Rozsah
- Klient (karta, okno, stav, zápis, admin záložka): **M**, ≈ 1 den.
- Funkce (`dailyStats` krok 7, `adminOverview`): **S**, ≈ 2–3 h; nasadí GitHub Actions.
- `privacy.html`: drobnost.
- **Bez změny `firestore.rules` a `firestore.indexes.json`.**

---

## Shrnutí pro kodéra

| Bod | Soubory | Rozsah | Pravidla |
|---|---|---|---|
| 1 Landing | index.html (blok `#lp-landing`), style.css (LOGIN), i18n/cs.js, i18n/en.js | S | beze změny |
| 2 Pozvánka | index.html (inline rychlý start), app.js (`capturePendingJoin`, `stripJoinParam`, `inAppLink`, `initLoginScreen`, `groupInviteUrl`, `showJoinInviteModal`, `confirmPendingJoin`, detail skupiny ř. ~13537, dialog rotace), style.css, i18n | M (+ S–M volitelný push) | beze změny |
| 3 Dotazník | app.js (karta na Domů vedle `nudgeForDash`, okno, `prof.svy`, admin záložka), functions/index.js (`dailyStats`, `adminOverview`), style.css, i18n, privacy.html | M + S | beze změny |

Pořadí: **1 → 2 → 3** (landing nejlevnější a ovlivní každého nového návštěvníka; pozvánka zvedá růst přes rodiny; dotazník dává smysl, až bude kam lidi přivádět).

Testy (statické, tester): obě slovníky stejné klíče; landing bez/s `?join=`, s/bez `od`, s neplatným `co`; okno pozvánky ve všech 6 stavech (simulace v node nad `showJoinInviteModal`); dotazník: podmínky 3.2 v node (`accDay`, `actN`, `svy.s7` stavy, 2× Teď ne → konec), allowlist `helps`, délka `missing`, `msg` česky.

---

# Archiv: kolo 1 (4.27, 2026-10-07, implementováno)


Výchozí stav, ze kterého návrh vychází (ověřeno v kódu):
- Nový návštěvník má téma **sunshine** (světlé), viz `loadTheme()` v app.js (`lp_theme || 'sunshine'`). Landing proto uvidí většina lidí **světlý**. Všechno níže používá jen tokeny `var(--…)`, takže funguje ve všech třech tématech (dark-gold, sunshine, tangerine).
- `meta theme-color` je teď `#faf8f0` a za běhu ho přepisuje `setTheme()` přes `querySelector('meta[name="theme-color"]')`, tedy **jen první** takovou značku. Druhou značku (např. s `media=`) nepřidávat.
- Přihlašovací obrazovka `#s-login` má jednu `.card` (ikona, `.logo-name`, `.logo-tag`, mřížka `.feats`, Google, e-mail, chyba, odkazy).
- Pozvánky: `shareGroupInvite(gid)` posílá `https://lifepocket.app/?join=KÓD`, `capturePendingJoin()` si kód uloží do `lp_pending_join` už před přihlášením.

Společná pravidla pro kodéra:
- Uživatelský text (název skupiny, jméno) do HTML vždy přes `esc()`, do handlerů přes `data-aN` / `data-gid`.
- Dotykové plochy alespoň 44×44 px. Vstupy na mobilu `font-size:16px` (pod 16 px iOS při fokusu zoomuje).
- Tlačítka s textem na `var(--accent)`: v tangerine má `#1a1a1a` na `#c94800` kontrast jen 3,7 : 1. Zavádím token `--on-accent` (níže) a v nových prvcích ho používám.
- Verze: `APP_VERSION` 4.26 → 4.27, záznam v `CHANGELOG`, `CACHE` v sw.js `lifepocket-v20` → `v21`.

Nový token (style.css, ke každému tématu):
```css
:root,[data-theme="dark-gold"],[data-theme="sunshine"]{--on-accent:#1a1a1a}
[data-theme="tangerine"]{--on-accent:#ffffff}
[hidden]{display:none!important}
```
Řádek s `[hidden]` je pojistka: nové sekce se přepínají atributem `hidden` a nesmí ho přebít žádné `display:flex`.

---

## 1. Landing pro nepřihlášené (uvnitř `#s-login`)

### Princip
Jedna obrazovka, dva stavy ve stejné `.card`:
1. **`#lp-landing`**: krátké představení a dvě tlačítka.
2. **`#auth-panel`**: stávající přihlášení (Google a e-mail) beze změny ID a handlerů.

„Začít zdarma“ otevře panel v režimu registrace, „Mám účet“ v režimu přihlášení. Kdo appku už zná, landing nevidí: když v `localStorage` je `lp_owner_uid` (někdy se tu přihlásil) nebo běží appka z plochy (`isStandaloneApp()`), otevře se rovnou `#auth-panel` v režimu přihlášení. Po odhlášení (`doLogout` → reload) tak člověk skončí rovnou u přihlášení.

Pořadí bloků vědomě měním oproti zadání: **tlačítka jsou hned pod hero větou, výhody až pod nimi.** Na 360×640 (reálně asi 360×560 s lištou prohlížeče) by se při pořadí hero → 4 výhody → tlačítka dostalo „Začít zdarma“ pod okraj obrazovky. Takhle je hlavní akce vidět bez scrollu a v dosahu palce, výhody si přečte ten, kdo scrolluje.

### Před / po (schéma mobilu 360 px)
```
PŘED                          PO (landing)                 PO („Začít zdarma“)
┌──────────────────────┐      ┌──────────────────────┐     ┌──────────────────────┐
│      [ikona 96]      │      │      [ikona 64]      │     │      [ikona 64]      │
│     LifePocket       │      │     LifePocket       │     │     LifePocket       │
│ Jedna appka místo…   │      │ Jedna appka místo    │     │ ← Zpět               │
│ ─────────────────    │      │ deseti. (H1)         │     │   ✨ Nový účet        │
│ [✨ ][🎯 ][🍽️]  3 sl. │      │ Návyky, kalendář…    │     │ [G Pokračovat přes G]│
│ [G Přihlásit přes G] │      │ (Zdarma, bez reklam) │     │ ── nebo e-mailem ──  │
│ ── nebo emailem ──   │      │ [  Začít zdarma   ]  │     │ [E-mail           ]  │
│ 🔑 Přihlásit se      │      │ [    Mám účet     ]  │     │ [Heslo         👁️ ]  │
│ [Email] [Heslo]      │      │ ─ Co v appce najdeš ─│     │ [  Vytvořit účet  ]  │
│ [Přihlásit se]       │      │ 🛒 Nákup pro rodinu  │     │ ← Zpět na přihlášení │
│ Zapomenuté… Regist.→ │      │ 🔥 Návyky a cíle     │     │ 🔒 Zdarma · Firebase │
│ 🔒 Zdarma · …        │      │ ✨ AI společník      │     │ Ochrana · Podmínky   │
│ Ochrana · Podmínky   │      │ 🗓️ Kalendář…         │     └──────────────────────┘
└──────────────────────┘      │ Ochrana · Podmínky   │
                              └──────────────────────┘
```

### HTML (index.html, nahrazuje obsah `<div class="screen" id="s-login">`)
```html
<div class="screen" id="s-login">
  <div class="card lp-card">
    <!-- ZACHOVAT beze změny: ikona (base64 img) a název -->
    <div class="app-icon-wrap"><img class="app-icon" src="data:image/png;base64,…" alt=""></div>
    <div class="logo-name">LifePocket</div>

    <!-- ── LANDING ── -->
    <section id="lp-landing" aria-labelledby="lp-hero-t">
      <h1 class="lp-hero" id="lp-hero-t">Jedna appka místo deseti.</h1>
      <p class="lp-sub">Návyky, kalendář, nákupy i poznámky na jednom místě. A celá rodina vidí, co je potřeba.</p>

      <div class="lp-invite" id="lp-invite" hidden>
        <span aria-hidden="true">🔗</span>
        <span>Máš pozvánku do skupiny. Založ si účet nebo se přihlas a hned se připojíš.</span>
      </div>

      <div class="lp-free">Zdarma, bez reklam, česky</div>

      <div class="lp-ctas">
        <button type="button" class="btn-p" id="lp-start-btn" onclick="showAuthPanel('register')">Začít zdarma</button>
        <button type="button" class="btn-s lp-have" onclick="showAuthPanel('login')">Mám účet</button>
      </div>

      <h2 class="lp-sec">Co v appce najdeš</h2>
      <ul class="lp-benefits">
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🛒</span>
          <div><div class="lp-b-t">Nákup pro celou rodinu</div>
          <div class="lp-b-d">Jeden seznam pro všechny. Co koupí partner, tobě se hned odškrtne.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🔥</span>
          <div><div class="lp-b-t">Návyky a cíle</div>
          <div class="lp-b-d">Sleduj série, plň malé kroky a koukej, jak se posouváš.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">✨</span>
          <div><div class="lp-b-t">AI společník</div>
          <div class="lp-b-d">Rex, Nora nebo jiný parťák ti poradí recept, naplánuje týden a podrží tě, když se nedaří.</div></div>
        </li>
        <li class="lp-benefit">
          <span class="lp-b-em" aria-hidden="true">🗓️</span>
          <div><div class="lp-b-t">Kalendář a připomínky</div>
          <div class="lp-b-d">Narozeniny, kroužky i schůzky. Upozornění ti přijde do telefonu.</div></div>
        </li>
      </ul>

      <div class="lp-legal">
        <a href="privacy.html" target="_blank" rel="noopener">Ochrana osobních údajů</a> ·
        <a href="terms.html" target="_blank" rel="noopener">Podmínky použití</a>
      </div>
    </section>

    <!-- ── PŘIHLÁŠENÍ (stávající prvky) ── -->
    <section id="auth-panel" hidden aria-labelledby="auth-mode-lbl">
      <button type="button" class="lp-back" onclick="showLanding()">← Zpět</button>
      <!-- auth-mode-lbl přesunut NAHORU panelu, jinak beze změny -->
      <div id="auth-mode-lbl" tabindex="-1" style="…stávající…">🔑 Přihlásit se</div>

      <button class="google-btn" id="login-btn" onclick="window.doLogin()" style="margin-bottom:14px">
        <svg …stávající…></svg>
        Pokračovat přes Google
      </button>
      <!-- oddělovač: text „nebo e-mailem“ -->
      <div id="email-login-form" …>
        <input id="email-inp" type="email" placeholder="E-mail" aria-label="E-mail" autocomplete="email" inputmode="email" …>
        <div …>
          <input id="pass-inp" type="password" placeholder="Heslo" aria-label="Heslo" autocomplete="current-password" …>
          <button type="button" id="pass-eye-btn" aria-label="Zobrazit heslo" …>👁️</button>
        </div>
        <button class="btn-p" id="email-login-btn" onclick="window.doEmailLogin()" …>Přihlásit se</button>
        <div id="email-register-fields" style="display:none;…">…beze změny…</div>
        <div class="lp-auth-links">
          <button type="button" class="lp-link" id="login-forgot" onclick="window.doPasswordReset()">Zapomenuté heslo?</button>
          <button type="button" class="lp-link" id="login-toggle-reg" onclick="window.toggleLoginMode('register')">Registrovat se →</button>
          <button type="button" class="lp-link" id="login-toggle-login" style="display:none" onclick="window.toggleLoginMode('login')">← Zpět na přihlášení</button>
        </div>
      </div>
      <div class="err" id="login-err" role="alert"></div>
      <div class="privacy">🔒 Zdarma · Data ve Firebase · AI přes Anthropic</div>
      <div class="lp-legal">…stejné dva odkazy…</div>
    </section>
  </div>
</div>
```

### Co se MUSÍ zachovat (jinak se rozbije přihlášení)
| Prvek | Proč |
|---|---|
| `#s-login` (id a třída `screen`) | `ss('s-login')` v `onAuthStateChanged` a v tlačítku „← Zpět“ na `#s-step1`. |
| `#login-btn` a `onclick="window.doLogin()"` | `doLogin()` a `resetLoginBtn()` ho hledají podle id a přepisují mu `innerHTML`. |
| `#email-inp`, `#pass-inp` | čtou je `doEmailLogin`, `doEmailRegister`, `doPasswordReset`, `togglePassVis`. |
| `#pass-eye-btn` | `togglePassVis()` mění text. |
| `#email-login-btn` | `toggleLoginMode()` mu mění text a `onclick`, `doEmail*` ho zakazují. |
| `#email-register-fields` | zůstává (i když je skrytý). |
| `#login-forgot`, `#login-toggle-reg`, `#login-toggle-login` | `toggleLoginMode()` přepíná `style.display` (`block`/`none`). Funguje i na `<button>`. |
| `#auth-mode-lbl` | `toggleLoginMode()` přepisuje text. |
| `#login-err` (třída `err`, `.show`) | všechny chybové hlášky. |
| `.app-icon`, `.logo-name` | jen vzhled, ale ponechat kvůli značce. |

Odstraňuje se: `.logo-tag`, `.divider` a mřížka `.feats` (nahrazuje je landing). CSS pro `.feats` může zůstat, nikde jinde se nepoužívá, smazat až při úklidu.

### JS (app.js, hned za `loadTheme();` kolem ř. 2645)
```js
// ── Landing / přihlášení ──
function showAuthPanel(mode){
  const l=document.getElementById('lp-landing'), a=document.getElementById('auth-panel');
  if(!l||!a) return;
  l.hidden=true; a.hidden=false;
  window.toggleLoginMode(mode==='register'?'register':'login');
  window.scrollTo(0,0);
  document.getElementById('auth-mode-lbl')?.focus({preventScroll:true}); // čtečka ohlásí „Nový účet“
}
window.showAuthPanel=showAuthPanel;
window.showLanding=()=>{
  document.getElementById('auth-panel').hidden=true;
  document.getElementById('lp-landing').hidden=false;
  document.getElementById('login-err')?.classList.remove('show');
  document.getElementById('lp-start-btn')?.focus({preventScroll:true});
};
function initLoginScreen(){
  let known=false; try{ known=!!localStorage.getItem('lp_owner_uid'); }catch(e){}
  if(known || isStandaloneApp()) showAuthPanel('login');
  const inv=document.getElementById('lp-invite');
  if(inv) inv.hidden=!readPendingJoin();
}
initLoginScreen();
```
- `readPendingJoin` a `isStandaloneApp` jsou deklarace funkcí v modulu, volání po nich funguje. `capturePendingJoin()` ale musí proběhnout **dřív** než `initLoginScreen()` (je na ř. ~4419). Volání `initLoginScreen()` proto dej **za** `capturePendingJoin();`, ne za `loadTheme()`.
- `toggleLoginMode()` doplnit o dvě věci: `pass-inp.autocomplete = isReg ? 'new-password' : 'current-password'` a u `#login-toggle-*` ponechat `display:'block'`.
- `resetLoginBtn()`: text `Přihlásit se přes Google` → `Pokračovat přes Google` (stejně jako ve statickém HTML, platí pro registraci i přihlášení).
- `togglePassVis()`: kromě textu měnit i `aria-label` („Zobrazit heslo“ / „Skrýt heslo“).
- Inline `onclick` v HTML volá `showAuthPanel` a `showLanding` přes `window`, proto přiřazení do `window`.

### CSS (style.css, za blok `/* LOGIN */`)
```css
/* LANDING */
.lp-hero{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:28px;line-height:1.2;color:var(--text);text-align:center;margin:14px 0 8px}
.lp-sub{font-size:17px;line-height:1.45;color:var(--text2);text-align:center;margin:0 auto 14px;max-width:34ch}
.lp-free{display:block;width:max-content;margin:0 auto 16px;padding:6px 14px;border:1px solid var(--border2);border-radius:50px;font-size:14px;font-weight:600;color:var(--green)}
.lp-ctas{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
.lp-ctas .btn-p{min-height:52px}
.lp-have{width:100%;min-height:48px;font-size:16px;color:var(--text);font-weight:600}
.lp-sec{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--text2);text-align:center;margin:0 0 10px}
.lp-benefits{list-style:none;display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.lp-benefit{display:flex;gap:12px;align-items:flex-start;background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
.lp-b-em{width:40px;height:40px;flex-shrink:0;border-radius:12px;background:var(--card3);display:flex;align-items:center;justify-content:center;font-size:22px}
.lp-b-t{font-size:16px;font-weight:700;color:var(--text);line-height:1.3}
.lp-b-d{font-size:14px;color:var(--text2);line-height:1.4;margin-top:2px}
.lp-invite{display:flex;gap:8px;align-items:flex-start;background:var(--card2);border:1px solid var(--accent);border-radius:12px;padding:10px 12px;font-size:15px;color:var(--text);margin-bottom:14px}
.lp-legal{text-align:center;font-size:13px;color:var(--text2);margin-top:10px}
.lp-legal a{color:var(--text2);text-decoration:underline;display:inline-block;padding:10px 4px}
.lp-back{background:none;border:none;color:var(--text2);font-family:'Crimson Pro',serif;font-size:15px;min-height:44px;padding:0 8px 0 0;cursor:pointer;margin:6px 0 2px}
.lp-auth-links{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px}
.lp-link{background:none;border:none;color:var(--accent);font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;min-height:44px;padding:0 4px;cursor:pointer}
.lp-card :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#s-login .card{width:440px}
#email-inp,#pass-inp{font-size:16px!important}
@media(max-width:480px){
  .screen>.card{padding:24px 18px;border-radius:24px}
  #s-login .app-icon{width:64px;height:64px;border-radius:16px}
  #s-login .logo-name{font-size:30px}
  .lp-hero{font-size:26px}
}
@media(prefers-reduced-motion:reduce){.app-icon{animation:none}.screen.active{animation:none}}
[data-theme="tangerine"] .logo-name{background:linear-gradient(135deg,#c94800,#b03a0a);-webkit-background-clip:text;background-clip:text}
```

Na co si dát pozor:
- `.card` se používá i pro widget Focus na dashboardu. Mobilní pravidlo proto cílí jen na `.screen>.card` (platí pro login a onboarding, kde se padding 44/40 px na 360 px stejně nevejde).
- `.lp-link` v sunshine: `#d4870a` na bílé má kontrast asi 3 : 1. Je to stejné jako dnes, ale tlačítka jsou nově 15px tučně a mají plochu 44 px. Pokud to revizor bude chtít řešit, změnit barvu na `var(--text)` s podtržením (backlog, neblokuje).
- Staré odkazy `color:#6a6a88` jsou nahrazené `var(--text2)` (na tmavé kartě měly kontrast pod 4,5 : 1).
- `.err` má natvrdo `#ff8080`, na bílé kartě je kontrast nízký. Doporučení (stačí jeden řádek): `[data-theme="sunshine"] .err,[data-theme="tangerine"] .err{color:var(--red)}`.
- Plovoucí banner „Nainstaluj LifePocket“ (`#pwa-banner`, `bottom:76px`) může na landingu překrýt výhody. Tlačítka jsou nahoře, takže to nevadí, jen ověřit, že banner nepřekryje „Mám účet“ na malém displeji.
- Text „AI společník“: mluvím o „Rexovi, Noře nebo jiném parťákovi“, protože si uživatel společníka vybírá v kroku 2 (`AVS`). Jen „Rex“ by sliboval něco, co si člověk pak přepne.

---

## 2. Meta a OG značky (index.html, `<head>`)

Stávající `<meta name="theme-color" content="#faf8f0">` **ponechat jako jedinou** (viz úvod). Ostatní přidat pod `<title>`:

```html
<title>LifePocket – návyky, kalendář a sdílené nákupy pro rodinu</title>
<meta name="description" content="Sdílený nákupní seznam pro rodinu, návyky, cíle, kalendář s připomínkami a AI společník. Česky, zdarma a bez reklam. Funguje v telefonu jako aplikace.">
<link rel="canonical" href="https://lifepocket.app/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="LifePocket">
<meta property="og:locale" content="cs_CZ">
<meta property="og:url" content="https://lifepocket.app/">
<meta property="og:title" content="LifePocket – jedna appka místo deseti">
<meta property="og:description" content="Společný nákup pro celou rodinu, návyky, kalendář a AI společník. Česky, zdarma, bez reklam.">
<meta property="og:image" content="https://lifepocket.app/og-image.png?v=1">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="LifePocket – jedna appka místo deseti. Sdílený nákup, návyky, kalendář a AI společník.">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LifePocket – jedna appka místo deseti">
<meta name="twitter:description" content="Společný nákup pro celou rodinu, návyky, kalendář a AI společník. Česky, zdarma, bez reklam.">
<meta name="twitter:image" content="https://lifepocket.app/og-image.png?v=1">
```
- URL obrázku musí být **absolutní**. Při každé změně obrázku zvýšit `?v=` (Facebook a WhatsApp náhledy dlouho cachují). Po nasazení ověřit ve Facebook Sharing Debuggeru.
- Odkaz `?join=KÓD` dostane stejný náhled, což je v pořádku.
- `title` je delší kvůli vyhledávačům. Název ikony na ploše se bere z `apple-mobile-web-app-title` a z manifestu, takže se nezmění.
- `og-image.png` nepatří do precache v sw.js.

### Náhledový obrázek 1200×630 (`/og-image.png`)
Tmavé pozadí se zlatou, stejně jako ikona appky. V tmavém i světlém feedu působí výrazně. Bez screenshotů, vpravo vektorová ilustrace sdíleného seznamu (ukazuje hlavní důvod sdílení).

```
0,0 ───────────────────────────────────────────────────────────── 1200
│  [ikona 120×120 @ (80,72), rx 28]                                 │
│                                                ┌───────────────┐  │
│  LifePocket            (y=300)                 │ 🧺 Nákup·Rodina│  │
│  Jedna appka místo deseti.  (y=372)            │ ✓ Mléko     (M)│  │
│                                                │ ✓ Rohlíky   (T)│  │
│  [🛒 Sdílený nákup] [🔥 Návyky a cíle] (y=420) │ ○ Jablka    (M)│  │
│  [🗓️ Kalendář    ] [✨ AI společník ] (y=492)  │ ○ Káva      (T)│  │
│                                                └───────────────┘  │
│  Zdarma · bez reklam · lifepocket.app   (y=588)                   │
└──────────────────────────────────────────────────────────────── 630
```

Přesné hodnoty pro SVG:
| Prvek | Pozice a velikost | Styl |
|---|---|---|
| Pozadí | 0,0 1200×630 | `#0c0c10` |
| Záře 1 | kruh cx 1080 cy 40 r 420 | `#f5c842`, opacity .16, `feGaussianBlur stdDeviation=120` |
| Záře 2 | kruh cx 80 cy 640 r 360 | `#e0954a`, opacity .12, stejný blur |
| Ikona | `<image href="icon-512.png">` x 80 y 72 w/h 120, clipPath rect rx 28 | jemný stín `#f5c842` opacity .25 |
| Název | text „LifePocket“, x 80, baseline y 300 | Playfair Display Italic 700, 88 px, výplň lineární gradient `#f5c842` → `#e0954a` → `#f5c842` (45°) |
| Hero | „Jedna appka místo deseti.“, x 80, baseline y 372 | Crimson Pro 600, 48 px, `#f0f0f5` |
| Čipy (2×2) | řádek 1 y 420, řádek 2 y 492, výška 56, rx 28; sloupec 1 x 80, sloupec 2 x 80+šířka1+16; šířka podle textu, vnitřní okraj 24 px | výplň `rgba(245,200,66,.08)`, obrys `rgba(245,200,66,.35)` 2 px, text Crimson Pro 600 28 px `#f0f0f5`, baseline +38 od horní hrany čipu |
| Texty čipů | „🛒 Sdílený nákup“, „🔥 Návyky a cíle“, „🗓️ Kalendář“, „✨ AI společník“ | |
| Patička | x 80, baseline y 588: „Zdarma · bez reklam · “ + „lifepocket.app“ | Crimson Pro 600 30 px, první část `#9090a8`, doména `#f5c842` |
| Karta seznamu | rect x 760 y 120 w 360 h 400, rx 28 | výplň `#16161c`, obrys `#252532` 2 px, stín `rgba(0,0,0,.5)` blur 40 |
| Hlavička karty | „🧺 Nákup · Rodina“, x 792 baseline y 176 | Playfair Display Italic 700, 30 px, `#f5c842` |
| Oddělovač | čára x 792–1088, y 200 | `#252532` 2 px |
| Položky (4) | řádky baseline y 260, 326, 392, 458; x 792 značka, x 836 text | značka: hotovo = kruh r 14 vyplněný `#3dd68c` s ✓ `#0c0c10`; nehotovo = kruh r 14 obrys `#52526a` 2 px. Text Crimson Pro 600 30 px: hotové `#9090a8` přeškrtnuté, nehotové `#f0f0f5` |
| Iniciály (kdo přidal) | kruh r 18 cx 1072, cy = baseline −10; M = `#5b9cf6`, T = `#e0954a` | písmeno Crimson Pro 700 20 px `#0c0c10`, na střed |

Technické poznámky ke skriptu (SVG → PNG):
- Renderer (resvg/sharp) **nestahuje webové fonty**. Fonty Crimson Pro a Playfair Display (TTF z Google Fonts) musí ležet lokálně a být předané rendereru.
- **Emoji:** bez nainstalovaného *Noto Color Emoji* se vykreslí prázdné čtverečky. Buď font přidat, nebo emoji v čipech a v hlavičce karty vynechat (layout funguje i bez nich, šířku čipů pak spočítat bez nich).
- Šířku čipů měřit až s načteným fontem, ne odhadem.
- Výsledné PNG držet **pod 300 kB** (WhatsApp větší náhledy někdy nezobrazí). Případně použít `pngquant`.
- Důležitý text je vlevo do x 700. WhatsApp na úzkém náhledu ořízne čtverec ze středu, logo a název tam zůstanou aspoň částečně, karta seznamu doplní obsah. Okraj 72 px od hran je bezpečný.
- Zdroj SVG uložit vedle skriptu (např. `scripts/og-image.svg`), PNG do kořene repa jako `og-image.png`.

---

## 3. „Sdílet LifePocket“ v Nastavení

### Umístění
Sekce „👨‍👩‍👧 Skupiny & sdílení“ (`index.html`, `.setsec` kolem ř. 864) obsahuje i podporu, dokumenty, kontakt a odhlášení. Nový blok vlož **těsně před nadpis `☕ Podpořit projekt`**: doporučení je nejlevnější forma podpory a dává smysl hned pod skupinami.

```html
<div class="setsec-t" style="margin-top:20px">💛 Doporuč LifePocket</div>
<div class="setsec-d">Nejvíc pomůžeš, když o appce řekneš kamarádům. Stačí jedno klepnutí.</div>
<button type="button" class="share-app-btn" onclick="shareApp()">📤 Sdílet LifePocket</button>
```
```css
.share-app-btn{width:100%;min-height:48px;background:var(--accent);color:var(--on-accent);border:none;border-radius:12px;font-family:'Crimson Pro',serif;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:20px}
.share-app-btn:focus-visible{outline:2px solid var(--text);outline-offset:2px}
```

### Text a logika (app.js, vedle `shareGroupInvite`, ř. ~4387)
```js
window.shareApp = async () => {
  const url  = 'https://lifepocket.app/';
  const text = 'Používám LifePocket: návyky, kalendář, poznámky a společný nákupní seznam pro celou rodinu v jedné appce. Česky, zdarma a bez reklam.';
  if (navigator.share) {
    try { await navigator.share({ title: 'LifePocket', text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; } // NotAllowedError apod. → kopírování
  }
  try { await navigator.clipboard.writeText(text + '\n' + url); toast('📋 Zkopírováno, vlož to kamarádům'); }
  catch (e) { prompt('Zkopíruj si odkaz:', url); }
};
```
- URL **nedávat do `text`**. Android jinak v některých aplikacích (WhatsApp) zobrazí odkaz dvakrát.
- Žádná uživatelská data, takže `esc()` není potřeba. Pokud se později přidá jméno („Adam tě zve…“), jde jen do textu pro `navigator.share` a schránku, nikdy do `innerHTML`.
- Zrušení sdílení (`AbortError`) je tiché, žádný toast.

---

## 4. Výraznější pozvánka do skupiny (Nákupy a Kalendář)

### Stavy
| Stav | Podmínka | Karta |
|---|---|---|
| `nogroup` | `!familyId` | „Nakupujete ve více lidech? / Plánujete ve více lidech?“ + **Pozvat rodinu** |
| `pending` | `familyId && !familyData` (skupina se právě zakládá) | stejná karta, tlačítko vypnuté „⏳ Chystám skupinu…“ |
| `alone` | ve skupině je 1 člen (`Object.keys(familyData.members).length <= 1`) a modul je sdílený (`shareShop` / `shareCal`) | „Ve skupině „{název}“ jsi zatím jen ty“ + **📤 Poslat pozvánku** |
| žádná karta | 2 a více členů, nebo skupina modul nesdílí (uživatel to tak chtěl), nebo karta zavřená pro tento stav | – |

Zavření se pamatuje **pro stav**: v `lp_ih_shop` / `lp_ih_cal` je uložený stav, ve kterém uživatel kartu zavřel (`'nogroup'` nebo `'alone'`). Když se stav změní (založí skupinu), karta se jednou ukáže znovu s novou výzvou. Klíče přidat do `LOCAL_PERSONAL_KEYS` (app.js ř. 480), ať se při přihlášení jiného účtu na stejném zařízení resetují.

### Texty
| | `nogroup` | `alone` |
|---|---|---|
| Nákupy, nadpis | Nakupujete ve více lidech? | Ve skupině „{esc(název)}“ jsi zatím jen ty |
| Nákupy, popis | Pozvi rodinu a budete mít jeden společný seznam. Co jeden koupí, druhému se hned odškrtne. | Pošli pozvánku a nákup uvidíte společně. |
| Kalendář, nadpis | Plánujete ve více lidech? | Ve skupině „{esc(název)}“ jsi zatím jen ty |
| Kalendář, popis | Pozvi rodinu a narozeniny, kroužky i návštěvy uvidíte všichni v jednom kalendáři. | Pošli pozvánku a události uvidíte společně. |
| Tlačítko | 👨‍👩‍👧 Pozvat rodinu | 📤 Poslat pozvánku |

(Záměrně „jsi zatím jen ty“, ne „jsi sám/sama“: bez rodu.)

### HTML sloty (index.html)
- Nákupy: `<div id="shop-invite-slot"></div>` hned **za** `#shop-empty` (konec `#shop-section-list`). Karta je pod seznamem nebo pod prázdným stavem, nikdy nepřekáží přidávání položek. V záložce Zásoby se schová sama.
- Kalendář: `<div id="cal-invite-slot"></div>` hned **za** `<div id="cal-events-list"></div>` v `.cal-right`.

### Komponenta (generuje JS)
```html
<div class="invite-hint" role="region" aria-label="Pozvánka pro rodinu">
  <span class="invite-hint-em" aria-hidden="true">👨‍👩‍👧</span>
  <div class="invite-hint-body">
    <div class="invite-hint-t">Nakupujete ve více lidech?</div>
    <div class="invite-hint-d">Pozvi rodinu a budete mít jeden společný seznam…</div>
    <button type="button" class="invite-hint-btn" onclick="inviteHintAction()">👨‍👩‍👧 Pozvat rodinu</button>
  </div>
  <button type="button" class="invite-hint-x" aria-label="Skrýt nabídku" data-a0="shop" onclick="dismissInviteHint(this.dataset.a0)">×</button>
</div>
```
```css
.invite-hint{display:flex;gap:12px;align-items:flex-start;background:var(--card2);border:1px dashed var(--border2);border-radius:var(--radius);padding:14px 4px 14px 14px;margin-top:16px}
.invite-hint-em{font-size:26px;line-height:1;flex-shrink:0;margin-top:2px}
.invite-hint-body{flex:1;min-width:0}
.invite-hint-t{font-size:16px;font-weight:700;color:var(--text);line-height:1.3;overflow-wrap:anywhere}
.invite-hint-d{font-size:14px;color:var(--text2);line-height:1.45;margin-top:3px}
.invite-hint-btn{margin-top:10px;min-height:44px;padding:10px 18px;border:none;border-radius:10px;background:var(--accent);color:var(--on-accent);font-family:'Crimson Pro',serif;font-size:15px;font-weight:700;cursor:pointer}
.invite-hint-btn:disabled{opacity:.6;cursor:default}
.invite-hint-x{flex-shrink:0;width:44px;height:44px;margin-top:-10px;background:none;border:none;border-radius:10px;color:var(--text2);font-size:22px;cursor:pointer}
.invite-hint-btn:focus-visible,.invite-hint-x:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
```
Proč plné tlačítko a ne obrysové: text v barvě `--accent` na `--card2` má v sunshine kontrast jen asi 3 : 1. Plné tlačítko s `--on-accent` projde ve všech třech tématech.

### JS (app.js, sekce skupin, kolem ř. 4400)
```js
function inviteHintState(where){
  if(!familyId) return 'nogroup';
  if(!familyData) return 'pending';
  const shared = where==='shop' ? familyData.shareShop : familyData.shareCal;
  if(!shared) return null;
  return Object.keys(familyData.members||{}).length <= 1 ? 'alone' : null;
}
function renderInviteHints(){ ['shop','cal'].forEach(renderInviteHint); }
function renderInviteHint(where){
  const slot=document.getElementById(where+'-invite-slot'); if(!slot) return;
  const st=inviteHintState(where);
  if(!st || lsGet('lp_ih_'+where)===st){ slot.innerHTML=''; return; }
  // texty z tabulky výše; název skupiny: esc(cutName(familyData.groupName,40)||'Skupina')
  slot.innerHTML = …;
}
window.dismissInviteHint = where => {
  if(where!=='shop' && where!=='cal') return;
  const st=inviteHintState(where); if(st && st!=='pending') lsSave('lp_ih_'+where, st);
  renderInviteHint(where);
};
window.inviteHintAction = async () => {
  if(!familyId){                               // 1. klepnutí: založ skupinu „Rodina“
    document.querySelectorAll('.invite-hint-btn').forEach(b=>{b.disabled=true;b.textContent='⏳ Chystám skupinu…';});
    await window.createFamily('Rodina');
    renderInviteHints();
    return;                                    // sdílení až dalším klepnutím (viz níže)
  }
  if(familyData) window.shareGroupInvite(familyId); // stávající odkaz ?join=
};
```
Napojení:
- `renderShop()`: zavolat `renderInviteHint('shop')` na začátku (před `if(!activeItems.length)…return`), aby se karta ukázala i u prázdného seznamu.
- `renderEvList()` (nebo konec `renderCal()`): `renderInviteHint('cal')`.
- Snapshot skupiny v `subscribeFamily` (ř. ~4690, za `renderFamilySettings();`): přidat `renderInviteHints();`. Jinak by po připojení druhého člena karta „jsi zatím jen ty“ visela dál, protože snapshot dnes přerenderuje jen Nastavení.
- `renderAfterFamilyChange()` volá `renderShop` i `renderCal`, takže odchod ze skupiny je pokrytý.
- `createFamily` rozšířit o volitelný parametr: `window.createFamily = async (presetName) => { … const groupName = cutName(typeof presetName==='string' ? presetName : nameInp?.value, 40) || 'Moje skupina'; …`. Inline `onclick="createFamily()"` v Nastavení dál funguje. Pozor: z inline handleru může přijít jako argument objekt události, proto `typeof === 'string'`.

Na co si dát pozor:
- **Proč dvě klepnutí** (založit, pak poslat): `navigator.share` vyžaduje čerstvé gesto uživatele. Po `await` na zápis do Firestore ho iOS Safari už nemusí uznat (`NotAllowedError`). Proto první klepnutí skupinu založí a karta se přepne na „Poslat pozvánku“.
- V `shareGroupInvite` je teď při `NotAllowedError` jen toast „Sdílení selhalo“. Doporučuji stejný fallback jako v bodě 3: při chybě jiné než `AbortError` zkopírovat do schránky. Je to malá změna ve stejném místě.
- Název skupiny je uživatelský text, takže vždy `esc()`. Do `onclick` nic dynamického, jen `data-a0` s pevnou hodnotou `shop`/`cal`.
- Po zavření karty se fokus ztratí (prvek zmizí). Stačí `document.getElementById('shop-inp')?.focus({preventScroll:true})` u Nákupů, u Kalendáře nic.
- Karta se nezobrazuje v Nastavení ani na dashboardu: tam už je úkol „Připoj se k rodině nebo pozvi blízkého“ v Quick Startu.

---

## 5. Onboarding šablony (Rodina / Student / Zdraví)

### Umístění
Žádná nová obrazovka. Do **kroku 3** (`#s-step3`, „Co chceš sledovat?“) přidat nad `#mods-primary` řádek šablon. Výběr šablony přepíše předvybrané moduly (dnes podle avatara přes `AVMODS`) a nabídne ukázkové návyky. Bez výběru se nic nemění, takže stávající cesta zůstává.

```html
<div class="slabel">🧩 Začni podle šablony</div>
<div class="tpl-row" role="radiogroup" aria-label="Šablona">
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="family" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">👨‍👩‍👧</span><span class="tpl-nm">Rodina</span><span class="tpl-ds">Nákupy, jídlo, kalendář</span>
  </button>
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="student" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">🎓</span><span class="tpl-nm">Student</span><span class="tpl-ds">Učení, rozvrh, cíle</span>
  </button>
  <button type="button" class="tpl-card" role="radio" aria-checked="false" data-a0="health" onclick="pickTpl(this.dataset.a0)">
    <span class="tpl-em" aria-hidden="true">💪</span><span class="tpl-nm">Zdraví</span><span class="tpl-ds">Pohyb, jídlo, spánek</span>
  </button>
</div>
<label class="tpl-samples" id="tpl-samples" hidden>
  <input type="checkbox" id="tpl-samples-chk" checked>
  <span>Přidat ukázkové návyky: <span id="tpl-samples-list"></span></span>
</label>
<button type="button" class="lp-link" id="tpl-clear" hidden onclick="pickTpl(null)">Bez šablony</button>
```
```css
.tpl-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.tpl-card{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:88px;padding:12px 6px;background:var(--card2);border:2px solid var(--border);border-radius:14px;cursor:pointer;font-family:'Crimson Pro',serif;color:var(--text);text-align:center}
.tpl-card[aria-checked="true"]{border-color:var(--accent);background:var(--card3)}
.tpl-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tpl-em{font-size:26px;line-height:1}
.tpl-nm{font-size:15px;font-weight:700}
.tpl-ds{font-size:13px;color:var(--text2);line-height:1.25}
.tpl-samples{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text2);margin:4px 0 12px;min-height:44px;cursor:pointer}
.tpl-samples input{width:20px;height:20px;margin-top:2px;accent-color:var(--accent);flex-shrink:0}
@media(max-width:380px){.tpl-ds{display:none}}
```
Vybraná karta se pozná rámečkem a pozadím, ne jen barvou (`aria-checked` pro čtečky). Ve 360 px vychází karta asi na 90 px šířky, proto se popisek pod 380 px skryje.

### Data šablon (app.js, za `AVMODS`, ř. 352)
Moduly odpovídají `MODS` (id: `rex, habits, journal, calendar, goals, cooking, shopping, mealplan, checklist`). `rex` a `checklist` přidá `finishOnboard` vždy sám. Návyky odpovídají polím ze `saveHabit()`: `type` `'yesno'|'count'`, `freq` `{type:'daily'}` / `{type:'weekly',times}` / `{type:'days',days:[0–6, 0 = neděle]}`, `group` `'morning'|'day'|'evening'`.

```js
const ONB_TPLS = {
  family: { mods:['shopping','mealplan','cooking','calendar','habits'], habits:[
    {name:'Společná večeře',   emoji:'🍽️', type:'yesno', goal:1, freq:{type:'daily'},          group:'evening'},
    {name:'Čas venku spolu',   emoji:'🌳', type:'yesno', goal:1, freq:{type:'weekly',times:3}, group:'day'},
    {name:'Hodina bez mobilu', emoji:'📵', type:'yesno', goal:1, freq:{type:'daily'},          group:'evening'},
  ]},
  student: { mods:['habits','calendar','goals','journal'], habits:[
    {name:'Učení 30 minut',    emoji:'📚', type:'yesno', goal:1,  freq:{type:'days',days:[1,2,3,4,5]}, group:'day'},
    {name:'Přečtené stránky',  emoji:'📖', type:'count', goal:10, freq:{type:'daily'},                 group:'evening'},
    {name:'Spát do 23:00',     emoji:'😴', type:'yesno', goal:1,  freq:{type:'daily'},                 group:'evening'},
  ]},
  health: { mods:['habits','goals','mealplan','cooking','journal'], habits:[
    {name:'Procházka 30 minut',emoji:'🚶', type:'yesno', goal:1, freq:{type:'daily'},          group:'day'},
    {name:'Porce zeleniny',    emoji:'🥗', type:'count', goal:3, freq:{type:'daily'},          group:'day'},
    {name:'Protažení',         emoji:'🧘', type:'yesno', goal:1, freq:{type:'weekly',times:3}, group:'morning'},
  ]},
};
```
Pitný režim do šablony Zdraví záměrně nedávám: vodu už řeší widget na dashboardu (`lp_water`), návyk by byl duplicitní.

### Logika
```js
let selTpl = null;
window.pickTpl = id => {
  selTpl = ONB_TPLS[id] ? id : null;
  selMods = new Set(selTpl ? ONB_TPLS[selTpl].mods : (AVMODS[selAv]||[]));
  rMods();
  document.querySelectorAll('.tpl-card').forEach(b => b.setAttribute('aria-checked', String(b.dataset.a0===selTpl)));
  const s=document.getElementById('tpl-samples'), c=document.getElementById('tpl-clear');
  if(s) s.hidden=!selTpl; if(c) c.hidden=!selTpl;
  const l=document.getElementById('tpl-samples-list');
  if(l && selTpl) l.textContent = ONB_TPLS[selTpl].habits.map(h=>h.emoji+' '+h.name).join(', '); // textContent, ne innerHTML
};
```
- `gS3()` (vstup do kroku 3) resetuje `selTpl=null` a `aria-checked`, aby šablona nezůstala viset po návratu „← Zpět“.
- V **původním** `finishOnboard` (ř. 2302) za `await setDoc(…profile…)` a **před** `initApp()`:
  ```js
  if(selTpl && document.getElementById('tpl-samples-chk')?.checked && selMods.has('habits')){
    prof.template = selTpl;
    const now = new Date().toISOString();
    await Promise.all(ONB_TPLS[selTpl].habits.map((h,i)=>addDoc(collection(db,'users',CU.uid,'habits'),
      {...h, freq:{...h.freq}, reminderTime:null, goalId:null, order:i+1, createdAt:now})));
  }
  ```
  Zápis do `users/{uid}/habits` pravidla povolují (vlastník). Pole `prof.template` je volitelné (do budoucna, např. pro tipy), uložit ho v témže `setDoc` jako zbytek profilu, tedy nastavit `prof.template` ještě před ním.
- Když uživatel v šabloně ručně vypne modul Návyky, ukázkové návyky se nepřidají (podmínka `selMods.has('habits')`).
- Chyba zápisu návyků nesmí zablokovat dokončení onboardingu: `try/catch` kolem `Promise.all`, při chybě jen `console.warn` a pokračovat na `initApp()`.
- U šablony Rodina se po startu sama ukáže karta „Nakupujete ve více lidech?“ z bodu 4 (uživatel ještě nemá skupinu), další krok tedy není potřeba.
- Uvítací průvodce (`startWelcomeTour` přes obal `finishOnboard` na ř. 9245) zůstává beze změny.

---

## Shrnutí pro kodéra: soubory a místa

| Bod | index.html | style.css | app.js |
|---|---|---|---|
| 1 Landing | obsah `#s-login` (ř. 58–117) | nové `.lp-*`, `.screen>.card` mobil, `--on-accent`, `[hidden]`, tangerine `.logo-name`, `.err` ve světlých tématech | `showAuthPanel`, `showLanding`, `initLoginScreen` (za `capturePendingJoin()`), `toggleLoginMode` (autocomplete), `resetLoginBtn` (text), `togglePassVis` (aria-label) |
| 2 Meta/OG | `<head>` | – | – (+ nový `og-image.png`, skript a SVG ve `scripts/`) |
| 3 Sdílet appku | blok před „☕ Podpořit projekt“ (ř. ~889) | `.share-app-btn` | `window.shareApp` u `shareGroupInvite` |
| 4 Pozvánka | sloty `#shop-invite-slot`, `#cal-invite-slot` | `.invite-hint*` | `renderInviteHint(s)`, `dismissInviteHint`, `inviteHintAction`, `createFamily(presetName)`, volání z `renderShop`, `renderEvList`, snapshotu skupiny, `LOCAL_PERSONAL_KEYS`, fallback v `shareGroupInvite` |
| 5 Šablony | řádek šablon v `#s-step3` | `.tpl-*` | `ONB_TPLS`, `pickTpl`, reset v `gS3`, přidání návyků v `finishOnboard` |

Pořadí implementace podle dopadu: 2 → 1 → 3 → 4 → 5. Body 2 a 3 jsou malé a nezávislé, bod 1 mění přihlášení, proto ho testovat zvlášť: Google, e-mail přihlášení, registrace, reset hesla, odkaz `?join=` u nepřihlášeného, odhlášení → návrat rovnou na přihlášení.

Otevřené otázky pro vedoucího (výchozí volba = moje doporučení):
1. Landing přeskakovat i v nainstalované PWA? **Ano** (kdo appku nainstaloval, ji zná).
2. Tlačítko „Pozvat rodinu“ zakládá skupinu rovnou s názvem „Rodina“, nebo nejdřív posílá do Nastavení? **Rovnou zakládat** (jedno klepnutí, přejmenovat jde kdykoli).
3. Barva podkladu OG obrázku: tmavá se zlatou, nebo světlá jako výchozí téma? **Tmavá** (sedí k ikoně a ve feedu je výraznější).
