/**
 * WasmRuntime Tests
 *
 * Tests for G1: WASM Runtime (QuickJS sandbox execution).
 * Verifies: wrapper logic, result mapping, error handling, timeout configuration.
 *
 * Note: The actual QuickJS WASM execution requires --experimental-vm-modules in Jest.
 * These tests verify the WasmRuntime wrapper logic using mocked QuickJS.
 * Real QuickJS execution is verified through integration tests.
 */

import { WasmRuntime, WasmExecutionRequest } from '../inline-script/WasmRuntime';

// Mock the quickjs-emscripten module
jest.mock('quickjs-emscripten', () => {
  // Track created runtimes and contexts for cleanup verification
  const createdRuntimes: any[] = [];
  const createdContexts: any[] = [];

  const mockQuickJS = {
    newRuntime: jest.fn((options: any) => {
      const rt = {
        memoryLimitBytes: options?.memoryLimitBytes,
        setInterruptHandler: jest.fn(),
        newContext: jest.fn(() => {
          const ctx = {
            global: 'global_handle',
            newFunction: jest.fn((_name: string, _fn: any) => ({ dispose: jest.fn() })),
            newObject: jest.fn(() => ({ dispose: jest.fn() })),
            setProp: jest.fn(),
            evalCode: jest.fn(() => ({
              value: { dispose: jest.fn() },
              error: null,
            })),
            dump: jest.fn((h: any) => 'dumped'),
            dispose: jest.fn(),
          };
          createdContexts.push(ctx);
          return ctx;
        }),
        dispose: jest.fn(),
      };
      createdRuntimes.push(rt);
      return rt;
    }),
  };

  return {
    getQuickJS: jest.fn(() => Promise.resolve(mockQuickJS)),
    mockQuickJS,
    createdRuntimes,
    createdContexts,
  };
});

import { getQuickJS, mockQuickJS, createdRuntimes, createdContexts } from 'quickjs-emscripten';

