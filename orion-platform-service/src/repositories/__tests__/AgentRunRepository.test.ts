/**
 * Tests for AgentRunRepository
 */

import { AgentRunRepository } from '../AgentRunRepository';

describe('AgentRunRepository', () => {
  let repo: AgentRunRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AgentRunRepository(mockDb);
  });

  const mockRunRow = {
    id: 'run-1',
    agent_profile_id: 'agent-1',
    trigger_payload: { action: 'fix_bug' },
    status: 'running',
    current_step: 0,
    total_steps: 1,
    result: null,
    error: null,
    started_at: new Date(),
    completed_at: null,
    timeout_at: new Date(Date.now() + 3600000),
    tenant_id: null,
  };

  test('should create a run', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockRunRow] });
    const result = await repo.createRun('agent-1', { action: 'fix_bug' }, 1, new Date());
    expect(result.id).toBe('run-1');
    expect(result.status).toBe('running');
    expect(result.agent_profile_id).toBe('agent-1');
  });

  test('should find run by ID', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockRunRow] });
    const result = await repo.findRunById('run-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('run-1');
  });

  test('should return null when run not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findRunById('nonexistent');
    expect(result).toBeNull();
  });

  test('should list runs with filters', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockRunRow] });
    const results = await repo.listRuns({ agentProfileId: 'agent-1', statusFilter: 'running' });
    expect(results.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE 1=1'),
      expect.arrayContaining(['agent-1', 'running'])
    );
  });

  test('should complete a run', async () => {
    const completedRow = { ...mockRunRow, status: 'completed', result: JSON.stringify({ success: true }), completed_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [completedRow] });
    const result = await repo.completeRun('run-1', { success: true });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');
  });

  test('should fail a run', async () => {
    const failedRow = { ...mockRunRow, status: 'failed', error: 'step failed', completed_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [failedRow] });
    const result = await repo.failRun('run-1', 'step failed');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
  });

  test('should cancel a run', async () => {
    const cancelledRow = { ...mockRunRow, status: 'cancelled', completed_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [cancelledRow] });
    const result = await repo.cancelRun('run-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('cancelled');
  });

  test('should create a decision', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'dec-1' }] });
    const result = await repo.createDecision('run-1', 'agent-1', 1, 'read_file', { filePath: '/test.ts' }, 'test reasoning');
    expect(result.id).toBe('dec-1');
  });

  test('should update a decision', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.updateDecision('dec-1', { toolResult: { success: true } });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE agent_decisions'),
      expect.any(Array)
    );
  });

  test('should get decisions by run ID', async () => {
    const mockDecision = {
      id: 'dec-1',
      run_id: 'run-1',
      agent_id: 'agent-1',
      step_number: 1,
      action: 'read_file',
      action_input: { filePath: '/test.ts' },
      action_output: null,
      reasoning: 'test',
      tool_result: null,
      error: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockDecision] });
    const results = await repo.getDecisionsByRunId('run-1');
    expect(results.length).toBe(1);
    expect(results[0].action).toBe('read_file');
  });

  test('should create an approval', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'approval-1' }] });
    const result = await repo.createApproval('run-1', 'agent-1', 'create_pr', { title: 'Fix' }, 'needs review');
    expect(result.id).toBe('approval-1');
  });
});
