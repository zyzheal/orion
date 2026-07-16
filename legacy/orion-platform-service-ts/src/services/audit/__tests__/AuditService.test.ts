/**
 * AuditService 单元测试
 */

import { AuditService, AuditServiceError } from '../AuditService';
import { AuditRepository, AuditLog, CreateAuditLogInput } from '../AuditRepository';

// Mock AuditRepository
const mockRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  getLatestHash: jest.fn(),
  verifyChain: jest.fn(),
  getActions: jest.fn(),
  getResourceTypes: jest.fn(),
} as unknown as AuditRepository;

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(mockRepository);
  });

  describe('AuditServiceError', () => {
    it('应该正确设置错误信息和 code', () => {
      const error = new AuditServiceError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AuditServiceError');
    });

    it('应该继承 Error', () => {
      const error = new AuditServiceError('msg', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('getAuditLog', () => {
    it('应该返回审计日志', async () => {
      const mockLog = { id: 'log-1', action: 'CREATE' } as AuditLog;
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockLog);

      const result = await service.getAuditLog('log-1');

      expect(result.id).toBe('log-1');
      expect(mockRepository.findById).toHaveBeenCalledWith('log-1');
    });

    it('应该抛出 NOT_FOUND 错误当日志不存在', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getAuditLog('nonexistent')).rejects.toThrow(AuditServiceError);
      await expect(service.getAuditLog('nonexistent')).rejects.toThrow('Audit log not found: nonexistent');
    });

    it('错误应该包含 NOT_FOUND code', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      try {
        await service.getAuditLog('nonexistent');
        fail('should have thrown');
      } catch (err) {
        expect((err as AuditServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('listAuditLogs', () => {
    it('应该返回分页结果', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'CREATE' },
        { id: 'log-2', action: 'UPDATE' },
      ] as AuditLog[];
      (mockRepository.findAll as jest.Mock).mockResolvedValue(mockLogs);
      (mockRepository.count as jest.Mock).mockResolvedValue(2);

      const result = await service.listAuditLogs();

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('应该使用默认分页参数', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(0);

      await service.listAuditLogs();

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });

    it('应该支持自定义分页', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(100);

      const result = await service.listAuditLogs({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('应该传递过滤参数', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(0);

      await service.listAuditLogs({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'DELETE',
        resourceType: 'pipeline',
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'DELETE',
          resourceType: 'pipeline',
        })
      );
    });

    it('应该正确计算 totalPages', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(25);

      const result = await service.listAuditLogs({ limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  describe('createAuditLog', () => {
    it('应该创建审计日志', async () => {
      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'pipeline',
      };
      const mockCreated = { id: 'log-new', ...input } as AuditLog;

      (mockRepository.getLatestHash as jest.Mock).mockResolvedValue('prev-hash');
      (mockRepository.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.createAuditLog(input);

      expect(result.id).toBe('log-new');
      expect(mockRepository.getLatestHash).toHaveBeenCalledWith('tenant-1');
      expect(mockRepository.create).toHaveBeenCalledWith(input, 'prev-hash');
    });

    it('应该传递 prevHash 到 repository', async () => {
      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        action: 'CREATE',
        resource_type: 'test',
      };

      (mockRepository.getLatestHash as jest.Mock).mockResolvedValue('hash-abc');
      (mockRepository.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

      await service.createAuditLog(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input, 'hash-abc');
    });

    it('应该在没有 prevHash 时传递 undefined', async () => {
      const input: CreateAuditLogInput = {
        tenant_id: 'tenant-1',
        action: 'CREATE',
        resource_type: 'test',
      };

      (mockRepository.getLatestHash as jest.Mock).mockResolvedValue(null);
      (mockRepository.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

      await service.createAuditLog(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input, undefined);
    });

    it('应该拒绝缺少 tenant_id 的输入', async () => {
      const input = {
        action: 'CREATE',
        resource_type: 'test',
      } as CreateAuditLogInput;

      await expect(service.createAuditLog(input)).rejects.toThrow(AuditServiceError);
      await expect(service.createAuditLog(input)).rejects.toThrow('Tenant ID required');
    });

    it('应该拒绝缺少 action 的输入', async () => {
      const input = {
        tenant_id: 'tenant-1',
        resource_type: 'test',
      } as CreateAuditLogInput;

      await expect(service.createAuditLog(input)).rejects.toThrow(AuditServiceError);
      await expect(service.createAuditLog(input)).rejects.toThrow('Action required');
    });

    it('应该拒绝缺少 resource_type 的输入', async () => {
      const input = {
        tenant_id: 'tenant-1',
        action: 'CREATE',
      } as CreateAuditLogInput;

      await expect(service.createAuditLog(input)).rejects.toThrow(AuditServiceError);
      await expect(service.createAuditLog(input)).rejects.toThrow('Resource type required');
    });

    it('验证错误应该包含 INVALID_INPUT code', async () => {
      const input = {} as CreateAuditLogInput;

      try {
        await service.createAuditLog(input);
        fail('should have thrown');
      } catch (err) {
        expect((err as AuditServiceError).code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('verifyChain', () => {
    it('应该调用 repository.verifyChain', async () => {
      const mockResult = { valid: true, totalVerified: 10 };
      (mockRepository.verifyChain as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.verifyChain('tenant-1');

      expect(result).toEqual(mockResult);
      expect(mockRepository.verifyChain).toHaveBeenCalledWith('tenant-1');
    });

    it('应该返回无效结果当链断裂', async () => {
      const mockResult = { valid: false, brokenAt: new Date(), totalVerified: 5 };
      (mockRepository.verifyChain as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.verifyChain('tenant-1');

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBeDefined();
    });
  });

  describe('getActions', () => {
    it('应该返回操作列表', async () => {
      (mockRepository.getActions as jest.Mock).mockResolvedValue(['CREATE', 'UPDATE', 'DELETE']);

      const result = await service.getActions('tenant-1');

      expect(result).toEqual(['CREATE', 'UPDATE', 'DELETE']);
      expect(mockRepository.getActions).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('getResourceTypes', () => {
    it('应该返回资源类型列表', async () => {
      (mockRepository.getResourceTypes as jest.Mock).mockResolvedValue(['pipeline', 'config']);

      const result = await service.getResourceTypes('tenant-1');

      expect(result).toEqual(['pipeline', 'config']);
      expect(mockRepository.getResourceTypes).toHaveBeenCalledWith('tenant-1');
    });
  });
});
