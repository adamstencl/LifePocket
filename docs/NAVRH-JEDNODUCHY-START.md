# Návrh: Jednoduchý start (postupné odkrývání), LifePocket 4.67

Adam: *„Pro nově příchozího je v aplikaci strašně moc možností, jak to zjednodušit?“*

Statická procházka kódu (`index.html`, `app.js`, `style.css`, `i18n/cs.js`) očima nováčka na telefonu (390×844), který prošel onboardingem a je v appce první den. Navazuje na `docs/NAVRH-PRVNI-DOJEM.md` (4.58). Odtud už je hotové: jedno okno naráz (`whenUiFree`, `app.js:647`), žádné „Co je nového“ pro nový účet (`app.js:609`), průvodce zkrácený na 3 kroky (`app.js:18019`) a energie parťáka až po první aktivitě (`app.js:4217`).

**Hlavní myšlenka:** nový účet začne se **3 moduly**, které si vybere jednou otázkou. Domů ukáže **nejvýš 3 karty** a hned na začátku jasně řekne, co udělat. Všechno ostatní (body a úrovně, výzvy, skupiny, statistiky, další moduly) se **odkryje postupně**: podle dní a podle toho, co člověk opravdu dělá, a nejvýš jedna nabídka za 3 dny. Stávajícím uživatelům se nic nezmění.

---

## 0. Co dnes vidí nováček první den (spočítáno)

Cesta **Rodina** (je to nejčastější cesta: pozvánka od partnera předvybere Rodinu, `app.js:4088`), ukázkové návyky zaškrtnuté, telefon.

### Onboarding: 26 voleb ve 3 krocích
| Krok | Co je na obrazovce | Volby |
|---|---|---|
| 1 `index.html:200` | jméno, oslovení Muž/Žena/Neuvádět, Zpět, Pokračovat | 6 |
| 2 `index.html:219` | 3 šablony + „Vlastní výběr“, zaškrtávátko ukázkových návyků, 5 předvybraných modulů (`ONB_TPLS.family`, `app.js:718`), „+ Zobrazit další možnosti“ (dalších 5 modulů), Zpět, Pokračovat | 13 (18 po rozbalení) |
| 3 `index.html:255` | 5 parťáků, Zpět, Jdeme na to | 7 |

`finishOnboard` k výběru navíc vždy přidá `rex` a `checklist` (`app.js:4134`). **Rodina tak začíná se 7 moduly, Zdraví s 8 a Student se 6.**

### Okna a výzvy během prvního dne: asi 12
uvítání průvodce + 3 kroky + závěrečné okno (`app.js:17988`, `app.js:18019`), toast „Ověř svůj e-mail“ (`app.js:1009`), nápovědy modulů při první návštěvě (`app.js:18129`; u Rodiny Návyky, Kalendář, Vaření, Jídelníček = 4), měkký dotaz na upozornění po 3. splněném návyku (`app.js:4744`), instalační banner po první akci (`app.js:658`) a nabídka sdílení po uložení návyku, pokud je člověk ve skupině (`app.js:12086`).

### Domů: banner + 7 karet, asi 21 míst, na která jde klepnout (`rDash`, `app.js:14446`)
| # | Karta | Kód | Poznámka |
|---|---|---|---|
| – | Banner parťáka **s kruhem úrovně, názvem úrovně a XP lištou** | `index.html:293`, `gameRenderUI` `app.js:6643` | body nováček nezná, a přesto je vidí hned |
| 1 | Začínáme: 5 úkolů + × | `quickStartHTML` `app.js:6340` | jeden z úkolů je „hlavní úkol dne“, což je tatáž věc jako karta 2 |
| 2 | Hlavní úkol dne: dnes, zítra, 7 teček týdne, statistika | `focusWidgetHTML` `app.js:6334`, `focusStatsHTML` `app.js:6290` | třetí koncept vedle návyků a úkolů |
| 3 | Výzva měsíce (+ případně týdne) | `pcDashHTML` `app.js:11280`, vložení `app.js:14517` | nováčkovi se ukáže hned |
| 4 | Citát dne od parťáka | `app.js:14540` | jen se čte, nic nedělá |
| 5 | Návyky (3 ukázkové) | `app.js:14555` | dobrá karta |
| 6 | Vaření („Co uvaříme?“) | `app.js:14672` | prázdná pobídka |
| 7 | (Pitný režim u Zdraví, Zápisník u Studenta) | `waterWidgetHTML` `app.js:5805` | |

Studenta a Zdraví čeká stejný počet karet. Místo Vaření se jim ukáže Zápisník, Pitný režim nebo Cíle.

### Spodní lišta a „Více“: 9 cílů bez kategorií (`buildNav`, `app.js:14346`)
Lišta *Domů · Nákupy · Kalendář · Rex · Více*. Ve „Více“ je plochý seznam *Návyky · Vaření · Jídelníček · Checklist · Nastavení* (`app.js:14361`). U Zdraví je ve Více 6 položek. Panel má napevno tmavé pozadí `rgba(20,20,24,.98)` (`style.css:648`), takže ve světlém režimu je tmavý pruh pod světlou appkou.

### Nastavení: 14 sekcí, asi 43 voleb na jedné dlouhé stránce (`index.html:906`)
Profil a avatar · Vzhled (3 motivy + Body a úrovně, `index.html:946`) · Jazyk · Moduly (10 přepínačů, `app.js:15355`) · Upozornění (až 4 technická tlačítka „test / test serveru / obnovit token“ `index.html:975–984`, 2 časy, 4 zaškrtávátka) · Skupiny a sdílení · Doporuč · Podpořit (QR) · Podpořit projekt (Lightning) · Právní dokumenty · Napiš nám (formulář) · Průvodce · Odhlášení · Účet (export, smazání).

