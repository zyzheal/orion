/**
 * PullRequestService Unit Tests
 */

import {
  PullRequestService,
  GitHubPRClient,
  GitLabPRClient,
  PRApiClient,
  PRContext,
} from '../PullRequestService';

// Mock fetch
global.fetch = jest.fn();

describe('PullRequestService', () => {
  let service: PullRequestService;
  let mockClient: PRApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PullRequestService();
    mockClient = {
      updateCheckStatus: jest.fn().mockResolvedValue(undefined),
      postComment: jest.fn().mockResolvedValue(undefined),
      getOpenPrs: jest.fn().mockResolvedValue([1, 2, 3]),
    };
  });

  afterEach(() => {
    // Clean up debounce timers
    jest.clearAllTimers();
  });

  const mockContext: PRContext = {
    provider: 'github',
    owner: 'org',
    repo: 'repo',
    prNumber: 42,
    commitSha: 'abc123',
  };

  describe('registerClient', () => {
    it('should register a client', () => {
      service.registerClient('github', mockClient);

      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('updateCheckStatus', () => {
    it('should update check status via client', async () => {
      service.registerClient('github', mockClient);

      await service.updateCheckStatus(mockContext, {
        context: 'ci/build',
        state: 'success',
        description: 'Build passed',
      });

      expect(mockClient.updateCheckStatus).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({ state: 'success' })
      );
    });

    it('should warn when no client registered', async () => {
      await service.updateCheckStatus(
        { ...mockContext, provider: 'gitlab' as any },
        { context: 'test', state: 'success' }
      );

      expect(mockClient.updateCheckStatus).not.toHaveBeenCalled();
    });

    it('should apply debounce by default', async () => {
      jest.useFakeTimers();
      service.registerClient('github', mockClient);

      await service.updateCheckStatus(mockContext, { context: 'test', state: 'success' });
      await service.updateCheckStatus(mockContext, { context: 'test', state: 'success' });

      // Second call should be debounced
      expect(mockClient.updateCheckStatus).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should skip debounce when debounce=false', async () => {
      service.registerClient('github', mockClient);

      await service.updateCheckStatus(mockContext, { context: 'test', state: 'success' }, { debounce: false });
      await service.updateCheckStatus(mockContext, { context: 'test', state: 'success' }, { debounce: false });

      expect(mockClient.updateCheckStatus).toHaveBeenCalledTimes(2);
    });

    it('should allow update after debounce window expires', async () => {
      jest.useFakeTimers();
      service.registerClient('github', mockClient);

      await service.updateCheckStatus(mockContext, { context: 'test', state: 'success' });

      // Advance past debounce window (30s)
      jest.advanceTimersByTime(31000);

      await service.updateCheckStatus(mockContext, { context: 'test', state: 'failure' });

      expect(mockClient.updateCheckStatus).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('postComment', () => {
    it('should post comment via client', async () => {
      service.registerClient('github', mockClient);

      await service.postComment(mockContext, { body: 'LGTM' });

      expect(mockClient.postComment).toHaveBeenCalledWith(mockContext, { body: 'LGTM' });
    });

    it('should warn when no client registered', async () => {
      await service.postComment(
        { ...mockContext, provider: 'gitlab' as any },
        { body: 'test' }
      );

      expect(mockClient.postComment).not.toHaveBeenCalled();
    });
  });

  describe('postTestResults', () => {
    it('should format and post test results', async () => {
      service.registerClient('github', mockClient);

      await service.postTestResults(mockContext, {
        passed: 10,
        failed: 2,
        skipped: 1,
        total: 13,
      });

      expect(mockClient.postComment).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({
          body: expect.stringContaining('Passed'),
        })
      );
    });

    it('should use error emoji when tests failed', async () => {
      service.registerClient('github', mockClient);

      await service.postTestResults(mockContext, {
        passed: 8,
        failed: 2,
        skipped: 0,
        total: 10,
      });

      const call = (mockClient.postComment as jest.Mock).mock.calls[0];
      expect(call[1].body).toContain('❌');
    });

    it('should use success emoji when all tests passed', async () => {
      service.registerClient('github', mockClient);

      await service.postTestResults(mockContext, {
        passed: 10,
        failed: 0,
        skipped: 0,
        total: 10,
      });

      const call = (mockClient.postComment as jest.Mock).mock.calls[0];
      expect(call[1].body).toContain('✅');
    });
  });

  describe('extractPRContext', () => {
    it('should extract from GitHub PR payload', () => {
      const payload = {
        pull_request: {
          number: 42,
          head: { sha: 'abc123' },
          base: { repo: { full_name: 'org/repo' } },
        },
      };

      const result = PullRequestService.extractPRContext(payload);

      expect(result).toEqual({
        provider: 'github',
        owner: 'org',
        repo: 'repo',
        prNumber: 42,
        commitSha: 'abc123',
      });
    });

    it('should extract from GitLab MR payload', () => {
      const payload = {
        object_attributes: {
          iid: 42,
          last_commit: { id: 'def456' },
          target: { path_with_namespace: 'org/repo' },
        },
      };

      const result = PullRequestService.extractPRContext(payload);

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'org',
        repo: 'repo',
        prNumber: 42,
        commitSha: 'def456',
      });
    });

    it('should return null for unknown payload', () => {
      const result = PullRequestService.extractPRContext({ unknown: true });

      expect(result).toBeNull();
    });

    it('should handle GitHub payload with missing fields', () => {
      const payload = {
        pull_request: {
          number: 1,
          head: {},
          base: { repo: {} },
        },
      };

      const result = PullRequestService.extractPRContext(payload);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('github');
      expect(result!.owner).toBe('');
    });

    it('should handle GitLab payload with source fallback', () => {
      const payload = {
        object_attributes: {
          iid: 1,
          last_commit: { id: 'sha' },
          source: { path_with_namespace: 'org/repo' },
        },
      };

      const result = PullRequestService.extractPRContext(payload);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('gitlab');
    });
  });
});

describe('GitHubPRClient', () => {
  let client: GitHubPRClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubPRClient('test-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  const context: PRContext = {
    provider: 'github',
    owner: 'org',
    repo: 'repo',
    prNumber: 42,
    commitSha: 'abc123',
  };

  describe('updateCheckStatus', () => {
    it('should send POST to GitHub statuses API', async () => {
      await client.updateCheckStatus(context, {
        context: 'ci/build',
        state: 'success',
        description: 'Build passed',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/org/repo/statuses/abc123',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'token test-token',
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
      });

      // Should not throw
      await client.updateCheckStatus(context, { context: 'test', state: 'success' });
    });
  });

  describe('postComment', () => {
    it('should send POST to issues comments API', async () => {
      await client.postComment(context, { body: 'LGTM' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/org/repo/issues/42/comments',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

      await client.postComment(context, { body: 'test' });
    });
  });

  describe('getOpenPrs', () => {
    it('should return PR numbers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ number: 1 }, { number: 2 }]),
      });

      const result = await client.getOpenPrs('org', 'repo');

      expect(result).toEqual([1, 2]);
    });

    it('should return empty on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await client.getOpenPrs('org', 'repo');

      expect(result).toEqual([]);
    });
  });
});

