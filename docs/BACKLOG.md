# Backlog (neblokující nálezy z testů a revizí)

## Z 4.75 (2026-10-21)
- Štíty série se počítají od okna 60 dní (může se lišit od 4.74). 4.78: ponecháno – dotažená historie (`hlNeedHistory`) je jen na některých zařízeních, štíty by se pak mezi zařízeními lišily a `gameAutoShield` by zapisoval podle toho, kde je historie. Rozdíl nastane jen při použití štítu v prvních ~14 dnech okna. Řešení: počítat štíty na serveru nebo ukládat stav štítů do logu.

## Plánované notifikace (server, S4)
- Události 00:00–00:57 nedostanou upozornění hodinu předem (cron bere jen dnešek).
- Změna času: na podzim upozornění 03:00–03:59 dvakrát, na jaře vůbec.
- Vlastní typy událostí (`customEvTypes`) s časem nedostanou upozornění (server bere jen `type==='event'`).
- Každoroční 29. 2. se v nepřestupném roce nepřipomene; vícedenní události jen první den.
- Čtení roste s historií událostí s časem; varianta bez čtení: klient zapisuje nejbližší připomínky do profilu.
- `evWindow`: `a>=1440` → null; sjednotit konstanty okna s podmínkou v cyklu.

## Z 4.77
- Jen parťák bez nákupů: pravidelné nákupy zmizí z kontextu AI (záměr).
