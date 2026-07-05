/**
 * CMDB Service 单元测试
 *
 * 使用内存 Mock Repository 模拟 PostgreSQL 行为
 */

import { CmdbService } from '../CmdbService';
import { CmdbEventPublisher } from '../CmdbEventPublisher';
import { EventBusService } from '../../event-bus-service';
import { CI, CreateCIInput, UpdateCIInput, CIRelation, CIVersion, CIFilters, CIListResponse, RelationTypeDefinition, CreateRelationTypeInput, UpdateRelationTypeInput } from '../CmdbTypes';
import { OrionError, ErrorCode } from '../../../errors';

// ==================== 内存 Mock Repository ====================

class MockCmdbRepository {
  private store = new Map<string, CI>();
  private tenantStores = new Map<string, Map<string, CI>>();

  private getTenantStore(tenantId: bigint): Map<string, CI> {
    const key = String(tenantId);
    if (!this.tenantStores.has(key)) {
      this.tenantStores.set(key, new Map());
    }
    return this.tenantStores.get(key)!;
  }

  async createCI(input: CreateCIInput): Promise<CI> {
    const now = new Date();
    const id = `mock-id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ci: CI = {
      id,
      ciId: input.ciId,
      tenantId: input.tenantId,
      ciType: input.ciType,
      name: input.name,
      description: input.description,
      status: input.status || 'ACTIVE',
      environment: input.environment,
      tags: input.tags || [],
      attributes: input.attributes || {},
      version: 1,
      relations: [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    const tenantStore = this.getTenantStore(input.tenantId);
    tenantStore.set(id, ci);
    return ci;
  }

  async getCIById(id: string, tenantId: bigint): Promise<CI | null> {
    const tenantStore = this.getTenantStore(tenantId);
    const ci = tenantStore.get(id);
    if (!ci || ci.deletedAt) return null;
    return { ...ci };
  }

  async getCIByCiId(ciId: string, tenantId: bigint): Promise<CI | null> {
    const tenantStore = this.getTenantStore(tenantId);
    for (const ci of tenantStore.values()) {
      if (ci.ciId === ciId && !ci.deletedAt) {
        return { ...ci };
      }
    }
    return null;
  }

  async updateCI(id: string, input: UpdateCIInput, user: string, tenantId: bigint): Promise<CI | null> {
    const tenantStore = this.getTenantStore(tenantId);
    const ci = tenantStore.get(id);
    if (!ci || ci.deletedAt) return null;

    if (input.description !== undefined) ci.description = input.description;
    if (input.status !== undefined) ci.status = input.status;
    if (input.environment !== undefined) ci.environment = input.environment;
    if (input.tags !== undefined) ci.tags = input.tags;
    if (input.attributes !== undefined) ci.attributes = { ...ci.attributes, ...input.attributes };

    ci.version += 1;
    ci.updatedAt = new Date();
    tenantStore.set(id, ci);
    return { ...ci };
  }

  async deleteCI(id: string, tenantId: bigint): Promise<boolean> {
    const tenantStore = this.getTenantStore(tenantId);
    const ci = tenantStore.get(id);
    if (!ci || ci.deletedAt) return false;
    ci.deletedAt = new Date();
    ci.status = 'DECOMMISSIONED';
    tenantStore.set(id, ci);
    return true;
  }

  async archiveCI(id: string, tenantId: bigint): Promise<boolean> {
    const tenantStore = this.getTenantStore(tenantId);
    const ci = tenantStore.get(id);
    if (!ci || ci.deletedAt || ci.archivedAt) return false;
    ci.archivedAt = new Date();
    ci.status = 'ARCHIVED';
    ci.updatedAt = new Date();
    tenantStore.set(id, ci);
    return true;
  }

  async restoreCI(id: string): Promise<boolean> {
    for (const [, store] of this.tenantStores) {
      const ci = store.get(id);
      if (ci && ci.archivedAt) {
        ci.archivedAt = undefined;
        ci.status = 'ACTIVE';
        ci.updatedAt = new Date();
        store.set(id, ci);
        return true;
      }
    }
    return false;
  }

  async getArchivedCIs(tenantId: bigint, limit = 100, offset = 0): Promise<CI[]> {
    const tenantStore = this.getTenantStore(tenantId);
    return Array.from(tenantStore.values())
      .filter(ci => ci.archivedAt && !ci.deletedAt)
      .sort((a, b) => (b.archivedAt!.getTime() - a.archivedAt!.getTime()))
      .slice(offset, offset + limit);
  }

  async listCIs(filters: CIFilters): Promise<CIListResponse> {
    const tenantStore = this.getTenantStore(filters.tenantId);
    let result = Array.from(tenantStore.values()).filter(ci => !ci.deletedAt);

    if (!filters.includeArchived) {
      result = result.filter(ci => !ci.archivedAt);
    }
    if (filters.ciType) {
      result = result.filter(ci => ci.ciType === filters.ciType);
    }
    if (filters.status) {
      result = result.filter(ci => ci.status === filters.status);
    }
    if (filters.environment) {
      result = result.filter(ci => ci.environment === filters.environment);
    }
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(ci =>
        ci.tags && ci.tags.some(tag => filters.tags!.includes(tag))
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(ci =>
        ci.name.toLowerCase().includes(searchLower) ||
        ci.description?.toLowerCase().includes(searchLower)
      );
    }

    const orderBy = filters.orderBy || 'createdAt';
    const order = filters.order || 'DESC';
    result.sort((a, b) => {
      const aVal = (a as any)[orderBy] || '';
      const bVal = (b as any)[orderBy] || '';
      if (aVal < bVal) return order === 'ASC' ? -1 : 1;
      if (aVal > bVal) return order === 'ASC' ? 1 : -1;
      return 0;
    });

    const total = result.length;
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    return { data: result.slice(offset, offset + limit), total, limit, offset };
  }

  async ciExists(ciId: string, tenantId: bigint): Promise<boolean> {
    const tenantStore = this.getTenantStore(tenantId);
    for (const ci of tenantStore.values()) {
      if (ci.ciId === ciId && !ci.deletedAt) return true;
    }
    return false;
  }

  reset(): void {
    this.store.clear();
    this.tenantStores.clear();
  }
}

class MockCmdbRelationRepository {
  private store = new Map<string, CIRelation>();
  private tenantStore = new Map<string, CIRelation[]>();

  private getTenantList(tenantId: bigint): CIRelation[] {
    const key = String(tenantId);
    if (!this.tenantStore.has(key)) {
      this.tenantStore.set(key, []);
    }
    return this.tenantStore.get(key)!;
  }

  async createRelation(input: any, user: string, tenantId?: bigint): Promise<CIRelation> {
    const now = new Date();
    const relation: CIRelation = {
      id: `mock-rel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fromCiId: input.fromCiId,
      toCiId: input.toCiId,
      relationType: input.relationType,
      description: input.description,
      createdBy: user,
      createdAt: now,
    };
    this.store.set(relation.id, relation);
    if (tenantId) {
      this.getTenantList(tenantId).push(relation);
    }
    return relation;
  }

  async getRelationById(id: string): Promise<CIRelation | null> {
    return this.store.get(id) || null;
  }

  async relationExists(fromCiId: string, toCiId: string, relationType: string): Promise<boolean> {
    for (const rel of this.store.values()) {
      if (rel.fromCiId === fromCiId && rel.toCiId === toCiId &&
          rel.relationType === relationType && !rel.deletedAt) {
        return true;
      }
    }
    return false;
  }

  async getCIRelations(ciId: string): Promise<CIRelation[]> {
    return Array.from(this.store.values()).filter(
      r => (r.fromCiId === ciId || r.toCiId === ciId) && !r.deletedAt
    );
  }

  async deleteRelation(id: string): Promise<boolean> {
    const relation = this.store.get(id);
    if (!relation || relation.deletedAt) return false;
    relation.deletedAt = new Date();
    this.store.set(id, relation);
    return true;
  }

  reset(): void {
    this.store.clear();
    this.tenantStore.clear();
  }
}

