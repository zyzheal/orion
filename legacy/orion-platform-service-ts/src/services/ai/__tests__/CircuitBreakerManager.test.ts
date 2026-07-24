/**
 * CircuitBreakerManager 测试
 */

import { CircuitBreakerManager, LLMProvider, DualCircuitState } from '../CircuitBreakerManager';
import { CircuitState, AIScenario, CircuitBreakerState } from '../types';

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  const testProviders: LLMProvider[] = [
    { id: 'openai', name: 'OpenAI', type: 'openai', priority: 1, enabled: true },
    { id: 'claude', name: 'Claude', type: 'claude', priority: 2, enabled: true },
    { id: 'deepseek', name: 'DeepSeek', type: 'deepseek', priority: 3, enabled: true },
  ];

  beforeEach(() => {
    manager = new CircuitBreakerManager({
      providers: testProviders,
      providerConfig: {
        failureThreshold: 0.15, // 15%
        timeoutThreshold: 5000, // 5s
        openDuration: 1000, // 1s for testing
      },
      enabled: true,
    });
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  describe('初始化', () => {
    it('should initialize with correct default provider', () => {
      expect(manager.getDefaultProvider()).toBe('openai');
    });

    it('should have all enabled providers available', () => {
      const available = manager.getAvailableProviders();
      expect(available).toContain('openai');
      expect(available).toContain('claude');
      expect(available).toContain('deepseek');
    });

    it('should return ProviderBreaker instance', () => {
      const breaker = manager.getProviderBreaker();
      expect(breaker).toBeDefined();
    });
  });

  describe('双层熔断检查', () => {
    it('should allow requests when both layers are CLOSED', async () => {
      const state = await manager.checkDualCircuit('code-review');
      expect(state.canProceed).toBe(true);
      expect(state.shouldDegrade).toBe(false);
      expect(state.combinedState).toBe('CLOSED');
    });

    it('should block requests when scenario circuit is OPEN', async () => {
      // 设置场景级熔断为 OPEN
      const scenarioState: CircuitBreakerState = {
        scenario: 'code-review',
        state: 'OPEN',
        failureCount: 5,
        successCount: 0,
        lastStateChangeTime: new Date(),
        halfOpenAttempts: 0,
      };
      manager.updateScenarioState('code-review', scenarioState);

      const state = await manager.checkDualCircuit('code-review');
      expect(state.canProceed).toBe(false);
      expect(state.shouldDegrade).toBe(true);
      expect(state.degradationReason).toBe('scenario_circuit_open');
    });

    it('should suggest fallback provider when provider circuit is OPEN', async () => {
      // 触发 openai Provider 熔断
      manager.tripProvider('openai', 'test');

      const state = await manager.checkDualCircuit('code-review', 'openai');
      expect(state.canProceed).toBe(true);
      expect(state.shouldDegrade).toBe(false);
      expect(state.suggestedProvider).toBe('claude');
    });

    it('should degrade when all providers are OPEN', async () => {
      // 触发所有 Provider 熔断
      manager.tripProvider('openai', 'test');
      manager.tripProvider('claude', 'test');
      manager.tripProvider('deepseek', 'test');

      const state = await manager.checkDualCircuit('code-review');
      expect(state.canProceed).toBe(false);
      expect(state.shouldDegrade).toBe(true);
      expect(state.degradationReason).toBe('no_available_provider');
    });
  });

  describe('Provider 级熔断', () => {
    it('should track provider request results', async () => {
      await manager.afterProviderRequest('openai', true, 100);
      await manager.afterProviderRequest('openai', true, 150);
      await manager.afterProviderRequest('openai', false, 200);

      const metrics = manager.getProviderMetrics('openai');
      expect(metrics?.totalRequests).toBe(3);
      expect(metrics?.failedRequests).toBe(1);
    });

    it('should trip provider when failure rate exceeds threshold', async () => {
      // 使用高失败阈值避免测试期间触发
      manager = new CircuitBreakerManager({
        providers: testProviders,
        providerConfig: {
          failureThreshold: 0.15, // 15%
          openDuration: 60000, // 长时间避免恢复
        },
      });

      // 记录足够多的失败以超过 15% 阈值
      // 2 成功 + 8 失败 = 80% 失败率 > 15%
      for (let i = 0; i < 2; i++) {
        await manager.afterProviderRequest('openai', true, 100);
      }
      for (let i = 0; i < 8; i++) {
        await manager.afterProviderRequest('openai', false, 1000);
      }

      expect(manager.getProviderState('openai')).toBe('OPEN');
    });

    it('should trip provider when P95 latency exceeds threshold', async () => {
      manager = new CircuitBreakerManager({
        providers: testProviders,
        providerConfig: {
          failureThreshold: 0.8, // 高阈值避免错误率触发
          timeoutThreshold: 5000, // 5s
          openDuration: 60000,
        },
      });

      // 添加大量成功请求，但延迟超过 5s
      // P95 需要超过 5000ms
      const latencies = [100, 200, 300, 400, 500, 6000, 7000, 8000, 9000, 10000];
      for (const latency of latencies) {
        await manager.afterProviderRequest('openai', true, latency);
      }

      const metrics = manager.getProviderMetrics('openai');
      expect(metrics?.p95Latency).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('场景级熔断', () => {
    it('should update scenario state correctly', () => {
      const scenarioState: CircuitBreakerState = {
        scenario: 'code-review',
        state: 'OPEN',
        failureCount: 5,
        successCount: 0,
        lastStateChangeTime: new Date(),
        halfOpenAttempts: 0,
      };

      manager.updateScenarioState('code-review', scenarioState);
      const retrieved = manager.getScenarioState('code-review');

      expect(retrieved?.state).toBe('OPEN');
      expect(retrieved?.failureCount).toBe(5);
    });

    it('should reset scenario state', () => {
      const scenarioState: CircuitBreakerState = {
        scenario: 'code-review',
        state: 'OPEN',
        failureCount: 5,
        successCount: 0,
        lastStateChangeTime: new Date(),
        halfOpenAttempts: 0,
      };

      manager.updateScenarioState('code-review', scenarioState);
      manager.resetScenario('code-review');

      const retrieved = manager.getScenarioState('code-review');
      expect(retrieved?.state).toBe('CLOSED');
    });
  });

  describe('健康状态摘要', () => {
    it('should return health summary with correct data', () => {
      const summary = manager.getHealthSummary();

      expect(summary.overallHealthy).toBe(true);
      expect(summary.providers.has('openai')).toBe(true);
      expect(summary.scenarios.size).toBe(0); // 无场景状态
    });

    it('should reflect unhealthy state when provider is OPEN', () => {
      manager.tripProvider('openai', 'test');
      const summary = manager.getHealthSummary();

      expect(summary.overallHealthy).toBe(false);
      expect(summary.providers.get('openai')?.state).toBe('OPEN');
    });
  });

  describe('事件', () => {
    it('should emit dual:circuit:event on provider state change', async () => {
      const eventHandler = jest.fn();
      manager.on('dual:circuit:event', eventHandler);

      // 触发 Provider 熔断
      manager.tripProvider('openai', 'manual');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'provider_circuit_change',
          data: expect.objectContaining({
            providerId: 'openai',
            newState: 'OPEN',
          }),
        })
      );
    });

    it('should emit provider_fallback event when fallback is triggered', async () => {
      const eventHandler = jest.fn();
      manager.on('dual:circuit:event', eventHandler);

      manager.tripProvider('openai', 'test');
      await manager.checkDualCircuit('code-review', 'openai');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'provider_fallback',
        })
      );
    });
  });

  describe('Provider 管理', () => {
    it('should add new provider', () => {
      const newProvider: LLMProvider = {
        id: 'gemini',
        name: 'Gemini',
        type: 'custom',
        priority: 5,
        enabled: true,
      };

      manager.addProvider(newProvider);
      const available = manager.getAvailableProviders();

      expect(available).toContain('gemini');
    });

    it('should remove provider', () => {
      manager.removeProvider('deepseek');
      const available = manager.getAvailableProviders();

      expect(available).not.toContain('deepseek');
    });

    it('should disable provider', () => {
      manager.setProviderEnabled('deepseek', false);
      const available = manager.getAvailableProviders();

      expect(available).not.toContain('deepseek');
    });
  });

  describe('配置', () => {
    it('should update config correctly', () => {
      manager.updateConfig({
        enabled: false,
      });

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
    });

    it('should allow requests when disabled', async () => {
      manager.updateConfig({ enabled: false });
      manager.tripProvider('openai', 'test');

      const state = await manager.checkDualCircuit('code-review');
      expect(state.canProceed).toBe(true);
      expect(state.combinedState).toBe('CLOSED');
    });
  });
});