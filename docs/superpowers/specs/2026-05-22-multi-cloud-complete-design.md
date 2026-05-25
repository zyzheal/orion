# 多云管理模块完整设计（Multi-Cloud Management Complete Design）

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：现有 `102_multi_cloud.sql`、`113_multi_cloud_advanced.sql`，需补充新建表
> 菜单归属：基础设施（`/infra`），图标 `ClusterOutlined`

---

## 1. 功能设计（后端）

### 1.1 业务闭环

多云管理模块实现"接入→发现→聚合→治理→编排"五步闭环：

```
云账户凭据（cloud_accounts）
        │
        ▼ (Provider SDK 调用)
  资源自动发现 ──────────────► cloud_resources
        │
        ▼ (统一数据模型 + 标签映射)
  多云统一视图 ─────────────► 跨云资源聚合
        │
        ▼ (成本数据同步)
  成本聚合分析 ─────────────► multi_cloud_cost
        │
        ▼ (标签合规检查 + 治理规则)
  多云治理 ────────────────► 合规评分 + 违规告警
        │
        ▼ (IaC + 跨云编排引擎)
  跨云部署编排 ─────────────► cross_cloud_deployments
```

**闭环触发关系**：
- 云账户新增 → 自动触发资源发现任务
- 资源发现完成 → 自动聚合到多云视图 + 成本计算
- 标签不合规 → 自动标记违规资源 + 生成修复建议
- 跨云编排部署 → 联动 IaC 模块执行

### 1.2 现有表分析

| 表名 | 迁移编号 | 字段数 | 用途 |
|------|----------|--------|------|
| `cloud_providers` | 102 | 9 | 云提供商定义（AWS/Azure/GCP/阿里云/腾讯云） |
| `cloud_accounts` | 102 | 12 | 云账户凭据与配置 |
| `cloud_resources` | 102 | 10 | 云资源清单（EC2/S3/RDS 等） |
| `multi_cloud_cost` | 113 | 12 | 多云成本分析（按提供商/账期） |
| `cross_zone_dr` | 113 | 11 | 跨可用区灾备配置 |
| `cloud_networking` | 113 | 11 | 云网络配置（VPC/VNet/对等连接） |

**不足**：
1. 缺少跨云部署编排实体表
2. 缺少标签治理/合规规则表
3. `cloud_resources` 缺少 `deleted_at` 软删除字段
4. 缺少多云资源搜索的统一索引表

### 1.3 需新建表

#### 迁移 196：多云增强表