### Součet
| Oblast | Dnes |
|---|---|
| Volby v onboardingu | 26 |
| Okna, tipy a výzvy 1. dne | ~12 |
| Karty na Domů (vč. banneru) | 8 |
| Místa na Domů, na která jde klepnout | ~21 |
| Cíle v liště a ve Více | 9 |
| Zapnuté moduly | 7 (Rodina) / 8 (Zdraví) |
| Viditelné volby v Nastavení | ~43 ve 14 sekcích |
| **Celkem prvků a voleb první den** | **~100** |

Za problém nepovažuju jednotlivé funkce. Problém je, že **všechny mají hlas hned první den**. Body, výzva měsíce, citát, hlavní úkol, energie a 7 modulů soupeří o pozornost člověka, který chtěl jen nákupní seznam.

---

## 1. Start se 3 moduly podle jedné otázky

Krok 2 onboardingu (`index.html:219`, `rMods` `app.js:4101`, `pickTpl` `app.js:4112`) nahradí **jedna otázka s velkými odpověďmi**. Mřížka modulů zůstane schovaná pod odkazem pro ty, kdo chtějí vybírat sami.

### Obrazovka (před / po)

```
PŘED (krok 2)                          PO (krok 2)
┌────────────────────────────┐         ┌────────────────────────────┐
│ K čemu appku chceš, Adame? │         │ Co chceš hlavně řešit?     │
│ 🧩 Začni podle šablony     │         │ Vyber jednu věc. Další      │
│ [👨‍👩‍👧Rodina][🎓Student][💪Zdraví]│         │ přidáš kdykoli později.    │
│ Vlastní výběr              │         │ ┌────────────────────────┐ │
│ ☑ Přidat ukázkové návyky…  │         │ │🧺 Nákupy a jídlo doma   │ │
│ ⭐ Připraveno pro tebe      │         │ │ Nákupy · Jídelníček ·   │ │
│ [🧺 Nákupy ✓]              │         │ │ Kalendář                │ │
│ [🥗 Jídelníček ✓]          │         │ └────────────────────────┘ │
│ [👨‍🍳 Vaření ✓]              │         │ [🔥 Návyky a zdraví     ]  │
│ [🗓️ Kalendář ✓]            │         │ [🗓️ Škola a přehled     ]  │
│ [🔥 Návyky ✓]              │         │ [🎯 Cíle a osobní rozvoj]  │
│ + Zobrazit další možnosti  │         │ [🤷 Ještě nevím         ]  │
│ [← Zpět] [Pokračovat →]    │         │ Vyberu si moduly sám/a →   │
└────────────────────────────┘         │ [← Zpět] [Pokračovat →]    │
13 voleb, 3 pojmy (šablona, modul,     └────────────────────────────┘
ukázka)                                7 voleb, 1 otázka
```

### Odpovědi → moduly (vždy max. 3 + Rex)

| Odpověď (`prof.start`) | Moduly | `prof.template` (pro `NAV_TPL`, `TOUR_MAIN`, ukázky) | Ukázkové návyky |
|---|---|---|---|
| 🧺 **Nákupy a jídlo doma** (`home`) | shopping, mealplan, calendar | `family` | ne (návyky nemá) |
| 🔥 **Návyky a zdraví** (`health`) | habits, water, goals | `health` | ano, 3 z `ONB_TPLS.health` |
| 🗓️ **Škola a přehled o čase** (`study`) | calendar, habits, journal | `student` | ano, 3 ze `student` |
| 🎯 **Cíle a osobní rozvoj** (`growth`) | goals, habits, journal | nová `growth` | ano (🧘 5 minut klidu, 📖 10 stran, 📝 Večer 3 věty) |
| 🤷 **Ještě nevím** (`basic`) | habits, shopping, calendar | – | ne |

- Pozvánka (`readPendingJoin()`) předvybere **Nákupy a jídlo doma**. Text `onb.tpl.invNote` zůstane.
- Zaškrtávátko ukázkových návyků zmizí z obrazovky. U odpovědí s návyky se ukázky přidají samy a v kartě „Další krok“ je jde jedním klepnutím smazat („Ukázky nechci“). Je to o jednu volbu míň a o jeden pojem míň.
- `finishOnboard` (`app.js:4134`) v jednoduchém režimu **nepřidá `checklist`**. Nabídne se, až ho někdo ve skupině nasdílí (viz 2b). `rex` zůstane, AI parťák je jádro appky.
- Odkaz „Vyberu si moduly sám/a“ otevře dnešní mřížku (`rMods`) a **jednoduchý režim vypne** (`prof.simple=false`). Pokročilý člověk tak dostane appku jako dnes.
- Vypnuté moduly se jen nepřidají do `prof.modules`, data se nemažou. Server (`sendScheduledNotifications`) už dnes řídí připomínky podle `prof.modules`, takže se nic dalšího nemění.

### Komponenta (styl `.tpl-card`, `style.css:130`, ale řádky na celou šířku)

```html
<div class="startq" role="radiogroup" aria-labelledby="s2-title">
  <button type="button" class="startq-opt" role="radio" aria-checked="false" data-a0="home" onclick="pickStart(this.dataset.a0)">
    <span class="startq-em" aria-hidden="true">🧺</span>
    <span class="startq-txt">
      <span class="startq-nm">Nákupy a jídlo doma</span>
      <span class="startq-ds">Nákupy · Jídelníček · Kalendář</span>
    </span>
    <span class="startq-chk" aria-hidden="true"></span>
  </button>
  …
</div>
<button type="button" class="lp-link" onclick="pickStartCustom()">Vyberu si moduly sám/a →</button>
```

