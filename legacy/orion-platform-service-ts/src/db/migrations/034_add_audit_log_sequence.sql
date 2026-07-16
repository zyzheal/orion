-- Migration 034: Add Audit Log Sequence Number
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sequence_number BIGINT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq
  FROM audit_logs WHERE sequence_number IS NULL
)
UPDATE audit_logs SET sequence_number = numbered.seq FROM numbered WHERE audit_logs.id = numbered.id;

ALTER TABLE audit_logs ALTER COLUMN sequence_number SET NOT NULL;
ALTER TABLE audit_logs ADD CONSTRAINT uq_audit_logs_sequence UNIQUE (sequence_number);
CREATE INDEX idx_audit_logs_sequence ON audit_logs(sequence_number DESC);

-- Rollback:
-- DROP INDEX IF EXISTS idx_audit_logs_sequence;
-- ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS uq_audit_logs_sequence;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS sequence_number;
