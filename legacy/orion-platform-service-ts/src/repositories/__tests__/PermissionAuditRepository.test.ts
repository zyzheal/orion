import { PermissionAuditRepository } from '../PermissionAuditRepository';

describe('PermissionAuditRepository', () => {
  const mockQuery = jest.fn();
  let repo: PermissionAuditRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PermissionAuditRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should logDecision', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.logDecision({ subject: 'user-1', resource: 'res-1', action: 'read', decision: 'allow', reason: 'test' } as any);
    expect(mockQuery).toHaveBeenCalled();
  });
});
