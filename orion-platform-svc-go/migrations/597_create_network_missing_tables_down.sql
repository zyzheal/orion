-- Reverse 597_create_network_missing_tables.sql.
-- Order: child tables first (they reference vpcs).
DROP TABLE IF EXISTS dns_records;
DROP TABLE IF EXISTS firewall_rules;
DROP TABLE IF EXISTS load_balancers;
DROP TABLE IF EXISTS subnets;
DROP TABLE IF EXISTS vpcs;
