import { ArtifactPromotionRepository } from '../ArtifactPromotionRepository';

describe('ArtifactPromotionRepository', () => {
  let repo: ArtifactPromotionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ArtifactPromotionRepository(mockDb);
  });

  test('should create promotion', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'promo-1', artifact_id: 'artifact-1', from_env: 'development', to_env: 'testing', status: 'pending', promoted_by: 'user-1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
    });
    const result = await repo.create({ artifactId: 'artifact-1', fromEnv: 'development', toEnv: 'testing', status: 'pending', promotedBy: 'user-1', createdAt: new Date() });
    expect(result.artifactId).toBe('artifact-1');
    expect(result.fromEnv).toBe('development');
    expect(result.toEnv).toBe('testing');
  });

  test('should find by artifact', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'promo-1', artifact_id: 'artifact-1', from_env: 'development', to_env: 'testing', status: 'completed', promoted_by: 'u1', approved_by: 'u2', approved_at: new Date(), reason: null, created_at: new Date() },
        { id: 'promo-2', artifact_id: 'artifact-1', from_env: 'testing', to_env: 'staging', status: 'pending', promoted_by: 'u1', approved_by: null, approved_at: null, reason: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByArtifact('artifact-1');
    expect(result.length).toBe(2);
    expect(result[0].fromEnv).toBe('development');
    expect(result[1].toEnv).toBe('staging');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'promo-1', artifact_id: 'a1', from_env: 'dev', to_env: 'test', status: 'pending', promoted_by: 'u1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
    });
    const result = await repo.findByStatus('pending');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('pending');
  });

  test('should find by environment', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'promo-1', artifact_id: 'a1', from_env: 'development', to_env: 'staging', status: 'completed', promoted_by: 'u1', approved_by: null, approved_at: null, reason: null, created_at: new Date() },
        { id: 'promo-2', artifact_id: 'a2', from_env: 'testing', to_env: 'staging', status: 'pending', promoted_by: 'u1', approved_by: null, approved_at: null, reason: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByEnvironment('staging');
    expect(result.length).toBe(2);
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'promo-1', artifact_id: 'a1', from_env: 'dev', to_env: 'test', status: 'completed', promoted_by: 'u1', approved_by: null, approved_at: null, reason: null, created_at: new Date() }],
    });
    const result = await repo.updateStatus('promo-1', 'completed');
    expect(result?.status).toBe('completed');
  });

  test('should approve promotion', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'promo-1', artifact_id: 'a1', from_env: 'dev', to_env: 'test', status: 'approved', promoted_by: 'u1', approved_by: 'approver-1', approved_at: new Date(), reason: null, created_at: new Date() }],
    });
    const result = await repo.approve('promo-1', 'approver-1');
    expect(result?.approvedBy).toBe('approver-1');
    expect(result?.approvedAt).toBeDefined();
    expect(result?.status).toBe('approved');
  });
});