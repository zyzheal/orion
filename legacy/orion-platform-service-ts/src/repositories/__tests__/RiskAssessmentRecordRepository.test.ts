/**
 * RiskAssessmentRecordRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RiskAssessmentRecordRepository } from '../RiskAssessmentRecordRepository';

const mockQuery = jest.fn();

describe('RiskAssessmentRecordRepository', () => {
  let repo: RiskAssessmentRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RiskAssessmentRecordRepository({ query: mockQuery } as any);
  });

  it('should findByTarget', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTarget('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
