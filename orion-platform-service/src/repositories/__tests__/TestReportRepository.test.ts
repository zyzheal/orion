/**
 * TestReportRepository Tests
 */
import { PostgresTestReportRepository } from '../TestReportRepository';

const mockQuery = jest.fn();

describe('PostgresTestReportRepository', () => {
  let repo: PostgresTestReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresTestReportRepository({ query: mockQuery } as any);
  });

  it('should createReport', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createReport('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findReports', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findReports('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getReportById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getReportById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createCase', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createCase('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createCases', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createCases('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getCasesByReportId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getCasesByReportId('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getReportsByRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getReportsByRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
