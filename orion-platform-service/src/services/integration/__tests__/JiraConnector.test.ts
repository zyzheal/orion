/**
 * JiraConnector Tests
 *
 * Tests for the JiraConnector class covering:
 * - Metadata (name, version, capabilities)
 * - initialize (success, missing host, missing credentials)
 * - validateConfig
 * - testConnection (success, failure, network error)
 * - execute (all actions + unknown action + not initialized)
 * - transformEvent
 * - Error handling for API calls
 */

import { JiraConnector } from '../connectors/JiraConnector';
import { ConnectorCapability } from '../ConnectorRegistry';

// Mock global fetch
const originalFetch = global.fetch;
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('JiraConnector', () => {
  let connector: JiraConnector;

  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    connector = new JiraConnector();
  });

  // ==================== Metadata ====================

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(connector.name).toBe('jira');
    });

    it('should have correct version', () => {
      expect(connector.version).toBe('1.0.0');
    });

    it('should have IssueTracker and Notification capabilities', () => {
      expect(connector.capabilities).toContain(ConnectorCapability.IssueTracker);
      expect(connector.capabilities).toContain(ConnectorCapability.Notification);
    });

    it('should have exactly 2 capabilities', () => {
      expect(connector.capabilities).toHaveLength(2);
    });
  });

  // ==================== initialize ====================

  describe('initialize', () => {
    it('should initialize with host and token', async () => {
      await expect(
        connector.initialize({ host: 'https://company.atlassian.net', token: 'api-token' })
      ).resolves.toBeUndefined();
    });

    it('should initialize with host and username/password', async () => {
      await expect(
        connector.initialize({
          host: 'https://company.atlassian.net',
          username: 'user@example.com',
          password: 'pass',
        })
      ).resolves.toBeUndefined();
    });

    it('should strip trailing slash from host', async () => {
      await connector.initialize({
        host: 'https://company.atlassian.net/',
        token: 'token',
      });
      // Verify by checking testConnection URL
      mockFetch.mockResolvedValue({ ok: true });
      await connector.testConnection({ host: 'https://company.atlassian.net/', token: 'token' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://company.atlassian.net/rest/api/3/myself',
        expect.anything()
      );
    });

    it('should throw when host is missing', async () => {
      await expect(connector.initialize({ token: 'token' })).rejects.toThrow(
        'Jira host is required'
      );
    });

    it('should throw when neither token nor username/password is provided', async () => {
      await expect(
        connector.initialize({ host: 'https://company.atlassian.net' })
      ).rejects.toThrow('Jira token or username/password is required');
    });

    it('should use custom apiVersion when provided', async () => {
      await connector.initialize({
        host: 'https://company.atlassian.net',
        token: 'token',
        apiVersion: '2',
      });
      mockFetch.mockResolvedValue({ ok: true });
      await connector.testConnection({
        host: 'https://company.atlassian.net',
        token: 'token',
        apiVersion: '2',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://company.atlassian.net/rest/api/2/myself',
        expect.anything()
      );
    });
  });

  // ==================== validateConfig ====================

  describe('validateConfig', () => {
    it('should return true when host and token are present', async () => {
      const result = await connector.validateConfig({
        host: 'https://company.atlassian.net',
        token: 'abc',
      });
      expect(result).toBe(true);
    });

    it('should return true when host and username/password are present', async () => {
      const result = await connector.validateConfig({
        host: 'https://company.atlassian.net',
        username: 'user',
        password: 'pass',
      });
      expect(result).toBe(true);
    });

    it('should return false when host is missing', async () => {
      const result = await connector.validateConfig({ token: 'abc' });
      expect(result).toBe(false);
    });

    it('should return false when neither token nor username/password is provided', async () => {
      const result = await connector.validateConfig({
        host: 'https://company.atlassian.net',
      });
      expect(result).toBe(false);
    });
  });

  // ==================== testConnection ====================

  describe('testConnection', () => {
    it('should return true when API responds with ok (token auth)', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await connector.testConnection({
        host: 'https://company.atlassian.net',
        token: 'api-token',
      });
      expect(result).toBe(true);

      const expectedAuth = `Basic ${Buffer.from(':api-token').toString('base64')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        'https://company.atlassian.net/rest/api/3/myself',
        expect.objectContaining({
          headers: {
            'Authorization': expectedAuth,
            'Accept': 'application/json',
          },
        })
      );
    });

    it('should return true when API responds with ok (username/password auth)', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await connector.testConnection({
        host: 'https://company.atlassian.net',
        username: 'user@example.com',
        password: 'mypassword',
      });
      expect(result).toBe(true);

      const expectedAuth = `Basic ${Buffer.from('user@example.com:mypassword').toString('base64')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expectedAuth,
          }),
        })
      );
    });

    it('should return false when API responds with error status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const result = await connector.testConnection({
        host: 'https://company.atlassian.net',
        token: 'bad-token',
      });
      expect(result).toBe(false);
    });

    it('should return false when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await connector.testConnection({
        host: 'https://company.atlassian.net',
        token: 'token',
      });
      expect(result).toBe(false);
    });

    it('should use default apiVersion 3 when not specified', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await connector.testConnection({
        host: 'https://company.atlassian.net',
        token: 'token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/'),
        expect.anything()
      );
    });
  });

  // ==================== execute ====================

  describe('execute', () => {
    beforeEach(async () => {
      await connector.initialize({
        host: 'https://company.atlassian.net',
        token: 'test-token',
      });
    });

    it('should throw when not initialized', async () => {
      const freshConnector = new JiraConnector();
      await expect(
        freshConnector.execute('getProjects', {})
      ).rejects.toThrow('Connector not initialized');
    });

    it('should throw for unknown action', async () => {
      await expect(
        connector.execute('unknownAction', {})
      ).rejects.toThrow('Unknown action: unknownAction');
    });

    // ---- getProjects ----

    describe('getProjects', () => {
      it('should list projects', async () => {
        const projects = [{ id: '1', key: 'TEST', name: 'Test Project' }];
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(projects),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getProjects', {});
        expect(result).toEqual(projects);
      });

      it('should pass expand parameter', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('getProjects', { expand: 'lead' });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('expand=lead');
      });
    });

    // ---- getProject ----

    describe('getProject', () => {
      it('should get a project by key', async () => {
        const project = { id: '1', key: 'TEST', name: 'Test' };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(project),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getProject', { projectKey: 'TEST' });
        expect(result).toEqual(project);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/project/TEST'),
          expect.anything()
        );
      });

      it('should throw when projectKey is missing', async () => {
        await expect(connector.execute('getProject', {})).rejects.toThrow(
          'projectKey is required'
        );
      });
    });

    // ---- createIssue ----

    describe('createIssue', () => {
      it('should create an issue', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '10001', key: 'TEST-1' }),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('createIssue', {
          projectKey: 'TEST',
          summary: 'Bug report',
          issueType: 'Bug',
          description: 'A bug description',
          priority: 'High',
          labels: ['bug', 'urgent'],
          assigneeAccountId: 'user-123',
        });

        expect(result).toMatchObject({
          id: '10001',
          key: 'TEST-1',
        });
      });

      it('should create issue with minimal required params', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: '10002', key: 'TEST-2' }),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('createIssue', {
          projectKey: 'TEST',
          summary: 'Task',
          issueType: 'Task',
        });

        expect(result).toMatchObject({ id: '10002', key: 'TEST-2' });
      });

      it('should throw when required params are missing', async () => {
        await expect(
          connector.execute('createIssue', { projectKey: 'TEST' })
        ).rejects.toThrow('projectKey, summary, and issueType are required');
      });
    });

    // ---- updateIssue ----

    describe('updateIssue', () => {
      it('should update an issue', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('updateIssue', {
          issueKey: 'TEST-1',
          summary: 'Updated summary',
          description: 'Updated description',
          labels: ['updated'],
          assigneeAccountId: 'user-456',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issue/TEST-1'),
          expect.objectContaining({ method: 'PUT' })
        );
      });

      it('should clear assignee when assigneeAccountId is null', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('updateIssue', {
          issueKey: 'TEST-1',
          assigneeAccountId: null,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.fields.assignee).toBeNull();
      });

      it('should throw when issueKey is missing', async () => {
        await expect(
          connector.execute('updateIssue', { summary: 'test' })
        ).rejects.toThrow('issueKey is required');
      });
    });

    // ---- getIssue ----

    describe('getIssue', () => {
      it('should get an issue by key', async () => {
        const issue = { id: '10001', key: 'TEST-1', fields: { summary: 'Test' } };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(issue),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getIssue', { issueKey: 'TEST-1' });
        expect(result).toEqual(issue);
      });

      it('should pass fields parameter', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('getIssue', {
          issueKey: 'TEST-1',
          fields: ['summary', 'status'],
        });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('fields=summary%2Cstatus');
      });

      it('should throw when issueKey is missing', async () => {
        await expect(connector.execute('getIssue', {})).rejects.toThrow(
          'issueKey is required'
        );
      });
    });

    // ---- searchIssues ----

    describe('searchIssues', () => {
      it('should search issues with JQL', async () => {
        const searchResult = { issues: [], total: 0, maxResults: 50, startAt: 0 };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(searchResult),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('searchIssues', {
          jql: 'project = TEST',
          maxResults: 10,
          startAt: 0,
        });
        expect(result).toEqual(searchResult);
      });

      it('should pass fields parameter as array', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ issues: [], total: 0 }),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('searchIssues', {
          fields: ['summary', 'status'],
        });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('fields=summary%2Cstatus');
      });

      it('should pass fields parameter as string', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ issues: [], total: 0 }),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('searchIssues', {
          fields: 'summary,status',
        });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('fields=summary%2Cstatus');
      });
    });

    // ---- transitionIssue ----

    describe('transitionIssue', () => {
      it('should transition issue by ID', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({}),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('transitionIssue', {
          issueKey: 'TEST-1',
          transitionId: '31',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/issue/TEST-1/transitions'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should transition issue by name (fetching transitions first)', async () => {
        // First call: getTransitions
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({
              transitions: [
                { id: '31', name: 'In Progress', to: { name: 'In Progress', id: '3' } },
                { id: '41', name: 'Done', to: { name: 'Done', id: '5' } },
              ],
            }),
            text: jest.fn().mockResolvedValue(''),
          })
          // Second call: POST transition
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({}),
            text: jest.fn().mockResolvedValue(''),
          });

        await connector.execute('transitionIssue', {
          issueKey: 'TEST-1',
          transitionName: 'done',
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should throw when transition name is not found', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            transitions: [{ id: '31', name: 'In Progress', to: { name: 'In Progress', id: '3' } }],
          }),
          text: jest.fn().mockResolvedValue(''),
        });

        await expect(
          connector.execute('transitionIssue', {
            issueKey: 'TEST-1',
            transitionName: 'nonexistent',
          })
        ).rejects.toThrow("Transition 'nonexistent' not found");
      });

      it('should throw when issueKey is missing', async () => {
        await expect(
          connector.execute('transitionIssue', { transitionId: '31' })
        ).rejects.toThrow('issueKey is required');
      });

      it('should throw when neither transitionId nor transitionName is provided', async () => {
        await expect(
          connector.execute('transitionIssue', { issueKey: 'TEST-1' })
        ).rejects.toThrow('transitionId or transitionName is required');
      });
    });

    // ---- addComment ----

    describe('addComment', () => {
      it('should add a comment to an issue', async () => {
        const comment = { id: '10000', body: 'test comment', author: { displayName: 'User' } };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(comment),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('addComment', {
          issueKey: 'TEST-1',
          body: 'test comment',
        });

        expect(result).toEqual(comment);
      });

      it('should throw when issueKey is missing', async () => {
        await expect(
          connector.execute('addComment', { body: 'test' })
        ).rejects.toThrow('issueKey and body are required');
      });

      it('should throw when body is missing', async () => {
        await expect(
          connector.execute('addComment', { issueKey: 'TEST-1' })
        ).rejects.toThrow('issueKey and body are required');
      });
    });

    // ---- getTransitions ----

    describe('getTransitions', () => {
      it('should get transitions for an issue', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            transitions: [
              { id: '31', name: 'In Progress', to: { name: 'In Progress', id: '3' } },
            ],
          }),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getTransitions', { issueKey: 'TEST-1' });
        expect(result).toEqual([
          { id: '31', name: 'In Progress', to: { name: 'In Progress', id: '3' } },
        ]);
      });

      it('should throw when issueKey is missing', async () => {
        await expect(connector.execute('getTransitions', {})).rejects.toThrow(
          'issueKey is required'
        );
      });
    });

    // ---- getComments ----

    describe('getComments', () => {
      it('should get comments for an issue', async () => {
        const commentsResponse = {
          comments: [{ id: '1', body: 'hello' }],
          total: 1,
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(commentsResponse),
          text: jest.fn().mockResolvedValue(''),
        });

        const result = await connector.execute('getComments', { issueKey: 'TEST-1' });
        expect(result).toEqual(commentsResponse);
      });

      it('should pass pagination params', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ comments: [], total: 0 }),
          text: jest.fn().mockResolvedValue(''),
        });

        await connector.execute('getComments', {
          issueKey: 'TEST-1',
          startAt: 10,
          maxResults: 25,
        });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('startAt=10');
        expect(url).toContain('maxResults=25');
      });

      it('should throw when issueKey is missing', async () => {
        await expect(connector.execute('getComments', {})).rejects.toThrow(
          'issueKey is required'
        );
      });
    });
  });

  // ==================== API error handling ====================

  describe('API error handling', () => {
    beforeEach(async () => {
      await connector.initialize({
        host: 'https://company.atlassian.net',
        token: 'test-token',
      });
    });

    it('should throw OrionError when API returns error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      });

      await expect(
        connector.execute('getProjects', {})
      ).rejects.toThrow('Jira API error: 403 - Forbidden');
    });

    it('should throw SERVICE_UNAVAILABLE when credentials are missing', async () => {
      const freshConnector = new JiraConnector();
      await freshConnector.initialize({
        host: 'https://company.atlassian.net',
        token: 'x',
      });
      // Clear the config credentials
      (freshConnector as any).config = { host: 'https://company.atlassian.net' };

      await expect(
        freshConnector.execute('getProjects', {})
      ).rejects.toThrow('Jira credentials not configured');
    });
  });

  // ==================== transformEvent ====================

  describe('transformEvent', () => {
    it('should transform a jira:issue_created event', () => {
      const rawEvent = {
        webhookEvent: 'jira:issue_created',
        issue: { key: 'TEST-1' },
      };

      const event = connector.transformEvent(rawEvent);

      expect(event.type).toBe('jira:jira:issue_created');
      expect(event.source).toBe('jira');
      expect(event.payload).toBe(rawEvent);
      expect(event.externalId).toBe('TEST-1');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should transform a jira:issue_updated event', () => {
      const rawEvent = {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'TEST-2' },
      };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('jira:jira:issue_updated');
      expect(event.externalId).toBe('TEST-2');
    });

    it('should handle event without webhookEvent', () => {
      const rawEvent = { some_field: 'value' };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('jira:unknown');
      expect(event.source).toBe('jira');
      expect(event.externalId).toBeUndefined();
    });

    it('should handle event without issue', () => {
      const rawEvent = { webhookEvent: 'jira:issue_deleted' };

      const event = connector.transformEvent(rawEvent);
      expect(event.type).toBe('jira:jira:issue_deleted');
      expect(event.externalId).toBeUndefined();
    });
  });
});
