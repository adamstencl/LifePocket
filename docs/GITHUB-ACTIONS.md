# GitHub Actions pro LifePocket

Kontrola a nasazení běží v cloudu GitHubu, počítač nemusí být zapnutý.

| Workflow | Kdy běží | Co dělá |
|---|---|---|
| `ci.yml` | každý push a pull request do `main` | statické kontroly (`.github/scripts/ci-check.js`), bez tajemství |
| `deploy-functions.yml` | push do `main` se změnou `functions/**` nebo `firebase.json`, nebo ručně | nejdřív CI, pak `firebase deploy --only functions` |
| `deploy-rules.yml` | jen ručně, nutné napsat `ANO` | CI a `firebase deploy --only firestore:rules` |

Nasazení appky (GitHub Pages) se nemění: push do `main` ji nasadí jako dosud.

Kontroly jde pustit i lokálně: `node .github/scripts/ci-check.js`.

## Jednorázové nastavení (asi 10 minut)

Potřebuješ jediné tajemství `FIREBASE_SERVICE_ACCOUNT` (klíč servisního účtu). Bez něj CI funguje, ale nasazení skončí chybou „Chybí secret".

### A) Vytvoř servisní účet v Google Cloud

1. Otevři https://console.cloud.google.com/ a přihlas se účtem, který vlastní Firebase projekt.
2. Nahoře vedle loga Google Cloud klikni na výběr projektu (Select a project) a zvol **lifepocket-d8f0e**.
3. Vlevo otevři menu (☰) → **IAM a správa** (IAM & Admin) → **Servisní účty** (Service accounts).
4. Nahoře klikni **+ Vytvořit servisní účet** (+ Create service account).
5. Do pole **Název servisního účtu** (Service account name) napiš `github-deploy`. ID se doplní samo. Klikni **Vytvořit a pokračovat** (Create and continue).
6. V kroku **Udělit tomuto servisnímu účtu přístup k projektu** (Grant this service account access to project) přidej role. Klikni na **Vybrat roli** (Select a role), do hledání napiš název a vyber ho. Další role přidáš tlačítkem **+ Přidat další roli** (+ Add another role). Potřebujeme těchto 7:
   - **Firebase Admin** (`roles/firebase.admin`)
   - **Cloud Functions Admin** (`roles/cloudfunctions.admin`)
   - **Cloud Run Admin** (`roles/run.admin`)
   - **Cloud Scheduler Admin** (`roles/cloudscheduler.admin`)
   - **Service Account User** (`roles/iam.serviceAccountUser`)
   - **Artifact Registry Administrator** (`roles/artifactregistry.admin`)
   - **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`)
7. Klikni **Pokračovat** (Continue) a pak **Hotovo** (Done). Třetí krok (přístup uživatelů) přeskoč.

### B) Vytvoř JSON klíč

1. V seznamu servisních účtů klikni na e-mail účtu `github-deploy@lifepocket-d8f0e.iam.gserviceaccount.com`.
2. Nahoře otevři záložku **Klíče** (Keys).
3. **Přidat klíč** (Add key) → **Vytvořit nový klíč** (Create new key) → typ **JSON** → **Vytvořit** (Create).
4. Do počítače se stáhne soubor `.json`. Zatím ho nikam neposílej a neukazuj.
5. Pokud Google klíč vytvořit nedovolí (hláška o zásadě organizace `iam.disableServiceAccountKeyCreation`), napiš vedoucímu, vyřeší se jinak.

### C) Vlož klíč do GitHubu

1. Otevři soubor `.json` v Poznámkovém bloku (Notepad), stiskni Ctrl+A a Ctrl+C. Zkopíruje se celý obsah, včetně složených závorek.
2. Na GitHubu otevři repozitář LifePocket → **Settings** (Nastavení) → vlevo **Secrets and variables** → **Actions**.
3. Klikni na zelené **New repository secret**.
4. **Name**: přesně `FIREBASE_SERVICE_ACCOUNT`.
5. **Secret**: vlož (Ctrl+V) celý obsah souboru.
6. Klikni **Add secret**. Obsah už se nikde nezobrazí, to je v pořádku.

### D) Smaž stažený soubor

Smaž `.json` ze složky Stažené soubory a vyprázdni Koš. Klíč je teď jen v GitHubu. Soubor nikdy nevkládej do složky projektu, do e-mailu ani do chatu.

### Jak poznat, že to funguje

1. V repozitáři otevři záložku **Actions**.
2. Vlevo klikni na **Deploy functions** → vpravo **Run workflow** → větev `main` → zelené **Run workflow**.
3. Po 2 až 5 minutách má běh zelenou fajfku u obou jobů (CI a Nasazení funkcí). To znamená, že vše funguje.
4. Červený křížek: klikni na běh → na červený job → rozbal červený krok. V logu je přesný důvod.

Zelená fajfka u `CI` se objeví i po každém běžném pushi.

## Role: minimální sada a co dělat při chybě

Sedm rolí výše je doporučená sada pro naše funkce 2. generace (`claudeProxy`, `notifyFamily`, `testPush` jsou `onCall`, `sendScheduledNotifications` je `onSchedule`) a pro pravidla Firestore.

| Role | Proč |
|---|---|
| Cloud Functions Admin | vytvoření a aktualizace funkcí |
| Cloud Run Admin | funkce 2. generace běží jako služby Cloud Run |
| Service Account User | funkce se spouštějí pod runtime účtem, nasazující účet za něj musí smět „vystupovat" (actAs) |
| Cloud Scheduler Admin | časovaná funkce `sendScheduledNotifications` vytváří úlohu v Cloud Scheduleru |
| Artifact Registry Administrator | ukládání obrazů funkcí; Administrator navíc umožní nastavit cleanup policy (viz níž). Samotné nasazení vystačí s rolí Writer |
| Service Usage Consumer | Firebase CLI před nasazením ověřuje, že jsou zapnutá potřebná API |
| Firebase Admin | čtení projektu a nasazení pravidel (obsahuje Firebase Rules Admin); jen pro pravidla by stačilo Firebase Rules Admin + Firebase Viewer |

Poznámky:
- **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) je potřeba jen tehdy, když CLI musí nově zapínat API. Všechna API už jsou zapnutá (funkce se nasazují z počítače), takže Consumer stačí. Kdyby log psal o zapnutí API, přidej Admin.
- **Eventarc a Pub/Sub** teď nepotřebujeme: `onCall` a `onSchedule` na nich nestojí (Scheduler volá funkci přes HTTP). Role Eventarc Admin a Pub/Sub Admin přidej, až budou funkce reagovat na události (např. změny ve Firestore).
- **Cloud Build** běží pod vlastním účtem Googlu, nasazující účet žádnou roli navíc nepotřebuje.
- Seznam vychází z dokumentace Firebase a Google Cloud (nasazení funkcí vyžaduje Cloud Functions Admin a Service Account User, 2. generace navíc Cloud Run a Artifact Registry, časované funkce Cloud Scheduler). Z tohoto prostředí nešlo ověřit živě, proto platí pravidlo níž.
- **Kdyby první běh selhal na oprávnění**, chyba v logu (záložka Actions → červený běh → červený krok) obsahuje přesné oprávnění, např. `Permission 'cloudscheduler.jobs.update' denied`, nebo přímo název role. Tu roli doplň u účtu `github-deploy` (IAM a správa → IAM → tužka u účtu → Přidat další roli) a v Actions klikni **Re-run failed jobs**.

## Cleanup policy (Artifact Registry)

Po úspěšném nasazení někdy Firebase CLI skončí kódem 1 s hláškou „Functions successfully deployed but could not set up cleanup policy". Funkce jsou přitom nasazené. Workflow tuto jedinou konkrétní hlášku bere jako úspěch (vypíše žluté varování), jakákoli jiná chyba běh shodí.

Nepoužívá se `--force`, protože `firebase deploy --force` v CI mimo jiné bez ptaní **smaže funkce, které zmizí z `index.js`**. To je nevratné mazání, které má zůstat na schválení.

Chceš-li varování odstranit, spusť jednou na svém počítači: `firebase functions:artifacts:setpolicy --location europe-west1 --days 3`. Staré obrazy funkcí se pak samy mažou po 3 dnech.

## Bezpečnost

- Klíč servisního účtu je silný: kdo ho má, může měnit funkce a data v projektu. Drž ho jen v GitHub Secrets.
- Secret dostanou jen workflow běžící z větve `main` v tomto repozitáři. Pull requesty z forků ho nedostanou a workflow `pull_request_target` se nepoužívá.
- Při podezření na únik: v Google Cloud (Servisní účty → `github-deploy` → Klíče) klíč **smaž**, vytvoř nový a vlož ho do secretu znovu (postup B a C). Rotuj klíč i bez podezření občas, např. jednou ročně.
- Klíč se během běhu zapíše do dočasného souboru mimo repozitář a po běhu (i po chybě) se smaže.
- Soubor `*firebase-adminsdk*.json` ve složce projektu je jiný, starý klíč. Nepoužívej ho, pro GitHub vytvoř nový, jak je popsáno výše. Zůstává v `.gitignore`.

## Jak spustit nasazení pravidel z mobilu

Pravidla Firestore se nenasazují automaticky. Spouštíš je ty ručně a potvrzuješ slovem `ANO`.

1. Otevři mobilní aplikaci **GitHub** (nebo github.com v prohlížeči telefonu) a přihlas se.
2. Otevři repozitář **LifePocket** → záložka **Actions**.
3. V seznamu workflow vyber **Deploy Firestore rules**.
4. Klepni na **Run workflow** (v aplikaci také tlačítko se třemi tečkami a „Run workflow").
5. Větev nech `main`. Do pole **confirm** napiš přesně `ANO` (velkými písmeny, bez mezer) a klepni **Run workflow**.
6. Za pár sekund se objeví nový běh. Zelená fajfka = pravidla jsou nasazená. Červený křížek = nic se nezměnilo nebo se nasazení nepovedlo, otevři log. Pokud jsi napsal něco jiného než `ANO`, běh hned skončí chybou a nic se nenasadí.

Pokud aplikace „Run workflow" nenabízí, otevři stejnou stránku v prohlížeči telefonu a zvol „Verze pro počítač" (Desktop site).
