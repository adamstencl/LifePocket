# 💡 Nápady na vylepšení LifePocket

Sem si piš nápady kdykoli — probereme a naplánujeme implementaci.

---

## 🚀 Nápady

### 🧊 Spíž / Lednice / Mrazák (Pantry tracker)
Modul pro sledování zásob doma.

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

### 💧 Voda tracker
Denní sledování příjmu vody — náhrada za samostatnou appku.

**Jak by to fungovalo:**
- Denní cíl sklenic (výchozí 8, upravitelné)
- Jedno klepnutí = +1 sklenice
- Progress bar na dashboardu
- Rex pochválí když splníš cíl
- Reset každý den o půlnoci

**Priorita:** Implementovat brzy

---

### 🎯 Denní focus (MIT — Most Important Task)
Každé ráno jedna nejdůležitější věc na den.

**Jak by to fungovalo:**
- Widget na dashboardu: "Co musíš dnes udělat?"
- Jedna věta, výrazně zobrazená nahoře celý den
- Večer Rex se zeptá jestli jsi to splnil
- Historie focusů

**Priorita:** Implementovat brzy

---

### 📊 Týdenní review (Rex)
Automatické shrnutí týdne každou neděli.

**Stav:** ⚠️ Funkce existuje v kódu ale nefunguje — opravit!

**Jak by to mělo fungovat:**
- Každou neděli notifikace nebo automatické otevření
- Rex vygeneruje AI shrnutí: návyky, cíle, jídla, nálada
- Uloží se jako zápisník záznam

**Priorita:** Opravit bug

---

### 📸 Foto v zápisníku
Přidat fotku k záznamu v zápisníku.

**Jak by to fungovalo:**
- Tlačítko 📷 při vytváření/editaci záznamu
- Fotka z galerie nebo kamery
- Zobrazuje se v náhledu záznamu

**Priorita:** Na později

---

### 😊 Nálada tracker
Rychlý ranní check-in — jak se dnes cítíš?

**Jak by to fungovalo:**
- 5 emoji: 😞 😕 😐 🙂 😄 — jedno klepnutí, žádný text
- Zobrazuje se na dashboardu jako malý widget
- Rex reaguje na náladu
- Týdenní přehled nálad (barevné tečky v kalendáři)

**Důraz na jednoduchost:** Max 2 vteřiny na vyplnění

**Priorita:** Na později

---

### ⚔️ Gamifikace — Rex jako Tamagotchi
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
