-- ============================================================================
-- Pipeline Seed Data
-- Pipeline ID: 359d0e92-17bf-46ff-b038-eea53964bb7c
-- ============================================================================
-- Run: psql -h localhost -p 5433 -U heal -d orion -f this_file.sql
-- ============================================================================

\set ADMIN_USER_ID '00000000-0000-0000-0000-000000000001'

-- Find tenant_id from users table
\set TENANT_ID `(SELECT tenant_id FROM users WHERE id = '00000000-0000-0000-0000-000000000001' LIMIT 1)`

-- ============================================================================
-- 1. Pipeline Definition
-- ============================================================================

INSERT INTO pipelines (
  id, tenant_id, project_id, name, description, trigger_type,
  config, status, version, yaml_definition, spec,
  created_at, updated_at, created_by
) SELECT
  '359d0e92-17bf-46ff-b038-eea53964bb7c',
  (SELECT tenant_id FROM users WHERE id = :'ADMIN_USER_ID' LIMIT 1),
  NULL,
  'orion-platform-ci',
  'Orion 平台核心 CI/CD Pipeline: 构建 -> 测试 -> 安全扫描 -> 部署',
  'manual',
  '{"repository": "github.com/orion/orion-platform", "branch": "main"}',
  'active',
  2,
  E'apiVersion: v1\nkind: Pipeline\nmetadata:\n  name: orion-platform-ci\n  version: "2"\nspec:\n  stages:\n    - name: Checkout\n      type: scm\n      order: 1\n    - name: Build\n      type: build\n      order: 2\n      dependsOn: [Checkout]\n    - name: Test\n      type: test\n      order: 3\n      dependsOn: [Build]\n    - name: Security Scan\n      type: security\n      order: 4\n      dependsOn: [Build]\n    - name: Deploy\n      type: deploy\n      order: 5\n      dependsOn: [Test, Security Scan]',
  '{
    "triggers": [{"type": "manual"}],
    "stages": [
      {"name": "Checkout", "type": "scm", "order": 1},
      {"name": "Build", "type": "build", "order": 2, "dependsOn": ["Checkout"]},
      {"name": "Test", "type": "test", "order": 3, "dependsOn": ["Build"]},
      {"name": "Security Scan", "type": "security", "order": 4, "dependsOn": ["Build"]},
      {"name": "Deploy", "type": "deploy", "order": 5, "dependsOn": ["Test", "Security Scan"]}
    ]
  }'::jsonb,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '1 day',
  :'ADMIN_USER_ID'
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW(),
  status = 'active';

-- ============================================================================
-- 2. Pipeline Stages
-- ============================================================================

DO $$
DECLARE
  v_pipeline_id UUID := '359d0e92-17bf-46ff-b038-eea53964bb7c';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE pipeline_id = v_pipeline_id) THEN
    INSERT INTO pipeline_stages (id, pipeline_id, name, type, config, order_index, timeout, retry_count, parallel, conditions)
    VALUES
      (gen_random_uuid(), v_pipeline_id, 'Checkout', 'scm', '{"steps": [{"name": "git-clone", "uses": "scm/checkout", "with": {"depth": 1}}]}', 1, 300, 0, false, '{}'),
      (gen_random_uuid(), v_pipeline_id, 'Build', 'build', '{"steps": [{"name": "npm-install", "uses": "npm/run", "with": {"command": "install"}}, {"name": "npm-build", "uses": "npm/run", "with": {"command": "build"}}]}', 2, 600, 1, false, '{}'),
      (gen_random_uuid(), v_pipeline_id, 'Test', 'test', '{"steps": [{"name": "unit-test", "uses": "npm/run", "with": {"command": "test -- --coverage"}}, {"name": "integration-test", "uses": "npm/run", "with": {"command": "test:integration"}}]}', 3, 900, 1, false, '{}'),
      (gen_random_uuid(), v_pipeline_id, 'Security Scan', 'security', '{"steps": [{"name": "sonarqube", "uses": "security/sonarqube", "with": {"quality_gate": "default"}}, {"name": "sast-scan", "uses": "security/sast", "with": {"severity_threshold": "high"}}]}', 4, 600, 0, false, '{}'),
      (gen_random_uuid(), v_pipeline_id, 'Deploy', 'deploy', '{"steps": [{"name": "docker-build", "uses": "docker/build", "with": {"registry": "registry.orion.local"}}, {"name": "k8s-deploy", "uses": "k8s/deploy", "with": {"namespace": "staging", "strategy": "rolling"}}]}', 5, 900, 0, false, '{}');
  END IF;
