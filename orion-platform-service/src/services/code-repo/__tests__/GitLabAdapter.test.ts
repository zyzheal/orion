/**
 * GitLabAdapter 单元测试
 */

import { GitLabAdapter } from '../GitLabAdapter';
import { RepoType, PullRequestStatus, MergeStrategy } from '../types';

describe('GitLabAdapter', () => {
  let adapter: GitLabAdapter;

  beforeEach(() => {
    adapter = new GitLabAdapter({
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token',
    });
  });

  describe('type', () => {
    it('should return GITLAB type', () => {
      expect(adapter.type).toBe(RepoType.GITLAB);
    });
  });

  describe('getRepository', () => {
    it('should return repository info', async () => {
      const repo = await adapter.getRepository('group/test-project');

      expect(repo.id).toBe('group/test-project');
      expect(repo.name).toBe('test-project');
      expect(repo.fullName).toBe('group/test-project');
      expect(repo.type).toBe(RepoType.GITLAB);
      expect(repo.url).toContain('gitlab.example.com');
    });
  });

  describe('listRepositories', () => {
    it('should return array of repositories', async () => {
      const repos = await adapter.listRepositories();
      expect(Array.isArray(repos)).toBe(true);
    });
  });

  describe('branch management', () => {
    it('should return branch info', async () => {
      const branch = await adapter.getBranch('test-repo', 'main');

      expect(branch.name).toBe('main');
      expect(typeof branch.isProtected).toBe('boolean');
    });

    it('should list branches', async () => {
      const branches = await adapter.listBranches('test-repo');
      expect(Array.isArray(branches)).toBe(true);
    });

    it('should create a branch', async () => {
      const branch = await adapter.createBranch('test-repo', 'feature-branch', 'main');

      expect(branch.name).toBe('feature-branch');
    });

    it('should delete a branch', async () => {
      // Mock implementation, should not throw
      await expect(adapter.deleteBranch('test-repo', 'feature-branch')).resolves.not.toThrow();
    });

    it('should return branch protection status', async () => {
      const result = await adapter.getBranchProtection('test-repo', 'main');

      expect(typeof result.isProtected).toBe('boolean');
    });
  });

  describe('commit management', () => {
    it('should list commits', async () => {
      const commits = await adapter.listCommits('test-repo');
      expect(Array.isArray(commits)).toBe(true);
    });

    it('should return commit info', async () => {
      const commit = await adapter.getCommit('test-repo', 'abc123');

      expect(commit.sha).toBe('abc123');
    });
  });

  describe('pull request management', () => {
    it('should create a merge request', async () => {
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
      const mr = await adapter.getPullRequest('test-repo', '1');

      expect(mr.id).toBe('1');
    });

    it('should list merge requests', async () => {
      const mrs = await adapter.listPullRequests('test-repo', {
        state: PullRequestStatus.OPEN,
      });
      expect(Array.isArray(mrs)).toBe(true);
    });

    it('should merge a merge request', async () => {
      const mr = await adapter.mergePullRequest('test-repo', '1', {
        strategy: MergeStrategy.SQUASH_MERGE,
      });

      expect(mr.status).toBe(PullRequestStatus.MERGED);
      expect(mr.mergedAt).toBeDefined();
    });

    it('should close a merge request', async () => {
      const mr = await adapter.closePullRequest('test-repo', '1');

      expect(mr.status).toBe(PullRequestStatus.CLOSED);
      expect(mr.closedAt).toBeDefined();
    });

    it('should update a merge request', async () => {
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
      const review = await adapter.addReview('test-repo', '1', {
        content: 'LGTM',
        state: 'approve',
      });

      expect(review.content).toBe('LGTM');
      expect(review.state).toBe('approve');
      expect(review.pullRequestId).toBe('1');
    });

    it('should list reviews', async () => {
      const reviews = await adapter.listReviews('test-repo', '1');
      expect(Array.isArray(reviews)).toBe(true);
    });
  });

  describe('webhook management', () => {
    it('should create a webhook', async () => {
      const webhook = await adapter.createWebhook('test-repo', {
        url: 'https://example.com/webhook',
        events: ['merge_requests', 'push'],
        secret: 'secret-token',
      });

      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain('merge_requests');
      expect(webhook.isActive).toBe(true);
    });

    it('should list webhooks', async () => {
      const webhooks = await adapter.listWebhooks('test-repo');
      expect(Array.isArray(webhooks)).toBe(true);
    });

    it('should delete a webhook', async () => {
      await expect(adapter.deleteWebhook('test-repo', 'hook-1')).resolves.not.toThrow();
    });
  });
});
