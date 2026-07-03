/**
 * LowcodeWorkflowService - 低代码工作流业务服务
 *
 * 负责工作流定义和实例的 CRUD 操作。
 * 迁移: 直接 SQL (workflow-routes.ts) -> PostgreSQL Repository + 内存降级
 *
 * 设计:
 * - 优先使用 PostgreSQL Repository 持久化
 * - DB 失败时自动降级到内存 Map 存储
 * - 保持对外公开接口不变
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { LowcodeWorkflowDefinitionPgRepository, LowcodeWorkflowDefinitionEntity } from '../../repositories/LowcodeWorkflowDefinitionRepository';
import { LowcodeWorkflowInstancePgRepository, LowcodeWorkflowInstanceEntity } from '../../repositories/LowcodeWorkflowInstanceRepository';
import { LowcodeWorkflowVersionPgRepository, LowcodeWorkflowVersionEntity } from '../../repositories/LowcodeWorkflowVersionRepository';
import { LowcodeFlowTemplatePgRepository, LowcodeFlowTemplateEntity } from '../../repositories/LowcodeFlowTemplateRepository';
import { OrionError, ErrorCode, ValidationError, NotFoundError } from '../../errors';

const logger = createLogger('LowcodeWorkflowService');

// ==================== 数据类型定义 ====================

/** 工作流定义（对外暴露的类型） */
export interface LowcodeWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建工作流请求 */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  tenantId?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  createdBy?: string;
}

/** 更新工作流请求 */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  enabled?: boolean;
}

/** 分页列表选项 */
export interface ListOptions {
  enabled?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

/** 工作流实例（对外暴露的类型） */
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowDefinitionId: string;
  tenantId: string;
  status: string;
  currentNodeId?: string;
  variables: Record<string, unknown>;
  history: Array<Record<string, unknown>>;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/** 创建工作流实例请求 */
export interface CreateInstanceInput {
  workflowId: string;
  workflowDefinitionId: string;
  tenantId?: string;
  status?: string;
  currentNodeId?: string;
  variables?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

// ==================== 内存降级存储 ====================

interface MemoryWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  nodes: string;  // JSON string
  edges: string;  // JSON string
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class MemoryStore {
  private workflows = new Map<string, MemoryWorkflow>();
  private instances = new Map<string, WorkflowInstance>();

  // ---- Workflow ----

  saveWorkflow(workflow: MemoryWorkflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  findWorkflowById(id: string): MemoryWorkflow | undefined {
    return this.workflows.get(id);
  }

  findAllWorkflows(options?: { enabled?: boolean; limit?: number; offset?: number }): { entities: MemoryWorkflow[]; total: number } {
    let items = Array.from(this.workflows.values());

    if (options?.enabled !== undefined) {
      items = items.filter(w => w.enabled === options.enabled);
    }

    const total = items.length;
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.offset) {
      items = items.slice(options.offset);
    }
    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return { entities: items, total };
  }

  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }

  // ---- Instance ----

  saveInstance(instance: WorkflowInstance): void {
    this.instances.set(instance.id, instance);
  }

