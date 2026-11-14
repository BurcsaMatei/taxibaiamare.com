# CLAUDE.md — taxibaiamare.com

Instrucțiuni pentru agentul care lucrează în acest repo. Se încarcă la fiecare sesiune, deci rămâne
**scurt**. Detaliile stau în fișierele de mai jos și se citesc **la nevoie**.

---

## Harta documentației

| Fișier | Când îl citești |
| --- | --- |
| **`CLAUDE.md`** (acesta) | Mereu — reguli de lucru + esențial |
| [`PRD.md`](./PRD.md) | Produs: suprafețe, reguli de business, starea reală, non-goals |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Cod: workspaces, flux de date, realtime, deployment, **riscuri (§11)** |
| [`ROADMAP.md`](./ROADMAP.md) | **Sursa de adevăr pentru ordinea de execuție** — faze, dependențe, milestone-uri |
| [`CHANGELOG.md`](./CHANGELOG.md) | De ce a fost făcut ceva într-un anume fel; istoric |
| `docs/konceptid-taxi.md` | Workflow-ul de colaborare KonceptID, per issue |
| `AGENTS.md` | Pointer către acest fișier |

**Regula de aur:** codul e sursa de adevăr. Dacă documentația contrazice codul, codul câștigă — și
actualizezi documentația în același PR.

---

## Ce este proiectul

Platformă de taxi multi-oraș (BOLT-like) pentru România — brand **Taxi Galant**, administrată de
**KonceptID**. Monorepo npm cu patru suprafețe planificate; **doar dispeceratul există**, iar
user/driver/admin/landing sunt **parcate** (vezi `ROADMAP.md` §2).

```
api/               Express 5 + WS (:3001)          — LIVE pe api.taxibaiamare.com (Railway)
controlcenter/     Next.js 16 (:3000)              — LIVE pe ops.taxibaiamare.com
packages/shared/   @taxi/shared                    — SURSĂ UNICĂ pentru domeniu
packages/tokens/   @taxi/tokens                    — design tokens
user/ driver/      REZERVATE — nu există pe disc. Nu le șterge din `workspaces`.
```

Ordinea de dezvoltare, decisă și fixă: **controlcenter → landing → user → driver → payments**.

---

**Principiu (2026-11-13):** până la finalul M2 nu se începe nimic din `[PARCAT]` și nicio infrastructură
nouă (excepții: securitate pentru ce există, costurile Railway). **Controlcenter-ul doar observă** în timp
real clientul, șoferul și flota; nu creează comenzi. Telefonul: singurul rol e „user a sunat dispeceratul
din aplicație" (nu sunt mașini libere), eveniment deja afișat în pagina de comenzi.

## Starea în trei rânduri

