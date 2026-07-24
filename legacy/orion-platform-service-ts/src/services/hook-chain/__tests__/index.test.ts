/**
 * hook-chain index.ts - Re-export + Behavior Tests
 *
 * 覆盖范围:
 * - Re-export 验证 (HookChainService, 类型)
 * - Chain CRUD 行为 (createChain, getChain, listChains, deleteChain, updateChain)
 * - Chain 执行行为 (executeChain, 顺序/并行模式)
 * - 条件评估 (always, on_success, on_failure, on_match, expression)
 * - 重试逻辑 (retryPolicy, backoff)
 * - Executor 注册与覆盖
 * - 事件发射 (chain:created, chain:deleted, chain:started, chain:completed)
 * - 错误处理与边界条件
 */

import { EventEmitter } from 'events';
import * as HookChainExports from '../index';
import {
  HookChainService,
  HookChainDefinition,
  HookDefinition,
  HookExecutionContext,
  HookExecutionResult,
  HookExecutor,
} from '../HookChainService';

// ==================== Helpers ====================

function makeHook(overrides: Partial<HookDefinition> = {}): HookDefinition {
  return {
    id: `hook-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Hook',
    type: 'webhook',
    config: { url: 'https://example.com/hook' },
    ...overrides,
  };
}

function makeChain(overrides: Partial<HookChainDefinition> = {}): HookChainDefinition {
  return {
    id: `chain-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Chain',
    hooks: [makeHook()],
    executionMode: 'sequential',
    stopOnFailure: true,
    ...overrides,
  };
}

function createMockExecutor(): HookExecutor {
  return {
    execute: jest.fn(async () => ({ success: true })),
  };
}

// ==================== Re-export Tests ====================

describe('hook-chain index exports', () => {
  it('should export HookChainService', () => {
    expect(HookChainExports.HookChainService).toBeDefined();
    expect(typeof HookChainExports.HookChainService).toBe('function');
  });

  it('should export types (compile-time check via typeof)', () => {
    expect('HookChainService' in HookChainExports).toBe(true);
  });
});

// ==================== Behavior Tests ====================

