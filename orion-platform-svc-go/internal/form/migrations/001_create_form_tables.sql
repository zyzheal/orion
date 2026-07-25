-- 255_create_form_tables.sql
-- Form Engine: form definitions, fields, and submissions

-- Form definitions (templates)
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'custom',
    description TEXT,
    layout JSONB,
    fields JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Form fields (individual controls within a form)
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    field_id VARCHAR(128) NOT NULL,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'text',
    placeholder VARCHAR(255),
    required BOOLEAN NOT NULL DEFAULT false,
    visible BOOLEAN NOT NULL DEFAULT true,
    read_only BOOLEAN NOT NULL DEFAULT false,
    validation JSONB,
    options JSONB,
    default_value TEXT,
    dependency JSONB,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Form submissions (user-submitted instances)
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    submitted_by VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forms_tenant_code ON forms(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_category ON forms(category);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_priority ON form_fields(form_id, priority);
CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant ON form_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_by ON form_submissions(submitted_by);