```css
.startq{display:flex;flex-direction:column;gap:10px;margin:14px 0}
.startq-opt{display:flex;align-items:center;gap:14px;min-height:64px;padding:12px 16px;width:100%;
  background:var(--card2);border:2px solid var(--border);border-radius:var(--radius);
  color:var(--text);font-family:'Crimson Pro',serif;text-align:left;cursor:pointer}
.startq-opt[aria-checked="true"]{border-color:var(--accent);background:var(--card3)}
.startq-opt:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.startq-em{font-size:28px;flex-shrink:0}
.startq-txt{display:flex;flex-direction:column;flex:1;min-width:0}
.startq-nm{font-size:17px;font-weight:700}
.startq-ds{font-size:13px;color:var(--text2)}           /* ne --text3: kontrast */
.startq-chk{width:22px;height:22px;border-radius:50%;border:2px solid var(--border2);flex-shrink:0}
.startq-opt[aria-checked="true"] .startq-chk{background:var(--accent);border-color:var(--accent)}
```

Texty (`i18n/cs.js` a `en.js`): `onb.start.title` „Co chceš hlavně řešit?“, `onb.start.sub` „Vyber jednu věc. Další přidáš kdykoli později.“, `onb.start.custom` „Vyberu si moduly sám/a →“. Krok 3 (parťák) zůstane, parťák je už předvybraný a stačí klepnout na „Jdeme na to!“.

---

## 2. Postupné odkrývání

### 2a. Co se kdy ukáže

Platí jen pro `prof.simple===true`. „Den“ = dny od `prof.createdAt` (pomocník `accNew`, `app.js:638`). „Aktivní den“ = den s aspoň jednou akcí (splněný návyk, položka v nákupu, záznam, událost). Co se jednou odkryje, zůstane odkryté a uloží se do `prof.unl.<id> = 'YYYY-MM-DD'`.

| Funkce | Dnes se ukáže | Nově se ukáže | Kde v kódu |
|---|---|---|---|
| **Body a úrovně** (kruh v banneru, úroveň, XP lišta, „+10“, oslavy) | hned | po **3. splněném návyku** nebo 3. aktivním dni. Odkrytí ohlásí stávající úvodní karta `gameIntroHTML` | `gameRenderUI` `app.js:6643`, `xpPop` `app.js:6658`, `gameIntroHTML` `app.js:6761` (dnes se nováčkovi potlačí přes `accNew(7)`) |
| Body se počítají dál | – | **od prvního dne**, skryté je jen zobrazení. Po odkrytí člověk uvidí body, které už nasbíral | nový `gameUiOn()` = `gameOn() && unl('game')` |
| **Týdenní souhrn** | po + út, jsou-li data | až po odkrytí bodů a prvním celém týdnu | `weekCardHTML` `app.js:7130` |
| **Energie parťáka** na Domů | po první aktivitě | v jednoduchém režimu **nikdy na Domů**, jen na stránce parťáka (energie a úroveň jsou dvě měřítka téhož) | `app.js:14521` |
| **Citát dne** | hned | v jednoduchém režimu ne na Domů, jako zpráva parťáka na jeho stránce | `app.js:14540` |
| **Hlavní úkol dne** | hned, i se statistikami | nabídka 2. den (fronta 2b). Řádek „zítra“ až po prvním splněném dni, tečky a statistika od 3. dne s úkolem | `focusWidgetHTML` `app.js:6334`, `focusStatsHTML` `app.js:6290` |
| **Výzva měsíce / týdne** | hned | po **5 aktivních dnech**, jako nabídka ve frontě, ne jako karta navíc | `pcDashHTML` `app.js:11280`, vložení `app.js:14517` |
| **Skupiny: aktivní pobídky** (úkol „Pozvi rodinu“, nabídka sdílení, tipy ke sdílení, nabídka skupinové výzvy) | hned | po **3 aktivních dnech** nebo hned po vstupu do skupiny. **Ruční cesta (Nastavení → Skupiny) a pozvánka odkazem fungují vždy od prvního dne** | `quickStartHTML` (úkol `family`) `app.js:6340`, `ctaAskShare` `app.js:12086`, `COACH` `app.js:12160`, `ctaChHTML` `app.js:12111` |
| **Skupinové výzvy** | po vstupu do skupiny | beze změny (kdo je ve skupině, chce vidět, co dělají ostatní) | `chDashHTML` `app.js:10579` |
| **Statistiky návyků** (tlačítko „📊 Měsíc“, detail návyku) | hned | tlačítko až po 7 dnech s aspoň jedním záznamem. Do té doby by ukazovalo prázdnou mřížku | `index.html:318` (`habit-month-btn`) |
| **Dotaz na upozornění** | po 3. splněném návyku / vstupu do skupiny / události s připomínkou | beze změny spouštěčů, ale **počítá se do limitu fronty** (2b) | `notifAskSoon` `app.js:4744` |
| **Instalace na plochu** | po první akci | beze změny, počítá se do limitu fronty | `installGate` `app.js:658` |

### 2b. Kontextové nabídky dalších modulů (fronta)

Jedna fronta nabídek místo dnešních samostatných karet (`wtIntroSlot`, `gameIntroHTML`, `groupNotifIntroHTML`, `notifAsk…`).

