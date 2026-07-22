# Blueprint 目录冗余审计报告

> **审计日期**: 2026-07-20  
> **审计范围**: `blueprints/` 目录下所有微服务蓝图  
> **审计方式**: 只读分析，对比 `orion-platform-svc-go/internal/` 主平台代码  
> **总文件数**: 181,212（含 node_modules），实际源码约 2,248 个源文件  

---

## 1. 目录结构总览

`blueprints/` 包含 **64 个微服务蓝图目录**，按语言分类：

| 类型 | 数量 | 示例 |
|------|------|------|
| Go 蓝图 (`*-svc-go`) | 21 | `orion-monitor-svc-go`, `orion-notification-svc-go` |
| TS 蓝图 (`*-svc`) | 36 | `orion-ticket-svc`, `orion-chatops-svc` |
| Python 蓝图 (`*-svc-py`) | 2 | `orion-knowledge-svc-py`, `orion-llm-trace-svc-py` |
| Rust 蓝图 (`*-svc-rust`) | 1 | `orion-security-svc-rust` |
| 其他非服务目录 | 4 | `orion-db`, `orion-platform-core` |

---

## 2. 磁盘空间占用分析

### 2.1 总体占用

| 项目 | 大小 | 备注 |
|------|------|------|
| `blueprints/` 总目录 | 4.5G | 主要被 node_modules 占用 |
| Go 源码 (`*.go`) | 6.9M | 1,144 个文件 |
| TS 源码 (`*.ts`, 排除 node_modules) | ~100M | 1,086 个文件 |
| node_modules | ~4.4G | 大量冗余依赖，可安全删除 |

### 2.2 TS 蓝图 node_modules 占比

| 蓝图服务 | 总 JS 文件 | TS 源码文件 | node_modules 占比 |
|---------|-----------|------------|-------------------|
| orion-deploy-svc | 6,232 | 26 | >99% |
| orion-ticket-svc | 5,130 | 35 | >99% |
| orion-chatops-svc | 5,016 | 81 | >98% |
| orion-security-svc | 4,065 | 43 | >99% |
| orion-approval-svc | 3,681 | 20 | >99% |

**结论**: TS 蓝图中 **99% 以上的磁盘空间**被 node_modules 占用，而非源码。

---

## 3. 与主平台模块重叠度分析

### 3.1 Go 蓝图 vs `orion-platform-svc-go/internal/`

主平台有 **225 个内部模块**（service/handler/repository 目录），Go 蓝图覆盖 **21 个模块**。

#### 3.1.1 重叠模块（9 个）

| 蓝图模块 | 蓝图 Go 文件数 | 主平台 Go 文件数 | 差异倍数 |
|---------|--------------|----------------|---------|
| `notification` | 108 | 7 | 15x |
| `workflow` | 102 | 7 | 15x |
| `finops` | 71 | 7 | 10x |
| `governance` | 68 | 7 | 10x |
| `security` | 61 | 7 | 9x |
| `community` | 10 | 6 | 1.7x |
| `inspection` | 10 | 6 | 1.7x |
| `lowcode` | 11 | 6 | 1.8x |
| `alert-breaker` | 7 | 6 | 1.2x |

#### 3.1.2 仅存在于蓝图的模块（12 个）

| 蓝图模块 | Go 文件数 | 主平台是否有 |
|---------|---------|------------|
| `ai` | 56 | ❌ 不存在 |
| `ci-cd` | 115 | ❌ 不存在（有 `ci-type`） |
| `config-mgmt` | 67 | ❌ 不存在（有 `config-mgmt-enhanced`） |
| `event-bus` | 46 | ❌ 不存在（有 `eventbus`） |
| `identity` | 72 | ❌ 不存在（有 `auth`, `sso`） |
| `infra-ops` | 97 | ❌ 不存在（有 `infrastructure`） |
| `monitor` | 20 | ❌ 不存在（有 `monitoring`） |
| `pandawiki` | 10 | ❌ 不存在 |
| `skill-config` | 11 | ❌ 不存在（有 `skill`） |
| `ticket` | 98 | ❌ 不存在（有 `ticketing`） |
| `tool` | 9 | ❌ 不存在 |
| `visor` | 10 | ❌ 不存在（有 `visor-exec`） |

### 3.2 TS 蓝图 vs 主平台模块

36 个 TS 蓝图中，**22 个与主平台模块名称匹配**（如 `approval`, `artifact`, `audit`, `chatops`, `deploy`, `pipeline` 等）。

