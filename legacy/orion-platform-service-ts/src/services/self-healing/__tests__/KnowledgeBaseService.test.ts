/**
 * KnowledgeBaseService - Unit Tests
 *
 * Tests for the self-healing knowledge base:
 * - Pattern querying with keywords, symptoms, category, affected component
 * - Pattern management (add, get, update success rate)
 * - Statistics
 * - Category filtering
 * - Constructor validation
 */

import { KnowledgeBaseService, IncidentPattern, KBQuery } from '../KnowledgeBaseService';

// Build a DB mock that returns realistic PostgreSQL results
function makeDbMock(rows: any[] = [], rowCount: number = 0, insertId: string = 'mock-id') {
  return {
    query: jest.fn().mockImplementation(async (sql: string, _params?: any[]) => {
      const lower = sql.toLowerCase();

      // AVG/COUNT aggregate queries
      if (lower.includes('avg(') || lower.includes('count(')) {
        if (lower.includes('avg(success_rate)') || lower.includes('avg(avg_recovery_time)')) {
          // totalSuccessRate query
          if (rows.length > 0) {
            const rates = rows.map(r => parseFloat(r.success_rate ?? r.successRate ?? 0.85));
            const times = rows.map(r => parseFloat(r.avg_recovery_time ?? r.avgRecoveryTime ?? 180));
            const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            return { rows: [{ avg_success_rate: String(avgRate), avg_recovery_time: String(avgTime) }], rowCount: 1 };
          }
          return { rows: [{ avg_success_rate: null, avg_recovery_time: null }], rowCount: 1 };
        }
        if (lower.includes('group by')) {
          // countByCategory query
          const categories: Record<string, number> = {};
          rows.forEach(r => {
            const cat = r.category || 'unknown';
            categories[cat] = (categories[cat] || 0) + 1;
          });
          return { rows: Object.entries(categories).map(([cat, cnt]) => ({ category: cat, count: String(cnt) })) || [], rowCount: Object.keys(categories).length };
        }
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }

      // SELECT for findById - single row
      if (lower.includes('where id =')) {
        return { rows: rows.slice(0, 1), rowCount: Math.min(1, rows.length) };
      }

      // SELECT COUNT for findAll count query
      if (lower.includes('count(*)') && lower.includes('where 1=1')) {
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }

      // SELECT * FROM with ORDER BY/LIMIT/OFFSET - findAll
      if (lower.includes('select *') && lower.includes('order by')) {
        const limitMatch = sql.match(/limit\s+(\d+)/i);
        const offsetMatch = sql.match(/offset\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : 10000;
        const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
        const sliced = rows.slice(offset, offset + limit);
        return { rows: sliced, rowCount: sliced.length };
      }

      // INSERT
      if (lower.includes('insert')) {
        return { rows: [{ ...rows[0], id: insertId, created_at: new Date(), updated_at: new Date() }], rowCount: 1 };
      }

      // UPDATE
      if (lower.includes('update') && lower.includes('set')) {
        return { rows: [{ ...rows[0], updated_at: new Date() }], rowCount: 1 };
      }

      // DELETE
      if (lower.includes('delete')) {
        return { rows: [], rowCount: 1 };
      }

      // Generic fallback
      return { rows, rowCount: rows.length };
    }),
  };
}

function makeEntity(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 'kb-pod-crash',
    name: 'Pod Crash Loop',
    category: 'pod',
    symptoms: JSON.stringify(['CrashLoopBackOff', 'RestartCount increasing']),
    root_causes: JSON.stringify(['Application error', 'Out of memory']),
    indicators: JSON.stringify([{ metric: 'kube_pod_container_status_restarts_total', operator: '>', threshold: 5 }]),
    remediation_steps: JSON.stringify([{ order: 1, action: 'Get pod logs' }]),
    success_rate: 0.85,
    avg_recovery_time: 180,
    risk_level: 'high',
    affected_components: JSON.stringify(['kubernetes', 'application']),
    related_patterns: null,
    tenant_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('KnowledgeBaseService', () => {
  let kb: KnowledgeBaseService;
  let dbMock: jest.Mock;
  let dbRows: Record<string, any>[];

  beforeEach(() => {
    dbRows = [];
    const mockPool = makeDbMock(dbRows);
    dbMock = mockPool.query as jest.Mock;
    kb = new KnowledgeBaseService(mockPool as any);
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should throw when db is null', () => {
      expect(() => new KnowledgeBaseService(null as any)).toThrow('DatabasePool is required');
    });

    it('should throw when db is undefined', () => {
      expect(() => new KnowledgeBaseService(undefined as any)).toThrow('DatabasePool is required');
    });

    it('should initialize with a valid db', () => {
      const db = { query: jest.fn() } as any;
      expect(() => new KnowledgeBaseService(db)).not.toThrow();
    });
  });

  // ==================== getPattern ====================

  describe('getPattern', () => {
    it('should return pattern by known ID', async () => {
      dbRows.push(makeEntity({ id: 'kb-pod-crash', name: 'Pod Crash Loop', category: 'pod' }));

      const pattern = await kb.getPattern('kb-pod-crash');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Pod Crash Loop');
      expect(pattern?.category).toBe('pod');
      expect(pattern?.symptoms).toContain('CrashLoopBackOff');
      expect(pattern?.riskLevel).toBe('high');
    });

    it('should return undefined for unknown ID', async () => {
      const pattern = await kb.getPattern('non-existent-id');
      expect(pattern).toBeUndefined();
    });
  });

  // ==================== Query ====================

  describe('query', () => {
    it('should return patterns when no query provided', async () => {
      const results = kb.query({});
      // query() uses built-in seed patterns
      expect(results.length).toBeGreaterThan(0);
    });

    it('should query by keywords', async () => {
      const results = kb.query({ keywords: ['crash'] });
      expect(results.length).toBeGreaterThan(0);
      const podCrash = results.find(r => r.pattern.id === 'kb-pod-crash');
      expect(podCrash).toBeDefined();
    });

    it('should query by symptoms', async () => {
      const results = kb.query({ symptoms: ['CrashLoopBackOff'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pattern.symptoms).toContain('CrashLoopBackOff');
    });

    it('should query by category', async () => {
      const results = kb.query({ category: 'database' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.pattern.category === 'database')).toBe(true);
    });

    it('should query by affected component', async () => {
      const results = kb.query({ affectedComponent: 'kubernetes' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r =>
        r.pattern.affectedComponents.some(c => c.includes('kubernetes'))
      )).toBe(true);
    });

    it('should combine multiple query dimensions', async () => {
      const results = kb.query({
        category: 'pod',
        symptoms: ['OOMKilled'],
      });
      expect(results.length).toBeGreaterThan(0);
      const oom = results.find(r => r.pattern.id === 'kb-pod-oom');
      expect(oom).toBeDefined();
    });

    it('should respect limit option', async () => {
      const results = kb.query({ limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should include confidence and relevanceScore in results', async () => {
      const results = kb.query({ keywords: ['crash'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
      expect(results[0].relevanceScore).toBeGreaterThanOrEqual(0);
      expect(results[0].suggestedActions).toBeDefined();
      expect(results[0].suggestedActions.length).toBeGreaterThan(0);
    });

    it('should sort results by confidence (highest first)', async () => {
      const results = kb.query({ keywords: ['restart', 'crash'] });
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
        }
      }
    });
  });

  // ==================== addPattern ====================

  describe('addPattern', () => {
    it('should add a custom pattern', async () => {
      const customPattern: IncidentPattern = {
        id: 'custom-test-pattern',
        name: 'Custom Test Pattern',
        category: 'custom',
        symptoms: ['Test symptom A', 'Test symptom B'],
        rootCauses: ['Test root cause'],
        indicators: [
          { metric: 'test_metric', operator: '>', threshold: 100 },
        ],
        remediationSteps: [
          { order: 1, action: 'Test action' },
        ],
        successRate: 0.95,
        avgRecoveryTime: 60,
        riskLevel: 'low',
        affectedComponents: ['test-component'],
      };

      await kb.addPattern(customPattern);

      // Should not throw - the create query is called
      expect(dbMock).toHaveBeenCalled();
    });

    it('should update existing pattern', async () => {
      // Pre-populate DB with existing pattern
      dbRows.push(makeEntity({
        id: 'update-me',
        name: 'Old Pattern',
        category: 'custom',
        success_rate: 0.5,
        avg_recovery_time: 50,
      }));

      const customPattern: IncidentPattern = {
        id: 'update-me',
        name: 'Updated Pattern',
        category: 'custom',
        symptoms: ['Symptom'],
        rootCauses: ['Cause'],
        indicators: [],
        remediationSteps: [{ order: 1, action: 'Fix' }],
        successRate: 0.8,
        avgRecoveryTime: 100,
        riskLevel: 'medium',
        affectedComponents: ['component'],
      };

      await kb.addPattern(customPattern);

      // Should not throw - update is called
      expect(dbMock).toHaveBeenCalled();
    });
  });

  // ==================== updatePatternSuccess ====================

  describe('updatePatternSuccess', () => {
    it('should update pattern success rate', async () => {
      dbRows.push(makeEntity({ id: 'kb-pod-crash', success_rate: 0.85, avg_recovery_time: 180 }));

      await kb.updatePatternSuccess('kb-pod-crash', true, 120);

      expect(dbMock).toHaveBeenCalled();
    });

    it('should handle non-existent pattern gracefully', async () => {
      await expect(kb.updatePatternSuccess('non-existent', true, 60)).resolves.not.toThrow();
    });
  });

  // ==================== getByCategory ====================

  describe('getByCategory', () => {
    it('should return patterns for known category', async () => {
      dbRows.push(
        makeEntity({ id: 'kb-pod-crash', name: 'Pod Crash Loop', category: 'pod' }),
        makeEntity({ id: 'kb-pod-oom', name: 'Out of Memory', category: 'pod' })
      );

      // getByCategory queries DB with category filter
      const podPatterns = await kb.getByCategory('pod');
      expect(podPatterns).toBeDefined();
    });

    it('should return empty array for unknown category', async () => {
      const results = await kb.getByCategory('non-existent');
      expect(results).toEqual([]);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats from DB', async () => {
      dbRows.push(
        makeEntity({ id: 's1', success_rate: 0.8, avg_recovery_time: 120 }),
        makeEntity({ id: 's2', success_rate: 0.9, avg_recovery_time: 240 })
      );

      const stats = await kb.getStats();

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.averageSuccessRate).toBeGreaterThan(0);
      expect(stats.averageRecoveryTime).toBeGreaterThan(0);
    });
  });

  // ==================== getAllPatterns ====================

  describe('getAllPatterns', () => {
    it('should return all patterns from DB', async () => {
      dbRows.push(makeEntity({ id: 'kb-pod-crash', name: 'Pod Crash Loop', category: 'pod' }));

      const patterns = await kb.getAllPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0].id).toBe('kb-pod-crash');
    });
  });

  // ==================== Pattern Data Integrity ====================

  describe('pattern data integrity', () => {
    it('should have required fields for all built-in patterns', async () => {
      const results = kb.query({});
      for (const rec of results) {
        expect(rec.pattern.id).toBeDefined();
        expect(rec.pattern.name).toBeDefined();
        expect(rec.pattern.category).toBeDefined();
        expect(rec.pattern.symptoms).toBeDefined();
        expect(Array.isArray(rec.pattern.symptoms)).toBe(true);
        expect(rec.pattern.rootCauses).toBeDefined();
        expect(Array.isArray(rec.pattern.rootCauses)).toBe(true);
        expect(rec.pattern.riskLevel).toMatch(/^(low|medium|high|critical)$/);
        expect(rec.pattern.successRate).toBeGreaterThanOrEqual(0);
        expect(rec.pattern.successRate).toBeLessThanOrEqual(1);
        expect(rec.pattern.avgRecoveryTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have remediation steps ordered correctly', async () => {
      const results = kb.query({});
      for (const rec of results) {
        if (rec.pattern.remediationSteps.length > 0) {
          for (let i = 1; i < rec.pattern.remediationSteps.length; i++) {
            expect(rec.pattern.remediationSteps[i].order).toBeGreaterThan(
              rec.pattern.remediationSteps[i - 1].order
            );
          }
        }
      }
    });
  });
});
