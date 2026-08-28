-- ============================================================================
-- Phase 2: Homework
-- ============================================================================

CREATE TABLE IF NOT EXISTS homework (
  id              TEXT PRIMARY KEY,
  class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id      TEXT REFERENCES sections(id) ON DELETE CASCADE,
  subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  assigned_date   TEXT NOT NULL,
  due_date        TEXT,
  attachments     TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_section ON homework(section_id);
CREATE INDEX IF NOT EXISTS idx_homework_due ON homework(due_date);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id              TEXT PRIMARY KEY,
  homework_id     TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted', 'late', 'reviewed')),
  submitted_at    TEXT,
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (homework_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_hw_subs_homework ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_subs_student ON homework_submissions(student_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_homework_read', 'homework.read', 'View homework'),
  ('p_homework_write', 'homework.write', 'Create or edit homework'),
  ('p_homework_delete', 'homework.delete', 'Remove homework');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_homework_read'),
  ('r_admin', 'p_homework_write'),
  ('r_admin', 'p_homework_delete'),
  ('r_principal', 'p_homework_read'),
  ('r_principal', 'p_homework_write'),
  ('r_teacher', 'p_homework_read'),
  ('r_teacher', 'p_homework_write');
