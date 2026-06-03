/**
 * CmdbEventPublisher 测试
 *
 * 测试 CMDB 事件发布器：CI 创建/更新/删除事件、关联关系事件、版本事件。
 * Mock EventBusService 模拟事件总线。
 */

import { CmdbEventPublisher } from '../CmdbEventPublisher';
import { CI, CIRelation } from '../CmdbTypes';

// ==================== Mock EventBusService ====================

function createMockEventBus() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  };
}

function createTestCI(overrides: Partial<CI> = {}): CI {
  return {
    id: 'ci-uuid-1',
    ciId: 'CI-001',
    ciType: 'service' as any,
    name: 'test-service',
    status: 'active',
    environment: 'production',
    tenantId: BigInt(1),
    tags: ['test'],
    attributes: { region: 'us-east-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestRelation(overrides: Partial<CIRelation> = {}): CIRelation {
  return {
    id: 'rel-1',
    fromCiId: 'CI-001',
    toCiId: 'CI-002',
    relationType: 'depends_on',
    description: 'Test relation',
    ...overrides,
  };
}

// ==================== Tests ====================

describe('CmdbEventPublisher', () => {
  let publisher: CmdbEventPublisher;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventBus = createMockEventBus();
    publisher = new CmdbEventPublisher(mockEventBus as any);
  });

  // ---- publishCICreated ----

  describe('publishCICreated', () => {
    it('should publish CI created event with correct data', async () => {
      const ci = createTestCI();

      await publisher.publishCICreated(ci);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.created',
        expect.objectContaining({
          ciId: 'CI-001',
          id: 'ci-uuid-1',
          ciType: 'service',
          name: 'test-service',
          status: 'active',
          environment: 'production',
          tenantId: '1',
        })
      );
    });

    it('should convert tenantId to string', async () => {
      const ci = createTestCI({ tenantId: BigInt(42) });

      await publisher.publishCICreated(ci);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.created',
        expect.objectContaining({ tenantId: '42' })
      );
    });
  });

  // ---- publishCIUpdated ----

  describe('publishCIUpdated', () => {
    it('should publish CI updated event with changes', async () => {
      const ci = createTestCI();
      const changes = ['status', 'name'];

      await publisher.publishCIUpdated(ci, changes);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.updated',
        expect.objectContaining({
          ciId: 'CI-001',
          changes: ['status', 'name'],
          tenantId: '1',
        })
      );
    });

    it('should include all required fields', async () => {
      const ci = createTestCI();

      await publisher.publishCIUpdated(ci, []);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.updated',
        expect.objectContaining({
          ciId: ci.ciId,
          id: ci.id,
          ciType: ci.ciType,
          name: ci.name,
          status: ci.status,
        })
      );
    });
  });

  // ---- publishCIDeleted ----

  describe('publishCIDeleted', () => {
    it('should publish CI deleted event', async () => {
      const ci = createTestCI();

      await publisher.publishCIDeleted(ci);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.deleted',
        expect.objectContaining({
          ciId: 'CI-001',
          id: 'ci-uuid-1',
          ciType: 'service',
          name: 'test-service',
          tenantId: '1',
        })
      );
    });
  });

  // ---- publishRelationCreated ----

  describe('publishRelationCreated', () => {
    it('should publish relation created event', async () => {
      const relation = createTestRelation();

      await publisher.publishRelationCreated(relation);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.relation.created',
        expect.objectContaining({
          id: 'rel-1',
          fromCiId: 'CI-001',
          toCiId: 'CI-002',
          relationType: 'depends_on',
        })
      );
    });
  });

  // ---- publishRelationDeleted ----

  describe('publishRelationDeleted', () => {
    it('should publish relation deleted event', async () => {
      const relation = createTestRelation();

      await publisher.publishRelationDeleted(relation);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.relation.deleted',
        expect.objectContaining({
          id: 'rel-1',
          fromCiId: 'CI-001',
          toCiId: 'CI-002',
          relationType: 'depends_on',
        })
      );
    });
  });

  // ---- publishCIVersionCreated ----

  describe('publishCIVersionCreated', () => {
    it('should publish CI version created event', async () => {
      await publisher.publishCIVersionCreated('CI-001', 3, 'Updated attributes');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'cmdb.ci.versioned',
        expect.objectContaining({
          ciId: 'CI-001',
          version: 3,
          changes: 'Updated attributes',
        })
      );
    });
  });

  // ---- Error handling ----

  describe('error handling', () => {
    it('should propagate event bus errors', async () => {
      mockEventBus.publish.mockRejectedValueOnce(new Error('NATS connection lost'));

      await expect(
        publisher.publishCICreated(createTestCI())
      ).rejects.toThrow('NATS connection lost');
    });
  });
});