```sql
-- 196: Multi-Cloud Enhancement
-- 跨云部署编排、标签治理、资源搜索索引

-- cross_cloud_deployments 表（跨云部署编排）
CREATE TABLE IF NOT EXISTS cross_cloud_deployments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',      -- draft, planning, deploying, running, failed, terminated
  strategy          VARCHAR(30) NOT NULL DEFAULT 'sequential',  -- sequential, parallel, staged
  cloud_targets     JSONB NOT NULL DEFAULT '[]',                -- [{provider, account_id, region, resource_type, spec}]
  deployment_order  JSONB NOT NULL DEFAULT '[]',                -- [{step, provider, resource_type, depends_on}]
  current_step      INT NOT NULL DEFAULT 0,
  total_steps       INT NOT NULL DEFAULT 0,
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_cross_cloud_deploy_tenant ON cross_cloud_deployments(tenant_id);
CREATE INDEX idx_cross_cloud_deploy_status ON cross_cloud_deployments(status);
CREATE INDEX idx_cross_cloud_deploy_created ON cross_cloud_deployments(created_at DESC);

-- cloud_tag_policies 表（标签治理策略）
CREATE TABLE IF NOT EXISTS cloud_tag_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  required_tags     JSONB NOT NULL DEFAULT '[]',               -- [{tag_key, pattern, required_for}]
  forbidden_tags    JSONB NOT NULL DEFAULT '[]',               -- [tag_key patterns to block]
  enforcement       VARCHAR(30) NOT NULL DEFAULT 'audit',       -- audit, warn, enforce
  scope_providers   JSONB NOT NULL DEFAULT '[]',               -- [provider_name or 'all']
  scope_resource_types JSONB NOT NULL DEFAULT '[]',            -- [resource_type or 'all']
  violation_count   INT NOT NULL DEFAULT 0,
  status            VARCHAR(30) NOT NULL DEFAULT 'active',      -- active, paused, archived
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_cloud_tag_policies_tenant ON cloud_tag_policies(tenant_id);
CREATE INDEX idx_cloud_tag_policies_status ON cloud_tag_policies(status);
CREATE INDEX idx_cloud_tag_policies_enforcement ON cloud_tag_policies(enforcement);

-- cloud_tag_violations 表（标签违规记录）
CREATE TABLE IF NOT EXISTS cloud_tag_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id         UUID REFERENCES cloud_tag_policies(id) ON DELETE SET NULL,
  resource_id       UUID NOT NULL REFERENCES cloud_resources(id) ON DELETE CASCADE,
  violation_type    VARCHAR(50) NOT NULL,                       -- missing_required_tag, forbidden_tag, invalid_value
  tag_key           VARCHAR(200),
  expected_value    VARCHAR(500),
  actual_value      VARCHAR(500),
  severity          VARCHAR(20) NOT NULL DEFAULT 'warning',     -- info, warning, critical
  resolved          BOOLEAN NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolved_by       VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_tag_violations_tenant ON cloud_tag_violations(tenant_id);
CREATE INDEX idx_cloud_tag_violations_policy ON cloud_tag_violations(policy_id);
CREATE INDEX idx_cloud_tag_violations_resolved ON cloud_tag_violations(resolved);
CREATE INDEX idx_cloud_tag_violations_severity ON cloud_tag_violations(severity);

-- cloud_resource_search_index 表（多云资源搜索索引）
CREATE TABLE IF NOT EXISTS cloud_resource_search_index (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id       UUID NOT NULL REFERENCES cloud_resources(id) ON DELETE CASCADE,
  provider          VARCHAR(100) NOT NULL,
  account_name      VARCHAR(200) NOT NULL,
  resource_type     VARCHAR(100) NOT NULL,
  resource_name     VARCHAR(200),
  region            VARCHAR(100),
  state             VARCHAR(30),
  monthly_cost      FLOAT DEFAULT 0,
  tags_flat         VARCHAR(1000) NOT NULL DEFAULT '',          -- "k1:v1,k2:v2" 用于全文搜索
  search_vector     TSVECTOR,                                    -- PostgreSQL 全文搜索
  indexed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_resource_search_tenant ON cloud_resource_search_index(tenant_id);
CREATE INDEX idx_cloud_resource_search_provider ON cloud_resource_search_index(provider);
CREATE INDEX idx_cloud_resource_search_type ON cloud_resource_search_index(resource_type);
CREATE INDEX idx_cloud_resource_search_state ON cloud_resource_search_index(state);
CREATE INDEX idx_cloud_resource_search_region ON cloud_resource_search_index(region);
CREATE INDEX idx_cloud_resource_search_vector ON cloud_resource_search_index USING GIN(search_vector);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cross_cloud_deployments_updated_at
  BEFORE UPDATE ON cross_cloud_deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_cloud_tag_policies_updated_at
  BEFORE UPDATE ON cloud_tag_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE cross_cloud_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_tag_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_tag_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_resource_search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cross_cloud_deployments ON cross_cloud_deployments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cloud_tag_policies ON cloud_tag_policies
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cloud_tag_violations ON cloud_tag_violations
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cloud_resource_search_index ON cloud_resource_search_index
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### 1.4 核心功能

#### 1.4.1 多云资源统一视图

**功能**：聚合 AWS/Azure/GCP/阿里云/腾讯云的异构资源为统一数据模型。

**数据模型转换**：

| 云提供商 | 计算实例 | 对象存储 | 数据库 | 网络 |
|----------|----------|---------|--------|------|
| AWS | EC2 | S3 | RDS | VPC |
| Azure | VM | Blob Storage | Azure SQL | VNet |
| GCP | Compute Engine | Cloud Storage | Cloud SQL | VPC |
| 阿里云 | ECS | OSS | RDS | VPC |
| 腾讯云 | CVM | COS | TencentDB | VPC |

**统一资源类型映射**：`compute`, `storage`, `database`, `network`, `serverless`, `container`, `cache`, `queue`

**统一状态映射**：`running`, `stopped`, `pending`, `terminated`, `error`, `unknown`

**实现代码位置**：
- Service: `orion-platform-service/src/services/multi-cloud/MultiCloudResourceService.ts`
- 提供商适配器: `orion-platform-service/src/services/multi-cloud/providers/{aws,azure,gcp,aliyun,tencent}-adapter.ts`
- Controller: `orion-platform-service/src/api/controllers/MultiCloudController.ts`
- Routes: `orion-platform-service/src/api/multi-cloud-routes.ts`

#### 1.4.2 跨云成本聚合

**功能**：基于 `multi_cloud_cost` 表，聚合多云账单数据，支持按账期/提供商/账户/资源类型多维度分析。

**聚合维度**：

| 维度 | 字段 | 聚合方式 |
|------|------|----------|
| 按提供商 | `cloud_provider` | GROUP BY 求和 |
| 按账期 | `billing_period` | 时间序列聚合 |
| 按账户 | `account_id` | GROUP BY 求和 |
| 按成本类型 | `compute_cost`, `storage_cost`, `network_cost` | 分类聚合 |
| 按预算偏差 | `budget` vs `total_cost` | 超预算率 = `(actual - budget) / budget` |
| 预测偏差 | `forecast_cost` vs `total_cost` | 预测准确率 = `1 - |actual - forecast| / actual` |

**成本同步策略**：
1. AWS: 通过 Cost Explorer API 拉取 `GetCostAndUsage` 数据
2. Azure: 通过 Cost Management API 拉取 `Query` 数据
3. GCP: 通过 Cloud Billing API 拉取 `List` 数据
4. 阿里云: 通过费用中心 API 拉取 `QueryInstanceBill` 数据
5. 腾讯云: 通过费用中心 API 拉取 `DescribeBillDetail` 数据
6. 定时任务每日 02:00 UTC 同步上一日账单数据

**实现代码位置**：
- Service: `orion-platform-service/src/services/multi-cloud/MultiCloudCostService.ts`
- 同步任务: `orion-platform-service/src/services/multi-cloud/CostSyncScheduler.ts`

#### 1.4.3 多云标签与治理

**功能**：定义标签策略 → 扫描资源合规性 → 生成违规记录 → 提供修复建议。

**标签策略规则引擎**：

| 规则类型 | 描述 | 示例 |
|----------|------|------|
| required | 资源必须有指定标签 | 所有 compute 资源必须有 `owner`, `env`, `cost-center` |
| pattern | 标签值必须符合正则 | `env` 必须是 `dev\|staging\|prod` |
| forbidden | 资源不能有指定标签 | 禁止包含 `test-` 前缀的标签 |
| inherit | 从父资源继承标签 | 子网自动继承 VPC 的 `project` 标签 |

**治理流程**：
1. 管理员创建标签策略（`cloud_tag_policies`）
2. 定时任务每 4h 扫描所有资源合规性
3. 不合规资源写入 `cloud_tag_violations`
4. 前端展示违规面板 + 批量修复入口
5. 支持一键补标签（调用云提供商 Tag API）

#### 1.4.4 跨云部署编排

**功能**：定义跨多个云提供商的部署计划，支持顺序/并行/分阶段执行。

**编排模型**：

```typescript
interface CrossCloudDeploymentPlan {
  name: string;
  description?: string;
  strategy: 'sequential' | 'parallel' | 'staged';
  cloudTargets: CloudTarget[];
  deploymentOrder: DeploymentStep[];
}

