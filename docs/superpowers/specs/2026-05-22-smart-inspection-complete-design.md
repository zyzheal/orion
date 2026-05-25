# 智能巡检（Smart Inspection）完整设计

> **文档类型**: 功能设计 + 页面交互设计
> **创建日期**: 2026-05-22
> **关联计划**: `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.5
> **状态**: 待评审

---

## 一、业务闭环设计

### 1.1 完整流程：计划 → 调度 → 执行 → 报告 → 整改

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  巡检计划    │────▶│  定时调度    │────▶│  执行引擎    │────▶│  结果报告    │────▶│  整改跟踪    │
│  (Plan)     │     │  (Scheduler) │     │  (Executor) │     │  (Report)   │     │  (Action)   │
│             │     │             │     │             │     │             │     │             │
│ • 定义目标   │     │ • Cron 解析 │     │ • 采集数据   │     │ • 统计汇总   │     │ • 自动修复   │
│ • 配置巡检项 │     │ • 定时触发   │     │ • 阈值判断   │     │ • 趋势分析   │     │ • 手动分派   │
│ • 设置周期   │     │ • 手动触发   │     │ • 超时/重试  │     │ • 通知推送   │     │ • 验证关闭   │
│ • 指定负责人 │     │ • 并发控制   │     │ • 失败降级   │     │ • 整改建议   │     │ • 升级策略   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
   inspection_plans    CronScheduler    InspectionEngine   inspection_runs     inspection_actions
                                             │              inspection_results
                                             ▼
                                    ┌─────────────────┐
                                    │ 外部数据源       │
                                    │ • Prometheus    │
                                    │ • Kubernetes    │
                                    │ • PostgreSQL    │
                                    │ • 自定义脚本     │
                                    └─────────────────┘
```

**各阶段职责**：

| 阶段 | 做什么 | 谁做 | 产出 |
|------|--------|------|------|
| **计划** | 用户定义巡检目标、巡检项集合、调度规则 | 运维工程师/平台管理员 | `inspection_plans` 记录 |
| **调度** | 解析 cron 表达式，到时间触发执行 | `CronSchedulerService`（已有） | `inspection_runs` 记录（status=running） |
| **执行** | 串行/并行执行每个巡检项，采集数据并判断 | `InspectionEngine`（新建） | `inspection_results` 记录 |
| **报告** | 聚合结果，生成统计摘要，触发通知 | `InspectionService` | Run 状态更新 + 通知事件 |
| **整改** | 对 failed 结果创建整改任务，跟踪闭环 | 用户手动 + 自动修复 | `inspection_actions` 记录 |

### 1.2 状态机设计

#### InspectionPlan 状态
```
enabled=true ──执行──▶ 产生 Runs
enabled=false ──不执行──▶ 跳过
```

#### InspectionRun 状态机
```
scheduled ──▶ running ──▶ completed (全部通过/警告)
                          ──▶ failed_with_warnings (有警告但无失败)
                          ──▶ failed (有关键失败)
                ──▶ cancelled (用户取消)
                ──▶ timeout (执行超时)
```

#### InspectionResult 状态
```
result: pass | fail | warning
severity: info | warning | critical
```

#### InspectionAction 状态机
```
pending ──▶ in_progress ──▶ completed
    │                           │
    └──▶ rejected ◀─────────────┘ (验证不通过)
    └──▶ escalated (升级给更高级别)
```

---

## 二、执行引擎设计

### 2.1 调度方式

**复用已有 `CronSchedulerService`**（位于 `orion-platform-service/src/services/scheduler/`），通过新增回调实现巡检触发。

```typescript
// 调度器复用方案
// 每个 inspection_plan 创建一个 cron job：
//   id: `inspection-${planId}`
//   schedule: plan.schedule (cron 表达式)
//   task: () => InspectionEngine.executePlan(planId)
```

**Cron 表达式支持**：
| 格式 | 示例 | 说明 |
|------|------|------|
| 标准 6 字段 | `0 */30 * * * *` | 每 30 分钟 |
| 简写 | `@hourly`, `@daily`, `@weekly` | 快捷表达式 |
| 一次性 | `0` 或空 | 不自动调度，仅手动触发 |

### 2.2 执行器架构

```typescript
// InspectionEngine 核心结构
class InspectionEngine {
  // 执行一个巡检计划
  async executePlan(planId: string, triggerType: 'scheduled' | 'manual'): Promise<InspectionRun>

  // 执行单个巡检项
  async executeItem(item: InspectionItem, targets: string[]): Promise<InspectionResult[]>

  // 执行模式
  executionMode: 'serial' | 'parallel'  // 串行/并行，默认并行

  // 超时控制
  itemTimeout: number    // 单个巡检项超时时间（默认 60s）
  runTimeout: number     // 整个 Run 超时时间（默认 300s）

  // 重试策略
  maxRetries: number     // 最大重试次数（默认 2）
  retryDelay: number     // 重试间隔（默认 5s）
}
```

**执行流程**：
```
executePlan(planId)
  ├── 1. 创建 InspectionRun (status=running)
  ├── 2. 加载 inspection_items
  ├── 3. 解析 target_ids → 实际资源列表
  ├── 4. 按 executionMode 执行：
  │     ├── parallel: Promise.allSettled(items.map(executeItem))
  │     └── serial:   for...of (逐个执行，失败可 continue)
  ├── 5. 每个 item 内部：
  │     ├── 5a. 调用对应的 Collector 采集数据
  │     ├── 5b. 与阈值比较判断 pass/fail/warning
  │     ├── 5c. 写入 inspection_results
  │     └── 5d. 失败时重试（maxRetries 次）
  ├── 6. 汇总统计 → 更新 inspection_runs (passed_items/failed_items/warning_items)
  ├── 7. 触发通知（有 critical 结果时）
  └── 8. 更新 Run 状态 (completed/failed)
```

### 2.3 超时/重试/失败处理

| 场景 | 处理方式 | 说明 |
|------|----------|------|
| 单个巡检项超时 | 标记 `result=fail, severity=critical`，写入 error_message | 不阻塞其他项 |
| 单个巡检项失败 | 按 retry 策略重试，全部失败后记录结果 | 重试间隔指数退避 |
| 全部项执行超时 | Run 标记 `status=timeout`，已执行的项保留 | 通过 runTimeout 控制 |
| 外部依赖不可达 | Collector 返回 fail + 建议检查依赖 | 不抛异常，优雅降级 |
| Run 执行异常 | catch 全部异常，更新 error_message | 保证 Run 记录有终态 |

---

## 三、巡检项类型设计

### 3.1 巡检项统一模型

每个巡检项在 `inspection_plans.inspection_items` JSONB 中的结构：

```typescript
interface InspectionItem {
  id: string;              // 唯一标识
  type: 'resource' | 'service' | 'database' | 'security';
  name: string;            // 巡检项名称
  collector: string;       // 采集器类型
  target: {                // 目标定义
    resourceType: string;  // 具体资源类型
    selector?: string;     // 选择器（如 label selector）
  };
  threshold: {             // 阈值判断
    metric: string;        // 指标名
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'range';
    warningValue: number;  // 警告阈值
    criticalValue: number; // 严重阈值
    unit: string;          // 单位
  };
  schedule?: {             // 覆盖全局调度
    cron?: string;
    timeout?: number;
  };
  enabled: boolean;
  retryConfig?: {          // 覆盖全局重试
    maxRetries: number;
    retryDelay: number;
  };
}
```

### 3.2 四类巡检项详细设计

#### 3.2.1 资源类（Resource）

| 巡检项 | 采集方式 | 阈值示例 | 严重级别 |
|--------|----------|----------|----------|
| CPU 使用率 | Prometheus `node_cpu_seconds_total` | warning: 70%, critical: 90% | warning/critical |
| 内存使用率 | Prometheus `node_memory_MemTotal_bytes` | warning: 75%, critical: 95% | warning/critical |
| 磁盘使用率 | Prometheus `node_filesystem_avail_bytes` | warning: 80%, critical: 95% | warning/critical |
| 网络 I/O | Prometheus `node_network_receive_bytes_total` | warning: 800Mbps, critical: 950Mbps | warning/critical |
| 文件描述符 | Prometheus `process_open_fds` | warning: 80%, critical: 95% | warning/critical |

**采集器**: `PrometheusCollector`（复用已有的 `MetricsService` 和 Prometheus 集成）

#### 3.2.2 服务类（Service）

| 巡检项 | 采集方式 | 阈值示例 | 严重级别 |
|--------|----------|----------|----------|
| Pod 健康状态 | K8s API `GET /api/v1/pods`，检查 status.phase | 非 Running = fail | critical |
| Service 端点 | K8s API `GET /api/v1/endpoints`，检查 subsets | 无端点 = fail | critical |
| Deployment 副本 | K8s API `GET /apis/apps/v1/deployments`，比较 readyReplicas | ready < desired = fail | warning/critical |
| Container 重启次数 | K8s API，检查 restartCount | > 5 = warning, > 20 = critical | warning/critical |
| Ingress 健康 | K8s API，检查 ingress status.loadBalancer | 无 IP = fail | critical |

