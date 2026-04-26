ALTER TABLE domains ADD COLUMN subdomain_type TEXT NOT NULL DEFAULT 'permanent';

UPDATE domains
SET subdomain_type = 'root'
WHERE is_root = 1;

INSERT INTO settings (key, value, created_at, updated_at)
VALUES (
  'subdomain_rotation_limit',
  '5',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_domains_subdomain_type ON domains(subdomain_type);
CREATE INDEX IF NOT EXISTS idx_domains_root_type_created_at ON domains(root_name, subdomain_type, created_at);
