/**
 * Configuration Search & UI Schema Service
 *
 * 配置智能搜索 + UI Schema 生成
 *
 * 迁移: Map() mock → PostgreSQL Repository (migration 364)
 * 降级: DB 失败时自动回退到内存数组
 */

import Fuse from 'fuse.js';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ConfigSearch');

// ==================== 配置元数据 ====================

export interface ConfigMetadata {
  domain: string;
  key: string;
  type: string;
  description: string;
  example?: any;
  defaultValue?: any;
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
  tags: string[];
  validations?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
  ui?: {
    label: string;
    group: string;
    order: number;
    widget: 'input' | 'select' | 'toggle' | 'slider' | 'json' | 'code';
    placeholder?: string;
    helpText?: string;
    dependsOn?: string[];
  };
}

// ==================== 搜索索引 ====================

class ConfigSearchIndex {
  private fuse: Fuse<ConfigMetadata> | null = null;
  private metadata: ConfigMetadata[] = [];
  private readonly fallbackSource: ConfigMetadata[];

  constructor(fallbackSource: ConfigMetadata[]) {
    this.fallbackSource = fallbackSource;
  }

  /**
   * Initialize from PostgreSQL; falls back to in-memory array on failure.
   */
  async initializeFromDatabase(db?: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  }): Promise<void> {
    if (!db) {
      logger.warn('No DB pool provided — using in-memory fallback');
      this._loadFromFallback();
      return;
    }

    try {
      const result = await db.query(
        `SELECT domain, "key", type, description, example, default_value,
                sensitivity, tags, validations, ui_config
         FROM config_metadata ORDER BY domain, "key"`,
      );

      const configs: ConfigMetadata[] = result.rows.map((row: any) => ({
        domain: row.domain,
        key: row.key,
        type: row.type,
        description: row.description,
        example: row.example,
        defaultValue: row.default_value,
        sensitivity: (row.sensitivity ?? 'internal') as ConfigMetadata['sensitivity'],
        tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags) : []),
        validations: typeof row.validations === 'string' ? JSON.parse(row.validations) : row.validations,
        ui: typeof row.ui_config === 'string' ? JSON.parse(row.ui_config) : row.ui_config,
      }));

      this._rebuildIndex(configs);
      logger.info({ count: configs.length, source: 'database' }, 'Search index loaded from DB');
    } catch (err) {
      logger.warn({ error: String(err) }, 'DB load failed — falling back to in-memory metadata');
      this._loadFromFallback();
    }
  }

  private _loadFromFallback(): void {
    this._rebuildIndex(this.fallbackSource);
  }

  private _rebuildIndex(configs: ConfigMetadata[]): void {
    this.metadata = configs;

    this.fuse = new Fuse(configs, {
      keys: [
        { name: 'key', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'domain', weight: 0.2 },
        { name: 'tags', weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    logger.info({ count: configs.length }, 'Search index rebuilt');
  }

  /**
   * Search configuration metadata using Fuse.js fuzzy search with filters.
   */
  search(query: string, options?: {
    limit?: number;
    domain?: string;
    sensitivity?: string[];
    tags?: string[];
  }): Array<ConfigMetadata & { score: number; matches?: any }> {
    if (!this.fuse) {
      return [];
    }

    let results = this.fuse.search(query);

    // Apply filters (Fuse doesn't support our custom multi-field filters)
    if (options?.domain) {
      results = results.filter(r => r.item.domain === options.domain);
    }

    if (options?.sensitivity?.length) {
      results = results.filter(r => options.sensitivity!.includes(r.item.sensitivity));
    }

    if (options?.tags?.length) {
      results = results.filter(r =>
        r.item.tags.some(t => options.tags!.includes(t))
      );
    }

    const limit = options?.limit || 20;

    return results.slice(0, limit).map(r => ({
      ...r.item,
      score: r.score || 0,
      matches: r.matches,
    }));
  }

  /**
   * Get unique domain list.
   */
  getDomains(): string[] {
    const domains = this.metadata.map(c => c.domain);
    return Array.from(new Set(domains));
  }

  /**
   * Get unique tag list.
   */
  getTags(): string[] {
    const tags = this.metadata.flatMap(c => c.tags);
    return Array.from(new Set(tags));
  }

  /**
   * Group configurations by domain.
   */
  groupByDomain(): Map<string, ConfigMetadata[]> {
    const groups = new Map<string, ConfigMetadata[]>();

    for (const config of this.metadata) {
      const existing = groups.get(config.domain) || [];
      existing.push(config);
      groups.set(config.domain, existing);
    }

    return groups;
  }

  /**
   * Return all metadata (from index or fallback).
   */
  getAll(): ConfigMetadata[] {
    return this.metadata.length > 0 ? this.metadata : this.fallbackSource;
  }
}

// ==================== UI Schema 生成 ====================

export class ConfigUISchemaGenerator {
  /**
   * 生成配置编辑表单的 JSON Schema
   */
  static generateJsonSchema(configs: ConfigMetadata[]): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const config of configs) {
      properties[config.key] = this.fieldToJsonSchema(config);

      if (config.ui?.widget === 'select' && config.validations?.enum) {
        properties[config.key].enum = config.validations.enum;
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * 生成表单布局配置
   */
  static generateFormLayout(configs: ConfigMetadata[]): any {
    const groups: Record<string, Array<{
      key: string;
      label: string;
      widget: string;
      order: number;
      helpText?: string;
      placeholder?: string;
      dependsOn?: string[];
    }>> = {};

    for (const config of configs) {
      const groupName = config.ui?.group || 'general';

      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      groups[groupName].push({
        key: `${config.domain}.${config.key}`,
        label: config.ui?.label || config.key,
        widget: config.ui?.widget || this.inferWidget(config),
        order: config.ui?.order || 0,
        helpText: config.ui?.helpText,
        placeholder: config.ui?.placeholder,
        dependsOn: config.ui?.dependsOn,
      });
    }

    // Sort by order within each group
    for (const group of Object.values(groups)) {
      group.sort((a, b) => a.order - b.order);
    }

    return groups;
  }

  /**
   * 生成配置文档 Markdown
   */
  static generateMarkdown(configs: ConfigMetadata[]): string {
    let md = '# Orion 配置参考\n\n';

    // Group by domain
    const byDomain = new Map<string, ConfigMetadata[]>();
    for (const config of configs) {
      const existing = byDomain.get(config.domain) || [];
      existing.push(config);
      byDomain.set(config.domain, existing);
    }

    for (const [domain, domainConfigs] of Array.from(byDomain.entries())) {
      md += `## ${domain}\n\n`;

      for (const config of domainConfigs) {
        md += `### \`${config.key}\`\n\n`;

        if (config.description) {
          md += `${config.description}\n\n`;
        }

        md += '| 属性 | 值 |\n';
        md += '|------|-----|\n';
        md += `| 类型 | \`${config.type}\` |\n`;
        md += `| 敏感度 | ${config.sensitivity} |\n`;

        if (config.defaultValue !== undefined) {
          md += `| 默认值 | \`${JSON.stringify(config.defaultValue)}\` |\n`;
        }

        if (config.example) {
          md += `| 示例 | \`${JSON.stringify(config.example)}\` |\n`;
        }

        if (config.tags.length > 0) {
          md += `| 标签 | ${config.tags.join(', ')} |\n`;
        }

        md += '\n';
      }
    }

    return md;
  }

  // ==================== 私有方法 ====================

  private static fieldToJsonSchema(config: ConfigMetadata): any {
    const schema: any = {
      type: config.type,
      description: config.description,
    };

    // Validation rules
    if (config.validations) {
      if (config.validations.min !== undefined) {
        schema.minimum = config.validations.min;
      }
      if (config.validations.max !== undefined) {
        schema.maximum = config.validations.max;
      }
      if (config.validations.pattern) {
        schema.pattern = config.validations.pattern;
      }
    }

    // Example value
    if (config.example) {
      schema.example = config.example;
    } else if (config.defaultValue !== undefined) {
      schema.default = config.defaultValue;
    }

    return schema;
  }

  private static inferWidget(config: ConfigMetadata): string {
    if (config.ui?.widget) {
      return config.ui.widget;
    }

    switch (config.type) {
      case 'boolean':
        return 'toggle';
      case 'number':
        return 'input';
      case 'string':
        if (config.validations?.enum) {
          return 'select';
        }
        if (config.key.toLowerCase().includes('json')) {
          return 'json';
        }
        if (config.key.toLowerCase().includes('code') || config.key.toLowerCase().includes('script')) {
          return 'code';
        }
        return 'input';
      case 'object':
      case 'array':
        return 'json';
      default:
        return 'input';
    }
  }
}

// ==================== 预定义配置元数据 ====================

export const CONFIG_METADATA: ConfigMetadata[] = [
  // Pipeline config
  {
    domain: 'pipeline',
    key: 'maxConcurrentRuns',
    type: 'number',
    description: '最大并发流水线运行数',
    example: 50,
    defaultValue: 50,
    sensitivity: 'internal',
    tags: ['pipeline', 'concurrency', 'limit'],
    validations: { min: 1, max: 1000 },
    ui: { label: '最大并发数', group: 'pipeline', order: 1, widget: 'input' },
  },
  {
    domain: 'pipeline',
    key: 'defaultTimeoutMinutes',
    type: 'number',
    description: '流水线默认超时时间(分钟)',
    example: 120,
    defaultValue: 120,
    sensitivity: 'internal',
    tags: ['pipeline', 'timeout'],
    validations: { min: 1, max: 1440 },
    ui: { label: '默认超时', group: 'pipeline', order: 2, widget: 'input' },
  },
  {
    domain: 'pipeline',
    key: 'retryAttempts',
    type: 'number',
    description: '失败重试次数',
    example: 3,
    defaultValue: 3,
    sensitivity: 'internal',
    tags: ['pipeline', 'retry'],
    validations: { min: 0, max: 10 },
    ui: { label: '重试次数', group: 'pipeline', order: 3, widget: 'input' },
  },

  // Security config
  {
    domain: 'security',
    key: 'jwtSecret',
    type: 'string',
    description: 'JWT 签名密钥 - 生产环境必须修改',
    sensitivity: 'secret',
    tags: ['security', 'jwt', 'secret'],
    ui: { label: 'JWT 密钥', group: 'security', order: 1, widget: 'input', helpText: '生产环境必须使用环境变量设置' },
  },
  {
    domain: 'security',
    key: 'jwtExpiryHours',
    type: 'number',
    description: 'JWT 令牌过期时间(小时)',
    example: 24,
    defaultValue: 24,
    sensitivity: 'internal',
    tags: ['security', 'jwt', 'timeout'],
    validations: { min: 1, max: 168 },
    ui: { label: 'JWT 过期时间', group: 'security', order: 2, widget: 'input' },
  },

  // Deploy config
  {
    domain: 'deploy',
    key: 'defaultStrategy',
    type: 'string',
    description: '默认部署策略',
    example: 'rolling',
    defaultValue: 'rolling',
    sensitivity: 'public',
    tags: ['deploy', 'strategy'],
    validations: { enum: ['rolling', 'blue-green', 'canary'] },
    ui: { label: '部署策略', group: 'deploy', order: 1, widget: 'select' },
  },
  {
    domain: 'deploy',
    key: 'autoRollbackEnabled',
    type: 'boolean',
    description: '部署失败自动回滚',
    example: true,
    defaultValue: true,
    sensitivity: 'internal',
    tags: ['deploy', 'rollback'],
    ui: { label: '自动回滚', group: 'deploy', order: 2, widget: 'toggle' },
  },

  // Alert config
  {
    domain: 'alert',
    key: 'deduplicationWindowMs',
    type: 'number',
    description: '告警去重时间窗口(毫秒)',
    example: 300000,
    defaultValue: 300000,
    sensitivity: 'internal',
    tags: ['alert', 'deduplication'],
    validations: { min: 60000, max: 3600000 },
    ui: { label: '去重窗口', group: 'alert', order: 1, widget: 'input', helpText: '默认 5 分钟' },
  },

  // Deployment window
  {
    domain: 'deploymentWindow',
    key: 'enabled',
    type: 'boolean',
    description: '是否启用发布窗口控制',
    example: false,
    defaultValue: false,
    sensitivity: 'internal',
    tags: ['deploy', 'window', 'control'],
    ui: { label: '启用发布窗口', group: 'window', order: 1, widget: 'toggle' },
  },
  {
    domain: 'deploymentWindow',
    key: 'allowedDays',
    type: 'array',
    description: '允许发布的日期',
    example: ['Sat', 'Sun'],
    defaultValue: ['Sat', 'Sun'],
    sensitivity: 'internal',
    tags: ['deploy', 'window', 'schedule'],
    ui: { label: '允许日期', group: 'window', order: 2, widget: 'select' },
  },
  {
    domain: 'deploymentWindow',
    key: 'allowedHours',
    type: 'array',
    description: '允许发布的小时(UTC)',
    example: [2, 3, 4],
    defaultValue: [2, 3, 4],
    sensitivity: 'internal',
    tags: ['deploy', 'window', 'schedule'],
    ui: { label: '允许小时', group: 'window', order: 3, widget: 'slider', helpText: 'UTC 时区' },
  },

  // Notification config
  {
    domain: 'notification',
    key: 'defaultChannel',
    type: 'string',
    description: '默认通知渠道',
    example: 'dingtalk',
    defaultValue: 'dingtalk',
    sensitivity: 'public',
    tags: ['notification', 'channel'],
    validations: { enum: ['dingtalk', 'wechat', 'email', 'sms', 'slack'] },
    ui: { label: '默认渠道', group: 'notification', order: 1, widget: 'select' },
  },

  // Monitoring config
  {
    domain: 'monitoring',
    key: 'sampleRate',
    type: 'number',
    description: 'Trace 采样率',
    example: 0.1,
    defaultValue: 0.1,
    sensitivity: 'internal',
    tags: ['monitoring', 'trace', 'sampling'],
    validations: { min: 0, max: 1 },
    ui: { label: '采样率', group: 'monitoring', order: 1, widget: 'slider', helpText: '0-1 之间的小数' },
  },

  // Tenant config
  {
    domain: 'tenant',
    key: 'maxTenants',
    type: 'number',
    description: '最大租户数量',
    example: 100,
    defaultValue: 100,
    sensitivity: 'internal',
    tags: ['tenant', 'quota', 'limit'],
    validations: { min: 1, max: 10000 },
    ui: { label: '最大租户数', group: 'tenant', order: 1, widget: 'input' },
  },
  {
    domain: 'tenant',
    key: 'rlsEnabled',
    type: 'boolean',
    description: '是否启用行级安全策略',
    example: true,
    defaultValue: true,
    sensitivity: 'internal',
    tags: ['tenant', 'security', 'rls'],
    ui: { label: '启用 RLS', group: 'tenant', order: 2, widget: 'toggle' },
  },
];

// ==================== 搜索服务 ====================

class ConfigSearchService {
  private searchIndex: ConfigSearchIndex;

  constructor(
    private readonly dbPool?: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    },
  ) {
    this.searchIndex = new ConfigSearchIndex(CONFIG_METADATA);
    // Async init — fire-and-forget so constructor stays synchronous
    this.searchIndex.initializeFromDatabase(dbPool).catch(err => {
      logger.error({ error: String(err) }, 'Failed to initialize search index from DB');
    });
  }

  /**
   * 搜索配置
   */
  search(query: string, options?: {
    limit?: number;
    domain?: string;
    sensitivity?: string[];
    tags?: string[];
  }): Array<ConfigMetadata & { score: number }> {
    return this.searchIndex.search(query, options);
  }

  /**
   * 获取建议
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    const results = this.searchIndex.search(query, { limit });
    return results.map(r => `${r.domain}.${r.key}`);
  }

  /**
   * 获取所有域
   */
  getDomains(): string[] {
    return this.searchIndex.getDomains();
  }

  /**
   * 获取所有标签
   */
  getTags(): string[] {
    return this.searchIndex.getTags();
  }

  /**
   * 获取所有配置元数据
   */
  getAllMetadata(): ConfigMetadata[] {
    return this.searchIndex.getAll();
  }

  /**
   * 获取指定域的配置
   */
  getByDomain(domain: string): ConfigMetadata[] {
    const all = this.searchIndex.getAll();
    return all.filter(c => c.domain === domain);
  }

  /**
   * 生成 UI Schema
   */
  generateUISchema() {
    const configs = this.searchIndex.getAll();
    return {
      jsonSchema: ConfigUISchemaGenerator.generateJsonSchema(configs),
      formLayout: ConfigUISchemaGenerator.generateFormLayout(configs),
    };
  }

  /**
   * 生成配置文档
   */
  generateDocs(): string {
    const configs = this.searchIndex.getAll();
    return ConfigUISchemaGenerator.generateMarkdown(configs);
  }
}

// 单例 — 传入 dbPool 使搜索服务使用数据库持久化
// dbPool 通常在应用启动时通过依赖注入传入
let _dbPool: {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
} | undefined;

export function setConfigSearchDbPool(pool: typeof _dbPool): void {
  _dbPool = pool;
  // Replace singleton with DB-backed instance
  _instance = new ConfigSearchService(_dbPool);
}

let _instance: ConfigSearchService;

/**
 * 获取全局单例。
 * 如果在调用 setConfigSearchDbPool 之前调用，则使用内存模式。
 */
export function getConfigSearchService(): ConfigSearchService {
  if (!_instance) {
    _instance = new ConfigSearchService(_dbPool);
  }
  return _instance;
}

// 向后兼容：默认导出为无参构造（内存模式）
export const configSearchService = new ConfigSearchService();

export default configSearchService;
