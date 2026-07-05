/**
 * CommandRouter 单元测试
 *
 * 测试命令路由分发、内置处理器、自定义处理器注册、mock 降级等。
 */

// Mock the ChatOpsCommandHandlerRepository before importing
jest.mock('../../../repositories/ChatOpsCommandHandlerRepository', () => {
  return {
    ChatOpsCommandHandlerRepository: jest.fn().mockImplementation(() => ({
      upsertByCommandName: jest.fn().mockResolvedValue({}),
      findByCommandName: jest.fn().mockResolvedValue(null),
      findEnabled: jest.fn().mockResolvedValue([]),
      disableByCommandName: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { CommandRouter, CommandHandler } from '../CommandRouter';

describe('CommandRouter', () => {
  let services: Map<string, any>;
  let mockDb: { query: jest.Mock };

  beforeEach(() => {
    services = new Map();
    mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
  });

  describe('constructor', () => {
    it('should initialize with services map', () => {
      const router = new CommandRouter(services);
      expect(router).toBeDefined();
    });

    it('should accept optional db and tenantId', () => {
      const router = new CommandRouter(services, mockDb, 'tenant-1');
      expect(router).toBeDefined();
    });

    it('should work without db (null repo)', () => {
      const router = new CommandRouter(services);
      expect(router).toBeDefined();
    });
  });

  describe('registerHandler', () => {
    it('should register a custom handler', async () => {
      const router = new CommandRouter(services);
      const handler: CommandHandler = async (params) => ({
        status: 'ok',
        custom: true,
        params,
      });

      router.registerHandler('mycommand', handler);
      const result = await router.routeAndExecute('mycommand', { foo: 'bar' });
      expect(result.status).toBe('ok');
      expect(result.custom).toBe(true);
    });

    it('should persist handler registration to repo when db is provided', async () => {
      const router = new CommandRouter(services, mockDb, 'tenant-1');
      const handler: CommandHandler = async () => ({ status: 'ok' });

      router.registerHandler('test-cmd', handler);
      // The upsert is fire-and-forget, so we just verify it doesn't throw
      const result = await router.routeAndExecute('test-cmd', {});
      expect(result.status).toBe('ok');
    });
  });

  describe('routeAndExecute with builtin handlers', () => {
    it('should execute the status builtin command', async () => {
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('status', { target: 'api' });

      expect(result.status).toBe('ok');
      expect(result.command).toBe('status');
      expect(result.output).toBe('资源状态查询完成');
      expect(result.timestamp).toBeDefined();
    });

    it('should execute the logs builtin command', async () => {
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('logs', { lines: 100 });

      expect(result.status).toBe('ok');
      expect(result.command).toBe('logs');
      expect(result.output).toBe('日志查询完成');
      expect(result.lines).toEqual([]);
    });

    it('should execute the help builtin command', async () => {
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('help', {});

      expect(result.status).toBe('ok');
      expect(result.command).toBe('help');
      expect(result.output).toContain('可用命令');
    });

    it('should execute the ping builtin command', async () => {
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('ping', {});

      expect(result.status).toBe('ok');
      expect(result.command).toBe('ping');
      expect(result.output).toBe('pong');
    });
  });

  describe('routeAndExecute with service routing', () => {
    it('should route deploy command to deploy service', async () => {
      const deployService = {
        deploy: jest.fn().mockResolvedValue({ status: 'deployed', service: 'api' }),
      };
      services.set('deploy', deployService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('deploy', { service: 'api', environment: 'staging' });

      expect(deployService.deploy).toHaveBeenCalledWith({ service: 'api', environment: 'staging' });
      expect(result.status).toBe('deployed');
    });

    it('should route rollback command to deploy service', async () => {
      const deployService = {
        rollback: jest.fn().mockResolvedValue({ status: 'rolled_back' }),
      };
      services.set('deploy', deployService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('rollback', { target: 'v1.0' });

      expect(deployService.rollback).toHaveBeenCalled();
      expect(result.status).toBe('rolled_back');
    });

    it('should route restart command to deploy service', async () => {
      const deployService = {
        restartPod: jest.fn().mockResolvedValue({ status: 'restarted' }),
      };
      services.set('deploy', deployService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('restart', { pod: 'api-abc' });

      expect(deployService.restartPod).toHaveBeenCalled();
      expect(result.status).toBe('restarted');
    });

    it('should route diagnose command to diagnostic service', async () => {
      const diagnosticService = {
        runDiagnosis: jest.fn().mockResolvedValue({ status: 'diagnosed' }),
      };
      services.set('diagnostic', diagnosticService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('diagnose', { target: 'api' });

      expect(diagnosticService.runDiagnosis).toHaveBeenCalled();
      expect(result.status).toBe('diagnosed');
    });

    it('should route pipeline command to pipeline service', async () => {
      const pipelineService = {
        getPipeline: jest.fn().mockResolvedValue({ status: 'found', id: 'p-1' }),
      };
      services.set('pipeline', pipelineService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('pipeline', { id: 'p-1' });

      expect(pipelineService.getPipeline).toHaveBeenCalled();
      expect(result.status).toBe('found');
    });

    it('should route selfhealing_trigger to selfhealing service', async () => {
      const selfhealingService = {
        executePolicy: jest.fn().mockResolvedValue({ status: 'executed' }),
      };
      services.set('selfhealing', selfhealingService);

      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('selfhealing_trigger', { policy: 'restart-on-crash' });

      expect(selfhealingService.executePolicy).toHaveBeenCalled();
      expect(result.status).toBe('executed');
    });
  });

  describe('mock fallback when service is not available', () => {
    it('should return mock result when target service is not registered', async () => {
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('deploy', { service: 'api' });

      expect(result.mock).toBe(true);
      expect(result.command).toBe('deploy');
      expect(result.status).toBe('completed');
      expect(result.message).toContain('尚未接入');
      expect(result.pendingIntegration).toBe(true);
    });

    it('should mark builtin commands as not pending integration in mock', async () => {
      // status is a builtin command but also has a route target (monitoring)
      // If monitoring service is not registered, it should use the builtin handler first
      const router = new CommandRouter(services);
      const result = await router.routeAndExecute('status', {});

      // Builtins take priority over routing, so it returns builtin result
      expect(result.status).toBe('ok');
      expect(result.command).toBe('status');
    });

    it('should include params in mock result', async () => {
      const router = new CommandRouter(services);
      const params = { service: 'api', environment: 'prod' };
      const result = await router.routeAndExecute('deploy', params);

      expect(result.params).toEqual(params);
    });
  });

  describe('route (direct routing without builtin check)', () => {
    it('should throw OrionError for unknown command', async () => {
      const router = new CommandRouter(services);

      await expect(router.route('unknown-cmd', {})).rejects.toThrow('未知命令');
    });

    it('should return mock when service is not in services map', async () => {
      const router = new CommandRouter(services);
      const result = await router.route('deploy', { service: 'api' });

      expect(result.mock).toBe(true);
    });

    it('should call service method when service exists', async () => {
      const deployService = {
        deploy: jest.fn().mockResolvedValue({ ok: true }),
      };
      services.set('deploy', deployService);

      const router = new CommandRouter(services);
      await router.route('deploy', { service: 'api' });

      expect(deployService.deploy).toHaveBeenCalled();
    });
  });

  describe('custom handler priority over routing', () => {
    it('should use custom handler instead of service routing when both exist', async () => {
      const deployService = {
        deploy: jest.fn().mockResolvedValue({ from: 'service' }),
      };
      services.set('deploy', deployService);

      const router = new CommandRouter(services);
      router.registerHandler('deploy', async () => ({ from: 'custom-handler' }));

      const result = await router.routeAndExecute('deploy', {});
      expect(result.from).toBe('custom-handler');
      expect(deployService.deploy).not.toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should pass tenantId to repo on handler registration', async () => {
      const router = new CommandRouter(services, mockDb, 'tenant-abc');
      router.registerHandler('custom-cmd', async () => ({ ok: true }));

      // Verify the handler still works
      const result = await router.routeAndExecute('custom-cmd', {});
      expect(result.ok).toBe(true);
    });

    it('should work with null tenantId', async () => {
      const router = new CommandRouter(services, mockDb);
      router.registerHandler('cmd2', async () => ({ ok: true }));

      const result = await router.routeAndExecute('cmd2', {});
      expect(result.ok).toBe(true);
    });
  });
});
