# LifePocket – pravidla práce

Česká PWA (návyky, cíle, kalendář, poznámky, vaření, nákupy, AI společník). Vanilla HTML/CSS/JS + Firebase + Anthropic API. Komunikace s uživatelem vždy česky, stručně.

## Role
Vedoucí týmu řídí, nekóduje. Kód píše agent `koder`, návrhy `ux-designer`, testy `tester`, review `revizor` (definice v `.claude/agents/`).

## Samostatnost (99 %)
Uživatel nechce schvalovat průběžné kroky. Pracuj samostatně od zadání po nasazení.

Postup: návrh (jen pokud jde o UI) → koder → tester a revizor souběžně → commit, push, nasazení funkcí → krátký report.

**Bez ptaní, jakmile je test zelený a revizor schválil:** `git add`, `git commit`, `git push origin main`, `firebase deploy --only functions`.

**Vždy se zeptat (zbylé 1 %):**
- nasazení `firestore.rules` (`firebase deploy --only firestore:rules`)
- nevratné mazání dat nebo souborů (Firestore, uživatelská data, soubory v repu)
- `git push --force`
- hesla, platby, tokeny a klíče: nikdy je nezadávám a nevkládám, zadává je uživatel

## Review a testy
- Revizor blokuje jen to, co přináší aktuální změna (nová chyba, regrese, zranitelnost v diffu). Starší chyby a „hezké by bylo" jdou do backlogu a push neblokují.
- Maximálně 2 kola test + review na úkol. Po druhém rozhoduje vedoucí a zbytek se zapíše jako poznámka.
- Malé změny (texty, verze, dokumentace) stačí lehká kontrola.
- Testy jsou statické (čtení kódu, grep, `node --check`, simulace v node). Běh v prohlížeči jen s testovacími účty a přihlášením provádí uživatel.
- Agenti nesmí spouštět lokální servery a skripty, které vyžadují schvalování.

## Verze
Každá viditelná změna = `APP_VERSION` + záznam v `CHANGELOG` (app.js) česky pro uživatele + bump `CACHE` v `sw.js`. Změny v `manifest.json`, ikonách a `pwa.js` vyžadují jednorázovou reinstalaci PWA na zařízeních.

## Reporty
Stručně, česky, na konci úkolu: hotovo / běží / čeká na uživatele. Otázky v jednom seznamu s mým doporučením jako výchozí volbou.

## Paralelní práce
Soubor `app.js` je velký a sdílený: jen jeden koder naráz, nebo oddělený `git worktree` a pak sloučit. Nesahat do cizích rozpracovaných souborů.

## Architektura a rozhodnutí
- Hosting: GitHub Pages, doména `lifepocket.app` (soubor `CNAME`), push do `main` = nasazení appky. Service worker je network-first, `CACHE` se bumpuje při změně souborů.
- Firebase projekt `lifepocket-d8f0e`, plán Blaze (bez něj Cloud Functions nefungují). Funkce v `europe-west1`: `claudeProxy` (AI, limit 50/den přes `rateLimits/{uid}`), `notifyFamily`, `testPush`, `sendScheduledNotifications` (cron každých 5 min, Europe/Prague), `dailyStats` (03:10, anonymní souhrny do `config/stats_daily`), `deleteAccount` (smazání účtu z appky), `rotateGroupCode` (nový kód skupiny, přesun dat). Model AI se přepíná v `config/ai.model` (allowlist Haiku 4.5 / 5.5) bez nasazení.
- GitHub Actions (`.github/workflows/`, nastavení v `docs/GITHUB-ACTIONS.md`): CI kontroly na každý push a PR, funkce se nasadí samy po změně `functions/**`, pravidla Firestore jen ručně se zadáním „ANO". Ověřeno funkční 2026-10-07 (servisní účet `github-deploy`, secret `FIREBASE_SERVICE_ACCOUNT`, Cloud Billing API zapnuté). Při změně funkcí stačí push, nasazení proběhne v cloudu bez PC.
- Pravidla Firestore: `users/{uid}/**` jen vlastník; `config/**` zavřeno; `rateLimits/{uid}` jen čtení; `families/{id}` get ano, list ne, nové skupiny jen s ID `WORD-XXXXXX` (6 znaků z `FAMILY_CODE_ALPHABET`, bez I/L/O/0/1), starší skupiny mají `WORD-NNNN` a dál fungují; max. 8 členů v pravidlech (hlavní skupinu na 6 hlídá klient). `FAMILY_WORDS` a abeceda v app.js se musí shodovat s pravidlem (hlídá ci-check).
- Push: tokeny v `users/{uid}/profile/main.fcmTokens` (mapa podle deviceId) plus legacy `fcmToken`. Mrtvé tokeny maže server jen při kódech `registration-token-not-registered` a spol., nikdy plošně při chybě oprávnění. Server posílá `data.tag` shodné s `webpush.notification.tag` (jinak vzniknou dvě notifikace).
- Android PWA: stabilní `/manifest.json` s `id:"/"`, skutečné PNG ikony včetně maskable. iOS: notifikace jen z aplikace přidané na plochu (iOS 16.4+).
- Kód: uživatelský text do HTML vždy přes `esc()`, do inline handlerů přes `data-aN` a `this.dataset.aN` (nikdy `onclick="fn('${x}')"`). Datum „dnes" přes `toDS()` (lokální čas), nikdy `toISOString().slice(0,10)`.
- AI chat: `buildChatContext()` skládá přehled všech modulů, limit ~7000 znaků, data uživatele jsou v promptu označená jako data (instrukce z nich se neplní).
- Při ručním smazání uživatele smazat rekurzivně i podkolekce (errorLogs, events, habits …).
- Tajemství: `*firebase-adminsdk*.json` je v `.gitignore` a nesmí do gitu ani do URL remote. Adresa `origin` je čistá `https://github.com/adamstencl/LifePocket.git`, přihlášení přes Git Credential Manager.
