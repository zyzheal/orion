/**
 * CodeRepoWebhookService 单元测试
 */

import { CodeRepoWebhookService } from '../WebhookService';
import { WebhookEventType, RepoType, PullRequestStatus } from '../types';

describe('CodeRepoWebhookService', () => {
  let service: CodeRepoWebhookService;

  beforeEach(() => {
    service = new CodeRepoWebhookService();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const svc = new CodeRepoWebhookService();
      expect(svc).toBeDefined();
    });

    it('should accept custom source', () => {
      const svc = new CodeRepoWebhookService({ source: 'custom-source' });
      expect(svc).toBeDefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should pass when no secret is configured', () => {
      const result = service.verifyWebhookSignature(
        'test-repo',
        '{}',
        {}
      );
      expect(result).toBe(true);
    });

    it('should validate GitLab token', () => {
      service.registerWebhookSecret('test-repo', 'secret-token');

      const result = service.verifyWebhookSignature(
        'test-repo',
        '{}',
        { 'x-gitlab-token': 'secret-token' }
      );
      expect(result).toBe(true);
    });

    it('should reject invalid GitLab token', () => {
      service.registerWebhookSecret('test-repo', 'secret-token');

      const result = service.verifyWebhookSignature(
        'test-repo',
        '{}',
        { 'x-gitlab-token': 'wrong-token' }
      );
      expect(result).toBe(false);
    });
  });

  describe('handleGitLabWebhook', () => {
    it('should handle merge_request opened event', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature-branch',
          target_branch: 'main',
          state: 'opened',
          action: 'open',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          web_url: 'https://gitlab.example.com/group/test-project',
        },
        user: {
          username: 'developer',
          name: 'Developer',
        },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_OPENED);
      expect(result.eventId).toBe('mock-event-id');
    });

    it('should handle merge_request merged event', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature-branch',
          target_branch: 'main',
          state: 'merged',
          action: 'merge',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        user: { username: 'developer' },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_MERGED);
    });

    it('should handle merge_request closed event', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature-branch',
          target_branch: 'main',
          state: 'closed',
          action: 'close',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        user: { username: 'developer' },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_CLOSED);
    });

    it('should handle push event', async () => {
      const payload = {
        object_kind: 'push',
        ref: 'refs/heads/main',
        after: 'abc123',
        user_name: 'developer',
        commits: [
          { message: 'Fix bug', id: 'abc123' },
        ],
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          web_url: 'https://gitlab.example.com/group/test-project',
        },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PUSH);
    });

    it('should handle note (review) event', async () => {
      const payload = {
        object_kind: 'note',
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        object_attributes: {
          note: 'LGTM',
        },
        merge_request: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature',
          target_branch: 'main',
          state: 'opened',
        },
        user: { username: 'reviewer' },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_REVIEWED);
    });

    it('should emit event on processing', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature-branch',
          target_branch: 'main',
          state: 'opened',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        user: { username: 'developer' },
      };

      const eventPromise = new Promise<any>((resolve) => {
        service.once(WebhookEventType.PR_OPENED, (data) => resolve(data));
      });

      await service.handleGitLabWebhook(payload);
      const emitted = await eventPromise;

      expect(emitted.eventType).toBe(WebhookEventType.PR_OPENED);
      expect(emitted.repository.name).toBe('test-project');
    });

    it('should return error for unsupported event', async () => {
      const payload = { object_kind: 'wiki' };
      const result = await service.handleGitLabWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('handleGerritWebhook', () => {
    it('should handle change-merged event', async () => {
      const payload = {
        type: 'change-merged',
        project: {
          name: 'test-project',
        },
        change: {
          number: 12345,
          changeId: 'Iabc123',
          subject: 'Fix bug',
          branch: 'refs/heads/master',
          owner: { name: 'developer' },
        },
      };

      const result = await service.handleGerritWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_MERGED);
    });

    it('should handle change-created event', async () => {
      const payload = {
        type: 'change-created',
        project: {
          name: 'test-project',
        },
        change: {
          number: 12345,
          changeId: 'Iabc123',
          subject: 'New feature',
          branch: 'refs/heads/master',
          owner: { name: 'developer' },
        },
      };

      const result = await service.handleGerritWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_OPENED);
    });

    it('should handle change-abandoned event', async () => {
      const payload = {
        type: 'change-abandoned',
        project: {
          name: 'test-project',
        },
        change: {
          number: 12345,
          changeId: 'Iabc123',
          subject: 'Abandoned feature',
          branch: 'refs/heads/master',
        },
      };

      const result = await service.handleGerritWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_CLOSED);
    });

    it('should handle comment-added event', async () => {
      const payload = {
        type: 'comment-added',
        project: {
          name: 'test-project',
        },
        change: {
          number: 12345,
          subject: 'Test change',
          branch: 'refs/heads/master',
        },
      };

      const result = await service.handleGerritWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_REVIEWED);
    });

    it('should return error for unsupported event', async () => {
      const payload = { type: 'unknown-event' };
      const result = await service.handleGerritWebhook(payload);

      expect(result.success).toBe(false);
    });
  });

  describe('handleGitHubWebhook', () => {
    it('should handle pull_request opened event', async () => {
      const payload = {
        action: 'opened',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'org/test-repo',
          html_url: 'https://github.com/org/test-repo',
        },
        pull_request: {
          number: 1,
          title: 'Test PR',
          state: 'open',
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
          user: { login: 'developer' },
          html_url: 'https://github.com/org/test-repo/pull/1',
        },
      };

      const result = await service.handleGitHubWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_OPENED);
    });

    it('should handle pull_request closed with merge', async () => {
      const payload = {
        action: 'closed',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'org/test-repo',
        },
        pull_request: {
          number: 1,
          title: 'Test PR',
          state: 'closed',
          merged: true,
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
          user: { login: 'developer' },
        },
      };

      const result = await service.handleGitHubWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_MERGED);
    });

    it('should handle pull_request closed without merge', async () => {
      const payload = {
        action: 'closed',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'org/test-repo',
        },
        pull_request: {
          number: 1,
          title: 'Test PR',
          state: 'closed',
          merged: false,
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
          user: { login: 'developer' },
        },
      };

      const result = await service.handleGitHubWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe(WebhookEventType.PR_CLOSED);
    });

    it('should return error for unsupported action', async () => {
      const payload = { action: 'labeled' };
      const result = await service.handleGitHubWebhook(payload);

      expect(result.success).toBe(false);
    });
  });

  describe('getEventLog', () => {
    it('should record processed events', async () => {
      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature',
          target_branch: 'main',
          state: 'opened',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        user: { username: 'developer' },
      };

      await service.handleGitLabWebhook(payload);

      const logs = service.getEventLog();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].eventType).toBe(WebhookEventType.PR_OPENED);
      expect(logs[0].success).toBe(true);
    });

    it('should filter by event type', async () => {
      const pushPayload = {
        object_kind: 'push',
        ref: 'refs/heads/main',
        after: 'abc123',
        project: { id: 1, name: 'test', path_with_namespace: 'group/test' },
      };

      await service.handleGitLabWebhook(pushPayload);

      const logs = service.getEventLog({ eventType: WebhookEventType.PUSH });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].eventType).toBe(WebhookEventType.PUSH);
    });

    it('should respect limit parameter', async () => {
      // Generate multiple events
      for (let i = 0; i < 5; i++) {
        await service.handleGitLabWebhook({
          object_kind: 'push',
          ref: 'refs/heads/main',
          after: `sha-${i}`,
          project: { id: 1, name: 'test', path_with_namespace: 'group/test' },
        });
      }

      const logs = service.getEventLog({ limit: 2 });
      expect(logs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('setEventPublisher', () => {
    it('should use custom event publisher', async () => {
      const mockPublisher = {
        publish: jest.fn().mockResolvedValue('custom-event-id'),
      };

      service.setEventPublisher(mockPublisher);

      const payload = {
        object_kind: 'merge_request',
        object_attributes: {
          iid: 1,
          title: 'Test MR',
          source_branch: 'feature',
          target_branch: 'main',
          state: 'opened',
        },
        project: {
          id: 123,
          name: 'test-project',
          path_with_namespace: 'group/test-project',
        },
        user: { username: 'developer' },
      };

      const result = await service.handleGitLabWebhook(payload);

      expect(result.eventId).toBe('custom-event-id');
      expect(mockPublisher.publish).toHaveBeenCalled();
    });
  });
});
