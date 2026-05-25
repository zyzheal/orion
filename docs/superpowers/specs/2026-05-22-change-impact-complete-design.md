# 变更影响分析模块完整设计（Change Impact Analysis Complete Design）

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：现有 `028_create_change_intelligence_tables.sql`，扩展迁移 195
> 菜单归属：治理（`/governance`），图标 `SafetyCertificateOutlined`

---

## 1. 功能设计（后端）

### 1.1 业务闭环

变更影响分析模块实现"扫描→分析→评估→预警→追溯"五步闭环：

```
代码变更（PR / Commit / Merge）
        │
        ▼ (AST 扫描 + 依赖分析)
  Code Change Scanner ─────────► 变更文件列表 + 变更类型
        │
        ▼ (调用链 + 数据血缘 + 服务拓扑)
  Impact Analysis Engine ──────► 受影响服务/用户/SLA
        │
        ▼ (风险模型 + 历史匹配)
  Risk Assessment ─────────────► change_intelligence_reports
        │
        ▼ (SLO 评估 + 告警)
  SLO Impact Evaluation ───────► slo_impact
        │
        ▼ (报告生成 + GitLab 评论)
  Report & Notification ───────► GitLab MR 评论 + 前端面板
```

**闭环触发关系**：
- PR 创建/更新 → 自动触发代码扫描
- 扫描完成 → 自动触发影响分析
- 分析完成 → 生成风险报告 → GitLab MR 自动评论
- 高风险变更 → 额外通知相关责任人
- 发布后 → 对比实际影响与预估，校准模型

### 1.2 现有表分析

| 表名 | 迁移编号 | 字段数 | 用途 |
|------|----------|--------|------|
| `change_intelligence_reports` | 028 | 12 | 变更智能报告（风险评分、影响服务数） |
| `change_intelligence_affected_services` | 028 | 8 | 受影响服务明细 |
| `change_intelligence_risk_factors` | 028 | 7 | 风险因子明细（SHAP 值） |
| `change_intelligence_historical_matches` | 028 | 6 | 历史相似变更匹配 |

**不足**：
1. 缺少 `runtime_impact` 运行态影响字段
2. 缺少 `slo_impact` SLO 影响字段
3. 缺少代码扫描的 AST 分析结果存储
4. 缺少接口变更检测记录

### 1.3 需扩展表

#### 迁移 195：变更影响扩展

```sql
-- 195: Change Intelligence Extension
-- 扩展 change_intelligence_reports 增加运行态和 SLO 影响列

ALTER TABLE change_intelligence_reports
  ADD COLUMN IF NOT EXISTS runtime_impact JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS slo_impact JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS api_changes JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS config_changes JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_changes JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deployment_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS db_migration_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_duration_ms INT,
  ADD COLUMN IF NOT EXISTS scan_status VARCHAR(30) NOT NULL DEFAULT 'completed'; -- pending, scanning, completed, failed

COMMENT ON COLUMN change_intelligence_reports.runtime_impact IS '运行态影响: {affected_users, affected_requests_per_min, estimated_downtime_min, blast_radius}';
COMMENT ON COLUMN change_intelligence_reports.slo_impact IS 'SLO 影响: {affected_slos: [{slo_name, current_budget, estimated_budget_consumption, risk_level}]}';
COMMENT ON COLUMN change_intelligence_reports.api_changes IS 'API 变更: [{endpoint, method, change_type, breaking}]';
```

#### 迁移 199：变更影响增强表

