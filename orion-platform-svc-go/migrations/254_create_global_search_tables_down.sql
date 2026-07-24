-- Down migration 254: Remove global search tables.
DROP TABLE IF EXISTS global_search_indexer_status;
DROP TABLE IF EXISTS global_search_configs;
