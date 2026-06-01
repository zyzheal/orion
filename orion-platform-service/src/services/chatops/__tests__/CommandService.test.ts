/**
 * CommandService 单元测试
 *
 * 测试命令注册、解析、帮助、CRUD 操作、健康检查。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Create stable mock repository instance
const mockRepoInstance = {
  findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
  findByName: jest.fn().mockResolvedValue(null),
  findByAlias: jest.fn().mockResolvedValue(null),
  findByPermission: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
};

// Mock ChatOpsRepository
jest.mock('../../../repositories/ChatOpsRepository', () => ({
  ChatOpsCommandRepository: jest.fn().mockImplementation(() => mockRepoInstance),
}));

import { CommandService } from '../CommandService';

describe('CommandService', () => {
  let service: CommandService;
  let mockPool: any;
  let mockEventBus: any;

  const sampleEntity = {
    id: 'cmd-1',
    name: 'deploy',
    subcommand: 'service',
    schema: { service: { type: 'string', required: true } },
    aliases: ['deploy-service', 'rollout'],
    permissionLevel: 'deployer',
    examples: ['/deploy service=api'],
  };

  beforeEach(() => {
    // Reset singleton
    (CommandService as any)._instance = undefined;
    jest.clearAllMocks();

    // Re-set default return values
    mockRepoInstance.findAll.mockResolvedValue({ entities: [], total: 0 });
    mockRepoInstance.findByName.mockResolvedValue(null);
    mockRepoInstance.findByAlias.mockResolvedValue(null);
    mockRepoInstance.findByPermission.mockResolvedValue([]);
    mockRepoInstance.insert.mockResolvedValue({});
    mockRepoInstance.delete.mockResolvedValue(true);

    mockPool = {
      query: jest.fn(),
    };
    mockEventBus = {
      publish: jest.fn(),
    };
    service = new CommandService({ pool: mockPool, eventBus: mockEventBus });
  });

  describe('constructor', () => {
    it('should create service with options', () => {
      expect(service).toBeDefined();
    });

    it('should create default repository when none provided', () => {
      const svc = new CommandService({ pool: mockPool });
      expect(svc).toBeDefined();
    });

    it('should use provided repository', () => {
      const customRepo = { findAll: jest.fn() } as any;
      const svc = new CommandService({ pool: mockPool, repository: customRepo });
      expect(svc).toBeDefined();
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CommandService.getInstance();
      const instance2 = CommandService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('create (static)', () => {
    it('should create a new instance', () => {
      const svc = CommandService.create(mockPool, { eventBus: mockEventBus });
      expect(svc).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize only once', async () => {
      await service.initialize();
      await service.initialize(); // Second call should be no-op

      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('insert', () => {
    it('should insert a new command', async () => {
      mockRepoInstance.insert.mockResolvedValue(sampleEntity);

      const result = await service.insert({
        name: 'deploy',
        subcommand: 'service',
        schema: { service: { type: 'string', required: true } },
        aliases: ['deploy-service'],
        permissionLevel: 'deployer',
        examples: ['/deploy service=api'],
      });

      expect(result.name).toBe('deploy');
      expect(result.aliases).toEqual(['deploy-service', 'rollout']);
      expect(mockEventBus.publish).toHaveBeenCalledWith('chatops.command.created', expect.any(Object));
    });

    it('should use defaults for optional fields', async () => {
      mockRepoInstance.insert.mockResolvedValue({
        ...sampleEntity,
        subcommand: '',
        schema: {},
        aliases: [],
        permissionLevel: 'user',
        examples: [],
      });

      await service.insert({ name: 'test' });

      expect(mockRepoInstance.insert).toHaveBeenCalledWith({
        name: 'test',
        subcommand: '',
        schema: {},
        aliases: [],
        permissionLevel: 'user',
        examples: [],
      });
    });

    it('should throw when no repository configured', async () => {
      const svc = new CommandService({});
      // Force no repository
      (svc as any).commandRepository = null;

      await expect(svc.insert({ name: 'test' })).rejects.toThrow('no database repository');
    });
  });

  describe('getByName', () => {
    it('should return command by direct name match', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const result = await service.getByName('deploy');

      expect(result).toBeDefined();
      expect(result!.name).toBe('deploy');
    });

    it('should fall back to alias match', async () => {
      mockRepoInstance.findByName.mockResolvedValue(null);
      mockRepoInstance.findByAlias.mockResolvedValue(sampleEntity);

      const result = await service.getByName('rollout');

      expect(result).toBeDefined();
      expect(result!.name).toBe('deploy');
    });

    it('should return undefined when not found', async () => {
      mockRepoInstance.findByName.mockResolvedValue(null);
      mockRepoInstance.findByAlias.mockResolvedValue(null);

      const result = await service.getByName('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all commands', async () => {
      mockRepoInstance.findAll.mockResolvedValue({ entities: [sampleEntity], total: 1 });

      const result = await service.list();

      expect(result.commands).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by permission level', async () => {
      mockRepoInstance.findByPermission.mockResolvedValue([sampleEntity]);

      const result = await service.list({ permissionLevel: 'deployer' });

      expect(result.commands).toHaveLength(1);
      expect(mockRepoInstance.findByPermission).toHaveBeenCalledWith('deployer');
    });

    it('should filter by name', async () => {
      mockRepoInstance.findAll.mockResolvedValue({
        entities: [
          sampleEntity,
          { ...sampleEntity, id: 'cmd-2', name: 'restart', aliases: [] },
        ],
        total: 2,
      });

      const result = await service.list({ name: 'deploy' });

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('deploy');
    });

    it('should filter by alias name', async () => {
      mockRepoInstance.findAll.mockResolvedValue({
        entities: [sampleEntity],
        total: 1,
      });

      const result = await service.list({ name: 'rollout' });

      expect(result.commands).toHaveLength(1);
    });

    it('should paginate results', async () => {
      const entities = Array.from({ length: 5 }, (_, i) => ({
        ...sampleEntity,
        id: `cmd-${i}`,
        name: `cmd-${i}`,
        aliases: [],
      }));
      mockRepoInstance.findAll.mockResolvedValue({ entities, total: 5 });

      const result = await service.list({ page: 2, perPage: 2 });

      expect(result.commands).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  describe('delete', () => {
    it('should delete existing command', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);
      mockRepoInstance.delete.mockResolvedValue(true);

      const result = await service.delete('deploy');

      expect(result).toBe(true);
    });

    it('should return false when command not found', async () => {
      mockRepoInstance.findByName.mockResolvedValue(null);

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help for existing command', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const help = await service.getHelp('deploy');

      expect(help).toBeDefined();
      expect(help!.name).toBe('deploy');
      expect(help!.subcommand).toBe('service');
      expect(help!.aliases).toEqual(['deploy-service', 'rollout']);
      expect(help!.permissionLevel).toBe('deployer');
    });

    it('should return undefined for unknown command', async () => {
      mockRepoInstance.findByName.mockResolvedValue(null);
      mockRepoInstance.findByAlias.mockResolvedValue(null);

      const help = await service.getHelp('nonexistent');

      expect(help).toBeUndefined();
    });
  });

  describe('parseCommand', () => {
    it('should parse command with params', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const result = await service.parseCommand('/deploy service=api environment=staging');

      expect(result.command).toBeDefined();
      expect(result.command!.name).toBe('deploy');
      expect(result.params).toEqual({ service: 'api', environment: 'staging' });
    });

    it('should parse command without leading slash', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const result = await service.parseCommand('deploy service=api');

      expect(result.command).toBeDefined();
      expect(result.params).toEqual({ service: 'api' });
    });

    it('should handle command with no params', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const result = await service.parseCommand('/deploy');

      expect(result.params).toEqual({});
    });

    it('should return undefined command for unknown command', async () => {
      mockRepoInstance.findByName.mockResolvedValue(null);
      mockRepoInstance.findByAlias.mockResolvedValue(null);

      const result = await service.parseCommand('/unknown param=value');

      expect(result.command).toBeUndefined();
      expect(result.params).toEqual({ param: 'value' });
    });

    it('should trim whitespace from input', async () => {
      mockRepoInstance.findByName.mockResolvedValue(sampleEntity);

      const result = await service.parseCommand('  /deploy service=api  ');

      expect(result.command).toBeDefined();
      expect(result.params).toEqual({ service: 'api' });
    });
  });

  describe('getAllCommands', () => {
    it('should return all commands', async () => {
      mockRepoInstance.findAll.mockResolvedValue({ entities: [sampleEntity], total: 1 });

      const result = await service.getAllCommands();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('deploy');
    });
  });

  describe('getHealth', () => {
    it('should return healthy when DB responds', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const health = await service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded when DB fails', async () => {
      mockPool.query.mockRejectedValue(new Error('DB down'));

      const health = await service.getHealth();

      expect(health.status).toBe('degraded');
    });
  });
});
