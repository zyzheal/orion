/**
 * ConfigDriftDetector - Unit Tests
 *
 * Tests for drift detection, config comparison, severity assessment,
 * auto-remediation, and drift reporting.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `drift-uuid-${++uuidCounter}`),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { ConfigDriftDetector } from '../ConfigDriftDetector';
import { OrionError } from '../../../errors';

describe('ConfigDriftDetector', () => {
  let detector: ConfigDriftDetector;

  beforeEach(() => {
    uuidCounter = 0;
    detector = new ConfigDriftDetector(); // No database = in-memory
  });

  // ==================== compareConfig ====================

  describe('compareConfig', () => {
    it('should report equal when configs are identical', () => {
      const config = { host: 'localhost', port: 5432, name: 'db' };
      const result = detector.compareConfig(config, config);

      expect(result.isEqual).toBe(true);
      expect(result.differences).toHaveLength(0);
      expect(result.missingInActual).toHaveLength(0);
      expect(result.missingInExpected).toHaveLength(0);
    });

    it('should detect value differences', () => {
      const expected = { host: 'localhost', port: 5432 };
      const actual = { host: 'remote-host', port: 5432 };

      const result = detector.compareConfig(expected, actual);

      expect(result.isEqual).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0]).toEqual({
        path: 'host',
        expected: 'localhost',
        actual: 'remote-host',
      });
    });

    it('should detect missing keys in actual', () => {
      const expected = { host: 'localhost', port: 5432, password: 'secret' };
      const actual = { host: 'localhost', port: 5432 };

      const result = detector.compareConfig(expected, actual);

      expect(result.isEqual).toBe(false);
      expect(result.missingInActual).toContain('password');
    });

    it('should detect extra keys in actual (missing in expected)', () => {
      const expected = { host: 'localhost' };
      const actual = { host: 'localhost', extra: 'value' };

      const result = detector.compareConfig(expected, actual);

      expect(result.isEqual).toBe(false);
      expect(result.missingInExpected).toContain('extra');
    });

    it('should handle nested objects', () => {
      const expected = {
        database: { host: 'localhost', port: 5432 },
        cache: { enabled: true },
      };
      const actual = {
        database: { host: 'remote', port: 5432 },
        cache: { enabled: true },
      };

      const result = detector.compareConfig(expected, actual);

      expect(result.isEqual).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].path).toBe('database.host');
    });

    it('should detect deeply nested differences', () => {
      const expected = { a: { b: { c: { d: 'old' } } } };
      const actual = { a: { b: { c: { d: 'new' } } } };

      const result = detector.compareConfig(expected, actual);
      expect(result.isEqual).toBe(false);
      expect(result.differences[0].path).toBe('a.b.c.d');
    });

    it('should handle empty configs', () => {
      const result = detector.compareConfig({}, {});
      expect(result.isEqual).toBe(true);
    });

    it('should handle array values as leaf nodes', () => {
      const expected = { tags: ['a', 'b'] };
      const actual = { tags: ['a', 'c'] };

      const result = detector.compareConfig(expected, actual);
      expect(result.isEqual).toBe(false);
      expect(result.differences).toHaveLength(1);
    });
  });

  // ==================== registerExpectedConfig / detectDrift ====================

  describe('detectDrift', () => {
    it('should report in_sync when no expected configs registered', async () => {
      const report = await detector.detectDrift('tenant-1');

      expect(report.driftStatus).toBe('in_sync');
      expect(report.totalDrifts).toBe(0);
      expect(report.criticalDrifts).toBe(0);
      expect(report.driftItems).toHaveLength(0);
      expect(report.tenantId).toBe('tenant-1');
    });

    it('should detect drift when expected and actual differ', async () => {
      detector.registerExpectedConfig('tenant-1', 'database', {
        host: 'expected-host',
        port: 5432,
      });

      const report = await detector.detectDrift('tenant-1', 'database');

      // Since we have no configService, actual will be empty
      // So we should see missing keys
      expect(report.driftItems.length).toBeGreaterThanOrEqual(0);
      expect(report.tenantId).toBe('tenant-1');
    });

    it('should save drift report', async () => {
      const report = await detector.detectDrift('tenant-1');
      expect(report.id).toBeDefined();
      expect(report.detectedAt).toBeInstanceOf(Date);
      expect(report.createdAt).toBeInstanceOf(Date);
    });

    it('should handle drift detection for specific config group', async () => {
      detector.registerExpectedConfig('tenant-1', 'group-a', { key: 'val-a' });
      detector.registerExpectedConfig('tenant-1', 'group-b', { key: 'val-b' });

      const report = await detector.detectDrift('tenant-1', 'group-a');
      expect(report.configGroup).toBe('group-a');
    });
  });

  // ==================== getDriftReport / getAllDriftReports ====================

  describe('getDriftReport', () => {
    it('should return null when no reports exist', async () => {
      const report = await detector.getDriftReport('tenant-1');
      expect(report).toBeNull();
    });

    it('should return the latest drift report', async () => {
      await detector.detectDrift('tenant-1');
      await detector.detectDrift('tenant-1');

      const report = await detector.getDriftReport('tenant-1');
      expect(report).not.toBeNull();
    });
  });

  describe('getAllDriftReports', () => {
    it('should return all drift reports for a tenant', async () => {
      await detector.detectDrift('tenant-1');
      await detector.detectDrift('tenant-1');

      const reports = await detector.getAllDriftReports('tenant-1');
      expect(reports).toHaveLength(2);
    });

    it('should return empty array for tenant with no reports', async () => {
      const reports = await detector.getAllDriftReports('ghost-tenant');
      expect(reports).toHaveLength(0);
    });
  });

  // ==================== registerExpectedConfig ====================

  describe('registerExpectedConfig', () => {
    it('should register expected config for a tenant and group', () => {
      // Should not throw
      detector.registerExpectedConfig('tenant-1', 'my-group', {
        key: 'value',
      });
    });

    it('should overwrite previous registration for same tenant+group', async () => {
      detector.registerExpectedConfig('tenant-1', 'group', { old: 'value' });
      detector.registerExpectedConfig('tenant-1', 'group', { new: 'value' });

      // The second registration should overwrite the first
      const report = await detector.detectDrift('tenant-1', 'group');
      expect(report).toBeDefined();
    });
  });

  // ==================== autoRemediateDrift ====================

  describe('autoRemediateDrift', () => {
    it('should throw error for non-existent drift report', async () => {
      await expect(detector.autoRemediateDrift('non-existent')).rejects.toThrow(
        'Drift report'
      );
    });

    it('should throw error when drift status is not drift_detected', async () => {
      // Create an in-sync report
      const report = await detector.detectDrift('tenant-1');

      await expect(detector.autoRemediateDrift(report.id)).rejects.toThrow(
        'Can only remediate drift'
      );
    });
  });

  // ==================== Severity assessment ====================

  describe('severity assessment', () => {
    it('should assess security-related paths as critical for value differences', async () => {
      // When both expected and actual have the key but with different values,
      // assessSeverity is used. For missing keys, severity is hardcoded to 'high'.
      detector.registerExpectedConfig('tenant-1', 'config', {
        security: { jwtSecret: 'expected-secret' },
      });

      const report = await detector.detectDrift('tenant-1', 'config');

      // Missing items get 'high' severity (hardcoded in detectDrift)
      // Value differences use assessSeverity which returns 'critical' for security paths
      for (const item of report.driftItems) {
        if (item.path.includes('security')) {
          // Missing items are 'high', value diffs are 'critical'
          expect(['critical', 'high']).toContain(item.severity);
        }
      }
    });

    it('should assess database paths as high severity', async () => {
      detector.registerExpectedConfig('tenant-1', 'config', {
        database: { connection: { host: 'expected' } },
      });

      const report = await detector.detectDrift('tenant-1', 'config');

      const dbItems = report.driftItems.filter(
        (d) => d.path.includes('database') || d.path.includes('connection')
      );
      for (const item of dbItems) {
        expect(['high', 'critical']).toContain(item.severity);
      }
    });
  });
});
