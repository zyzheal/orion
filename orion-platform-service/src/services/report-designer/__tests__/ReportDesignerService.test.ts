/**
 * ReportDesignerService Tests
 * Covers CRUD, validation, execution, and error handling
 */
import { ReportDesignerService } from '../ReportDesignerService';
import { OrionError } from '../../../errors';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockDefRepo = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  getByCategory: jest.fn(),
};

const mockDsRepo = {
  list: jest.fn(),
  create: jest.fn(),
  getById: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
};

const mockScheduleRepo = {
  listByReport: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  getActiveSchedules: jest.fn(),
};

const mockExecRepo = {
  listByReport: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
};

let service: ReportDesignerService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new ReportDesignerService(
    mockDefRepo as any,
    mockDsRepo as any,
    mockScheduleRepo as any,
    mockExecRepo as any,
  );
});

const mockReport = {
  id: 'rpt-1',
  tenantId: 'test-tenant',
  name: 'Sales Report',
  description: 'Monthly sales',
  category: 'sales',
  layout: {},
  components: [],
  datasourceBindings: null,
  templateId: null,
  enabled: true,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ReportDesignerService', () => {
  // ==================== Report Definitions ====================
  describe('listReports', () => {
    it('should delegate to definitionRepo.list', async () => {
      mockDefRepo.list.mockResolvedValue({ entities: [mockReport], total: 1 });
      const result = await service.listReports({ category: 'sales' });
      expect(result.entities).toHaveLength(1);
      expect(mockDefRepo.list).toHaveBeenCalledWith({ category: 'sales' });
    });
  });

  describe('getReport', () => {
    it('should return report when found', async () => {
      mockDefRepo.getById.mockResolvedValue(mockReport);
      const result = await service.getReport('rpt-1');
      expect(result.id).toBe('rpt-1');
    });

    it('should throw NOT_FOUND when report missing', async () => {
      mockDefRepo.getById.mockResolvedValue(undefined);
      await expect(service.getReport('missing')).rejects.toThrow(OrionError);
    });
  });

  describe('createReport', () => {
    it('should create with defaults when optional fields omitted', async () => {
      mockDefRepo.create.mockResolvedValue(mockReport);
      const result = await service.createReport({ name: 'Sales Report' });
      expect(mockDefRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Sales Report',
        description: null,
        category: null,
        layout: {},
        components: [],
        enabled: true,
      }));
    });

    it('should throw VALIDATION_ERROR when name is empty', async () => {
      await expect(service.createReport({ name: '' })).rejects.toThrow('Report name is required');
    });
  });

  describe('updateReport', () => {
    it('should verify existence then update', async () => {
      mockDefRepo.getById.mockResolvedValue(mockReport);
      mockDefRepo.updateById.mockResolvedValue({ ...mockReport, name: 'Updated' });
      const result = await service.updateReport('rpt-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw when report not found', async () => {
      mockDefRepo.getById.mockResolvedValue(undefined);
      await expect(service.updateReport('missing', { name: 'x' })).rejects.toThrow(OrionError);
    });
  });

  describe('deleteReport', () => {
    it('should delete successfully', async () => {
      mockDefRepo.deleteById.mockResolvedValue(true);
      await expect(service.deleteReport('rpt-1')).resolves.toBeUndefined();
    });

    it('should throw when delete returns false', async () => {
      mockDefRepo.deleteById.mockResolvedValue(false);
      await expect(service.deleteReport('missing')).rejects.toThrow(OrionError);
    });
  });

  describe('previewReport', () => {
    it('should return report and params', async () => {
      mockDefRepo.getById.mockResolvedValue(mockReport);
      const result = await service.previewReport('rpt-1', { dateRange: '30d' });
      expect(result.report.id).toBe('rpt-1');
      expect(result.previewParams).toEqual({ dateRange: '30d' });
    });
  });

  describe('executeReport', () => {
    it('should create execution record', async () => {
      mockDefRepo.getById.mockResolvedValue(mockReport);
      mockExecRepo.create.mockResolvedValue({ id: 'exec-1', status: 'running' });
      const result = await service.executeReport('rpt-1', { exportFormat: 'pdf' }, 'user-1');
      expect(result.id).toBe('exec-1');
      expect(mockExecRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        reportId: 'rpt-1',
        exportFormat: 'pdf',
        status: 'running',
        triggeredBy: 'user-1',
      }));
    });
  });

  // ==================== Datasources ====================
  describe('createDatasource', () => {
    it('should validate required fields', async () => {
      await expect(service.createDatasource({ name: '', datasourceType: '', config: {} })).rejects.toThrow('required');
    });

    it('should create datasource', async () => {
      mockDsRepo.create.mockResolvedValue({ id: 'ds-1', name: 'PG' });
      const result = await service.createDatasource({ name: 'PG', datasourceType: 'postgresql', config: { host: 'localhost' } });
      expect(result.name).toBe('PG');
    });
  });

  describe('updateDatasource', () => {
    it('should throw when datasource not found', async () => {
      mockDsRepo.getById.mockResolvedValue(undefined);
      await expect(service.updateDatasource('missing', { name: 'x' })).rejects.toThrow(OrionError);
    });
  });

  describe('deleteDatasource', () => {
    it('should throw when delete returns false', async () => {
      mockDsRepo.deleteById.mockResolvedValue(false);
      await expect(service.deleteDatasource('missing')).rejects.toThrow(OrionError);
    });
  });

  // ==================== Schedules ====================
  describe('createSchedule', () => {
    it('should validate required fields', async () => {
      await expect(service.createSchedule({ reportId: '', cronExpression: '', exportFormat: '' })).rejects.toThrow('required');
    });

    it('should verify report exists before creating schedule', async () => {
      mockDefRepo.getById.mockResolvedValue(mockReport);
      mockScheduleRepo.create.mockResolvedValue({ id: 'sch-1' });
      const result = await service.createSchedule({ reportId: 'rpt-1', cronExpression: '0 * * * *', exportFormat: 'pdf' });
      expect(result.id).toBe('sch-1');
    });
  });

  describe('deleteSchedule', () => {
    it('should throw when delete returns false', async () => {
      mockScheduleRepo.deleteById.mockResolvedValue(false);
      await expect(service.deleteSchedule('missing')).rejects.toThrow(OrionError);
    });
  });

  // ==================== Execution History ====================
  describe('getExecutionHistory', () => {
    it('should delegate to executionRepo', async () => {
      mockExecRepo.listByReport.mockResolvedValue([{ id: 'exec-1' }]);
      const result = await service.getExecutionHistory('rpt-1', 10);
      expect(result).toHaveLength(1);
      expect(mockExecRepo.listByReport).toHaveBeenCalledWith('rpt-1', 10);
    });
  });
});
