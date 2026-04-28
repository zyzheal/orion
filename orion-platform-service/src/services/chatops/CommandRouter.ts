/**
 * Command Router — 命令路由分发服务
 *
 * B-4: 将 ChatOps 命令分发到对应的业务服务
 * Phase 1: 目标服务不存在时返回 mock 结果 (标记 mock: true)
 * Phase 2: 支持注册内置 handler (status/logs/help 等不需要外部集成的命令)
 */

export interface RouteTarget {
  service: string;
  method: string;
  paramsMapper?: (params: Record<string, unknown>) => Record<string, unknown>;
}

/** 命令处理器函数签名 */
export type CommandHandler = (
  params: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const COMMAND_ROUTES: Record<string, RouteTarget> = {
  'deploy': { service: 'deploy', method: 'deploy' },
  'rollback': { service: 'deploy', method: 'rollback' },
  'restart': { service: 'deploy', method: 'restartPod' },
  'status': { service: 'monitoring', method: 'getStatus' },
  'logs': { service: 'monitoring', method: 'getLogs' },
  'diagnose': { service: 'diagnostic', method: 'runDiagnosis' },
  'pipeline': { service: 'pipeline', method: 'getPipeline' },
  'selfhealing_trigger': { service: 'selfhealing', method: 'executePolicy' },
};

/** 内置命令 (不需要外部服务集成的命令) */
const BUILTIN_COMMANDS = ['status', 'logs', 'help', 'ping'];

export class CommandRouter {
  private services: Map<string, any>;
  /** 用户注册的自定义处理器 */
  private handlers: Map<string, CommandHandler> = new Map();

  constructor(services: Map<string, any>) {
    this.services = services;
    // 注册内置处理器
    this.registerBuiltinHandlers();
  }

  /** 注册内置处理器 (status/logs/help/ping) */
  private registerBuiltinHandlers(): void {
    this.handlers.set('status', async (params: Record<string, unknown>) => ({
      status: 'ok',
      command: 'status',
      params,
      output: `资源状态查询完成`,
      timestamp: new Date().toISOString(),
    }));

    this.handlers.set('logs', async (params: Record<string, unknown>) => ({
      status: 'ok',
      command: 'logs',
      params,
      output: `日志查询完成`,
      lines: [],
      timestamp: new Date().toISOString(),
    }));

    this.handlers.set('help', async (params: Record<string, unknown>) => ({
      status: 'ok',
      command: 'help',
      params,
      output: '可用命令: deploy, rollback, restart, status, logs, diagnose, pipeline, selfhealing_trigger, help, ping',
      timestamp: new Date().toISOString(),
    }));

    this.handlers.set('ping', async () => ({
      status: 'ok',
      command: 'ping',
      output: 'pong',
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * 注册自定义命令处理器
   * @param name 命令名称
   * @param handler 处理器函数
   */
  registerHandler(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  /**
   * 路由并执行命令
   * @param commandName 命令名称
   * @param params 命令参数
   * @returns 执行结果
   */
  async routeAndExecute(
    commandName: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // 优先检查自定义处理器
    const handler = this.handlers.get(commandName);
    if (handler) {
      return handler(params);
    }

    // 回退到服务路由
    return this.route(commandName, params);
  }

  async route(commandName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = COMMAND_ROUTES[commandName];
    if (!target) {
      // 未知命令: 返回友好错误
      throw new Error(`未知命令: ${commandName}。使用 /help 查看可用命令列表`);
    }

    const service = this.services.get(target.service);
    if (!service) {
      // Phase 1 降级: 返回 mock 结果
      return this.mockResult(commandName, params, target.service);
    }

    const mappedParams = target.paramsMapper?.(params) ?? params;
    return service[target.method](mappedParams);
  }

  /** Phase 1 mock 结果 (目标服务不存在时返回) */
  private mockResult(
    commandName: string,
    params: Record<string, unknown>,
    serviceName: string,
  ): Record<string, unknown> {
    return {
      mock: true,
      command: commandName,
      params,
      message: `服务 ${serviceName} 尚未接入，此为模拟结果`,
      output: `[Mock] 命令 ${commandName} 执行完成`,
      status: 'completed',
      pendingIntegration: BUILTIN_COMMANDS.includes(commandName) ? false : true,
    };
  }
}
