/**
 * BackupVerificationRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { BackupVerificationRepository } from '../BackupVerificationRepository';

const mockQuery = jest.fn();

describe('BackupVerificationRepository', () => {
  let repo: BackupVerificationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BackupVerificationRepository({ query: mockQuery } as any);
  });

  it('should findByBackupId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByBackupId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateIntegrityCheck', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateIntegrityCheck('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateRestoreTest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateRestoreTest('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