```sql
-- 199: Change Impact Enhancement
-- 代码扫描结果、接口变更、SLO 影响明细、变更追溯

-- code_scan_results 表（代码扫描结果明细）
CREATE TABLE IF NOT EXISTS code_scan_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id         UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  file_path         VARCHAR(500) NOT NULL,
  change_type       VARCHAR(50) NOT NULL,                  -- added, modified, deleted, renamed
  lines_added       INT NOT NULL DEFAULT 0,
  lines_deleted     INT NOT NULL DEFAULT 0,
  language          VARCHAR(30),                           -- typescript, python, go, etc.
  ast_analysis      JSONB NOT NULL DEFAULT '{}',           -- {functions_changed, classes_changed, imports_changed}
  complexity_delta  DECIMAL(5, 2),                         -- 圈复杂度变化
  security_findings JSONB NOT NULL DEFAULT '[]',           -- [{type, severity, location}]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_code_scan_report ON code_scan_results(report_id);
CREATE INDEX idx_code_scan_tenant ON code_scan_results(tenant_id);
CREATE INDEX idx_code_scan_file ON code_scan_results(file_path);
CREATE INDEX idx_code_scan_type ON code_scan_results(change_type);

-- api_change_records 表（接口变更检测记录）
CREATE TABLE IF NOT EXISTS api_change_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id         UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  endpoint          VARCHAR(500) NOT NULL,                 -- /api/v1/users/{id}
  method            VARCHAR(10) NOT NULL,                  -- GET, POST, PUT, DELETE, PATCH
  change_type       VARCHAR(30) NOT NULL,                  -- added, removed, modified, deprecated
  breaking          BOOLEAN NOT NULL DEFAULT false,
  details           JSONB NOT NULL DEFAULT '{}',           -- {old_schema, new_schema, field_changes}
  consumers         JSONB NOT NULL DEFAULT '[]',           -- [consuming_service_name]
  migration_required BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_change_report ON api_change_records(report_id);
CREATE INDEX idx_api_change_tenant ON api_change_records(tenant_id);
CREATE INDEX idx_api_change_endpoint ON api_change_records(endpoint);
CREATE INDEX idx_api_change_breaking ON api_change_records(breaking);

-- slo_impact_details 表（SLO 影响明细）
CREATE TABLE IF NOT EXISTS slo_impact_details (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id         UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  slo_name          VARCHAR(200) NOT NULL,
  slo_target        DECIMAL(5, 2) NOT NULL,                -- 如 99.9
  current_value     DECIMAL(5, 2),                         -- 当前实际值
  estimated_impact  DECIMAL(5, 2),                         -- 预估影响值
  budget_impact_percent DECIMAL(5, 2),                     -- 预算消耗百分比
  risk_level        VARCHAR(20) NOT NULL DEFAULT 'none',   -- none, low, medium, high, critical
  affected_metrics  JSONB NOT NULL DEFAULT '[]',           -- [metric_names]
  recommendation    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slo_impact_report ON slo_impact_details(report_id);
CREATE INDEX idx_slo_impact_tenant ON slo_impact_details(tenant_id);
CREATE INDEX idx_slo_impact_risk ON slo_impact_details(risk_level);
CREATE INDEX idx_slo_impact_slo ON slo_impact_details(slo_name);

-- change_trace_records 表（变更追溯记录）
CREATE TABLE IF NOT EXISTS change_trace_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id         UUID NOT NULL REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  deployment_id     UUID,                                  -- 关联的部署
  incident_id       VARCHAR(100),                          -- 关联的故障 ID
  incident_severity VARCHAR(20),                           -- P0, P1, P2, P3, P4
  root_cause_confirmed BOOLEAN NOT NULL DEFAULT false,
  actual_impact     JSONB NOT NULL DEFAULT '{}',           -- 实际影响 vs 预估影响
  lessons_learned   TEXT,
  traced_by         VARCHAR(100),
  traced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_change_trace_report ON change_trace_records(report_id);
CREATE INDEX idx_change_trace_tenant ON change_trace_records(tenant_id);
CREATE INDEX idx_change_trace_incident ON change_trace_records(incident_id);
CREATE INDEX idx_change_trace_root_cause ON change_trace_records(root_cause_confirmed);

-- RLS
ALTER TABLE code_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_change_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE slo_impact_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_trace_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_code_scan ON code_scan_results
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_api_change ON api_change_records
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_slo_impact ON slo_impact_details
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_change_trace ON change_trace_records
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### 1.4 核心功能

#### 1.4.1 代码变更自动扫描

**功能**：对每个 PR/Merge Request 进行自动化代码变更扫描。

**扫描流程**：
1. Webhook 接收 GitLab/GitHub PR 事件
2. 拉取变更文件列表（`git diff --name-status`）
3. 对每个变更文件执行 AST 分析
4. 提取函数签名变更、接口定义变更、依赖变更
5. 检测安全敏感变更（如认证逻辑、数据库操作）

**AST 分析能力**：

| 语言 | 分析器 | 提取内容 |
|------|--------|----------|
| TypeScript | `typescript` compiler API | 函数签名、接口定义、类型变更、导入导出 |
| Python | `ast` 模块 | 函数/类定义、装饰器变更、导入变更 |
| Go | `go/parser` | 函数签名、结构体、接口定义 |
| SQL | `node-sql-parser` | 表变更、列变更、索引变更 |

**变更分类**：

| 变更类型 | 检测规则 | 风险权重 |
|----------|----------|----------|
| Breaking API Change | REST endpoint 删除或字段必填化 | 0.9 |
| Database Schema Change | DDL 语句（ALTER/DROP） | 0.8 |
| Auth Logic Change | 认证/授权相关文件变更 | 0.7 |
| Dependency Update | package.json/go.mod 版本变更 | 0.5 |
| Config Change | 配置文件变更 | 0.4 |
| Bug Fix | 修复已知的 bug | 0.2 |
| Documentation | 仅文档变更 | 0.1 |

**实现代码位置**：
- Service: `orion-platform-service/src/services/change-impact/CodeScannerService.ts`
- AST 分析器: `orion-platform-service/src/services/change-impact/ast/{ts,python,go,sql}-analyzer.ts`
- Controller: `orion-platform-service/src/api/controllers/ChangeImpactController.ts`
- Routes: `orion-platform-service/src/api/change-impact-routes.ts`

#### 1.4.2 运行态影响评估

**功能**：将代码变更映射到运行时的服务、用户和 SLA 影响。

**影响评估模型**：

```
代码变更
  │
  ├─► 直接变更的文件/函数
  │     └─► 所在服务
  │           └─► 该服务的调用方（从 API Gateway 日志获取）
  │                 └─► 影响用户数
  │
  ├─► API 接口变更
  │     └─► 调用该 API 的消费者服务
  │           └─► 影响范围
  │
  └─► 数据库变更
        └─► 使用该表的服务
              └─► 数据血缘下游
