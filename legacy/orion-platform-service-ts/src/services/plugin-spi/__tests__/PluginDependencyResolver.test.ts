/**
 * Plugin Dependency Resolver Tests
 *
 * Tests for dependency graph building, cycle detection,
 * topological sorting, and install order resolution.
 */

import { PluginDependencyResolver } from '../PluginDependencyResolver';
import { PluginManifest } from '../types';

describe('PluginDependencyResolver', () => {
  let resolver: PluginDependencyResolver;

  const createManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: 'index.js',
    capabilities: ['CUSTOM_TASK'],
    dependencies: [],
    ...overrides,
  });

  beforeEach(() => {
    resolver = new PluginDependencyResolver();
  });

  describe('resolveDependencies', () => {
    it('should resolve plugins with no dependencies', () => {
      const manifests = [
        createManifest({ name: 'plugin-a' }),
        createManifest({ name: 'plugin-b' }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.cycles).toEqual([]);
      expect(result.installOrder).toHaveLength(2);
    });

    it('should resolve plugins with dependencies in correct order', () => {
      const manifests = [
        createManifest({ name: 'base' }),
        createManifest({
          name: 'dependent',
          dependencies: [{ name: 'base', version: '>=1.0.0' }],
        }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(true);
      expect(result.missing).toEqual([]);

      // base should come before dependent
      const baseIndex = result.installOrder.indexOf('base');
      const depIndex = result.installOrder.indexOf('dependent');
      expect(baseIndex).toBeLessThan(depIndex);
    });

    it('should detect missing dependencies', () => {
      const manifests = [
        createManifest({
          name: 'plugin-a',
          dependencies: [{ name: 'missing-dep', version: '>=1.0.0' }],
        }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual({
        pluginId: 'plugin-a',
        missingDependency: 'missing-dep',
      });
    });

    it('should detect circular dependencies', () => {
      const manifests = [
        createManifest({
          name: 'plugin-a',
          dependencies: [{ name: 'plugin-b', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'plugin-b',
          dependencies: [{ name: 'plugin-a', version: '>=1.0.0' }],
        }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it('should ignore optional missing dependencies', () => {
      const manifests = [
        createManifest({
          name: 'plugin-a',
          dependencies: [
            { name: 'optional-dep', version: '>=1.0.0', optional: true },
          ],
        }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should handle complex dependency chains', () => {
      const manifests = [
        createManifest({ name: 'core' }),
        createManifest({
          name: 'utils',
          dependencies: [{ name: 'core', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'feature-a',
          dependencies: [{ name: 'utils', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'feature-b',
          dependencies: [
            { name: 'utils', version: '>=1.0.0' },
            { name: 'core', version: '>=1.0.0' },
          ],
        }),
      ];

      const result = resolver.resolveDependencies(manifests);

      expect(result.resolved).toBe(true);

      // core should come first
      const coreIndex = result.installOrder.indexOf('core');
      const utilsIndex = result.installOrder.indexOf('utils');
      const featureAIndex = result.installOrder.indexOf('feature-a');
      const featureBIndex = result.installOrder.indexOf('feature-b');

      expect(coreIndex).toBeLessThan(utilsIndex);
      expect(utilsIndex).toBeLessThan(featureAIndex);
      expect(coreIndex).toBeLessThan(featureBIndex);
      expect(utilsIndex).toBeLessThan(featureBIndex);
    });
  });

  describe('detectCycles', () => {
    it('should return empty array for no cycles', () => {
      const manifests = [
        createManifest({ name: 'a' }),
        createManifest({
          name: 'b',
          dependencies: [{ name: 'a', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'c',
          dependencies: [{ name: 'b', version: '>=1.0.0' }],
        }),
      ];

      const cycles = resolver.detectCycles(manifests);
      expect(cycles).toEqual([]);
    });

    it('should detect simple two-node cycle', () => {
      const manifests = [
        createManifest({
          name: 'a',
          dependencies: [{ name: 'b', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'b',
          dependencies: [{ name: 'a', version: '>=1.0.0' }],
        }),
      ];

      const cycles = resolver.detectCycles(manifests);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect three-node cycle', () => {
      const manifests = [
        createManifest({
          name: 'a',
          dependencies: [{ name: 'b', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'b',
          dependencies: [{ name: 'c', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'c',
          dependencies: [{ name: 'a', version: '>=1.0.0' }],
        }),
      ];

      const cycles = resolver.detectCycles(manifests);
      expect(cycles.length).toBeGreaterThan(0);

      // The cycle should contain all three nodes
      const cycle = cycles[0];
      expect(cycle).toContain('a');
      expect(cycle).toContain('b');
      expect(cycle).toContain('c');
    });

    it('should not report cycle for optional dependencies', () => {
      // Optional dependencies don't create edges in the graph
      const manifests = [
        createManifest({
          name: 'a',
          dependencies: [{ name: 'b', version: '>=1.0.0', optional: true }],
        }),
        createManifest({
          name: 'b',
          dependencies: [{ name: 'a', version: '>=1.0.0', optional: true }],
        }),
      ];

      const cycles = resolver.detectCycles(manifests);
      expect(cycles).toEqual([]);
    });

    it('should detect self-dependency', () => {
      const manifests = [
        createManifest({
          name: 'a',
          dependencies: [{ name: 'a', version: '>=1.0.0' }],
        }),
      ];

      const cycles = resolver.detectCycles(manifests);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('getInstallOrder', () => {
    it('should return correct installation order', () => {
      const manifests = [
        createManifest({ name: 'core' }),
        createManifest({
          name: 'middleware',
          dependencies: [{ name: 'core', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'app',
          dependencies: [
            { name: 'core', version: '>=1.0.0' },
            { name: 'middleware', version: '>=1.0.0' },
          ],
        }),
      ];

      const order = resolver.getInstallOrder(manifests);

      expect(order).toEqual(['core', 'middleware', 'app']);
    });

    it('should throw error when circular dependency exists', () => {
      const manifests = [
        createManifest({
          name: 'a',
          dependencies: [{ name: 'b', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'b',
          dependencies: [{ name: 'a', version: '>=1.0.0' }],
        }),
      ];

      expect(() => resolver.getInstallOrder(manifests)).toThrow(
        'circular dependency detected'
      );
    });

    it('should handle diamond dependencies', () => {
      const manifests = [
        createManifest({ name: 'base' }),
        createManifest({
          name: 'left',
          dependencies: [{ name: 'base', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'right',
          dependencies: [{ name: 'base', version: '>=1.0.0' }],
        }),
        createManifest({
          name: 'top',
          dependencies: [
            { name: 'left', version: '>=1.0.0' },
            { name: 'right', version: '>=1.0.0' },
          ],
        }),
      ];

      const order = resolver.getInstallOrder(manifests);

      const baseIndex = order.indexOf('base');
      const leftIndex = order.indexOf('left');
      const rightIndex = order.indexOf('right');
      const topIndex = order.indexOf('top');

      expect(baseIndex).toBeLessThan(leftIndex);
      expect(baseIndex).toBeLessThan(rightIndex);
      expect(leftIndex).toBeLessThan(topIndex);
      expect(rightIndex).toBeLessThan(topIndex);
    });
  });

  describe('canInstall', () => {
    it('should return true when all dependencies are satisfied', () => {
      const manifest = createManifest({
        name: 'plugin-a',
        dependencies: [{ name: 'plugin-b', version: '>=1.0.0' }],
      });

      const result = resolver.canInstall(manifest, ['plugin-b', 'plugin-c']);

      expect(result.canInstall).toBe(true);
      expect(result.missingDeps).toEqual([]);
    });

    it('should return false when dependencies are missing', () => {
      const manifest = createManifest({
        name: 'plugin-a',
        dependencies: [
          { name: 'plugin-b', version: '>=1.0.0' },
          { name: 'plugin-c', version: '>=1.0.0' },
        ],
      });

      const result = resolver.canInstall(manifest, ['plugin-b']);

      expect(result.canInstall).toBe(false);
      expect(result.missingDeps).toEqual(['plugin-c']);
    });

    it('should ignore optional dependencies', () => {
      const manifest = createManifest({
        name: 'plugin-a',
        dependencies: [{ name: 'optional-dep', version: '>=1.0.0', optional: true }],
      });

      const result = resolver.canInstall(manifest, []);

      expect(result.canInstall).toBe(true);
      expect(result.missingDeps).toEqual([]);
    });

    it('should return true for plugin with no dependencies', () => {
      const manifest = createManifest({ name: 'standalone' });

      const result = resolver.canInstall(manifest, []);

      expect(result.canInstall).toBe(true);
    });
  });
});
