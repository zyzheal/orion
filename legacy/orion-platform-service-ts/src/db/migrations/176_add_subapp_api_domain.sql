-- Migration 176: Add api_domain to SubApp Configuration
--
-- Purpose: Enable per-subapp API routing via /api/v1/{api_domain}/*

ALTER TABLE subapp_configs
ADD COLUMN api_domain VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN subapp_configs.api_domain IS 'API routing domain (e.g., "dba", "knowledge"). Requests go to /api/v1/{api_domain}/*';

-- Set default values for existing subapps
UPDATE subapp_configs SET api_domain = 'dba' WHERE key = 'dba';
UPDATE subapp_configs SET api_domain = 'knowledge' WHERE key = 'knowledge';
UPDATE subapp_configs SET api_domain = 'visor' WHERE key = 'visor';

-- Update migration tracking
INSERT INTO schema_migrations (version, description)
VALUES ('176', 'Add api_domain column to subapp_configs')
ON CONFLICT (version) DO NOTHING;