  findInstanceById(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  findInstancesByWorkflowId(workflowId: string): WorkflowInstance[] {
    return Array.from(this.instances.values())
      .filter(i => i.workflowId === workflowId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteInstance(id: string): boolean {
    return this.instances.delete(id);
  }
}

// ==================== 服务实现 ====================

export class LowcodeWorkflowService {
  private defRepo: LowcodeWorkflowDefinitionPgRepository | null = null;
  private instRepo: LowcodeWorkflowInstancePgRepository | null = null;
  private memoryStore = new MemoryStore();
  private dbAvailable = false;

  /**
   * 构造函数 - 可选择注入 Repository
   */
  constructor(defRepo?: LowcodeWorkflowDefinitionPgRepository | null, instRepo?: LowcodeWorkflowInstancePgRepository | null) {
    if (defRepo) {
      this.defRepo = defRepo;
      this.instRepo = instRepo ?? null;
      this.dbAvailable = true;
    }
  }

  /**
   * 检查数据库可用性
   */
  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  // ==================== Workflow 定义 CRUD ====================

  /**
   * 创建工作流定义
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<LowcodeWorkflow> {
    const now = new Date();
    const id = uuidv4();

    const nodesJson = input.nodes ? JSON.stringify(input.nodes) : '[]';
    const edgesJson = input.edges ? JSON.stringify(input.edges) : '[]';

    const memoryWorkflow: MemoryWorkflow = {
      id,
      tenantId: input.tenantId || '00000000-0000-0000-0000-000000000000',
      name: input.name,
      description: input.description,
      version: input.version || '1.0.0',
      enabled: true,
      nodes: nodesJson,
      edges: edgesJson,
      createdBy: input.createdBy || 'system',
      createdAt: now,
      updatedAt: now,
    };

    // 尝试持久化到 DB (fire-and-forget, 失败则降级到内存)
    if (this.defRepo) {
      try {
        const entity = await this.defRepo.create({
          id,
          tenant_id: memoryWorkflow.tenantId,
          name: memoryWorkflow.name,
          description: memoryWorkflow.description || '',
          version: memoryWorkflow.version,
          enabled: true,
          nodes: nodesJson,
          edges: edgesJson,
          created_by: memoryWorkflow.createdBy,
        });
        logger.info({ workflowId: id }, 'Workflow created in DB');
        return this.mapEntityToWorkflow(entity);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg }, 'DB persist failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    // 内存存储（降级）
    this.memoryStore.saveWorkflow(memoryWorkflow);
    return this.mapMemoryToWorkflow(memoryWorkflow);
  }

  /**
   * 根据 ID 获取工作流
   */
  async getWorkflowById(id: string): Promise<LowcodeWorkflow | null> {
    // 先从 DB 查
    if (this.dbAvailable && this.defRepo) {
      try {
        const entity = await this.defRepo.findById(id);
        if (entity) {
          return this.mapEntityToWorkflow(entity);
        }
        return null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    // 从内存查
    const mem = this.memoryStore.findWorkflowById(id);
    if (mem) {
      return this.mapMemoryToWorkflow(mem);
    }

    return null;
  }

  /**
   * 列出所有工作流
   */
  async listWorkflows(options?: ListOptions): Promise<PaginatedResult<LowcodeWorkflow>> {
    // 先从 DB 查
    if (this.dbAvailable && this.defRepo) {
      try {
        const where: Record<string, unknown> = {};
        if (options?.enabled !== undefined) {
          where.enabled = options.enabled;
        }
        const result = await this.defRepo.findAll({
          where,
          limit: options?.limit || 50,
          offset: options?.offset || 0,
          orderBy: options?.orderBy || 'created_at',
          orderDir: options?.orderDir || 'DESC',
        });
        return {
          data: result.entities.map(e => this.mapEntityToWorkflow(e)),
          total: result.total,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    // 从内存查
    const memResult = this.memoryStore.findAllWorkflows({
      enabled: options?.enabled,
      limit: options?.limit,
      offset: options?.offset,
    });
    return {
      data: memResult.entities.map(e => this.mapMemoryToWorkflow(e)),
      total: memResult.total,
    };
  }

  /**
   * 更新工作流定义
   */
  async updateWorkflow(id: string, updates: UpdateWorkflowInput): Promise<LowcodeWorkflow | null> {
    let existing: MemoryWorkflow | LowcodeWorkflowDefinitionEntity | undefined;

    // 先从 DB 查
    if (this.dbAvailable && this.defRepo) {
      try {
        existing = await this.defRepo.findById(id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    if (!existing) {
      // 从内存查
      existing = this.memoryStore.findWorkflowById(id);
    }

    if (!existing) {
      return null;
    }

    const now = new Date();
    // 同时适配 DB entity 和 MemoryWorkflow 两种类型
    const currentName = existing.name || '';
    const currentDescription = (existing as any).description || '';
    const currentVersion = (existing as any).version || '1.0.0';
    const currentEnabled = existing.enabled ?? true;
    const currentNodes = existing.nodes || '[]';
    const currentEdges = existing.edges || '[]';
    const currentTenantId = (existing as any).tenant_id || '00000000-0000-0000-0000-000000000000';
    const currentCreatedBy = (existing as any).created_by || (existing as any).createdBy || 'system';
    const currentCreatedAt = (existing as any).created_at || (existing as any).createdAt || now;

    const newName = updates.name !== undefined ? updates.name : currentName;
    const newDescription = updates.description !== undefined ? updates.description : currentDescription;
    const newVersion = updates.version !== undefined ? updates.version : currentVersion;
    const newEnabled = updates.enabled !== undefined ? updates.enabled : currentEnabled;
    const newNodes = updates.nodes !== undefined ? JSON.stringify(updates.nodes) : currentNodes;
    const newEdges = updates.edges !== undefined ? JSON.stringify(updates.edges) : currentEdges;

    const updated: MemoryWorkflow = {
      id,
      tenantId: currentTenantId,
      name: newName,
      description: newDescription,
      version: newVersion,
      enabled: newEnabled,
      nodes: newNodes,
      edges: newEdges,
      createdBy: currentCreatedBy,
      createdAt: currentCreatedAt instanceof Date ? currentCreatedAt : new Date(currentCreatedAt),
      updatedAt: now,
    };

    // 尝试更新 DB
    if (this.defRepo) {
      try {
        const entity = await this.defRepo.update(id, {
          name: newName,
          description: newDescription,
          version: newVersion,
          enabled: newEnabled,
          nodes: newNodes,
          edges: newEdges,
        } as any);
        logger.info({ workflowId: id }, 'Workflow updated in DB');
        return this.mapEntityToWorkflow(entity);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB update failed, saving to memory only');
        this.dbAvailable = false;
      }
    }

    // 内存存储
    this.memoryStore.saveWorkflow(updated);
    return this.mapMemoryToWorkflow(updated);
  }

  /**
   * 删除工作流定义
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    // 先从 DB 删除
    if (this.dbAvailable && this.defRepo) {
      try {
        const deleted = await this.defRepo.delete(id);
        if (deleted) {
          logger.info({ workflowId: id }, 'Workflow deleted from DB');
          return true;
        }
        // DB 中没有，尝试从内存删
        return this.memoryStore.deleteWorkflow(id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB delete failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    return this.memoryStore.deleteWorkflow(id);
  }

  // ==================== Workflow 实例 CRUD ====================

  /**
   * 创建工作流实例
   */
  async createInstance(input: CreateInstanceInput): Promise<WorkflowInstance> {
    const now = new Date();
    const id = uuidv4();

    const instance: WorkflowInstance = {
      id,
      workflowId: input.workflowId,
      workflowDefinitionId: input.workflowDefinitionId,
      tenantId: input.tenantId || '00000000-0000-0000-0000-000000000000',
      status: input.status || 'pending',
      currentNodeId: input.currentNodeId,
      variables: input.variables || {},
      history: [],
      input: input.input || {},
      createdAt: now,
      updatedAt: now,
    };

    // 尝试持久化到 DB
    if (this.instRepo) {
      try {
        await this.instRepo.create({
          id,
          workflow_id: input.workflowId,
          workflow_definition_id: input.workflowDefinitionId,
          tenant_id: instance.tenantId,
          status: instance.status,
          current_node_id: input.currentNodeId || null,
          variables: JSON.stringify(instance.variables),
          history: JSON.stringify(instance.history),
          input: JSON.stringify(instance.input),
          output: null,
          error: null,
        });
        logger.info({ instanceId: id }, 'Workflow instance created in DB');
        return instance;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg }, 'DB persist failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    // 内存存储
    this.memoryStore.saveInstance(instance);
    return instance;
  }

  /**
   * 根据 ID 获取实例
   */
  async getInstanceById(id: string): Promise<WorkflowInstance | null> {
    if (this.dbAvailable && this.instRepo) {
      try {
        const entity = await this.instRepo.findById(id);
        if (entity) {
          return this.mapInstEntityToInstance(entity);
        }
        return null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    return this.memoryStore.findInstanceById(id) || null;
  }

  /**
   * 根据工作流 ID 获取实例列表
   */
  async getInstancesByWorkflowId(workflowId: string): Promise<WorkflowInstance[]> {
    if (this.dbAvailable && this.instRepo) {
      try {
        const entities = await this.instRepo.findByWorkflowId(workflowId);
        return entities.map(e => this.mapInstEntityToInstance(e));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, workflowId }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    return this.memoryStore.findInstancesByWorkflowId(workflowId);
  }

  /**
   * 更新实例状态
   */
  async updateInstanceStatus(id: string, status: string, error?: string): Promise<WorkflowInstance | null> {
    const existing = await this.getInstanceById(id);
    if (!existing) {
      return null;
    }

    const updates: Partial<WorkflowInstance> = {
      status,
      updatedAt: new Date(),
    };

    if (error) {
      updates.error = error;
    }

    if (status === 'completed' || status === 'failed' || status === 'terminated') {
      updates.completedAt = new Date();
    }

    Object.assign(existing, updates);

    // 尝试持久化到 DB
    if (this.instRepo) {
      try {
        await this.instRepo.update(id, {
          status,
          error: error || null,
          completed_at: existing.completedAt?.toISOString() || null,
          updated_at: existing.updatedAt.toISOString(),
        } as any);
        logger.info({ instanceId: id, status }, 'Workflow instance status updated in DB');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg, id }, 'DB update failed');
      }
    }

    this.memoryStore.saveInstance(existing);
    return existing;
  }

  /**
   * 更新实例变量
   */
  async updateInstanceVariables(id: string, variables: Record<string, unknown>): Promise<WorkflowInstance | null> {
    const existing = await this.getInstanceById(id);
    if (!existing) {
      return null;
    }

    existing.variables = { ...existing.variables, ...variables };
    existing.updatedAt = new Date();

    // 尝试持久化到 DB
    if (this.instRepo) {
      try {
        await this.instRepo.update(id, {
          variables: JSON.stringify(existing.variables),
          updated_at: existing.updatedAt.toISOString(),
        } as any);
      } catch (error) {
        logger.warn({ error, id }, 'Failed to persist variable update to DB');
      }
    }

    this.memoryStore.saveInstance(existing);
    return existing;
  }

  /**
   * 添加实例历史记录
   */
  async addInstanceHistory(id: string, historyItem: Record<string, unknown>): Promise<void> {
    const existing = await this.getInstanceById(id);
    if (!existing) {
      throw new OrionError(`Workflow instance not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    existing.history = [...existing.history, { ...historyItem, timestamp: new Date() }];
    existing.updatedAt = new Date();

    // 尝试持久化到 DB
    if (this.instRepo) {
      try {
        await this.instRepo.update(id, {
          history: JSON.stringify(existing.history),
          updated_at: existing.updatedAt.toISOString(),
        } as any);
      } catch (error) {
        logger.warn({ error, id }, 'Failed to persist history update to DB');
      }
    }

    this.memoryStore.saveInstance(existing);
  }

  /**
   * 根据定义 ID 获取实例列表
   */
  async getInstancesByDefinitionId(definitionId: string, limit: number = 50): Promise<WorkflowInstance[]> {
    if (this.dbAvailable && this.instRepo) {
      try {
        const entities = await this.instRepo.findByDefinitionId(definitionId, limit);
        return entities.map(e => this.mapInstEntityToInstance(e));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ error: msg }, 'DB query failed, falling back to memory');
        this.dbAvailable = false;
      }
    }

    // 降级到内存：过滤所有相关实例
    return this.memoryStore
      .findInstancesByWorkflowId(definitionId)
      .filter(i => i.workflowDefinitionId === definitionId);
  }

  // ==================== 映射方法 ====================

  /** 将 DB Entity 映射为 LowcodeWorkflow */
  private mapEntityToWorkflow(entity: LowcodeWorkflowDefinitionEntity): LowcodeWorkflow {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      description: entity.description || undefined,
      version: entity.version,
      enabled: entity.enabled,
      nodes: typeof entity.nodes === 'string' ? JSON.parse(entity.nodes) : entity.nodes,
      edges: typeof entity.edges === 'string' ? JSON.parse(entity.edges) : entity.edges,
      createdBy: entity.created_by || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  /** 将内存数据映射为 LowcodeWorkflow */
  private mapMemoryToWorkflow(mem: MemoryWorkflow): LowcodeWorkflow {
    return {
      id: mem.id,
      tenantId: mem.tenantId,
      name: mem.name,
      description: mem.description,
      version: mem.version,
      enabled: mem.enabled,
      nodes: typeof mem.nodes === 'string' ? JSON.parse(mem.nodes) : mem.nodes,
      edges: typeof mem.edges === 'string' ? JSON.parse(mem.edges) : mem.edges,
      createdBy: mem.createdBy,
      createdAt: mem.createdAt,
      updatedAt: mem.updatedAt,
    };
  }

  /** 将 Instance Entity 映射为 WorkflowInstance */
  private mapInstEntityToInstance(entity: LowcodeWorkflowInstanceEntity): WorkflowInstance {
    return {
      id: entity.id,
      workflowId: entity.workflow_id,
      workflowDefinitionId: entity.workflow_definition_id,
      tenantId: entity.tenant_id,
      status: entity.status,
      currentNodeId: entity.current_node_id || undefined,
      variables: typeof entity.variables === 'string' ? JSON.parse(entity.variables) : entity.variables,
      history: typeof entity.history === 'string' ? JSON.parse(entity.history) : entity.history,
      input: typeof entity.input === 'string' ? JSON.parse(entity.input) : entity.input,
      output: entity.output ? (typeof entity.output === 'string' ? JSON.parse(entity.output) : entity.output) : undefined,
      error: entity.error || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      completedAt: entity.completed_at || undefined,
    };
  }
}

// ==================== 单例 ====================

let serviceInstance: LowcodeWorkflowService | null = null;

/**
 * 获取 LowcodeWorkflowService 单例
 *
 * @param defRepo - WorkflowDefinition 的 PostgreSQL Repository（可选，用于启用 DB 持久化）
 * @param instRepo - WorkflowInstance 的 PostgreSQL Repository（可选）
 */
export function getLowcodeWorkflowService(
  defRepo?: LowcodeWorkflowDefinitionPgRepository | null,
  instRepo?: LowcodeWorkflowInstancePgRepository | null,
): LowcodeWorkflowService {
  if (!serviceInstance) {
    serviceInstance = new LowcodeWorkflowService(defRepo ?? null, instRepo ?? null);
  }
  return serviceInstance;
}

/**
 * 重置单例（主要用于测试）
 */
export function resetLowcodeWorkflowService(): void {
  serviceInstance = null;
}

export default LowcodeWorkflowService;
