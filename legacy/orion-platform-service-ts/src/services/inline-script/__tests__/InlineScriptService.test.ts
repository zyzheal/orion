/**
 * InlineScriptService Tests
 *
 * Comprehensive tests covering:
 * - scanCode: AST-based security scanning for JS/TS, regex scanning for shell/Python
 * - dryRun: validation without execution
 * - execute: safe/standard/advanced level execution paths
 * - requestApproval: approval creation with different expiration types
 * - getApprovalStatus: approval status retrieval
 * - Error handling, edge cases, and boundary conditions
 */

// Mock WasmRuntime before importing InlineScriptService
jest.mock('../WasmRuntime', () => {
  return {
    WasmRuntime: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'mock output',
      }),
    })),
  };
});

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

import { InlineScriptService, InlineScriptExecutionRequest } from '../InlineScriptService';
import { InlineScriptConfig } from '../../plugin-spi/types';
import { createHash } from 'crypto';

describe('InlineScriptService', () => {
  let service: InlineScriptService;
  let mockWasmExecute: jest.Mock;
  let mockApprovalRepo: {
    findByApprovalId: jest.Mock;
    createApproval: jest.Mock;
    incrementApprovals: jest.Mock;
    updateUsageCount: jest.Mock;
    updateStatus: jest.Mock;
    findByTenantId: jest.Mock;
    findExpired: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InlineScriptService();
    // Access the mocked wasmRuntime's execute method
    mockWasmExecute = (service as any).wasmRuntime.execute;
  });

  // ============================================================
  // Helper to create a minimal valid request
  // ============================================================
  const makeRequest = (overrides: Partial<InlineScriptExecutionRequest> = {}): InlineScriptExecutionRequest => ({
    taskId: 'task-001',
    pipelineRunId: 'run-001',
    stageId: 'stage-001',
    config: {
      level: 'safe',
      language: 'javascript',
      code: 'console.log("hello")',
    },
    ...overrides,
  });

  const makeConfig = (overrides: Partial<InlineScriptConfig> = {}): InlineScriptConfig => ({
    level: 'safe',
    language: 'javascript',
    code: '1 + 1',
    ...overrides,
  });

  // ============================================================
  // scanCode
  // ============================================================
  describe('scanCode', () => {
    describe('input validation', () => {
      it('should reject null config', async () => {
        const result = await service.scanCode(null as any);
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('Missing or invalid code');
        expect(result.riskLevel).toBe('high');
      });

      it('should reject undefined config', async () => {
        const result = await service.scanCode(undefined as any);
        expect(result.valid).toBe(false);
        expect(result.riskLevel).toBe('high');
      });

      it('should reject config with non-string code', async () => {
        const result = await service.scanCode({ level: 'safe', language: 'javascript', code: 123 as any });
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('Missing or invalid code');
      });

      it('should reject config with missing code field', async () => {
        const result = await service.scanCode({ level: 'safe', language: 'javascript' } as any);
        expect(result.valid).toBe(false);
      });
    });

    describe('JavaScript/TypeScript AST scanning', () => {
      it('should allow safe JavaScript code', async () => {
        const result = await service.scanCode(makeConfig({ code: 'const x = 1 + 2; console.log(x);' }));
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.riskLevel).toBe('low');
      });

      it('should allow TypeScript code', async () => {
        const result = await service.scanCode(makeConfig({
          language: 'typescript',
          code: 'const x: number = 42; console.log(x);',
        }));
        expect(result.valid).toBe(true);
        expect(result.riskLevel).toBe('low');
      });

      it('should detect eval() calls', async () => {
        const result = await service.scanCode(makeConfig({ code: 'eval("alert(1)")' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('eval() is not allowed');
        expect(result.riskLevel).toBe('medium');
      });

      it('should detect Function constructor usage', async () => {
        const result = await service.scanCode(makeConfig({ code: 'new Function("return 1")()' }));
        expect(result.valid).toBe(false);
        // The AST scanner detects either the constructor call or bare Function reference
        expect(result.violations.some(v => v.toLowerCase().includes('function'))).toBe(true);
      });

      it('should detect require() in safe level', async () => {
        const result = await service.scanCode(makeConfig({
          level: 'safe',
          code: 'require("fs").readFileSync("/etc/passwd")',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('require() is not allowed');
      });

      it('should detect dynamic import()', async () => {
        const result = await service.scanCode(makeConfig({ code: 'import("fs")' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('dynamic import() is not allowed in safe mode');
      });

      it('should detect process access', async () => {
        const result = await service.scanCode(makeConfig({ code: 'process.exit(0)' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('process access is not allowed in safe mode');
      });

      it('should detect globalThis indirect access', async () => {
        const result = await service.scanCode(makeConfig({ code: 'globalThis["process"]' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('indirect process access is not allowed');
      });

      it('should detect globalThis indirect eval access', async () => {
        const result = await service.scanCode(makeConfig({ code: 'globalThis["eval"]' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('indirect access to eval is not allowed');
      });

      it('should detect constructor chain access (vm escape)', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'this.constructor.constructor("return process")()',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations.some(v => v.includes('constructor chain'))).toBe(true);
      });

      it('should detect setTimeout with string argument', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'setTimeout("alert(1)", 100)',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('setTimeout with string argument is not allowed');
      });

      it('should detect setInterval with string argument', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'setInterval("alert(1)", 100)',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('setInterval with string argument is not allowed');
      });

      it('should allow setTimeout with function argument', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'setTimeout(() => {}, 100)',
        }));
        expect(result.valid).toBe(true);
      });

      it('should detect rm -rf / command', async () => {
        const result = await service.scanCode(makeConfig({ code: 'rm -rf /' }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('destructive rm -rf / command detected');
        // Single violation -> medium risk
        expect(result.riskLevel).toBe('medium');
      });

      it('should detect multiple violations and classify as high risk', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'eval("x"); new Function("y"); process.exit(1)',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations.length).toBeGreaterThan(2);
        expect(result.riskLevel).toBe('high');
      });
    });

    describe('non-JS language scanning (regex fallback)', () => {
      it('should detect DROP TABLE in SQL at safe level', async () => {
        const result = await service.scanCode(makeConfig({
          language: 'sql',
          code: 'DROP TABLE users;',
          level: 'safe',
        }));
        expect(result.valid).toBe(false);
        expect(result.violations).toContain('DROP TABLE command detected');
      });

      it('should detect destructive rm -rf in shell scripts', async () => {
        const result = await service.scanCode(makeConfig({
          language: 'shell',
          code: 'rm -rf /home/data',
          level: 'safe',
        }));
        expect(result.valid).toBe(false);
      });

      it('should allow non-destructive SQL at safe level', async () => {
        const result = await service.scanCode(makeConfig({
          language: 'sql',
          code: 'SELECT * FROM users WHERE id = 1',
          level: 'safe',
        }));
        expect(result.valid).toBe(true);
      });

      it('should pass safe Python code through regex scanner', async () => {
        const result = await service.scanCode(makeConfig({
          language: 'python',
          code: 'print("hello world")',
          level: 'standard',
        }));
        expect(result.valid).toBe(true);
      });
    });

    describe('risk level classification', () => {
      it('should classify no violations as low risk', async () => {
        const result = await service.scanCode(makeConfig({ code: 'const a = 1;' }));
        expect(result.riskLevel).toBe('low');
      });

      it('should classify 1-2 violations as medium risk', async () => {
        const result = await service.scanCode(makeConfig({ code: 'eval("x")' }));
        expect(result.riskLevel).toBe('medium');
      });

      it('should classify more than 2 violations as high risk', async () => {
        const result = await service.scanCode(makeConfig({
          code: 'eval("x"); new Function("y"); process.exit(0)',
        }));
        expect(result.riskLevel).toBe('high');
      });
    });
  });

  // ============================================================
  // dryRun
  // ============================================================
  describe('dryRun', () => {
    it('should pass for safe code', async () => {
      const result = await service.dryRun(makeRequest({
        config: { level: 'safe', language: 'javascript', code: 'const x = 1;' },
      }));
      expect(result.status).toBe('success');
      expect(result.taskId).toBe('task-001');
      expect(result.durationMs).toBe(0);
    });

    it('should fail for missing config', async () => {
      const result = await service.dryRun(makeRequest({ config: undefined as any }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Missing config.code');
    });

    it('should fail for non-string code', async () => {
      const result = await service.dryRun(makeRequest({
        config: { level: 'safe', language: 'javascript', code: 123 as any },
      }));
      expect(result.status).toBe('failed');
    });

    it('should fail for code with security violations', async () => {
      const result = await service.dryRun(makeRequest({
        config: { level: 'safe', language: 'javascript', code: 'eval("hack")' },
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Security scan failed');
      expect(result.errorMessage).toContain('eval()');
    });

    it('should preserve taskId in result', async () => {
      const result = await service.dryRun(makeRequest({ taskId: 'custom-task-42' }));
      expect(result.taskId).toBe('custom-task-42');
    });

    it('should report stdout on success', async () => {
      const result = await service.dryRun(makeRequest());
      expect(result.stdout).toBe('Dry run passed - code is safe to execute');
    });
  });

  // ============================================================
  // execute - input validation
  // ============================================================
  describe('execute - input validation', () => {
    it('should fail when config is missing', async () => {
      const result = await service.execute(makeRequest({ config: undefined as any }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Missing config');
    });

    it('should fail when code is not a string', async () => {
      const result = await service.execute(makeRequest({
        config: { level: 'safe', language: 'javascript', code: null as any },
      }));
      expect(result.status).toBe('failed');
    });

    it('should fail when security scan fails', async () => {
      const result = await service.execute(makeRequest({
        config: { level: 'safe', language: 'javascript', code: 'eval("x")' },
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Security scan failed');
    });

    it('should fail for unknown script level', async () => {
      const result = await service.execute(makeRequest({
        config: { level: 'unknown' as any, language: 'javascript', code: 'const x = 1;' },
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Unknown script level');
    });

    it('should return non-negative durationMs on failure', async () => {
      const result = await service.execute(makeRequest({ config: undefined as any }));
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // execute - safe level
  // ============================================================
  describe('execute - safe level', () => {
    it('should execute safe code via WasmRuntime', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true, stdout: 'result' });
      const result = await service.execute(makeRequest({
        config: { level: 'safe', language: 'javascript', code: 'console.log("hello")' },
      }));
      expect(result.status).toBe('success');
      expect(result.stdout).toBe('result');
      expect(mockWasmExecute).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'console.log("hello")', memoryLimit: 256 * 1024 * 1024 })
      );
    });

    it('should use default timeout of 60000ms for safe level', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'safe', language: 'javascript', code: '1+1' },
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60000 }));
    });

    it('should use custom timeout when provided', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'safe', language: 'javascript', code: '1+1' },
        timeout: 5000,
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000 }));
    });

    it('should handle WasmRuntime returning failure', async () => {
      mockWasmExecute.mockResolvedValueOnce({
        success: false,
        error: 'ReferenceError: x is not defined',
      });
      const result = await service.execute(makeRequest());
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('ReferenceError: x is not defined');
    });

    it('should handle WasmRuntime throwing an exception', async () => {
      mockWasmExecute.mockRejectedValueOnce(new Error('WASM initialization failed'));
      const result = await service.execute(makeRequest());
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('WASM initialization failed');
    });

    it('should handle non-Error thrown from WasmRuntime', async () => {
      mockWasmExecute.mockRejectedValueOnce('string error');
      const result = await service.execute(makeRequest());
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Unknown error');
    });

    it('should return correct taskId', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      const result = await service.execute(makeRequest({ taskId: 'safe-task-99' }));
      expect(result.taskId).toBe('safe-task-99');
    });
  });

  // ============================================================
  // execute - standard level
  // ============================================================
  describe('execute - standard level', () => {
    it('should execute standard code via WasmRuntime', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true, stdout: 'std output' });
      const result = await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
      }));
      expect(result.status).toBe('success');
      expect(result.stdout).toBe('std output');
    });

    it('should use default timeout of 30000ms for standard level', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30000 }));
    });

    it('should use memory limit of 512MB for standard level', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(
        expect.objectContaining({ memoryLimit: 512 * 1024 * 1024 })
      );
    });

    it('should handle WasmRuntime failure at standard level', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: false, error: 'timeout exceeded' });
      const result = await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('timeout exceeded');
    });

    it('should handle WasmRuntime exception at standard level', async () => {
      mockWasmExecute.mockRejectedValueOnce(new Error('OOM'));
      const result = await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('OOM');
    });

    it('should use custom timeout for standard level', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'standard', language: 'javascript', code: '1+1' },
        timeout: 10000,
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10000 }));
    });

    it('should log network access when permissions specify networks', async () => {
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      const result = await service.execute(makeRequest({
        config: {
          level: 'standard',
          language: 'javascript',
          code: 'fetch("https://example.com")',
          permissions: { network: ['example.com'] },
        },
      }));
      expect(result.status).toBe('success');
    });
  });

  // ============================================================
  // execute - advanced level
  // ============================================================
  describe('execute - advanced level', () => {
    beforeEach(() => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn(),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      service = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      mockWasmExecute = (service as any).wasmRuntime.execute;
    });

    it('should return pending_approval when no approvalId is provided', async () => {
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('pending_approval');
    });

    it('should fail when approvalRepo is not available', async () => {
      const svcNoRepo = new InlineScriptService();
      const result = await svcNoRepo.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('approval repository');
    });

    it('should fail when tenantId is missing', async () => {
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: undefined,
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('tenant ID');
    });

    it('should fail when approval is not found', async () => {
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce(undefined);
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-missing' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('ap-missing');
      expect(result.errorMessage).toContain('not found');
    });

    it('should return pending_approval when approval status is pending', async () => {
      const codeHash = createHash('sha256').update('1+1').digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'pending',
        script_code_hash: codeHash,
        expires_at: null,
        expiration_type: 'single_use',
        used_count: 0,
        max_uses: 1,
        current_approvals: 0,
        required_approvals: 2,
      });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('pending_approval');
      expect(result.approvalId).toBe('ap-1');
    });

    it('should fail when approval has expired', async () => {
      const codeHash = createHash('sha256').update('1+1').digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: new Date(Date.now() - 100000),
        expiration_type: '24h',
        used_count: 0,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('expired');
    });

    it('should fail when single_use approval is used up', async () => {
      const codeHash = createHash('sha256').update('1+1').digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: null,
        expiration_type: 'single_use',
        used_count: 1,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('used up');
    });

    it('should fail when code hash does not match approved code', async () => {
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: 'mismatched-hash',
        expires_at: null,
        expiration_type: 'single_use',
        used_count: 0,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Code hash does not match');
    });

    it('should execute approved advanced script successfully', async () => {
      const code = 'console.log("approved")';
      const codeHash = createHash('sha256').update(code).digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: new Date(Date.now() + 86400000),
        expiration_type: '24h',
        used_count: 0,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      mockWasmExecute.mockResolvedValueOnce({ success: true, stdout: 'approved' });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code, approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('success');
      expect(result.stdout).toBe('approved');
    });

    it('should handle WasmRuntime failure for approved advanced script', async () => {
      const code = '1+1';
      const codeHash = createHash('sha256').update(code).digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: null,
        expiration_type: 'single_use',
        used_count: 0,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      mockWasmExecute.mockResolvedValueOnce({ success: false, error: 'runtime crash' });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code, approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('runtime crash');
    });

    it('should handle approvalRepo.findByApprovalId throwing an error', async () => {
      mockApprovalRepo.findByApprovalId.mockRejectedValueOnce(new Error('DB connection lost'));
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code: '1+1', approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Failed to verify approval');
    });

    it('should allow execution when approval is not expired', async () => {
      const code = '2+2';
      const codeHash = createHash('sha256').update(code).digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: new Date(Date.now() + 86400000),
        expiration_type: '7d',
        used_count: 0,
        max_uses: 5,
        current_approvals: 2,
        required_approvals: 2,
      });
      mockWasmExecute.mockResolvedValueOnce({ success: true, stdout: '4' });
      const result = await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code, approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(result.status).toBe('success');
    });

    it('should use default timeout of 60000ms for advanced level', async () => {
      const code = '1+1';
      const codeHash = createHash('sha256').update(code).digest('hex');
      mockApprovalRepo.findByApprovalId.mockResolvedValueOnce({
        status: 'approved',
        script_code_hash: codeHash,
        expires_at: null,
        expiration_type: 'single_use',
        used_count: 0,
        max_uses: 1,
        current_approvals: 2,
        required_approvals: 2,
      });
      mockWasmExecute.mockResolvedValueOnce({ success: true });
      await service.execute(makeRequest({
        config: { level: 'advanced', language: 'javascript', code, approvalId: 'ap-1' },
        tenantId: 't1',
      }));
      expect(mockWasmExecute).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60000 }));
    });
  });

  // ============================================================
  // requestApproval
  // ============================================================
  describe('requestApproval', () => {
    it('should create approval with stub when no repo is configured', async () => {
      const svc = new InlineScriptService();
      const result = await svc.requestApproval({
        tenantId: 't1',
        userId: 'u1',
        code: 'console.log("test")',
        permissions: {},
        reason: 'Testing',
      });
      expect(result.approvalId).toMatch(/^approval-/);
      expect(result.status).toBe('pending');
    });

    it('should persist approval via repository when repo is available', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn().mockResolvedValueOnce({}),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const result = await svc.requestApproval({
        tenantId: 't1',
        userId: 'u1',
        code: 'const x = 1;',
        permissions: { network: ['example.com'] },
        reason: 'Need network access',
        expirationType: '24h',
      });
      expect(result.status).toBe('pending');
      expect(result.approvalId).toMatch(/^approval-/);
      expect(mockApprovalRepo.createApproval).toHaveBeenCalledTimes(1);
      const call = mockApprovalRepo.createApproval.mock.calls[0][0];
      expect(call.tenantId).toBe('t1');
      expect(call.userId).toBe('u1');
      expect(call.scriptLanguage).toBe('javascript');
      expect(call.reason).toBe('Need network access');
      expect(call.expirationType).toBe('24h');
    });

    it('should default to single_use expiration type', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn().mockResolvedValueOnce({}),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      await svc.requestApproval({
        tenantId: 't1',
        userId: 'u1',
        code: '1+1',
        permissions: {},
        reason: 'test',
      });
      const call = mockApprovalRepo.createApproval.mock.calls[0][0];
      expect(call.expirationType).toBe('single_use');
    });

    it('should set correct expiration for 7d type', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn().mockResolvedValueOnce({}),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const before = Date.now();
      await svc.requestApproval({
        tenantId: 't1',
        userId: 'u1',
        code: '1+1',
        permissions: {},
        reason: 'test',
        expirationType: '7d',
      });
      const call = mockApprovalRepo.createApproval.mock.calls[0][0];
      const expiresAt = call.expiresAt.getTime();
      // 7 days = 604800000ms, allow small drift
      expect(expiresAt - before).toBeGreaterThan(600000000);
      expect(expiresAt - before).toBeLessThan(610000000);
    });

    it('should compute correct code hash', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn().mockResolvedValueOnce({}),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const code = 'console.log("hash test")';
      await svc.requestApproval({
        tenantId: 't1',
        userId: 'u1',
        code,
        permissions: {},
        reason: 'test',
      });
      const expectedHash = createHash('sha256').update(code).digest('hex');
      const call = mockApprovalRepo.createApproval.mock.calls[0][0];
      expect(call.scriptCodeHash).toBe(expectedHash);
    });
  });

  // ============================================================
  // getApprovalStatus
  // ============================================================
  describe('getApprovalStatus', () => {
    it('should return default pending status when no repo is available', async () => {
      const svc = new InlineScriptService();
      const result = await svc.getApprovalStatus('ap-1');
      expect(result.status).toBe('pending');
      expect(result.currentApprovals).toBe(0);
      expect(result.requiredApprovals).toBe(2);
    });

    it('should return default when tenantId is not provided', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn(),
        createApproval: jest.fn(),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const result = await svc.getApprovalStatus('ap-1');
      expect(result.status).toBe('pending');
      expect(mockApprovalRepo.findByApprovalId).not.toHaveBeenCalled();
    });

    it('should return approval status from repository', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn().mockResolvedValueOnce({
          status: 'approved',
          current_approvals: 2,
          required_approvals: 2,
        }),
        createApproval: jest.fn(),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const result = await svc.getApprovalStatus('ap-1', 't1');
      expect(result.status).toBe('approved');
      expect(result.currentApprovals).toBe(2);
      expect(result.requiredApprovals).toBe(2);
    });

    it('should return default when approval not found in repo', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn().mockResolvedValueOnce(undefined),
        createApproval: jest.fn(),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const result = await svc.getApprovalStatus('nonexistent', 't1');
      expect(result.status).toBe('pending');
    });

    it('should fallback to default when repo throws an error', async () => {
      mockApprovalRepo = {
        findByApprovalId: jest.fn().mockRejectedValueOnce(new Error('DB timeout')),
        createApproval: jest.fn(),
        incrementApprovals: jest.fn(),
        updateUsageCount: jest.fn(),
        updateStatus: jest.fn(),
        findByTenantId: jest.fn(),
        findExpired: jest.fn(),
      };
      const svc = new InlineScriptService({ approvalRepo: mockApprovalRepo as any });
      const result = await svc.getApprovalStatus('ap-1', 't1');
      expect(result.status).toBe('pending');
      expect(result.currentApprovals).toBe(0);
    });
  });

  // ============================================================
  // constructor
  // ============================================================
  describe('constructor', () => {
    it('should initialize without options', () => {
      const svc = new InlineScriptService();
      expect(svc).toBeDefined();
      expect((svc as any).approvalRepo).toBeUndefined();
    });

    it('should accept approvalRepo option', () => {
      const repo = { findByApprovalId: jest.fn() } as any;
      const svc = new InlineScriptService({ approvalRepo: repo });
      expect((svc as any).approvalRepo).toBe(repo);
    });

    it('should create WasmRuntime instance', () => {
      const svc = new InlineScriptService();
      expect((svc as any).wasmRuntime).toBeDefined();
    });
  });

  // ============================================================
  // edge cases and integration
  // ============================================================
  describe('edge cases', () => {
    it('should handle empty code string', async () => {
      const result = await service.scanCode(makeConfig({ code: '' }));
      expect(result.valid).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    it('should handle very long code', async () => {
      // Use unique variable names to avoid babel duplicate declaration errors
      const longCode = Array.from({ length: 10000 }, (_, i) => `var _v${i} = ${i};`).join('\n');
      const result = await service.scanCode(makeConfig({ code: longCode }));
      expect(result.valid).toBe(true);
    });

    it('should handle code with special characters', async () => {
      const result = await service.scanCode(makeConfig({
        code: 'const str = "hello\\n\\tworld\\0"; console.log(str);',
      }));
      expect(result.valid).toBe(true);
    });

    it('should handle JSX code', async () => {
      const result = await service.scanCode(makeConfig({
        language: 'javascript',
        code: 'const el = <div>Hello</div>;',
      }));
      expect(result.valid).toBe(true);
    });

    it('should handle TypeScript with type annotations', async () => {
      const result = await service.scanCode(makeConfig({
        language: 'typescript',
        code: 'interface Foo { bar: string; } const f: Foo = { bar: "baz" };',
      }));
      expect(result.valid).toBe(true);
    });

    it('should not duplicate violations', async () => {
      const result = await service.scanCode(makeConfig({
        code: 'eval("a"); eval("b");',
      }));
      const evalViolations = result.violations.filter(v => v.includes('eval'));
      expect(evalViolations).toHaveLength(1);
    });

    it('should detect rm -rf / with trailing spaces', async () => {
      const result = await service.scanCode(makeConfig({ code: 'rm -rf /   ' }));
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('destructive rm -rf / command detected');
    });

    it('should not detect rm -rf on non-root paths at JS level', async () => {
      // rm -rf /tmp/foo is not caught by the destructive rm -rf / pattern
      const result = await service.scanCode(makeConfig({ code: 'rm -rf /tmp/foo' }));
      // The pattern checks for `rm -rf /` at end, so this should not trigger
      const destructive = result.violations.filter(v => v.includes('destructive rm -rf'));
      expect(destructive).toHaveLength(0);
    });
  });
});
