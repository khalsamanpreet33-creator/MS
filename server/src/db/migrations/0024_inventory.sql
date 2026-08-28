-- ============================================================================
-- Phase 4: Inventory (Items, Vendors, Stock Movements, Purchase Orders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  gstin           TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id              TEXT PRIMARY KEY,
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     TEXT REFERENCES inventory_categories(id) ON DELETE SET NULL,
  unit            TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs', 'box', 'kg', 'litre', 'meter', 'set', 'pack')),
  min_stock       REAL NOT NULL DEFAULT 0,
  current_stock   REAL NOT NULL DEFAULT 0,
  unit_cost       REAL NOT NULL DEFAULT 0,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_items_name ON inventory_items(name);

CREATE TABLE IF NOT EXISTS stock_movements (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust')),
  quantity        REAL NOT NULL,
  unit_cost       REAL,
  reference       TEXT,
  vendor_id       TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_movement_item ON stock_movements(item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              TEXT PRIMARY KEY,
  po_number       TEXT NOT NULL UNIQUE,
  vendor_id       TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'placed', 'partial', 'received', 'cancelled')),
  total_amount    REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  expected_date   TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              TEXT PRIMARY KEY,
  po_id           TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity        REAL NOT NULL,
  unit_cost       REAL NOT NULL,
  received_qty    REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_inventory_read', 'inventory.read', 'View inventory items, vendors, POs'),
  ('p_inventory_write', 'inventory.write', 'Manage items, stock movements, vendors, POs');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_inventory_read'),
  ('r_admin', 'p_inventory_write'),
  ('r_principal', 'p_inventory_read'),
  ('r_accountant', 'p_inventory_read'),
  ('r_accountant', 'p_inventory_write'),
  ('r_reception', 'p_inventory_read');

INSERT OR IGNORE INTO inventory_categories (id, name) VALUES
  ('ivc_stationery', 'Stationery'),
  ('ivc_cleaning', 'Cleaning'),
  ('ivc_electronics', 'Electronics'),
  ('ivc_sports', 'Sports');
