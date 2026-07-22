/**
 * ReportExecutionRepository Tests
 * Covers listByReport, getById, create, mapRowToEntity
 */
import { ReportExecutionRepository } from '../ReportExecutionRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ReportExecutionRepository;

const snakeRow = {
  id: 'exec-1',
  tenant_id: 'test-tenant',
  report_id: 'rpt-1',
  schedule_id: null,
  export_format: 'pdf',
  status: 'completed',
  file_url: 'http://example.com/report.pdf',
  error: null,
  started_at: new Date('2026-01-01T10:00:00'),
  completed_at: new Date('2026-01-01T10:05:00'),
  duration_ms: 300000,
  triggered_by: 'manual',
  created_at: new Date('2026-01-01'),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ReportExecutionRepository({ query: mockQuery });
});

describe('ReportExecutionRepository', () => {
  describe('listByReport', () => {
    it('should query by tenant and report_id with default limit 20', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.listByReport('rpt-1');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1 AND report_id = $2'),
        ['test-tenant', 'rpt-1', 20],
      );
    });

    it('should accept custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.listByReport('rpt-1', 50);
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-tenant', 'rpt-1', 50]);
    });
  });

  describe('getById', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('exec-1');
      expect(result?.id).toBe('exec-1');
      expect(result?.reportId).toBe('rpt-1');
      expect(result?.exportFormat).toBe('pdf');
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.getById('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should insert with correct parameters', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.create({
        reportId: 'rpt-1',
        scheduleId: null,
        exportFormat: 'pdf',
        status: 'running',
        fileUrl: null,
        error: null,
        startedAt: new Date(),
        triggeredBy: 'manual',
      });
      expect(result.id).toBe('exec-1');
      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[1]).toBe('rpt-1');
    });
  });

  describe('mapRowToEntity', () => {
    it('should map all snake_case fields to camelCase', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('exec-1');
      expect(result?.scheduleId).toBeNull();
      expect(result?.fileUrl).toBe('http://example.com/report.pdf');
      expect(result?.startedAt).toEqual(new Date('2026-01-01T10:00:00'));
      expect(result?.completedAt).toEqual(new Date('2026-01-01T10:05:00'));
      expect(result?.durationMs).toBe(300000);
      expect(result?.triggeredBy).toBe('manual');
    });
  });
});
