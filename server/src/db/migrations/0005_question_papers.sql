-- ============================================================================
-- Phase 2: Question Papers
-- ============================================================================

CREATE TABLE question_bank (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'short', 'long', 'numerical')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  options_json TEXT,            -- JSON array for MCQ: ["A. ...", "B. ..."]
  correct_answer TEXT,
  marks INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_question_bank_subject ON question_bank(subject_id);
CREATE INDEX idx_question_bank_status ON question_bank(status);

CREATE TABLE question_papers (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_question_papers_subject ON question_papers(subject_id);

CREATE TABLE question_paper_items (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  marks_override INTEGER,
  UNIQUE (paper_id, question_id)
);

CREATE INDEX idx_paper_items_paper ON question_paper_items(paper_id);

INSERT INTO permissions (id, key, description) VALUES
  ('p_exams_read', 'exams.read', 'View question bank and papers'),
  ('p_exams_write', 'exams.write', 'Manage questions and papers');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_exams_read'),
  ('r_admin', 'p_exams_write'),
  ('r_principal', 'p_exams_read'),
  ('r_principal', 'p_exams_write'),
  ('r_teacher', 'p_exams_read'),
  ('r_teacher', 'p_exams_write');