**Pravidla**
1. **Nejvýš 1 nabídka za 3 dny**, ne v den založení účtu a nikdy dvě naráz. Mezi zobrazeními hlídá čas `prof.nudge.last`, ve Firestore, aby se nabídky neopakovaly na dalším zařízení.
2. Každá nabídka **jen jednou**. Odpověď se uloží do `prof.nudge.<id> = 'yes' | 'no' | 'later:<datum>'`, „Později“ = znovu nejdřív za 14 dní.
3. Nabídka se ukáže přes **`whenUiFree`** (`app.js:647`) jako karta na Domů ve **slotu 3** (viz kap. 3), ne jako okno přes obsah. Na Domů je čas, jinde člověk něco dělá.
4. Nabídky se seřadí podle pořadí v tabulce a ukáže se první, jejíž podmínka platí.

| id | Podmínka | Text (titulek / věta) | Tlačítko | Akce |
|---|---|---|---|---|
| `game` | 3 splněné návyky | 🌱 **{av} roste s tebou** / Za každý splněný návyk sbíráš body. Zatím jich máš {n}. | Ukázat | odkryje body, `openGame()` |
| `focus` | 2. den | 🎯 **Jedna hlavní věc na dnešek?** / Vyber si ráno jednu věc, kterou chceš určitě stihnout. | Vyzkoušet | `openFocusModal('today')` |
| `water` | návyky ≥ 7 dní, ≥ 5 aktivních dní, `water` vypnutý | 💧 **Používáš návyky už týden. Zkusíš pitný režim?** / Láhev se plní a připomene ti, když zapomeneš pít. | Zapnout | `wtEnableModule()` `app.js:5839` |
| `groups` | nákupy ≥ 3 aktivní dny, žádná skupina | 🏠 **Nakupujete doma ve dvou?** / Pozvi domácnost a seznam uvidíte oba, i když nakupuje ten druhý. | Pozvat | `openNewGroup()` |
| `mealplan` | ≥ 10 položek v nákupu, `mealplan` vypnutý | 🥗 **Naplánuj si jídla na týden** / Z plánu ti appka sama udělá nákupní seznam. | Zapnout | zapnout modul + `sp('mealplan')` |
| `calendar` | 5. den, `calendar` vypnutý | 🗓️ **Narozeniny a akce na jednom místě** / Připomeneme ti je den předem. | Zapnout | zapnout + `sp('calendar')` |
| `habits` | 5. den, `habits` vypnutý | 🔥 **Jeden malý zvyk denně?** / Třeba „Večeře bez mobilu“. Odškrtneš ho jedním klepnutím. | Přidat | zapnout + nový návyk předvyplněný |
| `goals` | ≥ 3 návyky, 10. den, `goals` vypnutý | 🏆 **Návyky ti jdou. Propojíš je s větším cílem?** | Zapnout | zapnout + `sp('goals')` |
| `cooking` | jídelníček použitý 2 týdny | 👨‍🍳 **Ulož si recepty, které vaříš** / Do jídelníčku je pak přidáš jedním klepnutím. | Zapnout | zapnout + `sp('cooking')` |
| `checklist` | ve skupině je nasdílený checklist | ✅ **{skupina} ti nasdílela seznam úkolů** | Otevřít | zapnout + `sp('checklist')` |
| `pc` | 5 aktivních dní | 🏆 **Výzva měsíce: {název}** / Přidej se k ostatním, stačí odškrtnout den. | Přidat se | odkryje `pc`, `pcOpen` |

`notifAsk` a instalační banner mají vlastní spouštěče (správná chvíle), jen respektují limit: když se ten den už ukázala nabídka z fronty, počkají na další příležitost.

**Komponenta:** stávající `.invite-hint` (`style.css:141`), aby se nepřidával nový vzhled. Dvě tlačítka (hlavní + „Teď ne“) a křížek, všechno min. 44×44 px:

```html
<div class="invite-hint nudge" id="nudge-card" role="region" aria-label="Tip od {av}">
  <span class="invite-hint-em" aria-hidden="true">💧</span>
  <div class="invite-hint-body">
    <div class="invite-hint-t">Používáš návyky už týden. Zkusíš pitný režim?</div>
    <div class="invite-hint-d">Láhev se plní a připomene ti, když zapomeneš pít.</div>
    <div class="nudge-btns">
      <button type="button" class="invite-hint-btn" data-a0="water" onclick="nudgeYes(this.dataset.a0)">Zapnout</button>
      <button type="button" class="btn-s nudge-no" data-a0="water" onclick="nudgeNo(this.dataset.a0)">Teď ne</button>
    </div>
  </div>
</div>
```
```css
.nudge-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.nudge-btns button{min-height:44px;padding:0 16px}
```

Kód (pro kodéra): registr `NUDGES=[{id, when(), html(), yes()}]`, `nudgePick()` se volá z `rDash` a vrací nejvýš jednu kartu. `nudgeYes/No` zapisují přes `updateDoc(profileRef, {'nudge.water':'yes','nudge.last':toDS()})`, ne přes `setDoc` celého profilu. Pravidla Firestore se nemění (`users/{uid}/**` vlastník).

---

## 3. Domů pro nováčka: max. 3 karty a jasné „co teď“

### Před / po (Rodina, 1. den)

