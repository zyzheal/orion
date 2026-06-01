import { ModuleManager, ModuleLifecycle, ModuleDescriptor } from '../ModuleManager';

// In-memory store shared between mock and tests
const store = new Map<string, any>();

jest.mock('../../../repositories/ModuleRegistryRepository', () => {
  return {
    ModuleRegistryRepository: jest.fn().mockImplementation(() => ({
      findById: jest.fn((id: string) => Promise.resolve(store.get(id) || null)),
      findAllModules: jest.fn(() => Promise.resolve(Array.from(store.values()))),
      upsertModule: jest.fn((id: string, data: any) => {
        store.set(id, { id, ...data });
        return Promise.resolve();
      }),
      updateState: jest.fn((id: string, state: string, error?: string) => {
        const entity = store.get(id);
        if (entity) {
          entity.state = state;
          if (error !== undefined) entity.error = error;
        }
        return Promise.resolve();
      }),
      delete: jest.fn((id: string) => {
        store.delete(id);
        return Promise.resolve();
      }),
    })),
  };
});

const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

describe('ModuleManager', () => {
  let manager: ModuleManager;
  let mockConfig: () => any;

  beforeEach(() => {
    store.clear();
    mockConfig = () => ({
      core: {
        auth: { enabled: true },
        database: { enabled: true },
      },
      domains: {
        ai: { enabled: true, autoStart: true },
        chaos: { enabled: false },
      },
      services: {
        adaptivePipeline: { enabled: true },
      },
    });
    manager = new ModuleManager(mockConfig, mockDb);
  });

  describe('loadFromConfig', () => {
    it('should load module configuration', async () => {
      await manager.loadFromConfig();
      const size = await manager.getRegistry().getSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should mark disabled modules as not enabled', async () => {
      await manager.loadFromConfig();
      const chaos = await manager.getRegistry().get('domain:chaos');
      expect(chaos?.config.enabled).toBe(false);
    });
  });

  describe('startAll', () => {
    it('should start all enabled modules in dependency order', async () => {
      await manager.loadFromConfig();
      await manager.startAll();
      const active = await manager.getRegistry().getActiveModules();
      const chaos = await manager.getRegistry().get('domain:chaos');
      expect(active.length).toBeGreaterThan(0);
      expect(chaos?.state).not.toBe('active');
    });
  });

  describe('startModule', () => {
    it('should start a single module and call lifecycle', async () => {
      const lifecycle: ModuleLifecycle = {
        initialize: jest.fn(),
        start: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.startModule('test-module');
      expect(lifecycle.initialize).toHaveBeenCalled();
      expect(lifecycle.start).toHaveBeenCalled();
      const mod = await manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('active');
    });

    it('should fail if dependencies are not met', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true, dependencies: ['missing-dep'] },
      };
      await manager.registerModule(descriptor);
      await expect(manager.startModule('test-module')).rejects.toThrow('missing-dep');
    });
  });

  describe('stopModule', () => {
    it('should stop a module and call lifecycle stop', async () => {
      const lifecycle: ModuleLifecycle = {
        stop: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.stopModule('test-module');
      expect(lifecycle.stop).toHaveBeenCalled();
      const mod = await manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('stopped');
    });
  });

  describe('isModuleEnabled', () => {
    it('should check if a module is enabled', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor);
      const result = await manager.isModuleEnabled('test-module');
      expect(result).toBe(true);
    });
  });

  describe('getModuleStatus', () => {
    it('should return status for all modules', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor);
      const status = await manager.getModuleStatus();
      expect(status.modules).toHaveLength(1);
      expect(status.modules[0].id).toBe('test-module');
      expect(status.modules[0].state).toBe('active');
    });
  });
});
