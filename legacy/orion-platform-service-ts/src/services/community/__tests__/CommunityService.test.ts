/**
 * CommunityService Tests - Test community plugin management, contributor tracking
 */

import { CommunityService } from '../CommunityService';
import { CommunityPluginService } from '../CommunityPluginService';

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(() => {
    service = new CommunityService();
  });

  describe('createContribution', () => {
    it('should create a new contribution with pending status', async () => {
      const contribution = await service.createContribution('tenant-1', {
        userId: 'user-1',
        type: 'code',
        title: 'Test Contribution',
        description: 'A test contribution',
      });

      expect(contribution.id).toBeDefined();
      expect(contribution.userId).toBe('user-1');
      expect(contribution.type).toBe('code');
      expect(contribution.status).toBe('pending');
      expect(contribution.createdAt).toBeDefined();
    });

    it('should create contribution with optional fields', async () => {
      const contribution = await service.createContribution('tenant-1', {
        userId: 'user-1',
        type: 'doc',
        title: 'Doc Contribution',
        description: 'Documentation update',
        repository: 'https://github.com/repo',
        url: 'https://docs.example.com',
        tags: ['docs', 'tutorial'],
      });

      expect(contribution.repository).toBe('https://github.com/repo');
      expect(contribution.url).toBe('https://docs.example.com');
      expect(contribution.tags).toEqual(['docs', 'tutorial']);
    });

    it('should default tags to empty array when not provided', async () => {
      const contribution = await service.createContribution('tenant-1', {
        userId: 'user-1',
        type: 'code',
        title: 'No Tags',
        description: 'No tags provided',
      });

      expect(contribution.tags).toEqual([]);
    });
  });

  describe('listContributions', () => {
    beforeEach(async () => {
      await service.createContribution('tenant-1', { userId: 'user-1', type: 'code', title: 'Code Contrib 1', description: 'desc' });
      await service.createContribution('tenant-1', { userId: 'user-2', type: 'doc', title: 'Doc Contrib', description: 'desc' });
      await service.createContribution('tenant-1', { userId: 'user-1', type: 'bugfix', title: 'Bug Fix', description: 'desc', tags: ['critical'] });
    });

    it('should return all contributions when no filters', async () => {
      const results = await service.listContributions();
      expect(results).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const results = await service.listContributions({ type: 'code' });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('code');
    });

    it('should filter by userId', async () => {
      const results = await service.listContributions({ userId: 'user-1' });
      expect(results).toHaveLength(2);
    });

    it('should filter by tags', async () => {
      const results = await service.listContributions({ tags: ['critical'] });
      expect(results).toHaveLength(1);
    });

    it('should return empty when no match', async () => {
      const results = await service.listContributions({ type: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });

  describe('getContribution', () => {
    it('should return contribution by id', async () => {
      const created = await service.createContribution('tenant-1', {
        userId: 'user-1',
        type: 'code',
        title: 'Findable',
        description: 'desc',
      });

      const found = await service.getContribution(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await service.getContribution('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getContributor', () => {
    it('should auto-populate contributor from contributions', async () => {
      await service.createContribution('tenant-1', {
        userId: 'user-100',
        type: 'code',
        title: 'First',
        description: 'desc',
      });

      const contributor = await service.getContributor('user-100');
      expect(contributor).not.toBeNull();
      expect(contributor!.userId).toBe('user-100');
      expect(contributor!.contributions).toBe(1);
      expect(contributor!.types).toContain('code');
    });

    it('should calculate reputation based on approved contributions', async () => {
      // Contributions start as pending, so reputation = 0
      await service.createContribution('tenant-1', {
        userId: 'user-200',
        type: 'code',
        title: 'Pending Contrib',
        description: 'desc',
      });

      const contributor = await service.getContributor('user-200');
      expect(contributor!.reputation).toBe(0); // pending = 0 points
    });

    it('should return cached contributor', async () => {
      const first = await service.getContributor('cached-user');
      const second = await service.getContributor('cached-user');
      expect(first).toEqual(second);
    });
  });

  describe('listContributors', () => {
    beforeEach(async () => {
      await service.createContribution('tenant-1', { userId: 'user-a', type: 'code', title: 'A1', description: 'desc' });
      await service.createContribution('tenant-1', { userId: 'user-a', type: 'doc', title: 'A2', description: 'desc' });
      await service.createContribution('tenant-1', { userId: 'user-b', type: 'code', title: 'B1', description: 'desc' });
    });

    it('should list all contributors sorted by reputation', async () => {
      const contributors = await service.listContributors();
      expect(contributors.length).toBeGreaterThanOrEqual(2);
      // Sorted by reputation descending
      for (let i = 0; i < contributors.length - 1; i++) {
        expect(contributors[i].reputation).toBeGreaterThanOrEqual(contributors[i + 1].reputation);
      }
    });

    it('should respect limit parameter', async () => {
      const contributors = await service.listContributors(1);
      expect(contributors).toHaveLength(1);
    });
  });

  describe('bestPractices', () => {
    it('should create a best practice', async () => {
      const bp = await service.createBestPractice({
        title: 'Best Practice 1',
        description: 'A good practice',
        category: 'pipeline',
        tags: ['ci', 'cd'],
        content: 'Full content here',
        authorId: 'author-1',
        authorName: 'Test Author',
      });

      expect(bp.id).toBeDefined();
      expect(bp.status).toBe('published');
      expect(bp.votes).toBe(0);
      expect(bp.views).toBe(0);
    });

    it('should list best practices sorted by votes', async () => {
      const bp1 = await service.createBestPractice({
        title: 'BP Low',
        description: 'desc',
        category: 'testing',
        content: 'content',
        authorId: 'author-1',
      });
      const bp2 = await service.createBestPractice({
        title: 'BP High',
        description: 'desc',
        category: 'testing',
        content: 'content',
        authorId: 'author-1',
      });

      await service.voteBestPractice(bp2.id, 'up');
      await service.voteBestPractice(bp2.id, 'up');
      await service.voteBestPractice(bp1.id, 'up');

      const results = await service.listBestPractices();
      expect(results[0].id).toBe(bp2.id); // higher votes first
    });

    it('should filter best practices by category', async () => {
      await service.createBestPractice({ title: 'Pipeline BP', description: 'desc', category: 'pipeline', content: 'c', authorId: 'a1' });
      await service.createBestPractice({ title: 'Security BP', description: 'desc', category: 'security', content: 'c', authorId: 'a1' });

      const results = await service.listBestPractices({ category: 'pipeline' });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('pipeline');
    });

    it('should filter by search term', async () => {
      await service.createBestPractice({ title: 'Docker Best Practice', description: 'About docker containers', category: 'deployment', content: 'c', authorId: 'a1', tags: ['docker'] });
      await service.createBestPractice({ title: 'K8s Guide', description: 'About kubernetes', category: 'deployment', content: 'c', authorId: 'a1' });

      const results = await service.listBestPractices({ search: 'docker' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should increment views on get', async () => {
      const bp = await service.createBestPractice({
        title: 'View Test',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      await service.getBestPractice(bp.id);
      const updated = await service.getBestPractice(bp.id);
      expect(updated!.views).toBe(2);
    });

    it('should handle upvote and downvote', async () => {
      const bp = await service.createBestPractice({
        title: 'Vote Test',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      const upvoted = await service.voteBestPractice(bp.id, 'up');
      expect(upvoted!.votes).toBe(1);

      const downvoted = await service.voteBestPractice(bp.id, 'down');
      expect(downvoted!.votes).toBe(0);
    });

    it('should return null when voting non-existent bp', async () => {
      const result = await service.voteBestPractice('non-existent', 'up');
      expect(result).toBeNull();
    });

    it('should delete best practice', async () => {
      const bp = await service.createBestPractice({
        title: 'Delete Me',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      const deleted = await service.deleteBestPractice(bp.id);
      expect(deleted).toBe(true);

      const found = await service.getBestPractice(bp.id);
      expect(found).toBeNull();
    });
  });
});

describe('CommunityPluginService', () => {
  let service: CommunityPluginService;

  beforeEach(() => {
    service = new CommunityPluginService();
  });

  describe('submitPlugin', () => {
    it('should submit a new plugin with pending status', async () => {
      const plugin = await service.submitPlugin('tenant-1', {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'test-author',
        category: 'ci',
        repository: 'https://github.com/test/plugin',
      });

      expect(plugin.id).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.status).toBe('pending');
      expect(plugin.submittedAt).toBeDefined();
    });

    it('should default compatibility to empty array', async () => {
      const plugin = await service.submitPlugin('tenant-1', {
        name: 'no-compat',
        version: '1.0.0',
        description: 'desc',
        author: 'author',
        category: 'ci',
        repository: 'https://github.com/test',
      });

      expect(plugin.compatibility).toEqual([]);
    });
  });

  describe('listPlugins', () => {
    beforeEach(async () => {
      await service.submitPlugin('tenant-1', { name: 'plugin-a', version: '1.0.0', description: 'desc', author: 'alice', category: 'ci', repository: 'https://github.com/a' });
      await service.submitPlugin('tenant-1', { name: 'plugin-b', version: '2.0.0', description: 'desc', author: 'bob', category: 'cd', repository: 'https://github.com/b' });
      await service.submitPlugin('tenant-1', { name: 'plugin-c', version: '1.0.0', description: 'desc', author: 'alice', category: 'ci', repository: 'https://github.com/c' });
    });

    it('should return all plugins', async () => {
      const plugins = await service.listPlugins();
      expect(plugins).toHaveLength(3);
    });

    it('should filter by category', async () => {
      const plugins = await service.listPlugins({ category: 'ci' });
      expect(plugins).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const plugins = await service.listPlugins({ status: 'pending' });
      expect(plugins).toHaveLength(3);
    });

    it('should filter by author', async () => {
      const plugins = await service.listPlugins({ author: 'alice' });
      expect(plugins).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const plugins = await service.listPlugins({ category: 'ci', author: 'alice' });
      expect(plugins).toHaveLength(2);
    });
  });

  describe('reviewPlugin', () => {
    let pluginId: string;

    beforeEach(async () => {
      const plugin = await service.submitPlugin('tenant-1', {
        name: 'review-plugin',
        version: '1.0.0',
        description: 'desc',
        author: 'author',
        category: 'ci',
        repository: 'https://github.com/test',
      });
      pluginId = plugin.id;
    });

    it('should approve a plugin', async () => {
      const result = await service.reviewPlugin(pluginId, 'approve', 'Looks good!');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('approved');
      expect(result!.reviewComment).toBe('Looks good!');
      expect(result!.reviewedAt).toBeDefined();
    });

    it('should reject a plugin', async () => {
      const result = await service.reviewPlugin(pluginId, 'reject', 'Not ready');
      expect(result!.status).toBe('rejected');
    });

    it('should return null for non-existent plugin', async () => {
      const result = await service.reviewPlugin('non-existent', 'approve', 'comment');
      expect(result).toBeNull();
    });
  });
});
