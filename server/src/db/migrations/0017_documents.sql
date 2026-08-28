-- ============================================================================
-- Phase 4: Documents (per-student/per-staff record store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  document_type   TEXT NOT NULL,
  related_to      TEXT NOT NULL CHECK (related_to IN ('student', 'staff', 'general')),
  related_id      TEXT,
  file_path       TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       TEXT,
  expiry_date     TEXT,
  notes           TEXT,
  uploaded_by     TEXT REFERENCES users(id),
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_related ON documents(related_to, related_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_documents_read', 'documents.read', 'View documents'),
  ('p_documents_write', 'documents.write', 'Upload and edit documents'),
  ('p_documents_delete', 'documents.delete', 'Remove documents');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_documents_read'),
  ('r_admin', 'p_documents_write'),
  ('r_admin', 'p_documents_delete'),
  ('r_principal', 'p_documents_read'),
  ('r_principal', 'p_documents_write'),
  ('r_reception', 'p_documents_read'),
  ('r_reception', 'p_documents_write');