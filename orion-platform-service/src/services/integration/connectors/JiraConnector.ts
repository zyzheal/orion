/**
 * Jira Connector - Integration with Jira for issue tracking and notifications
 *
 * Capabilities: IssueTracker, Notification
 */

import {
  Connector,
  ConnectorCapability,
  ConnectorConfig,
  IntegrationEvent,
} from '../ConnectorRegistry';
import { OrionError, ErrorCode } from '../../../../errors';

// Jira API response types
interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  style: string;
  isPrivate: boolean;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    priority: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    reporter: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    } | null;
    assignee: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    } | null;
    created: string;
    updated: string;
    resolutiondate: string | null;
    labels: string[];
    components: Array<{
      id: string;
      name: string;
    }>;
    fixVersions: Array<{
      id: string;
      name: string;
    }>;
    [key: string]: unknown;
  };
}

interface JiraTransition {
  id: string;
  name: string;
  to: {
    name: string;
    id: string;
  };
}

interface JiraComment {
  id: string;
  body: string | {
    content: Array<{
      content: Array<{
        text: string;
      }>;
    }>;
  };
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  updated: string;
}

interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

/**
 * Jira Connector implementation
 */
export class JiraConnector implements Connector {
  name = 'jira';
  version = '1.0.0';
  capabilities: ConnectorCapability[] = [
    ConnectorCapability.IssueTracker,
    ConnectorCapability.Notification,
  ];

  private config: ConnectorConfig | null = null;
  private baseUrl: string = '';
  private apiVersion: string = '3';

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;

    if (!config.host) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Jira host is required (e.g., https://yourcompany.atlassian.net)');
    }

    this.baseUrl = config.host.replace(/\/$/, '');

    if (config.apiVersion) {
      this.apiVersion = config.apiVersion;
    }

