/**
 * SkillRepository 单元测试
 */

import { SkillRepository, SkillEntity } from '../SkillRepository';

describe('SkillRepository', () => {
  let repo: SkillRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SkillRepository(mockDb);
  });

  test('should find skill by name', async () => {
    const mockRow = {
      id: 'skill-1', name: 'deploy-app', description: 'Deploy application',
      category: 'deployment', commands: { run: 'kubectl apply -f deploy.yaml' },
      enabled: true, created_at: new Date(), updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.findByName('deploy-app');
    expect(result?.name).toBe('deploy-app');
    expect(result?.category).toBe('deployment');
  });

  test('should find skills by category', async () => {
    const mockRows = [
      { id: 'skill-1', name: 'deploy-app', description: 'Deploy', category: 'deployment', commands: {}, enabled: true, created_at: new Date(), updated_at: new Date() },
      { id: 'skill-2', name: 'rollback-app', description: 'Rollback', category: 'deployment', commands: {}, enabled: true, created_at: new Date(), updated_at: new Date() }
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });
    const result = await repo.findByCategory('deployment');
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('deployment');
  });

  test('should find enabled skills', async () => {
    const mockRows = [
      { id: 'skill-1', name: 'deploy-app', description: 'Deploy', category: 'deployment', commands: {}, enabled: true, created_at: new Date(), updated_at: new Date() }
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });
    const result = await repo.findEnabled();
    expect(result).toHaveLength(1);
    expect(result[0].enabled).toBe(true);
  });

  test('should set enabled status', async () => {
    const mockRow = {
      id: 'skill-1', name: 'deploy-app', description: 'Deploy',
      category: 'deployment', commands: {}, enabled: false, created_at: new Date(), updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.setEnabled('skill-1', false);
    expect(result.enabled).toBe(false);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE skills SET enabled'),
      [false, 'skill-1']
    );
  });
});