```

**运行态影响数据结构**：

```typescript
interface RuntimeImpact {
  affectedServices: string[];        // 受影响的服务名
  affectedUsers: number;             // 预估受影响用户数（从活跃度推算）
  affectedRequestsPerMin: number;    // 预估受影响 QPM
  estimatedDowntimeMin: number;      // 预估中断时间
  blastRadius: 'low' | 'medium' | 'high' | 'critical';
  criticalPath: boolean;             // 是否在关键路径上
  dataLossRisk: boolean;             // 是否有数据丢失风险
}
```

**数据来源**：
- 服务调用关系：从 CMDB 服务拓扑 + API Gateway 访问日志
- 用户活跃度：从监控系统的 QPM/DAU 指标
- 关键路径标识：从 Service Mesh 调用链分析

#### 1.4.3 SLO 影响分析

**功能**：评估变更对现有 SLO（Service Level Objectives）的潜在影响。

**SLO 数据来源**：
- 从监控系统（Prometheus/Grafana）获取当前 SLO 状态
- 从 SLO 配置表获取目标值和预算

**评估流程**：
1. 识别变更影响的服务
2. 查询这些服务的 SLO 定义
3. 根据变更类型和历史数据预估 SLO 影响
4. 计算 Error Budget 消耗
5. 生成风险等级和建议

**SLO 影响数据结构**：

```typescript
interface SLOImpact {
  sloName: string;
  sloTarget: number;        // 如 99.9 (99.9%)
  currentValue: number;     // 当前实际值
  estimatedImpact: number;  // 预估影响后的值
  budgetImpactPercent: number; // Error Budget 消耗百分比
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  affectedMetrics: string[];
  recommendation?: string;
}
```

**风险等级判定**：

| 条件 | 风险等级 |
|------|----------|
| 预估 SLO 值 > 目标值 | none |
| 预估影响后仍在 Budget 内（> 50% Budget 剩余） | low |
| 预估影响后 Budget 剩余 20-50% | medium |
| 预估影响后 Budget 剩余 < 20% | high |
| 预估影响后 SLO 不达标 | critical |

#### 1.4.4 变更推荐与风险评估

**功能**：基于历史数据推荐变更策略，评估变更风险。

**历史匹配**：
1. 对当前变更提取特征向量（文件数、变更类型、影响服务数等）
2. 与 `change_intelligence_historical_matches` 中的历史变更比对
3. 使用余弦相似度找到最相似的 N 个历史变更
4. 如果历史变更导致了故障（`incident_linked = true`），提高当前风险评分

**推荐生成**：

```typescript
interface ChangeRecommendation {
  type: 'review' | 'test' | 'staging' | 'rollback_plan' | 'canary' | 'notification';
  priority: 'P0' | 'P1' | 'P2';
  description: string;
  details: Record<string, unknown>;
}
```

| 推荐类型 | 触发条件 | 示例 |
|----------|----------|------|
| review | risk_score > 0.7 | "建议增加资深工程师 Code Review" |
| test | 缺少测试的变更 | "变更涉及 3 个函数但无对应测试用例" |
| staging | 影响服务数 > 3 | "建议在 Staging 环境先验证" |
| rollback_plan | risk_score > 0.5 | "建议准备回滚方案" |
| canary | 影响用户数 > 1000 | "建议使用灰度发布" |
| notification | 影响关键路径服务 | "建议提前通知 OnCall 团队" |

### 1.5 外部依赖

| 依赖 | 用途 | 已有/需新建 | 回退策略 |
|------|------|-------------|----------|
| GitLab/GitHub API | PR 事件 Webhook、Diff 获取 | 已有 Webhook 基础设施 | 手动上传 Diff |
| AST 分析器 | 代码语义分析 | TypeScript AST 已有 | 降级为文件级分析 |
| CMDB | 服务拓扑 | 已有 CMDB 服务 | 使用静态配置 |
| Prometheus | SLO 指标 | 已有 `PrometheusClient` | SLO 影响标记为 unknown |
| API Gateway 日志 | 服务调用关系 | 已有日志系统 | 使用最后已知拓扑 |
| 工作流引擎 | 审批流集成 | 已有 `WorkflowService` | 仅做通知 |
| NATS EventBus | 变更事件 | 已有 | 降级为日志 |

### 1.6 权限模型

| 角色 | 查看报告 | 查看扫描结果 | 查看 SLO 影响 | 管理配置 | 追溯变更 |
|------|----------|-------------|---------------|----------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| PlatformAdmin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Developer | ✅ (自己的) | ✅ (自己的) | ✅ (自己的) | ❌ | ❌ |
| QAViewer | ✅ | ✅ | ✅ | ❌ | ❌ |
| OpsEngineer | ✅ | ✅ | ✅ | ❌ | ✅ |

**API 权限映射**：

| 路由 | 权限要求 |
|------|----------|
| GET `/change-impact/reports` | `change_impact:read` |
| GET `/change-impact/reports/:id` | `change_impact:read` |
| POST `/change-impact/reports/scan` | `change_impact:execute` |
| GET `/change-impact/reports/:id/scan-results` | `change_impact:read` |
| GET `/change-impact/reports/:id/api-changes` | `change_impact:read` |
| GET `/change-impact/reports/:id/slo-impact` | `change_impact:read` |
| GET `/change-impact/reports/:id/runtime-impact` | `change_impact:read` |
| GET `/change-impact/reports/:id/recommendations` | `change_impact:read` |
| POST `/change-impact/reports/:id/trace` | `change_impact:admin` |
| GET `/change-impact/dashboard` | `change_impact:read` |
| GET `/change-impact/trend` | `change_impact:read` |

### 1.7 定时任务

| 任务 | Cron | 功能 | 超时 |
|------|------|------|------|
| WebhookListener | 常驻进程 | 监听 GitLab/GitHub Webhook | N/A |
| ScanQueueProcessor | 常驻进程 | 处理扫描队列 | N/A |
| HistoricalMatchRefresh | `0 4 * * 1` | 每周更新历史匹配索引 | 300s |
| SLOBudgetReporter | `0 8 * * *` | 每日生成 SLO 预算报告 | 120s |
| StaleScanCleaner | `0 3 * * 0` | 清理 > 90 天的扫描结果 | 60s |

---

## 2. 页面交互设计（前端）

### 2.1 页面清单与路由

| 页面 | 路由 | 优先级 | 对应后端 API |
|------|------|--------|-------------|
| 变更列表 | `/governance/change-impact` | P0 | GET `/reports` |
| 影响分析详情 | `/governance/change-impact/:id` | P0 | GET `/reports/:id` + 子资源 |
| SLO 影响面板 | `/governance/change-impact/:id/slo` | P1 | GET `/reports/:id/slo-impact` |
| 风险评估面板 | `/governance/change-impact/risk-dashboard` | P1 | GET `/dashboard`, GET `/trend` |
| 变更追溯 | `/governance/change-impact/:id/trace` | P2 | POST `/reports/:id/trace` |

### 2.2 页面 1：变更列表（/governance/change-impact）

**页面标题**：

```tsx
<Title level={2} style={{ marginBottom: spacing.sm }}>
  <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  变更影响分析
