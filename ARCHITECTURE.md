# ARCHITECTURE — taxibaiamare.com

**Documentul tehnic complet.** Stack, structură, flux de date, contracte, decizii **cu motivația lor**.
Pentru produs → [`PRD.md`](./PRD.md). Pentru esențialul de sesiune → [`CLAUDE.md`](./CLAUDE.md).
Pentru ordinea de execuție → [`ROADMAP.md`](./ROADMAP.md).

**Ultima actualizare:** 2026-09-02

---

## 1. Stack

| Strat | Tehnologie |
| --- | --- |
| Monorepo | **npm workspaces** — fără pnpm, fără Turborepo |
| Backend | **Express 5 + WebSocket** (`ws`), port 3001 |
| Frontend dispecerat | **Next.js 16 — Pages Router**, port 3000 |
| Hartă | Mapbox GL |
| Stiluri | **Vanilla Extract** (`styles/*.css.ts`), tokens din `@taxi/tokens` |
| Limbaj | TypeScript strict, **fără `any`** |
| Runtime | **Node 22.x** (`controlcenter/.nvmrc`, `engines`, CI, Vercel — aliniate) |
| Persistență | **niciuna încă** — decisă Supabase, neimplementată |
| Aplicație user (viitor) | React Native — nativ iOS + Android |

---

## 2. Workspaces

```
api/               backend central — Express 5 + WS (:3001)
controlcenter/     dispecerat — Next.js 16 (:3000)          ← singura suprafață live
packages/shared/   @taxi/shared  — SURSĂ UNICĂ DE ADEVĂR pentru domeniu
packages/tokens/   @taxi/tokens  — design tokens (light/dark)
user/              REZERVAT — nu există pe disc. React Native, nativ.
driver/            REZERVAT — nu există pe disc.
scripts/           utilitare dev (simulator flotă, tree)
docs/              konceptid-taxi.md — workflow de colaborare
```

> `user/` și `driver/` sunt declarate în `workspaces` din `package.json` dar **nu există pe disc**.
> Numele sunt **rezervate intenționat** — nu le șterge din `workspaces`.
> `landing` va fi un workspace separat, viitor.

**Ordine obligatorie de build:** `packages/shared` **înaintea** `api` și `controlcenter` — ambele
consumă `dist`-ul lui la typecheck. Nerespectarea ei e cea mai frecventă cauză de build eșuat.

---

## 3. Fluxul de date

```
browser
   │
   ├─ HTTP ─→ Next API proxies (controlcenter/pages/api/*) ─→ Express :3001
   │
   └─ WS ───────────────────────────────────────────────────→ /ws?token=… → topic hub
```

Browserul **nu vorbește direct** cu Express pe HTTP — trece prin proxy-urile Next, ca tokenul de API
și adresa backendului să nu ajungă în client. WebSocket-ul, în schimb, se conectează direct.

### 3.1 Endpoints API (Express)

| Metodă | Rută | Note |
| --- | --- | --- |
| POST | `/auth/controlcenter/login` | PIN → token HMAC |
| GET | `/cities` · `/cities/:cityId` | necesită Bearer token |
| GET | `/health` | — |
| POST | `/orders` | creează + dispecerizează sincron |
| PATCH | `/orders/:id/status` | tranziție de status |
| POST | `/orders/:id/call` | — |
| GET | `/dev/fleet/:cityId` · `/dev/fleet/:cityId/summary` | dev |
| PATCH | `/dev/vehicles/:vehicleId/location` · `/offline` | alimentează prezența |
| GET | `/dev/cities/:cityId` | **deprecated** — fără auth; folosește `/cities/:cityId` |

