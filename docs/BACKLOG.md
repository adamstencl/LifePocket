# Backlog (neblokující nálezy z testů a revizí)

## Z 4.75 (2026-10-21)
- Štíty série se počítají od okna 60 dní (může se lišit od 4.74). 4.78: ponecháno – dotažená historie (`hlNeedHistory`) je jen na některých zařízeních, štíty by se pak mezi zařízeními lišily a `gameAutoShield` by zapisoval podle toho, kde je historie. Rozdíl nastane jen při použití štítu v prvních ~14 dnech okna. Řešení: počítat štíty na serveru nebo ukládat stav štítů do logu.

## Plánované notifikace (server, S4)
- Čtení roste s historií událostí s časem; varianta bez čtení: klient zapisuje nejbližší připomínky do profilu.

## Z 4.77
- Jen parťák bez nákupů: pravidelné nákupy zmizí z kontextu AI (záměr).

## Z 4.78
- 29. 2.: server připomíná v nepřestupném roce 28. 2., ale kalendář (`getEventsForDate`) a ranní souhrn ji ten den neukáží; narozeniny 29. 2. se na serveru v nepřestupném roce nepřipomenou.
- Lokální záloha `checkEventReminders` (bez push tokenu) a `notifAskSoon` berou jen `type==='event'`, neřeší půlnoc ani změnu času.
- `evWindow` s neplatnou zónou bez `normTz` hodí TypeError (dnes se tak nevolá).
- Víc vypršelých dotazů zásob naráz → víc toastů za sebou, vidět je jen poslední.
- `syncGroupsFromProfile`: skupina smazaná mimo změnu kódu („duch“) blokuje přidání nových skupin do restartu; `_profRefreshing` se uvolní dřív než doběhne sync.

## Z 4.81
- `hlRevert`: dva rychlé zápisy stejného záznamu, první selže → vrátí zastaralou zálohu.
- `saveSubGImpl`: při chybě zápisu zůstane podcíl „duch“ v `subs[gid]`.
- Widget Návyky na Domů: řádky ukazují i týdenní / dnes neaktivní návyky, počítadlo je nezahrnuje (jen týdenní → „0/0“).
- `habitDayRoll` po půlnoci nepřekreslí Domů (`rDash`).
- Měsíční pohled: `return` přeskočí `habits-archive-toggle` a `hb-pend-chip`.
- `getEvIcon`: `typeEmoji` cizího člena zkrátit i při čtení.
- `delG`: podcíle mazat až po úspěšném smazání cíle.
- Voda: změna cíle nepřepíše `goal` v dnešním dokumentu → po půlnoci se včerejšek hodnotí podle starého cíle.
- Narozeniny → zpět na Událost nechá opakování „ano“.
- Šipka › u dne návyků aktivní i na dnešku; budoucí buňky mají `cursor:pointer`.
- Týdenní návyky: série a procenta po dnech (potřebuje návrh).
- Server: `habit.nag` nekontroluje modul Návyky; en „all 2 habits“.

## Z 4.83
- `clOfflineWrite` neběží v `clQueue`: dvě rychlé offline úpravy mohou číst stejnou cache; offline zápis celého `items` může po připojení přepsat cizí změny (jako před 4.83).
- Dvě chyby za sebou: druhý `undo` vrátí stav s první neuloženou změnou (opraví další snapshot).
- `scaleQty`: zlomky „1/2“, rozsahy „2-3“, „1.000 g“, desetinná tečka.
- `shopPantryUndo`: prázdné jméno, „vráceno“ i u smazané zásoby, dvojí přičtení při rychlém odškrtnutí během načítání.
- Lišta „Přičíst / Jako nová“ zůstane po zrušení odškrtnutí; starý recept z chatu → zavádějící toast.
- Vlastní AI jídelníček přes `updateDoc` – bez `profile/main` skončí not-found.
- Kategorie: Brambory, Rajčata, Jablka, Vejce, Pepř → Ostatní; Zubní pasta → Trvanlivé; suroviny z receptu bez kategorie nepoužijí `guessShopCategory`.
- Měsíční pravidelná položka se přidá hned při založení (i před 4.83).