interface CloudTarget {
  provider: 'aws' | 'azure' | 'gcp' | 'aliyun' | 'tencent';
  accountId: string;
  region: string;
  resourceType: string;
  spec: Record<string, unknown>;  // IaC 模板参数
}

interface DeploymentStep {
  stepNumber: number;
  provider: string;
  resourceType: string;
  dependsOn: number[];  // 依赖的上一步骤编号
  timeout: number;      // 超时秒数
  onFailure: 'abort' | 'continue' | 'retry';
}
```

**执行流程**：
1. 用户创建编排计划（draft 状态）
2. 提交执行后状态变为 `deploying`
3. 引擎按 `deployment_order` 逐步执行，每步调用对应云提供商 API 或 IaC 模块
4. 执行中记录 `current_step` 和进度
5. 全部完成 → `running`；任何一步失败 → `failed`（支持重试）
6. 执行日志通过 SSE 实时推送到前端

**与 IaC 模块的集成**：
- 复用现有 IaC 模块的 Terraform 执行引擎
- `cloud_targets.spec` 作为 Terraform variables 传入
- 执行结果回写 `cloud_resources` 表

#### 1.5 外部依赖

| 依赖 | 用途 | 已有/需新建 | 回退策略 |
|------|------|-------------|----------|
| AWS SDK (JS) | EC2/S3/RDS/Cost Explorer API | 需 `npm install aws-sdk` | 该提供商显示为空 |
| Azure SDK | VM/Blob/Cost Management API | 需 `npm install @azure/arm-*` | 该提供商显示为空 |
| GCP SDK | Compute/Billing API | 需 `npm install @google-cloud/*` | 该提供商显示为空 |
| 阿里云 SDK | ECS/OSS/费用中心 API | 需 `npm install @alicloud/*` | 该提供商显示为空 |
| 腾讯云 SDK | CVM/COS/费用中心 API | 需 `npm install tencentcloud-sdk` | 该提供商显示为空 |
| IaC 模块 | Terraform 执行引擎 | 已有 | 降级为手动 API 调用 |
| NATS EventBus | 部署事件通知 | 已有 | 降级为日志记录 |
| SSE Bridge | 实时日志推送 | 已有 | 降级为轮询 |

#### 1.6 权限模型

| 角色 | 查看资源 | 管理账户 | 执行发现 | 查看成本 | 管理标签策略 | 执行编排 | 删除资源 |
|------|----------|----------|----------|----------|-------------|----------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PlatformAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| CloudAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| CloudViewer | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| FinanceViewer | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

**API 权限映射**：

| 路由 | 权限要求 |
|------|----------|
| GET `/multi-cloud/providers` | `multi_cloud:read` |
| POST `/multi-cloud/accounts` | `multi_cloud:admin` |
| POST `/multi-cloud/accounts/:id/discover` | `multi_cloud:execute` |
| GET `/multi-cloud/resources` | `multi_cloud:read` |
| GET `/multi-cloud/cost` | `multi_cloud:read` 或 `finops:read` |
| POST `/multi-cloud/cost/sync` | `multi_cloud:execute` |
| GET `/multi-cloud/tag-policies` | `multi_cloud:read` |
| POST `/multi-cloud/tag-policies` | `multi_cloud:admin` |
| GET `/multi-cloud/tag-violations` | `multi_cloud:read` |
| POST `/multi-cloud/tag-violations/:id/fix` | `multi_cloud:execute` |
| GET `/multi-cloud/deployments` | `multi_cloud:read` |
| POST `/multi-cloud/deployments` | `multi_cloud:admin` |
| POST `/multi-cloud/deployments/:id/execute` | `multi_cloud:execute` |
| POST `/multi-cloud/deployments/:id/terminate` | `multi_cloud:execute` |

#### 1.7 定时任务

| 任务 | Cron | 功能 | 超时 |
|------|------|------|------|
| ResourceDiscoverer | `0 */6 * * *` | 每 6h 自动发现新增/删除资源 | 600s |
| CostSync | `0 2 * * *` | 每日 02:00 UTC 同步前一日账单 | 900s |
| TagComplianceScan | `0 */4 * * *` | 每 4h 扫描标签合规性 | 300s |
| SearchIndexRebuild | `0 3 * * 0` | 每周日重建搜索索引 | 600s |
| StaleResourceCleaner | `0 4 * * 1` | 清理标记为 terminated > 30 天的资源 | 120s |

---

## 2. 页面交互设计（前端）

### 2.1 页面清单与路由

| 页面 | 路由 | 优先级 | 对应后端 API |
|------|------|--------|-------------|
| 多云概览 | `/infra/multi-cloud/overview` | P0 | 聚合统计接口 |
| 资源搜索 | `/infra/multi-cloud/resources` | P0 | GET `/multi-cloud/resources`, GET `/search` |
| 成本分析 | `/infra/multi-cloud/cost` | P0 | GET `/multi-cloud/cost` |
| 标签治理 | `/infra/multi-cloud/tag-governance` | P1 | GET/POST `/tag-policies`, GET `/tag-violations` |
| 部署编排 | `/infra/multi-cloud/deployments` | P1 | GET/POST `/deployments` |
| 编排详情 | `/infra/multi-cloud/deployments/:id` | P1 | GET `/deployments/:id`, SSE 日志 |
| 云账户管理 | `/infra/multi-cloud/accounts` | P1 | GET/POST/PUT/DELETE `/accounts` |

### 2.2 页面 1：多云概览（/infra/multi-cloud/overview）

**页面标题**：

```tsx
<Title level={2} style={{ marginBottom: spacing.sm }}>
  <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  多云管理
