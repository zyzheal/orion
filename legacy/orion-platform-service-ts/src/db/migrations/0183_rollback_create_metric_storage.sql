-- Migration 0183: Rollback Metric Storage

ALTER TABLE metric_data_points DROP CONSTRAINT IF EXISTS fk_metric_points_name;
DROP TABLE IF EXISTS metric_data_points;
DROP TABLE IF EXISTS metric_registry;
