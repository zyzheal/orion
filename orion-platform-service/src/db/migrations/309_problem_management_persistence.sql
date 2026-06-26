-- Migration 309: Problem Management Persistence (ITIL Standard)
-- Problem tickets lifecycle, Known Error Database (KEDB), timeline events
-- Tables: problems, known_errors, problem_timeline_events

-- 1. Problem tickets main table
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'known',
    severity VARCHAR(50) NOT NULL DEFAULT 'medium',
    category VARCHAR(100),
    root_cause TEXT,
    workaround TEXT,
    resolution TEXT,
    impact VARCHAR(50),
    urgency VARCHAR(50),
    related_incidents JSONB DEFAULT '[]',
    related_changes JSONB DEFAULT '[]',
    assigned_to VARCHAR(255),
    created_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Known Error Database (KEDB)
CREATE TABLE IF NOT EXISTS known_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    symptoms TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    workaround TEXT NOT NULL,
    permanent_fix TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    affected_services JSONB DEFAULT '[]',
    keywords TEXT[] DEFAULT '{}',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Problem timeline events
CREATE TABLE IF NOT EXISTS problem_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for problems
CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_severity ON problems(severity);
CREATE INDEX IF NOT EXISTS idx_problems_assigned_to ON problems(assigned_to);
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);

-- Indexes for known_errors
CREATE INDEX IF NOT EXISTS idx_known_errors_tenant ON known_errors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_status ON known_errors(status);
CREATE INDEX IF NOT EXISTS idx_known_errors_problem ON known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_keywords ON known_errors USING GIN(keywords);

-- Indexes for problem_timeline_events
CREATE INDEX IF NOT EXISTS idx_problem_timeline_problem ON problem_timeline_events(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_timeline_tenant ON problem_timeline_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problem_timeline_created ON problem_timeline_events(created_at DESC);

-- RLS policies for tenant isolation
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_timeline_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY problems_tenant_isolation ON problems
        USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY known_errors_tenant_isolation ON known_errors
        USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY problem_timeline_tenant_isolation ON problem_timeline_events
        USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE problems IS 'ITIL Problem Management - tracks problem records through their lifecycle';
COMMENT ON TABLE known_errors IS 'Known Error Database (KEDB) - documented workarounds and permanent fixes';
COMMENT ON TABLE problem_timeline_events IS 'Problem timeline - chronological event log for problem investigations';
