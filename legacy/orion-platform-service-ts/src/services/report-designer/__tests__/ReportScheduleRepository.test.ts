/**
 * ReportScheduleRepository Tests
 * Covers listByReport, getById, create, updateById, deleteById, getActiveSchedules, mapRowToEntity
 */
import { ReportScheduleRepository } from '../ReportScheduleRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ReportScheduleRepository;

const snakeRow = {
  id: 'sch-1',
  tenant_id: 'test-tenant',
  report_id: 'rpt-1',
  cron_expression: '0 9 * * 1',
  export_format: 'pdf',
  recipients: [{ email: 'a@b.com' }],
  enabled: true,
  last_run_at: new Date('2026-01-01'),
  next_run_at: new Date('2026-01-08'),
  created_at: new Date('2026-01-01'),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ReportScheduleRepository({ query: mockQuery });
});

describe('ReportScheduleRepository', () => {
  describe('listByReport', () => {
    it('should query by tenant and report_id', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.listByReport('rpt-1');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1 AND report_id = $2'),
        ['test-tenant', 'rpt-1'],
      );
    });
  });

  describe('getById', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('sch-1');
      expect(result?.cronExpression).toBe('0 9 * * 1');
      expect(result?.recipients).toEqual([{ email: 'a@b.com' }]);
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.getById('missing')).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should serialize recipients as JSON', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      await repo.create({
        reportId: 'rpt-1',
        cronExpression: '0 9 * * 1',
        exportFormat: 'pdf',
        recipients: [{ email: 'a@b.com' }],
        enabled: true,
      });
      const params = mockQuery.mock.calls[0][1];
      expect(params[4]).toBe(JSON.stringify([{ email: 'a@b.com' }]));
    });
  });

  describe('updateById', () => {
    it('should build dynamic SET clauses', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      await repo.updateById('sch-1', { cronExpression: '0 10 * * *', enabled: false });
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('cron_expression = $1');
      expect(sql).toContain('enabled = $2');
    });

    it('should throw when no fields provided', async () => {
      await expect(repo.updateById('sch-1', {})).rejects.toThrow('No fields to update');
    });

    it('should throw when row not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(repo.updateById('sch-1', { cronExpression: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteById', () => {
    it('should return true on success', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      expect(await repo.deleteById('sch-1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      expect(await repo.deleteById('missing')).toBe(false);
    });
  });

  describe('getActiveSchedules', () => {
    it('should query enabled schedules ordered by next_run_at', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.getActiveSchedules();
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
        ['test-tenant'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should map all snake_case fields', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRow], rowCount: 1 });
      const result = await repo.getById('sch-1');
      expect(result?.reportId).toBe('rpt-1');
      expect(result?.lastRunAt).toEqual(new Date('2026-01-01'));
      expect(result?.nextRunAt).toEqual(new Date('2026-01-08'));
    });
  });
});
