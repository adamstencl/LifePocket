# Backlog (neblokující nálezy z testů a revizí)

## Z 4.75 (2026-10-21)
- Zásoby: skloňování suroviny („200 g mouky“ vs. zásoba „Mouka“) se nespáruje.
- Štíty série se počítají od okna 60 dní (může se lišit od 4.74).
- Odznak „Pisatel“ se nevyhodnotí při vypnutém Deníku.
- Desktopová PWA spadá pod `isStandaloneApp()` → 60s limit Google okna i tam.
- `lp_adm`: změna správce se projeví až další den (jen UI).

## Plánované notifikace (server, S4)
- Události 00:00–00:57 nedostanou upozornění hodinu předem (cron bere jen dnešek).
- Změna času: na podzim upozornění 03:00–03:59 dvakrát, na jaře vůbec.
- Vlastní typy událostí (`customEvTypes`) s časem nedostanou upozornění (server bere jen `type==='event'`).
- Každoroční 29. 2. se v nepřestupném roce nepřipomene; vícedenní události jen první den.
- Čtení roste s historií událostí s časem; varianta bez čtení: klient zapisuje nejbližší připomínky do profilu.
- `evWindow`: `a>=1440` → null; sjednotit konstanty okna s podmínkou v cyklu.