</Title>
<Typography.Text style={{ color: colors.neutral[500], fontSize: 14 }}>
  多云资源统一视图、成本聚合与跨云编排
</Typography.Text>
```

**布局结构**：4 统计卡片 + 云提供商分布饼图 + 资源类型分布 + 近期成本趋势 + 活跃编排列表

**统计卡片（5 个）**：

| 卡片 | 数据来源 | 交互 |
|------|----------|------|
| 已接入云账户数 | `GET /accounts?status=active` | 点击跳转云账户管理 |
| 纳管资源总数 | `GET /resources` 聚合 | 点击跳转资源搜索 |
| 本月总成本 | `GET /cost?period=current` | 点击跳转成本分析 |
| 标签违规数 | `GET /tag-violations?resolved=false` | 点击跳转标签治理 |
| 运行中编排数 | `GET /deployments?status=deploying` | 点击跳转部署编排 |

**云提供商分布饼图（ECharts）**：
- 每个提供商一个扇区，显示资源数和成本占比
- 点击扇区 → 筛选资源搜索页面的 `provider` 过滤条件

**近期成本趋势折线图**：
- 近 6 个月总成本趋势
- 按提供商分堆叠面积图
- 标注预算线（如有）

**活跃编排列表**：
- Table 组件，显示最近 5 个运行中的编排
- 列：名称、策略、目标云数、当前进度、状态
- 操作列：查看详情

**空状态**：无云账户时显示引导卡片："请先添加云账户以开始多云管理"

### 2.3 页面 2：资源搜索（/infra/multi-cloud/resources）

**页面标题**：`<Title level={2}>多云资源</Title>` + 描述文字

**搜索/过滤区域**：

```tsx
<Space style={{ marginBottom: spacing.md, flexWrap: 'wrap' }}>
  <Input
    placeholder="搜索资源名称/ID/标签"
    prefix={<SearchOutlined />}
    value={keyword}
    onChange={(e) => setKeyword(e.target.value)}
    style={{ width: 320 }}
    allowClear
    onPressEnter={handleSearch}
  />
  <Select placeholder="云提供商" value={provider} onChange={setProvider} style={{ width: 160 }} allowClear
    options={[
      { label: 'AWS', value: 'aws' },
      { label: 'Azure', value: 'azure' },
      { label: 'GCP', value: 'gcp' },
      { label: '阿里云', value: 'aliyun' },
      { label: '腾讯云', value: 'tencent' },
    ]}
  />
  <Select placeholder="资源类型" value={resourceType} onChange={setResourceType} style={{ width: 160 }} allowClear
    options={[
      { label: '计算', value: 'compute' },
      { label: '存储', value: 'storage' },
      { label: '数据库', value: 'database' },
      { label: '网络', value: 'network' },
      { label: 'Serverless', value: 'serverless' },
    ]}
  />
  <Select placeholder="区域" value={region} onChange={setRegion} style={{ width: 160 }} allowClear
    options={regionOptions}
  />
  <Select placeholder="状态" value={state} onChange={setState} style={{ width: 140 }} allowClear
    options={[
      { label: '运行中', value: 'running' },
      { label: '已停止', value: 'stopped' },
      { label: '已终止', value: 'terminated' },
      { label: '异常', value: 'error' },
    ]}
  />
  <Button icon={<ReloadOutlined />} onClick={handleSearch} loading={loading}>刷新</Button>
  <Button icon={<CloudDownloadOutlined />} onClick={handleDiscover} loading={discovering}>
    发现资源
  </Button>
