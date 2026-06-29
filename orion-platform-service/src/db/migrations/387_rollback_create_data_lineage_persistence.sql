-- Rollback: Data Lineage Persistence
-- Removes data_lineage_nodes, data_lineage_edges, data_lineage_records tables

DROP TABLE IF EXISTS data_lineage_records;
DROP TABLE IF EXISTS data_lineage_edges;
DROP TABLE IF EXISTS data_lineage_nodes;
