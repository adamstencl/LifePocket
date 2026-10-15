# Úkoly pro Adama (čeká na uživatele)

Seznam věcí, které musí udělat uživatel (přihlášení, klíče, testy v telefonu). Vedoucí týmu ho průběžně aktualizuje.

## Otevřené
- [ ] **Výzva měsíce (4.63) – nasazení:** GitHub → Actions → „Deploy Firestore rules“ → Run workflow → napsat `ANO`. Když běh spadne, pošli mi screenshot chyby (staré pravidla zůstanou, nic se nerozbije). Při chybě oprávnění k indexům přidat servisnímu účtu `github-deploy` roli „Cloud Datastore Index Admin“.
- [ ] **Výzva měsíce – správce:** v appce Nastavení → Účet → ID účtu → 📋. Firebase konzole → Firestore → kolekce `config` → Přidat dokument, ID `admins`, pole `uids` typu array s jednou položkou (string) = zkopírované ID. Pak appku znovu načíst → v Nastavení je 🛠️ Správa výzev.
- [ ] **Výzva měsíce – první výzva:** založit listopadovou výzvu pár dní před 1. 11. a vyzkoušet přihlášení, odškrtnutí a žebříček.
- [ ] **Pitný režim (4.62):** zapnout modul a ověřit připomínku po 2 h bez pití.
- [ ] **Model AI:** ve Firebase konzoli → Firestore → `config/ai` → pole `model` zjistit hodnotu. Pokud je Haiku 4.5, přepnout na Haiku 5.5 (lepší čeština). Napsat mi hodnotu, pošlu přesný postup.
- [ ] **Recept od AI:** po aktualizaci (4.58) nechat vygenerovat recept a zkontrolovat češtinu.
- [ ] **Zvuk notifikací:** otestovat se zapnutým zvukem telefonu; v Android Nastavení → Aplikace → LifePocket/Chrome → Oznámení zkontrolovat, že kanál je „Upozorňovat“, ne „Tichý“.
- [ ] **Recept → nákup (4.57):** se skupinou se sdíleným nákupem zkusit „Do nákupu“ a výběr seznamu.
- [ ] **Nový průvodce (4.60):** založit testovací účet (jiný e-mail) přes odkaz pozvánky do své skupiny – zkontrolovat 3 kroky průvodce, nabídku připojení a krátkou prohlídku; na mobilu zkusit i systémové Zpět na okně pozvánky.
- [ ] **Aktualizace appky** na všech zařízeních (zavřít a otevřít, případně stáhnout dolů).
- [ ] **Obnova skupiny:** vyzkoušet obnovení původní skupiny (zakladatel) a připojení druhého člena kódem.
- [ ] **Příspěvky:** v `support.json` vyplnit IBAN a `enabled: true` (přes GitHub web), až budeš chtít zapnout.
- [ ] **Právní texty EN:** nechat zkontrolovat právníkem (dozorový úřad EU, věková hranice, přednost české verze).
- [ ] **Google Play:** založit vývojářský účet, až bude appka hotová (návod `docs/GOOGLE-PLAY.md`).
