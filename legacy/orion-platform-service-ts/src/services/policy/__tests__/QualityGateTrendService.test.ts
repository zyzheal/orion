/**
 * QualityGateTrendService - Unit Tests
 *
 * Tests for pass rate trends, violation distribution, top failing policies,
 * exemption stats, and recommendation engine.
 *
 * Uses mock database pool since QualityGateTrendService requires db.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `trend-uuid-${++uuidCounter}`),
}));

import { QualityGateTrendService } from '../QualityGateTrendService';

// ==================== Mock Database ====================

/**
 * Creates a mock DB with pattern-based responses.
 */
function createMockDb(responses: Record<string, any[]> = {}) {
  const db = {
    query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
      for (const [pattern, rows] of Object.entries(responses)) {
        if (text.includes(pattern)) {
          return { rows, rowCount: rows.length };
        }
      }
      return { rows: [], rowCount: 0 };
    }),
  };
  return db;
}

/**
 * Creates a mock DB with sequential responses for getRecommendations tests.
 * Each call to db.query() returns the next response in the queue.
 */
function createSequentialMockDb(sequentialResponses: Array<{ rows: any[] }>) {
  let callIndex = 0;
  const db = {
    query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
      const response = sequentialResponses[callIndex] || { rows: [] };
      callIndex++;
      return { rows: response.rows, rowCount: response.rows.length };
    }),
  };
  return db;
}

/**
 * Helper to build the standard 4-query sequence for getRecommendations:
 * 1. getPassRateTrend
 * 2. getTopFailingPolicies
 * 3. getExemptionsByCategory
 * 4. stale violations count
 */
function buildRecommendationResponses(options: {
  trendRows?: any[];
  topFailingRows?: any[];
  exemptionRows?: any[];
  staleViolationCount?: string;
}) {
  return [
    { rows: options.trendRows ?? [{ date: '2025-01-01', total_evaluations: '100', passed_evaluations: '95' }] },
    { rows: options.topFailingRows ?? [] },
    { rows: options.exemptionRows ?? [{ total: '0', false_positive: '0', business_urgency: '0', tech_debt: '0', temporary: '0' }] },
    { rows: [{ count: options.staleViolationCount ?? '0' }] },
  ];
}

// ==================== Tests ====================

