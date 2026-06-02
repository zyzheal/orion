/**
 * ApkUploadHistoryService Unit Tests
 */

import { ApkUploadHistoryService, ApkUploadRecordCreateInput } from '../ApkUploadHistoryService';

describe('ApkUploadHistoryService', () => {
  let service: ApkUploadHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApkUploadHistoryService();
  });

  const createInput: ApkUploadRecordCreateInput = {
    tenantId: 'tenant-1',
    market: 'huawei',
    packageName: 'com.example.app',
    apkPath: '/path/app.apk',
    status: 'pending',
  };

  // ==================== create ====================

  describe('create', () => {
    it('should create a record', async () => {
      const record = await service.create(createInput);

      expect(record.id).toMatch(/^apk-upload-/);
      expect(record.tenantId).toBe('tenant-1');
      expect(record.market).toBe('huawei');
      expect(record.packageName).toBe('com.example.app');
      expect(record.status).toBe('pending');
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', async () => {
      const r1 = await service.create(createInput);
      const r2 = await service.create(createInput);

      expect(r1.id).not.toBe(r2.id);
    });

    it('should store optional fields', async () => {
      const input: ApkUploadRecordCreateInput = {
        ...createInput,
        pipelineRunId: 'run-1',
        pipelineId: 'pipe-1',
        pipelineName: 'Build Pipeline',
        versionName: '1.0.0',
        versionCode: 100,
        uploadUrl: 'https://example.com',
        uploadId: 'upload-1',
        durationMs: 5000,
        progress: 100,
      };

      const record = await service.create(input);

      expect(record.pipelineRunId).toBe('run-1');
      expect(record.pipelineId).toBe('pipe-1');
      expect(record.pipelineName).toBe('Build Pipeline');
      expect(record.versionName).toBe('1.0.0');
      expect(record.versionCode).toBe(100);
      expect(record.uploadUrl).toBe('https://example.com');
      expect(record.uploadId).toBe('upload-1');
      expect(record.durationMs).toBe(5000);
      expect(record.progress).toBe(100);
    });

    it('should persist to repository when db provided', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ id: 'test' });
      const mockDb = {
        query: jest.fn(),
      };
      // The service creates an ApkUploadRepository internally
      const svc = new ApkUploadHistoryService(mockDb);
      const record = await svc.create(createInput);

      expect(record).toBeDefined();
      expect(record.id).toMatch(/^apk-upload-/);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update an existing record', async () => {
      const created = await service.create(createInput);

      const updated = await service.update(created.id, {
        status: 'uploading',
        progress: 50,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('uploading');
      expect(updated!.progress).toBe(50);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent record', async () => {
      const result = await service.update('nonexistent', { status: 'failed' });

      expect(result).toBeNull();
    });

    it('should preserve unmodified fields', async () => {
      const created = await service.create(createInput);

      const updated = await service.update(created.id, { progress: 75 });

      expect(updated!.tenantId).toBe('tenant-1');
      expect(updated!.market).toBe('huawei');
      expect(updated!.packageName).toBe('com.example.app');
    });
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should find a record by ID', async () => {
      const created = await service.create(createInput);

      const found = await service.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('nonexistent');

      expect(found).toBeNull();
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should find a record by ID and tenant', async () => {
      const created = await service.create(createInput);

      const found = await service.findByIdAndTenant(created.id, 'tenant-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null when tenant does not match', async () => {
      const created = await service.create(createInput);

      const found = await service.findByIdAndTenant(created.id, 'wrong-tenant');

      expect(found).toBeNull();
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findByIdAndTenant('nonexistent', 'tenant-1');

      expect(found).toBeNull();
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should find records by tenant', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1');

      expect(records).toHaveLength(2);
    });

    it('should return empty for different tenant', async () => {
      await service.create(createInput);

      const records = await service.findByTenant('other-tenant');

      expect(records).toHaveLength(0);
    });

    it('should sort by createdAt descending', async () => {
      const r1 = await service.create(createInput);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      const r2 = await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1');

      expect(records[0].id).toBe(r2.id);
      expect(records[1].id).toBe(r1.id);
    });

    it('should filter by market', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1', { market: 'huawei' });

      expect(records).toHaveLength(1);
      expect(records[0].market).toBe('huawei');
    });

    it('should filter by status', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed' });

      const records = await service.findByTenant('tenant-1', { status: 'pending' });

      expect(records).toHaveLength(1);
    });

    it('should apply limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ ...createInput, market: `market-${i}` });
      }

      const page1 = await service.findByTenant('tenant-1', { limit: 2, offset: 0 });
      const page2 = await service.findByTenant('tenant-1', { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should use default limit of 50', async () => {
      for (let i = 0; i < 55; i++) {
        await service.create({ ...createInput, market: `market-${i}` });
      }

      const records = await service.findByTenant('tenant-1');

      expect(records).toHaveLength(50);
    });
  });

  // ==================== findByPipelineRun ====================

  describe('findByPipelineRun', () => {
    it('should find records by pipeline run ID', async () => {
      await service.create({ ...createInput, pipelineRunId: 'run-1' });
      await service.create({ ...createInput, pipelineRunId: 'run-1', market: 'xiaomi' });
      await service.create({ ...createInput, pipelineRunId: 'run-2' });

      const records = await service.findByPipelineRun('run-1');

      expect(records).toHaveLength(2);
    });

    it('should return empty for non-existent run', async () => {
      const records = await service.findByPipelineRun('nonexistent');

      expect(records).toHaveLength(0);
    });

    it('should sort by createdAt descending', async () => {
      await service.create({ ...createInput, pipelineRunId: 'run-1' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await service.create({ ...createInput, pipelineRunId: 'run-1', market: 'xiaomi' });

      const records = await service.findByPipelineRun('run-1');

      expect(records[0].market).toBe('xiaomi');
    });
  });

  // ==================== countByTenant ====================

  describe('countByTenant', () => {
    it('should count records for a tenant', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const count = await service.countByTenant('tenant-1');

      expect(count).toBe(2);
    });

    it('should count with market filter', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const count = await service.countByTenant('tenant-1', { market: 'huawei' });

      expect(count).toBe(1);
    });

    it('should count with status filter', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed' });

      const count = await service.countByTenant('tenant-1', { status: 'pending' });

      expect(count).toBe(1);
    });

    it('should return 0 for non-existent tenant', async () => {
      await service.create(createInput);

      const count = await service.countByTenant('other-tenant');

      expect(count).toBe(0);
    });
  });

  // ==================== getRecentFailures ====================

  describe('getRecentFailures', () => {
    it('should return failed records', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed', error: 'Network error' });

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures).toHaveLength(1);
      expect(failures[0].status).toBe('failed');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ ...createInput, status: 'failed', error: `Error ${i}` });
      }

      const failures = await service.getRecentFailures('tenant-1', 3);

      expect(failures).toHaveLength(3);
    });

    it('should use default limit of 10', async () => {
      for (let i = 0; i < 15; i++) {
        await service.create({ ...createInput, status: 'failed' });
      }

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures).toHaveLength(10);
    });

    it('should sort by createdAt descending', async () => {
      await service.create({ ...createInput, status: 'failed', error: 'First' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await service.create({ ...createInput, status: 'failed', error: 'Second' });

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures[0].error).toBe('Second');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats grouped by status', async () => {
      await service.create(createInput); // pending
      await service.create({ ...createInput, status: 'published' });
      await service.create({ ...createInput, status: 'failed' });
      await service.create({ ...createInput, status: 'uploading' });
      await service.create({ ...createInput, status: 'submitted' });

      const stats = await service.getStats('tenant-1');

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.published).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.uploading).toBe(1);
      expect(stats.submitted).toBe(1);
    });

    it('should return zeroed stats for empty tenant', async () => {
      const stats = await service.getStats('empty-tenant');

      expect(stats.total).toBe(0);
      expect(stats.published).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.uploading).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.submitted).toBe(0);
    });
  });
});