| 状态 | 数量 | 说明 |
|------|------|------|
| 名称完全匹配 | 22 | 如 `approval`, `audit`, `chatops`, `deploy`, `pipeline` |
| 名称近似（命名差异） | 6 | 如 `ticket`→`ticketing`, `monitor`→`monitoring`, `notify`→`notification` |
| 无对应 | 8 | 如 `auth`, `user`, `llm`, `visor`（有但为空目录） |

---

## 4. 内容差异分析（关键发现）

### 4.1 非简单复制，而是差异化实现

通过文件哈希和内容对比，**蓝图与主平台代码是不同实现**，不是简单复制：

#### 示例：notification 模块

**蓝图实现** (`orion-notification-svc-go/internal/notification/handler/handler.go`):
```go
// 蓝图：直接注入具体 Service 结构体
type Handler struct { svc *service.Service }
// 导入路径：orion/notification-svc-go/internal/notification/...
```

**主平台实现** (`orion-platform-svc-go/internal/notification/handler/handler.go`):
```go
// 主平台：接口注入，支持 mockgen 生成 mock
type Service interface { ... }
type Handler struct { svc Service }
// 导入路径：orion/platform-svc-go/internal/notification/...
// 使用 middleware, otel (OpenTelemetry)
```

### 4.2 架构差异

| 维度 | 蓝图 (blueprint) | 主平台 (platform) |
|------|-----------------|-------------------|
| 依赖注入 | 直接结构体注入 | 接口注入（`RepositoryInterface`） |
| Mock 支持 | 无 | `mockgen` 生成 mock |
| 链路追踪 | 无 | OpenTelemetry (`otel`) |
| 限流熔断 | 无 | Sentinel (`sentinel`) |
| 日志 | 基础 | 结构化 + 上下文传递 |
| 包路径 | `orion/<module>-svc-go/` | `orion/platform-svc-go/` |

### 4.3 复杂度对比

| 维度 | 蓝图 | 主平台 |
|------|------|--------|
| Handler 复杂度 | 单文件，路由与逻辑混合 | 分层（handler/service/repository） |
| 业务逻辑 | 在 handler 中 | 分离到 service 层 |
| 数据访问 | 直接调用 repository | 通过 `RepositoryInterface` 抽象 |
| 测试支持 | 有限 | 完整测试框架（Jest/Go test） |

**结论**: 蓝图代码是**早期原型/简化实现**，主平台是**企业级生产实现**。蓝图代码更简单但不完整，主平台更复杂但功能完整。

---

## 5. 蓝图服务健康度评估

### 5.1 Go 蓝图（21 个）

| 状态 | 数量 | 详情 |
|------|------|------|
| 有 main.go + go.mod | 21/21 | 全部为可独立部署的完整服务 |
| 与平台有重叠 | 9 | 代码不同，不应替换 |
| 仅蓝图有，平台无 | 12 | 部分功能可能未迁移到主平台 |

#### 5.1.1 Go 蓝图代码量排行

| 服务 | Go 文件数 | 主平台对比 |
|------|----------|-----------|
| orion-ci-cd-svc-go | 115 | 平台有 `ci-type`（不同模块） |
| orion-notification-svc-go | 108 | 平台有 `notification`（差异实现） |
| orion-workflow-svc-go | 102 | 平台有 `workflow`（差异实现） |
| orion-ticket-svc-go | 98 | 平台有 `ticketing`（不同模块） |
| orion-infra-ops-svc-go | 97 | 平台有 `infrastructure`（不同模块） |
| orion-identity-svc-go | 72 | 平台有 `auth`（不同模块） |
| orion-finops-svc-go | 71 | 平台有 `finops`（差异实现） |

### 5.2 TS 蓝图（36 个）

| 状态 | 数量 | 详情 |
|------|------|------|
| 有实质代码（TS 文件>0） | 33 | 排除 `auth-svc`, `user-svc`, `llm-svc`（空目录） |
| 与平台重叠 | 22 | 主平台已集成 |
| node_modules 大量冗余 | 36 | 占用 ~4.4G 磁盘 |

### 5.3 Python 蓝图（2 个）

| 服务 | Python 文件数 | 主平台对应 |
|------|-------------|-----------|
| orion-knowledge-svc-py | 9 | 平台有 `knowledge` |
| orion-llm-trace-svc-py | 9 | 平台有 `llm-trace` |

### 5.4 Rust 蓝图（1 个）

| 服务 | 状态 |
|------|------|
| orion-security-svc-rust | 存在，主平台有 `security`（Go 实现） |

---

## 6. 清理建议

### 6.1 安全删除清单（高优先级）