**采集器**: `KubernetesCollector`（复用已有的 K8s client 集成，参考 `k8s-provisioner-service.ts`）

#### 3.2.3 数据库类（Database）

| 巡检项 | 采集方式 | 阈值示例 | 严重级别 |
|--------|----------|----------|----------|
| 慢 SQL 数量 | PostgreSQL `pg_stat_statements` | > 10/h = warning, > 50/h = critical | warning/critical |
| 连接数使用率 | PostgreSQL `pg_stat_activity` | > 70% = warning, > 90% = critical | warning/critical |
| 复制延迟 | PostgreSQL `pg_stat_replication` | > 10s = warning, > 60s = critical | warning/critical |
| 表空间使用率 | PostgreSQL `pg_tablespace` | > 80% = warning, > 95% = critical | warning/critical |
| 死锁数量 | PostgreSQL `pg_stat_database` | > 0 = warning | warning |

**采集器**: `DatabaseCollector`（复用已有的 `DatabaseService` 和 PostgreSQL 连接池）

#### 3.2.4 安全类（Security）

| 巡检项 | 采集方式 | 阈值示例 | 严重级别 |
|--------|----------|----------|----------|
| TLS 证书过期 | K8s Secret 或文件系统读取 | < 30 天 = warning, < 7 天 = critical | warning/critical |
| 密码策略合规 | 调用 Auth 服务 API | 不符合策略 = fail | critical |
| 已知漏洞扫描 | 调用 Trivy/Grype API 或数据库 | HIGH+ = warning, CRITICAL = critical | warning/critical |
| RBAC 过度授权 | K8s API 扫描 ClusterRoleBinding | cluster-admin 绑定 = critical | critical |
| 敏感配置暴露 | K8s ConfigMap 扫描 | 含密码/密钥明文 = critical | critical |

**采集器**: `SecurityCollector`（新建，组合 K8s API + Auth 服务 + 漏洞扫描）

### 3.3 巡检项模板库

提供预定义模板，用户创建计划时可直接选用：

```typescript
const INSPECTION_TEMPLATES = {
  // 基础巡检（所有租户默认启用）
  'basic-cluster-health': {
    name: '集群基础健康检查',
    items: [
      { type: 'resource', collector: 'PrometheusCollector', metric: 'cpu_usage', ... },
      { type: 'resource', collector: 'PrometheusCollector', metric: 'memory_usage', ... },
      { type: 'service', collector: 'KubernetesCollector', metric: 'pod_health', ... },
    ],
  },
  // 数据库专项
  'database-health': { ... },
  // 安全合规
  'security-compliance': { ... },
  // 发布前检查
  'pre-deployment-check': { ... },
};
```

---

## 四、外部依赖分析

### 4.1 已有依赖（可复用）

| 依赖 | 位置 | 状态 | 复用方式 |
|------|------|------|----------|
| Prometheus 指标采集 | `services/metrics/` | ✅ 已有 | 通过 `MetricsService` 查询 Prometheus 数据 |
| Kubernetes API | `services/k8s-provisioner-service.ts` | ✅ 已有 | 复用 K8s client 查询 Pod/Deployment/Service |
| PostgreSQL 连接 | `services/database.ts` | ✅ 已有 | 复用 DatabasePool 执行 SQL 采集 |
| Cron 调度器 | `services/scheduler/CronSchedulerService` | ✅ 已有 | 复用 CronSchedulerService 注册巡检任务 |
| 通知服务 | `services/notification/NotificationService` | ✅ 已有 | 通过 NotificationService 发送巡检结果通知 |
| 告警服务 | `services/alert/` | ✅ 已有 | 关键巡检失败时创建告警 |
| 租户隔离 | RLS 策略 | ✅ DDL 已有 | 所有查询自动通过 RLS 隔离 |

### 4.2 需要新建

| 依赖 | 说明 | 优先级 |
|------|------|--------|
| `InspectionRepository` | 4 张表的 Repository 层 | P0 |
| `InspectionService` | 巡检业务逻辑层 | P0 |
| `InspectionEngine` | 巡检执行引擎 | P0 |
| `InspectionCollector` | 各类型数据采集器 | P0 |
| `inspection-routes.ts` | API 路由 | P0 |
| `InspectionController` | HTTP 控制器 | P0 |
| 前端 API 客户端 | `api/inspection.ts` | P0 |
| 前端页面 | 5 个页面组件 | P0 |

---

## 五、权限模型

### 5.1 角色与权限矩阵

基于已有 RBAC 系统（`requirePermission` 中间件），定义巡检资源权限：

| 操作 | 资源 | 动作 | 可执行角色 | 说明 |
|------|------|------|-----------|------|
| 创建巡检计划 | `inspection` | `write` | admin, ops_engineer | 定义巡检目标和巡检项 |
| 编辑巡检计划 | `inspection` | `write` | admin, ops_engineer, plan_owner | 修改已有计划 |
| 删除巡检计划 | `inspection` | `delete` | admin, ops_engineer, plan_owner | 删除计划及关联历史 |
| 启用/禁用计划 | `inspection` | `write` | admin, ops_engineer | 切换计划状态 |
| 手动触发执行 | `inspection` | `execute` | admin, ops_engineer, viewer | 立即执行一次 |
| 查看执行记录 | `inspection` | `read` | admin, ops_engineer, viewer, auditor | 查看 Runs 列表和详情 |
| 查看巡检结果 | `inspection` | `read` | admin, ops_engineer, viewer, auditor | 查看 Results 详情 |
| 创建整改任务 | `inspection_action` | `write` | admin, ops_engineer | 对失败项发起整改 |
| 执行整改 | `inspection_action` | `write` | 被分派人 + admin | 标记整改进度 |
| 导出巡检报告 | `inspection` | `read` | admin, ops_engineer, viewer | 导出 PDF/Excel |

### 5.2 权限实现

```typescript
// 路由层权限控制示例
app.post('/plans', {
  onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
}, handler);

app.post('/plans/:id/trigger', {
  onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'execute' })],
}, handler);

// Repository 层通过 RLS 自动隔离
// 所有 SQL 查询无需手动追加 tenant_id 条件
```

---

## 六、失败告警与通知

### 6.1 通知触发条件

| 条件 | 通知渠道 | 通知内容 |
|------|----------|----------|
| Run 中有 critical 结果 | 短信 + 邮件 + 企微/钉钉 | 巡检失败摘要 + 链接 |
| Run 中有 warning 结果 | 邮件 + 企微/钉钉 | 巡检警告摘要 |
| Run 执行失败（超时/异常） | 邮件 + 企微/钉钉 | 执行失败原因 |
| 连续 N 次 Run 失败 | 升级通知（短信 + 电话） | 连续失败告警 |

### 6.2 升级策略

```
第 1 次失败    → 通知计划创建者 + 指定负责人
连续 2 次失败  → 通知部门负责人
连续 3 次失败  → 通知 VP/CTO + 自动创建工单
```

### 6.3 实现方式

```typescript
// InspectionService 中的通知逻辑
async notifyRunCompletion(run: InspectionRun, results: InspectionResult[]): Promise<void> {
  const criticalCount = results.filter(r => r.severity === 'critical').length;
  const warningCount = results.filter(r => r.severity === 'warning').length;

  if (criticalCount > 0) {
    // 调用 NotificationService 发送通知
    await this.notificationService.send({
      tenant_id: run.tenant_id,
      user_id: plan.created_by,
      type: 'inspection_critical',
      title: `巡检 "${plan.name}" 发现 ${criticalCount} 个严重问题`,
      message: `...摘要...`,
      channel: 'email',
    });
    // 同时创建告警
    await this.alertService.createAlert({ ... });
  }

  // 检查连续失败次数，触发升级
  const consecutiveFailures = await this.getConsecutiveFailures(run.plan_id);
  if (consecutiveFailures >= 3) {
    await this.escalate(plan, consecutiveFailures);
  }
}
```

---

## 七、API 设计

### 7.1 后端路由设计

**文件**: `orion-platform-service/src/api/inspection-routes.ts`

**Prefix**: `/api/v1/inspection`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| **巡检计划** |
| POST | `/plans` | `inspection:write` | 创建巡检计划 |
| GET | `/plans` | `inspection:read` | 列出巡检计划 |
| GET | `/plans/:id` | `inspection:read` | 获取计划详情 |
| PUT | `/plans/:id` | `inspection:write` | 更新巡检计划 |
| DELETE | `/plans/:id` | `inspection:delete` | 删除巡检计划 |
| PUT | `/plans/:id/toggle` | `inspection:write` | 启用/禁用计划 |
| POST | `/plans/:id/trigger` | `inspection:execute` | 手动触发执行 |
| **巡检执行** |
| GET | `/runs` | `inspection:read` | 列出执行记录 |
| GET | `/runs/:id` | `inspection:read` | 获取执行详情 |
| POST | `/runs/:id/cancel` | `inspection:execute` | 取消执行中 Run |
| **巡检结果** |
| GET | `/runs/:id/results` | `inspection:read` | 获取某次 Run 的结果列表 |
| GET | `/results/:id` | `inspection:read` | 获取单条结果详情 |
| POST | `/results/:id/action` | `inspection_action:write` | 对结果创建整改任务 |
| **整改跟踪** |
| GET | `/actions` | `inspection:read` | 列出整改任务 |
| GET | `/actions/:id` | `inspection:read` | 获取整改详情 |
| PUT | `/actions/:id` | `inspection_action:write` | 更新整改状态 |
| POST | `/actions/:id/escalate` | `inspection_action:write` | 升级整改任务 |
| **统计与模板** |
| GET | `/stats/overview` | `inspection:read` | 巡检概览统计 |
| GET | `/templates` | `inspection:read` | 获取巡检模板列表 |
| POST | `/templates/:id/apply` | `inspection:write` | 应用模板创建计划 |

