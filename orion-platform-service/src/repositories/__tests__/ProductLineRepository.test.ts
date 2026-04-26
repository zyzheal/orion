import { ProductLineRepository, ReleaseTrainRepository, HotfixChannelRepository } from '../ProductLineRepository';

describe('ProductLineRepository', () => {
  let repo: ProductLineRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ProductLineRepository(mockDb);
  });

  test('should create product line', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'pl-1', tenant_id: 'tenant-1', name: 'payment-service', display_name: '支付服务', description: '支付核心',
        git_url: 'https://gitlab.com/payment', git_provider: 'gitlab', git_default_branch: 'main', git_credential_ref: null,
        branch_mode: 'gitflow', protected_branches: [], code_ownership: {}, naming_convention: {}, merge_strategy: {},
        default_environment: 'dev', environment_mappings: [], promotion_config: {}, environments: [],
        default_pipeline_template: null, pipeline_templates: [], team_bindings: [], resource_quotas: {}, notifications: {},
        labels: {}, annotations: {}, phase: 'Pending', conditions: [], statistics: {}, git_status: {}, environment_statuses: [],
        created_at: new Date(), updated_at: new Date()
      }],
    });
    const result = await repo.create({
      tenantId: 'tenant-1', name: 'payment-service', displayName: '支付服务', gitUrl: 'https://gitlab.com/payment',
      branchMode: 'gitflow', environmentMappings: [], createdAt: new Date(), updatedAt: new Date()
    });
    expect(result.name).toBe('payment-service');
    expect(result.displayName).toBe('支付服务');
    expect(result.branchMode).toBe('gitflow');
  });

  test('should find by name', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'pl-1', tenant_id: 't1', name: 'payment-service', display_name: '支付', description: null,
        git_url: 'https://gitlab.com/pay', git_provider: 'github', git_default_branch: 'main', git_credential_ref: null,
        branch_mode: 'github-flow', protected_branches: [], code_ownership: {}, naming_convention: {}, merge_strategy: {},
        default_environment: 'dev', environment_mappings: [], promotion_config: {}, environments: [],
        default_pipeline_template: null, pipeline_templates: [], team_bindings: [], resource_quotas: {}, notifications: {},
        labels: {}, annotations: {}, phase: 'Active', conditions: [], statistics: {}, git_status: {}, environment_statuses: [],
        created_at: new Date(), updated_at: new Date()
      }],
    });
    const result = await repo.findByName('payment-service');
    expect(result?.name).toBe('payment-service');
    expect(result?.phase).toBe('Active');
  });

  test('should find by tenant', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'pl-1', tenant_id: 't1', name: 'payment', display_name: 'P1', git_url: 'url1', branch_mode: 'gitflow', phase: 'Active', created_at: new Date(), updated_at: new Date() },
        { id: 'pl-2', tenant_id: 't1', name: 'order', display_name: 'P2', git_url: 'url2', branch_mode: 'github-flow', phase: 'Active', created_at: new Date(), updated_at: new Date() },
      ],
    });
    const result = await repo.findByTenant('t1');
    expect(result.length).toBe(2);
  });

  test('should find by phase', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'pl-1', tenant_id: 't1', name: 'payment', display_name: 'P1', git_url: 'url', branch_mode: 'gitflow', phase: 'Pending', created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findByPhase('Pending');
    expect(result.length).toBe(1);
    expect(result[0].phase).toBe('Pending');
  });

  test('should update phase', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'pl-1', tenant_id: 't1', name: 'payment', display_name: 'P1', git_url: 'url', branch_mode: 'gitflow', phase: 'Active', conditions: [{ type: 'Ready', status: 'True' }], created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.updatePhase('pl-1', 'Active', [{ type: 'Ready', status: 'True' }]);
    expect(result?.phase).toBe('Active');
    expect(result?.conditions.length).toBe(1);
  });
});

describe('ReleaseTrainRepository', () => {
  let repo: ReleaseTrainRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ReleaseTrainRepository(mockDb);
  });

  test('should create release train', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'rt-1', product_line_id: 'pl-1', name: 'weekly-release', schedule: '0 10 * * 1',
        target_branch: 'production', source_branch: 'main', auto_promote: false, approval_required: true,
        approvers: ['user-1', 'user-2'], pre_checks: [], post_actions: [], last_run: null, next_run: null,
        state: 'Idle', last_release: null, created_at: new Date(), updated_at: new Date()
      }],
    });
    const result = await repo.create({
      productLineId: 'pl-1', name: 'weekly-release', schedule: '0 10 * * 1',
      createdAt: new Date(), updatedAt: new Date()
    });
    expect(result.name).toBe('weekly-release');
    expect(result.schedule).toBe('0 10 * * 1');
    expect(result.state).toBe('Idle');
  });

  test('should find by product line', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'rt-1', product_line_id: 'pl-1', name: 'weekly', schedule: 'cron', target_branch: 'prod', source_branch: 'main', auto_promote: false, approval_required: true, approvers: [], pre_checks: [], post_actions: [], last_run: null, next_run: null, state: 'Idle', last_release: null, created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findByProductLine('pl-1');
    expect(result.length).toBe(1);
  });

  test('should update state', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'rt-1', product_line_id: 'pl-1', name: 'weekly', schedule: 'cron', target_branch: 'prod', source_branch: 'main', auto_promote: false, approval_required: true, approvers: [], pre_checks: [], post_actions: [], last_run: new Date(), next_run: new Date(), state: 'Completed', last_release: 'v1.0', created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.updateState('rt-1', 'Completed', new Date(), new Date());
    expect(result?.state).toBe('Completed');
    expect(result?.lastRun).toBeDefined();
  });
});

describe('HotfixChannelRepository', () => {
  let repo: HotfixChannelRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new HotfixChannelRepository(mockDb);
  });

  test('should create hotfix channel', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'hf-1', product_line_id: 'pl-1', name: 'critical-hotfix', enabled: true,
        branch_pattern: '^hotfix/.*$', skip_stages: ['test'], required_stages: ['scan', 'deploy'],
        approval_required: true, approval_timeout: 30, auto_merge: false, notify_on_call: true, max_duration: 60,
        active_hotfixes: 0, last_hotfix: null, created_at: new Date(), updated_at: new Date()
      }],
    });
    const result = await repo.create({
      productLineId: 'pl-1', name: 'critical-hotfix', createdAt: new Date(), updatedAt: new Date()
    });
    expect(result.name).toBe('critical-hotfix');
    expect(result.enabled).toBe(true);
  });

  test('should find enabled by product line', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'hf-1', product_line_id: 'pl-1', name: 'hotfix', enabled: true, branch_pattern: 'hotfix/*', skip_stages: [], required_stages: [], approval_required: true, approval_timeout: 30, auto_merge: false, notify_on_call: true, max_duration: 60, active_hotfixes: 1, last_hotfix: 'hf-001', created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findEnabled('pl-1');
    expect(result?.enabled).toBe(true);
    expect(result?.activeHotfixes).toBe(1);
  });

  test('should update active hotfixes', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'hf-1', product_line_id: 'pl-1', name: 'hotfix', enabled: true, branch_pattern: 'hotfix/*', skip_stages: [], required_stages: [], approval_required: true, approval_timeout: 30, auto_merge: false, notify_on_call: true, max_duration: 60, active_hotfixes: 2, last_hotfix: 'hf-002', created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.updateActiveHotfixes('hf-1', 2, 'hf-002');
    expect(result?.activeHotfixes).toBe(2);
    expect(result?.lastHotfix).toBe('hf-002');
  });
});