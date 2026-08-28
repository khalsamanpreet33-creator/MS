-- ============================================================================
-- Phase 4: Events & Calendar
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('academic', 'sports', 'cultural', 'holiday', 'meeting', 'general')),
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  start_time      TEXT,
  end_time        TEXT,
  location        TEXT,
  audience        TEXT NOT NULL DEFAULT 'all'
                  CHECK (audience IN ('all', 'students', 'staff', 'parents')),
  is_holiday      INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response        TEXT NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  responded_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_events_read', 'events.read', 'View events'),
  ('p_events_write', 'events.write', 'Create or edit events'),
  ('p_events_delete', 'events.delete', 'Remove events');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_events_read'),
  ('r_admin', 'p_events_write'),
  ('r_admin', 'p_events_delete'),
  ('r_principal', 'p_events_read'),
  ('r_principal', 'p_events_write'),
  ('r_principal', 'p_events_delete'),
  ('r_teacher', 'p_events_read'),
  ('r_accountant', 'p_events_read'),
  ('r_reception', 'p_events_read');