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

## Z 5.00 (připomínka jídelníčku)
- Lokální připomínka (bez push tokenu) jen při otevřené appce, nedohání se v `checkMissedNotifications`; změna z jiného zařízení nepřeplánuje lokální časovač.
- Profil bez `modules`: server připomínku pošle, klient (`hasMod`) ne – sjednotit.
- Zápis `mealRemind` ze zařízení se starým profilem může vrátit `on` (stejně jako `notifSettings`).
- Kopie jídelníčku ze skupiny nezapisuje `mealPlanAt`; vynechání podle plánu skupiny by stálo čtení navíc.

## Z 5.01 (odložení připomínky návyku)
- Bez push tokenu odkládá appka (`setTimeout` 15 min) jen při otevřené appce; zavřená appka = odložení se ztratí (SW bez okna nic nedělá).
- Lokální počítadlo (`lp_hsnz`) a serverové (`profile.habitSnz`) jsou oddělené; záloha přes appku při chybě serveru limit serveru nevidí.
- Kvůli 5min cronu přijde odložená připomínka za 15–20 min.
- Starý klient (cache před 5.01) může celoprofilovým zápisem vrátit `habitSnz` na starší stav téhož dne → nejvýš odložení navíc.

## Z 5.01 (odložení připomínky)
- Timeout SW (5 s) po úspěšném zápisu na serveru → odloží i appka (dvě připomínky se stejným tagem, rozejdou se počítadla).
- Po úspěšném odložení SW nic nepotvrdí (u pití krátké potvrzení je).
- Vlastník si může přepsat `profile.habitSnz` a obejít limit 3 (jen sám sobě).
- iOS akční tlačítka v notifikacích neukazuje – odložení tam není vidět.

## Z 5.02 (panel po klepnutí na připomínku)
- `hspShow` zavírá jen lištu „Další krok“; s otevřenou nabídkou propojení pití nebo sdílení se překryjí. `ctaAskShare` nekontroluje `naCovered()`.
- `hspDone` nekontroluje datum: panel otevřený přes půlnoc zapíše včerejšek.

## Z 5.04 (jídlo → recept)
- `mprStart` při běžícím dotazu (`_mprBusy`) a klepnutí u jiného jídla: nic se nestane – přidat toast.
- `mprGen` catch: chybový toast i po zavření okna (`if(_mpr===st)`).
- `openMealPicker` `curHTML`: ochrana `typeof === 'string'` proti poškozené hodnotě.
- Sjednotit ořez názvu receptu (plán 200 / normRecipe 80 / zrcadlo 100).

## Z 5.05 (regresní audit – zbytek)
- `scaleQty`: zlomky a desetinná čárka („1/2 lžičky“ → „0.5/2“, „1,5 lžíce“ → „0.8“, „1 ks“ → „0.5 ks“) – nově viditelné i v Jídelníček → nákup.
- Porce receptů v Do nákupu: přepočet jen když je v plánu jídlo bez receptu; jídlo s prázdným klíčem (emoji) přepočte recepty bez okna – sjednotit.
- `mealplanToShopping`: `shopActive` načíst až po `await mpiCacheLoad()`.
- `delEvent`: osiřelou kopii mazat jen v jejím kalendáři (`pgid`/osobní), ne naslepo ve všech; příznak proti dvojímu dotazu během čekání 3 s.
- Cron: slot z `event.scheduleTime`; při časové pojistce rotovat začátek seznamu uživatelů; `reminderTime` ve tvaru HH:MM:SS server nenajde (klient ho nevytváří).

## Z 5.07 (jméno parťáka)
- Jméno z emoji: `ctxT(…, AV_NAME_MAX)` počítá UTF-16 → v promptu se ořízne; `maxlength` 20 pustí jen 10 emoji. Sjednotit (code pointy nebo ×2).
- `avNameWrite` catch: nehlídá změnu účtu (uid) a souběh dvou zápisů.
- `cleanAvName`: doplnit U+061C, U+180E, U+3164, U+034F, tag znaky E0000–E007F (i do `ctxStrip`).
- Po obnově profilu ze serveru překreslit i stránku parťáka a Nastavení.