</Space>
```

**表格列定义**：

| 列 | 宽度 | 内容 |
|----|------|------|
| 提供商 | 80px | AWS/Azure 等 Tag + 图标 |
| 资源类型 | 100px | 计算/存储/数据库 Tag |
| 资源名称 | 200px | 可点击查看详情 |
| 资源 ID | 160px | 可复制 |
| 区域 | 120px | us-east-1 等 |
| 状态 | 80px | 彩色状态点 |
| 月成本 | 100px | `$XXX.XX` |
| 标签 | 200px | 标签列表，hover 展开 |
| 更新时间 | 160px | `YYYY-MM-DD HH:mm` |
| 操作 | 120px | 详情、编辑标签、停止/启动 |

**操作交互**：
- "发现资源"按钮 → Popconfirm 确认 → 调用 `POST /accounts/:id/discover` → loading 状态 → `message.success`
- 编辑标签 → 打开 Drawer → 表单修改 → 保存调用 `PUT /resources/:id/tags`
- 停止/启动 → Popconfirm 二次确认 → 调用云提供商 API → 刷新列表

### 2.4 页面 3：成本分析（/infra/multi-cloud/cost）

**布局结构**：统计摘要卡片 + 成本趋势图 + 成本归因表 + 超预算告警

**时间范围选择器**：
```tsx
<RangePicker value={dateRange} onChange={setDateRange} style={{ marginBottom: spacing.md }} />
```

**统计摘要**：总成本、较上月变化率、各提供商占比、预算使用率

**成本趋势图**：
- 柱状图（月度总成本）
- 堆叠柱状图（按提供商拆分）
- 折线图叠加预算线

**成本归因表**：
- 支持按提供商/账户/资源类型分组
- 可展开查看子项
- 排序：按成本降序

**超预算告警**：
- Alert 组件，显示超预算的账户
- 提供"查看详情"链接

### 2.5 页面 4：标签治理（/infra/multi-cloud/tag-governance）

**双 Tab 布局**：策略管理 + 违规面板

**Tab 1 — 策略管理**：
- Table 展示所有标签策略
- 操作：创建（Modal 表单）、编辑（Drawer）、暂停/启用、删除
- 创建策略表单：
  - 策略名称（Input，必填）
  - 执行模式（Radio: audit / warn / enforce）
  - 必须标签（Table：标签 Key、值模式、适用资源类型）
  - 禁止标签（Input tags）
  - 生效范围（Select：云提供商 + 资源类型）

**Tab 2 — 违规面板**：
- 过滤：严重程度、未解决/已解决
- Table 列：资源名称、违规类型、标签 Key、期望值、实际值、严重程度、操作
- 操作：一键修复（调用 Tag API 补标签）、标记忽略、查看详情
- 批量操作：批量修复选中项

### 2.6 页面 5：部署编排（/infra/multi-cloud/deployments）

**列表页**：
- 创建按钮（右上角）→ Modal 表单
- Table 列：名称、策略类型、目标云、进度、状态、创建时间、操作
- 状态筛选：全部/草稿/部署中/运行中/失败/已终止
- 操作：查看、执行、终止、复制、删除

**详情页（:id）**：
- 基本信息卡片（名称、描述、策略、状态）
- 部署步骤可视化（Steps 组件）：
  - 每个步骤显示提供商图标、资源类型、依赖关系
  - 执行中步骤高亮 + 实时日志
- 实时日志面板（SSE 订阅 `/deployments/:id/logs`）：
  ```tsx
  // 使用 SSE hook 订阅日志
  const { logs, connected } = useDeploymentLogs(deploymentId);
  <div className="log-panel">
    {logs.map((log, i) => (
      <div key={i} className={`log-line log-${log.level}`}>
        <span className="log-time">{formatTime(log.timestamp)}</span>
        <span className="log-step">[{log.step}]</span>
        <span className="log-msg">{log.message}</span>
      </div>
    ))}
  </div>
  ```
- 底部操作栏：执行/暂停/重试/终止

### 2.7 页面 6：云账户管理（/infra/multi-cloud/accounts）

**列表页**：
- 创建按钮 → Modal 表单
- Table 列：账户名、提供商、区域、状态、月预算、当前花费、标签数、操作
- 操作：编辑、测试连接、触发发现、删除

**创建/编辑表单**：
- 账户名称（Input，必填）
- 云提供商（Select，必填，决定后续字段）
- 区域（Select，根据提供商动态加载）
- 凭据类型（Radio: Access Key / Service Account / IAM Role）
- 凭据输入（根据类型动态渲染不同表单）
- 月预算（InputNumber）
- 标签（Tags input）
- 保存按钮 + 测试连接按钮

---

## 3. API 设计

### 3.1 云账户管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/multi-cloud/accounts` | 账户列表 | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/accounts/:id` | 账户详情 | `multi_cloud:read` |
| POST | `/api/v1/multi-cloud/accounts` | 创建账户 | `multi_cloud:admin` |
| PUT | `/api/v1/multi-cloud/accounts/:id` | 更新账户 | `multi_cloud:admin` |
| DELETE | `/api/v1/multi-cloud/accounts/:id` | 删除账户 | `multi_cloud:admin` |
| POST | `/api/v1/multi-cloud/accounts/:id/test-connection` | 测试连接 | `multi_cloud:admin` |
| POST | `/api/v1/multi-cloud/accounts/:id/discover` | 触发资源发现 | `multi_cloud:execute` |

### 3.2 多云资源

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/multi-cloud/resources` | 资源列表（分页/过滤/搜索） | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/resources/:id` | 资源详情 | `multi_cloud:read` |
| PUT | `/api/v1/multi-cloud/resources/:id/tags` | 更新资源标签 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/resources/:id/stop` | 停止资源 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/resources/:id/start` | 启动资源 | `multi_cloud:execute` |
| GET | `/api/v1/multi-cloud/resources/search` | 全文搜索 | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/resources/stats` | 聚合统计 | `multi_cloud:read` |