</Title>
<Typography.Text style={{ color: colors.neutral[500], fontSize: 14 }}>
  代码变更自动扫描、运行态影响评估与 SLO 风险分析
</Typography.Text>
```

**布局结构**：统计摘要 + 过滤栏 + 变更列表

**统计摘要（4 个卡片）**：

| 卡片 | 数据 | 颜色 |
|------|------|------|
| 今日变更数 | 近 24h 变更数 | 中性色 |
| 高风险变更 | risk_level = high/critical 的数量 | 红色 |
| Breaking API 变更 | api_changes 中有 breaking=true 的数量 | 橙色 |
| SLO 风险 | slo_impact 中 risk != none 的数量 | 紫色 |

**过滤栏**：
```tsx
<Space style={{ marginBottom: spacing.md }}>
  <Input placeholder="搜索 PR/Commit/服务" prefix={<SearchOutlined />} value={keyword} onChange={setKeyword} style={{ width: 280 }} allowClear />
  <Select placeholder="风险等级" value={risk} onChange={setRisk} style={{ width: 140 }} allowClear
    options={[
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' },
      { label: '严重', value: 'critical' },
    ]}
  />
  <Select placeholder="仓库" value={repo} onChange={setRepo} style={{ width: 180 }} allowClear
    options={repoOptions}
  />
  <RangePicker value={dateRange} onChange={setDateRange} style={{ width: 240 }} />
  <Select placeholder="状态" value={status} onChange={setStatus} style={{ width: 140 }} allowClear
    options={[
      { label: '扫描中', value: 'scanning' },
      { label: '已完成', value: 'completed' },
      { label: '失败', value: 'failed' },
    ]}
  />
