# Alert Service Design
> **注意**: 本文档中的 `Map()` / 内存存储描述已过时。相关服务已迁移到 PostgreSQL Repository 模式，详见 `src/repositories/` 和 `src/db/migrations/`。



> 状态: ✅ 后端已实现 | 数据存储: PostgreSQL Repository 模式
> 创建日期: 2026-04-23 | 关联: M26 可观测性

---

## 1. 服务概述

Alert Service (告警服务) 负责告警的去重、关联分析、抑制和分发。是 Orion 可观测性体系的核心组件。

## 2. 代码位置

```
orion-platform-service/src/services/alert/
├── AlertDeduplication.ts         # 告警去重
├── AlertCorrelationService.ts    # 告警关联分析
├── AlertSuppressionService.ts    # 告警抑制
├── AlertTypes.ts                 # 类型定义
└── index.ts                      # 模块导出
```

## 3. 核心功能

### 3.1 AlertDeduplication

| 功能 | 说明 | 状态 |
|------|------|------|
| deduplicate() | 告警去重 | ✅ 已实现 |
| getDeduplicationKey() | 生成去重键 | ✅ 已实现 |
| getTimeWindow() | 获取时间窗口 | ✅ 已实现 |

**去重策略**:
- 基于告警来源 + 告警类型 + 告警对象生成唯一键
- 默认时间窗口: 5 分钟
- 可配置抑制时间

### 3.2 AlertCorrelationService

| 功能 | 说明 |
|------|------|
| correlateAlerts() | 关联相关告警 |
| findRootCause() | 寻找根因告警 |
| buildAlertGraph() | 构建告警关系图 |
| groupByPattern() | 按模式分组 |

**关联算法**:
- 基于时间邻近性
- 基于资源关联 (同一 Pod/Service/Node)
- 基于告警类型关联

### 3.3 AlertSuppressionService

| 功能 | 说明 |
|------|------|
| shouldSuppress() | 判断是否应抑制 |
| getSuppressionRules() | 获取抑制规则 |
| applyMaintenanceWindow() | 应用维护窗口抑制 |
| silenceAlert() | 静默指定告警 |

## 4. 数据模型

```typescript
interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  target: string;
  timestamp: Date;
  payload: Record<string, any>;
  status: 'firing' | 'resolved' | 'suppressed';
}
```

## 5. API 路由

- 路由前缀: `/api/v1/alert/`
- 当前路由: `alert-routes.ts`
- 前端 API: `alerts.ts` (路径不匹配，需修复)

## 6. 已知问题

- ⚠️ 数据存储使用 `Map()` 内存模拟
- ⚠️ 前端 API 路径 `/v1/alerts` 与后端 `/api/v1/alert/list` 不一致
- ⚠️ 告警通知渠道 (邮件/Slack/钉钉) 未实现

## 7. 后续计划

- [ ] 修复 API 路径不一致
- [ ] 补充告警通知渠道集成
- [ ] 添加告警升级机制
- [ ] 集成 PagerDuty/AlertManager