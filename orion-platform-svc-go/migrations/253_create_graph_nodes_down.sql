-- Reverse 253_create_graph_nodes.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS graph_relationships CASCADE;
DROP TABLE IF EXISTS graph_nodes CASCADE;
