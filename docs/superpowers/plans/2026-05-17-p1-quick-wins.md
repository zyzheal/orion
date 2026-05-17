# P1 Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 high-impact P1 issues that can be resolved quickly with minimal code changes.

**Architecture:** Each fix is self-contained. monitor-svc Map→PostgreSQL migration creates new Repository files. Other fixes are single-file changes.

**Tech Stack:** Fastify, PostgreSQL, TypeScript

---

### Task 1: Migrate monitor-svc MonitoringService from Map to PostgreSQL

**Files:**
- Create: `orion-monitor-svc/src/repositories/MonitoringRuleRepository.ts`
- Modify: `orion-monitor-svc/src/services/MonitoringService.ts`
- Create: `orion-monitor-svc/migrations/001_monitoring_rules.sql`

Currently `MonitoringService.ts` uses `const rules: Map<string, MonitoringRule> = new Map()` — all rules lost on restart.

- [ ] **Step 1: Create the migration**

Create `orion-monitor-svc/migrations/001_monitoring_rules.sql`:

```sql
CREATE TABLE IF NOT EXISTS monitoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  metric VARCHAR(255) NOT NULL,
  condition VARCHAR(50) NOT NULL,
  threshold DECIMAL NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels TEXT[] DEFAULT '{}',
  cooldown_seconds INTEGER DEFAULT 300,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitoring_rules_tenant ON monitoring_rules(tenant_id);
CREATE INDEX idx_monitoring_rules_enabled ON monitoring_rules(enabled) WHERE enabled = true;
```

- [ ] **Step 2: Create the Repository**

Create `orion-monitor-svc/src/repositories/MonitoringRuleRepository.ts`:

