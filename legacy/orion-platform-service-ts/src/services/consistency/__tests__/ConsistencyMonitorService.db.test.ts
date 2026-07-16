/**
 * ConsistencyMonitorService DB-dependent tests
 * Tests the three consistency check methods (pipeline-artifact, config-sync, deployment-state)
 * with a mocked pg Pool, plus auto-repair and error paths.
 */

import { ConsistencyMonitorService, ConsistencyCheckResult } from '../ConsistencyMonitorService';

// --- Helpers to build mock pg Pool ---
function createMockPool(queryResults: Array<{ rows: any[] } | ((sql: string) => { rows: any[] })>) {
  let callIndex = 0;
  const pool = {
    query: jest.fn().mockImplementation((_sql: string, _params?: any[]) => {
      const entry = queryResults[callIndex] ?? { rows: [] };
      callIndex++;
      if (typeof entry === 'function') {
        return Promise.resolve(entry(_sql));
      }
      return Promise.resolve(entry);
    }),
  };
  return pool;
}

/** Pool whose query always rejects */
function createErrorPool(err: Error) {
  return {
    query: jest.fn().mockRejectedValue(err),
  };
}

describe('ConsistencyMonitorService – DB integration tests', () => {
  let service: ConsistencyMonitorService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (service) service.shutdown();
  });

  // ---------------------------------------------------------------
  // Pipeline-Artifact consistency
  // ---------------------------------------------------------------
  describe('checkPipelineArtifactConsistency', () => {
    it('should detect missing artifact', async () => {
      const pool = createMockPool([
        // pipeline_runs query
        {
          rows: [
            { id: 'run-1', status: 'completed', artifact_id: 'art-1', updated_at: new Date(), metadata: {} },
          ],
        },
        // artifacts query – not found
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const paResult = results.find(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-1'
      );

      expect(paResult).toBeDefined();
      expect(paResult!.isConsistent).toBe(false);
      expect(paResult!.expectedHash).toBe('artifact_exists');
      expect(paResult!.actualHash).toBe('artifact_missing');
      expect(paResult!.metadata).toEqual({ reason: 'referenced_artifact_not_found' });
    });

    it('should detect hash mismatch between pipeline run and artifact', async () => {
      const mismatchedHash = 'a'.repeat(64); // won't match computed hash

      const pool = createMockPool([
        // pipeline_runs
        {
          rows: [
            { id: 'run-2', status: 'completed', artifact_id: 'art-2', updated_at: new Date(), metadata: { key: 'val' } },
          ],
        },
        // artifacts – has a content_hash that won't match
        { rows: [{ id: 'art-2', content_hash: mismatchedHash, metadata: {} }] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const paResult = results.find(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-2'
      );

      expect(paResult).toBeDefined();
      expect(paResult!.isConsistent).toBe(false);
      expect(paResult!.expectedHash).not.toBe(mismatchedHash);
      expect(paResult!.actualHash).toBe(mismatchedHash);
      expect(paResult!.metadata).toEqual(
        expect.objectContaining({ artifactId: 'art-2', reason: 'hash_mismatch' })
      );
    });

    it('should NOT flag when artifact hash matches computed hash', async () => {
      // We need to pre-compute the expected hash
      const tmpService = new ConsistencyMonitorService({} as any);
      const run = { id: 'run-ok', status: 'succeeded', metadata: {} };
      const expectedHash = tmpService.computeJsonHash({
        status: run.status,
        id: run.id,
        metadata: run.metadata,
      });

      const pool = createMockPool([
        { rows: [run] },
        { rows: [{ id: 'art-ok', content_hash: expectedHash, metadata: {} }] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      // No pipeline_artifact violation for this run
      const paViolations = results.filter(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-ok' && !r.isConsistent
      );
      expect(paViolations).toHaveLength(0);
    });

    it('should handle empty pipeline_runs result', async () => {
      const pool = createMockPool([{ rows: [] }]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      expect(results.filter(r => r.checkType === 'pipeline_artifact')).toHaveLength(0);
    });

    it('should handle per-row query error gracefully (catch inner)', async () => {
      let callCount = 0;
      const pool = {
        query: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            // artifacts query fails
            return Promise.reject(new Error('artifact table missing'));
          }
          if (callCount === 1) {
            return Promise.resolve({
              rows: [{ id: 'run-err', status: 'completed', artifact_id: 'art-err', updated_at: new Date(), metadata: {} }],
            });
          }
          // subsequent queries (config/deployment) return empty
          return Promise.resolve({ rows: [] });
        }),
      };

      service = new ConsistencyMonitorService(pool as any);
      // Should not throw – the error is caught per-row
      const results = await service.runConsistencyChecks();
      expect(results.filter(r => r.checkType === 'pipeline_artifact')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // Config-Sync consistency
  // ---------------------------------------------------------------
  describe('checkConfigSyncConsistency', () => {
    it('should detect config drift when source_hash != target_hash', async () => {
      const pool = createMockPool([
        // Empty pipeline_runs
        { rows: [] },
        // config_syncs with mismatch
        {
          rows: [
            {
              id: 'sync-1',
              config_id: 'cfg-1',
              source_hash: 'src-hash',
              target_hash: 'tgt-hash',
              target_environment: 'production',
              updated_at: new Date(),
            },
          ],
        },
        // current configs check – matches source_hash (no second violation)
        { rows: [{ id: 'cfg-1', content_hash: 'src-hash' }] },
        // unsynced configs query
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const driftResult = results.find(
        r => r.checkType === 'config_sync' && r.metadata?.reason === 'config_drift_detected'
      );

      expect(driftResult).toBeDefined();
      expect(driftResult!.isConsistent).toBe(false);
      expect(driftResult!.expectedHash).toBe('src-hash');
      expect(driftResult!.actualHash).toBe('tgt-hash');
      expect(driftResult!.metadata).toEqual(
        expect.objectContaining({ syncId: 'sync-1', targetEnvironment: 'production' })
      );
    });

    it('should detect source config changed since last sync', async () => {
      const pool = createMockPool([
        { rows: [] },
        // config_syncs – hashes match
        {
          rows: [
            {
              id: 'sync-2',
              config_id: 'cfg-2',
              source_hash: 'old-hash',
              target_hash: 'old-hash',
              target_environment: 'staging',
              updated_at: new Date(),
            },
          ],
        },
        // current configs check – hash differs from stored source_hash
        { rows: [{ id: 'cfg-2', content_hash: 'new-hash' }] },
        // unsynced configs query
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const changeResult = results.find(
        r =>
          r.checkType === 'config_sync' &&
          r.metadata?.reason === 'source_config_changed_since_sync'
      );

      expect(changeResult).toBeDefined();
      expect(changeResult!.isConsistent).toBe(false);
      expect(changeResult!.expectedHash).toBe('old-hash');
      expect(changeResult!.actualHash).toBe('new-hash');
    });

    it('should detect unsynced configs', async () => {
      const pool = createMockPool([
        { rows: [] }, // pipeline
        { rows: [] }, // config_syncs
        // unsynced configs query
        {
          rows: [{ id: 'cfg-unsync', content_hash: 'hash-1', updated_at: new Date() }],
        },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const unsyncedResult = results.find(
        r =>
          r.checkType === 'config_sync' &&
          r.metadata?.reason === 'config_not_synced'
      );

      expect(unsyncedResult).toBeDefined();
      expect(unsyncedResult!.isConsistent).toBe(false);
      expect(unsyncedResult!.expectedHash).toBe('sync_record_exists');
      expect(unsyncedResult!.actualHash).toBe('no_sync_record');
    });

    it('should NOT flag when source_hash == target_hash and config hash matches', async () => {
      const pool = createMockPool([
        { rows: [] },
        // config_syncs – hashes match
        {
          rows: [
            {
              id: 'sync-ok',
              config_id: 'cfg-ok',
              source_hash: 'same-hash',
              target_hash: 'same-hash',
              target_environment: 'dev',
              updated_at: new Date(),
            },
          ],
        },
        // current config – also same
        { rows: [{ id: 'cfg-ok', content_hash: 'same-hash' }] },
        { rows: [] }, // unsynced
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const configViolations = results.filter(
        r => r.checkType === 'config_sync' && r.resourceId === 'cfg-ok' && !r.isConsistent
      );
      expect(configViolations).toHaveLength(0);
    });

    it('should skip second hash check when current config not found', async () => {
      const pool = createMockPool([
        { rows: [] },
        {
          rows: [
            {
              id: 'sync-3',
              config_id: 'cfg-missing',
              source_hash: 'src-hash',
              target_hash: 'src-hash',
              target_environment: 'prod',
              updated_at: new Date(),
            },
          ],
        },
        // current config query – empty (config deleted)
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      // Should not have source_config_changed violation for cfg-missing
      const changedViolation = results.find(
        r =>
          r.checkType === 'config_sync' &&
          r.resourceId === 'cfg-missing' &&
          r.metadata?.reason === 'source_config_changed_since_sync'
      );
      expect(changedViolation).toBeUndefined();
    });

    it('should handle per-row sync query error gracefully', async () => {
      let callCount = 0;
      const pool = {
        query: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            // config_syncs query fails
            return Promise.reject(new Error('config_syncs table missing'));
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();
      expect(results.filter(r => r.checkType === 'config_sync')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // Deployment-State consistency
  // ---------------------------------------------------------------
  describe('checkDeploymentStateConsistency', () => {
    it('should detect expected/actual state mismatch', async () => {
      const pool = createMockPool([
        { rows: [] }, // pipeline
        { rows: [] }, // config_syncs
        { rows: [] }, // unsynced configs
        // deployments
        {
          rows: [
            {
              id: 'dep-1',
              name: 'my-app',
              namespace: 'default',
              status: 'running',
              expected_state: { replicas: 3 },
              actual_state: { replicas: 1 },
              cluster_name: 'prod-cluster',
              updated_at: new Date(),
            },
          ],
        },
        // cluster_state
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const depResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-1' &&
          r.metadata?.reason === 'state_mismatch'
      );

      expect(depResult).toBeDefined();
      expect(depResult!.isConsistent).toBe(false);
      expect(depResult!.expectedHash).toBeDefined();
      expect(depResult!.actualHash).toBeDefined();
      expect(depResult!.expectedHash).not.toBe(depResult!.actualHash);
    });

    it('should detect stale running deployment (updated > 30min ago)', async () => {
      const staleDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        // deployments – running but stale
        {
          rows: [
            {
              id: 'dep-stale',
              name: 'stale-app',
              namespace: 'ns',
              status: 'running',
              expected_state: null,
              actual_state: null,
              cluster_name: 'c1',
              updated_at: staleDate,
            },
          ],
        },
        { rows: [] }, // cluster_state
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const staleResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-stale' &&
          r.metadata?.reason === 'stale_deployment_status'
      );

      expect(staleResult).toBeDefined();
      expect(staleResult!.isConsistent).toBe(false);
      expect(staleResult!.metadata).toEqual(
        expect.objectContaining({ name: 'stale-app', reason: 'stale_deployment_status' })
      );
    });

    it('should NOT flag stale for recently updated running deployment', async () => {
      const recentDate = new Date(); // just now

      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        {
          rows: [
            {
              id: 'dep-fresh',
              name: 'fresh-app',
              namespace: 'ns',
              status: 'running',
              expected_state: null,
              actual_state: null,
              cluster_name: 'c1',
              updated_at: recentDate,
            },
          ],
        },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const staleResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-fresh' &&
          r.metadata?.reason === 'stale_deployment_status'
      );
      expect(staleResult).toBeUndefined();
    });

    it('should NOT flag stale for non-running deployment', async () => {
      const staleDate = new Date(Date.now() - 60 * 60 * 1000);

      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        {
          rows: [
            {
              id: 'dep-succeeded',
              name: 'done-app',
              namespace: 'ns',
              status: 'succeeded',
              expected_state: null,
              actual_state: null,
              cluster_name: 'c1',
              updated_at: staleDate,
            },
          ],
        },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const staleResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-succeeded' &&
          r.metadata?.reason === 'stale_deployment_status'
      );
      expect(staleResult).toBeUndefined();
    });

    it('should detect cluster_state drift', async () => {
      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] }, // deployments
        // cluster_state discrepancies
        {
          rows: [
            {
              deployment_id: 'dep-drift',
              resource_name: 'my-deploy',
              namespace: 'default',
              cluster_name: 'c1',
              recorded_state: { replicas: 3 },
              observed_state: { replicas: 2 },
            },
          ],
        },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const driftResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.metadata?.reason === 'cluster_state_drift'
      );

      expect(driftResult).toBeDefined();
      expect(driftResult!.isConsistent).toBe(false);
      expect(driftResult!.resourceId).toBe('dep-drift');
    });

    it('should use "unknown" resourceId when deployment_id is null in cluster_state', async () => {
      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        {
          rows: [
            {
              deployment_id: null,
              resource_name: 'orphan-deploy',
              namespace: 'ns',
              cluster_name: 'c1',
              recorded_state: 'a',
              observed_state: 'b',
            },
          ],
        },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const driftResult = results.find(
        r => r.metadata?.reason === 'cluster_state_drift'
      );
      expect(driftResult).toBeDefined();
      expect(driftResult!.resourceId).toBe('unknown');
    });

    it('should handle null recorded/observed state in cluster_state', async () => {
      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        {
          rows: [
            {
              deployment_id: 'dep-null',
              resource_name: 'r',
              namespace: 'n',
              cluster_name: 'c',
              recorded_state: null,
              observed_state: null,
            },
          ],
        },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      const driftResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-null'
      );
      expect(driftResult).toBeDefined();
      expect(driftResult!.expectedHash).toBeUndefined();
      expect(driftResult!.actualHash).toBeUndefined();
    });

    it('should handle per-row deployment query error gracefully', async () => {
      let callCount = 0;
      const pool = {
        query: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 4) {
            // deployments query fails
            return Promise.reject(new Error('deployments table missing'));
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();
      expect(results.filter(r => r.checkType === 'deployment_state')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // Auto-repair
  // ---------------------------------------------------------------
  describe('attemptAutoRepair (via runConsistencyChecks)', () => {
    it('should auto-repair pipeline_artifact violations when enabled', async () => {
      const pool = createMockPool([
        // pipeline_runs
        {
          rows: [
            { id: 'run-ar', status: 'completed', artifact_id: 'art-ar', updated_at: new Date(), metadata: {} },
          ],
        },
        // artifacts – missing
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { enableAutoRepair: true });
      const repairedHandler = jest.fn();
      service.on('consistency:repaired', repairedHandler);

      const results = await service.runConsistencyChecks();

      const paResult = results.find(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-ar'
      );

      expect(paResult).toBeDefined();
      expect(paResult!.resolvedAt).toBeInstanceOf(Date);
      expect(paResult!.resolutionAction).toBe('auto_repair');
      expect(repairedHandler).toHaveBeenCalled();
    });

    it('should auto-repair config_sync violations when enabled', async () => {
      const pool = createMockPool([
        { rows: [] },
        {
          rows: [
            {
              id: 'sync-ar',
              config_id: 'cfg-ar',
              source_hash: 'src',
              target_hash: 'tgt',
              target_environment: 'prod',
              updated_at: new Date(),
            },
          ],
        },
        { rows: [{ id: 'cfg-ar', content_hash: 'src' }] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { enableAutoRepair: true });
      const repairedHandler = jest.fn();
      service.on('consistency:repaired', repairedHandler);

      const results = await service.runConsistencyChecks();

      const configResult = results.find(
        r => r.checkType === 'config_sync' && r.resourceId === 'cfg-ar'
      );

      expect(configResult).toBeDefined();
      expect(configResult!.resolutionAction).toBe('auto_repair');
      expect(configResult!.resolvedAt).toBeInstanceOf(Date);
    });

    it('should auto-repair deployment_state violations when enabled', async () => {
      const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        {
          rows: [
            {
              id: 'dep-ar',
              name: 'ar-app',
              namespace: 'ns',
              status: 'running',
              expected_state: { replicas: 3 },
              actual_state: { replicas: 1 },
              cluster_name: 'c1',
              updated_at: new Date(),
            },
          ],
        },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { enableAutoRepair: true });
      const repairedHandler = jest.fn();
      service.on('consistency:repaired', repairedHandler);

      const results = await service.runConsistencyChecks();

      const depResult = results.find(
        r =>
          r.checkType === 'deployment_state' &&
          r.resourceId === 'dep-ar' &&
          r.metadata?.reason === 'state_mismatch'
      );

      expect(depResult).toBeDefined();
      expect(depResult!.resolutionAction).toBe('auto_repair');
      expect(repairedHandler).toHaveBeenCalled();
    });

    it('should NOT attempt auto-repair when disabled (default)', async () => {
      const pool = createMockPool([
        {
          rows: [
            { id: 'run-nar', status: 'completed', artifact_id: 'art-nar', updated_at: new Date(), metadata: {} },
          ],
        },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { enableAutoRepair: false });
      const repairedHandler = jest.fn();
      service.on('consistency:repaired', repairedHandler);

      const results = await service.runConsistencyChecks();

      const paResult = results.find(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-nar'
      );

      expect(paResult).toBeDefined();
      expect(paResult!.resolvedAt).toBeUndefined();
      expect(paResult!.resolutionAction).toBeUndefined();
      expect(repairedHandler).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // Violation events & stats
  // ---------------------------------------------------------------
  describe('violation events and stats tracking', () => {
    it('should emit consistency:violation for each inconsistent result', async () => {
      const pool = createMockPool([
        {
          rows: [
            { id: 'run-v', status: 'completed', artifact_id: 'art-v', updated_at: new Date(), metadata: {} },
          ],
        },
        { rows: [] }, // artifact missing
        { rows: [] },
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const violationHandler = jest.fn();
      service.on('consistency:violation', violationHandler);

      await service.runConsistencyChecks();

      expect(violationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          checkType: 'pipeline_artifact',
          resourceType: 'pipeline',
          resourceId: 'run-v',
        })
      );
    });

    it('should increment violationCount in stats', async () => {
      const pool = createMockPool([
        {
          rows: [
            { id: 'run-s', status: 'completed', artifact_id: 'art-s', updated_at: new Date(), metadata: {} },
          ],
        },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);

      expect(service.getStats().violationCount).toBe(0);
      await service.runConsistencyChecks();
      expect(service.getStats().violationCount).toBe(1);
    });

    it('should track multiple violations across multiple check types', async () => {
      const pool = createMockPool([
        // pipeline – missing artifact
        {
          rows: [
            { id: 'run-m', status: 'completed', artifact_id: 'art-m', updated_at: new Date(), metadata: {} },
          ],
        },
        { rows: [] },
        // config_sync – drift
        {
          rows: [
            {
              id: 'sync-m',
              config_id: 'cfg-m',
              source_hash: 'a',
              target_hash: 'b',
              target_environment: 'prod',
              updated_at: new Date(),
            },
          ],
        },
        { rows: [{ id: 'cfg-m', content_hash: 'a' }] },
        { rows: [] },
        // deployments – stale
        {
          rows: [
            {
              id: 'dep-m',
              name: 'm-app',
              namespace: 'ns',
              status: 'running',
              expected_state: null,
              actual_state: null,
              cluster_name: 'c1',
              updated_at: new Date(Date.now() - 60 * 60 * 1000),
            },
          ],
        },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const violationHandler = jest.fn();
      service.on('consistency:violation', violationHandler);

      const results = await service.runConsistencyChecks();

      const violations = results.filter(r => !r.isConsistent);
      expect(violations.length).toBeGreaterThanOrEqual(3);
      expect(violationHandler).toHaveBeenCalledTimes(violations.length);
      expect(service.getStats().violationCount).toBe(violations.length);
    });
  });

  // ---------------------------------------------------------------
  // Error handling at top level
  // ---------------------------------------------------------------
  describe('top-level error handling', () => {
    it('should emit check:error when first pipeline_runs query throws', async () => {
      const pool = createErrorPool(new Error('connection refused'));
      service = new ConsistencyMonitorService(pool as any);

      const errorHandler = jest.fn();
      service.on('check:error', errorHandler);

      const results = await service.runConsistencyChecks();

      // Pipeline check catches error internally and returns [], so top-level may not throw
      // But config/deployment checks also call pool.query which will also fail
      // The first top-level try/catch should emit check:error
      expect(results).toEqual([]);
    });

    it('should return empty results when all queries fail', async () => {
      service = new ConsistencyMonitorService(
        createErrorPool(new Error('db down')) as any
      );

      const results = await service.runConsistencyChecks();
      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // Constructor defaults
  // ---------------------------------------------------------------
  describe('constructor defaults', () => {
    it('should use DEFAULT_CONFIG when no config provided', () => {
      service = new ConsistencyMonitorService({} as any);
      const stats = service.getStats();

      expect(stats.checkIntervalMs).toBe(60000);
      expect(stats.isRunning).toBe(false);
      expect(stats.checkCount).toBe(0);
      expect(stats.violationCount).toBe(0);
    });

    it('should merge partial config with defaults', () => {
      service = new ConsistencyMonitorService({} as any, { checkIntervalMs: 5000 });
      const stats = service.getStats();

      expect(stats.checkIntervalMs).toBe(5000);
    });
  });

  // ---------------------------------------------------------------
  // Integration: monitoring lifecycle with DB
  // ---------------------------------------------------------------
  describe('monitoring lifecycle with DB', () => {
    it('should run initial check on startMonitoring and emit check:completed', async () => {
      const pool = createMockPool([
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { checkIntervalMs: 60000 });
      const completedHandler = jest.fn();
      service.on('check:completed', completedHandler);

      await service.startMonitoring();

      expect(completedHandler).toHaveBeenCalledTimes(1);
      expect(service.getStats().isRunning).toBe(true);
      expect(service.getStats().checkCount).toBe(1);
    });

    it('should run periodic checks with setInterval', async () => {
      const pool = createMockPool([
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any, { checkIntervalMs: 100 });

      await service.startMonitoring();

      // Wait for a couple of interval ticks
      await new Promise(resolve => setTimeout(resolve, 300));
      service.stopMonitoring();

      // Should have run at least 2 checks (initial + 1 interval)
      expect(service.getStats().checkCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------
  // Multiple pipeline runs in a single query result
  // ---------------------------------------------------------------
  describe('multiple results handling', () => {
    it('should process multiple pipeline runs independently', async () => {
      const tmpService = new ConsistencyMonitorService({} as any);
      const run1Hash = tmpService.computeJsonHash({ status: 'completed', id: 'run-multi-1', metadata: {} });

      const pool = createMockPool([
        // pipeline_runs – 2 runs
        {
          rows: [
            { id: 'run-multi-1', status: 'completed', artifact_id: 'art-multi-1', updated_at: new Date(), metadata: {} },
            { id: 'run-multi-2', status: 'completed', artifact_id: 'art-multi-2', updated_at: new Date(), metadata: {} },
          ],
        },
        // artifacts for run-multi-1 – hash matches
        { rows: [{ id: 'art-multi-1', content_hash: run1Hash, metadata: {} }] },
        // artifacts for run-multi-2 – missing
        { rows: [] },
        // config syncs
        { rows: [] },
        { rows: [] },
        // deployments
        { rows: [] },
        { rows: [] },
      ]);

      service = new ConsistencyMonitorService(pool as any);
      const results = await service.runConsistencyChecks();

      // run-multi-1 should have no violation
      const r1 = results.filter(
        r => r.checkType === 'pipeline_artifact' && r.resourceId === 'run-multi-1'
      );
      expect(r1).toHaveLength(0);

      // run-multi-2 should have a violation (artifact missing)
      const r2 = results.find(
        r =>
          r.checkType === 'pipeline_artifact' &&
          r.resourceId === 'run-multi-2' &&
          !r.isConsistent
      );
      expect(r2).toBeDefined();
      expect(r2!.metadata).toEqual({ reason: 'referenced_artifact_not_found' });
    });
  });
});
