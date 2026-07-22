# ITSM / Ticketing 模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/ticketing/` 及相关 ITSM 模块

---

## 模块概览

Ticketing 模块实现了一个完整的 ITSM 工单系统，包含工单 CRUD、状态机流转、智能派单、升级、BI 分析、知识关联等能力。

### 核心文件

| 文件 | 职责 |
|------|------|
| `TicketingRepository.ts` | PostgreSQL Repository，工单/Comment/Relation 数据访问 |
| `TicketingService.ts` | 工单基础 CRUD：创建/查询/更新/分配/解决/关闭/评论 |
| `TicketWorkflowService.ts` | 工单状态机、流转校验、自动分配、超时升级 |
| `TicketTransferService.ts` | 工单转派：手动转派、超时自动转派、转派次数限制 |
| `EngineerSuspendService.ts` | 工程师暂停/恢复 |
| `DispatchEngine.ts` | 智能派单引擎 |
| `DispatchQueueManager.ts` | 派单队列管理 |
| `LoadBalancer.ts` | 负载均衡 |
| `DispatchAnalytics.ts` | 派单分析 |
| `TicketBIService.ts` | BI 分析：统计报表、趋势、工程师绩效 |
| `TicketReportService.ts` | 报表生成 |
| `TicketRelationAnalyzer.ts` | 工单关联分析（相似工单、重复检测） |
| `TicketGenerator.ts` | 工单生成器 |

---

## 架构设计

### 1. 数据模型

**Ticket（工单核心）**
```typescript
interface Ticket {
  id, tenantId, title, description, status, priority, category, source
  assignee, reporter, teamId
  slaResponseDeadline, slaResolutionDeadline
  tags, customFields
  createdAt, updatedAt, resolvedAt, closedAt
}
```

**TicketStatus 流转**
```
open → assigned → in-progress → resolved → closed
          ↓           ↓           ↓
         open       assigned    open（重开）
```

**状态转换矩阵**（VALID_TRANSITIONS）
| 源状态 | 可转换目标 |
|--------|-----------|
| open | assigned, closed |
| assigned | in-progress, open, closed |
| in-progress | resolved, assigned |
| resolved | closed, open |
| closed | open（重开）|

### 2. 智能派单系统

**DispatchEngine** 支持多种派单策略：
- 基于负载均衡（LoadBalancer）
- 基于技能匹配
- 基于工程师状态（空闲/繁忙/暂停）
- 队列管理（DispatchQueueManager）

**自动转派机制**：
- 超时未处理自动转派
- 最大转派次数限制（默认 3 次）
- 按优先级设置超时时间

### 3. SLA 管理

**默认 SLA 目标**：
| 优先级 | 响应时间 | 解决时间 |
|--------|---------|---------|
| Critical | 15 分钟 | 4 小时 |
| High | 1 小时 | 8 小时 |
| Medium | 4 小时 | 24 小时 |
| Low | 8 小时 | 72 小时 |

### 4. BI 分析

**TicketBIService** 提供：
- 工单统计（按状态/优先级/分类）
- 工程师绩效分析
- 处理时间趋势
- 工单分布报表

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 工单 CRUD | ✅ | 完整的增删改查 |
| 工单分配 | ✅ | 手动分配 + 自动分配 |
| 状态机流转 | ✅ | VALID_TRANSITIONS 矩阵控制 |
| 工单评论 | ✅ | 支持内部/外部评论 |
| 工单转派 | ✅ | 手动/自动转派 + 次数限制 |
| 工程师暂停 | ✅ | EngineerSuspendService |
| 智能派单 | ✅ | DispatchEngine + LoadBalancer |
| SLA 跟踪 | ✅ | 响应/解决 SLA 目标 |
| 超时升级 | ✅ | 自动升级机制 |
| BI 统计 | ✅ | TicketBIService |
| 工单关联 | ✅ | TicketRelationAnalyzer |
| 报表生成 | ✅ | TicketReportService |
| 批量导入 | ✅ | TicketGenerator |
| 知识关联 | ⚠️ | ticket-knowledge-routes 存在但实现待确认 |

---

## 与 ITSM 标准对比

| ITSM 能力 | Orion 实现 | ServiceNow | Jira SM |
|-----------|-----------|------------|---------|
| 工单管理 | ✅ 完整 | ✅ | ✅ |
| 变更管理 | ✅ change/change-request 模块 | ✅ | ✅ |
| 事件管理 | ✅ incident 模块 | ✅ | ✅ |
| 问题管理 | ✅ problem 模块 | ✅ | ✅ |
| CMDB | ✅ cmdb 模块 | ✅ | ⚠️ 需插件 |
| SLA 管理 | ✅ 基础 SLA | ✅ 高级 | ✅ 基础 |
| 知识管理 | ✅ knowledge 模块 | ✅ | ✅ |
| 审批流 | ✅ approval 模块 | ✅ | ⚠️ 需插件 |
| 自助服务门户 | ❌ 缺失 | ✅ | ✅ |
| 聊天机器人 | ✅ chatops 模块 | ⚠️ | ⚠️ |
| AI 辅助 | ✅ ai-review, ai-agents | ✅ | ⚠️ |

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| 自助服务门户 | P1 | 终端用户无法自行提交/查询工单 |
| 工单模板 | P2 | 无预定义工单模板 |
| 工单合并/关联 | P2 | TicketRelationAnalyzer 存在但前端未展示 |
| 工单 SLA 可视化 | P2 | SLA 仪表盘待开发 |
| 工单自动化规则 | P2 | 无规则引擎自动触发动作 |
| 工单满意度调查 | P3 | 无客户满意度反馈 |
| 工单知识推荐 | P2 | ticket-knowledge 路由存在但功能待完善 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| TicketWorkflowService 中 `(existing as any)` 类型断言 | 类型安全 | 定义统一接口 |
| 内存缓存未清理 | 内存泄漏风险 | 添加 TTL 清理 |
| 派单引擎单例 | 测试耦合 | 保持但提供 reset |

---

## 建议优先级

1. **P1**: 开发工单前端页面（列表/详情/创建）并接入智能派单
2. **P1**: 开发自助服务门户
3. **P2**: 完善工单模板和自动化规则
4. **P2**: 增加 SLA 仪表盘和可视化
5. **P3**: 增加满意度调查和知识推荐