</Space>
```

**表格列定义**：

| 列 | 宽度 | 内容 |
|----|------|------|
| PR / Commit | 200px | PR 号或 Commit SHA 前 8 位，可点击 |
| 仓库 | 160px | 仓库名 |
| 风险等级 | 100px | 彩色 Tag + 分数 |
| 影响服务数 | 80px | 数字 |
| Breaking 变更 | 80px | 有/无（红色标记） |
| SLO 风险 | 100px | 彩色 Tag |
| 扫描状态 | 80px | 完成/扫描中/失败 |
| 变更文件数 | 80px | 数字 |
| 创建时间 | 160px | 可排序 |
| 操作 | 120px | 查看详情、重新扫描 |

### 2.3 页面 2：影响分析详情（/governance/change-impact/:id）

**布局结构**：基本信息 + 代码变更 + 运行态影响 + API 变更 + 风险因子 + 推荐 + 历史匹配

**基本信息卡片**：
- PR 链接（可点击跳转 GitLab）
- Commit SHA（可复制）
- 风险分（大号数字 + 颜色）
- 风险等级（Tag）
- 影响服务数 / 影响能力数
- 扫描耗时
- 是否需要部署 / 是否需要数据库迁移

**代码变更 Tab**：
- Table 展示所有变更文件
- 列：文件路径、变更类型（added/modified/deleted Tag）、语言、+/- 行数、安全发现
- 点击行 → 展开 AST 分析结果（变更的函数/类/接口）
- 支持按语言/类型过滤

**运行态影响 Tab**：
- 受影响服务列表（Table）：服务名、服务等级、影响类型、变更文件、SLO 风险
- 影响指标摘要：受影响用户数、QPM、预估中断时间
- 爆炸半径（blast_radius）可视化

**API 变更 Tab**：
- Table 展示所有 API 接口变更
- 列：Endpoint、Method、变更类型、是否 Breaking、消费者、迁移要求
- Breaking 变更行红色高亮
- 点击行 → 展开 Schema 对比（旧 vs 新）

**风险评估 Tab**：
- 风险因子列表（进度条 + SHAP 值）
- 每个因子有名称、分数、权重、贡献值、说明
- 推荐操作列表（优先级 + 描述）

**历史匹配 Tab**：
- 最相似的 N 个历史变更
- 显示：相似 PR、相似度、是否导致故障、故障 ID
- 点击可跳转到历史变更详情

### 2.4 页面 3：SLO 影响面板（/governance/change-impact/:id/slo）

**布局结构**：SLO 概览 + 详情表 + 预算可视化

**SLO 概览**：
- 大字号显示受影响的 SLO 数量
- 按风险等级分组显示

**SLO 详情表**：

| 列 | 内容 |
|----|------|
| SLO 名称 | 如 "API 可用性 99.9%" |
| 目标值 | 99.9% |
| 当前值 | 99.95%（带颜色） |
| 预估影响值 | 99.92%（带颜色，低于目标时红色） |
| 预算消耗 | 进度条，显示剩余 Budget 百分比 |
| 风险等级 | 彩色 Tag |
| 影响指标 | 受影响的 Prometheus 指标列表 |
| 建议 | 文本建议 |

**预算可视化**：
- 每个受影响 SLO 一个卡片
- 显示 Error Budget 时间线图
  - X 轴：时间
  - Y 轴：可用性
  - 目标线
  - 预估影响区域（红色阴影）

### 2.5 页面 4：风险评估面板（/governance/change-impact/risk-dashboard）

**布局结构**：风险分布 + 趋势图 + 高风险 Top10 + 变更类型分布

**风险分布**：
- 环形图：按风险等级分布

**风险趋势折线图**：
- 近 30 天日均风险分趋势
- 按仓库分多线

**高风险 Top10**：
- Table 展示风险最高的 10 个变更
- 列：PR、仓库、风险分、主要风险因子、操作

**变更类型分布**：
- 柱状图：按变更类型统计（Breaking API / DB Schema / Auth / Dependency / Config 等）

### 2.6 页面 5：变更追溯（/governance/change-impact/:id/trace）

**布局结构**：追溯表单 + 追溯历史

**追溯表单**（用于事后标注）：
- 关联部署（Select，关联 deployment）
- 关联故障（Input，输入故障 ID）
- 故障严重度（Select：P0-P4）
- 是否确认根因（Checkbox）
- 实际影响 vs 预估影响对比（JSON 表单）
- 经验教训（TextArea）
- 提交按钮

**追溯历史**：
- 时间线展示该变更的追溯记录
- 每次追溯：时间、操作人、关联故障、结论

---

## 3. API 设计

### 3.1 变更报告管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/change-impact/reports` | 报告列表 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id` | 报告详情 | `change_impact:read` |
| POST | `/api/v1/change-impact/reports/scan` | 手动触发扫描 | `change_impact:execute` |
| DELETE | `/api/v1/change-impact/reports/:id` | 删除报告 | `change_impact:admin` |

### 3.2 代码扫描结果

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/change-impact/reports/:id/scan-results` | 扫描结果列表 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id/scan-results/:scanId` | 扫描结果详情 | `change_impact:read` |

### 3.3 影响分析

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/change-impact/reports/:id/runtime-impact` | 运行态影响 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id/api-changes` | API 变更列表 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id/slo-impact` | SLO 影响列表 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id/recommendations` | 推荐操作列表 | `change_impact:read` |
| GET | `/api/v1/change-impact/reports/:id/historical-matches` | 历史匹配列表 | `change_impact:read` |

### 3.4 变更追溯

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/change-impact/reports/:id/traces` | 追溯记录列表 | `change_impact:read` |
| POST | `/api/v1/change-impact/reports/:id/trace` | 创建追溯记录 | `change_impact:admin` |
| PUT | `/api/v1/change-impact/traces/:id` | 更新追溯记录 | `change_impact:admin` |

