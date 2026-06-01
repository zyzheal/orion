import { ModuleRegistry, ModuleDescriptor } from '../ModuleRegistry';

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

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    store.clear();
    registry = new ModuleRegistry(mockDb);
  });

  describe('register', () => {
    it('should register a module successfully', async () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true, autoStart: true, priority: 10 },
      };
      await registry.register(module);
      const result = await registry.get('test-module');
      expect(result).toBeDefined();
      expect(result!.id).toBe('test-module');
      expect(result!.name).toBe('Test Module');
    });

    it('should throw error when registering duplicate module', async () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await registry.register(module);
      await expect(registry.register(module)).rejects.toThrow('Module test-module is already registered');
    });
  });

  describe('state transitions', () => {
    it('should transition from registered to starting to active', async () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await registry.register(module);
      await registry.setState('test-module', 'starting');
      await registry.setState('test-module', 'active');
      const result = await registry.get('test-module');
      expect(result?.state).toBe('active');
    });

    it('should transition to failed state with error message', async () => {
      const module: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      await registry.register(module);
      await registry.setFailed('test-module', new Error('Connection failed'));
      const mod = await registry.get('test-module');
      expect(mod?.state).toBe('failed');
      expect(mod?.error).toBe('Connection failed');
    });
  });

  describe('dependency validation', () => {
    it('should validate satisfied dependencies', async () => {
      await registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      await registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = await registry.validateDependencies();
      expect(result.valid).toBe(true);
      expect(result.missingDependencies).toEqual([]);
    });

    it('should detect missing dependencies', async () => {
      await registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a', 'module-c'] },
      });
      const result = await registry.validateDependencies();
      expect(result.valid).toBe(false);
      expect(result.missingDependencies).toContain('module-a');
      expect(result.missingDependencies).toContain('module-c');
    });

    it('should detect circular dependencies', async () => {
      await registry.register({
        id: 'module-a', name: 'A', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-b'] },
      });
      await registry.register({
        id: 'module-b', name: 'B', description: '', level: 'service',
        state: 'registered', config: { enabled: true, dependencies: ['module-a'] },
      });
      const result = await registry.validateDependencies();
      expect(result.circularDependencies).toBeDefined();
      expect(result.circularDependencies!.length).toBeGreaterThan(0);
    });
  });

  describe('getStartupOrder', () => {
    it('should return modules in dependency order', async () => {
      await registry.register({
        id: 'db', name: 'DB', description: '', level: 'core',
        state: 'registered', config: { enabled: true, priority: 1 },
      });
      await registry.register({
        id: 'auth', name: 'Auth', description: '', level: 'core',
        state: 'registered', config: { enabled: true, dependencies: ['db'], priority: 2 },
      });
      await registry.register({
        id: 'api', name: 'API', description: '', level: 'domain',
        state: 'registered', config: { enabled: true, dependencies: ['auth'], priority: 10 },
      });
      const order = await registry.getStartupOrder();
      expect(order).toEqual(['db', 'auth', 'api']);
    });
  });

  describe('listByLevel', () => {
    it('should filter modules by level', async () => {
      await registry.register({
        id: 'core-1', name: 'Core 1', description: '', level: 'core',
        state: 'registered', config: { enabled: true },
      });
      await registry.register({
        id: 'svc-1', name: 'Svc 1', description: '', level: 'service',
        state: 'registered', config: { enabled: true },
      });
      const core = await registry.listByLevel('core');
      expect(core).toHaveLength(1);
      expect(core[0].id).toBe('core-1');
    });
  });

  describe('getActiveModules', () => {
    it('should return only active modules', async () => {
      await registry.register({
        id: 'active', name: 'Active', description: '', level: 'service',
        state: 'active', config: { enabled: true },
      });
      await registry.register({
        id: 'stopped', name: 'Stopped', description: '', level: 'service',
        state: 'stopped', config: { enabled: false },
      });
      const active = await registry.getActiveModules();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });
  });
});
