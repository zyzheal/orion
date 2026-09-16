-- Reverse 604_create_pandawiki_missing_tables.sql.
-- Order: child tables first (they reference kb_spaces / kb_docs).
DROP TABLE IF EXISTS kb_doc_versions;
DROP TABLE IF EXISTS kb_sync_logs;
DROP TABLE IF EXISTS kb_docs;
DROP TABLE IF EXISTS kb_spaces;
