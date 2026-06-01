/**
 * KnowledgeBaseService - Unit Tests
 *
 * Tests for the self-healing knowledge base:
 * - Pattern querying with keywords, symptoms, category, affected component
 * - Pattern management (add, get, update success rate)
 * - Statistics
 * - Category filtering
 */

import { KnowledgeBaseService, IncidentPattern, KBQuery } from '../KnowledgeBaseService';

describe('KnowledgeBaseService', () => {
  let kb: KnowledgeBaseService;

  beforeEach(() => {
    // No DB dependency - loads built-in patterns from constants
    kb = new KnowledgeBaseService();
  });

  // Wait for async initialization to complete
  const waitForInit = async () => {
    // The constructor starts an async load; give it time to settle
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  // ==================== Initialization ====================

  describe('initialization', () => {
    it('should load built-in patterns on construction', async () => {
      await waitForInit();
      const patterns = await kb.getAllPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(12); // 14 built-in patterns
    });

    it('should have patterns in multiple categories', async () => {
      await waitForInit();
      const patterns = await kb.getAllPatterns();
      const categories = new Set(patterns.map(p => p.category));
      expect(categories.has('pod')).toBe(true);
      expect(categories.has('resource')).toBe(true);
      expect(categories.has('network')).toBe(true);
      expect(categories.has('deployment')).toBe(true);
      expect(categories.has('database')).toBe(true);
      expect(categories.has('node')).toBe(true);
    });
  });

  // ==================== getPattern ====================

  describe('getPattern', () => {
    it('should return pattern by known ID', async () => {
      await waitForInit();
      const pattern = await kb.getPattern('kb-pod-crash');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Pod Crash Loop');
      expect(pattern?.category).toBe('pod');
      expect(pattern?.symptoms).toContain('CrashLoopBackOff');
      expect(pattern?.riskLevel).toBe('high');
    });

    it('should return pattern for resource issues', async () => {
      await waitForInit();
      const pattern = await kb.getPattern('kb-high-cpu');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('High CPU Usage');
      expect(pattern?.category).toBe('resource');
    });

    it('should return undefined for unknown ID', async () => {
      await waitForInit();
      const pattern = await kb.getPattern('non-existent-id');
      expect(pattern).toBeUndefined();
    });

    it('should have remediation steps for patterns', async () => {
      await waitForInit();
      const pattern = await kb.getPattern('kb-pod-crash');
      expect(pattern?.remediationSteps.length).toBeGreaterThan(0);
      expect(pattern?.remediationSteps[0].order).toBe(1);
      expect(pattern?.remediationSteps[0].action).toBeDefined();
    });

    it('should have indicators for patterns', async () => {
      await waitForInit();
      const pattern = await kb.getPattern('kb-pod-crash');
      expect(pattern?.indicators.length).toBeGreaterThan(0);
      expect(pattern?.indicators[0].metric).toBeDefined();
      expect(pattern?.indicators[0].operator).toBeDefined();
      expect(pattern?.indicators[0].threshold).toBeDefined();
    });
  });

  // ==================== Query ====================

  describe('query', () => {
    it('should return all patterns when no query provided', async () => {
      await waitForInit();
      const results = kb.query({});
      expect(results.length).toBeGreaterThan(0);
    });

    it('should query by keywords', async () => {
      await waitForInit();
      const results = kb.query({ keywords: ['crash'] });
      expect(results.length).toBeGreaterThan(0);
      // Pod Crash Loop should be a top result
      const podCrash = results.find(r => r.pattern.id === 'kb-pod-crash');
      expect(podCrash).toBeDefined();
    });

    it('should query by symptoms', async () => {
      await waitForInit();
      const results = kb.query({ symptoms: ['CrashLoopBackOff'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pattern.symptoms).toContain('CrashLoopBackOff');
    });

    it('should query by category', async () => {
      await waitForInit();
      const results = kb.query({ category: 'database' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.pattern.category === 'database')).toBe(true);
    });

    it('should query by affected component', async () => {
      await waitForInit();
      const results = kb.query({ affectedComponent: 'kubernetes' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r =>
        r.pattern.affectedComponents.some(c => c.includes('kubernetes'))
      )).toBe(true);
    });

    it('should combine multiple query dimensions', async () => {
      await waitForInit();
      const results = kb.query({
        category: 'pod',
        symptoms: ['OOMKilled'],
      });
      expect(results.length).toBeGreaterThan(0);
      const oom = results.find(r => r.pattern.id === 'kb-pod-oom');
      expect(oom).toBeDefined();
    });

    it('should respect limit option', async () => {
      await waitForInit();
      const results = kb.query({ limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should include confidence and relevanceScore in results', async () => {
      await waitForInit();
      const results = kb.query({ keywords: ['crash'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
      expect(results[0].relevanceScore).toBeGreaterThanOrEqual(0);
      expect(results[0].suggestedActions).toBeDefined();
      expect(results[0].suggestedActions.length).toBeGreaterThan(0);
    });

    it('should sort results by relevance (highest first)', async () => {
      await waitForInit();
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
      await waitForInit();

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

      const found = await kb.getPattern('custom-test-pattern');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Custom Test Pattern');
    });

    it('should make custom pattern searchable', async () => {
      await waitForInit();

      const customPattern: IncidentPattern = {
        id: 'searchable-pattern',
        name: 'Database Slow Query',
        category: 'database',
        symptoms: ['Slow query detected'],
        rootCauses: ['Missing index'],
        indicators: [],
        remediationSteps: [{ order: 1, action: 'Analyze query' }],
        successRate: 0.8,
        avgRecoveryTime: 120,
        riskLevel: 'medium',
        affectedComponents: ['database'],
      };

      await kb.addPattern(customPattern);

      const results = kb.query({ keywords: ['slow', 'query'] });
      const found = results.find(r => r.pattern.id === 'searchable-pattern');
      expect(found).toBeDefined();
    });
  });

  // ==================== updatePatternSuccess ====================

  describe('updatePatternSuccess', () => {
    it('should update pattern success rate', async () => {
      await waitForInit();

      const before = await kb.getPattern('kb-pod-crash');
      const originalRate = before!.successRate;

      await kb.updatePatternSuccess('kb-pod-crash', true, 120);

      const after = await kb.getPattern('kb-pod-crash');
      // Success rate should change (running average)
      expect(after!.successRate).not.toBe(originalRate);
    });

    it('should update recovery time', async () => {
      await waitForInit();

      const before = await kb.getPattern('kb-pod-crash');
      const originalTime = before!.avgRecoveryTime;

      await kb.updatePatternSuccess('kb-pod-crash', true, 60);

      const after = await kb.getPattern('kb-pod-crash');
      expect(after!.avgRecoveryTime).not.toBe(originalTime);
    });

    it('should handle non-existent pattern gracefully', async () => {
      await waitForInit();
      // Should not throw
      await expect(kb.updatePatternSuccess('non-existent', true, 60)).resolves.not.toThrow();
    });
  });

  // ==================== getByCategory ====================

  describe('getByCategory', () => {
    it('should return patterns for known category', async () => {
      await waitForInit();
      const podPatterns = await kb.getByCategory('pod');
      expect(podPatterns.length).toBeGreaterThanOrEqual(3);
      expect(podPatterns.every(p => p.category === 'pod')).toBe(true);
    });

    it('should return patterns for resource category', async () => {
      await waitForInit();
      const resourcePatterns = await kb.getByCategory('resource');
      expect(resourcePatterns.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for unknown category', async () => {
      await waitForInit();
      const results = await kb.getByCategory('non-existent');
      expect(results.length).toBe(0);
    });

    it('should be case-insensitive', async () => {
      await waitForInit();
      const results = await kb.getByCategory('POD');
      expect(results.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return correct stats', async () => {
      await waitForInit();
      const stats = await kb.getStats();

      expect(stats.totalPatterns).toBeGreaterThanOrEqual(12);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byCategory['pod']).toBeGreaterThanOrEqual(3);
      expect(stats.byCategory['resource']).toBeGreaterThanOrEqual(3);
      expect(stats.averageSuccessRate).toBeGreaterThan(0);
      expect(stats.averageSuccessRate).toBeLessThanOrEqual(1);
      expect(stats.averageRecoveryTime).toBeGreaterThan(0);
    });

    it('should include all categories in stats', async () => {
      await waitForInit();
      const stats = await kb.getStats();
      expect(Object.keys(stats.byCategory)).toEqual(
        expect.arrayContaining(['pod', 'resource', 'network', 'deployment', 'database', 'node'])
      );
    });
  });

  // ==================== Pattern Data Integrity ====================

  describe('pattern data integrity', () => {
    it('should have required fields for all patterns', async () => {
      await waitForInit();
      const patterns = await kb.getAllPatterns();

      for (const pattern of patterns) {
        expect(pattern.id).toBeDefined();
        expect(pattern.name).toBeDefined();
        expect(pattern.category).toBeDefined();
        expect(pattern.symptoms).toBeDefined();
        expect(Array.isArray(pattern.symptoms)).toBe(true);
        expect(pattern.rootCauses).toBeDefined();
        expect(Array.isArray(pattern.rootCauses)).toBe(true);
        expect(pattern.riskLevel).toMatch(/^(low|medium|high|critical)$/);
        expect(pattern.successRate).toBeGreaterThanOrEqual(0);
        expect(pattern.successRate).toBeLessThanOrEqual(1);
        expect(pattern.avgRecoveryTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have remediation steps ordered correctly', async () => {
      await waitForInit();
      const patterns = await kb.getAllPatterns();

      for (const pattern of patterns) {
        if (pattern.remediationSteps.length > 0) {
          for (let i = 1; i < pattern.remediationSteps.length; i++) {
            expect(pattern.remediationSteps[i].order).toBeGreaterThan(
              pattern.remediationSteps[i - 1].order
            );
          }
        }
      }
    });
  });
});
