# 通知告警域深度分析 (2026-08-02)

> **覆盖**: 15 模块 / ~35,000 行 | **原深度分析覆盖率**: 通知告警域 67%

---

## 一、通知告警域总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **alert** (告警主模块) | 1,439 | 1 | 17 | 19 | 21 | ✅ | ✅ | 90% |
| **alert-adapter** (SPI) | 3,311 | 0 | 10 | **114** | 16 | ✅ | ❌ | **95%** |
| **alert-adapter-v2** | 1,805 | 0 | 0 | **95** | 17 | ❌ | ❌ | 50% |
| **alert-breaker** (熔断) | 659 | 1 | 6 | 6 | 6 | ✅ | ✅ | 60% |
| **alert-correlation** (关联) | 600 | 0 | 9 | 8 | 14 | ✅ | ❌ | 55% |
| **alert-deduplication** (去重) | 254 | 0 | 5 | 6 | 0 | ✅ | ❌ | 45% |
| **alert-pipeline** (管道) | 2,054 | 0 | 0 | 0 | 0 | ❌ | ❌ | 30% |
| **alert-silence** (静默) | 504 | 0 | 7 | 7 | 15 | ✅ | ❌ | 55% |
| **notification** (通知引擎) | 18,144 | 18 | 0 | 0 | 0 | ❌ | ✅ | 85% |
| **notification-management** | 369 | 1 | 6 | 6 | 6 | ✅ | ✅ | 60% |
| **notification-policy** | 1,097 | 1 | 16 | 19 | 13 | ✅ | ❌ | 75% |
| **notification-template** | 822 | 1 | 12 | 15 | 7 | ✅ | ❌ | 70% |
| **scheduled-notification** | 965 | 1 | 14 | 14 | 10 | ✅ | ❌ | 75% |
| **channel** | 523 | 1 | 7 | 7 | 7 | ✅ | ❌ | 60% |
| **do-not-disturb** | 373 | 1 | 5 | 5 | 5 | ✅ | ❌ | 55% |

### 域级 P0 问题

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **未 wiring** | alert-adapter (3,311 行, 114S) | **最大告警模块完全不可用** |
| 2 | **未 wiring** | alert-correlation (600 行) | 关联分析不可用 |
| 3 | **未 wiring** | alert-deduplication (254 行) | 去重不可用 |
| 4 | **未 wiring** | alert-silence (504 行) | 静默不可用 |
| 5 | **未 wiring** | notification-policy/template/scheduled/channel/dnd (5 模块) | 通知管理不可用 |
| 6 | **零测试** | alert-adapter/alert-correlation/alert-deduplication/alert-pipeline/alert-silence (5 模块) | 核心模块零测试 |
| 7 | **未 wiring** | alert-adapter-v2 (1,805 行, 95S) | v2 适配器不可用 |
| 8 | **alert-pipeline 异常** | 2,054 行但 0 Handler/0 Service/0 Repo | 无标准三层架构 |
| 9 | **notification 异常** | 18,144 行但 0 Handler/0 Service/0 Repo | 非标准三层架构 |

---

## 二、核心模块深度分析

### 2.1 alert-adapter (SPI 适配器) — 95% ⚠️ 域内最强但未 wiring

**114 Service 方法**，告警数据源适配器框架，10 种适配器：

| 适配器 | 说明 |
|--------|------|
| Prometheus | 指标告警 |
| Zabbix | 传统监控 |
| Grafana | 可视化告警 |
| Kafka | 消息队列 |
| Webhook | HTTP 回调 |
| Slack | IM 通知 |
| Email | 邮件 |
| WeChat | 企业微信 |
| DingTalk | 钉钉 |
| PagerDuty | 值班告警 |

### 2.2 alert (告警主模块) — 90%

| 能力 | 方法 |
|------|------|
| 告警 CRUD | Create/Get/List/Update/Delete |
| 状态管理 | Acknowledge/Resolve/Escalate |
| 告警规则 | 阈值/时间窗口/条件 |

### 2.3 notification (通知引擎) — 85% ⚠️ 架构异常

**18,144 行** — 全平台最大模块，但 **0 Handler / 0 Service / 0 Repo**：
- 非标准三层架构，可能为直接嵌入的框架代码
- 18 测试文件
- **已注册 wiring**

### 2.4 alert-pipeline (告警管道) — 30% ⚠️ 架构异常

**2,054 行但 0 Handler/0 Service/0 Repo/0 测试**：
- 内部组件，非标准三层架构
- 6 阶段责任链：receive → validate → dedup → enrich → route → notify → track
- **未注册 wiring**

### 2.5 notification-policy (通知策略) — 75% ⚠️ 未 wiring

| 能力 | 方法 |
|------|------|
| 策略 CRUD | Create/Get/List/Update/Delete |
| 策略评估 | Evaluate |
| 策略版本 | Version |

### 2.6 scheduled-notification (定时通知) — 75% ⚠️ 未 wiring

| 能力 | 方法 |
|------|------|
| 定时任务 | Create/Get/List/Update/Delete |
| 调度 | Schedule/Execute |
| 历史 | GetHistory |

### 2.7 do-not-disturb (免打扰) — 55% ⚠️ 未 wiring

| 能力 | 方法 |
|------|------|
| 规则 CRUD | Create/Get/List/Update/Delete |
| 评估 | IsDisturb |

---

*分析完成: 2026-08-02 | 通知告警域 15 模块*
