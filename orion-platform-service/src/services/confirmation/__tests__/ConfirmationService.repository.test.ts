/**
 * ConfirmationService - Repository (DB-backed) Path Tests
 *
 * Tests all public methods when a PostgreSQL repository is injected.
 * Directly injects a mock repository into the service instance to test
 * DB path logic, error handling, and graceful fallback to in-memory.
 *
 * Uses jest.resetModules() to get fresh module-level Maps for each test group.
 */

let ConfirmationService: typeof import('../ConfirmationService').ConfirmationService;

const getFreshModule = async () => {
  jest.resetModules();
  const mod = await require('../ConfirmationService');
  return mod;
};

const createMockRepository = () => ({
  insert: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  insertAudit: jest.fn(),
  findAuditsByConfirmation: jest.fn(),
  findAllAudits: jest.fn(),
  findNotificationSettings: jest.fn(),
  upsertNotificationSettings: jest.fn(),
  getStats: jest.fn(),
});

const makeEntity = (overrides: Record<string, any> = {}) => ({
  id: 'conf-001',
  scene_type: 'deploy',
  priority: 'P1' as const,
  ai_suggestion: 'Deploy hotfix',
  ai_confidence: 0.85,
  status: 'pending' as const,
  push_time: new Date('2026-01-15T10:00:00Z'),
  response_time: null,
  responder: null,
  comment: null,
  context: null,
  tenant_id: null,
  created_at: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const makeAuditEntity = (overrides: Record<string, any> = {}) => ({
  id: 'audit-001',
  confirmation_id: 'conf-001',
  action: 'approved',
  user: 'admin',
  timestamp: new Date('2026-01-15T10:05:00Z'),
  details: null,
  ...overrides,
});

const makeNotificationEntity = (overrides: Record<string, any> = {}) => ({
  id: 'ns-001',
  user_id: 'user-1',
  channels: ['email', 'slack'],
  dnd_start: '22:00',
  dnd_end: '08:00',
  auto_approve_p3: false,
  auto_approve_after_minutes: 30,
  created_at: new Date('2026-01-15T10:00:00Z'),
  updated_at: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

/**
 * Helper to create a service with an injected mock repository
 * and fresh module-level Maps (via jest.resetModules).
 */
const createServiceWithRepo = async () => {
  const mod = await getFreshModule();
  ConfirmationService = mod.ConfirmationService;
  const mockRepo = createMockRepository();
  const service = new ConfirmationService();
  // Directly inject the mock repository (bypassing private access)
  (service as any).repository = mockRepo;
  return { service, mockRepo };
};

describe('ConfirmationService - Repository Path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // CREATE - DB PATH
  // ==========================================================================

  describe('create (DB path)', () => {
    test('should call repository insert with correct parameters', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockResolvedValue(makeEntity());

      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy hotfix',
        aiConfidence: 0.85,
      });

      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).toHaveBeenCalledWith({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy hotfix',
        aiConfidence: 0.85,
        context: undefined,
        tenantId: undefined,
      });
      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.sceneType).toBe('deploy');
      expect(result.aiSuggestion).toBe('Deploy hotfix');
    });

    test('should generate its own UUID (not use repository entity id)', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockResolvedValue(makeEntity({ id: 'repo-generated-id' }));

      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Test',
        aiConfidence: 0.8,
      });

      // Service creates its own UUID, doesn't use the repo entity's id
      expect(result.id).toBeDefined();
      expect(result.id).not.toBe('repo-generated-id');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    test('should pass context and tenantId to repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockResolvedValue(makeEntity({
        context: { env: 'prod' },
        tenant_id: 'tenant-123',
      }));

      await service.create({
        sceneType: 'rollback',
        priority: 'P0',
        aiSuggestion: 'Rollback',
        aiConfidence: 0.95,
        context: { env: 'prod' },
        tenantId: 'tenant-123',
      });

      expect(mockRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        context: { env: 'prod' },
        tenantId: 'tenant-123',
      }));
    });

    test('should fall back to in-memory when repository insert throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');

      // Should be accessible via in-memory fallback (getById checks memory first)
      const found = await service.getById(result.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(result.id);
    });

    test('should set default values for created confirmation', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockResolvedValue(makeEntity());

      const before = Date.now();
      const result = await service.create({
        sceneType: 'scaling',
        priority: 'P3',
        aiSuggestion: 'Scale down',
        aiConfidence: 0.60,
      });
      const after = Date.now();

      expect(result.status).toBe('pending');
      expect(result.priority).toBe('P3');
      const pushTime = new Date(result.pushTime).getTime();
      expect(pushTime).toBeGreaterThanOrEqual(before);
      expect(pushTime).toBeLessThanOrEqual(after);
    });

    test('should not store in in-memory Map when repository succeeds', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockResolvedValue(makeEntity());

      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Test',
        aiConfidence: 0.8,
      });

      // When repository insert succeeds, the item is NOT stored in the
      // in-memory confirmations Map (only stored on fallback).
      // getById should need to query the repository.
      mockRepo.findById.mockResolvedValue(makeEntity({ id: result.id }));
      const found = await service.getById(result.id);
      expect(found).not.toBeNull();
      expect(mockRepo.findById).toHaveBeenCalledWith(result.id);
    });
  });

  // ==========================================================================
  // GET BY ID - DB PATH
  // ==========================================================================

  describe('getById (DB path)', () => {
    test('should return mapped request from repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(makeEntity({
        id: 'conf-100',
        scene_type: 'scaling',
        priority: 'P0',
        ai_confidence: 0.99,
        response_time: new Date('2026-01-15T10:05:00Z'),
        responder: 'admin',
        comment: 'Approved',
        context: { region: 'us-east-1' },
        tenant_id: 'tenant-A',
      }));

      const result = await service.getById('conf-100');

      expect(mockRepo.findById).toHaveBeenCalledWith('conf-100');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('conf-100');
      expect(result!.sceneType).toBe('scaling');
      expect(result!.priority).toBe('P0');
      expect(result!.aiConfidence).toBe(0.99);
      expect(result!.responseTime).toBe('2026-01-15T10:05:00.000Z');
      expect(result!.responder).toBe('admin');
      expect(result!.comment).toBe('Approved');
      expect(result!.context).toEqual({ region: 'us-east-1' });
      expect(result!.tenantId).toBe('tenant-A');
    });

    test('should return null when repository finds nothing and memory is empty', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });

    test('should check in-memory cache before querying repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();

      // Create an item (falls back to in-memory since insert will fail)
      mockRepo.insert.mockRejectedValue(new Error('skip DB'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Test',
        aiConfidence: 0.8,
      });

      // Now getById should find it in memory without calling repository
      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    test('should fall back to repository when not in memory', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(makeEntity({ id: 'db-only-id' }));

      const result = await service.getById('db-only-id');

      expect(mockRepo.findById).toHaveBeenCalledWith('db-only-id');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('db-only-id');
    });
  });

  // ==========================================================================
  // LIST - DB PATH
  // ==========================================================================

  describe('list (DB path)', () => {
    test('should return mapped results from repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAll.mockResolvedValue({
        entities: [
          makeEntity({ id: 'c1', scene_type: 'deploy', priority: 'P1' }),
          makeEntity({ id: 'c2', scene_type: 'rollback', priority: 'P0' }),
        ],
        total: 2,
      });

      const result = await service.list();

      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('c1');
      expect(result[0].sceneType).toBe('deploy');
      expect(result[1].id).toBe('c2');
      expect(result[1].sceneType).toBe('rollback');
    });

    test('should pass filter params to repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      await service.list({
        sceneType: 'deploy',
        priority: 'P0',
        status: 'pending',
        tenantId: 'tenant-1',
        offset: 10,
        limit: 20,
      });

      expect(mockRepo.findAll).toHaveBeenCalledWith({
        sceneType: 'deploy',
        priority: 'P0',
        status: 'pending',
        tenantId: 'tenant-1',
        offset: 10,
        limit: 20,
      });
    });

    test('should fall back to in-memory when repository throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAll.mockRejectedValue(new Error('DB timeout'));

      // Create items in-memory first (insert fails -> fallback)
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Test',
        aiConfidence: 0.8,
      });

      // Reset mock to throw for findAll
      mockRepo.findAll.mockRejectedValue(new Error('DB timeout'));

      const result = await service.list({ sceneType: 'deploy' });

      // Should fall back to in-memory and find the item
      expect(result.length).toBe(1);
    });

    test('should return empty array from empty repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await service.list();

      expect(result).toEqual([]);
    });

    test('should map entity fields correctly in list results', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAll.mockResolvedValue({
        entities: [
          makeEntity({
            id: 'c1',
            scene_type: 'incident',
            priority: 'P0',
            ai_suggestion: 'Emergency',
            ai_confidence: 0.99,
            status: 'confirmed',
            response_time: new Date('2026-01-15T10:05:00Z'),
            responder: 'on-call',
            comment: 'Approved',
            context: { severity: 'critical' },
            tenant_id: 'prod',
          }),
        ],
        total: 1,
      });

      const result = await service.list();

      expect(result[0]).toEqual({
        id: 'c1',
        sceneType: 'incident',
        priority: 'P0',
        aiSuggestion: 'Emergency',
        aiConfidence: 0.99,
        status: 'confirmed',
        pushTime: '2026-01-15T10:00:00.000Z',
        responseTime: '2026-01-15T10:05:00.000Z',
        responder: 'on-call',
        comment: 'Approved',
        context: { severity: 'critical' },
        tenantId: 'prod',
      });
    });
  });

  // ==========================================================================
  // APPROVE - DB PATH
  // ==========================================================================

  describe('approve (DB path)', () => {
    test('should update status and insert audit via repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();

      // Create in-memory first (insert fails)
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.approve(created.id, {
        responder: 'admin',
        comment: 'Looks good',
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('confirmed');
      expect(result!.responder).toBe('admin');
      expect(result!.comment).toBe('Looks good');
      expect(result!.responseTime).toBeDefined();
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        created.id, 'confirmed', 'admin', 'Looks good', expect.any(Date)
      );
      expect(mockRepo.insertAudit).toHaveBeenCalledWith({
        confirmationId: created.id,
        action: 'approved',
        user: 'admin',
        details: 'Looks good',
      });
    });

    test('should use reason as comment when comment is not provided', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.approve(created.id, {
        responder: 'admin',
        reason: 'Approved via reason',
      });

      expect(result!.comment).toBe('Approved via reason');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        created.id, 'confirmed', 'admin', 'Approved via reason', expect.any(Date)
      );
    });

    test('should default responder to "system"', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.approve(created.id, {});

      expect(result!.responder).toBe('system');
      expect(mockRepo.insertAudit).toHaveBeenCalledWith(expect.objectContaining({
        user: 'system',
      }));
    });

    test('should return null for non-existent confirmation', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.approve('non-existent', { responder: 'admin' });

      expect(result).toBeNull();
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    test('should return null when confirmation is already confirmed', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      // First approve succeeds
      await service.approve(created.id, { responder: 'admin' });

      // Second approve should fail
      const result = await service.approve(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when confirmation is already rejected', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      await service.reject(created.id, { responder: 'admin' });

      const result = await service.approve(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null for expired confirmation', async () => {
      const { service, mockRepo } = await createServiceWithRepo();

      // Item only in repository (not in memory), with expired status
      mockRepo.findById.mockResolvedValue(makeEntity({ id: 'expired-1', status: 'expired' }));

      const result = await service.approve('expired-1', { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should still succeed when DB persistence of status fails', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      // DB operations fail but service should still succeed (in-memory updated first)
      mockRepo.updateStatus.mockRejectedValue(new Error('DB write error'));
      mockRepo.insertAudit.mockRejectedValue(new Error('DB write error'));

      const result = await service.approve(created.id, { responder: 'admin' });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('confirmed');
    });

    test('should set responseTime to current timestamp', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const before = Date.now();
      const result = await service.approve(created.id, { responder: 'admin' });
      const after = Date.now();

      const responseTime = new Date(result!.responseTime!).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(before);
      expect(responseTime).toBeLessThanOrEqual(after);
    });
  });

  // ==========================================================================
  // REJECT - DB PATH
  // ==========================================================================

  describe('reject (DB path)', () => {
    test('should update status and insert audit via repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity({ action: 'rejected' }));

      const result = await service.reject(created.id, {
        responder: 'reviewer',
        comment: 'Too risky',
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
      expect(result!.responder).toBe('reviewer');
      expect(result!.comment).toBe('Too risky');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        created.id, 'rejected', 'reviewer', 'Too risky', expect.any(Date)
      );
      expect(mockRepo.insertAudit).toHaveBeenCalledWith({
        confirmationId: created.id,
        action: 'rejected',
        user: 'reviewer',
        details: 'Too risky',
      });
    });

    test('should use reason as comment when comment is not provided', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.reject(created.id, {
        responder: 'reviewer',
        reason: 'Rejected via reason',
      });

      expect(result!.comment).toBe('Rejected via reason');
    });

    test('should default responder to "system"', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.reject(created.id, {});

      expect(result!.responder).toBe('system');
    });

    test('should return null for non-existent confirmation', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.reject('non-existent', { responder: 'admin' });

      expect(result).toBeNull();
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    test('should return null when already rejected', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      await service.reject(created.id, { responder: 'admin' });

      const result = await service.reject(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when already confirmed', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      await service.approve(created.id, { responder: 'admin' });

      const result = await service.reject(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should still succeed when DB persistence fails', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockRejectedValue(new Error('DB write error'));
      mockRepo.insertAudit.mockRejectedValue(new Error('DB write error'));

      const result = await service.reject(created.id, { responder: 'admin' });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
    });
  });

  // ==========================================================================
  // BATCH APPROVE - DB PATH
  // ==========================================================================

  describe('batchApprove (DB path)', () => {
    test('should approve multiple items via repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));

      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P2', aiSuggestion: 'B', aiConfidence: 0.7,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());

      const result = await service.batchApprove({
        ids: [c1.id, c2.id],
        responder: 'admin',
        comment: 'Batch OK',
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(2);
      expect(result.details.every(d => d.status === 'confirmed')).toBe(true);
    });

    test('should handle mixed success and failure with repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));

      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());
      mockRepo.findById.mockResolvedValue(null); // for the non-existent id

      const result = await service.batchApprove({
        ids: [c1.id, 'non-existent-id'],
        responder: 'admin',
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    test('should handle batch when DB persistence fails but in-memory succeeds', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));

      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });

      mockRepo.updateStatus.mockRejectedValue(new Error('DB error'));
      mockRepo.insertAudit.mockRejectedValue(new Error('DB error'));

      const result = await service.batchApprove({
        ids: [c1.id],
        responder: 'admin',
      });

      // Should succeed despite DB errors (in-memory fallback)
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  // ==========================================================================
  // GET AUDIT LOGS - DB PATH
  // ==========================================================================

  describe('getAuditLogs (DB path)', () => {
    test('should fetch by confirmationId from repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAuditsByConfirmation.mockResolvedValue([
        makeAuditEntity({ id: 'a1', confirmation_id: 'c1', action: 'approved' }),
        makeAuditEntity({ id: 'a2', confirmation_id: 'c1', action: 'rejected' }),
      ]);

      const result = await service.getAuditLogs({ confirmationId: 'c1' });

      expect(mockRepo.findAuditsByConfirmation).toHaveBeenCalledWith('c1');
      expect(result.length).toBe(2);
      expect(result[0].action).toBe('approved');
      expect(result[1].action).toBe('rejected');
    });

    test('should fetch all audits from repository when no confirmationId', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAllAudits.mockResolvedValue({
        entities: [
          makeAuditEntity({ id: 'a1', user: 'admin' }),
          makeAuditEntity({ id: 'a2', user: 'reviewer' }),
        ],
        total: 2,
      });

      const result = await service.getAuditLogs({ user: 'admin', limit: 10 });

      expect(mockRepo.findAllAudits).toHaveBeenCalledWith({
        user: 'admin',
        tenantId: undefined,
        startDate: undefined,
        endDate: undefined,
        offset: undefined,
        limit: 10,
      });
      expect(result.length).toBe(2);
    });

    test('should pass all filter params to repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAllAudits.mockResolvedValue({ entities: [], total: 0 });

      await service.getAuditLogs({
        user: 'admin',
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        offset: 5,
        limit: 25,
      });

      expect(mockRepo.findAllAudits).toHaveBeenCalledWith({
        user: 'admin',
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        offset: 5,
        limit: 25,
      });
    });

    test('should fall back to in-memory when findAuditsByConfirmation throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));

      // Create and approve in-memory
      const c = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      mockRepo.updateStatus.mockResolvedValue(true);
      mockRepo.insertAudit.mockResolvedValue(makeAuditEntity());
      await service.approve(c.id, { responder: 'admin' });

      // Now make the audit query fail
      mockRepo.findAuditsByConfirmation.mockRejectedValue(new Error('DB error'));

      const result = await service.getAuditLogs({ confirmationId: c.id });

      // Falls back to in-memory audit logs
      expect(result.length).toBe(1);
      expect(result[0].action).toBe('approved');
    });

    test('should fall back to in-memory when findAllAudits throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAllAudits.mockRejectedValue(new Error('DB timeout'));

      const result = await service.getAuditLogs();

      expect(result).toEqual([]);
    });

    test('should correctly map audit entity fields', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAuditsByConfirmation.mockResolvedValue([
        makeAuditEntity({
          id: 'audit-abc',
          confirmation_id: 'conf-xyz',
          action: 'approved',
          user: 'engineer-1',
          timestamp: new Date('2026-06-01T12:00:00Z'),
          details: 'All checks passed',
        }),
      ]);

      const result = await service.getAuditLogs({ confirmationId: 'conf-xyz' });

      expect(result[0]).toEqual({
        id: 'audit-abc',
        confirmationId: 'conf-xyz',
        action: 'approved',
        user: 'engineer-1',
        timestamp: '2026-06-01T12:00:00.000Z',
        details: 'All checks passed',
      });
    });

    test('should map audit entity with null details to undefined', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findAuditsByConfirmation.mockResolvedValue([
        makeAuditEntity({ details: null }),
      ]);

      const result = await service.getAuditLogs({ confirmationId: 'c1' });

      expect(result[0].details).toBeUndefined();
    });
  });

  // ==========================================================================
  // NOTIFICATION SETTINGS - DB PATH
  // ==========================================================================

  describe('getNotificationSettings (DB path)', () => {
    test('should return settings from repository when found', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(makeNotificationEntity({
        user_id: 'user-1',
        channels: ['pagerduty', 'slack'],
        dnd_start: '23:00',
        dnd_end: '07:00',
        auto_approve_p3: true,
        auto_approve_after_minutes: 60,
      }));

      const result = await service.getNotificationSettings('user-1');

      expect(mockRepo.findNotificationSettings).toHaveBeenCalledWith('user-1');
      expect(result.userId).toBe('user-1');
      expect(result.channels).toEqual(['pagerduty', 'slack']);
      expect(result.dndStart).toBe('23:00');
      expect(result.dndEnd).toBe('07:00');
      expect(result.autoApproveP3).toBe(true);
      expect(result.autoApproveAfterMinutes).toBe(60);
    });

    test('should return defaults when repository returns null', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(null);

      const result = await service.getNotificationSettings('new-user');

      expect(result.userId).toBe('new-user');
      expect(result.channels).toEqual(['email', 'slack']);
      expect(result.dndStart).toBe('22:00');
      expect(result.dndEnd).toBe('08:00');
      expect(result.autoApproveP3).toBe(false);
      expect(result.autoApproveAfterMinutes).toBe(30);
    });

    test('should fall back to in-memory when repository throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockRejectedValue(new Error('DB error'));

      const result = await service.getNotificationSettings('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.channels).toEqual(['email', 'slack']);
    });

    test('should cache settings from repository into memory', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(makeNotificationEntity({
        user_id: 'user-1',
        channels: ['pagerduty'],
      }));

      await service.getNotificationSettings('user-1');

      // Second call should use in-memory cache (repository still returns though)
      const result = await service.getNotificationSettings('user-1');
      expect(result.channels).toEqual(['pagerduty']);
    });
  });

  describe('updateNotificationSettings (DB path)', () => {
    test('should upsert to repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(null); // defaults
      mockRepo.upsertNotificationSettings.mockResolvedValue(makeNotificationEntity());

      const result = await service.updateNotificationSettings('user-1', {
        channels: ['pagerduty'],
        autoApproveP3: true,
      });

      expect(mockRepo.upsertNotificationSettings).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        channels: ['pagerduty'],
        autoApproveP3: true,
      }));
      expect(result.channels).toEqual(['pagerduty']);
      expect(result.autoApproveP3).toBe(true);
    });

    test('should fall back gracefully when repository upsert throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(null);
      mockRepo.upsertNotificationSettings.mockRejectedValue(new Error('DB write error'));

      const result = await service.updateNotificationSettings('user-1', {
        channels: ['webhook'],
      });

      // Should still return the updated value (in-memory fallback)
      expect(result.channels).toEqual(['webhook']);
    });

    test('should merge with existing settings from repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findNotificationSettings.mockResolvedValue(makeNotificationEntity({
        channels: ['email', 'slack'],
        dnd_start: '22:00',
        dnd_end: '08:00',
      }));
      mockRepo.upsertNotificationSettings.mockResolvedValue(makeNotificationEntity());

      const result = await service.updateNotificationSettings('user-1', {
        dndStart: '23:00',
      });

      expect(result.channels).toEqual(['email', 'slack']); // preserved from existing
      expect(result.dndStart).toBe('23:00'); // updated
    });
  });

  // ==========================================================================
  // STATS - DB PATH
  // ==========================================================================

  describe('getStats (DB path)', () => {
    test('should return stats from repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.getStats.mockResolvedValue({
        total: 10,
        pending: 3,
        confirmed: 5,
        rejected: 1,
        expired: 1,
      });

      const result = await service.getStats();

      expect(mockRepo.getStats).toHaveBeenCalledWith(undefined);
      expect(result.total).toBe(10);
      expect(result.pending).toBe(3);
      expect(result.confirmed).toBe(5);
      expect(result.rejected).toBe(1);
      expect(result.expired).toBe(1);
    });

    test('should pass tenantId to repository', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.getStats.mockResolvedValue({
        total: 5, pending: 2, confirmed: 2, rejected: 1, expired: 0,
      });

      await service.getStats('tenant-A');

      expect(mockRepo.getStats).toHaveBeenCalledWith('tenant-A');
    });

    test('should fall back to in-memory when repository throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.getStats.mockRejectedValue(new Error('DB query failed'));

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.expired).toBe(0);
    });

    test('should fall back to in-memory with tenantId when repository throws', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.insert.mockRejectedValue(new Error('skip'));

      // Create items in-memory
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
        tenantId: 't-1',
      });

      mockRepo.getStats.mockRejectedValue(new Error('DB error'));

      const result = await service.getStats('t-1');

      expect(result.total).toBe(1);
      expect(result.pending).toBe(1);
    });
  });

  // ==========================================================================
  // ENTITY MAPPER EDGE CASES
  // ==========================================================================

  describe('entity mapper edge cases', () => {
    test('should map entity with null optional fields to undefined', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(makeEntity({
        response_time: null,
        responder: null,
        comment: null,
        context: null,
        tenant_id: null,
      }));

      const result = await service.getById('c1');

      expect(result!.responseTime).toBeUndefined();
      expect(result!.responder).toBeUndefined();
      expect(result!.comment).toBeUndefined();
      expect(result!.context).toBeUndefined();
      expect(result!.tenantId).toBeUndefined();
    });

    test('should map entity with all optional fields populated', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(makeEntity({
        response_time: new Date('2026-01-15T12:00:00Z'),
        responder: 'admin',
        comment: 'Approved',
        context: { key: 'value', nested: { a: 1 } },
        tenant_id: 'tenant-1',
      }));

      const result = await service.getById('c1');

      expect(result!.responseTime).toBe('2026-01-15T12:00:00.000Z');
      expect(result!.responder).toBe('admin');
      expect(result!.comment).toBe('Approved');
      expect(result!.context).toEqual({ key: 'value', nested: { a: 1 } });
      expect(result!.tenantId).toBe('tenant-1');
    });

    test('should map all priority values correctly', async () => {
      const { service, mockRepo } = await createServiceWithRepo();

      for (const priority of ['P0', 'P1', 'P2', 'P3'] as const) {
        mockRepo.findById.mockResolvedValue(makeEntity({ priority }));
        const result = await service.getById('c1');
        expect(result!.priority).toBe(priority);
      }
    });

    test('should map all status values correctly', async () => {
      const { service, mockRepo } = await createServiceWithRepo();

      for (const status of ['pending', 'confirmed', 'rejected', 'expired'] as const) {
        mockRepo.findById.mockResolvedValue(makeEntity({ status }));
        const result = await service.getById('c1');
        expect(result!.status).toBe(status);
      }
    });

    test('should convert push_time Date to ISO string', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      const testDate = new Date('2026-03-15T08:30:00Z');
      mockRepo.findById.mockResolvedValue(makeEntity({ push_time: testDate }));

      const result = await service.getById('c1');

      expect(result!.pushTime).toBe('2026-03-15T08:30:00.000Z');
    });

    test('should parse ai_confidence as float', async () => {
      const { service, mockRepo } = await createServiceWithRepo();
      mockRepo.findById.mockResolvedValue(makeEntity({ ai_confidence: 0.123456789 }));

      const result = await service.getById('c1');

      expect(result!.aiConfidence).toBeCloseTo(0.123456789);
    });
  });
});
