# Phase 1 Batch 1 — 低难度持久化 (20 个服务) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 20 个低难度服务从 Map 存储迁移到 PostgreSQL，使用 Phase 0 创建的 BaseRepository 和 QueryBuilder。

**Architecture:** 每个服务创建对应的 Repository 类继承 BaseRepository，服务类通过构造函数注入 Repository。迁移表已在 Phase 0 创建（034-044）。

**Tech Stack:** TypeScript, pg (PostgreSQL), BaseRepository, QueryBuilder, Jest, uuid v4, pino

---

## 分组策略

将 20 个服务按领域分为 5 组，每组 4 个，便于并行执行：

| 组 | 服务 | 迁移表 |
|---|------|--------|
| **G1: Tenant/FinOps** | TenantQuota, Budget, NamespacePool, PluginRegistry | tenant_quotas, budgets, namespace_pools, plugins |
| **G2: Alert/Monitoring** | AlertSuppression, AlertRule, CronScheduler, Notification | alert_suppression_rules, alert_rules, cron_jobs, notification_channels |
| **G3: Scheduler/OnCall** | OnCall, Skill, Policy, Risk | oncall_schedules, skills, policy_evaluations, risk_assessments |
| **G4: SBOM/Plugin** | SbomVulnerability, SbomWaiver, AgentProfile, PluginExecutor | sbom_vulnerabilities, sbom_waivers, agent_profiles, plugin_executions |
| **G5: Backup/Config/IaC** | Backup, Config, DeploymentHistory, Rollback, IaCPlan | backups, configs, deployments, rollback_history, iac_plans |

---

## 通用模式

每个服务的改造遵循相同模式：

### 1. 创建 Repository 类

```typescript
// src/repositories/XxxRepository.ts
import { BaseRepository } from '../db/base-repository';
import { XxxEntity } from '../services/xxx/types';

export class XxxRepository extends BaseRepository<XxxEntity> {
  constructor(db: DatabasePool) {
    super(db, 'xxx_table');
  }

  protected mapRowToEntity(row: any): XxxEntity {
    return {
      id: row.id,
      // ... 字段映射 snake_case → camelCase
    };
  }

  // 额外查询方法（如按名称查找）
  async findByName(name: string): Promise<XxxEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}
```

### 2. 修改 Service 类

```typescript
// src/services/xxx/XxxService.ts
export class XxxService {
  private repository: XxxRepository;

  constructor(db: DatabasePool) {
    this.repository = new XxxRepository(db);
  }

  // 原 Map 方法 → Repository 方法
  async createXxx(params: CreateParams): Promise<XxxEntity> {
    return this.repository.create({
      id: uuidv4(),
      ...params,
      createdAt: new Date(),
    });
  }
}
```

### 3. 创建测试

```typescript
// src/repositories/__tests__/XxxRepository.test.ts
describe('XxxRepository', () => {
  let repo: XxxRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new XxxRepository(mockDb);
  });

  test('should create entity', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: '1', name: 'Test' }] });
    const result = await repo.create({ name: 'Test' });
    expect(result.id).toBe('1');
  });

  test('should find by id', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: '1', name: 'Test' }] });
    const result = await repo.findById('1');
    expect(result?.name).toBe('Test');
  });

  test('should return undefined when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findById('nonexistent');
    expect(result).toBeUndefined();
  });
});
```

---

## Group 1: Tenant/FinOps 持久化

### Task 1.1: TenantQuotaRepository

**Files:**
- Create: `orion-platform-service/src/repositories/TenantQuotaRepository.ts`
- Modify: `orion-platform-service/src/services/tenant/TenantQuotaService.ts`
- Test: `orion-platform-service/src/repositories/__tests__/TenantQuotaRepository.test.ts`

**迁移表**: `tenant_quotas` (已存在于 020_create_tenant_quotas.sql)

**实体类型**:
```typescript
interface TenantQuotaEntity {
  id: string;
  tenantId: string;
  maxUsers: number;
  maxProjects: number;
  maxPipelines: number;
  maxStorageMb: number;
  maxApiCallsPerHour: number;
  maxConcurrentBuilds: number;
  usage: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 1: Write TenantQuotaRepository tests**

```typescript
// src/repositories/__tests__/TenantQuotaRepository.test.ts
import { TenantQuotaRepository } from '../TenantQuotaRepository';

