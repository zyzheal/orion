import { AgentProfileRepository, AgentProfileEntity } from '../AgentProfileRepository';

describe('AgentProfileRepository', () => {
  let repo: AgentProfileRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AgentProfileRepository(mockDb);
  });

  test('should create agent profile', async () => {
    const mockRow = {
      id: 'agent-1',
      name: 'Code Review Agent',
      type: 'review',
      capabilities: { languages: ['typescript', 'python'] },
      config: { max_files: 50 },
      status: 'active',
      last_active_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ name: 'Code Review Agent', type: 'review' } as any);
    expect(result.name).toBe('Code Review Agent');
    expect(result.type).toBe('review');
  });

  test('should find by type', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'a1', name: 'Agent 1', type: 'review', capabilities: {}, config: {}, status: 'active', last_active_at: null, created_at: new Date(), updated_at: new Date() },
        { id: 'a2', name: 'Agent 2', type: 'review', capabilities: {}, config: {}, status: 'inactive', last_active_at: null, created_at: new Date(), updated_at: new Date() },
      ],
    });
    const result = await repo.findByType('review');
    expect(result.length).toBe(2);
    expect(result[0].type).toBe('review');
  });

  test('should find active agents', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'a1', name: 'Active Agent', type: 'test', capabilities: {}, config: {}, status: 'active', last_active_at: new Date(), created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findActive();
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('active');
  });

  test('should update capabilities', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.updateCapabilities('agent-1', { new_cap: true });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agent_profiles'),
      expect.arrayContaining([expect.any(String), 'agent-1']),
    );
  });
});