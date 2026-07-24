-- Migration: 383_create_message_queue_persistence.sql
-- Purpose: Persist MessageQueueService core messages to PostgreSQL
--          (in-memory Map -> DB-backed queue with priority dequeue)
-- F005: enqueue / dequeue / ack / nack / retry

CREATE TABLE IF NOT EXISTS message_queue_persistence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_name VARCHAR(200) NOT NULL,
  message_id VARCHAR(200) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  delivered_at TIMESTAMPTZ,
  delivered_to VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msg_queue_persistence_tenant ON message_queue_persistence(tenant_id);
CREATE INDEX idx_msg_queue_persistence_name ON message_queue_persistence(queue_name);
CREATE INDEX idx_msg_queue_persistence_status ON message_queue_persistence(status);
CREATE INDEX idx_msg_queue_persistence_created ON message_queue_persistence(created_at ASC);

COMMENT ON COLUMN message_queue_persistence.status IS 'Message status: pending, processing, completed, failed, dead';
COMMENT ON COLUMN message_queue_persistence.message_id IS 'Unique task identifier (client-provided or auto-generated)';
COMMENT ON COLUMN message_queue_persistence.payload IS 'JSON task payload with type and data fields';