**LIVE din 2026-11-13:** `ops.taxibaiamare.com` (Vercel) + `api.taxibaiamare.com` (Railway). Intri cu **o
singură parolă** (hash scrypt în env) direct pe `/ops/baia-mare/map`; harta se încarcă, WS conectat.
M1 atins (2026-07-03); **Reorientare 2026-11-13:** scop activ = controlcenter + API + persistență +
deploy; restul parcat (22 issues `[PARCAT]`). Livrat azi: taxi-048 (#93 parolă), taxi-051 (#97 token pe
toate rutele), taxi-049 (#95 deploy API), taxi-052 (#99 CSP/WS), taxi-053 (#101 mapbox css).
**Nu există persistență** (refresh = totul pierdut) și **nu există vehicule reale**: cele 250 din Baia Mare
sunt offline până rulează simulatorul (`PASSWORD='…' npm run sim:fleet -- --base-url https://api.taxibaiamare.com`).
**2026-11-14:** taxi-017 (#31) pas 1 livrat (PR #108) — `/ops/[cityId]/orders` montează pagina de comenzi,
buton **Hartă / Comenzi** pe ambele pagini. **2026-11-14:** markerii livrați (PR #111) — mașina cu comandă
activă e roșie (`taxi-busy.png`), cea liberă galbenă; verificat pe producție; **#31 închis**.
**2026-11-14:** taxi-055 (#104) livrat (PR #109) — `npm run sim:orders`; verificat local (comenzi live în
pagina de comenzi + evenimentul „user a sunat dispeceratul"); **#104 închis** după verificarea și pe
producție (`--base-url https://api.taxibaiamare.com`, 2026-11-14).
**2026-11-14:** PR B livrat (PR #110) — API-ul ține minte vehiculele ocupate (listă în memorie, se pierde la
restart; eliberare la COMPLETED/CANCELED); verificat local: comenzile eșuate apar cu FAILED + CALLED.
Verificat și pe producție: comenzi live, FAILED + CALLED cu flotă mică.
Următorii: persistența (**furnizor în discuție:** Neon în
loc de Supabase; Blob nu e necesar acum). **Railway e pe plan plătit** (trecut din trial la 2026-11-14).
Detalii deploy → `ARCHITECTURE.md` §10; produs → `PRD.md` §5.

---

## Reguli de lucru

Workflow (branch, când e nevoie de issue, analiză→execuție, PR, merge) → `konceptid-ops` →
`STANDARDS.md` §7. Nu se repetă aici.

- Commit: `type(scope): description` — ex. `feat(controlcenter): …`, `chore(api): …`.
- **Procedura (tot ce merge e live în producție):** branch → commit → PR → verificare în Preview și analiza
  PR-ului împreună → corecturi dacă e nevoie → **„merge" explicit de la proprietar** → squash în `main`. Nu se
  lucrează pe un branch `dev`. Doar modificările **docs-only** merg direct în `main`.
- După merge: update `CLAUDE.md` + `ROADMAP.md` dacă starea s-a schimbat (commit docs direct în `main`).
- PR-ul care livrează doar o parte dintr-un issue folosește `Refs #nr`, nu `Closes #nr`.
- `npm run typecheck` + `npm -w controlcenter run lint` curate înainte de commit.
- **CI-ul GitHub nu pornește** (blocaj de facturare la nivel de cont). Verificarea reală e Vercel Preview.

### Ordinea de build — cauza #1 de build eșuat

```bash
npm -w packages/shared run build   # ÎNTOTDEAUNA primul — dist-ul e consumat de api și controlcenter
```

---

## Interzis / Permis

**Interzis:**

- commit de `.env.local` sau secrete
- **inline styles**, CSS global nou, tipuri de domeniu în afara `@taxi/shared`
- dependențe noi semnificative fără discuție
- **reparat known issues sau șters rute deprecated fără să ți se ceară** — fiecare are issue-ul lui
- rulat scripturi `.ps1` din WSL (`scripts/project-tree.ps1` e PowerShell-only)
- introdus bibliotecă de validare (zod etc.) — stilul e guard-uri scrise de mână care întorc `null`

**Permis fără să întrebi:** refactor local în fișierele pe care le atingi pentru task, aliniere la
convenții, completare de tipuri lipsă în `@taxi/shared` când task-ul o cere.

---

## Convenții de cod

- TypeScript strict, **fără `any`**. Controlcenter adaugă `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- **Vanilla Extract only** (`styles/*.css.ts`), tokens din `@taxi/tokens`.
- **Importuri relative**, fără alias-uri. Type imports inline: `import { type Foo }`.
- Comentarii de secțiune:
  ```ts
  // ==============================
  // Section name
  // ==============================
  ```
- Prettier: 100 coloane, ghilimele duble, `;`, trailing commas.
- **Forma răspunsurilor API:** `{ ok: true, ... } | { ok: false, error: string }`.
- Pachete: `@taxi/*`.

---

## Regula centrală

> **Orice tip de domeniu, status, eveniment sau contract nou se adaugă în `packages/shared` —
> niciodată local în `api/` sau `controlcenter/`.**

Nu e preferință de stil: duplicarea de tipuri a produs deja bug-uri reale (taxi-008/009).
Orice eveniment realtime nou se înregistrează și în `api/src/modules/realtime/index.ts`.

---

## Deprecated — nu construi peste ele

- `controlcenter/pages/ops/map.tsx` și `ops/orders.tsx` (city-pickers legacy) — ruta canonică e
  `/ops/[cityId]/{map,orders}`
- `GET /dev/cities/:cityId` (fără auth) — folosește `GET /cities/:cityId` cu Bearer token

---

## Comenzi

```bash
npm run dev:all                                   # TOT local dintr-o comandă: build shared+api, apoi API :3001 + controlcenter :3000 (Ctrl+C = oprește ambele)
PASSWORD='…' npm run hash:password                # generează TAXI_CONTROL_CENTER_PASSWORD_HASH pentru api/.env.local
npm -w packages/shared run build                  # OBLIGATORIU primul (dacă pornești manual)
npm -w api run build
node --env-file=api/.env.local api/dist/index.js  # :3001 — API-ul nu încarcă singur .env.local
npm run dev:controlcenter                         # :3000
PASSWORD='…' npm run sim:fleet -- --city baia-mare --count 20  # simulator flotă (cere parola controlcenter); Ctrl+C = offline
PASSWORD='…' npm run sim:orders -- --city baia-mare            # simulator comenzi (cere parola; rulează lângă sim:fleet); --base-url https://api.taxibaiamare.com pentru producție, --force-calls ca să vezi apelurile la dispecerat; Ctrl+C = anulează comenzile active
npm run typecheck                                 # toate workspace-urile
npm -w controlcenter run check:all                # format:check + typecheck + lint
```

Node 24.x (`.nvmrc`, `engines`, CI; `engines` are prioritate față de dashboard-ul Vercel). Env: `api/.env.example` + `controlcenter/.env.example` — reale, fiecare cheie e citită de cod.

---

## Referințe rapide

- `packages/tokens/src/theme.css.ts` — design tokens
- `api/src/modules/realtime/index.ts` — registry evenimente ↔ topicuri (**de actualizat la orice event nou**)
- `packages/shared/src/` — domeniul: `contracts/orders.ts`, `domain/{auth,city,driver,geo,order,service,status,user,vehicle}.ts`, `events/{realtime,topics}.ts`
- `controlcenter/vercel.json` — configul de build (path absolut; vezi `ARCHITECTURE.md` §10)
- `./briefing.sh` — snapshot de sesiune (git, env, scripts); generează `BRIEFING.md` (gitignored)

---

## De reținut

- **Doar `baia-mare` are flotă** (250 vehicule sintetice). În celelalte 4 orașe, dispecerizarea eșuează —
  e așteptat, nu e bug.
- **Pagina de comenzi e montată** (PR #108); fără date arată „No events yet" (date de test: `sim:orders`).
  Harta colorează mașinile: galben = liberă, roșu = cu comandă activă (PR #111). Harta e goală pe
  localhost/Preview (token Mapbox) — se verifică pe producție.
- **Preview Vercel:** `TAXI_API_BASE_URL` și `NEXT_PUBLIC_TAXI_WS_URL` trebuie bifate pe **Production și
  Preview**, iar după orice schimbare de variabilă e nevoie de **Redeploy** (altfel „Auth proxy error"). Harta
  poate ieși goală pe Preview: tokenul Mapbox permite doar `ops.taxibaiamare.com` + localhost (403 pe tile-uri);
  nu se lărgește tokenul pentru `*.vercel.app` — harta se verifică pe producție, după merge.
- Modulele `api/src/modules/drivers/` și `payments/` sunt stub-uri goale.
- **Zero teste** în repo.
- Aplicația **user va fi nativă (React Native)**, nu PWA, nu web. Nu există `app.taxibaiamare.com` în plan.