Endpoint-urile `/dev/vehicles/*` se retrag după implementarea driver-ului (taxi-033 / #47).

### 3.2 Proxy-uri Next (`controlcenter/pages/api/`)

`auth/controlcenter/login` · `cities/index` · `cities/[cityId]` · `fleet/[cityId]` · `csp-report`

Toate citesc `TAXI_API_BASE_URL` prin același pattern `readEnv` / `apiBaseUrl()`.

### 3.3 Pagini controlcenter

| Rută | Stare |
| --- | --- |
| `/ops/[cityId]/map` | ✅ canonică, funcțională |
| `/ops/[cityId]/orders` | ⚠️ randează **harta**, nu comenzile (§7) |
| `/ops/map`, `/ops/orders` | **deprecated** — city-pickers legacy, nu construi peste ele |

---

## 4. Autentificare și autorizare

- **PIN** (per oraș sau HQ) → `POST /auth/controlcenter/login` → **token HMAC custom, nu JWT**,
  purtând un scope: `hq` | `city`.
- Scope-ul guvernează și **abonarea pe topicuri WS**, nu doar accesul HTTP. Un operator `city` nu se
  poate abona la datele altui oraș.
- Tipurile `ControlcenterTokenPayload` / `ControlcenterScope` trăiesc în `@taxi/shared/domain/auth.ts` —
  importate atât de api cât și de controlcenter, **zero duplicate** (taxi-009).

---

## 5. Realtime — topicuri și evenimente

Registry-ul evenimentelor permise per topic: **`api/src/modules/realtime/index.ts`**.
Orice eveniment nou se înregistrează acolo — altfel e respins.

| Topic | Conținut |
| --- | --- |
| `city:` | evenimente la nivel de oraș |
| `order:` | ciclul de viață al comenzii |
| `driver:` | `order.offered` · `order.accepted` · `order.rejected` — **definite, dar încă neemise** (emiterea vine cu taxi-028) |
| `vehicle:` | poziție, prezență |
| `controlcenter:` | evenimente de dispecerat |

**Abonarea pe `driver:*` (wildcard) e imposibilă** până la WS multi-subiect (taxi-021).

**Prezența vehiculelor:** in-memory, **TTL 60s**, alimentată prin `PATCH /dev/vehicles/*`.
Se pierde la restart — ca tot restul stării.

---

## 6. Dispecerizare

- Algoritm: **cel mai apropiat vehicul** (distanță Haversine).
- Executat **sincron**, în timpul `POST /orders`.
- **Fără acceptare din partea șoferului** — atribuirea e finală.
- Flotă: `api/src/modules/vehicles/fleetDirectory.ts`, `FLEET_SIZE = 250`, **doar `baia-mare`**,
  vehicule sintetice. Cele 5 orașe definite: `baia-mare`, `cluj-napoca`, `iasi`, `satu-mare`,
  `timisoara` — ultimele patru au **flotă zero**, deci dispecerizarea acolo eșuează.

---

## 7. `@taxi/shared` — sursa unică de adevăr

**Regula centrală a proiectului:** orice tip de domeniu, status, eveniment sau contract nou se adaugă în
`packages/shared` — **niciodată local** în `api/` sau `controlcenter/`.

```
contracts/orders.ts       CreateOrder* · PatchOrderStatus* · CallOrder*
domain/auth.ts            ControlcenterTokenPayload · ControlcenterScope
domain/city.ts            CityPublic (cu mapCenter / mapZoom)
domain/driver.ts · geo.ts · order.ts · service.ts · status.ts · user.ts · vehicle.ts
events/realtime.ts        evenimente
events/topics.ts          topicuri
```

Motivul e istoric și concret: au existat duplicate reale (`CityPublic`, `ControlcenterTokenPayload`,
contracte fictive de orders) care s-au desincronizat între api și controlcenter. Rezolvate în
taxi-008/009; regula previne recidiva.

**Duplicate încă netracked** (audit 2026-07-03 — de deschis issue la prima atingere):

- `FleetVehicle` ×3 — `api/fleetDirectory`, `controlcenter/opsMap.types`, proxy-ul fleet
  → de unificat la taxi-016/017
- Contractul de login — `LoginOk` (api) vs. `ControlcenterLoginOk` (controlcenter)
  → de unificat la taxi-014

---

## 8. Convenții de cod

- TypeScript strict, **fără `any`**. Controlcenter adaugă: `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- **Vanilla Extract only** — `styles/*.css.ts`. **Fără inline styles**, fără CSS global nou peste
  `globals.css` / `theme.global.css`. Tokens din `@taxi/tokens`.
- **Importuri relative** — fără alias-uri. Type imports inline (`import { type Foo }`), impus de ESLint
  `consistent-type-imports`.
- Comentarii de secțiune, folosite peste tot în codebase:
  ```ts
  // ==============================
  // Section name
  // ==============================
  ```
- Prettier: 100 coloane, ghilimele duble, punct-și-virgulă, trailing commas.
- Pachete: `@taxi/*`.
- **Validare:** guard-uri înguste scrise de mână (`isObject`, `normalize*`) care întorc `null` la invalid.
  Nu se introduce o bibliotecă de validare fără discuție.
- **Forma răspunsurilor API:** `{ ok: true, ... } | { ok: false, error: string }` — se păstrează.

---

## 9. Comenzi

```bash
# shared — OBLIGATORIU înaintea api (dist-ul e consumat)
npm -w packages/shared run build

# API: build first — dev rulează dist/
npm -w api run build
node --env-file=api/.env.local api/dist/index.js      # :3001

npm run dev:controlcenter                              # next dev :3000

npm run sim:fleet -- --city baia-mare --count 20       # simulator flotă (tsx); Ctrl+C = offline
npm run typecheck                                      # toate workspace-urile
npm -w controlcenter run lint
npm -w controlcenter run check:all                     # format:check + typecheck + lint
```

- **API-ul nu încarcă singur `.env.local`** — pornește-l cu `node --env-file=…`.
- `scripts/project-tree.ps1` e **PowerShell-only** — nu rulează pe WSL fără `pwsh`.
  Simulatoarele de flotă sunt Node/tsx (taxi-004).
- Env documentate real în `api/.env.example` și `controlcenter/.env.example` — fiecare cheie e citită
  efectiv de cod (taxi-003).

---

## 10. Deployment

### Controlcenter → Vercel (LIVE din 2026-07-02)

- Proiect Vercel: **`taxibaiamare-com`** (redenumit din `taxi-platform-controlcenter` la 2026-09-02).
- Domenii: `ops.taxibaiamare.com` + apex `taxibaiamare.com` + `www`.
- „Varianta A": un singur proiect, două pagini interne `/ops/[cityId]/{map,orders}`.
  Proiecte separate pentru driver/admin se creează când suprafețele vor exista.
- Production doar din `main`; preview pe orice branch/PR.

**Config-ul de build trăiește în `controlcenter/vercel.json`**, nu în dashboard:

```
cd /vercel/path0 && npm -w packages/shared run build && npm -w controlcenter run build
```

> **Lecție costisitoare:** Vercel rulează `buildCommand` cu working directory = Root Directory
> (`controlcenter/`), deci comenzile `npm -w` **nu găsesc workspace-urile** fără `cd /vercel/path0`
> (rădăcina repo-ului în containerul de build). Dashboard: Root Directory `controlcenter`, Node 22,
> **Build Command Override OFF** — comanda trăiește doar în `vercel.json`.

Env pe Vercel (dashboard): `NEXT_PUBLIC_MAPBOX_TOKEN`, `TAXI_API_BASE_URL=https://api.taxibaiamare.com`,
`NEXT_PUBLIC_TAXI_WS_URL=wss://api.taxibaiamare.com/ws`.

`next-pwa` a fost **eliminat complet** (taxi-007) — `NEXT_PUBLIC_ENABLE_PWA` nu mai există. PWA se
reintroduce doar dacă devine cerință (probabil pentru driver).

### API → VPS Hetzner (NEDEPLOYAT)

**Express + WebSocket nu merg pe Vercel** — conexiuni persistente, nu serverless. Destinația e un VPS
Hetzner pe `api.taxibaiamare.com`.

**Verificat 2026-09-02: domeniul nu răspunde.** Consecință directă: **pe producție, login-ul eșuează
controlat.** Interfața e live, dar fără backend. Comportament așteptat, nu defect.

### DNS

Hostico: CNAME `ops` → `cname.vercel-dns.com.`

---

## 11. Riscuri cunoscute și puncte fragile

Răspunsul la „ce se va strica, ce lipsește, ce e over-engineered".

### 11.1 Ce se va strica

| Risc | Impact |
| --- | --- |
| **Zero persistență** | Orice restart de API = pierderea tuturor comenzilor și a prezenței vehiculelor. Nu e un edge case, e comportamentul normal actual. Blocantul #1 al produsului. |
| **API nedeployat** | Producția arată funcțională, dar nu poate autentifica pe nimeni. Un observator extern vede un produs live care „nu merge". |
| **Ordinea de build shared → api/controlcenter** | Dacă cineva rulează build-urile în altă ordine (sau CI-ul se rescrie neglijent), typecheck-ul cade pe `dist` lipsă. |
| **Token HMAC custom, nu JWT** | Funcționează, dar e cod propriu de securitate. Fără rotație automată, fără expirare standardizată, fără bibliotecă auditată în spate. |
| **Prezență in-memory cu TTL 60s** | Nu scalează peste o singură instanță de API. Două instanțe = două realități despre unde sunt vehiculele. |
| **`FleetVehicle` duplicat în 3 locuri** | Se vor desincroniza. E deja cunoscut, netracked. |

### 11.2 Ce lipsește

- **Zero teste** în tot repo-ul. Nici unit, nici E2E. Există issues pentru asta (taxi-035 #49,
  taxi-034 #48), nerezolvate.
- **Fără rate limiting, fără CORS explicit, fără logging structurat** pe API (taxi-042 / #56).
- **Fără acceptare de cursă de către șofer** — dispecerizarea e finală. Tipurile există; emiterea nu.
- **Fără pricing, fără plăți** — module stub goale.
- **Patru din cinci orașe au flotă zero** — comenzile acolo eșuează.

### 11.3 Cod mort / nemontat

| Element | Verdict |
| --- | --- |
| **`controlcenter/components/ops/orders/OpsOrdersPage.tsx`** | 400+ linii funcționale, **importate de nicăieri** (verificat 2026-09-02). Ruta `/ops/[cityId]/orders` afișează harta în loc. → taxi-017 (#31) |
| `api/src/modules/drivers/` · `payments/` | Stub-uri goale (`export {}`) |
| `/ops/map`, `/ops/orders` (fără `[cityId]`) | Rute deprecated → ștergere la taxi-040 (#54) |
| `GET /dev/cities/:cityId` | Deprecated, fără auth |

### 11.4 Datorie de securitate

`api/.env.local` **a fost comis în git** în trecut (taxi-001, rezolvat 2026-07-02): fișierul e scos din
tracking, secretele au fost **rotite**, deci valorile din istoric sunt moarte.
**Istoricul git nu a fost rescris** — decizie conștientă (repo privat). Dacă repo-ul devine vreodată
public, asta trebuie reevaluat înainte.

### 11.5 Nu e over-engineered

Verificat deliberat: monorepo-ul cu 4 workspace-uri pentru un produs cu o singură suprafață live pare
excesiv, **dar nu este** — cele patru suprafețe sunt decise, iar `@taxi/shared` există tocmai pentru că
duplicarea de tipuri a produs deja bug-uri reale. Regula „totul în shared" e cea care ține produsul
coerent înainte să existe.

---

## 12. Stare CI

`.github/workflows/ci.yml` la root: shared build → typecheck → lint → api build → controlcenter build.
Rulează pe push în `main` și pe toate PR-urile, **pe Node 22** (taxi-047).

> ⚠️ La 2026-09-02, CI-ul **nu pornește**: GitHub raportează
> *„the job was not started because your account is locked due to a billing issue"* — blocaj la nivel de
> cont GitHub, nu al proiectului. Verificarea reală de build rămâne Vercel Preview.