### 7.2 Controller → Service → Repository 分层

```
inspection-routes.ts          (路由层 - HTTP 端点)
    │
    ▼
InspectionController.ts       (控制器层 - 请求/响应处理)
    │
    ▼
InspectionService.ts          (服务层 - 业务逻辑)
    ├── InspectionEngine.ts   (执行引擎 - 调度/执行/重试)
    ├── InspectionCollector   (采集器 - 数据收集)
    ├── NotificationService   (通知 - 已有)
    └── AlertService          (告警 - 已有)
    │
    ▼
InspectionRepository.ts       (仓储层 - 数据库操作)
```

### 7.3 前端 API 客户端设计

**文件**: `orion-frontend/src/api/inspection.ts`

```typescript
import { api } from './client';

// ========== 类型定义 ==========

export interface InspectionPlan {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  targetType: 'cluster' | 'namespace' | 'service' | 'host' | 'database';
  targetIds: string[];
  schedule: string;              // cron 表达式
  inspectionItems: InspectionItem[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionItem {
  id: string;
  type: 'resource' | 'service' | 'database' | 'security';
  name: string;
  collector: string;
  target: { resourceType: string; selector?: string };
  threshold: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | 'range';
    warningValue: number;
    criticalValue: number;
    unit: string;
  };
  enabled: boolean;
}

export interface InspectionRun {
  id: string;
  tenantId: string;
  planId: string;
  planName?: string;
  triggerType: 'scheduled' | 'manual';
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  totalItems: number;
  passedItems: number;
  failedItems: number;
  warningItems: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface InspectionResult {
  id: string;
  runId: string;
  itemName: string;
  targetId?: string;
  result: 'pass' | 'fail' | 'warning';
  actualValue?: string;
  expectedValue?: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown>;
  recommendation?: string;
  recordedAt: string;
}

export interface InspectionAction {
  id: string;
  resultId?: string;
  actionType: 'auto_fix' | 'manual_fix' | 'ignore' | 'escalate';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  assignedTo?: string;
  description?: string;
  completedAt?: string;
  createdAt: string;
}

// ========== API 函数 ==========

// --- 巡检计划 ---

export function getInspectionPlans(params?: {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  targetType?: string;
  keyword?: string;
}) {
  return api.get('/v1/inspection/plans', { params });
}

export function getInspectionPlan(id: string) {
  return api.get(`/v1/inspection/plans/${id}`);
}

export function createInspectionPlan(data: Omit<InspectionPlan, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) {
  return api.post('/v1/inspection/plans', data);
}

export function updateInspectionPlan(id: string, data: Partial<InspectionPlan>) {
  return api.put(`/v1/inspection/plans/${id}`, data);
}

export function deleteInspectionPlan(id: string) {
  return api.delete(`/v1/inspection/plans/${id}`);
}

export function toggleInspectionPlan(id: string, enabled: boolean) {
  return api.put(`/v1/inspection/plans/${id}/toggle`, { enabled });
}

export function triggerInspection(id: string) {
  return api.post(`/v1/inspection/plans/${id}/trigger`);
}

// --- 巡检执行 ---

export function getInspectionRuns(params?: {
  page?: number;
  pageSize?: number;
  planId?: string;
  status?: string;
  triggerType?: string;
}) {
  return api.get('/v1/inspection/runs', { params });
}

export function getInspectionRun(id: string) {
  return api.get(`/v1/inspection/runs/${id}`);
}

export function cancelInspectionRun(id: string) {
  return api.post(`/v1/inspection/runs/${id}/cancel`);
}

// --- 巡检结果 ---

export function getInspectionResults(runId: string, params?: {
  page?: number;
  pageSize?: number;
  result?: string;
  severity?: string;
}) {
  return api.get(`/v1/inspection/runs/${runId}/results`, { params });
}

export function getInspectionResult(id: string) {
  return api.get(`/v1/inspection/results/${id}`);
}

export function createActionForResult(resultId: string, data: {
  actionType: string;
  assignedTo?: string;
  description?: string;
}) {
  return api.post(`/v1/inspection/results/${resultId}/action`, data);
}

// --- 整改跟踪 ---

export function getInspectionActions(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  actionType?: string;
  assignedTo?: string;
}) {
  return api.get('/v1/inspection/actions', { params });
}

export function getInspectionAction(id: string) {
  return api.get(`/v1/inspection/actions/${id}`);
}

export function updateInspectionAction(id: string, data: {
  status: string;
  description?: string;
}) {
  return api.put(`/v1/inspection/actions/${id}`, data);
}

export function escalateInspectionAction(id: string) {
  return api.post(`/v1/inspection/actions/${id}/escalate`);
}

// --- 统计与模板 ---

export function getInspectionStats() {
  return api.get('/v1/inspection/stats/overview');
}

export function getInspectionTemplates() {
  return api.get('/v1/inspection/templates');
}

export function applyInspectionTemplate(templateId: string, overrides: Record<string, unknown>) {
  return api.post(`/v1/inspection/templates/${templateId}/apply`, overrides);
}
```

---

## 八、页面交互设计

### 8.1 页面清单与路由

| 页面 | 路由 | 权限 | 说明 |
|------|------|------|------|
| 巡检计划列表 | `/inspection/plans` | `inspection:read` | 计划管理入口 |
| 创建/编辑巡检计划 | `/inspection/plans/new`, `/inspection/plans/:id/edit` | `inspection:write` | 表单页面 |
| 巡检执行记录 | `/inspection/runs` | `inspection:read` | Run 历史 |
| 巡检结果详情 | `/inspection/results/:runId` | `inspection:read` | 单次 Run 详情 |
| 整改跟踪 | `/inspection/actions` | `inspection:read` | 整改任务管理 |

### 8.2 路由注册

**文件**: `orion-frontend/src/router/routes.tsx`

```typescript
// Inspection 模块路由
{
  path: '/inspection',
  element: React.lazy(() => import('@/pages/inspection/InspectionLayout')),
  protected: true,
  children: [
    {
      path: '/inspection/plans',
      element: React.lazy(() => import('@/pages/inspection/PlanList')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'read' },
    },
    {
      path: '/inspection/plans/new',
      element: React.lazy(() => import('@/pages/inspection/PlanForm')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'write' },
    },
    {
      path: '/inspection/plans/:id/edit',
      element: React.lazy(() => import('@/pages/inspection/PlanForm')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'write' },
    },
    {
      path: '/inspection/runs',
      element: React.lazy(() => import('@/pages/inspection/RunList')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'read' },
    },
    {
      path: '/inspection/results/:runId',
      element: React.lazy(() => import('@/pages/inspection/ResultDetail')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'read' },
    },
    {
      path: '/inspection/actions',
      element: React.lazy(() => import('@/pages/inspection/ActionList')),
      protected: true,
      requiredPermission: { resource: 'inspection', action: 'read' },
    },
  ],
},
```

### 8.3 页面 1：巡检计划列表（PlanList）

