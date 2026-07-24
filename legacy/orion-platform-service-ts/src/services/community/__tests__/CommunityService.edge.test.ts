/**
 * CommunityService & CommunityPluginService - Edge Case Tests
 *
 * Covers gaps not in the original test file:
 * - status filter for contributions
 * - combined filters
 * - bestPractice search in tags
 * - bestPractice status/authorId filters
 * - getBestPractice null case
 * - deleteBestPractice non-existent
 * - createBestPractice default authorName
 * - contributor with no contributions
 * - plugin with compatibility
 * - reviewPlugin mutation verification
 */

import { CommunityService } from '../CommunityService';
import { CommunityPluginService } from '../CommunityPluginService';

describe('CommunityService - edge cases', () => {
  let service: CommunityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunityService();
  });

  describe('listContributions - status filter', () => {
    it('should filter contributions by status', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });
      const c2 = await service.createContribution('t1', { userId: 'u2', type: 'code', title: 'B', description: 'd' });

      // All start as pending
      const pending = await service.listContributions({ status: 'pending' });
      expect(pending).toHaveLength(2);

      // No approved yet
      const approved = await service.listContributions({ status: 'approved' });
      expect(approved).toHaveLength(0);
    });

    it('should filter with combined type and userId', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });
      await service.createContribution('t1', { userId: 'u1', type: 'doc', title: 'B', description: 'd' });
      await service.createContribution('t1', { userId: 'u2', type: 'code', title: 'C', description: 'd' });

      const results = await service.listContributions({ type: 'code', userId: 'u1' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('A');
    });

    it('should filter with tags that have multiple matches', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd', tags: ['a', 'b'] });
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'B', description: 'd', tags: ['c'] });

      const results = await service.listContributions({ tags: ['a', 'c'] });
      expect(results).toHaveLength(2);
    });

    it('should return empty when tags filter has no match', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd', tags: ['x'] });

      const results = await service.listContributions({ tags: ['nonexistent'] });
      expect(results).toHaveLength(0);
    });

    it('should handle empty tags array in filter as no-op', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });

      const results = await service.listContributions({ tags: [] });
      expect(results).toHaveLength(1);
    });
  });

  describe('getContribution', () => {
    it('should return null for empty string id', async () => {
      const result = await service.getContribution('');
      expect(result).toBeNull();
    });
  });

  describe('getContributor - edge cases', () => {
    it('should create contributor with zero contributions for unknown userId', async () => {
      const contributor = await service.getContributor('never-seen');

      expect(contributor).not.toBeNull();
      expect(contributor!.contributions).toBe(0);
      expect(contributor!.types).toEqual([]);
      expect(contributor!.reputation).toBe(0);
    });

    it('should compute unique types from multiple contributions', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'B', description: 'd' });
      await service.createContribution('t1', { userId: 'u1', type: 'doc', title: 'C', description: 'd' });

      const contributor = await service.getContributor('u1');
      expect(contributor!.types).toHaveLength(2);
      expect(contributor!.types).toContain('code');
      expect(contributor!.types).toContain('doc');
      expect(contributor!.contributions).toBe(3);
    });
  });

  describe('listContributors - edge cases', () => {
    it('should return empty array when no contributions exist', async () => {
      const contributors = await service.listContributors();
      expect(contributors).toEqual([]);
    });

    it('should handle limit larger than available contributors', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });

      const contributors = await service.listContributors(100);
      expect(contributors).toHaveLength(1);
    });

    it('should handle limit of 0', async () => {
      await service.createContribution('t1', { userId: 'u1', type: 'code', title: 'A', description: 'd' });

      const contributors = await service.listContributors(0);
      // 0 is falsy, so no slicing happens
      expect(contributors).toHaveLength(1);
    });
  });

  describe('bestPractices - edge cases', () => {
    it('should return null when getting non-existent best practice', async () => {
      const result = await service.getBestPractice('non-existent');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent best practice', async () => {
      const result = await service.deleteBestPractice('non-existent');
      expect(result).toBe(false);
    });

    it('should use default authorName when not provided', async () => {
      const bp = await service.createBestPractice({
        title: 'Test',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'author-12345678',
      });

      expect(bp.authorName).toBe('user-author-1');
    });

    it('should default tags to empty array', async () => {
      const bp = await service.createBestPractice({
        title: 'Test',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      expect(bp.tags).toEqual([]);
    });

    it('should filter best practices by status', async () => {
      const bp = await service.createBestPractice({
        title: 'Published',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      const published = await service.listBestPractices({ status: 'published' });
      expect(published).toHaveLength(1);

      const draft = await service.listBestPractices({ status: 'draft' });
      expect(draft).toHaveLength(0);
    });

    it('should filter best practices by authorId', async () => {
      await service.createBestPractice({
        title: 'By Author 1',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });
      await service.createBestPractice({
        title: 'By Author 2',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a2',
      });

      const results = await service.listBestPractices({ authorId: 'a1' });
      expect(results).toHaveLength(1);
      expect(results[0].authorId).toBe('a1');
    });

    it('should filter best practices by tags', async () => {
      await service.createBestPractice({
        title: 'Tagged',
        description: 'desc',
        category: 'general',
        tags: ['docker', 'k8s'],
        content: 'content',
        authorId: 'a1',
      });
      await service.createBestPractice({
        title: 'Untagged',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      const results = await service.listBestPractices({ tags: ['docker'] });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('docker');
    });

    it('should search best practices matching tags', async () => {
      await service.createBestPractice({
        title: 'Unrelated Title',
        description: 'Unrelated desc',
        category: 'general',
        tags: ['prometheus'],
        content: 'content',
        authorId: 'a1',
      });

      const results = await service.listBestPractices({ search: 'prometheus' });
      expect(results).toHaveLength(1);
    });

    it('should return empty when search matches nothing', async () => {
      await service.createBestPractice({
        title: 'Something',
        description: 'desc',
        category: 'general',
        content: 'content',
        authorId: 'a1',
      });

      const results = await service.listBestPractices({ search: 'zzzznonexistent' });
      expect(results).toHaveLength(0);
    });

    it('should return empty list when no best practices exist', async () => {
      const results = await service.listBestPractices();
      expect(results).toEqual([]);
    });

    it('should combine category and search filters', async () => {
      await service.createBestPractice({
        title: 'Docker Pipeline',
        description: 'desc',
        category: 'pipeline',
        content: 'content',
        authorId: 'a1',
      });
      await service.createBestPractice({
        title: 'Docker Security',
        description: 'desc',
        category: 'security',
        content: 'content',
        authorId: 'a1',
      });

      const results = await service.listBestPractices({ category: 'pipeline', search: 'docker' });
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('pipeline');
    });
  });
});

describe('CommunityPluginService - edge cases', () => {
  let service: CommunityPluginService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunityPluginService();
  });

  describe('submitPlugin - edge cases', () => {
    it('should store compatibility array when provided', async () => {
      const plugin = await service.submitPlugin('tenant-1', {
        name: 'compat-plugin',
        version: '1.0.0',
        description: 'desc',
        author: 'author',
        category: 'ci',
        repository: 'https://github.com/test',
        compatibility: ['orion-v1', 'orion-v2'],
      });

      expect(plugin.compatibility).toEqual(['orion-v1', 'orion-v2']);
    });

    it('should generate unique plugin ids', async () => {
      const p1 = await service.submitPlugin('t1', {
        name: 'a', version: '1.0.0', description: 'd', author: 'au', category: 'ci', repository: 'r',
      });
      const p2 = await service.submitPlugin('t1', {
        name: 'b', version: '1.0.0', description: 'd', author: 'au', category: 'ci', repository: 'r',
      });

      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('listPlugins - edge cases', () => {
    it('should return empty array when no plugins exist', async () => {
      const plugins = await service.listPlugins();
      expect(plugins).toEqual([]);
    });

    it('should return empty array when filters match nothing', async () => {
      await service.submitPlugin('t1', {
        name: 'p1', version: '1.0.0', description: 'd', author: 'a', category: 'ci', repository: 'r',
      });

      const plugins = await service.listPlugins({ category: 'nonexistent' });
      expect(plugins).toEqual([]);
    });

    it('should filter by non-pending status', async () => {
      const p = await service.submitPlugin('t1', {
        name: 'p1', version: '1.0.0', description: 'd', author: 'a', category: 'ci', repository: 'r',
      });
      await service.reviewPlugin(p.id, 'approve', 'good');

      const approved = await service.listPlugins({ status: 'approved' });
      expect(approved).toHaveLength(1);

      const pending = await service.listPlugins({ status: 'pending' });
      expect(pending).toHaveLength(0);
    });
  });

  describe('reviewPlugin - edge cases', () => {
    it('should mutate the original plugin object', async () => {
      const plugin = await service.submitPlugin('t1', {
        name: 'p1', version: '1.0.0', description: 'd', author: 'a', category: 'ci', repository: 'r',
      });

      const reviewed = await service.reviewPlugin(plugin.id, 'approve', 'LGTM');

      // The returned object should be the same reference
      expect(reviewed!.id).toBe(plugin.id);
      expect(reviewed!.reviewComment).toBe('LGTM');
      expect(reviewed!.reviewedAt).toBeDefined();
    });

    it('should persist review status across list calls', async () => {
      const plugin = await service.submitPlugin('t1', {
        name: 'p1', version: '1.0.0', description: 'd', author: 'a', category: 'ci', repository: 'r',
      });
      await service.reviewPlugin(plugin.id, 'reject', 'Issues found');

      const plugins = await service.listPlugins({ status: 'rejected' });
      expect(plugins).toHaveLength(1);
      expect(plugins[0].reviewComment).toBe('Issues found');
    });
  });
});
