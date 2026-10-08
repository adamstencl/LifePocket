# LifePocket na Google Play (TWA přes PWABuilder)

Stav: návod a příprava, 2026-10-08. Appka v obchodě bude jen „okno“ na `https://lifepocket.app` (Trusted Web Activity). Kód zůstává stejný, web se aktualizuje sám.

Co je hotové v repu:
- `.well-known/assetlinks.json`: šablona propojení webu a aplikace (package `app.lifepocket`, otisky zatím jako zástupný text).

Co **ještě nefunguje** a musí potvrdit vedoucí (krok 0 níže): GitHub Pages zatím složku `.well-known` vůbec nezveřejní.

---

## 0. Než začneš (rozhodne vedoucí, pak push)

### 0.1 Zveřejnění `/.well-known/` na GitHub Pages
Repo nemá `.nojekyll` ani `_config.yml`, takže GitHub Pages web staví přes Jekyll. Ten **vynechává složky začínající tečkou**, tedy i `.well-known`. Adresa `https://lifepocket.app/.well-known/assetlinks.json` by vracela 404 a appka by měla nahoře lištu s adresou (TWA bez ověření).

Doporučené řešení: v kořeni repa vytvořit `_config.yml` s tímto obsahem:

```yaml
# GitHub Pages (Jekyll): zveřejnit /.well-known/ (assetlinks.json pro Android TWA)
include:
  - .well-known
```

Proč ne `.nojekyll`: vypnul by Jekyll úplně a začal by zveřejňovat i ostatní tečkové soubory a složky (`.claude/`, `.github/`, `.firebaserc`, `.gitignore`). Nic tajného v nich není, ale není důvod je servírovat. `_config.yml` s `include` zveřejní jen `.well-known`.

Ověření po pushi (za 1–2 minuty, v prohlížeči): `https://lifepocket.app/.well-known/assetlinks.json` musí ukázat JSON (ne 404, ne přesměrování).

### 0.2 Smazání účtu v aplikaci (podmínka Google Play)
Google Play vyžaduje u aplikací s registrací:
1. možnost **požádat o smazání účtu přímo v aplikaci** (stačí tlačítko v Nastavení, které otevře e-mail nebo formulář),
2. **webovou adresu**, kde jde o smazání požádat i bez aplikace (vyplňuje se v Play Console, Data safety).

Teď je jen e-mail v `privacy.html` (bod 10 a 11). Bod 2 by šel splnit odkazem na `https://lifepocket.app/privacy.html` s kotvou na sekci o smazání, bod 1 potřebuje změnu v appce (viz seznam pro vedoucího na konci).

### 0.3 Odkazy na podporu (Buy Me a Coffee, BTC)
Pravidla plateb Google Play zakazují v aplikaci z obchodu odkazovat na jiné platby za digitální obsah. Dobrovolné spropitné vývojáři je šedá zóna a recenze ho může zamítnout. Bezpečnější je sekci podpory **v TWA skrýt** (viz seznam pro vedoucího). Na webu zůstane.

---

## 1. Účet vývojáře Google Play
1. Jdi na <https://play.google.com/console> a přihlas se Google účtem (doporučuji stejný jako pro Firebase).
2. Typ účtu: **Osobní** (Personal). Zaplať jednorázově **25 USD** kartou (zadáváš sám).
3. Ověř totožnost (občanka) a telefon. Ověření trvá od hodin po pár dní.
4. Kontaktní e-mail vývojáře bude v obchodě veřejný.

**Pozor u nového osobního účtu:** než půjde appka do produkce, musí proběhnout **uzavřené testování s alespoň 12 testery po dobu 14 dní v kuse** (testeři mají appku nainstalovanou). Připrav si 12 Google účtů známých a rodiny (e-maily zadáš do seznamu testerů). Teprve pak jde požádat o přístup k produkci.

## 2. Vytvoření balíčku v PWABuilderu
1. Otevři <https://www.pwabuilder.com>, zadej `https://lifepocket.app` a klikni **Start**.
2. Počkej na skóre manifestu. Varování o screenshotech a kategoriích nevadí (viz seznam pro vedoucího).
3. Klikni **Package for stores** → **Android** → **Generate Package** (nebo **Options** pro nastavení).
4. Nastavení (Options):