### 3.3 多云成本

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/multi-cloud/cost` | 成本列表/聚合 | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/cost/summary` | 成本摘要（按维度） | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/cost/trend` | 成本趋势（时序数据） | `multi_cloud:read` |
| POST | `/api/v1/multi-cloud/cost/sync` | 手动同步成本 | `multi_cloud:execute` |
| GET | `/api/v1/multi-cloud/cost/providers/:provider` | 指定提供商成本 | `multi_cloud:read` |

### 3.4 标签治理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/multi-cloud/tag-policies` | 策略列表 | `multi_cloud:read` |
| POST | `/api/v1/multi-cloud/tag-policies` | 创建策略 | `multi_cloud:admin` |
| PUT | `/api/v1/multi-cloud/tag-policies/:id` | 更新策略 | `multi_cloud:admin` |
| DELETE | `/api/v1/multi-cloud/tag-policies/:id` | 删除策略 | `multi_cloud:admin` |
| GET | `/api/v1/multi-cloud/tag-violations` | 违规列表 | `multi_cloud:read` |
| POST | `/api/v1/multi-cloud/tag-violations/:id/fix` | 一键修复 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/tag-violations/:id/ignore` | 忽略违规 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/tag-violations/batch-fix` | 批量修复 | `multi_cloud:execute` |

