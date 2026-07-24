-- Internal-library module tables

-- Table 1: internal_libraries (base table)
CREATE TABLE IF NOT EXISTS internal_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add new columns to internal_libraries
ALTER TABLE internal_libraries ADD COLUMN display_name VARCHAR(255);
ALTER TABLE internal_libraries ADD COLUMN description TEXT;
ALTER TABLE internal_libraries ADD COLUMN language VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE internal_libraries ADD COLUMN status VARCHAR(50) DEFAULT 'development';
ALTER TABLE internal_libraries ADD COLUMN owner VARCHAR(255);
ALTER TABLE internal_libraries ADD COLUMN repository VARCHAR(500);
ALTER TABLE internal_libraries ADD COLUMN documentation TEXT;
ALTER TABLE internal_libraries ADD COLUMN current_version VARCHAR(100);
ALTER TABLE internal_libraries ADD COLUMN latest_stable_version VARCHAR(100);
ALTER TABLE internal_libraries ADD COLUMN dependents_total INT DEFAULT 0;
ALTER TABLE internal_libraries ADD COLUMN quality_test_coverage FLOAT;
ALTER TABLE internal_libraries ADD COLUMN quality_security_score FLOAT;
ALTER TABLE internal_libraries ADD COLUMN labels JSONB DEFAULT '{}';
ALTER TABLE internal_libraries ADD COLUMN annotations JSONB DEFAULT '{}';

-- Create indexes for internal_libraries
CREATE INDEX IF NOT EXISTS idx_internal_libraries_tenant_id ON internal_libraries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_libraries_language ON internal_libraries(language);
CREATE INDEX IF NOT EXISTS idx_internal_libraries_owner ON internal_libraries(owner);

-- Table 2: library_versions
CREATE TABLE IF NOT EXISTS library_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES internal_libraries(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'snapshot',
    released_at TIMESTAMP WITH TIME ZONE,
    changelog TEXT,
    security_score FLOAT,
    test_coverage FLOAT,
    eol_date TIMESTAMP WITH TIME ZONE,
    deprecation_reason TEXT,
    migration_guide TEXT,
    artifact_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_versions_library_id ON library_versions(library_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_versions_unique ON library_versions(library_id, version);

-- Table 3: library_dependents
CREATE TABLE IF NOT EXISTS library_dependents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES internal_libraries(id) ON DELETE CASCADE,
    repo_name VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    current_version VARCHAR(100),
    latest_compatible_version VARCHAR(100),
    upgrade_available BOOLEAN DEFAULT FALSE,
    upgrade_type VARCHAR(50),
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_dependents_library_id ON library_dependents(library_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_dependents_unique ON library_dependents(library_id, repo_name);
