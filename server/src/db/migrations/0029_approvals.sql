-- ============================================================================
-- Phase 5: Approval Centre (fee concession + refund)
-- Leave applications already exist from migration 0008_hr_leave.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_concessions (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  concession_type TEXT NOT NULL CHECK (concession_type IN ('percentage', 'fixed')),
  concession_value REAL NOT NULL,
  applies_to_fee_head_id TEXT,
  valid_from      TEXT NOT NULL,
  valid_to        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  approver_id     TEXT REFERENCES users(id),
  decision_at     TEXT,
  decision_notes  TEXT,
  requested_by    TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_concession_status ON fee_concessions(status);
CREATE INDEX IF NOT EXISTS idx_concession_student ON fee_concessions(student_id, status);

CREATE TABLE IF NOT EXISTS refunds (
  id              TEXT PRIMARY KEY,
  receipt_no      TEXT NOT NULL UNIQUE,
  student_id      TEXT NOT NULL REFERENCES students(id),
  payment_id      TEXT REFERENCES fee_payments(id),
  amount          REAL NOT NULL,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  approver_id     TEXT REFERENCES users(id),
  decision_at     TEXT,
  decision_notes  TEXT,
  processed_at    TEXT,
  requested_by    TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_student ON refunds(student_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_approvals_read', 'approvals.read', 'View approval queue'),
  ('p_approvals_write', 'approvals.write', 'Approve/reject leave, fee concession, refund requests');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_approvals_read'),
  ('r_admin', 'p_approvals_write'),
  ('r_principal', 'p_approvals_read'),
  ('r_principal', 'p_approvals_write'),
  ('r_teacher', 'p_approvals_read'),
  ('r_accountant', 'p_approvals_read'),
  ('r_accountant', 'p_approvals_write');
