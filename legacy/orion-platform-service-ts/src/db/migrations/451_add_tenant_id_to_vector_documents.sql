-- Migration 451: Add tenant_id to vector_documents
-- Enables multi-tenant isolation for vector store documents

-- Add tenant_id column with default for backfill compatibility
ALTER TABLE vector_documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) NOT NULL DEFAULT 'default';

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_vector_documents_tenant ON vector_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_documents_tenant_collection ON vector_documents(tenant_id, collection);
