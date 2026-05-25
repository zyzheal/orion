# MLOps 平台模块完整设计

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：`orion-upgrade-executable-plan-2026-05-22.md` Section 11.6 — 迁移 186

---

## 1. 功能设计（后端）

### 1.1 业务闭环

MLOps 模块实现"数据集准备 → 模型定义 → 训练任务 → 评估 → 注册 → 部署 → 推理监控"七步闭环：

```
数据集/特征
    │
    ▼
模型定义 ──► ml_models
    │
    ▼
训练任务提交 ──► ml_training_jobs
    │
    ▼ (epoch/loss/accuracy 进度跟踪)
训练执行 ──► 检查点保存
    │
    ▼
模型评估 ──► accuracy/precision/recall/F1/AUC
    │
    ▼
模型注册 ──► 版本管理（语义化版本、回滚）
    │
    ▼
模型部署 ──► API 端点（灰度/蓝绿）
    │
    ▼
推理监控 ──► 延迟/吞吐量/准确率漂移
```

### 1.2 模型管理

**模型注册表**：每个模型包含名称、框架（PyTorch/TensorFlow/Sklearn/XGBoost）、描述、Owner、状态（draft/staging/production/deprecated）。

**版本管理**：
- 语义化版本 `v{major}.{minor}.{patch}`
- 每次训练完成自动生成新版本
- 支持版本回滚（production 版本回滚到 staging）
- 版本血缘：训练任务 ID → 特征集 → 数据集

**模型血缘**：`ml_models` 表通过 `training_job_id` 关联 `ml_training_jobs`，通过 `feature_set_id` 关联 `ml_feature_stores`，形成完整血缘链。

### 1.3 训练任务

**训练提交**：
- 框架选择：PyTorch / TensorFlow / Sklearn / XGBoost
- 超参数：JSONB 存储，支持任意结构
- 资源需求：CPU 核数、内存 GB、GPU 数量
- 训练数据集引用（数据管道 ID 或 S3 路径）
- 特征集引用（可选）

**训练进度跟踪**：
- 实时推送 epoch/loss/accuracy 到前端（SSE）
- 训练状态：pending → queued → running → completed / failed / cancelled
- 检查点：每 N 个 epoch 保存一次，支持从检查点恢复

**训练失败处理**：
- 自动重试（最多 2 次）
- 失败原因记录（OOM / timeout / data_error / code_error）
- 通知训练 Owner

### 1.4 特征存储

**特征定义**：
- 名称（唯一，`{entity}_{feature_name}` 命名规范）
- 类型：numeric / categorical / timestamp / embedding / text
- 计算逻辑：SQL 表达式或 Python 函数引用
- 数据源：表名 / 查询语句
- 刷新策略：realtime / hourly / daily

**特征计算与缓存**：
- 按需计算 + 缓存（Redis）
- 缓存 TTL 可配置
- 批量预计算（定时任务）

**特征版本管理**：
- 特征定义变更自动创建新版本
- 向后兼容性检查
- 历史版本可回溯

**特征复用与发现**：
- 按标签搜索特征
- 按使用频率排序
- 特征相似度推荐

### 1.5 模型评估

**评估指标**：
| 任务类型 | 指标 |
|---------|------|
| 分类 | accuracy, precision, recall, F1, AUC, confusion_matrix |
| 回归 | MSE, RMSE, MAE, R2 |
| 排序 | NDCG, MAP, MRR |

**多模型对比**：
- 同一数据集上多个模型的指标对比表
- 可视化雷达图
- 统计显著性检验

**A/B 测试支持**：
- 将两个模型版本分配流量比例
- 收集线上指标
- 自动判定胜出模型

### 1.6 模型部署

**一键部署**：
- 选择模型版本 → 选择部署环境 → 自动生成推理 API 端点
- 端点格式：`https://{gateway}/api/v1/models/{model_id}/predict`

**灰度发布**：
- 设置流量比例（如 v1.0: 90%, v1.1: 10%）
- 自动监控两组指标差异
- 异常时自动回滚

**蓝绿部署**：
- 新版本部署到独立实例
- 健康检查通过后切换流量
- 保留旧版本作为回滚目标

