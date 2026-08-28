-- ============================================================================
-- Phase 3: Payroll
-- ============================================================================

CREATE TABLE IF NOT EXISTS salary_structures (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  basic           REAL NOT NULL DEFAULT 0,
  hra             REAL NOT NULL DEFAULT 0,
  transport       REAL NOT NULL DEFAULT 0,
  other_allowances REAL NOT NULL DEFAULT 0,
  pf_deduction    REAL NOT NULL DEFAULT 0,
  tax_deduction   REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  effective_from  TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id              TEXT PRIMARY KEY,
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'paid')),
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by    TEXT REFERENCES users(id),
  approved_at     TEXT,
  approved_by     TEXT REFERENCES users(id),
  paid_at         TEXT,
  notes           TEXT,
  UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS payslips (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  basic           REAL NOT NULL DEFAULT 0,
  hra             REAL NOT NULL DEFAULT 0,
  transport       REAL NOT NULL DEFAULT 0,
  other_allowances REAL NOT NULL DEFAULT 0,
  pf_deduction    REAL NOT NULL DEFAULT 0,
  tax_deduction   REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  gross           REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  net             REAL NOT NULL DEFAULT 0,
  UNIQUE (run_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user ON payslips(user_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_payroll_read', 'payroll.read', 'View payroll data'),
  ('p_payroll_write', 'payroll.write', 'Manage salary structures and payroll runs'),
  ('p_payroll_approve', 'payroll.approve', 'Approve and pay out payroll runs');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_payroll_read'),
  ('r_admin', 'p_payroll_write'),
  ('r_admin', 'p_payroll_approve'),
  ('r_principal', 'p_payroll_read'),
  ('r_accountant', 'p_payroll_read'),
  ('r_accountant', 'p_payroll_write'),
  ('r_accountant', 'p_payroll_approve');