### 3.5 面板与趋势

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/change-impact/dashboard` | 风险面板聚合数据 | `change_impact:read` |
| GET | `/api/v1/change-impact/trend` | 风险趋势（时序数据） | `change_impact:read` |
| GET | `/api/v1/change-impact/stats` | 统计摘要 | `change_impact:read` |

---

## 4. 验收标准

### 4.1 功能验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 代码扫描 | 推送 PR 触发 Webhook | 生成 `change_intelligence_reports` 记录 + `code_scan_results` |
| 2 | AST 分析 | TypeScript 文件变更 | 提取变更的函数签名和接口定义 |
| 3 | API 变更检测 | REST 路由文件变更 | 生成 `api_change_records`，breaking 正确标记 |
| 4 | 运行态影响 | 查看运行态影响 API | 返回受影响服务列表 + 用户数 + 爆炸半径 |
| 5 | SLO 影响评估 | 变更影响 SLO 相关服务 | 生成 `slo_impact_details`，预算消耗计算正确 |
| 6 | 风险评分 | 查看报告 | 综合风险分在 0-1 之间，各因子 SHAP 值之和接近总分 |
| 7 | 历史匹配 | 查看历史匹配 | 返回相似度 > 0.5 的历史变更 |
| 8 | 推荐生成 | 高风险变更 | 至少生成 1 条推荐操作 |
| 9 | GitLab 评论 | PR 扫描完成后 | MR 自动评论风险摘要（可通过配置开关） |
| 10 | 变更追溯 | 事后标注关联故障 | 创建 `change_trace_records`，关联 incident |
| 11 | 迁移 195 | 执行扩展迁移 | `runtime_impact` 和 `slo_impact` 列添加到 reports 表 |
| 12 | 迁移 199 | 执行增强迁移 | 4 张新表 + RLS 创建成功 |

### 4.2 前端交互验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 页面标题规范 | 检查所有页面 | `level={2}` + 图标 + Design Token |
| 2 | 空状态引导 | 无数据时 | Empty + 引导文字 |
| 3 | 异步操作反馈 | 手动触发扫描 | loading + success/error message |
| 4 | 风险分可视化 | 详情页查看风险分 | 大字号 + 颜色随风险等级变化 |
| 5 | Breaking 变更高亮 | API 变更 Tab | Breaking 行红色标记 |
| 6 | SLO 预算可视化 | SLO 面板 | 进度条显示剩余 Budget 百分比 |
| 7 | Design Token 使用 | 搜索硬编码色值 | 无硬编码 |
| 8 | CRUD 完整性 | 变更追溯 | 创建/查看/编辑追溯记录 |

### 4.3 后端验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | TypeScript 编译 | `npm run build` | 零 error |
| 2 | ESLint | `npm run lint` | 零 error |
| 3 | 单元测试 | `npm run test` | 覆盖率 >= 80% |
| 4 | RLS 策略 | 切换 tenant_id | 仅返回当前租户数据 |
| 5 | 错误码规范 | 触发错误 | `CLIENT.4xx.*` 或 `BIZ.*` 格式 |
| 6 | 权限校验 | 无权限调用 | 403 + `CLIENT.403.FORBIDDEN` |
| 7 | AST 分析器 | 输入 TypeScript 测试代码 | 正确提取函数/接口变更 |
| 8 | 风险评分 | 输入测试变更集 | 各因子加权计算正确 |
| 9 | Webhook 处理 | 模拟 GitLab Webhook | 自动触发扫描，创建报告 |
