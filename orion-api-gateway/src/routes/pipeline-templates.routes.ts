/**
 * Pipeline 模板库 API 路由
 *
 * 提供 Pipeline 模板管理功能：
 * - GET /api/v1/pipeline-templates - 获取模板列表
 * - POST /api/v1/pipeline-templates - 创建模板
 * - GET /api/v1/pipeline-templates/:id - 获取模板详情
 * - PUT /api/v1/pipeline-templates/:id - 更新模板
 * - DELETE /api/v1/pipeline-templates/:id - 删除模板
 * - POST /api/v1/pipeline-templates/:id/publish - 发布模板
 * - GET /api/v1/pipeline-templates/:id/versions - 获取模板版本
 * - POST /api/v1/pipeline-templates/:id/instantiate - 从模板创建 Pipeline
 * - GET /api/v1/pipeline-templates/categories - 获取模板分类
 * - GET /api/v1/pipeline-templates/search - 搜索模板
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 模板状态枚举
 */
export enum TemplateStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

/**
 * 模板可见性枚举
 */
export enum TemplateVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
}

/**
 * 模板分类枚举
 */
export enum TemplateCategory {
  CI_CD = 'ci_cd',
  BUILD = 'build',
  DEPLOY = 'deploy',
  TEST = 'test',
  SECURITY = 'security',
  MONITORING = 'monitoring',
  INFRASTRUCTURE = 'infrastructure',
  DATA_PIPELINE = 'data_pipeline',
  ML_OPS = 'ml_ops',
  CUSTOM = 'custom',
}

/**
 * Pipeline 模板
 */
export interface PipelineTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  status: TemplateStatus;
  visibility: TemplateVisibility;
  version: string;
  author: string;
  organization?: string;
  config: Record<string, unknown>;
  parameters: TemplateParameter[];
  readme?: string;
  icon?: string;
  usageCount: number;
  starCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * 模板参数定义
 */
export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

/**
 * 模板版本
 */
export interface TemplateVersion {
  id: string;
  templateId: string;
  version: string;
  config: Record<string, unknown>;
  parameters: TemplateParameter[];
  changeLog: string;
  createdAt: string;
  createdBy: string;
}

/**
 * 创建模板请求
 */
export interface CreateTemplateRequest {
  name: string;
  displayName: string;
  description: string;
  category: TemplateCategory;
  tags?: string[];
  visibility?: TemplateVisibility;
  config: Record<string, unknown>;
  parameters?: TemplateParameter[];
  readme?: string;
  icon?: string;
}

/**
 * 更新模板请求
 */
export interface UpdateTemplateRequest {
  name?: string;
  displayName?: string;
  description?: string;
  category?: TemplateCategory;
  tags?: string[];
  visibility?: TemplateVisibility;
  config?: Record<string, unknown>;
  parameters?: TemplateParameter[];
  readme?: string;
  icon?: string;
}

/**
 * 从模板创建 Pipeline 请求
 */
export interface InstantiateTemplateRequest {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

/**
 * Pipeline 模板服务类
 */
export class PipelineTemplatesService {
  private templates: Map<string, PipelineTemplate> = new Map();
  private versions: Map<string, TemplateVersion[]> = new Map();
  private templateCounter = 0;

  /**
   * 生成模板 ID
   */
  private generateId(): string {
    this.templateCounter++;
    return `tpl_${Date.now()}_${this.templateCounter}`;
  }

  /**
   * 创建模板
   */
  async createTemplate(data: CreateTemplateRequest, userId: string): Promise<PipelineTemplate> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const template: PipelineTemplate = {
      id,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      category: data.category,
      tags: data.tags || [],
      status: TemplateStatus.DRAFT,
      visibility: data.visibility || TemplateVisibility.PRIVATE,
      version: '1.0.0',
      author: userId,
      config: data.config,
      parameters: data.parameters || [],
      readme: data.readme,
      icon: data.icon,
      usageCount: 0,
      starCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, template);
    return template;
  }

