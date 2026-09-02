# PRD — taxibaiamare.com

**Product Requirements Document.** Ce construim, pentru cine, ce trebuie să facă produsul.
Pentru tehnic → [`ARCHITECTURE.md`](./ARCHITECTURE.md). Pentru ordinea de execuție → [`ROADMAP.md`](./ROADMAP.md).

**Ultima actualizare:** 2026-09-02

---

## 1. Ce este produsul

**Platformă de taxi modernă, multi-oraș, de tip BOLT/Uber**, construită pentru piața din România.
Nu e un site de prezentare pentru o firmă de taxi — e infrastructura operațională completă: comandă,
dispecerizare, urmărire live, plată.

Diferența față de un site: aici produsul **este** software-ul care rulează operațiunea, nu o vitrină.

Obiectivul declarat: scalare națională, pornind de la Baia Mare.

---

## 2. Pentru cine — cele patru suprafețe

Produsul e format din patru aplicații distincte, cu utilizatori diferiți. **Ordinea de construcție e
decisă și fixă:** controlcenter → landing → user → driver → payments.

| Suprafață | Utilizator | Ce face | Stare |
| --- | --- | --- | --- |
| **Controlcenter** (dispecerat) | Dispecerul firmei, la birou | Vede flota live pe hartă, gestionează comenzi, comută între orașe | **LIVE** pe `ops.taxibaiamare.com` |
| **Landing** | Public / clienți potențiali | Prezentare, descărcare aplicații | nu există încă |
| **User** (pasager) | Clientul care comandă | Comandă cursă, urmărește șoferul, plătește | nu există încă |
| **Driver** (șofer) | Șoferul de taxi | Primește oferte, acceptă/refuză, navighează | nu există încă |

**Decizie fermă asupra aplicației user:** va fi **aplicație nativă React Native (iOS + Android)**,
distribuită prin App Store și Google Play. **Nu PWA, nu web.** Nu va exista `app.taxibaiamare.com`.

Motivul: o aplicație de comandă taxi are nevoie de locație în background, notificări push fiabile și
prezență pe ecranul telefonului — lucruri pe care un PWA nu le oferă comparabil pe iOS.

---

## 3. Ce trebuie să facă — cerințe pe suprafață

### 3.1 Controlcenter (singura suprafață existentă)

| Cerință | Stare |
| --- | --- |
| Autentificare cu PIN — per oraș sau HQ (acces la toate orașele) | ✅ funcțional |
| Hartă live cu poziția vehiculelor, per oraș (Mapbox) | ✅ funcțional |
| HUD cu starea flotei | ✅ funcțional |
| Comutare între orașe (city switcher), pentru operatorii HQ | ✅ funcțional |
| Actualizare în timp real, cu reconectare automată la pierderea conexiunii | ✅ funcțional |
| **Pagina de comenzi — listă, filtrare, acțiuni** | ❌ **construită dar nemontată** (vezi §5) |
| Atribuire manuală a unei comenzi către un vehicul | ❌ nu există |

### 3.2 Reguli de business stabilite

- **Dispecerizare: cel mai apropiat vehicul disponibil** (distanță Haversine), calculată sincron la
  primirea comenzii. Șoferul **nu** acceptă încă — atribuirea e automată și finală.
  Lifecycle-ul cu acceptare/refuz din partea șoferului (`order.offered` → `accepted`/`rejected`) e
  definit în tipuri, dar nu e emis efectiv.
