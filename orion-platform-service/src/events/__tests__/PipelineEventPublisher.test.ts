/**
 * PipelineEventPublisher 单元测试
 */

import { PipelineEventPublisher } from '../PipelineEventPublisher';
import { createPipelineRun, PipelineRun, PipelineRunStatus, TriggerType } from '../../models/PipelineRun';
import { createStage, Stage, StageStatus } from '../../models/Stage';
import { createTask, Task, TaskStatus } from '../../models/Task';

// 模拟 EventBus
class MockEventBus {
  public publishedEvents: any[] = [];

  async publish(subject: string, data: any, options?: any): Promise<string> {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    // EventBusAdapter 传递 event.data 和包含 tenantId 的 options
    // 模拟创建完整的 CloudEvent 结构，与 EventBusAdapter.createCloudEvent 一致
    const event = {
      specversion: '1.0',
      id: eventId,
      type: subject,
      source: options?.source || 'pipeline-service',
      time: new Date().toISOString(),
      data: data,
      tenantid: options?.tenantId,
      userid: options?.publishedBy,
      traceid: options?.traceId ?? eventId, // 从 options 获取或使用默认值
    };
    this.publishedEvents.push({ subject, data: event, options });
    return eventId;
  }

  isHealthy(): boolean {
    return true;
  }

  isJetStreamAvailable(): boolean {
    return true;
  }

  getConnectionStatus(): { state: string } {
    return { state: 'connected' };
  }
}