## Z 4.84
- `doRegisterFcmToken`: trvale selhávající `deleteToken` → nový účet nikdy nedostane push; počítat pokusy (`lp_fcm_reset_n`), po 3 příznak zahodit; vlastní hláška.
- Po 8s timeoutu běží řetězec getToken→deleteToken dál; souběh s ruční registrací může smazat čerstvý token.
- Onboarding krok 1: jedno Zpět „naprázdno“ (zbylý záznam panelu).
- `togModSet`: dvě rychlá přepnutí, první selže → rollback zahodí i druhé.
- Prohlídka během otevřeného modalu: Zpět vrátí krok prohlídky, modal zůstane.
- sw.js `no-cache`: offline obrázky mimo OFFLINE_URLS → 503.
- `IN_APP_BROWSER`: TikTok a appky bez značky v UA se nerozpoznají.

## Z 4.85
- Mobilní tabulka návyků: tečky teď 18 px (pravidla konečně platí) – ověřit klikací plochu.
- `--keyboard-offset` při pinch-zoomu s otevřenou klávesnicí zůstává na poslední hodnotě.
- Tangerine `.btn-p:hover` stín i u `.gcomplete-btn`.
- `--text3` na card2/card3 4,1–4,65:1.
- `.hlogo` aria-label „Domů“ vs. viditelný text; `.habit-check` aria-pressed nerozliší „nesplněno“.
- Plochy ⏭ / − + do stran jen +2 px (ne 44 px na šířku).

## Z 4.86
- Skryté karty (návyky, série, deník, nálada) se v rDash pořád počítají – přidat `!dHid.has(id)`.
- Zavření modalu přes ✕/Hotovo nevrací záznam historie ani fokus na ✏️ (jako ostatní modaly); `.macts` tlačítka 39–40 px.

## Z 4.87
- `buildChatContext`: prázdné `catch(e){}` u kalendáře – přidat `console.warn('[LP] ctx cal', e?.name)`.
- `chatSend`: nouzové zkracování `chatCtx` řeže uprostřed bloku (dnes se nespustí) – řezat po řádcích.
- `ctxStem`: 5písmenná slova → 4 znaky přidávají falešné shody („domov“ → „domo“).
- `CTX_STOP`: duplicitní slova.

## Z 4.88
- `renderChecklist`: rozepsaný text z `#cl-new-inp` může přejít do jiného seznamu, pokud se při přepnutí záložky nepřesune fokus – ukládat id seznamu a porovnat.
- Počítaný návyk na mobilu: štítek „0 / 10“ v 1. řádku, ovládání ve 2. – UX kontrola.

## Z 4.89
- `chainSave`: odebraný 1. krok s připomínkou – nový 1. krok ji nedostane ani nenabídne.
- 1. krok s připomínkou přetažený do jiné rutiny: připomínka se jen nabídne, nepřesune.
- Smazání 1. kroku dvoukrokové rutiny: zbylý návyk zůstane bez připomínky.
- „Spustit rutinu“ přes celou obrazovku, řádek rutiny na Domů, body/odznak za rutinu (4.90+).

## Z 4.91
- Týdenní: `checkAndRemindHabits` a `calcWeekSummaryRaw` počítají cíl podle `times`, ne podle cíle upraveného pauzou/založením.
- Zrcadlo ve skupině: starší klienti (≤4.90) uvidí týdenní sérii jako „N dní“; `mirrorDoc` drží starý `best` ve dnech.
- Pilulka „x/y tento týden“ při prohlížení dne z minulého týdne.
- Dny `rest` kontrast 2,1–2,3 (opacity .55).
- Pauza od pondělí po prvním splnění zmenší cíl na 1 (podle návrhu, zneužitelné).
- Detail týdenního: dokud se nedotáhne historie, dlaždice 12/26/celkem krátce ukazují nižší čísla.

