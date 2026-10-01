/**
 * Pipeline 版本控制 API 路由
 *
 * 提供 Pipeline 版本管理功能：
 * - GET /api/v1/pipelines/:id/versions - 获取版本列表
 * - GET /api/v1/pipelines/:id/versions/:versionId - 获取特定版本
 * - POST /api/v1/pipelines/:id/versions - 创建新版本
 * - PUT /api/v1/pipelines/:id/versions/:versionId - 更新版本
 * - POST /api/v1/pipelines/:id/versions/:versionId/publish - 发布版本
 * - POST /api/v1/pipelines/:id/versions/:versionId/rollback - 回滚版本
 * - POST /api/v1/pipelines/:id/versions/compare - 比较版本
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, CursorPaginationParams, OffsetPaginationParams } from '../utils/pagination';

/**
 * 版本状态枚举
 */
export enum VersionStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

/**
 * 版本创建请求
 */
export interface CreateVersionRequest {
  name: string;
  description?: string;
  config: Record<string, unknown>;
  baseVersionId?: string;
  changeLog?: string;
  tags?: string[];
}

/**
 * 版本更新请求
 */
export interface UpdateVersionRequest {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  changeLog?: string;
  tags?: string[];
}

/**
 * 版本比较请求
 */
export interface CompareVersionsRequest {
  fromVersionId: string;
  toVersionId: string;
  includeConfig?: boolean;
}

/**
 * 版本发布请求
 */
export interface PublishVersionRequest {
  releaseNotes?: string;
  makeDefault?: boolean;
}

/**
 * 版本回滚请求
 */
export interface RollbackVersionRequest {
  reason: string;
  targetVersionId?: string;
}

/**
 * 版本响应
 */
export interface VersionResponse {
  id: string;
  pipelineId: string;
  version: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  status: VersionStatus;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  deprecatedAt?: string;
  changeLog?: string;
  tags: string[];
  parentVersionId?: string;
}

/**
 * Pipeline 版本控制服务类
 */
export class PipelineVersionsService {
  private versions: Map<string, VersionResponse> = new Map();
  private versionCounter = 0;

  /**
   * 生成版本 ID
   */
  private generateVersionId(): string {
    this.versionCounter++;
    return `v_${Date.now()}_${this.versionCounter}`;
  }

  /**
   * 生成版本号
   */
  private generateVersionNumber(pipelineId: string): string {
    const pipelineVersions = Array.from(this.versions.values())
      .filter(v => v.pipelineId === pipelineId);
    const majorVersions = pipelineVersions.filter(v => v.version.startsWith('v1.'));
    return `v1.${majorVersions.length + 1}.0`;
  }

  /**
   * 创建版本
   */
  async createVersion(pipelineId: string, data: CreateVersionRequest, userId: string): Promise<VersionResponse> {
    const id = this.generateVersionId();
    const version = this.generateVersionNumber(pipelineId);
    const now = new Date().toISOString();

    const newVersion: VersionResponse = {
      id,
      pipelineId,
      version,
      name: data.name,
      description: data.description,
      config: data.config,
      status: VersionStatus.DRAFT,
      isDefault: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      changeLog: data.changeLog,
      tags: data.tags || [],
      parentVersionId: data.baseVersionId,
    };

    this.versions.set(id, newVersion);
    return newVersion;
  }

  /**
   * 获取版本列表
   */
  async listVersions(
    pipelineId: string,
    params: OffsetPaginationParams,
    filters?: { status?: VersionStatus; tags?: string[] }
  ): Promise<{ data: VersionResponse[]; total: number }> {
    let versions = Array.from(this.versions.values())
      .filter(v => v.pipelineId === pipelineId);

    // 应用过滤
    if (filters?.status) {
      versions = versions.filter(v => v.status === filters.status);
    }
    if (filters?.tags && filters.tags.length > 0) {
      versions = versions.filter(v => 
        filters.tags.some(tag => v.tags.includes(tag))
      );
    }

    // 排序
    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    versions.sort((a, b) => {
      const aVal = a[sortField as keyof VersionResponse];
      const bVal = b[sortField as keyof VersionResponse];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = versions.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    versions = versions.slice(offset, offset + limit);

    return { data: versions, total };
  }

  /**
   * 获取版本详情
   */
  async getVersion(pipelineId: string, versionId: string): Promise<VersionResponse | null> {
    const version = this.versions.get(versionId);
    if (!version || version.pipelineId !== pipelineId) {
      return null;
    }
    return version;
  }

  /**
   * 更新版本
   */
  async updateVersion(
    pipelineId: string,
    versionId: string,
    data: UpdateVersionRequest
  ): Promise<VersionResponse> {
    const version = await this.getVersion(pipelineId, versionId);
    if (!version) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: versionId,
      });
    }

    if (version.status === VersionStatus.PUBLISHED) {
      throw new AppError('VERSION_LOCKED', 'Cannot update published version', 400);
    }

    const updated = {
      ...version,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.versions.set(versionId, updated);
    return updated;
  }