describe('TenantQuotaRepository', () => {
  let repo: TenantQuotaRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new TenantQuotaRepository(mockDb);
  });

  test('should find quota by tenant id', async () => {
    const mockRow = {
      id: 'quota-1', tenant_id: 'tenant-1', max_users: 100, max_projects: 50,
      max_pipelines: 200, max_storage_mb: 10240, max_api_calls_per_hour: 10000,
      max_concurrent_builds: 10, usage: '{"pipelines": 5}', created_at: new Date(), updated_at: new Date()
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.findByTenantId('tenant-1');
    expect(result?.tenantId).toBe('tenant-1');
    expect(result?.maxPipelines).toBe(200);
  });

  test('should create quota', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'quota-1', tenant_id: 'tenant-1' }] });
    const result = await repo.create({ tenantId: 'tenant-1', maxPipelines: 100 });
    expect(result.id).toBeDefined();
  });

  test('should update quota', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'quota-1', max_pipelines: 200 }] });
    const result = await repo.update('quota-1', { maxPipelines: 200 });
    expect(result.maxPipelines).toBe(200);
  });

  test('should update usage', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'quota-1', usage: '{"pipelines": 10}' }] });
    await repo.updateUsage('quota-1', { pipelines: 10 });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('usage'), expect.any(Array));
  });
});
```

- [ ] **Step 2: Write TenantQuotaRepository implementation**

```typescript
// src/repositories/TenantQuotaRepository.ts
import { BaseRepository } from '../db/base-repository';
import { v4 as uuidv4 } from 'uuid';

export interface TenantQuotaEntity {
  id: string;
  tenantId: string;
  maxUsers: number;
  maxProjects: number;
  maxPipelines: number;
  maxStorageMb: number;
  maxApiCallsPerHour: number;
  maxConcurrentBuilds: number;
  usage: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export class TenantQuotaRepository extends BaseRepository<TenantQuotaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'tenant_quotas');
  }

  async findByTenantId(tenantId: string): Promise<TenantQuotaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM tenant_quotas WHERE tenant_id = $1`,
      [tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateUsage(id: string, usage: Record<string, number>): Promise<void> {
    await this.db.query(
      `UPDATE tenant_quotas SET usage = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(usage), id],
    );
  }

  protected mapRowToEntity(row: any): TenantQuotaEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      maxUsers: row.max_users ?? 100,
      maxProjects: row.max_projects ?? 50,
      maxPipelines: row.max_pipelines ?? 200,
      maxStorageMb: row.max_storage_mb ?? 10240,
      maxApiCallsPerHour: row.max_api_calls_per_hour ?? 10000,
      maxConcurrentBuilds: row.max_concurrent_builds ?? 10,
      usage: row.usage ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/repositories/__tests__/TenantQuotaRepository.test.ts --no-coverage`
Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/repositories/TenantQuotaRepository.ts src/repositories/__tests__/TenantQuotaRepository.test.ts
git commit -m "feat(phase1): add TenantQuotaRepository for tenant quota persistence

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.2: BudgetRepository

**Files:**
- Create: `orion-platform-service/src/repositories/BudgetRepository.ts`
- Test: `orion-platform-service/src/repositories/__tests__/BudgetRepository.test.ts`

**迁移表**: `budgets` + `cost_records` (已存在于 031_create_cost_tables.sql)

- [ ] **Step 1: Write BudgetRepository tests** (5 tests: create, findByEntity, update, checkThreshold, recordSpend)

- [ ] **Step 2: Write BudgetRepository implementation**

- [ ] **Step 3: Run tests** (5 PASS)

- [ ] **Step 4: Commit**

---

### Task 1.3: NamespacePoolRepository

**Files:**
- Create: `orion-platform-service/src/repositories/NamespacePoolRepository.ts`
- Test: `orion-platform-service/src/repositories/__tests__/NamespacePoolRepository.test.ts`

**迁移表**: `namespace_pools` (已存在于 042_create_namespace_pools.sql)

- [ ] **Step 1-4**: Same pattern (tests, implementation, run, commit)

---

### Task 1.4: PluginRepository (补充)

**Files:**
- Modify: `orion-platform-service/src/repositories/PluginRepository.ts` (已存在，确保继承 BaseRepository)
- Test: 补充测试

- [ ] **Step 1-4**: Verify existing PluginRepository inherits BaseRepository pattern

---

## Group 2: Alert/Monitoring 持久化

### Task 2.1: AlertSuppressionRepository

**迁移表**: `alert_suppression_rules` + `maintenance_windows` + `known_issues` (037)

### Task 2.2: AlertRuleRepository

**迁移表**: `alert_rules` (031 已有)

### Task 2.3: CronJobRepository

**迁移表**: `cron_jobs` + `cron_executions` (036)

### Task 2.4: NotificationChannelRepository

**迁移表**: `notification_channels` (017)

---

## Group 3: Scheduler/OnCall 持久化

### Task 3.1: OnCallScheduleRepository

**迁移表**: `oncall_schedules` + `oncall_assignments` + `oncall_overrides` (035)

### Task 3.2: SkillRepository

**迁移表**: `skills` (030)

### Task 3.3: PolicyEvaluationRepository

**迁移表**: `policy_evaluations` (027)

### Task 3.4: RiskAssessmentRepository

**迁移表**: `risk_assessments` (018)

---

## Group 4: SBOM/Plugin 持久化

### Task 4.1: SbomVulnerabilityRepository

**迁移表**: `sbom_vulnerabilities` (补充表，需创建)

### Task 4.2: SbomWaiverRepository

**迁移表**: `sbom_waivers` (补充表，需创建)

### Task 4.3: AgentProfileRepository

**迁移表**: `agent_profiles` (024)

### Task 4.4: PluginExecutionRepository

**迁移表**: `plugin_executions` (043)

---

## Group 5: Backup/Config/IaC 持久化

### Task 5.1: BackupRepository

**迁移表**: `backup_configs` + `backup_jobs` (015)

### Task 5.2: ConfigRepository

**迁移表**: `configs` (016)

### Task 5.3: DeploymentHistoryRepository

**迁移表**: `deployments` (007)

### Task 5.4: RollbackRepository

**迁移表**: `rollback_history` (新表，需创建)

### Task 5.5: IaCPlanRepository

**迁移表**: `iac_plans` (044)

---

## 补充迁移文件

### Task 6: 补充 SBOM Vulnerability/Waiver 表

**Files:**
- Create: `orion-platform-service/src/db/migrations/045_create_sbom_vulnerability_tables.sql`

```sql
-- Migration 045: SBOM Vulnerability Tracking
CREATE TABLE IF NOT EXISTS sbom_vulnerabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sbom_id         UUID REFERENCES sbom_documents(id),
  cve_id          VARCHAR(50) NOT NULL,
  package_name    VARCHAR(200) NOT NULL,
  package_version VARCHAR(100),
  severity        VARCHAR(20) NOT NULL,
  cvss_score      DECIMAL(3,2),
  description     TEXT,
  remediation     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sbom_vulnerabilities_sbom ON sbom_vulnerabilities(sbom_id);
