/**
 * IaC Workspace Service - Workspace CRUD, locking, state management
 */

import { EventBusService } from '../event-bus-service';
import {
  IaCWorkspace,
  IaCWorkspaceCreateInput,
  IaCWorkspaceUpdateInput,
  createIaCWorkspace,
  IaCStateVersion,
  IaCStateVersionCreateInput,
  createIaCStateVersion,
  IaCModule,
  IaCModuleCreateInput,
  createIaCModule,
  IaCEnvironment,
  IaCWorkspaceStatus,
  IaCProvider,
} from '../../models/IacWorkspace';

export interface IaCWorkspaceListFilter {
  projectId?: string;
  environment?: IaCEnvironment;
  status?: IaCWorkspaceStatus;
  provider?: IaCProvider;
  page?: number;
  perPage?: number;
}

export class WorkspaceService {
  private workspaces: Map<string, IaCWorkspace> = new Map();
  private stateVersions: Map<string, IaCStateVersion[]> = new Map();
  private modules: Map<string, IaCModule> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  // ==================== Workspace CRUD ====================

  async create(input: IaCWorkspaceCreateInput): Promise<IaCWorkspace> {
    const workspace = createIaCWorkspace(input);
    this.workspaces.set(workspace.id, workspace);
    this.stateVersions.set(workspace.id, []);

    await this.eventBus?.publish('iac.workspace.created', {
      workspaceId: workspace.id,
      name: workspace.name,
      environment: workspace.environment,
    });
    return workspace;
  }

  async getById(id: string): Promise<IaCWorkspace | undefined> {
    return this.workspaces.get(id);
  }

  async list(filter: IaCWorkspaceListFilter = {}): Promise<{ workspaces: IaCWorkspace[]; total: number }> {
    let items = Array.from(this.workspaces.values());

    if (filter.projectId) {
      items = items.filter(w => w.projectId === filter.projectId);
    }
    if (filter.environment) {
      items = items.filter(w => w.environment === filter.environment);
    }
    if (filter.status) {
      items = items.filter(w => w.status === filter.status);
    }
    if (filter.provider) {
      items = items.filter(w => w.provider === filter.provider);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    items = items.slice(start, start + perPage);

    return { workspaces: items, total };
  }

  async update(id: string, input: IaCWorkspaceUpdateInput): Promise<IaCWorkspace | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;

    if (input.name !== undefined) workspace.name = input.name;
    if (input.statePath !== undefined) workspace.statePath = input.statePath;
    if (input.variables !== undefined) workspace.variables = input.variables;
    if (input.status !== undefined) workspace.status = input.status;

    this.workspaces.set(id, workspace);
    await this.eventBus?.publish('iac.workspace.updated', { workspaceId: id });
    return workspace;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.workspaces.delete(id);
    this.stateVersions.delete(id);
    if (deleted) {
      await this.eventBus?.publish('iac.workspace.deleted', { workspaceId: id });
    }
    return deleted;
  }

  // ==================== Locking ====================

  async lock(workspaceId: string, userId: string): Promise<IaCWorkspace | undefined> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;
    if (workspace.lockedBy) {
      throw new Error(`Workspace is already locked by ${workspace.lockedBy}`);
    }

    workspace.lockedBy = userId;
    workspace.status = 'locked';
    this.workspaces.set(workspaceId, workspace);

    await this.eventBus?.publish('iac.workspace.locked', {
      workspaceId,
      lockedBy: userId,
    });
    return workspace;
  }

  async unlock(workspaceId: string): Promise<IaCWorkspace | undefined> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    workspace.lockedBy = null;
    workspace.status = 'active';
    this.workspaces.set(workspaceId, workspace);

    await this.eventBus?.publish('iac.workspace.unlocked', { workspaceId });
    return workspace;
  }

  // ==================== State Management ====================

  async addStateVersion(input: IaCStateVersionCreateInput): Promise<IaCStateVersion> {
    const version = createIaCStateVersion(input);
    const versions = this.stateVersions.get(input.workspaceId) ?? [];
    versions.push(version);
    versions.sort((a, b) => b.version - a.version);
    this.stateVersions.set(input.workspaceId, versions);

    await this.eventBus?.publish('iac.state.versioned', {
      workspaceId: input.workspaceId,
      version: version.version,
    });
    return version;
  }

  async getCurrentState(workspaceId: string): Promise<IaCStateVersion | undefined> {
    const versions = this.stateVersions.get(workspaceId) ?? [];
    if (versions.length === 0) return undefined;
    return versions[0]; // Already sorted by version descending
  }

  async getStateHistory(workspaceId: string): Promise<IaCStateVersion[]> {
    return this.stateVersions.get(workspaceId) ?? [];
  }

  // ==================== Resource Listing ====================

  async listResources(workspaceId: string): Promise<Record<string, unknown>[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return [];

    // Derive mock resources from variables for in-memory implementation
    const resources: Record<string, unknown>[] = [];
    const stateVersions = this.stateVersions.get(workspaceId) ?? [];
    const currentState = stateVersions[0];

    if (currentState) {
      resources.push({
        address: 'workspace.state',
        type: 'state_version',
        id: currentState.id,
        version: currentState.version,
        timestamp: currentState.timestamp.toISOString(),
        commitSha: currentState.commitSha,
        author: currentState.author,
        sizeBytes: currentState.size,
      });
    }

    // List variables as resource-like entries
    for (const [key, value] of Object.entries(workspace.variables)) {
      resources.push({
        address: `var.${key}`,
        type: 'variable',
        value,
        environment: workspace.environment,
      });
    }

    return resources;
  }

  async importResource(workspaceId: string, resource: Record<string, unknown>): Promise<Record<string, unknown>> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Store imported resource in variables for tracking
    const resourceId = (resource.address as string) || `imported-${Date.now()}`;
    workspace.variables[`imported_${resourceId}`] = resource;
    this.workspaces.set(workspaceId, workspace);

    await this.eventBus?.publish('iac.resource.imported', {
      workspaceId,
      resourceId,
    });
    return { ...resource, workspaceId, importedAt: new Date().toISOString() };
  }

  // ==================== Module Management ====================

  async createModule(input: IaCModuleCreateInput): Promise<IaCModule> {
    const module = createIaCModule(input);
    this.modules.set(module.id, module);

    await this.eventBus?.publish('iac.module.created', {
      moduleId: module.id,
      name: module.name,
      version: module.version,
    });
    return module;
  }

  async getModuleById(id: string): Promise<IaCModule | undefined> {
    return this.modules.get(id);
  }

  async listModules(): Promise<IaCModule[]> {
    return Array.from(this.modules.values());
  }

  async deleteModule(id: string): Promise<boolean> {
    const deleted = this.modules.delete(id);
    return deleted;
  }
}