| Pole | Hodnota |
|---|---|
| Package ID | `app.lifepocket` (**nejde nikdy změnit**) |
| App name | `LifePocket` |
| Launcher name | `LifePocket` |
| App version | `1.0.0` |
| App version code | `1` (při každém novém .aab o 1 víc) |
| Host / Start URL | `lifepocket.app` / `/` |
| Theme / background color | nechat z manifestu |
| Display mode | Standalone |
| Notification delegation | **zapnuto** (push notifikace půjdou přes Android) |
| Location delegation | vypnuto |
| Google Play billing | vypnuto |
| Fallback behavior | Custom Tabs |
| Signing key | **Create new** (PWABuilder ho vygeneruje) |

5. Klíč: vyplň jméno a organizaci, hesla nech vygenerovat nebo zvol vlastní. **Hesla zadáváš jen ty.**
6. Stáhni ZIP. Obsahuje:
   - `*.aab`: nahraješ do Play Console,
   - `*.apk`: na ruční test v telefonu,
   - `signing.keystore` a `signing-key-info.txt`: **klíč a hesla**,
   - `assetlinks.json`: s otiskem tvého upload klíče.

### Záloha klíče (důležité)
- `signing.keystore` a `signing-key-info.txt` **zálohuj na dvě místa** (např. šifrovaný disk a správce hesel).
- **Nikdy je nedávej do gitu, do chatu ani do e-mailu.** Bez nich nejde nahrát aktualizaci (dá se to řešit jen žádostí o reset upload klíče u Googlu).
- ZIP nerozbaluj do složky s repem.

## 3. Play Console: nová aplikace a interní test
1. Play Console → **Vytvořit aplikaci**: název `LifePocket`, výchozí jazyk **čeština – cs-CZ**, typ **Aplikace**, **Zdarma**, potvrď prohlášení.
2. **Testování → Interní testování → Vytvořit verzi.** Play nabídne **Podpis aplikace Google Play**: přijmi (Google drží podpisový klíč, tvůj klíč z PWABuilderu je „upload klíč“).
3. Nahraj `.aab`, poznámka k verzi např. „První verze“. Ulož a zveřejni pro interní testery (přidej svůj e-mail).
4. Teď doplň otisk do `assetlinks.json` (krok 6), jinak bude mít appka nahoře lištu s adresou.
5. Nainstaluj appku přes odkaz pro interní testery a zkontroluj: bez lišty s adresou, přihlášení přes Google, notifikace.

## 4. Záznam v obchodě (Hlavní záznam v obchodě)
- **Název:** LifePocket
- **Krátký popis** a **Úplný popis:** připravené texty níže.
- **Ikona aplikace:** 512×512 PNG, použij `icon-512.png` z repa.
- **Grafika funkce (feature graphic):** 1024×500 PNG nebo JPG, **zatím není** (máš `Cover canva.png` 1600×400, to je jiný poměr; udělej novou v Canvě 1024×500).
- **Screenshoty telefonu:** minimálně 2, doporučeno 4–8, na výšku (např. 1080×1920 nebo 1080×2400). Udělej je v telefonu: Domů, Nákupy (sdílený seznam), Návyky, Kalendář, AI společník. Bez skutečných osobních dat jiných lidí.
- **Kategorie:** Produktivita (případně Životní styl). **Štítky:** produktivita, návyky, rodina.
- **Kontakt:** e-mail `adam.stencl@gmail.com`, web `https://lifepocket.app`.
- **Zásady ochrany soukromí:** `https://lifepocket.app/privacy.html`

## 5. Obsah aplikace (sekce „Obsah aplikace“ / App content)

### 5.1 Data safety (Zabezpečení dat): co vyplnit
Podle `privacy.html`:

Obecné otázky:
- Shromažďuje nebo sdílí appka data? **Ano.**
- Šifrování při přenosu? **Ano** (HTTPS).
- Může uživatel požádat o smazání dat? **Ano** (e-mailem; až bude, i v appce). Vyplň webovou adresu pro smazání účtu (krok 0.2).
- Reklamy? **Ne.** Sledování (tracking)? **Ne.**

