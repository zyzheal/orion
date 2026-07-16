/**
 * AuditRepository 单元测试
 */

import { AuditRepository, AuditLog, CreateAuditLogInput } from '../AuditRepository';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('AuditRepository', () => {
  let repository: AuditRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    mockPool.query.mockReset();
    repository = new AuditRepository(mockPool as any);
  });

  describe('findById', () => {
    it('应该返回审计日志', async () => {
      const mockLog: AuditLog = {
        id: 'log-1',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'pipeline',
        resource_id: 'res-1',
        request_method: 'POST',
        request_path: '/api/pipelines',
        request_body: null,
        response_code: 200,
        response_body: null,
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        prev_hash: null,
        hash: 'abc123',
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockLog] });

      const result = await repository.findById('log-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('log-1');
      expect(result!.action).toBe('CREATE');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM audit_logs WHERE id = $1',
        ['log-1']
      );
    });

    it('应该返回 null 当未找到', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('应该返回所有审计日志', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'log-1', action: 'CREATE' },
          { id: 'log-2', action: 'UPDATE' },
        ],
      });

      const result = await repository.findAll();

      expect(result.length).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM audit_logs'),
        []
      );
    });

    it('应该支持按 tenantId 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ tenantId: 'tenant-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('应该支持按 userId 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ userId: 'user-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        ['user-1']
      );
    });

    it('应该支持按 action 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ action: 'DELETE' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('action = $1'),
        ['DELETE']
      );
    });

    it('应该支持按 resourceType 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ resourceType: 'pipeline' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1'),
        ['pipeline']
      );
    });

    it('应该支持按 resourceId 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ resourceId: 'res-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_id = $1'),
        ['res-1']
      );
    });

    it('应该支持分页 (limit + offset)', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ limit: 10, offset: 20 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });

    it('应该支持组合过滤条件', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({
        tenantId: 'tenant-1',
        action: 'CREATE',
        limit: 5,
      });

      const query = mockPool.query.mock.calls[0][0] as string;
      expect(query).toContain('tenant_id');
      expect(query).toContain('action');
      expect(query).toContain('LIMIT');
    });

    it('应该按 created_at DESC 排序', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('count', () => {
    it('应该返回总记录数', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('应该支持按 tenantId 过滤计数', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '10' }] });

      const result = await repository.count({ tenantId: 'tenant-1' });

      expect(result).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        expect.arrayContaining(['tenant-1'])
      );
    });

    it('应该支持按 userId 过滤计数', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });

      await repository.count({ userId: 'user-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        expect.any(Array)
      );
    });

    it('应该支持按 action 过滤计数', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

      await repository.count({ action: 'DELETE' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('action'),
        expect.any(Array)
      );
    });

    it('应该返回 0 当没有记录', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });

  describe('create', () => {
    it('应该创建审计日志', async () => {
      const mockCreatedLog: AuditLog = {
        id: 'log-new',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'pipeline',
        resource_id: 'res-1',
        request_method: 'POST',
        request_path: '/api/pipelines',
        request_body: null,
        response_code: 201,
        response_body: null,
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        prev_hash: null,
        hash: 'hash-value',
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockCreatedLog] });

      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'pipeline',
        resource_id: 'res-1',
        request_method: 'POST',
        request_path: '/api/pipelines',
      };

      const result = await repository.create(input);

      expect(result.id).toBe('log-new');
      expect(result.action).toBe('CREATE');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['tenant-1', 'user-1', 'CREATE', 'pipeline', 'res-1'])
      );
    });

    it('应该支持 prevHash 参数', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'log-2', prev_hash: 'prev-hash', hash: 'new-hash' }],
      });

      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        action: 'UPDATE',
        resource_type: 'config',
      };

      const result = await repository.create(input, 'prev-hash');

      expect(result.prev_hash).toBe('prev-hash');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['prev-hash'])
      );
    });

    it('应该处理可选字段为空', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'log-3',
          tenant_id: 'tenant-1',
          user_id: null,
          action: 'READ',
          resource_type: 'status',
          resource_id: null,
          request_method: null,
          request_path: null,
          request_body: null,
          response_code: null,
          response_body: null,
          ip_address: null,
          user_agent: null,
          prev_hash: null,
          hash: 'hash',
          created_at: new Date(),
        }],
      });

      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        action: 'READ',
        resource_type: 'status',
      };

      const result = await repository.create(input);

      expect(result.user_id).toBeNull();
      expect(result.resource_id).toBeNull();
    });

    it('应该生成 hash 值', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'log-4', hash: 'generated-hash' }],
      });

      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        action: 'CREATE',
        resource_type: 'test',
      };

      await repository.create(input);

      // The hash is generated internally, verify the INSERT includes it
      const insertCall = mockPool.query.mock.calls[0];
      const query = insertCall[0] as string;
      expect(query).toContain('hash');
      expect(query).toContain('RETURNING *');
    });
  });

  describe('getLatestHash', () => {
    it('应该返回最新记录的 hash', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ hash: 'latest-hash-value' }],
      });

      const result = await repository.getLatestHash('tenant-1');

      expect(result).toBe('latest-hash-value');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC LIMIT 1'),
        ['tenant-1']
      );
    });

    it('应该返回 null 当没有记录', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.getLatestHash('tenant-empty');

      expect(result).toBeNull();
    });
  });

  describe('verifyChain', () => {
    it('应该验证空链为有效', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.verifyChain('tenant-1');

      expect(result.valid).toBe(true);
      expect(result.totalVerified).toBe(0);
    });

    it('应该验证单条记录链为有效', async () => {
      const singleLog = {
        id: 'log-1',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'test',
        resource_id: null,
        request_method: null,
        request_path: null,
        request_body: null,
        response_code: null,
        response_body: null,
        ip_address: null,
        user_agent: null,
        prev_hash: null,
        hash: 'hash-1',
        created_at: new Date('2026-01-01T00:00:00Z'),
      };

      // First call returns the page, second call returns empty (no more pages)
      mockPool.query
        .mockResolvedValueOnce({ rows: [singleLog] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.verifyChain('tenant-1');

      expect(result.valid).toBe(true);
      expect(result.totalVerified).toBe(1);
    });
  });

  describe('getActions', () => {
    it('应该返回去重的操作列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { action: 'CREATE' },
          { action: 'DELETE' },
          { action: 'UPDATE' },
        ],
      });

      const result = await repository.getActions('tenant-1');

      expect(result).toEqual(['CREATE', 'DELETE', 'UPDATE']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT action'),
        ['tenant-1']
      );
    });

    it('应该返回空列表当没有记录', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.getActions('tenant-empty');

      expect(result).toEqual([]);
    });
  });

  describe('getResourceTypes', () => {
    it('应该返回去重的资源类型列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { resource_type: 'pipeline' },
          { resource_type: 'config' },
        ],
      });

      const result = await repository.getResourceTypes('tenant-1');

      expect(result).toEqual(['pipeline', 'config']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT resource_type'),
        ['tenant-1']
      );
    });

    it('应该返回空列表当没有记录', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.getResourceTypes('tenant-empty');

      expect(result).toEqual([]);
    });
  });
});
