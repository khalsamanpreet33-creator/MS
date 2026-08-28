-- ============================================================================
-- Phase 4: Transport (Vehicles, Drivers, Routes, Allocations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id              TEXT PRIMARY KEY,
  vehicle_number  TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('bus', 'van', 'car', 'minibus')),
  capacity        INTEGER NOT NULL DEFAULT 40,
  make_model      TEXT,
  year            INTEGER,
  fuel_type       TEXT,
  insurance_expiry TEXT,
  fitness_expiry  TEXT,
  permit_expiry   TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'maintenance', 'retired')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drivers (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  license_number  TEXT NOT NULL,
  license_expiry  TEXT,
  address         TEXT,
  joining_date    TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transport_routes (
  id              TEXT PRIMARY KEY,
  route_code      TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  vehicle_id      TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id       TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  morning_pickup_time  TEXT,
  evening_drop_time    TEXT,
  distance_km     REAL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transport_stops (
  id              TEXT PRIMARY KEY,
  route_id        TEXT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  latitude        REAL,
  longitude       REAL,
  stop_order      INTEGER NOT NULL DEFAULT 0,
  pickup_time     TEXT,
  drop_time       TEXT,
  fare            REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stops_route ON transport_stops(route_id, stop_order);

CREATE TABLE IF NOT EXISTS transport_allocations (
  id              TEXT PRIMARY KEY,
  route_id        TEXT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_id         TEXT NOT NULL REFERENCES transport_stops(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  effective_from  TEXT NOT NULL DEFAULT (date('now')),
  effective_to    TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'cancelled')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alloc_student ON transport_allocations(student_id, status);
CREATE INDEX IF NOT EXISTS idx_alloc_route ON transport_allocations(route_id, status);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_vehicles_read', 'vehicles.read', 'View vehicles'),
  ('p_vehicles_write', 'vehicles.write', 'Manage vehicles'),
  ('p_drivers_read', 'drivers.read', 'View drivers'),
  ('p_drivers_write', 'drivers.write', 'Manage drivers'),
  ('p_transport_read', 'transport.read', 'View routes, stops, allocations'),
  ('p_transport_write', 'transport.write', 'Manage routes, stops, student allocations');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_vehicles_read'),
  ('r_admin', 'p_vehicles_write'),
  ('r_admin', 'p_drivers_read'),
  ('r_admin', 'p_drivers_write'),
  ('r_admin', 'p_transport_read'),
  ('r_admin', 'p_transport_write'),
  ('r_principal', 'p_vehicles_read'),
  ('r_principal', 'p_transport_read'),
  ('r_principal', 'p_transport_write'),
  ('r_reception', 'p_vehicles_read'),
  ('r_reception', 'p_drivers_read'),
  ('r_reception', 'p_transport_read'),
  ('r_teacher', 'p_transport_read'),
  ('r_accountant', 'p_transport_read');
