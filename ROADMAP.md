# ROADMAP — taxibaiamare.com

## 1. Ce este acest roadmap

Planul complet de execuție de la starea actuală (controlcenter matur vizual, api demo fără persistență, user/driver inexistente) până la produsul testabil end-to-end: user comandă → driver acceptă și execută → controlcenter vede totul live.

Cum se folosește:
- Fiecare item = un issue GitHub (#15–#59 backlog-ul inițial; maparea `#nr = taxi-XXX + 14` e valabilă DOAR pentru acest interval — issue-urile noi de după, ex. taxi-046 = #76, taxi-047 = #77, primesc numărul curent GitHub), executat prin workflow-ul din `docs/konceptid-taxi.md`: Prompt 1 (analiză) → aprobare → Prompt 2 (execuție) → PR → merge → update CLAUDE.md + ROADMAP.md. Hot-fix-urile mici (P2/P3, fără risc arhitectural) pot sări peste Prompt 1, cu issue dedicat obligatoriu.
- **Ordinea e dictată exclusiv de dependențe, nu de preferințe.** Un issue nu se începe dacă are dependențe nemergeuite. Dacă două issues nu se blochează reciproc, pot rula în paralel.
- Convenție numerotare: `#nr GitHub = taxi-XXX + 14` (taxi-001 = #15 … taxi-045 = #59).

## 2. Drumul critic (P1)

Secvența P1 în ordinea de execuție. Săgețile arată dependența directă; itemii de pe același rând pot rula în paralel.

```
taxi-001 (#15) secrete ──→ taxi-003* (#17) env ──→ taxi-011 (#25) Supabase
taxi-002 (#16) CI          taxi-008 (#22) contracte   taxi-009 (#23) dedupe   taxi-017 (#31) pagini ops
                                    │
taxi-011 ──→ taxi-012 (#26) persistare orders ──→ taxi-013 (#27) GET /orders ──→ taxi-018 (#32) orders UI
                  │                                    taxi-014 (#28) auth scriere
taxi-011 ──→ taxi-020 (#34) user auth ──→ taxi-021 (#35) WS multi-subiect
                  │
taxi-020 + taxi-011 ──→ taxi-027 (#41) drivers ──→ taxi-043 (#57) vehicle entity
taxi-002 ──→ taxi-022 (#36) scaffold user ──→ taxi-023 (#37) creare comandă ──→ taxi-024 (#38) tracking
taxi-002 ──→ taxi-029 (#43) scaffold driver ──→ taxi-030 (#44) locație reală
taxi-010 (#24) evenimente driver + taxi-012 + taxi-027 ──→ taxi-028 (#42) dispatch confirmare
taxi-028 + taxi-030 ──→ taxi-031 (#45) accept ofertă ──→ taxi-032 (#46) execuție cursă
taxi-018 + taxi-024 + taxi-032 ──→ taxi-034 (#48) E2E
taxi-001 + taxi-002 + taxi-003 ──→ taxi-044 (#58) Vercel + domeniu (ramură paralelă — nu blochează MVP-ul testabil local)
```

\* taxi-003 e P2, dar stă pe drumul critic: taxi-011 depinde de el.

Lanțul cel mai lung (long pole): **001 → 003 → 011 → 020 → 027 → 028 → 031 → 032 → 034** — orice întârziere aici întârzie tot MVP-ul. Track-ul user (022 → 023 → 024) și track-ul driver (029 → 030) se execută în paralel cu el.

## 3. Faze

### Faza 0 — Igienă & securitate
Scop: repo sigur, CI real, tooling care rulează pe WSL.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | ✅ 2026-07-02 — taxi-001 Rotire secrete + eliminare .env.local din git | #15 | P1 | infra/api | — |
| 1 | ✅ 2026-07-02 — taxi-002 CI funcțional la root | #16 | P1 | infra | — |
| 2 | ✅ 2026-07-02 — taxi-003 .env.example reale | #17 | P2 | infra | taxi-001 |
| 2 | ✅ 2026-07-02 — taxi-004 Simulatoare flotă bash/node | #18 | P2 | infra | — |
| 2 | ✅ 2026-07-03 — taxi-005 Fix proxy fleet env var | #19 | P2 | controlcenter | — |
| 3 | ✅ 2026-07-02 — taxi-044 Setup Vercel + domeniu — **LIVE pe `ops.taxibaiamare.com`** (varianta A: doar controlcenter; build config în dashboard Vercel, nu în vercel.json; proiectele user/driver/admin la scaffold-ul lor) | #58 | P1 | infra | taxi-001, taxi-002, taxi-003 |
| 3 | ✅ 2026-07-03 — taxi-006 README root | #20 | P3 | infra | — |
| 3 | ✅ 2026-07-03 — taxi-007 Eliminare next-pwa@0.0.1 | #21 | P3 | controlcenter | — |

Paralel: 001 ∥ 002 ∥ 004 ∥ 005 (fără dependențe între ele); 006/007 oricând; 044 după 001+002+003.
Deblochează: Faza 2 (Supabase are nevoie de 001+003), scaffold-urile user/driver/landing (au nevoie de 002), deployment-ul suprafețelor web (044).
Notă 044: API-ul (Express + WS) NU merge pe Vercel — VPS Hetzner, api.domeniu.ro; Vercel doar pentru controlcenter/driver/admin (user e app nativ React Native, distribuit prin App Store + Google Play — fără subdomeniu web).

### Faza 1 — Shared ca sursă de adevăr
Scop: contractele din `@taxi/shared` devin reale și complete înainte de a construi pe ele.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | ✅ 2026-07-03 — taxi-008 Aliniere contracts/orders.ts cu API-ul real | #22 | P1 | shared/api | — |
| 1 | ✅ 2026-07-03 — taxi-009 Mutare TokenPayload + CityPublic în shared | #23 | P1 | shared/api/controlcenter | — |
| 2 | ✅ 2026-07-03 — taxi-010 Evenimente lifecycle driver + registry | #24 | P1 | shared/api | taxi-008 |
| — | ✅ 2026-07-03 — taxi-046 Fix `Order.serviceType` → `service` (hot-fix post-audit) | #76 | P1 | shared | taxi-008 |
| — | ✅ 2026-07-03 — taxi-047 Fix CI Node 20 → 22 (hot-fix post-audit) | #77 | P2 | infra | — |

Paralel: 008 ∥ 009; faza întreagă poate rula în paralel cu Faza 0.
Deblochează: taxi-012 (persistare pe contracte corecte), taxi-014, taxi-028, taxi-035.

### Faza 2 — Persistență Supabase
Scop: platforma capătă memorie — comenzi, orașe și flotă în DB.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | taxi-011 Setup Supabase: proiect, schemă, env | #25 | P1 | api/infra | taxi-001, taxi-003 |
| 2 | taxi-012 Persistare orders (POST în DB, PATCH validat) | #26 | P1 | api | taxi-008, taxi-011 |
| 3 | taxi-013 GET /orders + GET /orders/:id | #27 | P1 | api | taxi-012 |
| 3 | taxi-014 Auth pe rutele de scriere orders | #28 | P1 | api | taxi-009, taxi-012 |
| 2 | taxi-015 Cities din Supabase | #29 | P2 | api | taxi-011 |
| 2 | taxi-016 Vehicles/fleet din Supabase, multi-city | #30 | P2 | api | taxi-011 |

Paralel: după 011 → 012 ∥ 015 ∥ 016; după 012 → 013 ∥ 014.
Deblochează: Faza 3 completă, auth user (taxi-020), pricing (taxi-038).

### Faza 3 — Controlcenter complet
Scop: dispeceratul devine operațional — două pagini distincte, date care supraviețuiesc refresh-ului.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | taxi-017 Pagină comenzi separată + markeri PNG galben/roșu | #31 | P1 | controlcenter | — |
| 2 | taxi-018 OpsOrdersPage pe snapshot + live WS | #32 | P1 | controlcenter | taxi-013, taxi-017 |
| 2 | taxi-019 Snapshot inițial pe hartă | #33 | P2 | controlcenter | taxi-013, taxi-016 |

Paralel: 017 poate începe imediat (zero dependențe — milestone-ul curent); 018 ∥ 019 după 013.
Deblochează: taxi-034 (E2E), taxi-040 (cleanup rute deprecated).

### Faza 4 — Auth multi-subiect + aplicația user
Scop: clientul există — se autentifică, comandă și își urmărește cursa live.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | taxi-020 User auth (Supabase phone OTP) | #34 | P1 | api/shared | taxi-011 |
| 2 | taxi-021 WS multi-subiect (user/driver) | #35 | P1 | api | taxi-020 |
| 1 | taxi-022 Scaffold workspace user/ — **React Native (iOS + Android), nu Next.js** | #36 | P1 | user | taxi-002 |
| 3 | taxi-023 Flux creare comandă | #37 | P1 | user | taxi-012, taxi-014, taxi-020, taxi-022 |
| 4 | taxi-024 Tracking live comandă | #38 | P1 | user | taxi-021, taxi-023 |
| 5 | taxi-025 Istoric comenzi user | #39 | P2 | user/api | taxi-013, taxi-023 |
| 5 | taxi-026 „Sună dispecerat” în user app | #40 | P2 | user | taxi-023 |

Paralel: 020 ∥ 022; după 023 → 024 ∥ 025 ∥ 026.
Deblochează: driver auth (taxi-027 cere pattern-ul din 020), locație reală driver (taxi-030 cere 021), E2E user-side.

### Faza 5 — Aplicația driver
Scop: șoferul există — primește oferte, acceptă și conduce cursa prin toate stările.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | taxi-027 Modul drivers (entitate, auth, vehicul) | #41 | P1 | api/shared | taxi-011, taxi-020 |
| 1 | taxi-029 Scaffold workspace driver/ | #43 | P1 | driver | taxi-002 |
| 2 | taxi-043 Entitate vehicle completă (indicativ, poze, Storage) | #57 | P1 | api/shared | taxi-011, taxi-027 |
| 2 | taxi-028 Dispatch cu confirmare (ofertă/accept/timeout) | #42 | P1 | api | taxi-010, taxi-012, taxi-027 |
| 2 | taxi-030 Online/offline + locație reală | #44 | P1 | driver/api | taxi-021, taxi-027, taxi-029 |
| 3 | taxi-031 Primire ofertă + accept/refuz | #45 | P1 | driver | taxi-028, taxi-030 |
| 4 | taxi-032 Execuție cursă (arrived → in_progress → completed) | #46 | P1 | driver/api | taxi-031 |
| 2 | taxi-045 Scaffold admin panel + auth admin + CRUD indicative | #59 | P2 | admin/api/shared | taxi-011, taxi-027 |
| 5 | taxi-033 Retragere endpoints /dev/vehicles/* | #47 | P2 | api/infra | taxi-004, taxi-030 |

Paralel: 027 ∥ 029; după 027 → 028 ∥ 030 ∥ 043 ∥ 045.
Notă: taxi-043 a fost deschis ulterior, dar aparține logic acestei faze — cardul cursei din taxi-024 îl consumă; ideal se închide înainte de sau împreună cu 031.
Notă 045: introduce suprafața nouă `admin/` (a cincea suprafață web, admin.domeniu.ro) — interfața prin care flota (indicative `{CITY_CODE}{NR}`, poze, asocieri șofer–vehicul) se administrează fără acces direct la DB; pregătește auth-ul driver pe telefon (027) și cardul cursei (024/043).
Deblochează: taxi-034 (E2E complet), taxi-036 (seed cu driveri).

### Faza 6 — E2E & QA
Scop: „testabil complet” devine o comandă care rulează repetat, nu o afirmație.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| 1 | taxi-034 Scenariu E2E documentat + script | #48 | P1 | infra | taxi-018, taxi-024, taxi-032 |
| 1 | taxi-035 Teste unit shared + api | #49 | P2 | infra/shared/api | taxi-008 |
| 1 | taxi-036 Seed demo multi-city (5 orașe) | #50 | P2 | api | taxi-015, taxi-016, taxi-027 |

Paralel: toate trei independente între ele; 035 poate rula mult mai devreme (doar 008 o blochează).
Deblochează: MVP declarat testabil (M4).

### Post-MVP (P3)
Scop: extindere după validarea buclei principale.

| Ordine | Issue | # | P | Suprafață | Depinde de |
|---|---|---|---|---|---|
| — | taxi-037 Scaffold workspace landing/ | #51 | P3 | infra | taxi-002 |
| — | taxi-038 Pricing/quote engine | #52 | P3 | api/shared | taxi-012 |
| — | taxi-039 Modul payments | #53 | P3 | api | taxi-038 |
| — | taxi-040 Eliminare rute deprecated | #54 | P3 | controlcenter/api | taxi-018 |
| — | taxi-041 Igienă shared (extensii, PAYMENT_PENDING) | #55 | P3 | shared | — |
| — | taxi-042 Hardening API (rate limit, CORS, logging) | #56 | P3 | api | taxi-014 |

Ordinea internă e liberă, cu excepția 038 → 039. Conform ordinii de produs, landing (037) precede user/driver ca prioritate de business, dar tehnic nu blochează nimic.

## 4. Matrice de dependențe

| Issue | # | E blocat de | Blochează |
|---|---|---|---|
| taxi-001 | #15 | — | 003, 011, 044 |
| taxi-002 | #16 | — | 022, 029, 037, 044 |
| taxi-003 | #17 | 001 | 011, 044 |
| taxi-004 | #18 | — | 033 |
| taxi-005 | #19 | — | — |
| taxi-006 | #20 | — | — |
| taxi-007 | #21 | — | — |
| taxi-008 | #22 | — | 010, 012, 035 |
| taxi-009 | #23 | — | 014 |
| taxi-010 | #24 | 008 | 028 |
| taxi-011 | #25 | 001, 003 | 012, 015, 016, 020, 027, 043, 045 |
| taxi-012 | #26 | 008, 011 | 013, 014, 023, 028, 038 |
| taxi-013 | #27 | 012 | 018, 019, 025 |
| taxi-014 | #28 | 009, 012 | 023, 042 |
| taxi-015 | #29 | 011 | 036 |
| taxi-016 | #30 | 011 | 019, 036 |
| taxi-017 | #31 | — | 018 |
| taxi-018 | #32 | 013, 017 | 034, 040 |
| taxi-019 | #33 | 013, 016 | — |
| taxi-020 | #34 | 011 | 021, 023, 027 |
| taxi-021 | #35 | 020 | 024, 030 |
| taxi-022 | #36 | 002 | 023 |
| taxi-023 | #37 | 012, 014, 020, 022 | 024, 025, 026 |
| taxi-024 | #38 | 021, 023 | 034 |
| taxi-025 | #39 | 013, 023 | — |
| taxi-026 | #40 | 023 | — |
| taxi-027 | #41 | 011, 020 | 028, 030, 036, 043, 045 |
| taxi-028 | #42 | 010, 012, 027 | 031 |
| taxi-029 | #43 | 002 | 030 |
| taxi-030 | #44 | 021, 027, 029 | 031, 033 |
| taxi-031 | #45 | 028, 030 | 032 |
| taxi-032 | #46 | 031 | 034 |
| taxi-033 | #47 | 004, 030 | — |
| taxi-034 | #48 | 018, 024, 032 | — |
| taxi-035 | #49 | 008 | — |
| taxi-036 | #50 | 015, 016, 027 | — |
| taxi-037 | #51 | 002 | — |
| taxi-038 | #52 | 012 | 039 |
| taxi-039 | #53 | 038 | — |
| taxi-040 | #54 | 018 | — |
| taxi-041 | #55 | — | — |
| taxi-042 | #56 | 014 | — |
| taxi-043 | #57 | 011, 027 | — |
| taxi-044 | #58 | 001, 002, 003 | — |
| taxi-045 | #59 | 011, 027 | — |
| taxi-046 | #76 | 008 | — |
| taxi-047 | #77 | — | — |

## 5. Milestone-uri

**M1 — Repo sigur + CI verde — ✅ ATINS 2026-07-03**
Închise: toată Faza 0 (taxi-001…007, taxi-044) + taxi-047 (CI pe Node 22).
Validare: secretele rotite și netracked, CI rulează pe PR și e verde (Node 22, aliniat cu producția), simulatorul de flotă merge pe WSL, controlcenter LIVE pe ops.taxibaiamare.com.

**M2 — API persistent + controlcenter funcțional complet**
Închise: taxi-008…taxi-019 (#22–#33).
Validare: comandă creată cu curl autentificat → vizibilă în DB, în pagina de comenzi și pe hartă (markeri galben/roșu); refresh nu pierde nimic; tranziții invalide respinse.

**M3 — User app testabilă end-to-end**
Închise: taxi-020…taxi-026 (#34–#40).
Validare: un client real se loghează cu OTP, comandă din UI, vede statusul și mașina live pe hartă; controlcenter vede comanda simultan.

**M4 — Driver app testabilă + flux complet user→driver→controlcenter**
Închise: taxi-027…taxi-034 (#41–#48) + taxi-043 (#57).
Validare: `npm run e2e:happy` verde — user comandă, driverul primește oferta, acceptă, execută cursa până la COMPLETED, clientul vede cardul complet al cursei (indicativ, mașină, poze, preț), controlcenter vede totul live pe ambele pagini.

După M4, produsul e MVP testabil complet. Post-MVP (037–042) se prioritizează separat.

## 6. Reguli de actualizare

- **La fiecare merge de issue:** marchează itemul în acest fișier (strikethrough sau ✅ + data), în același PR care actualizează CLAUDE.md. Niciun issue nu e închis fără ambele actualizări.
- **La decizii arhitecturale noi** (provider nou, schimbare de flux, issue nou/anulat): actualizează faza afectată, matricea de dependențe și, dacă e cazul, drumul critic — în PR-ul care implementează decizia sau într-un PR `docs:` dedicat.
- **La deschiderea de issues noi:** primesc număr `taxi-XXX` secvențial, intră în faza corespunzătoare cu dependențele explicite și se adaugă în matrice.
- **Nu se reordonează fazele retroactiv** — dacă realitatea contrazice planul, se documentează schimbarea, nu se rescrie istoria.
- Sursa de adevăr pentru starea curentă rămâne CLAUDE.md; ROADMAP.md e sursa de adevăr pentru secvență și dependențe.
