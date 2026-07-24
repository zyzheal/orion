# 低代码模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/lowcode/`

---

## 模块概览

低代码模块实现了一个轻量级工作流引擎，支持可视化流程编排、条件分支、审批集成、定时触发等能力。

### 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `types.ts` | 267 | 工作流类型定义（WorkflowDefinition、WorkflowInstance、节点配置） |
| `LowcodeWorkflowService.ts` | 731 | 工作流定义/实例 CRUD，DB+内存双写降级 |
| `WorkflowRepository.ts` | - | PostgreSQL Repository 定义 |
| `WorkflowEngine.ts` | - | 工作流执行引擎 |
| `WorkflowInstance.ts` | - | 工作流实例管理 |
| `WorkflowScheduler.ts` | - | 工作流定时调度 |
| `TriggerManager.ts` | - | 触发器管理 |
| `CacheCleanupService.ts` | - | 缓存清理 |
| `TaskTimeoutChecker.ts` | - | 任务超时检查 |
| `WorkflowDependencyAnalyzer.ts` | - | 工作流依赖分析 |

---

## 架构设计

### 1. 数据模型

**WorkflowDefinition**（工作流定义）
```typescript
interface WorkflowDefinition {
  id, tenantId, name, description, version, enabled
  nodes: WorkflowNode[]       // 流程节点图
  edges: WorkflowEdge[]       // 节点连接
  createdBy, createdAt, updatedAt
}
```

**WorkflowInstance**（工作流实例）
```typescript
interface WorkflowInstance {
  id, workflowId, workflowDefinitionId, tenantId
  status: 'pending'|'running'|'suspended'|'completed'|'failed'|'terminated'
  currentNodeId, variables, history, input, output, error
  createdAt, updatedAt, completedAt
}
```

**节点类型支持**: start, approval, condition, notification, webhook, end, task, sub-workflow, delay, timer（共 10 种）

### 2. 存储策略

采用 **PostgreSQL + 内存降级** 双写策略：
- 优先写入 PostgreSQL Repository
- DB 失败时自动降级到内存 Map
- `dbAvailable` 标志控制降级状态
- 一旦降级，后续请求全部走内存

### 3. 与审批系统集成

`ApprovalNodeConfig` 直接引用 `ApprovalFlowConfig`，工作流中的审批节点可调用 `ApprovalFlowEngine` 实现多级审批。

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 工作流定义 CRUD | ✅ | 创建/查询/更新/删除完整 |
| 工作流实例管理 | ✅ | 创建/查询/状态更新/变量更新/历史记录 |
| 分页查询 | ✅ | 支持 limit/offset 分页 |
| 条件分支 | ✅ | 支持表达式条件分支 |
| 审批节点 | ✅ | 集成 ApprovalFlowEngine |
| 通知节点 | ✅ | 支持多渠道通知 |
| Webhook 节点 | ✅ | 支持 HTTP 调用 |
| 子工作流 | ✅ | 支持嵌套子流程 |
| 定时触发 | ✅ | Timer 节点支持 cron 表达式 |
| 延迟节点 | ✅ | Delay 节点支持时长/事件恢复 |
| 任务节点 | ✅ | Task 节点支持人工/系统任务 |
| 依赖分析 | ✅ | WorkflowDependencyAnalyzer |
| 超时检查 | ✅ | TaskTimeoutChecker |
| 缓存清理 | ✅ | CacheCleanupService |
| 持久化 | ✅ | PostgreSQL Repository + 内存降级 |

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| 前端页面 | P1 | 无对应前端页面，仅有后端 API |
| API 路由文件 | P1 | 未找到独立的 `lowcode-routes.ts`，功能可能集成在其他路由中 |
| 工作流版本管理 | P2 | 仅有 `version` 字段，无版本对比/回滚 |
| 工作流导入/导出 | P2 | 无 JSON/YAML 导入导出功能 |
| 工作流模板市场 | P3 | 无预定义模板库 |
| 执行沙箱 | P3 | 无隔离执行环境，节点配置直接执行 |
| 可视化编辑器 API | P1 | 前端需通过 API 保存/加载流程图 |
| SLA 集成 | P2 | 未与 SLA 模块集成超时升级 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| `JSON.parse` 无 try-catch | 节点配置解析崩溃风险 | 添加解析错误处理 |
| 内存 Map 残留 | 进程重启丢失未持久化数据 | 确认 DB 降级后内存数据不丢失 |
| `any` 类型使用 | 类型安全降低 | 细化节点配置类型 |
| 单例模式 | 测试耦合 | 保持但提供 reset 方法 |

---

## 与 ITSM/Ticketing 集成点

| 集成点 | 当前状态 | 建议 |
|--------|---------|------|
| 工单状态流转 | ❌ 未集成 | TicketWorkflowService 独立实现状态机，未复用 lowcode |
| 审批节点 | ✅ 已集成 | 复用 ApprovalFlowEngine |
| 通知节点 | ✅ 已集成 | 复用 NotificationService |
| SLA 升级 | ❌ 未集成 | 建议 lowcode 的 escalation 节点调用 SLA 模块 |

---

## 建议优先级

1. **P1**: 补充前端低代码流程设计器页面
2. **P1**: 确认/补充 `lowcode-routes.ts` API 路由
3. **P2**: 增加工作流版本对比与回滚
4. **P2**: 增加导入/导出功能
5. **P3**: 建立模板市场
