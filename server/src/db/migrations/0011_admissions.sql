-- ============================================================================
-- Phase 2: Admissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS admissions_inquiries (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  parent_name          TEXT,
  phone                TEXT,
  email                TEXT,
  applying_for_class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  source               TEXT,
  status               TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'contacted', 'reviewing', 'accepted', 'rejected', 'waitlisted', 'enrolled')),
  notes                TEXT,
  converted_student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions_inquiries(status);

CREATE TABLE IF NOT EXISTS admissions_applications (
  id                TEXT PRIMARY KEY,
  inquiry_id        TEXT NOT NULL UNIQUE REFERENCES admissions_inquiries(id) ON DELETE CASCADE,
  dob               TEXT,
  gender            TEXT CHECK (gender IN ('male', 'female', 'other')),
  address           TEXT,
  previous_school   TEXT,
  documents_checklist TEXT,
  test_score        REAL,
  test_date         TEXT,
  interview_notes   TEXT,
  decision_date     TEXT,
  decision_by       TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_admissions_read', 'admissions.read', 'View admission inquiries and applications'),
  ('p_admissions_write', 'admissions.write', 'Manage inquiries and applications'),
  ('p_admissions_delete', 'admissions.delete', 'Remove admission records');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_admissions_read'),
  ('r_admin', 'p_admissions_write'),
  ('r_admin', 'p_admissions_delete'),
  ('r_principal', 'p_admissions_read'),
  ('r_principal', 'p_admissions_write'),
  ('r_reception', 'p_admissions_read'),
  ('r_reception', 'p_admissions_write');
