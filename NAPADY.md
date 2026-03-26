# 💡 Nápady na vylepšení LifePocket

Sem si piš nápady kdykoli — probereme a naplánujeme implementaci.

---

## 🚀 Nápady

### ✅ ~~Spíž / Lednice / Mrazák (Pantry tracker)~~
**Stav: HOTOVO** — záložka Zásoby uvnitř modulu Vaření.

~~Modul pro sledování zásob doma.~~

**Jak by to fungovalo:**
- Na začátku zapíšeš co máš doma (lednice, mrazák, spíž) — název + množství + jednotka
- Když uvaříš recept, ingredience se automaticky odečtou ze zásob
- Když nakoupíš položku a odškrtneš ji v nákupním seznamu, automaticky se přičte do zásob
- Přehled co dochází (červeně zvýraznit položky s nízkým množstvím)
- AI může navrhovat recepty na základě toho co máš doma ("Co uvařit z toho co mám?")

**Propojení s existujícími moduly:**
- Vaření → po uvaření receptu nabídne odečtení ingrediencí
- Nákupy → po odškrtnutí položky nabídne přičtení do zásob
- Rex AI → může doporučovat recepty podle aktuálních zásob

**Rozhodnutí:** Záložka uvnitř modulu Vaření (ne samostatný modul)
```
[ 🍳 Recepty ]  [ 🧊 Zásoby ]
```
**Priorita:** Na později

---

### ✅ ~~Voda tracker~~
**Stav: HOTOVO** — widget na dashboardu, denní reset, Rex pochválí.

**Zbývá:** Přesunout do opt-in (ne vždy viditelný) — viz sekce "Water tracker opt-in" níže.

---

### ✅ ~~Denní focus (MIT — Most Important Task)~~
**Stav: HOTOVO** — widget nahoře na dashboardu, denní reset, localStorage.

---

### ✅ ~~Týdenní review (Rex)~~
**Stav: HOTOVO** — spouští se každou hodinu, v neděli vygeneruje AI shrnutí a uloží do zápisníku.

**Jak by to mělo fungovat:**
- Každou neděli notifikace nebo automatické otevření
- Rex vygeneruje AI shrnutí: návyky, cíle, jídla, nálada
- Uloží se jako zápisník záznam

**Priorita:** Opravit bug

---

### ✅ ~~Foto v zápisníku~~
**Stav: HOTOVO** — tlačítko 📷 v editoru, komprese, uložení do Firestore, thumbnail v seznamu.

---

### ✅ ~~Nálada tracker~~
**Stav: HOTOVO** — widget na dashboardu, 5 emoji, Rex reaguje.

**Zbývá:** Widget zmizí po kliknutí (jednou denně) — viz sekce "Jak se dnes cítím" níže.

---

### ⚔️ Gamifikace — Rex jako Tamagotchi *(Fáze 1 HOTOVO)*
Rex se stane živou postavou jejíž stav odráží jak plníš návyky a cíle.

**Fáze 1 — Nálada Rexe (jednoduchý start):**
- Rex má energii 0–100% podle splněných návyků daného dne
- Vizuální stav: 😴 Unavený / 😊 Spokojený / 💪 Nabitý / 🔥 V zóně
- Zobrazuje se přímo na Rex stránce i na dashboardu

**Fáze 2 — XP a levely:**
- Každá aktivita dává XP: splněný návyk (+10), streak bonus (+5/den), uložený recept (+5), splněný cíl (+50)
- Rex leveluje: Mladý bojovník → Zkušený → Mistr → Legenda
- Každý level = nový titul + změna vzhledu Rexe

**Fáze 3 — Questy:**
- Týdenní výzvy: "Splň 5 dní v řadě" → bonus XP
- Měsíční: "Přidej 3 recepty" / "Dosáhni cíle" → nový Rex skin

**Propojení:**
- Dashboard → mini Rex stav (emoji + energy bar)
- Rex stránka → plný profil s XP, levelem, historií

**Priorita:** Na později


---

---

### 🏗️ Refaktoring Phase 2 — Architektura kódu

Audit odhalil dva větší technické dluhy, které zatím nerušují funkčnost ale zhoršují udržovatelnost kódu.

**1. Rozdělení app.js na moduly**
- `app.js` = 5 500+ řádků, vše v jednom souboru
- Plán: Rozdělit na ES modules (`habits.js`, `journal.js`, `cooking.js`, `calendar.js`, `settings.js`, `ai.js`, `state.js`)
- Vyžaduje refaktoring globálních proměnných na importy/exporty
- **Riziko:** Vysoké — nutné otestovat každý modul po rozdělení
- **Prerekvizita:** Více feature-complete stav, aby se při refaktoru nemusel kód přepisovat znovu

