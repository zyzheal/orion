-- database-devops schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS database_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL UNIQUE,
    engine VARCHAR(32) NOT NULL,
    host VARCHAR(512) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(128) NOT NULL,
    password VARCHAR(256),
    db_name VARCHAR(128) NOT NULL,
    status VARCHAR(16) DEFAULT 'inactive',
    role VARCHAR(16) DEFAULT 'standalone',
    tenant_id VARCHAR(64) NOT NULL,
    metrics TEXT DEFAULT '{}',
    tags TEXT DEFAULT '{}',
    labels TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_instances_tenant ON database_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_db_instances_status ON database_instances(status);

CREATE TABLE IF NOT EXISTS backup_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id VARCHAR(64) NOT NULL REFERENCES database_instances(id),
    schedule VARCHAR(64) NOT NULL,
    retention INTEGER NOT NULL DEFAULT 30,
    type VARCHAR(32) NOT NULL DEFAULT 'full',
    destination VARCHAR(256) DEFAULT 'local',
    format VARCHAR(32) DEFAULT 'custom',
    compression VARCHAR(32),
    status VARCHAR(16) DEFAULT 'enabled',
    last_backup TIMESTAMP WITH TIME ZONE,
    next_backup TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_policies_database ON backup_policies(database_id);
CREATE INDEX IF NOT EXISTS idx_backup_policies_tenant ON backup_policies(tenant_id);

CREATE TABLE IF NOT EXISTS backup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES backup_policies(id),
    database_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    path VARCHAR(1024),
    size_bytes BIGINT DEFAULT 0,
    duration INTEGER DEFAULT 0,
    checksum VARCHAR(64),
    errors TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_database ON backup_records(database_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);

CREATE TABLE IF NOT EXISTS db_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    executor VARCHAR(128),
    progress INTEGER DEFAULT 0,
    command TEXT,
    logs TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_operations_database ON db_operations(database_id);
CREATE INDEX IF NOT EXISTS idx_db_operations_status ON db_operations(status);
