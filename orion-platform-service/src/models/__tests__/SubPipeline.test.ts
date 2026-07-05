/**
 * SubPipeline 模型测试
 */
import {
  createSubPipelineInvocation,
  startSubPipeline,
  completeSubPipeline,
  failSubPipeline,
  cancelSubPipeline,
} from '../SubPipeline';

describe('SubPipeline', () => {
  describe('createSubPipelineInvocation', () => {
    it('should create invocation with defaults', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'parent-run-1',
        childPipelineId: 'child-pipeline-1',
        inputParams: { branch: 'main' },
        stageName: 'sub-build',
      });

      expect(inv.id).toBeDefined();
      expect(inv.parentRunId).toBe('parent-run-1');
      expect(inv.childPipelineId).toBe('child-pipeline-1');
      expect(inv.childRunId).toBeNull();
      expect(inv.status).toBe('pending');
      expect(inv.inputParams).toEqual({ branch: 'main' });
      expect(inv.outputResults).toEqual({});
      expect(inv.stageName).toBe('sub-build');
      expect(inv.outputMapping).toEqual({});
      expect(inv.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional outputMapping', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'p1',
        childPipelineId: 'c1',
        inputParams: {},
        stageName: 'sub',
        outputMapping: { version: '${child.version}' },
      });

      expect(inv.outputMapping).toEqual({ version: '${child.version}' });
    });
  });

  describe('startSubPipeline', () => {
    it('should set running status and childRunId', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'p1',
        childPipelineId: 'c1',
        inputParams: {},
        stageName: 'sub',
      });

      const started = startSubPipeline(inv, 'child-run-1');

      expect(started.status).toBe('running');
      expect(started.childRunId).toBe('child-run-1');
    });
  });

  describe('completeSubPipeline', () => {
    it('should set completed status with results', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'p1',
        childPipelineId: 'c1',
        inputParams: {},
        stageName: 'sub',
      });

      const completed = completeSubPipeline(inv, { version: '1.0.0' });

      expect(completed.status).toBe('completed');
      expect(completed.outputResults).toEqual({ version: '1.0.0' });
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('failSubPipeline', () => {
    it('should set failed status with error', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'p1',
        childPipelineId: 'c1',
        inputParams: {},
        stageName: 'sub',
      });

      const failed = failSubPipeline(inv, 'Build failed');

      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Build failed');
      expect(failed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('cancelSubPipeline', () => {
    it('should set cancelled status', () => {
      const inv = createSubPipelineInvocation({
        parentRunId: 'p1',
        childPipelineId: 'c1',
        inputParams: {},
        stageName: 'sub',
      });

      const cancelled = cancelSubPipeline(inv);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeInstanceOf(Date);
    });
  });
});
