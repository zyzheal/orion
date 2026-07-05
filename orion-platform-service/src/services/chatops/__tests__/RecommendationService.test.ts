/**
 * RecommendationService 单元测试
 *
 * 测试推荐面板聚合服务：数据聚合、缓存、数据转换。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import {
  RecommendationService,
  RealDataProvider,
  DataProvider,
  MockAlert,
  MockBlockedPipeline,
  MockFailedSelfHealing,
  MockCostAnomaly,
} from '../RecommendationService';

function createMockDataProvider(overrides: Partial<DataProvider> = {}): DataProvider {
  return {
    getActiveAlerts: jest.fn().mockResolvedValue([]),
    getBlockedPipelines: jest.fn().mockResolvedValue([]),
    getFailedSelfHealingExecutions: jest.fn().mockResolvedValue([]),
    getCostAnomalies: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('RecommendationService', () => {
  let service: RecommendationService;
  let mockProvider: DataProvider;

  const sampleAlerts: MockAlert[] = [
    { id: 'alert-1', severity: 'critical', title: 'CPU > 90%', message: 'node-3 CPU high', resource: 'node-3' },
    { id: 'alert-2', severity: 'warning', title: 'Memory > 80%', message: 'gateway mem high', resource: 'api-gateway' },
  ];

  const sampleBlocked: MockBlockedPipeline[] = [
    { pipelineId: '42', message: 'Waiting for approval', status: 'blocked' },
  ];

  const sampleSelfHealing: MockFailedSelfHealing[] = [
    { policyId: 'pol-1', policyName: 'Pod Restart', error: 'Retries exhausted', service: 'payment-service' },
  ];

  const sampleCostAnomalies: MockCostAnomaly[] = [
    { id: 'cost-1', service: 'data-pipeline', anomaly: 'Storage cost +300%', severity: 'warning' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider = createMockDataProvider();
    service = new RecommendationService(mockProvider);
  });

  describe('constructor', () => {
    it('should create service with data provider', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getRecommendations', () => {
    it('should aggregate all data sources', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockResolvedValue(sampleAlerts),
        getBlockedPipelines: jest.fn().mockResolvedValue(sampleBlocked),
        getFailedSelfHealingExecutions: jest.fn().mockResolvedValue(sampleSelfHealing),
        getCostAnomalies: jest.fn().mockResolvedValue(sampleCostAnomalies),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result).toHaveLength(5); // 2 alerts + 1 pipeline + 1 selfhealing + 1 cost
    });

    it('should return empty when no data', async () => {
      const result = await service.getRecommendations('user-1', 'admin');

      expect(result).toHaveLength(0);
    });

    it('should use cache on subsequent calls', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockResolvedValue(sampleAlerts),
      });
      service = new RecommendationService(mockProvider);

      const result1 = await service.getRecommendations('user-1', 'admin');
      const result2 = await service.getRecommendations('user-1', 'admin');

      expect(result1).toEqual(result2);
      // Data provider should only be called once (cache hit)
      expect(mockProvider.getActiveAlerts).toHaveBeenCalledTimes(1);
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result).toHaveLength(0);
    });

    it('should cache per role', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockResolvedValue(sampleAlerts),
      });
      service = new RecommendationService(mockProvider);

      await service.getRecommendations('user-1', 'admin');
      await service.getRecommendations('user-2', 'viewer');

      // Different roles should trigger different cache entries
      expect(mockProvider.getActiveAlerts).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateCache', () => {
    it('should clear cache for global keys', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockResolvedValue(sampleAlerts),
      });
      service = new RecommendationService(mockProvider);

      await service.getRecommendations('user-1', 'admin');
      service.invalidateCache('user-1');

      // Next call should hit provider again
      await service.getRecommendations('user-1', 'admin');

      expect(mockProvider.getActiveAlerts).toHaveBeenCalledTimes(2);
    });
  });

  describe('alertToRecommendation', () => {
    it('should convert alert to recommendation', async () => {
      mockProvider = createMockDataProvider({
        getActiveAlerts: jest.fn().mockResolvedValue([sampleAlerts[0]]),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result[0].id).toBe('alert:alert-1');
      expect(result[0].type).toBe('alert');
      expect(result[0].severity).toBe('critical');
      expect(result[0].title).toBe('CPU > 90%');
      expect(result[0].description).toBe('node-3 CPU high');
      expect(result[0].source).toBe('monitoring');
      expect(result[0].actions).toHaveLength(2);
      expect(result[0].actions[0].label).toBe('查看日志');
      expect(result[0].actions[1].label).toBe('诊断根因');
    });
  });

  describe('pipelineToRecommendation', () => {
    it('should convert blocked pipeline to recommendation', async () => {
      mockProvider = createMockDataProvider({
        getBlockedPipelines: jest.fn().mockResolvedValue(sampleBlocked),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result[0].id).toBe('pipeline:42');
      expect(result[0].type).toBe('blocked');
      expect(result[0].severity).toBe('warning');
      expect(result[0].title).toBe('Pipeline #42 等待确认');
      expect(result[0].source).toBe('pipeline');
      expect(result[0].actions).toHaveLength(2);
      expect(result[0].actions[0].label).toBe('批准');
      expect(result[0].actions[1].label).toBe('拒绝');
    });
  });

  describe('selfhealingToRecommendation', () => {
    it('should convert failed self-healing to recommendation', async () => {
      mockProvider = createMockDataProvider({
        getFailedSelfHealingExecutions: jest.fn().mockResolvedValue(sampleSelfHealing),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result[0].id).toBe('selfhealing:pol-1');
      expect(result[0].type).toBe('selfhealing');
      expect(result[0].severity).toBe('warning');
      expect(result[0].title).toBe('自愈失败: Pod Restart');
      expect(result[0].description).toBe('Retries exhausted');
      expect(result[0].source).toBe('selfhealing');
    });
  });

  describe('finopsToRecommendation', () => {
    it('should convert cost anomaly to recommendation', async () => {
      mockProvider = createMockDataProvider({
        getCostAnomalies: jest.fn().mockResolvedValue(sampleCostAnomalies),
      });
      service = new RecommendationService(mockProvider);

      const result = await service.getRecommendations('user-1', 'admin');

      expect(result[0].id).toBe('cost:cost-1');
      expect(result[0].type).toBe('cost_anomaly');
      expect(result[0].severity).toBe('warning');
      expect(result[0].title).toBe('成本异常: data-pipeline');
      expect(result[0].description).toBe('Storage cost +300%');
      expect(result[0].source).toBe('finops');
    });
  });
});

// ==================== RealDataProvider Tests ====================

describe('RealDataProvider', () => {
  let mockPool: any;
  let provider: RealDataProvider;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
  });

  describe('getActiveAlerts', () => {
    it('should return alerts from database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'alert-1', severity: 'critical', title: 'CPU High', message: 'CPU > 90%' },
          { id: 'alert-2', severity: 'warning', title: 'Memory High', message: 'Mem > 80%' },
        ],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getActiveAlerts();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('alert-1');
      expect(result[0].severity).toBe('critical');
      expect(result[0].title).toBe('CPU High');
      expect(result[0].message).toBe('CPU > 90%');
      expect(result[0].resource).toBe('CPU High');
    });

    it('should use tenant_id filter when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      provider = new RealDataProvider(mockPool, 'tenant-1');

      await provider.getActiveAlerts();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1'],
      );
    });

    it('should handle missing fields with defaults', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'alert-1', severity: null, title: null, message: null }],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getActiveAlerts();

      expect(result[0].severity).toBe('warning');
      expect(result[0].title).toBe('未知告警');
      expect(result[0].message).toBe('');
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('Table does not exist'));
      provider = new RealDataProvider(mockPool);

      const result = await provider.getActiveAlerts();

      expect(result).toEqual([]);
    });

    it('should return empty array on other database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));
      provider = new RealDataProvider(mockPool);

      const result = await provider.getActiveAlerts();

      expect(result).toEqual([]);
    });
  });

  describe('getBlockedPipelines', () => {
    it('should return blocked pipelines from database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'run-1', pipeline_id: 'pipe-1', status: 'pending', error_message: 'Waiting for approval' },
          { id: 'run-2', pipeline_id: 'pipe-2', status: 'running', error_message: null },
        ],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getBlockedPipelines();

      expect(result).toHaveLength(2);
      expect(result[0].pipelineId).toBe('run-1');
      expect(result[0].message).toBe('Waiting for approval');
      expect(result[0].status).toBe('blocked');
      expect(result[1].message).toBe('等待执行');
    });

    it('should use tenant_id filter when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      provider = new RealDataProvider(mockPool, 'tenant-1');

      await provider.getBlockedPipelines();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1'],
      );
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
      provider = new RealDataProvider(mockPool);

      const result = await provider.getBlockedPipelines();

      expect(result).toEqual([]);
    });
  });

  describe('getFailedSelfHealingExecutions', () => {
    it('should return failed self-healing executions from database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'incident-1', strategy_id: 'strat-1', strategy_name: 'Pod Restart', error: 'Max retries exceeded', app_name: 'payment-service' },
        ],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getFailedSelfHealingExecutions();

      expect(result).toHaveLength(1);
      expect(result[0].policyId).toBe('incident-1');
      expect(result[0].policyName).toBe('Pod Restart');
      expect(result[0].error).toBe('Max retries exceeded');
      expect(result[0].service).toBe('payment-service');
    });

    it('should handle missing fields with defaults', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'incident-1', strategy_id: null, strategy_name: null, error: null, app_name: null }],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getFailedSelfHealingExecutions();

      expect(result[0].policyName).toBe('未知策略');
      expect(result[0].error).toBe('未知错误');
      expect(result[0].service).toBe('unknown');
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
      provider = new RealDataProvider(mockPool);

      const result = await provider.getFailedSelfHealingExecutions();

      expect(result).toEqual([]);
    });
  });

  describe('getCostAnomalies', () => {
    it('should return cost anomalies from database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'rule-1', service: 'data-pipeline', severity: 'warning', condition: 'cost_increase', threshold: 100 },
          { id: 'rule-2', service: 'api-gateway', severity: 'critical', condition: 'latency_spike', threshold: 500 },
        ],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getCostAnomalies();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('rule-1');
      expect(result[0].service).toBe('data-pipeline');
      expect(result[0].anomaly).toBe('规则: cost_increase > 100');
      expect(result[0].severity).toBe('warning');
      expect(result[1].anomaly).toBe('规则: latency_spike > 500');
    });

    it('should handle missing fields with defaults', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'rule-1', service: null, severity: null, condition: null, threshold: null }],
      });
      provider = new RealDataProvider(mockPool);

      const result = await provider.getCostAnomalies();

      expect(result[0].service).toBe('unknown');
      expect(result[0].anomaly).toBe('规则: unknown > N/A');
      expect(result[0].severity).toBe('warning');
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
      provider = new RealDataProvider(mockPool);

      const result = await provider.getCostAnomalies();

      expect(result).toEqual([]);
    });
  });
});