| Typ dat (Play) | Sbírá | Sdílí s 3. stranou* | Povinné | Účel |
|---|---|---|---|---|
| Osobní údaje → Jméno | ano | ne | ano (přezdívka) | Funkce aplikace, Správa účtu |
| Osobní údaje → E-mailová adresa | ano | ne | ano | Správa účtu (Firebase Auth); kontaktní formulář |
| Osobní údaje → ID uživatele | ano | ne | ano | Správa účtu, Funkce aplikace |
| Osobní údaje → Jiné (pohlaví) | ano | ne | ne | Funkce aplikace (tvary slov) |
| Zdraví a fitness → Informace o zdraví | ano | ne | ne | Funkce aplikace (nálada, spánek, stres, voda, kalorie) |
| Zprávy → Jiné zprávy v aplikaci | ano | ne | ne | Funkce aplikace (chat s AI společníkem, upozornění skupině) |
| Fotky a videa → Fotky | ano | ne | ne | Funkce aplikace (fotky u zápisků a checklistů) |
| Zvuk → Hlasové nahrávky | ne** | – | – | – |
| Aplikace → Jiný obsah vytvořený uživatelem | ano | ne | ne | Funkce aplikace (zápisky, cíle, návyky, nákupy, recepty, kalendář) |
| Kalendář → Události v kalendáři | ano | ne | ne | Funkce aplikace (události zadané v appce, ne systémový kalendář) |
| Info o aplikaci a výkonu → Protokoly selhání | ano | ne | ne | Analytika (oprava chyb) |
| Identifikátory zařízení → ID zařízení | ano | ne | ne | Funkce aplikace (push notifikace: token a náhodné ID zařízení) |
| Aktivita v aplikaci → Interakce s aplikací | ano | ne | ano | Analytika (datum posledního otevření, souhrnná čísla) |

\* Google (Firebase), Anthropic a GitHub jsou **zpracovatelé** (service providers), kteří data zpracovávají jen naším jménem. Podle pravidel Play se to **nepočítá jako sdílení**. Data zadaná do AI se zpracují u Anthropicu jen kvůli odpovědi.

\** Diktování používá rozpoznávání řeči v prohlížeči nebo systému, appka zvuk nesbírá ani neukládá.

Data se zpracovávají „dočasně“? U AI dotazů ano (server je neukládá), u ostatního ne (ukládá se do účtu).

### 5.2 Hodnocení obsahu (dotazník IARC)
- Kategorie: **Pomůcky, produktivita, komunikace nebo jiné** (Utility/Productivity).
- Násilí, sex, hazard, drogy: **ne**.
- Komunikace mezi uživateli: **ano** (skupiny: sdílený nákup, události, krátké upozornění členům). Sdílení polohy: **ne**.
- Uživatelský obsah: **ano**, ale jen v uzavřených skupinách s kódem.
- Obsah z AI (generativní AI): **ano** (chat se společníkem). Play u AI appek chce, aby šlo v appce nahlásit nevhodnou odpověď (viz seznam pro vedoucího).

### 5.3 Cílová skupina
- Věkové skupiny: **16–17 a 18+** (Play nemá skupinu 15+; appka je podle zásad od 15 let, nejbližší bezpečná volba je od 16). Nezaškrtávej nic pod 13, jinak se appka dostane do přísných pravidel pro děti.
- Láká appka děti? **Ne.**

### 5.4 Ostatní
- Reklamy: **ne**. Přístup k aplikaci: **část funkcí vyžaduje přihlášení** → zadej testovací účet pro recenzenty (e-mail a heslo zadáš ty, ne do gitu). Vytvoř na to samostatný účet.
- Zpravodajská aplikace: ne. Vládní: ne. Finanční funkce: žádné.

## 6. Doplnění otisku do assetlinks.json
1. Play Console → **Nastavení → Integrita aplikace → Podpis aplikace** (Setup → App integrity → App signing).
2. Zkopíruj **SHA-256 otisk certifikátu** z části **Klíč podepisování aplikace** (App signing key). Nahraď jím `SHA256_FINGERPRINT_Z_PLAY_CONSOLE`.
3. Ze stejné stránky zkopíruj SHA-256 z části **Klíč pro nahrávání** (Upload key; je stejný jako v `assetlinks.json` ze ZIPu PWABuilderu). Nahraď jím `SHA256_FINGERPRINT_UPLOAD_KLICE_Z_PWABUILDERU`. Díky tomu bude bez lišty fungovat i ručně nainstalované `.apk`.
4. Otisk má tvar `AB:CD:12:…` (32 dvojic oddělených dvojtečkou). Tohle **není tajné**, smí do gitu.
5. Commit a push do `main`. Ověř adresu `https://lifepocket.app/.well-known/assetlinks.json`.
6. Kontrola: <https://developers.google.com/digital-asset-links/tools/generator> (doména `lifepocket.app`, package `app.lifepocket`, otisk) → „Test statement“. Pak appku v telefonu zavři a otevři: lišta s adresou zmizí (někdy až po vymazání dat aplikace nebo reinstalaci).

