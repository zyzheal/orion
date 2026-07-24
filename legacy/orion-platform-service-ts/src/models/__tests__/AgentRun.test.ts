/**
 * AgentRun 模型测试
 */
import {
  createAgentRun,
  addDecision,
  completeDecision,
  failDecision,
  completeRun,
  failRun,
  cancelRun,
  createAgentApproval,
  AgentRun,
  AgentDecision,
} from '../AgentRun';

describe('AgentRun', () => {
  describe('createAgentRun', () => {
    it('should create run with defaults', () => {
      const run = createAgentRun({
        agentProfileId: 'profile-1',
        triggerPayload: { event: 'push' },
      });

      expect(run.id).toBeDefined();
      expect(run.agentProfileId).toBe('profile-1');
      expect(run.agentProfileName).toBe('');
      expect(run.status).toBe('running');
      expect(run.currentStep).toBe(0);
      expect(run.totalSteps).toBe(1);
      expect(run.decisions).toEqual([]);
      expect(run.startedAt).toBeInstanceOf(Date);
    });

    it('should set timeout to 3600s by default', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });
      const diff = run.timeoutAt.getTime() - run.startedAt.getTime();
      expect(diff).toBe(3600 * 1000);
    });

    it('should accept custom timeout', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
        timeoutSec: 600,
      });
      const diff = run.timeoutAt.getTime() - run.startedAt.getTime();
      expect(diff).toBe(600 * 1000);
    });

    it('should accept custom totalSteps', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
        totalSteps: 10,
      });
      expect(run.totalSteps).toBe(10);
    });

    it('should accept tenantId', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
        tenantId: 'tenant-1',
      });
      expect(run.tenantId).toBe('tenant-1');
    });
  });

  describe('addDecision', () => {
    it('should add a decision to the run', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });

      const decision = addDecision(run, 'agent-1', 1, 'read_file', { path: '/tmp' }, 'need to read');

      expect(decision.id).toBeDefined();
      expect(decision.runId).toBe(run.id);
      expect(decision.agentId).toBe('agent-1');
      expect(decision.stepNumber).toBe(1);
      expect(decision.action).toBe('read_file');
      expect(decision.reasoning).toBe('need to read');
      expect(run.decisions).toHaveLength(1);
      expect(run.currentStep).toBe(1);
    });
  });

  describe('completeDecision', () => {
    it('should set toolResult and actionOutput', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });
      const decision = addDecision(run, 'a1', 1, 'read_file', {}, 'reason');

      completeDecision(decision, { content: 'file content' }, { parsed: true });

      expect(decision.toolResult).toEqual({ content: 'file content' });
      expect(decision.actionOutput).toEqual({ parsed: true });
    });

    it('should work without actionOutput', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });
      const decision = addDecision(run, 'a1', 1, 'read_file', {}, 'reason');

      completeDecision(decision, { data: 123 });

      expect(decision.toolResult).toEqual({ data: 123 });
      expect(decision.actionOutput).toBeUndefined();
    });
  });

  describe('failDecision', () => {
    it('should set error on decision', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });
      const decision = addDecision(run, 'a1', 1, 'run_command', {}, 'reason');

      failDecision(decision, 'command failed');

      expect(decision.error).toBe('command failed');
    });
  });

  describe('completeRun', () => {
    it('should mark run as completed', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });

      completeRun(run, { output: 'done' });

      expect(run.status).toBe('completed');
      expect(run.result).toEqual({ output: 'done' });
      expect(run.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('failRun', () => {
    it('should mark run as failed', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });

      failRun(run, 'timeout exceeded');

      expect(run.status).toBe('failed');
      expect(run.error).toBe('timeout exceeded');
      expect(run.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('cancelRun', () => {
    it('should mark run as cancelled', () => {
      const run = createAgentRun({
        agentProfileId: 'p1',
        triggerPayload: {},
      });

      cancelRun(run);

      expect(run.status).toBe('cancelled');
      expect(run.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('createAgentApproval', () => {
    it('should create pending approval', () => {
      const approval = createAgentApproval(
        'run-1',
        'agent-1',
        'request_approval',
        { action: 'deploy' },
        'needs approval'
      );

      expect(approval.id).toBeDefined();
      expect(approval.runId).toBe('run-1');
      expect(approval.agentId).toBe('agent-1');
      expect(approval.action).toBe('request_approval');
      expect(approval.status).toBe('pending');
      expect(approval.reason).toBe('needs approval');
      expect(approval.createdAt).toBeInstanceOf(Date);
    });
  });
});
