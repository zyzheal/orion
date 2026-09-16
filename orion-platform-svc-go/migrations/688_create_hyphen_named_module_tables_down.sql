-- Reverse of migration 688.
--
-- Nothing else owns these tables, so CASCADE is not destructive beyond them.
-- The hyphenated, double-quoted twins from 659 / 668 / 669 are untouched.

DROP TABLE IF EXISTS message_queue CASCADE;
DROP TABLE IF EXISTS multi_modal_trigger CASCADE;
DROP TABLE IF EXISTS notification_management CASCADE;
DROP TABLE IF EXISTS oci_registry CASCADE;
DROP TABLE IF EXISTS plugin_hotreload CASCADE;
DROP TABLE IF EXISTS script_library CASCADE;
DROP TABLE IF EXISTS script_version CASCADE;
DROP TABLE IF EXISTS self_service CASCADE;
DROP TABLE IF EXISTS ticket_knowledge CASCADE;
DROP TABLE IF EXISTS unified_config CASCADE;
DROP TABLE IF EXISTS vector_store CASCADE;
DROP TABLE IF EXISTS vectorize_rules CASCADE;
DROP TABLE IF EXISTS version_archive CASCADE;
DROP TABLE IF EXISTS rate_limiting CASCADE;
DROP TABLE IF EXISTS test_reports CASCADE;
DROP TABLE IF EXISTS gateway_route_configs CASCADE;
DROP TABLE IF EXISTS service_catalog_timeline CASCADE;
DROP TABLE IF EXISTS service_catalog_requests CASCADE;
