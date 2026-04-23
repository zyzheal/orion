import { BaseRepository } from '../base-repository';

interface TestEntity {
  id: string;
  name: string;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(db: any) {
    super(db, 'test_entities');
  }

  protected mapRowToEntity(row: any): TestEntity {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

describe('BaseRepository', () => {
  let repo: TestRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    repo = new TestRepository(mockDb);
  });

  test('findById should return entity when found', async () => {
    const mockRow = { id: '1', name: 'Test', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findById('1');
    expect(result).toEqual({
      id: '1',
      name: 'Test',
      status: 'active',
      created_at: mockRow.created_at,
      updated_at: mockRow.updated_at,
    });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['1']);
  });

  test('findById should return undefined when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findById('nonexistent');
    expect(result).toBeUndefined();
  });

  test('findAll should return entities with pagination', async () => {
    const mockRows = [
      { id: '1', name: 'Test 1', status: 'active', created_at: new Date(), updated_at: new Date() },
      { id: '2', name: 'Test 2', status: 'inactive', created_at: new Date(), updated_at: new Date() },
    ];
    mockDb.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });
    mockDb.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await repo.findAll({ limit: 10, offset: 0 });
    expect(result.entities).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  test('create should insert and return entity', async () => {
    const mockRow = { id: '1', name: 'New', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({ id: '1', name: 'New', status: 'active' });
    expect(result.id).toBe('1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.any(Array));
  });

  test('update should modify entity', async () => {
    const mockRow = { id: '1', name: 'Updated', status: 'active', created_at: new Date(), updated_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.update('1', { name: 'Updated', status: 'active' });
    expect(result.name).toBe('Updated');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  test('delete should remove entity', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 });

    const result = await repo.delete('1');
    expect(result).toBe(true);
  });

  test('delete should return false when not found', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 0 });

    const result = await repo.delete('nonexistent');
    expect(result).toBe(false);
  });
});