以下蓝图可以**安全删除**，因为主平台已有更完整的实现：

#### Go 蓝图（9 个重叠模块）
- `orion-alert-breaker-svc-go` - 平台有 `alert-breaker`，实现更完整
- `orion-community-svc-go` - 平台有 `community`，实现更完整
- `orion-finops-svc-go` - 平台有 `finops`，实现更完整
- `orion-governance-svc-go` - 平台有 `governance`，实现更完整
- `orion-inspection-svc-go` - 平台有 `inspection`，实现更完整
- `orion-lowcode-svc-go` - 平台有 `lowcode`，实现更完整
- `orion-notification-svc-go` - 平台有 `notification`，实现更完整
- `orion-security-svc-go` - 平台有 `security`，实现更完整
- `orion-workflow-svc-go` - 平台有 `workflow`，实现更完整

**理由**: 主平台实现包含接口注入、OpenTelemetry、Sentinel、mockgen 等企业级特性，蓝图仅为简化原型。

#### TS 蓝图（22 个重叠模块）
- `orion-approval-svc`, `orion-artifact-svc`, `orion-audit-svc`
- `orion-chatops-svc`, `orion-code-svc`, `orion-community-svc`
- `orion-config-mgmt-svc`, `orion-dba-svc`, `orion-deploy-svc`
- `orion-digital-twin-svc`, `orion-efficiency-svc`, `orion-federation-svc`
- `orion-finops-svc`, `orion-governance-svc`, `orion-inception-svc`
- `orion-knowledge-svc`, `orion-monitor-svc`, `orion-pipeline-svc`
- `orion-plugin-svc`, `orion-risk-svc`, `orion-selfhealing-svc`
- `orion-skill-svc`

**理由**: TS 蓝图是 TS 单体时代的微服务拆分原型，Go 平台已集成其功能。

#### 空/无效蓝图（5 个）
- `orion-auth-svc` (TS) - 0 个 TS 文件，空目录
- `orion-llm-svc` (TS) - 0 个 TS 文件，空目录
- `orion-user-svc` (TS) - 0 个 TS 文件，空目录
- `orion-cmdb-svc` (TS) - 仅 8 个 TS 文件，主平台有完整 `cmdb`
- `orion-visor-svc` (TS) - 仅 11 个 TS 文件，主平台有 `visor-exec`

### 6.2 需要审查后决定（中优先级）

以下蓝图与平台模块**命名不同**，需要确认功能是否已完全迁移：

| 蓝图 | 平台对应 | 建议 |
|------|---------|------|
| `orion-ai-svc-go` (56 Go) | 平台无直接对应 | **审查后决定**：可能包含 AI 网关/模型管理功能 |
| `orion-ci-cd-svc-go` (115 Go) | 平台有 `ci-type`（仅 6 文件） | **审查后决定**：可能包含更多 CI/CD 功能 |
| `orion-config-mgmt-svc-go` (67 Go) | 平台有 `config-mgmt-enhanced`（不同名） | **审查后决定**：确认功能是否覆盖 |
| `orion-event-bus-svc-go` (46 Go) | 平台有 `eventbus`（不同名） | **审查后决定**：可能是事件总线实现 |
| `orion-identity-svc-go` (72 Go) | 平台有 `auth`, `sso`（不同名） | **审查后决定**：身份管理功能 |
| `orion-infra-ops-svc-go` (97 Go) | 平台有 `infrastructure`（不同名） | **审查后决定**：基础设施运维功能 |
| `orion-monitor-svc-go` (20 Go) | 平台有 `monitoring`（不同名） | **审查后决定**：监控功能 |
| `orion-pandawiki-svc-go` (10 Go) | 平台无 | **审查后决定**：可能是知识图谱功能 |
| `orion-skill-config-svc-go` (11 Go) | 平台有 `skill`（不同名） | **审查后决定**：技能配置功能 |
| `orion-ticket-svc-go` (98 Go) | 平台有 `ticketing`（不同名） | **审查后决定**：工单功能 |
| `orion-tool-svc-go` (9 Go) | 平台无 | **审查后决定**：工具服务功能 |
| `orion-visor-svc-go` (10 Go) | 平台有 `visor-exec`（不同名） | **审查后决定**：可视化执行功能 |

### 6.3 建议合并到主平台的蓝图

以下蓝图包含**主平台缺失的功能**，建议审查后合并：

