/**
 * AI 模型版本管理 API 路由
 *
 * 提供 AI 模型管理功能：
 * - GET /api/v1/ai/models - 获取模型列表
 * - POST /api/v1/ai/models - 注册新模型
 * - GET /api/v1/ai/models/:id - 获取模型详情
 * - PUT /api/v1/ai/models/:id - 更新模型信息
 * - DELETE /api/v1/ai/models/:id - 删除模型
 * - GET /api/v1/ai/models/:id/versions - 获取模型版本列表
 * - POST /api/v1/ai/models/:id/versions - 发布新版本
 * - GET /api/v1/ai/models/:id/versions/:versionId - 获取版本详情
 * - POST /api/v1/ai/models/:id/versions/:versionId/promote - 推广版本到指定环境
 * - POST /api/v1/ai/models/:id/versions/:versionId/rollback - 回滚版本
 * - GET /api/v1/ai/models/:id/metrics - 获取模型指标
 * - POST /api/v1/ai/models/:id/canary - 配置金丝雀发布
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 模型类型枚举
 */
export enum ModelType {
  LLM = 'llm',
  EMBEDDING = 'embedding',
  CLASSIFIER = 'classifier',
  REGRESSOR = 'regressor',
  DETECTOR = 'detector',
  GENERATOR = 'generator',
  CUSTOM = 'custom',
}

/**
 * 模型状态枚举
 */
export enum ModelStatus {
  DRAFT = 'draft',
  TRAINING = 'training',
  STAGING = 'staging',
  PRODUCTION = 'production',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

/**
 * 环境枚举
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  CANARY = 'canary',
  PRODUCTION = 'production',
}

/**
 * AI 模型
 */
export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: ModelType;
  status: ModelStatus;
  framework: string;
  currentVersion?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模型版本
 */
export interface ModelVersion {
  id: string;
  modelId: string;
  version: string;
  artifactUri: string;
  environment: Environment;
  status: ModelStatus;
  metrics: ModelMetrics;
  config: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  promotedAt?: string;
  promotedBy?: string;
  deprecatedAt?: string;
}

/**
 * 模型指标
 */
export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  latency?: number;
  throughput?: number;
  errorRate?: number;
  custom?: Record<string, number>;
}

/**
 * 金丝雀配置
 */
export interface CanaryConfig {
  modelId: string;
  enabled: boolean;
  targetVersion: string;
  trafficPercent: number;
  successThreshold: number;
  latencyThreshold: number;
  errorRateThreshold: number;
  startTime: string;
  duration: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'aborted';
  currentMetrics?: ModelMetrics;
}

/**
 * 注册模型请求
 */
export interface RegisterModelRequest {
  name: string;
  displayName: string;
  description: string;
  type: ModelType;
  framework: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 更新模型请求
 */
export interface UpdateModelRequest {
  displayName?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 发布版本请求
 */
export interface PublishVersionRequest {
  artifactUri: string;
  environment?: Environment;
  metrics?: ModelMetrics;
  config?: Record<string, unknown>;
  description?: string;
}

/**
 * 推广版本请求
 */
export interface PromoteVersionRequest {
  targetEnvironment: Environment;
  trafficPercent?: number;
}

/**
 * 金丝雀配置请求
 */
export interface CanaryConfigRequest {
  targetVersion: string;
  trafficPercent: number;
  duration: number;
  successThreshold?: number;
  latencyThreshold?: number;
  errorRateThreshold?: number;
}

/**
 * AI 模型服务类
 */
export class AIModelsService {
  private models: Map<string, AIModel> = new Map();
  private versions: Map<string, ModelVersion[]> = new Map();
  private canaryConfigs: Map<string, CanaryConfig> = new Map();
  private modelCounter = 0;
  private versionCounter = 0;

  /**
   * 生成模型 ID
   */
  private generateModelId(): string {
    this.modelCounter++;
    return `model_${Date.now()}_${this.modelCounter}`;
  }

  /**
   * 生成版本 ID
   */
  private generateVersionId(): string {
    this.versionCounter++;
    return `ver_${Date.now()}_${this.versionCounter}`;
  }

  /**
   * 注册模型
   */
  async registerModel(data: RegisterModelRequest, userId: string): Promise<AIModel> {
    const id = this.generateModelId();
    const now = new Date().toISOString();

    const model: AIModel = {
      id,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      type: data.type,
      status: ModelStatus.DRAFT,
      framework: data.framework,
      tags: data.tags || [],
      metadata: data.metadata || {},
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    this.models.set(id, model);
    return model;
  }

  /**
   * 获取模型列表
   */
  async listModels(
    params: OffsetPaginationParams,
    filters?: {
      type?: ModelType;
      status?: ModelStatus;
      tags?: string[];
      search?: string;
    }
  ): Promise<{ data: AIModel[]; total: number }> {
    let models = Array.from(this.models.values());

    if (filters?.type) {
      models = models.filter(m => m.type === filters.type);
    }
    if (filters?.status) {
      models = models.filter(m => m.status === filters.status);
    }
    if (filters?.tags && filters.tags.length > 0) {
      models = models.filter(m => filters.tags!.some(tag => m.tags.includes(tag)));
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      models = models.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.displayName.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower)
      );
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    models.sort((a, b) => {
      const aVal = a[sortField as keyof AIModel];
      const bVal = b[sortField as keyof AIModel];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = models.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    models = models.slice(offset, offset + limit);

    return { data: models, total };
  }

  /**
   * 获取模型详情
   */
  async getModel(id: string): Promise<AIModel | null> {
    return this.models.get(id) || null;
  }

  /**
   * 更新模型
   */
  async updateModel(id: string, data: UpdateModelRequest): Promise<AIModel> {
    const model = await this.getModel(id);
    if (!model) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'model',
        identifier: id,
      });
    }

