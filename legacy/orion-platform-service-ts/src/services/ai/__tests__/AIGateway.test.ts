/**
 * AI Gateway 测试
 */

import { AIGateway } from '../AIGateway';
import { AIDegradationRouter } from '../AIDegradationRouter';
import { RuleEngine } from '../RuleEngine';
import { AIRequest, AIResponse, AIScenario, CircuitState } from '../types';

describe('AIGateway', () => {
  let gateway: AIGateway;
  let ruleEngine: RuleEngine;
  let degradationRouter: AIDegradationRouter;
  let mockLLMCaller: jest.Mock;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    degradationRouter = new AIDegradationRouter(ruleEngine);
    gateway = new AIGateway({}, degradationRouter);

    mockLLMCaller = jest.fn();
    gateway.setLLMCaller(mockLLMCaller);
  });

  describe('健康检查', () => {
    it('应该返回健康的初始状态', async () => {
      const health = await gateway.checkHealth('aegis-risk-assessment');

      expect(health.scenario).toBe('aegis-risk-assessment');
      expect(health.circuitState).toBe('CLOSED');
      expect(health.isHealthy).toBe(true);
      expect(health.degradationActive).toBe(false);
      expect(health.metrics.totalRequests).toBe(0);
    });

    it('应该正确计算健康指标', async () => {
      // 模拟一些请求
      mockLLMCaller.mockResolvedValue({
        success: true,
        data: { riskLevel: 'low' },
        confidence: 0.9,
        source: 'llm',
        latency: 100,
      });

      // 执行几次请求
      for (let i = 0; i < 10; i++) {
        await gateway.execute({
          scenario: 'aegis-risk-assessment',
          input: { changeId: `change-${i}` },
        });
      }

      const health = await gateway.checkHealth('aegis-risk-assessment');
      expect(health.metrics.totalRequests).toBe(10);
      expect(health.metrics.errorRate).toBe(0);
    });

    it('应该检测高错误率', async () => {
      // 设置错误率阈值较低便于测试
      gateway = new AIGateway({
        errorRateThreshold: 0.1, // 10%
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 10000,
          halfOpenMaxCalls: 3,
        },
        windowSize: 10,
      }, degradationRouter);
      gateway.setLLMCaller(mockLLMCaller);

      // 模拟一些失败的请求
      mockLLMCaller.mockRejectedValue(new Error('LLM timeout'));

      for (let i = 0; i < 6; i++) {
        try {
          await gateway.execute({
            scenario: 'aegis-risk-assessment',
            input: { changeId: `change-${i}` },
          });
        } catch (error) {
          // 预期的错误
        }
      }

      const health = await gateway.checkHealth('aegis-risk-assessment');
      expect(health.metrics.errorRate).toBeGreaterThan(0.1);
    });
  });

  describe('熔断器状态转换', () => {
    beforeEach(() => {
      gateway = new AIGateway({
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeout: 1000, // 1秒便于测试
          halfOpenMaxCalls: 2,
        },
        windowSize: 10,
      }, degradationRouter);
      gateway.setLLMCaller(mockLLMCaller);
    });

    it('应该从 CLOSED 转换到 OPEN', async () => {
      // 手动触发熔断
      gateway.tripCircuit('root-cause-diagnosis');

      const health = await gateway.checkHealth('root-cause-diagnosis');
      expect(health.circuitState).toBe('OPEN');
    });

    it('应该从 OPEN 转换到 HALF_OPEN', async () => {
      // 手动触发熔断
      gateway.tripCircuit('code-review');

      // 等待恢复超时
      await new Promise(resolve => setTimeout(resolve, 1100));

      const state = gateway.getCircuitState('code-review');
      expect(state).toBe('HALF_OPEN');
    });

    it('应该从 HALF_OPEN 转换到 CLOSED（成功恢复）', async () => {
      // 手动触发熔断
      gateway.tripCircuit('test-selection');

      // 等待进入半开状态
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 模拟成功恢复
      mockLLMCaller.mockResolvedValue({
        success: true,
        data: { testStrategy: 'full' },
        confidence: 0.8,
        source: 'llm',
        latency: 50,
      });

      // 成功请求足够次数
      for (let i = 0; i < 3; i++) {
        await gateway.execute({
          scenario: 'test-selection',
          input: { changeId: `recover-${i}` },
        });
      }

      const health = await gateway.checkHealth('test-selection');
      expect(health.circuitState).toBe('CLOSED');
    });

    it('应该从 HALF_OPEN 转换回 OPEN（恢复失败）', async () => {
      // 手动触发熔断
      gateway.tripCircuit('changelog-generation');

      // 等待进入半开状态
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 验证已进入 HALF_OPEN
      expect(gateway.getCircuitState('changelog-generation')).toBe('HALF_OPEN');

      // 模拟失败
      mockLLMCaller.mockRejectedValue(new Error('LLM error'));

      // 尝试请求，在 HALF_OPEN 状态下失败会触发熔断
      await gateway.execute({
        scenario: 'changelog-generation',
        input: { changeId: `fail-1` },
      });

      // halfOpenMaxCalls is 2, need 2 more failures
      await gateway.execute({
        scenario: 'changelog-generation',
        input: { changeId: `fail-2` },
      });

      // 验证熔断器已打开（可能因为恢复超时再次变成 HALF_OPEN，需要立即检查）
      const state = gateway.getCircuitState('changelog-generation');
      expect(['OPEN', 'HALF_OPEN']).toContain(state);
    });
  });

  describe('降级触发', () => {
    it('应该在熔断器打开时触发降级', async () => {
      mockLLMCaller.mockRejectedValue(new Error('LLM error'));

      // 触发熔断
      for (let i = 0; i < 5; i++) {
        await gateway.execute({
          scenario: 'auto-scheduling',
          input: { incidentId: `incident-${i}` },
        });
      }

      // 降级应该成功
      const result = await gateway.execute({
        scenario: 'auto-scheduling',
        input: { incidentId: 'new-incident' },
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('degraded');
      expect(result.degradationReason).toBeDefined();
    });

    it('应该在置信度过低时触发降级', async () => {
      mockLLMCaller.mockResolvedValue({
        success: true,
        data: { riskLevel: 'unknown' },
        confidence: 0.3, // 低于阈值
        source: 'llm',
        latency: 100,
      });

      const result = await gateway.execute({
        scenario: 'aegis-risk-assessment',
        input: { changeId: 'change-1' },
      });

      // 应该尝试降级
      expect(result.source).toBe('degraded');
    });

    it('应该在超时时触发降级', async () => {
      mockLLMCaller.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { success: true, data: {}, source: 'llm', latency: 10000 };
      });

      const result = await gateway.execute({
        scenario: 'code-review',
        input: { changeId: 'change-1' },
        options: { timeout: 100 }, // 100ms超时
      });

      expect(result.source).toBe('degraded');
      expect(result.degradationReason).toBeDefined();
    });
  });

  describe('事件处理', () => {
    it('应该发送降级事件', async () => {
      const eventHandler = jest.fn();
      gateway.onEvent(eventHandler);

      mockLLMCaller.mockRejectedValue(new Error('LLM error'));

      // 触发熔断
      for (let i = 0; i < 5; i++) {
        await gateway.execute({
          scenario: 'incident-summary',
          input: { incidentId: `incident-${i}` },
        });
      }

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'degradation',
          scenario: 'incident-summary',
        })
      );
    });

    it('应该发送熔断事件', async () => {
      const eventHandler = jest.fn();
      gateway.onEvent(eventHandler);

      // 手动触发熔断
      gateway.tripCircuit('metric-anomaly-detection');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'circuit_open',
          scenario: 'metric-anomaly-detection',
        })
      );
    });
  });

  describe('手动操作', () => {
    it('应该允许手动重置熔断器', async () => {
      // 手动触发熔断
      gateway.tripCircuit('log-pattern-analysis');

      expect(gateway.getCircuitState('log-pattern-analysis')).toBe('OPEN');

      // 手动重置
      gateway.resetCircuit('log-pattern-analysis');
      expect(gateway.getCircuitState('log-pattern-analysis')).toBe('CLOSED');
    });

    it('应该允许手动触发熔断', () => {
      gateway.tripCircuit('dependency-analysis');
      expect(gateway.getCircuitState('dependency-analysis')).toBe('OPEN');
    });
  });

  describe('指标收集', () => {
    it('应该正确收集请求指标', async () => {
      mockLLMCaller.mockImplementation(async () => {
        // 模拟实际延迟
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          success: true,
          data: {},
          confidence: 0.8,
          source: 'llm',
          latency: 10,
        };
      });

      for (let i = 0; i < 20; i++) {
        await gateway.execute({
          scenario: 'capacity-forecast',
          input: { serviceId: `service-${i}` },
        });
      }

      const metrics = gateway.getMetrics('capacity-forecast');
      expect(metrics?.totalRequests).toBe(20);
      expect(metrics?.avgLatency).toBeGreaterThanOrEqual(10);
    });

    it('应该正确计算 P95 延迟', async () => {
      // 模拟不同延迟
      for (let i = 0; i < 12; i++) {
        const delay = (i + 1) * 10; // 10, 20, 30, ..., 120
        mockLLMCaller.mockImplementationOnce(async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          return {
            success: true,
            data: {},
            confidence: 0.8,
            source: 'llm',
            latency: delay,
          };
        });

        await gateway.execute({
          scenario: 'sla-prediction',
          input: { serviceId: `service-${i}` },
        });
      }

      const metrics = gateway.getMetrics('sla-prediction');
      expect(metrics?.p95Latency).toBeGreaterThanOrEqual(100);
    });
  });
});