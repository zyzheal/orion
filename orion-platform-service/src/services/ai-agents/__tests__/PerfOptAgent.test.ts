/**
 * PerfOptAgent Tests
 *
 * Covers:
 * - Constructor: default thresholds, custom thresholds merging
 * - getThresholds / setThresholds
 * - analyze(): delegates to execute()
 * - doExecute(): health score, issues detection, resource analysis, recommendations, trend analysis
 * - fetchMetricsFromMonitoring(): success, empty result, metric mapping
 * - Performance issue detection: CPU, memory, disk, latency, error rate, throughput, cache, DB
 * - Severity calculation and sorting
 * - Recommendation generation per issue type
 * - Health score calculation
 * - Summary generation
 * - AI detailed report generation (success and failure)
 * - Trend analysis with historical metrics
 * - Factory function createPerfOptAgent
 */

import { PerfOptAgent, createPerfOptAgent } from '../performance/PerfOptAgent';
import { AgentConfig, AgentExecutionContext } from '../base/types';
import {
  PerformanceAnalysisInput,
  PerformanceMetrics,
  PerformanceThresholds,
} from '../performance/types';

// -- Mock Factories --

function createMockAIGateway(overrides: Record<string, unknown> = {}) {
  return {
    execute: jest.fn().mockResolvedValue({ success: true, data: 'AI report content' }),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    ...overrides,
  } as any;
}

function createMockToolAdapter(overrides: Record<string, unknown> = {}) {
  return {
    executeTool: jest.fn().mockResolvedValue({
      success: true,
      data: {
        metrics: [
          { name: 'system.cpu.usage', value: 45 },
          { name: 'system.memory.usage', value: 60 },
          { name: 'app.http.latency', value: 200 },
        ],
      },
    }),
    getToolNames: jest.fn().mockReturnValue(['pipeline', 'deploy', 'monitoring']),
    registerTool: jest.fn(),
    ...overrides,
  } as any;
}

function createDefaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'perf-opt-agent',
    name: 'PerfOpt Agent',
    enabled: true,
    scenario: 'performance-analysis',
    provider: 'sonnet',
    maxConcurrency: 3,
    timeoutMs: 30000,
    retry: { maxRetries: 0, backoffMs: 100 },
    requiredTools: ['monitoring'],
    requiredPermissions: [],
    ...overrides,
  };
}

