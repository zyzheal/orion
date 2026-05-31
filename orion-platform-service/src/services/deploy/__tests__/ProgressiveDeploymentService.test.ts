/**
 * Tests for ProgressiveDeploymentService
 */

import {
  ProgressiveDeploymentService,
  ProgressiveDeployConfig,
  ProgressiveDeployStatus,
  ProgressiveDeploymentServiceError,
} from '../ProgressiveDeploymentService';

// Mock database for testing - uses a shared store that gets cleared between tests
let mockStore = new Map<string, any>();
let mockIdCounter = 0;

function createMockDb() {
  return {
    query: async (text: string, params?: unknown[]) => {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith('INSERT')) {
        const values: any = {};
        const colMatch = text.match(/\(([^)]+)\)\s*VALUES/i);
        if (colMatch && params) {
          const cols = colMatch[1].split(',').map(c => c.trim());
          cols.forEach((col, i) => { values[col] = params[i]; });
        }
        const id = values.id || `auto-${++mockIdCounter}`;
        values.id = id;
        values.created_at = values.created_at || new Date();
        values.updated_at = values.updated_at || new Date();
        mockStore.set(id, values);
        return { rows: [values], rowCount: 1 };
      }

      if (sql.startsWith('SELECT')) {
        let results = Array.from(mockStore.values());
        if (text.includes('WHERE')) {
          // Extract WHERE clause (everything between WHERE and ORDER/LIMIT/GROUP/end)
          const whereStart = text.indexOf('WHERE');
          const afterWhere = text.substring(whereStart + 5);
          // Find the end of WHERE clause
          const orderIdx = afterWhere.search(/\s+ORDER\s+/i);
          const limitIdx = afterWhere.search(/\s+LIMIT\s+/i);
          const groupIdx = afterWhere.search(/\s+GROUP\s+/i);
          let endIdx = afterWhere.length;
          if (orderIdx > 0) endIdx = Math.min(endIdx, orderIdx);
          if (limitIdx > 0) endIdx = Math.min(endIdx, limitIdx);
          if (groupIdx > 0) endIdx = Math.min(endIdx, groupIdx);
          const whereClause = afterWhere.substring(0, endIdx).trim();

          // Parse conditions - split by AND but respect parentheses
          const conditions: string[] = [];
          let depth = 0;
          let current = '';
          for (let i = 0; i < whereClause.length; i++) {
            const ch = whereClause[i];
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth === 0 && whereClause.substring(i).match(/^\s+AND\s+/i)) {
              conditions.push(current.trim());
              current = '';
              i += whereClause.substring(i).match(/^\s+AND\s+/i)![0].length - 1;
            } else {
              current += ch;
            }
          }
          if (current.trim()) conditions.push(current.trim());

          for (const cond of conditions) {
            // Handle column = $N
            const eqMatch = cond.match(/^(\w+)\s*=\s*\$(\d+)$/);
            if (eqMatch) {
              const col = eqMatch[1];
              const idx = parseInt(eqMatch[2]) - 1;
              if (idx < params!.length) {
                results = results.filter(r => r[col] === params![idx]);
              }
              continue;
            }
            // Handle column NOT IN ('a', 'b')
            const notInMatch = cond.match(/^(\w+)\s+NOT\s+IN\s*\(([^)]+)\)/i);
            if (notInMatch) {
              const col = notInMatch[1];
              const excluded = notInMatch[2].split(',').map(s => s.replace(/'/g, '').trim());
              results = results.filter(r => !excluded.includes(r[col]));
              continue;
            }
            // Handle (expr1 OR expr2)
            if (cond.startsWith('(') && cond.includes(' OR ')) {
              const inner = cond.slice(1, -1);
              const orConds = inner.split(/\s+OR\s+/i);
              results = results.filter(r => {
                return orConds.some(orCond => {
                  const ltMatch = orCond.match(/(\w+)\s*<\s*\$(\d+)/);
                  if (ltMatch) {
                    const col = ltMatch[1];
                    const idx = parseInt(ltMatch[2]) - 1;
                    if (r[col] && params && params[idx]) {
                      return new Date(r[col]).getTime() < new Date(params[idx] as any).getTime();
                    }
                  }
                  const nullMatch = orCond.match(/(\w+)\s+IS\s+NULL/i);
                  if (nullMatch) {
                    return r[nullMatch[1]] === null || r[nullMatch[1]] === undefined;
                  }
                  return false;
                });
              });
              continue;
            }
            // Handle column IS NULL
            const nullMatch = cond.match(/^(\w+)\s+IS\s+NULL$/i);
            if (nullMatch) {
              results = results.filter(r => r[nullMatch[1]] === null || r[nullMatch[1]] === undefined);
              continue;
            }
          }
        }
        // LIMIT
        const limitMatch = text.match(/LIMIT\s*\$(\d+)/i);
        if (limitMatch && params) {
          const idx = parseInt(limitMatch[1]) - 1;
          results = results.slice(0, params[idx] as number);
        }
        return { rows: results, rowCount: results.length };
      }

      if (sql.startsWith('UPDATE')) {
        const whereMatch = text.match(/WHERE\s+(.+?)(?:RETURNING|$)/is);
        if (whereMatch && params) {
          // Find the target row
          let target: any = null;
          const whereClause = whereMatch[1].trim();
          const eqMatch = whereClause.match(/(\w+)\s*=\s*\$(\d+)/);
          if (eqMatch) {
            const col = eqMatch[1];
            const idx = parseInt(eqMatch[2]) - 1;
            const key = params[idx] as string;
            target = mockStore.get(key) || Array.from(mockStore.values()).find(r => r[col] === key);
          }

          if (target) {
            const setMatch = text.match(/SET\s+(.+?)\s+WHERE/is);
            if (setMatch) {
              const assignments = setMatch[1].split(',');
              for (const assignment of assignments) {
                const colMatch = assignment.trim().match(/(\w+)\s*=\s*\$(\d+)/);
                if (colMatch) {
                  const col = colMatch[1];
                  const pIdx = parseInt(colMatch[2]) - 1;
                  if (col !== 'updated_at' && pIdx < params.length) {
                    target[col] = params[pIdx];
                  }
                }
              }
              target.updated_at = new Date();
              mockStore.set(target.id, target);
            }
            return { rows: [target], rowCount: 1 };
          }
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.startsWith('DELETE')) {
        const whereStart = text.indexOf('WHERE');
        if (whereStart > 0) {
          const whereClause = text.substring(whereStart + 5).trim();

          // Simple id/deployment_id match
          const simpleMatch = whereClause.match(/^(\w+)\s*=\s*\$(\d+)$/);
          if (simpleMatch && params) {
            const col = simpleMatch[1];
            const idx = parseInt(simpleMatch[2]) - 1;
            const key = params[idx] as string;
            if (col === 'id' && mockStore.has(key)) {
              mockStore.delete(key);
              return { rows: [], rowCount: 1 };
            }
            const entry = Array.from(mockStore.entries()).find(([, v]) => v[col] === key);
            if (entry) {
              mockStore.delete(entry[0]);
              return { rows: [], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          // Complex WHERE with multiple conditions - parse respecting parentheses
          const conditions: string[] = [];
          let depth = 0;
          let current = '';
          for (let i = 0; i < whereClause.length; i++) {
            const ch = whereClause[i];
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth === 0 && whereClause.substring(i).match(/^\s+AND\s+/i)) {
              conditions.push(current.trim());
              current = '';
              i += whereClause.substring(i).match(/^\s+AND\s+/i)![0].length - 1;
            } else {
              current += ch;
            }
          }
          if (current.trim()) conditions.push(current.trim());

          const matches = Array.from(mockStore.entries()).filter(([, v]) => {
            return conditions.every(cond => {
              // Simple equality
              const eqMatch = cond.match(/^(\w+)\s*=\s*\$(\d+)$/);
              if (eqMatch && params) {
                const col = eqMatch[1];
                const idx = parseInt(eqMatch[2]) - 1;
                return v[col] === params[idx];
              }
              // IN clause with string literals
              const inMatch = cond.match(/^(\w+)\s+IN\s*\(([^)]+)\)/i);
              if (inMatch) {
                const col = inMatch[1];
                const vals = inMatch[2].split(',').map(s => s.replace(/'/g, '').trim());
                return vals.includes(v[col]);
              }
              // OR group
              if (cond.startsWith('(') && cond.includes(' OR ')) {
                const inner = cond.slice(1, -1);
                const orConds = inner.split(/\s+OR\s+/i);
                return orConds.some(orCond => {
                  // Handle nested AND
                  const andConds = orCond.split(/\s+AND\s+/i);
                  return andConds.every(ac => {
                    const ltMatch = ac.match(/(\w+)\s*<\s*\$(\d+)/);
                    if (ltMatch && params) {
                      const col = ltMatch[1];
                      const idx = parseInt(ltMatch[2]) - 1;
                      if (v[col] && params[idx]) {
                        return new Date(v[col]).getTime() < new Date(params[idx] as any).getTime();
                      }
                    }
                    const nullMatch = ac.match(/(\w+)\s+IS\s+NULL/i);
                    if (nullMatch) {
                      return v[nullMatch[1]] === null || v[nullMatch[1]] === undefined;
                    }
                    return false;
                  });
                });
              }
              return true;
            });
          });

          for (const [k] of matches) {
            mockStore.delete(k);
          }
          return { rows: [], rowCount: matches.length };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

const DEFAULT_CONFIG: ProgressiveDeployConfig = {
  strategy: 'canary',
  initialTrafficPercent: 10,
  incrementPercent: 10,
  incrementIntervalSeconds: 60,
  autoRollback: true,
  rollbackThreshold: 5,
  healthCheckEndpoint: '/health',
};

describe('ProgressiveDeploymentService', () => {
  let service: ProgressiveDeploymentService;

  beforeEach(() => {
    mockStore = new Map();
    mockIdCounter = 0;
    service = new ProgressiveDeploymentService(createMockDb() as any);
  });

  describe('startProgressiveDeploy', () => {
    it('should start a canary deployment', async () => {
      const result = await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe('deploy-001');
      expect(result.status.phase).toBe('initial');
      expect(result.status.currentTrafficPercent).toBe(10);
      expect(result.status.targetTrafficPercent).toBe(100);
      expect(result.status.errorRate).toBe(0);
      expect(result.status.startedAt).toBeInstanceOf(Date);
    });

    it('should start with different strategies', async () => {
      const strategies: ProgressiveDeployConfig['strategy'][] = [
        'canary',
        'blue-green',
        'rolling',
        'shadow',
      ];

      for (const strategy of strategies) {
        const config = { ...DEFAULT_CONFIG, strategy };
        const result = await service.startProgressiveDeploy(
          `deploy-${strategy}`,
          config
        );
        expect(result.success).toBe(true);
      }
    });

    it('should start with 0 initial traffic', async () => {
      const config = { ...DEFAULT_CONFIG, initialTrafficPercent: 0 };
      const result = await service.startProgressiveDeploy('deploy-001', config);

      expect(result.status.currentTrafficPercent).toBe(0);
      expect(result.status.phase).toBe('initial');
    });

    it('should throw error for invalid initialTrafficPercent', async () => {
      const config = { ...DEFAULT_CONFIG, initialTrafficPercent: -5 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow('initialTrafficPercent must be between 0 and 100');
    });

    it('should throw error for invalid incrementPercent', async () => {
      const config = { ...DEFAULT_CONFIG, incrementPercent: 0 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow('incrementPercent must be between 1 and 100');
    });

    it('should throw error for invalid rollbackThreshold', async () => {
      const config = { ...DEFAULT_CONFIG, rollbackThreshold: 150 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
    });

    it('should throw error when deployment already exists', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      await expect(
        service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG)
      ).rejects.toThrow('already has an active progressive deployment');
    });
  });

  describe('incrementTraffic', () => {
    it('should increment traffic', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      expect(status).not.toBeNull();
      expect(status!.currentTrafficPercent).toBe(20);
      expect(status!.phase).toBe('progressing');
      expect(status!.lastIncrementAt).toBeInstanceOf(Date);
    });

    it('should increment through multiple phases', async () => {
      const noIntervalConfig = { ...DEFAULT_CONFIG, incrementIntervalSeconds: undefined as any };
      await service.startProgressiveDeploy('deploy-001', noIntervalConfig);

      // First increment: 10 -> 20
      let status = await service.incrementTraffic('deploy-001', noIntervalConfig);
      expect(status!.currentTrafficPercent).toBe(20);
      expect(status!.phase).toBe('progressing');

      // Second increment: 20 -> 30
      status = await service.incrementTraffic('deploy-001', noIntervalConfig);
      expect(status!.currentTrafficPercent).toBe(30);
      expect(status!.phase).toBe('progressing');
    });

    it('should complete when reaching 100%', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 90,
        incrementPercent: 20,
      };
      await service.startProgressiveDeploy('deploy-001', config);

      const status = await service.incrementTraffic('deploy-001', config);

      expect(status).not.toBeNull();
      expect(status!.currentTrafficPercent).toBe(100);
      expect(status!.phase).toBe('complete');
      expect(status!.completedAt).toBeInstanceOf(Date);
    });

    it('should not increment when deployment is complete', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      };
      await service.startProgressiveDeploy('deploy-001', config);
      await service.incrementTraffic('deploy-001', config); // Now complete

      const status = await service.incrementTraffic('deploy-001', config);

      expect(status!.phase).toBe('complete');
      expect(status!.currentTrafficPercent).toBe(100);
    });

    it('should not increment when deployment is rolled back', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.abortDeployment('deploy-001');

      const status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      expect(status!.phase).toBe('rolled_back');
    });

    it('should return null for non-existent deployment', async () => {
      const status = await service.incrementTraffic('non-existent', DEFAULT_CONFIG);

      expect(status).toBeNull();
    });
  });

  describe('checkAndAutoRollback', () => {
    it('should not trigger rollback when error rate is below threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        3 // 3% error rate, threshold is 5%
      );

      expect(shouldRollback).toBe(false);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).not.toBe('rolled_back');
    });

    it('should trigger rollback when error rate exceeds threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        10 // 10% error rate, threshold is 5%
      );

      expect(shouldRollback).toBe(true);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).toBe('rolled_back');
    });

    it('should trigger rollback when error rate equals threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        5 // exactly threshold
      );

      expect(shouldRollback).toBe(true);
    });

    it('should not rollback when autoRollback is disabled', async () => {
      const config = { ...DEFAULT_CONFIG, autoRollback: false };
      await service.startProgressiveDeploy('deploy-001', config);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        config,
        50 // very high error rate
      );

      expect(shouldRollback).toBe(false);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).not.toBe('rolled_back');
    });

    it('should return false for non-existent deployment', async () => {
      const shouldRollback = await service.checkAndAutoRollback(
        'non-existent',
        DEFAULT_CONFIG,
        10
      );

      expect(shouldRollback).toBe(false);
    });

    it('should update error rate even when not rolling back', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      await service.checkAndAutoRollback('deploy-001', DEFAULT_CONFIG, 2);

      const status = await service.getStatus('deploy-001');
      expect(status!.errorRate).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return status for existing deployment', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const status = await service.getStatus('deploy-001');

      expect(status).not.toBeNull();
      expect(status!.deploymentId).toBe('deploy-001');
      expect(status!.phase).toBe('initial');
    });

    it('should return null for non-existent deployment', async () => {
      const status = await service.getStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('abortDeployment', () => {
    it('should abort and rollback deployment', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      const result = await service.abortDeployment('deploy-001');

      expect(result).toBe(true);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).toBe('rolled_back');
    });

    it('should return false for non-existent deployment', async () => {
      const result = await service.abortDeployment('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listActiveDeployments', () => {
    it('should return all active deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', DEFAULT_CONFIG);

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(2);
    });

    it('should filter out completed deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-002', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // Now complete

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(1);
      expect(active[0].deploymentId).toBe('deploy-001');
    });

    it('should filter out rolled back deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', DEFAULT_CONFIG);
      await service.abortDeployment('deploy-002');

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(1);
      expect(active[0].deploymentId).toBe('deploy-001');
    });

    it('should return empty array when no active deployments', async () => {
      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(0);
    });
  });

  describe('calculateTrafficWeights', () => {
    it('should calculate correct weights for canary', () => {
      const weights = service.calculateTrafficWeights(10);

      expect(weights.stable).toBe(90);
      expect(weights.canary).toBe(10);
    });

    it('should calculate correct weights at 50%', () => {
      const weights = service.calculateTrafficWeights(50);

      expect(weights.stable).toBe(50);
      expect(weights.canary).toBe(50);
    });

    it('should calculate correct weights at 100%', () => {
      const weights = service.calculateTrafficWeights(100);

      expect(weights.stable).toBe(0);
      expect(weights.canary).toBe(100);
    });

    it('should calculate correct weights at 0%', () => {
      const weights = service.calculateTrafficWeights(0);

      expect(weights.stable).toBe(100);
      expect(weights.canary).toBe(0);
    });
  });

  describe('cleanupCompletedDeployments', () => {
    it('should clean up completed deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // complete

      const cleaned = await service.cleanupCompletedDeployments();

      expect(cleaned).toBe(1);
      const status = await service.getStatus('deploy-001');
      expect(status).toBeNull();
    });

    it('should clean up old deployments based on age', async () => {
      await service.startProgressiveDeploy('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // complete

      // Update the completed_at in the mock DB to be in the past
      const entry = Array.from(mockStore.values()).find(r => r.deployment_id === 'deploy-001');
      if (entry) {
        entry.completed_at = new Date(Date.now() - 60000);
      }

      // Clean only deployments older than 1 hour - should not delete
      const cleaned = await service.cleanupCompletedDeployments(3600000);

      expect(cleaned).toBe(0);

      // Clean deployments older than 1 second - should delete
      const cleaned2 = await service.cleanupCompletedDeployments(1000);
      expect(cleaned2).toBe(1);
    });

    it('should not clean up active deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const cleaned = await service.cleanupCompletedDeployments();

      expect(cleaned).toBe(0);
      const status = await service.getStatus('deploy-001');
      expect(status).not.toBeNull();
    });
  });
});