**推理监控**：
- 延迟 P50/P95/P99
- 吞吐量（QPS）
- 准确率漂移检测（输入分布变化 → 预测质量下降告警）

### 1.7 外部依赖

| 依赖 | 用途 | 已有 |
|------|------|------|
| 通知服务 | 训练完成/失败通知 | ✅ NotificationService |
| SSE 推送 | 训练进度实时推送 | ✅ SSE 基础设施 |
| Redis | 特征缓存 | ✅ 已有 |
| K8s API | 训练资源调度 | ✅ 已有 |
| AI 推理服务 | 模型部署后的推理端点 | ✅ orion-ai-service |
| 数据管道 | 训练数据集获取 | ✅ data_pipelines(100) |

### 1.8 权限模型

| 角色 | 创建模型 | 发起训练 | 部署模型 | 管理特征 | 查看 |
|------|---------|---------|---------|---------|------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| ML Engineer | ✅ | ✅ | ✅（staging）| ✅ | ✅ |
| Data Scientist | ✅ | ✅ | ❌ | 读 | ✅ |
| Viewer | ❌ | ❌ | ❌ | ❌ | 读 |

---

## 2. 数据库设计（迁移 186）

### 2.1 ml_models

```sql
-- 186_create_mlops_tables.sql — 模型注册表
CREATE TABLE IF NOT EXISTS ml_models (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  framework         VARCHAR(50) NOT NULL,            -- pytorch, tensorflow, sklearn, xgboost
  version           VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
  status            VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, staging, production, deprecated
  owner             VARCHAR(100),
  tags              JSONB NOT NULL DEFAULT '{}',
  training_job_id   UUID,
  feature_set_id    UUID,
  artifact_path     VARCHAR(500),                    -- S3/对象存储路径
  metrics           JSONB NOT NULL DEFAULT '{}',     -- {accuracy, precision, recall, f1, auc}
  deployment_url    VARCHAR(500),
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ml_models ON ml_models USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_ml_models_tenant ON ml_models(tenant_id);
CREATE INDEX idx_ml_models_status ON ml_models(status);
CREATE INDEX idx_ml_models_framework ON ml_models(framework);
CREATE INDEX idx_ml_models_version ON ml_models(version);
ALTER TABLE ml_models ADD CONSTRAINT chk_ml_models_framework
  CHECK (framework IN ('pytorch', 'tensorflow', 'sklearn', 'xgboost'));
ALTER TABLE ml_models ADD CONSTRAINT chk_ml_models_status
  CHECK (status IN ('draft', 'staging', 'production', 'deprecated'));
```

### 2.2 ml_training_jobs

```sql
-- 训练任务表
CREATE TABLE IF NOT EXISTS ml_training_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model_id          UUID REFERENCES ml_models(id) ON DELETE SET NULL,
  name              VARCHAR(200) NOT NULL,
  framework         VARCHAR(50) NOT NULL,
  hyperparameters   JSONB NOT NULL DEFAULT '{}',
  resource_config   JSONB NOT NULL DEFAULT '{}',     -- {cpu_cores, memory_gb, gpu_count}
  dataset_ref       VARCHAR(500),
  feature_set_ids   UUID[] DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, queued, running, completed, failed, cancelled
  current_epoch     INT NOT NULL DEFAULT 0,
  total_epochs      INT NOT NULL,
  current_loss      DECIMAL(10,6),
  current_accuracy  DECIMAL(5,4),
  checkpoint_path   VARCHAR(500),
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE ml_training_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ml_training_jobs ON ml_training_jobs USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_ml_training_jobs_tenant ON ml_training_jobs(tenant_id);
CREATE INDEX idx_ml_training_jobs_model ON ml_training_jobs(model_id);
CREATE INDEX idx_ml_training_jobs_status ON ml_training_jobs(status);
CREATE INDEX idx_ml_training_jobs_time ON ml_training_jobs(created_at DESC);
ALTER TABLE ml_training_jobs ADD CONSTRAINT chk_ml_training_jobs_status
  CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled'));
```

### 2.3 ml_feature_stores

