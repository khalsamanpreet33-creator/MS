-- ============================================================================
-- Phase 4: Tasks & Follow-ups
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  assignee_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by      TEXT NOT NULL REFERENCES users(id),
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  due_date        TEXT,
  completed_at    TEXT,
  related_to      TEXT,
  related_id      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_tasks_read', 'tasks.read', 'View tasks'),
  ('p_tasks_write', 'tasks.write', 'Create or update tasks'),
  ('p_tasks_delete', 'tasks.delete', 'Remove tasks');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_tasks_read'),
  ('r_admin', 'p_tasks_write'),
  ('r_admin', 'p_tasks_delete'),
  ('r_principal', 'p_tasks_read'),
  ('r_principal', 'p_tasks_write'),
  ('r_principal', 'p_tasks_delete'),
  ('r_teacher', 'p_tasks_read'),
  ('r_teacher', 'p_tasks_write'),
  ('r_accountant', 'p_tasks_read'),
  ('r_accountant', 'p_tasks_write'),
  ('r_reception', 'p_tasks_read'),
  ('r_reception', 'p_tasks_write');