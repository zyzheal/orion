-- Rollback: 050_template_marketplace_rollback.sql
-- Description: Rollback template marketplace and cache strategy tables

-- ============================================
-- Rollback Cache Stats and Strategies
-- ============================================

DROP TABLE IF EXISTS cache_stats;
DROP TABLE IF EXISTS cache_strategies;

-- ============================================
-- Rollback Visual Pipelines
-- ============================================

DROP TABLE IF EXISTS visual_pipelines;

-- ============================================
-- Rollback Template Marketplace
-- ============================================

DROP TABLE IF EXISTS template_ratings;
DROP TABLE IF EXISTS template_categories;

-- Remove marketplace columns from pipeline_templates
ALTER TABLE pipeline_templates
DROP COLUMN IF EXISTS is_public,
DROP COLUMN IF EXISTS download_count,
DROP COLUMN IF EXISTS rating_count,
DROP COLUMN IF EXISTS author,
DROP COLUMN IF EXISTS thumbnail,
DROP COLUMN IF EXISTS readme;