## Z 4.93 (finální kontrola)
- Celkový výkon v detailu ignoruje frekvenci (app.js `renderHabitDetail`, dlaždice „celkem“).
- Nejednotné počty x/y v hlavičce skupiny návyků a u Rexe (hlavička počítá všechny aktivní, Rex jen `habitsDue`).
- Offline archivace, pauza a smazání v detailu návyku nereagují (`await updateDoc` visí bez sítě).
- Slabý kontrast stavů `.inactive` / `.pre` / `.future` ve světlých motivech.
- Prompt injection přes neviditelné znaky v `</data>` (normalizovat/odstranit zero-width znaky před vložením dat do promptu).
- Osobní checklist offline přepíše celý seznam (zápis celého dokumentu z paměti).
- Fotka checklistu se přilepí k další položce.
- Opakovaná vícedenní událost se v mřížce kalendáře ukáže jen první den.
- Přerušené připojení ke skupině nejde zopakovat.
- Hlášky jídelníček → nákup a volné párování receptů.

## Z 4.96 (připomínky)
- `notifTimers` roste při dlouhém offline (scheduleDaily opakování přidává ID) – držet jeden handle v closure.
- Připomínka s vlastním časem bez push tokenu propadne, když data ze serveru nedorazí do 2 min – dohnat při prvním `habitRemindReady()` (do ~30 min).
- Komentář u `checkMissedNotifications` (app.js ~6833) neodpovídá chování.
- SW data-only větev u zastaralé připomínky: raději zobrazit a hned zavřít (iOS).
- Různé zóny zařízení vs. `prof.tz` kolem půlnoci mohou skrýt platnou připomínku.

## Týdenní souhrn (neděle večer)
- Lokální náhrada bez push tokenu (klient by souhrn sestavil sám v čase večerního souhrnu) – zatím jen push ze serveru.
- Každoroční události se pro souhrn čtou všechny (`repeat == 'yes'`); při velkém počtu narozenin zvážit uložené `md` (MM-DD) a rozsah.
- Série se před pondělí dohledává nejvýš 42 čteními; delší nedohledaná série se ukáže jako „N+“.
- Týdenní cíl v souhrnu je podle aktivních dnů (`habitWeekStat`), karta týdne na Domů (`calcWeekSummaryRaw`) počítá s `times` – sjednotit.

## Z 4.98 (revize + test)
- Týdenní souhrn: `weeklySent=true` až po úspěšném pushi (functions ~1666), jinak při chybě nepřijde ani večerní.
- Týdenní souhrn: do počtu událostí nepočítat zrcadla mazlíčka (`vet`, granule), osobní `vet` jen s modulem pets.
- `deleteHabit`/`archiveHabit`/`moveHabitToGroup`: při chybě se nevrátí `unshareAll` a `chainHeadGone` (volat až po úspěchu nebo `syncShared` v catch).
- Jídelníček → nákup: při `mealGrp[g].err` věčné „Načítám…“ – rozlišit chybu.
- Detail návyku „Celkem“ před dotažením historie počítá staré dny jako nesplněné; po `hlNeedHistory` zavolat `hbDetailRefresh`.
- Přetažení: karta uskočí od prstu na krátké stránce (dočasná zóna nahoře); čára dopadu chybí u `.hb-next` (box-shadow) a u cizí rutiny ukazuje jiné místo, než kam návyk dopadne.
- Hlavička skupiny počítá nevyřízené týdenní návyky, Domů (`habitsDue`) ne – sjednotit.
- Fotka checklistu: `clNewPhotoList` nastavit před `await compressImage`.
- `moveHabitToGroup` přečísluje jen nearchivované; `renderEvList` s neplatným rozpětím ukáže původní rok; opakovaný join může zapsat 2× aktivitu „připojil se“.