describe('HookChainService behavior via index', () => {
  let service: HookChainService;

  beforeEach(() => {
    service = new HookChainService();
  });

  // ==================== createChain ====================

  describe('createChain', () => {
    it('should create and store a chain', () => {
      const chain = makeChain({ name: 'My Chain' });
      const result = service.createChain(chain);

      expect(result).toEqual(chain);
      expect(service.getChain(chain.id)).toEqual(chain);
    });

    it('should emit chain:created event', () => {
      const listener = jest.fn();
      service.on('chain:created', listener);

      const chain = makeChain();
      service.createChain(chain);

      expect(listener).toHaveBeenCalledWith({ chainId: chain.id, definition: chain });
    });

    it('should throw OrionError when chain id is empty', () => {
      expect(() => service.createChain(makeChain({ id: '' }))).toThrow();
    });

    it('should throw OrionError when hooks array is empty', () => {
      expect(() => service.createChain(makeChain({ hooks: [] }))).toThrow();
    });

    it('should throw OrionError when a hook is missing id', () => {
      expect(() => service.createChain(makeChain({ hooks: [makeHook({ id: '' })] }))).toThrow();
    });
  });

  // ==================== getChain ====================

  describe('getChain', () => {
    it('should return the chain if it exists', () => {
      const chain = makeChain();
      service.createChain(chain);
      expect(service.getChain(chain.id)).toEqual(chain);
    });

    it('should return undefined for non-existent chain', () => {
      expect(service.getChain('nonexistent')).toBeUndefined();
    });
  });

  // ==================== listChains ====================

  describe('listChains', () => {
    it('should return empty array when no chains exist', () => {
      expect(service.listChains()).toEqual([]);
    });

    it('should return all created chains', () => {
      const chain1 = makeChain({ name: 'Chain 1' });
      const chain2 = makeChain({ name: 'Chain 2' });
      service.createChain(chain1);
      service.createChain(chain2);

      const list = service.listChains();
      expect(list).toHaveLength(2);
      expect(list).toContainEqual(chain1);
      expect(list).toContainEqual(chain2);
    });
  });

  // ==================== deleteChain ====================

  describe('deleteChain', () => {
    it('should delete an existing chain and return true', () => {
      const chain = makeChain();
      service.createChain(chain);
      expect(service.deleteChain(chain.id)).toBe(true);
      expect(service.getChain(chain.id)).toBeUndefined();
    });

    it('should return false for non-existent chain', () => {
      expect(service.deleteChain('nonexistent')).toBe(false);
    });

    it('should emit chain:deleted event', () => {
      const listener = jest.fn();
      service.on('chain:deleted', listener);

      const chain = makeChain();
      service.createChain(chain);
      service.deleteChain(chain.id);

      expect(listener).toHaveBeenCalledWith({ chainId: chain.id });
    });
  });

  // ==================== updateChain ====================

  describe('updateChain', () => {
    it('should update an existing chain', () => {
      const chain = makeChain();
      service.createChain(chain);

      const updated = service.updateChain(chain.id, { name: 'Updated Name' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.id).toBe(chain.id);
    });

    it('should return undefined for non-existent chain', () => {
      expect(service.updateChain('nonexistent', { name: 'x' })).toBeUndefined();
    });

    it('should validate the updated definition', () => {
      const chain = makeChain();
      service.createChain(chain);
      expect(() => service.updateChain(chain.id, { hooks: [] })).toThrow();
    });

    it('should preserve fields not included in updates', () => {
      const chain = makeChain({ description: 'Original' });
      service.createChain(chain);

      const updated = service.updateChain(chain.id, { name: 'New Name' });
      expect(updated!.description).toBe('Original');
      expect(updated!.name).toBe('New Name');
    });
  });

  // ==================== registerExecutor ====================

  describe('registerExecutor', () => {
    it('should register a custom executor', () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom_type', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom_type' as any })] });
      expect(() => service.createChain(chain)).not.toThrow();
    });

    it('should override existing executor of same type', async () => {
      const calls: string[] = [];
      const executor1: HookExecutor = {
        execute: jest.fn(async () => { calls.push('executor1'); return {}; }),
      };
      const executor2: HookExecutor = {
        execute: jest.fn(async () => { calls.push('executor2'); return {}; }),
      };

      service.registerExecutor('custom', executor1);
      service.registerExecutor('custom', executor2);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any })] });
      service.createChain(chain);
      await service.executeChain(chain.id, 'test', {}, 't1');

      expect(calls).toEqual(['executor2']);
    });
  });

  // ==================== executeChain ====================

  describe('executeChain', () => {
    it('should throw for non-existent chain', async () => {
      await expect(service.executeChain('nonexistent', 'test', {}, 't1')).rejects.toThrow();
    });

    it('should execute a simple chain with one hook', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any, id: 'h1' })] });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'trigger', { key: 'value' }, 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.chainId).toBe(chain.id);
      expect(result.hookResults).toHaveLength(1);
      expect(result.hookResults[0].success).toBe(true);
      expect(result.executionId).toMatch(/^exec-/);
    });

    it('should execute sequential hooks and pass data between them', async () => {
      const executor: HookExecutor = {
        execute: jest.fn(async (ctx) => {
          if (ctx.currentHookIndex === 0) return { step1: 'done' };
          return { step2: 'done' };
        }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1' }),
          makeHook({ type: 'custom' as any, id: 'h2' }),
        ],
        executionMode: 'sequential',
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.success).toBe(true);
      expect(result.hookResults).toHaveLength(2);
      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('should execute parallel hooks', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1' }),
          makeHook({ type: 'custom' as any, id: 'h2' }),
          makeHook({ type: 'custom' as any, id: 'h3' }),
        ],
        executionMode: 'parallel',
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.success).toBe(true);
      expect(result.hookResults).toHaveLength(3);
      expect(executor.execute).toHaveBeenCalledTimes(3);
    });

    it('should stop on failure in sequential mode when stopOnFailure is true', async () => {
      let callCount = 0;
      const executor: HookExecutor = {
        execute: jest.fn(async () => {
          callCount++;
          if (callCount === 1) throw new Error('Hook 1 failed');
          return { ok: true };
        }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1' }),
          makeHook({ type: 'custom' as any, id: 'h2' }),
        ],
        executionMode: 'sequential',
        stopOnFailure: true,
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.success).toBe(false);
      expect(result.hookResults).toHaveLength(1);
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });

    it('should continue execution when stopOnFailure is false', async () => {
      let callCount = 0;
      const executor: HookExecutor = {
        execute: jest.fn(async () => {
          callCount++;
          if (callCount === 1) throw new Error('Hook 1 failed');
          return { ok: true };
        }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1' }),
          makeHook({ type: 'custom' as any, id: 'h2' }),
        ],
        executionMode: 'sequential',
        stopOnFailure: false,
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.hookResults).toHaveLength(2);
      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    it('should emit chain:started and chain:completed events', async () => {
      const events: string[] = [];
      service.on('chain:started', () => events.push('started'));
      service.on('chain:completed', () => events.push('completed'));

      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any })] });
      service.createChain(chain);

      await service.executeChain(chain.id, 'test', {}, 't1');

      expect(events).toEqual(['started', 'completed']);
    });

    it('should return accumulated data as finalOutput when no outputTransform', async () => {
      const executor: HookExecutor = {
        execute: jest.fn(async () => ({ value: 1 })),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any, id: 'h1' })] });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');
      expect(result.finalOutput).toEqual({ h1: { value: 1 } });
    });
  });

  // ==================== Condition Evaluation ====================

  describe('condition evaluation', () => {
    it('should skip hook when condition on_success and previous hook failed', async () => {
      let callCount = 0;
      const executor: HookExecutor = {
        execute: jest.fn(async () => {
          callCount++;
          if (callCount === 1) throw new Error('fail');
          return { ran: true };
        }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1', name: 'First' }),
          makeHook({ type: 'custom' as any, id: 'h2', name: 'Second', condition: { type: 'on_success' } }),
        ],
        executionMode: 'sequential',
        stopOnFailure: false,
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.hookResults[1].output).toEqual({ skipped: true, reason: 'condition_not_met' });
    });

    it('should skip hook when condition on_failure and previous hook succeeded', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({ type: 'custom' as any, id: 'h1', name: 'First' }),
          makeHook({ type: 'custom' as any, id: 'h2', name: 'Second', condition: { type: 'on_failure' } }),
        ],
        executionMode: 'sequential',
        stopOnFailure: false,
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');

      expect(result.hookResults[1].output).toEqual({ skipped: true, reason: 'condition_not_met' });
    });

    it('should evaluate on_match condition against payload', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({
            type: 'custom' as any,
            id: 'h1',
            condition: { type: 'on_match', matchField: 'event', matchPatterns: ['deploy.*'] },
          }),
        ],
      });
      service.createChain(chain);

      // Matching payload
      const result1 = await service.executeChain(chain.id, 'test', { event: 'deploy.started' }, 't1');
      expect(result1.hookResults[0].output).toEqual({ success: true });

      // Non-matching payload
      const service2 = new HookChainService();
      service2.registerExecutor('custom', executor);
      service2.createChain(chain);
      const result2 = await service2.executeChain(chain.id, 'test', { event: 'other.event' }, 't1');
      expect(result2.hookResults[0].output).toEqual({ skipped: true, reason: 'condition_not_met' });
    });

    it('should evaluate expression condition', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [
          makeHook({
            type: 'custom' as any,
            id: 'h1',
            condition: { type: 'expression', expression: 'context.triggerPayload.value > 10' },
          }),
        ],
      });
      service.createChain(chain);

      // Expression true
      const result1 = await service.executeChain(chain.id, 'test', { value: 20 }, 't1');
      expect(result1.hookResults[0].output).toEqual({ success: true });

      // Expression false
      const service2 = new HookChainService();
      service2.registerExecutor('custom', executor);
      service2.createChain(chain);
      const result2 = await service2.executeChain(chain.id, 'test', { value: 5 }, 't1');
      expect(result2.hookResults[0].output).toEqual({ skipped: true, reason: 'condition_not_met' });
    });

    it('should skip hook when expression is missing', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [makeHook({ type: 'custom' as any, id: 'h1', condition: { type: 'expression' } })],
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');
      expect(result.hookResults[0].output).toEqual({ skipped: true, reason: 'condition_not_met' });
    });
  });

  // ==================== Retry Logic ====================

  describe('retry logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry failed hooks according to retryPolicy', async () => {
      let attempts = 0;
      const executor: HookExecutor = {
        execute: jest.fn(async () => {
          attempts++;
          if (attempts < 3) throw new Error(`Attempt ${attempts} failed`);
          return { recovered: true };
        }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [makeHook({
          type: 'custom' as any,
          id: 'h1',
          retryPolicy: { maxRetries: 3, retryDelay: 100, backoffMultiplier: 1 },
        })],
      });
      service.createChain(chain);

      const resultPromise = service.executeChain(chain.id, 'test', {}, 't1');

      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);
      await jest.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      expect(result.hookResults[0].retryCount).toBe(2);
    });

    it('should fail after exhausting all retries', async () => {
      const executor: HookExecutor = {
        execute: jest.fn(async () => { throw new Error('Always fails'); }),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [makeHook({
          type: 'custom' as any,
          id: 'h1',
          retryPolicy: { maxRetries: 2, retryDelay: 50, backoffMultiplier: 1 },
        })],
        stopOnFailure: true,
      });
      service.createChain(chain);

      const resultPromise = service.executeChain(chain.id, 'test', {}, 't1');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.hookResults[0].retryCount).toBe(3);
      expect(executor.execute).toHaveBeenCalledTimes(3);
    });
  });

  // ==================== Execution History ====================

  describe('execution history', () => {
    it('should return empty array for chain with no executions', () => {
      expect(service.getExecutionHistory('nonexistent')).toEqual([]);
    });

    it('should store execution results in history', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any })] });
      service.createChain(chain);

      await service.executeChain(chain.id, 'test', {}, 't1');

      const history = service.getExecutionHistory(chain.id);
      expect(history).toHaveLength(1);
      expect(history[0].chainId).toBe(chain.id);
      expect(history[0].success).toBe(true);
    });

    it('should accumulate multiple executions in history', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({ hooks: [makeHook({ type: 'custom' as any })] });
      service.createChain(chain);

      await service.executeChain(chain.id, 'test', {}, 't1');
      await service.executeChain(chain.id, 'test', {}, 't1');
      await service.executeChain(chain.id, 'test', {}, 't1');

      expect(service.getExecutionHistory(chain.id)).toHaveLength(3);
    });
  });

  // ==================== Data Transforms ====================

  describe('data transforms', () => {
    it('should handle invalid inputTransform gracefully', async () => {
      const executor = createMockExecutor();
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [makeHook({ type: 'custom' as any })],
        inputTransform: 'invalid syntax!!!',
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', { key: 'value' }, 't1');
      expect(result.success).toBe(true);
    });

    it('should apply outputTransform', async () => {
      const executor: HookExecutor = {
        execute: jest.fn(async () => ({ value: 42 })),
      };
      service.registerExecutor('custom', executor);

      const chain = makeChain({
        hooks: [makeHook({ type: 'custom' as any, id: 'h1' })],
        outputTransform: '({ summary: Object.keys(data).length })',
      });
      service.createChain(chain);

      const result = await service.executeChain(chain.id, 'test', {}, 't1');
      expect(result.success).toBe(true);
      expect(result.finalOutput).toEqual({ summary: 1 });
    });
  });

  // ==================== Multiple Chains ====================

  describe('multiple chains', () => {
    it('should manage multiple chains independently', () => {
      const chain1 = makeChain({ name: 'Chain A' });
      const chain2 = makeChain({ name: 'Chain B' });

      service.createChain(chain1);
      service.createChain(chain2);

      expect(service.listChains()).toHaveLength(2);
      expect(service.getChain(chain1.id)!.name).toBe('Chain A');
      expect(service.getChain(chain2.id)!.name).toBe('Chain B');

      service.deleteChain(chain1.id);
      expect(service.listChains()).toHaveLength(1);
      expect(service.getChain(chain1.id)).toBeUndefined();
      expect(service.getChain(chain2.id)).toBeDefined();
    });
  });

  // ==================== EventEmitter ====================

  describe('EventEmitter integration', () => {
    it('should be an EventEmitter instance', () => {
      expect(service).toBeInstanceOf(EventEmitter);
    });

    it('should accept custom eventBus in constructor', () => {
      const eventBus = new EventEmitter();
      const svc = new HookChainService({ eventBus });
      expect(svc).toBeDefined();
    });
  });
});