- **Vehiculele au indicativ**, în formatul `{COD_ORAȘ}{NUMĂR}` — cum se identifică o mașină în
  operațiunea reală, nu prin UUID. (Entitatea completă e încă de implementat — taxi-043 / #57.)
- **Prezența vehiculului expiră** după 60 de secunde fără semnal. Un vehicul care nu mai raportează
  poziția dispare din dispecerizare — nu rămâne fantomă pe hartă.
- **Autorizarea e pe oraș.** Un operator cu scope `city` vede și acționează exclusiv în orașul lui;
  doar `hq` vede tot. Se aplică inclusiv la abonarea pe canalele de timp real.
- **Cinci orașe definite:** Baia Mare, Cluj-Napoca, Iași, Satu Mare, Timișoara.
  **Doar Baia Mare are flotă** (250 de vehicule sintetice). În celelalte, o comandă eșuează — nu există
  vehicule de atribuit. Comportament așteptat în stadiul actual, nu defect.

### 3.3 Ce trebuie să facă produsul, dar încă nu face

Acestea sunt cerințe de produs neîndeplinite, nu idei:

| Cerință | Blocant |
| --- | --- |
| **Comenzile să supraviețuiască unui refresh** | Nu există persistență — comenzile sunt doar evenimente efemere. Decizia luată: **Supabase**. Punct de intrare: taxi-011 (#25). |
| Istoric de comenzi, rapoarte, facturare | Depinde de persistență |
| Pasagerul să poată comanda | Aplicația user nu există |
| Șoferul să accepte/refuze o cursă | Aplicația driver nu există |
| Calcul de preț și plată | Modulele `pricing` și `payments` sunt stub-uri goale |

---

## 4. Ce NU face produsul (non-goals)

| Nu facem | Motivul |
| --- | --- |
| PWA pentru aplicația user | Decizie fermă: nativ React Native (§2) |
| Subdomeniu web pentru user | Se distribuie prin store-uri |
| Un proiect Vercel separat per suprafață, acum | „Varianta A": un singur proiect, două pagini interne. Se extinde când suprafețele există. |
| API pe Vercel | Express + WebSocket cu conexiuni persistente → VPS Hetzner, nu serverless |
| pnpm / Turborepo | npm workspaces, deliberat |
| Bibliotecă de validare (zod etc.) | Guard-uri scrise de mână, care întorc `null` la invalid. Nu se schimbă fără discuție. |

---

## 5. Starea reală a produsului (2026-09-02)

Onest, verificat în cod — nu ce ar trebui să fie:

**Ce funcționează:** controlcenter-ul e matur vizual și funcțional pentru monitorizare live.
Un dispecer poate să se autentifice, să vadă flota din Baia Mare mișcându-se pe hartă în timp real,
și să comute între orașe dacă are drepturi HQ.

**Ce nu funcționează:**

- **Nu există persistență.** Un restart de server sau un refresh înseamnă pierderea tuturor comenzilor.
  Acesta e blocantul numărul unu al întregului produs.
- **Pagina de comenzi e construită dar nemontată.** `OpsOrdersPage.tsx` (peste 400 de linii, funcțional)
  nu e importată nicăieri; ruta `/ops/[cityId]/orders` afișează în schimb harta. Verificat în cod la
  2026-09-02. → taxi-017 (#31)
- **API-ul nu e deployat.** `api.taxibaiamare.com` nu răspunde (verificat: fără DNS/serviciu).
  Consecință: **pe producție, login-ul eșuează controlat.** Interfața e live, dar nu are backend.
  Deployment-ul pe VPS Hetzner e în afara scopului actual.
- Modulele `drivers` și `payments` sunt stub-uri goale (`export {}`).
- Zero teste în tot repo-ul.

**Milestone atins:** M1 (2026-07-03) — Faza 0 complet închisă.
**Milestone curent:** M2 — API persistent + controlcenter funcțional complet.
**Activitate:** ultimul commit de cod la 2026-07-03; proiectul e în pauză de ~2 luni. 34 issues deschise.

---

## 6. Domenii

| Domeniu | Servește | Stare |
| --- | --- | --- |
| `ops.taxibaiamare.com` | Controlcenter (dispecerat) | ✅ live |
| `taxibaiamare.com` (apex) + `www` | Tot controlcenter-ul, momentan | ✅ live — va deveni `landing` când există |
| `api.taxibaiamare.com` | API Express + WS, pe VPS | ❌ nedeployat |

---

## 7. Proprietate

Proiect KonceptID. Cod proprietar.
