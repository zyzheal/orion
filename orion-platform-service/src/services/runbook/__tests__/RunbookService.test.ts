/**
 * RunbookService Tests
 */
import { RunbookService } from '../RunbookService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockDefRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByCategory: jest.fn(),
  findEnabled: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockExecRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByRunbookId: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
};

describe('RunbookService', () => {
  let service: RunbookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RunbookService(mockDefRepo as any, mockExecRepo as any);
  });

  describe('create', () => {
    it('should create a runbook definition', async () => {
      mockDefRepo.create.mockResolvedValue({ id: 'rb-1', name: 'Restart Pod' });
      const result = await service.create({
        name: 'Restart Pod', category: 'k8s', steps: [{ id: 's1', name: 'restart', action: 'kubectl' }],
      });
      expect(result.id).toBe('rb-1');
      expect(mockDefRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'test-tenant', enabled: true,
      }));
    });
  });

  describe('get', () => {
    it('should return runbook when found', async () => {
      mockDefRepo.findById.mockResolvedValue({ id: 'rb-1' });
      const result = await service.get('rb-1');
      expect(result.id).toBe('rb-1');
    });

    it('should throw when not found', async () => {
      mockDefRepo.findById.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toThrow('not found');
    });
  });

  describe('execute', () => {
    it('should create an execution for enabled runbook', async () => {
      mockDefRepo.findById.mockResolvedValue({ id: 'rb-1', enabled: true, steps: [{ id: 's1' }] });
      mockExecRepo.create.mockResolvedValue({ id: 'ex-1', status: 'pending' });

      const result = await service.execute({ runbookId: 'rb-1', triggeredBy: 'admin' });
      expect(result.id).toBe('ex-1');
      expect(mockExecRepo.create).toHaveBeenCalled();
    });

    it('should throw when runbook is disabled', async () => {
      mockDefRepo.findById.mockResolvedValue({ id: 'rb-1', enabled: false });
      await expect(service.execute({ runbookId: 'rb-1', triggeredBy: 'admin' })).rejects.toThrow('disabled');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a running execution', async () => {
      mockExecRepo.findById.mockResolvedValue({ id: 'ex-1', status: 'running' });
      mockExecRepo.updateStatus.mockResolvedValue({ id: 'ex-1', status: 'cancelled' });

      const result = await service.cancelExecution('ex-1');
      expect(result.status).toBe('cancelled');
    });

    it('should throw when execution is already completed', async () => {
      mockExecRepo.findById.mockResolvedValue({ id: 'ex-1', status: 'completed' });
      await expect(service.cancelExecution('ex-1')).rejects.toThrow('Cannot cancel');
    });
  });

  describe('delete', () => {
    it('should delete runbook and its executions', async () => {
      mockDefRepo.findById.mockResolvedValue({ id: 'rb-1' });
      await service.delete('rb-1');
      expect(mockExecRepo.delete).toHaveBeenCalledWith('rb-1');
      expect(mockDefRepo.delete).toHaveBeenCalledWith('rb-1');
    });
  });
});
