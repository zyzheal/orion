/**
 * GitLab Connector - Integration with GitLab for source control and CI/CD
 *
 * Capabilities: SourceControl, SourceRead, CICD
 */

import {
  Connector,
  ConnectorCapability,
  ConnectorConfig,
  IntegrationEvent,
} from '../ConnectorRegistry';
import { OrionError, ErrorCode } from '../../../errors';
import { safeFetch } from '../../../utils/safeFetch';

// GitLab API response types
interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string;
  default_branch: string;
  web_url: string;
  visibility: string;
  archived: boolean;
  created_at: string;
  last_activity_at: string;
}

interface GitLabBranch {
  name: string;
  protected: boolean;
  commit: {
    id: string;
    short_id: string;
    title: string;
    author_name: string;
    created_at: string;
  };
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  author_email: string;
  created_at: string;
  message: string;
}

interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
}

interface GitLabPipeline {
  id: number;
  iid: number;
  project_id: number;
  status: string;
  source: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

interface GitLabJob {
  id: number;
  name: string;
  status: string;
  stage: string;
  pipeline: {
    id: number;
    status: string;
  };
  web_url: string;
  created_at: string;
}

/**
 * GitLab Connector implementation
 */
export class GitLabConnector implements Connector {
  name = 'gitlab';
  version = '1.0.0';
  capabilities: ConnectorCapability[] = [
    ConnectorCapability.SourceControl,
    ConnectorCapability.SourceRead,
    ConnectorCapability.CICD,
  ];

  private config: ConnectorConfig | null = null;
  private baseUrl: string = 'https://gitlab.com';

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;

    if (config.host) {
      this.baseUrl = config.host.replace(/\/$/, '');
    }

    // Validate required config
    if (!config.token) {
      throw new OrionError('GitLab token is required', ErrorCode.VALIDATION_ERROR);
    }
  }

  async validateConfig(config: ConnectorConfig): Promise<boolean> {
    if (!config.token) {
      return false;
    }
    return true;
  }

