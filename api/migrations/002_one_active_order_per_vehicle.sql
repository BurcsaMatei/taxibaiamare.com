-- 002_one_active_order_per_vehicle.sql
--
-- Regula (#26): un vehicul poate avea cel mult O comandă activă într-un oraș.
-- Dacă două comenzi simultane aleg același vehicul, baza o respinge pe a doua (eroare 23505),
-- iar API-ul încearcă următorul vehicul. Comenzile fără mașină (assigned_vehicle_id null) nu intră în regulă.
--
-- „Activă" oglindește ACTIVE_ORDER_STATUSES din @taxi/shared (NEW, DISPATCHING, ASSIGNED, IN_PROGRESS).
-- Dacă lista se schimbă acolo, se adaugă o migrație nouă care înlocuiește indexul.

create unique index orders_one_active_per_vehicle_idx
  on orders (city_id, assigned_vehicle_id)
  where assigned_vehicle_id is not null
    and status in ('NEW', 'DISPATCHING', 'ASSIGNED', 'IN_PROGRESS');
