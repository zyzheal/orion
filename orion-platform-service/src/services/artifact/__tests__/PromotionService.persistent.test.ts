/**
 * Tests for PromotionService in persistent (DB-backed) mode
 * Covers: constructor with DB, isPersistent, promote with repository,
 * promoteWithApproval with repository, getCurrentStage with repository,
 * getHistory with repository, canPromote edge cases
 *
 * Task 2.38 update: getCurrentStage now returns DEVELOPMENT for new artifacts
 * instead of undefined. Error codes updated to OrionError codes.
 */

import { PromotionService, PromotionStage, PROMOTION_ORDER } from '../PromotionService';

function makeMockDb() {
  return {
    query: jest.fn(),
  };
}

describe('PromotionService (persistent mode)', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = makeMockDb();
  });

  // ==================== constructor & isPersistent ====================
  describe('constructor and isPersistent', () => {
    it('should be persistent when DB is provided', () => {
      const service = new PromotionService(mockDb as any);

      expect(service.isPersistent).toBe(true);
    });

    it('should NOT be persistent when DB is not provided', () => {
      const service = new PromotionService();

      expect(service.isPersistent).toBe(false);
    });
  });

  // ==================== getCurrentStage (persistent) ====================
  describe('getCurrentStage (persistent)', () => {
    it('should return DEVELOPMENT when no promotion records exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const service = new PromotionService(mockDb as any);

      const stage = await service.getCurrentStage('artifact-new');

      expect(stage).toBe(PromotionStage.DEVELOPMENT);
    });

    it('should return the latest toEnv from promotion records', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'p1', artifact_id: 'a1', from_env: 'development', to_env: 'testing', status: 'completed', promoted_by: 'user1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
        rowCount: 1,
      });
      const service = new PromotionService(mockDb as any);

      const stage = await service.getCurrentStage('a1');

      expect(stage).toBe(PromotionStage.TESTING);
    });

    it('should return RELEASED when latest record is to RELEASED', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'p5', artifact_id: 'a1', from_env: 'production', to_env: 'released', status: 'completed', promoted_by: 'user1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
        rowCount: 1,
      });
      const service = new PromotionService(mockDb as any);

      const stage = await service.getCurrentStage('a1');

      expect(stage).toBe(PromotionStage.RELEASED);
    });

    it('should return undefined when repository throws DB error', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection lost'));
      const service = new PromotionService(mockDb as any);

      const stage = await service.getCurrentStage('a1');

      // Graceful degradation: returns undefined instead of throwing
      expect(stage).toBeUndefined();
    });
  });

  // ==================== getCurrentStage (in-memory fallback) ====================
  describe('getCurrentStage (in-memory fallback)', () => {
    it('should return undefined for unknown artifact in memory mode', async () => {
      const service = new PromotionService();

      const stage = await service.getCurrentStage('unknown');

      expect(stage).toBeUndefined();
    });

    it('should return the set stage in memory mode', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.STAGING);

      const stage = await service.getCurrentStage('a1');

      expect(stage).toBe(PromotionStage.STAGING);
    });
  });

  // ==================== promote (persistent) ====================
  describe('promote (persistent)', () => {
    it('should promote from DEVELOPMENT to TESTING and persist to DB', async () => {
      // Mock sequence:
      // 1. getCurrentStage → findByArtifact returns empty (new artifact)
      // 2. storage.set calls persistToDbSilently → upsert
      // 3. promote → repository.create
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // findByArtifact
        .mockResolvedValueOnce({ rows: [{ id: 'upsert-1' }], rowCount: 1 }) // upsert (cache)
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }], rowCount: 1 }); // create

      const service = new PromotionService(mockDb as any);
      const record = await service.promote('a1', 'user1', 'Ready for testing');

      expect(record.fromStage).toBe(PromotionStage.DEVELOPMENT);
      expect(record.toStage).toBe(PromotionStage.TESTING);
      expect(record.promotedBy).toBe('user1');
      expect(record.reason).toBe('Ready for testing');
      expect(record.id).toMatch(/^promo_/);
    });

    it('should promote through all stages sequentially', async () => {
      const service = new PromotionService(mockDb as any);
      const stages = [
        PromotionStage.DEVELOPMENT,
        PromotionStage.TESTING,
        PromotionStage.STAGING,
        PromotionStage.PRODUCTION,
      ];

      for (let i = 0; i < stages.length; i++) {
        mockDb.query.mockReset();
        // getCurrentStage → findByArtifact returns current stage
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: `p${i}`, artifact_id: 'a1', from_env: stages[i], to_env: stages[i], status: 'completed', promoted_by: 'user1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
          rowCount: 1,
        });
        // storage.set → upsert
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: `upsert-${i}` }], rowCount: 1 });
        // create returns created row
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: `p${i + 1}` }], rowCount: 1 });

        const record = await service.promote('a1', 'user1');
        expect(record.fromStage).toBe(stages[i]);
        expect(record.toStage).toBe(PROMOTION_ORDER[i + 1]);
      }
    });

    it('should throw STATE_CONFLICT when already at RELEASED', async () => {
      // Pre-seed storage with RELEASED stage so getCurrentStage returns it
      const service = new PromotionService(mockDb as any);
      await service.setStage('a1', PromotionStage.RELEASED);

      await expect(service.promote('a1', 'user1')).rejects.toMatchObject({
        code: 'STATE_CONFLICT',
      });
    });

    it('should propagate DB errors during promote when getCurrentStage fails', async () => {
      mockDb.query.mockRejectedValue(new Error('DB write failed'));
      const service = new PromotionService(mockDb as any);

      // When getCurrentStage's repository call fails, it returns undefined
      // promote then throws BUSINESS_ERROR (Unknown stage: undefined)
      await expect(service.promote('a1', 'user1')).rejects.toMatchObject({
        code: 'BUSINESS_ERROR',
      });
    });
  });

  // ==================== promote (in-memory fallback) ====================
  describe('promote (in-memory fallback)', () => {
    it('should promote from DEVELOPMENT to TESTING in memory', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.DEVELOPMENT);

      const record = await service.promote('a1', 'user1');

      expect(record.fromStage).toBe(PromotionStage.DEVELOPMENT);
      expect(record.toStage).toBe(PromotionStage.TESTING);
      expect(await service.getCurrentStage('a1')).toBe(PromotionStage.TESTING);
    });

    it('should succeed for unknown artifact in memory mode (starts at DEVELOPMENT)', async () => {
      const service = new PromotionService();

      // New unknown artifact now starts at DEVELOPMENT (not undefined)
      const record = await service.promote('unknown-artifact', 'user1');

      expect(record.fromStage).toBe(PromotionStage.DEVELOPMENT);
      expect(record.toStage).toBe(PromotionStage.TESTING);
    });

    it('should throw STATE_CONFLICT when at RELEASED in memory mode', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.RELEASED);

      await expect(service.promote('a1', 'user1')).rejects.toMatchObject({
        code: 'STATE_CONFLICT',
      });
    });
  });

  // ==================== promoteWithApproval (persistent) ====================
  describe('promoteWithApproval (persistent)', () => {
    it('should promote and then approve in repository', async () => {
      // Mock sequence:
      // 1. getCurrentStage → findByArtifact returns empty
      // 2. storage.set → upsert (cache DEVELOPMENT)
      // 3. promote → repository.create
      // 4. promoteWithApproval → repository.approve
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // findByArtifact
        .mockResolvedValueOnce({ rows: [{ id: 'upsert-1' }], rowCount: 1 }) // upsert
        .mockResolvedValueOnce({ rows: [{ id: 'promo-uuid' }], rowCount: 1 }) // create
        .mockResolvedValueOnce({ rows: [{ id: 'promo-uuid', approved_by: 'manager1' }], rowCount: 1 }); // approve

      const service = new PromotionService(mockDb as any);
      const record = await service.promoteWithApproval('a1', 'user1', 'manager1', 'Approved for testing');

      expect(record.approvedBy).toBe('manager1');
      expect(record.approvedAt).toBeInstanceOf(Date);
    });

    it('should work in memory mode with approval', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.TESTING);

      const record = await service.promoteWithApproval('a1', 'user1', 'manager1', 'LGTM');

      expect(record.approvedBy).toBe('manager1');
      expect(record.approvedAt).toBeInstanceOf(Date);
      expect(record.toStage).toBe(PromotionStage.STAGING);
    });
  });

  // ==================== getHistory (persistent) ====================
  describe('getHistory (persistent)', () => {
    it('should map repository entities to PromotionRecord format', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'p2', artifact_id: 'a1', from_env: 'testing', to_env: 'staging', status: 'completed', promoted_by: 'user1', approved_by: 'mgr', approved_at: now, reason: 'good', created_at: now },
          { id: 'p1', artifact_id: 'a1', from_env: 'development', to_env: 'testing', status: 'completed', promoted_by: 'user1', approved_by: null, approved_at: null, reason: null, created_at: now },
        ],
        rowCount: 2,
      });
      const service = new PromotionService(mockDb as any);

      const history = await service.getHistory('a1');

      expect(history).toHaveLength(2);
      expect(history[0].fromStage).toBe(PromotionStage.TESTING);
      expect(history[0].toStage).toBe(PromotionStage.STAGING);
      expect(history[0].approvedBy).toBe('mgr');
      expect(history[1].approvedBy).toBeUndefined();
    });

    it('should return empty array when no history in DB', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const service = new PromotionService(mockDb as any);

      const history = await service.getHistory('a1');

      expect(history).toEqual([]);
    });

    it('should handle DB errors gracefully and return empty array', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));
      const service = new PromotionService(mockDb as any);

      const history = await service.getHistory('a1');

      // Graceful degradation: returns empty array on DB error
      expect(history).toEqual([]);
    });
  });

  // ==================== canPromote (edge cases) ====================
  describe('canPromote', () => {
    it('should allow promotion from DEVELOPMENT to TESTING', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.DEVELOPMENT);

      expect(await service.canPromote('a1', PromotionStage.TESTING)).toBe(true);
    });

    it('should reject skipping stages (DEVELOPMENT to STAGING)', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.DEVELOPMENT);

      expect(await service.canPromote('a1', PromotionStage.STAGING)).toBe(false);
    });

    it('should reject skipping stages (DEVELOPMENT to PRODUCTION)', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.DEVELOPMENT);

      expect(await service.canPromote('a1', PromotionStage.PRODUCTION)).toBe(false);
    });

    it('should allow promotion from TESTING to STAGING', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.TESTING);

      expect(await service.canPromote('a1', PromotionStage.STAGING)).toBe(true);
    });

    it('should allow promotion from STAGING to PRODUCTION', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.STAGING);

      expect(await service.canPromote('a1', PromotionStage.PRODUCTION)).toBe(true);
    });

    it('should allow promotion from PRODUCTION to RELEASED', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.PRODUCTION);

      expect(await service.canPromote('a1', PromotionStage.RELEASED)).toBe(true);
    });

    it('should reject backwards promotion (TESTING to DEVELOPMENT)', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.TESTING);

      expect(await service.canPromote('a1', PromotionStage.DEVELOPMENT)).toBe(false);
    });

    it('should allow DEVELOPMENT when current stage is undefined (new artifact)', async () => {
      const service = new PromotionService();

      // undefined current stage → canPromote returns toStage === DEVELOPMENT
      expect(await service.canPromote('unknown', PromotionStage.DEVELOPMENT)).toBe(true);
    });

    it('should reject non-DEVELOPMENT when current stage is undefined', async () => {
      const service = new PromotionService();

      expect(await service.canPromote('unknown', PromotionStage.TESTING)).toBe(false);
    });

    it('should work in persistent mode', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'p1', artifact_id: 'a1', from_env: 'development', to_env: 'testing', status: 'completed', promoted_by: 'user1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
        rowCount: 1,
      });
      const service = new PromotionService(mockDb as any);

      expect(await service.canPromote('a1', PromotionStage.STAGING)).toBe(true);
      expect(await service.canPromote('a1', PromotionStage.PRODUCTION)).toBe(false);
    });
  });

  // ==================== PROMOTION_ORDER ====================
  describe('PROMOTION_ORDER constant', () => {
    it('should have exactly 5 stages', () => {
      expect(PROMOTION_ORDER).toHaveLength(5);
    });

    it('should follow the correct order', () => {
      expect(PROMOTION_ORDER).toEqual([
        PromotionStage.DEVELOPMENT,
        PromotionStage.TESTING,
        PromotionStage.STAGING,
        PromotionStage.PRODUCTION,
        PromotionStage.RELEASED,
      ]);
    });
  });

  // ==================== PromotionStage enum ====================
  describe('PromotionStage enum', () => {
    it('should have correct string values', () => {
      expect(PromotionStage.DEVELOPMENT).toBe('development');
      expect(PromotionStage.TESTING).toBe('testing');
      expect(PromotionStage.STAGING).toBe('staging');
      expect(PromotionStage.PRODUCTION).toBe('production');
      expect(PromotionStage.RELEASED).toBe('released');
    });
  });

  // ==================== setStage deprecation ====================
  describe('setStage (deprecated)', () => {
    it('should set stage in fallback storage', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.STAGING);

      expect(await service.getCurrentStage('a1')).toBe(PromotionStage.STAGING);
    });

    it('should allow overwriting a previously set stage', async () => {
      const service = new PromotionService();
      await service.setStage('a1', PromotionStage.DEVELOPMENT);
      await service.setStage('a1', PromotionStage.PRODUCTION);

      expect(await service.getCurrentStage('a1')).toBe(PromotionStage.PRODUCTION);
    });
  });

  // ==================== start / stop lifecycle ====================
  describe('start / stop lifecycle', () => {
    it('should start and stop in in-memory mode without error', async () => {
      const service = new PromotionService();

      await expect(service.start()).resolves.toBeUndefined();
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('should start in persistent mode without error', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const service = new PromotionService(mockDb as any);

      await expect(service.start()).resolves.toBeUndefined();
    });
  });
});
