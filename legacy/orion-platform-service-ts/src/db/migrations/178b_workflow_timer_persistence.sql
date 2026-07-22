-- Migration 178: Workflow Timer Persistence
--
-- Adds persistence for Delay/Timer nodes to survive service restarts
-- and enables sub-workflow circular dependency detection

-- ============================================================
-- 1. Workflow Timer State Table
-- ============================================================
-- Stores active timers (delay/timer nodes) for persistence across restarts
CREATE TABLE IF NOT EXISTS workflow_timers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         VARCHAR(255) NOT NULL,  -- FK to workflow instance
    node_id             VARCHAR(100) NOT NULL,  -- Node ID in workflow graph
    timer_type          VARCHAR(20) NOT NULL,   -- 'delay' | 'timer'

    -- Timer configuration
    cron_expression     VARCHAR(100),           -- For timer nodes
    duration_ms         INTEGER,                -- For delay nodes (milliseconds)
    timezone            VARCHAR(50) DEFAULT 'Asia/Shanghai',
    max_executions      INTEGER,                -- For timer nodes (null = unlimited)
    current_executions  INTEGER DEFAULT 0,      -- Times executed so far

    -- Timer state
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'cancelled'
    scheduled_at        TIMESTAMPTZ NOT NULL,   -- When the timer should fire
    fired_at            TIMESTAMPTZ,            -- When the timer actually fired
    resume_event        VARCHAR(100),           -- Optional event to wake up delay node

    -- Output variables to merge after timer completes
    output_variables    JSONB DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for workflow_timers
CREATE INDEX idx_wt_instance ON workflow_timers(instance_id);
CREATE INDEX idx_wt_status ON workflow_timers(status);
CREATE INDEX idx_wt_scheduled ON workflow_timers(scheduled_at DESC);
CREATE INDEX idx_wt_type ON workflow_timers(timer_type);

-- ============================================================
-- 2. Workflow Instance Dependencies Table
-- ============================================================
-- Tracks parent-child relationships between workflow instances
-- Used for sub-workflow circular dependency detection
CREATE TABLE IF NOT EXISTS workflow_instance_dependencies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_instance_id  VARCHAR(255) NOT NULL,
    child_instance_id   VARCHAR(255) NOT NULL,
    node_id             VARCHAR(100) NOT NULL,  -- Sub-workflow node ID
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate parent-child relationships
CREATE UNIQUE INDEX idx_wid_parent_child ON workflow_instance_dependencies(parent_instance_id, child_instance_id);
CREATE INDEX idx_wid_child ON workflow_instance_dependencies(child_instance_id);
CREATE INDEX idx_wid_parent ON workflow_instance_dependencies(parent_instance_id);

-- ============================================================
-- 3. Add Foreign Key Constraints (with existence check)
-- ============================================================
DO $$
BEGIN
    -- Add FK to lowcode_workflow_instance if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lowcode_workflow_instance') THEN
        ALTER TABLE workflow_timers
            ADD CONSTRAINT fk_wt_instance
            FOREIGN KEY (instance_id) REFERENCES lowcode_workflow_instance(id) ON DELETE CASCADE;
    END IF;

    -- Add FKs to workflow_instance_dependencies if lowcode_workflow_instance exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lowcode_workflow_instance') THEN
        ALTER TABLE workflow_instance_dependencies
            ADD CONSTRAINT fk_wid_parent
            FOREIGN KEY (parent_instance_id) REFERENCES lowcode_workflow_instance(id) ON DELETE CASCADE;

        ALTER TABLE workflow_instance_dependencies
            ADD CONSTRAINT fk_wid_child
            FOREIGN KEY (child_instance_id) REFERENCES lowcode_workflow_instance(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- Rollback:
-- DROP TABLE IF EXISTS workflow_instance_dependencies;
-- DROP TABLE IF EXISTS workflow_timers;
