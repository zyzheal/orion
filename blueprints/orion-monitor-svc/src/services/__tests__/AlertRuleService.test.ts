import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AlertRuleService,
  type CreateRuleInput,
  type MetricSample,
} from '../AlertRuleService.js';
import {
  AlertRuleRepository,
  type AlertRule,
} from '../../repositories/AlertRuleRepository.js';

// -- Mock repository -------------------------------------------------------

function makeRepo() {
  const store = new Map<string, AlertRule>();

  const repo = {
    create: vi.fn(async (data: Omit<AlertRule, 'createdAt' | 'updatedAt'>) => {
      const rule: AlertRule = {
        id: data.id,
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        metric: data.metric,
        condition: data.condition,
        threshold: data.threshold,
        thresholdMax: data.thresholdMax,
        duration: data.duration,
        severity: data.severity,
        enabled: data.enabled,
        labels: data.labels,
        annotations: data.annotations,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(rule.id, rule);
      return rule;
    }),
    findAll: vi.fn(async (tenantId: string, enabledOnly?: boolean) => {
      let rules = Array.from(store.values()).filter((r) => r.tenantId === tenantId);
      if (enabledOnly) {
        rules = rules.filter((r) => r.enabled);
      }
      return rules;
    }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    update: vi.fn(async (id: string, updates: Partial<AlertRule>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => store.delete(id)),
  };
  return repo;
}

type MockRepo = ReturnType<typeof makeRepo>;

function makeService(repo: MockRepo) {
  return new AlertRuleService(repo as unknown as AlertRuleRepository);
}

// -- Helpers ----------------------------------------------------------------

function makeRuleInput(overrides: Partial<CreateRuleInput> = {}): CreateRuleInput {
  return {
    tenantId: overrides.tenantId ?? 'tenant-001',
    name: overrides.name ?? 'CPU High Alert',
    description: overrides.description ?? 'Alert when CPU exceeds threshold',
    metric: overrides.metric ?? 'cpu_usage',
    condition: overrides.condition ?? 'gt',
    threshold: overrides.threshold ?? 80,
    thresholdMax: overrides.thresholdMax,
    duration: overrides.duration ?? 60,
    severity: overrides.severity ?? 'warning',
    enabled: overrides.enabled ?? true,
    labels: overrides.labels ?? { team: 'infra' },
    annotations: overrides.annotations ?? { summary: 'CPU is high' },
  };
}

function makeSample(overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    metric: overrides.metric ?? 'cpu_usage',
    value: overrides.value ?? 85,
    timestamp: overrides.timestamp ?? new Date(),
    labels: overrides.labels ?? { host: 'node-1' },
  };
}

// -- Tests ------------------------------------------------------------------

describe('AlertRuleService', () => {
  let repo: MockRepo;
  let svc: AlertRuleService;

  beforeEach(() => {
    repo = makeRepo();
    svc = makeService(repo);
  });

  describe('createRule', () => {
    it('creates an alert rule and returns it', async () => {
      const input = makeRuleInput();
      const result = await svc.createRule(input);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^rule-/);
      expect(result.tenantId).toBe('tenant-001');
      expect(result.name).toBe('CPU High Alert');
      expect(result.metric).toBe('cpu_usage');
      expect(result.condition).toBe('gt');
      expect(result.threshold).toBe(80);
      expect(result.enabled).toBe(true);
      expect(result.severity).toBe('warning');
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('uses defaults for optional fields', async () => {
      const input: CreateRuleInput = {
        tenantId: 'tenant-001',
        name: 'Test Rule',
        metric: 'memory_usage',
        condition: 'gte',
        threshold: 90,
      };
      const result = await svc.createRule(input);

      expect(result.description).toBe('');
      expect(result.duration).toBe(60);
      expect(result.severity).toBe('warning');
      expect(result.enabled).toBe(true);
      expect(result.labels).toEqual({});
      expect(result.annotations).toEqual({});
    });

    it('supports between condition with thresholdMax', async () => {
      const input = makeRuleInput({
        condition: 'between',
        threshold: 40,
        thresholdMax: 80,
      });
      const result = await svc.createRule(input);
      expect(result.condition).toBe('between');
      expect(result.thresholdMax).toBe(80);
    });
  });

  describe('listRules', () => {
    it('returns all rules for a tenant', async () => {
      await svc.createRule(makeRuleInput({ name: 'Rule 1' }));
      await svc.createRule(makeRuleInput({ name: 'Rule 2' }));
      const rules = await svc.listRules('tenant-001');
      expect(rules).toHaveLength(2);
    });

    it('filters by tenant', async () => {
      await svc.createRule(makeRuleInput({ tenantId: 'tenant-A', name: 'Rule A' }));
      await svc.createRule(makeRuleInput({ tenantId: 'tenant-B', name: 'Rule B' }));
      const rulesA = await svc.listRules('tenant-A');
      expect(rulesA).toHaveLength(1);
      expect(rulesA[0].name).toBe('Rule A');
    });

    it('returns only enabled rules when enabledOnly is true', async () => {
      await svc.createRule(makeRuleInput({ name: 'Enabled', enabled: true }));
      await svc.createRule(makeRuleInput({ name: 'Disabled', enabled: false }));
      const enabled = await svc.listRules('tenant-001', true);
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('Enabled');
    });
  });

  describe('getRule', () => {
    it('returns a rule by ID', async () => {
      const created = await svc.createRule(makeRuleInput());
      const found = await svc.getRule(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null for non-existent rule', async () => {
      const found = await svc.getRule('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('updateRule', () => {
    it('updates specified fields', async () => {
      const created = await svc.createRule(makeRuleInput());
      const updated = await svc.updateRule(created.id, {
        name: 'Updated Name',
        threshold: 95,
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.threshold).toBe(95);
    });

    it('returns null for non-existent rule', async () => {
      const result = await svc.updateRule('non-existent', { name: 'X' });
      expect(result).toBeNull();
    });

    it('can toggle enabled flag', async () => {
      const created = await svc.createRule(makeRuleInput({ enabled: true }));
      const updated = await svc.updateRule(created.id, { enabled: false });
      expect(updated!.enabled).toBe(false);
    });
  });

  describe('deleteRule', () => {
    it('deletes an existing rule', async () => {
      const created = await svc.createRule(makeRuleInput());
      const result = await svc.deleteRule(created.id);
      expect(result).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith(created.id);
    });

    it('returns false for non-existent rule', async () => {
      const result = await svc.deleteRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('evaluate', () => {
    describe('gt condition', () => {
      it('triggers when value > threshold', () => {
        const rule = { ...makeRuleInput(), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 85 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(true);
        expect(result.currentValue).toBe(85);
      });

      it('does not trigger when value <= threshold', () => {
        const rule = { ...makeRuleInput(), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 80 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(false);
      });
    });

    describe('lt condition', () => {
      it('triggers when value < threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'lt', threshold: 20 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 15 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(true);
      });

      it('does not trigger when value >= threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'lt', threshold: 20 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 20 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(false);
      });
    });

    describe('eq condition', () => {
      it('triggers when value === threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'eq', threshold: 50 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 50 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(true);
      });

      it('does not trigger when value !== threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'eq', threshold: 50 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ value: 51 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(false);
      });
    });

    describe('gte condition', () => {
      it('triggers when value >= threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'gte', threshold: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 80 }), rule).triggered).toBe(true);
        expect(svc.evaluate(makeSample({ value: 85 }), rule).triggered).toBe(true);
      });

      it('does not trigger when value < threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'gte', threshold: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 79 }), rule).triggered).toBe(false);
      });
    });

    describe('lte condition', () => {
      it('triggers when value <= threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'lte', threshold: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 80 }), rule).triggered).toBe(true);
        expect(svc.evaluate(makeSample({ value: 75 }), rule).triggered).toBe(true);
      });

      it('does not trigger when value > threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'lte', threshold: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 81 }), rule).triggered).toBe(false);
      });
    });

    describe('between condition', () => {
      it('triggers when value is within range', () => {
        const rule = { ...makeRuleInput({ condition: 'between', threshold: 40, thresholdMax: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 50 }), rule).triggered).toBe(true);
        expect(svc.evaluate(makeSample({ value: 40 }), rule).triggered).toBe(true);
        expect(svc.evaluate(makeSample({ value: 80 }), rule).triggered).toBe(true);
      });

      it('does not trigger when value is outside range', () => {
        const rule = { ...makeRuleInput({ condition: 'between', threshold: 40, thresholdMax: 80 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 30 }), rule).triggered).toBe(false);
        expect(svc.evaluate(makeSample({ value: 90 }), rule).triggered).toBe(false);
      });

      it('triggers when value >= threshold and thresholdMax is undefined', () => {
        const rule = { ...makeRuleInput({ condition: 'between', threshold: 40, thresholdMax: undefined }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 100 }), rule).triggered).toBe(true);
      });
    });

    describe('anomaly condition', () => {
      it('triggers when deviation > 50% of threshold', () => {
        const rule = { ...makeRuleInput({ condition: 'anomaly', threshold: 100 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        // 50% of 100 = 50, so anything outside [50, 150] triggers
        expect(svc.evaluate(makeSample({ value: 200 }), rule).triggered).toBe(true);
        expect(svc.evaluate(makeSample({ value: 10 }), rule).triggered).toBe(true);
      });

      it('does not trigger when within 50% deviation', () => {
        const rule = { ...makeRuleInput({ condition: 'anomaly', threshold: 100 }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        expect(svc.evaluate(makeSample({ value: 100 }), rule).triggered).toBe(false);
        expect(svc.evaluate(makeSample({ value: 140 }), rule).triggered).toBe(false);
        expect(svc.evaluate(makeSample({ value: 60 }), rule).triggered).toBe(false);
      });
    });

    describe('non-matching metric', () => {
      it('never triggers for different metric name', () => {
        const rule = { ...makeRuleInput({ metric: 'cpu_usage' }), id: 'rule-1', createdAt: new Date(), updatedAt: new Date() } as AlertRule;
        const sample = makeSample({ metric: 'memory_usage', value: 999 });
        const result = svc.evaluate(sample, rule);
        expect(result.triggered).toBe(false);
        expect(result.ruleId).toBe('rule-1');
      });
    });
  });

  describe('evaluateAll', () => {
    it('evaluates all enabled rules against all samples', async () => {
      await svc.createRule(makeRuleInput({ metric: 'cpu_usage', condition: 'gt', threshold: 80, name: 'CPU Rule' }));
      await svc.createRule(makeRuleInput({ metric: 'memory_usage', condition: 'gte', threshold: 90, name: 'Memory Rule' }));

      const samples: MetricSample[] = [
        makeSample({ metric: 'cpu_usage', value: 85 }),
        makeSample({ metric: 'memory_usage', value: 95 }),
      ];

      const results = await svc.evaluateAll('tenant-001', samples);
      expect(results).toHaveLength(4); // 2 rules x 2 samples

      // Find triggered evaluations
      const cpuTriggered = results.find(
        (r) => r.triggered && r.currentValue === 85,
      );
      const memTriggered = results.find(
        (r) => r.triggered && r.currentValue === 95,
      );
      expect(cpuTriggered).toBeDefined();
      expect(memTriggered).toBeDefined();
    });

    it('ignores disabled rules', async () => {
      await svc.createRule(makeRuleInput({ enabled: true, name: 'Enabled' }));
      await svc.createRule(makeRuleInput({ enabled: false, name: 'Disabled' }));

      const results = await svc.evaluateAll('tenant-001', [makeSample()]);
      expect(results).toHaveLength(1); // Only 1 enabled rule
    });

    it('returns empty array when no samples', async () => {
      await svc.createRule(makeRuleInput());
      const results = await svc.evaluateAll('tenant-001', []);
      expect(results).toHaveLength(0);
    });
  });
});
