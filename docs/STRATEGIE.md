# LifePocket – růst, prezentace, monitoring (návrh 2026-10)

Zásada: **přihlášení a základ zůstávají zdarma.** Hlavní náklad je AI (Anthropic) a Firebase Blaze. Proto nejdřív hlídat náklady, potom zvát lidi.

---

## 1. Rychlé výhry (hodiny práce, udělám sám)

| # | Co | Proč |
|---|----|------|
| 1 | **Meta a OG značky v `index.html`** (popis, náhledový obrázek 1200×630, `og:title`, `og:description`) | Odkaz poslaný přes WhatsApp, Messenger nebo Facebook teď nemá náhled. S náhledem lidi klikají výrazně víc. |
| 2 | **Úvodní obrazovka pro nepřihlášené jako mini landing page** (3 výhody, 3 screenshoty, tlačítko „Začít zdarma“) | Kdo přijde z odkazu, hned uvidí, co appka umí, a ne jen přihlašovací formulář. |
| 3 | **Pozvánka do skupiny jako hlavní cesta růstu** (výraznější „Pozvi rodinu“ u Nákupů a Kalendáře) | Sdílené nákupy jsou důvod, proč si appku nainstaluje i partner nebo partnerka. Každý uživatel přivede 1–3 další. |
| 4 | **„Sdílet LifePocket“ v Nastavení** (Web Share API, text + odkaz) | Nulové náklady, lidi doporučují rádi, když je to jedno klepnutí. |
| 5 | **Rozpočtové alerty v Google Cloud** (Billing → Budgets, např. 5 € / 20 €) a **limit útraty v Anthropic konzoli** | Ochrana proti nečekanému účtu, když appka vyroste nebo ji někdo zneužije. **Musíš nastavit ty** (platby a účty). |

## 2. Monitoring (bez sledování lidí, v souladu se zásadami)

1. **Počty bez osobních dat:** malá serverová funkce jednou denně spočítá souhrny a zapíše je do `config/stats/{datum}` (zavřené pravidly, čte jen admin):
   - noví uživatelé, aktivní za 1, 7 a 30 dní (z `lastSeen` v profilu),
   - počet skupin, počet AI dotazů celkem, počet push tokenů.
   Žádné jméno ani e-mail. Do zásad stačí doplnit jednu větu.
2. **Chyby:** zapisovač chyb už běží (4.23). Další krok je týdenní souhrn nejčastějších chyb, který GitHub Action uloží jako report (bez osobních dat), abych je opravoval bez tvého hlášení.
3. **Dostupnost webu:** UptimeRobot nebo Better Stack (zdarma), hlídá `lifepocket.app` a pošle e-mail, když web spadne.
4. **Návštěvnost webu (volitelné):** Cloudflare Web Analytics nebo GoatCounter. Bez cookies, bez souhlasové lišty, zdarma. Do zásad je potřeba doplnit odstavec.
5. **Náklady:** měsíčně se podívat do Billing a na Anthropic usage. Pokud AI poroste, snížit denní limit (teď 50) nebo zkrátit kontext.

## 3. Prezentace a získávání lidí

- **Google Play přes TWA** (PWABuilder, jednorázově 25 USD za vývojářský účet). Appka bude k nalezení v obchodě, kde lidi aplikace hledají. Kód zůstane stejný. Největší jednorázový efekt. App Store (iOS) stojí 99 USD/rok, ten až později.
- **Krátká videa (Reels/TikTok/Shorts, 15–30 s):** jedno video = jedna funkce („nákupák, který vidí celá rodina“, „Rex mi připomněl návyk“). Natočit 5–10 kusů najednou.
- **České komunity:** FB skupiny o organizaci domácnosti, maminky, minimalismus, vaření, plánování (Notion CZ). Psát jako autor („dělám to po večerech, zdarma, chci zpětnou vazbu“), ne jako reklama.
- **Buy Me a Coffee stránka a „Proč je to zdarma“:** transparentnost (kolik stojí servery) motivuje k dobrovolné podpoře.
- **SEO:** jednoduchá statická stránka `lifepocket.app/o-aplikaci` s textem pro Seznam a Google („sdílený nákupní seznam pro rodinu“, „aplikace na návyky česky“).
- **Zpětná vazba z appky:** tlačítko „Navrhni vylepšení“ (zápis do tvého e-mailu nebo Firestore). Kdo navrhne nápad a ten se objeví v CHANGELOGu, appku sám rád sdílí.

## 4. Co by lidi potěšilo (nápady do appky)

1. **Šablony při prvním spuštění:** „Rodina“, „Student“, „Zdraví“. Rovnou zapnou správné moduly a přidají ukázkové návyky, takže appka není na začátku prázdná.
2. **Nákupy:** „Často nakupované“ jedním klepnutím, množství u položky, řazení podle oddělení obchodu.
3. **Kalendář:** import a export `.ics` (Google Kalendář), sdílené rodinné události s připomínkou.
4. **Návyky:** „zamrazení série“ (nemoc nebo dovolená neshodí streak), týdenní cíl místo denního (3× týdně).
5. **Rex týdenní report jako obrázek ke sdílení:** přirozená reklama.
6. **Export vlastních dat (JSON) a smazání účtu v appce:** důvěra, GDPR a méně e-mailů pro tebe.
7. **Offline přidání do nákupů:** v obchodě bez signálu se položka zapíše po připojení.
8. **Zjednodušení témat na světlé a tmavé** (podle `NAPADY.md`).

## 5. Doporučené pořadí

1. Rozpočtové alerty a limit Anthropic (ty, 10 minut).
2. OG náhled, „Sdílet LifePocket“, landing pro nepřihlášené (já).
3. Denní statistiky bez osobních dat a UptimeRobot (já + ty založíš účet).
4. Šablony při prvním spuštění a „Často nakupované“ (já, s návrhem UI).
5. Google Play přes TWA (ty zaplatíš účet, já připravím balíček).
6. Videa a komunity (ty, já připravím texty a scénáře).
