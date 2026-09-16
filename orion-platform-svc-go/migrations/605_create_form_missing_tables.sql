-- 605_create_form_missing_tables.sql
-- form 模块 3 张表无 CREATE TABLE。
-- 回滚见 605_create_form_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS forms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    code        TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    layout      JSONB DEFAULT '{}',
    fields      JSONB DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'active',
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id);

CREATE TABLE IF NOT EXISTS form_fields (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id       UUID NOT NULL,
    field_id      TEXT NOT NULL DEFAULT '',
    label         TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL DEFAULT '',
    placeholder   TEXT NOT NULL DEFAULT '',
    required      BOOLEAN NOT NULL DEFAULT FALSE,
    visible       BOOLEAN NOT NULL DEFAULT TRUE,
    read_only     BOOLEAN NOT NULL DEFAULT FALSE,
    validation    JSONB DEFAULT '{}',
    options       JSONB DEFAULT '[]',
    default_value TEXT NOT NULL DEFAULT '',
    dependency    TEXT NOT NULL DEFAULT '',
    priority      INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id);

CREATE TABLE IF NOT EXISTS form_submissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    form_id      UUID NOT NULL,
    data         JSONB DEFAULT '{}',
    submitted_by TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'submitted',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant ON form_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
