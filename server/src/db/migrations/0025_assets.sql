-- ============================================================================
-- Phase 4: Assets (Asset Register, Assignment, Depreciation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  depreciation_rate REAL NOT NULL DEFAULT 10, -- % per year
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id              TEXT PRIMARY KEY,
  asset_code      TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     TEXT REFERENCES asset_categories(id) ON DELETE SET NULL,
  vendor_id       TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_date   TEXT NOT NULL,
  purchase_cost   REAL NOT NULL DEFAULT 0,
  current_value   REAL NOT NULL DEFAULT 0,
  location        TEXT,
  assigned_to_type TEXT CHECK (assigned_to_type IN ('student', 'staff', 'department', 'room', NULL)),
  assigned_to_id   TEXT,
  assigned_to_name TEXT,
  assigned_at      TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'maintenance', 'retired', 'disposed', 'lost')),
  depreciation_rate REAL,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned ON assets(assigned_to_type, assigned_to_id);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id              TEXT PRIMARY KEY,
  asset_id        TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  assigned_to_type TEXT NOT NULL,
  assigned_to_id   TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL,
  assigned_at     TEXT NOT NULL DEFAULT (datetime('now')),
  returned_at     TEXT,
  returned_condition TEXT,
  assigned_by     TEXT REFERENCES users(id),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_aa_asset ON asset_assignments(asset_id, returned_at);

CREATE TABLE IF NOT EXISTS depreciation_log (
  id              TEXT PRIMARY KEY,
  asset_id        TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  amount          REAL NOT NULL,
  book_value_after REAL NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dep_asset ON depreciation_log(asset_id, period_year);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_assets_read', 'assets.read', 'View asset register'),
  ('p_assets_write', 'assets.write', 'Manage assets, assignments, depreciation');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_assets_read'),
  ('r_admin', 'p_assets_write'),
  ('r_principal', 'p_assets_read'),
  ('r_principal', 'p_assets_write'),
  ('r_accountant', 'p_assets_read'),
  ('r_accountant', 'p_assets_write');

INSERT OR IGNORE INTO asset_categories (id, name, depreciation_rate) VALUES
  ('ast_furniture', 'Furniture', 10),
  ('ast_computer', 'Computer / IT', 25),
  ('ast_vehicle', 'Vehicle', 15),
  ('ast_equipment', 'Lab Equipment', 15),
  ('ast_building', 'Building', 5);
