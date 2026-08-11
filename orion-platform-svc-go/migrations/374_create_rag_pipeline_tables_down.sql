-- Migration 374 Down: Drop RAG pipeline tables
DROP INDEX IF EXISTS idx_rag_conv_tenant;
DROP INDEX IF EXISTS idx_rag_conv_user;
DROP INDEX IF EXISTS idx_rag_msg_conv;
DROP INDEX IF EXISTS idx_rag_feedback_conv;
DROP INDEX IF EXISTS idx_rag_corr_hash;
DROP INDEX IF EXISTS idx_rag_corr_user;
DROP INDEX IF EXISTS idx_rag_eval_query;
DROP INDEX IF EXISTS idx_rag_cache_hash;
DROP INDEX IF EXISTS idx_rag_cache_expires;
DROP INDEX IF EXISTS idx_rag_template_name;
DROP INDEX IF EXISTS idx_rag_nodes_tenant;
DROP INDEX IF EXISTS idx_rag_edges_source;
DROP INDEX IF EXISTS idx_rag_edges_target;

DROP TABLE IF EXISTS rag_conversations CASCADE;
DROP TABLE IF EXISTS rag_chat_messages CASCADE;
DROP TABLE IF EXISTS rag_feedback_events CASCADE;
DROP TABLE IF EXISTS rag_user_corrections CASCADE;
DROP TABLE IF EXISTS rag_user_preferences CASCADE;
DROP TABLE IF EXISTS rag_eval_metrics CASCADE;
DROP TABLE IF EXISTS rag_eval_ground_truth CASCADE;
DROP TABLE IF EXISTS rag_semantic_cache CASCADE;
DROP TABLE IF EXISTS rag_prompt_templates CASCADE;
DROP TABLE IF EXISTS rag_knowledge_nodes CASCADE;
DROP TABLE IF EXISTS rag_knowledge_edges CASCADE;
DROP TABLE IF EXISTS rag_sync_status CASCADE;