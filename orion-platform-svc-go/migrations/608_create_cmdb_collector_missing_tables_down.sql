-- Reverse 608_create_cmdb_collector_missing_tables.sql.
-- Order: child tables first (assets/collections reference adapters/targets/devices).
DROP TABLE IF EXISTS cmdb_assets;
DROP TABLE IF EXISTS cmdb_discovery_jobs;
DROP TABLE IF EXISTS cmdb_collections;
DROP TABLE IF EXISTS cmdb_devices;
DROP TABLE IF EXISTS cmdb_targets;
DROP TABLE IF EXISTS cmdb_adapters;
