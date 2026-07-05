/**
 * GitLabConnector Tests
 *
 * Tests for the GitLabConnector class covering:
 * - Metadata (name, version, capabilities)
 * - initialize (success, missing token, custom host)
 * - validateConfig
 * - testConnection (success, failure, network error)
 * - execute (all actions + unknown action + not initialized)
 * - transformEvent
 * - Error handling for API calls
 */

import { GitLabConnector } from '../connectors/GitLabConnector';
import { ConnectorCapability } from '../ConnectorRegistry';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('GitLabConnector', () => {
  let connector: GitLabConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    connector = new GitLabConnector();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(connector.name).toBe('gitlab');
    });

    it('should have correct version', () => {
      expect(connector.version).toBe('1.0.0');
    });

    it('should have SourceControl, SourceRead, and CICD capabilities', () => {
      expect(connector.capabilities).toContain(ConnectorCapability.SourceControl);
      expect(connector.capabilities).toContain(ConnectorCapability.SourceRead);
      expect(connector.capabilities).toContain(ConnectorCapability.CICD);
    });

    it('should have exactly 3 capabilities', () => {
      expect(connector.capabilities).toHaveLength(3);
    });
  });

  describe('initialize', () => {
    it('should initialize with token', async () => {
      await expect(
        connector.initialize({ token: 'my-token' })
      ).resolves.toBeUndefined();
    });

    it('should initialize with custom host', async () => {
      await expect(
        connector.initialize({ token: 'token', host: 'https://gitlab.example.com/' })
      ).resolves.toBeUndefined();
    });

    it('should throw when token is missing', async () => {
      await expect(connector.initialize({})).rejects.toThrow('GitLab token is required');
    });

    it('should throw when token is empty string', async () => {
      await expect(connector.initialize({ token: '' })).rejects.toThrow(
        'GitLab token is required'
      );
    });
  });

  describe('validateConfig', () => {
    it('should return true when token is present', async () => {
      const result = await connector.validateConfig({ token: 'abc' });
      expect(result).toBe(true);
    });

    it('should return false when token is missing', async () => {
      const result = await connector.validateConfig({});
      expect(result).toBe(false);
    });

    it('should return false when token is empty string', async () => {
      const result = await connector.validateConfig({ token: '' });
      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true when API responds with ok', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await connector.testConnection({ token: 'valid-token' });
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/user',
        expect.objectContaining({
          headers: { 'PRIVATE-TOKEN': 'valid-token' },
        })
      );
    });

    it('should return false when API responds with error status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const result = await connector.testConnection({ token: 'bad-token' });
      expect(result).toBe(false);
    });

    it('should return false when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await connector.testConnection({ token: 'token' });
      expect(result).toBe(false);
    });

    it('should use custom host when provided', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await connector.testConnection({
        token: 'token',
        host: 'https://custom.gitlab.com/',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.gitlab.com/api/v4/user',
        expect.anything()
      );
    });

    it('should use default host when host is not provided', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await connector.testConnection({ token: 'token' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/user',
        expect.anything()
      );
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await connector.initialize({ token: 'test-token' });
    });

    it('should throw when not initialized', async () => {
      const freshConnector = new GitLabConnector();
      await expect(
        freshConnector.execute('listProjects', {})
      ).rejects.toThrow('Connector not initialized');
    });

    it('should throw for unknown action', async () => {
      await expect(
        connector.execute('unknownAction', {})
      ).rejects.toThrow('Unknown action: unknownAction');
    });

    describe('listProjects', () => {
      it('should list projects with default params', async () => {
        const projects = [{ id: 1, name: 'test-project' }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(projects),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('listProjects', {});
        expect(result).toEqual(projects);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v4/projects?'),
          expect.objectContaining({ headers: { 'PRIVATE-TOKEN': 'test-token' } })
        );
      });

      it('should pass search and membership params', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('listProjects', {
          page: 2,
          perPage: 10,
          search: 'my-project',
          membership: true,
        });

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('page=2');
        expect(url).toContain('per_page=10');
        expect(url).toContain('search=my-project');
        expect(url).toContain('membership=true');
      });
    });

    describe('listAllProjects', () => {
      it('should fetch all projects with pagination', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `p${i + 1}` }));
        const page2 = [{ id: 101, name: 'p101' }];

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(page1),
            text: jest.fn().mockResolvedValue(''),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(page2),
            text: jest.fn().mockResolvedValue(''),
          });

        const result = await connector.execute('listAllProjects', {});
        expect(result).toHaveLength(101);
      });

      it('should stop when empty page is returned', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('listAllProjects', {});
        expect(result).toEqual([]);
      });
    });

    describe('getProject', () => {
      it('should get a project by ID', async () => {
        const project = { id: 42, name: 'my-project' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(project),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getProject', { projectId: 42 });
        expect(result).toEqual(project);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/projects/42'),
          expect.anything()
        );
      });

      it('should throw when projectId is missing', async () => {
        await expect(connector.execute('getProject', {})).rejects.toThrow(
          'projectId is required'
        );
      });
    });

    describe('listBranches', () => {
      it('should list branches for a project', async () => {
        const branches = [{ name: 'main', protected: true }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(branches),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('listBranches', { projectId: 1 });
        expect(result).toEqual(branches);
      });

      it('should throw when projectId is missing', async () => {
        await expect(connector.execute('listBranches', {})).rejects.toThrow(
          'projectId is required'
        );
      });
    });

    describe('getCommit', () => {
      it('should get a commit by sha', async () => {
        const commit = { id: 'abc123', title: 'Fix bug' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(commit),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getCommit', {
          projectId: 1,
          sha: 'abc123',
        });
        expect(result).toEqual(commit);
      });

      it('should throw when projectId is missing', async () => {
        await expect(
          connector.execute('getCommit', { sha: 'abc' })
        ).rejects.toThrow('projectId and sha are required');
      });

      it('should throw when sha is missing', async () => {
        await expect(
          connector.execute('getCommit', { projectId: 1 })
        ).rejects.toThrow('projectId and sha are required');
      });
    });

    describe('listCommits', () => {
      it('should list commits for a project', async () => {
        const commits = [{ id: 'abc', title: 'commit 1' }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(commits),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('listCommits', {
          projectId: 1,
          refName: 'main',
        });
        expect(result).toEqual(commits);
      });

      it('should throw when projectId is missing', async () => {
        await expect(connector.execute('listCommits', {})).rejects.toThrow(
          'projectId is required'
        );
      });
    });

    describe('createMergeRequest', () => {
      it('should create a merge request', async () => {
        const mr = { id: 1, iid: 1, title: 'New MR' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mr),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('createMergeRequest', {
          projectId: 1,
          sourceBranch: 'feature',
          targetBranch: 'main',
          title: 'New MR',
          description: 'Some description',
        });
        expect(result).toEqual(mr);
      });

      it('should throw when required params are missing', async () => {
        await expect(
          connector.execute('createMergeRequest', { projectId: 1 })
        ).rejects.toThrow('projectId, sourceBranch, targetBranch, and title are required');
      });
    });

    describe('listMergeRequests', () => {
      it('should list merge requests', async () => {
        const mrs = [{ id: 1, title: 'MR 1' }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mrs),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('listMergeRequests', {
          projectId: 1,
          state: 'opened',
        });
        expect(result).toEqual(mrs);
      });

      it('should throw when projectId is missing', async () => {
        await expect(connector.execute('listMergeRequests', {})).rejects.toThrow(
          'projectId is required'
        );
      });
    });

    describe('triggerPipeline', () => {
      it('should trigger a pipeline', async () => {
        const pipeline = { id: 99, status: 'created' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(pipeline),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('triggerPipeline', {
          projectId: 1,
          ref: 'main',
          variables: { ENV: 'staging' },
        });
        expect(result).toEqual(pipeline);
      });

      it('should throw when projectId or ref is missing', async () => {
        await expect(
          connector.execute('triggerPipeline', { projectId: 1 })
        ).rejects.toThrow('projectId and ref are required');
        await expect(
          connector.execute('triggerPipeline', { ref: 'main' })
        ).rejects.toThrow('projectId and ref are required');
      });
    });

    describe('getPipelineStatus', () => {
      it('should get pipeline status', async () => {
        const pipeline = { id: 10, status: 'success' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(pipeline),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getPipelineStatus', {
          projectId: 1,
          pipelineId: 10,
        });
        expect(result).toEqual(pipeline);
      });

      it('should throw when required params are missing', async () => {
        await expect(
          connector.execute('getPipelineStatus', { projectId: 1 })
        ).rejects.toThrow('projectId and pipelineId are required');
      });
    });

    describe('getPipelineJobs', () => {
      it('should get pipeline jobs', async () => {
        const jobs = [{ id: 1, name: 'build', status: 'success' }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(jobs),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getPipelineJobs', {
          projectId: 1,
          pipelineId: 10,
        });
        expect(result).toEqual(jobs);
      });

      it('should throw when required params are missing', async () => {
        await expect(
          connector.execute('getPipelineJobs', { projectId: 1 })
        ).rejects.toThrow('projectId and pipelineId are required');
      });
    });
  });

  describe('API error handling', () => {
    beforeEach(async () => {
      await connector.initialize({ token: 'test-token' });
    });

    it('should throw OrionError when API returns error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      });

      await expect(
        connector.execute('listProjects', {})
      ).rejects.toThrow('GitLab API error: 403 - Forbidden');
    });

    it('should throw SERVICE_UNAVAILABLE when token is not set', async () => {
      const freshConnector = new GitLabConnector();
      // Bypass initialize to have no token
      (freshConnector as any).config = {};
      (freshConnector as any).baseUrl = 'https://gitlab.com';

      // We need to call initialize with a token first, then clear it
      await freshConnector.initialize({ token: 'x' });
      (freshConnector as any).config = { token: '' };

      // This should fail because token is empty/falsy
      await expect(
        freshConnector.execute('listProjects', {})
      ).rejects.toThrow('GitLab token not configured');
    });
  });

  describe('transformEvent', () => {
    it('should transform a push event', () => {
      const rawEvent = {
        object_kind: 'push',
        object_attributes: { id: 123 },
        ref: 'refs/heads/main',
      };

      const event = connector.transformEvent(rawEvent);

      expect(event.type).toBe('gitlab:push');
      expect(event.source).toBe('gitlab');
      expect(event.payload).toBe(rawEvent);
      expect(event.externalId).toBe('123');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should transform a merge_request event', () => {
      const rawEvent = {
        object_kind: 'merge_request',
        object_attributes: { id: 456 },
      };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('gitlab:merge_request');
      expect(event.externalId).toBe('456');
    });

    it('should handle event without object_kind', () => {
      const rawEvent = { some_field: 'value' };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('gitlab:unknown');
      expect(event.source).toBe('gitlab');
      expect(event.externalId).toBeUndefined();
    });

    it('should handle event with object_attributes but no id', () => {
      const rawEvent = {
        object_kind: 'pipeline',
        object_attributes: {},
      };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('gitlab:pipeline');
      expect(event.externalId).toBeUndefined();
    });
  });
});
