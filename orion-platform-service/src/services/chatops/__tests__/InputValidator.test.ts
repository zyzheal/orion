/**
 * InputValidator 单元测试
 *
 * 测试输入安全校验：危险字符、路径遍历、命令白名单、Schema 校验、敏感参数拦截、脱敏。
 */

import { InputValidator, ParsedCommand } from '../InputValidator';

describe('InputValidator', () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
    // Register a test schema
    validator.registerSchema('deploy', {
      type: 'object',
      properties: {
        service: { type: 'string' },
        environment: { type: 'string', enum: ['dev', 'staging', 'prod'] },
        version: { type: 'string' },
      },
      required: ['service', 'environment'],
      additionalProperties: false,
    });

    validator.registerSchema('restart', {
      type: 'object',
      properties: {
        namespace: { type: 'string' },
        pod: { type: 'string' },
      },
      required: ['namespace', 'pod'],
    });

    validator.registerSchema('status', {
      type: 'object',
      properties: {
        target: { type: 'string' },
      },
    });
  });

  describe('constructor', () => {
    it('should create a new InputValidator', () => {
      const v = new InputValidator();
      expect(v).toBeDefined();
    });
  });

  describe('registerSchema', () => {
    it('should register a command schema', () => {
      const v = new InputValidator();
      v.registerSchema('test', { type: 'object', properties: {} });
      // No error thrown means success
      expect(true).toBe(true);
    });

    it('should handle invalid schema gracefully', () => {
      const v = new InputValidator();
      // Invalid schema (not a valid JSON Schema) - should not throw
      v.registerSchema('bad', { type: 'invalid-type' } as any);
      expect(true).toBe(true);
    });
  });

  describe('validate - command whitelist', () => {
    it('should reject unknown commands', () => {
      const result = validator.validate('/unknown', {
        command: '/unknown',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('未知命令');
    });

    it('should accept known commands without leading slash', () => {
      const result = validator.validate('deploy service=api environment=staging', {
        command: 'deploy',
        params: { service: 'api', environment: 'staging' },
      });

      expect(result.valid).toBe(true);
    });

    it('should accept known commands with leading slash', () => {
      const result = validator.validate('/deploy service=api environment=staging', {
        command: '/deploy',
        params: { service: 'api', environment: 'staging' },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('validate - dangerous characters', () => {
    it('should reject semicolons in /command mode', () => {
      // Need to register a schema first for 'cmd'
      validator.registerSchema('cmd', { type: 'object', properties: {} });
      const result = validator.validate('/cmd; rm -rf /', {
        command: '/cmd',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许的字符');
    });

    it('should reject pipe characters in /command mode', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test | cat /etc/passwd', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许的字符');
    });

    it('should reject ampersand in /command mode', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test & background', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许的字符');
    });

    it('should reject backticks in /command mode', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test `whoami`', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许的字符');
    });

    it('should reject $ in /command mode', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test $(cmd)', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许的字符');
    });

    it('should NOT check dangerous chars for non-slash commands', () => {
      // 'status' is registered, and non-slash commands skip dangerous char check
      const result = validator.validate('status target=api; echo hi', {
        command: 'status',
        params: { target: 'api' },
      });

      // Should pass dangerous char check (but may still fail for other reasons)
      // Since status schema doesn't restrict additional props, it should be valid
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - path traversal', () => {
    it('should reject ../ in input', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test ../../etc/passwd', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('路径遍历');
    });

    it('should reject ..\\ in input', () => {
      validator.registerSchema('test', { type: 'object', properties: {} });
      const result = validator.validate('/test ..\\windows\\system32', {
        command: '/test',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不允许');
    });

    it('should reject path traversal in any mode (not just /command)', () => {
      const result = validator.validate('../etc/passwd', {
        command: 'status',
        params: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('路径遍历');
    });
  });

  describe('validate - JSON Schema validation', () => {
    it('should reject when required fields are missing', () => {
      const result = validator.validate('/deploy environment=staging', {
        command: '/deploy',
        params: { environment: 'staging' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid enum values', () => {
      const result = validator.validate('/deploy service=api environment=invalid', {
        command: '/deploy',
        params: { service: 'api', environment: 'invalid' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject additional properties when not allowed', () => {
      const result = validator.validate('/deploy service=api environment=staging extra=bad', {
        command: '/deploy',
        params: { service: 'api', environment: 'staging', extra: 'bad' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid params', () => {
      const result = validator.validate('/deploy service=api environment=prod version=1.0', {
        command: '/deploy',
        params: { service: 'api', environment: 'prod', version: '1.0' },
      });

      expect(result.valid).toBe(true);
    });

    it('should validate restart command schema', () => {
      const result = validator.validate('/restart namespace=production pod=api-123', {
        command: '/restart',
        params: { namespace: 'production', pod: 'api-123' },
      });

      expect(result.valid).toBe(true);
    });

    it('should reject restart with missing pod', () => {
      const result = validator.validate('/restart namespace=production', {
        command: '/restart',
        params: { namespace: 'production' },
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('validate - sensitive parameter interception', () => {
    it('should reject password parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', password: 'secret123' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
      expect(result.error).toContain('password');
    });

    it('should reject secret parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', secret: 'my-secret' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
    });

    it('should reject token parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', token: 'jwt-token' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
    });

    it('should reject api_key parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', api_key: 'key-123' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
    });

    it('should reject private_key parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', private_key: '-----BEGIN...' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
    });

    it('should reject credential parameter', () => {
      const result = validator.validate('/status target=api', {
        command: 'status',
        params: { target: 'api', credential: 'some-cred' },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('敏感参数');
    });
  });

  describe('sanitize (static)', () => {
    it('should redact password fields', () => {
      const input = { username: 'admin', password: 'secret123' };
      const result = InputValidator.sanitize(input);

      expect(result.username).toBe('admin');
      expect(result.password).toBe('***REDACTED***');
    });

    it('should redact multiple sensitive fields', () => {
      const input = {
        name: 'test',
        password: 'pass',
        secret: 'sec',
        token: 'tok',
        api_key: 'key',
        credential: 'cred',
      };
      const result = InputValidator.sanitize(input);

      expect(result.name).toBe('test');
      expect(result.password).toBe('***REDACTED***');
      expect(result.secret).toBe('***REDACTED***');
      expect(result.token).toBe('***REDACTED***');
      expect(result.api_key).toBe('***REDACTED***');
      expect(result.credential).toBe('***REDACTED***');
    });

    it('should not modify non-sensitive fields', () => {
      const input = { service: 'api', environment: 'prod', version: '1.0' };
      const result = InputValidator.sanitize(input);

      expect(result).toEqual(input);
    });

    it('should not mutate the original object', () => {
      const input = { password: 'secret' };
      const result = InputValidator.sanitize(input);

      expect(input.password).toBe('secret');
      expect(result.password).toBe('***REDACTED***');
    });

    it('should handle empty object', () => {
      const result = InputValidator.sanitize({});
      expect(result).toEqual({});
    });

    it('should redact all 10 sensitive key types', () => {
      const input: Record<string, unknown> = {
        password: 'a',
        secret: 'b',
        token: 'c',
        key: 'd',
        credential: 'e',
        access_key: 'f',
        api_key: 'g',
        private_key: 'h',
        certificate: 'i',
        private_key_path: 'j',
      };
      const result = InputValidator.sanitize(input);

      for (const key of Object.keys(input)) {
        expect(result[key]).toBe('***REDACTED***');
      }
    });
  });

  describe('validate - edge cases', () => {
    it('should handle slash-prefixed command name extraction', () => {
      // /status -> status (after removing slash)
      validator.registerSchema('mycommand', { type: 'object', properties: {} });
      const result = validator.validate('/mycommand', {
        command: '/mycommand',
        params: {},
      });

      expect(result.valid).toBe(true);
    });

    it('should validate with cached validateFn (second call)', () => {
      // First call caches the validateFn
      validator.validate('/deploy service=api environment=staging', {
        command: '/deploy',
        params: { service: 'api', environment: 'staging' },
      });

      // Second call should use cached version
      const result = validator.validate('/deploy service=api environment=prod', {
        command: '/deploy',
        params: { service: 'api', environment: 'prod' },
      });

      expect(result.valid).toBe(true);
    });
  });
});
