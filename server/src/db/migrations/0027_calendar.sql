-- ============================================================================
-- Phase 5: Central Calendar permission
-- ============================================================================

INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_calendar_read', 'calendar.read', 'View unified school calendar');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_calendar_read'),
  ('r_principal', 'p_calendar_read'),
  ('r_teacher', 'p_calendar_read'),
  ('r_reception', 'p_calendar_read'),
  ('r_accountant', 'p_calendar_read');
