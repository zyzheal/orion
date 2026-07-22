/**
 * VariableContext Tests
 *
 * Tests for the pipeline variable context that manages task output
 * propagation and variable resolution using ${tasks.<taskName>.outputs.<key>} syntax.
 */

import { VariableContext } from '../VariableContext';

describe('VariableContext', () => {
  let ctx: VariableContext;

  beforeEach(() => {
    ctx = new VariableContext('run-001');
  });

  describe('setTaskOutput / getTaskOutput', () => {
    test('should set and get a single task output', () => {
      ctx.setTaskOutput('build', 'version', '1.2.3');
      expect(ctx.getTaskOutput('build', 'version')).toBe('1.2.3');
    });

    test('should return undefined for non-existent task output', () => {
      expect(ctx.getTaskOutput('build', 'version')).toBeUndefined();
    });

    test('should support multiple outputs per task', () => {
      ctx.setTaskOutput('build', 'version', '1.2.3');
      ctx.setTaskOutput('build', 'image', 'myapp:1.2.3');
      ctx.setTaskOutput('build', 'commit', 'abc123');

      expect(ctx.getTaskOutput('build', 'version')).toBe('1.2.3');
      expect(ctx.getTaskOutput('build', 'image')).toBe('myapp:1.2.3');
      expect(ctx.getTaskOutput('build', 'commit')).toBe('abc123');
    });

    test('should support outputs from different tasks', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      ctx.setTaskOutput('test', 'coverage', '85%');
      ctx.setTaskOutput('deploy', 'url', 'https://example.com');

      expect(ctx.getTaskOutput('build', 'version')).toBe('1.0.0');
      expect(ctx.getTaskOutput('test', 'coverage')).toBe('85%');
      expect(ctx.getTaskOutput('deploy', 'url')).toBe('https://example.com');
    });

    test('should overwrite existing output value', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      ctx.setTaskOutput('build', 'version', '2.0.0');
      expect(ctx.getTaskOutput('build', 'version')).toBe('2.0.0');
    });
  });

  describe('setVariable / getVariable', () => {
    test('should set and get pipeline-level variables', () => {
      ctx.setVariable('pipeline_name', 'my-pipeline');
      expect(ctx.getVariable('pipeline_name')).toBe('my-pipeline');
    });

    test('should return undefined for non-existent variable', () => {
      expect(ctx.getVariable('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllTaskOutputs', () => {
    test('should return all outputs for a given task', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      ctx.setTaskOutput('build', 'image', 'myapp:latest');

      const outputs = ctx.getAllTaskOutputs('build');
      expect(outputs).toEqual({ version: '1.0.0', image: 'myapp:latest' });
    });

    test('should return empty object for task with no outputs', () => {
      expect(ctx.getAllTaskOutputs('nonexistent')).toEqual({});
    });
  });

  describe('resolve - string templating', () => {
    test('should resolve single variable reference', () => {
      ctx.setTaskOutput('build', 'version', '1.2.3');
      const result = ctx.resolve('${tasks.build.outputs.version}');
      expect(result).toBe('1.2.3');
    });

    test('should resolve variable reference within a string', () => {
      ctx.setTaskOutput('build', 'version', '1.2.3');
      const result = ctx.resolve('Image: myapp:${tasks.build.outputs.version}');
      expect(result).toBe('Image: myapp:1.2.3');
    });

    test('should resolve multiple variable references in one string', () => {
      ctx.setTaskOutput('build', 'version', '1.2.3');
      ctx.setTaskOutput('build', 'commit', 'abc123');
      const result = ctx.resolve(
        'v${tasks.build.outputs.version}-${tasks.build.outputs.commit}'
      );
      expect(result).toBe('v1.2.3-abc123');
    });

    test('should leave unresolved references as empty string', () => {
      const result = ctx.resolve('prefix-${tasks.build.outputs.missing}-suffix');
      expect(result).toBe('prefix--suffix');
    });

    test('should handle strings with no variable references', () => {
      const result = ctx.resolve('plain text');
      expect(result).toBe('plain text');
    });

    test('should handle empty string', () => {
      expect(ctx.resolve('')).toBe('');
    });

    test('should resolve pipeline-level variables', () => {
      ctx.setVariable('pipeline_name', 'deploy-prod');
      const result = ctx.resolve('Pipeline: ${pipeline_name}');
      expect(result).toBe('Pipeline: deploy-prod');
    });

    test('should resolve mixed task outputs and pipeline variables', () => {
      ctx.setVariable('env', 'production');
      ctx.setTaskOutput('deploy', 'url', 'https://prod.example.com');
      const result = ctx.resolve(
        'Deploying to ${env} at ${tasks.deploy.outputs.url}'
      );
      expect(result).toBe('Deploying to production at https://prod.example.com');
    });
  });

  describe('resolveObject - deep resolution on objects', () => {
    test('should resolve variables in object values', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      const input = {
        image: 'myapp:${tasks.build.outputs.version}',
        tag: 'latest',
      };
      const result = ctx.resolveObject(input);
      expect(result).toEqual({ image: 'myapp:1.0.0', tag: 'latest' });
    });

    test('should resolve variables in nested objects', () => {
      ctx.setTaskOutput('build', 'version', '2.0.0');
      const input = {
        deploy: {
          image: 'app:${tasks.build.outputs.version}',
          config: {
            name: 'myapp-${tasks.build.outputs.version}',
          },
        },
      };
      const result = ctx.resolveObject(input);
      expect(result).toEqual({
        deploy: {
          image: 'app:2.0.0',
          config: { name: 'myapp-2.0.0' },
        },
      });
    });

    test('should resolve variables in arrays', () => {
      ctx.setTaskOutput('build', 'version', '3.0.0');
      const input = {
        args: ['--version', '${tasks.build.outputs.version}', '--verbose'],
      };
      const result = ctx.resolveObject(input);
      expect(result).toEqual({
        args: ['--version', '3.0.0', '--verbose'],
      });
    });
  });

  describe('toExpressionContext - integration with ExpressionEvaluator', () => {
    test('should produce an object compatible with ExpressionContext', () => {
      ctx.setVariable('branch', 'refs/heads/main');
      ctx.setTaskOutput('build', 'version', '1.0.0');

      const exprCtx = ctx.toExpressionContext();
      expect(exprCtx.branch).toBe('refs/heads/main');
      expect(exprCtx.tasks).toBeDefined();
      expect((exprCtx.tasks as any).build.outputs.version).toBe('1.0.0');
    });
  });

  describe('getRunId', () => {
    test('should return the run ID', () => {
      expect(ctx.getRunId()).toBe('run-001');
    });
  });

  describe('clearTaskOutputs', () => {
    test('should clear all outputs for a task', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      ctx.setTaskOutput('build', 'image', 'myapp:latest');
      ctx.clearTaskOutputs('build');
      expect(ctx.getTaskOutput('build', 'version')).toBeUndefined();
      expect(ctx.getTaskOutput('build', 'image')).toBeUndefined();
    });

    test('should not affect other tasks outputs', () => {
      ctx.setTaskOutput('build', 'version', '1.0.0');
      ctx.setTaskOutput('test', 'coverage', '85%');
      ctx.clearTaskOutputs('build');
      expect(ctx.getTaskOutput('test', 'coverage')).toBe('85%');
    });
  });
});
