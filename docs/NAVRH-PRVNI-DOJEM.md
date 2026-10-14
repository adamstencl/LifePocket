# Návrh: první dojem nového uživatele (LifePocket 4.58)

Statická procházka kódu (index.html, app.js, style.css, i18n/cs.js, pwa.js) očima člověka, který dostal odkaz na `lifepocket.app` do telefonu (390×844) a nikdy appku neviděl. Tok: landing → registrace → onboarding → Domů → první návyk/nákup → skupiny → Rex → notifikace.

Seřazeno podle poměru dopad / náročnost (rychlé výhry nahoře). Náročnost: **S** = do půl dne, **M** = 1–2 dny, **L** = větší přestavba.

| # | Co | Dopad | Náročnost |
|---|----|-------|-----------|
| 1 | Bouře oken v první minutě | velký | S |
| 2 | Pozvaný člověk čeká na připojení až po celém průvodci | velký | S |
| 3 | Spodní lišta: Nákupy schované ve „Více“, popisky 9 px | velký | S |
| 4 | Domů pro nováčka: „Začínáme“ až druhé, pod tím energie a body | střední | S |
| 5 | Texty: žargon, anglicismy, mužský rod, vykání | střední | S |
| 6 | První načtení: landing až po ~750 kB, záblesk tmavá → světlá | velký | S (část) / L (zbytek) |
| 7 | Onboarding: povinné pohlaví, avatar tiše vybírá moduly | velký | M |
| 8 | Notifikace se nikde neptají v pravou chvíli | velký | M |
| 9 | Rex: úvodní návrhy potřebují data, která nováček nemá | střední | S–M |
| 10 | Formuláře: „Skupina“ v návyku, „Vymazat splněné“ jako hlavní tlačítko | střední | M |

---

## 1. Bouře oken v první minutě (S)

**Problém.** Po „🚀 Jdeme na to!“ dostane nový člověk během ~10 s postupně nebo naráz:
- uvítací okno průvodce (1 s) a 6 kroků prohlídky (`app.js:16199`, `app.js:16034`),
- okno **„Co je nového ve verzi 4.58“** (1,5 s), protože `lp_seen_version` je prázdné (`app.js:530`, `app.js:12399`); pro nováčka nesmysl,
- toast „📧 Ověř svůj email“ (`app.js:888`),
- kartu **„🌱 Nově: růst s Rex“** (`app.js:5986`, `i18n/cs.js:668`): „nově“ nedává smysl a „s Rex“ je špatně skloňované,
- bublinu Rexe s AI pozdravem (`app.js:12401`),
- banner „Nainstaluj LifePocket“ / iOS návod (`pwa.js:100`, `pwa.js:44`), který se zobrazuje už **na landingu a v registraci**, překrývá spodní část karty (bottom:76px) a po zavření se na iOS už nikdy neukáže,
- po prohlídce znovu **stejné texty** jako nápovědy modulů při první návštěvě stránky (`app.js:16165`: prohlídka klíče `lp_hint_*` nenastaví, takže se text zopakuje), plus tipy ke sdílení (`app.js:10265`).

**Návrh.** Jedno pravidlo: *nováček vidí v jednu chvíli nejvýš jedno okno a první den žádné „novinky“.*
- `checkChangelog`: když `prof.createdAt` je mladší 1 den nebo `lp_seen_version` chybí, jen uložit verzi a nic neukázat.
- `gameIntroHTML`: pro účty mladší 7 dní nezobrazovat (nebo text bez „Nově“, např. „🌱 Za splněné návyky sbíráš body a {av} roste s tebou.“; v `game.intro.title` opravit skloňování, „s Rexem“ jde přes pád ve slovníku avatarů).
- Prohlídka: při průchodu stránkou nastavit `lp_hint_<modul>`, aby se text neopakoval.
- Prohlídku zkrátit na **uvítání + 3 kroky max.** (Domů, hlavní modul ze šablony, Rex), ne všech 6 modulů.
- Instalační banner (Android i iOS) neukazovat na obrazovkách `s-login`, `s-step*`; poprvé až po prvním „aha“ (první položka v nákupu / první splněný návyk), a dát trvalou položku „📲 Přidat na plochu“ do Nastavení.
- Toast o ověření e-mailu posunout až po skončení průvodce.

---

## 2. Pozvaný člověk čeká na připojení až po celém průvodci (S)

