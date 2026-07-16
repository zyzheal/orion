/**
 * Tests for ProblemService
 *
 * Mode B: Mock Repository objects, verify business logic,
 * status transitions, linking, and KEDB operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProblemService } from '../ProblemService';
import { OrionError } from '../../../errors';

// Mock repositories
const mockProblemRepo = {
  create: jest.fn<any>(),
  findByIdAndTenant: jest.fn<any>(),
  findByTenant: jest.fn<any>(),
  update: jest.fn<any>(),
  delete: jest.fn<any>(),
  updateStatus: jest.fn<any>(),
  addIncident: jest.fn<any>(),
  addChange: jest.fn<any>(),
  getStats: jest.fn<any>(),
};

const mockKnownErrorRepo = {
  create: jest.fn<any>(),
  findByIdAndTenant: jest.fn<any>(),
  findByTenant: jest.fn<any>(),
  update: jest.fn<any>(),
  delete: jest.fn<any>(),
  search: jest.fn<any>(),
  findByKeywords: jest.fn<any>(),
};

// Mock the repository constructors
jest.mock('../../../repositories/ProblemRepository', () => ({
  ProblemRepository: jest.fn(() => mockProblemRepo),
  KnownErrorRepository: jest.fn(() => mockKnownErrorRepo),
}));

const TENANT = 'tenant-1';

const mockProblem = (overrides: Record<string, any> = {}) => ({
  id: 'prob-1',
  tenantId: TENANT,
  title: 'Database connection pool exhaustion',
  description: 'DB pool exhausted during peak hours',
  status: 'known',
  severity: 'high',
  category: 'infrastructure',
  rootCause: null,
  workaround: null,
  resolution: null,
  relatedIncidents: [],
  relatedChanges: [],
  assignedTo: 'user-1',
  createdBy: 'user-2',
  resolvedAt: null,
  closedAt: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockKnownError = (overrides: Record<string, any> = {}) => ({
  id: 'ke-1',
  tenantId: TENANT,
  problemId: 'prob-1',
  title: 'Connection pool exhaustion workaround',
  symptoms: 'HTTP 503 errors',
  rootCause: 'ORM connection leak',
  workaround: 'Restart daily',
  permanentFix: null,
  status: 'active',
  affectedServices: ['api-gateway'],
  keywords: ['database', 'connection'],
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ProblemService', () => {
  let service: ProblemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProblemService({} as any);
    service.init();
  });

  // ==================== init ====================

  describe('init', () => {
    it('should initialize repositories when db is provided', () => {
      const svc = new ProblemService({} as any);
      svc.init();
      // Service should be initialized (no throw on construction)
      expect(svc).toBeDefined();
    });

    it('should run in degraded mode when no db provided', async () => {
      const svc = new ProblemService();
      svc.init();
      await expect(svc.getProblem('x', TENANT)).rejects.toThrow('Database not available');
    });
  });

  // ==================== createProblem ====================

  describe('createProblem', () => {
    it('should create a problem with defaults', async () => {
      mockProblemRepo.create.mockResolvedValueOnce(mockProblem());

      const result = await service.createProblem({ title: 'Test Problem' }, TENANT);

      expect(result.id).toBe('prob-1');
      expect(mockProblemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          title: 'Test Problem',
          description: null,
          status: 'known',
          severity: 'medium',
          category: null,
          assignedTo: null,
          createdBy: null,
          relatedIncidents: [],
          relatedChanges: [],
          metadata: {},
        })
      );
    });

    it('should create a problem with all fields', async () => {
      mockProblemRepo.create.mockResolvedValueOnce(mockProblem());

      await service.createProblem({
        title: 'Full Problem',
        description: 'Detailed description',
        severity: 'critical',
        category: 'database',
        assignedTo: 'user-3',
        createdBy: 'user-4',
        metadata: { priority: 1 },
      }, TENANT);

      expect(mockProblemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Full Problem',
          description: 'Detailed description',
          severity: 'critical',
          category: 'database',
          assignedTo: 'user-3',
          createdBy: 'user-4',
          metadata: { priority: 1 },
        })
      );
    });

    it('should throw when title is empty', async () => {
      await expect(service.createProblem({ title: '' }, TENANT)).rejects.toThrow(OrionError);
    });

    it('should throw when database not available', async () => {
      const svc = new ProblemService();
      svc.init();
      await expect(svc.createProblem({ title: 'Test' }, TENANT)).rejects.toThrow('Database not available');
    });
  });

  // ==================== getProblem ====================

  describe('getProblem', () => {
    it('should return problem when found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem());

      const result = await service.getProblem('prob-1', TENANT);

      expect(result.id).toBe('prob-1');
      expect(mockProblemRepo.findByIdAndTenant).toHaveBeenCalledWith('prob-1', TENANT);
    });

    it('should throw when not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.getProblem('prob-x', TENANT)).rejects.toThrow('Problem not found');
    });
  });

  // ==================== listProblems ====================

  describe('listProblems', () => {
    it('should return problems with total', async () => {
      mockProblemRepo.findByTenant.mockResolvedValueOnce({
        entities: [mockProblem(), mockProblem({ id: 'prob-2' })],
        total: 2,
      });

      const result = await service.listProblems(TENANT);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should pass filters to repository', async () => {
      mockProblemRepo.findByTenant.mockResolvedValueOnce({ entities: [], total: 0 });

      await service.listProblems(TENANT, { status: 'open', severity: 'high', limit: 10, offset: 5 });

      expect(mockProblemRepo.findByTenant).toHaveBeenCalledWith(TENANT, {
        status: 'open',
        severity: 'high',
        limit: 10,
        offset: 5,
      });
    });
  });

  // ==================== updateProblem ====================

  describe('updateProblem', () => {
    it('should update only provided fields', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem());
      mockProblemRepo.update.mockResolvedValueOnce(mockProblem({ title: 'Updated' }));

      const result = await service.updateProblem('prob-1', { title: 'Updated' }, TENANT);

      expect(result.title).toBe('Updated');
      expect(mockProblemRepo.update).toHaveBeenCalledWith('prob-1', { title: 'Updated' });
    });

    it('should return existing when no fields changed', async () => {
      const existing = mockProblem();
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(existing);

      const result = await service.updateProblem('prob-1', {}, TENANT);

      expect(result).toEqual(existing);
      expect(mockProblemRepo.update).not.toHaveBeenCalled();
    });

    it('should throw when problem not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateProblem('prob-x', { title: 'x' }, TENANT)).rejects.toThrow('Problem not found');
    });
  });

  // ==================== deleteProblem ====================

  describe('deleteProblem', () => {
    it('should delete and return true', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem());
      mockProblemRepo.delete.mockResolvedValueOnce(true);

      const result = await service.deleteProblem('prob-1', TENANT);

      expect(result).toBe(true);
      expect(mockProblemRepo.delete).toHaveBeenCalledWith('prob-1');
    });

    it('should throw when not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.deleteProblem('prob-x', TENANT)).rejects.toThrow('Problem not found');
    });
  });

  // ==================== updateStatus ====================

  describe('updateStatus', () => {
    it('should allow known -> investigating', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'known' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(mockProblem({ status: 'investigating' }));

      const result = await service.updateStatus('prob-1', 'investigating', TENANT);

      expect(result.status).toBe('investigating');
    });

    it('should allow investigating -> resolved', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'investigating' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(mockProblem({ status: 'resolved' }));

      const result = await service.updateStatus('prob-1', 'resolved', TENANT);

      expect(result.status).toBe('resolved');
    });

    it('should allow investigating -> known', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'investigating' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(mockProblem({ status: 'known' }));

      const result = await service.updateStatus('prob-1', 'known', TENANT);

      expect(result.status).toBe('known');
    });

    it('should allow resolved -> closed', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'resolved' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(mockProblem({ status: 'closed' }));

      const result = await service.updateStatus('prob-1', 'closed', TENANT);

      expect(result.status).toBe('closed');
    });

    it('should allow resolved -> investigating (reopen)', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'resolved' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(mockProblem({ status: 'investigating' }));

      const result = await service.updateStatus('prob-1', 'investigating', TENANT);

      expect(result.status).toBe('investigating');
    });

    it('should reject known -> resolved (invalid)', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'known' }));

      await expect(service.updateStatus('prob-1', 'resolved', TENANT)).rejects.toThrow('Invalid status transition');
    });

    it('should reject closed -> anything', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'closed' }));

      await expect(service.updateStatus('prob-1', 'investigating', TENANT)).rejects.toThrow('Invalid status transition');
    });

    it('should reject unknown target status', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'known' }));

      await expect(service.updateStatus('prob-1', 'invalid', TENANT)).rejects.toThrow('Invalid status transition');
    });

    it('should throw when problem not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateStatus('prob-x', 'investigating', TENANT)).rejects.toThrow('Problem not found');
    });

    it('should throw when repo returns null', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ status: 'known' }));
      mockProblemRepo.updateStatus.mockResolvedValueOnce(null);

      await expect(service.updateStatus('prob-1', 'investigating', TENANT)).rejects.toThrow('Failed to update problem status');
    });
  });

  // ==================== linkIncident ====================

  describe('linkIncident', () => {
    it('should link incident to problem', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ relatedIncidents: [] }));
      mockProblemRepo.addIncident.mockResolvedValueOnce(mockProblem({ relatedIncidents: ['inc-1'] }));

      const result = await service.linkIncident('prob-1', 'inc-1', TENANT);

      expect(result.relatedIncidents).toContain('inc-1');
      expect(mockProblemRepo.addIncident).toHaveBeenCalledWith('prob-1', 'inc-1', TENANT);
    });

    it('should skip if already linked', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ relatedIncidents: ['inc-1'] }));

      const result = await service.linkIncident('prob-1', 'inc-1', TENANT);

      expect(result.relatedIncidents).toContain('inc-1');
      expect(mockProblemRepo.addIncident).not.toHaveBeenCalled();
    });

    it('should throw when problem not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.linkIncident('prob-x', 'inc-1', TENANT)).rejects.toThrow('Problem not found');
    });

    it('should throw when repo returns null', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ relatedIncidents: [] }));
      mockProblemRepo.addIncident.mockResolvedValueOnce(null);

      await expect(service.linkIncident('prob-1', 'inc-1', TENANT)).rejects.toThrow('Failed to link incident');
    });
  });

  // ==================== linkChange ====================

  describe('linkChange', () => {
    it('should link change to problem', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ relatedChanges: [] }));
      mockProblemRepo.addChange.mockResolvedValueOnce(mockProblem({ relatedChanges: ['chg-1'] }));

      const result = await service.linkChange('prob-1', 'chg-1', TENANT);

      expect(result.relatedChanges).toContain('chg-1');
    });

    it('should skip if already linked', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem({ relatedChanges: ['chg-1'] }));

      const result = await service.linkChange('prob-1', 'chg-1', TENANT);

      expect(mockProblemRepo.addChange).not.toHaveBeenCalled();
    });

    it('should throw when problem not found', async () => {
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.linkChange('prob-x', 'chg-1', TENANT)).rejects.toThrow('Problem not found');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats from repository', async () => {
      mockProblemRepo.getStats.mockResolvedValueOnce({
        total: 10,
        byStatus: { open: 5, closed: 5 },
        bySeverity: { high: 3, medium: 7 },
      });

      const result = await service.getStats(TENANT);

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual({ open: 5, closed: 5 });
    });
  });

  // ==================== createKnownError ====================

  describe('createKnownError', () => {
    it('should create known error with required fields', async () => {
      mockKnownErrorRepo.create.mockResolvedValueOnce(mockKnownError());

      const result = await service.createKnownError({
        title: 'KE Title',
        symptoms: 'Symptom A',
        rootCause: 'Cause B',
        workaround: 'Fix C',
      }, TENANT);

      expect(result.id).toBe('ke-1');
      expect(mockKnownErrorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          title: 'KE Title',
          symptoms: 'Symptom A',
          rootCause: 'Cause B',
          workaround: 'Fix C',
          status: 'active',
          affectedServices: [],
          keywords: [],
          problemId: null,
          permanentFix: null,
          createdBy: null,
        })
      );
    });

    it('should throw when title is missing', async () => {
      await expect(service.createKnownError({
        title: '',
        symptoms: 'S',
        rootCause: 'R',
        workaround: 'W',
      }, TENANT)).rejects.toThrow(OrionError);
    });

    it('should throw when symptoms is missing', async () => {
      await expect(service.createKnownError({
        title: 'T',
        symptoms: '',
        rootCause: 'R',
        workaround: 'W',
      }, TENANT)).rejects.toThrow(OrionError);
    });
  });

  // ==================== getKnownError ====================

  describe('getKnownError', () => {
    it('should return known error when found', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(mockKnownError());

      const result = await service.getKnownError('ke-1', TENANT);

      expect(result.id).toBe('ke-1');
    });

    it('should throw when not found', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.getKnownError('ke-x', TENANT)).rejects.toThrow('Known error not found');
    });
  });

  // ==================== listKnownErrors ====================

  describe('listKnownErrors', () => {
    it('should return known errors with total', async () => {
      mockKnownErrorRepo.findByTenant.mockResolvedValueOnce({
        entities: [mockKnownError()],
        total: 1,
      });

      const result = await service.listKnownErrors(TENANT);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== updateKnownError ====================

  describe('updateKnownError', () => {
    it('should update provided fields', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(mockKnownError());
      mockKnownErrorRepo.update.mockResolvedValueOnce(mockKnownError({ title: 'Updated' }));

      const result = await service.updateKnownError('ke-1', { title: 'Updated' }, TENANT);

      expect(result.title).toBe('Updated');
      expect(mockKnownErrorRepo.update).toHaveBeenCalledWith('ke-1', { title: 'Updated' });
    });

    it('should return existing when no fields changed', async () => {
      const existing = mockKnownError();
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(existing);

      const result = await service.updateKnownError('ke-1', {}, TENANT);

      expect(result).toEqual(existing);
      expect(mockKnownErrorRepo.update).not.toHaveBeenCalled();
    });

    it('should throw when not found', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.updateKnownError('ke-x', { title: 'x' }, TENANT)).rejects.toThrow('Known error not found');
    });
  });

  // ==================== deleteKnownError ====================

  describe('deleteKnownError', () => {
    it('should delete and return true', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(mockKnownError());
      mockKnownErrorRepo.delete.mockResolvedValueOnce(true);

      const result = await service.deleteKnownError('ke-1', TENANT);

      expect(result).toBe(true);
    });

    it('should throw when not found', async () => {
      mockKnownErrorRepo.findByIdAndTenant.mockResolvedValueOnce(undefined);

      await expect(service.deleteKnownError('ke-x', TENANT)).rejects.toThrow('Known error not found');
    });
  });

  // ==================== searchKnownErrors ====================

  describe('searchKnownErrors', () => {
    it('should search with query', async () => {
      mockKnownErrorRepo.search.mockResolvedValueOnce([mockKnownError()]);

      const result = await service.searchKnownErrors('timeout', TENANT);

      expect(result).toHaveLength(1);
      expect(mockKnownErrorRepo.search).toHaveBeenCalledWith(TENANT, 'timeout');
    });

    it('should throw when query is empty', async () => {
      await expect(service.searchKnownErrors('', TENANT)).rejects.toThrow('Search query is required');
    });
  });

  // ==================== findByKeywords ====================

  describe('findByKeywords', () => {
    it('should search by keywords', async () => {
      mockKnownErrorRepo.findByKeywords.mockResolvedValueOnce([mockKnownError()]);

      const result = await service.findByKeywords(['database', 'connection'], TENANT);

      expect(result).toHaveLength(1);
      expect(mockKnownErrorRepo.findByKeywords).toHaveBeenCalledWith(TENANT, ['database', 'connection']);
    });

    it('should throw when keywords array is empty', async () => {
      await expect(service.findByKeywords([], TENANT)).rejects.toThrow('At least one keyword is required');
    });
  });

  // ==================== createFromIncident ====================

  describe('createFromIncident', () => {
    it('should auto-create problem and link incident', async () => {
      const created = mockProblem({ id: 'prob-auto', title: '[Auto] Incident Title', relatedIncidents: [] });
      mockProblemRepo.create.mockResolvedValueOnce(created);
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(created);
      mockProblemRepo.addIncident.mockResolvedValueOnce(mockProblem({ id: 'prob-auto', relatedIncidents: ['inc-1'] }));

      const result = await service.createFromIncident({
        title: 'Incident Title',
        incidentId: 'inc-1',
        tenantId: TENANT,
      });

      expect(result.id).toBe('prob-auto');
      expect(mockProblemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '[Auto] Incident Title',
          category: 'incident-derived',
        })
      );
      expect(mockProblemRepo.addIncident).toHaveBeenCalledWith('prob-auto', 'inc-1', TENANT);
    });

    it('should use incident description as fallback', async () => {
      mockProblemRepo.create.mockResolvedValueOnce(mockProblem());
      mockProblemRepo.findByIdAndTenant.mockResolvedValueOnce(mockProblem());
      mockProblemRepo.addIncident.mockResolvedValueOnce(mockProblem());

      await service.createFromIncident({
        title: 'Test',
        description: 'Custom description',
        severity: 'critical',
        incidentId: 'inc-1',
        tenantId: TENANT,
      });

      expect(mockProblemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Custom description',
          severity: 'critical',
        })
      );
    });
  });
});