## 7. Uzavřený test a produkce
1. **Testování → Uzavřené testování** → vytvoř seznam testerů (12+ e-mailů), nahraj stejné `.aab` (nebo povýš verzi z interního testu).
2. Testeři se přihlásí přes odkaz a nainstalují appku. Nech běžet **14 dní**.
3. Pak **Produkce → Požádat o přístup** (dotazník o testování) a po schválení **Vytvořit verzi**. První recenze trvá obvykle 1–7 dní.

## 8. Aktualizace appky
- **Běžné změny (app.js, index.html, style.css, funkce):** stačí push do `main` jako dosud. Appka z Play načítá web, takže se aktualizuje sama. Do Play nic nenahráváš.
- **Nový .aab je potřeba jen při změně:** názvu, ikon, barev (`theme_color`, `background_color`), `start_url`/`scope`, splash screenu, nastavení notifikací v TWA, nebo když Google zvedne požadovanou úroveň Android API (zhruba jednou ročně, Play Console upozorní).
- Postup: PWABuilder → stejné nastavení → **Signing key: Use mine** (nahraj zálohovaný `signing.keystore` a hesla) → zvyš **App version** (např. 1.0.1) a **version code** (+1) → nahraj `.aab` do Produkce.
- `assetlinks.json` se při aktualizaci nemění (klíče zůstávají).

---

## Texty pro záznam v obchodě

### Krátký popis (max. 80 znaků)
```
Návyky, kalendář a sdílený nákup pro celou rodinu. S AI společníkem, česky.
```

### Úplný popis (max. 4000 znaků)
```
Jedna appka místo deseti. LifePocket spojí návyky, cíle, kalendář, poznámky, vaření a nákupy na jednom místě. A celá rodina vidí, co je potřeba.

Zdarma, bez reklam a česky.

🛒 NÁKUP PRO CELOU RODINU
Jeden nákupní seznam pro všechny. Co koupí partner, tobě se hned odškrtne. Pravidelné nákupy, oblíbené položky a zásoby doma. Rodinu pozveš jedním odkazem.

🔥 NÁVYKY A CÍLE
Sleduj série, plň malé kroky a koukej, jak se posouváš. Nastav si připomínku na čas, který ti vyhovuje, a návyk odškrtni rovnou z notifikace. Velké cíle si rozděl na podcíle a sleduj, kolik ti zbývá.

🗓️ KALENDÁŘ A PŘIPOMÍNKY
Narozeniny, kroužky i schůzky. Upozornění ti přijde do telefonu. Události můžeš sdílet se skupinou, takže všichni vědí, kdo kdy kam jede.

📓 ZÁPISKY A NÁLADA
Piš si deník, přidej fotku a zaznamenej náladu. Appka z textu pozná, co jsi splnil, a nabídne odškrtnutí návyku.

🍽️ VAŘENÍ A JÍDELNÍČEK
Recepty, plán jídel na týden a nákup podle jídelníčku. Nevíš, co uvařit? Řekni, co máš doma, a dostaneš nápad i s postupem. Odhad kalorií a záznam jídla pro ty, kdo chtějí mít přehled.

✅ CHECKLISTY
Seznamy na dovolenou, stěhování nebo úklid. Hotové položky odškrtáš a checklist můžeš sdílet s rodinou.

💚 ZDRAVÍ
Spánek, energie, stres, voda a nálada na jednom místě. Uvidíš, jak se ti daří v čase.

✨ AI SPOLEČNÍK
Rex, Nora nebo jiný parťák zná tvoje návyky, kalendář i nákupy. Poradí recept, naplánuje týden, připraví ranní pozdrav a týdenní shrnutí a podrží tě, když se nedaří.

👨‍👩‍👧 SKUPINY
Založ skupinu pro rodinu, spolubydlící nebo partu. Sdílíte jen to, co chcete: nákup, události, jídelníček, zásoby a vybrané checklisty. Tvoje zápisky, návyky a chat s AI zůstávají jen tvoje.

🎨 PO SVÉM
Zapni si jen moduly, které používáš. Vyber si světlý nebo tmavý vzhled. Na začátku můžeš zvolit šablonu Rodina, Student nebo Zdraví, aby appka nebyla prázdná.

🔒 SOUKROMÍ
Žádné reklamy a žádné sledovací nástroje. Tvoje data neprodáváme. Data máš v účtu, takže je uvidíš na telefonu i na počítači (lifepocket.app). Podrobnosti najdeš v zásadách ochrany osobních údajů.

LifePocket vyvíjí jeden člověk po večerech. Máš nápad nebo jsi našel chybu? Napiš přes „Napište nám“ v aplikaci nebo na adam.stencl@gmail.com.

Aplikace je určena lidem od 15 let. AI funkce mají denní limit, aby appka mohla zůstat zdarma.
```