class MockCmdbRelationTypeRepository {
  private store = new Map<string, RelationTypeDefinition>();

  async createRelationType(input: CreateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition> {
    const now = new Date();
    const rt: RelationTypeDefinition = {
      id: `mock-rt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tenantId,
      name: input.name,
      description: input.description,
      category: input.category,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(rt.id, rt);
    return rt;
  }

  async getRelationTypeById(id: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    const rt = this.store.get(id);
    if (!rt || rt.tenantId !== tenantId) return null;
    return { ...rt };
  }

  async getRelationTypeByName(name: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    for (const rt of this.store.values()) {
      if (rt.name === name && rt.tenantId === tenantId) {
        return { ...rt };
      }
    }
    return null;
  }

  async getRelationTypes(tenantId: bigint): Promise<RelationTypeDefinition[]> {
    return Array.from(this.store.values())
      .filter(rt => rt.tenantId === tenantId)
      .map(rt => ({ ...rt }));
  }

  async updateRelationType(id: string, input: UpdateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    const rt = this.store.get(id);
    if (!rt || rt.tenantId !== tenantId) return null;
    if (rt.isSystem) return null;

    if (input.name !== undefined) rt.name = input.name;
    if (input.description !== undefined) rt.description = input.description;
    if (input.category !== undefined) rt.category = input.category;
    rt.updatedAt = new Date();
    this.store.set(id, rt);
    return { ...rt };
  }

  async deleteRelationType(id: string, tenantId: bigint): Promise<boolean> {
    const rt = this.store.get(id);
    if (!rt || rt.tenantId !== tenantId || rt.isSystem) return false;
    this.store.delete(id);
    return true;
  }

  reset(): void {
    this.store.clear();
  }
}

class MockCmdbVersionRepository {
  private store = new Map<string, CIVersion[]>();

  async createVersion(input: { ciId: string; version: number; changes: string; data: Record<string, any>; createdBy: string }): Promise<CIVersion> {
    const now = new Date();
    const version: CIVersion = {
      id: `mock-ver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ciId: input.ciId,
      version: input.version,
      changes: input.changes,
      data: input.data,
      createdBy: input.createdBy,
      createdAt: now,
    };
    const versions = this.store.get(input.ciId) || [];
    versions.push(version);
    this.store.set(input.ciId, versions);
    return version;
  }

  async getVersions(ciId: string): Promise<CIVersion[]> {
    const versions = this.store.get(ciId) || [];
    return [...versions].sort((a, b) => b.version - a.version);
  }

  async getVersion(ciId: string, version: number): Promise<CIVersion | null> {
    const versions = this.store.get(ciId) || [];
    return versions.find(v => v.version === version) || null;
  }

  async getCurrentVersion(ciId: string): Promise<number> {
    const versions = this.store.get(ciId) || [];
    if (versions.length === 0) return 0;
    return Math.max(...versions.map(v => v.version));
  }

  reset(): void {
    this.store.clear();
  }
}

// ==================== 测试辅助 ====================

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
  let mockCiRepo: MockCmdbRepository;
  let mockRelationRepo: MockCmdbRelationRepository;
  let mockRelationTypeRepo: MockCmdbRelationTypeRepository;
  let mockVersionRepo: MockCmdbVersionRepository;

