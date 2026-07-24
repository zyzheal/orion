/**
 * AIGenerateService Tests
 *
 * Verifies template-based script generation fallback.
 */

import { AIGenerateService, GenerateRequest } from '../AIGenerateService';

describe('AIGenerateService', () => {
  let service: AIGenerateService;

  beforeEach(() => {
    // Point to non-existent AI service to force template fallback
    service = new AIGenerateService({
      aiServiceUrl: 'http://localhost:19999',
      timeoutMs: 2000,
    });
  });

  describe('template-based generation', () => {
    it('should generate disk check script', async () => {
      const result = await service.generateScript({
        prompt: 'Check disk space usage',
        language: 'bash',
      });

      expect(result.code).toBe('df -h');
      expect(result.language).toBe('bash');
      expect(result.warnings).toEqual([]);
    });

    it('should generate memory check script', async () => {
      const result = await service.generateScript({
        prompt: 'Show memory usage',
        language: 'bash',
      });

      expect(result.code).toBe('free -h');
      expect(result.language).toBe('bash');
    });

    it('should generate port scan script', async () => {
      const result = await service.generateScript({
        prompt: 'Scan for open ports and check listening services',
        language: 'bash',
      });

      expect(result.code).toContain('netstat');
    });

    it('should generate process list script', async () => {
      const result = await service.generateScript({
        prompt: 'List running processes',
        language: 'bash',
      });

      expect(result.code).toContain('ps aux');
    });

    it('should generate nginx check script', async () => {
      const result = await service.generateScript({
        prompt: 'Check if nginx is running',
        language: 'bash',
      });

      expect(result.code).toContain('nginx');
    });

    it('should generate docker containers script', async () => {
      const result = await service.generateScript({
        prompt: 'Show docker containers',
        language: 'bash',
      });

      expect(result.code).toContain('docker ps');
    });

    it('should generate log viewing script', async () => {
      const result = await service.generateScript({
        prompt: 'View recent log entries',
        language: 'bash',
      });

      expect(result.code).toContain('tail');
    });

    it('should generate uptime script', async () => {
      const result = await service.generateScript({
        prompt: 'Check system uptime and when it booted',
        language: 'bash',
      });

      expect(result.code).toContain('uptime');
    });

    it('should generate OS info script', async () => {
      const result = await service.generateScript({
        prompt: 'Show operating system and kernel information',
        language: 'bash',
      });

      expect(result.code).toContain('uname');
    });

    it('should warn when language does not match template', async () => {
      const result = await service.generateScript({
        prompt: 'Check disk space',
        language: 'javascript',
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('bash');
    });

    it('should return placeholder for unknown prompts', async () => {
      const result = await service.generateScript({
        prompt: 'do something magical and unknown',
        language: 'bash',
      });

      expect(result.code).toContain('No template found');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.requiresApproval).toBe(true);
    });
  });
});
