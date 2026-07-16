/**
 * DigitalTwinRepository Unit Tests
 */

import { DigitalTwinRepository } from '../DigitalTwinRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

const createMockPool = (rows: any[] = [], rowCount: number = 0) => ({
  query: jest.fn().mockResolvedValue({ rows, rowCount }),
});

describe('DigitalTwinRepository', () => {
  let repo: DigitalTwinRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    repo = new DigitalTwinRepository(mockPool as any);
  });

  // ==================== Digital Twins ====================

  describe('createTwin', () => {
    it('should insert a twin and return entity', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'twin-1',
          tenant_id: 'test-tenant-001',
          name: 'My Twin',
          service_type: 'web',
          source_service: 'svc-a',
          status: 'active',
          created_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createTwin({
        name: 'My Twin',
        serviceType: 'web',
        sourceService: 'svc-a',
      });

      expect(result.id).toBe('twin-1');
      expect(result.name).toBe('My Twin');
      expect(result.status).toBe('active');
    });
  });

  describe('findTwinById', () => {
    it('should return twin when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'twin-1',
          tenant_id: 'test-tenant-001',
          name: 'T',
          service_type: 'web',
          source_service: 'svc',
          status: 'active',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findTwinById('twin-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('twin-1');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findTwinById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllTwins', () => {
    it('should return all twins for tenant', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 't1', tenant_id: 'test-tenant-001', name: 'A', service_type: 'web', source_service: 's1', status: 'active', created_at: new Date('2026-07-01T00:00:01Z') },
          { id: 't2', tenant_id: 'test-tenant-001', name: 'B', service_type: 'db', source_service: 's2', status: 'paused', created_at: new Date('2026-07-01T00:00:02Z') },
        ],
        rowCount: 2,
      });

      const result = await repo.findAllTwins();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('A');
    });
  });

  // ==================== Snapshots ====================

  describe('createSnapshot', () => {
    it('should insert a snapshot', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'snap-1',
          twin_id: 'twin-1',
          tenant_id: 'test-tenant-001',
          name: 'Init',
          created_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createSnapshot({ twinId: 'twin-1', name: 'Init' });
      expect(result.id).toBe('snap-1');
      expect(result.twin_id).toBe('twin-1');
      expect(result.name).toBe('Init');
    });
  });

  describe('findSnapshotsByTwinId', () => {
    it('should return snapshots for a twin', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 's1', twin_id: 'twin-1', tenant_id: 'test-tenant-001', name: 'S1', created_at: new Date('2026-07-01T00:00:01Z') },
          { id: 's2', twin_id: 'twin-1', tenant_id: 'test-tenant-001', name: 'S2', created_at: new Date('2026-07-01T00:00:02Z') },
        ],
        rowCount: 2,
      });

      const result = await repo.findSnapshotsByTwinId('twin-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
    });
  });

  // ==================== Traffic Records ====================

  describe('createTrafficRecord', () => {
    it('should insert a traffic record', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'traffic-1',
          twin_id: 'twin-1',
          tenant_id: 'test-tenant-001',
          type: 'record',
          request_count: 10,
          duration: '5s',
          started_at: new Date('2026-07-01T00:00:00Z'),
          completed_at: null,
        }],
        rowCount: 1,
      });

      const result = await repo.createTrafficRecord({
        twinId: 'twin-1',
        type: 'record',
        startedAt: new Date(),
      });

      expect(result.id).toBe('traffic-1');
      expect(result.type).toBe('record');
      expect(result.request_count).toBe(10);
    });
  });

  describe('findTrafficRecordsByTwinId', () => {
    it('should return traffic records for a twin', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', twin_id: 'twin-1', tenant_id: 'test-tenant-001', type: 'record', request_count: 5, duration: '3s', started_at: new Date(), completed_at: null },
        ],
        rowCount: 1,
      });

      const result = await repo.findTrafficRecordsByTwinId('twin-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('record');
    });
  });

  // ==================== Replay Sessions ====================

  describe('createReplaySession', () => {
    it('should insert a replay session', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'replay-1',
          twin_id: 'twin-1',
          tenant_id: 'test-tenant-001',
          recording_session_id: 'rec-1',
          sandbox_endpoint: 'http://sb-1',
          status: 'running',
          progress: 0,
          total_requests: 100,
          completed_requests: 0,
          matched_requests: 0,
          failed_requests: 0,
          started_at: new Date('2026-07-01T00:00:00Z'),
          completed_at: null,
        }],
        rowCount: 1,
      });

      const result = await repo.createReplaySession({
        twinId: 'twin-1',
        recordingSessionId: 'rec-1',
        sandboxEndpoint: 'http://sb-1',
        startedAt: new Date(),
      });

      expect(result.id).toBe('replay-1');
      expect(result.status).toBe('running');
      expect(result.total_requests).toBe(100);
    });
  });

  describe('findReplaySessionById', () => {
    it('should return session when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'replay-1',
          twin_id: 'twin-1',
          tenant_id: 'test-tenant-001',
          recording_session_id: 'rec-1',
          sandbox_endpoint: 'http://sb-1',
          status: 'completed',
          progress: 100,
          total_requests: 100,
          completed_requests: 100,
          matched_requests: 95,
          failed_requests: 5,
          started_at: new Date(),
          completed_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findReplaySessionById('replay-1');
      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findReplaySessionById('nonexistent')).toBeUndefined();
    });
  });

  describe('findReplaySessionsByTwinId', () => {
    it('should return sessions for a twin', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', twin_id: 'twin-1', tenant_id: 'test-tenant-001', recording_session_id: 'rec-1', sandbox_endpoint: 'http://sb', status: 'running', progress: 50, total_requests: 100, completed_requests: 50, matched_requests: 48, failed_requests: 2, started_at: new Date(), completed_at: null },
        ],
        rowCount: 1,
      });

      const result = await repo.findReplaySessionsByTwinId('twin-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateReplaySession', () => {
    it('should update session fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'replay-1',
          twin_id: 'twin-1',
          tenant_id: 'test-tenant-001',
          recording_session_id: 'rec-1',
          sandbox_endpoint: 'http://sb-1',
          status: 'completed',
          progress: 100,
          total_requests: 100,
          completed_requests: 100,
          matched_requests: 100,
          failed_requests: 0,
          started_at: new Date(),
          completed_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateReplaySession('replay-1', { status: 'completed', progress: 100 });
      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });

    it('should return undefined when session not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.updateReplaySession('nonexistent', { status: 'cancelled' });
      expect(result).toBeUndefined();
    });
  });
});
