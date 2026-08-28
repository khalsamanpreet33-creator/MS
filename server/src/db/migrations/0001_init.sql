-- Phase 1: Core School ERP schema
-- Centralized single-DB design. Soft deletes via `status` columns.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- Auth & RBAC
-- ============================================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- Academics: Classes & Sections
-- ============================================================================
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  class_teacher_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, academic_year)
);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 40,
  class_teacher_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (class_id, name)
);

-- ============================================================================
-- Students
-- ============================================================================
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  admission_no TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  blood_group TEXT,
  address TEXT,
  photo_url TEXT,
  guardian_name TEXT,
  guardian_relation TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  emergency_contact TEXT,
  joining_date TEXT NOT NULL DEFAULT (date('now')),
  current_class_id TEXT REFERENCES classes(id),
  current_section_id TEXT REFERENCES sections(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_students_class ON students(current_class_id, current_section_id);
CREATE INDEX idx_students_status ON students(status);

CREATE TABLE student_class_history (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  academic_year TEXT NOT NULL,
  roll_no TEXT,
  result TEXT,
  action TEXT NOT NULL DEFAULT 'promote', -- promote | hold | transfer | repeat
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_student_history_student ON student_class_history(student_id);

-- ============================================================================
-- Attendance
-- ============================================================================
CREATE TABLE attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  section_id TEXT NOT NULL REFERENCES sections(id),
  date TEXT NOT NULL,
  taken_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (section_id, date)
);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave')),
  remarks TEXT,
  marked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, student_id)
);

CREATE INDEX idx_attendance_records_student ON attendance_records(student_id);

-- ============================================================================
-- Fees
-- ============================================================================
CREATE TABLE fee_structures (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'one_time')),
  due_day_of_month INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fee_invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id),
  structure_id TEXT REFERENCES fee_structures(id),
  period_label TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  fine REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paid REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoices_student ON fee_invoices(student_id);
CREATE INDEX idx_invoices_status ON fee_invoices(status);

CREATE TABLE fee_payments (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id),
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank', 'cheque', 'card')),
  reference TEXT,
  notes TEXT,
  collected_by TEXT REFERENCES users(id),
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fee_payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL
);

-- ============================================================================
-- Automation
-- ============================================================================
CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cron_expr TEXT NOT NULL,
  handler TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  details TEXT,
  error TEXT
);

-- ============================================================================
-- Communication Outbox
-- ============================================================================
CREATE TABLE communication_outbox (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'inapp')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  provider TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outbox_status ON communication_outbox(status, scheduled_at);

-- ============================================================================
-- System Events, Audit, Settings
-- ============================================================================
CREATE TABLE system_events (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_created ON system_events(created_at DESC);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  payload_hash TEXT,
  ip TEXT,
  status INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);