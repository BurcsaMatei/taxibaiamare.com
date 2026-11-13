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

## Starea în trei rânduri

**LIVE din 2026-11-13:** `ops.taxibaiamare.com` (Vercel) + `api.taxibaiamare.com` (Railway). Intri cu **o
singură parolă** (hash scrypt în env) direct pe `/ops/baia-mare/map`; harta se încarcă, WS conectat.
M1 atins (2026-07-03); **Reorientare 2026-11-13:** scop activ = controlcenter + API + persistență +
deploy; restul parcat (21 issues `[PARCAT]`). Livrat azi: taxi-048 (#93 parolă), taxi-051 (#97 token pe
toate rutele), taxi-049 (#95 deploy API), taxi-052 (#99 CSP/WS), taxi-053 (#101 mapbox css).
**Nu există persistență** (refresh = totul pierdut) și **nu există vehicule reale**: cele 250 din Baia Mare
sunt offline până rulează simulatorul (`PASSWORD='…' npm run sim:fleet -- --base-url https://api.taxibaiamare.com`).
Următorii: **#31** (pagina de comenzi), persistența (**furnizor în discuție:** Neon + Blob în loc de
Supabase), **#96** (comandă manuală). **Railway e pe trial (30 zile / 5 $)** — de trecut pe plan plătit.
Detalii deploy → `ARCHITECTURE.md` §10; produs → `PRD.md` §5.

---

## Reguli de lucru

Workflow (branch, când e nevoie de issue, analiză→execuție, PR, merge) → `konceptid-ops` →
`STANDARDS.md` §7. Nu se repetă aici.

- Commit: `type(scope): description` — ex. `feat(controlcenter): …`, `chore(api): …`.
- După merge: update `CLAUDE.md` + `ROADMAP.md` dacă starea s-a schimbat.
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
npm run typecheck                                 # toate workspace-urile
npm -w controlcenter run check:all                # format:check + typecheck + lint
```

Node 22.x. Env: `api/.env.example` + `controlcenter/.env.example` — reale, fiecare cheie e citită de cod.

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
- **`OpsOrdersPage.tsx` există dar nu e montat nicăieri** — ruta de comenzi afișează harta. → taxi-017 (#31)
- Modulele `api/src/modules/drivers/` și `payments/` sunt stub-uri goale.
- **Zero teste** în repo.
- Aplicația **user va fi nativă (React Native)**, nu PWA, nu web. Nu există `app.taxibaiamare.com` în plan.