```
PŘED                                   PO
┌────────────────────────────┐         ┌────────────────────────────┐
│ Dobré ráno, Adame!   po 16.│         │ Dobré ráno, Adame!   po 16.│
│ ┌───────────────────────┐  │         │ ┌───────────────────────┐  │
│ │(◯1) Nora · Úroveň 1   │  │         │ │🏡 Nora                │  │
│ │ Ahoj! Přidej návyk…   │  │         │ │ Začneme nákupem? Napiš │  │
│ │ ▓░░░░░░ 0/50 XP       │  │         │ │ mi, kdyby něco.  💬 →  │  │
│ └───────────────────────┘  │         │ └───────────────────────┘  │
│ Začínáme! 1/5 hotovo     × │         │ ① CO TEĎ  · krok 1 ze 3    │
│ ✓ 🎯 Přidej návyk          │         │ 🧺 Napiš první věc na nákup│
│ ○ 🎯 Nastav hlavní úkol    │         │ [ Mléko, chleba…   ][ + ]  │
│ ○ 🍳 Ulož recept           │         │ Příklad: 🥛 Mléko           │
│ ○ 🛒 Přidej nákup          │         ├────────────────────────────┤
│ ○ 👨‍👩‍👧 Pozvi rodinu          │         │ ② 🗓️ Kalendář            → │
│ DNES  Nastav prioritu   ＋ │         │ Zatím nic. Přidej narozeni-│
│ ZÍTRA Naplánuj zítřek   ＋ │         │ ny někoho blízkého.        │
│ ● ● ● ● ● ● ●   0/0        │         ├────────────────────────────┤
│ 🏆 Výzva měsíce: 30 dní …  │         │ ③ 🥗 Jídelníček          → │
│ [Přidat se]          [Skrýt]│         │ Co bude dnes k večeři?     │
│ NORA ŘÍKÁ: „Malé kroky…“   │         └────────────────────────────┘
│ Návyky 0/3 …               │         Domů · Nákupy · Kalendář ·
│ Vaření: Co uvaříme?        │         Jídelníček · Více
└────────────────────────────┘
8 bloků, ~21 klepnutí, 6 pojmů         4 bloky, ~9 klepnutí, 1 úkol
```

### Pravidla pro `rDash` v jednoduchém režimu (`app.js:14506`)

Pod pozdravem a bannerem jsou **nejvýš 3 karty**, vybrané podle priority:

1. **Slot 1 = „Co teď“**, dokud nejsou hotové 3 první kroky. Nahradí kartu Začínáme (`quickStartHTML`, `app.js:6340`): **místo 5 úkolů najednou ukazuje vždy jen jeden krok**, a kde to jde, je ho možné splnit přímo v kartě (vstup do nákupu, odškrtnutí ukázkového návyku). Kroky se odvodí ze 3 modulů v pořadí lišty:
   | Modul | Krok (text) | Splněno když |
   |---|---|---|
   | shopping | 🧺 Napiš první věc na nákup | `shopItems.length>0` |
   | habits | ✅ Odškrtni dnešní návyk (ukázky) / 🔥 Přidej první návyk | dnešní log / `habits.length` |
   | calendar | 🎂 Ulož narozeniny někoho blízkého | `events.length>0` |
   | mealplan | 🥗 Napiš, co bude dnes k večeři | vyplněné jedno jídlo |
   | water | 💧 Ťukni na šálek, až se napiješ | `wtMl(today)>0` |
   | goals | 🎯 Napiš jeden cíl na letošek | `goals.length>0` |
   | journal | 📝 Zapiš si první myšlenku | `entries.length>0` |

   Po 3 krocích karta jednou poděkuje („Hotovo, základ máš 🎉 Další věci ti {av} ukáže postupně.“) a zmizí. Hlavička „krok 1 ze 3“ místo procent: tři kroky si člověk zapamatuje, 5 úkolů a lišta procent působí jako práce.
2. **Slot 2 = karta modulu č. 1** (z lišty), vždy interaktivní: návyky s kroužky k odškrtnutí, nákup s rychlým přidáním. Prázdný modul ukáže prázdný stav podle kap. 6, ne skrytou kartu.
3. **Slot 3 = nabídka z fronty** (kap. 2b), když nějaká čeká. Jinak karta modulu č. 2.

**Na Domů v jednoduchém režimu nebude:** citát, energie, hlavní úkol (dokud se nenabídne), výzva měsíce (dokud se neodkryje), týdenní report, karta sérií (série se ukazují 🔥 přímo v kartě návyků, `app.js:14568`), karta Vaření bez obsahu.

**Banner parťáka:** bez kruhu úrovně a XP lišty, dokud se neodkryjí body (`gameRenderUI`). Text bude o jedno sloveso konkrétnější („Začneme nákupem?“) a vpravo bude tlačítko 💬 (44×44, `aria-label="Napsat {av}"`), protože Rex už nemusí být v liště (kap. 5).

Po 14 dnech, nebo když člověk vypne jednoduchý režim, se slot pravidla uvolní: Domů ukáže karty všech zapnutých modulů jako dnes. Odkrytá rozšíření (body, výzvy) už zůstanou.

---

## 4. Nastavení: Základní a Pokročilé

Dnes je to 14 sekcí a asi 43 voleb pod sebou (`index.html:906–1132`). Nově bude nahoře **5 základních sekcí** a pod nimi **3 sbalené skupiny** (`<details>`, výchozí stav zavřený, pamatuje si ho `localStorage` `lp_set_open`, klíč přidat do `LOCAL_PERSONAL_KEYS` `app.js:1143`).

```
PŘED                                   PO
👤 Profil & Avatar                     👤 Ty a parťák       jméno · parťák
🎨 Vzhled  (+ Body a úrovně)           📱 Moduly            tvoje 3 + „Přidat modul“
🌍 Jazyk                               🔔 Upozornění        1 přepínač + časy
📱 Moduly  (10 přepínačů)              👨‍👩‍👧 Skupiny          vytvořit · připojit kódem
🔔 Upozornění (4 tech. tlačítka,       🎨 Vzhled a jazyk    3 motivy · CZ/EN
   2 časy, 4 zaškrtávátka)             🌱 Jednoduchý režim  přepínač
👨‍👩‍👧 Skupiny & sdílení                  ─────────────────────────────
💛 Doporuč LifePocket                  ▸ Pokročilé
☕ Podpořit (QR)                        ▸ Podpora, kontakt a dokumenty
⚡ Podpořit projekt (Lightning)          ▸ Účet a data
📄 Právní dokumenty                    [ Odhlásit se ]
📬 Napiš nám (formulář)
🗺️ Průvodce
🚪 Odhlášení
🔐 Účet
```

