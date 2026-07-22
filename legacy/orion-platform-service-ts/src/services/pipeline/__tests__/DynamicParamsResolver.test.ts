/**
 * DynamicParamsResolver - Runtime Parameter Resolution Unit Tests
 *
 * Coverage: resolve, resolveReferences, resolveDynamicStages,
 *           filterIncludedStages, parameter validation, env injection
 */

import { DynamicParamsResolver } from '../DynamicParamsResolver';

describe('DynamicParamsResolver', () => {
  let resolver: DynamicParamsResolver;

  beforeEach(() => {
    resolver = new DynamicParamsResolver();
  });

  // ==================== resolve ====================

  describe('resolve', () => {
    it('should merge default and runtime params', async () => {
      const result = await resolver.resolve(
        'p-1',
        { nodeVersion: '20' },
        { nodeVersion: '18', buildTarget: 'prod' },
        'steps:\n  - build:\n      version: ${params.nodeVersion}',
        { triggerType: 'push', branch: 'main' }
      );

      expect(result.injectedParams.nodeVersion).toBe('20'); // runtime overrides default
      expect(result.injectedParams.buildTarget).toBe('prod'); // default preserved
    });

    it('should inject environment variables', async () => {
      const result = await resolver.resolve(
        'p-1',
        {},
        {},
        'steps: []',
        { triggerType: 'push', branch: 'main', commitSha: 'abc123' }
      );

      expect(result.injectedParams['trigger.type']).toBe('push');
      expect(result.injectedParams['git.branch']).toBe('main');
      expect(result.injectedParams['git.sha']).toBe('abc123');
    });

    it('should resolve ${params.*} references in YAML', async () => {
      const result = await resolver.resolve(
        'p-1',
        { appName: 'my-app' },
        {},
        'name: ${params.appName}\nsteps: []',
        { triggerType: 'manual' }
      );

      expect(result.resolvedYamlDefinition).toContain('my-app');
      expect(result.resolvedYamlDefinition).not.toContain('${params.appName}');
    });

    it('should keep unresolved references for missing params', async () => {
      const result = await resolver.resolve(
        'p-1',
        {},
        {},
        'name: ${params.missing}',
        { triggerType: 'manual' }
      );

      expect(result.resolvedYamlDefinition).toContain('${params.missing}');
    });

    it('should pass through object parameters (validation does not reject)', async () => {
      // Note: validateAndNormalizeParam returns errors:[] for objects (source code quirk)
      // Objects are passed through without validation error
      const result = await resolver.resolve(
        'p-1',
        { bad: { nested: 'object' } },
        {},
        'steps: []',
        { triggerType: 'manual' }
      );
      expect(result.injectedParams.bad).toEqual({ nested: 'object' });
    });

    it('should throw on null parameter values', async () => {
      await expect(
        resolver.resolve(
          'p-1',
          { bad: null },
          {},
          'steps: []',
          { triggerType: 'manual' }
        )
      ).rejects.toThrow('Parameter validation failed');
    });

    it('should accept array parameters', async () => {
      const result = await resolver.resolve(
        'p-1',
        { tags: ['a', 'b'] },
        {},
        'steps: []',
        { triggerType: 'manual' }
      );

      expect(result.injectedParams.tags).toEqual(['a', 'b']);
    });

    it('should reject arrays with non-string items', async () => {
      await expect(
        resolver.resolve(
          'p-1',
          { tags: [1, 2] as any },
          {},
          'steps: []',
          { triggerType: 'manual' }
        )
      ).rejects.toThrow('non-string values');
    });
  });

  // ==================== resolveReferences ====================

  describe('resolveReferences', () => {
    it('should replace parameter references', () => {
      const result = resolver.resolveReferences(
        'name: ${params.app}\nversion: ${params.ver}',
        { app: 'my-app', ver: '1.0' }
      );

      expect(result).toBe('name: my-app\nversion: 1.0');
    });

    it('should handle nested param names', () => {
      const result = resolver.resolveReferences(
        '${params.config.name}',
        { 'config.name': 'test' }
      );

      expect(result).toBe('test');
    });

    it('should leave unresolved params as-is', () => {
      const result = resolver.resolveReferences('${params.unknown}', {});
      expect(result).toBe('${params.unknown}');
    });
  });

  // ==================== resolveDynamicStages ====================

  describe('resolveDynamicStages', () => {
    it('should return empty for stages without conditions (handled by filterIncludedStages)', () => {
      const yaml = `stages:
- name: build
- name: test`;

      // resolveDynamicStages only records stages with 'if' conditions;
      // stages without conditions are included by default via filterIncludedStages
      const result = resolver.resolveDynamicStages(yaml, {});
      expect(result).toEqual([]);
    });

    it('should include stages when condition is true', () => {
      const yaml = `stages:
- name: deploy
  if: \${params.deployEnabled} == "true"`;

      const result = resolver.resolveDynamicStages(yaml, { deployEnabled: 'true' });
      expect(result).toContain('include:deploy');
    });

    it('should exclude stages when condition is false', () => {
      const yaml = `stages:
- name: deploy
  if: \${params.deployEnabled} == "false"`;

      const result = resolver.resolveDynamicStages(yaml, { deployEnabled: 'true' });
      expect(result).toContain('exclude:deploy');
    });
  });

  // ==================== filterIncludedStages ====================

  describe('filterIncludedStages', () => {
    it('should filter out excluded stages', () => {
      const stages = [
        { name: 'build', type: 'build' },
        { name: 'deploy', type: 'deploy' },
        { name: 'test', type: 'test' },
      ];

      const result = DynamicParamsResolver.filterIncludedStages(stages, [
        'include:build',
        'exclude:deploy',
        'include:test',
      ]);

      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toEqual(['build', 'test']);
    });

    it('should include stages by default when no decision', () => {
      const stages = [
        { name: 'build', type: 'build' },
        { name: 'unknown', type: 'custom' },
      ];

      const result = DynamicParamsResolver.filterIncludedStages(stages, ['include:build']);

      expect(result).toHaveLength(2);
    });
  });

  // ==================== Environment Variable Injection ====================

  describe('environment injection', () => {
    it('should inject default git.branch for push trigger', async () => {
      const result = await resolver.resolve(
        'p-1', {}, {}, 'steps: []',
        { triggerType: 'push' }
      );

      expect(result.injectedParams['git.branch']).toBe('main');
      expect(result.injectedParams['git.sha']).toBe('unknown');
    });

    it('should inject trigger.timestamp', async () => {
      const result = await resolver.resolve(
        'p-1', {}, {}, 'steps: []',
        { triggerType: 'manual' }
      );

      expect(result.injectedParams['trigger.timestamp']).toBeDefined();
    });

    it('should inject trigger.by', async () => {
      const result = await resolver.resolve(
        'p-1', {}, {}, 'steps: []',
        { triggerType: 'api', triggerBy: 'user-1' }
      );

      expect(result.injectedParams['trigger.by']).toBe('user-1');
    });
  });
});
