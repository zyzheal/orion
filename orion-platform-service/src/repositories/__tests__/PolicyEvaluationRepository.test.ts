import { PolicyEvaluationRepository } from '../PolicyEvaluationRepository';

describe('PolicyEvaluationRepository', () => {
  let repo: PolicyEvaluationRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PolicyEvaluationRepository(mockDb);
  });

  test('should create policy evaluation', async () => {
    const mockRow = {
      id: 'eval-1',
      policy_id: 'policy-1',
      run_id: 'run-1',
      input_context: { resource: 'deployment', action: 'create' },
      result: { allow: true, reasons: [] },
      evaluated_at: new Date(),
      evaluation_ms: 150,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      policyId: 'policy-1',
      runId: 'run-1',
      inputContext: { resource: 'deployment', action: 'create' },
      result: { allow: true, reasons: [] },
      evaluationMs: 150,
    });

    expect(result.id).toBe('eval-1');
    expect(result.policyId).toBe('policy-1');
    expect(result.runId).toBe('run-1');
    expect(result.inputContext).toEqual({ resource: 'deployment', action: 'create' });
    expect(result.result).toEqual({ allow: true, reasons: [] });
    expect(result.evaluationMs).toBe(150);
  });

  test('should find evaluations by run ID', async () => {
    const mockRows = [
      { id: 'eval-1', policy_id: 'policy-1', run_id: 'run-1', input_context: {}, result: { allow: true }, evaluated_at: new Date(), evaluation_ms: 100 },
      { id: 'eval-2', policy_id: 'policy-2', run_id: 'run-1', input_context: {}, result: { allow: false }, evaluated_at: new Date(), evaluation_ms: 200 },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.findByRunId('run-1');

    expect(results).toHaveLength(2);
    expect(results[0].runId).toBe('run-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE run_id = $1'),
      ['run-1'],
    );
  });

  test('should find evaluations by policy ID', async () => {
    const mockRows = [
      { id: 'eval-1', policy_id: 'policy-1', run_id: 'run-1', input_context: {}, result: { allow: true }, evaluated_at: new Date(), evaluation_ms: 100 },
      { id: 'eval-2', policy_id: 'policy-1', run_id: 'run-2', input_context: {}, result: { allow: true }, evaluated_at: new Date(), evaluation_ms: 120 },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.findByPolicyId('policy-1', { limit: 10, offset: 0 });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.policyId === 'policy-1')).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE policy_id = $1'),
      ['policy-1', 10, 0],
    );
  });

  test('should handle null policy ID', async () => {
    const mockRow = {
      id: 'eval-1',
      policy_id: null,
      run_id: 'run-1',
      input_context: { resource: 'config' },
      result: { allow: true, reasons: ['no policy required'] },
      evaluated_at: new Date(),
      evaluation_ms: 50,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      policyId: null,
      runId: 'run-1',
      inputContext: { resource: 'config' },
      result: { allow: true, reasons: ['no policy required'] },
      evaluationMs: 50,
    });

    expect(result.policyId).toBeNull();
    expect(result.inputContext).toEqual({ resource: 'config' });
  });
});