```sql
-- 特征存储表
CREATE TABLE IF NOT EXISTS ml_feature_stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  feature_type      VARCHAR(30) NOT NULL,            -- numeric, categorical, timestamp, embedding, text
  entity_type       VARCHAR(100),                    -- user, item, transaction, etc.
  computation_logic JSONB NOT NULL DEFAULT '{}',     -- {sql, python_func}
  data_source       VARCHAR(500),
  refresh_strategy  VARCHAR(30) NOT NULL DEFAULT 'daily', -- realtime, hourly, daily, weekly
  cache_ttl_seconds INT NOT NULL DEFAULT 3600,
  version           VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
  usage_count       INT NOT NULL DEFAULT 0,
  tags              JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  deleted_at        TIMESTAMPTZ
);
ALTER TABLE ml_feature_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ml_feature_stores ON ml_feature_stores USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE INDEX idx_ml_feature_stores_tenant ON ml_feature_stores(tenant_id);
CREATE INDEX idx_ml_feature_stores_type ON ml_feature_stores(feature_type);
CREATE INDEX idx_ml_feature_stores_entity ON ml_feature_stores(entity_type);
CREATE INDEX idx_ml_feature_stores_usage ON ml_feature_stores(usage_count DESC);
ALTER TABLE ml_feature_stores ADD CONSTRAINT chk_ml_feature_stores_type
  CHECK (feature_type IN ('numeric', 'categorical', 'timestamp', 'embedding', 'text'));
ALTER TABLE ml_feature_stores ADD CONSTRAINT chk_ml_feature_stores_refresh
  CHECK (refresh_strategy IN ('realtime', 'hourly', 'daily', 'weekly'));
```

### 2.4 Rollback SQL

```sql
-- 186_create_mlops_tables-rollback.sql
DROP TABLE IF EXISTS ml_feature_stores CASCADE;
DROP TABLE IF EXISTS ml_training_jobs CASCADE;
DROP TABLE IF EXISTS ml_models CASCADE;
```

---

## 3. API 设计

### 3.1 后端路由（mlops-routes.ts）

| Method | Path | 权限 | 描述 |
|--------|------|------|------|
| GET | `/v1/mlops/models` | 查看 | 模型列表（搜索/过滤/分页） |
| POST | `/v1/mlops/models` | 创建 | 创建模型 |
| GET | `/v1/mlops/models/:id` | 查看 | 模型详情 |
| PATCH | `/v1/mlops/models/:id` | 编辑 | 更新模型信息 |
| DELETE | `/v1/mlops/models/:id` | Admin | 删除模型 |
| POST | `/v1/mlops/models/:id/promote` | Admin | 提升状态（draft→staging→production） |
| GET | `/v1/mlops/training` | 查看 | 训练任务列表 |
| POST | `/v1/mlops/training` | 发起训练 | 创建训练任务 |
| GET | `/v1/mlops/training/:id` | 查看 | 训练详情 |
| POST | `/v1/mlops/training/:id/cancel` | 发起训练 | 取消训练 |
| POST | `/v1/mlops/training/:id/resume` | 发起训练 | 从检查点恢复 |
| GET | `/v1/mlops/training/:id/stream` | 查看 | SSE 进度推送 |
| GET | `/v1/mlops/features` | 查看 | 特征列表 |
| POST | `/v1/mlops/features` | 管理特征 | 创建特征 |
| GET | `/v1/mlops/features/:id` | 查看 | 特征详情 |
| PATCH | `/v1/mlops/features/:id` | 管理特征 | 更新特征 |
| GET | `/v1/mlops/features/search` | 查看 | 特征搜索（按标签/实体/类型） |
| GET | `/v1/mlops/compare` | 查看 | 多模型对比（传入 model IDs） |
| POST | `/v1/mlops/deploy` | 部署 | 部署模型 |
| GET | `/v1/mlops/deployments/:modelId` | 查看 | 模型部署信息 |
| PATCH | `/v1/mlops/deployments/:id/canary` | 部署 | 调整灰度流量 |
| POST | `/v1/mlops/deployments/:id/rollback` | 部署 | 回滚部署 |

### 3.2 前端 API 客户端（api/mlops.ts）

