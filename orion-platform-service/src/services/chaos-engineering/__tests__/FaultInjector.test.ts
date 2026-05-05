/**
 * FaultInjector 单元测试
 */

import { FaultInjector, FaultInjectorError } from '../FaultInjector';

describe('FaultInjector', () => {
  let injector: FaultInjector;

  beforeEach(() => {
    jest.clearAllMocks();
    injector = new FaultInjector();
  });

  describe('inject', () => {
    it('应该注入故障', async () => {
      const result = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      expect(result.success).toBe(true);
      expect(result.fault_id).toBeDefined();
      expect(result.message).toContain('injected');
    });

    it('应该生成唯一的故障 ID', async () => {
      const result1 = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      const result2 = await injector.inject({
        type: 'cpu_stress',
        target: 'service-b',
        config: { stress_percent: 50 },
        duration_ms: 60000,
      });

      expect(result1.fault_id).not.toBe(result2.fault_id);
    });

    it('应该拒绝无效配置', async () => {
      await expect(injector.inject({
        type: 'network_latency',
        target: '',
        config: {},
        duration_ms: 1000,
      })).rejects.toThrow(FaultInjectorError);
    });

    it('应该拒绝重复目标注入', async () => {
      await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      await expect(injector.inject({
        type: 'cpu_stress',
        target: 'service-a',
        config: { stress_percent: 50 },
        duration_ms: 60000,
      })).rejects.toThrow(FaultInjectorError);
    });

    it('应该返回估算结束时间', async () => {
      const result = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      expect(result.estimated_end_at).toBeDefined();
      expect(result.estimated_end_at.getTime() - result.started_at.getTime()).toBe(60000);
    });
  });

  describe('inject - Fault Types', () => {
    it('应该注入网络延迟', async () => {
      const result = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100, jitter_ms: 10 },
        duration_ms: 30000,
      });

      expect(result.success).toBe(true);
    });

    it('应该注入服务宕机', async () => {
      const result = await injector.inject({
        type: 'service_down',
        target: 'service-b',
        config: { graceful_shutdown: true },
        duration_ms: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('应该注入 CPU 压力', async () => {
      const result = await injector.inject({
        type: 'cpu_stress',
        target: 'service-c',
        config: { stress_percent: 80, workers: 4 },
        duration_ms: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('应该注入内存压力', async () => {
      const result = await injector.inject({
        type: 'memory_stress',
        target: 'service-d',
        config: { stress_mb: 1024 },
        duration_ms: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('应该注入磁盘满', async () => {
      const result = await injector.inject({
        type: 'disk_full',
        target: 'service-e',
        config: { fill_percent: 90 },
        duration_ms: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('应该拒绝未知故障类型', async () => {
      await expect(injector.inject({
        type: 'unknown_type' as any,
        target: 'service-a',
        config: {},
        duration_ms: 1000,
      })).rejects.toThrow(FaultInjectorError);
    });
  });

  describe('recover', () => {
    it('应该恢复故障', async () => {
      const injectResult = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      const recoverResult = await injector.recover(injectResult.fault_id);

      expect(recoverResult.success).toBe(true);
    });

    it('应该拒绝不存在的故障 ID', async () => {
      const result = await injector.recover('nonexistent-fault');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('应该清理活跃故障列表', async () => {
      const injectResult = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      await injector.recover(injectResult.fault_id);

      // Should allow reinjection after recovery
      const reinjectResult = await injector.inject({
        type: 'cpu_stress',
        target: 'service-a',
        config: { stress_percent: 50 },
        duration_ms: 60000,
      });

      expect(reinjectResult.success).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('应该返回故障状态', async () => {
      const injectResult = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      const status = injector.getStatus(injectResult.fault_id);

      expect(status).not.toBeNull();
      expect(status!.status).toBe('active');
    });

    it('应该返回 null 对于不存在的故障', () => {
      const status = injector.getStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('listActiveFaults', () => {
    it('应该返回活跃故障列表', async () => {
      await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      await injector.inject({
        type: 'cpu_stress',
        target: 'service-b',
        config: { stress_percent: 50 },
        duration_ms: 60000,
      });

      const activeFaults = injector.listActiveFaults();

      expect(activeFaults.length).toBe(2);
    });

    it('应该返回空列表如果没有活跃故障', () => {
      const activeFaults = injector.listActiveFaults();

      expect(activeFaults.length).toBe(0);
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', async () => {
      const result = await injector.inject({
        type: 'network_latency',
        target: 'valid-target',
        config: { latency_ms: 100 },
        duration_ms: 1000,
      });

      expect(result.success).toBe(true);
    });

    it('应该拒绝空目标', async () => {
      await expect(injector.inject({
        type: 'network_latency',
        target: '',
        config: {},
        duration_ms: 1000,
      })).rejects.toThrow();
    });

    it('应该拒绝零持续时间', async () => {
      await expect(injector.inject({
        type: 'network_latency',
        target: 'service',
        config: {},
        duration_ms: 0,
      })).rejects.toThrow();
    });
  });

  describe('Events', () => {
    it('应该发出 injection:start 事件', async () => {
      const eventHandler = jest.fn();
      injector.on('injection:start', eventHandler);

      await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      expect(eventHandler).toHaveBeenCalled();
    });

    it('应该发出 injection:failed 事件', async () => {
      const eventHandler = jest.fn();
      injector.on('injection:failed', eventHandler);

      // First injection succeeds
      await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: {},
        duration_ms: 60000,
      });

      // Second injection on same target should fail
      try {
        await injector.inject({
          type: 'cpu_stress',
          target: 'service-a',
          config: {},
          duration_ms: 60000,
        });
      } catch (e) {
        // Expected
      }

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('InjectionStatus', () => {
    it('应该包含完整的状态信息', async () => {
      const injectResult = await injector.inject({
        type: 'network_latency',
        target: 'service-a',
        config: { latency_ms: 100 },
        duration_ms: 60000,
      });

      const status = injector.getStatus(injectResult.fault_id);

      expect(status!.fault_id).toBeDefined();
      expect(status!.type).toBe('network_latency');
      expect(status!.target).toBe('service-a');
      expect(status!.started_at).toBeDefined();
      expect(status!.metrics).toBeDefined();
    });
  });

  describe('FaultInjectorError', () => {
    it('应该正确设置错误信息', () => {
      const error = new FaultInjectorError('Fault injection failed', 'INJECTION_FAILED');

      expect(error.message).toBe('Fault injection failed');
      expect(error.code).toBe('INJECTION_FAILED');
      expect(error.name).toBe('FaultInjectorError');
    });
  });
});