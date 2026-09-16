-- Reverse 610_create_change_intelligence_missing_tables.sql.
-- Order: child tables first (they reference analyses).
DROP TABLE IF EXISTS change_intelligence_risk_factors;
DROP TABLE IF EXISTS change_intelligence_blast_radius;
DROP TABLE IF EXISTS change_intelligence_analyses;
