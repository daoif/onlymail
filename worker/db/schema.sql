CREATE TABLE IF NOT EXISTS address (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    project TEXT NOT NULL,
    ttl_hours INTEGER NOT NULL DEFAULT 24,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_address_domain ON address(domain);
CREATE INDEX IF NOT EXISTS idx_address_project ON address(project);
CREATE INDEX IF NOT EXISTS idx_address_updated_at ON address(updated_at);

CREATE TABLE IF NOT EXISTS raw_mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    source TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    message_id TEXT,
    raw TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    html TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(address) REFERENCES address(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_raw_mails_address ON raw_mails(address);
CREATE INDEX IF NOT EXISTS idx_raw_mails_created_at ON raw_mails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id);

CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    root_name TEXT NOT NULL,
    is_root INTEGER NOT NULL DEFAULT 0,
    routing_enabled INTEGER NOT NULL DEFAULT 0,
    cf_zone_id TEXT NOT NULL,
    mx_record_ids TEXT NOT NULL DEFAULT '[]',
    txt_record_id TEXT,
    route_rule_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_domains_root_name ON domains(root_name);
CREATE INDEX IF NOT EXISTS idx_domains_is_root ON domains(is_root);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
