-- ============================================================================
-- Phase 2: Subjects & Syllabus
-- ============================================================================

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (class_id, code)
);

CREATE INDEX idx_subjects_class ON subjects(class_id);
CREATE INDEX idx_subjects_teacher ON subjects(teacher_id);

CREATE TABLE syllabus_topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  planned_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_syllabus_subject ON syllabus_topics(subject_id);
CREATE INDEX idx_syllabus_status ON syllabus_topics(status);

-- Phase 2 permissions
INSERT INTO permissions (id, key, description) VALUES
  ('p_academics_read', 'academics.read', 'View subjects and syllabus'),
  ('p_academics_write', 'academics.write', 'Manage subjects and syllabus');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_academics_read'),
  ('r_admin', 'p_academics_write'),
  ('r_principal', 'p_academics_read'),
  ('r_principal', 'p_academics_write'),
  ('r_teacher', 'p_academics_read'),
  ('r_teacher', 'p_academics_write'),
  ('r_accountant', 'p_academics_read'),
  ('r_reception', 'p_academics_read');
