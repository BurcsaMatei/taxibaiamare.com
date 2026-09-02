# CHANGELOG — taxibaiamare.com

Istoricul deciziilor și schimbărilor. Extras din `CLAUDE.md` și din istoricul git la 2026-09-02.

Ordine invers cronologică. Fiecare intrare păstrează **motivul**, nu doar ce s-a schimbat.

Stare curentă → [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`PRD.md`](./PRD.md)
Ce urmează → [`ROADMAP.md`](./ROADMAP.md)

Convenție de numerotare: `taxi-XXX` = issue intern. Pentru intervalul **#15–#59** există maparea
`#nr = taxi-XXX + 14`. Issue-urile de după primesc numărul curent GitHub (taxi-046 = #76, taxi-047 = #77).

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
