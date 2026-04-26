INSERT INTO settings (key, value, created_at, updated_at)
VALUES (
  'subdomain_dns_mode',
  'compatible',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(key) DO NOTHING;
