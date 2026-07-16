/**
 * module-lifecycle types.ts type definition tests
 *
 * Verifies that type interfaces are correctly structured by creating conformant objects.
 * TypeScript types are erased at runtime, so these tests validate runtime compatibility.
 */

// Import types to verify they exist and are usable
import type {
  ModuleState,
  ModuleLevel,
  ModuleConfig,
  ModuleDescriptor,
  ModuleLifecycle,
  ModuleRegistration,
  DependencyValidationResult,
  DomainConfig,
  ModuleManagerConfig,
} from '../types';

describe('module-lifecycle types', () => {
  describe('ModuleState', () => {
    it('should accept valid state values', () => {
      const validStates: ModuleState[] = [
        'registered',
        'starting',
        'active',
        'stopping',
        'stopped',
        'failed',
      ];
      expect(validStates).toHaveLength(6);
    });
  });

  describe('ModuleLevel', () => {
    it('should accept valid level values', () => {
      const validLevels: ModuleLevel[] = ['core', 'domain', 'service', 'feature'];
      expect(validLevels).toHaveLength(4);
    });
  });

  describe('ModuleConfig', () => {
    it('should create a valid config object with required fields', () => {
      const config: ModuleConfig = { enabled: true };
      expect(config.enabled).toBe(true);
    });

    it('should create a config with all optional fields', () => {
      const config: ModuleConfig = {
        enabled: false,
        autoStart: true,
        dependencies: ['dep1', 'dep2'],
        priority: 10,
      };
      expect(config.autoStart).toBe(true);
      expect(config.dependencies).toEqual(['dep1', 'dep2']);
      expect(config.priority).toBe(10);
    });
  });

  describe('ModuleDescriptor', () => {
    it('should create a valid descriptor object', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test-module',
        name: 'Test Module',
        description: 'A test module',
        level: 'service',
        state: 'registered',
        config: { enabled: true },
      };
      expect(descriptor.id).toBe('test-module');
      expect(descriptor.level).toBe('service');
      expect(descriptor.state).toBe('registered');
    });

    it('should support all optional fields', () => {
      const descriptor: ModuleDescriptor = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        level: 'core',
        state: 'active',
        config: { enabled: true },
        domain: 'ai',
        routePrefix: '/api/test',
        error: 'Some error',
      };
      expect(descriptor.domain).toBe('ai');
      expect(descriptor.routePrefix).toBe('/api/test');
      expect(descriptor.error).toBe('Some error');
    });
  });

  describe('ModuleLifecycle', () => {
    it('should create a valid lifecycle object with all hooks', () => {
      const lifecycle: ModuleLifecycle = {
        initialize: async () => {},
        start: async () => {},
        stop: async () => {},
        healthCheck: async () => true,
      };
      expect(typeof lifecycle.initialize).toBe('function');
      expect(typeof lifecycle.start).toBe('function');
      expect(typeof lifecycle.stop).toBe('function');
      expect(typeof lifecycle.healthCheck).toBe('function');
    });

    it('should allow empty lifecycle (all hooks optional)', () => {
      const lifecycle: ModuleLifecycle = {};
      expect(lifecycle.initialize).toBeUndefined();
      expect(lifecycle.start).toBeUndefined();
      expect(lifecycle.stop).toBeUndefined();
      expect(lifecycle.healthCheck).toBeUndefined();
    });
  });

  describe('ModuleRegistration', () => {
    it('should create a valid registration with descriptor only', () => {
      const registration: ModuleRegistration = {
        descriptor: {
          id: 'test',
          name: 'Test',
          description: 'Test',
          level: 'service',
          state: 'registered',
          config: { enabled: true },
        },
      };
      expect(registration.descriptor.id).toBe('test');
      expect(registration.lifecycle).toBeUndefined();
      expect(registration.routeRegistrar).toBeUndefined();
    });

    it('should create a registration with lifecycle and routeRegistrar', () => {
      const registration: ModuleRegistration = {
        descriptor: {
          id: 'test',
          name: 'Test',
          description: 'Test',
          level: 'domain',
          state: 'registered',
          config: { enabled: true },
        },
        lifecycle: {
          start: async () => {},
        },
        routeRegistrar: async (app: any) => {},
      };
      expect(registration.lifecycle).toBeDefined();
      expect(registration.routeRegistrar).toBeDefined();
    });
  });

  describe('DependencyValidationResult', () => {
    it('should create a valid result for successful validation', () => {
      const result: DependencyValidationResult = {
        valid: true,
        missingDependencies: [],
      };
      expect(result.valid).toBe(true);
      expect(result.circularDependencies).toBeUndefined();
    });

    it('should create a result with missing and circular dependencies', () => {
      const result: DependencyValidationResult = {
        valid: false,
        missingDependencies: ['dep1'],
        circularDependencies: [['a', 'b', 'a']],
      };
      expect(result.valid).toBe(false);
      expect(result.missingDependencies).toContain('dep1');
      expect(result.circularDependencies).toHaveLength(1);
    });
  });

  describe('DomainConfig', () => {
    it('should create a valid domain config', () => {
      const config: DomainConfig = {
        enabled: true,
        autoStart: true,
        services: {
          svc1: { enabled: true, priority: 10 },
          svc2: { enabled: false },
        },
      };
      expect(config.enabled).toBe(true);
      expect(Object.keys(config.services!)).toHaveLength(2);
    });
  });

  describe('ModuleManagerConfig', () => {
    it('should create a valid manager config with all sections', () => {
      const config: ModuleManagerConfig = {
        core: { auth: { enabled: true } },
        domains: {
          ai: { enabled: true, services: {} },
        },
        services: {
          svc1: { enabled: true },
        },
        features: {
          feat1: { enabled: false },
        },
      };
      expect(config.core).toBeDefined();
      expect(config.domains).toBeDefined();
      expect(config.services).toBeDefined();
      expect(config.features).toBeDefined();
    });

    it('should allow empty config (all sections optional)', () => {
      const config: ModuleManagerConfig = {};
      expect(config.core).toBeUndefined();
      expect(config.domains).toBeUndefined();
    });
  });

});