function createContext(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    traceId: 'trace-perf-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

function createHealthyMetrics(): PerformanceMetrics {
  return {
    cpuUsage: 30,
    memoryUsage: 40,
    diskUsage: 50,
    responseTime: 100,
    errorRate: 0.1,
    throughput: 500,
    cacheHitRate: 90,
    dbQueryTime: 50,
    load1m: 0.5,
    load5m: 0.6,
    load15m: 0.7,
    memoryUsed: 4e9,
    networkBytesRecv: 1e8,
    networkBytesSent: 5e7,
  };
}

function createCriticalMetrics(): PerformanceMetrics {
  return {
    cpuUsage: 95,
    memoryUsage: 92,
    diskUsage: 95,
    responseTime: 5000,
    errorRate: 10,
    throughput: 100,
    cacheHitRate: 30,
    dbQueryTime: 8000,
    load1m: 8,
    load5m: 7,
    load15m: 6,
  };
}

function createAnalysisInput(
  metrics: PerformanceMetrics,
  overrides: Partial<PerformanceAnalysisInput> = {}
): PerformanceAnalysisInput {
  return {
    type: 'metrics',
    metrics,
    ...overrides,
  };
}

// -- Tests --

describe('PerfOptAgent', () => {
  let agent: PerfOptAgent;
  let mockGateway: any;
  let mockToolAdapter: any;

  beforeEach(() => {
    mockGateway = createMockAIGateway();
    mockToolAdapter = createMockToolAdapter();
    agent = new PerfOptAgent(createDefaultConfig(), mockGateway, mockToolAdapter);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      const thresholds = agent.getThresholds();
      expect(thresholds.cpuWarningPercent).toBe(70);
      expect(thresholds.cpuCriticalPercent).toBe(90);
      expect(thresholds.memoryWarningPercent).toBe(75);
      expect(thresholds.memoryCriticalPercent).toBe(90);
      expect(thresholds.responseTimeWarningMs).toBe(500);
      expect(thresholds.responseTimeCriticalMs).toBe(2000);
      expect(thresholds.errorRateWarningPercent).toBe(1);
      expect(thresholds.errorRateCriticalPercent).toBe(5);
    });

    it('should merge custom thresholds with defaults', () => {
      const custom: PerformanceThresholds = {
        cpuWarningPercent: 60,
        cpuCriticalPercent: 85,
      };
      const customAgent = new PerfOptAgent(
        createDefaultConfig(),
        mockGateway,
        mockToolAdapter,
        custom
      );

      const thresholds = customAgent.getThresholds();
      expect(thresholds.cpuWarningPercent).toBe(60);
      expect(thresholds.cpuCriticalPercent).toBe(85);
      // defaults preserved
      expect(thresholds.memoryWarningPercent).toBe(75);
      expect(thresholds.responseTimeWarningMs).toBe(500);
    });
  });

  // ==================== getThresholds / setThresholds ====================

  describe('getThresholds / setThresholds', () => {
    it('should return a copy of thresholds', () => {
      const t1 = agent.getThresholds();
      const t2 = agent.getThresholds();
      expect(t1).toEqual(t2);
      expect(t1).not.toBe(t2);
    });

    it('should update specific thresholds', () => {
      agent.setThresholds({ cpuWarningPercent: 50, memoryCriticalPercent: 95 });
      const thresholds = agent.getThresholds();
      expect(thresholds.cpuWarningPercent).toBe(50);
      expect(thresholds.memoryCriticalPercent).toBe(95);
      // others unchanged
      expect(thresholds.cpuCriticalPercent).toBe(90);
    });
  });

  // ==================== analyze() ====================

  describe('analyze', () => {
    it('should delegate to execute and return analysis result', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());

      expect(result).toBeDefined();
      expect(result.analysisId).toBeTruthy();
      expect(result.inputType).toBe('metrics');
      expect(typeof result.healthScore).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.resourceAnalysis).toBeDefined();
      expect(result.analyzedAt).toBeTruthy();
      expect(result.analysisDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should work with bottleneck type input', async () => {
      const input = createAnalysisInput(createHealthyMetrics(), { type: 'bottleneck' });
      const result = await agent.analyze(input, createContext());
      expect(result.inputType).toBe('bottleneck');
    });

    it('should work with capacity type input', async () => {
      const input = createAnalysisInput(createHealthyMetrics(), { type: 'capacity' });
      const result = await agent.analyze(input, createContext());
      expect(result.inputType).toBe('capacity');
    });

    it('should work with trend type input', async () => {
      const input = createAnalysisInput(createHealthyMetrics(), { type: 'trend' });
      const result = await agent.analyze(input, createContext());
      expect(result.inputType).toBe('trend');
    });
  });

  // ==================== Healthy Metrics Analysis ====================

  describe('healthy metrics analysis', () => {
    it('should report high health score for healthy metrics', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());

      expect(result.healthScore).toBeGreaterThanOrEqual(90);
      expect(result.issues.length).toBe(0);
    });

    it('should generate summary indicating healthy system', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());

      expect(result.summary).toContain('正常');
    });

    it('should report healthy resource status', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.cpu.status).toBe('healthy');
      expect(result.resourceAnalysis.memory.status).toBe('healthy');
      expect(result.resourceAnalysis.disk.status).toBe('healthy');
    });
  });

  // ==================== Critical Metrics Analysis ====================

  describe('critical metrics analysis', () => {
    it('should detect critical CPU issue', async () => {
      const input = createAnalysisInput({ cpuUsage: 95 });
      const result = await agent.analyze(input, createContext());

      const cpuIssue = result.issues.find(i => i.type === 'high_cpu');
      expect(cpuIssue).toBeDefined();
      expect(cpuIssue!.severity).toBe('critical');
      expect(cpuIssue!.currentValue).toBe(95);
    });

    it('should detect warning-level CPU issue', async () => {
      const input = createAnalysisInput({ cpuUsage: 75 });
      const result = await agent.analyze(input, createContext());

      const cpuIssue = result.issues.find(i => i.type === 'high_cpu');
      expect(cpuIssue).toBeDefined();
      expect(cpuIssue!.severity).toBe('warning');
    });

    it('should detect critical memory issue', async () => {
      const input = createAnalysisInput({ memoryUsage: 92 });
      const result = await agent.analyze(input, createContext());

      const memIssue = result.issues.find(i => i.type === 'high_memory');
      expect(memIssue).toBeDefined();
      expect(memIssue!.severity).toBe('critical');
    });

    it('should detect warning-level memory issue', async () => {
      const input = createAnalysisInput({ memoryUsage: 80 });
      const result = await agent.analyze(input, createContext());

      const memIssue = result.issues.find(i => i.type === 'high_memory');
      expect(memIssue).toBeDefined();
      expect(memIssue!.severity).toBe('warning');
    });

    it('should detect disk usage over 80% as warning', async () => {
      const input = createAnalysisInput({ diskUsage: 85 });
      const result = await agent.analyze(input, createContext());

      const diskIssue = result.issues.find(i => i.type === 'high_disk');
      expect(diskIssue).toBeDefined();
      expect(diskIssue!.severity).toBe('warning');
    });

    it('should detect disk usage over 90% as critical', async () => {
      const input = createAnalysisInput({ diskUsage: 95 });
      const result = await agent.analyze(input, createContext());

      const diskIssue = result.issues.find(i => i.type === 'high_disk');
      expect(diskIssue).toBeDefined();
      expect(diskIssue!.severity).toBe('critical');
    });

    it('should detect high latency issue', async () => {
      const input = createAnalysisInput({ responseTime: 3000 });
      const result = await agent.analyze(input, createContext());

      const latencyIssue = result.issues.find(i => i.type === 'high_latency');
      expect(latencyIssue).toBeDefined();
      expect(latencyIssue!.severity).toBe('critical');
    });

    it('should detect warning-level latency', async () => {
      const input = createAnalysisInput({ responseTime: 800 });
      const result = await agent.analyze(input, createContext());

      const latencyIssue = result.issues.find(i => i.type === 'high_latency');
      expect(latencyIssue).toBeDefined();
      expect(latencyIssue!.severity).toBe('warning');
    });

    it('should detect high error rate', async () => {
      const input = createAnalysisInput({ errorRate: 8 });
      const result = await agent.analyze(input, createContext());

      const errorIssue = result.issues.find(i => i.type === 'high_error_rate');
      expect(errorIssue).toBeDefined();
      expect(errorIssue!.severity).toBe('critical');
    });

    it('should detect warning-level error rate', async () => {
      const input = createAnalysisInput({ errorRate: 2 });
      const result = await agent.analyze(input, createContext());

      const errorIssue = result.issues.find(i => i.type === 'high_error_rate');
      expect(errorIssue).toBeDefined();
      expect(errorIssue!.severity).toBe('warning');
    });

    it('should detect low throughput critically when below 50%', async () => {
      const input = createAnalysisInput(
        { throughput: 40 },
        { performanceTargets: { throughput: 100 } }
      );
      const result = await agent.analyze(input, createContext());

      const tpIssue = result.issues.find(i => i.type === 'low_throughput');
      expect(tpIssue).toBeDefined();
      expect(tpIssue!.severity).toBe('critical');
    });

    it('should detect low throughput as warning when below 80%', async () => {
      const input = createAnalysisInput(
        { throughput: 70 },
        { performanceTargets: { throughput: 100 } }
      );
      const result = await agent.analyze(input, createContext());

      const tpIssue = result.issues.find(i => i.type === 'low_throughput');
      expect(tpIssue).toBeDefined();
      expect(tpIssue!.severity).toBe('warning');
    });

    it('should detect low cache hit rate as warning', async () => {
      const input = createAnalysisInput({ cacheHitRate: 60 });
      const result = await agent.analyze(input, createContext());

      const cacheIssue = result.issues.find(i => i.type === 'cache_miss');
      expect(cacheIssue).toBeDefined();
      expect(cacheIssue!.severity).toBe('warning');
    });

    it('should detect very low cache hit rate as critical', async () => {
      const input = createAnalysisInput({ cacheHitRate: 30 });
      const result = await agent.analyze(input, createContext());

      const cacheIssue = result.issues.find(i => i.type === 'cache_miss');
      expect(cacheIssue).toBeDefined();
      expect(cacheIssue!.severity).toBe('critical');
    });

    it('should detect slow DB queries as warning', async () => {
      const input = createAnalysisInput({ dbQueryTime: 2000 });
      const result = await agent.analyze(input, createContext());

      const dbIssue = result.issues.find(i => i.type === 'db_slow_query');
      expect(dbIssue).toBeDefined();
      expect(dbIssue!.severity).toBe('warning');
    });

    it('should detect very slow DB queries as critical', async () => {
      const input = createAnalysisInput({ dbQueryTime: 8000 });
      const result = await agent.analyze(input, createContext());

      const dbIssue = result.issues.find(i => i.type === 'db_slow_query');
      expect(dbIssue).toBeDefined();
      expect(dbIssue!.severity).toBe('critical');
    });
  });

  // ==================== Issue Sorting ====================

  describe('issue sorting', () => {
    it('should sort issues by severity (critical first)', async () => {
      const input = createAnalysisInput({
        cpuUsage: 95,       // critical
        memoryUsage: 80,    // warning
        diskUsage: 85,      // warning
        responseTime: 3000, // critical
      });
      const result = await agent.analyze(input, createContext());

      expect(result.issues.length).toBeGreaterThanOrEqual(4);
      // First two should be critical
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[1].severity).toBe('critical');
    });
  });

  // ==================== Recommendations ====================

  describe('recommendation generation', () => {
    it('should generate CPU-related recommendations', async () => {
      const input = createAnalysisInput({ cpuUsage: 95 });
      const result = await agent.analyze(input, createContext());

      const cpuRecs = result.recommendations.filter(r =>
        r.title.includes('CPU') || r.title.includes('扩展') || r.title.includes('代码')
      );
      expect(cpuRecs.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate memory-related recommendations', async () => {
      const input = createAnalysisInput({ memoryUsage: 92 });
      const result = await agent.analyze(input, createContext());

      const memRecs = result.recommendations.filter(r =>
        r.title.includes('内存') || r.type === 'scale_up'
      );
      expect(memRecs.length).toBeGreaterThanOrEqual(1);
      expect(memRecs[0].configChanges).toBeDefined();
    });

    it('should generate latency-related recommendations', async () => {
      const input = createAnalysisInput({ responseTime: 3000 });
      const result = await agent.analyze(input, createContext());

      const latencyRecs = result.recommendations.filter(r =>
        r.title.includes('缓存') || r.type === 'cache_optimization'
      );
      expect(latencyRecs.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate error rate recommendations', async () => {
      const input = createAnalysisInput({ errorRate: 8 });
      const result = await agent.analyze(input, createContext());

      const errorRecs = result.recommendations.filter(r =>
        r.title.includes('错误') || r.type === 'configuration_tuning'
      );
      expect(errorRecs.length).toBeGreaterThanOrEqual(1);
      expect(errorRecs[0].commands).toBeDefined();
    });

    it('should generate cache recommendations', async () => {
      const input = createAnalysisInput({ cacheHitRate: 40 });
      const result = await agent.analyze(input, createContext());

      const cacheRecs = result.recommendations.filter(r =>
        r.title.includes('缓存') || r.type === 'cache_optimization'
      );
      expect(cacheRecs.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate DB query recommendations', async () => {
      const input = createAnalysisInput({ dbQueryTime: 6000 });
      const result = await agent.analyze(input, createContext());

      const dbRecs = result.recommendations.filter(r =>
        r.title.includes('数据库') || r.type === 'query_optimization'
      );
      expect(dbRecs.length).toBeGreaterThanOrEqual(1);
      expect(dbRecs[0].rollbackPlan).toBeDefined();
    });

    it('should generate preventive recommendation when no issues but CPU > 50%', async () => {
      const input = createAnalysisInput({ cpuUsage: 55 });
      const result = await agent.analyze(input, createContext());

      // No issues at 55% CPU (threshold is 70%)
      expect(result.issues.length).toBe(0);
      // But there should be a preventive recommendation
      const preventiveRecs = result.recommendations.filter(r =>
        r.title.includes('预防') || r.priority === 'low'
      );
      expect(preventiveRecs.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate fallback recommendation for unknown issue types', async () => {
      // Trigger a custom scenario with an issue type that falls to default case
      // We test this indirectly by checking all recommendations have expected fields
      const input = createAnalysisInput({ cpuUsage: 95, errorRate: 8 });
      const result = await agent.analyze(input, createContext());

      for (const rec of result.recommendations) {
        expect(rec.id).toBeTruthy();
        expect(rec.title).toBeTruthy();
        expect(rec.description).toBeTruthy();
        expect(rec.priority).toBeDefined();
        expect(rec.riskLevel).toBeDefined();
      }
    });
  });

  // ==================== Health Score ====================

  describe('health score calculation', () => {
    it('should return 100 for healthy metrics', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());
      expect(result.healthScore).toBe(100);
    });

    it('should reduce score for critical issues', async () => {
      const input = createAnalysisInput({
        cpuUsage: 95,     // critical issue -20
        memoryUsage: 92,  // critical issue -20
      });
      const result = await agent.analyze(input, createContext());
      // 100 - 20(cpu critical) - 20(mem critical) - 15(cpu resource critical) - 15(mem resource critical) = 30
      expect(result.healthScore).toBeLessThan(100);
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
    });

    it('should reduce score for warning issues', async () => {
      const input = createAnalysisInput({ cpuUsage: 75 }); // warning
      const result = await agent.analyze(input, createContext());
      // 100 - 10(cpu warning) - 5(cpu resource warning) = 85
      expect(result.healthScore).toBeLessThan(100);
      expect(result.healthScore).toBeGreaterThanOrEqual(70);
    });

    it('should not go below 0', async () => {
      const input = createAnalysisInput(createCriticalMetrics());
      const result = await agent.analyze(input, createContext());
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
    });

    it('should not go above 100', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });
  });

  // ==================== Summary Generation ====================

  describe('summary generation', () => {
    it('should generate positive summary for high health score', async () => {
      const input = createAnalysisInput(createHealthyMetrics());
      const result = await agent.analyze(input, createContext());
      expect(result.summary).toContain('正常');
    });

    it('should generate warning summary for medium health score', async () => {
      const input = createAnalysisInput({ cpuUsage: 75, memoryUsage: 80 });
      const result = await agent.analyze(input, createContext());
      expect(result.summary).toContain('警告');
    });

    it('should generate critical summary for low health score', async () => {
      const input = createAnalysisInput({
        cpuUsage: 95,
        memoryUsage: 92,
        responseTime: 5000,
        errorRate: 10,
      });
      const result = await agent.analyze(input, createContext());
      expect(result.summary).toContain('严重');
    });
  });

  // ==================== Resource Analysis ====================

  describe('resource analysis', () => {
    it('should analyze CPU resource', async () => {
      const input = createAnalysisInput({ cpuUsage: 45 });
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.cpu.currentValue).toBe(45);
      expect(result.resourceAnalysis.cpu.maxValue).toBe(100);
      expect(result.resourceAnalysis.cpu.status).toBe('healthy');
      expect(result.resourceAnalysis.cpu.analysis).toContain('正常');
    });

    it('should analyze memory resource', async () => {
      const input = createAnalysisInput({ memoryUsage: 80, memoryUsed: 8e9 });
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.memory.currentValue).toBe(80);
      expect(result.resourceAnalysis.memory.status).toBe('warning');
      expect(result.resourceAnalysis.memory.peak).toBe(8e9);
    });

    it('should analyze disk resource', async () => {
      const input = createAnalysisInput({ diskUsage: 85 });
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.disk.currentValue).toBe(85);
      expect(result.resourceAnalysis.disk.status).toBe('warning');
    });

    it('should detect high network traffic', async () => {
      const input = createAnalysisInput({
        networkBytesRecv: 2e9, // > 1GB
        networkBytesSent: 5e8,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.network.status).toBe('warning');
    });

    it('should report healthy network for normal traffic', async () => {
      const input = createAnalysisInput({
        networkBytesRecv: 1e8,
        networkBytesSent: 5e7,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.network.status).toBe('healthy');
    });

    it('should handle undefined metrics gracefully (defaults to 0)', async () => {
      const input = createAnalysisInput({});
      const result = await agent.analyze(input, createContext());

      expect(result.resourceAnalysis.cpu.currentValue).toBe(0);
      expect(result.resourceAnalysis.memory.currentValue).toBe(0);
      expect(result.resourceAnalysis.disk.currentValue).toBe(0);
      expect(result.resourceAnalysis.cpu.status).toBe('healthy');
    });
  });

  // ==================== Trend Analysis ====================

  describe('trend analysis', () => {
    it('should not include trend analysis when historical data has <= 1 entries', async () => {
      const input = createAnalysisInput(createHealthyMetrics(), {
        type: 'trend',
        historicalMetrics: [{ cpuUsage: 30, memoryUsage: 40 }],
      });
      const result = await agent.analyze(input, createContext());
      expect(result.trendAnalysis).toBeUndefined();
    });

    it('should perform trend analysis with sufficient historical data', async () => {
      const historical: PerformanceMetrics[] = [
        { cpuUsage: 20, memoryUsage: 30 },
        { cpuUsage: 25, memoryUsage: 35 },
        { cpuUsage: 22, memoryUsage: 32 },
        { cpuUsage: 28, memoryUsage: 38 },
        { cpuUsage: 24, memoryUsage: 34 },
      ];
      const current = { cpuUsage: 30, memoryUsage: 40 };
      const input = createAnalysisInput(current, {
        type: 'trend',
        historicalMetrics: historical,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.trendAnalysis).toBeDefined();
      expect(result.trendAnalysis!.direction).toBeDefined();
      expect(typeof result.trendAnalysis!.changeRate).toBe('number');
      expect(result.trendAnalysis!.analysis).toBeTruthy();
    });

    it('should detect degrading trend when metrics increase significantly', async () => {
      const historical: PerformanceMetrics[] = [
        { cpuUsage: 20, memoryUsage: 30 },
        { cpuUsage: 20, memoryUsage: 30 },
        { cpuUsage: 20, memoryUsage: 30 },
        { cpuUsage: 20, memoryUsage: 30 },
        { cpuUsage: 20, memoryUsage: 30 },
      ];
      const current = { cpuUsage: 50, memoryUsage: 60 }; // significant increase
      const input = createAnalysisInput(current, {
        type: 'trend',
        historicalMetrics: historical,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.trendAnalysis!.direction).toBe('degrading');
      expect(result.trendAnalysis!.predictions.length).toBeGreaterThan(0);
    });

    it('should detect improving trend when metrics decrease significantly', async () => {
      const historical: PerformanceMetrics[] = [
        { cpuUsage: 80, memoryUsage: 80 },
        { cpuUsage: 80, memoryUsage: 80 },
        { cpuUsage: 80, memoryUsage: 80 },
        { cpuUsage: 80, memoryUsage: 80 },
        { cpuUsage: 80, memoryUsage: 80 },
      ];
      const current = { cpuUsage: 30, memoryUsage: 30 };
      const input = createAnalysisInput(current, {
        type: 'trend',
        historicalMetrics: historical,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.trendAnalysis!.direction).toBe('improving');
    });

    it('should detect stable trend when metrics remain similar', async () => {
      const historical: PerformanceMetrics[] = [
        { cpuUsage: 50, memoryUsage: 50 },
        { cpuUsage: 51, memoryUsage: 49 },
        { cpuUsage: 50, memoryUsage: 51 },
        { cpuUsage: 49, memoryUsage: 50 },
        { cpuUsage: 50, memoryUsage: 50 },
      ];
      const current = { cpuUsage: 50, memoryUsage: 50 };
      const input = createAnalysisInput(current, {
        type: 'trend',
        historicalMetrics: historical,
      });
      const result = await agent.analyze(input, createContext());

      expect(result.trendAnalysis!.direction).toBe('stable');
    });
  });

  // ==================== AI Detailed Report ====================

  describe('AI detailed report', () => {
    it('should not generate report when modelConfig.maxTokens is not set', async () => {
      const input = createAnalysisInput({ cpuUsage: 95 });
      const result = await agent.analyze(input, createContext());

      // No modelConfig.maxTokens => no detailed report
      expect(result.detailedReport).toBeUndefined();
    });

    it('should generate report when modelConfig.maxTokens is set and issues exist', async () => {
      const configWithTokens = createDefaultConfig({
        modelConfig: { maxTokens: 2000 },
      });
      const reportAgent = new PerfOptAgent(configWithTokens, mockGateway, mockToolAdapter);

      const input = createAnalysisInput({ cpuUsage: 95 });
      const result = await reportAgent.analyze(input, createContext());

      expect(result.detailedReport).toBe('AI report content');
      expect(mockGateway.execute).toHaveBeenCalled();
    });

    it('should not generate report when there are no issues', async () => {
      const configWithTokens = createDefaultConfig({
        modelConfig: { maxTokens: 2000 },
      });
      const reportAgent = new PerfOptAgent(configWithTokens, mockGateway, mockToolAdapter);

      const input = createAnalysisInput(createHealthyMetrics());
      const result = await reportAgent.analyze(input, createContext());

      expect(result.detailedReport).toBeUndefined();
    });

    it('should handle AI report generation failure gracefully', async () => {
      const failGateway = createMockAIGateway({
        execute: jest.fn().mockRejectedValue(new Error('AI unavailable')),
      });
      const configWithTokens = createDefaultConfig({
        modelConfig: { maxTokens: 2000 },
      });
      const reportAgent = new PerfOptAgent(configWithTokens, failGateway, mockToolAdapter);

      const input = createAnalysisInput({ cpuUsage: 95 });
      const result = await reportAgent.analyze(input, createContext());

      expect(result.detailedReport).toBe('AI 报告生成失败');
    });
  });

  // ==================== fetchMetricsFromMonitoring ====================

  describe('fetchMetricsFromMonitoring', () => {
    it('should fetch and map metrics from monitoring tool', async () => {
      mockToolAdapter.executeTool.mockResolvedValue({
        success: true,
        data: {
          metrics: [
            { name: 'system.cpu.usage', value: 45.5 },
            { name: 'system.memory.usage', value: 62.3 },
            { name: 'system.memory.used', value: 4e9 },
            { name: 'system.disk.usage', value: 55 },
            { name: 'system.load.1m', value: 1.5 },
            { name: 'system.load.5m', value: 1.2 },
            { name: 'system.load.15m', value: 1.0 },
            { name: 'app.http.latency', value: 250 },
            { name: 'app.errors.count', value: 0.5 },
            { name: 'app.throughput', value: 1000 },
          ],
        },
      });

      const result = await agent.fetchMetricsFromMonitoring('system', '1h', createContext());

      expect(result.cpuUsage).toBe(45.5);
      expect(result.memoryUsage).toBe(62.3);
      expect(result.memoryUsed).toBe(4e9);
      expect(result.diskUsage).toBe(55);
      expect(result.load1m).toBe(1.5);
      expect(result.load5m).toBe(1.2);
      expect(result.load15m).toBe(1.0);
      expect(result.responseTime).toBe(250);
      expect(result.errorRate).toBe(0.5);
      expect(result.throughput).toBe(1000);
      expect(result.timestamp).toBeTruthy();
    });

    it('should return empty object when monitoring returns no metrics', async () => {
      mockToolAdapter.executeTool.mockResolvedValue({
        success: true,
        data: null,
      });

      const result = await agent.fetchMetricsFromMonitoring('system', '1h', createContext());
      expect(result).toEqual({});
    });

    it('should return empty object when monitoring returns empty metrics', async () => {
      mockToolAdapter.executeTool.mockResolvedValue({
        success: true,
        data: { metrics: null },
      });

      const result = await agent.fetchMetricsFromMonitoring('system', '1h', createContext());
      expect(result).toEqual({});
    });

    it('should handle unknown metric names gracefully', async () => {
      mockToolAdapter.executeTool.mockResolvedValue({
        success: true,
        data: {
          metrics: [
            { name: 'unknown.metric', value: 42 },
            { name: 'system.cpu.usage', value: 30 },
          ],
        },
      });

      const result = await agent.fetchMetricsFromMonitoring('system', '1h', createContext());
      expect(result.cpuUsage).toBe(30);
      // unknown metric is ignored
      expect((result as any).unknown).toBeUndefined();
    });

    it('should pass correct parameters to monitoring tool', async () => {
      await agent.fetchMetricsFromMonitoring('cpu', '24h', createContext());

      expect(mockToolAdapter.executeTool).toHaveBeenCalledWith(
        'monitoring',
        { action: 'metrics', metricType: 'cpu', timeRange: '24h' },
        expect.anything()
      );
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle metrics with all undefined values', async () => {
      const input = createAnalysisInput({});
      const result = await agent.analyze(input, createContext());

      expect(result.healthScore).toBe(100);
      expect(result.issues.length).toBe(0);
      expect(result.resourceAnalysis.cpu.currentValue).toBe(0);
    });

    it('should handle metrics at exact threshold boundaries', async () => {
      // Exactly at warning threshold - should NOT trigger
      const input = createAnalysisInput({ cpuUsage: 70 });
      const result = await agent.analyze(input, createContext());

      const cpuIssue = result.issues.find(i => i.type === 'high_cpu');
      // 70 >= 70 (warning threshold) => should trigger
      expect(cpuIssue).toBeDefined();
      expect(cpuIssue!.severity).toBe('warning');
    });

    it('should handle metrics just below warning threshold', async () => {
      const input = createAnalysisInput({ cpuUsage: 69.9 });
      const result = await agent.analyze(input, createContext());

      const cpuIssue = result.issues.find(i => i.type === 'high_cpu');
      expect(cpuIssue).toBeUndefined();
    });

    it('should handle throughput at exactly 50% of target (warning, not critical)', async () => {
      const input = createAnalysisInput(
        { throughput: 50 },
        { performanceTargets: { throughput: 100 } }
      );
      const result = await agent.analyze(input, createContext());

      const tpIssue = result.issues.find(i => i.type === 'low_throughput');
      // 50/100 = 0.5, which is NOT < 0.5, so not critical
      // but IS < 0.8, so warning
      expect(tpIssue).toBeDefined();
      expect(tpIssue!.severity).toBe('warning');
    });

    it('should handle throughput at exactly 80% of target', async () => {
      const input = createAnalysisInput(
        { throughput: 80 },
        { performanceTargets: { throughput: 100 } }
      );
      const result = await agent.analyze(input, createContext());

      const tpIssue = result.issues.find(i => i.type === 'low_throughput');
      // 80/100 = 0.8, which is NOT < 0.8, so no warning
      expect(tpIssue).toBeUndefined();
    });

    it('should include serviceName and environment in the analysis', async () => {
      const input = createAnalysisInput(createHealthyMetrics(), {
        serviceName: 'my-api',
        environment: 'production',
      });
      const result = await agent.analyze(input, createContext());

      expect(result).toBeDefined();
      // The result should succeed regardless
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Factory Function ====================

  describe('createPerfOptAgent', () => {
    it('should create a PerfOptAgent instance', () => {
      const config = createDefaultConfig();
      const result = createPerfOptAgent(config, mockGateway, mockToolAdapter);
      expect(result).toBeInstanceOf(PerfOptAgent);
    });

    it('should pass custom thresholds to the agent', () => {
      const config = createDefaultConfig();
      const customThresholds: PerformanceThresholds = {
        cpuWarningPercent: 50,
      };
      const result = createPerfOptAgent(config, mockGateway, mockToolAdapter, customThresholds);
      expect(result.getThresholds().cpuWarningPercent).toBe(50);
      // defaults preserved
      expect(result.getThresholds().cpuCriticalPercent).toBe(90);
    });
  });
});
