-- Auto-generated rollback for version 052. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_knowledge_sync_logs_tenant_id";

DROP TABLE IF EXISTS "knowledge_sync_logs" CASCADE;

DROP INDEX IF EXISTS "idx_knowledge_doc_versions_document_id";

DROP TABLE IF EXISTS "knowledge_doc_versions" CASCADE;

DROP INDEX IF EXISTS "idx_knowledge_documents_status";

DROP INDEX IF EXISTS "idx_knowledge_documents_space_id";

DROP INDEX IF EXISTS "idx_knowledge_documents_tenant_id";

DROP TABLE IF EXISTS "knowledge_documents" CASCADE;

DROP INDEX IF EXISTS "idx_knowledge_spaces_type";

DROP INDEX IF EXISTS "idx_knowledge_spaces_tenant_id";
