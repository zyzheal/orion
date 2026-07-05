# Spec: 配置管理 (Config Management)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 配置管理
> **目标成熟度**: L2 → L3
> **关键交付**: 版本快照、校验 Schema、Webhook 通知、配置模板、灰度发布

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- 配置管理 CRUD（ConfigService + ConfigRepository）
- 环境管理（开发/测试/预发/生产）
- 配置分组（按应用/环境/模块组织）
- GitOps 配置同步基础
- 配置漂移检测基础

**不足**：
- 版本快照管理缺失（无配置变更历史/回退）
- 配置校验 Schema 缺失（无字段类型/约束校验）
- Webhook/通知缺失（配置变更无通知）
- 配置模板缺失（无预定义模板）
- 灰度发布配置不支持

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 版本快照 | 自动版本控制、对比、回退 | L3 |
| 校验 Schema | JSON Schema 定义、自动校验 | L3 |
| Webhook 通知 | 配置变更自动通知、分级告警 | L3 |
| 配置模板 | 预置模板、自定义模板、一键创建 | L3 |
| 灰度发布 | 按比例/条件灰度、自动回滚 | L3 |

## 二、验收标准

### 2.1 版本快照

| # | 标准 | 验证方式 |
|---|------|----------|
| CM1 | 每次配置更新自动创建版本快照，版本号递增 | API 测试 |
| CM2 | 支持版本对比（diff 格式），显示增/删/改 | API 测试 |
| CM3 | 支持回退到任意历史版本（保留历史记录） | API 测试 |
| CM4 | 版本历史按时间倒序，含操作人、变更说明、时间戳 | 前端验证 |
| CM5 | 单个配置最多保留 100 个版本，超出自动清理最旧版本 | 单元测试 |

### 2.2 校验 Schema

| # | 标准 | 验证方式 |
|---|------|----------|
| CM6 | 支持为配置定义 JSON Schema（类型/必填/枚举/正则/范围） | API 测试 |
| CM7 | 配置更新时自动校验 Schema，校验失败拒绝保存 | 集成测试 |
| CM8 | 校验失败返回具体错误信息（字段名、约束、期望值） | API 测试 |
| CM9 | 预置 8+ 公共 Schema（数据库/Redis/日志/端口/URL/证书/限流/超时） | 单元测试 |
| CM10 | Schema 支持版本管理，更新不影响已有配置 | API 测试 |

### 2.3 Webhook 通知

| # | 标准 | 验证方式 |
|---|------|----------|
| CM11 | 配置变更时触发 Webhook，含变更内容/操作人/时间 | 集成测试 |
| CM12 | 支持多通知渠道（邮件/钉钉/企微/飞书） | 集成测试 |
| CM13 | 敏感配置变更（密码/密钥/证书）发送高优先级通知 | 集成测试 |
| CM14 | Webhook 目标可配置，支持 URL 和 Secret 签名 | API 测试 |

### 2.4 配置模板

| # | 标准 | 验证方式 |
|---|------|----------|
| CM15 | 预置 6+ 模板（Nginx/Redis/PostgreSQL/Node.js/Java/NATS） | 前端验证 |
| CM16 | 从模板创建配置时自动填充默认值，支持参数覆盖 | 前端 + API 测试 |
| CM17 | 模板支持版本管理，更新不影响已创建的配置 | API 测试 |

### 2.5 灰度发布

| # | 标准 | 验证方式 |
|---|------|----------|
| CM18 | 支持按比例灰度（10%/20%/50%/100%） | API 测试 |
| CM19 | 支持按条件灰度（实例标签/版本号/IP 段） | API 测试 |
| CM20 | 灰度期间自动监控错误率，超过阈值自动回滚 | 集成测试 |
| CM21 | 灰度状态可视化，显示已发布范围和健康状态 | 前端验证 |

## 三、API 设计

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/config` | 配置列表 |
| POST | `/api/v1/config` | 创建配置 |
| PUT | `/api/v1/config/:id` | 更新配置 |
| GET | `/api/v1/config/:id/versions` | 版本历史 |
| POST | `/api/v1/config/:id/rollback/:vid` | 回退版本 |
| GET | `/api/v1/config/schemas` | Schema 列表 |
| POST | `/api/v1/config/schemas` | 创建 Schema |
| PUT | `/api/v1/config/schemas/:id` | 更新 Schema |
| GET | `/api/v1/config/templates` | 模板列表 |
| POST | `/api/v1/config/templates` | 创建模板 |
| POST | `/api/v1/config/:id/canary` | 发起灰度发布 |
| GET | `/api/v1/config/:id/canary` | 灰度发布状态 |
| POST | `/api/v1/config/:id/canary/promote` | 全量发布 |
| POST | `/api/v1/config/:id/canary/rollback` | 灰度回滚 |

## 四、数据模型

```sql
-- 配置版本快照
CREATE TABLE IF NOT EXISTS config_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES config(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  value           JSONB NOT NULL,
  schema_id       UUID,
  change_summary  TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(config_id, version)
);

-- 灰度发布记录
CREATE TABLE IF NOT EXISTS config_canary_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES config(id),
  version         INT NOT NULL,
  strategy        JSONB NOT NULL,
  progress        INT DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'running',
  error_rate      DECIMAL(5,2) DEFAULT 0,
  auto_rollback   BOOLEAN DEFAULT true,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
```

## 五、前端设计

**路由**: `/config`

主要页面：
- 配置列表页：按应用/环境分组展示
- 配置详情页：编辑、版本历史、回退
- Schema 管理页：创建/编辑校验规则
- 模板库页：预置模板和自定义模板
- 灰度管理页：灰度发布状态、推进/回滚

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 22 | ConfigVersionService、SchemaValidator、CanaryReleaseService |
| 集成测试 | 6 | 版本生命周期、Schema 校验、灰度完整流程 |
| 前端测试 | 4 | 配置编辑器、版本对比、灰度仪表盘 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