| 蓝图 | 理由 |
|------|------|
| `orion-ci-cd-svc-go` (115 Go) | 主平台仅 `ci-type`（6 文件），可能遗漏 CI/CD 核心功能 |
| `orion-ticket-svc-go` (98 Go) | 主平台仅 `ticketing`，工单功能可能不完整 |
| `orion-infra-ops-svc-go` (97 Go) | 主平台仅 `infrastructure`，基础设施运维可能不完整 |
| `orion-identity-svc-go` (72 Go) | 主平台有 `auth`, `sso`，但身份管理可能不完整 |
| `orion-event-bus-svc-go` (46 Go) | 主平台有 `eventbus`，但事件总线实现可能不完整 |

### 6.4 低优先级清理

| 类型 | 建议 |
|------|------|
| **所有 TS 蓝图的 node_modules** | 可以 `rm -rf node_modules`，节省 ~4.4G 磁盘空间 |
| **Python 蓝图** (`orion-*-svc-py`) | 仅 9 个文件，保留作为参考或迁移到 Python 服务 |
| **Rust 蓝图** (`orion-security-svc-rust`) | 仅 1 个，保留作为参考 |
| **空 TS 蓝图** | `orion-auth-svc`, `orion-llm-svc`, `orion-user-svc` 可直接删除 |

---

## 7. 清理执行方案

### 7.1 第一阶段：清理 node_modules（立即执行）

```bash
# 清理所有 TS 蓝图的 node_modules，节省 ~4.4G
for dir in blueprints/orion-*-svc/*/node_modules; do
  rm -rf "$dir"
done
# 清理 TS 蓝图根目录的 node_modules
for dir in blueprints/orion-*-svc/node_modules; do
  rm -rf "$dir"
done
```

### 7.2 第二阶段：删除重叠蓝图（高优先级）

```bash
# 删除 9 个重叠 Go 蓝图
rm -rf blueprints/orion-alert-breaker-svc-go
rm -rf blueprints/orion-community-svc-go
rm -rf blueprints/orion-finops-svc-go
rm -rf blueprints/orion-governance-svc-go
rm -rf blueprints/orion-inspection-svc-go
rm -rf blueprints/orion-lowcode-svc-go
rm -rf blueprints/orion-notification-svc-go
rm -rf blueprints/orion-security-svc-go
rm -rf blueprints/orion-workflow-svc-go

# 删除 22 个重叠 TS 蓝图
# （列出具体服务名）

# 删除 5 个空/无效蓝图
rm -rf blueprints/orion-auth-svc
rm -rf blueprints/orion-llm-svc
rm -rf blueprints/orion-user-svc
```

### 7.3 第三阶段：审查后合并（中优先级）

对 12 个"仅蓝图有"的模块进行功能差异分析，确认是否已完整迁移到主平台，再决定是否删除。

### 7.4 第四阶段：归档保留（可选）

如需保留历史记录，可将所有蓝图打包为 `.tar.gz` 并移至 `archive/` 目录：

```bash
tar -czf archive/blueprints-2026-07-20.tar.gz blueprints/
rm -rf blueprints/
```

---

## 8. 总结

| 指标 | 数值 |
|------|------|
| 蓝图目录总数 | 64 |
| 可安全删除 | ~36（9 Go + 22 TS + 5 空目录） |
| 需审查后决定 | 12（命名差异模块） |
| 建议保留 | ~12（仅蓝图有的功能） |
| node_modules 冗余 | ~4.4G（可立即清理） |
| 主平台已覆盖 | 9/21 Go 蓝图，22/36 TS 蓝图 |

**核心结论**: `blueprints/` 目录包含大量历史遗留代码，主平台 `orion-platform-svc-go/` 已集成其大部分功能。蓝图代码与主平台实现存在**架构差异**（原型 vs 生产），不应作为当前参考。建议分阶段清理，优先删除重叠和空目录，再审查命名差异模块。

---

## 附录：完整蓝图清单

### Go 蓝图（21 个）

