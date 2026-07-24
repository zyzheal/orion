/**
 * SecurityScannerService Unit Tests
 */

import { SecurityScannerService, ScanOptions, ScanResult } from '../SecurityScannerService';
import { SecurityScanRepository, SecurityFindingRepository } from '../../../repositories/SecurityScanRepository';

// Mock repositories
const mockScanRepository = {
  findById: jest.fn().mockImplementation(async (id: string) => {
    // Only return a scan for IDs that look like valid scan IDs
    if (!id.startsWith('scan-')) return null;
    return {
      id,
      tenantId: null,
      scanType: 'composite',
      repository: '/tmp/test-repo',
      branch: 'main',
      commitHash: 'abc123',
      status: 'success',
      scanner: 'secret+sast',
      findingsCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      gateFailed: false,
      scanStartTime: new Date(),
      scanEndTime: new Date(),
      durationMs: 100,
      createdAt: new Date(),
      metadata: {},
    };
  }),
  findByRepository: jest.fn().mockImplementation(async (repository: string) => {
    if (repository === '/tmp/test-repo') {
      return [{
        id: 'scan-1',
        tenantId: null,
        scanType: 'composite',
        repository: '/tmp/test-repo',
        branch: 'main',
        commitHash: 'abc123',
        status: 'success',
        scanner: 'secret+sast',
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        gateFailed: false,
        scanStartTime: new Date(),
        scanEndTime: new Date(),
        durationMs: 100,
        createdAt: new Date(),
        metadata: {},
      }];
    }
    return [];
  }),
  findByTenant: jest.fn().mockResolvedValue([]),
  findFailedGates: jest.fn().mockResolvedValue([]),
  findRecent: jest.fn().mockImplementation(async () => [{
    id: 'scan-1',
    tenantId: null,
    scanType: 'composite',
    repository: '/tmp/test-repo',
    branch: 'main',
    commitHash: 'abc123',
    status: 'success',
    scanner: 'secret+sast',
    findingsCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    gateFailed: false,
    scanStartTime: new Date(),
    scanEndTime: new Date(),
    durationMs: 100,
    createdAt: new Date(),
    metadata: {},
  }]),
  getScanStats: jest.fn().mockImplementation(async (repository?: string) => {
    // Return 0 for unknown repositories
    if (repository && repository !== '/tmp/test-repo') {
      return { totalScans: 0, successCount: 0, failedCount: 0, avgFindings: 0 };
    }
    return { totalScans: 1, successCount: 1, failedCount: 0, avgFindings: 0 };
  }),
  create: jest.fn().mockResolvedValue({ id: 'scan-1' }),
  findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const mockFindingRepository = {
  findById: jest.fn().mockResolvedValue(null),
  findByScanId: jest.fn().mockResolvedValue([]),
  findByScanIds: jest.fn().mockImplementation(async (scanIds: string[]) => {
    const map = new Map<string, any[]>();
    for (const id of scanIds) {
      map.set(id, []);
    }
    return map;
  }),
  findBySeverity: jest.fn().mockResolvedValue([]),
  batchCreate: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 'finding-1' }),
  findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const createTestScanOptions = (overrides: Partial<ScanOptions> = {}): ScanOptions => ({
  repository: '/tmp/test-repo',
  branch: 'main',
  commitHash: 'abc123',
  scanTypes: ['secret', 'sast'],
  ...overrides,
});

describe('SecurityScannerService', () => {
  let service: SecurityScannerService;

  beforeEach(() => {
    service = new SecurityScannerService({
      scanRepository: mockScanRepository as any,
      findingRepository: mockFindingRepository as any,
    });
    jest.clearAllMocks();
  });

  // ==================== Path Validation ====================

  describe('path validation', () => {
    it('should reject path traversal attempts', async () => {
      const options = createTestScanOptions({
        repository: '/tmp/../etc/passwd',
      });

      await expect(service.scan(options)).rejects.toThrow('Invalid path');
    });

    it('should reject paths with null bytes', async () => {
      const options = createTestScanOptions({
        repository: '/tmp/test\0repo',
      });

      await expect(service.scan(options)).rejects.toThrow('Invalid path');
    });

    it('should reject paths with shell metacharacters', async () => {
      const options = createTestScanOptions({
        repository: '/tmp/test;rm -rf /',
      });

      await expect(service.scan(options)).rejects.toThrow('Invalid path');
    });

    it('should accept valid paths', async () => {
      const options = createTestScanOptions({
        repository: '/home/user/project',
      });

      const result = await service.scan(options);
      expect(result).toBeDefined();
    });
  });

  // ==================== Scan Execution ====================

  describe('scan', () => {
    it('should execute scan and return result', async () => {
      const options = createTestScanOptions();

      const result = await service.scan(options);

      expect(result.id).toBeDefined();
      expect(result.scanType).toBe('composite');
      expect(result.repository).toBe(options.repository);
      expect(['success', 'failed', 'partial']).toContain(result.status);
      expect(result.findings).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should run specified scan types', async () => {
      const secretOnly = createTestScanOptions({ scanTypes: ['secret'] });

      const result = await service.scan(secretOnly);

      expect(result.scanType).toBe('secret');
    });

    it('should persist scan result to repository', async () => {
      const options = createTestScanOptions();

      await service.scan(options);

      expect(mockScanRepository.create).toHaveBeenCalled();
    });
  });

  // ==================== Gate Check ====================

  describe('checkGate', () => {
    it('should pass when no critical findings', async () => {
      const options = createTestScanOptions();
      const scanResult = await service.scan(options);

      const gateResult = await service.checkGate(scanResult.id, 'critical');

      expect(gateResult.passed).toBe(true);
      expect(gateResult.summary).toBeDefined();
    });

    it('should throw for non-existent scan', async () => {
      await expect(service.checkGate('non-existent', 'critical')).rejects.toThrow('not found');
    });
  });

  // ==================== History ====================

  describe('getScanHistory', () => {
    it('should return history from database', async () => {
      const options = createTestScanOptions();
      await service.scan(options);

      const history = await service.getScanHistory(options.repository);

      expect(history.length).toBeGreaterThan(0);
    });

    it('should return empty for unknown repository', async () => {
      const history = await service.getScanHistory('/unknown/repo');

      expect(history.length).toBe(0);
    });
  });

  // ==================== Metrics ====================

  describe('getSecurityMetrics', () => {
    it('should return metrics for repository', async () => {
      const options = createTestScanOptions();
      await service.scan(options);

      const metrics = await service.getSecurityMetrics(options.repository);

      expect(metrics.totalScans).toBeGreaterThan(0);
      expect(['improving', 'degrading', 'stable']).toContain(metrics.trend);
    });

    it('should return empty metrics for no scans', async () => {
      const metrics = await service.getSecurityMetrics('/unknown/repo');

      expect(metrics.totalScans).toBe(0);
      expect(metrics.trend).toBe('stable');
    });
  });

  // ==================== Repository Integration ====================

  describe('repository integration', () => {
    it('should work without repository (fallback)', async () => {
      const noRepoService = new SecurityScannerService();
      const options = createTestScanOptions();

      const result = await noRepoService.scan(options);

      expect(result).toBeDefined();
    });
  });
});
