-- Migration: 052_create_message_queue_tables.sql
-- Purpose: Create tables for message queue persistence, dead letter queue, and consumer groups
-- Feature: F005, F006, F007 - Message Queue core, Delay/DLQ, Consumer Groups

-- Main message queue table (Redis LPUSH/RPOP + PostgreSQL async persistence)
CREATE TABLE IF NOT EXISTS message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL DEFAULT 'default',
    task_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    max_retries INT NOT NULL DEFAULT 3,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

COMMENT ON COLUMN message_queue.status IS 'Task status: pending, processing, completed, failed, dead';
COMMENT ON COLUMN message_queue.task_id IS 'Unique task identifier (client-provided or auto-generated)';
COMMENT ON COLUMN message_queue.payload IS 'JSON task payload with type and data fields';

-- Dead letter queue (tasks exceeding max retries)
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_queue_id UUID NOT NULL,
    queue_name VARCHAR(255) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    original_priority INT,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    dead_reason VARCHAR(50) NOT NULL DEFAULT 'max_retries_exceeded',
    dead_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed_at TIMESTAMPTZ,
    replay_status VARCHAR(20)
);

COMMENT ON COLUMN dead_letter_queue.dead_reason IS 'Reason for DLQ: max_retries_exceeded, expired, manual';
COMMENT ON COLUMN dead_letter_queue.replay_status IS 'Replay status: pending, replaying, replayed, failed';

-- Delay queue (scheduled tasks using Redis ZADD, PostgreSQL for persistence)
CREATE TABLE IF NOT EXISTS delay_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL DEFAULT 'default',
    task_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    execute_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

COMMENT ON COLUMN delay_queue.execute_at IS 'Scheduled execution time';

-- Consumer group tracking
CREATE TABLE IF NOT EXISTS consumer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    consumer_id VARCHAR(255) NOT NULL,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    messages_processed BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN consumer_groups.status IS 'Consumer status: active, idle, dead';

-- Consumer group pending messages (for tracking which message is assigned to which consumer)
CREATE TABLE IF NOT EXISTS consumer_group_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    consumer_id VARCHAR(255) NOT NULL,
    message_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ack_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    timeout_at TIMESTAMPTZ
);

COMMENT ON COLUMN consumer_group_pending.status IS 'Pending message status: pending, acked, timed_out';

-- Statistics table for queue metrics
CREATE TABLE IF NOT EXISTS queue_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_enqueued BIGINT NOT NULL DEFAULT 0,
    total_dequeued BIGINT NOT NULL DEFAULT 0,
    total_completed BIGINT NOT NULL DEFAULT 0,
    total_failed BIGINT NOT NULL DEFAULT 0,
    total_dead_lettered BIGINT NOT NULL DEFAULT 0,
    avg_processing_time_ms BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (queue_name, date)
);

-- Indexes
CREATE INDEX idx_mq_status ON message_queue (status, queue_name);
CREATE INDEX idx_mq_queue ON message_queue (queue_name, created_at DESC);
CREATE INDEX idx_mq_task ON message_queue (task_id);
CREATE INDEX idx_dlq_queue ON dead_letter_queue (queue_name, dead_at DESC);
CREATE INDEX idx_dlq_replay ON dead_letter_queue (replay_status, dead_at);
CREATE INDEX idx_dq_execute ON delay_queue (execute_at, status);
CREATE INDEX idx_cg_group ON consumer_groups (queue_name, group_name);
CREATE INDEX idx_cgp_message ON consumer_group_pending (message_id, status);
CREATE INDEX idx_stats_queue_date ON queue_stats (queue_name, date DESC);
