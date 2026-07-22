# Spec: 工具管理 (Tool)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 工具管理
> **目标成熟度**: L1 → L2
> **关键交付**: 工具注册、版本管理、分类、调用追踪、使用统计

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-tool-svc-go`）：
- 工具 CRUD（ToolService + ToolRepository）
- 工具版本管理（ToolVersion 模型）
- 工具分类（ToolCategory 模型）
- 工具调用记录（ToolInvocation 模型）
- 工具请求/响应模型（CreateToolRequest/UpdateToolRequest）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无工具调用鉴权
- 无工具使用统计
- 无工具评分/评论
- 无工具 Marketplace
- 无工具依赖管理
- 无工具超时/重试配置
- 无工具执行日志
- 无工具 A/B 测试

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 调用追踪 | 每次调用记录输入/输出/耗时/状态 | L2 |
| 使用统计 | 调用量/成功率/平均耗时/活跃用户 | L2 |
| 鉴权控制 | 工具调用权限 + API Key | L2 |
| 超时重试 | 调用超时 + 失败重试 | L2 |
| 分类管理 | 工具分类 + 标签 + 搜索 | L2 |
| 版本管理 | 多版本 + 兼容性 + 回滚 | L2 |

## 二、验收标准

### 2.1 工具管理

| # | 标准 | 验证方式 |
|---|------|----------|
| TL1 | 支持注册工具（name/description/endpoint/category） | API 测试 |
| TL2 | 工具分类：integration/ai/utility/compliance/devops | API 测试 |
| TL3 | 工具含调用 schema（输入参数定义） | API 测试 |
| TL4 | 工具状态：active/inactive/deprecated | API 测试 |
| TL5 | 支持工具标签 | API 测试 |
| TL6 | 多租户隔离 | 集成测试 |
| TL7 | 工具可启用/禁用 | API 测试 |

### 2.2 版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| TL8 | 同一工具支持多版本 | API 测试 |
| TL9 | 版本号遵循 SemVer | API 测试 |
| TL10 | 版本含 changelog | API 测试 |
| TL11 | 版本可标记为默认版本 | API 测试 |
| TL12 | 调用时可指定版本，默认使用最新 | API 测试 |
| TL13 | 旧版本支持回滚调用 | API 测试 |

### 2.3 调用追踪

| # | 标准 | 验证方式 |
|---|------|----------|
| TL14 | 每次工具调用记录追踪日志 | API 测试 |
| TL15 | 追踪记录含：输入参数/输出结果/耗时/状态码 | API 测试 |
| TL16 | 调用状态：success/error/timeout | API 测试 |
| TL17 | 失败记录含错误信息 + 堆栈 | API 测试 |
| TL18 | 追踪记录不可篡改 | 单元测试 |
| TL19 | 调用历史分页查询 | API 测试 |

### 2.4 使用统计

| # | 标准 | 验证方式 |
|---|------|----------|
| TL20 | 工具调用量统计（按天/周/月） | API 测试 |
| TL21 | 成功率统计（成功数/总调用数） | API 测试 |
| TL22 | 平均响应耗时 | API 测试 |
| TL23 | P95/P99 响应耗时 | API 测试 |
| TL24 | 活跃用户统计（去重用户数） | API 测试 |
| TL25 | Top 10 最常用工具 | API 测试 |
| TL26 | 使用趋势图 | 前端验证 |

### 2.5 鉴权与配置

| # | 标准 | 验证方式 |
|---|------|----------|
| TL27 | 工具调用需 API Key 认证 | API 测试 |
| TL28 | API Key 可限制工具范围 | API 测试 |
| TL29 | 工具调用可配置超时时间 | API 测试 |
| TL30 | 失败自动重试（最多 N 次，指数退避） | 集成测试 |
| TL31 | 重试间隔可配置 | API 测试 |
| TL32 | 调用频率限制（每用户每分钟） | 集成测试 |

### 2.6 工具市场

| # | 标准 | 验证方式 |
|---|------|----------|
| TL33 | 工具可发布到市场 | API 测试 |
| TL34 | 用户可评分（1-5星） | API 测试 |
| TL35 | 用户可写评论 | API 测试 |
| TL36 | 市场搜索 + 分类筛选 | API 测试 |
| TL37 | 工具详情页（描述/评分/调用量/文档） | 前端验证 |
| TL38 | 热门工具推荐 | API 测试 |

## 三、API 设计

```
Base: /api/v1/tools
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/tools` | 注册工具 |
| GET | `/tools` | 工具列表 |
| GET | `/tools/:id` | 工具详情 |
| PUT | `/tools/:id` | 更新工具 |
| DELETE | `/tools/:id` | 删除工具 |
| POST | `/tools/:id/versions` | 创建版本 |
| GET | `/tools/:id/versions` | 版本列表 |
| POST | `/invoke` | 调用工具 |
| GET | `/invocations` | 调用历史 |
| GET | `/invocations/:id` | 调用详情 |
| GET | `/statistics` | 使用统计 |
| GET | `/statistics/:toolId` | 工具统计 |
| POST | `/api-keys` | 创建 API Key |
| GET | `/categories` | 分类列表 |
| GET | `/market/search` | 市场搜索 |
| POST | `/market/:id/rate` | 评分 |
| POST | `/market/:id/reviews` | 评论 |

## 四、数据模型

```sql
-- 工具
CREATE TABLE IF NOT EXISTS tools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  endpoint        VARCHAR(500),
  input_schema    JSONB DEFAULT '{}',
  output_schema   JSONB DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'active',
  tags            TEXT[] DEFAULT '{}',
  timeout_sec     INT DEFAULT 30,
  max_retries     INT DEFAULT 3,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 工具版本
