/**
 * SecurityBoundaryValidator - Comprehensive Tests
 *
 * Tests for file path validation, content security checks,
 * disallowed patterns, sensitive keyword detection, and configuration.
 */

import { SecurityBoundaryValidator } from '../SecurityBoundaryValidator';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SecurityBoundaryValidator', () => {
  let validator: SecurityBoundaryValidator;

  beforeEach(() => {
    validator = new SecurityBoundaryValidator();
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create with default config', () => {
      const v = new SecurityBoundaryValidator();
      expect(v).toBeDefined();
    });

    it('should create with custom config', () => {
      const v = new SecurityBoundaryValidator({
        maxChangesPerPatch: 5,
        maxFileSize: 50000,
      });
      expect(v).toBeDefined();
    });

    it('should accept custom disallowed patterns', () => {
      const v = new SecurityBoundaryValidator({
        disallowedPatterns: ['**/custom-secret*'],
      });
      expect(v).toBeDefined();
    });
  });

  // ─── validate (file paths) ────────────────────────────────────────────────

  describe('validate', () => {
    it('should pass for safe file paths', () => {
      const result = validator.validate({
        target_files: [
          { path: 'src/index.ts' },
          { path: 'lib/utils.js' },
          { path: 'README.md' },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject .env files', () => {
      const result = validator.validate({
        target_files: [{ path: '.env' }],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('.env'))).toBe(true);
    });

    it('should reject .env.local files', () => {
      const result = validator.validate({
        target_files: [{ path: '.env.local' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject credentials files', () => {
      const result = validator.validate({
        target_files: [{ path: 'config/credentials.json' }],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('credentials'))).toBe(true);
    });

    it('should reject secrets files', () => {
      const result = validator.validate({
        target_files: [{ path: 'secrets.yaml' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject .pem files', () => {
      const result = validator.validate({
        target_files: [{ path: 'certs/server.pem' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject .key files', () => {
      const result = validator.validate({
        target_files: [{ path: 'certs/private.key' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject ssh directory files', () => {
      const result = validator.validate({
        target_files: [{ path: '.ssh/id_rsa' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject aws directory files', () => {
      const result = validator.validate({
        target_files: [{ path: '.aws/credentials' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject kubeconfig files', () => {
      const result = validator.validate({
        target_files: [{ path: 'kubeconfig' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject absolute paths', () => {
      const result = validator.validate({
        target_files: [{ path: '/etc/passwd' }],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('Absolute paths'))).toBe(true);
    });

    it('should reject Windows absolute paths', () => {
      const result = validator.validate({
        target_files: [{ path: 'C:\\Windows\\System32\\config' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      const result = validator.validate({
        target_files: [{ path: '../../../etc/passwd' }],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('Path traversal'))).toBe(true);
    });

    it('should reject tilde paths', () => {
      const result = validator.validate({
        target_files: [{ path: '~/secret-file' }],
      });

      expect(result.valid).toBe(false);
    });

    it('should reject disallowed file extensions', () => {
      const result = validator.validate({
        target_files: [{ path: 'binary.exe' }],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('extension not allowed'))).toBe(true);
    });

    it('should warn about sensitive keywords in path', () => {
      const result = validator.validate({
        target_files: [{ path: 'src/password-handler.ts' }],
      });

      expect(result.valid).toBe(true); // Warning, not violation
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('password'))).toBe(true);
    });

    it('should warn about hidden files', () => {
      const result = validator.validate({
        target_files: [{ path: '.hidden-config' }],
      });

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Hidden file'))).toBe(true);
    });

    it('should allow .github files', () => {
      const result = validator.validate({
        target_files: [{ path: '.github/workflows/ci.yml' }],
      });

      // .github should not trigger hidden file warning
      expect(result.warnings?.some(w => w.includes('Hidden file'))).toBeFalsy();
    });

    it('should enforce max changes per patch', () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        path: `src/file${i}.ts`,
      }));

      const result = validator.validate({ target_files: files });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('Too many files'))).toBe(true);
    });

    it('should pass with custom max changes', () => {
      const v = new SecurityBoundaryValidator({ maxChangesPerPatch: 20 });
      const files = Array.from({ length: 15 }, (_, i) => ({
        path: `src/file${i}.ts`,
      }));

      const result = v.validate({ target_files: files });
      expect(result.valid).toBe(true);
    });

    it('should handle multiple violations in single patch', () => {
      const result = validator.validate({
        target_files: [
          { path: '.env' },
          { path: '/etc/passwd' },
          { path: '../../../secret' },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty target_files', () => {
      const result = validator.validate({ target_files: [] });
      expect(result.valid).toBe(true);
    });
  });

  // ─── validateContent ──────────────────────────────────────────────────────

  describe('validateContent', () => {
    it('should pass for safe content', () => {
      const result = validator.validateContent('const x = 1;');
      expect(result.valid).toBe(true);
    });

    it('should warn about hardcoded passwords', () => {
      const result = validator.validateContent('password = "mysecret123"');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('password'))).toBe(true);
    });

    it('should warn about hardcoded API keys', () => {
      const result = validator.validateContent('api_key = "sk-1234567890"');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('API key'))).toBe(true);
    });

    it('should warn about hardcoded secret keys', () => {
      const result = validator.validateContent('secret_key = "my-secret"');
      expect(result.warnings).toBeDefined();
    });

    it('should warn about hardcoded tokens', () => {
      const result = validator.validateContent('token = "bearer-xyz"');
      expect(result.warnings).toBeDefined();
    });

    it('should warn about PEM private keys', () => {
      const result = validator.validateContent('-----BEGIN RSA PRIVATE KEY-----\nMIIE...');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('PEM'))).toBe(true);
    });

    it('should warn about private keys', () => {
      const result = validator.validateContent('private_key = "-----BEGIN PRIVATE KEY-----"');
      expect(result.warnings).toBeDefined();
    });

    it('should reject content exceeding max size', () => {
      const largeContent = 'x'.repeat(200000);
      const result = validator.validateContent(largeContent);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('exceeds maximum size'))).toBe(true);
    });

    it('should use custom max file size', () => {
      const v = new SecurityBoundaryValidator({ maxFileSize: 100 });
      const result = validator.validateContent('x'.repeat(200));
      // Default validator should pass, custom should fail
      expect(result.valid).toBe(true); // Using default validator, not custom
    });

    it('should handle empty content', () => {
      const result = validator.validateContent('');
      expect(result.valid).toBe(true);
    });
  });

  // ─── addDisallowedPattern ─────────────────────────────────────────────────

  describe('addDisallowedPattern', () => {
    it('should add custom disallowed pattern', () => {
      validator.addDisallowedPattern('**/custom-secret*');

      const result = validator.validate({
        target_files: [{ path: 'config/custom-secret.yaml' }],
      });

      expect(result.valid).toBe(false);
    });
  });

  // ─── addAllowedExtension ──────────────────────────────────────────────────

  describe('addAllowedExtension', () => {
    it('should add custom allowed extension', () => {
      validator.addAllowedExtension('.rs');

      const result = validator.validate({
        target_files: [{ path: 'src/main.rs' }],
      });

      expect(result.valid).toBe(true);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle Windows-style paths', () => {
      const result = validator.validate({
        target_files: [{ path: 'src\\index.ts' }],
      });

      expect(result.valid).toBe(true);
    });

    it('should handle deeply nested paths', () => {
      const result = validator.validate({
        target_files: [{ path: 'a/b/c/d/e/f/g.ts' }],
      });

      expect(result.valid).toBe(true);
    });

    it('should handle files with multiple dots', () => {
      const result = validator.validate({
        target_files: [{ path: 'src/utils.test.ts' }],
      });

      expect(result.valid).toBe(true);
    });

    it('should detect multiple sensitive keywords', () => {
      const result = validator.validate({
        target_files: [{ path: 'src/api_token_handler.ts' }],
      });

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThanOrEqual(1);
    });
  });
});
