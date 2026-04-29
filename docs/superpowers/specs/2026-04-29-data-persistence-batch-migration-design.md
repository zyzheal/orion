# 数据持久化批量迁移设计文档

> 日期: 2026-04-29
> 状态: 设计阶段
> 优先级: P0
> 关联决策: 总架构师评审决策 C

## 1. 问题陈述

### 1.1 现状

30+ 服务已迁移到 PostgreSQL Repository 模式，但 80+ 文件仍使用 `new Map()` 模拟存储。
其中约 50% 是合理的内存使用（实时状态、缓存、沙箱），仅 ~20 个服务需要真实持久化。

### 1.2 总架构师评审决策

**分类迁移策略（修正后）**：
- **需要迁移 (14 个)**：涉及真实业务数据持久化的服务
- **保留内存 (~36 个)**：实时状态、缓存、沙箱等合理内存使用

## 2. 需要迁移的服务清单（14 个）

### 2.1 核心业务 (5 个)

| 服务 | 当前文件 | 数据模型 | 迁移原因 |
|------|---------|---------|---------|
| TenantQuotaService | tenant/TenantQuotaService.ts | TenantQuota, TenantUsage | 多租户配额必须持久化 |
| NamespacePoolService | tenant/NamespacePoolService.ts | NamespacePoolEntry | 资源池分配必须持久化 |
| OnCallService | scheduler/OnCallService.ts | OnCallAssignment, OnCallOverride | SRE 排班必须持久化 |
| CronSchedulerService | scheduler/CronSchedulerService.ts | CronJobExecution | 定时任务定义必须持久化 |
| ConfigApprovalService | config-mgmt/ConfigApprovalService.ts | ChangeRequest | 审批流程必须持久化 |

### 2.2 制品管理 (3 个)

| 服务 | 当前文件 | 数据模型 | 迁移原因 |
|------|---------|---------|---------|
| PromotionService | artifact/PromotionService.ts | PromotionStage | 制品晋升必须持久化 |
| ArtifactService | build/ArtifactService.ts | Artifact | 制品元数据必须持久化 |
| BuildLogService | build/BuildLogService.ts | BuildLog | 构建日志必须持久化 |

### 2.3 告警/Plugin (3 个)

| 服务 | 当前文件 | 数据模型 | 迁移原因 |
|------|---------|---------|---------|
| AlertSuppressionService | alert/AlertSuppressionService.ts | SuppressionRule, MaintenanceWindow | 抑制规则必须持久化 |
| PluginRegistry | plugin-spi/PluginRegistry.ts | PluginInfo | 插件注册信息必须持久化 |
| PluginExecutor | plugin-executor-service.ts | TaskExecutionResult | 执行结果必须持久化 |

### 2.4 工单/备份 (3 个)

| 服务 | 当前文件 | 数据模型 | 迁移原因 |
|------|---------|---------|---------|
| TicketWorkflowService | ticketing/TicketWorkflowService.ts | Ticket, WorkflowHistory | 工单流转必须持久化 |
| BackupScheduler | backup/BackupScheduler.ts | BackupPlan | 备份计划必须持久化 |
| RecoveryService | backup/RecoveryService.ts | RecoveryRecord | 恢复记录必须持久化 |

## 3. 保留内存的服务清单（~36 个）

以下服务保留 Map() 使用，需添加注释说明原因：

### 3.1 运行时状态（不需要持久化）

| 服务 | 原因 |
|------|------|
| PluginManager | 插件运行时状态，重启后需重新初始化 |
| AgentSandbox | 沙箱是运行时状态，不应持久化 |
| AlertCorrelationService | 告警关联是实时计算，内存窗口更合理 |
| SelfHealingGuardian | 自愈决策是运行时状态 |
| HealingActionExecutor | 执行结果是临时的，已有 AuditLog 记录 |
| ChangeIntelligenceService | 分析数据可从事件重建 |
| Health, Metrics | 实时指标，重启后无意义 |
| SSEConnectionManager | WebSocket 连接，天然内存 |

### 3.2 缓存/监听器（内存更优）

| 服务 | 原因 |
|------|------|
| K8sWatchClient | K8s 事件监听，缓存合理 |
| ReplicationLagMonitor, ReadTrafficManager | 运行时监控 |
| CostCalculator, SaaSCostTracker | 成本计算中间状态 |
| AlertDeduplication | 告警去重 (内存窗口) |
| EventHandler | 事件处理中间状态 |
| TestSelector 系列 | 测试选择器分析结果 |
| GitOpsService | 文件内容缓存 |
| CloudCostCollector | 适配器注册 |
| NotificationService, Monitoring 系列 | 实时通知/监控 |
| DispatchAnalytics | 工单分析 |

## 3. 迁移规范

### 3.1 Repository 模式

每个服务创建对应的 Repository 文件，继承自 BaseRepository：

