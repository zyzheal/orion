import { ModuleManager, ModuleLifecycle, ModuleDescriptor } from '../ModuleManager';

describe('ModuleManager', () => {
  let manager: ModuleManager;
  let mockConfig: { get: jest.Mock };

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue({
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
      }),
    };
    manager = new ModuleManager(mockConfig.get);
  });

  describe('loadFromConfig', () => {
    it('should load module configuration', () => {
      manager.loadFromConfig();
      expect(manager.getRegistry().size).toBeGreaterThan(0);
    });

    it('should mark disabled modules as not enabled', () => {
      manager.loadFromConfig();
      const chaos = manager.getRegistry().get('domain:chaos');
      expect(chaos?.config.enabled).toBe(false);
    });
  });

  describe('startAll', () => {
    it('should start all enabled modules in dependency order', async () => {
      manager.loadFromConfig();
      await manager.startAll();
      const active = manager.getRegistry().getActiveModules();
      const chaos = manager.getRegistry().get('domain:chaos');
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
      manager.registerModule(descriptor, lifecycle);
      await manager.startModule('test-module');
      expect(lifecycle.initialize).toHaveBeenCalled();
      expect(lifecycle.start).toHaveBeenCalled();
      const mod = manager.getRegistry().get('test-module');
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
      manager.registerModule(descriptor);
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
      manager.registerModule(descriptor, lifecycle);
      await manager.stopModule('test-module');
      expect(lifecycle.stop).toHaveBeenCalled();
      const mod = manager.getRegistry().get('test-module');
      expect(mod?.state).toBe('stopped');
    });
  });

  describe('isModuleEnabled', () => {
    it('should check if a module is enabled', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      manager.registerModule(descriptor);
      expect(manager.isModuleEnabled('test-module')).toBe(true);
    });
  });

  describe('getModuleStatus', () => {
    it('should return status for all modules', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test',
        level: 'service',
        state: 'active',
        config: { enabled: true },
      };
      manager.registerModule(descriptor);
      const status = manager.getModuleStatus();
      expect(status.modules).toHaveLength(1);
      expect(status.modules[0].id).toBe('test-module');
      expect(status.modules[0].state).toBe('active');
    });
  });
});
