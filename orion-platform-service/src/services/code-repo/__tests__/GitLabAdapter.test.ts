/**
 * GitLabAdapter 单元测试
 */

import { GitLabAdapter } from '../GitLabAdapter';
import { RepoType, PullRequestStatus, MergeStrategy } from '../types';

// Enable real API mode so fetch mocks are used
process.env.GITLAB_API_ENABLED = 'true';

describe('GitLabAdapter', () => {
  let adapter: GitLabAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new GitLabAdapter({
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token',
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('type', () => {
    it('should return GITLAB type', () => {
      expect(adapter.type).toBe(RepoType.GITLAB);
    });
  });

  describe('getRepository', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          path_with_namespace: 'group/test-project',
          name: 'test-project',
          web_url: 'https://gitlab.example.com/group/test-project',
          default_branch: 'main',
        }),
      });
    });

    it('should return repository info', async () => {
      const repo = await adapter.getRepository('group/test-project');

      expect(repo.id).toBe('1'); // GitLab uses numeric IDs
      expect(repo.name).toBe('test-project');
      expect(repo.fullName).toBe('group/test-project');
      expect(repo.type).toBe(RepoType.GITLAB);
      expect(repo.url).toContain('gitlab.example.com');
    });
  });

  describe('listRepositories', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, path_with_namespace: 'group/project-1', name: 'project-1', web_url: 'https://gitlab.example.com/group/project-1' },
          { id: 2, path_with_namespace: 'group/project-2', name: 'project-2', web_url: 'https://gitlab.example.com/group/project-2' },
        ]),
      });
    });

    it('should return array of repositories', async () => {
      const repos = await adapter.listRepositories();
      expect(Array.isArray(repos)).toBe(true);
    });
  });

  describe('branch management', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'main',
          commit: { id: 'abc123', message: 'Initial commit' },
          protected: false,
        }),
      });
    });

    it('should return branch info', async () => {
      const branch = await adapter.getBranch('test-repo', 'main');

      expect(branch.name).toBe('main');
      expect(typeof branch.isProtected).toBe('boolean');
    });

    it('should list branches', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { name: 'main', commit: { id: 'abc123' }, protected: false },
          { name: 'develop', commit: { id: 'def456' }, protected: true },
        ]),
      });
      const branches = await adapter.listBranches('test-repo');
      expect(Array.isArray(branches)).toBe(true);
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
      // Mock implementation, should not throw
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

      expect(typeof result.isProtected).toBe('boolean');
    });
  });

  describe('commit management', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 'abc123', short_message: 'Initial commit', author_name: 'Test User', authored_date: '2024-01-01T00:00:00Z' },
        ]),
      });
    });

    it('should list commits', async () => {
      const commits = await adapter.listCommits('test-repo');
      expect(Array.isArray(commits)).toBe(true);
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
          labels: 'feature',
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
      expect(mr.reviewers).toContain('reviewer-1');
      expect(mr.labels).toContain('feature');
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
      const mrs = await adapter.listPullRequests('test-repo', {
        state: PullRequestStatus.OPEN,
      });
      expect(Array.isArray(mrs)).toBe(true);
    });

    it('should merge a merge request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            iid: 1,
            title: 'Test MR',
            state: 'merged',
            merged_at: '2024-01-01T00:00:00Z',
          }),
        });
      const mr = await adapter.mergePullRequest('test-repo', '1', {
        strategy: MergeStrategy.SQUASH_MERGE,
      });

      expect(mr.status).toBe(PullRequestStatus.MERGED);
      expect(mr.mergedAt).toBeDefined();
    });

    it('should close a merge request', async () => {
      mockFetch
        .mockResolvedValueOnce({
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
      expect(mr.closedAt).toBeDefined();
    });

    it('should update a merge request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          iid: 1,
          title: 'Updated Title',
          description: 'Updated description',
          state: 'opened',
          labels: 'updated',
        }),
      });
      const mr = await adapter.updatePullRequest('test-repo', '1', {
        title: 'Updated Title',
        description: 'Updated description',
        labels: ['updated'],
      });

      expect(mr.title).toBe('Updated Title');
      expect(mr.description).toBe('Updated description');
      expect(mr.labels).toContain('updated');
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

      expect(review.content).toBe('LGTM');
      expect(review.state).toBe('approve');
      expect(review.pullRequestId).toBe('1');
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
      expect(webhook.events).toContain('merge_requests');
      expect(webhook.events).toContain('push');
      expect(webhook.isActive).toBe(true);
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