  async testConnection(config: ConnectorConfig): Promise<boolean> {
    try {
      const baseUrl = config.host?.replace(/\/$/, '') || 'https://gitlab.com';
      const response = await safeFetch(`${baseUrl}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': config.token || '',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.config) {
      throw new OrionError('Connector not initialized. Call initialize() first.', ErrorCode.OPERATION_FAILED);
    }

    switch (action) {
      case 'listProjects':
        return this.listProjects(params);
      case 'listAllProjects':
        return this.listAllProjects(params);
      case 'getProject':
        return this.getProject(params);
      case 'listBranches':
        return this.listBranches(params);
      case 'getCommit':
        return this.getCommit(params);
      case 'listCommits':
        return this.listCommits(params);
      case 'createMergeRequest':
        return this.createMergeRequest(params);
      case 'listMergeRequests':
        return this.listMergeRequests(params);
      case 'triggerPipeline':
        return this.triggerPipeline(params);
      case 'getPipelineStatus':
        return this.getPipelineStatus(params);
      case 'getPipelineJobs':
        return this.getPipelineJobs(params);
      default:
        throw new OrionError(`Unknown action: ${action}`, ErrorCode.NOT_FOUND);
    }
  }

  transformEvent(rawEvent: unknown): IntegrationEvent {
    const event = rawEvent as Record<string, unknown>;
    const eventType = event.object_kind as string || 'unknown';

    return {
      type: `gitlab:${eventType}`,
      source: 'gitlab',
      payload: event,
      timestamp: new Date(),
      externalId: (event.object_attributes as any)?.id?.toString(),
    };
  }

  // Actions implementation

  private async listProjects(params: Record<string, unknown>): Promise<GitLabProject[]> {
    const { page = 1, perPage = 20, search, membership } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    if (search) queryParams.append('search', String(search));
    if (membership !== undefined) queryParams.append('membership', String(membership));

    const response = await this.apiGet(`/projects?${queryParams}`);
    return response as GitLabProject[];
  }

  /**
   * List all projects with automatic pagination
   * Use this when you need all projects (not just one page)
   */
  private async listAllProjects(params: Record<string, unknown> = {}): Promise<GitLabProject[]> {
    const { search, membership, maxPages: maxPagesUnknown = 10 } = params;
    const maxPages = maxPagesUnknown as number;
    const allProjects: GitLabProject[] = [];
    let currentPage = 1;
    const perPage = 100; // Maximum allowed by GitLab API

    while (currentPage <= maxPages) {
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        per_page: String(perPage),
      });

      if (search) queryParams.append('search', String(search));
      if (membership !== undefined) queryParams.append('membership', String(membership));

      const response = (await this.apiGet(`/projects?${queryParams}`)) as GitLabProject[];

      if (response.length === 0) break; // No more results
      allProjects.push(...response);

      if (response.length < perPage) break; // Last page
      currentPage++;
    }

    return allProjects;
  }

  private async getProject(params: Record<string, unknown>): Promise<GitLabProject> {
    const { projectId } = params;
    if (!projectId) {
      throw new OrionError('projectId is required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await this.apiGet(`/projects/${encodeURIComponent(String(projectId))}`);
    return response as GitLabProject;
  }

  private async listBranches(params: Record<string, unknown>): Promise<GitLabBranch[]> {
    const { projectId, page = 1, perPage = 100 } = params;
    if (!projectId) {
      throw new OrionError('projectId is required', ErrorCode.VALIDATION_ERROR);
    }

    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/repository/branches?${queryParams}`
    );
    return response as GitLabBranch[];
  }

  private async getCommit(params: Record<string, unknown>): Promise<GitLabCommit> {
    const { projectId, sha } = params;
    if (!projectId || !sha) {
      throw new OrionError('projectId and sha are required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/repository/commits/${sha}`
    );
    return response as GitLabCommit;
  }

  private async listCommits(params: Record<string, unknown>): Promise<GitLabCommit[]> {
    const { projectId, refName, page = 1, perPage = 20 } = params;
    if (!projectId) {
      throw new OrionError('projectId is required', ErrorCode.VALIDATION_ERROR);
    }

    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    if (refName) queryParams.append('ref_name', String(refName));

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/repository/commits?${queryParams}`
    );
    return response as GitLabCommit[];
  }

  private async createMergeRequest(params: Record<string, unknown>): Promise<GitLabMergeRequest> {
    const { projectId, sourceBranch, targetBranch, title, description } = params;

    if (!projectId || !sourceBranch || !targetBranch || !title) {
      throw new OrionError('projectId, sourceBranch, targetBranch, and title are required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await this.apiPost(
      `/projects/${encodeURIComponent(String(projectId))}/merge_requests`,
      {
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title,
        description: description || '',
      }
    );
    return response as GitLabMergeRequest;
  }

  private async listMergeRequests(params: Record<string, unknown>): Promise<GitLabMergeRequest[]> {
    const { projectId, state, page = 1, perPage = 20 } = params;
    if (!projectId) {
      throw new OrionError('projectId is required', ErrorCode.VALIDATION_ERROR);
    }

    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    if (state) queryParams.append('state', String(state));

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/merge_requests?${queryParams}`
    );
    return response as GitLabMergeRequest[];
  }

  private async triggerPipeline(params: Record<string, unknown>): Promise<GitLabPipeline> {
    const { projectId, ref, variables } = params;

    if (!projectId || !ref) {
      throw new OrionError('projectId and ref are required', ErrorCode.VALIDATION_ERROR);
    }

    const body: Record<string, unknown> = { ref };
    if (variables) {
      body.variables = variables;
    }

    const response = await this.apiPost(
      `/projects/${encodeURIComponent(String(projectId))}/pipeline`,
      body
    );
    return response as GitLabPipeline;
  }

  private async getPipelineStatus(params: Record<string, unknown>): Promise<GitLabPipeline> {
    const { projectId, pipelineId } = params;

    if (!projectId || !pipelineId) {
      throw new OrionError('projectId and pipelineId are required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/pipelines/${pipelineId}`
    );
    return response as GitLabPipeline;
  }

  private async getPipelineJobs(params: Record<string, unknown>): Promise<GitLabJob[]> {
    const { projectId, pipelineId } = params;

    if (!projectId || !pipelineId) {
      throw new OrionError('projectId and pipelineId are required', ErrorCode.VALIDATION_ERROR);
    }

    const response = await this.apiGet(
      `/projects/${encodeURIComponent(String(projectId))}/pipelines/${pipelineId}/jobs`
    );
    return response as GitLabJob[];
  }

  private async apiGet(endpoint: string): Promise<unknown> {
    if (!this.config?.token) {
      throw new OrionError('GitLab token not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const response = await safeFetch(`${this.baseUrl}/api/v4${endpoint}`, {
      headers: {
        'PRIVATE-TOKEN': this.config.token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OrionError(`GitLab API error: ${response.status} - ${error}`, 'OPERATION_FAILED')
    }

    return response.json();
  }

  private async apiPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.config?.token) {
      throw new OrionError('GitLab token not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const response = await safeFetch(`${this.baseUrl}/api/v4${endpoint}`, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': this.config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OrionError(`GitLab API error: ${response.status} - ${error}`, 'OPERATION_FAILED')
    }

    return response.json();
  }
}