```tsx
/**
 * 巡检计划列表页 /inspection/plans
 * - Summary cards：计划总数、已启用、本月执行次数、发现告警数
 * - 搜索过滤：关键词、目标类型、启用状态
 * - 操作：新建、刷新、批量启用/禁用
 * - 列表：名称、目标类型、调度周期、巡检项数、状态、最后执行时间、操作
 * - 操作列：执行、编辑、切换启用、删除
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Table, Modal, message, Empty, Spin } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PoweroffOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getInspectionPlans,
  toggleInspectionPlan,
  deleteInspectionPlan,
  triggerInspection,
  type InspectionPlan,
} from '@/api/inspection';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const targetTypeMap: Record<string, { color: string; label: string }> = {
  cluster: { color: colors.primary[500], label: '集群' },
  namespace: { color: colors.info[500], label: '命名空间' },
  service: { color: colors.purple[500], label: '服务' },
  host: { color: colors.warning[500], label: '主机' },
  database: { color: colors.success[500], label: '数据库' },
};

export default function PlanList() {
  const [plans, setPlans] = useState<InspectionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await getInspectionPlans({
        page,
        pageSize,
        keyword: keyword || undefined,
        targetType: filterType !== 'all' ? filterType : undefined,
        enabled: filterEnabled !== 'all' ? filterEnabled === 'true' : undefined,
      });
      setPlans(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      message.error('加载巡检计划失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, [page, keyword, filterType, filterEnabled]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleInspectionPlan(id, !enabled);
      message.success(enabled ? '已禁用' : '已启用');
      fetchPlans();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后将无法恢复该巡检计划及其关联的执行历史',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteInspectionPlan(id);
          message.success('已删除');
          fetchPlans();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleTrigger = async (id: string) => {
    try {
      await triggerInspection(id);
      message.success('已触发执行');
    } catch {
      message.error('触发失败');
    }
  };

  const columns = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: InspectionPlan) => (
        <Space>
          <Text strong style={{ color: colors.primary[500], cursor: 'pointer' }}>
            {text}
          </Text>
          {!record.enabled && <Tag color="default">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 120,
      render: (type: string) => {
        const cfg = targetTypeMap[type] || { color: colors.neutral[500], label: type };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '调度周期',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 160,
      render: (cron: string) => <Text code>{cron}</Text>,
    },
    {
      title: '巡检项',
      dataIndex: 'inspectionItems',
      key: 'inspectionItems',
      width: 100,
      render: (items: any[]) => `${items?.length || 0} 项`,
    },
    {
      title: '最后执行',
      key: 'lastRun',
      width: 180,
      render: (_: unknown, record: InspectionPlan) => {
        // 实际应从关联 Run 获取
        return <Text type="secondary">--</Text>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: InspectionPlan) => (
        <Space size={spacing.sm}>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleTrigger(record.id)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/inspection/plans/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={record.enabled ? <PoweroffOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleToggle(record.id, record.enabled)}
          >
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        巡检计划
      </Title>
      <Typography.Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        管理和配置定时巡检任务，确保系统持续健康运行
      </Typography.Text>

      {/* 统计卡片（略，使用 MetricCard 组件） */}

      {/* 操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/inspection/plans/new')}
          >
            新建巡检计划
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchPlans} loading={loading}>
            刷新
          </Button>
        </Space>
        <Space>
          {/* 搜索框 */}
          {/* 目标类型筛选 */}
          {/* 启用状态筛选 */}
        </Space>
      </div>

      {/* 列表 */}
      <Table
        columns={columns}
        dataSource={plans}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
        }}
        locale={{
          emptyText: (
            <Empty
              description="暂无巡检计划"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => navigate('/inspection/plans/new')}>
                创建第一个巡检计划
              </Button>
            </Empty>
          ),
        }}
      />
    </div>
  );
}
```

### 8.4 页面 2：创建/编辑巡检计划（PlanForm）

```tsx
/**
 * 巡检计划创建/编辑页 /inspection/plans/new, /inspection/plans/:id/edit
 * - 表单字段：名称、描述、目标类型、目标选择、调度周期、巡检项配置、负责人
 * - 校验规则：名称必填、目标非空、cron 格式校验
 * - 提交反馈：loading + success/error
 * - 支持从模板创建
 */
import React, { useState, useEffect } from 'react';
import {
  Form, Input, Select, Button, Space, Card, Switch,
  Divider, message, Modal, Typography, Tag, Empty,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { createInspectionPlan, updateInspectionPlan, getInspectionPlan, getInspectionTemplates } from '@/api/inspection';
import { useNavigate, useParams } from 'react-router-dom';
import cronstrue from 'cronstrue';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function PlanForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cronDescription, setCronDescription] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);

  // 加载编辑数据
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getInspectionPlan(id!)
        .then(res => {
          form.setFieldsValue(res.data);
        })
        .catch(() => message.error('加载计划失败'))
        .finally(() => setLoading(false));
    }
    getInspectionTemplates().then(res => setTemplates(res.data.data || [])).catch(() => {});
  }, [id]);

  // Cron 表达式翻译
  const handleCronChange = (value: string) => {
    try {
      setCronDescription(cronstrue.toString(value, { locale: 'zh_CN' }));
    } catch {
      setCronDescription('');
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateInspectionPlan(id!, values);
        message.success('巡检计划已更新');
      } else {
        await createInspectionPlan(values);
        message.success('巡检计划已创建');
      }
      navigate('/inspection/plans');
    } catch (err: any) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    Modal.confirm({
      title: '应用模板',
      content: '应用模板将覆盖当前巡检项配置，是否继续？',
      onOk: async () => {
        try {
          const res = await applyInspectionTemplate(templateId, {});
          form.setFieldsValue({
            inspectionItems: res.data.inspectionItems,
            targetType: res.data.targetType,
          });
          message.success('模板已应用');
        } catch {
          message.error('应用模板失败');
        }
      },
    });
  };

  if (loading) return <Spin />;

  return (
    <div style={{ padding: spacing.lg, maxWidth: 700, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        {isEdit ? '编辑巡检计划' : '新建巡检计划'}
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        {isEdit ? '修改巡检计划的配置信息' : '配置一个新的定时巡检任务'}
      </Text>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
      >
        {/* 基本信息 */}
        <Card title="基本信息" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
          <Form.Item
            name="name"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
          >
            <Input placeholder="例如：生产集群每日健康检查" maxLength={200} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="描述此巡检计划的目的和范围" maxLength={2000} />
          </Form.Item>

          <Form.Item
            name="targetType"
            label="目标类型"
            rules={[{ required: true, message: '请选择目标类型' }]}
          >
            <Select options={[
              { value: 'cluster', label: '集群' },
              { value: 'namespace', label: '命名空间' },
              { value: 'service', label: '服务' },
              { value: 'host', label: '主机' },
              { value: 'database', label: '数据库' },
            ]} />
          </Form.Item>

          <Form.Item
            name="targetIds"
            label="目标对象"
            rules={[{ required: true, message: '请选择目标对象' }]}
          >
            <Select mode="multiple" placeholder="选择目标资源" />
          </Form.Item>
        </Card>

        {/* 调度配置 */}
        <Card title="调度配置" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
          <Form.Item
            name="schedule"
            label="Cron 表达式"
            rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            extra={cronDescription && <Text type="success">{cronDescription}</Text>}
          >
            <Input
              placeholder="0 0 * * * *"
              onChange={e => handleCronChange(e.target.value)}
              addonAfter={
                <Select defaultValue="custom" style={{ width: 100 }}>
                  <Select.Option value="@hourly">每小时</Select.Option>
                  <Select.Option value="@daily">每天</Select.Option>
                  <Select.Option value="@weekly">每周</Select.Option>
                  <Select.Option value="custom">自定义</Select.Option>
                </Select>
              }
            />
          </Form.Item>

          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Card>

        {/* 巡检项配置 */}
        <Card
          title="巡检项配置"
          extra={
            <Space>
              <Select
                placeholder="从模板添加"
                style={{ width: 160 }}
                onChange={handleApplyTemplate}
                options={templates.map(t => ({ value: t.id, label: t.name }))}
              />
              <Button type="dashed" icon={<PlusOutlined />}>
                手动添加
              </Button>
            </Space>
          }
          style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}
        >
          <Form.Item name="inspectionItems" noStyle>
            {/* 巡检项列表组件 - 支持添加/删除/编辑单个巡检项 */}
            {/* 每个巡检项包含：类型、采集器、阈值（warning/critical）、单位 */}
          </Form.Item>

          {/* 空状态 */}
          <Form.Item shouldUpdate>
            {() => {
              const items = form.getFieldValue('inspectionItems');
              if (!items?.length) {
                return (
                  <Empty
                    description="暂无巡检项，请从模板添加或手动配置"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                );
              }
              return null;
            }}
          </Form.Item>
        </Card>

        {/* 操作按钮 */}
        <div style={{ textAlign: 'center', marginTop: spacing.lg }}>
          <Space size={spacing.md}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection/plans')}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={submitting}
              size="large"
            >
              {isEdit ? '保存修改' : '创建计划'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}
```

### 8.5 页面 3：巡检执行记录列表（RunList）

