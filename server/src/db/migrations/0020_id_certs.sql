-- ============================================================================
-- Phase 4: ID Cards & Certificates
-- ============================================================================

CREATE TABLE IF NOT EXISTS id_card_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  audience        TEXT NOT NULL CHECK (audience IN ('student', 'staff')),
  template_html   TEXT NOT NULL,
  width_mm        INTEGER NOT NULL DEFAULT 54,
  height_mm       INTEGER NOT NULL DEFAULT 86,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificate_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  certificate_type TEXT NOT NULL CHECK (certificate_type IN ('bonafide', 'transfer', 'character', 'achievement', 'completion', 'custom')),
  template_html   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generated_certificates (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL REFERENCES certificate_templates(id) ON DELETE RESTRICT,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_to_name  TEXT NOT NULL,
  issued_to_id    TEXT,
  issued_date     TEXT NOT NULL,
  details         TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gencerts_template ON generated_certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_gencerts_issued_to ON generated_certificates(issued_to_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_idcards_read', 'idcards.read', 'View ID card templates'),
  ('p_idcards_write', 'idcards.write', 'Manage ID card templates'),
  ('p_certificates_read', 'certificates.read', 'View certificate templates and issued certificates'),
  ('p_certificates_write', 'certificates.write', 'Manage templates and issue certificates');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_idcards_read'),
  ('r_admin', 'p_idcards_write'),
  ('r_admin', 'p_certificates_read'),
  ('r_admin', 'p_certificates_write'),
  ('r_principal', 'p_idcards_read'),
  ('r_principal', 'p_idcards_write'),
  ('r_principal', 'p_certificates_read'),
  ('r_principal', 'p_certificates_write'),
  ('r_reception', 'p_idcards_read'),
  ('r_reception', 'p_certificates_read'),
  ('r_reception', 'p_certificates_write');