CREATE TABLE IF NOT EXISTS pantagon_financial_accounts (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, display_order INTEGER DEFAULT 0,
  icon_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), user_id TEXT);
CREATE TABLE IF NOT EXISTS pantagon_financial_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_name TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL,
  date TEXT NOT NULL, note TEXT, tag TEXT, created_at TEXT DEFAULT (datetime('now')), user_id TEXT);
CREATE INDEX IF NOT EXISTS idx_tx_account ON pantagon_financial_transactions(account_name, date);
CREATE TABLE IF NOT EXISTS pantagon_financial_fx (
  id INTEGER PRIMARY KEY AUTOINCREMENT, foreign_amount REAL, thb_amount REAL, exchange_rate REAL,
  transaction_at TEXT, from_currency TEXT, to_currency TEXT, created_at TEXT DEFAULT (datetime('now')), user_id TEXT);
CREATE TABLE IF NOT EXISTS pantagon_financial_fcd (
  id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, date TEXT, usd REAL, thb REAL, rate REAL, note TEXT,
  created_at TEXT DEFAULT (datetime('now')), tx_type TEXT, user_id TEXT);
CREATE TABLE IF NOT EXISTS pantagon_financial_salary_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT, total_amount REAL, allocations TEXT, date TEXT,
  created_at TEXT DEFAULT (datetime('now')), user_id TEXT);
CREATE TABLE IF NOT EXISTS dime_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT, trade_date TEXT, side TEXT, symbol TEXT, market TEXT,
  qty REAL, price REAL, currency TEXT, gross_usd REAL, fee_usd REAL, wht_usd REAL, net_usd REAL,
  gross_thb REAL, fee_thb REAL, wht_thb REAL, net_thb REAL, source TEXT, created_at TEXT DEFAULT (datetime('now')),
  qty_unit TEXT, asset_class TEXT);
CREATE INDEX IF NOT EXISTS idx_dime_symbol ON dime_trades(asset_class, symbol);
CREATE TABLE IF NOT EXISTS dime_gold (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT, trade_date TEXT, side TEXT, symbol TEXT, vendor TEXT, channel TEXT,
  qty REAL, qty_unit TEXT, price REAL, currency TEXT, gross_usd REAL, fee_usd REAL, wht_usd REAL, net_usd REAL,
  gross_thb REAL, fee_thb REAL, wht_thb REAL, net_thb REAL, source TEXT, created_at TEXT DEFAULT (datetime('now')));
