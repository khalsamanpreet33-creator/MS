-- ============================================================================
-- Phase 3: Accounts (double-entry bookkeeping)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  parent_id       TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at       TEXT,
  closed_by       TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (start_date, end_date)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id              TEXT PRIMARY KEY,
  entry_number    TEXT NOT NULL UNIQUE,
  entry_date      TEXT NOT NULL,
  period_id       TEXT REFERENCES accounting_periods(id),
  narration       TEXT NOT NULL,
  reference       TEXT,
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  reversed_by     TEXT REFERENCES journal_entries(id),
  source          TEXT,
  source_id       TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_period ON journal_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit           REAL NOT NULL DEFAULT 0,
  credit          REAL NOT NULL DEFAULT 0,
  narration       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);

-- Default chart of accounts
INSERT OR IGNORE INTO accounts (id, code, name, type) VALUES
  ('acc_1000', '1000', 'Cash', 'asset'),
  ('acc_1010', '1010', 'Bank', 'asset'),
  ('acc_1100', '1100', 'Accounts Receivable (Fees)', 'asset'),
  ('acc_1200', '1200', 'Inventory', 'asset'),
  ('acc_1500', '1500', 'Fixed Assets', 'asset'),
  ('acc_2000', '2000', 'Accounts Payable', 'liability'),
  ('acc_2100', '2100', 'Salary Payable', 'liability'),
  ('acc_2200', '2200', 'Statutory Dues Payable', 'liability'),
  ('acc_3000', '3000', 'Owner Equity', 'equity'),
  ('acc_3100', '3100', 'Retained Earnings', 'equity'),
  ('acc_4000', '4000', 'Fee Income', 'income'),
  ('acc_4100', '4100', 'Other Income', 'income'),
  ('acc_5000', '5000', 'Salary Expense', 'expense'),
  ('acc_5100', '5100', 'Rent Expense', 'expense'),
  ('acc_5200', '5200', 'Utilities Expense', 'expense'),
  ('acc_5300', '5300', 'Supplies Expense', 'expense'),
  ('acc_5400', '5400', 'Maintenance Expense', 'expense'),
  ('acc_9000', '9000', 'Bank Charges', 'expense');

-- Current accounting period
INSERT OR IGNORE INTO accounting_periods (id, name, start_date, end_date, status)
VALUES ('per_current', 'FY 2025-2026', '2025-04-01', '2026-03-31', 'open');

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_accounts_read', 'accounts.read', 'View accounts, journal entries, reports'),
  ('p_accounts_write', 'accounts.write', 'Create accounts and post journal entries'),
  ('p_accounts_delete', 'accounts.delete', 'Reverse or remove journal entries'),
  ('p_accounts_close', 'accounts.close', 'Close accounting periods');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_accounts_read'),
  ('r_admin', 'p_accounts_write'),
  ('r_admin', 'p_accounts_delete'),
  ('r_admin', 'p_accounts_close'),
  ('r_principal', 'p_accounts_read'),
  ('r_principal', 'p_accounts_close'),
  ('r_accountant', 'p_accounts_read'),
  ('r_accountant', 'p_accounts_write'),
  ('r_accountant', 'p_accounts_delete');