---

## Co musí udělat uživatel (Adam)
1. Potvrdit krok 0 (vedoucí zařídí `_config.yml`, smazání účtu v appce a skrytí podpory v TWA).
2. Založit účet vývojáře, zaplatit 25 USD, ověřit totožnost.
3. V PWABuilderu vygenerovat balíček (nastavení podle tabulky v kroku 2), **zálohovat klíč a hesla** mimo repo.
4. Založit aplikaci v Play Console, přijmout podpis přes Google Play, nahrát `.aab` do interního testu.
5. Poslat vedoucímu (nebo sám doplnit) **dva SHA-256 otisky** (krok 6). Ty jsou veřejné, hesla ne.
6. Připravit grafiku: feature graphic 1024×500 a 4–8 screenshotů z telefonu.
7. Vyplnit záznam v obchodě, Data safety, hodnocení obsahu, cílovou skupinu a testovací účet pro recenzenty.
8. Sehnat 12 testerů na 14 dní uzavřeného testu, pak požádat o produkci.

## Navrhované změny kódu (rozhoduje vedoucí)
Povinné pro Play:
1. **`_config.yml`** v kořeni s `include: [.well-known]` (krok 0.1). Bez toho TWA nebude ověřená.
2. **Smazání účtu v appce:** v Nastavení tlačítko „Smazat účet“ (zatím stačí `mailto:` s předvyplněným předmětem, později skutečné smazání přes Cloud Function). Do `privacy.html` přidat kotvu (např. `id="smazani-uctu"`) pro webovou adresu v Data safety.
3. **Skrýt podporu (Buy Me a Coffee, BTC) v TWA:** detekce `document.referrer.startsWith('android-app://app.lifepocket')` při prvním načtení, uložit do `sessionStorage`/`localStorage` a sekci nezobrazit.
4. **Nahlášení odpovědi AI:** u zprávy AI společníka malá akce „Nahlásit“ (pravidla Play pro generativní AI). Stačí zápis do Firestore nebo `mailto:`.

Doporučené (manifest, vyžaduje reinstalaci PWA, dávkovat najednou):
5. `screenshots` v `manifest.json` (2–3 obrázky na výšku, `form_factor: "narrow"`, plus 1 `"wide"`): PWABuilder je hodnotí, Chrome je ukáže v instalačním dialogu. Obrázky do `img/screens/`.
6. `categories: ["productivity", "lifestyle"]`.
7. Sjednotit `theme_color` (`#faf8f0`) a `background_color` (`#fdf8f0`): liší se o jeden odstín, splash a lišta pak nepatrně bliknou. Stačí jedna hodnota.
8. Volitelně `shortcuts` (Nákupy, Návyky, Kalendář) pro dlouhý stisk ikony; v TWA se z nich stanou Android zkratky (nový .aab).

Bez změny (v pořádku):
- `name`, `short_name`, `id: "/"`, `start_url`, `scope`, `display: standalone`, `lang: cs`, ikony 192/512 `any` i `maskable` (skutečné PNG správných rozměrů).
- HTTPS: GitHub Pages s vlastní doménou a certifikátem; vynucení HTTPS ověřit v GitHub → Settings → Pages → „Enforce HTTPS“ (z prostředí agenta nešlo web načíst).
- Offline: service worker má network-first s cache a při výpadku sítě vrací `/index.html` pro navigaci. PWABuilder test offline splní.