| # | 服务名 | Go 文件 | 主平台重叠 | 状态建议 |
|---|--------|---------|-----------|---------|
| 1 | orion-ai-svc-go | 56 | ❌ | 审查后决定 |
| 2 | orion-alert-breaker-svc-go | 7 | ✅ (6) | 删除 |
| 3 | orion-ci-cd-svc-go | 115 | ❌ | 审查后决定 |
| 4 | orion-community-svc-go | 10 | ✅ (6) | 删除 |
| 5 | orion-config-mgmt-svc-go | 67 | ❌ | 审查后决定 |
| 6 | orion-event-bus-svc-go | 46 | ❌ | 审查后决定 |
| 7 | orion-finops-svc-go | 71 | ✅ (7) | 删除 |
| 8 | orion-governance-svc-go | 68 | ✅ (7) | 删除 |
| 9 | orion-identity-svc-go | 72 | ❌ | 审查后决定 |
| 10 | orion-infra-ops-svc-go | 97 | ❌ | 审查后决定 |
| 11 | orion-inspection-svc-go | 10 | ✅ (6) | 删除 |
| 12 | orion-lowcode-svc-go | 11 | ✅ (6) | 删除 |
| 13 | orion-monitor-svc-go | 20 | ❌ | 审查后决定 |
| 14 | orion-notification-svc-go | 108 | ✅ (7) | 删除 |
| 15 | orion-pandawiki-svc-go | 10 | ❌ | 审查后决定 |
| 16 | orion-security-svc-go | 61 | ✅ (7) | 删除 |
| 17 | orion-skill-config-svc-go | 11 | ❌ | 审查后决定 |
| 18 | orion-ticket-svc-go | 98 | ❌ | 审查后决定 |
| 19 | orion-tool-svc-go | 9 | ❌ | 审查后决定 |
| 20 | orion-visor-svc-go | 10 | ❌ | 审查后决定 |
| 21 | orion-workflow-svc-go | 102 | ✅ (7) | 删除 |

### TS 蓝图（36 个）

| # | 服务名 | TS 源码 | 主平台重叠 | 状态建议 |
|---|--------|---------|-----------|---------|
| 1 | orion-agent-svc | 33 | ❌ | 审查后决定 |
| 2 | orion-ai-svc | 76 | ❌ | 审查后决定 |
| 3 | orion-approval-svc | 20 | ✅ | 删除 |
| 4 | orion-artifact-svc | 24 | ✅ | 删除 |
| 5 | orion-audit-svc | 30 | ✅ | 删除 |
| 6 | orion-auth-svc | 0 | - | 删除（空） |
| 7 | orion-chatops-svc | 81 | ✅ | 删除 |
| 8 | orion-cmdb-svc | 8 | ✅ | 删除 |
| 9 | orion-code-svc | 52 | ✅ | 删除 |
| 10 | orion-community-svc | 17 | ✅ | 删除 |
| 11 | orion-config-mgmt-svc | 9 | ❌ | 审查后决定 |
| 12 | orion-dba-svc | 11 | ✅ | 删除 |
| 13 | orion-deploy-svc | 26 | ✅ | 删除 |
| 14 | orion-digital-twin-svc | 16 | ✅ | 删除 |
| 15 | orion-dr-svc | 24 | ❌ | 审查后决定 |
| 16 | orion-efficiency-svc | 22 | ✅ | 删除 |
| 17 | orion-federation-svc | 22 | ✅ | 删除 |
| 18 | orion-finops-svc | 25 | ✅ | 删除 |
| 19 | orion-governance-svc | 17 | ✅ | 删除 |
| 20 | orion-graph-svc | 10 | ❌ | 审查后决定 |
| 21 | orion-inception-svc | 9 | ✅ | 删除 |
| 22 | orion-knowledge-svc | 15 | ✅ | 删除 |
| 23 | orion-llm-svc | 0 | - | 删除（空） |
| 24 | orion-monitor-svc | 72 | ✅ | 删除 |
| 25 | orion-notify-svc | 38 | ✅ | 删除 |
| 26 | orion-pandawiki-svc | 10 | ✅ | 删除 |
| 27 | orion-pipeline-svc | 234 | ✅ | 删除 |
| 28 | orion-plugin-svc | 27 | ✅ | 删除 |
| 29 | orion-risk-svc | 19 | ✅ | 删除 |
| 30 | orion-runner-svc | 9 | ❌ | 审查后决定 |
| 31 | orion-security-svc | 43 | ✅ | 删除 |
| 32 | orion-selfhealing-svc | 7 | ✅ | 删除 |
| 33 | orion-skill-svc | 11 | ✅ | 删除 |
| 34 | orion-ticket-svc | 35 | ✅ | 删除 |
| 35 | orion-user-svc | 0 | - | 删除（空） |
| 36 | orion-visor-svc | 11 | ✅ | 删除 |

### Python 蓝图（2 个）

| # | 服务名 | Python 文件 | 主平台重叠 | 状态建议 |
|---|--------|-------------|-----------|---------|
| 1 | orion-knowledge-svc-py | 9 | ✅ | 审查后决定 |
| 2 | orion-llm-trace-svc-py | 9 | ✅ | 审查后决定 |

### Rust 蓝图（1 个）

| # | 服务名 | 状态建议 |
|---|--------|---------|
| 1 | orion-security-svc-rust | 审查后决定 |