```tsx
/**
 * 巡检执行记录列表页 /inspection/runs
 * - 过滤：计划、状态、触发方式、时间范围
 * - 列表：计划名称、触发方式、状态、巡检项统计、耗时、开始时间、操作
 * - 状态标签颜色：running=blue, completed=green, failed=red, cancelled=gray, timeout=orange
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Space, Button, Select, DatePicker, message } from 'antd';
import {
  EyeOutlined,
  StopOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getInspectionRuns, cancelInspectionRun, type InspectionRun } from '@/api/inspection';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusConfig: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'default', label: '等待中' },
  running: { color: 'processing', label: '执行中' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
  timeout: { color: 'warning', label: '超时' },
};

export default function RunList() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<InspectionRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await getInspectionRuns({
        page: 1,
        pageSize: 20,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setRuns(res.data.data || []);
    } catch {
      message.error('加载执行记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, [filterStatus]);

  const handleCancel = async (id: string) => {
    try {
      await cancelInspectionRun(id);
      message.success('已取消执行');
      fetchRuns();
    } catch {
      message.error('取消失败');
    }
  };

  const columns = [
    {
      title: '计划名称',
      dataIndex: 'planName',
      key: 'planName',
      render: (name: string, record: InspectionRun) => (
        <Text style={{ color: colors.primary[500], cursor: 'pointer' }}>
          {name || '手动触发'}
        </Text>
      ),
    },
    {
      title: '触发方式',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'manual' ? colors.purple[500] : colors.neutral[400]}>
          {type === 'manual' ? '手动' : '定时'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '巡检结果',
      key: 'results',
      width: 180,
      render: (_: unknown, record: InspectionRun) => (
        <Space size={spacing.sm}>
          <Tag color={colors.success[500]}>通过 {record.passedItems}</Tag>
          {record.warningItems > 0 && <Tag color={colors.warning[500]}>警告 {record.warningItems}</Tag>}
          {record.failedItems > 0 && <Tag color={colors.error[500]}>失败 {record.failedItems}</Tag>}
          <Text type="secondary">/ {record.totalItems}</Text>
        </Space>
      ),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_: unknown, record: InspectionRun) => {
        if (record.completedAt) {
          const duration = dayjs(record.completedAt).diff(dayjs(record.startedAt), 'second');
          return `${duration}s`;
        }
        if (record.status === 'running') {
          const duration = dayjs().diff(dayjs(record.startedAt), 'second');
          return `${duration}s (执行中)`;
        }
        return '--';
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: InspectionRun) => (
        <Space size={spacing.sm}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/inspection/results/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'running' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancel(record.id)}
            >
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        巡检执行记录
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        查看历史巡检执行情况和结果统计
      </Text>

      <div style={{ marginBottom: spacing.md }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'running', label: '执行中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRuns} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={runs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
      />
    </div>
  );
}
```

### 8.6 页面 4：巡检结果详情页（ResultDetail）