    const updated: AIModel = {
      ...model,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.models.set(id, updated);
    return updated;
  }

  /**
   * 删除模型
   */
  async deleteModel(id: string): Promise<void> {
    const model = await this.getModel(id);
    if (!model) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'model',
        identifier: id,
      });
    }

    this.models.delete(id);
    this.versions.delete(id);
    this.canaryConfigs.delete(id);
  }

  /**
   * 获取模型版本列表
   */
  async getVersions(
    modelId: string,
    params: OffsetPaginationParams,
    environment?: Environment
  ): Promise<{ data: ModelVersion[]; total: number }> {
    let versions = this.versions.get(modelId) || [];

    if (environment) {
      versions = versions.filter(v => v.environment === environment);
    }

    const total = versions.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: versions.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 发布版本
   */
  async publishVersion(modelId: string, data: PublishVersionRequest, userId: string): Promise<ModelVersion> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'model',
        identifier: modelId,
      });
    }

    const versions = this.versions.get(modelId) || [];
    const versionNum = `v${Math.floor(versions.length / 10) + 1}.${(versions.length % 10) + 1}.0`;

    const version: ModelVersion = {
      id: this.generateVersionId(),
      modelId,
      version: versionNum,
      artifactUri: data.artifactUri,
      environment: data.environment || Environment.DEVELOPMENT,
      status: ModelStatus.STAGING,
      metrics: data.metrics || {},
      config: data.config || {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    versions.unshift(version);
    this.versions.set(modelId, versions);

    // 更新模型的当前版本
    model.currentVersion = versionNum;
    model.status = ModelStatus.STAGING;
    model.updatedAt = new Date().toISOString();
    this.models.set(modelId, model);

    return version;
  }

  /**
   * 获取版本详情
   */
  async getVersion(modelId: string, versionId: string): Promise<ModelVersion | null> {
    const versions = this.versions.get(modelId) || [];
    return versions.find(v => v.id === versionId) || null;
  }

  /**
   * 推广版本到目标环境
   */
  async promoteVersion(
    modelId: string,
    versionId: string,
    data: PromoteVersionRequest,
    userId: string
  ): Promise<ModelVersion> {
    const version = await this.getVersion(modelId, versionId);
    if (!version) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: versionId,
      });
    }

    const now = new Date().toISOString();
    const updated: ModelVersion = {
      ...version,
      environment: data.targetEnvironment,
      status: data.targetEnvironment === Environment.PRODUCTION ? ModelStatus.PRODUCTION : version.status,
      promotedAt: now,
      promotedBy: userId,
    };

    const versions = this.versions.get(modelId) || [];
    const index = versions.findIndex(v => v.id === versionId);
    if (index !== -1) {
      versions[index] = updated;
      this.versions.set(modelId, versions);
    }

    return updated;
  }

  /**
   * 回滚版本
   */
  async rollbackVersion(modelId: string): Promise<ModelVersion> {
    const versions = this.versions.get(modelId) || [];
    if (versions.length < 2) {
      throw new Error('NO_VERSION_TO_ROLLBACK', 'No previous version available for rollback');
    }

    // 找到上一个生产版本
    const prevVersion = versions.find((v, i) => 
      i > 0 && v.environment === Environment.PRODUCTION && v.status === ModelStatus.PRODUCTION
    );

    if (!prevVersion) {
      throw new Error('NO_PRODUCTION_VERSION', 'No previous production version found');
    }

    // 标记当前生产版本为弃用
    const currentProd = versions.find(v => 
      v.environment === Environment.PRODUCTION && 
      v.status === ModelStatus.PRODUCTION && 
      v.id !== prevVersion.id
    );

    if (currentProd) {
      currentProd.status = ModelStatus.DEPRECATED;
      currentProd.deprecatedAt = new Date().toISOString();
    }

    return prevVersion;
  }

  /**
   * 获取模型指标
   */
  async getModelMetrics(modelId: string): Promise<{ current: ModelMetrics; history: ModelMetrics[] }> {
    const versions = this.versions.get(modelId) || [];
    const currentVersion = versions[0];

    return {
      current: currentVersion?.metrics || {},
      history: versions.slice(0, 10).map(v => v.metrics),
    };
  }

  /**
   * 配置金丝雀发布
   */
  async configureCanary(modelId: string, data: CanaryConfigRequest): Promise<CanaryConfig> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'model',
        identifier: modelId,
      });
    }

    const config: CanaryConfig = {
      modelId,
      enabled: true,
      targetVersion: data.targetVersion,
      trafficPercent: data.trafficPercent,
      successThreshold: data.successThreshold || 0.99,
      latencyThreshold: data.latencyThreshold || 500,
      errorRateThreshold: data.errorRateThreshold || 0.01,
      startTime: new Date().toISOString(),
      duration: data.duration,
      status: 'pending',
    };

    this.canaryConfigs.set(modelId, config);
    return config;
  }

  /**
   * 获取金丝雀配置
   */
  async getCanaryConfig(modelId: string): Promise<CanaryConfig | null> {
    return this.canaryConfigs.get(modelId) || null;
  }

  /**
   * 停止金丝雀发布
   */
  async stopCanary(modelId: string): Promise<void> {
    const config = this.canaryConfigs.get(modelId);
    if (config) {
      config.enabled = false;
      config.status = 'aborted';
    }
  }
}