**2. Inline HTML v JS → template funkce**
- Celá UI se renderuje jako template stringy v JS (`buildHabitCard()` = 142 řádků HTML)
- Přidání tlačítka = úprava v JS místo HTML
- Možné řešení: Přejít na Lit HTML, Alpine.js nebo Preact (minimální bundle, žádný build step)
- Alternativa: Zachovat vanilla JS ale extrahovat template do čistých helper funkcí v samostatném souboru

**Doporučený postup:**
1. Počkat až bude aplikace feature-complete
2. Přejít na Vite (build tool) + zachovat Firebase přímý přístup
3. Rozdělit do modulů
4. Postupně nahrazovat template strings za čistší řešení

**Priorita:** Až bude produkt stabilní (cca po dokončení gamifikace/Rex Tamagotchi)

---

### 🌍 Anglická mutace aplikace
Přeložit LifePocket do angličtiny — otevřít appku širšímu publiku.

**Jak by to fungovalo:**
- Přepínač jazyka v nastavení (🇨🇿 / 🇬🇧)
- Všechny texty v UI přes lokalizační slovník (`i18n.cs.js` + `i18n.en.js`)
- Rex mluví anglicky pokud je vybraná EN mutace
- Firestore data zůstanou stejná (jazykově neutrální), jen UI se přeloží
- GitHub Pages URL: `?lang=en` nebo subdoména

**Technický přístup:**
- Vytvořit objekt `T` s klíči pro všechny texty
- `T.key` místo hardcoded stringů v JS/HTML
- Postupně — začít navigací a dashboardem, pak zbytek

**Priorita:** Na později (po stabilizaci funkčností)

---

### ✅ ~~What's New — changelog při startu aplikace~~
**Stav: HOTOVO** — `APP_VERSION`, `CHANGELOG` array, modal při prvním spuštění nové verze.

---

### ✅ ~~Jídelníček — přidat jídlo z receptu~~
**Stav: OPRAVENO** — chyběl `renderMealPlan()` po uložení, UI se neaktualizovalo.

---

### 📊 Dashboard — personalizace a logika řazení
Dashboard je "myšmaš" — widgety jsou pro každého jinak důležité.

**Návrh řešení:**
- Každý uživatel si může widgety přeřadit (drag & drop nebo pořadí v nastavení)
- Nebo: inteligentní výchozí logika — zobrazit jen widgety relevantní pro daný den/čas
  - Ráno: nálada + focus + voda
  - Odpoledne: jídelníček + návyky
  - Večer: Rex shrnutí + zápisník
- Skrýt widgety modulů které uživatel nevyužívá

**Priorita:** Na později

---

### 💧 Water tracker — samostatný modul, ne nativně na dashboardu
Ne každý chce sledovat vodu — widget by neměl být vždy vidět.

**Návrh:**
- Přesunout do samostatného modulu (nebo záložky ve zdraví)
- Na dashboardu se zobrazí jen pokud si ho uživatel zapne v nastavení
- Opt-in widget

**Priorita:** Přepracovat (původní plán byl nativně na dasboardu — změna záměru)

---

### ✅ ~~Rex — bez receptů v konverzaci~~
**Stav: OPRAVENO** — systémový prompt přepsán, Rex nezmiňuje jídlo pokud se uživatel sám nezeptá.

---

### 💬 Rex — motivační citát na dashboardu
Rex každý den zobrazí krátký motivační/chytrý citát nahoře na dashboardu.

**Jak by to fungovalo:**
- Generovat přes Claude API (nebo lokální pool citátů jako fallback)
- Jednou denně nový citát, cachovat do localStorage
- Krátký, pozitivní, relevantní pro den (může zohledňovat náladu nebo splněné návyky)
- Výrazně zobrazený nahoře — ne jako chat bublina, spíš "denní slovo"

**Poznámka:** Dobrý nápad — citáty dávají rexovi osobnost a každodenní přítomnost bez rušení.

**Priorita:** Implementovat brzy

---

### 🎨 Témata — zjednodušit na světlé/tmavé
Momentálně 4 témata — zbytečně moc.

**Návrh:**
- Jen světlé + tmavé téma
- Barvy akcent lze řešit jinak (profilová barva, ne celé téma)

**Priorita:** Na později

---

### 🎨 Ikony modulů — nahradit černe ikony za hezké
Aktuální ikony jsou celé černé — nevýrazné, bez charakteru.

