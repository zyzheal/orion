/**
 * GerritAdapter 单元测试
 *
 * Coverage: getRepository, listRepositories, listBranches, getBranch,
 *           createBranch, deleteBranch, getBranchProtection, listCommits,
 *           getCommit, createPullRequest, getPullRequest, listPullRequests,
 *           mergePullRequest, closePullRequest, updatePullRequest,
 *           addReview, listReviews, createWebhook, listWebhooks, deleteWebhook
 */

import { GerritAdapter } from '../GerritAdapter';
import { RepoType, PullRequestStatus } from '../types';

describe('GerritAdapter', () => {
  let adapter: GerritAdapter;
  let mockFetch: jest.Mock;
  const origFetch = global.fetch;

  beforeEach(() => {
    process.env.GERRIT_API_ENABLED = 'true';

    adapter = new GerritAdapter({
      baseUrl: 'https://gerrit.example.com',
      username: 'test-user',
      password: 'test-pass',
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
    delete process.env.GERRIT_API_ENABLED;
  });

  // Helper to create a Gerrit response with magic prefix
  const gerritResponse = (data: any) => ({
    ok: true,
    text: () => Promise.resolve(")]}'" + JSON.stringify(data)),
  });

  const rawResponse = (data: any) => ({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  });

  // ==================== type ====================

  describe('type', () => {
    it('should return GERRIT type', () => {
      expect(adapter.type).toBe(RepoType.GERRIT);
    });
  });

  // ==================== getRepository ====================

  describe('getRepository', () => {
    it('should return repository info from Gerrit', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        id: 'my-project',
        name: 'my-project',
        state: 'ACTIVE',
        description: 'Test project',
        branches: { master: 'refs/heads/master' },
        web_url: 'https://gerrit.example.com/my-project',
        created_on: '2024-01-01T00:00:00Z',
        last_updated: '2024-06-01T00:00:00Z',
      }));

      const repo = await adapter.getRepository('my-project');

      expect(repo.id).toBe('my-project');
      expect(repo.name).toBe('my-project');
      expect(repo.type).toBe(RepoType.GERRIT);
      expect(repo.url).toContain('gerrit.example.com');
      expect(repo.description).toBe('Test project');
    });

    it('should return fallback when API returns empty object', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const repo = await adapter.getRepository('non-existent');

      expect(repo.id).toBe('non-existent');
      expect(repo.fullName).toBe('non-existent');
      expect(repo.type).toBe(RepoType.GERRIT);
    });

    it('should return fallback when fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('') });

      const repo = await adapter.getRepository('my-project');

      expect(repo.fullName).toBe('my-project');
      expect(repo.type).toBe(RepoType.GERRIT);
    });

    it('should return fallback when real API is disabled', async () => {
      delete process.env.GERRIT_API_ENABLED;

      adapter = new GerritAdapter({
        baseUrl: 'https://gerrit.example.com',
        username: 'user',
        password: 'pass',
      });

      const repo = await adapter.getRepository('my-project');

      expect(repo.fullName).toBe('my-project');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==================== listRepositories ====================

  describe('listRepositories', () => {
    it('should list repositories', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        'project-a': { state: 'ACTIVE', description: 'Project A' },
        'project-b': { state: 'READ_ONLY', description: 'Project B' },
      }));

      const result = await adapter.listRepositories({ search: 'project' });

      expect(result.repos).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty list when no projects', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const result = await adapter.listRepositories();

      expect(result.repos).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter empty key entries', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        '': {},
        'valid-project': { state: 'ACTIVE' },
      }));

      const result = await adapter.listRepositories();

      expect(result.repos).toHaveLength(1);
    });
  });

  // ==================== listBranches ====================

  describe('listBranches', () => {
    it('should list branches', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        main: { revision: 'abc123' },
        develop: { revision: 'def456' },
      }));

      const result = await adapter.listBranches('my-project');

      expect(result.branches).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty list when no branches', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const result = await adapter.listBranches('my-project');

      expect(result.branches).toHaveLength(0);
    });
  });

  // ==================== getBranch ====================

  describe('getBranch', () => {
    it('should return branch info', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        revision: 'abc123',
      }));

      const branch = await adapter.getBranch('my-project', 'main');

      expect(branch.name).toBe('main');
      expect(branch.sha).toBe('abc123');
      expect(branch.protected).toBe(false);
    });

    it('should return fallback when empty response', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const branch = await adapter.getBranch('my-project', 'main');

      expect(branch.name).toBe('main');
      expect(branch.sha).toBe('');
    });
  });

  // ==================== createBranch ====================

  describe('createBranch', () => {
    it('should create a branch', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        revision: 'new-branch-sha',
      }));

      const branch = await adapter.createBranch('my-project', 'feature', 'main');

      expect(branch.name).toBe('feature');
      expect(branch.sha).toBe('new-branch-sha');
    });

    it('should return fallback when empty response', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const branch = await adapter.createBranch('my-project', 'feature', 'main');

      expect(branch.name).toBe('feature');
      expect(branch.sha).toBe('');
    });
  });

  // ==================== deleteBranch ====================

  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });

      await expect(adapter.deleteBranch('my-project', 'feature')).resolves.not.toThrow();
    });

    it('should handle delete failure gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('') });

      await expect(adapter.deleteBranch('my-project', 'feature')).resolves.not.toThrow();
    });
  });

  // ==================== getBranchProtection ====================

  describe('getBranchProtection', () => {
    it('should return null (mock)', async () => {
      const result = await adapter.getBranchProtection('my-project', 'main');

      expect(result).toBeNull();
    });
  });

  // ==================== listCommits ====================

  describe('listCommits', () => {
    it('should list commits', async () => {
      mockFetch.mockResolvedValue(gerritResponse([
        {
          current_revision: 'abc123',
          subject: 'Initial commit',
          owner: { name: 'Test User', email: 'test@example.com' },
          created: '2024-01-01T00:00:00Z',
          _number: 1,
        },
      ]));

      const result = await adapter.listCommits('my-project');

      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].sha).toBe('abc123');
      expect(result.commits[0].message).toBe('Initial commit');
      expect(result.total).toBe(1);
    });

    it('should return empty list when no commits', async () => {
      mockFetch.mockResolvedValue(gerritResponse([]));

      const result = await adapter.listCommits('my-project');

      expect(result.commits).toHaveLength(0);
    });
  });

  // ==================== getCommit ====================

  describe('getCommit', () => {
    it('should return commit info', async () => {
      mockFetch.mockResolvedValue(gerritResponse([{
        current_revision: 'abc123',
        subject: 'Fix bug',
        owner: { name: 'Dev', email: 'dev@example.com' },
        created: '2024-01-01T00:00:00Z',
        _number: 42,
      }]));

      const commit = await adapter.getCommit('my-project', 'abc123');

      expect(commit.sha).toBe('abc123');
      expect(commit.message).toBe('Fix bug');
      expect(commit.author.name).toBe('Dev');
    });

    it('should return fallback when commit not found', async () => {
      mockFetch.mockResolvedValue(gerritResponse([]));

      const commit = await adapter.getCommit('my-project', 'non-existent');

      expect(commit.sha).toBe('non-existent');
      expect(commit.message).toBe('');
    });
  });

  // ==================== createPullRequest ====================

  describe('createPullRequest', () => {
    it('should create a change (mock)', async () => {
      const pr = await adapter.createPullRequest('my-project', {
        title: 'New feature',
        description: 'Feature description',
        sourceBranch: 'feature',
        targetBranch: 'main',
        reviewers: ['reviewer-1'],
      });

      expect(pr.title).toBe('New feature');
      expect(pr.sourceBranch).toBe('feature');
      expect(pr.targetBranch).toBe('main');
      expect(pr.status).toBe(PullRequestStatus.OPEN);
      expect(pr.id).toContain('change-');
    });
  });

  // ==================== getPullRequest ====================

  describe('getPullRequest', () => {
    it('should return change details', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        change_id: 'I1234',
        subject: 'Fix issue',
        branch: 'feature',
        dest_branch: 'main',
        owner: { name: 'Dev' },
        status: 'NEW',
      }));

      const pr = await adapter.getPullRequest('my-project', 'I1234');

      expect(pr.id).toBe('I1234');
      expect(pr.title).toBe('Fix issue');
      expect(pr.status).toBe(PullRequestStatus.OPEN);
    });

    it('should map MERGED status', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        change_id: 'I1234',
        subject: 'Merged',
        branch: 'feature',
        owner: { name: 'Dev' },
        status: 'MERGED',
      }));

      const pr = await adapter.getPullRequest('my-project', 'I1234');

      expect(pr.status).toBe(PullRequestStatus.MERGED);
    });

    it('should map ABANDONED status to CLOSED', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        change_id: 'I1234',
        subject: 'Abandoned',
        branch: 'feature',
        owner: { name: 'Dev' },
        status: 'ABANDONED',
      }));

      const pr = await adapter.getPullRequest('my-project', 'I1234');

      expect(pr.status).toBe(PullRequestStatus.CLOSED);
    });

    it('should return fallback when empty response', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const pr = await adapter.getPullRequest('my-project', 'I1234');

      expect(pr.id).toBe('I1234');
      expect(pr.title).toBe('Mock Change');
    });
  });

  // ==================== listPullRequests ====================

  describe('listPullRequests', () => {
    it('should list open changes', async () => {
      mockFetch.mockResolvedValue(gerritResponse([
        {
          change_id: 'I1',
          subject: 'Change 1',
          branch: 'feature',
          owner: { name: 'Dev' },
          status: 'NEW',
        },
      ]));

      const result = await adapter.listPullRequests('my-project', {
        state: PullRequestStatus.OPEN,
      });

      expect(result.pullRequests).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by MERGED status', async () => {
      mockFetch.mockResolvedValue(gerritResponse([]));

      await adapter.listPullRequests('my-project', { state: PullRequestStatus.MERGED });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('status:merged');
    });

    it('should filter by CLOSED status', async () => {
      mockFetch.mockResolvedValue(gerritResponse([]));

      await adapter.listPullRequests('my-project', { state: PullRequestStatus.CLOSED });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('status:abandoned');
    });
  });

  // ==================== mergePullRequest ====================

  describe('mergePullRequest', () => {
    it('should merge a change', async () => {
      mockFetch.mockResolvedValue(rawResponse({}));

      const pr = await adapter.mergePullRequest('my-project', 'I1234');

      expect(pr.status).toBe(PullRequestStatus.MERGED);
      expect(pr.title).toBe('Merged Change');
    });
  });

  // ==================== closePullRequest ====================

  describe('closePullRequest', () => {
    it('should abandon a change', async () => {
      mockFetch.mockResolvedValue(rawResponse({}));

      const pr = await adapter.closePullRequest('my-project', 'I1234');

      expect(pr.status).toBe(PullRequestStatus.CLOSED);
      expect(pr.title).toBe('Abandoned Change');
    });
  });

  // ==================== updatePullRequest ====================

  describe('updatePullRequest', () => {
    it('should update change title', async () => {
      const pr = await adapter.updatePullRequest('my-project', 'I1234', {
        title: 'Updated Title',
      });

      expect(pr.title).toBe('Updated Title');
      expect(pr.status).toBe(PullRequestStatus.OPEN);
    });

    it('should use default title when not provided', async () => {
      const pr = await adapter.updatePullRequest('my-project', 'I1234', {});

      expect(pr.title).toBe('Mock Change');
    });
  });

  // ==================== addReview ====================

  describe('addReview', () => {
    it('should add review with score', async () => {
      mockFetch.mockResolvedValue(rawResponse({}));

      const review = await adapter.addReview('my-project', 'I1234', {
        content: 'LGTM',
        score: 2,
        state: 'approve',
      });

      expect(review.body).toBe('LGTM');
      expect(review.state).toBe('approved');
    });

    it('should add review with request_changes state', async () => {
      mockFetch.mockResolvedValue(rawResponse({}));

      const review = await adapter.addReview('my-project', 'I1234', {
        content: 'Needs work',
        state: 'request_changes',
      });

      expect(review.state).toBe('changes_requested');
    });

    it('should add review with comment state', async () => {
      mockFetch.mockResolvedValue(rawResponse({}));

      const review = await adapter.addReview('my-project', 'I1234', {
        content: 'Just a comment',
      });

      expect(review.state).toBe('pending');
    });
  });

  // ==================== listReviews ====================

  describe('listReviews', () => {
    it('should list reviews from comments', async () => {
      mockFetch.mockResolvedValue(gerritResponse({
        'src/main.ts': [
          { id: 'c1', author: { name: 'Reviewer' }, message: 'LGTM', updated: '2024-01-01T00:00:00Z' },
        ],
        'src/utils.ts': [
          { id: 'c2', author: { name: 'Reviewer2' }, message: 'Fix this', updated: '2024-01-02T00:00:00Z' },
        ],
      }));

      const reviews = await adapter.listReviews('my-project', 'I1234');

      expect(reviews).toHaveLength(2);
      expect(reviews[0].body).toBe('LGTM');
      expect(reviews[1].body).toBe('Fix this');
    });

    it('should return empty when no comments', async () => {
      mockFetch.mockResolvedValue(gerritResponse({}));

      const reviews = await adapter.listReviews('my-project', 'I1234');

      expect(reviews).toHaveLength(0);
    });
  });

  // ==================== createWebhook ====================

  describe('createWebhook', () => {
    it('should create a webhook (mock)', async () => {
      const webhook = await adapter.createWebhook('my-project', {
        url: 'https://example.com/hook',
        events: ['push', 'merge_requests'],
        secret: 'my-secret',
      });

      expect(webhook.url).toBe('https://example.com/hook');
      expect(webhook.events).toEqual(['push', 'merge_requests']);
      expect(webhook.active).toBe(true);
      expect(webhook.secret).toBe('my-secret');
    });
  });

  // ==================== listWebhooks ====================

  describe('listWebhooks', () => {
    it('should return empty array (mock)', async () => {
      const webhooks = await adapter.listWebhooks('my-project');

      expect(webhooks).toEqual([]);
    });
  });

  // ==================== deleteWebhook ====================

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });

      await expect(adapter.deleteWebhook('my-project', 'hook-1')).resolves.not.toThrow();
    });

    it('should handle delete failure gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('') });

      await expect(adapter.deleteWebhook('my-project', 'hook-1')).resolves.not.toThrow();
    });
  });

  // ==================== Error handling ====================

  describe('error handling', () => {
    it('should return fallback when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const repo = await adapter.getRepository('my-project');

      expect(repo.fullName).toBe('my-project');
      expect(repo.type).toBe(RepoType.GERRIT);
    });

    it('should handle non-ok response for GET', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server Error'),
      });

      const branch = await adapter.getBranch('my-project', 'main');

      expect(branch.name).toBe('main');
    });

    it('should handle non-ok response for POST', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server Error'),
      });

      const result = await adapter.mergePullRequest('my-project', 'I1234');

      // Falls back to the mock return value
      expect(result.status).toBe(PullRequestStatus.MERGED);
    });
  });
});
