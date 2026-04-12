/**
 * CMDB Service 单元测试
 */

import { CmdbService } from '../CmdbService';
import { CmdbEventPublisher } from '../CmdbEventPublisher';
import { EventBusService } from '../../event-bus-service';

// Mock EventBusService
const mockEventBus = {
  publish: jest.fn().mockResolvedValue('mock-event-id'),
  connect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(async () => {}),
  close: jest.fn().mockResolvedValue(undefined),
  checkHealth: jest.fn().mockResolvedValue({ status: 'up' as const }),
  isHealthy: jest.fn().mockReturnValue(true),
  createStream: jest.fn().mockResolvedValue(undefined),
} as unknown as EventBusService;

describe('CmdbService', () => {
  let cmdbService: CmdbService;
  let eventPublisher: CmdbEventPublisher;

  beforeEach(() => {
    // 清空内存存储
    CmdbService.clearAll();
    jest.clearAllMocks();

    // 创建事件发布器和服务
    eventPublisher = new CmdbEventPublisher(mockEventBus);
    cmdbService = new CmdbService({ eventPublisher });
  });

  describe('createCI', () => {
    it('should create a CI successfully', async () => {
      const input = {
        ciId: 'app-001',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        description: 'Test Description',
        status: 'ACTIVE' as const,
        environment: 'dev',
        tags: ['test', 'demo'],
        createdBy: 'user-001',
        tenantId: BigInt(1),
      };

      const ci = await cmdbService.createCI(input);

      expect(ci.id).toBeDefined();
      expect(ci.ciId).toBe('app-001');
      expect(ci.ciType).toBe('APPLICATION');
      expect(ci.name).toBe('Test Application');
      expect(ci.version).toBe(1);
      expect(ci.createdAt).toBeDefined();
      expect(ci.deletedAt).toBeUndefined();
    });

    it('should throw error when CI already exists', async () => {
      const input = {
        ciId: 'app-001',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      };

      await cmdbService.createCI(input);

      await expect(cmdbService.createCI(input)).rejects.toThrow('already exists');
    });

    it('should throw error when missing required fields', async () => {
      const input = {
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      };

      await expect(cmdbService.createCI(input as any)).rejects.toThrow('Missing required fields');
    });

    it('should publish CI created event', async () => {
      const input = {
        ciId: 'app-002',
        ciType: 'SERVICE' as const,
        name: 'Test Service',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      };

      await cmdbService.createCI(input);

      expect(mockEventBus.publish).toHaveBeenCalledWith('cmdb.ci.created', expect.objectContaining({
        ciId: 'app-002',
        ciType: 'SERVICE',
      }));
    });
  });

  describe('getCI', () => {
    it('should get CI by id', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-003',
        ciType: 'DATABASE' as const,
        name: 'Test Database',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const ci = await cmdbService.getCI(created.id);

      expect(ci).toBeDefined();
      expect(ci?.id).toBe(created.id);
      expect(ci?.ciId).toBe('app-003');
    });

    it('should return null for deleted CI', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-004',
        ciType: 'SERVER' as const,
        name: 'Test Server',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.deleteCI(created.id);
      const ci = await cmdbService.getCI(created.id);

      expect(ci).toBeNull();
    });

    it('should return null for non-existent CI', async () => {
      const ci = await cmdbService.getCI('non-existent-id');
      expect(ci).toBeNull();
    });
  });

  describe('updateCI', () => {
    it('should update CI successfully', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-005',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        description: 'Original Description',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const updated = await cmdbService.updateCI(
        created.id,
        { description: 'Updated Description', status: 'INACTIVE' },
        'user-002'
      );

      expect(updated).toBeDefined();
      expect(updated?.description).toBe('Updated Description');
      expect(updated?.status).toBe('INACTIVE');
      expect(updated?.version).toBe(2);
    });

    it('should return null for non-existent CI', async () => {
      const updated = await cmdbService.updateCI(
        'non-existent-id',
        { description: 'Test' },
        'user-001'
      );
      expect(updated).toBeNull();
    });

    it('should publish CI updated event', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-006',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.updateCI(created.id, { description: 'New Description' }, 'user-001');

      expect(mockEventBus.publish).toHaveBeenCalledWith('cmdb.ci.updated', expect.objectContaining({
        ciId: 'app-006',
      }));
    });
  });

  describe('deleteCI', () => {
    it('should soft delete CI', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-007',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const deleted = await cmdbService.deleteCI(created.id);

      expect(deleted).toBe(true);

      const ci = await cmdbService.getCI(created.id);
      expect(ci).toBeNull();
    });

    it('should return false for non-existent CI', async () => {
      const deleted = await cmdbService.deleteCI('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should publish CI deleted event', async () => {
      const created = await cmdbService.createCI({
        ciId: 'app-008',
        ciType: 'APPLICATION' as const,
        name: 'Test Application',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.deleteCI(created.id);

      expect(mockEventBus.publish).toHaveBeenCalledWith('cmdb.ci.deleted', expect.objectContaining({
        ciId: 'app-008',
      }));
    });
  });

  describe('listCIs', () => {
    it('should list CIs with filters', async () => {
      // Create test data
      await cmdbService.createCI({
        ciId: 'app-009',
        ciType: 'APPLICATION' as const,
        name: 'App One',
        environment: 'dev',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.createCI({
        ciId: 'app-010',
        ciType: 'APPLICATION' as const,
        name: 'App Two',
        environment: 'prod',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const result = await cmdbService.listCIs({
        tenantId: BigInt(1),
        environment: 'dev',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ciId).toBe('app-009');
    });

    it('should support pagination', async () => {
      // Create test data
      for (let i = 0; i < 5; i++) {
        await cmdbService.createCI({
          ciId: `app-pag-${i}`,
          ciType: 'APPLICATION' as const,
          name: `App ${i}`,
          createdBy: 'user-001',
          tenantId: BigInt(1),
        });
      }

      const result = await cmdbService.listCIs({
        tenantId: BigInt(1),
        limit: 2,
        offset: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBeGreaterThanOrEqual(5);
    });

    it('should support search', async () => {
      await cmdbService.createCI({
        ciId: 'app-search',
        ciType: 'APPLICATION' as const,
        name: 'Searchable App',
        description: 'This is searchable',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const result = await cmdbService.listCIs({
        tenantId: BigInt(1),
        search: 'searchable',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ciId).toBe('app-search');
    });
  });

  describe('relations', () => {
    it('should create relation successfully', async () => {
      const fromCI = await cmdbService.createCI({
        ciId: 'app-from',
        ciType: 'APPLICATION' as const,
        name: 'From App',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const toCI = await cmdbService.createCI({
        ciId: 'app-to',
        ciType: 'DATABASE' as const,
        name: 'To DB',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const relation = await cmdbService.createRelation(
        {
          fromCiId: fromCI.ciId,
          toCiId: toCI.ciId,
          relationType: 'DEPENDS_ON',
        },
        'user-001'
      );

      expect(relation.id).toBeDefined();
      expect(relation.fromCiId).toBe('app-from');
      expect(relation.toCiId).toBe('app-to');
      expect(relation.relationType).toBe('DEPENDS_ON');
    });

    it('should throw error when CI not found', async () => {
      await expect(
        cmdbService.createRelation(
          {
            fromCiId: 'non-existent',
            toCiId: 'app-to',
            relationType: 'DEPENDS_ON',
          },
          'user-001'
        )
      ).rejects.toThrow('not found');
    });

    it('should get relations by CI id', async () => {
      const fromCI = await cmdbService.createCI({
        ciId: 'app-rel-from',
        ciType: 'APPLICATION' as const,
        name: 'From App',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const toCI = await cmdbService.createCI({
        ciId: 'app-rel-to',
        ciType: 'DATABASE' as const,
        name: 'To DB',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.createRelation(
        {
          fromCiId: fromCI.ciId,
          toCiId: toCI.ciId,
          relationType: 'DEPENDS_ON',
        },
        'user-001'
      );

      const relations = await cmdbService.getCIRelations(fromCI.ciId);
      expect(relations).toHaveLength(1);
    });

    it('should delete relation', async () => {
      const fromCI = await cmdbService.createCI({
        ciId: 'app-del-from',
        ciType: 'APPLICATION' as const,
        name: 'From App',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const toCI = await cmdbService.createCI({
        ciId: 'app-del-to',
        ciType: 'DATABASE' as const,
        name: 'To DB',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      const relation = await cmdbService.createRelation(
        {
          fromCiId: fromCI.ciId,
          toCiId: toCI.ciId,
          relationType: 'DEPENDS_ON',
        },
        'user-001'
      );

      const deleted = await cmdbService.deleteRelation(relation.id);
      expect(deleted).toBe(true);

      const relations = await cmdbService.getCIRelations(fromCI.ciId);
      expect(relations).toHaveLength(0);
    });
  });

  describe('versions', () => {
    it('should get version history', async () => {
      const ci = await cmdbService.createCI({
        ciId: 'app-version',
        ciType: 'APPLICATION' as const,
        name: 'Versioned App',
        description: 'Initial',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.updateCI(ci.id, { description: 'Updated v2' }, 'user-001');
      await cmdbService.updateCI(ci.id, { description: 'Updated v3' }, 'user-001');

      const versions = await cmdbService.getVersions(ci.ciId);

      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe(3);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(1);
    });

    it('should get current version', async () => {
      const ci = await cmdbService.createCI({
        ciId: 'app-current-version',
        ciType: 'APPLICATION' as const,
        name: 'Current Version App',
        createdBy: 'user-001',
        tenantId: BigInt(1),
      });

      await cmdbService.updateCI(ci.id, { description: 'v2' }, 'user-001');

      const currentVersion = await cmdbService.getCurrentVersion(ci.ciId);
      expect(currentVersion).toBe(2);
    });
  });
});