```typescript
// 模型
export const getModels = (params: ListParams) => api.get('/v1/mlops/models', { params });
export const createModel = (data: CreateModelInput) => api.post('/v1/mlops/models', data);
export const getModel = (id: string) => api.get(`/v1/mlops/models/${id}`);
export const updateModel = (id: string, data: UpdateModelInput) => api.patch(`/v1/mlops/models/${id}`, data);
export const deleteModel = (id: string) => api.delete(`/v1/mlops/models/${id}`);
export const promoteModel = (id: string, targetStatus: string) =>
  api.post(`/v1/mlops/models/${id}/promote`, { status: targetStatus });

// 训练
export const getTrainingJobs = (params: ListParams) => api.get('/v1/mlops/training', { params });
export const createTrainingJob = (data: CreateTrainingInput) => api.post('/v1/mlops/training', data);
export const getTrainingJob = (id: string) => api.get(`/v1/mlops/training/${id}`);
export const cancelTraining = (id: string) => api.post(`/v1/mlops/training/${id}/cancel`);
export const resumeTraining = (id: string) => api.post(`/v1/mlops/training/${id}/resume`);

// 特征
export const getFeatures = (params: ListParams) => api.get('/v1/mlops/features', { params });
export const createFeature = (data: CreateFeatureInput) => api.post('/v1/mlops/features', data);
export const searchFeatures = (query: string) => api.get('/v1/mlops/features/search', { params: { q: query } });
export const updateFeature = (id: string, data: UpdateFeatureInput) => api.patch(`/v1/mlops/features/${id}`, data);

// 部署
export const deployModel = (data: DeployInput) => api.post('/v1/mlops/deploy', data);
export const getDeployment = (modelId: string) => api.get(`/v1/mlops/deployments/${modelId}`);
export const updateCanary = (id: string, trafficRatio: number) =>
  api.patch(`/v1/mlops/deployments/${id}/canary`, { traffic_ratio: trafficRatio });
export const rollbackDeployment = (id: string) => api.post(`/v1/mlops/deployments/${id}/rollback`);

// 对比
export const compareModels = (modelIds: string[]) => api.get('/v1/mlops/compare', { params: { ids: modelIds.join(',') } });
```

---

## 4. 页面交互设计（前端）

### 4.1 模型列表（/mlops/models）

```tsx
// 页面标题
<Title level={2} style={{ marginBottom: 8 }}>
  <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  模型管理
</Title>
<Typography.Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: 16, display: 'block' }}>
  管理机器学习模型的全生命周期
</Typography.Text>

// 操作栏
<Space style={{ marginBottom: spacing.md }}>
  <Input.Search placeholder="搜索模型名称" onSearch={handleSearch} style={{ width: 240 }} />
  <Select value={filterFramework} onChange={setFilterFramework} style={{ width: 140 }}>
    <Option value="all">全部框架</Option>
    <Option value="pytorch">PyTorch</Option>
    <Option value="tensorflow">TensorFlow</Option>
    <Option value="sklearn">Sklearn</Option>
    <Option value="xgboost">XGBoost</Option>
  </Select>
  <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
    <Option value="all">全部状态</Option>
    <Option value="draft">草稿</Option>
    <Option value="staging">预发</Option>
    <Option value="production">生产</Option>
  </Select>
  <Button type="primary" onClick={handleCreate}>创建模型</Button>
</Space>

// 表格
<Table
  columns={[
    { title: '名称', dataIndex: 'name', render: (text, r) => <a onClick={() => navigate(`/mlops/models/${r.id}`)}>{text}</a> },
    { title: '框架', dataIndex: 'framework', render: (v) => <Tag>{v}</Tag> },
    { title: '版本', dataIndex: 'version' },
    { title: '状态', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'AUC', dataIndex: ['metrics', 'auc'] },
    { title: '创建人', dataIndex: 'created_by' },
    { title: '更新时间', dataIndex: 'updated_at', render: formatTime },
    { title: '操作', render: (_, r) => (
      <Space>
        <Button size="small" onClick={() => handlePromote(r.id)}>提升</Button>
        <Button size="small" onClick={() => handleDeploy(r.id)}>部署</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
      </Space>
    )}
  ]}
  dataSource={models}
  loading={loading}
  rowHeight={48}
/>

// 空状态
{!loading && models?.length === 0 && (
  <Empty description="暂无模型" extra={<Button type="primary" onClick={handleCreate}>创建第一个模型</Button>} />
)}
```

