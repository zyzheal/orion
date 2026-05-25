# 多云管理（Multi-Cloud Management）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P0
> **基于模块**: IaC + 环境管理
> **目标成熟度**: 7/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion IaC 模块和环境管理功能完整，支持多云账户管理和资源清单。
但缺少**多云统一视图、跨云成本分析、跨云编排**等企业级多云管理能力，
当前仅支持单云账户的 CRUD，无法跨云统一搜索、统一成本分析、统一资源编排。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| 多云账户 | ✅ 已有（AWS/Azure/GCP） | `MultiCloudManagerService.ts` |
| 资源清单 | ✅ 已有 | `MultiCloudRepository.ts` |
| 多云控制器 | ✅ 已有 | `MultiCloudController.ts`, `MultiCloudAdvancedController.ts` |
| 统一视图 | ❌ 缺失 | 无跨云聚合视图 |
| 跨云搜索 | ❌ 缺失 | 无法全局搜索资源 |
| 跨云成本 | ❌ 缺失 | 无跨云成本聚合 |
| 跨云编排 | ❌ 缺失 | 无多云联合部署 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 多云概览 | 跨云账户/资源/费用统一聚合视图 | 8.5 |
| 资源搜索 | 全局搜索所有云上的资源 | 8.5 |
| 成本分析 | 跨云成本聚合、对比、趋势 | 8.5 |
| 部署编排 | 跨云资源统一部署/编排 | 8.5 |

---

## 二、功能设计（后端）

### 2.1 多云统一视图

聚合所有云账户的关键指标：
- 账户数（按提供商分类）
- 资源总数（按类型分类）
- 月度总花费（按提供商/服务分类）
- 资源利用率（CPU/内存/存储）
- 异常检测（费用突增、资源闲置）

### 2.2 跨云资源搜索

```typescript
interface CloudResourceSearchResult {
  id: string;
  provider: 'aws' | 'azure' | 'gcp' | 'aliyun';
  accountId: string;
  accountName: string;
  region: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  status: string;
  tags: Record<string, string>;
  monthlyCost: number;
  metadata: Record<string, any>;
}

// 支持的搜索维度
// - 按名称/ID/标签搜索
// - 按资源类型过滤
// - 按提供商过滤
// - 按区域过滤
// - 按费用范围过滤
// - 按标签键值过滤
```

### 2.3 跨云成本分析

```typescript
interface CrossCloudCostAnalysis {
  period: string;
  totalCost: number;
  byProvider: {
    provider: string;
    cost: number;
    percent: number;
    trend: number; // 环比变化
  }[];
  byService: {
    service: string;
    cost: number;
    provider: string;
  }[];
  anomalies: {
    provider: string;
    service: string;
    expectedCost: number;
    actualCost: number;
    deviationPercent: number;
  }[];
  idleResources: {
    provider: string;
    resourceType: string;
    resourceId: string;
    monthlyCost: number;
    reason: string;
  }[];
}
```

### 2.4 跨云部署编排

复用已有的 `CrossDomainOrchestrator` 和 `ReleaseOrchestration`，
增强支持多云资源统一部署：
- 选择多个云账户
- 定义跨云资源依赖
- 按依赖顺序部署
- 部署后跨云健康检查

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 多云统一搜索索引表
CREATE TABLE cloud_resource_index (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  provider        VARCHAR(20) NOT NULL,
  account_id      VARCHAR(36) NOT NULL,
  region          VARCHAR(50) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(200) NOT NULL,
  resource_name   VARCHAR(200),
  status          VARCHAR(30),
  tags            JSONB DEFAULT '{}',
  monthly_cost    DECIMAL(10,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  last_synced_at  TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, provider, resource_id)
);

-- 跨云成本分析缓存表
CREATE TABLE cross_cloud_cost_analysis (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  period          VARCHAR(20) NOT NULL,              -- 2026-05
  total_cost      DECIMAL(12,2) NOT NULL,
  by_provider     JSONB NOT NULL,
  by_service      JSONB NOT NULL,
  anomalies       JSONB DEFAULT '[]',
  idle_resources  JSONB DEFAULT '[]',
  generated_at    TIMESTAMP DEFAULT NOW()
);

