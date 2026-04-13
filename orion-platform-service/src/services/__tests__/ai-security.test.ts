/**
 * Tests for AI Security Service (TASK-1004)
 */
import {
  sanitizeInput,
  validateOutput,
  ExecutionSandbox,
  AuditLogger,
  AISecurityService,
  SecurityError,
} from '../ai-security';

describe('AI Security Service', () => {
  describe('Input Sanitization', () => {
    it('should pass clean input', () => {
      const result = sanitizeInput('Hello, world!');
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect and remove script tags', () => {
      const result = sanitizeInput('<script>alert("xss")</script>Hello');
      expect(result.violations.some((v: string) => v.includes('阻止模式'))).toBe(true);
      expect(result.sanitizedInput).not.toContain('<script>');
    });

    it('should detect javascript: protocol', () => {
      const result = sanitizeInput('javascript:alert(1)');
      expect(result.violations.some((v: string) => v.includes('阻止模式'))).toBe(true);
    });

    it('should detect eval usage', () => {
      const result = sanitizeInput('eval("malicious code")');
      expect(result.violations.some((v: string) => v.includes('阻止模式'))).toBe(true);
    });

    it('should truncate long input', () => {
      const longInput = 'a'.repeat(15000);
      const result = sanitizeInput(longInput);
      expect(result.violations.some((v: string) => v.includes('长度超过限制'))).toBe(true);
      expect(result.sanitizedInput?.length).toBeLessThanOrEqual(10000);
    });

    it('should escape HTML entities', () => {
      const result = sanitizeInput('<div>Test & "quotes"</div>');
      expect(result.sanitizedInput).toContain('&lt;');
      expect(result.sanitizedInput).toContain('&amp;');
      expect(result.sanitizedInput).toContain('&quot;');
    });
  });

  describe('Output Validation', () => {
    it('should pass clean output', () => {
      const result = validateOutput('This is a clean output');
      expect(result.passed).toBe(true);
      expect(result.riskScore).toBe(0);
    });

    it('should detect long output', () => {
      const longOutput = 'a'.repeat(60000);
      const result = validateOutput(longOutput);
      expect(result.violations.some((v: string) => v.includes('长度超过限制'))).toBe(true);
    });

    it('should detect potential API keys', () => {
      const output = 'Your API key is sk_abcdefghij1234567890abcd';
      const result = validateOutput(output);
      expect(result.violations.some((v: string) => v.includes('敏感信息'))).toBe(true);
    });

    it('should detect code injection attempts', () => {
      const output = '<script>document.cookie</script>';
      const result = validateOutput(output);
      expect(result.violations.some((v: string) => v.includes('代码注入'))).toBe(true);
    });
  });

  describe('Execution Sandbox', () => {
    let sandbox: ExecutionSandbox;

    beforeEach(() => {
      sandbox = new ExecutionSandbox(3000);
    });

    it('should execute safe code', async () => {
      const code = 'return 1 + 1';
      const result = await sandbox.execute(code);
      expect(result).toBe(2);
    });

    it('should execute async code', async () => {
      const code = 'return Promise.resolve(42)';
      const result = await sandbox.execute(code);
      expect(result).toBe(42);
    });

    it('should reject require usage', async () => {
      const code = 'return require("fs")';
      await expect(sandbox.execute(code)).rejects.toThrow('代码验证失败');
    });

    it('should reject eval usage', async () => {
      const code = 'return eval("malicious")';
      await expect(sandbox.execute(code)).rejects.toThrow('代码验证失败');
    });

    it('should reject process access', async () => {
      const code = 'return process.env';
      await expect(sandbox.execute(code)).rejects.toThrow('代码验证失败');
    });

    it('should timeout long-running code', async () => {
      const code = 'return new Promise(() => {})';
      await expect(sandbox.execute(code)).rejects.toThrow('超时');
    });

    it('should allow console methods', async () => {
      const code = 'console.log("test"); return "done"';
      const result = await sandbox.execute(code);
      expect(result).toBe('done');
    });

    it('should track audit logs', async () => {
      await sandbox.execute('return 1');
      const logs = sandbox.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logger', () => {
    let logger: AuditLogger;

    beforeEach(() => {
      logger = new AuditLogger(100);
    });

    it('should log security events', () => {
      logger.log({
        action: 'input_sanitized',
        userId: 'user-1',
        sessionId: 'session-1',
        details: { violations: ['test violation'] },
      });

      const logs = logger.query({});
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('input_sanitized');
    });

    it('should filter logs by action', () => {
      logger.log({
        action: 'input_sanitized',
        userId: 'user-1',
        sessionId: 'session-1',
        details: {},
      });
      logger.log({
        action: 'output_validated',
        userId: 'user-1',
        sessionId: 'session-2',
        details: {},
      });

      const inputLogs = logger.query({ action: 'input_sanitized' });
      expect(inputLogs.length).toBe(1);
    });

    it('should filter logs by userId', () => {
      logger.log({
        action: 'input_sanitized',
        userId: 'user-1',
        sessionId: 'session-1',
        details: {},
      });
      logger.log({
        action: 'input_sanitized',
        userId: 'user-2',
        sessionId: 'session-2',
        details: {},
      });

      const user1Logs = logger.query({ userId: 'user-1' });
      expect(user1Logs.length).toBe(1);
    });

    it('should export logs as JSON', () => {
      logger.log({
        action: 'input_sanitized',
        userId: 'user-1',
        sessionId: 'session-1',
        details: {},
      });

      const json = logger.export('json');
      expect(JSON.parse(json)).toHaveLength(1);
    });

    it('should respect max logs limit', () => {
      for (let i = 0; i < 150; i++) {
        logger.log({
          action: 'input_sanitized',
          userId: `user-${i}`,
          sessionId: `session-${i}`,
          details: {},
        });
      }
      expect(logger.query({}).length).toBeLessThanOrEqual(100);
    });
  });

  describe('AISecurityService', () => {
    let service: AISecurityService;

    beforeEach(() => {
      service = new AISecurityService();
    });

    it('should process clean request', async () => {
      const result = await service.processRequest('Hello, AI!', 'user-1');
      expect(result.output).toBe('Hello, AI!');
      expect(result.riskScore).toBe(0);
    });

    it('should sanitize malicious input', async () => {
      const result = await service.processRequest('<script>alert(1)</script>test', 'user-1');
      expect(result.output).not.toContain('<script>');
    });

    it('should reject high-risk input', async () => {
      const maliciousInput = 'eval(require("fs").readFileSync("/etc/passwd"))'.repeat(10);
      const result = await service.processRequest(maliciousInput, 'user-1');
      // High-risk input should have riskScore >= 50
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('should track audit logs', async () => {
      await service.processRequest('test input', 'user-1');
      const logs = service.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should export audit logs', async () => {
      await service.processRequest('test', 'user-1');
      const json = service.exportAuditLogs('json');
      expect(JSON.parse(json)).toBeDefined();
    });
  });
});
