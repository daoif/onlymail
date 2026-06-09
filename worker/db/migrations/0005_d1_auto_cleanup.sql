CREATE INDEX IF NOT EXISTS idx_address_ttl_updated_id ON address(ttl_hours, updated_at DESC, id DESC);
