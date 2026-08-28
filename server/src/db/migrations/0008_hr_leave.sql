-- ============================================================================
-- Phase 3: HR & Leave
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  days_per_year   REAL NOT NULL DEFAULT 0,
  color           TEXT NOT NULL DEFAULT '#3b82f6',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_balances (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id   TEXT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  total_days      REAL NOT NULL DEFAULT 0,
  used_days       REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id   TEXT NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  from_date       TEXT NOT NULL,
  to_date         TEXT NOT NULL,
  days            REAL NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id     TEXT REFERENCES users(id),
  decision_at     TEXT,
  decision_notes  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leave_app_user ON leave_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_app_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_app_dates ON leave_applications(from_date, to_date);

CREATE TABLE IF NOT EXISTS holidays (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'public'
              CHECK (type IN ('public', 'school', 'optional')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_hr_read', 'hr.read', 'View HR & leave data'),
  ('p_hr_write', 'hr.write', 'Manage leave types, holidays, balances'),
  ('p_hr_delete', 'hr.delete', 'Remove HR records'),
  ('p_hr_approve', 'hr.approve', 'Approve or reject leave applications'),
  ('p_leave_apply', 'leave.apply', 'Apply for leave');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_hr_read'),
  ('r_admin', 'p_hr_write'),
  ('r_admin', 'p_hr_delete'),
  ('r_admin', 'p_hr_approve'),
  ('r_admin', 'p_leave_apply'),
  ('r_principal', 'p_hr_read'),
  ('r_principal', 'p_hr_write'),
  ('r_principal', 'p_hr_approve'),
  ('r_principal', 'p_leave_apply'),
  ('r_teacher', 'p_leave_apply'),
  ('r_reception', 'p_leave_apply');

-- Default leave types
INSERT OR IGNORE INTO leave_types (id, code, name, days_per_year, color) VALUES
  ('lt_cl', 'CL', 'Casual Leave', 12, '#3b82f6'),
  ('lt_sl', 'SL', 'Sick Leave', 10, '#ef4444'),
  ('lt_el', 'EL', 'Earned Leave', 15, '#10b981'),
  ('lt_lop', 'LOP', 'Leave Without Pay', 0, '#6b7280');