describe('QualityGateTrendService', () => {
  let service: QualityGateTrendService;

  beforeEach(() => {
    uuidCounter = 0;
  });

  // ==================== getPassRateTrend ====================

  describe('getPassRateTrend', () => {
    it('should return pass rate trend data', async () => {
      const db = createMockDb({
        'DATE(e.evaluated_at)': [
          { date: '2025-01-01', total_evaluations: '10', passed_evaluations: '8' },
          { date: '2025-01-02', total_evaluations: '12', passed_evaluations: '10' },
        ],
      });
      service = new QualityGateTrendService(db);

      const trend = await service.getPassRateTrend(30);

      expect(trend).toHaveLength(2);
      expect(trend[0].date).toBe('2025-01-01');
      expect(trend[0].totalEvaluations).toBe(10);
      expect(trend[0].passedEvaluations).toBe(8);
      expect(trend[0].passRate).toBe(80);
      expect(trend[1].passRate).toBeCloseTo(83.33, 1);
    });

    it('should handle zero evaluations', async () => {
      const db = createMockDb({
        'DATE(e.evaluated_at)': [
          { date: '2025-01-01', total_evaluations: '0', passed_evaluations: '0' },
        ],
      });
      service = new QualityGateTrendService(db);

      const trend = await service.getPassRateTrend(30);
      expect(trend[0].passRate).toBe(0);
    });

    it('should pass policyId filter to query', async () => {
      const db = createMockDb({
        'DATE(e.evaluated_at)': [],
      });
      service = new QualityGateTrendService(db);

      await service.getPassRateTrend(30, 'policy-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('e.policy_id = $2'),
        expect.arrayContaining([30, 'policy-1'])
      );
    });

    it('should return empty array when no data', async () => {
      const db = createMockDb({
        'DATE(e.evaluated_at)': [],
      });
      service = new QualityGateTrendService(db);

      const trend = await service.getPassRateTrend(7);
      expect(trend).toEqual([]);
    });
  });

  // ==================== getViolationDistribution ====================

  describe('getViolationDistribution', () => {
    it('should return distribution grouped by severity', async () => {
      const db = createMockDb({
        'v.severity AS key': [
          { key: 'critical', count: '5' },
          { key: 'high', count: '3' },
          { key: 'medium', count: '2' },
        ],
      });
      service = new QualityGateTrendService(db);

      const dist = await service.getViolationDistribution(30, 'severity');

      expect(dist).toHaveLength(3);
      expect(dist[0].key).toBe('critical');
      expect(dist[0].count).toBe(5);
      expect(dist[0].percentage).toBe(50); // 5/10
      expect(dist[1].percentage).toBe(30); // 3/10
      expect(dist[2].percentage).toBe(20); // 2/10
    });

    it('should return distribution grouped by policy', async () => {
      const db = createMockDb({
        'v.policy_id AS key': [
          { key: 'policy-1', count: '7' },
          { key: 'policy-2', count: '3' },
        ],
      });
      service = new QualityGateTrendService(db);

      const dist = await service.getViolationDistribution(30, 'policy');

      expect(dist).toHaveLength(2);
      expect(dist[0].key).toBe('policy-1');
      expect(dist[0].percentage).toBe(70);
    });

    it('should default to severity grouping', async () => {
      const db = createMockDb({
        'v.severity AS key': [{ key: 'low', count: '1' }],
      });
      service = new QualityGateTrendService(db);

      await service.getViolationDistribution();
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('v.severity AS key'));
    });

    it('should handle zero total for percentage calculation', async () => {
      const db = createMockDb({
        'v.severity AS key': [],
      });
      service = new QualityGateTrendService(db);

      const dist = await service.getViolationDistribution(30, 'severity');
      expect(dist).toEqual([]);
    });

    it('should default unknown key to "unknown"', async () => {
      const db = createMockDb({
        'v.severity AS key': [
          { key: null, count: '2' },
        ],
      });
      service = new QualityGateTrendService(db);

      const dist = await service.getViolationDistribution(30, 'severity');
      expect(dist[0].key).toBe('unknown');
    });
  });

  // ==================== getTopFailingPolicies ====================

  describe('getTopFailingPolicies', () => {
    it('should return top failing policies', async () => {
      const db = createMockDb({
        'policy_id': [
          { policy_id: 'p1', policy_name: 'Security Scan', failure_count: '10', total_evaluations: '15' },
          { policy_id: 'p2', policy_name: 'Cost Check', failure_count: '3', total_evaluations: '20' },
        ],
      });
      service = new QualityGateTrendService(db);

      const top = await service.getTopFailingPolicies(5, 30);

      expect(top).toHaveLength(2);
      expect(top[0].policyId).toBe('p1');
      expect(top[0].policyName).toBe('Security Scan');
      expect(top[0].failureCount).toBe(10);
      expect(top[0].totalEvaluations).toBe(15);
      expect(top[0].failureRate).toBeCloseTo(66.67, 1);
      expect(top[1].failureRate).toBe(15); // 3/20
    });

    it('should use default limit of 5', async () => {
      const db = createMockDb({ 'policy_id': [] });
      service = new QualityGateTrendService(db);

      await service.getTopFailingPolicies();

      expect(db.query).toHaveBeenCalledWith(
        expect.anything(),
        [5]
      );
    });

    it('should handle zero total evaluations for failure rate', async () => {
      const db = createMockDb({
        'policy_id': [
          { policy_id: 'p1', policy_name: 'Test', failure_count: '0', total_evaluations: '0' },
        ],
      });
      service = new QualityGateTrendService(db);

      const top = await service.getTopFailingPolicies();
      expect(top[0].failureRate).toBe(0);
    });

    it('should default unknown policy name', async () => {
      const db = createMockDb({
        'policy_id': [
          { policy_id: 'p1', policy_name: null, failure_count: '1', total_evaluations: '10' },
        ],
      });
      service = new QualityGateTrendService(db);

      const top = await service.getTopFailingPolicies();
      expect(top[0].policyName).toBe('Unknown');
    });
  });

  // ==================== getExemptionStats ====================

  describe('getExemptionStats', () => {
    it('should return exemption statistics', async () => {
      const db = createMockDb({
        'COUNT(*) FILTER': [
          { active: '5', expired: '3', pending: '2', revoked: '1', total: '11' },
        ],
      });
      service = new QualityGateTrendService(db);

      const stats = await service.getExemptionStats();

      expect(stats.active).toBe(5);
      expect(stats.expired).toBe(3);
      expect(stats.pending).toBe(2);
      expect(stats.revoked).toBe(1);
      expect(stats.total).toBe(11);
    });

    it('should handle empty result', async () => {
      const db = createMockDb({
        'COUNT(*) FILTER': [{}],
      });
      service = new QualityGateTrendService(db);

      const stats = await service.getExemptionStats();

      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.revoked).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  // ==================== getRecommendations ====================

  describe('getRecommendations', () => {
    it('should suggest maintain when all metrics are healthy', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        trendRows: [{ date: '2025-01-01', total_evaluations: '100', passed_evaluations: '95' }],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      expect(recs).toHaveLength(1);
      expect(recs[0].category).toBe('maintain');
      expect(recs[0].priority).toBe('low');
    });

    it('should suggest test-coverage improvement for low pass rate', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        trendRows: [{ date: '2025-01-01', total_evaluations: '100', passed_evaluations: '50' }],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const coverageRec = recs.find(r => r.category === 'test-coverage');
      expect(coverageRec).toBeDefined();
      expect(coverageRec!.priority).toBe('high');
    });

    it('should suggest medium priority for moderate pass rate', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        trendRows: [{ date: '2025-01-01', total_evaluations: '100', passed_evaluations: '70' }],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const coverageRec = recs.find(r => r.category === 'test-coverage');
      expect(coverageRec).toBeDefined();
      expect(coverageRec!.priority).toBe('medium');
    });

    it('should suggest policy review for high failure rate policies', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        topFailingRows: [
          { policy_id: 'p1', policy_name: 'Strict Policy', failure_count: '60', total_evaluations: '100' },
        ],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const policyRec = recs.find(r => r.category === 'policy-review');
      expect(policyRec).toBeDefined();
      expect(policyRec!.priority).toBe('high');
      expect(policyRec!.policyId).toBe('p1');
    });

    it('should suggest policy tuning for high false-positive ratio', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        exemptionRows: [{ total: '10', false_positive: '4', business_urgency: '0', tech_debt: '0', temporary: '0' }],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const tuningRec = recs.find(r => r.category === 'policy-tuning');
      expect(tuningRec).toBeDefined();
      expect(tuningRec!.priority).toBe('high');
    });

    it('should suggest emergency bypass for high business-urgency ratio', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        exemptionRows: [{ total: '10', false_positive: '0', business_urgency: '3', tech_debt: '0', temporary: '0' }],
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const bypassRec = recs.find(r => r.category === 'emergency-bypass');
      expect(bypassRec).toBeDefined();
      expect(bypassRec!.priority).toBe('medium');
    });

    it('should suggest resolution SLA for stale open violations', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({
        staleViolationCount: '15',
      }));
      service = new QualityGateTrendService(db);

      const recs = await service.getRecommendations();

      const slaRec = recs.find(r => r.category === 'resolution-sla');
      expect(slaRec).toBeDefined();
      expect(slaRec!.priority).toBe('medium');
    });

    it('should accept policyId parameter', async () => {
      const db = createSequentialMockDb(buildRecommendationResponses({}));
      service = new QualityGateTrendService(db);

      await service.getRecommendations('policy-1');

      // First query should contain policyId filter
      expect(db.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('e.policy_id = $2'),
        expect.arrayContaining([30, 'policy-1'])
      );
    });
  });
});