  /**
   * 发布版本
   */
  async publishVersion(
    pipelineId: string,
    versionId: string,
    data: PublishVersionRequest
  ): Promise<VersionResponse> {
    const version = await this.getVersion(pipelineId, versionId);
    if (!version) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: versionId,
      });
    }

    if (version.status === VersionStatus.PUBLISHED) {
      throw new AppError('VERSION_ALREADY_PUBLISHED', 'Version is already published', 400);
    }

    // 如果设为默认版本，取消其他默认版本
    if (data.makeDefault) {
      for (const [id, v] of this.versions) {
        if (v.pipelineId === pipelineId && v.isDefault) {
          this.versions.set(id, { ...v, isDefault: false });
        }
      }
    }

    const now = new Date().toISOString();
    const updated: VersionResponse = {
      ...version,
      status: VersionStatus.PUBLISHED,
      isDefault: data.makeDefault || false,
      publishedAt: now,
      updatedAt: now,
    };
    this.versions.set(versionId, updated);
    return updated;
  }

  /**
   * 回滚版本
   */
  async rollbackVersion(
    pipelineId: string,
    data: RollbackVersionRequest
  ): Promise<VersionResponse> {
    const targetVersionId = data.targetVersionId;
    if (!targetVersionId) {
      // 找到上一个发布的版本
      const versions = Array.from(this.versions.values())
        .filter(v => v.pipelineId === pipelineId && v.status === VersionStatus.PUBLISHED)
        .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
      
      if (versions.length < 2) {
        throw new AppError('NO_ROLLBACK_TARGET', 'No previous version to rollback to', 400);
      }
      return versions[1];
    }

    const targetVersion = await this.getVersion(pipelineId, targetVersionId);
    if (!targetVersion) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: targetVersionId,
      });
    }

    return targetVersion;
  }

  /**
   * 比较版本
   */
  async compareVersions(
    pipelineId: string,
    data: CompareVersionsRequest
  ): Promise<{ from: VersionResponse; to: VersionResponse; diff: Record<string, unknown> }> {
    const fromVersion = await this.getVersion(pipelineId, data.fromVersionId);
    const toVersion = await this.getVersion(pipelineId, data.toVersionId);

    if (!fromVersion || !toVersion) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: !fromVersion ? data.fromVersionId : data.toVersionId,
      });
    }

    // 简单的 diff 实现
    const diff = this.calculateDiff(fromVersion.config, toVersion.config);

    return { from: fromVersion, to: toVersion, diff };
  }

  /**
   * 计算配置差异
   */
  private calculateDiff(from: Record<string, unknown>, to: Record<string, unknown>): Record<string, unknown> {
    const diff: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);

    for (const key of allKeys) {
      if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
        diff[key] = {
          from: from[key],
          to: to[key],
        };
      }
    }

    return diff;
  }

  /**
   * 弃用版本
   */
  async deprecateVersion(pipelineId: string, versionId: string): Promise<VersionResponse> {
    const version = await this.getVersion(pipelineId, versionId);
    if (!version) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'version',
        identifier: versionId,
      });
    }

    const updated: VersionResponse = {
      ...version,
      status: VersionStatus.DEPRECATED,
      deprecatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.versions.set(versionId, updated);
    return updated;
  }
}

// 单例服务实例
export const pipelineVersionsService = new PipelineVersionsService();

/**
 * Pipeline 版本控制路由类
 */
export class PipelineVersionsRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/pipelines/:id/versions - 获取版本列表
    this.app.get('/api/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams & { status?: VersionStatus; tags?: string };
      
      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await pipelineVersionsService.listVersions(
        params.id,
        paginationParams,
        { status: query.status, tags: query.tags?.split(',') }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
          sort: paginationParams.sort,
          order: paginationParams.order,
        })
      );
    });

    // GET /api/v1/pipelines/:id/versions/:versionId - 获取版本详情
    this.app.get('/api/v1/pipelines/:id/versions/:versionId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };
      const version = await pipelineVersionsService.getVersion(params.id, params.versionId);
      
      if (!version) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'version',
          identifier: params.versionId,
        });
      }

      return reply.send(version);
    });

    // POST /api/v1/pipelines/:id/versions - 创建新版本
    this.app.post('/api/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as CreateVersionRequest;
      const userId = (request as any).user?.id || 'system';

      const version = await pipelineVersionsService.createVersion(params.id, body, userId);
      return reply.code(201).send(version);
    });

    // PUT /api/v1/pipelines/:id/versions/:versionId - 更新版本
    this.app.put('/api/v1/pipelines/:id/versions/:versionId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };
      const body = request.body as UpdateVersionRequest;

      const version = await pipelineVersionsService.updateVersion(params.id, params.versionId, body);
      return reply.send(version);
    });

    // POST /api/v1/pipelines/:id/versions/:versionId/publish - 发布版本
    this.app.post('/api/v1/pipelines/:id/versions/:versionId/publish', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };
      const body = (request.body || {}) as PublishVersionRequest;

      const version = await pipelineVersionsService.publishVersion(params.id, params.versionId, body);
      return reply.send(version);
    });

    // POST /api/v1/pipelines/:id/versions/:versionId/deprecate - 弃用版本
    this.app.post('/api/v1/pipelines/:id/versions/:versionId/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; versionId: string };

      const version = await pipelineVersionsService.deprecateVersion(params.id, params.versionId);
      return reply.send(version);
    });

    // POST /api/v1/pipelines/:id/versions/rollback - 回滚版本
    this.app.post('/api/v1/pipelines/:id/versions/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as RollbackVersionRequest;

      const version = await pipelineVersionsService.rollbackVersion(params.id, body);
      return reply.send(version);
    });

    // POST /api/v1/pipelines/:id/versions/compare - 比较版本
    this.app.post('/api/v1/pipelines/:id/versions/compare', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as CompareVersionsRequest;

      const result = await pipelineVersionsService.compareVersions(params.id, body);
      return reply.send(result);
    });
  }
}