-- Migration 039: Build System

CREATE TABLE IF NOT EXISTS build_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       VARCHAR(500) NOT NULL UNIQUE,
  project_id      UUID,
  branch          VARCHAR(200),
  source_hash     VARCHAR(64) NOT NULL,
  build_config    JSONB NOT NULL,
  artifact_path   VARCHAR(500),
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  hit_count       INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ
);
CREATE INDEX idx_build_cache_project ON build_cache(project_id);
CREATE INDEX idx_build_cache_source ON build_cache(source_hash);

CREATE TABLE IF NOT EXISTS build_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,
  project_id      UUID,
  stage           VARCHAR(50) NOT NULL,
  log_content     TEXT,
  log_url         VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_build_logs_build ON build_logs(build_id);
CREATE INDEX idx_build_logs_project ON build_logs(project_id);

CREATE TABLE IF NOT EXISTS build_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  artifact_type   VARCHAR(50) NOT NULL,
  registry_url    VARCHAR(500),
  digest          VARCHAR(128),
  size_bytes      BIGINT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_build_artifacts_build ON build_artifacts(build_id);

CREATE TABLE IF NOT EXISTS test_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        VARCHAR(200) NOT NULL,
  test_name       VARCHAR(500) NOT NULL,
  predicted_fail  BOOLEAN NOT NULL,
  actual_result   VARCHAR(20),
  confidence      DECIMAL(3,2),
  features        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_predictions_build ON test_predictions(build_id);

CREATE TABLE IF NOT EXISTS test_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name       VARCHAR(500) NOT NULL,
  depends_on      VARCHAR(500) NOT NULL,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'execution',
  source_file     VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_test_dependencies_pair ON test_dependencies(test_name, depends_on);

-- Rollback:
-- DROP TABLE IF EXISTS test_dependencies, test_predictions, build_artifacts, build_logs, build_cache;
