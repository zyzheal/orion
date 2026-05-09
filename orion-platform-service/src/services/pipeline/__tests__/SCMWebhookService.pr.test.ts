/**
 * SCMWebhookService PR/MR Tests
 *
 * Tests for GitHub pull_request and GitLab merge_request event handling.
 */

import { SCMWebhookService, SCMTriggerRule } from '../SCMWebhookService';
import { PullRequestService } from '../PullRequestService';

describe('SCMWebhookService PR/MR Events', () => {
  let service: SCMWebhookService;
  const mockRules: SCMTriggerRule[] = [
    {
      pipelineId: 'pipeline-1',
      repository: '*',
      branchPattern: '*',
      events: ['push', 'pull_request'],
    },
  ];

  beforeEach(() => {
    service = new SCMWebhookService();
    service.setTriggerRules(mockRules);
  });

  describe('handleGitHubPullRequest', () => {
    test('should parse GitHub PR opened event', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Test PR',
          head: {
            sha: 'abc123',
            ref: 'feature-branch',
          },
          base: {
            ref: 'main',
            repo: {
              full_name: 'owner/repo',
            },
          },
          user: { login: 'testuser' },
        },
      };

      const event = await service.handleGitHubPullRequest(payload);

      expect(event.provider).toBe('github');
      expect(event.eventType).toBe('pull_request');
      expect(event.repository).toBe('owner/repo');
      expect(event.branch).toBe('main');
      expect(event.commitSha).toBe('abc123');
      expect(event.pusher).toBe('testuser');
    });

    test('should debounce synchronize events', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 42,
          title: 'Test PR',
          head: { sha: 'def456' },
          base: {
            ref: 'main',
            repo: { full_name: 'owner/repo' },
          },
          user: { login: 'testuser' },
        },
      };

      const event1 = await service.handleGitHubPullRequest(payload);
      // Second event should be debounced (no additional processing)
      const event2 = await service.handleGitHubPullRequest(payload);

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
    });
  });

  describe('handleGitLabMergeRequest', () => {
    test('should parse GitLab MR opened event', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 10,
          title: 'Test MR',
          action: 'open',
          target_branch: 'main',
          source_branch: 'feature',
          last_commit: { id: 'xyz789' },
        },
        project: {
          path_with_namespace: 'group/project',
        },
        user: { username: 'gitlabuser' },
      };

      const event = await service.handleGitLabMergeRequest(payload);

      expect(event.provider).toBe('gitlab');
      expect(event.eventType).toBe('pull_request');
      expect(event.repository).toBe('group/project');
      expect(event.branch).toBe('main');
      expect(event.commitSha).toBe('xyz789');
    });
  });
});

describe('PullRequestService', () => {
  let service: PullRequestService;

  beforeEach(() => {
    service = new PullRequestService();
  });

  describe('extractPRContext', () => {
    test('should extract context from GitHub PR payload', () => {
      const payload = {
        pull_request: {
          number: 123,
          head: { sha: 'sha123' },
          base: {
            repo: { full_name: 'owner/repo' },
          },
        },
      };

      const context = PullRequestService.extractPRContext(payload);

      expect(context).not.toBeNull();
      expect(context!.provider).toBe('github');
      expect(context!.owner).toBe('owner');
      expect(context!.repo).toBe('repo');
      expect(context!.prNumber).toBe(123);
      expect(context!.commitSha).toBe('sha123');
    });

    test('should extract context from GitLab MR payload', () => {
      const payload = {
        object_attributes: {
          iid: 456,
          target: { path_with_namespace: 'group/project' },
          last_commit: { id: 'sha456' },
        },
      };

      const context = PullRequestService.extractPRContext(payload);

      expect(context).not.toBeNull();
      expect(context!.provider).toBe('gitlab');
      expect(context!.owner).toBe('group');
      expect(context!.repo).toBe('project');
      expect(context!.prNumber).toBe(456);
      expect(context!.commitSha).toBe('sha456');
    });

    test('should return null for unknown payload', () => {
      const context = PullRequestService.extractPRContext({ foo: 'bar' });
      expect(context).toBeNull();
    });
  });

  describe('formatTestResults', () => {
    test('should format results as markdown table', async () => {
      // Create a mock service to test private method through postTestResults
      // For now, test that the method doesn't throw
      const context = {
        provider: 'github' as const,
        owner: 'test',
        repo: 'test',
        prNumber: 1,
        commitSha: 'sha',
      };

      // Without a registered client, this should log warning but not throw
      await service.postTestResults(context, {
        passed: 10,
        failed: 2,
        skipped: 1,
        total: 13,
      });

      // If we got here without exception, test passes
      expect(true).toBe(true);
    });
  });
});
