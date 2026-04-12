# F301 - Pipeline 引擎核心服务需求文档

## 1. 概述

实现 Orion 平台的核心 Pipeline 引擎服务，包括 Pipeline 定义、执行、编排和调度功能。

## 2. 功能需求

### 2.1 Pipeline CRUD API
- 创建/读取/更新/删除 Pipeline
- Pipeline 版本管理
- Pipeline 验证（YAML/JSON Schema 验证）
- Pipeline 模板支持

### 2.2 PipelineRun 执行引擎
- 触发 Pipeline 执行（手动/API/事件触发）
- 执行状态管理（pending/running/success/failed/cancelled）
- 并发控制
- 执行历史查询

### 2.3 Stage 管理与编排
- Stage 顺序执行/并行执行
- Stage 条件判断（基于前置 Stage 结果）
- Stage 超时控制
- Stage 重试机制

### 2.4 Task 调度器
- Task 依赖解析
- Task 并发执行
- Task 资源配额管理
- Task 日志收集

### 2.5 事件发布
- 发布 pipeline.run.created 事件
- 发布 pipeline.run.started 事件
- 发布 pipeline.run.completed 事件
- 发布 pipeline.run.failed 事件
- 发布 pipeline.stage.* 事件
- 集成 @orion/event-bus

## 3. 技术栈

- Node.js 20 + TypeScript
- Express/Fastify
- PostgreSQL (使用 F003 的数据库架构)
- NATS JetStream (使用 F001 的 event-bus)
- Redis (使用 F003 的 Redis 缓存)

## 4. 验收标准

- Pipeline CRUD API 可用（单元测试 + 集成测试）
- PipelineRun 可正常执行
- Stage 按依赖关系正确编排
- Task 调度器正确处理并发和依赖
- 事件正确发布到 NATS
- 有完整的 API 文档
- 单元测试覆盖率 > 80%

## 5. 测试用例

### 5.1 Pipeline CRUD 测试
- TC001: 创建有效的 Pipeline
- TC002: 创建无效的 Pipeline（验证失败）
- TC003: 获取 Pipeline 列表
- TC004: 获取单个 Pipeline 详情
- TC005: 更新 Pipeline
- TC006: 删除 Pipeline
- TC007: Pipeline 版本管理

### 5.2 PipelineRun 执行测试
- TC008: 手动触发 Pipeline 执行
- TC009: Pipeline 执行状态流转
- TC010: 取消正在执行的 Pipeline
- TC011: 查询执行历史

### 5.3 Stage 编排测试
- TC012: Stage 顺序执行
- TC013: Stage 并行执行
- TC014: Stage 条件判断
- TC015: Stage 超时处理
- TC016: Stage 重试机制

### 5.4 Task 调度测试
- TC017: Task 依赖解析
- TC018: Task 并发执行
- TC019: Task 资源配额限制
- TC020: Task 日志收集

### 5.5 事件发布测试
- TC021: pipeline.run.created 事件发布
- TC022: pipeline.run.started 事件发布
- TC023: pipeline.run.completed 事件发布
- TC024: pipeline.run.failed 事件发布
