/**
 * StageParameterResolver Tests
 *
 * Tests for stage-to-stage parameter passing:
 * - extractStageOutputs: collect outputs from successful task results
 * - resolveStageParameters: resolve ${tasks.<name>.outputs.<key>} references
 * - aggregateParameters: merge multiple parameter sources
 */

import { StageParameterResolver } from '../StageParameterResolver';
import { VariableContext } from '../VariableContext';
import { Stage, StageStatus } from '../../models/Stage';
import { Task, TaskStatus } from '../../models/Task';

describe('StageParameterResolver', () => {
  let resolver: StageParameterResolver;
  let variableCtx: VariableContext;

  beforeEach(() => {
    variableCtx = new VariableContext('run-001');
    resolver = new StageParameterResolver(variableCtx);
  });

  describe('extractStageOutputs', () => {
    it('应该从成功Task的result中提取outputs', () => {
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.SUCCESS,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { version: '1.2.3', image: 'myapp:1.2.3' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks);
      expect(outputs).toEqual({ version: '1.2.3', image: 'myapp:1.2.3' });
    });

    it('应该支持outputs声明中的引用解析', () => {
      variableCtx.setTaskOutput('build', 'version', '1.2.3');
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.SUCCESS,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { version: '1.2.3' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks, {
        version: '${tasks.build.outputs.version}',
      });
      expect(outputs).toEqual({ version: '1.2.3' });
    });

    it('失败Task不应贡献outputs', () => {
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.FAILED,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { error: 'failed' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks);
      expect(outputs).toEqual({});
    });
  });

  describe('resolveStageParameters', () => {
    it('应该解析下游Stage的参数引用', () => {
      variableCtx.setTaskOutput('build', 'image', 'myapp:1.2.3');
      variableCtx.setTaskOutput('build', 'version', '1.2.3');

      const upstreamOutputs = {
        image: '${tasks.build.outputs.image}',
        version: '${tasks.build.outputs.version}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ image: 'myapp:1.2.3', version: '1.2.3' });
    });

    it('应该保留无法解析的引用为原始字符串', () => {
      const upstreamOutputs = {
        image: '${tasks.nonexistent.outputs.image}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ image: '${tasks.nonexistent.outputs.image}' });
    });

    it('应该支持默认值语法', () => {
      const upstreamOutputs = {
        env: '${tasks.build.outputs.env || "production"}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ env: 'production' });
    });
  });

  describe('aggregateParameters', () => {
    it('应该合并多个源参数', () => {
      const sourceA = { image: 'myapp:1.2.3' };
      const sourceB = { replicas: '3', env: 'staging' };

      const aggregated = resolver.aggregateParameters(sourceA, sourceB);
      expect(aggregated).toEqual({ image: 'myapp:1.2.3', replicas: '3', env: 'staging' });
    });

    it('后者应该覆盖前者（相同key）', () => {
      const sourceA = { env: 'staging' };
      const sourceB = { env: 'production' };

      const aggregated = resolver.aggregateParameters(sourceA, sourceB);
      expect(aggregated).toEqual({ env: 'production' });
    });
  });
});