**Problém.** Pozvánka je hlavní cesta, jak se appka bude šířit (manžel pošle odkaz manželce). Landing slibuje „Založ si účet nebo se přihlas **a hned se připojíš**“ (`i18n/cs.js:35`), ale `checkPendingJoin` čeká, dokud běží průvodce (`app.js:7830`, podmínka `tourActive()`). Pozvaný tedy projde: registrace → 3 kroky onboardingu → uvítání → 6 kroků prohlídky → závěrečné okno → **teprve teď** dotaz „Připojit ke skupině?“. Cca 12 obrazovek, a ve všech mezitím vidí prázdný nákup místo rodinného.

**Návrh.**
- S pozvánkou (`readPendingJoin()`) v kroku 3 předvybrat šablonu **Rodina** (obsahuje Nákupy a Kalendář).
- Po `finishOnboard` zobrazit dotaz na připojení **hned** (před průvodcem); průvodce spustit až po odpovědi a rovnou ukázat sdílený nákup.
- Text landingu nechat, bude pravdivý. Do okna pozvánky přidat jméno toho, kdo zve, pokud je v dokumentu skupiny.

---

## 3. Spodní lišta: Nákupy ve „Více“, popisky 9 px (S)

**Problém.**
- `buildNav` (`app.js:12431`, `app.js:12442`) dává do lišty první 4 položky v pevném pořadí: Domů, Rex, a pak moduly podle pořadí v `MODS` (návyky, poznámky, kalendář …). Pro šablonu **Rodina** je výsledek *Domů · Rex · Návyky · Kalendář · Více* a **Nákupy, tedy hlavní slib landingu, jsou až ve „Více“**.
- Popisky mají `font-size:9px` (`style.css:638`) a neaktivní barvu `--text3`: kontrast **2,6 : 1** v tmavém a **3,0 : 1** ve světlém režimu (WCAG chce 4,5 : 1).
- Druhé tlačítko nese jméno avatara („Rex“, „Nora“): nováček neví, co se za ním skrývá.
- Nastavení, kde jsou i Skupiny, je vždy ve „Více“ až na konci.

**Návrh.**
- Pořadí lišty podle šablony / hlavního modulu: Domů · *hlavní modul* (Rodina → Nákupy, Student → Kalendář, Zdraví → Návyky) · druhý modul · Rex · Více. Uživatel si pořadí může později upravit v Nastavení → Moduly (stačí šipky nahoru a dolů).
- Pod emoji Rexe dát popisek „Rex“, ale v průvodci a v `aria-label` použít „AI parťák Rex“.

Před / po (CSS):
```css
/* před */
.bnbtn{color:var(--text3);…}
.bnbtn .bn-lbl{font-size:9px;…}
/* po */
.bnbtn{color:var(--text2);…}           /* 5,9 : 1 ve světlém, 6,3 : 1 v tmavém */
.bnbtn .bn-lbl{font-size:11px;letter-spacing:0}
.bnbtn.active{color:var(--accent)}
.bnbtn.active .bn-lbl{font-weight:700}  /* aktivní stav nejen barvou */
```

---

## 4. Domů pro nováčka (S)

**Problém.** Pořadí na Domů (`app.js:12575–12620`): Focus („Co musíš udělat dnes?“) → karta Začínáme → „Nově: body“ → týdenní souhrn → Rex **energie 0 %** (pro nováčka smutný prázdný ukazatel) → denní citát (volá AI hned při prvním otevření, `app.js:12607`) → teprve widgety modulů. Na 844 px je karta „Začínáme“ pod ohybem nebo těsně na něm. V kartě Začínáme je druhý úkol „Nastav dnešní focus“ (`app.js:5588`), anglicismus. Řádky úkolů jsou `div` s `onclick`, ne tlačítka (čtečky, klávesnice).

**Návrh.**
- První 3 dny (nebo dokud není Začínáme hotové): **Začínáme nahoře**, Focus pod ní, energie Rexe a „Nově“ karty skryté.
- Úkoly karty seřadit podle šablony (Rodina: 🛒 Přidej první položku do nákupu → 👨‍👩‍👧 Pozvi rodinu → 🗓️ Přidej narozeniny…). Max. 4 úkoly.
- `qs-task` jako `<button type="button">` s min-height 44 px.
- Citát pro nováčka ze zálohy (`quote.N`), AI citát až od druhého dne, šetří denní limit 50 dotazů.

---

## 5. Texty: žargon, anglicismy, rod (S)

