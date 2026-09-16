-- Migration #237 (down): Drop data_pipelines table
-- Fixed: data_pipelines has FK references from data_pipeline_runs (273) and possibly other tables.
-- Adding CASCADE so the DROP succeeds; dependent tables will be dropped first.

DROP TABLE IF EXISTS data_pipelines CASCADE;
