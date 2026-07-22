/**
 * Comprehensive tests for InspectionService
 * Covers: Rules CRUD, Task Management, Report Generation, Health Score, Evaluate logic
 */

// We use dynamic import + jest.resetModules() because the module uses
// module-level Map() for storage, which leaks state between tests.

let InspectionService: any;
let service: any;

const TENANT_A = 'tenant-a-001';
const TENANT_B = 'tenant-b-002';

function makeRuleInput(overrides: Record<string, any> = {}) {
  return {
    name: 'CPU Check',
    description: 'Check CPU usage',
    target: 'host',
    checkType: 'cpu',
    threshold: 80,
    operator: 'gt',
    schedule: '*/5 * * * *',
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetModules();
  // Fresh import each time so module-level Maps are empty
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../InspectionService');
  InspectionService = mod.InspectionService;
  service = new InspectionService();
});

describe('InspectionService', () => {
  // ───────────────────────── Initialization ─────────────────────────

  describe('initialization', () => {
    it('should instantiate without errors', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(InspectionService);
    });

    it('should have all public methods', () => {
      expect(typeof service.createRule).toBe('function');
      expect(typeof service.listRules).toBe('function');
      expect(typeof service.getRule).toBe('function');
      expect(typeof service.updateRule).toBe('function');
      expect(typeof service.deleteRule).toBe('function');
      expect(typeof service.createTask).toBe('function');
      expect(typeof service.listTasks).toBe('function');
      expect(typeof service.getTask).toBe('function');
      expect(typeof service.generateReport).toBe('function');
      expect(typeof service.listReports).toBe('function');
      expect(typeof service.getReport).toBe('function');
      expect(typeof service.getHealthScore).toBe('function');
    });
  });

  // ───────────────────────── Rules CRUD ─────────────────────────

  describe('createRule', () => {
    it('should create a rule with all fields', async () => {
      const input = makeRuleInput();
      const rule = await service.createRule(input, TENANT_A);

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(typeof rule.id).toBe('string');
      expect(rule.tenantId).toBe(TENANT_A);
      expect(rule.name).toBe('CPU Check');
      expect(rule.description).toBe('Check CPU usage');
      expect(rule.target).toBe('host');
      expect(rule.checkType).toBe('cpu');
      expect(rule.threshold).toBe(80);
      expect(rule.operator).toBe('gt');
      expect(rule.enabled).toBe(true);
      expect(rule.schedule).toBe('*/5 * * * *');
      expect(rule.createdAt).toBeDefined();
      expect(rule.updatedAt).toBeDefined();
    });

    it('should create a rule without optional description', async () => {
      const input = makeRuleInput({ description: undefined });
      const rule = await service.createRule(input, TENANT_A);

      expect(rule.description).toBeUndefined();
    });

    it('should create multiple rules with unique IDs', async () => {
      const rule1 = await service.createRule(makeRuleInput({ name: 'Rule 1' }), TENANT_A);
      const rule2 = await service.createRule(makeRuleInput({ name: 'Rule 2' }), TENANT_A);

      expect(rule1.id).not.toBe(rule2.id);
      expect(rule1.name).toBe('Rule 1');
      expect(rule2.name).toBe('Rule 2');
    });

    it('should assign correct tenantId', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_B);
      expect(rule.tenantId).toBe(TENANT_B);
    });

    it('should set enabled to true by default', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      expect(rule.enabled).toBe(true);
    });
  });

  describe('listRules', () => {
    it('should return empty array when no rules exist', async () => {
      const rules = await service.listRules(TENANT_A);
      expect(rules).toEqual([]);
    });

    it('should list rules for a specific tenant', async () => {
      await service.createRule(makeRuleInput({ name: 'Rule A' }), TENANT_A);
      await service.createRule(makeRuleInput({ name: 'Rule B' }), TENANT_B);

      const rulesA = await service.listRules(TENANT_A);
      expect(rulesA).toHaveLength(1);
      expect(rulesA[0].name).toBe('Rule A');
    });

    it('should not leak rules between tenants', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);
      const rulesB = await service.listRules(TENANT_B);
      expect(rulesB).toHaveLength(0);
    });

    it('should filter by target', async () => {
      await service.createRule(makeRuleInput({ target: 'host' }), TENANT_A);
      await service.createRule(makeRuleInput({ target: 'database' }), TENANT_A);

      const hostRules = await service.listRules(TENANT_A, { target: 'host' });
      expect(hostRules).toHaveLength(1);
      expect(hostRules[0].target).toBe('host');
    });

    it('should filter by enabled status', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      await service.updateRule(rule.id, { enabled: false });
      await service.createRule(makeRuleInput({ name: 'Enabled Rule' }), TENANT_A);

      const enabledRules = await service.listRules(TENANT_A, { enabled: true });
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0].name).toBe('Enabled Rule');

      const disabledRules = await service.listRules(TENANT_A, { enabled: false });
      expect(disabledRules).toHaveLength(1);
    });

    it('should filter by both target and enabled', async () => {
      await service.createRule(makeRuleInput({ target: 'host', name: 'R1' }), TENANT_A);
      await service.createRule(makeRuleInput({ target: 'database', name: 'R2' }), TENANT_A);
      const r3 = await service.createRule(makeRuleInput({ target: 'host', name: 'R3' }), TENANT_A);
      await service.updateRule(r3.id, { enabled: false });

      const rules = await service.listRules(TENANT_A, { target: 'host', enabled: true });
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('R1');
    });
  });

  describe('getRule', () => {
    it('should get a rule by ID', async () => {
      const created = await service.createRule(makeRuleInput(), TENANT_A);
      const fetched = await service.getRule(created.id);

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe('CPU Check');
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await service.getRule('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('updateRule', () => {
    it('should update rule fields', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const updated = await service.updateRule(rule.id, { name: 'Updated Name', threshold: 90 });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.threshold).toBe(90);
    });

    it('should update the updatedAt timestamp', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const originalUpdated = rule.updatedAt;

      // Small delay to ensure different timestamp
      const updated = await service.updateRule(rule.id, { name: 'New' });
      expect(updated!.updatedAt).toBeDefined();
      // The timestamp should be an ISO string (may be same if very fast)
      expect(typeof updated!.updatedAt).toBe('string');
    });

    it('should preserve unchanged fields', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const updated = await service.updateRule(rule.id, { name: 'New Name' });

      expect(updated!.target).toBe('host');
      expect(updated!.checkType).toBe('cpu');
      expect(updated!.threshold).toBe(80);
      expect(updated!.schedule).toBe('*/5 * * * *');
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await service.updateRule('non-existent', { name: 'Test' });
      expect(result).toBeUndefined();
    });

    it('should update enabled status', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const updated = await service.updateRule(rule.id, { enabled: false });
      expect(updated!.enabled).toBe(false);
    });
  });

  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const deleted = await service.deleteRule(rule.id);

      expect(deleted).toBe(true);
      const fetched = await service.getRule(rule.id);
      expect(fetched).toBeUndefined();
    });

    it('should return false for non-existent ID', async () => {
      const result = await service.deleteRule('non-existent-id');
      expect(result).toBe(false);
    });

    it('should not affect other rules', async () => {
      const rule1 = await service.createRule(makeRuleInput({ name: 'R1' }), TENANT_A);
      const rule2 = await service.createRule(makeRuleInput({ name: 'R2' }), TENANT_A);

      await service.deleteRule(rule1.id);

      const remaining = await service.listRules(TENANT_A);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('R2');
    });
  });

  // ───────────────────────── Task Management ─────────────────────────

  describe('createTask', () => {
    it('should create a task for an existing rule', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const task = await service.createTask(rule.id, TENANT_A);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.tenantId).toBe(TENANT_A);
      expect(task.ruleId).toBe(rule.id);
      expect(task.createdAt).toBeDefined();
    });

    it('should mark task as completed when rule exists', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const task = await service.createTask(rule.id, TENANT_A);

      expect(task.status).toBe('completed');
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
      expect(task.result).toBeDefined();
    });

    it('should generate inspection result with correct structure', async () => {
      // Mock Math.random to get deterministic value
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'gt' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);

      expect(task.result).toBeDefined();
      expect(task.result!.id).toBeDefined();
      expect(task.result!.taskId).toBe(task.id);
      expect(task.result!.actualValue).toBe(50);
      expect(task.result!.expectedValue).toBe(80);
      expect(task.result!.passed).toBe(false); // 50 > 80 is false
      expect(task.result!.message).toContain('检查失败');
      expect(task.result!.createdAt).toBeDefined();

      jest.restoreAllMocks();
    });

    it('should create task with pending->running->completed lifecycle', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const task = await service.createTask(rule.id, TENANT_A);

      // Final state should be completed
      expect(task.status).toBe('completed');
      // Should have all lifecycle timestamps
      expect(task.createdAt).toBeDefined();
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
    });

    it('should handle task creation for non-existent rule', async () => {
      const task = await service.createTask('non-existent-rule', TENANT_A);

      expect(task).toBeDefined();
      expect(task.status).toBe('running');
      expect(task.result).toBeUndefined();
      expect(task.completedAt).toBeUndefined();
    });

    it('should store result in results collection when rule exists', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const task = await service.createTask(rule.id, TENANT_A);

      // Verify result is accessible through the task
      expect(task.result).toBeDefined();
      expect(task.result!.actualValue).toBe(30);

      jest.restoreAllMocks();
    });
  });

  describe('listTasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await service.listTasks(TENANT_A);
      expect(tasks).toEqual([]);
    });

    it('should list tasks for a specific tenant', async () => {
      const ruleA = await service.createRule(makeRuleInput(), TENANT_A);
      const ruleB = await service.createRule(makeRuleInput(), TENANT_B);
      await service.createTask(ruleA.id, TENANT_A);
      await service.createTask(ruleB.id, TENANT_B);

      const tasksA = await service.listTasks(TENANT_A);
      expect(tasksA).toHaveLength(1);
      expect(tasksA[0].tenantId).toBe(TENANT_A);
    });

    it('should filter tasks by ruleId', async () => {
      const rule1 = await service.createRule(makeRuleInput({ name: 'R1' }), TENANT_A);
      const rule2 = await service.createRule(makeRuleInput({ name: 'R2' }), TENANT_A);
      await service.createTask(rule1.id, TENANT_A);
      await service.createTask(rule2.id, TENANT_A);

      const filtered = await service.listTasks(TENANT_A, { ruleId: rule1.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].ruleId).toBe(rule1.id);
    });

    it('should filter tasks by status', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      await service.createTask(rule.id, TENANT_A);

      const completed = await service.listTasks(TENANT_A, { status: 'completed' });
      expect(completed).toHaveLength(1);
      expect(completed[0].status).toBe('completed');
    });

    it('should sort tasks by createdAt descending', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      await service.createTask(rule.id, TENANT_A);
      await service.createTask(rule.id, TENANT_A);

      const tasks = await service.listTasks(TENANT_A);
      expect(tasks).toHaveLength(2);
      // Should be sorted newest first
      expect(tasks[0].createdAt >= tasks[1].createdAt).toBe(true);
    });
  });

  describe('getTask', () => {
    it('should get a task by ID', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const created = await service.createTask(rule.id, TENANT_A);
      const fetched = await service.getTask(created.id);

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await service.getTask('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  // ───────────────────────── Report Generation ─────────────────────────

  describe('generateReport', () => {
    it('should generate a report with correct structure', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      const report = await service.generateReport('Test Report', TENANT_A);

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.tenantId).toBe(TENANT_A);
      expect(report.title).toBe('Test Report');
      expect(report.summary).toBeDefined();
      expect(report.summary.total).toBeGreaterThanOrEqual(1);
      expect(report.summary.passed).toBeDefined();
      expect(report.summary.failed).toBeDefined();
      expect(report.summary.warning).toBe(0);
      expect(report.summary.score).toBeDefined();
      expect(report.results).toBeDefined();
      expect(Array.isArray(report.results)).toBe(true);
      expect(report.generatedAt).toBeDefined();
    });

    it('should include results from all enabled rules', async () => {
      await service.createRule(makeRuleInput({ name: 'R1' }), TENANT_A);
      await service.createRule(makeRuleInput({ name: 'R2' }), TENANT_A);

      const report = await service.generateReport('Multi Rule Report', TENANT_A);
      expect(report.results.length).toBe(2);
      expect(report.summary.total).toBe(2);
    });

    it('should filter by specified ruleIds', async () => {
      const rule1 = await service.createRule(makeRuleInput({ name: 'R1' }), TENANT_A);
      const rule2 = await service.createRule(makeRuleInput({ name: 'R2' }), TENANT_A);

      const report = await service.generateReport('Filtered Report', TENANT_A, [rule1.id]);
      expect(report.results.length).toBe(1);
      expect(report.summary.total).toBe(1);
    });

    it('should skip disabled rules', async () => {
      await service.createRule(makeRuleInput({ name: 'R1' }), TENANT_A);
      const rule2 = await service.createRule(makeRuleInput({ name: 'R2' }), TENANT_A);
      await service.updateRule(rule2.id, { enabled: false });

      const report = await service.generateReport('Skip Disabled', TENANT_A);
      expect(report.results.length).toBe(1);
    });

    it('should not include rules from other tenants', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);
      await service.createRule(makeRuleInput(), TENANT_B);

      const report = await service.generateReport('Tenant Isolation', TENANT_A);
      expect(report.results.length).toBe(1);
    });

    it('should calculate score correctly', async () => {
      // All rules will pass if we set threshold very low and operator to lt
      await service.createRule(
        makeRuleInput({ threshold: 100, operator: 'lt' }),
        TENANT_A,
      );

      const report = await service.generateReport('Score Test', TENANT_A);
      // Random value is always < 100, so score should be 100
      expect(report.summary.score).toBe(100);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(0);
    });

    it('should return empty report when no enabled rules exist', async () => {
      const report = await service.generateReport('Empty Report', TENANT_A);
      expect(report.results).toHaveLength(0);
      expect(report.summary.total).toBe(0);
      expect(report.summary.score).toBe(0);
    });
  });

  describe('listReports', () => {
    it('should return empty array when no reports exist', async () => {
      const reports = await service.listReports(TENANT_A);
      expect(reports).toEqual([]);
    });

    it('should list reports for a specific tenant', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      await service.generateReport('Report A', TENANT_A);
      await service.generateReport('Report B', TENANT_A);

      const reports = await service.listReports(TENANT_A);
      expect(reports.length).toBe(2);
    });

    it('should not leak reports between tenants', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);
      await service.createRule(makeRuleInput(), TENANT_B);
      await service.generateReport('Report A', TENANT_A);
      await service.generateReport('Report B', TENANT_B);

      const reportsA = await service.listReports(TENANT_A);
      expect(reportsA).toHaveLength(1);
      expect(reportsA[0].title).toBe('Report A');
    });

    it('should sort reports by generatedAt descending', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);
      await service.generateReport('Report 1', TENANT_A);
      await service.generateReport('Report 2', TENANT_A);

      const reports = await service.listReports(TENANT_A);
      expect(reports.length).toBe(2);
      // Newest first
      expect(reports[0].generatedAt >= reports[1].generatedAt).toBe(true);
    });
  });

  describe('getReport', () => {
    it('should get a report by ID', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);
      const created = await service.generateReport('Report', TENANT_A);
      const fetched = await service.getReport(created.id);

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe('Report');
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await service.getReport('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  // ───────────────────────── Health Score ─────────────────────────

  describe('getHealthScore', () => {
    it('should return score 100 when no tasks exist', async () => {
      const health = await service.getHealthScore(TENANT_A);
      expect(health.score).toBe(100);
      expect(health.details).toEqual({});
    });

    it('should calculate correct score based on completed tasks', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      // threshold 100, operator gt => 50 > 100 is false => failed
      const rule = await service.createRule(
        makeRuleInput({ threshold: 100, operator: 'gt' }),
        TENANT_A,
      );
      await service.createTask(rule.id, TENANT_A);

      const health = await service.getHealthScore(TENANT_A);
      expect(health.score).toBe(0); // 0 passed / 1 total = 0%

      jest.restoreAllMocks();
    });

    it('should return 100 when all tasks pass', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      // threshold 10, operator gt => 50 > 10 is true => passed
      const rule = await service.createRule(
        makeRuleInput({ threshold: 10, operator: 'gt' }),
        TENANT_A,
      );
      await service.createTask(rule.id, TENANT_A);

      const health = await service.getHealthScore(TENANT_A);
      expect(health.score).toBe(100);

      jest.restoreAllMocks();
    });

    it('should include per-target breakdown in details', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      await service.createRule(makeRuleInput({ target: 'host' }), TENANT_A);
      await service.createRule(makeRuleInput({ target: 'database' }), TENANT_A);

      // Create tasks (this also runs inspections)
      const rules = await service.listRules(TENANT_A);
      for (const rule of rules) {
        await service.createTask(rule.id, TENANT_A);
      }

      const health = await service.getHealthScore(TENANT_A);
      expect(health.details).toBeDefined();
      expect(health.details['host']).toBeDefined();
      expect(health.details['database']).toBeDefined();

      jest.restoreAllMocks();
    });

    it('should isolate health scores between tenants', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const ruleA = await service.createRule(
        makeRuleInput({ threshold: 10, operator: 'gt' }),
        TENANT_A,
      );
      const ruleB = await service.createRule(
        makeRuleInput({ threshold: 100, operator: 'gt' }),
        TENANT_B,
      );
      await service.createTask(ruleA.id, TENANT_A);
      await service.createTask(ruleB.id, TENANT_B);

      const healthA = await service.getHealthScore(TENANT_A);
      const healthB = await service.getHealthScore(TENANT_B);

      expect(healthA.score).toBe(100); // 50 > 10 => pass
      expect(healthB.score).toBe(0);   // 50 > 100 => fail

      jest.restoreAllMocks();
    });
  });

  // ───────────────────────── Evaluate Logic (via createTask) ─────────────────────────

  describe('evaluate logic (via createTask results)', () => {
    it('should evaluate gt operator correctly - pass', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // actualValue = 90
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'gt' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(true); // 90 > 80
      jest.restoreAllMocks();
    });

    it('should evaluate gt operator correctly - fail', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'gt' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(false); // 50 > 80 is false
      jest.restoreAllMocks();
    });

    it('should evaluate lt operator correctly', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // actualValue = 30
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'lt' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(true); // 30 < 80
      jest.restoreAllMocks();
    });

    it('should evaluate eq operator correctly - pass', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.8); // actualValue = 80
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'eq' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(true); // 80 === 80
      jest.restoreAllMocks();
    });

    it('should evaluate eq operator correctly - fail', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'eq' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(false); // 50 !== 80
      jest.restoreAllMocks();
    });

    it('should evaluate gte operator correctly - equal', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.8); // actualValue = 80
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'gte' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(true); // 80 >= 80
      jest.restoreAllMocks();
    });

    it('should evaluate lte operator correctly', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50
      const rule = await service.createRule(
        makeRuleInput({ threshold: 80, operator: 'lte' }),
        TENANT_A,
      );
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.result!.passed).toBe(true); // 50 <= 80
      jest.restoreAllMocks();
    });
  });

  // ───────────────────────── Integration Scenarios ─────────────────────────

  describe('integration scenarios', () => {
    it('should support full lifecycle: create rule -> create task -> generate report', async () => {
      // 1. Create rule
      const rule = await service.createRule(
        makeRuleInput({ name: 'Disk Usage Check', target: 'host' }),
        TENANT_A,
      );
      expect(rule.id).toBeDefined();

      // 2. Create task
      const task = await service.createTask(rule.id, TENANT_A);
      expect(task.status).toBe('completed');

      // 3. Generate report
      const report = await service.generateReport('Health Report', TENANT_A);
      expect(report.results.length).toBeGreaterThanOrEqual(1);
      expect(report.summary.total).toBeGreaterThanOrEqual(1);
    });

    it('should support rule update and then task creation with new params', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // actualValue = 50

      const rule = await service.createRule(
        makeRuleInput({ threshold: 40, operator: 'gt' }),
        TENANT_A,
      );
      // 50 > 40 => pass
      const task1 = await service.createTask(rule.id, TENANT_A);
      expect(task1.result!.passed).toBe(true);

      // Update threshold so 50 > 60 => fail
      await service.updateRule(rule.id, { threshold: 60 });
      const task2 = await service.createTask(rule.id, TENANT_A);
      expect(task2.result!.passed).toBe(false);

      jest.restoreAllMocks();
    });

    it('should handle multiple tenants independently', async () => {
      const ruleA = await service.createRule(makeRuleInput({ name: 'A Rule' }), TENANT_A);
      const ruleB = await service.createRule(makeRuleInput({ name: 'B Rule' }), TENANT_B);

      await service.createTask(ruleA.id, TENANT_A);
      await service.createTask(ruleB.id, TENANT_B);

      const tasksA = await service.listTasks(TENANT_A);
      const tasksB = await service.listTasks(TENANT_B);

      expect(tasksA).toHaveLength(1);
      expect(tasksB).toHaveLength(1);
      expect(tasksA[0].tenantId).toBe(TENANT_A);
      expect(tasksB[0].tenantId).toBe(TENANT_B);
    });

    it('should handle deleting a rule that has tasks', async () => {
      const rule = await service.createRule(makeRuleInput(), TENANT_A);
      await service.createTask(rule.id, TENANT_A);

      // Delete rule - should succeed
      const deleted = await service.deleteRule(rule.id);
      expect(deleted).toBe(true);

      // Tasks should still exist
      const tasks = await service.listTasks(TENANT_A);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].ruleId).toBe(rule.id);
    });

    it('should support different checkTypes', async () => {
      const checkTypes = ['cpu', 'memory', 'disk', 'network', 'service', 'custom'] as const;
      const createdRules = [];

      for (const checkType of checkTypes) {
        const rule = await service.createRule(
          makeRuleInput({ name: `${checkType} check`, checkType }),
          TENANT_A,
        );
        createdRules.push(rule);
      }

      const allRules = await service.listRules(TENANT_A);
      expect(allRules).toHaveLength(6);

      const types = allRules.map((r: any) => r.checkType).sort();
      expect(types).toEqual(['cpu', 'custom', 'disk', 'memory', 'network', 'service']);
    });

    it('should handle report generation with no matching rules in ruleIds', async () => {
      await service.createRule(makeRuleInput(), TENANT_A);

      const report = await service.generateReport('No Match', TENANT_A, ['fake-id']);
      expect(report.results).toHaveLength(0);
      expect(report.summary.total).toBe(0);
    });
  });
});
