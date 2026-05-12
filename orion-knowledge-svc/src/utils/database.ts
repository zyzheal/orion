import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export type DatabasePool = Pool;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
    pool.on('error', (err) => console.error('[database] Unexpected error:', err));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function checkHealth(): Promise<{ status: string; message?: string }> {
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}

/**
 * Execute database initialization (create tables if not exist)
 */
export async function initializeDatabase(): Promise<void> {
  const p = getPool();

  // Knowledge spaces
  await p.query(`
    CREATE TABLE IF NOT EXISTS knowledge_spaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      visibility VARCHAR(20) NOT NULL DEFAULT 'private',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      owner_id VARCHAR(255) NOT NULL,
      team_id VARCHAR(255),
      tags TEXT[] DEFAULT '{}',
      config JSONB DEFAULT '{}',
      document_count INT NOT NULL DEFAULT 0,
      vector_indexing_enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Knowledge documents
  await p.query(`
    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      doc_type VARCHAR(20) NOT NULL DEFAULT 'text',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      summary TEXT,
      tags TEXT[] DEFAULT '{}',
      metadata JSONB DEFAULT '{}',
      source_url TEXT,
      version INT NOT NULL DEFAULT 1,
      author_id VARCHAR(255),
      vectorized BOOLEAN NOT NULL DEFAULT false,
      chunk_count INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    )
  `);

  // Document versions
  await p.query(`
    CREATE TABLE IF NOT EXISTS doc_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_id UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
      version INT NOT NULL,
      content TEXT NOT NULL,
      change_log TEXT,
      author_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Document chunks
  await p.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_id UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding_id VARCHAR(255),
      token_count INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(doc_id, chunk_index)
    )
  `);

  // Knowledge graph nodes
  await p.query(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL,
      label VARCHAR(500) NOT NULL,
      properties JSONB DEFAULT '{}',
      source_doc_id UUID REFERENCES knowledge_docs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Knowledge graph edges
  await p.query(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id UUID NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
      source_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      target_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL,
      properties JSONB DEFAULT '{}',
      source_doc_id UUID REFERENCES knowledge_docs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Vector stores
  await p.query(`
    CREATE TABLE IF NOT EXISTS vector_stores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      owner_id VARCHAR(255) NOT NULL,
      space_id UUID REFERENCES knowledge_spaces(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      config JSONB NOT NULL,
      vector_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_indexed_at TIMESTAMPTZ
    )
  `);

  // Vector embeddings (using pgvector)
  await p.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
      ref_id VARCHAR(255) NOT NULL,
      ref_type VARCHAR(50) NOT NULL DEFAULT 'chunk',
      vector VECTOR(1536) NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes
  await p.query('CREATE INDEX IF NOT EXISTS idx_knowledge_docs_space_id ON knowledge_docs(space_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status ON knowledge_docs(status)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_knowledge_docs_vectorized ON knowledge_docs(vectorized)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON doc_versions(doc_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(doc_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_graph_nodes_space_id ON graph_nodes(space_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_graph_edges_space_id ON graph_edges(space_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_node_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_node_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_vector_stores_owner ON vector_stores(owner_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_vector_stores_space ON vector_stores(space_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_store ON vector_embeddings(store_id)');
  await p.query('CREATE INDEX IF NOT EXISTS idx_vector_embeddings_ref ON vector_embeddings(ref_id)');

  // Create HNSW index on vector_embeddings if pgvector supports it
  try {
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_vector_embeddings_hnsw
      ON vector_embeddings USING hnsw (vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  } catch {
    // HNSW not supported, fallback to plain storage
    console.log('[database] HNSW index not supported, using plain vector storage');
  }

  console.log('[database] Schema initialized successfully');
}
