-- ============================================================================
-- Phase 2: Timetable
-- ============================================================================

CREATE TABLE IF NOT EXISTS timetable_periods (
  id              TEXT PRIMARY KEY,
  class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id      TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number   INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  room            TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (section_id, day_of_week, period_number)
);

CREATE INDEX IF NOT EXISTS idx_tt_section ON timetable_periods(section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tt_teacher ON timetable_periods(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tt_subject ON timetable_periods(subject_id);

CREATE TABLE IF NOT EXISTS timetable_substitutions (
  id                      TEXT PRIMARY KEY,
  period_id               TEXT NOT NULL REFERENCES timetable_periods(id) ON DELETE CASCADE,
  original_teacher_id     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  substitute_teacher_id   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  substitution_date       TEXT NOT NULL,
  reason                  TEXT,
  created_by              TEXT REFERENCES users(id),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (period_id, substitution_date)
);

CREATE INDEX IF NOT EXISTS idx_tts_period ON timetable_substitutions(period_id);
CREATE INDEX IF NOT EXISTS idx_tts_substitute ON timetable_substitutions(substitute_teacher_id, substitution_date);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_timetable_read', 'timetable.read', 'View timetable'),
  ('p_timetable_write', 'timetable.write', 'Create or edit timetable entries'),
  ('p_timetable_delete', 'timetable.delete', 'Remove timetable entries');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_timetable_read'),
  ('r_admin', 'p_timetable_write'),
  ('r_admin', 'p_timetable_delete'),
  ('r_principal', 'p_timetable_read'),
  ('r_principal', 'p_timetable_write'),
  ('r_principal', 'p_timetable_delete'),
  ('r_teacher', 'p_timetable_read');