```typescript
export interface MonitoringRule {
  id: string;
  tenant_id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  notification_channels: string[];
  cooldown_seconds: number;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export class MonitoringRuleRepository {
  constructor(private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }) {}

  async findAll(tenantId: string, enabledOnly?: boolean): Promise<MonitoringRule[]> {
    let sql = 'SELECT * FROM monitoring_rules WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (enabledOnly) {
      sql += ' AND enabled = true';
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async findById(id: string): Promise<MonitoringRule | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_rules WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(rule: Omit<MonitoringRule, 'id' | 'created_at' | 'updated_at'>): Promise<MonitoringRule> {
    const result = await this.pool.query(
      `INSERT INTO monitoring_rules (tenant_id, name, metric, condition, threshold, severity, enabled, notification_channels, cooldown_seconds, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [rule.tenant_id, rule.name, rule.metric, rule.condition, rule.threshold, rule.severity, rule.enabled, rule.notification_channels, rule.cooldown_seconds, rule.description]
    );
    return result.rows[0];
  }

  async update(id: string, updates: Partial<MonitoringRule>): Promise<MonitoringRule | null> {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return null;

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map(f => (updates as any)[f]);

    const result = await this.pool.query(
      `UPDATE monitoring_rules SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM monitoring_rules WHERE id = $1', [id]);
    return (result as any).rowCount > 0;
  }
}
```

- [ ] **Step 3: Rewrite MonitoringService to use Repository**

In `orion-monitor-svc/src/services/MonitoringService.ts`, replace the Map with Repository:

```typescript
import { MonitoringRuleRepository, MonitoringRule } from '../repositories/MonitoringRuleRepository';

export class MonitoringService {
  constructor(private repo: MonitoringRuleRepository) {}

  async createRule(rule: Omit<MonitoringRule, 'id' | 'created_at' | 'updated_at'>): Promise<MonitoringRule> {
    return this.repo.create(rule);
  }

  async getRules(tenantId: string, enabledOnly?: boolean): Promise<MonitoringRule[]> {
    return this.repo.findAll(tenantId, enabledOnly);
  }

  async getRule(id: string): Promise<MonitoringRule | null> {
    return this.repo.findById(id);
  }

  async updateRule(id: string, updates: Partial<MonitoringRule>): Promise<MonitoringRule | null> {
    return this.repo.update(id, updates);
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Wire Repository into app.ts**

In `orion-monitor-svc/src/app.ts`, update the MonitoringService initialization:

```typescript
import { MonitoringRuleRepository } from './repositories/MonitoringRuleRepository';
import { MonitoringService } from './services/MonitoringService';

// Replace:
// const monitoringService = new MonitoringService();
// With:
const monitoringRuleRepo = new MonitoringRuleRepository(db);
const monitoringService = new MonitoringService(monitoringRuleRepo);
```

- [ ] **Step 5: Commit**

```bash
git add orion-monitor-svc/
git commit -m "feat(monitor): migrate MonitoringService from Map to PostgreSQL with MonitoringRuleRepository"
```

---

### Task 2: Migrate monitor-svc AlertService from Map to PostgreSQL

**Files:**
- Create: `orion-monitor-svc/src/repositories/AlertRepository.ts`
- Modify: `orion-monitor-svc/src/services/AlertService.ts`
- Modify: `orion-monitor-svc/migrations/001_monitoring_rules.sql` — add alerts table

- [ ] **Step 1: Add alerts table to migration**

Append to `orion-monitor-svc/migrations/001_monitoring_rules.sql`:

```sql
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  rule_id UUID REFERENCES monitoring_rules(id),
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'firing',
  source VARCHAR(255),
  labels JSONB DEFAULT '{}',
  annotations JSONB DEFAULT '{}',
  fired_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_fired_at ON alerts(fired_at DESC);
```

- [ ] **Step 2: Create AlertRepository**

Create `orion-monitor-svc/src/repositories/AlertRepository.ts`:

```typescript
export interface Alert {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  title: string;
  message: string;
  severity: string;
  status: string;
  source: string | null;
  labels: Record<string, unknown>;
  annotations: Record<string, unknown>;
  fired_at: Date;
  resolved_at: Date | null;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
}

export class AlertRepository {
  constructor(private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }) {}

  async findAll(tenantId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<Alert[]> {
    let sql = 'SELECT * FROM alerts WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (options?.status) { params.push(options.status); sql += ` AND status = $${params.length}`; }
    sql += ' ORDER BY fired_at DESC';
    if (options?.limit) { params.push(options.limit); sql += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); sql += ` OFFSET $${params.length}`; }
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async findById(id: string): Promise<Alert | null> {
    const result = await this.pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(alert: Omit<Alert, 'id' | 'created_at'>): Promise<Alert> {
    const result = await this.pool.query(
      `INSERT INTO alerts (tenant_id, rule_id, title, message, severity, status, source, labels, annotations, fired_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [alert.tenant_id, alert.rule_id, alert.title, alert.message, alert.severity, alert.status, alert.source, alert.labels, alert.annotations, alert.fired_at]
    );
    return result.rows[0];
  }

  async updateStatus(id: string, status: string, resolvedBy?: string): Promise<Alert | null> {
    const result = await this.pool.query(
      `UPDATE alerts SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
       acknowledged_by = CASE WHEN $1 = 'acknowledged' THEN $2 ELSE acknowledged_by END,
       acknowledged_at = CASE WHEN $1 = 'acknowledged' THEN NOW() ELSE acknowledged_at END
       WHERE id = $3 RETURNING *`,
      [status, resolvedBy || null, id]
    );
    return result.rows[0] || null;
  }

  async count(tenantId: string, status?: string): Promise<number> {
    let sql = 'SELECT COUNT(*) FROM alerts WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    const result = await this.pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }
}
```

- [ ] **Step 3: Rewrite AlertService**

In `orion-monitor-svc/src/services/AlertService.ts`, replace Map with Repository pattern (same approach as Task 1 MonitoringService).

- [ ] **Step 4: Commit**

```bash
git add orion-monitor-svc/
git commit -m "feat(monitor): migrate AlertService from Map to PostgreSQL with AlertRepository"
```

---

### Task 3: Migrate monitor-svc OnCallService and SelfHealingService from Map

**Files:**
- Create: `orion-monitor-svc/src/repositories/OnCallRepository.ts`
- Create: `orion-monitor-svc/src/repositories/SelfHealingRepository.ts`
- Modify: `orion-monitor-svc/src/services/OnCallService.ts`
- Modify: `orion-monitor-svc/src/services/SelfHealingService.ts`
- Modify: `orion-monitor-svc/migrations/001_monitoring_rules.sql` — add tables

- [ ] **Step 1: Add oncall_schedules and self_healing_policies tables**

Append to migration file:

```sql
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  team VARCHAR(255),
  rotation_type VARCHAR(20) NOT NULL DEFAULT 'weekly',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  participants TEXT[] NOT NULL,
  escalation_policy JSONB,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS self_healing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_condition JSONB NOT NULL,
  action VARCHAR(50) NOT NULL,
  action_config JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_seconds INTEGER DEFAULT 600,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Create repositories and rewrite services**

Same pattern as Tasks 1-2: create Repository classes, rewrite services to use them.

- [ ] **Step 3: Commit**

```bash
git add orion-monitor-svc/
git commit -m "feat(monitor): migrate OnCallService and SelfHealingService from Map to PostgreSQL"
```

---

### Task 4: Migrate LLMTraceService from Map to PostgreSQL

**Files:**
- Create: `orion-platform-service/src/repositories/LLMTraceRepository.ts`
- Modify: `orion-platform-service/src/services/llm-trace/LLMTraceService.ts`
- Create: `orion-platform-service/src/db/migrations/160_llm_traces.sql`

LLMTraceService uses `Map<string, LLMTrace>` — restart loses all trace data needed for LLM cost tracking.

- [ ] **Step 1: Create migration**

Create `orion-platform-service/src/db/migrations/160_llm_traces.sql`:

```sql
CREATE TABLE IF NOT EXISTS llm_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  trace_id VARCHAR(255) NOT NULL,
  span_id VARCHAR(255),
  parent_span_id VARCHAR(255),
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  operation VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  error_message TEXT,
  input_data JSONB,
  output_data JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_traces_tenant ON llm_traces(tenant_id);
CREATE INDEX idx_llm_traces_trace ON llm_traces(trace_id);
CREATE INDEX idx_llm_traces_model ON llm_traces(model);
CREATE INDEX idx_llm_traces_created ON llm_traces(created_at DESC);
```

- [ ] **Step 2: Create LLMTraceRepository**

Create `orion-platform-service/src/repositories/LLMTraceRepository.ts` following the same Repository pattern used by other repositories in the codebase.

- [ ] **Step 3: Rewrite LLMTraceService**

In `orion-platform-service/src/services/llm-trace/LLMTraceService.ts`, replace `private traces = new Map<string, LLMTrace>()` with `private repository: LLMTraceRepository`.

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/repositories/LLMTraceRepository.ts orion-platform-service/src/services/llm-trace/LLMTraceService.ts orion-platform-service/src/db/migrations/160_llm_traces.sql
git commit -m "feat(ai): migrate LLMTraceService from Map to PostgreSQL for persistent cost tracking"
```
