-- 001_init.sql - ChatOps service tables
CREATE TABLE IF NOT EXISTS chatops_messages (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(100) NOT NULL,
    channel VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    sender VARCHAR(255),
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatops_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatops_platforms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    config TEXT,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatops_command_log (
    id BIGSERIAL PRIMARY KEY,
    command VARCHAR(255) NOT NULL,
    args TEXT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chatops_messages_platform ON chatops_messages(platform);
CREATE INDEX idx_chatops_messages_created ON chatops_messages(created_at);
CREATE INDEX idx_chatops_conversations_platform ON chatops_conversations(platform);
