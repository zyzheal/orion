import { createHash } from 'crypto';
import { AuditRepository } from '../AuditRepository';

describe('AuditRepository', () => {
  let repo: AuditRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AuditRepository(mockDb);
  });

  test('should create audit log entry', async () => {
    const mockRow = {
      id: 'audit-1', tenant_id: 'tenant-1', user_id: 'user-1', action: 'CREATE_PROJECT',
      resource_type: 'project', resource_id: 'proj-1',
      prev_hash: '0'.repeat(64), hash: 'abc123', request_body: null,
      response_code: 200, ip_address: '127.0.0.1', created_at: new Date(), sequence_number: 1,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      tenantId: 'tenant-1', userId: 'user-1', action: 'CREATE_PROJECT',
      resourceType: 'project', resourceId: 'proj-1',
      responseCode: 200, ipAddress: '127.0.0.1',
    });
    expect(result.id).toBe('audit-1');
    expect(result.sequenceNumber).toBe(1);
  });

  test('should get last entry for chain continuation', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'audit-last', hash: 'lasthash', sequence_number: 42 }] });
    const result = await repo.getLastEntry();
    expect(result?.hash).toBe('lasthash');
    expect(result?.sequenceNumber).toBe(42);
  });

  test('should return undefined when no entries exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.getLastEntry();
    expect(result).toBeUndefined();
  });

  test('should get entries by range', async () => {
    mockDb.query.mockResolvedValue({ rows: [
      { id: '1', sequence_number: 10, action: 'A', hash: 'h1', created_at: new Date() },
      { id: '2', sequence_number: 11, action: 'B', hash: 'h2', created_at: new Date() },
    ]});
    const results = await repo.getEntries({ startSequence: 10, endSequence: 15 });
    expect(results).toHaveLength(2);
  });

  test('should get next sequence number', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ max_seq: 42 }] });
    const result = await repo.getNextSequenceNumber();
    expect(result).toBe(43);
  });

  test('should verify chain integrity', async () => {
    const prevHash0 = '0'.repeat(64);
    const content1 = JSON.stringify({ id: '1', action: 'CREATE', resourceType: 'project', resourceId: 'p1', sequenceNumber: 1 });
    const hash1 = createHash('sha256').update(prevHash0 + content1).digest('hex');

    const content2 = JSON.stringify({ id: '2', action: 'UPDATE', resourceType: 'project', resourceId: 'p1', sequenceNumber: 2 });
    const hash2 = createHash('sha256').update(hash1 + content2).digest('hex');

    mockDb.query.mockResolvedValue({ rows: [
      { id: '1', sequence_number: 1, action: 'CREATE', resource_type: 'project', resource_id: 'p1', prev_hash: prevHash0, hash: hash1 },
      { id: '2', sequence_number: 2, action: 'UPDATE', resource_type: 'project', resource_id: 'p1', prev_hash: hash1, hash: hash2 },
    ]});
    const result = await repo.verifyChain({ startSequence: 1, endSequence: 2 });
    expect(result.valid).toBe(true);
    expect(result.verifiedCount).toBe(2);
  });
});