  /**
   * 获取模板列表
   */
  async listTemplates(
    params: OffsetPaginationParams,
    filters?: {
      category?: TemplateCategory;
      status?: TemplateStatus;
      visibility?: TemplateVisibility;
      author?: string;
      tags?: string[];
      search?: string;
    }
  ): Promise<{ data: PipelineTemplate[]; total: number }> {
    let templates = Array.from(this.templates.values());

    // 应用过滤
    if (filters?.category) {
      templates = templates.filter(t => t.category === filters.category);
    }
    if (filters?.status) {
      templates = templates.filter(t => t.status === filters.status);
    }
    if (filters?.visibility) {
      templates = templates.filter(t => t.visibility === filters.visibility);
    }
    if (filters?.author) {
      templates = templates.filter(t => t.author === filters.author);
    }
    if (filters?.tags && filters.tags.length > 0) {
      templates = templates.filter(t => filters.tags!.some(tag => t.tags.includes(tag)));
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.displayName.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    templates.sort((a, b) => {
      const aVal = a[sortField as keyof PipelineTemplate];
      const bVal = b[sortField as keyof PipelineTemplate];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = templates.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    templates = templates.slice(offset, offset + limit);

    return { data: templates, total };
  }

  /**
   * 获取模板详情
   */
  async getTemplate(id: string): Promise<PipelineTemplate | null> {
    return this.templates.get(id) || null;
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, data: UpdateTemplateRequest): Promise<PipelineTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    const updated: PipelineTemplate = {
      ...template,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(id, updated);
    return updated;
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    this.templates.delete(id);
    this.versions.delete(id);
  }

  /**
   * 发布模板
   */
  async publishTemplate(id: string): Promise<PipelineTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    const now = new Date().toISOString();
    const updated: PipelineTemplate = {
      ...template,
      status: TemplateStatus.PUBLISHED,
      publishedAt: now,
      updatedAt: now,
    };

    this.templates.set(id, updated);

    // 创建版本记录
    this.addVersion(id, {
      version: template.version,
      config: template.config,
      parameters: template.parameters,
      changeLog: 'Initial publication',
      createdBy: template.author,
    });

    return updated;
  }

  /**
   * 弃用模板
   */
  async deprecateTemplate(id: string): Promise<PipelineTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    const updated: PipelineTemplate = {
      ...template,
      status: TemplateStatus.DEPRECATED,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(id, updated);
    return updated;
  }

  /**
   * 获取模板版本列表
   */
  async getTemplateVersions(
    templateId: string,
    params: OffsetPaginationParams
  ): Promise<{ data: TemplateVersion[]; total: number }> {
    const versions = this.versions.get(templateId) || [];
    const total = versions.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: versions.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 从模板创建 Pipeline
   */
  async instantiateTemplate(
    id: string,
    data: InstantiateTemplateRequest,
    userId: string
  ): Promise<{ pipelineId: string; config: Record<string, unknown> }> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    if (template.status !== TemplateStatus.PUBLISHED) {
      throw new Error('TEMPLATE_NOT_PUBLISHED', 'Template must be published before instantiation');
    }

    // 验证必需参数
    for (const param of template.parameters) {
      if (param.required && !(param.name in data.parameters)) {
        throw new Error(`MISSING_REQUIRED_PARAMETER: ${param.name}`);
      }
    }

    // 增加使用计数
    template.usageCount++;
    template.updatedAt = new Date().toISOString();
    this.templates.set(id, template);

    // 生成 Pipeline ID
    const pipelineId = `pipeline_${Date.now()}`;

    // 合并配置
    const config = this.mergeConfig(template.config, data.parameters);

    return { pipelineId, config };
  }

  /**
   * 获取模板分类列表
   */
  async getCategories(): Promise<{ name: string; displayName: string; count: number }[]> {
    const categories = Object.values(TemplateCategory);
    return categories.map(cat => ({
      name: cat,
      displayName: this.getCategoryDisplayName(cat),
      count: Array.from(this.templates.values()).filter(t => t.category === cat).length,
    }));
  }

  /**
   * 获取分类显示名称
   */
  private getCategoryDisplayName(category: TemplateCategory): string {
    const displayNames: Record<TemplateCategory, string> = {
      [TemplateCategory.CI_CD]: 'CI/CD',
      [TemplateCategory.BUILD]: '构建',
      [TemplateCategory.DEPLOY]: '部署',
      [TemplateCategory.TEST]: '测试',
      [TemplateCategory.SECURITY]: '安全',
      [TemplateCategory.MONITORING]: '监控',
      [TemplateCategory.INFRASTRUCTURE]: '基础设施',
      [TemplateCategory.DATA_PIPELINE]: '数据管道',
      [TemplateCategory.ML_OPS]: 'ML Ops',
      [TemplateCategory.CUSTOM]: '自定义',
    };
    return displayNames[category] || category;
  }

  /**
   * 添加版本记录
   */
  private addVersion(templateId: string, data: Omit<TemplateVersion, 'id' | 'templateId' | 'createdAt'>): void {
    const versions = this.versions.get(templateId) || [];
    versions.unshift({
      id: `ver_${Date.now()}`,
      templateId,
      createdAt: new Date().toISOString(),
      ...data,
    });
    this.versions.set(templateId, versions);
  }

  /**
   * 合并配置和参数
   */
  private mergeConfig(
    templateConfig: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    const config = JSON.parse(JSON.stringify(templateConfig));
    
    // 递归替换参数占位符
    const replacePlaceholders = (obj: unknown): unknown => {
      if (typeof obj === 'string' && obj.startsWith('${') && obj.endsWith('}')) {
        const paramName = obj.slice(2, -1);
        return parameters[paramName] ?? obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(replacePlaceholders);
      }
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replacePlaceholders(value);
        }
        return result;
      }
      return obj;
    };

    return replacePlaceholders(config) as Record<string, unknown>;
  }

