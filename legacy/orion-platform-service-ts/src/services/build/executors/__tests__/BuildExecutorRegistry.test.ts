import { BuildExecutorRegistry, buildExecutorRegistry } from '../BuildExecutorRegistry';
import { BuildExecutor, BuildType, Platform, BuildConfig, BuildContext, BuildResult } from '../BaseBuildExecutor';

describe('BuildExecutorRegistry', () => {
  // Mock executor for testing
  const createMockExecutor = (type: BuildType): BuildExecutor => ({
    type,
    platforms: [Platform.LINUX],
    checkEnvironment: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue({
      status: 'success' as const,
      artifacts: ['artifact1.tar.gz'],
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
  });

  describe('register', () => {
    it('should register a new executor', () => {
      const registry = new BuildExecutorRegistry();
      const executor = createMockExecutor(BuildType.NODE);

      registry.register(executor);

      expect(registry.get(BuildType.NODE)).toBe(executor);
    });

    it('should throw when registering duplicate executor', () => {
      const registry = new BuildExecutorRegistry();
      const executor = createMockExecutor(BuildType.NODE);

      registry.register(executor);

      expect(() => registry.register(executor)).toThrow(`Executor ${BuildType.NODE} already registered`);
    });
  });

  describe('get', () => {
    it('should return registered executor', () => {
      const registry = new BuildExecutorRegistry();
      const executor = createMockExecutor(BuildType.PYTHON);

      registry.register(executor);

      expect(registry.get(BuildType.PYTHON)).toBe(executor);
    });

    it('should return undefined for unregistered type', () => {
      const registry = new BuildExecutorRegistry();

      expect(registry.get(BuildType.GO)).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all registered executors', () => {
      const registry = new BuildExecutorRegistry();
      const executor1 = createMockExecutor(BuildType.NODE);
      const executor2 = createMockExecutor(BuildType.PYTHON);
      const executor3 = createMockExecutor(BuildType.GO);

      registry.register(executor1);
      registry.register(executor2);
      registry.register(executor3);

      const list = registry.list();

      expect(list).toHaveLength(3);
      expect(list).toContain(executor1);
      expect(list).toContain(executor2);
      expect(list).toContain(executor3);
    });

    it('should return empty array when no executors registered', () => {
      const registry = new BuildExecutorRegistry();

      expect(registry.list()).toHaveLength(0);
    });
  });
});

describe('buildExecutorRegistry singleton', () => {
  it('should be an instance of BuildExecutorRegistry', () => {
    expect(buildExecutorRegistry).toBeInstanceOf(BuildExecutorRegistry);
  });
});