-- 跨云部署计划
CREATE TABLE cross_cloud_deployments (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  providers       JSONB NOT NULL,                    -- 涉及的云提供商
  resource_plans  JSONB NOT NULL,                    -- 资源部署计划
  execution_order JSONB NOT NULL,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resource_index_tenant ON cloud_resource_index(tenant_id);
CREATE INDEX idx_resource_index_provider ON cloud_resource_index(provider);
CREATE INDEX idx_resource_index_type ON cloud_resource_index(resource_type);
CREATE INDEX idx_resource_index_tags ON cloud_resource_index USING GIN(tags);
CREATE INDEX idx_cost_tenant_period ON cross_cloud_cost_analysis(tenant_id, period);
CREATE INDEX idx_deployments_tenant ON cross_cloud_deployments(tenant_id);
```

### 3.2 TypeScript 接口

```typescript
interface MultiCloudOverview {
  totalAccounts: number;
  totalResources: number;
  totalMonthlyCost: number;
  accountsByProvider: Record<string, number>;
  resourcesByProvider: Record<string, number>;
  resourcesByType: Record<string, number>;
  costByProvider: Record<string, number>;
  anomalies: CloudAnomaly[];
  idleResources: IdleResource[];
  healthStatus: {
    healthy: number;
    warning: number;
    critical: number;
  };
}

interface CloudAnomaly {
  type: 'cost_spike' | 'resource_idle' | 'permission_change' | 'config_drift';
  provider: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: Date;
}

interface IdleResource {
  provider: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  monthlyCost: number;
  idleReason: string;
  idleDays: number;
}

interface CloudResourceSearchInput {
  query?: string;
  provider?: string;
  resourceType?: string;
  region?: string;
  tags?: Record<string, string>;
  minCost?: number;
  maxCost?: number;
  page: number;
  pageSize: number;
}
```

---

## 四、API 路由设计

### 4.1 端点清单

| 方法 | 路径 | 描述 | 权限 | 响应 |
|------|------|------|------|------|
| **多云概览** |
| GET | `/multicloud/overview` | 多云统一视图 | `multicloud:read` | `{ data: MultiCloudOverview }` |
| GET | `/multicloud/health` | 多云健康状态 | `multicloud:read` | `{ data: { healthy, warning, critical } }` |
| **资源搜索** |
| POST | `/multicloud/resources/search` | 跨云资源搜索 | `multicloud:read` | `{ data: CloudResourceSearchResult[], total }` |
| GET | `/multicloud/resources/stats` | 资源统计 | `multicloud:read` | `{ data: { byProvider, byType, byRegion } }` |
| **成本分析** |
| GET | `/multicloud/cost/analysis` | 跨云成本分析 | `multicloud:read` | query | `{ data: CrossCloudCostAnalysis }` |
| GET | `/multicloud/cost/trend` | 成本趋势 | `multicloud:read` | query | `{ data: { period, cost }[] }` |
| GET | `/multicloud/cost/anomalies` | 费用异常 | `multicloud:read` | query | `{ data: CloudAnomaly[] }` |
| GET | `/multicloud/cost/idle-resources` | 闲置资源 | `multicloud:read` | query | `{ data: IdleResource[], totalSavings }` |
| POST | `/multicloud/cost/analyze` | 触发成本分析 | `multicloud:write` | - | `{ data: CrossCloudCostAnalysis }` |
| **部署编排** |
| POST | `/multicloud/deployments` | 创建跨云部署 | `multicloud:write` | `CrossCloudDeploymentCreate` | `{ data: CrossCloudDeployment }` |
| GET | `/multicloud/deployments` | 部署列表 | `multicloud:read` | query | `{ data: [], total }` |
| GET | `/multicloud/deployments/:id` | 部署详情 | `multicloud:read` | - | `{ data: CrossCloudDeployment }` |
| POST | `/multicloud/deployments/:id/execute` | 执行部署 | `multicloud:execute` | - | `{ data: { status } }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 多云概览 | `/infra/multicloud` | 基础设施 | 账户/资源/费用统一视图 |
| 资源搜索 | `/infra/multicloud/resources` | 基础设施 | 全局搜索/过滤/详情 |
| 成本分析 | `/infra/multicloud/cost` | 基础设施 | 跨云成本/趋势/异常/闲置 |
| 部署编排 | `/infra/multicloud/deployments` | 基础设施 | 跨云资源统一部署 |

### 5.2 多云概览页

**文件**: `orion-frontend/src/pages/MultiCloudOverview/index.tsx`

```tsx
// 第一行: 总账户数 | 总资源数 | 月度总花费 | 健康状态
<Row gutter={spacing.md}>
  <Col span={6}>
    <Card title="云账户" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={overview.totalAccounts} suffix="个" />
      <Text type="secondary" style={{ fontSize: 12 }}>
        AWS: {overview.accountsByProvider.aws || 0} |
        Azure: {overview.accountsByProvider.azure || 0} |
        GCP: {overview.accountsByProvider.gcp || 0}
      </Text>
    </Card>
  </Col>
  <Col span={6}>
    <Card title="云资源" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={overview.totalResources} suffix="个" />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="月度花费" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={overview.totalMonthlyCost} prefix="$" precision={2} />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="健康状态" style={{ borderRadius: componentRadius.card }}>
      <Row gutter={8}>
        <Col span={8}><Badge status="success" text={`正常 ${overview.healthStatus.healthy}`} /></Col>
        <Col span={8}><Badge status="warning" text={`警告 ${overview.healthStatus.warning}`} /></Col>
        <Col span={8}><Badge status="error" text={`异常 ${overview.healthStatus.critical}`} /></Col>
      </Row>
    </Card>
  </Col>
</Row>

// 第二行: 资源分布饼图 + 成本分布柱状图
```

### 5.3 资源搜索页

**文件**: `orion-frontend/src/pages/MultiCloudResources/index.tsx`

```tsx
// 搜索表单
<Form layout="inline" onFinish={handleSearch}>
  <Form.Item name="query">
    <Input placeholder="搜索资源名称/ID/标签" style={{ width: 300 }} />
  </Form.Item>
  <Form.Item name="provider">
    <Select placeholder="云提供商" style={{ width: 120 }} allowClear>
      <Option value="aws">AWS</Option>
      <Option value="azure">Azure</Option>
      <Option value="gcp">GCP</Option>
      <Option value="aliyun">阿里云</Option>
    </Select>
  </Form.Item>
  <Form.Item name="resourceType">
    <Select placeholder="资源类型" style={{ width: 140 }} allowClear>
      <Option value="ec2">EC2/VM</Option>
      <Option value="rds">RDS/DB</Option>
      <Option value="s3">存储</Option>
      <Option value="eks">K8s</Option>
    </Select>
  </Form.Item>
  <Form.Item>
    <Button type="primary" htmlType="submit" loading={loading}>搜索</Button>
  </Form.Item>
</Form>

// 搜索结果表格
<Table dataSource={results} rowKey="resourceId" loading={loading}>
  <Column title="提供商" dataIndex="provider" width={80}
    render={(v: string) => <Tag>{v.toUpperCase()}</Tag>} />
  <Column title="账户" dataIndex="accountName" width={120} />
  <Column title="区域" dataIndex="region" width={100} />
  <Column title="类型" dataIndex="resourceType" width={100} />
  <Column title="名称" dataIndex="resourceName" ellipsis />
  <Column title="月度费用" dataIndex="monthlyCost" width={100}
    render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="操作" render={(_: any, r: CloudResourceSearchResult) => (
    <Button type="link" size="small" onClick={() => navigate(`/infra/multicloud/resources/${r.id}`)}>
      详情
    </Button>
  )} />
</Table>
```

### 5.4 成本分析页

**文件**: `orion-frontend/src/pages/MultiCloudCost/index.tsx`

```tsx
// 闲置资源列表 + 预估节省金额
<Alert message={`发现 {idleResources.length} 个闲置资源，预计可节省 $${totalSavings.toFixed(2)}/月`}
  type="warning" showIcon style={{ marginBottom: spacing.md }} />

<Table dataSource={idleResources} rowKey="resourceId">
  <Column title="提供商" dataIndex="provider" />
  <Column title="资源类型" dataIndex="resourceType" />
  <Column title="资源ID" dataIndex="resourceId" />
  <Column title="月度费用" dataIndex="monthlyCost" render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="闲置原因" dataIndex="idleReason" />
  <Column title="闲置天数" dataIndex="idleDays" render={(v: number) => `${v} 天`} />
  <Column title="操作" render={(_: any, r: IdleResource) => (
    <Popconfirm title="确认终止此闲置资源？" onConfirm={() => handleTerminate(r.resourceId)}>
      <Button type="link" size="small" danger>终止</Button>
    </Popconfirm>
  )} />
</Table>
```

---

## 六、权限模型

| 角色 | 查看概览 | 搜索资源 | 查看成本 | 创建部署 |
|------|:--------:|:--------:|:--------:|:--------:|
| Viewer | ✅ | ✅ | - | - |
| Member | ✅ | ✅ | ✅ | - |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'multicloud', action: 'read' | 'write' | 'execute' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| AWS SDK | AWS 资源查询/操作 | ✅ 已有 |
| Azure SDK | Azure 资源查询/操作 | ⚠️ 需确认 |
| GCP SDK | GCP 资源查询/操作 | ⚠️ 需确认 |
| FinOps CostService | 成本数据聚合 | ✅ 已有 |
| IaC 引擎 | 跨云资源编排 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 健康状态 | `colors.success[500]` |
| 警告状态 | `colors.warning[500]` |
| 异常状态 | `colors.error[500]` |
| 云提供商 Tag | `colors.primary[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 查看多云概览 | 显示所有云账户/资源/费用的聚合数据 |
| E2 | 跨云搜索资源 | 输入名称/标签后返回所有提供商的匹配资源 |
| E3 | 按提供商/类型过滤搜索 | 过滤结果正确缩小 |
| E4 | 查看跨云成本分析 | 显示按提供商/服务分类的费用分布 |
| E5 | 查看闲置资源并终止 | 终止后资源从列表移除 |
| E6 | 费用异常告警 | 异常检测正确触发并展示 |
| E7 | 创建跨云部署 | 选择多个云账户，定义资源计划 |
| E8 | 执行跨云部署 | 按依赖顺序在各云部署资源 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 概览加载时间 | < 2s (p95) |
| 资源搜索响应时间 | < 1s |
| 成本分析生成时间 | < 5s |
| 跨云部署创建时间 | < 2s |
| 前端单元测试覆盖率 | > 75% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