**Návrh:**
- Barevné nebo dvoubarevné ikony pro každý modul
- Každý modul má svou barvu (návyky = zelená, jídelníček = oranžová, zápisník = modrá...)
- Nebo emoji jako ikony — jednoduché a cross-platform

**Priorita:** Na později (UX polish)

---

### 🦖 Rex nálada — z celého používání, ne jen návyků
Momentálně Rex energie = % splněných návyků.

**Problém:** Uživatel bez návyků bude mít Rexe vždy smutného.

**Návrh:**
- Celkové skóre aktivity: záznamy v zápisníku + splněné checklist položky + nálada + jídlo + návyky
- Každá aktivita přispívá trochu — Rex reaguje na to jestli uživatel vůbec appku používá
- Váhy: návyky 40%, checklist 20%, zápisník 20%, nálada 10%, jídlo 10%

**Priorita:** Opravit (před další gamifikací)

---

### ✅ ~~Obnova hesla~~
**Stav: HOTOVO** — link "Zapomenuté heslo?" v login formuláři, `sendPasswordResetEmail` přes Firebase.

---

### 🔔 Push notifikace — Service Worker upgrade
Bez push notifikací nelze uživatele upozornit v přesný čas (ranní check-in, večerní review, připomínka vody...).

**Co to odemkne:**
- Přesné ranní/večerní připomínky (Jak se cítíš? / Rex večerní shrnutí)
- Připomínka návyků pokud do X hodin nesplněno
- Weekly review notifikace v neděli večer
- Water tracker připomínka každé 2 hodiny

**Technicky:**
- PWA Service Worker + Web Push API (Firebase Cloud Messaging = FCM, zdarma)
- Uživatel musí jednou povolit notifikace v prohlížeči
- FCM token se uloží do Firestore profilu
- Notifikace se odesílají přes Firebase Functions (nebo jednoduché trigger pravidlo)
- Na Androidu funguje skvěle i když je appka zavřená

**Prerekvizita pro:**
- Přesný čas "Jak se dnes cítím" widgetu
- Večerní Rex shrnutí
- Habit reminder

**Složitost:** Střední — Service Worker + FCM setup + Firebase Functions
**Priorita:** Důležité — odemkne spoustu dalších funkcí

---

### 😊 Jak se dnes cítím — jednou denně, pak zmizí
Widget nálady na dashboardu by se měl zobrazit jen jednou denně a po kliknutí zmizet.

**Jak by to fungovalo:**
- Každý den v určitou dobu se widget zobrazí (nastavitelné: ráno / večer)
- Po kliknutí na emoji widget zmizí na zbytek dne
- Příští den se zobrazí znovu
- Uživatel si v nastavení vybere čas: "Ranní check-in (8:00)" nebo "Večerní check-in (21:00)"

**Jak zjistit čas:** Appka je PWA bez push notifikací (zatím) — widget se zobrazí při prvním otevření appky po nastaveném čase, ne přesně v tu chvíli. Push notifikace by to vyřešily perfektně ale jsou komplexnější.

**Priorita:** Implementovat brzy

---

### ✅ ~~Zůstat přihlášený — auto-login~~
**Stav: OPRAVENO** — splash loading screen, login se zobrazí až po Firebase auth check.

---

### 👥 Počet uživatelů — analytika
Jak zjistit kolik appku používá uživatelů?

**Možnosti:**
- Firebase Console → Authentication → Users (rychlé, zadarmo)
- Firestore kolekce `users/{uid}/meta` s `lastSeen` timestampem — zjistíš aktivní uživatele
- Google Analytics for Firebase (zdarma, detailnější)
- Jednoduchý vlastní counter: při každém loginu inkrementovat counter v Firestore

**Doporučení:** Nejjednodušší start = Firebase Console → Authentication. Pokud chceš víc, přidat `lastSeen` do Firestore profilu.

**Priorita:** Na později

---

### ✅ Checklist / Úkolníček
Jednoduchý seznam úkolů — náhrada za Google Keep / Samsung Notes.

**Jak by to fungovalo:**
- Více listů: "Denní úkoly", "Víkend", "Práce", vlastní název
- Přidat úkol jedním klepnutím, odškrtnout hotové
- Hotové úkoly zůstanou přeškrtnuté (nebo možnost vymazat splněné)
- Sdílené listy s rodinou (jako nákupní seznam)
- Připnutí důležitých úkolů nahoru

**Rozdíl od Návyků:**
- Návyky = opakující se každý den
- Checklist = jednorázové úkoly které odškrtneš a jsou hotové

**Rozdíl od Zápisníku:**
- Zápisník = volný text, myšlenky, deník
- Checklist = akční seznam s odškrtáváním

**Priorita:** Implementovat brzy
