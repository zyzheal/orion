// orion-ai-svc/src/services/agent/ToolRegistry.ts

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description: string;
}

export interface ToolExecutionContext {
  params: Record<string, unknown>;
  userId?: string;
  traceId?: string;
}

export type SandboxLevel = 'none' | 'process' | 'container';

export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  parameters: ToolParameter[];
  sandbox: SandboxLevel;
  requiresApproval: boolean;
  execute: (ctx: ToolExecutionContext) => Promise<unknown>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  registerBuiltinTools(): void {
    this.register({
      name: 'prometheus_query',
      version: '1.0.0',
      description: '查询 Prometheus 指标数据',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'PromQL 查询语句' },
        { name: 'range', type: 'string', required: false, description: '时间范围，如 1h, 24h' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用 Prometheus API
        return { data: [], query: ctx.params.query };
      },
    });
    this.register({
      name: 'log_query',
      version: '1.0.0',
      description: '查询日志',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'limit', type: 'number', required: false, description: '返回条数' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用日志 API
        return { logs: [], service: ctx.params.service };
      },
    });
    this.register({
      name: 'diagnose',
      version: '1.0.0',
      description: '运行诊断',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
      ],
      sandbox: 'process',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用诊断服务
        return { diagnosis: {}, service: ctx.params.service };
      },
    });
    this.register({
      name: 'deploy',
      version: '1.0.0',
      description: '触发部署',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'environment', type: 'string', required: true, description: '目标环境' },
      ],
      sandbox: 'container',
      requiresApproval: true,
      execute: async (ctx) => {
        // TODO: 调用部署 API
        return { status: 'deployed', service: ctx.params.service };
      },
    });
    this.register({
      name: 'vector_search',
      version: '1.0.0',
      description: '向量语义搜索',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索内容' },
        { name: 'topK', type: 'number', required: false, description: '返回条数' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用 VectorStore
        return { results: [], query: ctx.params.query };
      },
    });
  }
}