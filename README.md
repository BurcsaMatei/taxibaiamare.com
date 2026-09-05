# taxibaiamare.com

Platformă de taxi modernă (BOLT-like), multi-city, cu obiectiv de scalare națională (România).
Monorepo npm workspaces: backend realtime (Express + WebSocket), dispecerat live (Next.js), aplicații user/driver în plan.

## Suprafețe

| Workspace | Rol | Status |
|---|---|---|
| `api/` | Backend central — Express 5 + WS, port 3001 | funcțional (demo realtime, fără persistență) |
| `controlcenter/` | Dispecerat — Next.js 16, hartă live Mapbox, port 3000 | LIVE pe [ops.taxibaiamare.com](https://ops.taxibaiamare.com) |
| `packages/shared/` | `@taxi/shared` — domain types, contracts, evenimente realtime | sursă unică de adevăr |
| `packages/tokens/` | `@taxi/tokens` — design tokens (Vanilla Extract, light/dark) | stabil |
| `user/`, `driver/` | App client (React Native, iOS + Android), respectiv driver PWA | inexistente încă — nume rezervate |

## Arhitectură

```
browser → Next API proxies (controlcenter/pages/api/*) → Express :3001
                                                       → WS /ws?token=... → topic hub
```

Auth: PIN (per oraș sau HQ) → token HMAC cu scope `hq` | `city` → autorizare pe topicuri WS.
Dispatch: nearest-vehicle (Haversine), sincron la `POST /orders`.

## Pornire locală (WSL)

Cerințe: Node 22.x. Copiază `api/.env.example` → `api/.env.local` și `controlcenter/.env.example` → `controlcenter/.env.local`, completează valorile.

```bash
npm install

# 1. shared — obligatoriu înaintea api (dist-ul e consumat)
npm -w packages/shared run build

# 2. api (build first — dev rulează dist/)
npm -w api run build
node --env-file=api/.env.local api/dist/index.js   # :3001

# 3. controlcenter (terminal separat)
npm run dev:controlcenter                           # :3000

# 4. simulator flotă (terminal separat; Ctrl+C = offline)
npm run sim:fleet -- --city baia-mare --count 20
```

Verificare: `npm run typecheck` (toate workspace-urile), `npm -w controlcenter run check:all`.

## Documentație

- [`CLAUDE.md`](CLAUDE.md) — instrucțiuni pentru agenți: reguli de lucru, convenții, interzis/permis
- [`PRD.md`](PRD.md) — produs: suprafețe, utilizatori, reguli de business, starea reală, non-goals
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — tehnic: workspaces, flux de date, realtime, deployment, riscuri
- [`ROADMAP.md`](ROADMAP.md) — faze, dependențe, milestone-uri (sursa de adevăr pentru ordinea de execuție)
- [`CHANGELOG.md`](CHANGELOG.md) — istoric și motivele din spatele deciziilor
- [`docs/konceptid-taxi.md`](docs/konceptid-taxi.md) — workflow-ul de execuție per issue (KonceptID)
