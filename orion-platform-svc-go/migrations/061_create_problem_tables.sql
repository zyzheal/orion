-- Problem Management tables (ITIL Standard)
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS problem_problems (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    priority VARCHAR(32) NOT NULL DEFAULT 'medium',
    severity VARCHAR(32),
    category VARCHAR(128),
    assigned_to VARCHAR(255),
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_known_errors (
    id UUID PRIMARY KEY,
    problem_id UUID NOT NULL REFERENCES problem_problems(id),
    name VARCHAR(255) NOT NULL,
    symptoms JSONB NOT NULL DEFAULT '[]',
    workaround TEXT,
    root_cause TEXT,
    permanent_fix TEXT,
    affected_services JSONB DEFAULT '[]',
    keywords VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_incident_links (
    id UUID PRIMARY KEY,
    problem_id UUID NOT NULL REFERENCES problem_problems(id),
    incident_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_change_links (
    id UUID PRIMARY KEY,
    problem_id UUID NOT NULL REFERENCES problem_problems(id),
    change_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_problems_tenant ON problem_problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problem_problems_status ON problem_problems(status);
CREATE INDEX IF NOT EXISTS idx_problem_problems_priority ON problem_problems(priority);
CREATE INDEX IF NOT EXISTS idx_problem_known_errors_problem ON problem_known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incident_links_problem ON problem_incident_links(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incident_links_incident ON problem_incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_problem_change_links_problem ON problem_change_links(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_change_links_change ON problem_change_links(change_id);
