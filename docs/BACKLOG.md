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
