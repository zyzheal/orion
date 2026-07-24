# Workbench 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service/src/services/workbench/WorkbenchService.ts` + `src/api/workbench-routes.ts`  
**路由前缀**: `/api/v1/workbench`  

---

## 一、现状概述

### 模块定位

个人工作台数据聚合服务（Personal Dashboard），面向工程师提供统一的个人视图。将 Pipeline 运行、告警、工单、部署四种数据聚合到单一 API 端点，供前端"个人工作台"页面消费。

### 文件结构

```
services/workbench/
├── __tests__/
│   └── WorkbenchService.test.ts
├── index.ts                    # 导出 WorkbenchService
└── WorkbenchService.ts         # 聚合服务 (~196 行)

api/workbench-routes.ts        # 路由定义 (~38 行)
```

### 核心数据模型

所有数据模型为只读接口（无写操作），通过 SQL 聚合查询从各业务表获取：

| 接口 | 字段 | 数据来源 |
|------|------|---------|
| `WorkbenchPipelineData` | recentRuns[], successRate, totalRuns24h, failedRuns | `pipeline_runs` 表 |
| `WorkbenchAlertData` | unread, critical, recent[] | `alerts` 表 |
| `WorkbenchTicketData` | active, overdue, recent[] | `tickets` 表 |
| `WorkbenchDeploymentData` | recent[], successRate | `deployment_history` 表 |

### 持久化方式

不涉及本模块的持久化——直接通过 `DatabasePool` 执行原生 SQL 查询，无 Repository 层封装。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| Pipeline 数据聚合 | ✅ 完整 | 最近运行（5条）+ 24h 统计 |
| 告警数据聚合 | ✅ 完整 | 未读/严重数 + 最近告警（5条） |
| 工单数据聚合 | ✅ 完整 | 活跃/超时数 + 最近工单（5条） |
| 部署数据聚合 | ✅ 完整 | 最近部署（5条）+ 7天成功率 |
| 故障隔离 | ✅ 完整 | `Promise.allSettled` 确保单模块故障不阻塞 |
| 用户/租户过滤 | ✅ 完整 | 支持 tenantId 过滤（但 userId 参数传递但未使用） |
| 前端页面集成 | ✅ 完整 | DashboardNew 页面已对接 |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 | ACL |
|------|------|--------|------|-----|
| GET | `/api/v1/workbench` | `getWorkbench` | 聚合工作台数据 | resource:workbench, action:read |

**请求参数**:
- `tenantId` (query, optional) — 租户 ID，默认 "default"
- `userId` (query, optional) — 用户 ID，默认从 `request.user.id` 获取

---

## 四、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| `DatabasePool` | 基础设施 | 直接执行原生 SQL（无 Repository 层） |
| `pipeline_runs` 表 | 外部表 | pipeline 模块的数据库表 |
| `alerts` 表 | 外部表 | 监控告警模块的数据库表 |
| `tickets` 表 | 外部表 | 工单模块的数据库表 |
| `deployment_history` 表 | 外部表 | 部署模块的数据库表 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **`userId` 参数传入但 SQL 查询中未使用**，仅用 `tenantId` 过滤 | P1 | 修复 SQL 查询，加入 user 过滤条件，确保用户只能看到自己的数据 |
| **直接原生 SQL 无 Repository 层** | P1 | 虽为只读聚合服务，但建议抽取 SQL 到对应模块的 Repository 方法 |
| **alert 表名硬编码**，实际表名可能不同（如 `alerts` vs `alert_events`） | P2 | 确认表名准确，使用常量而非硬编码 |
| **无缓存**，每次请求都查询 4 张表 | P2 | 建议添加短时间缓存（如 30s），降低数据库压力 |
| **deployment_history 表名假设** | P2 | 确认实际表名是否与部署模块一致 |
| **测试覆盖**：存在 `WorkbenchService.test.ts` | ⚠️ | 需确认是否覆盖了故障隔离场景 |

---

## 六、总结

Workbench 模块是一个轻量级的数据聚合服务，定位清晰——为个人工作台提供只读数据。代码简洁（~196 行），使用了 `Promise.allSettled` 确保故障隔离，实现了基本的 SLA 计算（工单超时检查）。

**主要问题**：
1. `userId` 参数传而不用，实际查询只按 `tenantId` 过滤，缺少用户级隔离
2. 无 Repository 层，SQL 直接在服务层硬编码
3. 无缓存策略

**评分**: 7/10 — 功能简洁有效，但用户过滤缺陷和数据访问层缺失降低了评分。
