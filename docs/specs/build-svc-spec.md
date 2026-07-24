# Spec: 构建服务 (Build)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: CI/CD 构建
> **目标成熟度**: L2 → L2.5
> **关键交付**: 构建生命周期管理、制品管理、构建环境配置、统计

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-build-svc-go`）：
- 构建 CRUD（BuildService + BuildRepository）
- 构建生命周期：trigger / cancel / retry
- 构建状态追踪（pending/running/success/failed/cancelled）
- 构建日志存储与查询
- 制品 CRUD（ArtifactService + ArtifactRepository）
- 制品下载计数与过期清理
- 构建环境 CRUD（BuildEnvironment）
- 构建统计（BuildStats：总数/成功/失败/平均耗时）
- 按 Pipeline Run 关联查询构建
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无构建触发 Webhook 集成
- 无构建缓存机制
- 无构建并行/依赖编排
- 无构建资源配额限制
- 无构建审批流程
- 无构建模板/复用
- 无构建性能趋势分析
- 无制品签名/校验

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 构建 Webhook | 代码推送自动触发构建 | L2 |
| 构建缓存 | 层缓存/依赖缓存加速 | L2.5 |
| 构建模板 | 预置构建模板、参数化 | L2 |
| 构建审批 | 生产环境构建需审批 | L2 |
| 制品签名 | 制品 SHA256 校验 + 签名 | L2 |
| 性能趋势 | 构建耗时趋势/成功率趋势 | L2 |
| 资源配额 | 租户/项目构建并发限制 | L2 |

## 二、验收标准

### 2.1 构建基础流程

| # | 标准 | 验证方式 |
|---|------|----------|
| B1 | 支持创建构建记录（branch/commit/image/tag） | API 测试 |
| B2 | 构建状态流转：pending → running → success/failed/cancelled | API 测试 |
| B3 | 支持 trigger 启动构建 | API 测试 |
| B4 | 支持 cancel 取消构建 | API 测试 |
| B5 | 支持 retry 重试失败构建 | API 测试 |
| B6 | 多租户隔离：每个租户的构建独立 | 集成测试 |
| B7 | 构建记录含操作人/项目/PipelineRun 关联 | API 测试 |

### 2.2 构建日志与状态

| # | 标准 | 验证方式 |
|---|------|----------|
| B8 | 支持查询构建日志（按构建 ID） | API 测试 |
| B9 | 构建状态实时可查（GetBuildStatus） | API 测试 |
| B10 | 构建耗时自动计算（started_at → completed_at） | 单元测试 |
| B11 | 构建失败记录 error_message | API 测试 |

### 2.3 构建环境

| # | 标准 | 验证方式 |
|---|------|----------|
| B12 | 支持创建构建环境（name/type/image/config） | API 测试 |
| B13 | 构建环境可启用/禁用 | API 测试 |
| B14 | 构建环境 CRUD 完整 | API 测试 |
| B15 | 多租户隔离 | 集成测试 |

### 2.4 制品管理

| # | 标准 | 验证方式 |
|---|------|----------|
| B16 | 支持创建制品记录（name/type/storage_path/run_id） | API 测试 |
| B17 | 制品按 run_id/stage_id/type 筛选 | API 测试 |
| B18 | 制品下载计数自动递增 | API 测试 |
| B19 | 支持过期制品清理（CleanupExpiredArtifacts） | API 测试 |
| B20 | 支持按 PipelineRun 清理制品 | API 测试 |
| B21 | 制品 SHA256 校验支持 | API 测试 |

### 2.5 统计与查询

| # | 标准 | 验证方式 |
|---|------|----------|
| B22 | 构建统计：总数/成功/失败/运行中/待处理 | API 测试 |
| B23 | 平均构建耗时统计 | API 测试 |
| B24 | 按 PipelineRun 查询关联构建 | API 测试 |
| B25 | 构建列表分页（page/page_size） | API 测试 |

## 三、API 设计

```
Base: /api/v1
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/builds` | 创建构建 |
| GET | `/builds` | 构建列表（含筛选） |
| GET | `/builds/stats` | 构建统计 |
| GET | `/builds/count` | 构建总数 |
| GET | `/builds/pipeline-run/:runId` | 按 PipelineRun 查询 |
| GET | `/builds/:id` | 构建详情 |
| PUT | `/builds/:id` | 更新构建 |
| DELETE | `/builds/:id` | 删除构建 |
| POST | `/builds/:id/trigger` | 触发构建 |
| GET | `/builds/:id/status` | 构建状态 |
| POST | `/builds/:id/cancel` | 取消构建 |
| POST | `/builds/:id/retry` | 重试构建 |
| GET | `/builds/:id/logs` | 构建日志 |
| GET | `/environments` | 环境列表 |
| POST | `/environments` | 创建环境 |
| GET | `/environments/:id` | 环境详情 |
| PUT | `/environments/:id` | 更新环境 |
| DELETE | `/environments/:id` | 删除环境 |
| GET | `/artifacts` | 制品列表 |
| POST | `/artifacts` | 创建制品 |
| GET | `/artifacts/:id` | 制品详情 |
| DELETE | `/artifacts/:id` | 删除制品 |
| POST | `/artifacts/:id/download` | 记录下载 |
| POST | `/artifacts/cleanup` | 清理过期制品 |
| DELETE | `/artifacts/run/:runId` | 按 Run 清理制品 |

## 四、数据模型

```sql
-- 构建记录
CREATE TABLE IF NOT EXISTS builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    repo_id UUID,
    branch VARCHAR(255),
    commit_sha VARCHAR(40),
    status VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    logs TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builds_tenant_id ON builds (tenant_id);

-- 构建扩展字段（Node.js 对齐）
ALTER TABLE builds ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS pipeline_run_id UUID;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS image VARCHAR(500);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS tag VARCHAR(255);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS build_args JSONB DEFAULT '{}';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_builds_pipeline_run_id ON builds (pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds (status);

-- 构建环境
CREATE TABLE IF NOT EXISTS build_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    image VARCHAR(500) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_build_environments_tenant_id ON build_environments (tenant_id);

-- 制品
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(100) NOT NULL,
    storage_type VARCHAR(50) DEFAULT 'local',
    storage_path VARCHAR(1000) NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    run_id UUID NOT NULL,
    stage_id UUID,
    expires_at TIMESTAMP,
    downloaded_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_id ON artifacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts (run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_stage_id ON artifacts (stage_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires_at ON artifacts (expires_at) WHERE expires_at IS NOT NULL;
```

## 五、前端设计

**路由**: `/build`

主要页面：
- 构建列表页：按项目/状态/分支筛选，分页
- 构建详情页：状态/日志/关联制品/操作按钮（trigger/cancel/retry）
- 构建环境管理页：环境列表/创建/编辑
- 制品管理页：制品列表/下载/清理
- 统计页：构建量/成功率/平均耗时图表

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | BuildService、EnvironmentService、ArtifactService |
| 集成测试 | 6 | 创建→trigger→cancel→retry→success→制品闭环 |
| 前端测试 | 4 | 构建列表、详情、环境管理、制品管理 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
