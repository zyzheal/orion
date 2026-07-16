-- 162: Extend artifact_type enum for M29 frontend types
-- The original enum only had 8 values; frontend uses 20+ types

DO $$
DECLARE
  val text;
  vals text[] := ARRAY['container_image','base_image','builder_image','jar_artifact','war_artifact','npm_package','python_wheel','go_module','rust_crate','terraform_module','k8s_manifest','docker_compose','coverage_report','performance_report','test_artifact','sbom','signature','security_scan_report','compliance_report','api_doc','changelog','release_notes'];
BEGIN
  FOREACH val IN ARRAY vals LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = val AND enumtypid = 'artifact_type'::regtype) THEN
      EXECUTE format('ALTER TYPE artifact_type ADD VALUE %L', val);
    END IF;
  END LOOP;
END $$;
