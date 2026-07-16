/**
 * SkillRepository 单元测试
 *
 * 测试数据库层操作：Skill CRUD、版本管理、评论、实例、执行记录、审计日志。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { SkillRepository } from '../SkillRepository';

describe('SkillRepository', () => {
  let repo: SkillRepository;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    repo = new SkillRepository(mockPool);
  });

  // ==================== findById / findByName ====================

  describe('findById', () => {
    it('should return skill when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', name: 'test-skill' }] });
      const result = await repo.findById('s1');
      expect(result).toEqual({ id: 's1', name: 'test-skill' });
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM skill_packages WHERE id = $1', ['s1']);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return skill by name', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', name: 'code-gen' }] });
      const result = await repo.findByName('code-gen');
      expect(result).toEqual({ id: 's1', name: 'code-gen' });
    });

    it('should return null when name not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findByName('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should return all skills without options', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }, { id: 's2' }] });
      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM skill_packages'),
        []
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', status: 'published' }] });
      const result = await repo.findAll({ status: 'published' });
      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['published']
      );
    });

    it('should filter by category', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ category: 'ai' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        ['ai']
      );
    });

    it('should filter by tags', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ tags: ['deploy', 'k8s'] });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tags && $1'),
        [['deploy', 'k8s']]
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ limit: 10, offset: 20 });
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toContain(10);
      expect(params).toContain(20);
    });

    it('should combine multiple filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ status: 'published', category: 'ai', limit: 5 });
      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('status = $1');
      expect(query).toContain('category = $2');
      expect(query).toContain('LIMIT');
    });
  });

  // ==================== count ====================

  describe('count', () => {
    it('should return total count', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }] });
      const result = await repo.count();
      expect(result).toBe(42);
    });

    it('should count with status filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });
      const result = await repo.count({ status: 'published' });
      expect(result).toBe(5);
    });

    it('should count with category filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });
      const result = await repo.count({ category: 'ai' });
      expect(result).toBe(3);
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a skill', async () => {
      const mockRow = { id: 's1', name: 'code-gen', status: 'draft' };
      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.create({
        name: 'code-gen',
        version: '1.0.0',
        description: 'Code generation skill',
        category: 'ai',
        author: 'test-user',
      });

      expect(result).toEqual(mockRow);
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO skill_packages');
      expect(sql).toContain("VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)");
    });

    it('should use default values for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      await repo.create({
        name: 'test',
        version: '1.0.0',
        description: 'desc',
        category: 'cat',
        author: 'author',
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[4]).toEqual([]); // tags default
      expect(params[6]).toEqual({}); // schema default
      expect(params[7]).toBeNull(); // capabilities default
    });

    it('should pass custom optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      await repo.create({
        name: 'test',
        version: '1.0.0',
        description: 'desc',
        category: 'cat',
        author: 'author',
        tags: ['ai', 'gen'],
        schema: { type: 'object' },
        capabilities: ['ai.code-gen'],
        schemas: { input: {} },
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[4]).toEqual(['ai', 'gen']);
      expect(params[6]).toEqual({ type: 'object' });
      expect(params[7]).toEqual(['ai.code-gen']);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update name field', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', name: 'new-name' }] });
      const result = await repo.update('s1', { name: 'new-name' });
      expect(result).not.toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('name = $1'),
        expect.arrayContaining(['new-name', 's1'])
      );
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      await repo.update('s1', { name: 'n', description: 'd', category: 'c', status: 'published' });
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('description = $2');
      expect(sql).toContain('category = $3');
      expect(sql).toContain('status = $4');
    });

    it('should update schema as JSON string', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      await repo.update('s1', { schema: { type: 'object' } });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('{"type":"object"}');
    });

    it('should update capabilities array', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
      await repo.update('s1', { capabilities: ['ai.code-gen'] });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toEqual(['ai.code-gen']);
    });

    it('should return existing skill when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', name: 'existing' }] });
      const result = await repo.update('s1', {});
      expect(result).toEqual({ id: 's1', name: 'existing' });
    });

    it('should return null when skill not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.update('missing', { name: 'test' });
      expect(result).toBeNull();
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should soft delete and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.delete('s1');
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'uninstalled'"),
        ['s1']
      );
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.delete('missing');
      expect(result).toBe(false);
    });
  });

  // ==================== incrementInstallCount ====================

  describe('incrementInstallCount', () => {
    it('should increment install count', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      await repo.incrementInstallCount('s1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('install_count = install_count + 1'),
        ['s1']
      );
    });
  });

  // ==================== Versions ====================

  describe('findVersions', () => {
    it('should return versions ordered by created_at DESC', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'v2' }, { id: 'v1' }] });
      const result = await repo.findVersions('s1');
      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['s1']
      );
    });
  });

  describe('findLatestVersion', () => {
    it('should return latest version', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'v1', is_latest: true }] });
      const result = await repo.findLatestVersion('s1');
      expect(result).not.toBeNull();
      expect(result!.is_latest).toBe(true);
    });

    it('should return null when no latest version', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findLatestVersion('s1');
      expect(result).toBeNull();
    });
  });

  describe('createVersion', () => {
    it('should create version and update package', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // clear latest
        .mockResolvedValueOnce({ rows: [{ id: 'v1', version: '1.0.0' }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // update package

      const result = await repo.createVersion({
        skill_id: 's1',
        version: '1.0.0',
        changelog: 'Initial release',
        schema: { type: 'object' },
      });

      expect(result).toEqual({ id: 'v1', version: '1.0.0' });
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should handle optional fields', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.createVersion({ skill_id: 's1', version: '1.0.0' });

      const params = mockPool.query.mock.calls[1][1];
      expect(params[2]).toBeNull(); // changelog
      expect(params[3]).toEqual({}); // schema
      expect(params[4]).toBeNull(); // schema_snapshot
    });
  });

  // ==================== Reviews ====================

  describe('findReviews', () => {
    it('should return reviews for a skill', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r1', rating: 5 }] });
      const result = await repo.findReviews('s1');
      expect(result).toHaveLength(1);
    });
  });

  describe('createReview', () => {
    it('should create review and update rating', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'r1', rating: 4 }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // update rating

      const result = await repo.createReview({
        skill_id: 's1',
        user_id: 'u1',
        rating: 4,
        comment: 'Great skill',
      });

      expect(result).toEqual({ id: 'r1', rating: 4 });
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should handle null comment', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.createReview({ skill_id: 's1', user_id: 'u1', rating: 3 });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBeNull();
    });
  });

  // ==================== Instances ====================

  describe('createInstance', () => {
    it('should create instance', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1', name: 'my-instance' }] });
      const result = await repo.createInstance({
        skill_id: 's1',
        tenant_id: 't1',
        name: 'my-instance',
      });
      expect(result).toEqual({ id: 'i1', name: 'my-instance' });
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1' }] });
      await repo.createInstance({ skill_id: 's1', tenant_id: 't1', name: 'inst' });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBeNull(); // project_id
      expect(params[5]).toEqual({}); // config
      expect(params[8]).toBe(false); // is_default
    });
  });

  describe('findInstanceById', () => {
    it('should return instance by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1' }] });
      const result = await repo.findInstanceById('i1');
      expect(result).toEqual({ id: 'i1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findInstanceById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findInstanceByIdAndTenant', () => {
    it('should return instance scoped to tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1', tenant_id: 't1' }] });
      const result = await repo.findInstanceByIdAndTenant('i1', 't1');
      expect(result).not.toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['i1', 't1']
      );
    });
  });

  describe('findInstancesBySkillId', () => {
    it('should return instances for skill in tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1' }, { id: 'i2' }] });
      const result = await repo.findInstancesBySkillId('s1', 't1');
      expect(result).toHaveLength(2);
    });
  });

  describe('findInstancesByTenant', () => {
    it('should return paginated instances', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'i1' }] });

      const result = await repo.findInstancesByTenant('t1', 5, 0);
      expect(result.total).toBe(10);
      expect(result.instances).toHaveLength(1);
    });
  });

  describe('updateInstance', () => {
    it('should update instance fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'i1', name: 'updated' }] });
      const result = await repo.updateInstance('i1', { name: 'updated', is_default: true });
      expect(result).not.toBeNull();
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'i1' }] });
      const result = await repo.updateInstance('i1', {});
      expect(result).toEqual({ id: 'i1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.updateInstance('missing', { name: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('deleteInstance', () => {
    it('should delete and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.deleteInstance('i1');
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.deleteInstance('missing');
      expect(result).toBe(false);
    });
  });

  // ==================== Version Locking ====================

  describe('lockVersion', () => {
    it('should lock version', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'v1', is_locked: true }] });
      const result = await repo.lockVersion('v1');
      expect(result).not.toBeNull();
      expect(result!.is_locked).toBe(true);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.lockVersion('missing');
      expect(result).toBeNull();
    });
  });

  describe('unlockVersion', () => {
    it('should unlock version', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'v1', is_locked: false }] });
      const result = await repo.unlockVersion('v1');
      expect(result).not.toBeNull();
      expect(result!.is_locked).toBe(false);
    });
  });

  // ==================== Search ====================

  describe('search', () => {
    it('should search by name or description', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 's1', name: 'code-gen' }] });
      const result = await repo.search('code');
      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE $1'),
        ['%code%', 20]
      );
    });

    it('should apply custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.search('test', 5);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBe(5);
    });
  });

  describe('getCategories', () => {
    it('should return categories with counts', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { category: 'ai', count: '10' },
          { category: 'devops', count: '5' },
        ],
      });
      const result = await repo.getCategories();
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('ai');
    });
  });

  // ==================== Executions ====================

  describe('createExecution', () => {
    it('should create execution record', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'e1', status: 'pending' }] });
      const result = await repo.createExecution({
        tenant_id: 't1',
        skill_id: 's1',
      });
      expect(result).toEqual({ id: 'e1', status: 'pending' });
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'e1' }] });
      await repo.createExecution({ tenant_id: 't1', skill_id: 's1' });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBeNull(); // instance_id
      expect(params[4]).toEqual({}); // input
      expect(params[6]).toBe('manual'); // trigger_mode
    });
  });

  describe('updateExecution', () => {
    it('should update execution fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'e1', status: 'completed' }] });
      const result = await repo.updateExecution('e1', { status: 'completed', duration_ms: 1500 });
      expect(result).not.toBeNull();
    });

    it('should return existing when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
      const result = await repo.updateExecution('e1', {});
      expect(result).toEqual({ id: 'e1' });
    });
  });

  describe('findExecutionById', () => {
    it('should return execution by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'e1' }] });
      const result = await repo.findExecutionById('e1');
      expect(result).toEqual({ id: 'e1' });
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findExecutionById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findExecutionsBySkill', () => {
    it('should return paginated executions', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'e1' }] });

      const result = await repo.findExecutionsBySkill('s1', 't1', 10, 0);
      expect(result.total).toBe(5);
      expect(result.executions).toHaveLength(1);
    });
  });

  describe('findExecutionsByTenant', () => {
    it('should return all executions for tenant', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }] });

      const result = await repo.findExecutionsByTenant('t1');
      expect(result.total).toBe(3);
      expect(result.executions).toHaveLength(2);
    });

    it('should filter by skillId when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'e1' }] });

      await repo.findExecutionsByTenant('t1', 10, 0, 's1');
      const countQuery = mockPool.query.mock.calls[0][0];
      expect(countQuery).toContain('skill_id = $2');
    });
  });

  // ==================== Audit Logs ====================

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1', action: 'published' }] });
      const result = await repo.createAuditLog({
        skill_id: 's1',
        action: 'published',
        actor_id: 'u1',
      });
      expect(result).toEqual({ id: 'a1', action: 'published' });
    });

    it('should handle null optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });
      await repo.createAuditLog({ skill_id: 's1', action: 'created' });
      const params = mockPool.query.mock.calls[0][1];
      expect(params[2]).toBeNull(); // actor_id
      expect(params[3]).toBeNull(); // actor_name
    });
  });

  describe('findAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '20' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

      const result = await repo.findAuditLogs('s1', 10, 0);
      expect(result.total).toBe(20);
      expect(result.logs).toHaveLength(1);
    });
  });

  describe('findAllAuditLogs', () => {
    it('should return all audit logs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

      const result = await repo.findAllAuditLogs();
      expect(result.total).toBe(5);
    });

    it('should filter by action', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

      await repo.findAllAuditLogs(10, 0, 'published');
      const countQuery = mockPool.query.mock.calls[0][0];
      expect(countQuery).toContain('action = $1');
    });
  });

  describe('findPendingReview', () => {
    it('should return skills pending review', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's1', status: 'review' }] });

      const result = await repo.findPendingReview();
      expect(result.total).toBe(3);
      expect(result.skills).toHaveLength(1);
    });

    it('should filter by category', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's1' }] });

      await repo.findPendingReview(10, 0, 'ai');
      const countQuery = mockPool.query.mock.calls[0][0];
      expect(countQuery).toContain('category = $1');
    });
  });
});
