# 告警升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/alert*` 10 个 alert 家族目录（73 非测试文件 / 13,454 行）
**基线数据**：`reports/expert-reviews/alert-expert-rereview-2026-10-01.md`（443 行独立复评 42-47%）
**相关报告**：`reports/expert-reviews/alert-expert-review-2026-09-30.md`（v1 48%）+ `alert-expert-supplement-2026-10-01.md`

---

## 1. TL;DR

- **当前完成度**：45-50%（复评中位数 47.5%，v1 48% 方向正确但低估 P0 缺口）
- **目标完成度**：72-75%（补多租户隔离 + 深度集成 + oncall/shift/SLA + dashboard）
- **关键改动**：
  1. **P0-8**：`alert-adapter-v2/service/handlers/` 通知渠道租户隔离（当前仅 1 处 tenant_id 引用）
  2. **P0-9**：AlertCorrelation 从 CRUD 升级为算法（当前 115 行无算法）
  3. **P0-10**：5 家族 Migration 补齐（alert/correlation/deduplication/silence/rule-engine 无 migrations，走 memory 重启丢失）
  4. **P1-1**：新增 oncall 模块（值班表）
  5. **P1-2**：新增 shift 模块（排班表）
  6. **P1-3**：新增 SLA 模块（告警响应 SLA）
  7. **P1-4**：新增 alert-dashboard 模块（当前只有 escalation/metrics 单端点）
  8. **P1-5**：11 通知渠道深度集成（签名验证/重试/限流/消息确认）
- **不动的部分**：主链路 5 步（Ingest/RuleEval/Route/Notify/Escalate 全部真实）+ 88 endpoints + 82 auth guards + 246 测试

---

## 2. 当前状态（代码实证）

### 2.1 10 alert 家族

| 家族 | 生产 LOC | 端点 | Auth | 备注 |
|------|---------|------|------|------|
| alert | 871 | 17 | 3 | 主告警存储 + Ingest + topology + dedup + maintenance |
| alert-adapter (v1) | 964 | 9 | 8 | 双工厂，5 处 `TODO: in production` |
| alert-adapter-v2 | 1361 | 9 | 9 | 11 LiveChannels，976 行 handlers.go |
| alert-breaker | 287 | 5 | 5 | 熔断器 |
| alert-correlation | 406 | 8 | 7 | 关联分组，简化（无算法） |
| alert-deduplication | 295 | 3 | 3 | 独立 dedup |
| alert-escalation | 820 | 13 | 13 | 升级策略 |
| alert-pipeline | 1017 | 7 | 7 | 7 stage 流水线 |
| alert-rule-engine | 381 | 5 | 5 | CEL 规则 |
| alert-silence | 592 | 12 | 9 | 抑制 + fatigue |
| **合计** | **~7000 生产** | **88** | **82 (93.2%)** | 246 测试函数 |

### 2.2 关键实证

- 主链路 5 步全部真实：Ingest 75 行 + RuleEval 164 行 + Route 160 行 + Notify 113 行 + Escalate 445 行
- 11 LiveChannels 声明属实（`live.go` L12-24）：email/sms/wechat/dingtalk/feishu/slack/telegram/pagerduty/opsgenie/webhook/in_app
- 5 家族无 migrations：alert/alert-correlation/alert-deduplication/alert-silence/alert-rule-engine（走 memory）
- **租户隔离强度**：
  - alert 56 处 / escalation 45 / silence 30（强）
  - correlation 14 / breaker 14（中）
  - deduplication 6（弱）
  - **adapter-v2 handlers.go 仅 1 处**（L311 `"tenant": variables["tenant_id"]` 作为 webhook payload 变量）
- NeatLogic 15 子域对齐：覆盖 8 项（rule/aggregator-weak/silence/ack/resolve/escalation/notification/routing/dedup），缺失 3 项（oncall/shift/SLA），简化 4 项（dashboard/inhibition/correlation/topology）

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | 通知渠道租户隔离缺失 | **G0** | adapter-v2 handlers.go 仅 1 处 tenant_id |
| G0-2 | AlertCorrelation 无算法 | **G0** | 115 行 CRUD + AutoCorrelate 一次性 |
| G0-3 | 5 家族无 migration | **G0** | 走 memory 重启丢失 |
| G0-4 | 无 oncall 模块 | **G0** | NeatLogic 核心，Orion 全 0 |
| G0-5 | 无 shift 模块 | **G0** | 排班全缺 |
| G0-6 | 无 SLA 模块 | **G0** | 告警响应 SLA 全缺 |
| G0-7 | 无 dashboard 独立模块 | **G0** | 只有 escalation/metrics 单端点 |
| G1-1 | 11 通知渠道深度集成 | **G1** | 签名/重试/限流/消息确认 0/11 |
| G1-2 | Alert adapter v1/v2 双份维护 | **G1** | 405 行 v1 + 976 行 v2 并存 |
| G1-3 | AlertCorrelation 独立存储与 alert/service 重复 | **G1** | 2 套并行实现 |
| G2-1 | Inhibition 是隐式而非独立 | **G2** | 通过 MaintenanceWindow 隐式实现 |
| G2-2 | Alert topology 未深入 | **G2** | topology.go 存在但未深入 |
| G3-1 | Alert 事件溯源（Event Sourcing） | **G3** | 高级能力 |