// 单例服务实例
export const aiModelsService = new AIModelsService();

/**
 * AI 模型路由类
 */
export class AIModelsRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/ai/models - 获取模型列表
    this.app.get('/api/v1/ai/models', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        type?: ModelType;
        status?: ModelStatus;
        tags?: string;
        q?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await aiModelsService.listModels(
        paginationParams,
        {
          type: query.type,
          status: query.status,
          tags: query.tags?.split(','),
          search: query.q,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/ai/models - 注册新模型
    this.app.post('/api/v1/ai/models', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as RegisterModelRequest;
      const userId = (request as any).user?.id || 'system';

      const model = await aiModelsService.registerModel(body, userId);
      return reply.code(201).send(model);
    });

    // GET /api/v1/ai/models/:id - 获取模型详情
    this.app.get('/api/v1/ai/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const model = await aiModelsService.getModel(params.id);

      if (!model) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'model',
          identifier: params.id,
        });
      }

      return reply.send(model);
    });

    // PUT /api/v1/ai/models/:id - 更新模型信息
    this.app.put('/api/v1/ai/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdateModelRequest;

      const model = await aiModelsService.updateModel(params.id, body);
      return reply.send(model);
    });

    // DELETE /api/v1/ai/models/:id - 删除模型
    this.app.delete('/api/v1/ai/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await aiModelsService.deleteModel(params.id);
      return reply.code(204).send();
    });

    // GET /api/v1/ai/models/:id/versions - 获取模型版本列表
    this.app.get('/api/v1/ai/models/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams & { environment?: Environment };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await aiModelsService.getVersions(
        params.id,
        paginationParams,
        query.environment
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/ai/models/:id/versions - 发布新版本
    this.app.post('/api/v1/ai/models/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as PublishVersionRequest;
      const userId = (request as any).user?.id || 'system';

      const version = await aiModelsService.publishVersion(params.id, body, userId);
      return reply.code(201).send(version);
    });

    // GET /api/v1/ai/models/:id/versions/:versionId - 获取版本详情
    this.app.get('/api/v1/ai/models/:id/versions/:versionId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };
      const version = await aiModelsService.getVersion(params.id, params.versionId);

      if (!version) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'version',
          identifier: params.versionId,
        });
      }

      return reply.send(version);
    });

    // POST /api/v1/ai/models/:id/versions/:versionId/promote - 推广版本到指定环境
    this.app.post('/api/v1/ai/models/:id/versions/:versionId/promote', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };
      const body = request.body as PromoteVersionRequest;
      const userId = (request as any).user?.id || 'system';

      const version = await aiModelsService.promoteVersion(params.id, params.versionId, body, userId);
      return reply.send(version);
    });

    // POST /api/v1/ai/models/:id/versions/:versionId/rollback - 回滚版本
    this.app.post('/api/v1/ai/models/:id/versions/:versionId/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };

      const version = await aiModelsService.rollbackVersion(params.id);
      return reply.send(version);
    });

    // GET /api/v1/ai/models/:id/metrics - 获取模型指标
    this.app.get('/api/v1/ai/models/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const metrics = await aiModelsService.getModelMetrics(params.id);
      return reply.send(metrics);
    });

    // POST /api/v1/ai/models/:id/canary - 配置金丝雀发布
    this.app.post('/api/v1/ai/models/:id/canary', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as CanaryConfigRequest;

      const config = await aiModelsService.configureCanary(params.id, body);
      return reply.send(config);
    });

    // GET /api/v1/ai/models/:id/canary - 获取金丝雀配置
    this.app.get('/api/v1/ai/models/:id/canary', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const config = await aiModelsService.getCanaryConfig(params.id);

      if (!config) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Canary configuration not found',
        });
      }

      return reply.send(config);
    });

    // DELETE /api/v1/ai/models/:id/canary - 停止金丝雀发布
    this.app.delete('/api/v1/ai/models/:id/canary', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await aiModelsService.stopCanary(params.id);
      return reply.code(204).send();
    });
  }
}