describe('WasmRuntime', () => {
  let runtime: WasmRuntime;

  beforeEach(() => {
    jest.clearAllMocks();
    createdRuntimes.length = 0;
    createdContexts.length = 0;
    runtime = new WasmRuntime();
    // Clear cached module
    (runtime as any).vmModule = null;
  });

  describe('initialization', () => {
    it('should lazily initialize the QuickJS module', async () => {
      await runtime.execute({
        code: 'console.log("test");',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      expect(getQuickJS).toHaveBeenCalledTimes(1);
    });

    it('should reuse the same module on subsequent calls', async () => {
      await runtime.execute({ code: '1', timeout: 1000, memoryLimit: 64 * 1024 * 1024 });
      await runtime.execute({ code: '2', timeout: 1000, memoryLimit: 64 * 1024 * 1024 });

      // getQuickJS should only be called once (lazy init)
      expect(getQuickJS).toHaveBeenCalledTimes(1);
    });
  });

  describe('execution configuration', () => {
    it('should create runtime with specified memory limit', async () => {
      const memoryLimit = 128 * 1024 * 1024; // 128MB

      await runtime.execute({
        code: '1',
        timeout: 5000,
        memoryLimit,
      });

      expect(mockQuickJS.newRuntime).toHaveBeenCalledWith({
        memoryLimitBytes: memoryLimit,
      });
    });

    it('should set interrupt handler for timeout', async () => {
      await runtime.execute({
        code: '1',
        timeout: 3000,
        memoryLimit: 64 * 1024 * 1024,
      });

      const rt = createdRuntimes[0];
      expect(rt.setInterruptHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('successful execution', () => {
    it('should return success for valid code', async () => {
      const result = await runtime.execute({
        code: 'console.log("hello");',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      expect(result.success).toBe(true);
    });

    it('should set up console object in the context', async () => {
      await runtime.execute({
        code: 'console.log("test");',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      const ctx = createdContexts[0];
      // Verify console object was created and set
      expect(ctx.newObject).toHaveBeenCalled();
      expect(ctx.setProp).toHaveBeenCalled();
    });

    it('should execute code via evalCode', async () => {
      await runtime.execute({
        code: 'const x = 42;',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      const ctx = createdContexts[0];
      expect(ctx.evalCode).toHaveBeenCalledWith('const x = 42;');
    });
  });

  describe('error handling', () => {
    it('should return failure when evalCode returns an error', async () => {
      // Configure mock to return an error
      const ctx = createdContexts[0] || {
        global: 'global_handle',
        newFunction: jest.fn(() => ({ dispose: jest.fn() })),
        newObject: jest.fn(() => ({ dispose: jest.fn() })),
        setProp: jest.fn(),
        evalCode: jest.fn(() => ({
          value: { dispose: jest.fn() },
          error: { dispose: jest.fn() },
        })),
        dump: jest.fn(() => ({ message: 'ReferenceError: x is not defined' })),
        dispose: jest.fn(),
      };

      (mockQuickJS.newRuntime as jest.Mock).mockReturnValueOnce({
        memoryLimitBytes: 64 * 1024 * 1024,
        setInterruptHandler: jest.fn(),
        newContext: jest.fn(() => ctx),
        dispose: jest.fn(),
      });

      const result = await runtime.execute({
        code: 'x;',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      expect(result.success).toBe(false);
    });

    it('should handle exception thrown during execution', async () => {
      (mockQuickJS.newRuntime as jest.Mock).mockReturnValueOnce({
        memoryLimitBytes: 64 * 1024 * 1024,
        setInterruptHandler: jest.fn(),
        newContext: jest.fn(() => ({
          global: 'global',
          newFunction: jest.fn(() => ({ dispose: jest.fn() })),
          newObject: jest.fn(() => ({ dispose: jest.fn() })),
          setProp: jest.fn(),
          evalCode: jest.fn(() => { throw new Error('Execution timeout: exceeded CPU time limit'); }),
          dump: jest.fn(() => 'error'),
          dispose: jest.fn(),
        })),
        dispose: jest.fn(),
      });

      const result = await runtime.execute({
        code: 'while(true){}',
        timeout: 500,
        memoryLimit: 64 * 1024 * 1024,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource limit exceeded');
    });

    it('should handle OOM errors specifically', async () => {
      (mockQuickJS.newRuntime as jest.Mock).mockReturnValueOnce({
        memoryLimitBytes: 1024, // Very small limit
        setInterruptHandler: jest.fn(),
        newContext: jest.fn(() => ({
          global: 'global',
          newFunction: jest.fn(() => ({ dispose: jest.fn() })),
          newObject: jest.fn(() => ({ dispose: jest.fn() })),
          setProp: jest.fn(),
          evalCode: jest.fn(() => { throw new Error('out of memory'); }),
          dump: jest.fn(() => 'error'),
          dispose: jest.fn(),
        })),
        dispose: jest.fn(),
      });

      const result = await runtime.execute({
        code: 'const a = []; while(true) a.push(1);',
        timeout: 5000,
        memoryLimit: 1024,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource limit exceeded');
    });
  });

  describe('cleanup', () => {
    it('should dispose context and runtime after execution', async () => {
      await runtime.execute({
        code: '1',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      const ctx = createdContexts[0];
      const rt = createdRuntimes[0];

      expect(ctx.dispose).toHaveBeenCalled();
      expect(rt.dispose).toHaveBeenCalled();
    });

    it('should handle double-dispose gracefully', async () => {
      (mockQuickJS.newRuntime as jest.Mock).mockReturnValueOnce({
        memoryLimitBytes: 64 * 1024 * 1024,
        setInterruptHandler: jest.fn(),
        newContext: jest.fn(() => ({
          global: 'global',
          newFunction: jest.fn(() => ({ dispose: jest.fn() })),
          newObject: jest.fn(() => ({ dispose: jest.fn() })),
          setProp: jest.fn(),
          evalCode: jest.fn(() => {
            // Simulate error that disposes context in error handler
            throw new Error('test');
          }),
          dump: jest.fn(() => 'error'),
          dispose: jest.fn(),
        })),
        dispose: jest.fn(),
      });

      // Should not throw even with error
      const result = await runtime.execute({
        code: 'throw new Error("test");',
        timeout: 5000,
        memoryLimit: 64 * 1024 * 1024,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('execution isolation', () => {
    it('should create a new context for each execution', async () => {
      await runtime.execute({ code: '1', timeout: 1000, memoryLimit: 64 * 1024 * 1024 });
      await runtime.execute({ code: '2', timeout: 1000, memoryLimit: 64 * 1024 * 1024 });

      expect(mockQuickJS.newRuntime).toHaveBeenCalledTimes(2);
    });
  });
});
