-- ============================================================================
-- Phase 4: Communication (Notice Board, Emergency, Notifications)
-- ============================================================================

-- Notice Board (pinned notices, audience-targeted)
CREATE TABLE IF NOT EXISTS notices (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('general', 'academic', 'event', 'holiday', 'urgent', 'sports', 'transport')),
  audience        TEXT NOT NULL DEFAULT 'all'
                  CHECK (audience IN ('all', 'students', 'parents', 'staff', 'teachers')),
  pinned          INTEGER NOT NULL DEFAULT 0,
  publish_date    TEXT NOT NULL DEFAULT (datetime('now')),
  expire_date     TEXT,
  status          TEXT NOT NULL DEFAULT 'published'
                  CHECK (status IN ('draft', 'published', 'archived')),
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notices_status ON notices(status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_notices_audience ON notices(audience, status);

-- Emergency Alerts (high-priority broadcasts)
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'high'
                  CHECK (severity IN ('info', 'warning', 'critical')),
  channels        TEXT NOT NULL DEFAULT 'inapp,sms,email,whatsapp',
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'resolved', 'cancelled')),
  created_by      TEXT REFERENCES users(id),
  resolved_at     TEXT,
  resolved_by     TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emerg_status ON emergency_alerts(status, created_at DESC);

-- In-App Notifications (per-user feed)
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'info'
                  CHECK (kind IN ('info', 'warning', 'success', 'alert', 'task', 'fee', 'attendance', 'exam')),
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,
  read_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read_at, created_at DESC);

-- Bulk Message Campaigns
CREATE TABLE IF NOT EXISTS bulk_campaigns (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  audience        TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'inapp')),
  subject         TEXT,
  body            TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'partial')),
  scheduled_at    TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at         TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON bulk_campaigns(status, created_at DESC);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_notices_read', 'notices.read', 'View notice board'),
  ('p_notices_write', 'notices.write', 'Create/edit notices'),
  ('p_emergency_read', 'emergency.read', 'View emergency alerts'),
  ('p_emergency_write', 'emergency.write', 'Trigger emergency alerts'),
  ('p_notifications_read', 'notifications.read', 'View in-app notifications'),
  ('p_bulkcomm_read', 'bulkcomm.read', 'View bulk communication campaigns'),
  ('p_bulkcomm_write', 'bulkcomm.write', 'Send bulk communications');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_notices_read'),
  ('r_admin', 'p_notices_write'),
  ('r_admin', 'p_emergency_read'),
  ('r_admin', 'p_emergency_write'),
  ('r_admin', 'p_notifications_read'),
  ('r_admin', 'p_bulkcomm_read'),
  ('r_admin', 'p_bulkcomm_write'),
  ('r_principal', 'p_notices_read'),
  ('r_principal', 'p_notices_write'),
  ('r_principal', 'p_emergency_read'),
  ('r_principal', 'p_emergency_write'),
  ('r_principal', 'p_notifications_read'),
  ('r_principal', 'p_bulkcomm_read'),
  ('r_principal', 'p_bulkcomm_write'),
  ('r_teacher', 'p_notices_read'),
  ('r_teacher', 'p_notifications_read'),
  ('r_reception', 'p_notices_read'),
  ('r_reception', 'p_notices_write'),
  ('r_reception', 'p_notifications_read'),
  ('r_reception', 'p_bulkcomm_read'),
  ('r_accountant', 'p_notices_read'),
  ('r_accountant', 'p_notifications_read');
