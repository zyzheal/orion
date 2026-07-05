CREATE TABLE IF NOT EXISTS wiki_spaces (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	space VARCHAR(128) NOT NULL, content TEXT NOT NULL, format VARCHAR(16) NOT NULL DEFAULT 'markdown', version INT NOT NULL DEFAULT 1, tags JSONB DEFAULT '[]',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wiki_spaces_tenant ON wiki_spaces(tenant_id, created_at);
