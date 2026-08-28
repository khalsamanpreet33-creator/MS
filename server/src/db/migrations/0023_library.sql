-- ============================================================================
-- Phase 4: Library (Books, Issues, Returns, Fines)
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  code            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id              TEXT PRIMARY KEY,
  accession_no    TEXT NOT NULL UNIQUE,
  isbn            TEXT,
  title           TEXT NOT NULL,
  author          TEXT NOT NULL,
  publisher       TEXT,
  category_id     TEXT REFERENCES book_categories(id) ON DELETE SET NULL,
  total_copies    INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  shelf_location  TEXT,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'archived', 'lost')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);

CREATE TABLE IF NOT EXISTS book_issues (
  id              TEXT PRIMARY KEY,
  book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  borrower_type   TEXT NOT NULL CHECK (borrower_type IN ('student', 'staff')),
  borrower_id     TEXT NOT NULL,
  borrower_name   TEXT NOT NULL,
  issued_by       TEXT REFERENCES users(id),
  issued_at       TEXT NOT NULL DEFAULT (datetime('now')),
  due_at          TEXT NOT NULL,
  returned_at     TEXT,
  returned_to     TEXT REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued', 'returned', 'overdue', 'lost')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_issues_book ON book_issues(book_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_borrower ON book_issues(borrower_id, borrower_type, status);
CREATE INDEX IF NOT EXISTS idx_issues_due ON book_issues(due_at) WHERE status = 'issued';

CREATE TABLE IF NOT EXISTS book_fines (
  id              TEXT PRIMARY KEY,
  issue_id        TEXT NOT NULL REFERENCES book_issues(id) ON DELETE CASCADE,
  amount          REAL NOT NULL,
  reason          TEXT NOT NULL DEFAULT 'overdue',
  paid            INTEGER NOT NULL DEFAULT 0,
  paid_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fines_issue ON book_fines(issue_id);

-- Permissions
INSERT OR IGNORE INTO permissions (id, key, description) VALUES
  ('p_library_read', 'library.read', 'View books and issues'),
  ('p_library_write', 'library.write', 'Manage books, categories, issues, returns, fines');

-- Role grants
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('r_admin', 'p_library_read'),
  ('r_admin', 'p_library_write'),
  ('r_principal', 'p_library_read'),
  ('r_principal', 'p_library_write'),
  ('r_teacher', 'p_library_read'),
  ('r_reception', 'p_library_read'),
  ('r_reception', 'p_library_write');

-- Default categories
INSERT OR IGNORE INTO book_categories (id, name, code) VALUES
  ('bct_fiction', 'Fiction', 'FIC'),
  ('bct_nonfiction', 'Non-Fiction', 'NF'),
  ('bct_reference', 'Reference', 'REF'),
  ('bct_textbook', 'Textbook', 'TB'),
  ('bct_periodical', 'Periodical', 'PER');