---

## 4. 升级目标

### 4.1 架构层

- **通知渠道租户隔离**：
  - 每个 channel handler 接收 `TenantID` 参数
  - templates 表增加 `tenant_id` 字段
  - 消息构造时通过 `TenantContext` 传递
- **AlertCorrelation 算法升级**：
  - 新增滑动窗口关联（时间窗口内同 label 归组）
  - 关联规则 DSL（类似 CEL 表达式）
  - 与 alert-deduplication 合并去重
- **5 家族 Migration 补齐**：
  - alert 主表：从 memory 迁到 PG
  - correlation/deduplication/silence/rule-engine 5 张表
- **oncall/shift 模块新建**：
  - oncall：值班表 + 值班通知
  - shift：排班规则（每周/每月/自定义）
- **SLA 模块新建**：
  - 告警响应 SLA（响应时间/解决时间）
  - 与 ITSM SLA 引擎区分（ITSM SLA 是工单 SLA，Alert SLA 是告警响应）
- **dashboard 模块新建**：
  - 告警总览 dashboard（当前告警/待处理/已解决）
  - 时间序列告警统计
  - 严重度分布

### 4.2 数据模型层（Migration 735-742）

- `735_alerts_persistent.sql`：alerts 主表持久化（迁离 memory）
- `736_alert_correlations.sql`：correlation 分组表
- `737_alert_deduplication.sql`：dedup 指纹表
- `738_alert_silences.sql`：silence 持久化
- `739_alert_rules.sql`：rule-engine 规则持久化
- `740_alert_oncall.sql`：oncall 值班表
- `741_alert_shift.sql`：shift 排班表
- `742_alert_sla.sql`：告警 SLA
- `743_alert_dashboard_stats.sql`：dashboard 缓存表
- `744_alert_channel_templates_tenant.sql`：channel templates 加 tenant_id

### 4.3 API 层

- `/api/v1/alerts/oncall/*`：6 端点（oncall 值班表 CRUD + 当前值班人查询）
- `/api/v1/alerts/shifts/*`：5 端点（排班 CRUD + 排班冲突检测）
- `/api/v1/alerts/sla/*`：5 端点（SLA 定义 + 违规查询）
- `/api/v1/alerts/dashboard/*`：4 端点（总览/统计/严重度分布/时间序列）
- 11 通知渠道深度集成改造（无新端点，改造现有实现）

---

## 5. 依赖链

### 5.1 前置模块

