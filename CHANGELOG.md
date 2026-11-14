# CHANGELOG — taxibaiamare.com

Istoricul deciziilor și schimbărilor. Extras din `CLAUDE.md` și din istoricul git la 2026-09-02.

Ordine invers cronologică. Fiecare intrare păstrează **motivul**, nu doar ce s-a schimbat.

Stare curentă → [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`PRD.md`](./PRD.md)
Ce urmează → [`ROADMAP.md`](./ROADMAP.md)

Convenție de numerotare: `taxi-XXX` = issue intern. Pentru intervalul **#15–#59** există maparea
`#nr = taxi-XXX + 14`. Issue-urile de după primesc numărul curent GitHub (taxi-046 = #76, taxi-047 = #77).

---

## 2026-11-14 — PR B (#110): API-ul ține minte vehiculele ocupate

Modul nou `api/src/modules/dispatch/busyVehicles.ts` (listă în memorie orderId ↔ vehicul). Vehiculul devine
ocupat la atribuire, `chooseNearestVehicle` sare peste ocupate, iar `PATCH /orders/:id/status` îl eliberează la
COMPLETED/CANCELED. Fără mașini libere → `dispatch: FAILED` (`NO_AVAILABLE_VEHICLE`). Verificat cu `curl` și în
browser cu `sim:fleet --count 2` + `sim:orders --interval 1500` (FAILED + CALLED apar natural). Limite: stare
în memorie (se pierde la restart), fără expirare, PATCH nu validează tranzițiile. Motiv: markerii roșii din #31
ar fi fost false fără „ocupat” în API.

---

## 2026-11-14 — taxi-055 (#104): simulator de comenzi `sim:orders` (PR #109)

Script nou `scripts/dev-simulate-orders.ts`, pe modelul `sim:fleet`: creează comenzi de test (`POST /orders`),
le trece prin `ASSIGNED → IN_PROGRESS → COMPLETED` (15% `CANCELED`) și trimite `POST /orders/:id/call`
după `dispatch: FAILED` (singurul rol al telefonului), sau forțat cu `--force-calls`. Comanda rămasă `NEW`
după un dispatch eșuat nu e anulată: simulatorul nu inventează un flux de produs. Ctrl+C anulează comenzile
active. Verificat local, în browser: comenzile apar live, iar apelul apare în coloana CALL (`+40700000000`,
`USER_APP`). Rândurile cu coordonate 0 apar când pagina e deschisă după `order.created` (pagina se
construiește doar din evenimentele văzute cât e deschisă; se rezolvă cu snapshot, #32). **#104 închis** după rularea pe producție
(2026-11-14: comenzi live, FAILED + CALLED cu 2 mașini). Descoperit la analiză: API-ul nu ține minte vehiculele ocupate
(aceeași mașină poate lua mai multe comenzi) → PR B, separat, ca schimbare de comportament în API.

---

## 2026-11-14 — taxi-017 (#31) pas 1: pagina de comenzi montată + navigare (PR #108)

`/ops/[cityId]/orders` era o copie a hărții; acum montează `OpsOrdersPage` (747 linii, până atunci cod mort).
Componentă nouă `OpsPageNav` (buton Hartă / Comenzi) pe ambele pagini, vizibilă pentru orice utilizator logat
(selectorul de oraș rămâne doar pentru HQ). **#31 rămâne deschis:** markerii galben/roșu sunt pasul 3, iar
ordinea s-a schimbat în **pas 1 → simulator de comenzi (#104) → markeri**, fiindcă fără simulator nu pot fi
verificați. Procedura de lucru a fost fixată: PR → verificare în Preview → „merge” explicit → squash în `main`;
fără branch `dev`; doar docs-only direct în `main`. Lecții de Preview (variabile pe Preview + Redeploy, harta
goală din cauza restricțiilor tokenului Mapbox) → `ARCHITECTURE.md` §10. Railway trecut pe plan plătit.
CI-ul GitHub a rămas roșu (blocaj de facturare), neschimbat.

---

## 2026-11-13 — taxi-053 (#101): importă mapbox-gl.css

`mapbox-gl.css` nu era importat nicăieri; consola de producție avertiza că lipsesc declarațiile CSS ale
Mapbox GL. Importat în `pages/_app.tsx`, la secțiunea de vendor CSS. Harta goală de pe producție avea
o cauză separată: 403 de la `api.mapbox.com` (restricții de URL pe tokenul din Vercel), rezolvată în
contul Mapbox, nu în cod.

---

## 2026-11-13 — #28 (taxi-014) închis

Esențialul (autentificare pe rutele de scriere) e acoperit de taxi-051 (#97). Tenant check-ul pe oraș din
acest issue a devenit obsolet după taxi-048 (scope-ul `city` nu mai e emis); extensibilitatea pentru tokeni
user/driver rămâne în issue-urile parcate (taxi-020/027).

---

## 2026-11-13 — taxi-056 (#106): Node 24 peste tot

Decizia din Val 0.3 (2026-09-04) fusese Node 24 (`engines.node: "24.x"`, are prioritate față de dashboard-ul
Vercel), dar au rămas pe 22: `controlcenter/.nvmrc`, `node-version` din CI și documentația (CLAUDE, README,
ARCHITECTURE). Aliniate pe 24. Node local: 24.14.1. Railway citește tot `engines.node`.

---

## 2026-11-13 — taxi-054 (#103): scoate numărul de telefon din HUD-ul hărții

Rândul „Dispatch” (numărul orașului, link `tel:`) din panoul Status al hărții a fost scos, împreună cu
starea și helperul `toTelHref` rămase nefolosite. Câmpul `dispatchPhone` rămâne în `CityPublic`/API
(aplicația de client va avea nevoie de el), iar pagina de comenzi afișează în continuare
`order.userCalledDispatch`.

---

## 2026-11-13 — Clarificare: controlcenter-ul doar observă; telefonul nu e parte din produs

Corecție de plan, la cererea proprietarului: am presupus greșit (fără confirmare) că dispeceratul introduce
comenzi primite la telefon. **Controlcenter-ul doar observă** în timp real ce fac clientul și șoferul; comenzile
vin din aplicațiile user/driver. Singurul rol al telefonului: din aplicația de client se poate suna
dispeceratul când nu sunt mașini libere, iar controlcenter-ul vede evenimentul `order.userCalledDispatch`
(deja afișat în pagina de comenzi). Consecințe: taxi-050 (#96, comandă manuală) **parcat**; taxi-054 (#103)
scoate numărul de telefon din HUD-ul hărții; taxi-055 (#104) adaugă un simulator de comenzi pentru date de
test în M2. Aplicația driver: nativă sau PWA (Serwist), nedecis. Principiul „nimic din `[PARCAT]` și
nicio infrastructură nouă până la finalul M2” e scris în `CLAUDE.md` și `ROADMAP.md`.

---

## 2026-11-13 — taxi-049 (#95): API LIVE pe Railway, api.taxibaiamare.com

Prima dată când tot fluxul merge pe producție: parolă → hartă Baia Mare → WS conectat. API-ul rulează pe
**Railway** (nu pe VPS Hetzner, cum era planificat): Hetzner cerea verificare de identitate la crearea
contului, iar un serviciu gestionat înseamnă mai puțini pași și zero administrare de server. Detalii de
configurare, DNS (Hostico) și restricțiile Mapbox → `ARCHITECTURE.md` §10.

Lecții din deploy: (1) CSP-ul de producție bloca WS-ul (taxi-052); (2) tokenul Mapbox avea restricții de URL
doar pentru localhost → 403 la tile-uri; (3) Vercel sare peste deploy când în commit nu s-a schimbat nimic în
`controlcenter/` (un commit gol nu ajută); (4) `mapbox-gl.css` lipsea (taxi-053). Railway e pe trial
(30 de zile / 5 $) — de trecut pe plan plătit. Nu există încă vehicule reale: flota din Baia Mare e offline
până rulează simulatorul.

---

## 2026-11-13 — taxi-052 (#99): CSP de producție permite WebSocket-ul către API

După deploy-ul API-ului pe Railway (`api.taxibaiamare.com`), login-ul și flota mergeau, dar HUD-ul arăta
„WS: DISCONNECTED / ws error”. Cauza: `connect-src` din CSP-ul de producție (`controlcenter/middleware.ts`)
permitea doar `'self'` și Mapbox; în dev permite `ws:`, de aceea local mergea. Acum origin-ul din
`NEXT_PUBLIC_TAXI_WS_URL` se adaugă automat în `connect-src`.

---

## 2026-11-13 — taxi-051 (#97): token obligatoriu pe toate rutele API

Pregătire pentru deploy-ul public (#95): `requireAuth` pe tot ce e după login; `/health` și login
rămân publice. Înainte, `POST /orders`, `PATCH /orders/:id/status` și `/dev/*` erau deschise oricui.
Proxy-ul Next `/api/fleet/[cityId]` și clientul de hartă trimit acum tokenul; simulatorul de flotă
se autentifică (`PASSWORD='…' npm run sim:fleet`, sau `TAXI_API_TOKEN`). Acoperă esențialul din
taxi-014 (#28); tenant check-ul pe oraș din #28 devine obsolet (scope-ul `city` nu mai e emis).

---

## 2026-11-13 — Reorientare: scop redus la controlcenter + API + persistență + deploy

Decizie luată împreună cu proprietarul proiectului: planul inițial (user React Native, driver, admin,
landing, pricing, payments) depășea mult ce există în cod și nu producea valoare utilizabilă. **21 de
issue-uri parcate** (titlu `[PARCAT]`, rămân deschise, nimic șters); `ROADMAP.md` are acum §2
„Reorientare” cu scopul activ. Issue-uri noi: taxi-049 (#95) deploy API pe VPS, taxi-050 (#96) comandă
manuală din controlcenter. Furnizorul de persistență (Supabase vs. Neon + Blob) e în discuție.
taxi-048 (#93) a fost integrat în `main` prin PR #94 (squash). Brand: **Taxi Galant**, administrat de
KonceptID. Local: `npm run dev:all` pornește API + controlcenter. CI-ul GitHub încă nu pornește
(blocaj de facturare); verificarea reală rămâne Vercel Preview.

---

## 2026-11-13 — taxi-048 (#93): autentificare simplificată, parolă unică

Login-ul cu City ID + PIN (scope `hq`/`city`) înlocuit cu **o singură parolă**, verificată cu hash
`scrypt` (`node:crypto`, fără dependențe noi) și rate limit în memorie (5 eșecuri/min per IP).
După login (sau cu token valid), controlcenter-ul intră **direct pe `/ops/baia-mare/map`**; pagina de
start nu mai are city picker. Motivul: accesează doar proprietarul și KonceptID, iar PIN-ul de 4 cifre
fără rate limiting era și complicat, și slab.

Tokenul HMAC și verificările WS rămân (calea `hq` exista deja); scope-ul `city` nu mai e emis.
Env: dispar `HQ_PIN` și `CITY_PINS_JSON`, apare `TAXI_CONTROL_CENTER_PASSWORD_HASH`
(`PASSWORD='…' npm run hash:password`). Branding UI: „Taxi Galant”, administrat de KonceptID.
`OpsPinGate` → `OpsLoginGate`.

---

## 2026-11-13 — Sincronizare documentație cu codul

Audit documentație ↔ cod, fără modificări de cod. Corectat: starea reală în `CLAUDE.md`/`PRD.md`
(ultimul commit de produs 2026-07-03, de atunci doar mentenanță de dependențe), `OpsOrdersPage.tsx` are
747 linii (nu „400+"), `docs/konceptid-taxi.md` pe Next 16 / React 19, contradicția dintre `ROADMAP.md`
și `ARCHITECTURE.md` despre locul build config-ului Vercel (corect: `controlcenter/vercel.json`).
Adăugate în `ARCHITECTURE.md` §11 riscurile verificate în cod și absente până acum: rute de scriere
fără auth, tranziții de status nevalidate, login PIN fără rate limiting, `npm audit` (11 vulnerabilități),
plus lipsa issue-urilor pentru deploy API și comandă manuală din controlcenter.
Alegerea furnizorului de persistență (inițial Supabase) e în discuție — documentele nu au fost modificate
pe acest punct.

---

## 2026-09-05 — Val 3.9: ESLint 8 → 9, flat config

Task de portofoliu (`konceptid-ops`, Val 3.9). **`eslint` 8.57.1 → 9.x**, `.eslintrc.cjs` +
`.eslintignore` → **`eslint.config.mjs`**, `eslint-config-next` 15.5 → **16.3.4** (aliniat cu
framework-ul, pe 16 din Val 2), `@typescript-eslint` 7.18 → **8.69**, `unused-imports` 3 → 4,
`eslint-config-prettier` 9 → 10.

ESLint 8.57.1 e **EOL**, și era exact ce bloca `eslint-config-next@16`: la Val 2 l-am ținut deliberat
pe 15, ca să nu amestecăm variabile.

**Regulile proiectului au fost preluate verbatim** din `.eslintrc.cjs`, nu rescrise. Patternurile din
`.eslintignore` au trecut în `globalIgnores` — ESLint 9 nu mai citește acel fișier.

**Val 3.9** din `konceptid-ops` — ultimul din val, și singurul monorepo. ESLint e declarat doar în workspace-ul `controlcenter`, deci acolo s-a făcut migrarea; instalarea s-a făcut din rădăcină, cu `-w controlcenter`.

`eslint` **8.57.1 → 9.39.5** · `.eslintrc.cjs` + `.eslintignore` → **`eslint.config.mjs`** · `eslint-config-next` **15.5 → 16.3.4** · `@typescript-eslint` **7.18 → 8.69**.

ESLint 8.57.1 e **EOL**, și era exact ce bloca `eslint-config-next@16`: la Val 2 l-am ținut deliberat pe 15, ca să nu amestecăm variabile.

**Regulile proiectului au fost preluate verbatim** din `.eslintrc.cjs`. Patternurile din `.eslintignore` au trecut în `globalIgnores` — ESLint 9 nu mai citește acel fișier.

**Migrarea nu adaugă reguli noi.** Directivele `eslint-disable` care indicau reguli neactivate au devenit comentarii simple: justificarea autorului rămâne, directiva moartă dispare.

## Echivalență, dovedită

Un **fișier-sondă** care încalcă deliberat câte o regulă din fiecare familie, trecut prin ambele configurații: **același număr de mesaje, aceleași reguli**, înainte și după. Baseline-ul era 0 probleme, deci „build verde" n-ar fi dovedit nimic.

## Descoperirea care contează: `eslint-config-next@16` activează React Compiler

Nu e o simplă versiune nouă de lint. v16 aduce **13 reguli `react-hooks` ca erori**, față de v15 care avea doar `rules-of-hooks` (error) și `exhaustive-deps` (warn). Adică **12 reguli noi**, toate erori, sosite ca efect secundar al alinierii cu framework-ul.

Ele lovesc tipare **preexistente**, scrise deliberat și cu justificare în cod: „citește din `localStorage` la montare" (imposibil altfel în Pages Router, nu există `localStorage` la SSR), `ref.current` citit în logica de drag, componente construite condiționat în render.

**Toate 12 sunt coborâte la avertisment, deliberat.** O migrare de lint nu are voie să devină tăcut o refactorizare React pe site-uri live. `rules-of-hooks` **rămâne eroare** — era eroare și în v15, și e corectitudine reală.

Poarta rămâne astfel utilă pentru **regresii**, iar datoria existentă e catalogată ca task separat în `konceptid-ops` → Val 3.

## Mecanica de monorepo

`eslint.config.mjs` a fost **formatat cu `prettier`** imediat după generare: build-ul lui `controlcenter` are `format:check` în poartă (`npm run format:check && npm run check && next build --webpack`), deci un fișier nou neformatat ar fi picat build-ul. Aceeași capcană ca la migrarea pe Next 16.

## Verificat

`eslint .` → **0 erori**, 9 avertismente: `react-hooks/set-state-in-effect`, `react-hooks/refs` și `react-hooks/purity`.

Acoperire identică: **53 de fișiere `.ts`/`.tsx`**.

`check:all` verde pe toate workspace-urile, `npm run build` verde — cu ordinea corectă, `packages/shared` primul.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01VqYdnje8b4nGFpUe79R6QR

Runbook: [`runbooks/eslint-9-flat-config.md`](../konceptid-ops/runbooks/eslint-9-flat-config.md).

---

## 2026-09-05 — Val 2.9: Next 15 → 16

Task de portofoliu (`konceptid-ops`, Val 2.9). **`next` 15.5.25 → 16.3.4.** React 18 și ESLint 8
rămân neatinse — un PR, o singură variabilă.

### Ce a cerut intervenție

- **`build` → `next build --webpack`.** Next 16 folosește Turbopack implicit, iar
  `@vanilla-extract/next-plugin` injectează configurație `webpack`.
- **Cheia `eslint` scoasă din `next.config.mjs`** — Next 16 nu o mai acceptă. Era config mort:
  `lint` cheamă `eslint .` direct, nu `next lint` (eliminat în 16).
- **`tsconfig.json` rescris de Next 16** (`jsx` → `react-jsx`). Commitat, altfel reapare la fiecare build.
- **`AGENTS.md`**: blocul `nextjs-agent-rules`, generat cu codemod-ul `agents-md`.

`eslint-config-next` **rămâne pe 15** — cel de 16 cere `eslint >=9`, iar portofoliul e pe 8.57.1.

### Mecanica de monorepo

`next` s-a instalat **în workspace-ul `controlcenter`** (`npm i -w controlcenter next@16.3.4`), nu la
rădăcină. Ordinea de build a rămas cea din script: `packages/shared` primul, apoi restul cu
`npm -ws run build --if-present`.

Scriptul de build al lui `controlcenter` e compus și mai strict decât în restul portofoliului —
`npm run format:check && npm run check && next build` — deci flag-ul a devenit
`... && next build --webpack`. **Poarta de `prettier` a prins imediat** că fișierul editat de mine
(`next.config.mjs`) nu mai era formatat; rulat `prettier --write` și build-ul a trecut. E un mecanism
util: aici formatarea e parte din build, nu doar din lint.

### Verificat pe build de producție real

`check:all` verde pe toate workspace-urile. Server cu `NODE_ENV=production`: `/` 200, `/ops/map` 200,
`/ops/orders` 200; headerele din `controlcenter/middleware.ts` prezente.

`/robots.txt` dă 404 — **neschimbat**, verificat și pe producția de pe Next 15; ruta nu există.

**`npm audit`: 3 → 1** (un singur `low` rămas).

---

## 2026-09-04 — Val 0.3 + 0.6: aliniere Node + scripturi standard (#84)

Task de portofoliu (`konceptid-ops`). **Zero modificări de cod.**

- `engines.node` → **`"24.x"`** la root (lipsea) **și în `controlcenter`** (era `22.x`)
- `.nvmrc` creat, valoarea `24`
- root: `dev`, `start`, `check:all`, `verify:prod` — delegări către workspaces
- root `build` respectă explicit ordinea: `packages/shared` întâi, apoi restul

**Cel mai important lucru din acest PR:** setarea de Node din dashboard-ul Vercel fusese trecută pe
`24.x`, dar build-ul ar fi rămas pe **Node 22**. `engines.node` din `package.json` are prioritate
față de dashboard, iar `controlcenter` — directorul pe care îl construiește Vercel — declara `22.x`.
Task-ul 0.6 din portofoliu **nu se putea rezolva din interfață**; era în cod.

**Defect preexistent reparat pe drum:** root-ul avea `lint` = `npm -ws run lint` și `typecheck`
analog, iar ambele **eșuau** — `packages/tokens` nu are aceste scripturi. Verificat pe `main` înainte
de orice modificare: erau roșii și acolo. Adăugat `--if-present`, deci acum trec și acoperă
workspace-urile care chiar au scripturile.

**Verificat:** `check:all` verde, `npm run build` verde pe toate workspace-urile în ordinea corectă
(`@taxi/shared` → `controlcenter` → `@taxi/api`), și `verify:prod` executat efectiv — server pornit
în regim producție, HTTP 200.

**Observat, nereparat aici:** `package.json` declară workspace-urile `user` și `driver`, care nu
există pe disc. Nu blochează nimic (`--if-present`), dar e o intrare moartă. Alt PR, altă variabilă.

Closes #84

---

## 2026-09-02 — Redenumire proiect + restructurare documentație

**Redenumire** (PR #80): repo GitHub `taxi-platform` → `taxibaiamare.com`, folder local, `package.json`.
Proiect Vercel `taxi-platform-controlcenter` → **`taxibaiamare-com`** (numele de pe Vercel diferea deja
de cel al repo-ului). Convenția KonceptID: domeniul exact, cu punctul înlocuit de cratimă doar unde
platforma obligă. Domeniile de producție, neafectate.

**Restructurare documentație:** `CLAUDE.md` împărțit în 5 fișiere — `CLAUDE.md` (reguli de lucru),
`PRD.md` (nou — stratul de produs lipsea complet), `ARCHITECTURE.md`, `CHANGELOG.md` (acest fișier),
`AGENTS.md` (pointer).

Verificări făcute față de cod, nu preluate din documentația veche — toate afirmațiile din vechiul
`CLAUDE.md` s-au confirmat: `user/`+`driver/` inexistente, `drivers`+`payments` stub-uri goale,
flotă doar în `baia-mare` (250 sintetice), zero teste, `OpsOrdersPage` nemontat.
Confirmat suplimentar: **`api.taxibaiamare.com` nu răspunde** — API-ul nu e deployat.

---

## 2026-07-03 — M1 atins; Faza 0 închisă

**Milestone M1.** Faza 0 (igienă & securitate) complet închisă. Din Faza 1 rămâne doar taxi-011.
Milestone curent: **M2** — API persistent + controlcenter funcțional complet.
Punct de intrare: **taxi-011 (#25), setup Supabase**.

- **taxi-047 (#77)** — CI pe **Node 22**, aliniat cu producția.
- **taxi-046 (#76)** — `Order.serviceType` redenumit în `Order.service`.
- **taxi-010 (#24)** — driver lifecycle events + topic registry: topicul `driver:` devine nevid
  (`order.offered` / `accepted` / `rejected`). **Emiterea efectivă vine cu taxi-028**; subscribe pe
  `driver:*` rămâne imposibil până la WS multi-subiect (taxi-021).
- **taxi-007 (#21)** — `next-pwa` eliminat complet ca dependință moartă; `NEXT_PUBLIC_ENABLE_PWA` dispare.
  PWA se reintroduce doar dacă devine cerință (probabil pentru driver).
- **taxi-006 (#20)** — README la rădăcină.
- **taxi-009 (#23)** — `ControlcenterTokenPayload` / `ControlcenterScope` mutate în
  `@taxi/shared/domain/auth.ts`; `CityPublic` (cu `mapCenter`/`mapZoom`) în `domain/city.ts`. Importate
  de api **și** controlcenter → **zero duplicate**.
- **taxi-008 (#22)** — contractele `orders` rescrise după API-ul real (`CreateOrder*`,
  `PatchOrderStatus*`, `CallOrder*`), înlocuind contracte fictive; importate de `api/src/modules/orders`.
- **taxi-005 (#19)** — proxy-ul fleet citea `API_BASE_URL` în timp ce restul citeau `TAXI_API_BASE_URL`.
  Aliniat la același pattern `readEnv` / `apiBaseUrl()`.

**Decizie de produs consemnată:** aplicația **user = React Native nativ (iOS + Android)**, nu PWA, nu web.
Se elimină din plan subdomeniul `app.taxibaiamare.com` — distribuția e prin store-uri.

**Duplicate rămase netracked** (audit): `FleetVehicle` ×3 (api `fleetDirectory`, controlcenter
`opsMap.types`, proxy fleet) → taxi-016/017; contractul de login (`LoginOk` vs `ControlcenterLoginOk`)
→ taxi-014. De deschis issue la prima atingere.

---

## 2026-07-02 — Controlcenter LIVE + Faza 0 de securitate

**Controlcenter live pe `ops.taxibaiamare.com`** (+ apex). „Varianta A": un proiect Vercel, două pagini
interne `/ops/[cityId]/{map,orders}`.

**Saga configului de build pe Vercel** (7 commit-uri succesive, #63–#69) — merită reținută:
Vercel rulează `buildCommand` cu working directory = **Root Directory** (`controlcenter/`), deci
comenzile `npm -w` nu găsesc workspace-urile. Soluția finală: **path absolut** în
`controlcenter/vercel.json` — `cd /vercel/path0 && npm -w packages/shared run build && npm -w controlcenter run build`
(shared înaintea controlcenter, pentru că `dist`-ul lui e consumat la typecheck).
Dashboard: **Build Command Override OFF** — comanda trăiește exclusiv în `vercel.json`.
Pe drum: `engines` bumped 20.x → 22.x, `.nvmrc` aliniat.

- **taxi-001 (#15) — secrete compromise.** `api/.env.local` era comis în git: secretul HMAC și toate
  PIN-urile erau expuse. Fișierul scos din tracking (`**/.env.local` în `.gitignore` root),
  **secretele rotite** — valorile din istoric sunt moarte. **Istoricul NU a fost rescris** (repo privat,
  decizie conștientă, out of scope).
- **taxi-002 (#16) — CI care nu rula niciodată.** Workflow-ul din `controlcenter/.github/workflows/`
  nu se declanșa (locație greșită). Înlocuit cu unul real la rădăcină: shared build → typecheck → lint →
  api build → controlcenter build, pe push `main` + toate PR-urile.
- **taxi-003 (#17)** — `.env.example` reale pentru api și controlcenter; fiecare cheie documentată e
  citită efectiv de cod.
- **taxi-004 (#18)** — simulatoarele de flotă trec din PowerShell în Node/tsx (`npm run sim:fleet`),
  ca să ruleze pe WSL. Rămâne un singur `.ps1`: `scripts/project-tree.ps1`.

**Sesiune de setup (2026-07-02):** zero cod modificat — doar documentație (`CLAUDE.md`,
`docs/konceptid-taxi.md`, `ROADMAP.md`) și deschiderea a **45 de issues (#15–#59)**.

---

## 2026-02 — Construcția controlcenter-ului

- **#14** — multicity ops + autentificare PIN + module de hartă.
- **#13** — styling index/map/orders, HUD + panels.
- **#12** — curățare routing; eliminat UI/SEO/cookies/blueprint legacy; aliniere tokens + tooling.
- **#11** — eliminat shim-ul de temă; consumă direct `@taxi/tokens`.
- **#10** — tokens partajate, **zero inline styles**, eliminat blueprint.
- **#9** — dispatch failed, `dispatchPhone` per oraș, căutare + reset pe hartă, semantică „busy".
- **#8** — markere de flotă în timp real + simulator dev.
- **#7** — hartă ops Mapbox + stream dev de vehicule.
- **#6** — shell ops dual-monitor (hook WS + tabel de comenzi).
- **#5** — curățare fundație (eliminat blog/pwa/panels; păstrat HUD + hartă).
- **#4** — registry realtime + `order.statusChanged`.
- **#3** — envelope realtime + publicare `order.created` + listener dev în controlcenter.
- **#2** — schelet WS realtime + `dist` ESM-safe pentru shared.
- **#1** — scripturi de workflow la rădăcină.

## 2026-02-08 — Bootstrap

Fundația monorepo-ului `taxi-platform`: npm workspaces, TypeScript strict, `@taxi/shared`, `@taxi/tokens`.