### 4.2 训练任务列表（/mlops/training）

```tsx
// 状态 Tag 颜色映射
const statusColors = { pending: 'default', queued: 'processing', running: 'blue', completed: 'success', failed: 'error', cancelled: 'warning' };

// 表格列
columns={[
  { title: '任务名称', dataIndex: 'name', render: (t, r) => <a onClick={() => navigate(`/mlops/training/${r.id}`)}>{t}</a> },
  { title: '模型', dataIndex: ['model', 'name'] },
  { title: '框架', dataIndex: 'framework' },
  { title: '状态', dataIndex: 'status', render: (v) => <Tag color={statusColors[v]}>{v}</Tag> },
  { title: '进度', dataIndex: 'progress', render: (_, r) => (
    <Progress percent={Math.round((r.current_epoch / r.total_epochs) * 100)} size="small" />
  )},
  { title: 'Loss', dataIndex: 'current_loss', render: (v) => v?.toFixed(4) },
  { title: 'Accuracy', dataIndex: 'current_accuracy', render: (v) => v?.toFixed(4) },
  { title: '创建时间', dataIndex: 'created_at', render: formatTime },
  { title: '操作', render: (_, r) => r.status === 'running' && (
    <Popconfirm title="确认取消训练？" onConfirm={() => handleCancel(r.id)}>
      <Button size="small" danger>取消</Button>
    </Popconfirm>
  )}
]}
```

### 4.3 训练任务详情（/mlops/training/:id）

```tsx
// 训练进度卡片
<Card title="训练进度" style={{ marginBottom: spacing.md }}>
  <Descriptions column={3}>
    <Descriptions.Item label="当前 Epoch">{job.current_epoch} / {job.total_epochs}</Descriptions.Item>
    <Descriptions.Item label="Loss">{job.current_loss?.toFixed(6)}</Descriptions.Item>
    <Descriptions.Item label="Accuracy">{job.current_accuracy?.toFixed(4)}</Descriptions.Item>
  </Descriptions>
  <Progress percent={Math.round((job.current_epoch / job.total_epochs) * 100)} />
</Card>

// 训练曲线图（使用 Recharts）
<Card title="训练曲线">
  <LineChart data={trainingMetrics}>
    <XAxis dataKey="epoch" />
    <YAxis />
    <Line type="monotone" dataKey="loss" stroke={colors.error[500]} />
    <Line type="monotone" dataKey="accuracy" stroke={colors.success[500]} />
  </LineChart>
</Card>

// 日志
<Card title="训练日志">
  <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
    {trainingLogs.map(l => `${l.timestamp} [${l.level}] ${l.message}`).join('\n')}
  </pre>
</Card>
```

### 4.4 模型详情（/mlops/models/:id）

```tsx
// Tab 布局
<Tabs items={[
  { key: 'info', label: '模型信息', children: <ModelInfo model={model} /> },
  { key: 'versions', label: '版本历史', children: <VersionList versions={versions} /> },
  { key: 'performance', label: '性能指标', children: <MetricsChart metrics={model.metrics} /> },
  { key: 'lineage', label: '血缘', children: <LineageGraph model={model} /> },
  { key: 'deployment', label: '部署', children: <DeploymentStatus model={model} /> },
]} />
```

### 4.5 特征存储（/mlops/features）

```tsx
// 搜索栏
<Space style={{ marginBottom: spacing.md }}>
  <Input.Search placeholder="搜索特征名称/标签" onSearch={handleSearch} style={{ width: 280 }} />
  <Select value={filterType} onChange={setFilterType} style={{ width: 130 }}>
    <Option value="all">全部类型</Option>
    <Option value="numeric">数值</Option>
    <Option value="categorical">分类</Option>
    <Option value="embedding">向量</Option>
  </Select>
  <Button type="primary" onClick={handleCreate}>创建特征</Button>
</Space>

// 表格按使用频率排序
<Table columns={[
  { title: '名称', dataIndex: 'name', render: (t, r) => <a onClick={() => navigate(`/mlops/features/${r.id}`)}>{t}</a> },
  { title: '类型', dataIndex: 'feature_type', render: (v) => <Tag>{v}</Tag> },
  { title: '实体', dataIndex: 'entity_type' },
  { title: '刷新策略', dataIndex: 'refresh_strategy', render: (v) => <Tag>{v}</Tag> },
  { title: '使用次数', dataIndex: 'usage_count', sorter: true, render: (v) => <Tag color={v > 10 ? 'green' : 'default'}>{v}</Tag> },
  { title: '版本', dataIndex: 'version' },
  { title: '操作', render: renderActions }
]} />
```