  /**
   * 收藏模板
   */
  async starTemplate(id: string): Promise<PipelineTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    template.starCount++;
    template.updatedAt = new Date().toISOString();
    this.templates.set(id, template);
    return template;
  }

  /**
   * 取消收藏
   */
  async unstarTemplate(id: string): Promise<PipelineTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'template',
        identifier: id,
      });
    }

    template.starCount = Math.max(0, template.starCount - 1);
    template.updatedAt = new Date().toISOString();
    this.templates.set(id, template);
    return template;
  }
}

// 单例服务实例
export const pipelineTemplatesService = new PipelineTemplatesService();

/**
 * Pipeline 模板路由类
 */
export class PipelineTemplatesRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/pipeline-templates/categories - 获取模板分类
    this.app.get('/api/v1/pipeline-templates/categories', async (request: FastifyRequest, reply: FastifyReply) => {
      const categories = await pipelineTemplatesService.getCategories();
      return reply.send({ data: categories });
    });

    // GET /api/v1/pipeline-templates/search - 搜索模板
    this.app.get('/api/v1/pipeline-templates/search', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        category?: TemplateCategory;
        status?: TemplateStatus;
        visibility?: TemplateVisibility;
        author?: string;
        tags?: string;
        q?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await pipelineTemplatesService.listTemplates(
        paginationParams,
        {
          category: query.category,
          status: query.status,
          visibility: query.visibility,
          author: query.author,
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

    // GET /api/v1/pipeline-templates - 获取模板列表
    this.app.get('/api/v1/pipeline-templates', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        category?: TemplateCategory;
        status?: TemplateStatus;
        visibility?: TemplateVisibility;
        author?: string;
        tags?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await pipelineTemplatesService.listTemplates(
        paginationParams,
        {
          category: query.category,
          status: query.status,
          visibility: query.visibility,
          author: query.author,
          tags: query.tags?.split(','),
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

    // POST /api/v1/pipeline-templates - 创建模板
    this.app.post('/api/v1/pipeline-templates', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateTemplateRequest;
      const userId = (request as any).user?.id || 'system';

      const template = await pipelineTemplatesService.createTemplate(body, userId);
      return reply.code(201).send(template);
    });

    // GET /api/v1/pipeline-templates/:id - 获取模板详情
    this.app.get('/api/v1/pipeline-templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const template = await pipelineTemplatesService.getTemplate(params.id);

      if (!template) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'template',
          identifier: params.id,
        });
      }

      return reply.send(template);
    });

    // PUT /api/v1/pipeline-templates/:id - 更新模板
    this.app.put('/api/v1/pipeline-templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdateTemplateRequest;

      const template = await pipelineTemplatesService.updateTemplate(params.id, body);
      return reply.send(template);
    });

    // DELETE /api/v1/pipeline-templates/:id - 删除模板
    this.app.delete('/api/v1/pipeline-templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await pipelineTemplatesService.deleteTemplate(params.id);
      return reply.code(204).send();
    });

    // POST /api/v1/pipeline-templates/:id/publish - 发布模板
    this.app.post('/api/v1/pipeline-templates/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const template = await pipelineTemplatesService.publishTemplate(params.id);
      return reply.send(template);
    });

    // POST /api/v1/pipeline-templates/:id/deprecate - 弃用模板
    this.app.post('/api/v1/pipeline-templates/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const template = await pipelineTemplatesService.deprecateTemplate(params.id);
      return reply.send(template);
    });

    // GET /api/v1/pipeline-templates/:id/versions - 获取模板版本列表
    this.app.get('/api/v1/pipeline-templates/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await pipelineTemplatesService.getTemplateVersions(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/pipeline-templates/:id/instantiate - 从模板创建 Pipeline
    this.app.post('/api/v1/pipeline-templates/:id/instantiate', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as InstantiateTemplateRequest;
      const userId = (request as any).user?.id || 'system';

      const result = await pipelineTemplatesService.instantiateTemplate(params.id, body, userId);
      return reply.code(201).send(result);
    });

    // POST /api/v1/pipeline-templates/:id/star - 收藏模板
    this.app.post('/api/v1/pipeline-templates/:id/star', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const template = await pipelineTemplatesService.starTemplate(params.id);
      return reply.send(template);
    });

    // DELETE /api/v1/pipeline-templates/:id/star - 取消收藏
    this.app.delete('/api/v1/pipeline-templates/:id/star', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const template = await pipelineTemplatesService.unstarTemplate(params.id);
      return reply.send(template);
    });
  }
}