```tsx
/**
 * 巡检结果详情页 /inspection/results/:runId
 * - Run 概要信息卡片（计划、状态、时间、统计）
 * - 结果列表：巡检项名称、目标、结果、实际值、期望值、严重级别、建议
 * - 过滤：按结果类型、严重级别
 * - 操作：对失败项创建整改任务
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Row, Col, Table, Tag, Space, Button,
  Select, Statistic, Descriptions, Modal, Form, Input, message, Spin,
} from 'antd';
import {
  RadarChartOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  getInspectionRun,
  getInspectionResults,
  createActionForResult,
  type InspectionRun,
  type InspectionResult,
} from '@/api/inspection';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const resultConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pass: { color: colors.success[500], label: '通过', icon: <CheckCircleOutlined /> },
  fail: { color: colors.error[500], label: '失败', icon: <ExclamationCircleOutlined /> },
  warning: { color: colors.warning[500], label: '警告', icon: <WarningOutlined /> },
};

const severityConfig: Record<string, { color: string; label: string }> = {
  info: { color: colors.neutral[400], label: '信息' },
  warning: { color: colors.warning[500], label: '警告' },
  critical: { color: colors.error[500], label: '严重' },
};

export default function ResultDetail() {
  const navigate = useNavigate();
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<InspectionRun | null>(null);
  const [results, setResults] = useState<InspectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterResult, setFilterResult] = useState('all');
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedResult, setSelectedResult] = useState<InspectionResult | null>(null);
  const [actionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    Promise.all([
      getInspectionRun(runId),
      getInspectionResults(runId),
    ])
      .then(([runRes, resRes]) => {
        setRun(runRes.data);
        setResults(resRes.data.data || []);
      })
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleCreateAction = async (values: any) => {
    if (!selectedResult) return;
    setSubmitting(true);
    try {
      await createActionForResult(selectedResult.id, values);
      message.success('整改任务已创建');
      setActionModalVisible(false);
      actionForm.resetFields();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !run) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  const duration = run.completedAt
    ? dayjs(run.completedAt).diff(dayjs(run.startedAt), 'second')
    : dayjs().diff(dayjs(run.startedAt), 'second');

  const columns = [
    {
      title: '巡检项',
      dataIndex: 'itemName',
      key: 'itemName',
    },
    {
      title: '结果',
      key: 'result',
      width: 100,
      render: (_: unknown, record: InspectionResult) => {
        const cfg = resultConfig[record.result];
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (sev: string) => {
        const cfg = severityConfig[sev];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '实际值',
      dataIndex: 'actualValue',
      key: 'actualValue',
      width: 140,
      render: (v: string) => <Text code>{v || '--'}</Text>,
    },
    {
      title: '期望值',
      dataIndex: 'expectedValue',
      key: 'expectedValue',
      width: 140,
      render: (v: string) => <Text code>{v || '--'}</Text>,
    },
    {
      title: '建议',
      dataIndex: 'recommendation',
      key: 'recommendation',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: InspectionResult) => (
        record.result === 'fail' && (
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => { setSelectedResult(record); setActionModalVisible(true); }}
          >
            发起整改
          </Button>
        )
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.md }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection/runs')}>
          返回
        </Button>
      </div>

      <Title level={2} style={{ marginBottom: 8 }}>
        <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        巡检结果详情
      </Title>

      {/* Run 概要 */}
      <Card style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Descriptions column={4} title="执行概要">
          <Descriptions.Item label="状态">
            <Tag color={run.status === 'completed' ? colors.success[500] : colors.error[500]}>
              {run.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="触发方式">{run.triggerType === 'manual' ? '手动' : '定时'}</Descriptions.Item>
          <Descriptions.Item label="耗时">{duration}s</Descriptions.Item>
          <Descriptions.Item label="开始时间">{dayjs(run.startedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        </Descriptions>
        <Row gutter={spacing.lg} style={{ marginTop: spacing.md }}>
          <Col span={6}>
            <Statistic title="总计巡检项" value={run.totalItems} />
          </Col>
          <Col span={6}>
            <Statistic title="通过" value={run.passedItems} valueStyle={{ color: colors.success[500] }} />
          </Col>
          <Col span={6}>
            <Statistic title="警告" value={run.warningItems} valueStyle={{ color: colors.warning[500] }} />
          </Col>
          <Col span={6}>
            <Statistic title="失败" value={run.failedItems} valueStyle={{ color: colors.error[500] }} />
          </Col>
        </Row>
      </Card>

      {/* 结果列表 */}
      <Card
        title="巡检结果列表"
        extra={
          <Space>
            <Select
              style={{ width: 120 }}
              value={filterResult}
              onChange={setFilterResult}
              options={[
                { value: 'all', label: '全部' },
                { value: 'pass', label: '通过' },
                { value: 'fail', label: '失败' },
                { value: 'warning', label: '警告' },
              ]}
            />
            <Button icon={<ReloadOutlined />} size="small">刷新</Button>
          </Space>
        }
        style={{ borderRadius: componentRadius.card }}
      >
        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
        />
      </Card>

      {/* 整改任务创建弹窗 */}
      <Modal
        title="创建整改任务"
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        footer={null}
      >
        <Form form={actionForm} layout="vertical" onFinish={handleCreateAction}>
          <Form.Item name="actionType" label="整改类型" initialValue="manual_fix" rules={[{ required: true }]}>
            <Select options={[
              { value: 'auto_fix', label: '自动修复' },
              { value: 'manual_fix', label: '手动修复' },
              { value: 'ignore', label: '忽略' },
              { value: 'escalate', label: '升级处理' },
            ]} />
          </Form.Item>
          <Form.Item name="assignedTo" label="负责人">
            <Input placeholder="输入负责人用户名" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述整改要求和预期结果" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setActionModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 8.7 页面 5：整改跟踪页（ActionList）

```tsx
/**
 * 整改跟踪页 /inspection/actions
 * - 统计卡片：待处理、处理中、已完成、已拒绝
 * - 过滤：状态、类型、负责人
 * - 列表：关联巡检项、类型、状态、负责人、描述、创建时间、操作
 * - 操作：更新状态、升级
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tag, Space, Button, Select, message, Modal, Form, Input } from 'antd';
import {
  SafetyCertificateOutlined,
  ReloadOutlined,
  EditOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getInspectionActions,
  updateInspectionAction,
  escalateInspectionAction,
  type InspectionAction,
} from '@/api/inspection';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const actionStatusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'default', label: '待处理', icon: <ClockCircleOutlined /> },
  'in-progress': { color: 'processing', label: '处理中', icon: <SyncOutlined spin /> },
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  rejected: { color: 'error', label: '已拒绝', icon: <CloseCircleOutlined /> },
};

const actionTypeMap: Record<string, string> = {
  auto_fix: '自动修复',
  manual_fix: '手动修复',
  ignore: '忽略',
  escalate: '升级处理',
};

export default function ActionList() {
  const [actions, setActions] = useState<InspectionAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchActions = async () => {
    setLoading(true);
    try {
      const res = await getInspectionActions({
        page: 1,
        pageSize: 20,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setActions(res.data.data || []);
    } catch {
      message.error('加载整改任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActions(); }, [filterStatus]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateInspectionAction(id, { status });
      message.success('状态已更新');
      fetchActions();
    } catch {
      message.error('更新失败');
    }
  };

  const handleEscalate = async (id: string) => {
    Modal.confirm({
      title: '确认升级',
      content: '升级后该任务将上报给更高级别负责人处理',
      onOk: async () => {
        try {
          await escalateInspectionAction(id);
          message.success('已升级');
          fetchActions();
        } catch {
          message.error('升级失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 120,
      render: (type: string) => <Tag>{actionTypeMap[type] || type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const cfg = actionStatusConfig[status];
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 120,
      render: (v: string) => v || '--',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: InspectionAction) => (
        <Space size={spacing.sm}>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleStatusUpdate(record.id, 'in-progress')}
            >
              开始处理
            </Button>
          )}
          {record.status === 'in-progress' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusUpdate(record.id, 'completed')}
              >
                完成
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<ArrowUpOutlined />}
                onClick={() => handleEscalate(record.id)}
              >
                升级
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        整改跟踪
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        跟踪和管理巡检发现的问题整改任务
      </Text>

      <div style={{ marginBottom: spacing.md }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '待处理' },
              { value: 'in-progress', label: '处理中' },
              { value: 'completed', label: '已完成' },
              { value: 'rejected', label: '已拒绝' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchActions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={actions}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
      />
    </div>
  );
}
```

---

## 九、后端实现骨架

### 9.1 InspectionRepository

```typescript
// orion-platform-service/src/services/inspection/InspectionRepository.ts
import { DatabasePool, sql } from '../database';

export interface InspectionPlanRecord {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  target_type: string;
  target_ids: string[];
  schedule: string;
  inspection_items: Record<string, unknown>[];
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class InspectionRepository {
  constructor(private pool: DatabasePool) {}

  // Plans
  async createPlan(input: Omit<InspectionPlanRecord, 'id' | 'created_at' | 'updated_at'>): Promise<InspectionPlanRecord> {
    const result = await this.pool.one(sql`
      INSERT INTO inspection_plans (tenant_id, name, description, target_type, target_ids, schedule, inspection_items, enabled, created_by)
      VALUES (${input.tenant_id}, ${input.name}, ${input.description}, ${input.target_type}, ${input.target_ids}, ${input.schedule}, ${JSON.stringify(input.inspection_items)}, ${input.enabled}, ${input.created_by})
      RETURNING *
    `);
    return result as InspectionPlanRecord;
  }

  async findPlanById(id: string): Promise<InspectionPlanRecord | null> {
    return await this.pool.oneOrNone<InspectionPlanRecord>(sql`SELECT * FROM inspection_plans WHERE id = ${id}`);
  }

  async findAllPlans(tenantId: string, options: { enabled?: boolean; targetType?: string; keyword?: string; limit: number; offset: number }): Promise<{ plans: InspectionPlanRecord[]; total: number }> {
    // 使用 sql.tag 构建动态查询
    const conditions: sql.SQLFragment[] = [sql`tenant_id = ${tenantId}`];
    if (options.enabled !== undefined) conditions.push(sql`enabled = ${options.enabled}`);
    if (options.targetType) conditions.push(sql`target_type = ${options.targetType}`);
    if (options.keyword) conditions.push(sql`name ILIKE ${'%' + options.keyword + '%'}`);

    const where = sql.join(conditions, sql` AND `);
    const [plans, [{ count }]] = await Promise.all([
      this.pool.any<InspectionPlanRecord>(sql`SELECT * FROM ${sql`inspection_plans`} WHERE ${where} ORDER BY created_at DESC LIMIT ${options.limit} OFFSET ${options.offset}`),
      this.pool.any<{ count: string }>(sql`SELECT COUNT(*) FROM ${sql`inspection_plans`} WHERE ${where}`),
    ]);
    return { plans, total: parseInt(count, 10) };
  }

  async updatePlan(id: string, input: Partial<InspectionPlanRecord>): Promise<InspectionPlanRecord | null> {
    return await this.pool.oneOrNone<InspectionPlanRecord>(sql`
      UPDATE inspection_plans SET ${sql.assign(input)}, updated_at = now() WHERE id = ${id} RETURNING *
    `);
  }

  async deletePlan(id: string): Promise<boolean> {
    const result = await this.pool.query(sql`DELETE FROM inspection_plans WHERE id = ${id}`);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Runs
  async createRun(input: { tenant_id: string; plan_id: string; trigger_type: string }): Promise<any> {
    return await this.pool.one(sql`
      INSERT INTO inspection_runs (tenant_id, plan_id, trigger_type, status)
      VALUES (${input.tenant_id}, ${input.plan_id}, ${input.trigger_type}, 'running')
      RETURNING *
    `);
  }

  async updateRun(id: string, input: { status: string; completed_at?: Date; error_message?: string; total_items?: number; passed_items?: number; failed_items?: number; warning_items?: number }): Promise<any> {
    return await this.pool.oneOrNone(sql`
      UPDATE inspection_runs SET ${sql.assign(input)} WHERE id = ${id} RETURNING *
    `);
  }

  async findRuns(tenantId: string, options: { planId?: string; status?: string; limit: number; offset: number }): Promise<{ runs: any[]; total: number }> {
    // 类似 findAllPlans 的实现
    return { runs: [], total: 0 };
  }

  // Results
  async createResults(results: Array<{ tenant_id: string; run_id: string; item_name: string; target_id?: string; result: string; actual_value?: string; expected_value?: string; severity: string; details: Record<string, unknown>; recommendation?: string }>): Promise<void> {
    if (results.length === 0) return;
    await this.pool.tx(async (tx) => {
      for (const r of results) {
        await tx.query(sql`
          INSERT INTO inspection_results (tenant_id, run_id, item_name, target_id, result, actual_value, expected_value, severity, details, recommendation)
          VALUES (${r.tenant_id}, ${r.run_id}, ${r.item_name}, ${r.target_id}, ${r.result}, ${r.actual_value}, ${r.expected_value}, ${r.severity}, ${JSON.stringify(r.details)}, ${r.recommendation})
        `);
      }
    });
  }

  async findResultsByRun(runId: string, options: { result?: string; severity?: string; limit: number; offset: number }): Promise<{ results: any[]; total: number }> {
    return { results: [], total: 0 };
  }

  // Actions
  async createAction(input: { tenant_id: string; result_id?: string; action_type: string; assigned_to?: string; description?: string }): Promise<any> {
    return await this.pool.one(sql`
      INSERT INTO inspection_actions (tenant_id, result_id, action_type, assigned_to, description, status)
      VALUES (${input.tenant_id}, ${input.result_id}, ${input.action_type}, ${input.assigned_to}, ${input.description}, 'pending')
      RETURNING *
    `);
  }

  async findActions(tenantId: string, options: { status?: string; actionType?: string; limit: number; offset: number }): Promise<{ actions: any[]; total: number }> {
    return { actions: [], total: 0 };
  }

  async updateAction(id: string, input: { status: string; completed_at?: Date }): Promise<any> {
    return await this.pool.oneOrNone(sql`
      UPDATE inspection_actions SET ${sql.assign(input)} WHERE id = ${id} RETURNING *
    `);
  }
}
```

### 9.2 InspectionService

```typescript
// orion-platform-service/src/services/inspection/InspectionService.ts
import { InspectionRepository, InspectionPlanRecord } from './InspectionRepository';
import { InspectionEngine } from './InspectionEngine';
import { CronSchedulerService } from '../scheduler/CronSchedulerService';
import { NotificationService } from '../notification/NotificationService';

export class InspectionService {
  constructor(
    private repository: InspectionRepository,
    private engine: InspectionEngine,
    private cronScheduler: CronSchedulerService,
    private notificationService: NotificationService,
  ) {}

  // ---- Plans ----
  async createPlan(tenantId: string, input: { name: string; description?: string; targetType: string; targetIds: string[]; schedule: string; inspectionItems: any[]; enabled?: boolean; createdBy: string }) {
    const plan = await this.repository.createPlan({
      tenant_id: tenantId,
      ...input,
      enabled: input.enabled ?? true,
    });

    // 注册到 CronScheduler
    if (plan.enabled && plan.schedule !== '0') {
      await this.cronScheduler.addJob({
        id: `inspection-${plan.id}`,
        name: `Inspection: ${plan.name}`,
        schedule: plan.schedule,
        task: () => this.engine.executePlan(plan.id, 'scheduled'),
      });
    }

    return plan;
  }

  async getPlan(id: string) {
    return this.repository.findPlanById(id);
  }

  async listPlans(tenantId: string, options: { page: number; pageSize: number; enabled?: boolean; targetType?: string; keyword?: string }) {
    return this.repository.findAllPlans(tenantId, {
      ...options,
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize,
    });
  }

  async updatePlan(id: string, input: Partial<any>) {
    return this.repository.updatePlan(id, input);
  }

  async deletePlan(id: string) {
    // 先取消 cron job
    await this.cronScheduler.removeJob(`inspection-${id}`);
    return this.repository.deletePlan(id);
  }

  async togglePlan(id: string, enabled: boolean) {
    const plan = await this.repository.updatePlan(id, { enabled });
    if (!plan) throw new Error('Plan not found');

    if (enabled && plan.schedule !== '0') {
      await this.cronScheduler.addJob({
        id: `inspection-${id}`,
        name: `Inspection: ${plan.name}`,
        schedule: plan.schedule,
        task: () => this.engine.executePlan(id, 'scheduled'),
      });
    } else {
      await this.cronScheduler.removeJob(`inspection-${id}`);
    }
    return plan;
  }

  async triggerPlan(id: string) {
    return this.engine.executePlan(id, 'manual');
  }

  // ---- Runs ----
  async listRuns(tenantId: string, options: { page: number; pageSize: number; planId?: string; status?: string }) {
    return this.repository.findRuns(tenantId, {
      ...options,
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize,
    });
  }

  async getRun(id: string) {
    // 直接查 run 表
    return null;
  }

  async cancelRun(id: string) {
    return this.repository.updateRun(id, { status: 'cancelled', completed_at: new Date() });
  }

  // ---- Results ----
  async listResults(runId: string, options: { page: number; pageSize: number; result?: string; severity?: string }) {
    return this.repository.findResultsByRun(runId, {
      ...options,
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize,
    });
  }

  // ---- Actions ----
  async listActions(tenantId: string, options: { page: number; pageSize: number; status?: string; actionType?: string }) {
    return this.repository.findActions(tenantId, {
      ...options,
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize,
    });
  }

  async createAction(tenantId: string, input: { resultId?: string; actionType: string; assignedTo?: string; description?: string }) {
    return this.repository.createAction({ tenant_id: tenantId, ...input });
  }

  async updateAction(id: string, input: { status: string }) {
    return this.repository.updateAction(id, {
      ...input,
      completed_at: input.status === 'completed' ? new Date() : undefined,
    });
  }
}
```

### 9.3 InspectionController

```typescript
// orion-platform-service/src/api/controllers/InspectionController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { InspectionService } from '../../services/inspection/InspectionService';

export class InspectionController {
  constructor(private service: InspectionService) {}

  private getTenantId(request: FastifyRequest): string {
    return (request.headers['x-tenant-id'] as string) || 'default';
  }

  private getUserId(request: FastifyRequest): string {
    const user = (request as any).user;
    return user?.id || user?.username || 'system';
  }

  // Plans
  async createPlan(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const plan = await this.service.createPlan(this.getTenantId(request), {
      ...body,
      createdBy: this.getUserId(request),
    });
    return reply.code(201).send({ success: true, data: plan });
  }

  async listPlans(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const result = await this.service.listPlans(this.getTenantId(request), {
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
      enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
      targetType: query.targetType,
      keyword: query.keyword,
    });
    return reply.send({ success: true, data: result.plans, total: result.total });
  }

  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const plan = await this.service.getPlan(id);
    if (!plan) return reply.code(404).send({ success: false, error: 'Plan not found' });
    return reply.send({ success: true, data: plan });
  }

  async updatePlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const plan = await this.service.updatePlan(id, request.body as any);
    if (!plan) return reply.code(404).send({ success: false, error: 'Plan not found' });
    return reply.send({ success: true, data: plan });
  }

  async deletePlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const deleted = await this.service.deletePlan(id);
    if (!deleted) return reply.code(404).send({ success: false, error: 'Plan not found' });
    return reply.send({ success: true });
  }

  async togglePlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    const plan = await this.service.togglePlan(id, enabled);
    return reply.send({ success: true, data: plan });
  }

  async triggerPlan(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const run = await this.service.triggerPlan(id);
    return reply.send({ success: true, data: run });
  }

  // Runs
  async listRuns(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const result = await this.service.listRuns(this.getTenantId(request), {
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
      planId: query.planId,
      status: query.status,
    });
    return reply.send({ success: true, data: result.runs, total: result.total });
  }

  async cancelRun(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const run = await this.service.cancelRun(id);
    return reply.send({ success: true, data: run });
  }

  // Results
  async listResults(request: FastifyRequest, reply: FastifyReply) {
    const { runId } = request.params as { runId: string };
    const query = request.query as any;
    const result = await this.service.listResults(runId, {
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
      result: query.result,
      severity: query.severity,
    });
    return reply.send({ success: true, data: result.results, total: result.total });
  }

  // Actions
  async listActions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const result = await this.service.listActions(this.getTenantId(request), {
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
      status: query.status,
      actionType: query.actionType,
    });
    return reply.send({ success: true, data: result.actions, total: result.total });
  }

  async createAction(request: FastifyRequest, reply: FastifyReply) {
    const { resultId } = request.params as { resultId: string };
    const body = request.body as any;
    const action = await this.service.createAction(this.getTenantId(request), {
      resultId,
      actionType: body.actionType,
      assignedTo: body.assignedTo,
      description: body.description,
    });
    return reply.code(201).send({ success: true, data: action });
  }

  async updateAction(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const action = await this.service.updateAction(id, request.body as any);
    return reply.send({ success: true, data: action });
  }
}
```

### 9.4 路由注册

```typescript
// orion-platform-service/src/api/inspection-routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { InspectionRepository } from '../services/inspection/InspectionRepository';
import { InspectionService } from '../services/inspection/InspectionService';
import { InspectionEngine } from '../services/inspection/InspectionEngine';
import { InspectionController } from './controllers/InspectionController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

export default async function inspectionRoutes(
  app: FastifyInstance,
  options: { database?: DatabasePool }
): Promise<void> {
  if (!options.database) {
    console.warn('[InspectionRoutes] No database pool provided');
    return;
  }

  const repository = new InspectionRepository(options.database);
  const engine = new InspectionEngine(repository);
  const service = new InspectionService(repository, engine, /* cronScheduler, notificationService */ null as any, null as any);
  const controller = new InspectionController(service);

  // Plans
  app.post('/plans', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, (req, reply) => controller.createPlan(req, reply));

  app.get('/plans', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, (req, reply) => controller.listPlans(req, reply));

  app.get('/plans/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, (req, reply) => controller.getPlan(req, reply));

  app.put('/plans/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, (req, reply) => controller.updatePlan(req, reply));

  app.delete('/plans/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'delete' })],
  }, (req, reply) => controller.deletePlan(req, reply));

  app.put('/plans/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, (req, reply) => controller.togglePlan(req, reply));

  app.post('/plans/:id/trigger', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'execute' })],
  }, (req, reply) => controller.triggerPlan(req, reply));

  // Runs
  app.get('/runs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, (req, reply) => controller.listRuns(req, reply));

  app.post('/runs/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'execute' })],
  }, (req, reply) => controller.cancelRun(req, reply));

  // Results
  app.get('/runs/:runId/results', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, (req, reply) => controller.listResults(req, reply));

  app.post('/results/:resultId/action', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection_action', action: 'write' })],
  }, (req, reply) => controller.createAction(req, reply));

  // Actions
  app.get('/actions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, (req, reply) => controller.listActions(req, reply));

  app.put('/actions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection_action', action: 'write' })],
  }, (req, reply) => controller.updateAction(req, reply));
}
```

---

## 十、验收标准

### 10.1 端到端测试场景

**场景：用户创建巡检计划 → 触发执行 → 查看报告 → 发起整改**

| 步骤 | 操作 | 预期结果 | 验证点 |
|------|------|----------|--------|
| 1 | 用户登录，导航到 `/inspection/plans` | 显示巡检计划列表 | 页面标题正确，列表加载 |
| 2 | 点击"新建巡检计划" | 显示创建表单 | 所有字段有校验规则 |
| 3 | 填写名称="集群每日健康检查"、目标类型=cluster、schedule=`0 0 * * * *`、添加 2 个巡检项 | 表单校验通过 | cron 表达式有中文翻译 |
| 4 | 点击"创建计划" | `message.success("巡检计划已创建")`，跳转到列表 | 列表中新增一条记录，状态为"已启用" |
| 5 | 点击该计划的"执行"按钮 | `message.success("已触发执行")` | 后端创建 inspection_run 记录 |
| 6 | 等待执行完成，导航到 `/inspection/runs` | 看到一条 completed 状态的 Run | 显示通过/警告/失败统计 |
| 7 | 点击"详情" | 导航到 `/inspection/results/:runId` | 显示 Run 概要 + 结果列表 |
| 8 | 结果列表中有一条 fail 记录 | 显示红色"失败"标签 + 建议 | 操作列有"发起整改"按钮 |
| 9 | 点击"发起整改"，选择"手动修复"，填写描述 | 弹窗提交成功 | 创建 inspection_action 记录 |
| 10 | 导航到 `/inspection/actions` | 看到一条 pending 状态的整改任务 | 可以执行"开始处理"→"完成"操作 |

### 10.2 量化验收指标

| 指标 | 目标值 | 验证方式 |
|------|--------|----------|
| 单次巡检执行时间（10 个巡检项） | ≤ 60 秒 | 性能测试 |
| 单个巡检项采集超时 | ≤ 10 秒 | 超时保护测试 |
| 巡检失败通知延迟 | ≤ 5 秒（Run 完成后） | 通知时间戳对比 |
| 页面加载时间（计划列表） | ≤ 2 秒（100 条记录） | 前端性能面板 |
| Cron 调度准确率 | 100%（不漏触发） | 72 小时连续运行测试 |
| 租户数据隔离 | 100%（RLS 策略生效） | 多租户交叉查询测试 |
| 并发执行支持 | 同一租户最多 3 个 Run 并行 | 并发触发测试 |
| API 覆盖率 | 所有路由 ≥ 80% 单元测试 | Jest 覆盖率报告 |

### 10.3 验收清单

#### 后端
- [ ] `183_create_inspection_tables.sql` 迁移文件（含 CHECK 约束 + rollback）
- [ ] `InspectionRepository.ts` - 4 张表 CRUD 完整
- [ ] `InspectionEngine.ts` - 执行引擎（串行/并行/超时/重试）
- [ ] `InspectionService.ts` - 业务逻辑层
- [ ] `InspectionController.ts` - HTTP 控制器
- [ ] `inspection-routes.ts` - 路由注册到 `routes.ts`
- [ ] 4 种 Collector 实现（Prometheus/K8s/Database/Security）
- [ ] CronScheduler 集成（计划启停时自动注册/注销）
- [ ] 通知集成（critical 结果触发通知）
- [ ] 单元测试覆盖率 ≥ 80%

#### 前端
- [ ] 5 个页面组件全部实现
- [ ] 路由注册到 `routes.tsx`
- [ ] `api/inspection.ts` API 客户端完整
- [ ] 每个页面包含：标题 + 图标、搜索/过滤、空状态引导、loading/error 处理
- [ ] 异步操作有 `message.success/error` 反馈
- [ ] 表单有校验规则和 loading 状态
- [ ] Design Token 使用规范（色彩/圆角/间距）
- [ ] 响应式适配（≥1200px 全列，≥768px 隐藏次要列，<768px 卡片列表）

#### 集成测试
- [ ] 端到端场景完整通过
- [ ] 多租户隔离验证
- [ ] 权限控制验证（无权限用户访问返回 403）
- [ ] 连续失败升级策略验证

---

## 十一、实施计划

### 11.1 阶段划分

| 阶段 | 内容 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase 1** | DDL 补充（CHECK 约束、审计字段、rollback）+ Repository | 2 天 | 无 |
| **Phase 2** | InspectionEngine + 4 种 Collector | 5 天 | Phase 1 |
| **Phase 3** | Service + Controller + Routes + Cron 集成 | 3 天 | Phase 2 |
| **Phase 4** | 前端 5 页面 + API 客户端 + 路由注册 | 5 天 | Phase 3 |
| **Phase 5** | 通知集成 + 升级策略 + 端到端测试 | 3 天 | Phase 4 |
| **Phase 6** | 文档 + 模板库 + 性能优化 | 2 天 | Phase 5 |

**总计**: 20 个工作日（约 4 周）

### 11.2 文件清单

| 文件 | 路径 | 新建/修改 |
|------|------|-----------|
| DDL 迁移 | `orion-platform-service/src/db/migrations/183_create_inspection_tables.sql` | 新建 |
| DDL Rollback | `orion-platform-service/src/db/migrations/183_create_inspection_tables-rollback.sql` | 新建 |
| Repository | `orion-platform-service/src/services/inspection/InspectionRepository.ts` | 新建 |
| Engine | `orion-platform-service/src/services/inspection/InspectionEngine.ts` | 新建 |
| Collectors | `orion-platform-service/src/services/inspection/collectors/PrometheusCollector.ts` | 新建 |
| Collectors | `orion-platform-service/src/services/inspection/collectors/KubernetesCollector.ts` | 新建 |
| Collectors | `orion-platform-service/src/services/inspection/collectors/DatabaseCollector.ts` | 新建 |
| Collectors | `orion-platform-service/src/services/inspection/collectors/SecurityCollector.ts` | 新建 |
| Service | `orion-platform-service/src/services/inspection/InspectionService.ts` | 新建 |
| Controller | `orion-platform-service/src/api/controllers/InspectionController.ts` | 新建 |
| Routes | `orion-platform-service/src/api/inspection-routes.ts` | 新建 |
| Routes 注册 | `orion-platform-service/src/api/routes.ts` | 修改（import + register） |
| API 客户端 | `orion-frontend/src/api/inspection.ts` | 新建 |
| 页面 | `orion-frontend/src/pages/inspection/PlanList/index.tsx` | 新建 |
| 页面 | `orion-frontend/src/pages/inspection/PlanForm/index.tsx` | 新建 |
| 页面 | `orion-frontend/src/pages/inspection/RunList/index.tsx` | 新建 |
| 页面 | `orion-frontend/src/pages/inspection/ResultDetail/index.tsx` | 新建 |
| 页面 | `orion-frontend/src/pages/inspection/ActionList/index.tsx` | 新建 |
| 路由注册 | `orion-frontend/src/router/routes.tsx` | 修改 |

---

## 十二、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Prometheus 查询复杂度高 | 采集性能差 | 预编译 PromQL，使用缓存 |
| K8s API 限流 | 采集失败 | 限流控制 + 指数退避重试 |
| CronScheduler 单点 | 调度丢失 | 计划持久化 + 启动时恢复 |
| 大量巡检项并发 | 资源竞争 | executionMode=serial 降级 |
| 前端页面复杂度 | 开发周期长 | 复用已有组件（Table/SearchFilterBar/MetricCard） |

---

## 附录 A：与已有系统的能力映射

| 巡检能力 | 已有系统 | 集成方式 |
|----------|---------|----------|
| 定时调度 | `CronSchedulerService` | `addJob()` / `removeJob()` |
| 指标查询 | `MetricsService` + Prometheus | 通过 MetricsRepository 查询 |
| K8s 资源查询 | `k8s-provisioner-service.ts` | 复用 K8s client |
| 数据库查询 | `DatabaseService` | 复用 DatabasePool |
| 通知推送 | `NotificationService` | `send()` 方法 |
| 告警创建 | `alert/` 服务 | 创建 critical 级别告警 |
| 权限控制 | `requirePermission` 中间件 | 路由层挂载 |
| 租户隔离 | RLS 策略 | DDL 已有，自动生效 |

## 附录 B：巡检项模板完整定义

```typescript
// 预定义模板（代码中硬编码或存储于 DB）
const INSPECTION_TEMPLATES = {
  'basic-cluster-health': {
    name: '集群基础健康检查',
    targetType: 'cluster',
    schedule: '0 0 * * * *',
    inspectionItems: [
      {
        id: 'cpu-usage',
        type: 'resource',
        name: 'CPU 使用率',
        collector: 'PrometheusCollector',
        target: { resourceType: 'node' },
        threshold: { metric: 'cpu_usage_percent', operator: '>', warningValue: 70, criticalValue: 90, unit: '%' },
        enabled: true,
      },
      {
        id: 'memory-usage',
        type: 'resource',
        name: '内存使用率',
        collector: 'PrometheusCollector',
        target: { resourceType: 'node' },
        threshold: { metric: 'memory_usage_percent', operator: '>', warningValue: 75, criticalValue: 95, unit: '%' },
        enabled: true,
      },
      {
        id: 'pod-health',
        type: 'service',
        name: 'Pod 健康状态',
        collector: 'KubernetesCollector',
        target: { resourceType: 'pod' },
        threshold: { metric: 'running_pods', operator: 'range', warningValue: 0.9, criticalValue: 0.8, unit: 'ratio' },
        enabled: true,
      },
    ],
  },
  'database-health': {
    name: '数据库健康检查',
    targetType: 'database',
    schedule: '0 */30 * * * *',
    inspectionItems: [
      {
        id: 'slow-queries',
        type: 'database',
        name: '慢 SQL 监控',
        collector: 'DatabaseCollector',
        target: { resourceType: 'postgresql' },
        threshold: { metric: 'slow_query_count', operator: '>', warningValue: 10, criticalValue: 50, unit: 'count/hour' },
        enabled: true,
      },
      {
        id: 'connection-usage',
        type: 'database',
        name: '连接数使用率',
        collector: 'DatabaseCollector',
        target: { resourceType: 'postgresql' },
        threshold: { metric: 'connection_usage_percent', operator: '>', warningValue: 70, criticalValue: 90, unit: '%' },
        enabled: true,
      },
    ],
  },
  'security-compliance': {
    name: '安全合规巡检',
    targetType: 'cluster',
    schedule: '0 0 * * 1 *',
    inspectionItems: [
      {
        id: 'cert-expiry',
        type: 'security',
        name: 'TLS 证书过期检查',
        collector: 'SecurityCollector',
        target: { resourceType: 'tls-secret' },
        threshold: { metric: 'cert_remaining_days', operator: '<', warningValue: 30, criticalValue: 7, unit: 'days' },
        enabled: true,
      },
      {
        id: 'rbac-overprivileged',
        type: 'security',
        name: 'RBAC 过度授权检查',
        collector: 'SecurityCollector',
        target: { resourceType: 'clusterrolebinding' },
        threshold: { metric: 'cluster_admin_bindings', operator: '>', warningValue: 0, criticalValue: 0, unit: 'count' },
        enabled: true,
      },
    ],
  },
};
```
