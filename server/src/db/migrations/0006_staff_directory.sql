-- Phase 3: Staff directory

CREATE TABLE IF NOT EXISTS staff (
  id              TEXT PRIMARY KEY,
  employee_code   TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  department      TEXT,
  designation     TEXT,
  email           TEXT,
  phone           TEXT,
  joining_date    TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);

CREATE TABLE IF NOT EXISTS staff_documents (
  id              TEXT PRIMARY KEY,
  staff_id        TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL,
  title           TEXT NOT NULL,
  file_path       TEXT,
  notes           TEXT,
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_docs_staff ON staff_documents(staff_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_staff_read', 'staff.read', 'View staff directory and profiles'),
  ('p_staff_write', 'staff.write', 'Create or edit staff profiles'),
  ('p_staff_delete', 'staff.delete', 'Soft delete staff');

-- Admin gets all
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_staff_read'),
  ('r_admin', 'p_staff_write'),
  ('r_admin', 'p_staff_delete');

-- Principal + reception get read
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_principal', 'p_staff_read'),
  ('r_reception', 'p_staff_read');