## Z 5.08 (celková kontrola)
- `.ev-icon` přeteče s dlouhým cizím `typeEmoji` (jen podvržená data) – omezit šířku.
- Předání správce: člen si může zapsat `joinedAt` = `createdAt` skupiny (stará slabina, ořez ji jen zmírňuje).
- `deleteAccount` s `trusted=true` maže rekurzivně chybějící skupinu z `prof.familyId` (klientem zapsané) – osiřelá data po neúplné rotaci.
- privacy bod 5: po nasazení nových `firestore.rules` upravit formulaci „po nasazení…“.
- Indexy: nepoužitý `participants (n ASC, joinedAt ASC)`; TTL `activity`/`reactions`/`challenges.expireAt` jen v konzoli – zapsat do `fieldOverrides`.
- Workflow: připnout `actions/*` a `firebase-tools` na přesné verze.

## Z 5.09 (Doplň včerejšek)
- Ranní push „Včera nevyplněno“ nepočítá štíty – den, který štít zalepí, server hlásí, appka pak nic nenabídne.
- Samostatná volba připomenutí včerejška i bez ranního souhrnu; odložení „Později/Nepřipomínat“ je jen v zařízení.
- Popup „Nový odznak“ přesahuje spodní okraj panelu o 5–10 px.

## Z 5.10 (UX úpravy)
- Zpět u skupinových dat (checklist, smazat splněné, událost) obnovuje přes `setDoc` – při souběhu dvou členů může vzkřísit nebo přepsat; obnovovat transakcí jen když dokument neexistuje.
- `lpAsk` okna nemají vlastní záznam v historii (systémové Zpět).
- Den 0 v jednoduchém režimu: „Co teď · Odškrtni návyk“ a „Návyky dnes“ ukazují stejné návyky.
- Karta „Mám ti připomínat nákup?“ v Co teď pro profil Nákupy (nedodělané).
- Převést zbylé `confirm()` (`archiveHabit`, `removeSamples`, `dashReset`, `grp.codeFixedQ`) a `prompt()` v `landing.inAppCopy` na `lpConfirm`/`lpCopy`.

## Z 5.13
- Šipka bubliny parťáka (`.avtxt::before`) je kvůli `overflow:hidden` oříznutá – vyřešit jinak než overflow.
- Pozvaný člen, který použije „Opravit adresu“, dál zabírá místo ve skupině přes starý účet (do jeho smazání).
- `err.aiVerify` tvrdí „odkaz ti přišel“, i když odeslání při registraci selhalo (`_verifyUnsent`).
- ci-check: allowlist českých literálů snížit na 196.

## Z 5.14 (finální kontrola)
- `destroyAllFireSubs()` nemaže `_subReady` (dnes nevadí kvůli reloadu).
- Jídelníček: jídlo k neděli zapsané v neděli po 12:00 jde na příští neděli – ověřit s UX (dnešní večeře „posunutá“).
- `pnPlace`: na nízkém displeji lišta Zpět, která se nevejde nad panel, hned zmizí; na iOS (`html.lp-iosb` !important bottom) může překrýt panel.
- `ctMarkOpen`: poděkování se neukáže, když se krok splní dřív než `ctSync`.
- Vestavěný prohlížeč: neověřeno na skutečném FB/Instagramu; mealplan člen smí zapisovat dle pravidel (omezení jen klient); App Check; profil čten cronem i bez tokenu.
- Snížit allowlisty ci-check (inline interpolace 8, české literály 197).

## Z 5.15 (revize Finance + K1 + K2)
- Skupinový rozpočet: správu (smazat/přesunout) hlídá jen klient (`finCanManage`); zvážit pravidlo pro `finBudgets` (pravidla schvaluje uživatel) nebo zmírnit text v privacy.
- Parťák se `finAi` dostane i souhrny skupinových rozpočtů a název skupiny – doplnit privacy nebo posílat jen „sdílený“.
- `lp_ai_intro` (drží UID) přidat do `LOCAL_PERSONAL_KEYS`.
- `<meta name="referrer" content="strict-origin">` do index.html (ochrana `oobCode`).
- `finMoveGo` / `finDelete` nejsou atomické – při chybě druhé fáze zůstanou kopie; dočistit při dalším otevření.
- Starší kopie profilu může přepsat `aiEntry` / `finAi` z jiného zařízení (stejně jako `healthConsent`).
- Ověřit v prohlížeči: návrat z akční stránky do přihlášení bez přihlášení nepřepne zpět na landing, e-mail zůstane předvyplněný.
