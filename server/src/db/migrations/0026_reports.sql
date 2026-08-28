-- ============================================================================
-- Phase 4: Reports permissions
-- ============================================================================

INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_reports_read', 'reports.read', 'View reports and dashboards');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_reports_read'),
  ('r_principal', 'p_reports_read'),
  ('r_accountant', 'p_reports_read'),
  ('r_teacher', 'p_reports_read'),
  ('r_reception', 'p_reports_read');