**Problém a návrh** (vše v `i18n/cs.js`, pár míst natvrdo v `index.html`):

| Kde | Teď | Návrh |
|-----|-----|-------|
| `cs.js:73` `auth.note` | 🔒 Zdarma · Data ve Firebase · AI přes Anthropic | 🔒 Zdarma a bez reklam · Tvoje data vidíš jen ty a tvoje skupina |
| `cs.js:362`, `:385` | focus, „Nastav dnešní focus“ | „Co je dnes nejdůležitější?“ / „Hlavní úkol dne“ |
| 27× v `cs.js` | streak | série (landing už používá „série“) |
| `cs.js:205` | 🔔 Push notifikace | 🔔 Upozornění |
| 11× v `cs.js` | Klikni … | Klepni … (mobil) |
| `cs.js:1770` | Prozkoumám sám, díky | Projdu si to sám/sama → lépe „Zatím ne, díky“ |
| `cs.js:1856`, `:1845` | Co bych měl…, co jsi dělal | Co mám dnes udělat…, co se dnes dělo |
| `cs.js:239` | 📬 Napište nám | 📬 Napiš nám |
| `cs.js:80` | Ověř svůj email | Ověř svůj e-mail |
| `cs.js:1774` | najdeš v ⚙️ Nastavení | lišta používá 🔧, sjednotit emoji |
| `index.html:266` | tlačítko „Odhlásit“ v hlavičce vedle jména (12 px, cca 28 px vysoké) | na mobilu skrýt, odhlášení je v Nastavení; snadno se trefí omylem |
| `index.html:318, 330, 341, 356` | popisky „Skupina“, „Typ“, „Emoji“, „Frekvence“ bez `data-i18n` | doplnit klíče (v EN zůstávají česky) |
| `index.html:786` | „● Online“ natvrdo | klíč ve slovníku |

---

## 6. První načtení: landing až po ~750 kB (S + L)

**Problém (z pohledu uživatele).** Návštěvník z odkazu vidí **jen spinner**, dokud se nestáhne a nespustí celý `app.js` a Firebase a nepřijde odpověď `onAuthStateChanged` (`index.html:73` má `s-loading` aktivní, landing ukazuje až `app.js:991`). Odhad přenosu (gzip):

| Soubor | gzip |
|--------|------|
| index.html (z toho ~85 kB base64 obrázky, ty se nekomprimují) | 109 kB |
| app.js (16 274 řádků, neminifikováno) | 268 kB |
| Firebase app/auth/firestore/messaging/functions (5 modulů z gstatic) | ~200 kB |
| i18n/cs.js + ai-cs.js + i18n.js | 46 kB |
| style.css | 32 kB |
| Google Fonts: 2 rodiny, 10 řezů, blokuje vykreslení | ~80–100 kB |
| **celkem před prvním textem landingu** | **~750 kB, cca 12 požadavků** |

Na průměrném 4G to jsou 2–4 s, na slabém signálu 8 s a víc spinneru. Navíc `:root` v CSS je tmavý (`style.css:3`), ale výchozí téma je světlé „sunshine“ a nastaví ho až JS (`app.js:4184–4195`), takže obrazovka **blikne z tmavé na světlou**.

**Rychlé výhry (S):**
- `index.html:95` ikona na landingu je **86 kB base64 JPEG**: nahradit `<img src="icon-192.png" width="72" height="72">` (nebo 128px WebP, cca 8 kB). `index.html:1037` QR kód Lightning (31 kB base64) v Nastavení: přesunout do souboru a načítat `loading="lazy"`. **HTML se zmenší asi na polovinu.**
- `icon-192.png` (75 kB) zkomprimovat (pngquant) na ~15 kB, je na splashi.
- Téma nastavit v inline skriptu v `<head>` (už tam je skript pro jazyk, `index.html:40`): `document.documentElement.dataset.theme = localStorage.lp_theme || 'sunshine'`. Konec záblesku.
- Landing ukázat okamžitě: v tom samém inline skriptu, pokud není `lp_owner_uid` a nejde o PWA na ploše, přepnout `s-loading` → `s-login` ještě před stažením `app.js` (tlačítka „Začít zdarma“ / „Mám účet“ počkají na `window.showAuthPanel`; do té doby jen přepnou sekci přes `hidden`).
- Fonty: ponechat jen použité řezy (Crimson Pro 400/600/700, Playfair 700 italic), `font-display:swap` už je.

