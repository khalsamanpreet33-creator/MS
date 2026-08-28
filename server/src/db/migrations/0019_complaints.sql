-- ============================================================================
-- Phase 4: Complaints & Approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints (
  id              TEXT PRIMARY KEY,
  ticket_number   TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('general', 'academic', 'transport', 'facility', 'staff', 'safety', 'other')),
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'rejected')),
  raised_by       TEXT NOT NULL REFERENCES users(id),
  assigned_to     TEXT REFERENCES users(id),
  related_to      TEXT,
  related_id      TEXT,
  resolution      TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_complaints_raised ON complaints(raised_by);

CREATE TABLE IF NOT EXISTS complaint_comments (
  id              TEXT PRIMARY KEY,
  complaint_id    TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id),
  message         TEXT NOT NULL,
  is_internal     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_complaint ON complaint_comments(complaint_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_complaints_read', 'complaints.read', 'View complaints'),
  ('p_complaints_write', 'complaints.write', 'Create or update complaints'),
  ('p_complaints_delete', 'complaints.delete', 'Remove complaints');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_complaints_read'),
  ('r_admin', 'p_complaints_write'),
  ('r_admin', 'p_complaints_delete'),
  ('r_principal', 'p_complaints_read'),
  ('r_principal', 'p_complaints_write'),
  ('r_principal', 'p_complaints_delete'),
  ('r_teacher', 'p_complaints_read'),
  ('r_teacher', 'p_complaints_write'),
  ('r_reception', 'p_complaints_read'),
  ('r_reception', 'p_complaints_write');