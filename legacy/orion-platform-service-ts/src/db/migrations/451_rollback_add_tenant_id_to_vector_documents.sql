-- Rollback Migration 451: Remove tenant_id from vector_documents
DROP INDEX IF EXISTS idx_vector_documents_tenant_collection;
DROP INDEX IF EXISTS idx_vector_documents_tenant;
ALTER TABLE vector_documents DROP COLUMN IF EXISTS tenant_id;