### 3.5 跨云部署编排

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/multi-cloud/deployments` | 编排列表 | `multi_cloud:read` |
| GET | `/api/v1/multi-cloud/deployments/:id` | 编排详情 | `multi_cloud:read` |
| POST | `/api/v1/multi-cloud/deployments` | 创建编排 | `multi_cloud:admin` |
| PUT | `/api/v1/multi-cloud/deployments/:id` | 更新编排 | `multi_cloud:admin` |
| DELETE | `/api/v1/multi-cloud/deployments/:id` | 删除编排 | `multi_cloud:admin` |
| POST | `/api/v1/multi-cloud/deployments/:id/execute` | 执行编排 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/deployments/:id/terminate` | 终止编排 | `multi_cloud:execute` |
| POST | `/api/v1/multi-cloud/deployments/:id/retry` | 重试失败步骤 | `multi_cloud:execute` |
| GET | `/api/v1/multi-cloud/deployments/:id/logs` | SSE 日志流 | `multi_cloud:read` |

---

## 4. 验收标准

### 4.1 功能验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 云账户创建 | 通过 API 创建 AWS 测试账户 | 账户状态 active，可测试连接 |
| 2 | 资源自动发现 | 触发发现任务 | `cloud_resources` 表新增对应资源记录 |
| 3 | 多云统一搜索 | 搜索关键词 + 多条件过滤 | 返回跨提供商的聚合结果，分页正确 |
| 4 | 成本聚合 | 查看月度成本摘要 | 按提供商/类型正确汇总，数据来自 `multi_cloud_cost` |
| 5 | 标签策略创建 | 创建 required_tag 策略 | 策略存储到 `cloud_tag_policies` |
| 6 | 标签合规扫描 | 手动触发扫描 | 不合规资源写入 `cloud_tag_violations` |
| 7 | 标签一键修复 | 点击修复按钮 | 调用云 API 补标签，违规标记 resolved |
| 8 | 跨云编排创建 | 创建包含 2+ 云的编排 | 存储到 `cross_cloud_deployments` |
| 9 | 跨云编排执行 | 提交执行 | 按 `deployment_order` 逐步执行，SSE 推送日志 |
| 10 | 编排失败处理 | 模拟某一步骤失败 | 状态变 failed，支持重试 |