CREATE TABLE IF NOT EXISTS tool_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  version         VARCHAR(50) NOT NULL,
  changelog       TEXT,
  endpoint        VARCHAR(500),
  input_schema    JSONB DEFAULT '{}',
  is_default      BOOLEAN DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tool_id, version)
);

-- 工具分类
CREATE TABLE IF NOT EXISTS tool_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  icon            VARCHAR(100),
  parent_id       UUID REFERENCES tool_categories(id),
  sort_order      INT DEFAULT 0,
  UNIQUE(tenant_id, name)
);

-- 工具调用记录
CREATE TABLE IF NOT EXISTS tool_invocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         UUID NOT NULL REFERENCES tools(id),
  version         VARCHAR(50),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id),
  input_params    JSONB DEFAULT '{}',
  output_result   JSONB,
  status          VARCHAR(20) DEFAULT 'success',
  error_message   TEXT,
  duration_ms     INT,
  invoked_at      TIMESTAMPTZ DEFAULT now()
);

-- 工具评分
CREATE TABLE IF NOT EXISTS tool_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tool_id, user_id)
);

-- 工具评论
CREATE TABLE IF NOT EXISTS tool_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(200),
  content         TEXT,
  helpful_count   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tools_tenant ON tools(tenant_id, status);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tool_invocations_tool ON tool_invocations(tool_id, invoked_at DESC);
CREATE INDEX idx_tool_invocations_user ON tool_invocations(user_id);
```

## 五、前端设计

**路由**: `/tools`

主要页面：
- 工具列表页：按分类/标签筛选
- 工具详情页：描述/版本/调用统计
- 工具注册页：创建工具 + 定义 schema
- 版本管理页：创建/发布版本
- 调用历史页：调用记录 + 输入输出
- 统计页：调用量/成功率/耗时图表
- 市场页：搜索/浏览/推荐

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | ToolService、InvocationService、StatsService |
| 集成测试 | 6 | 注册→版本→调用→统计→评分→评论闭环 |
| 前端测试 | 4 | 工具列表、详情、调用、统计 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
