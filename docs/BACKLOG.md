# Backlog (neblokující nálezy z testů a revizí)

## Z 4.75 (2026-10-21)
- `refreshProfileFromServer`: událost `online` přijde dřív než spojení Firestore → zopakovat 2–3× po pár s; nepřihlásí nové skupiny (`familyId`, `extraGroupIds`) ani jazyk.
- `checkRecurringShop` offline: nastavit `_recShopWait=true` / spustit po `online`, jinak se položka přidá až při dalším startu.
- `checkRecurringShop`: když `addDoc` po zápisu `lastAdded` selže, ukázat toast (teď jen konzole).
- Modul `rex` spouští i pravidelné nákupy → toasty „přidáno do nákupu“ uživateli bez Nákupů.
- `pantryHit` páruje oběma směry („Mléko kondenzované“ → Mléko); zvážit jen jeden směr nebo přesnou shodu v `offerPantryUpdate`. „100% kakao“ → „% kakao“, skloňování („200 g mouky“) nesedí.
- `lp_fs_retry` v sessionStorage spotřebuje i běžné odhlášení; na ř. ~1410 doplnit `!_accDeleting`.
- Chyba listeneru `shop` nechá nudge čekat 2 min.
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