```typescript
// 示例：TenantQuotaRepository.ts
import { BaseRepository } from '../database/BaseRepository';

export interface TenantQuotaRecord {
  id: string;
  tenant_id: number;
  resource_type: string;
  quota_limit: number;
  quota_used: number;
  created_at: Date;
  updated_at: Date;
}

export class TenantQuotaRepository extends BaseRepository<TenantQuotaRecord> {
  constructor(pool: DatabasePool) {
    super('tenant_quotas', pool);
  }

  async getByTenantId(tenantId: number): Promise<TenantQuotaRecord[]> {
    return this.findMany({ tenant_id: tenantId });
  }

  async updateUsage(tenantId: number, resourceType: string, used: number): Promise<void> {
    await this.update(
      { quota_used: used },
      { tenant_id: tenantId, resource_type: resourceType }
    );
  }
}
```

### 3.2 服务修改模式

```typescript
// 修改前
export class TenantQuotaService {
  private quotas: Map<number, TenantQuota> = new Map();
  private usage: Map<string, TenantUsage> = new Map();

  async getQuota(tenantId: number): Promise<TenantQuota> {
    return this.quotas.get(tenantId);
  }
}

// 修改后
export class TenantQuotaService {
  private repository: TenantQuotaRepository;

  constructor(repository: TenantQuotaRepository) {
    this.repository = repository;
  }

  async getQuota(tenantId: number): Promise<TenantQuota> {
    const record = await this.repository.getByTenantId(tenantId);
    return this.mapToDomain(record);
  }
}
```

### 3.3 数据库迁移 SQL

每个服务创建对应的迁移文件：

```sql
-- 050_tenant_quotas.sql
CREATE TABLE IF NOT EXISTS tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  quota_limit INTEGER NOT NULL,
  quota_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, resource_type)
);

CREATE INDEX idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
```

## 4. 批量迁移执行顺序

### Phase 1: 核心业务 (5 个服务)
1. TenantQuotaService → TenantQuotaRepository
2. NamespacePoolService → NamespacePoolRepository
3. OnCallService → OnCallRepository
4. CronSchedulerService → CronSchedulerRepository
5. ConfigApprovalService → ConfigApprovalRepository

### Phase 2: 制品管理 (3 个服务)
6. PromotionService → PromotionRepository
7. ArtifactService → ArtifactRepository (已存在，需扩展)
8. BuildLogService → BuildLogRepository

### Phase 3: 告警/SRE (4 个服务)
9. AlertSuppressionService → AlertSuppressionRepository
10. AlertCorrelationService → AlertCorrelationRepository
11. SelfHealingGuardian → SelfHealingGuardianRepository
12. HealingActionExecutor → HealingActionExecutorRepository

### Phase 4: Plugin (4 个服务)
13. PluginRegistry → PluginRegistryRepository
14. PluginExecutor → PluginExecutorRepository
15. PluginManager → PluginManagerRepository
16. AgentSandbox → AgentSandboxRepository

### Phase 5: 其他 (4 个服务)
17. TicketWorkflowService → TicketWorkflowRepository
18. BackupScheduler → BackupSchedulerRepository
19. RecoveryService → RecoveryRepository
20. ChangeIntelligenceService → ChangeIntelligenceRepository

## 5. 保留内存的服务清单

以下服务保留 Map() 使用，需添加注释说明原因：

```typescript
/**
 * Health check registry - kept in memory as health status
 * is ephemeral and has no value after restart.
 */
private allChecks: Map<string, HealthCheckFn> = new Map();
```

**保留列表**:
- Health, Metrics, MetricsCollector
- SSEConnectionManager
- K8sWatchClient
- ReplicationLagMonitor, ReadTrafficManager
- PluginSandbox (plugin-spi/), PluginSandbox (plugin/)
- CostCalculator, SaaSCostTracker
- AlertDeduplication, AlertCorrelationService (内存窗口)
- EventHandler
- TestSelector 系列
- DiagnosticKnowledgeBase (模式缓存)
- GitOpsService (文件内容缓存)
- CloudCostCollector (适配器注册)
- NotificationService
- Monitoring 系列
- DispatchAnalytics
- EnvironmentRepository (inMemory fallback)
- BackupRepository, BackupPlanRepository, RecoveryRepository (已有 DB 但用 Map 缓存)
- Health, Metrics
- CostCalculator
- CloudCostCollector
- AlertRuleEngine
- TestDependencyAnalyzer, TestFailurePredictor
- TestSelectorService
- K8sWatchClient
- ReplicationLagMonitor
- ReadTrafficManager
- DatabaseFailoverHandler

## 6. 验证策略

### 6.1 自动化验证

```bash
# 验证无 Map() 残留 (排除保留列表)
grep -rl "new Map()" orion-platform-service/src/services --include="*.ts" | \
  grep -v -E "(Health|Metrics|SSE|K8sWatch|ReplicationLag|ReadTraffic|PluginSandbox|CostCalculator|SaaSCost|AlertDeduplication|EventHandler|TestSelector|DiagnosticKnowledge|GitOps|CloudCost|Notification|Monitoring|DispatchAnalytics|EnvironmentRepository|BackupRepository)"
```

### 6.2 测试验证

运行后端测试套件确保所有迁移服务正常工作。

## 7. 成功标准

- [ ] 20 个服务全部迁移到 Repository 模式
- [ ] 每个服务有对应的数据库迁移 SQL
- [ ] 保留内存的服务添加注释说明原因
- [ ] 所有测试通过
- [ ] 无 Map() 残留 (排除保留列表)