**Větší krok (L, pro kodéra):** rozdělit `app.js` na jádro (auth, Domů, lišta) a moduly načítané `import()` při prvním otevření stránky (vaření, jídelníček, skupiny, gamifikace); Firebase Messaging a Functions načítat líně (až při povolení upozornění / prvním dotazu na AI); minifikovat při buildu nebo aspoň v CI.

---

## 7. Onboarding: povinné pohlaví, avatar tiše vybírá moduly (M)

**Problém.**
- Krok 1 vyžaduje pohlaví, bez něj je „Pokračovat“ neaktivní (`app.js:3881`). Pro část lidí nepříjemné, nikde není vysvětleno proč (kvůli tvarům „splnil/splnila“).
- Krok 2 „Vyber si svého společníka“ podle nálady („Tvrdý trénink, jasné cíle“) **potichu určuje moduly** (`AVMODS`, `app.js:590`): výchozí Rex = návyky, cíle, poznámky, **bez Nákupů**, přestože landing začíná „🛒 Nákup pro celou rodinu“. Kdo si vybere Rexe, sdílený nákup v appce nenajde.
- „← Zpět“ v kroku 1 vede na přihlašovací obrazovku, i když už je uživatel přihlášený (`index.html:206`).

**Návrh (nové pořadí, stále 3 kroky):**
1. **Jak ti máme říkat?** Jméno + volba oslovení jako tři čipy: „👨 Muž“ „👩 Žena“ „🙂 Neuvádět“ s malým textem „Jen aby ti appka psala správně česky.“ „Neuvádět“ použije neutrální tvary (nebo mužské jako dnes, bez nutnosti volit).
2. **K čemu appku chceš?** Šablony jako dnes (Rodina / Student / Zdraví + „Vlastní výběr“), moduly pod nimi. Šablona Rodina předvybraná, když existuje pozvánka.
3. **Vyber si parťáka** (Rex, Nora …) s předvybraným doporučením podle šablony; jen vzhled a styl řeči, **moduly už nemění**. Tlačítko „Jdeme na to!“ aktivní hned.

Rozložení na 390 px: šablony ve 3 sloupcích jsou OK; karty avatarů ve 3 sloupcích (`style.css:653`) mají vibe text zalomený na 2 řádky, ponechat.

---

## 8. Upozornění: žádný dotaz v pravou chvíli (M)

**Problém.** Systémové okno povolení se vyvolá jen tlačítkem v Nastavení (`app.js:4473`, `index.html:936`) nebo při nastavení času připomínky návyku (`app.js:2216`). Nováček tedy upozornění typicky nikdy nezapne, a přitom landing slibuje „Upozornění ti přijde do telefonu“ a skupiny stojí na tom, že „co koupí partner, tobě se hned odškrtne“. Na iPhonu navíc funguje jen z appky na ploše, a jediný návod (iOS banner) se ukáže na landingu a po zavření zmizí natrvalo.

**Návrh: „měkký dotaz“ kartou, pak teprve systémové okno.**
Spustit jednou, v první z těchto chvil: po připojení ke skupině, po přidání první události s připomínkou, po 3. splněném návyku.

```html
<div class="invite-hint" role="region" aria-label="Upozornění">
  <span class="invite-hint-em" aria-hidden="true">🔔</span>
  <div class="invite-hint-body">
    <div class="invite-hint-t">Chceš vědět, když ti Jana něco přidá do nákupu?</div>
    <div class="invite-hint-d">Pošleme ti jen to důležité. Vypnout to můžeš kdykoli v Nastavení.</div>
    <button type="button" class="invite-hint-btn" onclick="enableNotifications()">🔔 Zapnout upozornění</button>
  </div>
  <button type="button" class="invite-hint-x" aria-label="Teď ne">×</button>
</div>
```
- Využívá existující komponentu `.invite-hint` (ladí s kartami pozvánek).
- Na iOS mimo plochu karta místo tlačítka ukáže tři kroky „Sdílet → Přidat na plochu → otevři z plochy“ (text z `ios.*` už existuje) a dodá „Po otevření z plochy se přihlas znovu“, protože iOS appka na ploše nesdílí přihlášení se Safari.
- „×“ = odložit na 7 dní, ne navždy.

---

## 9. Rex pro nováčka (S–M)

