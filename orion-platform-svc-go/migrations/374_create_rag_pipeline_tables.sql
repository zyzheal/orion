-- Migration 374: Create RAG pipeline tables
-- Adds 10 tables for RAG Agent pipeline, feedback, evaluation, memory, and caching

CREATE TABLE IF NOT EXISTS rag_conversations (
    id            VARCHAR(36) PRIMARY KEY,
    tenant_id     VARCHAR(255) NOT NULL,
    user_id       VARCHAR(255) NOT NULL DEFAULT 'system',
    title         TEXT NOT NULL DEFAULT '',
    space_id      VARCHAR(36),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_chat_messages (
    id            SERIAL PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    tenant_id     VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL,
    content       TEXT NOT NULL,
    sources       JSONB,
    confidence    DOUBLE PRECISION,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_feedback_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         VARCHAR(255) NOT NULL,
    user_id           VARCHAR(255) NOT NULL,
    conversation_id   VARCHAR(36) NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    message_id        INTEGER NOT NULL REFERENCES rag_chat_messages(id) ON DELETE CASCADE,
    is_positive       BOOLEAN NOT NULL DEFAULT TRUE,
    corrected_answer  TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_user_corrections (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         VARCHAR(255) NOT NULL,
    user_id           VARCHAR(255) NOT NULL,
    query             TEXT NOT NULL,
    original_answer   TEXT,
    corrected_answer  TEXT NOT NULL,
    similarity_hash   VARCHAR(64) NOT NULL,
    applied_count     INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_user_preferences (
    id                VARCHAR(255) PRIMARY KEY,
    tenant_id         VARCHAR(255) NOT NULL,
    user_id           VARCHAR(255) NOT NULL,
    preferred_scope   VARCHAR(50),
    excluded_topics   TEXT[],
    query_patterns    JSONB DEFAULT '{}',
    active_until      TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_eval_metrics (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             VARCHAR(255) NOT NULL,
    query_id              VARCHAR(36) NOT NULL,
    recall_at_5           DOUBLE PRECISION,
    precision             DOUBLE PRECISION,
    ndcg                  DOUBLE PRECISION,
    hallucination_rate    DOUBLE PRECISION,
    latency_ms            INTEGER,
    score                 DOUBLE PRECISION,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_eval_ground_truth (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(255) NOT NULL,
    query         TEXT NOT NULL,
    gold_answer   TEXT NOT NULL,
    gold_sources  JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_semantic_cache (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         VARCHAR(255) NOT NULL,
    query_hash        VARCHAR(64) NOT NULL,
    original_query    TEXT NOT NULL,
    cached_answer     TEXT NOT NULL,
    sources           JSONB,
    hit_count         INTEGER DEFAULT 0,
    last_accessed_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at        TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_prompt_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    version     VARCHAR(20) NOT NULL,
    content     TEXT NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_knowledge_nodes (
    id        VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    type      VARCHAR(50) NOT NULL,
    label     TEXT NOT NULL,
    space_id  VARCHAR(36),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_knowledge_edges (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(255) NOT NULL,
    source      VARCHAR(255) NOT NULL,
    target      VARCHAR(255) NOT NULL,
    relation    VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS rag_sync_status (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(255) NOT NULL,
    source      VARCHAR(100) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'idle',
    last_sync_at TIMESTAMPTZ,
    error_msg   TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rag_conv_tenant ON rag_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_conv_user ON rag_conversations(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_msg_conv ON rag_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_conv ON rag_feedback_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rag_corr_hash ON rag_user_corrections(similarity_hash);
CREATE INDEX IF NOT EXISTS idx_rag_corr_user ON rag_user_corrections(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_eval_query ON rag_eval_metrics(query_id);
CREATE INDEX IF NOT EXISTS idx_rag_cache_hash ON rag_semantic_cache(tenant_id, query_hash);
CREATE INDEX IF NOT EXISTS idx_rag_cache_expires ON rag_semantic_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_rag_template_name ON rag_prompt_templates(name);
CREATE INDEX IF NOT EXISTS idx_rag_nodes_tenant ON rag_knowledge_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_edges_source ON rag_knowledge_edges(source);
CREATE INDEX IF NOT EXISTS idx_rag_edges_target ON rag_knowledge_edges(target);