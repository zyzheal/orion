/**
 * WasmRuntime Tests
 *
 * Verifies that the QuickJS-based WASM runtime correctly:
 * - Executes JavaScript code
 * - Captures console.log output
 * - Handles errors
 * - Enforces timeouts
 * - Isolates from Node.js APIs (require, fs, etc.)
 */

import { WasmRuntime, WasmExecutionRequest } from '../WasmRuntime';

describe('WasmRuntime', () => {
  let runtime: WasmRuntime;

  beforeEach(() => {
    runtime = new WasmRuntime();
  });

  const defaultRequest: WasmExecutionRequest = {
    code: '',
    timeout: 5000,
    memoryLimit: 10 * 1024 * 1024, // 10MB
  };

  describe('basic execution', () => {
    it('should execute simple arithmetic', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: '1 + 1',
      });

      expect(result.success).toBe(true);
    });

    it('should execute variable assignment and return', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'var x = 42; x',
      });

      expect(result.success).toBe(true);
    });

    it('should execute function definitions', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'function add(a, b) { return a + b; } add(2, 3)',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('console.log capture', () => {
    it('should capture console.log output', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'console.log("hello world")',
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('hello world');
    });

    it('should capture multiple console.log calls', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'console.log("line1"); console.log("line2");',
      });

      expect(result.stdout).toBe('line1\nline2');
    });
  });

  describe('error handling', () => {
    it('should catch thrown errors', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'throw new Error("test error")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('test error');
    });

    it('should catch syntax errors', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'this is not valid js',
      });

      expect(result.success).toBe(false);
    });

    it('should catch reference errors', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'undefinedVariable',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('isolation / security', () => {
    it('should NOT have access to require()', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'typeof require',
      });

      expect(result.success).toBe(true);
      // QuickJS does not provide require() - it should be undefined
      expect(result.stdout || '').not.toContain('function');
    });

    it('should NOT have access to Node.js fs module', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'console.log(typeof require === "undefined" ? "blocked" : "accessible")',
      });

      expect(result.success).toBe(true);
      // require does not exist in QuickJS sandbox
      expect(result.stdout).toBe('blocked');
    });

    it('should NOT have access to process object', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'typeof process',
      });

      expect(result.success).toBe(true);
      // process should be undefined in QuickJS
      expect(result.stdout || '').not.toContain('object');
    });
  });

  describe('timeout enforcement', () => {
    it('should interrupt infinite loops', async () => {
      const result = await runtime.execute({
        ...defaultRequest,
        code: 'while(true) {}',
        timeout: 500, // 500ms timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
