-- ============================================================================
-- Phase 2: Exams + Results + Report Cards
-- ============================================================================

CREATE TABLE IF NOT EXISTS exam_terms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  academic_year   TEXT NOT NULL,
  start_date      TEXT,
  end_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, academic_year)
);

CREATE TABLE IF NOT EXISTS exams (
  id              TEXT PRIMARY KEY,
  term_id         TEXT NOT NULL REFERENCES exam_terms(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date       TEXT,
  max_marks       REAL NOT NULL DEFAULT 100,
  passing_marks   REAL NOT NULL DEFAULT 35,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (term_id, class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exams_term ON exams(term_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);

CREATE TABLE IF NOT EXISTS grade_scales (
  id              TEXT PRIMARY KEY,
  min_percent     REAL NOT NULL,
  max_percent     REAL NOT NULL,
  grade           TEXT NOT NULL,
  gpa             REAL NOT NULL DEFAULT 0,
  description     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marks (
  id              TEXT PRIMARY KEY,
  exam_id         TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks_obtained  REAL,
  is_absent       INTEGER NOT NULL DEFAULT 0,
  remarks         TEXT,
  entered_by      TEXT REFERENCES users(id),
  entered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_marks_exam ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);

-- Default grade scale (CBSE-style)
INSERT OR IGNORE INTO grade_scales (id, min_percent, max_percent, grade, gpa, description) VALUES
  ('gs_a1', 90, 100, 'A1', 10, 'Outstanding'),
  ('gs_a2', 80, 89.99, 'A2', 9, 'Excellent'),
  ('gs_b1', 70, 79.99, 'B1', 8, 'Very Good'),
  ('gs_b2', 60, 69.99, 'B2', 7, 'Good'),
  ('gs_c1', 50, 59.99, 'C1', 6, 'Above Average'),
  ('gs_c2', 40, 49.99, 'C2', 5, 'Average'),
  ('gs_d', 33, 39.99, 'D', 4, 'Pass'),
  ('gs_e', 0, 32.99, 'E', 0, 'Needs Improvement');

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_exams_read', 'exams.read', 'View exam schedules and results'),
  ('p_exams_write', 'exams.write', 'Manage exams, marks, grade scales'),
  ('p_exams_delete', 'exams.delete', 'Remove exams and marks');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_exams_read'),
  ('r_admin', 'p_exams_write'),
  ('r_admin', 'p_exams_delete'),
  ('r_principal', 'p_exams_read'),
  ('r_principal', 'p_exams_write'),
  ('r_teacher', 'p_exams_read'),
  ('r_teacher', 'p_exams_write');
