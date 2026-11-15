-- 001_create_orders.sql
--
-- Tabela comenzilor (#25). Coloane minime: doar ce există în cod azi (decizie 2026-11-15).
-- Adresele, numele și emailul clientului se adaugă prin migrații NOI, când evenimentele din aplicații le aduc.
-- Fără telefon, fără observații sau alte câmpuri editabile.
--
-- `service` și `status` oglindesc @taxi/shared (ServiceTypeCode, ORDER_STATUSES). Dacă se schimbă acolo,
-- se adaugă o migrație nouă care actualizează și constrângerile de aici.
-- Regulă: un fișier de migrație care a rulat NU se mai editează — se adaugă unul nou.

create table orders (
  id                     uuid primary key,
  city_id                text not null,
  service                text not null
    check (service in ('TAXI', 'DELIVERY', 'ROADSIDE')),
  status                 text not null
    check (status in ('NEW', 'DISPATCHING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')),
  pickup_lat             double precision not null,
  pickup_lng             double precision not null,
  dropoff_lat            double precision not null,
  dropoff_lng            double precision not null,
  assigned_vehicle_id    text,
  dispatch_failed_reason text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Lista comenzilor unui oraș, cele mai noi primele (GET /orders, pagina de comenzi).
create index orders_city_created_idx on orders (city_id, created_at desc);
