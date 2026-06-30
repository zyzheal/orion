/**
 * ComplianceService Tests
 */
import { ComplianceService } from '../ComplianceService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockReportRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByFramework: jest.fn(),
  findByScheduleId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockScheduleRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findEnabled: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceService(mockReportRepo as any, mockScheduleRepo as any);
  });

  describe('createReport', () => {
    it('should create a report with draft status', async () => {
      mockReportRepo.create.mockResolvedValue({ id: 'r-1', name: 'SOC2 Audit', status: 'draft' });
      const result = await service.createReport({
        name: 'SOC2 Audit', framework: 'SOC2', triggeredBy: 'admin',
      });
      expect(result.id).toBe('r-1');
      expect(mockReportRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'test-tenant', status: 'draft', framework: 'SOC2',
      }));
    });
  });

  describe('getReport', () => {
    it('should return report when found', async () => {
      mockReportRepo.findById.mockResolvedValue({ id: 'r-1', name: 'Audit' });
      const result = await service.getReport('r-1');
      expect(result.id).toBe('r-1');
    });

    it('should throw when not found', async () => {
      mockReportRepo.findById.mockResolvedValue(null);
      await expect(service.getReport('missing')).rejects.toThrow('not found');
    });
  });

  describe('updateReport', () => {
    it('should update status and set timestamps', async () => {
      mockReportRepo.findById.mockResolvedValue({ id: 'r-1', startedAt: null });
      mockReportRepo.update.mockResolvedValue({ id: 'r-1', status: 'running' });
      const result = await service.updateReport('r-1', { status: 'running' });
      expect(result.status).toBe('running');
      expect(mockReportRepo.update).toHaveBeenCalledWith('r-1', expect.objectContaining({ startedAt: expect.any(Date) }));
    });

    it('should throw when not found', async () => {
      mockReportRepo.findById.mockResolvedValue(null);
      await expect(service.updateReport('missing', { name: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteReport', () => {
    it('should delete when found', async () => {
      mockReportRepo.findById.mockResolvedValue({ id: 'r-1' });
      await service.deleteReport('r-1');
      expect(mockReportRepo.delete).toHaveBeenCalledWith('r-1');
    });
  });

  describe('createSchedule', () => {
    it('should create a schedule', async () => {
      mockScheduleRepo.create.mockResolvedValue({ id: 's-1', name: 'Weekly', enabled: true });
      const result = await service.createSchedule({
        name: 'Weekly', framework: 'SOC2', cronExpression: '0 0 * * 0',
      });
      expect(result.id).toBe('s-1');
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule and associated reports', async () => {
      mockScheduleRepo.findById.mockResolvedValue({ id: 's-1' });
      mockReportRepo.findByScheduleId.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }]);
      await service.deleteSchedule('s-1');
      expect(mockReportRepo.delete).toHaveBeenCalledTimes(2);
      expect(mockScheduleRepo.delete).toHaveBeenCalledWith('s-1');
    });
  });
});
