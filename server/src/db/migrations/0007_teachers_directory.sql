-- ============================================================================
-- Phase 3: Teachers directory
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_code  TEXT UNIQUE,
  qualification  TEXT,
  joining_date   TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_status ON teacher_profiles(status);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_teachers_read', 'teachers.read', 'View teachers directory'),
  ('p_teachers_write', 'teachers.write', 'Create or edit teacher profiles'),
  ('p_teachers_delete', 'teachers.delete', 'Deactivate teacher profiles');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_teachers_read'),
  ('r_admin', 'p_teachers_write'),
  ('r_admin', 'p_teachers_delete'),
  ('r_principal', 'p_teachers_read'),
  ('r_principal', 'p_teachers_write');