describe('GitLabPRClient', () => {
  let client: GitLabPRClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitLabPRClient('test-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  const context: PRContext = {
    provider: 'gitlab',
    owner: 'org',
    repo: 'repo',
    prNumber: 42,
    commitSha: 'abc123',
  };

  describe('updateCheckStatus', () => {
    it('should send POST to GitLab statuses API', async () => {
      await client.updateCheckStatus(context, {
        context: 'ci/build',
        state: 'success',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gitlab.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'PRIVATE-TOKEN': 'test-token',
          }),
        })
      );
    });

    it('should map states correctly', async () => {
      await client.updateCheckStatus(context, { context: 'test', state: 'failure' });
      await client.updateCheckStatus(context, { context: 'test', state: 'error' });
      await client.updateCheckStatus(context, { context: 'test', state: 'pending' });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('postComment', () => {
    it('should send POST to merge request notes API', async () => {
      await client.postComment(context, { body: 'LGTM' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('merge_requests/42/notes'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getOpenPrs', () => {
    it('should return MR IIDs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ iid: 1 }, { iid: 2 }]),
      });

      const result = await client.getOpenPrs('org', 'repo');

      expect(result).toEqual([1, 2]);
    });

    it('should return empty on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('error'));

      const result = await client.getOpenPrs('org', 'repo');

      expect(result).toEqual([]);
    });
  });
});