### 4.6 模型对比（/mlops/compare）

```tsx
// 选择对比模型
<Card title="选择对比模型">
  <Select mode="multiple" placeholder="选择 2-5 个模型进行对比" onChange={setSelectedModels}>
    {models.map(m => <Option key={m.id} value={m.id}>{m.name} ({m.version})</Option>)}
  </Select>
</Card>

// 指标对比表
<Card title="指标对比">
  <Table columns={[
    { title: '指标', dataIndex: 'metric' },
    ...selectedModels.map(m => ({ title: m.name, dataIndex: m.id }))
  ]} dataSource={metricsComparison} />
</Card>
```

### 4.7 模型部署（/mlops/deployments）

```tsx
// 灰度控制
<Card title="灰度流量控制">
  <Slider value={canaryRatio} onChange={setCanaryRatio} marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} />
  <Space>
    <Tag color="blue">v{currentVersion} ({100 - canaryRatio}%)</Tag>
    <Tag color="green">v{canaryVersion} ({canaryRatio}%)</Tag>
  </Space>
  <Button type="primary" onClick={handleUpdateCanary} style={{ marginTop: spacing.sm }}>应用</Button>
</Card>

// 回滚按钮
<Button danger onClick={handleRollback} icon={<RollbackOutlined />}>回滚到上一版本</Button>
```

---

## 5. 验收标准

### 5.1 端到端场景

| 编号 | 场景 | 预期结果 |
|------|------|---------|
| E2E-01 | 创建训练任务 → 执行 → 查看进度 | 任务状态从 pending→running，进度条实时更新 |
| E2E-02 | 训练完成 → 自动评估 | 评估指标写入 metrics 字段，任务状态 completed |
| E2E-03 | 评估通过 → 注册模型 | 模型状态变为 staging |
| E2E-04 | 模型部署 → 灰度发布 | 端点生成，流量可调整 |
| E2E-05 | 异常流量 → 回滚 | 一键回滚到上一版本 |
| E2E-06 | 创建特征 → 搜索 → 复用 | 特征可在模型训练时被引用 |
| E2E-07 | 多模型对比 | 指标表格正确显示 |
| E2E-08 | 训练失败 → 通知 | 训练 Owner 收到通知 |
| E2E-09 | 取消训练 → 从检查点恢复 | 任务状态 cancelled，恢复后可继续 |
| E2E-10 | 模型从 staging 提升到 production | 状态正确流转，旧 production 版本自动变为 deprecated |

### 5.2 量化指标

| 指标 | 目标 |
|------|------|
| 训练任务创建延迟 | < 5s |
| 训练进度推送延迟 | < 2s（SSE） |
| 模型对比查询延迟 | < 500ms |
| 特征搜索延迟 | < 200ms |
| 模型部署延迟 | < 30s |
| 页面加载时间 | < 2s |

### 5.3 前端交互完整性

| 检查项 | 页面 | 状态 |
|--------|------|------|
| 标题 level={2} + 图标 | 全部 7 页面 | 遵循 |
| 空状态 + 引导按钮 | 列表页 4 个 | 遵循 |
| loading 状态 | 全部异步操作 | 遵循 |
| message.success/error | 全部异步操作 | 遵循 |
| 删除 Popconfirm | 模型/特征删除 | 遵循 |
| Design Token | 全部页面 | 遵循 |

### 5.4 工作量估算

| 阶段 | 工作量 |
|------|--------|
| 后端（3 张表 + 22 API + Service 层） | ~8 天 |
| 前端（7 页面 + API 客户端） | ~10 天 |
| 联调测试 | ~4 天 |
| **合计** | **~22 天（约 1 人月）** |

---

*文档生成时间：2026-05-22*
*关联：`orion-upgrade-executable-plan-2026-05-22.md` Section 11.6*
