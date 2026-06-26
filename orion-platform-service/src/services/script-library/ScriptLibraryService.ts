import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { ScriptLibraryRepository, ScriptLibraryEntity } from './ScriptLibraryRepository';
import { ScriptVersionRepository, ScriptVersionEntity } from './ScriptVersionRepository';
import { ScriptParameterRepository, ScriptParameterEntity } from './ScriptParameterRepository';
import { ScriptExecutionRepository, ScriptExecutionEntity } from './ScriptExecutionRepository';
import { createHash } from 'crypto';

const logger = pino({ name: 'ScriptLibraryService' });

export interface CreateScriptInput {
  name: string;
  description?: string;
  scriptType: string;
  category?: string;
  tags?: string[];
  content: string;
  changelog?: string;
  parameters?: Array<{
    paramKey: string;
    paramType: string;
    label: string;
    required?: boolean;
    defaultValue?: string;
    description?: string;
    sortOrder?: number;
  }>;
  createdBy?: string;
}

export interface UpdateScriptInput {
  name?: string;
  description?: string;
  scriptType?: string;
  category?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface CreateVersionInput {
  content: string;
  changelog?: string;
  createdBy?: string;
}

export interface ExecuteScriptInput {
  version?: number;
  targets: Record<string, unknown>;
  params?: Record<string, unknown>;
  executedBy?: string;
}

export class ScriptLibraryService {
  constructor(
    private readonly libraryRepo: ScriptLibraryRepository,
    private readonly versionRepo: ScriptVersionRepository,
    private readonly paramRepo: ScriptParameterRepository,
    private readonly executionRepo: ScriptExecutionRepository,
  ) {}

  // ==================== Script CRUD ====================

  async listScripts(filters?: { category?: string; enabled?: boolean }): Promise<ScriptLibraryEntity[]> {
    const tenantId = getCurrentTenantId();
    if (filters?.category) {
      return this.libraryRepo.findByCategory(filters.category);
    }
    if (filters?.enabled !== undefined) {
      return filters.enabled ? this.libraryRepo.findEnabled() : (await this.libraryRepo.findByTenant()).entities;
    }
    const result = await this.libraryRepo.findByTenant();
    return result.entities;
  }

  async getScript(id: string): Promise<ScriptLibraryEntity> {
    const script = await this.libraryRepo.findById(id);
    if (!script) {
      throw new OrionError(`Script not found: ${id}`, 'NOT_FOUND');
    }
    return script;
  }

  async createScript(input: CreateScriptInput): Promise<ScriptLibraryEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, scriptType: input.scriptType }, 'Creating script');

    const checksum = createHash('sha256').update(input.content).digest('hex');

    const script = await this.libraryRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      scriptType: input.scriptType,
      category: input.category ?? null,
      tags: JSON.stringify(input.tags ?? []),
      latestVersion: 1,
      enabled: true,
      createdBy: input.createdBy ?? null,
    });

    // Create initial version
    await this.versionRepo.create({
      tenantId,
      scriptId: script.id,
      version: 1,
      content: input.content,
      changelog: input.changelog ?? 'Initial version',
      checksum,
      createdBy: input.createdBy ?? null,
    });

    // Create parameters if provided
    if (input.parameters && input.parameters.length > 0) {
      await this.paramRepo.upsertBulk(script.id, input.parameters);
    }

    logger.info({ scriptId: script.id }, 'Script created');
    return script;
  }

  async updateScript(id: string, input: UpdateScriptInput): Promise<ScriptLibraryEntity> {
    const existing = await this.libraryRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Script not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.scriptType !== undefined) updateData.scriptType = input.scriptType;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.tags !== undefined) updateData.tags = JSON.stringify(input.tags);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.libraryRepo.update(id, updateData);
    logger.info({ scriptId: id }, 'Script updated');
    return updated;
  }

  async deleteScript(id: string): Promise<void> {
    const existing = await this.libraryRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Script not found: ${id}`, 'NOT_FOUND');
    }
    // CASCADE will handle versions, parameters, executions
    await this.libraryRepo.delete(id);
    logger.info({ scriptId: id }, 'Script deleted');
  }

  // ==================== Version Management ====================

  async getVersions(scriptId: string): Promise<ScriptVersionEntity[]> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }
    return this.versionRepo.findByScriptId(scriptId);
  }

  async createVersion(scriptId: string, input: CreateVersionInput): Promise<ScriptVersionEntity> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }

    const tenantId = getCurrentTenantId();
    const newVersion = script.latestVersion + 1;
    const checksum = createHash('sha256').update(input.content).digest('hex');

    const version = await this.versionRepo.create({
      tenantId,
      scriptId,
      version: newVersion,
      content: input.content,
      changelog: input.changelog ?? null,
      checksum,
      createdBy: input.createdBy ?? null,
    });

    // Update latest_version on script
    await this.libraryRepo.update(scriptId, { latestVersion: newVersion });

    logger.info({ scriptId, version: newVersion }, 'Script version created');
    return version;
  }

  async rollbackVersion(scriptId: string, targetVersion: number): Promise<ScriptVersionEntity> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }

    const target = await this.versionRepo.findByScriptAndVersion(scriptId, targetVersion);
    if (!target) {
      throw new OrionError(`Script version not found: ${scriptId} v${targetVersion}`, 'NOT_FOUND');
    }

    const tenantId = getCurrentTenantId();
    const newVersion = script.latestVersion + 1;
    const rollbackChangelog = `Rollback to v${targetVersion}`;

    const version = await this.versionRepo.create({
      tenantId,
      scriptId,
      version: newVersion,
      content: target.content,
      changelog: rollbackChangelog,
      checksum: target.checksum,
      createdBy: null,
    });

    // Update latest_version on script
    await this.libraryRepo.update(scriptId, { latestVersion: newVersion });

    logger.info({ scriptId, targetVersion, newVersion }, 'Script version rolled back');
    return version;
  }

  // ==================== Parameter Management ====================

  async getParameters(scriptId: string): Promise<ScriptParameterEntity[]> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }
    return this.paramRepo.findByScriptId(scriptId);
  }

  // ==================== Execution ====================

  async executeScript(scriptId: string, input: ExecuteScriptInput): Promise<ScriptExecutionEntity> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }

    if (!script.enabled) {
      throw new OrionError(`Script is disabled: ${scriptId}`, 'VALIDATION_ERROR');
    }

    const tenantId = getCurrentTenantId();
    const version = input.version ?? script.latestVersion;

    // Verify version exists
    const versionEntity = await this.versionRepo.findByScriptAndVersion(scriptId, version);
    if (!versionEntity) {
      throw new OrionError(`Script version not found: ${scriptId} v${version}`, 'NOT_FOUND');
    }

    const execution = await this.executionRepo.create({
      tenantId,
      scriptId,
      version,
      status: 'pending',
      targets: JSON.stringify(input.targets),
      params: input.params ? JSON.stringify(input.params) : null,
      output: null,
      error: null,
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
      executedBy: input.executedBy ?? null,
    });

    logger.info({ executionId: execution.id, scriptId, version }, 'Script execution created');
    return execution;
  }

  async getExecutionHistory(scriptId: string, limit: number = 20): Promise<ScriptExecutionEntity[]> {
    const script = await this.libraryRepo.findById(scriptId);
    if (!script) {
      throw new OrionError(`Script not found: ${scriptId}`, 'NOT_FOUND');
    }
    return this.executionRepo.findByScriptId(scriptId, limit);
  }

  async getExecution(executionId: string): Promise<ScriptExecutionEntity> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Script execution not found: ${executionId}`, 'NOT_FOUND');
    }
    return execution;
  }
}