    // Validate required config
    if (!config.token && !(config.username && config.password)) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Jira token or username/password is required');
    }
  }

  async validateConfig(config: ConnectorConfig): Promise<boolean> {
    if (!config.host) {
      return false;
    }
    if (!config.token && !(config.username && config.password)) {
      return false;
    }
    return true;
  }

  async testConnection(config: ConnectorConfig): Promise<boolean> {
    try {
      const baseUrl = config.host?.replace(/\/$/, '') || '';
      const version = config.apiVersion || '3';

      const auth = config.token
        ? `Basic ${Buffer.from(`:${config.token}`).toString('base64')}`
        : `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

      const response = await fetch(`${baseUrl}/rest/api/${version}/myself`, {
        headers: {
          'Authorization': auth,
          'Accept': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.config) {
      throw new Error('Connector not initialized. Call initialize() first.');
    }

    switch (action) {
      case 'getProjects':
        return this.getProjects(params);
      case 'getProject':
        return this.getProject(params);
      case 'createIssue':
        return this.createIssue(params);
      case 'updateIssue':
        return this.updateIssue(params);
      case 'getIssue':
        return this.getIssue(params);
      case 'searchIssues':
        return this.searchIssues(params);
      case 'transitionIssue':
        return this.transitionIssue(params);
      case 'addComment':
        return this.addComment(params);
      case 'getTransitions':
        return this.getTransitions(params);
      case 'getComments':
        return this.getComments(params);
      default:
        throw new OrionError(ErrorCode.NOT_FOUND, `Unknown action: ${action}`);
    }
  }

  transformEvent(rawEvent: unknown): IntegrationEvent {
    const event = rawEvent as Record<string, unknown>;
    const webhookEvent = event.webhookEvent as string || 'unknown';

    return {
      type: `jira:${webhookEvent}`,
      source: 'jira',
      payload: event,
      timestamp: new Date(),
      externalId: (event.issue as any)?.key,
    };
  }

  // Actions implementation

  private async getProjects(params: Record<string, unknown>): Promise<JiraProject[]> {
    const { expand } = params;
    const queryParams = new URLSearchParams();
    if (expand) queryParams.append('expand', String(expand));

    const response = await this.apiGet(`/project?${queryParams}`);
    return response as JiraProject[];
  }

  private async getProject(params: Record<string, unknown>): Promise<JiraProject> {
    const { projectKey } = params;
    if (!projectKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'projectKey is required');
    }

    const response = await this.apiGet(`/project/${encodeURIComponent(String(projectKey))}`);
    return response as JiraProject;
  }

  private async createIssue(params: Record<string, unknown>): Promise<JiraIssue> {
    const { projectKey, summary, description, issueType, priority, labels, assigneeAccountId } = params;

    if (!projectKey || !summary || !issueType) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'projectKey, summary, and issueType are required');
    }

    const fields: Record<string, unknown> = {
      project: { key: String(projectKey) },
      summary: String(summary),
      issuetype: { name: String(issueType) },
    };

    if (description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: String(description),
              },
            ],
          },
        ],
      };
    }

    if (priority) {
      fields.priority = { name: String(priority) };
    }

    if (labels && Array.isArray(labels)) {
      fields.labels = labels;
    }

    if (assigneeAccountId) {
      fields.assignee = { accountId: String(assigneeAccountId) };
    }

    const response = await this.apiPost('/issue', { fields });
    // Return the created issue data directly from the response
    return {
      id: (response as { id: string }).id,
      key: (response as { key: string }).key,
      fields: {
        summary: String(summary),
        description: description ? String(description) : null,
        status: { name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
        priority: priority ? { name: String(priority) } : { name: 'Medium' },
        issuetype: { id: '', name: String(issueType) },
        reporter: null,
        assignee: assigneeAccountId ? { accountId: String(assigneeAccountId), displayName: '', emailAddress: '' } : null,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        resolutiondate: null,
        labels: (labels as string[]) || [],
        components: [],
        fixVersions: [],
      },
    } as unknown as JiraIssue;
  }

  private async updateIssue(params: Record<string, unknown>): Promise<unknown> {
    const { issueKey, summary, description, labels, assigneeAccountId } = params;

    if (!issueKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey is required');
    }

    const fields: Record<string, unknown> = {};

    if (summary) {
      fields.summary = String(summary);
    }

    if (description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: String(description),
              },
            ],
          },
        ],
      };
    }

    if (labels && Array.isArray(labels)) {
      fields.labels = labels;
    }

    if (assigneeAccountId !== undefined) {
      fields.assignee = assigneeAccountId ? { accountId: String(assigneeAccountId) } : null;
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(fields).length > 0) {
      update.fields = fields;
    }

    return this.apiPut(`/issue/${encodeURIComponent(String(issueKey))}`, update);
  }

  private async getIssue(params: Record<string, unknown>): Promise<JiraIssue> {
    const { issueKey, fields: fieldsParam } = params;
    if (!issueKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey is required');
    }

    let endpoint = `/issue/${encodeURIComponent(String(issueKey))}`;
    if (fieldsParam) {
      const fields = Array.isArray(fieldsParam) ? fieldsParam.join(',') : String(fieldsParam);
      endpoint += `?fields=${encodeURIComponent(fields)}`;
    }

    const response = await this.apiGet(endpoint);
    return response as unknown as JiraIssue;
  }

  private async searchIssues(params: Record<string, unknown>): Promise<JiraSearchResult> {
    const { jql, maxResults = 50, startAt = 0, fields } = params;

    const queryParams = new URLSearchParams({
      maxResults: String(maxResults),
      startAt: String(startAt),
    });

    if (jql) {
      queryParams.append('jql', String(jql));
    }

    if (fields) {
      const fieldsStr = Array.isArray(fields) ? fields.join(',') : String(fields);
      queryParams.append('fields', fieldsStr);
    }

    const response = await this.apiGet(`/search?${queryParams}`);
    return response as JiraSearchResult;
  }

  private async transitionIssue(params: Record<string, unknown>): Promise<unknown> {
    const { issueKey, transitionId, transitionName } = params;

    if (!issueKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey is required');
    }

    if (!transitionId && !transitionName) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'transitionId or transitionName is required');
    }

    let transition: Record<string, unknown> = {};

    if (transitionId) {
      transition = { id: String(transitionId) };
    } else if (transitionName) {
      // Need to fetch transitions first to find the ID
      const transitions = await this.getTransitions({ issueKey });
      const found = (transitions as JiraTransition[]).find(
        (t) => t.name.toLowerCase() === String(transitionName).toLowerCase()
      );
      if (!found) {
        throw new Error(`Transition '${transitionName}' not found`);
      }
      transition = { id: found.id };
    }

    return this.apiPost(`/issue/${encodeURIComponent(String(issueKey))}/transitions`, {
      transition,
    });
  }

  private async getTransitions(params: Record<string, unknown>): Promise<JiraTransition[]> {
    const { issueKey } = params;
    if (!issueKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey is required');
    }

    const response = await this.apiGet(
      `/issue/${encodeURIComponent(String(issueKey))}/transitions?expand=transitions.fields`
    );
    const data = response as { transitions: JiraTransition[] };
    return data.transitions;
  }

  private async addComment(params: Record<string, unknown>): Promise<JiraComment> {
    const { issueKey, body } = params;

    if (!issueKey || !body) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey and body are required');
    }

    const commentBody = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: String(body),
              },
            ],
          },
        ],
      },
    };

    const response = await this.apiPost(
      `/issue/${encodeURIComponent(String(issueKey))}/comment`,
      commentBody
    );
    return response as JiraComment;
  }

  private async getComments(params: Record<string, unknown>): Promise<{ comments: JiraComment[]; total: number }> {
    const { issueKey, startAt = 0, maxResults = 50 } = params;

    if (!issueKey) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'issueKey is required');
    }

    const queryParams = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
    });

    const response = await this.apiGet(
      `/issue/${encodeURIComponent(String(issueKey))}/comment?${queryParams}`
    );
    return response as { comments: JiraComment[]; total: number };
  }

  private async apiGet(endpoint: string): Promise<unknown> {
    if (!this.config?.token && !(this.config?.username && this.config?.password)) {
      throw new Error('Jira credentials not configured');
    }

    const auth = this.config.token
      ? `Basic ${Buffer.from(`:${this.config.token}`).toString('base64')}`
      : `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/rest/api/${this.apiVersion}${endpoint}`, {
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async apiPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.config?.token && !(this.config?.username && this.config?.password)) {
      throw new Error('Jira credentials not configured');
    }

    const auth = this.config.token
      ? `Basic ${Buffer.from(`:${this.config.token}`).toString('base64')}`
      : `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/rest/api/${this.apiVersion}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async apiPut(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.config?.token && !(this.config?.username && this.config?.password)) {
      throw new Error('Jira credentials not configured');
    }

    const auth = this.config.token
      ? `Basic ${Buffer.from(`:${this.config.token}`).toString('base64')}`
      : `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/rest/api/${this.apiVersion}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}