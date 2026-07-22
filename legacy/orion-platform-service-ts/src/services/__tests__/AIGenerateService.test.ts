/**
 * AIGenerateService Tests
 *
 * Tests for G3: AI Script Generation Service.
 * Verifies: template-based fallback, keyword matching, warning generation.
 * Note: AI service HTTP integration tests require orion-ai-service running.
 */

import { AIGenerateService, GenerateRequest } from '../ai/AIGenerateService';

describe('AIGenerateService', () => {
  let service: AIGenerateService;

  beforeEach(() => {
    // Point to a non-existent AI service so all tests use template fallback
    service = new AIGenerateService({
      aiServiceUrl: 'http://127.0.0.1:1',
      timeoutMs: 2000,
    });
  });

  describe('template-based generation (fallback)', () => {
    it('should generate disk space check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check disk space',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toBe('df -h');
      expect(result.language).toBe('bash');
      expect(result.warnings).toEqual([]);
    });

    it('should generate memory check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check memory usage',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toBe('free -h');
      expect(result.language).toBe('bash');
    });

    it('should generate CPU check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check cpu load',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('top');
    });

    it('should generate process list script', async () => {
      const request: GenerateRequest = {
        prompt: 'list running processes',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('ps aux');
    });

    it('should generate network port check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check listening ports',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('netstat');
    });

    it('should generate network connectivity test script', async () => {
      const request: GenerateRequest = {
        prompt: 'test network connectivity',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('ping');
    });

    it('should generate DNS check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check DNS resolution',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('nslookup');
    });

    it('should generate nginx check script', async () => {
      const request: GenerateRequest = {
        prompt: 'check if nginx is running',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('nginx');
    });

    it('should generate Docker container list script', async () => {
      const request: GenerateRequest = {
        prompt: 'list docker containers',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('docker');
    });

    it('should generate log viewing script', async () => {
      const request: GenerateRequest = {
        prompt: 'view recent logs',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('tail');
    });

    it('should generate error search script', async () => {
      const request: GenerateRequest = {
        prompt: 'find error in logs',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('grep');
      expect(result.code).toContain('error');
    });

    it('should generate uptime script', async () => {
      const request: GenerateRequest = {
        prompt: 'check system uptime',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('uptime');
    });

    it('should generate user identity script', async () => {
      const request: GenerateRequest = {
        prompt: 'who is the current user',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('whoami');
    });

    it('should generate environment variable list script', async () => {
      const request: GenerateRequest = {
        prompt: 'list environment variables',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('env');
    });

    it('should generate OS info script', async () => {
      const request: GenerateRequest = {
        prompt: 'show operating system info',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('uname');
    });

    it('should generate large file search script', async () => {
      const request: GenerateRequest = {
        prompt: 'find large files on disk',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('find');
      expect(result.code).toContain('100M');
    });
  });

  describe('warning generation', () => {
    it('should warn when requested language does not match template', async () => {
      const request: GenerateRequest = {
        prompt: 'check disk space',
        language: 'javascript',
      };

      const result = await service.generateScript(request);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('bash');
      expect(result.warnings[0]).toContain('javascript');
    });

    it('should not warn when language matches template', async () => {
      const request: GenerateRequest = {
        prompt: 'check disk space',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.warnings).toEqual([]);
    });
  });

  describe('no match scenario', () => {
    it('should return placeholder script with warnings when no template matches', async () => {
      const request: GenerateRequest = {
        prompt: 'do something completely random and unknown',
        language: 'bash',
      };

      const result = await service.generateScript(request);

      expect(result.code).toContain('No template');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('result structure', () => {
    it('should return GeneratedScript with all required fields', async () => {
      const request: GenerateRequest = {
        prompt: 'check disk',
        language: 'bash',
        level: 'standard',
      };

      const result = await service.generateScript(request);

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('requiresApproval');
      expect(typeof result.code).toBe('string');
      expect(typeof result.language).toBe('string');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.requiresApproval).toBe('boolean');
    });
  });
});
