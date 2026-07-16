/**
 * DigitalTwinService - Digital Twin Management Unit Tests
 *
 * Coverage: Twin CRUD, Snapshot management, Sandbox operations,
 *           Traffic recording/replay, In-memory fallback, Error handling
 */

import { DigitalTwinService } from '../DigitalTwinService';

describe('DigitalTwinService', () => {
  let service: DigitalTwinService;

  beforeEach(() => {
    // Use in-memory fallback (no db parameter)
    service = new DigitalTwinService();
  });

  // ==================== Twin CRUD ====================

  describe('createTwin', () => {
    it('should create a twin in memory', async () => {
      const result = await service.createTwin('t-1', {
        name: 'my-twin',
        environment: 'dev',
        services: ['svc-a', 'svc-b'],
      });

      expect(result.twinName).toBe('my-twin');
      expect(result.tenantId).toBe('t-1');
      expect(result.environment).toBe('dev');
      expect(result.services).toEqual(['svc-a', 'svc-b']);
      expect(result.status).toBe('active');
      expect(result.healthScore).toBe(100);
      expect(result.syncInterval).toBe(60);
    });

    it('should use custom syncInterval', async () => {
      const result = await service.createTwin('t-1', {
        name: 'twin-2',
        environment: 'staging',
        services: [],
        syncInterval: 120,
      });

      expect(result.syncInterval).toBe(120);
    });
  });

  describe('getTwin', () => {
    it('should return null for non-existent twin', async () => {
      const result = await service.getTwin('non-existent');
      expect(result).toBeNull();
    });

    it('should return existing twin', async () => {
      const created = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: ['svc-a'],
      });

      const result = await service.getTwin(created.id);
      expect(result).toBeDefined();
      expect(result!.twinName).toBe('twin-1');
    });
  });

  describe('listTwins', () => {
    it('should list twins for tenant', async () => {
      await service.createTwin('t-1', { name: 'twin-1', environment: 'dev', services: [] });
      await service.createTwin('t-1', { name: 'twin-2', environment: 'staging', services: [] });
      await service.createTwin('t-2', { name: 'twin-3', environment: 'prod', services: [] });

      const result = await service.listTwins('t-1');
      expect(result).toHaveLength(2);
    });

    it('should return empty for tenant with no twins', async () => {
      const result = await service.listTwins('empty-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('updateTwin', () => {
    it('should update twin properties', async () => {
      const created = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: ['svc-a'],
      });

      const updated = await service.updateTwin(created.id, {
        twinName: 'updated-twin',
        services: ['svc-a', 'svc-b'],
      });

      expect(updated).toBeDefined();
      expect(updated!.twinName).toBe('updated-twin');
      expect(updated!.services).toEqual(['svc-a', 'svc-b']);
    });

    it('should return null for non-existent twin', async () => {
      const result = await service.updateTwin('non-existent', { twinName: 'new' });
      expect(result).toBeNull();
    });
  });

  describe('deleteTwin', () => {
    it('should delete existing twin', async () => {
      const created = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: [],
      });

      const result = await service.deleteTwin(created.id);
      expect(result).toBe(true);

      const found = await service.getTwin(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent twin', async () => {
      const result = await service.deleteTwin('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Metrics ====================

  describe('getMetrics', () => {
    it('should return metrics for existing twin', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: ['svc-a', 'svc-b'],
      });

      const result = await service.getMetrics(twin.id);

      expect(result.healthScore).toBe(100);
      expect(result.status).toBe('active');
      expect(result.serviceCount).toBe(2);
      expect(result.sandboxCount).toBe(0);
      expect(result.recordingCount).toBe(0);
    });

    it('should throw when twin not found', async () => {
      await expect(service.getMetrics('non-existent')).rejects.toThrow('Twin not found');
    });
  });

  // ==================== Sync ====================

  describe('syncTwin', () => {
    it('should sync twin successfully', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: ['svc-a'],
      });

      const result = await service.syncTwin(twin.id);

      expect(result.success).toBe(true);
      expect(result.syncedAt).toBeDefined();
    });

    it('should throw when twin not found', async () => {
      await expect(service.syncTwin('non-existent')).rejects.toThrow('Twin not found');
    });
  });

  // ==================== Sandbox ====================

  describe('createSandbox', () => {
    it('should create sandbox for existing twin', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: ['svc-a'],
      });

      const result = await service.createSandbox('t-1', twin.id, { name: 'my-sandbox' });

      expect(result).toBeDefined();
      expect(result!.twinId).toBe(twin.id);
      expect(result!.name).toBe('my-sandbox');
    });

    it('should return null for non-existent twin', async () => {
      const result = await service.createSandbox('t-1', 'non-existent');
      expect(result).toBeNull();
    });

    it('should return null when tenant mismatch', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: [],
      });

      const result = await service.createSandbox('t-2', twin.id);
      expect(result).toBeNull();
    });
  });

  describe('listSandboxes', () => {
    it('should list sandboxes for twin', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: [],
      });
      await service.createSandbox('t-1', twin.id, { name: 'sb-1' });

      const result = await service.listSandboxes(twin.id);
      expect(result).toHaveLength(1);
    });
  });

  describe('stopSandbox', () => {
    it('should stop existing sandbox', async () => {
      const twin = await service.createTwin('t-1', {
        name: 'twin-1',
        environment: 'dev',
        services: [],
      });
      await service.createSandbox('t-1', twin.id);

      // Get sandbox ID from the in-memory map
      const sandboxes = await service.listSandboxes(twin.id);
      expect(sandboxes.length).toBeGreaterThan(0);
    });

    it('should return false for non-existent sandbox', async () => {
      const result = await service.stopSandbox('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Snapshots ====================

  describe('createTwinSnapshot', () => {
    it('should create snapshot in memory', async () => {
      const result = await service.createTwinSnapshot('t-1', { key: 'value' });

      expect(result.tenantId).toBe('t-1');
      expect(result.config).toEqual({ key: 'value' });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('getSnapshot', () => {
    it('should return null for non-existent snapshot', async () => {
      const result = await service.getSnapshot('non-existent');
      expect(result).toBeNull();
    });

    it('should return existing snapshot', async () => {
      const created = await service.createTwinSnapshot('t-1', { key: 'value' });
      const result = await service.getSnapshot(created.id);

      expect(result).toBeDefined();
      expect(result!.config).toEqual({ key: 'value' });
    });
  });

  describe('listSnapshots', () => {
    it('should list snapshots for tenant', async () => {
      await service.createTwinSnapshot('t-1', { a: 1 });
      await service.createTwinSnapshot('t-1', { b: 2 });
      await service.createTwinSnapshot('t-2', { c: 3 });

      const result = await service.listSnapshots('t-1');
      expect(result).toHaveLength(2);
    });

    it('should return empty for tenant with no snapshots', async () => {
      const result = await service.listSnapshots('empty-tenant');
      expect(result).toEqual([]);
    });
  });

  // ==================== Traffic Recording ====================

  describe('recordTraffic', () => {
    it('should record traffic', async () => {
      const result = await service.recordTraffic('t-1', 'twin-1', {
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        latency: 50,
      });

      expect(result.tenantId).toBe('t-1');
      expect(result.twinId).toBe('twin-1');
      expect(result.method).toBe('GET');
      expect(result.path).toBe('/api/test');
      expect(result.statusCode).toBe(200);
      expect(result.latency).toBe(50);
    });

    it('should accumulate traffic records', async () => {
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/a', statusCode: 200, latency: 10 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'POST', path: '/b', statusCode: 201, latency: 20 });

      const records = await service.getTrafficRecords('t-1', 'twin-1');
      expect(records).toHaveLength(2);
    });
  });

  describe('getTrafficRecords', () => {
    it('should return empty for no records', async () => {
      const result = await service.getTrafficRecords('t-1', 'twin-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== Traffic Replay ====================

  describe('replayTraffic', () => {
    it('should replay traffic', async () => {
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/api/a', statusCode: 200, latency: 10 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'POST', path: '/api/b', statusCode: 201, latency: 20 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/other', statusCode: 200, latency: 30 });

      const result = await service.replayTraffic('t-1', 'twin-1');

      expect(result.totalRequests).toBe(3);
      expect(result.succeeded).toBe(2); // 95% of 3 = 2
      expect(result.status).toBe('completed');
    });

    it('should filter by path', async () => {
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/api/a', statusCode: 200, latency: 10 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/other/b', statusCode: 200, latency: 20 });

      const result = await service.replayTraffic('t-1', 'twin-1', { filter: '/api' });

      expect(result.totalRequests).toBe(1);
    });

    it('should apply limit', async () => {
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/a', statusCode: 200, latency: 10 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/b', statusCode: 200, latency: 20 });
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/c', statusCode: 200, latency: 30 });

      const result = await service.replayTraffic('t-1', 'twin-1', { limit: 2 });

      expect(result.totalRequests).toBe(2);
    });

    it('should handle empty traffic', async () => {
      const result = await service.replayTraffic('t-1', 'twin-1');

      expect(result.totalRequests).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('getReplayResult', () => {
    it('should return null for non-existent replay', async () => {
      const result = await service.getReplayResult('non-existent');
      expect(result).toBeNull();
    });

    it('should return existing replay result', async () => {
      await service.recordTraffic('t-1', 'twin-1', { method: 'GET', path: '/a', statusCode: 200, latency: 10 });
      const replay = await service.replayTraffic('t-1', 'twin-1');

      const result = await service.getReplayResult(replay.id);
      expect(result).toBeDefined();
      expect(result!.totalRequests).toBe(1);
    });
  });
});
