/**
 * TerminalAuditRepository Unit Tests
 */

import { TerminalAuditRepository } from '../TerminalAuditRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

const createMockPool = (rows: any[] = [], rowCount: number = 0) => ({
  query: jest.fn().mockResolvedValue({ rows, rowCount }),
});

describe('TerminalAuditRepository', () => {
  let repo: TerminalAuditRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    repo = new TerminalAuditRepository(mockPool as any);
  });

  // ==================== Connect Logs ====================

  describe('createConnectLog', () => {
    it('should insert a connect log', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'conn-1',
          tenant_id: 'test-tenant-001',
          username: 'admin',
          hostname: 'prod-web-01',
          host_ip: '10.0.1.10',
          connect_time: new Date('2026-07-01T00:00:00Z'),
          disconnect_time: null,
          duration: null,
          status: 'active',
          client_ip: '192.168.1.100',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createConnectLog({
        username: 'admin',
        hostname: 'prod-web-01',
        hostIp: '10.0.1.10',
        connectTime: new Date(),
        clientIp: '192.168.1.100',
      });

      expect(result.username).toBe('admin');
      expect(result.status).toBe('active');
    });
  });

  describe('findConnectLogById', () => {
    it('should return log when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'conn-1',
          tenant_id: 'test-tenant-001',
          username: 'admin',
          hostname: 'h1',
          host_ip: '1.1.1.1',
          connect_time: new Date(),
          disconnect_time: null,
          duration: null,
          status: 'active',
          client_ip: '1.1.1.1',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findConnectLogById('conn-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('conn-1');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findConnectLogById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllConnectLogs', () => {
    it('should return paginated results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            { id: 'c2', tenant_id: 't', username: 'u2', hostname: 'h2', host_ip: '2', connect_time: new Date('2026-07-01T00:00:02Z'), disconnect_time: null, duration: null, status: 'active', client_ip: '2', created_at: new Date() },
            { id: 'c1', tenant_id: 't', username: 'u1', hostname: 'h1', host_ip: '1', connect_time: new Date('2026-07-01T00:00:01Z'), disconnect_time: null, duration: null, status: 'active', client_ip: '1', created_at: new Date() },
          ],
          rowCount: 2,
        });

      const result = await repo.findAllConnectLogs(undefined, { page: 1, pageSize: 10 });
      expect(result.total).toBe(2);
      expect(result.entities).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            { id: 'c1', tenant_id: 't', username: 'u', hostname: 'h', host_ip: '1', connect_time: new Date(), disconnect_time: null, duration: null, status: 'active', client_ip: '1', created_at: new Date() },
          ],
          rowCount: 1,
        });

      const result = await repo.findAllConnectLogs(undefined, { page: 1, pageSize: 10, status: 'active' });
      expect(result.total).toBe(1);
      // Verify status filter was applied in SQL
      expect(mockPool.query.mock.calls[1][0]).toContain('status');
    });
  });

  // ==================== File Logs ====================

  describe('createFileLog', () => {
    it('should insert a file log', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'file-1',
          tenant_id: 'test-tenant-001',
          username: 'admin',
          hostname: 'prod-web-01',
          file_path: '/tmp',
          file_name: 'config.yaml',
          file_size: '2.4 KB',
          operation: 'upload',
          timestamp: new Date('2026-07-01T00:00:00Z'),
          status: 'success',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createFileLog({
        username: 'admin',
        hostname: 'prod-web-01',
        filePath: '/tmp',
        fileName: 'config.yaml',
        fileSize: '2.4 KB',
        operation: 'upload',
        timestamp: new Date(),
      });

      expect(result.file_name).toBe('config.yaml');
      expect(result.operation).toBe('upload');
    });
  });

  describe('findFileLogById', () => {
    it('should return log when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'file-1',
          tenant_id: 'test-tenant-001',
          username: 'admin',
          hostname: 'h',
          file_path: '/tmp',
          file_name: 'f',
          file_size: '1KB',
          operation: 'upload',
          timestamp: new Date(),
          status: 'success',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findFileLogById('file-1');
      expect(result).toBeDefined();
      expect(result!.file_name).toBe('f');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findFileLogById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllFileLogs', () => {
    it('should return paginated file logs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'file-1',
            tenant_id: 'test-tenant-001',
            username: 'admin',
            hostname: 'h',
            file_path: '/tmp',
            file_name: 'f',
            file_size: '1KB',
            operation: 'download',
            timestamp: new Date(),
            status: 'success',
            created_at: new Date(),
          }],
          rowCount: 1,
        });

      const result = await repo.findAllFileLogs(undefined, { page: 1, pageSize: 10 });
      expect(result.total).toBe(1);
      expect(result.entities[0].operation).toBe('download');
    });

    it('should filter by operation and status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      await repo.findAllFileLogs(undefined, {
        page: 1,
        pageSize: 10,
        operation: 'upload',
        status: 'failed',
      });

      // Should have 4 params: tenant_id, operation, status, limit, offset
      expect(mockPool.query.mock.calls[0][1]).toHaveLength(5);
    });
  });

  // ==================== Stats ====================

  describe('getAuditStats', () => {
    it('should return correct stats', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })  // total connect logs
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })   // active sessions
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });  // total file transfers

      const stats = await repo.getAuditStats();

      expect(stats.totalConnectLogs).toBe(10);
      expect(stats.activeSessions).toBe(3);
      expect(stats.totalFileTransfers).toBe(5);
    });
  });
});
