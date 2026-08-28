-- ============================================================================
-- Phase 2: Results & Report Cards
-- ============================================================================

INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_results_read', 'results.read', 'View marksheets and report cards'),
  ('p_results_write', 'results.write', 'Enter/update student marks');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_results_read'),
  ('r_admin', 'p_results_write'),
  ('r_principal', 'p_results_read'),
  ('r_principal', 'p_results_write'),
  ('r_teacher', 'p_results_read'),
  ('r_teacher', 'p_results_write'),
  ('r_reception', 'p_results_read'),
  ('r_accountant', 'p_results_read');

-- Default grade scale (A+/A/B/C/D/F) if not already seeded by 0001_init
INSERT OR IGNORE INTO grade_scales (id, min_percent, max_percent, grade, gpa, description) VALUES
  ('gr_a_plus', 90, 100, 'A+', 4.0, 'Outstanding'),
  ('gr_a',      80, 89.99, 'A',  3.6, 'Excellent'),
  ('gr_b_plus', 70, 79.99, 'B+', 3.2, 'Very Good'),
  ('gr_b',      60, 69.99, 'B',  2.8, 'Good'),
  ('gr_c',      50, 59.99, 'C',  2.4, 'Above Average'),
  ('gr_d',      40, 49.99, 'D',  2.0, 'Average'),
  ('gr_e',      33, 39.99, 'E',  1.6, 'Pass'),
  ('gr_f',       0, 32.99, 'F',  0.0, 'Fail');
