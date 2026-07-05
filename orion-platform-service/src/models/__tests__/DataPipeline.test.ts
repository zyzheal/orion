/**
 * DataPipeline 模型测试
 */
import {
  createDataPipeline,
  createPipelineExecution,
  PipelineStatus,
  ExecutionStatus,
  ScheduleType,
} from '../DataPipeline';

describe('DataPipeline', () => {
  describe('createDataPipeline', () => {
    it('should create pipeline with defaults', () => {
      const pipeline = createDataPipeline('t1', {
        name: 'etl-pipeline',
        input_config: { source: 'kafka' },
        processors: [{ type: 'transform', config: {}, order: 1 }],
        output_config: { sink: 'postgres' },
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.tenant_id).toBe('t1');
      expect(pipeline.name).toBe('etl-pipeline');
      expect(pipeline.description).toBe('');
      expect(pipeline.status).toBe(PipelineStatus.DRAFT);
      expect(pipeline.schedule_type).toBe(ScheduleType.MANUAL);
      expect(pipeline.cron_expression).toBeNull();
      expect(pipeline.last_run_id).toBeNull();
      expect(pipeline.created_by).toBe('system');
    });

    it('should accept custom values', () => {
      const pipeline = createDataPipeline('t1', {
        name: 'p1',
        description: 'desc',
        input_config: {},
        processors: [],
        output_config: {},
        created_by: 'admin',
      });

      expect(pipeline.description).toBe('desc');
      expect(pipeline.created_by).toBe('admin');
    });
  });

  describe('createPipelineExecution', () => {
    it('should create execution', () => {
      const exec = createPipelineExecution('t1', 'pipeline-1');

      expect(exec.id).toBeDefined();
      expect(exec.tenant_id).toBe('t1');
      expect(exec.pipeline_id).toBe('pipeline-1');
      expect(exec.status).toBe(ExecutionStatus.PENDING);
      expect(exec.input_count).toBe(0);
      expect(exec.output_count).toBe(0);
      expect(exec.error_message).toBeNull();
      expect(exec.metadata).toEqual({});
      expect(exec.started_at).toBeInstanceOf(Date);
      expect(exec.finished_at).toBeNull();
    });
  });

  describe('enums', () => {
    it('PipelineStatus should have correct values', () => {
      expect(PipelineStatus.DRAFT).toBe('draft');
      expect(PipelineStatus.ACTIVE).toBe('active');
      expect(PipelineStatus.PAUSED).toBe('paused');
      expect(PipelineStatus.DISABLED).toBe('disabled');
    });

    it('ExecutionStatus should have correct values', () => {
      expect(ExecutionStatus.PENDING).toBe('pending');
      expect(ExecutionStatus.RUNNING).toBe('running');
      expect(ExecutionStatus.SUCCESS).toBe('success');
      expect(ExecutionStatus.FAILED).toBe('failed');
      expect(ExecutionStatus.CANCELLED).toBe('cancelled');
    });

    it('ScheduleType should have correct values', () => {
      expect(ScheduleType.MANUAL).toBe('manual');
      expect(ScheduleType.CRON).toBe('cron');
      expect(ScheduleType.EVENT).toBe('event');
    });
  });
});