**Problém.** Úvodní návrhy v chatu (`index.html:808–814`): „📊 Týdenní report“, „Jak plním cíle?“, „Shrnutí pokroku“, „Moje nálada“. Nový člověk nemá data, takže dostane prázdnou nebo vymyšlenou odpověď a spálí dotazy z denního limitu 50. Hlavička chatu skládá avatar, úroveň, energii, náladu a lištu „🎙️ Přehled dne“, na 844 px zbývá na zprávy zhruba polovina výšky. Návrhy jsou `div` (ne tlačítka), menší než 44 px.

**Návrh.**
- Pro účty bez návyků a cílů jiné návrhy (podle šablony): „Co všechno umíš?“, „Pomoz mi vymyslet první návyk“, „Naplánuj mi jídla na týden“ (Rodina), „Jak si rozvrhnout učení?“ (Student). Report a náladu ukázat až po 7 dnech.
- Lištu „Přehled dne“ sbalit do ikony 🎙️ vedle mikrofonu ve vstupním řádku.
- Pod vstup malý šedý text „Zbývá 47 zpráv na dnešek“ až od 40. dotazu (aby limit nepřekvapil).
- Čipy jako `<button>` s `min-height:44px`.

---

## 10. Formuláře: první návyk a první nákup (M)

**Problém.**
- Formulář návyku (`index.html:315–400`) začíná polem **„Skupina“** (Ráno/Den/Večer), přičemž „skupina“ v appce jinak znamená sdílení s rodinou. Následuje 6 dalších polí (Typ, Emoji, Frekvence, Připomínka, Cíl). Název je až druhý.
- Nákupy (`index.html:663–664`): v hlavičce je hlavní (žluté) tlačítko **„✓ Vymazat splněné“** i na prázdném seznamu a vedle „📤 Sdílet“; obě cca 32 px vysoká. Hlavní akce (přidat položku) má menší váhu než mazání.
- Cíle (`index.html:763`): nad prvním cílem karta „✦ Moje vize: Klikni ✏️ a napiš svoji vizi pro každou oblast…“, abstraktní úkol dřív, než má člověk jediný cíl.

**Návrh.**
- Návyk: pořadí **Název** (autofocus) → řada čipů s nápady („💧 Pít vodu“, „🚶 Procházka“, „📖 Čtení“, které vyplní název i emoji) → **Uložit**. Ostatní pod „⚙️ Další možnosti“ (sbalené, výchozí: denně, ano/ne, bez připomínky). „Skupina“ přejmenovat na **„Kdy během dne“**.
- Nákupy: „Vymazat splněné“ zobrazit jen když je něco odškrtnuté, jako sekundární (`btn-s`); tlačítka v hlavičce `min-height:44px`.
- Cíle: kartu vize skrýt, dokud není aspoň 1 cíl; pak ji nabídnout jako „Chceš si sepsat i velkou vizi?“.

Před / po (hlavička Nákupů):
```html
<!-- před -->
<button class="btn-s" style="width:auto;padding:7px 14px;font-size:14px" onclick="shareShoppingList()">📤 Sdílet</button>
<button class="btn-p" style="width:auto;padding:7px 16px;font-size:14px" onclick="clearDoneItems()">✓ Vymazat splněné</button>
<!-- po -->
<button class="btn-s" style="width:auto;min-height:44px;padding:0 14px;font-size:15px" onclick="shareShoppingList()">📤 Sdílet</button>
<button class="btn-s" id="shop-clear-done" hidden style="width:auto;min-height:44px;padding:0 14px;font-size:15px" onclick="clearDoneItems()">✓ Smazat koupené</button>
```

---

## Mimo top 10 (backlog)
- Skupiny jsou až v 6. sekci Nastavení (Více → Nastavení → scroll). Kontextové pozvánky v Nákupech a Kalendáři to dobře řeší; v Nastavení dát sekci Skupiny hned pod Profil.
- Registrace: požadavek „aspoň 6 znaků“ ukázat předem pod polem hesla, ne až v chybě (`cs.js:77`).
- V Nastavení blok „⚡ Podpořit projekt / BTC Lightning“: pro běžné lidi cizí pojem, nechat jen bankovní převod a Lightning schovat pod „Další způsoby“.
- Instalační banner má natvrdo tmavý gradient (`index.html:47`), ve světlém tématu (výchozím) působí jako cizí prvek: použít `var(--card)` a `var(--border)`.
- Tlačítka průvodce (`app.js:16090` a dál) mají padding 8 px, výška cca 34 px: zvětšit na 44 px.
