-- Migration 747: Sprint Review + Retrospective tables
CREATE TABLE IF NOT EXISTS sprint_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    date            TEXT,
    attendees       TEXT[] DEFAULT '{}',
    highlights      TEXT,
    demo_notes      TEXT,
    feedback        TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sprint_reviews_sprint ON sprint_reviews(tenant_id, sprint_id);

CREATE TABLE IF NOT EXISTS sprint_retrospectives (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           TEXT NOT NULL,
    sprint_id           UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    date                TEXT,
    attendees           TEXT[] DEFAULT '{}',
    what_went_well      TEXT[] DEFAULT '{}',
    what_to_improve     TEXT[] DEFAULT '{}',
    action_items        JSONB NOT NULL DEFAULT '[]',
    summary             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sprint_retrospectives_sprint ON sprint_retrospectives(tenant_id, sprint_id);
