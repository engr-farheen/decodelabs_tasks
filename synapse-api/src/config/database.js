// ============================================================
// Database connection + schema.
//
// Uses better-sqlite3: a synchronous, file-based SQLite driver.
// No separate database server to install/host — the whole
// database lives in a single portable .sqlite file, which makes
// this API trivially deployable anywhere Node.js runs.
// ============================================================

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(__dirname, '..', '..', 'synapse.sqlite');

const db = new Database(DB_PATH);

// Pragmas: enforce referential integrity, and use WAL mode for
// better concurrent read/write performance under real traffic.
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS links (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code          TEXT NOT NULL UNIQUE,
    original_url  TEXT NOT NULL,
    is_active     INTEGER NOT NULL DEFAULT 1,
    click_count   INTEGER NOT NULL DEFAULT 0,
    expires_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS link_clicks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id     INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at  TEXT NOT NULL DEFAULT (datetime('now')),
    referrer    TEXT,
    user_agent  TEXT,
    ip_hash     TEXT,
    country     TEXT,
    device      TEXT,
    browser     TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
  CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
`);

module.exports = db;
