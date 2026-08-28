-- Phase 1: Seed roles + permissions

INSERT INTO permissions (id, key, description) VALUES
  ('p_students_read', 'students.read', 'View students'),
  ('p_students_write', 'students.write', 'Create or edit students'),
  ('p_students_delete', 'students.delete', 'Soft delete students'),
  ('p_classes_read', 'classes.read', 'View classes and sections'),
  ('p_classes_write', 'classes.write', 'Manage classes and sections'),
  ('p_attendance_read', 'attendance.read', 'View attendance'),
  ('p_attendance_write', 'attendance.write', 'Mark attendance'),
  ('p_fees_read', 'fees.read', 'View fee structures, invoices, payments'),
  ('p_fees_collect', 'fees.collect', 'Collect fee payments'),
  ('p_fees_refund', 'fees.refund', 'Issue refunds / adjustments'),
  ('p_fees_write', 'fees.write', 'Manage fee structures'),
  ('p_dashboard_read', 'dashboard.read', 'View dashboard'),
  ('p_system_admin', 'system.admin', 'Full system access'),
  ('p_backup_manage', 'backup.manage', 'Run or restore backups'),
  ('p_audit_read', 'audit.read', 'View audit log');

INSERT INTO roles (id, name, description) VALUES
  ('r_admin', 'Admin', 'Full access'),
  ('r_principal', 'Principal', 'Read all + reports'),
  ('r_teacher', 'Teacher', 'Attendance + view assigned classes'),
  ('r_accountant', 'Accountant', 'Fees, invoices, payments, reports'),
  ('r_reception', 'Reception', 'Students + attendance + fees collection'),
  ('r_parent', 'Parent', 'Read-only on linked children');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_system_admin'),
  ('r_admin', 'p_backup_manage'),
  ('r_admin', 'p_audit_read'),
  ('r_admin', 'p_dashboard_read'),
  ('r_admin', 'p_students_read'),
  ('r_admin', 'p_students_write'),
  ('r_admin', 'p_students_delete'),
  ('r_admin', 'p_classes_read'),
  ('r_admin', 'p_classes_write'),
  ('r_admin', 'p_attendance_read'),
  ('r_admin', 'p_attendance_write'),
  ('r_admin', 'p_fees_read'),
  ('r_admin', 'p_fees_collect'),
  ('r_admin', 'p_fees_refund'),
  ('r_admin', 'p_fees_write'),
  ('r_principal', 'p_dashboard_read'),
  ('r_principal', 'p_students_read'),
  ('r_principal', 'p_classes_read'),
  ('r_principal', 'p_classes_write'),
  ('r_principal', 'p_attendance_read'),
  ('r_principal', 'p_fees_read'),
  ('r_principal', 'p_audit_read'),
  ('r_teacher', 'p_dashboard_read'),
  ('r_teacher', 'p_classes_read'),
  ('r_teacher', 'p_attendance_read'),
  ('r_teacher', 'p_attendance_write'),
  ('r_teacher', 'p_students_read'),
  ('r_accountant', 'p_dashboard_read'),
  ('r_accountant', 'p_students_read'),
  ('r_accountant', 'p_classes_read'),
  ('r_accountant', 'p_fees_read'),
  ('r_accountant', 'p_fees_collect'),
  ('r_accountant', 'p_fees_refund'),
  ('r_accountant', 'p_fees_write'),
  ('r_reception', 'p_dashboard_read'),
  ('r_reception', 'p_students_read'),
  ('r_reception', 'p_students_write'),
  ('r_reception', 'p_classes_read'),
  ('r_reception', 'p_attendance_read'),
  ('r_reception', 'p_attendance_write'),
  ('r_reception', 'p_fees_read'),
  ('r_reception', 'p_fees_collect'),
  ('r_parent', 'p_dashboard_read'),
  ('r_parent', 'p_students_read'),
  ('r_parent', 'p_attendance_read'),
  ('r_parent', 'p_fees_read');

-- Default system settings (school letterhead, etc.)
INSERT INTO settings (key, value) VALUES
  ('school.name', 'Greenwood Public School'),
  ('school.address', '123 Main Road, City'),
  ('school.phone', '+91 0000000000'),
  ('school.email', 'info@greenwood.example'),
  ('school.academic_year', '2025-2026'),
  ('currency.code', 'INR'),
  ('currency.symbol', '₹');

-- Built-in automations (enabled by default)
INSERT INTO automations (id, name, description, cron_expr, handler, is_enabled) VALUES
  ('a_backup_nightly', 'Nightly database backup', 'Copies school.db and zips school-data at 02:00 daily',
   '0 2 * * *', 'backup.run', 1),
  ('a_attendance_reminder', 'Attendance reminder', 'Sends outbox reminder at 07:30 weekdays',
   '30 7 * * 1-6', 'attendance.remind', 1),
  ('a_outbox_flush', 'Communication outbox flush', 'Processes queued messages every 5 minutes',
   '*/5 * * * *', 'outbox.flush', 1);