END $$;

-- ============================================================================
-- 3. Pipeline Run #42 (Successful)
-- ============================================================================

DO $$
DECLARE
  v_pipeline_id UUID := '359d0e92-17bf-46ff-b038-eea53964bb7c';
  v_run_id UUID := 'a1b2c3d4-0001-4000-8000-000000000042';
  v_tenant_id UUID;
  v_checkout_stage UUID;
  v_build_stage UUID;
  v_test_stage UUID;
  v_security_stage UUID;
  v_deploy_stage UUID;
  v_se_checkout UUID;
  v_se_build UUID;
  v_se_test UUID;
  v_se_security UUID;
  v_se_deploy UUID;
  v_t_base TIMESTAMP;
BEGIN
  v_tenant_id := (SELECT tenant_id FROM users WHERE id = '00000000-0000-0000-0000-000000000001' LIMIT 1);
  v_t_base := NOW() - INTERVAL '2 hours';

  IF EXISTS (SELECT 1 FROM pipeline_runs WHERE id = v_run_id) THEN
    RAISE NOTICE 'Run #42 already exists, skipping';
    RETURN;
  END IF;

  -- Get stage IDs
  SELECT id INTO v_checkout_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Checkout' LIMIT 1;
  SELECT id INTO v_build_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Build' LIMIT 1;
  SELECT id INTO v_test_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Test' LIMIT 1;
  SELECT id INTO v_security_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Security Scan' LIMIT 1;
  SELECT id INTO v_deploy_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Deploy' LIMIT 1;

  -- Run #42 metadata
  INSERT INTO pipeline_runs (
    id, tenant_id, pipeline_id, trigger_type, trigger_by, status,
    config_snapshot, environment_name,
    started_at, completed_at, duration_ms, created_at
  ) VALUES (
    v_run_id, v_tenant_id, v_pipeline_id, 'manual',
    '00000000-0000-0000-0000-000000000001',
    'success',
    '{"version": "2", "branch": "main", "commitSha": "abc1234", "author": "admin"}'::jsonb,
    'staging',
    v_t_base,
    v_t_base + INTERVAL '8 minutes 32 seconds',
    512000,
    v_t_base
  );

  -- Stage Executions
  -- Checkout: success, 15s
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_checkout_stage, 'Checkout', 'success',
    v_t_base, v_t_base + INTERVAL '15 seconds', 15000,
    E'[INFO] Cloning repository github.com/orion/orion-platform\n[INFO] Using shallow clone (depth=1)\n[INFO] Checked out branch: main at commit abc1234\n[INFO] Repository cloned successfully in 15s');
  SELECT id INTO v_se_checkout FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Checkout' LIMIT 1;

  -- Build: success, 2m 30s
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_build_stage, 'Build', 'success',
    v_t_base + INTERVAL '15 seconds', v_t_base + INTERVAL '2 minutes 45 seconds', 150000,
    E'[INFO] Running npm install...\n[INFO] Added 842 packages in 45s\n[INFO] Running npm run build...\n[INFO] Compiled successfully.\n[INFO] Build output: dist/ (2.4MB)\n[INFO] Build completed in 2m 30s');
  SELECT id INTO v_se_build FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Build' LIMIT 1;

  -- Test: success, 3m 12s
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_test_stage, 'Test', 'success',
    v_t_base + INTERVAL '2 minutes 45 seconds', v_t_base + INTERVAL '5 minutes 57 seconds', 192000,
    E'[INFO] Running unit tests...\n[INFO] 347 tests passed, 0 failed, 3 skipped\n[INFO] Coverage: 87.5% (lines), 82.1% (branches)\n[INFO] Running integration tests...\n[INFO] 52 tests passed, 0 failed\n[INFO] All tests passed successfully in 3m 12s');
  SELECT id INTO v_se_test FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Test' LIMIT 1;

  -- Security Scan: success, 1m 45s (parallel with Test)
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_security_stage, 'Security Scan', 'success',
    v_t_base + INTERVAL '2 minutes 45 seconds', v_t_base + INTERVAL '4 minutes 30 seconds', 105000,
    E'[INFO] Running SonarQube analysis...\n[INFO] Quality Gate: PASSED\n[INFO] 0 bugs, 3 code smells, 0 vulnerabilities\n[INFO] Running SAST scan...\n[INFO] No critical or high severity issues found\n[INFO] Security scan completed successfully in 1m 45s');
  SELECT id INTO v_se_security FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Security Scan' LIMIT 1;

  -- Deploy: success, 3m 10s
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_deploy_stage, 'Deploy', 'success',
    v_t_base + INTERVAL '5 minutes 57 seconds', v_t_base + INTERVAL '8 minutes 32 seconds', 155000,
    E'[INFO] Building Docker image: registry.orion.local/orion-platform:2.0.42\n[INFO] Image pushed successfully (156MB)\n[INFO] Deploying to namespace: staging\n[INFO] Deployment strategy: rolling update\n[INFO] Waiting for rollout to complete...\n[INFO] All 3 replicas are ready\n[INFO] Deployment completed successfully in 3m 10s');
  SELECT id INTO v_se_deploy FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Deploy' LIMIT 1;

  -- Task Executions for Run #42
  -- Checkout -> git-clone
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_checkout, 'git-clone', 'scm/checkout', 'success',
    '{"depth": 1, "repository": "github.com/orion/orion-platform"}'::jsonb,
    '{"commitSha": "abc1234", "branch": "main"}'::jsonb,
    v_t_base, v_t_base + INTERVAL '15 seconds', 15000,
    E'Cloning into ''orion-platform''...\nremote: Enumerating objects: 1247\nremote: Counting objects: 100% (1247/1247)\nReceiving objects: 100% (1247/1247), 8.2 MiB\nChecking out files: 100% (892/892)\nDone in 15s');

  -- Build -> npm-install
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_build, 'npm-install', 'npm/run', 'success',
    '{"command": "install"}'::jsonb,
    '{"packagesInstalled": 842}'::jsonb,
    v_t_base + INTERVAL '15 seconds', v_t_base + INTERVAL '1 minute', 45000,
    E'npm install --production=false\nnpm WARN deprecated some-package@1.0.0\nadded 842 packages in 45s');

  -- Build -> npm-build
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_build, 'npm-build', 'npm/run', 'success',
    '{"command": "build"}'::jsonb,
    '{"outputDir": "dist/", "sizeBytes": 2516582}'::jsonb,
    v_t_base + INTERVAL '1 minute', v_t_base + INTERVAL '2 minutes 45 seconds', 105000,
    E'npm run build\n> orion-platform@2.0.0 build\n> vite build\nvite v5.2.0 building for production...\ndist/index.js  1,245.67 kB | gzip: 312.45 kB\nBuild complete in 105s');

  -- Test -> unit-test
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_test, 'unit-test', 'npm/run', 'success',
    '{"command": "test -- --coverage"}'::jsonb,
    '{"passed": 347, "failed": 0, "skipped": 3, "coverage": 87.5}'::jsonb,
    v_t_base + INTERVAL '2 minutes 45 seconds', v_t_base + INTERVAL '4 minutes 17 seconds', 92000,
    E'npm run test -- --coverage\n PASS  src/services/PipelineService.test.ts (23 tests)\n PASS  src/engine/PipelineEngine.test.ts (45 tests)\nTest Suites: 28 passed, 28 total\nTests:       347 passed, 3 skipped, 350 total\nCoverage:    87.5% lines, 82.1% branches');

  -- Test -> integration-test
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_test, 'integration-test', 'npm/run', 'success',
    '{"command": "test:integration"}'::jsonb,
    '{"passed": 52, "failed": 0}'::jsonb,
    v_t_base + INTERVAL '4 minutes 17 seconds', v_t_base + INTERVAL '5 minutes 57 seconds', 100000,
    E'npm run test:integration\n PASS  tests/integration/api.test.ts (18 tests)\n PASS  tests/integration/webhook.test.ts (12 tests)\nTest Suites: 5 passed, 5 total\nTests:       52 passed, 52 total');

  -- Security Scan -> sonarqube
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_security, 'sonarqube', 'security/sonarqube', 'success',
    '{"quality_gate": "default"}'::jsonb,
    '{"qualityGate": "PASSED", "bugs": 0, "codeSmells": 3}'::jsonb,
    v_t_base + INTERVAL '2 minutes 45 seconds', v_t_base + INTERVAL '3 minutes 35 seconds', 50000,
    E'SonarQube Scanner analysis...\nProject: orion-platform\nQuality Gate status: PASSED\n  - Bugs: 0\n  - Code Smells: 3\n  - Vulnerabilities: 0\nAnalysis completed in 50s');

  -- Security Scan -> sast-scan
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_security, 'sast-scan', 'security/sast', 'success',
    '{"severity_threshold": "high"}'::jsonb,
    '{"critical": 0, "high": 0, "medium": 2, "low": 5}'::jsonb,
    v_t_base + INTERVAL '3 minutes 35 seconds', v_t_base + INTERVAL '4 minutes 30 seconds', 55000,
    E'SAST Scan initiated...\nScanning source files: 892\nNo critical or high severity issues found.\nMedium issues: 2 (cosmetic)\nLow issues: 5 (style)\nScan completed in 55s');

  -- Deploy -> docker-build
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_deploy, 'docker-build', 'docker/build', 'success',
    '{"registry": "registry.orion.local"}'::jsonb,
    '{"image": "registry.orion.local/orion-platform:2.0.42", "sizeBytes": 163577856}'::jsonb,
    v_t_base + INTERVAL '5 minutes 57 seconds', v_t_base + INTERVAL '6 minutes 52 seconds', 55000,
    E'Docker build: registry.orion.local/orion-platform:2.0.42\nStep 1/8: FROM node:20-alpine\n...\nSuccessfully built 156MB\nPushed to registry.orion.local/orion-platform:2.0.42');

  -- Deploy -> k8s-deploy
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_deploy, 'k8s-deploy', 'k8s/deploy', 'success',
    '{"namespace": "staging", "strategy": "rolling"}'::jsonb,
    '{"namespace": "staging", "replicas": 3}'::jsonb,
    v_t_base + INTERVAL '6 minutes 52 seconds', v_t_base + INTERVAL '8 minutes 32 seconds', 100000,
    E'Kubernetes Deployment: orion-platform\nNamespace: staging\nStrategy: rolling update\nWaiting for rollout...\n  - Pod orion-platform-5d8f7b6c4-abc: Running\n  - Pod orion-platform-5d8f7b6c4-def: Running\n  - Pod orion-platform-5d8f7b6c4-ghi: Running\nAll 3 replicas ready. Deployment successful.');

  RAISE NOTICE 'Run #42 (success) seeded successfully';
