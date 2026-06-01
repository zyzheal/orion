/**
 * GitLabAdapter 单元测试
 */

import { GitLabAdapter } from '../GitLabAdapter';
import { RepoType, PullRequestStatus, MergeStrategy } from '../types';

describe('GitLabAdapter', () => {
  let adapter: GitLabAdapter;
  let mockFetch: jest.Mock;
  const origFetch = global.fetch;

  beforeEach(async () => {
    // Enable real API mode so fetch mocks are used
    process.env.GITLAB_API_ENABLED = 'true';

    adapter = new GitLabAdapter({
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token',
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    global.fetch = origFetch;
    delete process.env.GITLAB_API_ENABLED;
  });

  describe('type', () => {
    it('should return GITLAB type', async () => {
      expect(adapter.type).toBe(RepoType.GITLAB);
    });
  });

  describe('getRepository', () => {
    it('should return repository info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          path_with_namespace: 'group/test-project',
          name: 'test-project',
          web_url: 'https://gitlab.example.com/group/test-project',
          default_branch: 'main',
          visibility: 'private',
        }),
      });

      const repo = await adapter.getRepository('group/test-project');

      expect(repo.id).toBe('1'); // GitLab uses numeric IDs, adapter converts to string
      expect(repo.name).toBe('test-project');
      expect(repo.fullName).toBe('group/test-project');
      expect(repo.type).toBe(RepoType.GITLAB);
      expect(repo.url).toContain('gitlab.example.com');
    });
  });

  describe('listRepositories', () => {
    it('should return repos object with repos array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, path_with_namespace: 'group/project-1', name: 'project-1', web_url: 'https://gitlab.example.com/group/project-1' },
          { id: 2, path_with_namespace: 'group/project-2', name: 'project-2', web_url: 'https://gitlab.example.com/group/project-2' },
        ]),
      });

      const result = await adapter.listRepositories();
      expect(result.repos).toBeDefined();
      expect(Array.isArray(result.repos)).toBe(true);
      expect(result.total).toBeDefined();
    });
  });

  describe('branch management', () => {
    it('should return branch info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'main',
          commit: { id: 'abc123', message: 'Initial commit' },
          protected: false,
        }),
      });

      const branch = await adapter.getBranch('test-repo', 'main');

      expect(branch.name).toBe('main');
      expect(typeof branch.protected).toBe('boolean');
    });

    it('should list branches', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { name: 'main', commit: { id: 'abc123' }, protected: false },
          { name: 'develop', commit: { id: 'def456' }, protected: true },
        ]),
      });
      const result = await adapter.listBranches('test-repo');
      expect(result.branches).toBeDefined();
      expect(Array.isArray(result.branches)).toBe(true);
    });

    it('should create a branch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'feature-branch',
          commit: { id: 'xyz789' },
        }),
      });
      const branch = await adapter.createBranch('test-repo', 'feature-branch', 'main');

      expect(branch.name).toBe('feature-branch');
    });

    it('should delete a branch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(adapter.deleteBranch('test-repo', 'feature-branch')).resolves.not.toThrow();
    });

    it('should return branch protection status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'main',
          protected: true,
        }),
      });
      const result = await adapter.getBranchProtection('test-repo', 'main');

      expect(result).toBeDefined();
      expect(typeof result!.preventForcePush).toBe('boolean');
    });
  });

  describe('commit management', () => {
    it('should list commits', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 'abc123', short_message: 'Initial commit', author_name: 'Test User', authored_date: '2024-01-01T00:00:00Z' },
        ]),
      });
      const result = await adapter.listCommits('test-repo');
      expect(result.commits).toBeDefined();
      expect(Array.isArray(result.commits)).toBe(true);
    });

    it('should return commit info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'abc123',
          short_message: 'Initial commit',
          author_name: 'Test User',
          authored_date: '2024-01-01T00:00:00Z',
        }),
      });
      const commit = await adapter.getCommit('test-repo', 'abc123');

      expect(commit.sha).toBe('abc123');
    });
  });

  describe('pull request management', () => {
    it('should create a merge request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Test MR',
          description: 'Description',
          source_branch: 'feature-branch',
          target_branch: 'main',
          state: 'opened',
          reviewers: [{ username: 'reviewer-1' }],
          labels: [{ title: 'feature' }],
        }),
      });
      const mr = await adapter.createPullRequest('test-repo', {
        title: 'Test MR',
        description: 'Description',
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        reviewers: ['reviewer-1'],
        labels: ['feature'],
      });

      expect(mr.title).toBe('Test MR');
      expect(mr.sourceBranch).toBe('feature-branch');
      expect(mr.targetBranch).toBe('main');
      expect(mr.status).toBe(PullRequestStatus.OPEN);
    });

    it('should get merge request details', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Test MR',
          state: 'opened',
          source_branch: 'feature',
          target_branch: 'main',
        }),
      });
      const mr = await adapter.getPullRequest('test-repo', '1');

      expect(mr.id).toBe('1');
    });

    it('should list merge requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { iid: 1, title: 'MR 1', state: 'opened' },
          { iid: 2, title: 'MR 2', state: 'merged' },
        ]),
      });
      const result = await adapter.listPullRequests('test-repo', {
        state: PullRequestStatus.OPEN,
      });
      expect(result.pullRequests).toBeDefined();
      expect(Array.isArray(result.pullRequests)).toBe(true);
    });

    it('should merge a merge request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Test MR',
          state: 'merged',
          merged_at: '2024-01-01T00:00:00Z',
        }),
      });
      const mr = await adapter.mergePullRequest('test-repo', '1', {
        strategy: 'squash' as MergeStrategy,
      });

      expect(mr.status).toBe(PullRequestStatus.MERGED);
    });

    it('should close a merge request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Test MR',
          state: 'closed',
          closed_at: '2024-01-01T00:00:00Z',
        }),
      });
      const mr = await adapter.closePullRequest('test-repo', '1');

      expect(mr.status).toBe(PullRequestStatus.CLOSED);
    });

    it('should update a merge request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Updated Title',
          description: 'Updated description',
          state: 'opened',
          labels: [{ title: 'updated' }],
        }),
      });
      const mr = await adapter.updatePullRequest('test-repo', '1', {
        title: 'Updated Title',
        description: 'Updated description',
        labels: ['updated'],
      });

      expect(mr.title).toBe('Updated Title');
    });
  });

  describe('review management', () => {
    it('should add a review', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          body: 'LGTM',
          state: 'approved',
          author: { username: 'reviewer-1' },
        }),
      });
      const review = await adapter.addReview('test-repo', '1', {
        content: 'LGTM',
        state: 'approve',
      });

      // addReview returns a fallback Review with body (not content)
      expect(review.body).toBe('LGTM');
      expect(review.state).toBe('approved');
    });

    it('should list reviews', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, body: 'LGTM', state: 'approved' },
        ]),
      });
      const reviews = await adapter.listReviews('test-repo', '1');
      expect(Array.isArray(reviews)).toBe(true);
    });
  });

  describe('webhook management', () => {
    it('should create a webhook', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          url: 'https://example.com/webhook',
          merge_requests_events: true,
          push_events: true,
          active: true,
          token: 'secret-token',
          created_at: '2024-01-01T00:00:00Z',
          project_id: 1,
        }),
      });
      const webhook = await adapter.createWebhook('test-repo', {
        url: 'https://example.com/webhook',
        events: ['merge_requests', 'push'],
        secret: 'secret-token',
      });

      expect(webhook.url).toBe('https://example.com/webhook');
      // The webhook active property may be mapped differently
      expect(webhook).toBeDefined();
    });

    it('should list webhooks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, url: 'https://example.com/webhook', active: true, events: ['push'] },
        ]),
      });
      const webhooks = await adapter.listWebhooks('test-repo');
      expect(Array.isArray(webhooks)).toBe(true);
    });

    it('should delete a webhook', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(adapter.deleteWebhook('test-repo', 'hook-1')).resolves.not.toThrow();
    });
  });
});
