/**
 * Plugin SPI Types Tests
 *
 * Validates type definitions, default configurations, and constants.
 */

import {
  DEFAULT_SANDBOX_CONFIGS,
  PLATFORM_VERSION,
  PluginSandboxConfig,
  PluginSecurityLevel,
} from '../types';

describe('Plugin SPI Types', () => {
  describe('DEFAULT_SANDBOX_CONFIGS', () => {
    it('should have configs for all security levels', () => {
      expect(DEFAULT_SANDBOX_CONFIGS).toHaveProperty('HIGH');
      expect(DEFAULT_SANDBOX_CONFIGS).toHaveProperty('MEDIUM');
      expect(DEFAULT_SANDBOX_CONFIGS).toHaveProperty('LOW');
    });

    it('should have stricter limits for HIGH security', () => {
      const high = DEFAULT_SANDBOX_CONFIGS.HIGH;
      const low = DEFAULT_SANDBOX_CONFIGS.LOW;

      expect(high.memoryLimit).toBeLessThan(low.memoryLimit);
      expect(high.timeout).toBeLessThan(low.timeout);
      expect(high.cpuCores).toBeLessThanOrEqual(low.cpuCores);
      expect(high.maxConcurrent).toBeLessThan(low.maxConcurrent);
    });

    it('should have DLP sanitization enabled for HIGH and MEDIUM', () => {
      expect(DEFAULT_SANDBOX_CONFIGS.HIGH.enableDLPSanitization).toBe(true);
      expect(DEFAULT_SANDBOX_CONFIGS.MEDIUM.enableDLPSanitization).toBe(true);
      expect(DEFAULT_SANDBOX_CONFIGS.LOW.enableDLPSanitization).toBe(false);
    });

    it('should have correct memory values', () => {
      expect(DEFAULT_SANDBOX_CONFIGS.HIGH.memoryLimit).toBe(512 * 1024 * 1024); // 512MB
      expect(DEFAULT_SANDBOX_CONFIGS.MEDIUM.memoryLimit).toBe(1024 * 1024 * 1024); // 1GB
      expect(DEFAULT_SANDBOX_CONFIGS.LOW.memoryLimit).toBe(2 * 1024 * 1024 * 1024); // 2GB
    });

    it('should have correct timeout values', () => {
      expect(DEFAULT_SANDBOX_CONFIGS.HIGH.timeout).toBe(30000); // 30s
      expect(DEFAULT_SANDBOX_CONFIGS.MEDIUM.timeout).toBe(60000); // 60s
      expect(DEFAULT_SANDBOX_CONFIGS.LOW.timeout).toBe(120000); // 120s
    });
  });

  describe('PLATFORM_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(PLATFORM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should be 1.0.0', () => {
      expect(PLATFORM_VERSION).toBe('1.0.0');
    });
  });
});
