-- Canonical Money Manager SQLite Schema (Whole-Taka Integer Rounding — NO Paisa/Cents)
-- All monetary columns (amount, balance, principal, budget_monthly_allocated, etc.)
-- MUST store rounded whole-Taka integers (`Math.round(amount)` / `roundTaka()`).

PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  external_uid TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mfs', 'credit_card', 'asset', 'liability')),
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  account_number TEXT,
  credit_limit INTEGER,
  billing_day INTEGER,
  due_day INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  external_uid TEXT,
  name TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  subcategories_json TEXT NOT NULL DEFAULT '[]',
  budget_monthly_allocated INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  external_uid TEXT,
  fingerprint TEXT,
  sync_source TEXT NOT NULL DEFAULT 'local',
  date TEXT NOT NULL,
  time TEXT,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  account_id TEXT NOT NULL,
  target_account_id TEXT,
  note TEXT,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'BDT',
  original_amount REAL,
  exchange_rate REAL,
  receipt_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_external_uid ON transactions(external_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

CREATE TABLE IF NOT EXISTS sanchaypatra_schemes (
  id TEXT PRIMARY KEY,
  scheme_def_id TEXT,
  name TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  principal INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  maturity_date TEXT NOT NULL,
  tenure_years INTEGER NOT NULL,
  payout_frequency_months INTEGER NOT NULL,
  slab_gross_rate REAL NOT NULL,
  ait_rate REAL NOT NULL,
  net_periodic_profit INTEGER NOT NULL,
  linked_account_id TEXT NOT NULL,
  next_payout_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS fdr_dps_accounts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('fdr', 'dps')),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL DEFAULT '',
  principal INTEGER NOT NULL DEFAULT 0,
  monthly_installment INTEGER NOT NULL DEFAULT 0,
  annual_rate REAL NOT NULL,
  ait_rate REAL NOT NULL DEFAULT 0.10,
  tenure_months INTEGER NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  maturity_date TEXT NOT NULL,
  expected_maturity_amount INTEGER NOT NULL DEFAULT 0,
  linked_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  target_account_id TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'weekly')),
  next_due_date TEXT NOT NULL,
  auto_post INTEGER NOT NULL DEFAULT 1,
  note TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  match_mode TEXT NOT NULL DEFAULT 'ANY',
  conditions_json TEXT NOT NULL,
  actions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL,
  current_amount INTEGER NOT NULL DEFAULT 0,
  target_date TEXT NOT NULL,
  linked_account_id TEXT NOT NULL,
  color TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS iou_records (
  id TEXT PRIMARY KEY,
  person_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  principal INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  due_date TEXT,
  account_id TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_card_emis (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  tenure_months INTEGER NOT NULL,
  paid_months INTEGER NOT NULL DEFAULT 0,
  monthly_installment INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  merged_accounts INTEGER NOT NULL DEFAULT 0,
  merged_categories INTEGER NOT NULL DEFAULT 0,
  wal_verified INTEGER NOT NULL DEFAULT 1,
  scope_label TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS outbound_sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  synced_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
