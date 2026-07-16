/**
 * Skill Module - Barrel Export Tests
 *
 * Verifies that the index.ts correctly exports all public types and classes
 * from SkillRepository and SkillService.
 */

describe('Skill module barrel exports', () => {
  describe('SkillRepository exports', () => {
    it('should export SkillRepository class', async () => {
      const mod = await import('../index');
      expect(mod.SkillRepository).toBeDefined();
      expect(typeof mod.SkillRepository).toBe('function');
    });

    it('should export SkillService class', async () => {
      const mod = await import('../index');
      expect(mod.SkillService).toBeDefined();
      expect(typeof mod.SkillService).toBe('function');
    });

    it('should export SkillServiceError class', async () => {
      const mod = await import('../index');
      expect(mod.SkillServiceError).toBeDefined();
      expect(typeof mod.SkillServiceError).toBe('function');
    });

    it('should create SkillRepository instance with pool', async () => {
      const { SkillRepository } = await import('../index');
      const mockPool = { query: jest.fn() };
      const repo = new SkillRepository(mockPool as any);
      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
      expect(repo.findByName).toBeDefined();
      expect(repo.findAll).toBeDefined();
      expect(repo.create).toBeDefined();
      expect(repo.update).toBeDefined();
      expect(repo.delete).toBeDefined();
      expect(repo.findVersions).toBeDefined();
      expect(repo.createVersion).toBeDefined();
      expect(repo.findReviews).toBeDefined();
      expect(repo.createReview).toBeDefined();
      expect(repo.createInstance).toBeDefined();
      expect(repo.findInstanceById).toBeDefined();
      expect(repo.updateInstance).toBeDefined();
      expect(repo.deleteInstance).toBeDefined();
      expect(repo.search).toBeDefined();
      expect(repo.getCategories).toBeDefined();
      expect(repo.createExecution).toBeDefined();
      expect(repo.updateExecution).toBeDefined();
      expect(repo.findExecutionById).toBeDefined();
      expect(repo.createAuditLog).toBeDefined();
      expect(repo.findAuditLogs).toBeDefined();
      expect(repo.lockVersion).toBeDefined();
      expect(repo.unlockVersion).toBeDefined();
      expect(repo.incrementInstallCount).toBeDefined();
      expect(repo.count).toBeDefined();
      expect(repo.findPendingReview).toBeDefined();
    });

    it('should create SkillService instance with repo', async () => {
      const { SkillService } = await import('../index');
      const mockRepo = {
        findById: jest.fn(),
        findByName: jest.fn(),
        findAll: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findVersions: jest.fn(),
        findLatestVersion: jest.fn(),
        createVersion: jest.fn(),
        findReviews: jest.fn(),
        createReview: jest.fn(),
        createInstance: jest.fn(),
        findInstanceById: jest.fn(),
        findInstanceByIdAndTenant: jest.fn(),
        findInstancesBySkillId: jest.fn(),
        findInstancesByTenant: jest.fn(),
        updateInstance: jest.fn(),
        deleteInstance: jest.fn(),
        search: jest.fn(),
        getCategories: jest.fn(),
        createExecution: jest.fn(),
        updateExecution: jest.fn(),
        findExecutionById: jest.fn(),
        findExecutionsBySkill: jest.fn(),
        findExecutionsByTenant: jest.fn(),
        createAuditLog: jest.fn(),
        findAuditLogs: jest.fn(),
        findAllAuditLogs: jest.fn(),
        lockVersion: jest.fn(),
        unlockVersion: jest.fn(),
        incrementInstallCount: jest.fn(),
        findPendingReview: jest.fn(),
      };
      const service = new SkillService(mockRepo as any);
      expect(service).toBeDefined();
    });
  });

  describe('SkillServiceError', () => {
    it('should create error with message', async () => {
      const { SkillServiceError } = await import('../index');
      const error = new SkillServiceError('test error');
      expect(error.message).toBe('test error');
      expect(error.name).toBe('SkillServiceError');
    });
  });

  describe('type exports (compile-time verification)', () => {
    it('should have SkillRepository with all CRUD methods', async () => {
      const { SkillRepository } = await import('../index');
      const mockPool = { query: jest.fn() };
      const repo = new SkillRepository(mockPool as any);

      // Verify key methods exist
      const methods = [
        'findById', 'findByName', 'findAll', 'count', 'create', 'update', 'delete',
        'incrementInstallCount', 'findVersions', 'findLatestVersion', 'createVersion',
        'findReviews', 'createReview', 'createInstance', 'findInstanceById',
        'findInstanceByIdAndTenant', 'findInstancesBySkillId', 'findInstancesByTenant',
        'updateInstance', 'deleteInstance', 'lockVersion', 'unlockVersion', 'search',
        'getCategories', 'createExecution', 'updateExecution', 'findExecutionById',
        'findExecutionsBySkill', 'findExecutionsByTenant', 'createAuditLog',
        'findAuditLogs', 'findAllAuditLogs', 'findPendingReview',
      ];

      for (const method of methods) {
        expect(typeof (repo as any)[method]).toBe('function');
      }
    });
  });
});
