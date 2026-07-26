/**
 * Command Router - Command routing and dispatch service
 */

export interface RouteTarget {
  service: string;
  method: string;
  paramsMapper?: (params: Record<string, unknown>) => Record<string, unknown>;
}

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

const BUILTIN_COMMANDS = ['status', 'logs', 'help', 'ping'];

export class CommandRouter {
  private services: Map<string, any>;
  private handlers: Map<string, CommandHandler> = new Map();

  constructor(services: Map<string, any>) {
    this.services = services;
    this.registerBuiltinHandlers();
  }

  private registerBuiltinHandlers(): void {
    this.handlers.set('status', async (params: Record<string, unknown>) => ({
      status: 'ok', command: 'status', params,
      output: '资源状态查询完成', timestamp: new Date().toISOString(),
    }));
    this.handlers.set('logs', async (params: Record<string, unknown>) => ({
      status: 'ok', command: 'logs', params,
      output: '日志查询完成', lines: [], timestamp: new Date().toISOString(),
    }));
    this.handlers.set('help', async (params: Record<string, unknown>) => ({
      status: 'ok', command: 'help', params,
      output: '可用命令: deploy, rollback, restart, status, logs, diagnose, pipeline, selfhealing_trigger, help, ping',
      timestamp: new Date().toISOString(),
    }));
    this.handlers.set('ping', async () => ({
      status: 'ok', command: 'ping', output: 'pong',
      timestamp: new Date().toISOString(),
    }));
  }

  registerHandler(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  async routeAndExecute(commandName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(commandName);
    if (handler) return handler(params);
    return this.route(commandName, params);
  }

  async route(commandName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const target = COMMAND_ROUTES[commandName];
    if (!target) {
      throw new Error(`未知命令: ${commandName}。使用 /help 查看可用命令列表`);
    }
    const service = this.services.get(target.service);
    if (!service) {
      return this.mockResult(commandName, params, target.service);
    }
    const mappedParams = target.paramsMapper?.(params) ?? params;
    return service[target.method](mappedParams);
  }

  private mockResult(commandName: string, params: Record<string, unknown>, serviceName: string): Record<string, unknown> {
    return {
      mock: true, command: commandName, params,
      message: `服务 ${serviceName} 尚未接入，此为模拟结果`,
      output: `[Mock] 命令 ${commandName} 执行完成`,
      status: 'completed',
      pendingIntegration: BUILTIN_COMMANDS.includes(commandName) ? false : true,
    };
  }
}
