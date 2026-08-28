-- ============================================================================
-- Phase 2: Parents portal
-- ============================================================================

CREATE TABLE IF NOT EXISTS parent_profiles (
  id          TEXT PRIMARY KEY,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  occupation  TEXT,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_profiles_status ON parent_profiles(status);

CREATE TABLE IF NOT EXISTS parent_student_links (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL DEFAULT 'guardian'
              CHECK (relation IN ('father', 'mother', 'guardian', 'other')),
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (parent_id, student_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(student_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_parents_read', 'parents.read', 'View parent directory'),
  ('p_parents_write', 'parents.write', 'Manage parents and student links'),
  ('p_parents_delete', 'parents.delete', 'Remove parent records');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_parents_read'),
  ('r_admin', 'p_parents_write'),
  ('r_admin', 'p_parents_delete'),
  ('r_principal', 'p_parents_read'),
  ('r_principal', 'p_parents_write'),
  ('r_reception', 'p_parents_read'),
  ('r_reception', 'p_parents_write');
