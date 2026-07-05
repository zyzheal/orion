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

    it('should skip disabled modules', async () => {
      const lifecycle: ModuleLifecycle = {
        initialize: jest.fn(),
        start: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'disabled-module',
        name: 'Disabled',
        description: 'A disabled module',
        level: 'service',
        state: 'registered',
        config: { enabled: false },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.startModule('disabled-module');
      expect(lifecycle.initialize).not.toHaveBeenCalled();
      expect(lifecycle.start).not.toHaveBeenCalled();
    });

    it('should throw when module not found', async () => {
      await expect(manager.startModule('nonexistent')).rejects.toThrow('not found');
    });

    it('should skip check for disabled dependencies', async () => {
      // Register a disabled dependency
      const depDescriptor: ModuleDescriptor = {
        id: 'disabled-dep',
        name: 'Disabled Dep',
        description: '',
        level: 'service',
        state: 'registered',
        config: { enabled: false },
      };
      await manager.registerModule(depDescriptor);

      // Register module with disabled dependency
      const lifecycle: ModuleLifecycle = {
        initialize: jest.fn(),
        start: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: '',
        level: 'service',
        state: 'registered',
        config: { enabled: true, dependencies: ['disabled-dep'] },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.startModule('test-module');
      expect(lifecycle.initialize).toHaveBeenCalled();
      expect(lifecycle.start).toHaveBeenCalled();
    });

    it('should start module without lifecycle hooks', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'no-lifecycle',
        name: 'No Lifecycle',
        description: '',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor);
      await manager.startModule('no-lifecycle');
      const mod = await manager.getRegistry().get('no-lifecycle');
      expect(mod?.state).toBe('active');
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

    it('should throw when stopping nonexistent module', async () => {
      await expect(manager.stopModule('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when active modules depend on it', async () => {
      // Register dependency module
      const depDescriptor: ModuleDescriptor = {
        id: 'dep-module',
        name: 'Dep Module',
        description: '',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(depDescriptor);

      // Register dependent module
      const dependentDescriptor: ModuleDescriptor = {
        id: 'dependent-module',
        name: 'Dependent',
        description: '',
        level: 'service',
        state: 'active',
        config: { enabled: true, dependencies: ['dep-module'] },
      };
      await manager.registerModule(dependentDescriptor);

      await expect(manager.stopModule('dep-module')).rejects.toThrow('depend on it');
    });

    it('should stop module without lifecycle hooks', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'no-lifecycle',
        name: 'No Lifecycle',
        description: '',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor);
      await manager.stopModule('no-lifecycle');
      const mod = await manager.getRegistry().get('no-lifecycle');
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

    it('should count active and failed modules', async () => {
      await manager.registerModule({
        id: 'active-mod', name: 'Active', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      await manager.registerModule({
        id: 'failed-mod', name: 'Failed', description: '', level: 'service',
        state: 'failed', config: { enabled: true },
      });
      const status = await manager.getModuleStatus();
      expect(status.total).toBe(2);
      expect(status.active).toBe(1);
      expect(status.failed).toBe(1);
    });
  });

  describe('registerModule', () => {
    it('should update registration when module already exists in registry', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      // Register first time
      await manager.registerModule(descriptor);
      // Register again with lifecycle - should update registration without throwing
      const lifecycle: ModuleLifecycle = { start: jest.fn() };
      await manager.registerModule(descriptor, lifecycle);
      const mod = await manager.getRegistry().get('test-module');
      expect(mod).toBeDefined();
    });
  });

  describe('toggleModule', () => {
    it('should call startModule when enabling a non-active module', async () => {
      const lifecycle: ModuleLifecycle = {
        initialize: jest.fn(),
        start: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: '',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      // toggleModule sets enabled=true on local object and calls startModule
      // startModule gets fresh object from registry which has enabled=true
      await manager.toggleModule('test-module', true);
      expect(lifecycle.initialize).toHaveBeenCalled();
      expect(lifecycle.start).toHaveBeenCalled();
    });

    it('should call stopModule when disabling an active module', async () => {
      const lifecycle: ModuleLifecycle = {
        stop: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: '',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.toggleModule('test-module', false);
      expect(lifecycle.stop).toHaveBeenCalled();
      const mod = await manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('stopped');
    });

    it('should throw when toggling nonexistent module', async () => {
      await expect(manager.toggleModule('nonexistent', true)).rejects.toThrow('not found');
    });

    it('should throw when disabling a core module', async () => {
      const descriptor: ModuleDescriptor = {
        id: 'core-auth',
        name: 'Auth',
        description: '',
        level: 'core',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor);
      await expect(manager.toggleModule('core-auth', false)).rejects.toThrow('Core module');
    });

    it('should not start an already active module when enabling', async () => {
      const lifecycle: ModuleLifecycle = {
        start: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: '',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.toggleModule('test-module', true);
      // Should not call start since already active
      expect(lifecycle.start).not.toHaveBeenCalled();
    });

    it('should not stop an already stopped module when disabling', async () => {
      const lifecycle: ModuleLifecycle = {
        stop: jest.fn(),
      };
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: '',
        level: 'service',
        state: 'stopped',
        config: { enabled: true },
      };
      await manager.registerModule(descriptor, lifecycle);
      await manager.toggleModule('test-module', false);
      expect(lifecycle.stop).not.toHaveBeenCalled();
    });
  });

  describe('loadFromConfig with features', () => {
    it('should load features from config', async () => {
      mockConfig = () => ({
        features: {
          darkMode: { enabled: true },
          betaFeature: { enabled: false },
        },
      });
      manager = new ModuleManager(mockConfig, mockDb);
      await manager.loadFromConfig();
      const darkMode = await manager.getRegistry().get('feature:darkMode');
      expect(darkMode).toBeDefined();
      expect(darkMode?.level).toBe('feature');
      expect(darkMode?.config.enabled).toBe(true);
      const beta = await manager.getRegistry().get('feature:betaFeature');
      expect(beta?.config.enabled).toBe(false);
    });
  });

  describe('loadFromConfig with standalone services', () => {
    it('should load standalone services not in domains', async () => {
      mockConfig = () => ({
        services: {
          standaloneSvc: { enabled: true, priority: 5 },
        },
      });
      manager = new ModuleManager(mockConfig, mockDb);
      await manager.loadFromConfig();
      const svc = await manager.getRegistry().get('service:standaloneSvc');
      expect(svc).toBeDefined();
      expect(svc?.level).toBe('service');
    });

    it('should skip duplicate services', async () => {
      mockConfig = () => ({
        domains: {
          ai: {
            enabled: true,
            services: {
              sharedSvc: { enabled: true },
            },
          },
        },
        services: {
          sharedSvc: { enabled: true },
        },
      });
      manager = new ModuleManager(mockConfig, mockDb);
      await manager.loadFromConfig();
      // Should not throw, just skip duplicate
      const svc = await manager.getRegistry().get('service:sharedSvc');
      expect(svc).toBeDefined();
    });
  });

  describe('loadFromConfig with domain services', () => {
    it('should skip duplicate services within domains', async () => {
      mockConfig = () => ({
        domains: {
          domain1: {
            enabled: true,
            services: {
              sharedSvc: { enabled: true },
            },
          },
          domain2: {
            enabled: true,
            services: {
              sharedSvc: { enabled: true },
            },
          },
        },
      });
      manager = new ModuleManager(mockConfig, mockDb);
      await manager.loadFromConfig();
      // Should not throw, just log warning about duplicate
      const svc = await manager.getRegistry().get('service:sharedSvc');
      expect(svc).toBeDefined();
    });
  });

  describe('loadFromConfig with empty config', () => {
    it('should handle empty config gracefully', async () => {
      mockConfig = () => ({});
      manager = new ModuleManager(mockConfig, mockDb);
      await manager.loadFromConfig();
      const size = await manager.getRegistry().getSize();
      expect(size).toBe(0);
    });
  });

  describe('startAll with dependency issues', () => {
    it('should warn but still start modules when dependency issues exist', async () => {
      // Register a module with missing dependency
      await manager.registerModule({
        id: 'test-module',
        name: 'Test',
        description: '',
        level: 'service',
        state: 'registered',
        config: { enabled: true, dependencies: ['missing-dep'] },
      });
      // startAll should not throw, just warn
      await manager.startAll();
      // Module should not be active because dependency is missing
      const mod = await manager.getRegistry().get('test-module');
      expect(mod?.state).not.toBe('active');
    });
  });

  describe('getRegistry', () => {
    it('should return the registry instance', () => {
      const registry = manager.getRegistry();
      expect(registry).toBeDefined();
    });
  });
});
