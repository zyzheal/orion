-- 002_p0_domains.sql - AI service P0 domain tables
-- Knowledge Base (RAG)
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id VARCHAR(64) PRIMARY KEY,
    base_id VARCHAR(64) REFERENCES knowledge_bases(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding JSONB DEFAULT '[]',
    metadata TEXT,
    status VARCHAR(50) DEFAULT 'indexed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kb_tenant ON knowledge_bases(tenant_id);
CREATE INDEX idx_kd_base ON knowledge_documents(base_id);
CREATE INDEX idx_kd_content_gin ON knowledge_documents USING gin(to_tsvector('english', content));

-- Vector Store
CREATE TABLE IF NOT EXISTS vector_stores (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    dimensions INT NOT NULL,
    metric VARCHAR(50) DEFAULT 'cosine',
    vector_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vector_entries (
    id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) REFERENCES vector_stores(id),
    data JSONB NOT NULL,
    payload TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, store_id)
);

CREATE INDEX idx_vs_tenant ON vector_stores(tenant_id);
CREATE INDEX idx_ve_store ON vector_entries(store_id);

-- Semantic Search
CREATE TABLE IF NOT EXISTS semantic_search_results (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    score FLOAT DEFAULT 1.0,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ssr_source ON semantic_search_results(source);
CREATE INDEX idx_ssr_score ON semantic_search_results(score);

-- Orchestration
CREATE TABLE IF NOT EXISTS orchestrations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agents JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orchestration_runs (
    id VARCHAR(64) PRIMARY KEY,
    orchestration_id VARCHAR(64) REFERENCES orchestrations(id),
    status VARCHAR(50) DEFAULT 'running',
    input TEXT,
    output TEXT,
    error TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_orch_tenant ON orchestrations(tenant_id);
CREATE INDEX idx_orch_runs ON orchestration_runs(orchestration_id);

-- LLM Trace
CREATE TABLE IF NOT EXISTS llm_traces (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    cost FLOAT DEFAULT 0.0,
    latency_ms INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    error TEXT,
    trace_id VARCHAR(255),
    input TEXT,
    output TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_tenant ON llm_traces(tenant_id);
CREATE INDEX idx_llm_model ON llm_traces(model);
CREATE INDEX idx_llm_provider ON llm_traces(provider);
CREATE INDEX idx_llm_trace_id ON llm_traces(trace_id);
CREATE INDEX idx_llm_created ON llm_traces(created_at);
