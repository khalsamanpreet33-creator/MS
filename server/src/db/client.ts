import Database from 'better-sqlite3';
import { config } from '../config.js';

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) {
    _db = new Database(config.dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');
    _db.pragma('synchronous = NORMAL');
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}