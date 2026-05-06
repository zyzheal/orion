import { ModuleRegistry, ModuleDescriptor } from '../ModuleRegistry';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('register', () => {
    it('should register a module successfully', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true, autoStart: true, priority: 10 },
      };
      registry.register(module);
      expect(registry.get('test-module')).toEqual(module);
    });

    it('should throw error when registering duplicate module', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      expect(() => registry.register(module)).toThrow('Module test-module is already registered');
    });
  });

  describe('state transitions', () => {
    it('should transition from registered to starting to active', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      registry.setState('test-module', 'starting');
      registry.setState('test-module', 'active');
      expect(registry.get('test-module')?.state).toBe('active');
    });

    it('should transition to failed state with error message', () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      registry.register(module);
      registry.setFailed('test-module', new Error('Connection failed'));
      const mod = registry.get('test-module');
      expect(mod?.state).toBe('failed');
      expect(mod?.error).toBe('Connection failed');
    });
  });

  describe('dependency validation', () => {
    it('should validate satisfied dependencies', () => {
      registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = registry.validateDependencies();
      expect(result.valid).toBe(true);
      expect(result.missingDependencies).toEqual([]);
    });

    it('should detect missing dependencies', () => {
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a', 'module-c'] },
      });
      const result = registry.validateDependencies();
      expect(result.valid).toBe(false);
      expect(result.missingDependencies).toContain('module-a');
      expect(result.missingDependencies).toContain('module-c');
    });

    it('should detect circular dependencies', () => {
      registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-b'] },
      });
      registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = registry.validateDependencies();
      expect(result.circularDependencies).toBeDefined();
      expect(result.circularDependencies!.length).toBeGreaterThan(0);
    });
  });

  describe('getStartupOrder', () => {
    it('should return modules in dependency order', () => {
      registry.register({
        id: 'db', name: 'DB', description: '', level: 'core',
        state: 'registered', config: { enabled: true, priority: 1 },
      });
      registry.register({
        id: 'auth', name: 'Auth', description: '', level: 'core',
        state: 'registered', config: { enabled: true, dependencies: ['db'], priority: 2 },
      });
      registry.register({
        id: 'api', name: 'API', description: '', level: 'domain',
        state: 'registered', config: { enabled: true, dependencies: ['auth'], priority: 10 },
      });
      const order = registry.getStartupOrder();
      expect(order).toEqual(['db', 'auth', 'api']);
    });
  });

  describe('listByLevel', () => {
    it('should filter modules by level', () => {
      registry.register({
        id: 'core-1', name: 'Core 1', description: '', level: 'core',
        state: 'registered', config: { enabled: true },
      });
      registry.register({
        id: 'svc-1', name: 'Svc 1', description: '', level: 'service',
        state: 'registered', config: { enabled: true },
      });
      const core = registry.listByLevel('core');
      expect(core).toHaveLength(1);
      expect(core[0].id).toBe('core-1');
    });
  });

  describe('getActiveModules', () => {
    it('should return only active modules', () => {
      registry.register({
        id: 'active', name: 'Active', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      registry.register({
        id: 'stopped', name: 'Stopped', description: '', level: 'service',
        state: 'stopped', config: { enabled: false },
      });
      const active = registry.getActiveModules();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });
  });
});
