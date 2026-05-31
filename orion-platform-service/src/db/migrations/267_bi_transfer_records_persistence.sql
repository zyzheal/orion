-- BI transfer records for ticket analytics
CREATE TABLE IF NOT EXISTS bi_transfer_records (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  ticket_id VARCHAR(64) NOT NULL,
  from_engineer VARCHAR(64) NOT NULL,
  to_engineer VARCHAR(64) NOT NULL,
  reason TEXT,
  transferred_at TIMESTAMP NOT NULL,
  hold_time_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_transfer_records_tenant_id ON bi_transfer_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bi_transfer_records_ticket_id ON bi_transfer_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_bi_transfer_records_from_engineer ON bi_transfer_records(from_engineer);
CREATE INDEX IF NOT EXISTS idx_bi_transfer_records_to_engineer ON bi_transfer_records(to_engineer);
CREATE INDEX IF NOT EXISTS idx_bi_transfer_records_transferred_at ON bi_transfer_records(transferred_at);