  beforeEach(() => {
    // 重置 Mock Repositories
    mockCiRepo = new MockCmdbRepository();
    mockRelationRepo = new MockCmdbRelationRepository();
    mockRelationTypeRepo = new MockCmdbRelationTypeRepository();
    mockVersionRepo = new MockCmdbVersionRepository();

    jest.clearAllMocks();

    // 创建事件发布器和服务（注入 Mock Repositories）
    eventPublisher = new CmdbEventPublisher(mockEventBus);
    cmdbService = new CmdbService({
      eventPublisher,
      ciRepository: mockCiRepo as any,
      relationRepository: mockRelationRepo as any,
      relationTypeRepository: mockRelationTypeRepo as any,
      versionRepository: mockVersionRepo as any,
    });
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

      const ci = await cmdbService.getCI(created.id, BigInt(1));

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

      await cmdbService.deleteCI(created.id, BigInt(1));
      const ci = await cmdbService.getCI(created.id, BigInt(1));

      expect(ci).toBeNull();
    });

    it('should return null for non-existent CI', async () => {
      const ci = await cmdbService.getCI('non-existent-id', BigInt(1));
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
        'user-002',
        BigInt(1)
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
        'user-001',
        BigInt(1)
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

      await cmdbService.updateCI(created.id, { description: 'New Description' }, 'user-001', BigInt(1));

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

      const deleted = await cmdbService.deleteCI(created.id, BigInt(1));

      expect(deleted).toBe(true);

      const ci = await cmdbService.getCI(created.id, BigInt(1));
      expect(ci).toBeNull();
    });

    it('should return false for non-existent CI', async () => {
      const deleted = await cmdbService.deleteCI('non-existent-id', BigInt(1));
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

      await cmdbService.deleteCI(created.id, BigInt(1));

      expect(mockEventBus.publish).toHaveBeenCalledWith('cmdb.ci.deleted', expect.objectContaining({
        ciId: 'app-008',
      }));
    });
  });

  describe('listCIs', () => {
    it('should list CIs with filters', async () => {
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
        'user-001',
        BigInt(1)
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
          'user-001',
          BigInt(1)
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
        'user-001',
        BigInt(1)
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
        'user-001',
        BigInt(1)
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

      await cmdbService.updateCI(ci.id, { description: 'Updated v2' }, 'user-001', BigInt(1));
      await cmdbService.updateCI(ci.id, { description: 'Updated v3' }, 'user-001', BigInt(1));

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

      await cmdbService.updateCI(ci.id, { description: 'v2' }, 'user-001', BigInt(1));

      const currentVersion = await cmdbService.getCurrentVersion(ci.ciId);
      expect(currentVersion).toBe(2);
    });
  });
});