### 4.2 前端交互验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 页面标题规范 | 检查所有页面 | 使用 `level={2}` + 图标 + Design Token 颜色 |
| 2 | 空状态引导 | 清空数据后访问各页面 | 显示 Empty + 引导按钮 |
| 3 | 异步操作反馈 | 执行创建/删除/发现操作 | 有 loading 状态 + success/error message |
| 4 | 危险操作确认 | 删除账户/终止编排 | Popconfirm 二次确认 |
| 5 | 表单校验 | 提交空表单 | 必填项显示校验错误提示 |
| 6 | 实时日志 | 执行编排时查看日志页 | SSE 连接成功，日志实时追加 |
| 7 | Design Token 使用 | 搜索硬编码色值 | 无硬编码 `#xxx` 色值（除图表颜色） |
| 8 | CRUD 完整性 | 每个实体页面 | 创建、查看、编辑、删除入口齐全 |

### 4.3 后端验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | TypeScript 编译 | `npm run build` | 零 error |
| 2 | ESLint | `npm run lint` | 零 error |
| 3 | 单元测试 | `npm run test` | 覆盖率 >= 80% |
| 4 | RLS 策略 | 切换 tenant_id 查询 | 仅返回当前租户数据 |
| 5 | 错误码规范 | 触发各类错误 | 返回 `CLIENT.4xx.*` 或 `BIZ.*` 格式 |
| 6 | 权限校验 | 无权限角色调用 admin API | 返回 403 + `CLIENT.403.FORBIDDEN` |
| 7 | 迁移文件 | `npm run migrate` | 196 号迁移成功执行，rollback 可用 |
