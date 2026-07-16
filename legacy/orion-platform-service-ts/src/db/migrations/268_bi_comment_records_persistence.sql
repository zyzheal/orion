-- BI comment records for collaboration analytics
CREATE TABLE IF NOT EXISTS bi_comment_records (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ticket_id VARCHAR(64) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_comment_records_tenant_id ON bi_comment_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bi_comment_records_ticket_id ON bi_comment_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_bi_comment_records_author_id ON bi_comment_records(author_id);
CREATE INDEX IF NOT EXISTS idx_bi_comment_records_created_at ON bi_comment_records(created_at);