| Sekce | Obsah | Odkud (`index.html`) |
|---|---|---|
| **👤 Ty a parťák** | jméno, oslovení, změnit parťáka | 909 |
| **📱 Moduly** | zapnuté moduly s přepínačem, pod nimi „➕ Přidat modul“ otevře list s kategoriemi (stejný jako ve Více, kap. 5) | 961, `rSetMods` `app.js:15355` |
| **🔔 Upozornění** | hlavní přepínač „Připomínky do telefonu“ (dnes `notif-enable-btn`), ranní a večerní čas | 968–995 |
| **👨‍👩‍👧 Skupiny** | Vytvořit skupinu, Připojit se kódem, seznam skupin | 1034 |
| **🎨 Vzhled a jazyk** | 3 motivy, Čeština/English v jednom řádku | 925, 952 |
| **🌱 Jednoduchý režim** | přepínač + věta „Ukáže jen to hlavní. Další funkce ti nabídneme postupně.“, pod ním „Odkrýt všechno hned“ | nové |
| ▸ **Pokročilé** | Body a úrovně (`set-game` 946), které připomínky chci (4 zaškrtávátka 996–1017), upozornění ze skupin (`gn-box`), Spustit průvodce znovu (1109), **Řešení potíží s upozorněním**: test, test serveru, obnovit token (975–984; běžný člověk je nepotřebuje, podpora na ně odkáže) | |
| ▸ **Podpora, kontakt a dokumenty** | Doporuč LifePocket, Podpořit (QR i Lightning **v jedné sekci**, 1058–1085), Napiš nám, Právní dokumenty | |
| ▸ **Účet a data** | Stáhnout moje data, Smazat účet | 1122 |
| Odhlásit se | samostatné tlačítko na konci, vždy vidět | 1114 |

Hlavička sbalené skupiny (min. 48 px, celá plocha klikací):
```html
<details class="setgrp">
  <summary class="setgrp-s"><span>⚙️ Pokročilé</span><span class="setgrp-d">body, připomínky, průvodce</span></summary>
  … stávající sekce .setsec …
</details>
```
```css
.setgrp{background:var(--card);border:1px solid var(--border);border-radius:16px;margin-bottom:14px}
.setgrp-s{display:flex;flex-direction:column;gap:2px;min-height:48px;padding:14px 24px;cursor:pointer;list-style:none;font-size:16px;font-weight:700;color:var(--text)}
.setgrp-s::-webkit-details-marker{display:none}
.setgrp-s::after{content:'›';position:absolute;right:24px;transform:rotate(90deg);color:var(--text2)}
.setgrp[open] .setgrp-s::after{transform:rotate(-90deg)}
.setgrp-d{font-size:13px;font-weight:400;color:var(--text2)}
.setgrp .setsec{border:none;margin:0;background:none}
```
Rozdělení na Základní a Pokročilé platí **pro všechny uživatele**, nejen pro jednoduchý režim. Nic se neodebere, jen se schová pod sbalenou hlavičku, a technická tlačítka by stejně neměla být první, co člověk v Nastavení uvidí.

---

## 5. Spodní lišta: Domů + 3 moduly + Více, Více s kategoriemi

