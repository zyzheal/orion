# Spec: LLM 服务 (llm)

## 1. 模块概述

### 功能描述
LLM 服务负责 LLM 调用追踪、模型定价管理和使用统计。提供 LLM trace 记录、模型定价配置、日维度使用统计等功能。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("llm", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL (JSONB 存储灵活字段)

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/ai/` 下的相关模块
- Go 实现：独立微服务，更细粒度的 LLM trace 和定价管理

## 2. API 端点

**Base 路径**：`/api/v1/llm`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /traces | 分页查询 LLM 调用追踪 | llm:read |
| GET | /traces/:id | 获取单条 trace 详情 | llm:read |
| POST | /traces | 创建 LLM trace | llm:write |
| GET | /pricing | 查询模型定价列表 | llm:read |
| POST | /pricing | 创建/更新模型定价 | llm:write |
| GET | /stats/daily | 日维度使用统计 | llm:read |
| GET | /stats/summary | 统计摘要 | llm:read |
| POST | /traces/batch | 批量导入 traces | llm:write |
| GET | /models | 可用模型列表 | llm:read |
| GET | /models/:id | 模型详情 | llm:read |
| DELETE | /traces/:id | 删除 trace | llm:delete |

## 3. 数据模型

### LLMTrace
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| trace_id | VARCHAR | 追踪 ID |
| model | VARCHAR | 模型名称 |
| provider | VARCHAR | 提供商 |
| prompt_tokens | INT | 输入 token 数 |
| completion_tokens | INT | 输出 token 数 |
| total_tokens | INT | 总 token 数 |
| latency_ms | INT | 延迟(ms) |
| cost | DECIMAL | 成本 |
| status | VARCHAR | 状态 (success/error/timeout) |
| error_message | TEXT | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |

### ModelPricing
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| model | VARCHAR | 模型名称 |
| provider | VARCHAR | 提供商 |
| input_price_per_1k | DECIMAL | 输入价格(每1K tokens) |
| output_price_per_1k | DECIMAL | 输出价格(每1K tokens) |
| currency | VARCHAR | 货币 (USD/CNY) |
| effective_from | TIMESTAMP | 生效时间 |
| effective_to | TIMESTAMP | 失效时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| LLM-01 | 创建 LLM trace 后可在列表中查询到 | 单元测试 |
| LLM-02 | trace 包含完整的 token 用量和延迟信息 | 集成测试 |
| LLM-03 | 模型定价配置生效后统计自动使用新价格 | 单元测试 |
| LLM-04 | 多租户隔离：不同租户 trace 互不可见 | 集成测试 |
| LLM-05 | 日维度统计按日期聚合 token 用量和成本 | 单元测试 |
| LLM-06 | 批量导入 trace 支持最多 1000 条/次 | 单元测试 |
| LLM-07 | 错误状态的 trace 记录 error_message | 单元测试 |
| LLM-08 | 定价过期后新调用使用最新有效定价 | 集成测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 20+ | handler/service/repository 各层 |
| 集成测试 | 10+ | 端到端 API 流程 |
| 前端测试 | 5+ | trace 列表/详情/统计页面 |
