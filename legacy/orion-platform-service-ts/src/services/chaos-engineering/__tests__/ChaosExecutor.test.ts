/**
 * ChaosExecutor 单元测试
 */

import { ChaosExecutor, ChaosExecutorError } from '../ChaosExecutor';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock util.promisify to return our mock exec
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    return jest.fn(async (cmd: string) => {
      // Simulate exec failure so the fallback simulation path is used
      throw new Error('command not found');
    });
  }),
}));

// Mock ChaosRunRepository
jest.mock('../../../repositories/ChaosEngineeringRepository', () => ({
  ChaosRunRepository: jest.fn().mockImplementation(() => ({})),
}));

describe('ChaosExecutor', () => {
  let executor: ChaosExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new ChaosExecutor();
  });

  describe('ChaosExecutorError', () => {
    it('应该正确设置错误信息和 code', () => {
      const error = new ChaosExecutorError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ChaosExecutorError');
    });

    it('应该支持 cause 参数', () => {
      const cause = new Error('root cause');
      const error = new ChaosExecutorError('Test error', 'TEST_CODE', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('executeCPUSpike', () => {
    it('应该成功执行 CPU 飙升注入（模拟模式）', async () => {
      const result = await executor.executeCPUSpike('pod-1', {
        targetPercent: 80,
        workers: 4,
        duration: 30,
      });

      expect(result.success).toBe(true);
      expect(result.experimentId).toContain('cpu-spike');
      expect(result.result).toContain('SIMULATED');
      expect(result.result).toContain('80');
    });

    it('应该使用默认参数', async () => {
      const result = await executor.executeCPUSpike('pod-1', {
        targetPercent: 50,
      });

      expect(result.success).toBe(true);
      expect(result.result).toContain('workers=2');
      expect(result.result).toContain('duration=60');
    });

    it('应该拒绝无效的 targetPercent（过低）', async () => {
      const result = await executor.executeCPUSpike('pod-1', {
        targetPercent: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('targetPercent must be between 1 and 100');
    });

    it('应该拒绝无效的 targetPercent（过高）', async () => {
      const result = await executor.executeCPUSpike('pod-1', {
        targetPercent: 101,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('targetPercent must be between 1 and 100');
    });

    it('应该接受边界值 targetPercent', async () => {
      const result1 = await executor.executeCPUSpike('pod-1', { targetPercent: 1 });
      expect(result1.success).toBe(true);

      const result2 = await executor.executeCPUSpike('pod-2', { targetPercent: 100 });
      expect(result2.success).toBe(true);
    });
  });

  describe('executeMemoryLeak', () => {
    it('应该成功执行内存泄漏注入（模拟模式）', async () => {
      const result = await executor.executeMemoryLeak('pod-1', {
        leakMB: 256,
        leakRate: 10,
        duration: 60,
      });

      expect(result.success).toBe(true);
      expect(result.experimentId).toContain('memory-leak');
      expect(result.result).toContain('SIMULATED');
      expect(result.result).toContain('256');
    });

    it('应该使用默认参数', async () => {
      const result = await executor.executeMemoryLeak('pod-1', {
        leakMB: 128,
      });

      expect(result.success).toBe(true);
      expect(result.result).toContain('rate=10MB/s');
      expect(result.result).toContain('duration=60s');
    });

    it('应该拒绝 leakMB 为 0', async () => {
      const result = await executor.executeMemoryLeak('pod-1', {
        leakMB: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('leakMB must be greater than 0');
    });
  });

  describe('executeNetworkLatency', () => {
    it('应该成功执行网络延迟注入（模拟模式）', async () => {
      const result = await executor.executeNetworkLatency('service-a', {
        latencyMs: 500,
        jitterMs: 50,
        targetPort: 8080,
        packetLoss: 5,
      });

      expect(result.success).toBe(true);
      expect(result.experimentId).toContain('network-latency');
      expect(result.result).toContain('SIMULATED');
      expect(result.result).toContain('500ms');
      expect(result.result).toContain('50ms');
      expect(result.result).toContain('5%');
    });

    it('应该使用默认参数', async () => {
      const result = await executor.executeNetworkLatency('service-a', {
        latencyMs: 200,
      });

      expect(result.success).toBe(true);
      expect(result.result).toContain('jitter=0ms');
      expect(result.result).toContain('loss=0%');
    });

    it('应该拒绝负数 latencyMs', async () => {
      const result = await executor.executeNetworkLatency('service-a', {
        latencyMs: -1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('latencyMs must be between 0 and 30000');
    });

    it('应该拒绝超过 30000 的 latencyMs', async () => {
      const result = await executor.executeNetworkLatency('service-a', {
        latencyMs: 30001,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('latencyMs must be between 0 and 30000');
    });

    it('应该接受边界值 latencyMs', async () => {
      const result1 = await executor.executeNetworkLatency('service-a', { latencyMs: 0 });
      expect(result1.success).toBe(true);

      const result2 = await executor.executeNetworkLatency('service-a', { latencyMs: 30000 });
      expect(result2.success).toBe(true);
    });
  });

  describe('executeServiceDown', () => {
    it('应该成功执行服务宕机注入（模拟模式）', async () => {
      const result = await executor.executeServiceDown('deployment-a', {
        graceful: true,
        shutdownTimeout: 30,
        replicas: 0,
      });

      expect(result.success).toBe(true);
      expect(result.experimentId).toContain('service-down');
      expect(result.result).toContain('SIMULATED');
    });

    it('应该使用默认参数', async () => {
      const result = await executor.executeServiceDown('deployment-a', {});

      expect(result.success).toBe(true);
      expect(result.result).toContain('graceful=true');
      expect(result.result).toContain('replicas=0');
    });

    it('应该支持强制关闭', async () => {
      const result = await executor.executeServiceDown('deployment-a', {
        graceful: false,
      });

      expect(result.success).toBe(true);
      expect(result.result).toContain('graceful=false');
    });
  });

  describe('recoverExperiment', () => {
    it('应该恢复已存在的实验（模拟模式）', async () => {
      // 先创建一个实验
      const execResult = await executor.executeCPUSpike('pod-1', { targetPercent: 80 });
      const experimentId = execResult.experimentId;

      // 恢复实验 - 但 exec 已完成所以返回 already recovered
      const recoverResult = await executor.recoverExperiment(experimentId);

      // 实验已经 completed，应该返回 already recovered
      expect(recoverResult.success).toBe(false);
      expect(recoverResult.error).toBe('ALREADY_RECOVERED');
    });

    it('应该返回错误当实验不存在', async () => {
      const result = await executor.recoverExperiment('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('EXPERIMENT_NOT_FOUND');
      expect(result.result).toContain('not found');
    });
  });

  describe('getExperimentStatus', () => {
    it('应该返回实验状态', async () => {
      const execResult = await executor.executeCPUSpike('pod-1', { targetPercent: 80 });
      const status = executor.getExperimentStatus(execResult.experimentId);

      expect(status).toBeDefined();
      expect(status!.type).toBe('cpu-spike');
      expect(status!.target).toBe('pod-1');
      expect(status!.status).toBe('completed');
    });

    it('应该返回 undefined 当实验不存在', () => {
      const status = executor.getExperimentStatus('nonexistent');
      expect(status).toBeUndefined();
    });
  });

  describe('getAllExperiments', () => {
    it('应该返回所有实验', async () => {
      await executor.executeCPUSpike('pod-1', { targetPercent: 80 });
      await executor.executeMemoryLeak('pod-2', { leakMB: 128 });
      await executor.executeNetworkLatency('service-a', { latencyMs: 200 });

      const all = executor.getAllExperiments();

      expect(all.length).toBe(3);
    });

    it('应该返回空列表当没有实验', () => {
      const all = executor.getAllExperiments();
      expect(all.length).toBe(0);
    });
  });

  describe('getRunningExperiments', () => {
    it('应该返回空列表当所有实验已完成', async () => {
      await executor.executeCPUSpike('pod-1', { targetPercent: 80 });

      const running = executor.getRunningExperiments();
      expect(running.length).toBe(0);
    });
  });

  describe('experiment ID 生成', () => {
    it('应该生成唯一 ID', async () => {
      const result1 = await executor.executeCPUSpike('pod-1', { targetPercent: 50 });
      const result2 = await executor.executeCPUSpike('pod-2', { targetPercent: 60 });

      expect(result1.experimentId).not.toBe(result2.experimentId);
    });

    it('应该包含类型标识', async () => {
      const cpuResult = await executor.executeCPUSpike('pod-1', { targetPercent: 50 });
      const memResult = await executor.executeMemoryLeak('pod-1', { leakMB: 64 });
      const netResult = await executor.executeNetworkLatency('svc', { latencyMs: 100 });
      const downResult = await executor.executeServiceDown('deploy', {});

      expect(cpuResult.experimentId).toContain('cpu-spike');
      expect(memResult.experimentId).toContain('memory-leak');
      expect(netResult.experimentId).toContain('network-latency');
      expect(downResult.experimentId).toContain('service-down');
    });
  });

  describe('constructor with db', () => {
    it('应该接受 db 参数创建 ChaosRunRepository', () => {
      const mockDb = { query: jest.fn() };
      const executorWithDb = new ChaosExecutor(mockDb as any);
      // Verify it doesn't throw
      expect(executorWithDb).toBeDefined();
    });

    it('应该在没有 db 参数时正常工作', () => {
      const executorNoDb = new ChaosExecutor();
      expect(executorNoDb).toBeDefined();
    });
  });
});