END $$;

-- ============================================================================
-- 4. Pipeline Run #43 (Failed)
-- ============================================================================

DO $$
DECLARE
  v_pipeline_id UUID := '359d0e92-17bf-46ff-b038-eea53964bb7c';
  v_run_id UUID := 'a1b2c3d4-0001-4000-8000-000000000043';
  v_tenant_id UUID;
  v_checkout_stage UUID;
  v_build_stage UUID;
  v_test_stage UUID;
  v_security_stage UUID;
  v_deploy_stage UUID;
  v_se_checkout UUID;
  v_se_build UUID;
  v_se_test UUID;
  v_se_security UUID;
  v_se_deploy UUID;
  v_t_base TIMESTAMP;
BEGIN
  v_tenant_id := (SELECT tenant_id FROM users WHERE id = '00000000-0000-0000-0000-000000000001' LIMIT 1);
  v_t_base := NOW() - INTERVAL '30 minutes';

  IF EXISTS (SELECT 1 FROM pipeline_runs WHERE id = v_run_id) THEN
    RAISE NOTICE 'Run #43 already exists, skipping';
    RETURN;
  END IF;

  SELECT id INTO v_checkout_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Checkout' LIMIT 1;
  SELECT id INTO v_build_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Build' LIMIT 1;
  SELECT id INTO v_test_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Test' LIMIT 1;
  SELECT id INTO v_security_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Security Scan' LIMIT 1;
  SELECT id INTO v_deploy_stage FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Deploy' LIMIT 1;

  -- Run #43 metadata
  INSERT INTO pipeline_runs (
    id, tenant_id, pipeline_id, trigger_type, trigger_by, status,
    config_snapshot, environment_name,
    started_at, completed_at, duration_ms, error_message, created_at
  ) VALUES (
    v_run_id, v_tenant_id, v_pipeline_id, 'manual',
    '00000000-0000-0000-0000-000000000001',
    'failed',
    '{"version": "2", "branch": "feat/new-feature", "commitSha": "def5678", "author": "admin"}'::jsonb,
    'staging',
    v_t_base,
    v_t_base + INTERVAL '4 minutes 15 seconds',
    255000,
    'Integration test failure: 2 tests failed in tests/integration/api.test.ts',
    v_t_base
  );

  -- Stage Executions for Run #43
  -- Checkout: success
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_checkout_stage, 'Checkout', 'success',
    v_t_base, v_t_base + INTERVAL '12 seconds', 12000,
    E'[INFO] Cloning repository github.com/orion/orion-platform\n[INFO] Checked out branch: feat/new-feature at commit def5678\n[INFO] Repository cloned successfully in 12s');
  SELECT id INTO v_se_checkout FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Checkout' LIMIT 1;

  -- Build: success
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, logs)
  VALUES (gen_random_uuid(), v_run_id, v_build_stage, 'Build', 'success',
    v_t_base + INTERVAL '12 seconds', v_t_base + INTERVAL '2 minutes 22 seconds', 130000,
    E'[INFO] npm install: added 839 packages in 38s\n[INFO] npm build: Compiled with warnings (2)\n[INFO] Build completed in 2m 10s');
  SELECT id INTO v_se_build FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Build' LIMIT 1;

  -- Test: FAILED
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, error_message, logs)
  VALUES (gen_random_uuid(), v_run_id, v_test_stage, 'Test', 'failed',
    v_t_base + INTERVAL '2 minutes 22 seconds', v_t_base + INTERVAL '4 minutes 15 seconds', 113000,
    'Integration test failure: 2 tests failed',
    E'[INFO] Running unit tests...\n[INFO] 345 tests passed, 0 failed, 5 skipped\n[INFO] Running integration tests...\nFAIL tests/integration/api.test.ts\n  - Pipeline API should return 200: expected 200 but received 500\n  - Pipeline runs endpoint should paginate: timeout after 30s\n2 tests failed. Stage failed.');
  SELECT id INTO v_se_test FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Test' LIMIT 1;

  -- Security Scan: skipped
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, error_message)
  VALUES (gen_random_uuid(), v_run_id, v_security_stage, 'Security Scan', 'skipped',
    v_t_base + INTERVAL '4 minutes 15 seconds', v_t_base + INTERVAL '4 minutes 15 seconds', 0,
    'Skipped due to upstream failure: Test');
  SELECT id INTO v_se_security FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Security Scan' LIMIT 1;

  -- Deploy: skipped
  INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status, started_at, completed_at, duration_ms, error_message)
  VALUES (gen_random_uuid(), v_run_id, v_deploy_stage, 'Deploy', 'skipped',
    v_t_base + INTERVAL '4 minutes 15 seconds', v_t_base + INTERVAL '4 minutes 15 seconds', 0,
    'Skipped due to upstream failure: Test');
  SELECT id INTO v_se_deploy FROM stage_executions WHERE run_id = v_run_id AND stage_name = 'Deploy' LIMIT 1;

  -- Task Executions for Run #43
  -- Checkout -> git-clone
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_checkout, 'git-clone', 'scm/checkout', 'success',
    '{"depth": 1}'::jsonb, '{"commitSha": "def5678"}'::jsonb,
    v_t_base, v_t_base + INTERVAL '12 seconds', 12000,
    E'Cloning into ''orion-platform''...\nremote: Enumerating objects: 1251\nDone in 12s');

  -- Build -> npm-install
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_build, 'npm-install', 'npm/run', 'success',
    '{"command": "install"}'::jsonb, '{"packagesInstalled": 839}'::jsonb,
    v_t_base + INTERVAL '12 seconds', v_t_base + INTERVAL '50 seconds', 38000,
    E'npm install --production=false\nadded 839 packages in 38s');

  -- Build -> npm-build
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_build, 'npm-build', 'npm/run', 'success',
    '{"command": "build"}'::jsonb, '{"outputDir": "dist/"}'::jsonb,
    v_t_base + INTERVAL '50 seconds', v_t_base + INTERVAL '2 minutes 22 seconds', 92000,
    E'npm run build\n> orion-platform@2.0.0 build\nCompiled with 2 warnings\nBuild complete in 92s');

  -- Test -> unit-test (success)
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, logs)
  VALUES (v_se_test, 'unit-test', 'npm/run', 'success',
    '{"command": "test -- --coverage"}'::jsonb,
    '{"passed": 345, "failed": 0, "skipped": 5, "coverage": 86.2}'::jsonb,
    v_t_base + INTERVAL '2 minutes 22 seconds', v_t_base + INTERVAL '3 minutes 30 seconds', 68000,
    E'npm run test -- --coverage\nTest Suites: 28 passed, 28 total\nTests:       345 passed, 5 skipped, 350 total\nCoverage:    86.2% lines, 80.5% branches');

  -- Test -> integration-test (FAILED)
  INSERT INTO task_executions (execution_id, task_name, task_type, status, input, output, started_at, completed_at, duration_ms, error_message, logs)
  VALUES (v_se_test, 'integration-test', 'npm/run', 'failed',
    '{"command": "test:integration"}'::jsonb,
    '{"passed": 50, "failed": 2}'::jsonb,
    v_t_base + INTERVAL '3 minutes 30 seconds', v_t_base + INTERVAL '4 minutes 15 seconds', 45000,
    'Integration test failure: 2 tests failed',
    E'npm run test:integration\n PASS  tests/integration/webhook.test.ts (12 tests)\n FAIL  tests/integration/api.test.ts\n  - Pipeline API should return 200: expected 200 but received 500\n  - Pipeline runs endpoint should paginate: timeout after 30000ms\nTest Suites: 1 failed, 4 passed, 5 total\nTests:       2 failed, 50 passed, 52 total');

  RAISE NOTICE 'Run #43 (failed) seeded successfully';
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
\echo '=== Pipeline ==='
SELECT id, name, status, version FROM pipelines WHERE id = '359d0e92-17bf-46ff-b038-eea53964bb7c';

\echo '=== Stages ==='
SELECT name, type, order_index FROM pipeline_stages WHERE pipeline_id = '359d0e92-17bf-46ff-b038-eea53964bb7c' ORDER BY order_index;

\echo '=== Runs ==='
SELECT id, status, trigger_type, duration_ms, error_message FROM pipeline_runs WHERE pipeline_id = '359d0e92-17bf-46ff-b038-eea53964bb7c' ORDER BY created_at DESC;

\echo '=== Stage Executions ==='
SELECT se.stage_name, se.status, se.duration_ms, pr.status as run_status
FROM stage_executions se
JOIN pipeline_runs pr ON se.run_id = pr.id
WHERE pr.pipeline_id = '359d0e92-17bf-46ff-b038-eea53964bb7c'
ORDER BY pr.created_at DESC, se.created_at ASC;

\echo '=== Task Executions ==='
SELECT te.task_name, te.task_type, te.status, te.duration_ms
FROM task_executions te
JOIN stage_executions se ON te.execution_id = se.id
JOIN pipeline_runs pr ON se.run_id = pr.id
WHERE pr.pipeline_id = '359d0e92-17bf-46ff-b038-eea53964bb7c'
ORDER BY pr.created_at DESC, te.created_at ASC;
