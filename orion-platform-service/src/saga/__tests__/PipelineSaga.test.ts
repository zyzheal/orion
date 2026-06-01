jest.setTimeout(30000);
/**
 * Pipeline Saga 单元测试
 */

import { PipelineSaga, createPipelineSagaDefinition, PipelineSagaInput, PipelineSagaOutput } from '../PipelineSaga';
import { SagaCoordinator } from '../SagaCoordinator';
import { TransactionLog } from '../TransactionLog';
import { IdempotencyChecker } from '../IdempotencyChecker';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import { TriggerType, PipelineRunStatus } from '../../models/PipelineRun';
import { StageStatus } from '../../models/Stage';
import { SagaStatus, SagaStepStatus } from '../types';

// Mock Pipeline YAML
const mockPipelineYaml = `
apiVersion: pipeline.orion.io/v1
kind: Pipeline
metadata:
  name: test-pipeline
spec:
  stages:
    - name: build
      steps:
        - name: compile
          uses: build@v1
          with:
            target: dist
    - name: test
      dependsOn: [build]
      steps:
        - name: unit-test
          uses: test@v1
          with:
            type: unit
    - name: deploy
      dependsOn: [test]
      steps:
        - name: publish
          uses: deploy@v1
          with:
            env: staging
`;

describe.skip('PipelineSaga', () => {
  let pipelineSaga: PipelineSaga;
  let coordinator: SagaCoordinator;
  let pipelineService: PipelineService;
  let eventPublisher: PipelineEventPublisher;

  beforeEach(async () => {
    // 创建 Mock PipelineService
    pipelineService = {
      getById: async (id: string) => ({
        id,
        name: 'test-pipeline',
        version: '1.0.0',
        yamlDefinition: mockPipelineYaml,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as PipelineService;

    // 创建 Mock EventPublisher
    eventPublisher = {
      publishRunCreated: async () => {},
      publishRunStarted: async () => {},
      publishRunCompleted: async () => {},
      publishRunFailed: async () => {},
      publishRunCancelled: async () => {},
      publishStageStarted: async () => {},
      publishStageCompleted: async () => {},
      publishStageFailed: async () => {},
      publishStageSkipped: async () => {},
    } as unknown as PipelineEventPublisher;

    pipelineSaga = new PipelineSaga(pipelineService, eventPublisher);

    const transactionLog = new TransactionLog();
    const idempotencyChecker = new IdempotencyChecker();
    coordinator = new SagaCoordinator({
      transactionLog,
      idempotencyChecker,
    });
  });

  describe('Saga 定义', () => {
    it('should create pipeline saga definition', async () => {
      const definition = createPipelineSagaDefinition(pipelineService, eventPublisher);

      expect(definition.name).toBe('PipelineExecutionSaga');
      expect(definition.steps.length).toBe(5);
    });

    it('should have correct step names', async () => {
      const definition = pipelineSaga.getDefinition();

      const stepNames = definition.steps.map(s => s.name);
      expect(stepNames).toEqual([
        'createRun',
        'reserveResources',
        'executeStages',
        'updateStatus',
        'publishEvents',
      ]);
    });

    it('should have compensate function for each step', async () => {
      const definition = pipelineSaga.getDefinition();

      for (const step of definition.steps) {
        expect(step.compensate).toBeDefined();
      }
    });
  });

  describe('正常执行流程', () => {
    it('should execute pipeline successfully', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
        triggerBy: 'test-user',
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);

      expect(result.success).toBe(true);
      expect(result.status).toBe(SagaStatus.COMPLETED);
      expect(result.output).toBeDefined();
    });

    it('should create PipelineRun with correct status', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      expect(output.run).toBeDefined();
      expect(output.run.pipelineId).toBe('test-pipeline-id');
      expect(output.run.status).toBe(PipelineRunStatus.SUCCESS);
    });

    it('should create all stages', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      expect(output.stages.length).toBe(3);
      expect(output.stages.map(s => s.name)).toEqual(['build', 'test', 'deploy']);
    });

    it('should create all tasks for each stage', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      // build stage: 1 task (compile)
      // test stage: 1 task (unit-test)
      // deploy stage: 1 task (publish)
      expect(output.tasks.length).toBe(3);
    });

    it('should mark all stages as success', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      const allSuccess = output.stages.every(s => s.status === StageStatus.SUCCESS);
      expect(allSuccess).toBe(true);
    });
  });

  describe('补偿流程', () => {
    it('should compensate when createRun fails', async () => {
      // Mock 一个不存在的 Pipeline
      const failingPipelineService = {
        getById: async () => null,
      } as unknown as PipelineService;

      const failingSaga = new PipelineSaga(failingPipelineService, eventPublisher);

      const input: PipelineSagaInput = {
        pipelineId: 'non-existent-pipeline',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(failingSaga.getDefinition(), input);

      expect(result.success).toBe(false);
      expect(result.status).toBe(SagaStatus.COMPENSATED);
      expect(result.error).toContain('not found');
    });

    it('should cleanup resources after failure', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'non-existent-pipeline',
        triggerType: TriggerType.MANUAL,
      };

      // 使用会失败的配置
      const failingPipelineService = {
        getById: async () => null,
      } as unknown as PipelineService;

      const failingSaga = new PipelineSaga(failingPipelineService, eventPublisher);
      await coordinator.execute(failingSaga.getDefinition(), input);

      // 验证清理方法可用
      failingSaga.cleanup('some-run-id');
    });
  });

  describe('数据管理', () => {
    it('should provide run retrieval', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      const retrievedRun = pipelineSaga.getRun(output.run.id);
      expect(retrievedRun).toBeDefined();
      expect(retrievedRun?.id).toBe(output.run.id);
    });

    it('should provide stages retrieval', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      const stages = pipelineSaga.getStages(output.run.id);
      expect(stages.length).toBe(3);
    });

    it('should cleanup data correctly', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      pipelineSaga.cleanup(output.run.id);

      expect(pipelineSaga.getRun(output.run.id)).toBeNull();
      expect(pipelineSaga.getStages(output.run.id)).toEqual([]);
    });
  });

  describe('不同触发类型', () => {
    it('should handle manual trigger', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
        triggerBy: 'user@example.com',
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      expect(output.run.triggerType).toBe(TriggerType.MANUAL);
      expect(output.run.triggerBy).toBe('user@example.com');
    });

    it('should handle API trigger', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.API,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      expect(output.run.triggerType).toBe(TriggerType.API);
    });

    it('should handle event trigger', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.EVENT,
        context: {
          git: { ref: 'refs/heads/main', sha: 'abc123' },
        },
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const output = result.output as PipelineSagaOutput;

      expect(output.run.triggerType).toBe(TriggerType.EVENT);
      expect(output.run.context.git?.ref).toBe('refs/heads/main');
    });
  });

  describe('事务状态跟踪', () => {
    it('should track transaction status through coordinator', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      expect(status?.status).toBe(SagaStatus.COMPLETED);
      expect(status?.stepExecutions.length).toBe(5);
    });

    it('should have all steps completed in successful run', async () => {
      const input: PipelineSagaInput = {
        pipelineId: 'test-pipeline-id',
        triggerType: TriggerType.MANUAL,
      };

      const result = await coordinator.execute(pipelineSaga.getDefinition(), input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      const allCompleted = status?.stepExecutions.every(
        e => e.status === SagaStepStatus.COMPLETED
      );
      expect(allCompleted).toBe(true);
    });
  });
});