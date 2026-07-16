-- Rollback Migration 121: Drop canary_traffic tables

DROP TABLE IF EXISTS canary_traffic_history CASCADE;
DROP TABLE IF EXISTS canary_traffic_configs CASCADE;