- **CMDB**：告警资源关联 CI（`cmdb_ci_relations` 已有）
- **ITSM**：告警→Incident 转换（ITSM 工单系统）
- **Notification**：告警通知复用（虽然 alert-adapter 已有，但 notification 主模块可复用）
- **Audit**：告警变更审计

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/audit/` | 告警变更审计 |
| `internal/approval/` | SLA 例外审批 |
| `robfig/cron` | shift 排班调度 |
| `github.com/robfig/cron` | oncall 提醒 |
| `github.com/golang/protobuf`（gRPC） | 跨服务通知 |

### 5.3 下游消费者

- **ITSM**：告警升级→Incident
- **Automation**：告警触发自愈
- **Inspection**：巡检问题触发告警
- **BI**：告警数据入报表

---

## 6. 实施步骤

### 阶段 1：5 家族 Migration 补齐（G0-3，独立任务）

1. Migration 735-739：定义 5 张表
2. 5 家族 repository 从 memory 迁到 PG
3. 数据迁移脚本：内存数据 → PG
4. 单元测试：验证 PG 与 memory 行为一致

### 阶段 2：通知渠道租户隔离（G0-1，最高优先级）

1. 定义 `TenantContext` 结构：`type TenantContext struct { TenantID string; Variables map[string]any }`
2. `alert-adapter-v2/service/handlers/handlers.go` 改造：
   - 所有 11 个 channel handler 接收 `TenantContext`
   - templates 表查询带 `WHERE tenant_id = ?`
3. Migration 744：`alert_channel_templates` 加 `tenant_id` 字段 + 索引
4. 单元测试：2 租户配置相同 template，验证不互相污染

### 阶段 3：AlertCorrelation 算法升级（G0-2）

1. 新建 `internal/alert-correlation/service/algorithm.go`：
   - `SlidingWindowCorrelate(alerts []Alert, window time.Duration) []Group`
   - `RuleBasedCorrelate(alerts []Alert, rules []Rule) []Group`
   - `MergeDuplicateGroups(groups []Group) []Group`
2. `AutoCorrelate` 从一次性调用改为周期性运行
3. 与 `alert-deduplication` 合并：dedup 结果为 correlation 的输入

### 阶段 4：Oncall + Shift 模块（G0-4/5）

1. `internal/alert-oncall/` 新建：
   - Models：OncallSchedule / OncallMember / OncallRotation
   - Service：CRUD + GetCurrentOncall + Notify
   - Handler：6 端点
2. `internal/alert-shift/` 新建：
   - Models：ShiftRule / ShiftAssignment
   - Service：CRUD + ConflictDetect + ScheduleGenerate
   - Handler：5 端点
3. 与 alert-escalation 集成：升级策略中"升级到 oncall"作为新目标

### 阶段 5：SLA 模块（G0-6）

1. `internal/alert-sla/` 新建：
   - Models：AlertSLA / AlertSLAViolation
   - Service：CreateSLA / CheckCompliance / ListViolations
   - Handler：5 端点
2. 与 alert-escalation 集成：SLA 违规触发升级

### 阶段 6：Dashboard 模块（G0-7）

1. `internal/alert-dashboard/` 新建：
   - Service：GetOverview / GetTimeSeries / GetSeverityDistribution / GetTopOffenders
   - Handler：4 端点
2. 数据缓存：Migration 743 dashboard_stats 表
3. 后端聚合 SQL + 缓存 TTL 15min

### 阶段 7：11 通知渠道深度集成（G1-1）

按渠道分批：
1. **Slack/Discord**（webhook + signing secret）
2. **Dingtalk/Wechat/Feishu**（HMAC 签名）
3. **Pagerduty/Opsgenie**（API key + 事件模型）
4. **Telegram**（botToken 长连接）
5. **Email**（SMTP 完整实现）
6. **Webhook**（重试 + 幂等 + 消息确认）

每渠道改造要点：
- 签名/密钥管理：从密钥管理模块读取
- 重试策略：指数退避 3 次
- 限流：令牌桶
- 消息确认：异步回执

### 阶段 8：v1/v2 adapter 收敛（G1-2）

- v1（alert-adapter 405 行）标记为 deprecated
- v2（alert-adapter-v2 976 行）为唯一权威实现
- v1 handler 保留 3 个月兼容期后删除

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# 5 家族 migration 存在
ls migrations/735* migrations/736* migrations/737* migrations/738* migrations/739*

# 通知渠道租户隔离
grep -c "TenantContext\|TenantID" internal/alert-adapter-v2/service/handlers/handlers.go
# 期望：>50 命中（原仅 1 处）

# 新模块存在
ls internal/alert-oncall/ internal/alert-shift/ internal/alert-sla/ internal/alert-dashboard/

# AlertCorrelation 算法
grep -n "SlidingWindowCorrelate\|RuleBasedCorrelate" internal/alert-correlation/service/
```

### 7.2 单元测试

- 5 家族 PG 持久化：各 4 用例（CRUD）
- 通知渠道租户隔离：3 用例（多租户隔离验证）
- AlertCorrelation 滑动窗口：4 用例
- Oncall 排班：5 用例
- Shift 冲突检测：4 用例
- SLA 违规判定：4 用例
- Dashboard 聚合：3 用例

### 7.3 e2e 验证

1. 创建 Alert（K8s Pod CrashLoopBackOff）
2. 通过 CEL 规则匹配 → 触发 escalation policy
3. Oncall 查询当前值班人 → 通知 Slack（带签名）
4. SLA 检查 → 30 分钟未响应触发升级
5. Correlation 分组：同 namespace 下 5 个 pod 告警归为一组
6. Dashboard 展示：告警总数 1（分组后）

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 通知渠道租户隔离改造大范围破坏 | 中 | 高 | 先灰度 3 渠道（Slack/Dingtalk/Email），验证后再推广 |
| 5 家族 memory → PG 迁移数据丢失 | 中 | 高 | 双写期 + 数据校验脚本 |
| AlertCorrelation 算法引入循环依赖 | 中 | 中 | 与 deduplication 合并去重，避免双套 |
| Oncall/Shift/SLA/Dashboard 4 新模块过度设计 | 中 | 中 | 从最小可用开始（oncall 优先） |
| v1/v2 收敛期兼容性问题 | 低 | 中 | 3 个月兼容期，双份维护成本可控 |

### 8.2 回滚策略

- **通知渠道租户隔离回滚**：TenantContext 变可选，回到原逻辑
- **5 家族 PG 迁移回滚**：repository 切回 memory（数据保留在 PG 但代码不读）
- **AlertCorrelation 算法回滚**：AutoCorrelate 降级为原一次性调用
- **4 新模块回滚**：删除 `internal/alert-{oncall,shift,sla,dashboard}/` + Migration 740-743
- **11 渠道深度集成回滚**：每渠道独立回滚（保留 HTTP POST 基础实现）

### 8.3 认知边界

- 未验证 alert-adapter-v2 现有 976 行 handlers.go 的具体签名改造成本
- 未评估 AlertCorrelation 关联规则 DSL 的具体语法设计
- 未评估 Dashboard 数据聚合的 SQL 复杂度（是否需要物化视图）
- 未评估 v1/v2 adapter 收敛后的具体废弃时序

---

**文档编号**：`alert-upgrade-design-2026-10-03.md`
**关联报告**：`alert-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：ITSM（Incident 转换） / Automation（自愈触发） / CMDB（资源关联） / BI（告警报表）
