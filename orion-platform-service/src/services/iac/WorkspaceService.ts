/**
 * IaC Workspace Service - Workspace CRUD, locking, state management
 *
 * Uses PostgreSQL repositories for persistence (migration from Map() in-memory).
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
import { IaCWorkspaceRepository, IaCWorkspaceEntity } from '../../repositories/IaCWorkspaceRepository';
import { IaCStateVersionRepository, IaCStateVersionEntity } from '../../repositories/IaCStateVersionRepository';
import { IaCModuleRepository, IaCModuleEntity } from '../../repositories/IaCModuleRepository';

export interface IaCWorkspaceListFilter {
  projectId?: string;
  environment?: IaCEnvironment;
  status?: IaCWorkspaceStatus;
  provider?: IaCProvider;
  page?: number;
  perPage?: number;
}

// Entity-to-domain mapper for IaCWorkspace
function toWorkspace(entity: IaCWorkspaceEntity): IaCWorkspace {
  return {
    id: entity.id,
    name: entity.name,
    projectId: entity.projectId,
    environment: entity.environment,
    statePath: entity.statePath,
    variables: entity.variables,
    lockedBy: entity.lockedBy,
    status: entity.status,
    provider: entity.provider,
    createdAt: entity.createdAt,
  };
}

// Entity-to-domain mapper for IaCStateVersion
function toStateVersion(entity: IaCStateVersionEntity): IaCStateVersion {
  return {
    id: entity.id,
    workspaceId: entity.workspaceId,
    version: entity.version,
    timestamp: entity.timestamp,
    commitSha: entity.commitSha,
    author: entity.author,
    size: entity.size,
  };
}

// Entity-to-domain mapper for IaCModule
function toModule(entity: IaCModuleEntity): IaCModule {
  return {
    id: entity.id,
    name: entity.name,
    version: entity.version,
    source: entity.source,
    dependencies: entity.dependencies,
    createdAt: entity.createdAt,
  };
}

export class WorkspaceService {
  private workspaceRepository?: IaCWorkspaceRepository;
  private stateVersionRepository?: IaCStateVersionRepository;
  private moduleRepository?: IaCModuleRepository;
  private eventBus?: EventBusService;

  constructor(options: {
    eventBus?: EventBusService;
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  }) {
    this.eventBus = options.eventBus;
    if (options.db) {
      this.workspaceRepository = new IaCWorkspaceRepository(options.db);
      this.stateVersionRepository = new IaCStateVersionRepository(options.db);
      this.moduleRepository = new IaCModuleRepository(options.db);
    }
  }

  // ==================== Workspace CRUD ====================

  async create(input: IaCWorkspaceCreateInput): Promise<IaCWorkspace> {
    if (this.workspaceRepository) {
      // PostgreSQL path
      const entity = await this.workspaceRepository.create({
        name: input.name,
        project_id: input.projectId,
        environment: input.environment,
        state_path: input.statePath ?? '',
        variables: input.variables ?? {},
        status: 'active',
        provider: input.provider ?? 'terraform',
      } as any);

      const workspace = toWorkspace(entity);

      await this.eventBus?.publish('iac.workspace.created', {
        workspaceId: workspace.id,
        name: workspace.name,
        environment: workspace.environment,
      });
      return workspace;
    }

    // Fallback: in-memory path (backward compatibility)
    const workspace = createIaCWorkspace(input);
    await this.eventBus?.publish('iac.workspace.created', {
      workspaceId: workspace.id,
      name: workspace.name,
      environment: workspace.environment,
    });
    return workspace;
  }

  async getById(id: string): Promise<IaCWorkspace | undefined> {
    if (this.workspaceRepository) {
      const entity = await this.workspaceRepository.findById(id);
      return entity ? toWorkspace(entity) : undefined;
    }
    return undefined;
  }

  async list(filter: IaCWorkspaceListFilter = {}): Promise<{ workspaces: IaCWorkspace[]; total: number }> {
    if (this.workspaceRepository) {
      const entities = await this.workspaceRepository.findAllFiltered({
        projectId: filter.projectId,
        environment: filter.environment,
        status: filter.status,
        provider: filter.provider,
      });

      const total = entities.length;
      const page = filter.page ?? 1;
      const perPage = filter.perPage ?? 20;
      const start = (page - 1) * perPage;
      const paged = entities.slice(start, start + perPage);

      return { workspaces: paged.map(toWorkspace), total };
    }
    return { workspaces: [], total: 0 };
  }

  async update(id: string, input: IaCWorkspaceUpdateInput): Promise<IaCWorkspace | undefined> {
    if (this.workspaceRepository) {
      // Build update payload with snake_case columns
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.statePath !== undefined) updateData.state_path = input.statePath;
      if (input.variables !== undefined) updateData.variables = input.variables;
      if (input.status !== undefined) updateData.status = input.status;

      if (Object.keys(updateData).length === 0) {
        return this.getById(id);
      }

      try {
        const entity = await this.workspaceRepository.update(id, updateData as any);
        await this.eventBus?.publish('iac.workspace.updated', { workspaceId: id });
        return toWorkspace(entity);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    if (this.workspaceRepository) {
      const deleted = await this.workspaceRepository.delete(id);
      if (deleted) {
        await this.eventBus?.publish('iac.workspace.deleted', { workspaceId: id });
      }
      return deleted;
    }
    return false;
  }

  // ==================== Locking ====================

  async lock(workspaceId: string, userId: string): Promise<IaCWorkspace | undefined> {
    if (this.workspaceRepository) {
      const entity = await this.workspaceRepository.findById(workspaceId);
      if (!entity) return undefined;
      if (entity.lockedBy) {
        throw new Error(`Workspace is already locked by ${entity.lockedBy}`);
      }

      const updated = await this.workspaceRepository.update(workspaceId, {
        locked_by: userId,
        status: 'locked',
      } as any);

      await this.eventBus?.publish('iac.workspace.locked', {
        workspaceId,
        lockedBy: userId,
      });
      return toWorkspace(updated);
    }
    return undefined;
  }

  async unlock(workspaceId: string): Promise<IaCWorkspace | undefined> {
    if (this.workspaceRepository) {
      const entity = await this.workspaceRepository.findById(workspaceId);
      if (!entity) return undefined;

      const updated = await this.workspaceRepository.update(workspaceId, {
        locked_by: null,
        status: 'active',
      } as any);

      await this.eventBus?.publish('iac.workspace.unlocked', { workspaceId });
      return toWorkspace(updated);
    }
    return undefined;
  }

  // ==================== State Management ====================

  async addStateVersion(input: IaCStateVersionCreateInput): Promise<IaCStateVersion> {
    if (this.stateVersionRepository) {
      // Get next version number if not provided
      const version = input.version || await this.stateVersionRepository.getNextVersion(input.workspaceId);

      const entity = await this.stateVersionRepository.create({
        workspace_id: input.workspaceId,
        version,
        timestamp: new Date(),
        commit_sha: input.commitSha,
        author: input.author,
        size: input.size,
      } as any);

      await this.eventBus?.publish('iac.state.versioned', {
        workspaceId: input.workspaceId,
        version: entity.version,
      });
      return toStateVersion(entity);
    }

    // Fallback: in-memory
    const version = createIaCStateVersion(input);
    await this.eventBus?.publish('iac.state.versioned', {
      workspaceId: input.workspaceId,
      version: version.version,
    });
    return version;
  }

  async getCurrentState(workspaceId: string): Promise<IaCStateVersion | undefined> {
    if (this.stateVersionRepository) {
      const entity = await this.stateVersionRepository.findCurrent(workspaceId);
      return entity ? toStateVersion(entity) : undefined;
    }
    return undefined;
  }

  async getStateHistory(workspaceId: string): Promise<IaCStateVersion[]> {
    if (this.stateVersionRepository) {
      const entities = await this.stateVersionRepository.findByWorkspace(workspaceId);
      return entities.map(toStateVersion);
    }
    return [];
  }

  // ==================== Resource Listing ====================

  async listResources(workspaceId: string): Promise<Record<string, unknown>[]> {
    const workspace = await this.getById(workspaceId);
    if (!workspace) return [];

    const currentState = await this.getCurrentState(workspaceId);
    const resources: Record<string, unknown>[] = [];

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
    const workspace = await this.getById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Store imported resource in variables for tracking
    const resourceId = (resource.address as string) || `imported-${Date.now()}`;
    const updatedVariables = { ...workspace.variables, [`imported_${resourceId}`]: resource };

    await this.update(workspaceId, { variables: updatedVariables });

    await this.eventBus?.publish('iac.resource.imported', {
      workspaceId,
      resourceId,
    });
    return { ...resource, workspaceId, importedAt: new Date().toISOString() };
  }

  // ==================== Module Management ====================

  async createModule(input: IaCModuleCreateInput): Promise<IaCModule> {
    if (this.moduleRepository) {
      const entity = await this.moduleRepository.create({
        name: input.name,
        version: input.version,
        source: input.source,
        dependencies: input.dependencies ?? {},
      } as any);

      await this.eventBus?.publish('iac.module.created', {
        moduleId: entity.id,
        name: entity.name,
        version: entity.version,
      });
      return toModule(entity);
    }

    // Fallback: in-memory
    const module = createIaCModule(input);
    await this.eventBus?.publish('iac.module.created', {
      moduleId: module.id,
      name: module.name,
      version: module.version,
    });
    return module;
  }

  async getModuleById(id: string): Promise<IaCModule | undefined> {
    if (this.moduleRepository) {
      const entity = await this.moduleRepository.findById(id);
      return entity ? toModule(entity) : undefined;
    }
    return undefined;
  }

  async listModules(): Promise<IaCModule[]> {
    if (this.moduleRepository) {
      const entities = await this.moduleRepository.findAllModules();
      return entities.map(toModule);
    }
    return [];
  }

  async deleteModule(id: string): Promise<boolean> {
    if (this.moduleRepository) {
      return await this.moduleRepository.delete(id);
    }
    return false;
  }

  // ==================== State Version Operations ====================

  async listStateVersions(workspaceId: string): Promise<Array<{ version: number; createdAt: string; serial: number; lineage: string }>> {
    const workspace = await this.getById(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    const history = await this.getStateHistory(workspaceId);
    return history.map((sv, index) => ({
      version: history.length - index,
      createdAt: sv.createdAt,
      serial: sv.serialNumber ?? index + 1,
      lineage: sv.lineage ?? `lineage-${workspaceId}`,
    }));
  }

  async getStateDiff(workspaceId: string, versionA: string, versionB: string): Promise<{
    workspaceId: string;
    versionA: string;
    versionB: string;
    added: string[];
    modified: string[];
    removed: string[];
  }> {
    // MVP: return empty diff -- in production, compare terraform state JSON
    return { workspaceId, versionA, versionB, added: [], modified: [], removed: [] };
  }
}
