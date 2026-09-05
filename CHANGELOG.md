# CHANGELOG — taxibaiamare.com

Istoricul deciziilor și schimbărilor. Extras din `CLAUDE.md` și din istoricul git la 2026-09-02.

Ordine invers cronologică. Fiecare intrare păstrează **motivul**, nu doar ce s-a schimbat.

Stare curentă → [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`PRD.md`](./PRD.md)
Ce urmează → [`ROADMAP.md`](./ROADMAP.md)

Convenție de numerotare: `taxi-XXX` = issue intern. Pentru intervalul **#15–#59** există maparea
`#nr = taxi-XXX + 14`. Issue-urile de după primesc numărul curent GitHub (taxi-046 = #76, taxi-047 = #77).

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
