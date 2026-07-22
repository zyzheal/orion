# ADR-015: Phase 5 Go 迁移架构决策

**日期**: 2026-07-15  
**状态**: Accepted  
**影响范围**: orion-platform-svc-go（模块化单体）

## 背景

Phase 5 将 TS 单体（orion-platform-service）中 252 个模块以 Go 蓝图形式迁移至 orion-platform-svc-go，同时迁移 7 个核心域 TS 引擎（PipelineEngine、Saga、CheckpointManager 等）。

## 架构决策

### 1. 模块化单体架构

**决策**: 252 个 internal 模块注册到同一个 main.go 进程，而非独立微服务部署。

**原因**:
- 保持与当前 TS 单体部署模型一致，降低运维切换成本
- 模块间零耦合（仅通过 repository 层交互），为未来独立部署预留出口
- 避免服务间 RPC 延迟和网络故障点

**P0 独立条件**（触发即拆分）:
- pipeline-engine：高频运行（>10次/天）
- ticketing：已有 ticket-svc-go 独立实现
- saga：与 pipeline-engine 同步拆分

### 2. 4 层架构（models → repository → service → handler）

**决策**: 所有模块统一采用 4 层 DDD 架构。

**原因**:
- models 定义数据模型，与存储层解耦
- repository 封装数据库访问，支持 Map→PostgreSQL 渐进迁移
- service 承载业务逻辑，handler 仅做请求绑定
- handler 层统一错误信封（errors.WriteSuccess/WriteError）

**例外**: 2 个模块仅 handler+service（无独立 models），因与现有模块共享模型定义。

### 3. 错误信封统一

**决策**: handler 层禁止裸 `c.JSON(500, gin.H{"error": err.Error()})`，改用固定消息。

**原因**: 防止内部错误信息泄露到前端（路径、SQL、堆栈等敏感数据）。

**实现**: 每个 handler 模块定义 `respondInternalError()`、`respondBadRequest()`、`respondNotFound()` 辅助函数，统一输出固定错误描述。

### 4. Tenant 隔离

**决策**: 所有 handler 使用 `getTenantID()` 包装函数，缺失时回退到零 UUID。

**原因**: 确保所有数据库查询携带 tenant_id，防止跨租户数据泄露。

### 5. CheckpointManager 恢复模式

**决策**: PipelineEngine 采用 Checkpoint 持久化恢复，支持进程崩溃后从断点继续。

**实现**:
- 每个 task 执行后保存 Checkpoint（包含 completed/failed stages + task outputs）
- 启动时 `RecoverOrphanedRuns()` 扫描 RUNNING 状态的 Checkpoint，标记 stale run 为失败
- CheckpointManager 提供 Save/Load/Cleanup 接口

### 6. Saga 补偿策略

**决策**: 采用反向顺序补偿（reverse-order compensation），而非 Saga 事务日志重放。

**原因**:
- 补偿操作天然遵循 LIFO 顺序
- 避免复杂的事务日志状态机
- TransactionLog 仅记录已完成步骤，不参与补偿编排

## 迁移规模

| 指标 | 数值 |
|------|------|
| 总模块目录 | 252 |
| RegisterRoutes 调用 | 253 |
| 完整 4 层架构 | 235（93%） |
| Handler 方法数 | 3,430 |
| Stub→真实实现修复 | 724 |
| 核心域引擎迁移 | 9 个 TS→Go |
| 业务端点补充 | 37 个 |
| 分支领先 main | 1,758 commits |

## 后续行动

| 优先级 | 行动 |
|--------|------|
| P2 | PipelineEngine 独立部署准备（main.go 拆分、gRPC 暴露） |
| P2 | OTel 追踪集成（traceId 注入 Gin middleware） |
| P2 | Gateway 业务逻辑迁移（12 routes.ts → Go handler） |
