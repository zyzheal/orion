-- 161: Artifact Registry Fields for M29
-- Add stage and extended fields to artifact_registry table

ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'snapshot';
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '{}';
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '{}';
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(50) NOT NULL DEFAULT 'local';
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS retention_days INTEGER;
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS cleanup_policy VARCHAR(50);
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS product_line_id VARCHAR(100);
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS downloaded_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_artifact_registry_stage ON artifact_registry(stage);
CREATE INDEX IF NOT EXISTS idx_artifact_registry_product_line ON artifact_registry(product_line_id) WHERE product_line_id IS NOT NULL;

-- Add artifact_promotions table if it doesn't exist properly
CREATE TABLE IF NOT EXISTS artifact_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifact_registry(id) ON DELETE CASCADE,
    from_stage VARCHAR(50) NOT NULL,
    to_stage VARCHAR(50) NOT NULL,
    promoted_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100),
    reason TEXT,
    promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artifact_promotions_artifact ON artifact_promotions(artifact_id);