describe('PipelineEventPublisher', () => {
  let publisher: PipelineEventPublisher;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    publisher = new PipelineEventPublisher({
      eventBus: mockEventBus,
      source: 'pipeline-service',
      defaultTenantId: 'tenant-001',
      defaultUserId: 'user-001',
    });
  });

  afterEach(() => {
    mockEventBus.publishedEvents = [];
  });

  describe('CloudEvents 1.0 合规性', () => {
    it('发布的事件应包含所有必需字段', async () => {
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
        triggerBy: 'user-001',
      });

      await publisher.publishRunCreated(run);

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.specversion).toBe('1.0');
      expect(event.data.id).toBeDefined();
      expect(event.data.type).toBe('pipeline.run.created');
      expect(event.data.source).toBe('pipeline-service');
      expect(event.data.time).toBeDefined();
      expect(event.data.data).toBeDefined();
    });

    it('发布的事件应包含扩展属性', async () => {
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      await publisher.publishRunCreated(run, {
        tenantId: 'tenant-001',
        userId: 'user-001',
        traceId: 'trace-abc',
      });

      const event = mockEventBus.publishedEvents[0];
      // CloudEvents 扩展属性使用小写
      expect(event.data.tenantid).toBe('tenant-001');
      expect(event.data.userid).toBe('user-001');
      expect(event.data.traceid).toBe('trace-abc');
    });

    it('应使用默认的租户和用户 ID', async () => {
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      await publisher.publishRunCreated(run);

      const event = mockEventBus.publishedEvents[0];
      // 使用默认值
      expect(event.data.tenantid).toBe('tenant-001');
      expect(event.data.userid).toBe('user-001');
      expect(event.data.traceid).toBeDefined();
    });
  });

  describe('Pipeline Run 事件', () => {
    it('发布 pipeline.run.created 事件', async () => {
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.API,
        triggerBy: 'user-001',
        context: { git: { ref: 'refs/heads/main', sha: 'abc123' } },
      });

      await publisher.publishRunCreated(run);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.run.created');
      expect(event.data.data.runId).toBe(run.id);
      expect(event.data.data.pipelineId).toBe('pipeline-001');
      expect(event.data.data.status).toBe('pending');
      expect(event.data.data.triggerType).toBe('api');
      expect(event.data.data.triggeredBy).toBe('user-001');
      expect(event.data.data.gitRef).toBe('refs/heads/main');
      expect(event.data.data.gitSha).toBe('abc123');
    });

    it('发布 pipeline.run.started 事件', async () => {
      const run: PipelineRun = {
        ...createPipelineRun({
          pipelineId: 'pipeline-001',
          pipelineVersion: '1.0.0',
          triggerType: TriggerType.MANUAL,
        }),
        status: PipelineRunStatus.RUNNING,
        startedAt: new Date(),
      };

      await publisher.publishRunStarted(run);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.run.started');
      expect(event.data.data.status).toBe('running');
    });

    it('发布 pipeline.run.completed 事件', async () => {
      const run: PipelineRun = {
        ...createPipelineRun({
          pipelineId: 'pipeline-001',
          pipelineVersion: '1.0.0',
          triggerType: TriggerType.MANUAL,
        }),
        status: PipelineRunStatus.SUCCESS,
        startedAt: new Date(Date.now() - 10000),
        completedAt: new Date(),
        durationMs: 10000,
      };

      await publisher.publishRunCompleted(run);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.run.completed');
      expect(event.data.data.status).toBe('success');
      expect(event.data.data.durationMs).toBe(10000);
    });

    it('发布 pipeline.run.failed 事件', async () => {
      const run: PipelineRun = {
        ...createPipelineRun({
          pipelineId: 'pipeline-001',
          pipelineVersion: '1.0.0',
          triggerType: TriggerType.MANUAL,
        }),
        status: PipelineRunStatus.FAILED,
      };

      await publisher.publishRunFailed(run, 'Task execution failed');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.run.failed');
      expect(event.data.data.status).toBe('failed');
      expect(event.data.data.error).toBe('Task execution failed');
    });

    it('发布 pipeline.run.cancelled 事件', async () => {
      const run: PipelineRun = {
        ...createPipelineRun({
          pipelineId: 'pipeline-001',
          pipelineVersion: '1.0.0',
          triggerType: TriggerType.MANUAL,
        }),
        status: PipelineRunStatus.CANCELLED,
      };

      await publisher.publishRunCancelled(run);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.run.cancelled');
      expect(event.data.data.status).toBe('cancelled');
    });
  });

  describe('Stage 事件', () => {
    it('发布 pipeline.stage.started 事件', async () => {
      const stage: Stage = {
        ...createStage({
          runId: 'run-001',
          name: 'build',
          sequence: 1,
        }),
        status: StageStatus.RUNNING,
        startedAt: new Date(),
      };

      await publisher.publishStageStarted('run-001', stage, 'pipeline-001');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.stage.started');
      expect(event.data.data.runId).toBe('run-001');
      expect(event.data.data.stageId).toBe(stage.id);
      expect(event.data.data.stageName).toBe('build');
      expect(event.data.data.status).toBe('running');
    });

    it('发布 pipeline.stage.completed 事件', async () => {
      const stage: Stage = {
        ...createStage({
          runId: 'run-001',
          name: 'build',
          sequence: 1,
        }),
        status: StageStatus.SUCCESS,
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date(),
        durationMs: 5000,
      };

      await publisher.publishStageCompleted('run-001', stage, 'pipeline-001');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.stage.completed');
      expect(event.data.data.stageName).toBe('build');
      expect(event.data.data.durationMs).toBe(5000);
    });

    it('发布 pipeline.stage.failed 事件', async () => {
      const stage: Stage = {
        ...createStage({
          runId: 'run-001',
          name: 'test',
          sequence: 2,
        }),
        status: StageStatus.FAILED,
      };

      await publisher.publishStageFailed('run-001', stage, 'Test failed', 'pipeline-001');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.stage.failed');
      expect(event.data.data.stageName).toBe('test');
      expect(event.data.data.error).toBe('Test failed');
    });

    it('发布 pipeline.stage.skipped 事件', async () => {
      const stage: Stage = {
        ...createStage({
          runId: 'run-001',
          name: 'deploy',
          sequence: 3,
        }),
        status: StageStatus.SKIPPED,
      };

      await publisher.publishStageSkipped('run-001', stage, 'pipeline-001');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.stage.skipped');
      expect(event.data.data.stageName).toBe('deploy');
      expect(event.data.data.status).toBe('skipped');
    });
  });

  describe('Task 事件', () => {
    it('发布 pipeline.task.started 事件', async () => {
      const task: Task = {
        ...createTask({
          stageId: 'stage-001',
          name: 'compile',
          type: 'build',
          sequence: 1,
        }),
        status: TaskStatus.RUNNING,
        startedAt: new Date(),
      };

      await publisher.publishTaskStarted('run-001', 'stage-001', task);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.task.started');
      expect(event.data.data.runId).toBe('run-001');
      expect(event.data.data.taskId).toBe(task.id);
      expect(event.data.data.taskName).toBe('compile');
      expect(event.data.data.status).toBe('running');
    });

    it('发布 pipeline.task.completed 事件', async () => {
      const task: Task = {
        ...createTask({
          stageId: 'stage-001',
          name: 'compile',
          type: 'build',
          sequence: 1,
        }),
        status: TaskStatus.SUCCESS,
        startedAt: new Date(Date.now() - 3000),
        completedAt: new Date(),
        durationMs: 3000,
      };

      await publisher.publishTaskCompleted('run-001', 'stage-001', task);

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.task.completed');
      expect(event.data.data.taskName).toBe('compile');
      expect(event.data.data.durationMs).toBe(3000);
    });

    it('发布 pipeline.task.failed 事件', async () => {
      const task: Task = {
        ...createTask({
          stageId: 'stage-001',
          name: 'test',
          type: 'test',
          sequence: 1,
        }),
        status: TaskStatus.FAILED,
      };

      await publisher.publishTaskFailed('run-001', 'stage-001', task, 'Test failed');

      expect(mockEventBus.publishedEvents).toHaveLength(1);
      const event = mockEventBus.publishedEvents[0];
      expect(event.subject).toBe('pipeline.task.failed');
      expect(event.data.data.taskName).toBe('test');
      expect(event.data.data.error).toBe('Test failed');
    });
  });

  describe('事件数据类型验证', () => {
    it('PipelineRun 事件应包含所有必需字段', async () => {
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.API,
      });

      await publisher.publishRunStarted(run);

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('runId');
      expect(event.data.data).toHaveProperty('pipelineId');
      expect(event.data.data).toHaveProperty('pipelineVersion');
      expect(event.data.data).toHaveProperty('status');
      expect(event.data.data).toHaveProperty('triggerType');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('Stage 事件应包含所有必需字段', async () => {
      const stage = createStage({
        runId: 'run-001',
        name: 'build',
        sequence: 1,
      });

      await publisher.publishStageStarted('run-001', stage);

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('runId');
      expect(event.data.data).toHaveProperty('stageId');
      expect(event.data.data).toHaveProperty('stageName');
      expect(event.data.data).toHaveProperty('sequence');
      expect(event.data.data).toHaveProperty('status');
      expect(event.data.data).toHaveProperty('timestamp');
    });

    it('Task 事件应包含所有必需字段', async () => {
      const task = createTask({
        stageId: 'stage-001',
        name: 'compile',
        type: 'build',
        sequence: 1,
      });

      await publisher.publishTaskStarted('run-001', 'stage-001', task);

      const event = mockEventBus.publishedEvents[0];
      expect(event.data.data).toHaveProperty('runId');
      expect(event.data.data).toHaveProperty('stageId');
      expect(event.data.data).toHaveProperty('taskId');
      expect(event.data.data).toHaveProperty('taskName');
      expect(event.data.data).toHaveProperty('sequence');
      expect(event.data.data).toHaveProperty('status');
      expect(event.data.data).toHaveProperty('timestamp');
    });
  });

  describe('无 EventBus 时的行为', () => {
    it('EventBus 未连接时应优雅降级', async () => {
      const publisherWithoutBus = new PipelineEventPublisher();
      const run = createPipelineRun({
        pipelineId: 'pipeline-001',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      // 不应抛出错误
      await expect(publisherWithoutBus.publishRunCreated(run)).resolves.not.toThrow();
    });
  });
});
