// orion-platform-service/src/services/privacy/__tests__/SecretSanitizer.test.ts
import { SecretSanitizer } from '../SecretSanitizer';

describe('SecretSanitizer', () => {
  let sanitizer: SecretSanitizer;

  beforeEach(() => {
    sanitizer = new SecretSanitizer();
  });

  describe('detectSecrets', () => {
    it('should detect API keys', () => {
      const text = 'api_key: sk-1234567890abcdef1234567890abcdef';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('api_key_openai');
    });

    it('should detect passwords', () => {
      const text = 'password: mySecretP@ss123!';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'password')).toBe(true);
    });

    it('should detect JWT tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'jwt_token')).toBe(true);
    });

    it('should detect AWS access keys', () => {
      const text = 'AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'api_key_aws')).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      const text = 'token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'github_token')).toBe(true);
    });

    it('should detect private keys', () => {
      const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7M';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'private_key')).toBe(true);
    });

    it('should detect database URLs', () => {
      const text = 'DATABASE_URL: postgres://user:password@localhost:5432/mydb';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'db_url')).toBe(true);
    });
  });

  describe('sanitize', () => {
    it('should replace secrets with placeholders', () => {
      const text = 'api_key: sk-1234567890abcdef1234567890abcdef and password: secret123';
      const result = sanitizer.sanitize(text);
      expect(result.sanitized).toContain('[API_KEY_REDACTED]');
      expect(result.sanitized).toContain('[PASSWORD_REDACTED]');
      expect(result.detectedCount).toBe(2);
    });

    it('should preserve non-secret content', () => {
      const text = 'This is normal text without secrets';
      const result = sanitizer.sanitize(text);
      expect(result.sanitized).toBe(text);
      expect(result.detectedCount).toBe(0);
    });

    it('should track detection metadata', () => {
      const text = 'password: mySecretP@ss123!';
      const result = sanitizer.sanitize(text);
      expect(result.detected[0].type).toBe('password');
      expect(result.detected[0].confidence).toBeGreaterThan(0);
      expect(result.detected[0].start).toBeGreaterThanOrEqual(0);
      expect(result.detected[0].end).toBeGreaterThan(result.detected[0].start);
    });

    it('should measure processing time', () => {
      const text = 'api_key: sk-test12345678901234567890abcdef';
      const result = sanitizer.sanitize(text);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addCustomPattern', () => {
    it('should allow custom pattern registration', () => {
      sanitizer.addCustomPattern('custom_token', 'CUSTOM-[a-zA-Z0-9]{16}', 0.9);
      const text = 'token: CUSTOM-abc123def456ghi7';
      const detected = sanitizer.detectSecrets(text);
      expect(detected.some(d => d.type === 'custom_token')).toBe(true);
    });
  });

  describe('detectionRate', () => {
    it('should achieve >95% detection rate', () => {
      const testCases = [
        'api_key: sk-test123456789',
        'AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'password: MyP@ssw0rd!123',
        'private_key: -----BEGIN RSA PRIVATE KEY-----',
        'AWS_ACCESS_KEY: AKIAIOSFODNN7EXAMPLE',
        'db_url: postgres://admin:secret@localhost:5432/production',
        'jwt: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I',
      ];

      let detectedCount = 0;
      for (const text of testCases) {
        const detected = sanitizer.detectSecrets(text);
        if (detected.length > 0) detectedCount++;
      }

      const rate = detectedCount / testCases.length;
      expect(rate).toBeGreaterThanOrEqual(0.95);
    });
  });
});