### Lišta (`buildNav`, `app.js:14346`)
- Jednoduchý režim: **Domů · M1 · M2 · M3 · Více**, kde M1–M3 jsou moduly z odpovědi v pořadí z tabulky kap. 1. Je to 5 tlačítek, na 360 px vychází každé na 72 px, tedy víc než 44 px.
- **Rex (parťák) do lišty nepatří**, protože jeho jméno nováčkovi nic neřekne (viz NAVRH-PRVNI-DOJEM #3). Dostupný bude z banneru na Domů (tlačítko 💬) a jako první položka ve Více s popiskem „🤖 {av}, tvůj AI parťák“. *Sporné, viz otázka 1.*
- Mimo jednoduchý režim zůstane lišta jako dnes (`NAV_TPL`, `app.js:14366`).

### Panel Více (`bn-more-panel`, `app.js:14362`, `style.css:648`)
Místo plochého seznamu dlaždic bude spodní list se 3 skupinami:

```
┌────────────────────────────────────┐
│ ─────                              │   (úchyt, list jde stáhnout dolů)
│ 🤖 Nora, tvůj AI parťák          → │   44+ px řádky
│ 🔧 Nastavení                     → │
│ ─ TVOJE MODULY ─────────────────── │   (jen zapnuté, které nejsou v liště)
│ ─ PŘIDAT DALŠÍ ─────────────────── │
│ Domácnost  [🧺 Nákupy][🥗 Jídelníček]│
│            [👨‍🍳 Vaření][✅ Checklist] │
│ Já         [🔥 Návyky][💧 Pitný režim]│
│            [🏆 Cíle][📒 Poznámky]    │
│ Čas        [🗓️ Kalendář]            │
└────────────────────────────────────┘
```
- Kategorie: **Domácnost** (shopping, mealplan, cooking, checklist), **Já** (habits, water, goals, journal), **Čas** (calendar). Vypnuté moduly mají přerušovaný okraj (`border:1px dashed var(--border2)`, stejně jako `.more-tog`). Klepnutí otevře malý list: emoji, `modDesc`, „Zapnout“ / „Zpět“. Po zapnutí se modul hned otevře a v Domů slotu 1 se objeví jeho první krok.
- Zapnutí z Více volá stávající `togModSet(id,true)` (`app.js:15358`). Po zapnutí 4. modulu se lišta nemění, modul přibude do „Tvoje moduly“. Pořadí lišty jde změnit dlouhým stiskem jako vylepšení později, teď ne.
- **Oprava světlého režimu:** pozadí panelu podle tokenu.
```css
/* před */ .bn-more-panel{…background:rgba(20,20,24,.98);…}
/* po   */ .bn-more-panel{…background:var(--card);box-shadow:var(--shadow-lg);border-radius:20px 20px 0 0;…}
.bnm-sec{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin:14px 0 6px}
.bnm-row{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px;border-radius:12px;background:var(--card2)}
.bnm-off{border:1px dashed var(--border2);background:none}
```

---

## 6. Prázdné stavy modulů: jedna věta, jedno tlačítko, příklad

Dnes se prázdné stavy liší, mají dvě rovnocenná tlačítka nebo dlouhé texty, a Kalendář prázdný stav nemá vůbec. Návrh je jedna komponenta `emptyHTML(mod)` pro všechny moduly:

```html
<div class="es" role="region" aria-label="Návyky">
  <div class="es-em" aria-hidden="true">🔥</div>
  <p class="es-t">Začni jedním malým zvykem.</p>
  <button type="button" class="btn-p es-btn" onclick="…">+ Přidat návyk</button>
  <button type="button" class="es-ex" data-a0="💧 Sklenice vody ráno" onclick="…">Třeba: 💧 Sklenice vody ráno</button>
</div>
```
```css
.es{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:32px 16px}
.es-em{font-size:44px}
.es-t{font-size:17px;color:var(--text);max-width:280px;line-height:1.4;margin:0}
.es-btn{width:auto;min-height:48px;padding:0 24px}
.es-ex{min-height:44px;padding:0 14px;background:none;border:1px dashed var(--border2);border-radius:50px;color:var(--text2);font-family:'Crimson Pro',serif;font-size:14px;cursor:pointer}
```
Klepnutí na příklad **založí položku rovnou** (je to nejrychlejší „aha“), a ne jen předvyplní formulář.

| Modul | Dnes | Věta | Tlačítko | Příklad (1 klepnutí) |
|---|---|---|---|---|
| Návyky `index.html:438` | 2 věty | Začni jedním malým zvykem. | + Přidat návyk | 💧 Sklenice vody ráno |
| Nákupy `index.html:773` | 2 rovnocenná tlačítka (Přidat / Vybrat recept) | Napiš, co dojde, a máš to v telefonu. | + Přidat položku | 🥛 Mléko |
| Kalendář | prázdný stav chybí | Ulož si narozeniny a akce, připomeneme ti je. | + Přidat událost | 🎂 Narozeniny mámy (otevře formulář s typem narozeniny) |
| Poznámky `index.html:546` | 2 dlouhé věty | Sem si zapiš cokoli, co nechceš zapomenout. | + Nová poznámka | 🎁 Dárky na Vánoce |
| Cíle `goal.emptyTitle` | otázka + věta | Jeden větší cíl, ke kterému míříš. | + Přidat cíl | 🏃 Uběhnout 5 km |
| Vaření | – | Ulož si oblíbený recept a najdeš ho vždycky po ruce. | + Přidat recept | 🍝 Špagety po boloňsku |
| Jídelníček `app.js:13364` | hlavní tlačítko je AI | Naplánuj jídla na týden, nákup se pak udělá sám. | + Naplánovat dnešek | 🍲 Dnes polévka a chleba. AI návrh týdne jako druhý odkaz |
| Pitný režim | „Ťukni na šálek…“ | beze změny (už odpovídá) | – | – |
| Checklist `cl.empty` | „Žádné úkoly. Přidej první!“ | Seznam úkolů, třeba na dovolenou. | + Přidat úkol | 🧳 Sbalit nabíječku |

Texty jsou bez rodu („Ulož si“, ne „uložil/a“) a v `i18n` pod klíči `es.<mod>.t|btn|ex`.

---

## 7. Stávající uživatelé: nic jim nezmizí

- **Příznak jen pro nové účty:** `prof.simple=true` nastaví jen `finishOnboard` (`app.js:4134`), a jen když uživatel nezvolil „Vyberu si moduly sám/a“. Starý profil pole nemá, takže `isSimple()` vrátí `false` a appka se chová jako dnes. Žádná migrace ani zápis do starých profilů.
- **Přepínač „🌱 Jednoduchý režim“** v Nastavení (kap. 4) funguje oběma směry. Stávající uživatel si ho může zapnout. Jeho moduly se nevypnou, jen lišta ukáže první 3 a Domů 3 karty.
- **Vypnutí jednoduchého režimu** odkryje všechno (body, výzvy, citát, statistiky) a vrátí lištu a Domů do dnešní podoby. Moduly zůstanou, jak jsou.
- **Automatický konec:** po 30 dnech jednoduchý režim nezmizí sám od sebe. Přechod bez varování by mátl. Parťák se jednou zeptá (nabídka ve frontě): „Používáš LifePocket měsíc. Chceš vidět všechno najednou?“ [Ano] [Nechat jednoduché].
- **Druhé zařízení:** stav je ve Firestore (`prof.simple`, `prof.unl`, `prof.nudge`), ne v `localStorage`, takže na tabletu bude appka stejná.
- **Pozvaný člověk:** jednoduchý režim + odpověď „Nákupy a jídlo doma“. Skupinové funkce, které už ve skupině běží (sdílený nákup, výzvy skupiny, feed), vidí hned, protože kvůli nim přišel.

```js
// pomocníci pro kodéra (app.js poblíž accNew, :638)
const isSimple = () => prof?.simple === true;
const unl = id => !isSimple() || !!prof?.unl?.[id];       // mimo jednoduchý režim je odkryté vše
function unlock(id){ if(unl(id)) return; prof.unl={...(prof.unl||{}),[id]:toDS()};
  updateDoc(doc(db,'users',CU.uid,'profile','main'),{['unl.'+id]:prof.unl[id]}).catch(()=>{}); }
```

---

## 8. Fáze implementace

| Fáze | Co | Náročnost | Dopad | Soubory |
|---|---|---|---|---|
| **F1** | Příznak `prof.simple` ve `finishOnboard`, pomocníci `isSimple/unl/unlock`. `rDash`: v jednoduchém režimu bez citátu, energie, výzvy měsíce, hlavního úkolu a karty Vaření bez obsahu, nejvýš 3 karty. `gameRenderUI` a `xpPop` skryjí body do odkrytí `game`. Přepínač v Nastavení. | **S** | **velký**: Domů z 8 na 4 bloky | app.js, index.html, i18n |
| **F2** | Otázka „Co chceš hlavně řešit?“ místo kroku 2 (3 moduly, bez `checklist`), lišta Domů + 3 + Více, Rex přes banner | **M** | **velký**: ze 7 modulů na 3 | index.html, app.js (`rMods`, `pickTpl`, `finishOnboard`, `buildNav`, `tourSteps`), style.css, i18n |
| **F3** | Karta „Co teď“ (1 krok naráz, vstup přímo v kartě) místo Začínáme | **S–M** | velký (první akce do 30 s) | app.js (`quickStartHTML`), style.css |
| **F4** | Nastavení: Základní + 3 sbalené `<details>` pro všechny, technická tlačítka do Řešení potíží | **S** | střední | index.html, style.css, malá úprava `initSet` |
| **F5** | Fronta nabídek `NUDGES` + odkrývání (`unl`), převést `wtIntroSlot`, `gameIntroHTML`, `groupNotifIntroHTML` a `notifAsk` pod jeden limit | **M** | velký dlouhodobě (objevování modulů) | app.js |
| **F6** | Panel Více s kategoriemi a zapnutím modulu, oprava světlého režimu | **M** | střední | app.js (`buildNav`), style.css |
| **F7** | Jednotné prázdné stavy `emptyHTML(mod)` + příklad na 1 klepnutí, prázdný stav Kalendáře | **S–M** | střední | app.js, index.html, i18n |

**Největší výhra za nejmenší práci: F1 + F4.** Obojí je S, nesahá do onboardingu ani do dat a jde do jedné verze. Nováček hned uvidí poloviční Domů a čistší Nastavení. Hned potom F2, což je skutečné zjednodušení (3 moduly místo 7), ale sahá do onboardingu, takže potřebuje pečlivý test cesty s pozvánkou (`readPendingJoin`, `tourAfterJoin` `app.js:17980`).

Pro každou fázi: `APP_VERSION`, `CHANGELOG` (uživatelský text např. „🌱 Jednodušší začátek: noví uživatelé začínají se 3 moduly, další jim appka nabídne postupně.“), bump `CACHE` v `sw.js`. Pravidla Firestore se **nemění** (všechno je v `users/{uid}/profile/main`). Nové klíče `localStorage` přidat do `LOCAL_PERSONAL_KEYS` (`app.js:1143`). Texty do `i18n/cs.js` i `en.js`.

---

## 9. Čísla: dnes vs. po změně (nováček, cesta Rodina, 1. den)

| Oblast | Dnes | Po F1–F7 |
|---|---|---|
| Volby v onboardingu | 26 (+5 skrytých) | 21 (krok 2: 13 → 8) |
| Zapnuté moduly | 7 | 3 + Rex |
| Okna, tipy a výzvy 1. dne | ~12 | ~6 (uvítání, 2 kroky, toast, 1 nápověda, max. 1 nabídka) |
| Bloky na Domů (banner + karty) | 8 | 4 |
| Místa na Domů, na která jde klepnout | ~21 | ~9 |
| Pojmy na Domů (body, úroveň, výzva, hlavní úkol, citát, energie…) | 6 | 1 („co teď“) |
| Cíle v liště a ve Více | 9 (bez kategorií) | 4 + Více (Rex, Nastavení, Přidat modul) |
| Viditelné volby v Nastavení | ~43 ve 14 sekcích | ~16 v 6 sekcích + 3 sbalené řádky |
| **Celkem prvků a voleb první den** | **~100** | **~55** |

---

## 10. Otázky pro vedoucího (výchozí volba = moje doporučení)

1. **Rex v liště?** Výchozí: **ne**, lišta je Domů + 3 moduly + Více a Rex je v banneru (💬) a první ve Více. Alternativa: Domů · M1 · M2 · Rex · Více, a M3 jde do Více.
2. **Ukázkové návyky bez zaškrtávátka** (přidají se samy, smažou se jedním klepnutím v kartě „Co teď“)? Výchozí: **ano**.
3. **Rozdělení Nastavení na Základní a Pokročilé pro všechny uživatele**, nejen pro jednoduchý režim? Výchozí: **ano** (nic se neodebírá).
4. **Limit nabídek:** 1 za 3 dny? Výchozí: **ano**. Dotaz na upozornění a instalace mají vlastní spouštěče, ale počítají se do limitu.
5. **Body se počítají od prvního dne, ukazují až po odkrytí?** Výchozí: **ano**, po odkrytí člověk uvidí body, které už nasbíral („Zatím jich máš 30“), a to motivuje víc než nula.
