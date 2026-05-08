/**
 * SCMWebhookService tests
 */

import { SCMWebhookService, SCMTriggerRule } from '../SCMWebhookService';

// Mock crypto
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomBytes: () => ({ toString: () => 'abcd1234' }),
  };
});

describe('SCMWebhookService', () => {
  let service: SCMWebhookService;

  beforeEach(() => {
    service = new SCMWebhookService(null);
    delete process.env.SCM_WEBHOOK_SECRET;
  });

  describe('validateGitHubSignature', () => {
    it('skips validation when no secret configured', () => {
      delete process.env.SCM_WEBHOOK_SECRET;
      const localService = new SCMWebhookService(null);
      const result = localService.validateGitHubSignature('{"ref":"main"}', 'sha256=anything');
      expect(result).toBe(true);
    });

    it('validates correct HMAC signature', () => {
      process.env.SCM_WEBHOOK_SECRET = 'my-secret';
      const localService = new SCMWebhookService(null);
      const crypto = jest.requireActual('crypto');
      const expectedSig = crypto.createHmac('sha256', 'my-secret').update('{"ref":"main"}').digest('hex');

      const result = localService.validateGitHubSignature('{"ref":"main"}', `sha256=${expectedSig}`);
      expect(result).toBe(true);
    });

    it('rejects invalid signature', () => {
      process.env.SCM_WEBHOOK_SECRET = 'my-secret';
      const localService = new SCMWebhookService(null);
      const result = localService.validateGitHubSignature('{"ref":"main"}', 'sha256=invalidsignature');
      expect(result).toBe(false);
    });
  });

  describe('validateGitLabToken', () => {
    it('skips validation when no secret configured', () => {
      delete process.env.SCM_WEBHOOK_SECRET;
      const localService = new SCMWebhookService(null);
      const result = localService.validateGitLabToken('any-token');
      expect(result).toBe(true);
    });

    it('validates matching token', () => {
      process.env.SCM_WEBHOOK_SECRET = 'my-secret';
      const localService = new SCMWebhookService(null);
      const result = localService.validateGitLabToken('my-secret');
      expect(result).toBe(true);
    });

    it('rejects non-matching token', () => {
      process.env.SCM_WEBHOOK_SECRET = 'my-secret';
      const localService = new SCMWebhookService(null);
      const result = localService.validateGitLabToken('wrong-token');
      expect(result).toBe(false);
    });
  });

  describe('handleGitHubPush', () => {
    it('parses GitHub push payload', async () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123def',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'developer' },
        head_commit: { message: 'Fix bug' },
      };

      const event = await service.handleGitHubPush(payload);
      expect(event.provider).toBe('github');
      expect(event.repository).toBe('org/repo');
      expect(event.branch).toBe('main');
      expect(event.commitSha).toBe('abc123def');
      expect(event.pusher).toBe('developer');
      expect(event.commitMessage).toBe('Fix bug');
    });

    it('rejects invalid signature', async () => {
      process.env.SCM_WEBHOOK_SECRET = 'secret';
      const localService = new SCMWebhookService(null);
      const payload = { ref: 'refs/heads/main', after: 'abc123' };

      await expect(localService.handleGitHubPush(payload, 'sha256=invalid')).rejects.toThrow('Invalid GitHub webhook signature');
    });
  });

  describe('handleGitLabPush', () => {
    it('parses GitLab push payload', async () => {
      const payload = {
        ref: 'refs/heads/feature',
        after: 'def456abc',
        project: { path_with_namespace: 'group/project' },
        user_name: 'gitlab-user',
        commits: [{ message: 'Add feature' }],
      };

      const event = await service.handleGitLabPush(payload);
      expect(event.provider).toBe('gitlab');
      expect(event.repository).toBe('group/project');
      expect(event.branch).toBe('feature');
      expect(event.commitSha).toBe('def456abc');
      expect(event.pusher).toBe('gitlab-user');
    });

    it('rejects invalid token', async () => {
      process.env.SCM_WEBHOOK_SECRET = 'secret';
      const localService = new SCMWebhookService(null);
      const payload = { ref: 'refs/heads/main' };

      await expect(localService.handleGitLabPush(payload, 'wrong-token')).rejects.toThrow('Invalid GitLab webhook token');
    });
  });

  describe('matchPipelines', () => {
    it('matches pipeline by repository and branch', async () => {
      const rules: SCMTriggerRule[] = [
        {
          pipelineId: 'pipeline-1',
          repository: 'org/repo',
          branchPattern: 'main',
          events: ['push'],
        },
      ];
      service.setTriggerRules(rules);

      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'dev' },
      };

      const event = await service.handleGitHubPush(payload);
      expect(event.matchedPipelines).toContain('pipeline-1');
    });

    it('matches pipeline with wildcard repository', async () => {
      const rules: SCMTriggerRule[] = [
        {
          pipelineId: 'pipeline-2',
          repository: '*',
          branchPattern: 'main',
          events: ['push'],
        },
      ];
      service.setTriggerRules(rules);

      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        repository: { full_name: 'any/repo' },
        pusher: { name: 'dev' },
      };

      const event = await service.handleGitHubPush(payload);
      expect(event.matchedPipelines).toContain('pipeline-2');
    });

    it('does not match wrong branch', async () => {
      const rules: SCMTriggerRule[] = [
        {
          pipelineId: 'pipeline-1',
          repository: 'org/repo',
          branchPattern: 'main',
          events: ['push'],
        },
      ];
      service.setTriggerRules(rules);

      const payload = {
        ref: 'refs/heads/feature',
        after: 'abc123',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'dev' },
      };

      const event = await service.handleGitHubPush(payload);
      expect(event.matchedPipelines).toHaveLength(0);
    });

    it('matches with refs/heads/* pattern', async () => {
      const rules: SCMTriggerRule[] = [
        {
          pipelineId: 'pipeline-1',
          repository: '*',
          branchPattern: 'refs/heads/*',
          events: ['push'],
        },
      ];
      service.setTriggerRules(rules);

      const payload = {
        ref: 'refs/heads/any-branch',
        after: 'abc123',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'dev' },
      };

      const event = await service.handleGitHubPush(payload);
      expect(event.matchedPipelines).toContain('pipeline-1');
    });
  });

  describe('getEvents', () => {
    it('stores webhook events', async () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'dev' },
      };

      await service.handleGitHubPush(payload);
      const events = service.getEvents();

      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe('github');
    });

    it('limits stored events to 100', async () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        repository: { full_name: 'org/repo' },
        pusher: { name: 'dev' },
      };

      for (let i = 0; i < 110; i++) {
        await service.handleGitHubPush(payload);
      }

      // getEvents defaults to 20, so request 110 to verify the cap
      expect(service.getEvents(110)).toHaveLength(100);
    });
  });
});