CREATE INDEX idx_sbom_vulnerabilities_cve ON sbom_vulnerabilities(cve_id);

CREATE TABLE IF NOT EXISTS sbom_waivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID REFERENCES sbom_vulnerabilities(id),
  reason          TEXT NOT NULL,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sbom_waivers_vulnerability ON sbom_waivers(vulnerability_id);

-- Rollback:
-- DROP TABLE IF EXISTS sbom_waivers, sbom_vulnerabilities;
```

### Task 7: 补充 Rollback History 表

**Files:**
- Create: `orion-platform-service/src/db/migrations/046_create_rollback_history.sql`

```sql
-- Migration 046: Rollback History
CREATE TABLE IF NOT EXISTS rollback_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL,
  rollback_type   VARCHAR(20) NOT NULL,
  reason          TEXT,
  triggered_by    UUID,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  previous_version VARCHAR(100),
  target_version   VARCHAR(100),
  error_message   TEXT
);
CREATE INDEX idx_rollback_history_deployment ON rollback_history(deployment_id);
CREATE INDEX idx_rollback_history_status ON rollback_history(status);

-- Rollback:
-- DROP TABLE IF EXISTS rollback_history;
```

---

## 执行顺序

```
Group 1 (G1): TenantQuota → Budget → NamespacePool → PluginRegistry
Group 2 (G2): AlertSuppression → AlertRule → CronJob → NotificationChannel
Group 3 (G3): OnCall → Skill → Policy → Risk
Group 4 (G4): SbomVulnerability → SbomWaiver → AgentProfile → PluginExecution
Group 5 (G5): Backup → Config → DeploymentHistory → Rollback → IaCPlan

补充迁移: Task 6 (SBOM), Task 7 (Rollback)

总计: 20 个 Repository + 2 个补充迁移 + 20 个测试文件
```

---

## 成功标准

- 20 个 Repository 类全部继承 BaseRepository
- 每个 Repository 有对应测试文件，最少 4 个测试
- 所有测试通过 (80+ tests)
- 补充迁移文件 045, 046 创建并提交
- `npm run type-check` 无错误

---

## 文件清单

| 类型 | 数量 | 说明 |
|------|------|------|
| Repository | 20 | `src/repositories/*.ts` |
| Test | 20 | `src/repositories/__tests__/*.test.ts` |
| Migration | 2 | `src/db/migrations/045,046*.sql` |
| Service 修改 | 20 | 将 Map 替换为 Repository 调用 |

**总计**: 42 个文件修改/新增