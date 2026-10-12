-- Migration 744: BI Export Formats — 导出格式配置
CREATE TABLE IF NOT EXISTS bi_export_formats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    format_type     TEXT NOT NULL,
    -- Types: pdf, excel, csv, html, json, image
    template_path   TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, format_type)
);
-- Seed default export formats
INSERT INTO bi_export_formats (tenant_id, format_type, config, enabled) VALUES
    ('default', 'pdf', '{"pageSize": "A4", "orientation": "landscape"}', TRUE),
    ('default', 'excel', '{"includeCharts": true, "includeData": true}', TRUE),
    ('default', 'csv', '{"delimiter": ",", "header": true}', TRUE),
    ('default', 'html', '{"template": "default"}', TRUE),
    ('default', 'json', '{}', TRUE)
ON CONFLICT DO NOTHING;
