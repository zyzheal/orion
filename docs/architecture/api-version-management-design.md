# API Version Management Design

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**优先级**: P1  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会、平台基础团队、SRE 团队  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台 API 版本管理的完整方案。当前 Orion 平台缺乏规范的 API 版本化管理机制，导致 API 演进过程中频繁出现破坏性变更，影响调用方稳定性，无法支持多版本并行，缺乏废弃下线流程。

### 当前问题分析

| 问题类别 | 当前状态 | 风险等级 | 影响范围 |
|---------|---------|---------|---------|
| 版本化策略 | 无统一规范 | 高 | API 演进困难、调用方频繁适配 |
| 版本路由 | 硬编码路径 | 中 | 无法灵活切换版本、灰度发布困难 |
| 兼容性规则 | 无明确定义 | 高 | 破坏性变更无预警、调用方故障 |
| 生命周期管理 | 无流程 | 高 | 旧版本长期占用资源、无法下线 |
| 废弃通知 | 无机制 | 中 | 调用方不知情、迁移滞后 |
| 监控指标 | 无版本维度 | 中 | 无法评估版本使用情况 |

### 版本管理方案总览

| 管理领域 | 核心能力 | 预期收益 |
|---------|---------|---------|
| **版本化策略** | URL 路径版本 + Header 版本 + 内容协商 | 清晰可见、灵活适配 |
| **版本路由** | 精确匹配 + 前缀匹配 + 正则匹配 | 灵活路由、灰度发布 |
| **兼容性规则** | BREAKING vs NON-BREAKING 判定 | 破坏性变更可控 |
| **生命周期** | 草案→测试→稳定→废弃→下线 | 有序演进、资源释放 |
| **废弃管理** | 6 个月过渡期 + 3 次警告通知 | 调用方充分迁移 |
| **迁移支持** | 自动化检测 + 差异对比 + 迁移脚本 | 降低迁移成本 |
| **多版本并行** | 版本隔离 + 流量切换 + 回滚机制 | 平滑过渡、风险可控 |
| **SDK 管理** | SDK 与 API 版本映射 | 调用方便捷升级 |
| **监控指标** | 各版本 QPS + 错误率 + 弃用 API 调用 | 数据驱动决策 |

### 预期收益量化

| 指标 | 当前 | 增强后目标 | 改善幅度 |
|------|------|-----------|---------|
| API 破坏性变更 | 月均 3 次 | 0 次 | 100% |
| 版本迁移周期 | 2-4 周 | 3-5 天 | 75% |
| 旧版本资源占用 | 30%+ | <5% | 83% |
| 调用方满意度 | 65% | >90% | 38% |
| 废弃 API 调用率 | 无监控 | <1% | - |
| 版本监控覆盖率 | 0% | 95% | - |

---

## 一、API 版本化策略对比 (API Versioning Strategies Comparison)

### 1.1 主流版本化策略详解

API 版本化是 RESTful API 设计中的核心决策，直接影响 API 的可演进性和调用方体验。业界主流有三种策略，各有优劣。

#### 1.1.1 URL 路径版本化 (URL Path Versioning)

**格式**: `/api/{version}/{resource}`

**示例**:
```
GET /api/v1/users
GET /api/v2/users
POST /api/v1/artifacts
```

**优点**:
| 优点 | 详细说明 | 重要性 |
|------|---------|--------|
| 清晰可见 | 版本号直接体现在 URL 中，开发者一眼就能识别 | 高 |
| 浏览器友好 | 可直接在浏览器地址栏输入测试，无需额外工具 | 高 |
| 文档自动生成 | OpenAPI/Swagger 可自动按版本分组生成文档 | 中 |
| 缓存友好 | 不同版本 URL 天然隔离，CDN/代理缓存不会混淆 | 中 |
| 调试方便 | 日志、监控中直接可见版本号，排查问题方便 | 高 |

**缺点**:
| 缺点 | 详细说明 | 缓解措施 |
|------|---------|---------|
| 违反 REST 纯性 | REST 倡导 URL 标识资源，版本是元数据不应在 URL 中 | 接受务实折中 |
| URL 结构变化 | 同一资源在不同版本有不同 URL | 提供版本间映射 |
| 链接失效 | 硬编码的 URL 在版本下线后失效 | 提供重定向机制 |

**适用场景**:
- 绝大多数公开 API（Public API）
- 需要直接浏览器访问的场景
- 调用方多样化的开放平台
- 需要清晰文档和示例的场景

#### 1.1.2 请求头版本化 (Header Versioning)

**格式**: 通过自定义 HTTP Header 指定版本

**示例**:
```http
GET /api/users
X-API-Version: 2

GET /api/users
Accept-Version: v2

GET /api/users
X-Orion-API-Version: 2024-01-15
```

**优点**:
| 优点 | 详细说明 | 重要性 |
|------|---------|--------|
| URL 保持整洁 | 资源 URL 不包含版本，符合 REST 理念 | 中 |
| 语义清晰 | 版本作为元数据与资源分离 | 中 |
| 默认最新 | 不指定版本时默认返回最新版 | 高 |
| 链接稳定 | 资源 URL 不变，版本下线时可重定向 | 中 |

**缺点**:
| 缺点 | 详细说明 | 影响 |
|------|---------|------|
| 浏览器不友好 | 无法直接在浏览器测试，需要 Postman 等工具 | 高 |
| 调试不便 | 日志中需要额外解析 Header 才能知道版本 | 中 |
| 缓存复杂 | 需要配置 Vary 头，否则缓存可能混淆版本 | 中 |
| 文档复杂 | 需要额外说明 Header 用法 | 低 |

**适用场景**:
- 内部服务间调用（Internal API）
- SPA 应用、移动端 App
- 调用方可控的场景
- 对 URL 整洁度要求高的场景

#### 1.1.3 内容协商版本化 (Content Negotiation)

**格式**: 通过 Accept Header 的媒体类型指定版本

**示例**:
```http
GET /api/users
Accept: application/vnd.orion.v1+json

GET /api/users
Accept: application/vnd.orion.v2+json

GET /api/users
Accept: application/vnd.orion+json; version=2
```

**优点**:
| 优点 | 详细说明 | 重要性 |
|------|---------|--------|
| 最符合 HTTP 规范 | 充分利用 HTTP 内容协商机制 | 高 |
| 支持多版本共存 | 同一请求可接受多种版本格式 | 中 |
| 语义最精确 | 版本、格式、编码都在 Accept 中表达 | 中 |
| HATEOAS 友好 | 支持超媒体驱动的应用 | 低 |

**缺点**:
| 缺点 | 详细说明 | 影响 |
|------|---------|------|
| 实现复杂 | 需要解析复杂的媒体类型参数 | 高 |
| 调试困难 | 开发者不易理解和记忆格式 | 高 |
| 文档复杂 | 需要详细说明媒体类型格式 | 中 |
| 工具支持差 | 部分 HTTP 客户端不支持复杂 Accept | 中 |

**适用场景**:
- 对外部合作伙伴 API
- 企业级集成场景
- 需要高度灵活性的场景
- 严格遵循 REST/HATEOAS 的场景

### 1.2 版本化策略对比矩阵

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    API Version Strategy Comparison Matrix                        │
└─────────────────────────────────────────────────────────────────────────────────┘

评估维度权重:
├── 易用性 (30%): 开发者学习成本、调试便利性
├── 规范性 (20%): 符合 REST/HTTP 标准程度
├── 可维护性 (25%): 文档、监控、排查难度
├── 灵活性 (15%): 支持场景多样性
├── 性能 (10%): 缓存、路由效率

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Strategy Comparison Scorecard                            │
├──────────────────────┬─────────────┬─────────────┬─────────────┬───────────────┤
│      评估维度         │ URL 路径版本  │ Header 版本  │ 内容协商     │ 权重          │
├──────────────────────┼─────────────┼─────────────┼─────────────┼───────────────┤
│ 易用性                │ ★★★★★ (5)   │ ★★★☆☆ (3)   │ ★★☆☆☆ (2)   │ 30%           │
│ 规范性                │ ★★★☆☆ (3)   │ ★★★★☆ (4)   │ ★★★★★ (5)   │ 20%           │
│ 可维护性              │ ★★★★★ (5)   │ ★★★☆☆ (3)   │ ★★☆☆☆ (2)   │ 25%           │
│ 灵活性                │ ★★★☆☆ (3)   │ ★★★★☆ (4)   │ ★★★★★ (5)   │ 15%           │
│ 性能                  │ ★★★★★ (5)   │ ★★★★☆ (4)   │ ★★★☆☆ (3)   │ 10%           │
├──────────────────────┼─────────────┼─────────────┼─────────────┼───────────────┤
│ 加权得分              │ 4.40        │ 3.40        │ 2.85        │ 100%          │
├──────────────────────┼─────────────┼─────────────┼─────────────┼───────────────┤
│ 推荐指数              │ ★★★★★       │ ★★★☆☆       │ ★★☆☆☆       │ -             │
└──────────────────────┴─────────────┴─────────────┴─────────────┴───────────────┘

计算过程:
URL 路径版本：5×0.30 + 3×0.20 + 5×0.25 + 3×0.15 + 5×0.10 = 1.50 + 0.60 + 1.25 + 0.45 + 0.50 = 4.30
Header 版本：  3×0.30 + 4×0.20 + 3×0.25 + 4×0.15 + 4×0.10 = 0.90 + 0.80 + 0.75 + 0.60 + 0.40 = 3.45
内容协商：    2×0.30 + 5×0.20 + 2×0.25 + 5×0.15 + 3×0.10 = 0.60 + 1.00 + 0.50 + 0.75 + 0.30 = 3.15
```

### 1.3 版本化策略对比图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    API Version Strategy Comparison Diagram                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                         易用性 ─────────────────────────────────┐
                              │                                   │
                              │                                   │
                          5   │        ● URL 路径                  │
                              │                                   │
                              │                                   │
                          4   │                  ● Header         │
                              │                                   │
                              │                                   │
                          3   │                      ● 内容协商     │
                              │                                   │
                              │                                   │
                          2   │                                   │
                              │                                   │
                              │                                   │
                          1   │                                   │
                              │                                   │
                              └───────────────────────────────────┘
                               规范   维护   灵活   性能
                              性     性     性     

                         综合得分对比:
                              │
                          5.0 │┌───────────┐
                              ││           │
                          4.0 ││  ●●●●●    │  URL 路径：4.40
                              ││           │
                          3.0 ││           │  ┌───────────┐
                              ││           │  │  ●●●●     │  Header: 3.40
                          2.0 ││           │  │           │
                              ││           │  │           │  ┌───────────┐
                          1.0 ││           │  │           │  │  ●●●      │  内容协商：2.85
                              ││           │  │           │  │           │
                          0.0 └┴───────────┴──┴───────────┴──┴───────────┘
                                URL 路径     Header     内容协商

                         推荐场景矩阵:
                         ┌─────────────────────────────────────────────────────┐
                         │                   调用方多样性                       │
                         │              高                低                   │
                         │         ┌─────────────┬─────────────┐               │
                         │    高   │ URL 路径     │ URL 路径     │               │
                         │         │ (公开 API)   │ (内部 API)   │               │
                         │  文档   ├─────────────┼─────────────┤               │
                         │  需求   │  URL 路径     │  Header     │               │
                         │         │ (开放平台)   │ (可控调用)   │               │
                         │    低   ├─────────────┼─────────────┤               │
                         │         │  内容协商    │  Header     │               │
                         │         │ (企业集成)   │ (内部服务)   │               │
                         │         └─────────────┴─────────────┘               │
                         └─────────────────────────────────────────────────────┘
```

### 1.4 业界实践参考

| 公司/平台 | 采用策略 | 理由 | 参考链接 |
|----------|---------|------|---------|
| GitHub | URL 路径 (`/api/v3/`) | 清晰可见、文档友好 | https://docs.github.com/en/rest |
| Stripe | URL 日期版本 (`/v2024-01-15/`) | 精确版本控制 | https://stripe.com/docs/api/versioning |
| Twilio | URL 路径 (`/2015-04-01/`) | 日期版本便于追溯 | https://www.twilio.com/docs/usage/api-versioning |
| AWS | Header + URL 混合 | 不同服务有不同历史原因 | 各服务文档 |
| Google Cloud | URL 路径 (`/v1/`) | 统一体验、易于理解 | https://cloud.google.com/apis/design/versioning |
| Microsoft Graph | URL 路径 (`/v1.0/`, `/beta/`) | 支持稳定版和预览版 | https://learn.microsoft.com/en-us/graph/api/overview |
| Netflix | Header 版本 | 内部服务调用为主 | - |
| Alibaba OpenAPI | URL 路径 (`/v2/`) | 开放平台标准实践 | https://open.alibaba.com |

---

## 二、Orion 版本化方案选择 (Orion Versioning Strategy Selection)

### 2.1 推荐方案：URL 路径版本化

基于 Orion 平台的定位、调用方多样性、运维需求等综合因素，**推荐采用 URL 路径版本化作为主要策略**，同时保留 Header 版本化作为补充。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Orion API Versioning Strategy                            │
└─────────────────────────────────────────────────────────────────────────────────┘

主策略：URL 路径版本化 (Primary Strategy)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Format: /api/{version}/{resource}                                              │
│                                                                                  │
│  Examples:                                                                       │
│  ├── /api/v1/users                      # 用户管理 V1                            │
│  ├── /api/v2/users                      # 用户管理 V2                            │
│  ├── /api/v1/artifacts                  # 产物管理 V1                            │
│  ├── /api/v1/pipelines/{id}/execute     # 流水线执行 V1                          │
│  ├── /api/v1/tenants/{id}/quotas        # 租户配额 V1                            │
│  └── /api/beta/ai/chat                  # AI 对话 Beta 版                         │
│                                                                                  │
│  Version Format:                                                                 │
│  ├── v{major}                           # 主版本 (如 v1, v2, v3)                  │
│  ├── v{major}.{minor}                   # 主版本。次版本 (如 v1.1, v2.3)          │
│  ├── beta                               # 公开测试版                              │
│  └── alpha                              # 内部测试版 (不公开)                     │
└─────────────────────────────────────────────────────────────────────────────────┘

辅助策略：Header 版本化 (Fallback Strategy)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Format: X-API-Version Header                                                   │
│                                                                                  │
│  Examples:                                                                       │
│  ├── GET /api/users                                                             │
│  │   X-API-Version: 2                                                           │
│  │   → 路由到 /api/v2/users                                                     │
│  │                                                                              │
│  └── GET /api/users                                                             │
│      (无 X-API-Version Header)                                                   │
│      → 路由到默认版本 /api/v1/users                                             │
└─────────────────────────────────────────────────────────────────────────────────┘

特殊策略：内容协商 (用于特定场景)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Format: Accept Header                                                          │
│                                                                                  │
│  Example:                                                                        │
│  ├── GET /api/users                                                             │
│  │   Accept: application/vnd.orion.v2+json                                      │
│  │   → 返回 V2 格式的用户数据                                                    │
│  │                                                                              │
│  └── 用于：外部合作伙伴集成、企业级对接等特殊场景                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 选择理由详细说明

| 理由 | 详细说明 | Orion 场景适配 |
|------|---------|---------------|
| **调用方多样性** | Orion 有前端、移动端、CLI、外部集成等多种调用方 | URL 路径最易理解，降低学习成本 |
| **文档需求** | 需要自动生成 OpenAPI 文档并提供在线调试 | URL 路径版本天然支持 Swagger UI 分组 |
| **运维排查** | 日志、监控需要快速识别 API 版本 | URL 路径在日志中直接可见 |
| **缓存策略** | CDN 和代理需要区分不同版本 | 不同 URL 天然隔离，缓存配置简单 |
| **渐进迁移** | 需要支持多版本并行和灰度发布 | URL 路径便于流量切分和路由 |
| **团队现状** | 平台团队对 URL 版本化经验更丰富 | 降低实施风险 |

### 2.3 版本 URL 规范

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Orion API URL Specification                              │
└─────────────────────────────────────────────────────────────────────────────────┘

标准格式:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  https://{domain}/api/{version}/{resource}/{id}/{sub-resource}                  │
│                                                                                  │
│  Components:                                                                     │
│  ├── domain: API 网关域名 (api.orion.io / api-internal.orion.io)                 │
│  ├── version: API 版本 (v1, v2, v3, beta)                                        │
│  ├── resource: 资源名称 (复数形式，kebab-case)                                   │
│  ├── id: 资源标识符 (可选)                                                       │
│  └── sub-resource: 子资源 (可选)                                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

命名规范:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Element          │  Format           │  Example              │  Note           │
├─────────────────────────────────────────────────────────────────────────────────┤
│  资源名称          │  复数，kebab-case  │  /users, /artifacts   │  不用单数       │
│                   │                   │  /build-artifacts     │  复合词用连字符  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  资源 ID          │  路径参数          │  /users/{id}          │  不用 /users/:id │
│                   │                   │  /artifacts/{name}    │  名称可做 ID      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  子资源           │  嵌套路径          │  /users/{id}/roles    │  不用 /users/{id}?resource=roles │
│                   │                   │  /teams/{id}/members  │                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  操作             │  HTTP 方法         │  GET/POST/PUT/DELETE  │  不用 /users/{id}/delete │
│                   │                   │  POST /users/{id}/ban │  特殊操作用 POST  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  版本前缀          │  /api/v{n}        │  /api/v1, /api/v2     │  统一小写 v 前缀  │
│                   │  /api/beta        │  /api/beta            │  测试版用 beta   │
└─────────────────────────────────────────────────────────────────────────────────┘

正确与错误示例对比:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✅ 正确示例                               │  ❌ 错误示例                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  GET /api/v1/users                        │  GET /api/v1/user (单数)            │
│  GET /api/v1/users/{id}                   │  GET /api/v1/users/{userId} (驼峰)  │
│  GET /api/v1/build-artifacts              │  GET /api/v1/buildArtifacts (驼峰)  │
│  POST /api/v1/users/{id}/ban              │  POST /api/v1/users/{id}/banUser    │
│  /api/v2/pipelines                        │  /api/2/pipelines (缺 v 前缀)        │
│  /api/beta/ai/chat                        │  /api/v4/ai/chat (版本跳跃)         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 版本 URL 设计图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Orion API URL Structure                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                        https://api.orion.io
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │    /api               │  统一 API 前缀
                        └───────────┬───────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │    /{version}         │  版本标识
                        │    v1 | v2 | v3 | beta │
                        └───────────┬───────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │  /users       │       │  /artifacts   │       │  /pipelines   │
    │               │       │               │       │               │
    │  GET 列表      │       │  GET 列表      │       │  GET 列表      │
    │  POST 创建      │       │  POST 创建      │       │  POST 创建      │
    └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │  /{id}        │       │  /{name}      │       │  /{id}        │
    │               │       │               │       │               │
    │  GET 详情     │       │  GET 详情      │       │  GET 详情      │
    │  PUT 更新      │       │  PUT 更新      │       │  PUT 更新      │
    │  DELETE 删除   │       │  DELETE 删除   │       │  DELETE 删除   │
    └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │  /roles       │       │  /download    │       │  /execute     │
    │  /permissions │       │  /promote     │       │  /logs        │
    │               │       │  /sbom        │       │  /cancel      │
    └───────────────┘       └───────────────┘       └───────────────┘

版本演进示例:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  V1 → V2 变更示例 (用户资源):                                                     │
│                                                                                  │
│  V1 (2025-01):                 V2 (2026-01):                                    │
│  /api/v1/users                 /api/v2/users                                    │
│  ├── GET /api/v1/users         ├── GET /api/v2/users (支持分页参数)              │
│  ├── GET /api/v1/users/{id}    ├── GET /api/v2/users/{id} (返回新增字段)        │
│  ├── POST /api/v1/users        ├── POST /api/v2/users (请求体格式变更)          │
│  ├── PUT /api/v1/users/{id}    ├── PUT /api/v2/users/{id} (支持部分更新)         │
│  └── DELETE /api/v1/users/{id} └── DELETE /api/v2/users/{id} (软删除)           │
│                                                                                  │
│  变更类型:                                                                       │
│  ├── NON-BREAKING: 新增字段、新增接口、新增可选参数                              │
│  └── BREAKING: 删除字段、修改类型、修改行为、删除接口                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、版本路由规则 (Version Routing Rules)

### 3.1 路由匹配策略

API 网关支持三种路由匹配策略，按优先级顺序匹配：精确匹配 > 前缀匹配 > 正则匹配。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      API Version Routing Decision Flow                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  Incoming       │
                                    │  Request        │
                                    │  (URL + Headers)│
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 1: Version Resolution (版本解析)                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Priority 1: Extract from URL Path                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Pattern: ^/api/(v[0-9]+|beta|alpha)/(.*)$                          │  │  │
│  │  │  Example: /api/v2/users → version=v2, path=/users                   │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                            │  │
│  │  Priority 2: Extract from X-API-Version Header (if URL has no version)    │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Header: X-API-Version: 2                                           │  │  │
│  │  │  Example: /api/users + X-API-Version: 2 → version=v2                │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                            │  │
│  │  Priority 3: Default Version (if no version specified)                    │  │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Config: default_version: v1                                        │  │  │
│  │  │  Example: /api/users → version=v1 (default)                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 2: Route Matching (路由匹配)                                               │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Matching Priority (优先级从高到低):                                        │  │
│  │                                                                            │  │
│  │  ① Exact Match (精确匹配)                                                  │  │
│  │     ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │     │  Rule: /api/v1/users/{id}/ban → ban-user-service                  │ │  │
│  │     │  Match: /api/v1/users/123/ban → ✅ 精确匹配                         │ │  │
│  │     │  Priority: Highest (最优先)                                        │ │  │
│  │     └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                            │  │
│  │  ② Prefix Match (前缀匹配)                                                 │  │
│  │     ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │     │  Rule: /api/v1/users/* → user-service                             │ │  │
│  │     │  Match: /api/v1/users/123 → ✅ 前缀匹配                             │ │  │
│  │     │  Match: /api/v1/users/123/roles → ✅ 前缀匹配                       │ │  │
│  │     │  Priority: Medium (次优先)                                         │ │  │
│  │     └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                            │  │
│  │  ③ Regex Match (正则匹配)                                                  │  │
│  │     ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │     │  Rule: ^/api/v[0-9]+/artifacts/.*/download$ → artifact-download   │ │  │
│  │     │  Match: /api/v1/artifacts/build-001/download → ✅ 正则匹配          │ │  │
│  │     │  Priority: Lowest (最低优先级，兜底匹配)                            │ │  │
│  │     └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                            │  │
│  │  Match Result:                                                              │  │
│  │  ├── Match Found → Forward to Backend Service                              │  │
│  │  └── No Match → Return 404 Not Found                                       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 3: Backend Forwarding (后端转发)                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Strip Version Prefix (可选):                                              │  │
│  │  ├── strip_version: true → /api/v1/users → user-service: /users           │  │
│  │  └── strip_version: false → /api/v1/users → user-service: /api/v1/users   │  │
│  │                                                                            │  │
│  │  Add Version Header:                                                       │  │
│  │  ├── X-Forwarded-API-Version: v1                                          │  │
│  │  └── X-Original-Path: /api/v1/users                                       │  │
│  │                                                                            │  │
│  │  Load Balancing (负载均衡):                                                 │  │
│  │  ├── Strategy: Round Robin / Least Connections / Weighted                 │  │
│  │  └── Health Check: Remove unhealthy instances from pool                   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  Backend        │
                                    │  Service        │
                                    └─────────────────┘
```

### 3.2 精确匹配 (Exact Match)

**定义**: 请求路径与路由规则完全一致（路径参数除外）。

**优先级**: 最高（优先级 1）

**适用场景**:
- 特殊操作接口（如 `/ban`, `/promote`, `/export`）
- 需要精确控制的接口
- 不归属于常规 CRUD 的接口

**配置示例**:
```yaml
# routing-rules.yaml
exact_matches:
  - path: /api/v1/users/{id}/ban
    backend: user-moderation-service
    methods: [POST]
    timeout: 5s
    
  - path: /api/v1/artifacts/{name}/promote
    backend: artifact-lifecycle-service
    methods: [POST]
    timeout: 10s
    
  - path: /api/v1/pipelines/{id}/cancel
    backend: pipeline-executor-service
    methods: [POST]
    timeout: 3s
```

### 3.3 前缀匹配 (Prefix Match)

**定义**: 请求路径以路由规则前缀开头。

**优先级**: 中等（优先级 2）

**适用场景**:
- 常规 RESTful 资源接口
- 同一服务管理的资源集合
- 标准 CRUD 接口

**配置示例**:
```yaml
# routing-rules.yaml
prefix_matches:
  - prefix: /api/v1/users
    backend: user-service
    strip_prefix: /api/v1
    timeout: 10s
    
  - prefix: /api/v1/artifacts
    backend: artifact-service
    strip_prefix: /api/v1
    timeout: 15s
    
  - prefix: /api/v1/pipelines
    backend: pipeline-service
    strip_prefix: /api/v1
    timeout: 30s
    
  - prefix: /api/v1/tenants
    backend: tenant-service
    strip_prefix: /api/v1
    timeout: 10s
```

### 3.4 正则匹配 (Regex Match)

**定义**: 请求路径匹配正则表达式模式。

**优先级**: 最低（优先级 3，兜底匹配）

**适用场景**:
- 复杂路径模式匹配
- 动态资源路径
- 特殊格式要求的路径

**配置示例**:
```yaml
# routing-rules.yaml
regex_matches:
  - pattern: "^/api/v[0-9]+/artifacts/[^/]+/download$"
    backend: artifact-download-service
    capture_groups:
      version: 1
      artifact_name: 2
    timeout: 60s  # 下载接口超时较长
    
  - pattern: "^/api/v[0-9]+/export/(users|artifacts|pipelines)/[0-9]+$"
    backend: export-service
    capture_groups:
      version: 1
      resource_type: 2
      resource_id: 3
    timeout: 120s  # 导出接口超时更长
```

### 3.5 路由配置总览

```yaml
# api-version-routing.yaml
api_versioning:
  enabled: true
  
  # 版本解析配置
  version_resolution:
    # 解析顺序
    order:
      - url_path
      - custom_header
      - default
    
    # URL 路径解析
    url_path:
      enabled: true
      pattern: "^/api/(v[0-9]+|beta|alpha)/(.*)$"
      version_group: 1
      path_group: 2
    
    # Header 解析
    custom_header:
      enabled: true
      header_name: X-API-Version
      allowed_values: ["1", "2", "3", "v1", "v2", "v3", "beta", "alpha"]
      normalize: true  # 自动添加 v 前缀
    
    # 默认版本
    default:
      version: v1
      fallback_enabled: true  # 版本不存在时回退到默认版本
  
  # 路由规则
  routing_rules:
    # 精确匹配（优先级 1）
    exact_matches: []
    
    # 前缀匹配（优先级 2）
    prefix_matches: []
    
    # 正则匹配（优先级 3）
    regex_matches: []
  
  # 版本状态管理
  version_status:
    v1:
      status: stable
      backends:
        - service: user-service
          weight: 100
        - service: user-service-v2
          weight: 0
      sunset_date: null
    
    v2:
      status: stable
      backends:
        - service: user-service-v2
          weight: 100
      sunset_date: null
    
    v3:
      status: beta
      backends:
        - service: user-service-v3
          weight: 100
      sunset_date: null
    
    beta:
      status: beta
      backends:
        - service: ai-service-beta
          weight: 100
      sunset_date: null
  
  # 灰度发布配置
  canary:
    enabled: true
    rules:
      - version: v3
        canary_percentage: 10  # 10% 流量到 v3
        conditions:
          - header: X-Canary-Group
            value: beta-testers
```

---

## 四、版本兼容性规则 (Version Compatibility Rules)

### 4.1 变更类型定义

API 变更分为两大类：BREAKING CHANGE（破坏性变更）和 NON-BREAKING CHANGE（非破坏性变更）。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         API Change Classification                                │
└─────────────────────────────────────────────────────────────────────────────────┘

变更分类决策树:
                                    ┌─────────────────┐
                                    │  API 变更        │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
            ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
            │  接口级别     │         │  请求级别     │         │  响应级别     │
            └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
                   │                        │                        │
         ┌─────────┴─────────┐      ┌───────┴───────┐          ┌──────┴──────┐
         │                   │      │               │          │             │
         ▼                   ▼      ▼               ▼          ▼             ▼
    ┌──────────┐        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ 新增接口  │        │ 删除接口  │  │ 新增参数  │  │ 删除参数  │  │ 新增字段  │
    │ NON-     │        │ BREAKING │  │ NON-     │  │ BREAKING │  │ NON-     │
    │ BREAKING │        │          │  │ BREAKING │  │ (可选)   │  │ BREAKING │
    └──────────┘        └──────────┘  └──────────┘  │ BREAKING │  └──────────┘
                                                    │ (必需)   │  ┌──────────┐
                                                    └──────────┘  │ 删除字段  │
                                                                  │ BREAKING │
                                                                  └──────────┘
```

### 4.2 BREAKING CHANGE 判定规则

**定义**: 导致现有调用方代码需要修改才能正常工作的变更。

**影响**: 需要发布新版本（major version bump），旧版本需保持并行。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BREAKING CHANGE Checklist                                │
└─────────────────────────────────────────────────────────────────────────────────┘

接口级别 (Endpoint Level):
├── ❌ 删除现有接口
│   Example: 删除 DELETE /api/v1/users/{id}
│   Impact: 调用方删除功能失效
│
├── ❌ 修改接口路径
│   Example: /api/v1/users → /api/v1/members
│   Impact: 调用方 URL 需要修改
│
├── ❌ 修改 HTTP 方法
│   Example: DELETE /api/v1/users/{id} → POST /api/v1/users/{id}/delete
│   Impact: 调用方请求方法需要修改
│
└── ❌ 修改认证/授权要求
    Example: 公开接口改为需要认证
    Impact: 调用方需要添加认证逻辑

请求级别 (Request Level):
├── ❌ 删除必需参数
│   Example: 删除 POST /api/v1/users 的 name 参数
│   Impact: 调用方请求体需要修改
│
├── ❌ 新增必需参数
│   Example: POST /api/v1/users 新增必需参数 email
│   Impact: 调用方需要添加该参数
│
├── ❌ 修改参数类型
│   Example: age: integer → age: string
│   Impact: 调用方数据类型需要转换
│
├── ❌ 修改参数格式
│   Example: date: "YYYY-MM-DD" → date: "YYYY-MM-DDTHH:mm:ssZ"
│   Impact: 调用方格式需要调整
│
├── ❌ 修改参数约束
│   Example: name.max_length: 50 → 20
│   Impact: 调用方原有值可能失效
│
└── ❌ 删除支持的 Content-Type
    Example: 不再支持 application/x-www-form-urlencoded
    Impact: 调用方需要修改请求头

响应级别 (Response Level):
├── ❌ 删除响应字段
│   Example: 删除 user 对象中的 created_at 字段
│   Impact: 调用方字段读取失败
│
├── ❌ 修改字段类型
│   Example: id: string → id: integer
│   Impact: 调用方类型解析失败
│
├── ❌ 修改字段名称
│   Example: created_at → createdAt
│   Impact: 调用方字段映射失败
│
├── ❌ 修改状态码语义
│   Example: 200 → 201 或 400 → 422
│   Impact: 调用方状态判断失败
│
└── ❌ 修改错误响应格式
    Example: {error: "message"} → {errors: [{code, message}]}
    Impact: 调用方错误处理失败

行为级别 (Behavior Level):
├── ❌ 修改排序规则
│   Example: 列表接口默认排序从 created_at 改为 name
│   Impact: 调用方依赖默认排序
│
├── ❌ 修改分页行为
│   Example: 页码从 0 开始改为 1 开始
│   Impact: 调用方分页计算错误
│
├── ❌ 修改默认值
│   Example: status 参数默认值从 active 改为 all
│   Impact: 调用方隐式依赖默认值
│
└── ❌ 修改副作用
    Example: GET 接口开始记录审计日志（影响性能预期）
    Impact: 调用方性能预期变化
```

### 4.3 NON-BREAKING CHANGE 判定规则

**定义**: 现有调用方无需修改代码即可正常工作的变更。

**影响**: 可在现有版本内发布，无需新版本。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NON-BREAKING CHANGE Checklist                            │
└─────────────────────────────────────────────────────────────────────────────────┘

✅ 允许的非破坏性变更:

接口级别:
├── ✅ 新增接口
│   Example: 新增 GET /api/v1/users/{id}/permissions
│   Condition: 不影响现有接口
│
├── ✅ 新增可选操作
│   Example: POST /api/v1/users/{id}/deactivate (软删除)
│   Condition: 原有 DELETE 仍可用
│
└── ✅ 扩展支持的 HTTP 方法
    Example: GET /api/v1/stats 新增 POST 支持批量查询
    Condition: 原有 GET 不受影响

请求级别:
├── ✅ 新增可选参数
│   Example: GET /api/v1/users 新增可选参数 include_inactive
│   Condition: 有合理默认值，不影响现有行为
│
├── ✅ 放宽参数约束
│   Example: name.max_length: 20 → 50
│   Condition: 原有有效请求仍有效
│
├── ✅ 新增参数值
│   Example: status 参数新增 pending 值
│   Condition: 原有值仍有效
│
├── ✅ 新增支持的 Content-Type
│   Example: 新增支持 application/json
│   Condition: 原有类型仍支持
│
└── ✅ 新增 Header 参数
    Example: 新增可选 Header X-Request-Source
    Condition: 不影响现有逻辑

响应级别:
├── ✅ 新增响应字段
│   Example: user 对象新增字段 last_login_at
│   Condition: 调用方不依赖严格 Schema 验证
│
├── ✅ 新增枚举值
│   Example: status 字段新增值 pending
│   Condition: 调用方有 default 分支处理
│
├── ✅ 放宽响应类型
│   Example: age: integer → age: integer | null
│   Condition: 原有值类型不变
│
└── ✅ 提供字段别名
    Example: created_at 同时返回 created_at 和 createdAt
    Condition: 原有字段保留

行为级别:
├── ✅ 性能优化
│   Example: 查询接口添加缓存
│   Condition: 行为语义不变
│
├── ✅ 错误消息改进
│   Example: 错误消息更详细/友好
│   Condition: 错误码不变
│
└── ✅ 修复 Bug
    Example: 修复排序不一致问题
    Condition: 修复到文档描述的行为
```

### 4.4 兼容性判定决策矩阵

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      API Change Compatibility Matrix                             │
└─────────────────────────────────────────────────────────────────────────────────┘

变更场景                          │ 是否破坏性 │ 版本策略      │ 迁移要求
─────────────────────────────────┼────────────┼───────────────┼──────────────
新增 GET/POST 接口                │ ❌ NON     │ 当前版本内     │ 无
删除接口                          │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
修改接口路径                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
新增可选查询参数                  │ ❌ NON     │ 当前版本内     │ 无
新增必需请求参数                  │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
删除可选参数                      │ ❌ NON     │ 当前版本内     │ 无
删除必需参数                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
修改参数类型                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
修改参数默认值                    │ ⚠️ 视情况  │ 评估后定       │ 可能需迁移
新增响应字段                      │ ❌ NON     │ 当前版本内     │ 无
删除响应字段                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
修改字段类型                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
重命名字段 (无别名)               │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
重命名字段 (保留别名)             │ ❌ NON     │ 当前版本内     │ 无
新增状态码                        │ ❌ NON     │ 当前版本内     │ 无
修改状态码                        │ ✅ BREAK   │ 新 major 版本  │ 必须迁移
修改列表排序规则                  │ ⚠️ 视情况  │ 评估后定       │ 可能需迁移
修改分页默认行为                  │ ⚠️ 视情况  │ 评估后定       │ 可能需迁移
性能优化 (行为不变)               │ ❌ NON     │ 当前版本内     │ 无
修复 Bug 到文档行为                │ ❌ NON     │ 当前版本内     │ 无
修改认证要求                      │ ✅ BREAK   │ 新 major 版本  │ 必须迁移

判定流程:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Step 1: 识别变更类型                                                            │
│           │                                                                      │
│           ├── 接口增删？ → 删除=BREAKING                                         │
│           ├── 参数增删？ → 必需参数删除/BREAKING, 可选参数删除=NON-BREAKING      │
│           ├── 类型修改？ → 任何类型修改=BREAKING                                 │
│           └── 行为修改？ → 评估影响范围                                          │
│           │                                                                      │
│  Step 2: 评估影响范围                                                            │
│           │                                                                      │
│           ├── 影响现有调用？ → BREAKING                                          │
│           ├── 仅新增能力？ → NON-BREAKING                                        │
│           └── 不确定？ → 按 BREAKING 处理                                         │
│           │                                                                      │
│  Step 3: 确定版本策略                                                            │
│           │                                                                      │
│           ├── BREAKING → 新 major 版本 (v1 → v2)                                  │
│           └── NON-BREAKING → 当前版本内发布                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 兼容性检查清单

```yaml
# compatibility-check.yaml
# 用于 API 变更评审的 CheckList

api_change_review:
  # 变更基本信息
  change_info:
    api_path: /api/v1/resource
    http_method: POST
    change_description: "描述变更内容"
    change_author: "作者"
    change_date: "日期"
  
  # 兼容性自检清单
  compatibility_checklist:
    # 接口级别检查
    endpoint_checks:
      - question: "是否删除了现有接口？"
        if_yes: BREAKING
        notes: "需要新版本"
      
      - question: "是否修改了接口路径？"
        if_yes: BREAKING
        notes: "需要新版本"
      
      - question: "是否修改了 HTTP 方法？"
        if_yes: BREAKING
        notes: "需要新版本"
      
      - question: "是否仅新增接口？"
        if_yes: NON_BREAKING
        notes: "可当前版本发布"
    
    # 请求级别检查
    request_checks:
      - question: "是否删除了请求参数？"
        if_yes: BREAKING
        notes: "必需参数删除是破坏性的"
      
      - question: "是否新增了必需参数？"
        if_yes: BREAKING
        notes: "调用方需要添加参数"
      
      - question: "是否修改了参数类型？"
        if_yes: BREAKING
        notes: "类型不兼容"
      
      - question: "是否仅新增可选参数？"
        if_yes: NON_BREAKING
        notes: "可当前版本发布"
      
      - question: "是否放宽了参数约束？"
        if_yes: NON_BREAKING
        notes: "原有请求仍有效"
    
    # 响应级别检查
    response_checks:
      - question: "是否删除了响应字段？"
        if_yes: BREAKING
        notes: "调用方可能依赖该字段"
      
      - question: "是否修改了字段类型？"
        if_yes: BREAKING
        notes: "类型不兼容"
      
      - question: "是否重命名了字段（无别名）？"
        if_yes: BREAKING
        notes: "调用方字段映射失败"
      
      - question: "是否仅新增响应字段？"
        if_yes: NON_BREAKING
        notes: "可当前版本发布"
    
    # 行为级别检查
    behavior_checks:
      - question: "是否修改了默认排序/分页？"
        if_yes: REVIEW_NEEDED
        notes: "需评估影响"
      
      - question: "是否修改了状态码语义？"
        if_yes: BREAKING
        notes: "调用方状态判断失败"
      
      - question: "是否仅为性能优化？"
        if_yes: NON_BREAKING
        notes: "行为语义不变"
  
  # 评审结论
  review_conclusion:
    breaking_changes_found: false
    non_breaking_changes: true
    version_strategy: "current_version"  # current_version | new_major_version
    migration_guide_required: false
    deprecation_notice_required: false
```

---

## 五、版本演进流程 (Version Evolution Process)

### 5.1 版本生命周期状态机

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      API Version Lifecycle State Machine                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                  DRAFT (草案)                        │
                         │                  内部设计阶段                         │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 设计评审通过
                                               │ 开始开发
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                   ALPHA (内部测试)                   │
                         │                   不稳定，仅限内部                    │
                         │                   允许 Breaking Changes              │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 功能完成
                                               │ 准备公开测试
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                    BETA (公开测试)                   │
                         │                   有限 Breaking Changes              │
                         │                   SLA: 95%                           │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 测试稳定
                                               │ 无重大缺陷
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                   STABLE (稳定版)                    │
                         │                   生产就绪                           │
                         │                   仅 Non-Breaking Changes            │
                         │                   SLA: 99.9%                         │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 新版本发布
                                               │ 旧版本进入废弃期
                                               │ (最少 6 个月过渡)
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                  SUNSET (已废弃)                     │
                         │                   仍可用，强烈建议迁移                │
                         │                   仅安全修复                          │
                         │                   SLA: 99%                           │
                         │                   响应含弃用警告                      │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 过渡期结束
                                               │ 无活跃调用
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                  RETIRED (已下线)                    │
                         │                   返回 410 Gone                      │
                         │                   响应含迁移指南                      │
                         │                                                     │
                         └─────────────────────┬───────────────────────────────┘
                                               │
                                               │ 确认零流量
                                               │ (30 天观察)
                                               ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                                                     │
                         │                  REMOVED (已删除)                    │
                         │                   代码已删除                          │
                         │                   资源已释放                          │
                         │                                                     │
                         └─────────────────────────────────────────────────────┘

状态迁移规则:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  From State   │  To State       │  Trigger                          │  冷却期   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  DRAFT        │  ALPHA          │  设计评审通过，开始开发              │  无      │
│  ALPHA        │  BETA           │  功能完成，内部测试通过              │  ≥1 周   │
│  ALPHA        │  DRAFT          │  重大设计变更                       │  无      │
│  BETA         │  STABLE         │  测试稳定，无 P0/P1缺陷              │  ≥2 周   │
│  BETA         │  ALPHA          │  发现重大缺陷需要重构                │  无      │
│  STABLE       │  SUNSET         │  新版本发布，旧版本标记废弃           │  ≥6 月   │
│  SUNSET       │  RETIRED        │  过渡期结束，确认迁移完成             │  无      │
│  SUNSET       │  SUNSET         │  延长过渡期 (需审批)                  │  +3 月   │
│  RETIRED      │  REMOVED        │  零流量观察 30 天                       │  30 天   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 各阶段详细说明

#### 5.2.1 DRAFT（草案阶段）

**目标**: 完成 API 设计，通过架构评审

**准入条件**:
- 业务需求明确
- 技术方案初步确定

**退出条件**:
- API 设计文档完成
- 架构评审通过
- 开发计划确定

**活动清单**:
```yaml
draft_phase:
  activities:
    - name: "需求分析"
      owner: "产品经理"
      output: "需求文档"
      duration: "3-5 天"
    
    - name: "API 设计"
      owner: "开发工程师"
      output: "OpenAPI Spec (YAML)"
      duration: "5-10 天"
    
    - name: "架构评审"
      owner: "架构委员会"
      output: "评审意见书"
      duration: "1-2 天"
    
    - name: "开发计划"
      owner: "技术负责人"
      output: "迭代计划"
      duration: "1 天"
  
  deliverables:
    - "API 设计文档"
    - "OpenAPI 3.0 规范"
    - "接口 Mock 数据"
    - "评审会议纪要"
  
  exit_criteria:
    - "所有设计文档完成"
    - "架构评审通过 (无 P0/P1问题)"
    - "开发资源已确认"
```

#### 5.2.2 ALPHA（内部测试阶段）

**目标**: 完成开发，通过内部测试

**准入条件**:
- 设计评审通过
- 开发环境就绪

**退出条件**:
- 所有功能开发完成
- 单元测试通过
- 内部集成测试通过

**活动清单**:
```yaml
alpha_phase:
  activities:
    - name: "功能开发"
      owner: "开发工程师"
      output: "可运行代码"
      duration: "2-4 周"
    
    - name: "单元测试"
      owner: "开发工程师"
      output: "测试报告 (覆盖率≥80%)"
      duration: "并行进行"
    
    - name: "集成测试"
      owner: "测试工程师"
      output: "集成测试报告"
      duration: "1-2 周"
    
    - name: "文档编写"
      owner: "技术文档工程师"
      output: "API 参考文档"
      duration: "并行进行"
  
  deliverables:
    - "可部署的服务"
    - "测试报告"
    - "API 参考文档 (初稿)"
    - "已知问题清单"
  
  exit_criteria:
    - "所有 P0/P1功能完成"
    - "单元测试覆盖率≥80%"
    - "集成测试通过率 100%"
    - "无 P0/P1缺陷"
```

#### 5.2.3 BETA（公开测试阶段）

**目标**: 公开测试，收集反馈，修复问题

**准入条件**:
- Alpha 阶段完成
- 内部测试通过

**退出条件**:
- 稳定运行 2 周以上
- 无 P0/P1缺陷
- 调用方反馈积极

**活动清单**:
```yaml
beta_phase:
  activities:
    - name: "Beta 发布"
      owner: "发布工程师"
      output: "Beta 版本上线"
      duration: "1 天"
    
    - name: "邀请测试"
      owner: "产品经理"
      output: "测试反馈"
      duration: "2-4 周"
    
    - name: "问题修复"
      owner: "开发工程师"
      output: "修复版本"
      duration: "持续进行"
    
    - name: "文档完善"
      owner: "技术文档工程师"
      output: "完整文档"
      duration: "持续进行"
  
  deliverables:
    - "Beta 版本服务"
    - "用户反馈报告"
    - "问题修复记录"
    - "完整 API 文档"
  
  exit_criteria:
    - "稳定运行≥2 周"
    - "无 P0/P1缺陷"
    - "用户反馈积极"
    - "文档完整准确"
  
  allowed_changes:
    - "Non-Breaking Changes"
    - "Minor Breaking Changes (需通知)"
    - "Bug Fixes"
    - "Performance Improvements"
```

#### 5.2.4 STABLE（稳定版阶段）

**目标**: 生产服务，稳定运行

**准入条件**:
- Beta 阶段完成
- 稳定性验证通过

**退出条件**:
- 新版本发布
- 进入废弃流程

**活动清单**:
```yaml
stable_phase:
  activities:
    - name: "正式发布"
      owner: "发布工程师"
      output: "生产环境上线"
      duration: "1 天"
    
    - name: "监控运维"
      owner: "SRE 团队"
      output: "监控报告"
      duration: "持续进行"
    
    - name: "小版本迭代"
      owner: "开发工程师"
      output: "迭代版本"
      duration: "按需进行"
    
    - name: "文档维护"
      owner: "技术文档工程师"
      output: "文档更新"
      duration: "持续进行"
  
  deliverables:
    - "生产环境服务"
    - "监控 Dashboard"
    - "运维手册"
    - "更新日志"
  
  sla:
    availability: "99.9%"
    latency_p99: "<200ms"
    error_rate: "<0.1%"
  
  allowed_changes:
    - "Non-Breaking Changes Only"
    - "Security Patches"
    - "Bug Fixes"
    - "Performance Improvements"
```

#### 5.2.5 SUNSET（废弃阶段）

**目标**: 通知迁移，平稳过渡

**准入条件**:
- 新版本已发布
- 废弃通知已发出

**退出条件**:
- 过渡期结束（最少 6 个月）
- 调用方基本迁移完成

**活动清单**:
```yaml
sunset_phase:
  activities:
    - name: "废弃公告"
      owner: "产品经理"
      output: "废弃通知邮件/公告"
      duration: "T-90 天开始"
    
    - name: "迁移支持"
      owner: "技术支持"
      output: "迁移指南/答疑"
      duration: "持续进行"
    
    - name: "流量监控"
      owner: "SRE 团队"
      output: "流量报告"
      duration: "每周报告"
    
    - name: "下线准备"
      owner: "发布工程师"
      output: "下线计划"
      duration: "T-7 天开始"
  
  deliverables:
    - "废弃公告"
    - "迁移指南"
    - "流量监控报告"
    - "下线执行计划"
  
  notifications:
    - time: "T-90 days"
      channel: "Email + Dashboard"
      audience: "所有调用方"
      content: "废弃预告 + 迁移指南链接"
    
    - time: "T-60 days"
      channel: "Email + Dashboard"
      audience: "所有调用方"
      content: "废弃提醒 + 迁移协助 offer"
    
    - time: "T-30 days"
      channel: "Email + Phone"
      audience: "活跃调用方"
      content: "紧急提醒 + 一对一协助"
    
    - time: "T-7 days"
      channel: "Email + Phone + SMS"
      audience: "仍未迁移调用方"
      content: "最后警告 + 下线时间确认"
  
  response_headers:
    - "Deprecation: true"
    - "Sunset: {retire_date}"
    - "Link: <{new_version_url}>; rel=successor-version"
```

#### 5.2.6 RETIRED（已下线阶段）

**目标**: 停止服务，返回迁移指引

**准入条件**:
- SUNSET 阶段结束
- 过渡期已满

**退出条件**:
- 零流量观察 30 天
- 确认无调用方依赖

**响应行为**:
```yaml
retired_phase:
  http_response:
    status_code: 410  # Gone
    headers:
      Content-Type: "application/json"
      X-API-Retired: "true"
      X-API-Retired-Since: "{retire_date}"
      Link: "<{new_version_url}>; rel=successor-version"
    
    body:
      error: "api_retired"
      message: "该 API 版本已下线，请迁移到新版本"
      retired_version: "v1"
      successor_version: "v2"
      migration_guide: "https://docs.orion.io/api/migration/v1-to-v2"
      support_contact: "api-support@orion.io"
  
  activities:
    - name: "零流量观察"
      owner: "SRE 团队"
      output: "流量报告"
      duration: "30 天"
    
    - name: "文档归档"
      owner: "技术文档工程师"
      output: "归档文档"
      duration: "观察期后"
  
  exit_criteria:
    - "连续 30 天零调用"
    - "无调用方申诉"
    - "文档已归档"
```

#### 5.2.7 REMOVED（已删除阶段）

**目标**: 清理代码，释放资源

**准入条件**:
- RETIRED 阶段完成
- 零流量确认

**活动清单**:
```yaml
removed_phase:
  activities:
    - name: "代码删除"
      owner: "开发工程师"
      output: "代码清理完成"
      duration: "1-2 天"
    
    - name: "资源释放"
      owner: "SRE 团队"
      output: "资源回收"
      duration: "1 天"
    
    - name: "监控清理"
      owner: "SRE 团队"
      output: "监控配置更新"
      duration: "1 天"
    
    - name: "文档下线"
      owner: "技术文档工程师"
      output: "文档移除/归档"
      duration: "1 天"
  
  deliverables:
    - "代码清理记录"
    - "资源释放确认"
    - "监控配置更新"
    - "项目关闭报告"
```

---

## 六、废弃时间表 (Deprecation Schedule)

### 6.1 废弃时间表总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      API Deprecation Timeline Overview                           │
└─────────────────────────────────────────────────────────────────────────────────┘

版本废弃标准时间线 (以 v1 废弃为例):

2025-01-15          2025-07-15          2026-01-15          2026-04-15          2026-05-15
    │                   │                   │                   │                   │
    ▼                   ▼                   ▼                   ▼                   ▼
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│  v1     │         │  v1     │         │  v1     │         │  v1     │         │  v1     │
│ stable  │         │ sunset  │         │ retired │         │ removed │         │         │
│         │────────▶│         │────────▶│         │────────▶│         │────────▶│ (完成)  │
│         │         │         │         │         │         │         │         │         │
└─────────┘         └─────────┘         └─────────┘         └─────────┘         └─────────┘
    │                   │                   │                   │
    │                   │                   │                   │
    │              发布 v2              正式下线              代码删除
    │              开始废弃              返回 410              资源释放
    │              过渡期开始
    │
    ▼
  稳定运行期
  (12 个月)

废弃过渡期详细通知节奏:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  T-90 天 (废弃前 90 天)                                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  通知类型：预告通知                                                         │  │
│  │  通知渠道：邮件 + 开发者 Dashboard Banner                                    │  │
│  │  通知对象：所有注册调用方                                                    │  │
│  │  通知内容：                                                                 │  │
│  │  ├── v1 版本将于 {日期} 废弃                                                   │  │
│  │  ├── 推荐迁移到 v2 版本                                                       │  │
│  │  ├── 迁移指南链接：{url}                                                    │  │
│  │  └── 技术支持联系方式                                                       │  │
│  │  响应头变更：添加 Deprecation: {sunset_date}                                │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  T-60 天 (废弃前 60 天)                                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  通知类型：提醒通知                                                         │  │
│  │  通知渠道：邮件 + Dashboard 弹窗 + API 响应提示                                │  │
│  │  通知对象：所有注册调用方                                                    │  │
│  │  通知内容：                                                                 │  │
│  │  ├── v1 版本将于 {日期} 正式下线                                               │  │
│  │  ├── 您的应用仍在使用 v1 版本                                                 │  │
│  │  ├── 提供免费迁移协助服务                                                   │  │
│  │  └── 预约迁移支持：{url}                                                    │  │
│  │  响应头变更：添加 Sunset: {retire_date}                                     │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  T-30 天 (废弃前 30 天)                                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  通知类型：紧急通知                                                         │  │
│  │  通知渠道：邮件 + 电话 + SMS                                                 │  │
│  │  通知对象：近 7 天有调用的用户                                                 │  │
│  │  通知内容：                                                                 │  │
│  │  ├── ⚠️ 紧急：v1 版本将于 30 天后下线                                          │  │
│  │  ├── 检测到您的应用仍在调用 v1 API                                           │  │
│  │  ├── 请立即安排迁移                                                        │  │
│  │  └── 专属技术支持：{contact}                                                │  │
│  │  限流措施：旧版本限流阈值降至 50%                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  T-7 天 (废弃前 7 天)                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  通知类型：最后警告                                                         │  │
│  │  通知渠道：邮件 + 电话 + SMS + 工单                                           │  │
│  │  通知对象：仍未迁移的调用方                                                   │  │
│  │  通知内容：                                                                 │  │
│  │  ├── ⚠️⚠️ 最后警告：v1 版本将于 7 天后下线                                     │  │
│  │  ├── 您的应用尚未完成迁移                                                   │  │
│  │  ├── 下线后调用将返回 410 Gone                                               │  │
│  │  └── 紧急支持热线：{phone}                                                  │  │
│  │  限流措施：旧版本限流阈值降至 20%                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  T-0 (废弃日)                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  通知类型：下线通知                                                         │  │
│  │  通知渠道：邮件 + 状态页更新                                                  │  │
│  │  通知对象：所有调用方                                                        │  │
│  │  API 行为：                                                                 │  │
│  │  ├── 返回 HTTP 410 Gone                                                      │  │
│  │  ├── 响应体包含迁移指南                                                      │  │
│  │  └── 响应头包含新版本链接                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  T+30 天 (废弃后 30 天)                                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  确认零流量，开始代码清理                                                    │  │
│  │  关闭监控告警，归档文档                                                      │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 废弃时间表时间线图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    API Deprecation Timeline Diagram                               │
└─────────────────────────────────────────────────────────────────────────────────┘

时间轴 (月为单位):
────────────────────────────────────────────────────────────────────────────────────→
        1 月    2 月    3 月    4 月    5 月    6 月    7 月    8 月    9 月

        │                       │                       │                       │
        ▼                       ▼                       ▼                       ▼
    ┌─────────┐             ┌─────────┐             ┌─────────┐             ┌─────────┐
    │  v1     │             │  v1     │             │  v1     │             │  v1     │
    │ stable  │────────────▶│ sunset  │────────────▶│ retired │────────────▶│ removed │
    │         │   12 个月    │         │   6 个月    │         │   30 天     │         │
    └─────────┘             └─────────┘             └─────────┘             └─────────┘
        │                       │                       │                       │
        │                  ┌────┴────┐                  │                       │
        │                  │  通知   │                  │                       │
        │                  │  节奏   │                  │                       │
        │                  └────┬────┘                  │                       │
        │                       │                       │                       │
        ▼                       ▼                       ▼                       ▼
    稳定运行              T-90: 邮件预告              410 Gone              代码删除
    正常迭代              T-60: 邮件提醒              迁移指南              资源释放
                          T-30: 紧急通知
                          T-7:  最后警告

详细通知时间线 (以 2026-04-15 废弃为例):
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  2026-01-15          2026-02-15          2026-03-15          2026-04-08          │
│  (T-90)              (T-60)              (T-30)              (T-7)               │
│       │                   │                   │                   │              │
│       ▼                   ▼                   ▼                   ▼              │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐        │
│  │ 预告    │         │ 提醒    │         │ 紧急    │         │ 最后    │        │
│  │ 通知    │         │ 通知    │         │ 通知    │         │ 警告    │        │
│  │         │         │         │         │         │         │         │        │
│  │ ● 邮件  │         │ ● 邮件  │         │ ● 邮件  │         │ ● 邮件  │        │
│  │ ● Banner│         │ ● 弹窗  │         │ ● 电话  │         │ ● 电话  │        │
│  │         │         │ ● Offer │         │ ● SMS   │         │ ● SMS   │        │
│  └─────────┘         └─────────┘         │ ● 限流 50%│         │ ● 限流 20%│        │
│                                          └─────────┘         └─────────┘        │
│                                                                                   │
│                                    2026-04-15          2026-05-15                │
│                                    (T-0)               (T+30)                    │
│                                         │                   │                    │
│                                         ▼                   ▼                    │
│                                    ┌─────────┐         ┌─────────┐              │
│                                    │ 下线    │         │ 清理    │              │
│                                    │         │         │         │              │
│                                    │ ● 410   │         │ ● 删代码│              │
│                                    │ ● 指南  │         │ ● 释资源│              │
│                                    │ ● 公告  │         │ ● 归档  │              │
│                                    └─────────┘         └─────────┘              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

通知覆盖率目标:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  通知轮次   │  目标覆盖率  │  实际覆盖率 (示例)  │  未覆盖处理                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  T-90      │  100%       │  98%              │  Dashboard 补发通知              │
│  T-60      │  100%       │  95%              │  邮件 + 电话追呼                  │
│  T-30      │  100% (活跃) │  99%              │  技术支持介入                   │
│  T-7       │  100% (活跃) │  100%             │  -                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 废弃通知模板

```yaml
# deprecation-notice-templates.yaml

deprecation_notices:
  # T-90 天预告通知
  t_minus_90:
    template_name: "API Deprecation Notice - 90 Days Advance Warning"
    
    email:
      subject: "[Orion API] v{version} 版本废弃预告 - 请于 {sunset_date} 前迁移"
      
      body: |
        尊敬的 Orion API 用户：
        
        感谢您使用 Orion 平台 API 服务。
        
        我们特此通知，以下 API 版本计划于 {sunset_date} 正式废弃：
        
        - 废弃版本：v{version}
        - 废弃日期：{sunset_date}
        - 推荐版本：v{successor_version}
        
        【为什么废弃】
        为了确保 API 的持续改进和安全更新，我们会定期发布新版本并逐步淘汰旧版本。
        
        【您需要做什么】
        我们建议您开始规划迁移到 v{successor_version} 版本。迁移指南和文档已准备就绪：
        
        - 迁移指南：{migration_guide_url}
        - API 文档：{api_docs_url}
        - 变更对比：{diff_url}
        
        【技术支持】
        如您在迁移过程中遇到任何问题，我们的技术支持团队随时为您提供帮助：
        - 技术支持邮箱：api-support@orion.io
        - 技术支持热线：{phone}
        - 在线工单：{ticket_url}
        
        【重要时间点】
        - {t_minus_60_date}: 第二轮提醒通知
        - {t_minus_30_date}: 紧急通知，旧版本限流
        - {t_minus_7_date}:  最后警告
        - {sunset_date}:    正式下线，返回 410 Gone
        
        感谢您的理解与配合！
        
        Orion 平台团队
        {current_date}
    
    response_headers:
      Deprecation: "{sunset_date}"
      Link: "<{successor_version_url}>; rel=successor-version"
  
  # T-60 天提醒通知
  t_minus_60:
    template_name: "API Deprecation Reminder - 60 Days Remaining"
    
    email:
      subject: "[Orion API] 重要提醒 - v{version} 版本将于 60 天后废弃"
      
      body: |
        尊敬的 Orion API 用户：
        
        这是一封重要提醒通知。
        
        以下 API 版本将于 60 天后 ({sunset_date}) 正式废弃：
        
        - 废弃版本：v{version}
        - 您的调用状态：{usage_status} (近 30 天调用次数：{call_count})
        
        【检测到您的应用仍在使用旧版本】
        根据我们的监控，以下应用/项目仍在使用 v{version} 版本：
        
        - 应用名称：{app_name}
        - 项目 ID: {project_id}
        - 最后调用时间：{last_call_date}
        
        【免费迁移协助】
        我们现在提供免费的一对一迁移协助服务，帮助您顺利完成迁移：
        
        - 预约迁移支持：{assistance_url}
        - 迁移评估工具：{assessment_tool_url}
        
        【迁移资源】
        - 迁移指南：{migration_guide_url}
        - 代码示例：{code_samples_url}
        - 常见问题：{faq_url}
        
        请尽快安排迁移，如有疑问随时联系我们。
        
        Orion 平台团队
        {current_date}
    
    response_headers:
      Deprecation: "{sunset_date}"
      Sunset: "{retire_date}"
      Link: "<{successor_version_url}>; rel=successor-version"
  
  # T-30 天紧急通知
  t_minus_30:
    template_name: "URGENT: API Deprecation - 30 Days Remaining"
    
    email:
      subject: "[紧急] Orion API v{version} 将于 30 天后下线 - 请立即迁移"
      
      body: |
        ⚠️ 紧急通知 ⚠️
        
        尊敬的 Orion API 用户：
        
        以下 API 版本将于 30 天后 ({sunset_date}) 正式下线：
        
        - 废弃版本：v{version}
        - 您的调用状态：⚠️ 活跃调用中
        
        【重要】
        我们检测到您的应用/项目仍在调用 v{version} 版本 API。
        自 {sunset_date} 起，这些调用将返回 HTTP 410 Gone 错误。
        
        【可能影响】
        如未及时迁移，您的应用可能出现：
        - API 调用失败
        - 功能异常
        - 服务中断
        
        【立即行动】
        1. 查看迁移指南：{migration_guide_url}
        2. 评估迁移工作量：{assessment_tool_url}
        3. 预约技术支持：{assistance_url}
        
        【专属支持】
        我们已为您分配专属技术支持工程师：
        - 支持工程师：{engineer_name}
        - 联系方式：{contact_info}
        
        请务必重视此事，立即安排迁移！
        
        Orion 平台团队
        {current_date}
    
    sms:
      content: "[Orion] 紧急：API v{version} 将于 30 天后下线，您的应用仍在调用。请立即迁移：{short_url} 回 T 退订"
    
    response_headers:
      Deprecation: "{sunset_date}"
      Sunset: "{retire_date}"
      X-RateLimit-Limit: "{reduced_limit}"  # 限流阈值降低
  
  # T-7 天最后警告
  t_minus_7:
    template_name: "FINAL WARNING: API Deprecation - 7 Days Remaining"
    
    email:
      subject: "[最后警告] Orion API v{version} 将于 7 天后永久下线"
      
      body: |
        ⚠️⚠️ 最后警告 ⚠️⚠️
        
        尊敬的 Orion API 用户：
        
        这是关于 API v{version} 废弃的最后通知。
        
        【下线倒计时：7 天】
        - 下线日期：{sunset_date}
        - 下线时间：{sunset_time} (UTC+8)
        - 您的状态：尚未迁移
        
        【下线后行为】
        自 {sunset_date} 起：
        - 所有 v{version} 调用返回 HTTP 410 Gone
        - 响应体包含迁移指南
        - 不再提供技术支持
        
        【紧急支持】
        如需紧急迁移协助，请立即联系：
        - 紧急支持热线：{emergency_phone}
        - 在线支持：{chat_url}
        - 工单优先级：P0
        
        请珍惜最后的机会，立即行动！
        
        Orion 平台团队
        {current_date}
    
    sms:
      content: "[Orion] 最后警告：API v{version} 7 天后下线，调用将失败。紧急支持：{phone}"
    
    response_headers:
      Deprecation: "{sunset_date}"
      Sunset: "{retire_date}"
      X-RateLimit-Limit: "{emergency_limit}"  # 限流阈值降至 20%
  
  # T-0 下线通知
  t_minus_0:
    template_name: "API Deprecated - Now Retired"
    
    email:
      subject: "[Orion API] v{version} 版本已正式下线"
      
      body: |
        尊敬的 Orion API 用户：
        
        Orion API v{version} 已于 {sunset_date} 正式下线。
        
        【当前状态】
        - v{version}: 已下线 (HTTP 410 Gone)
        - 推荐版本：v{successor_version}
        
        【如仍需使用】
        请立即迁移到 v{successor_version} 版本：
        - 迁移指南：{migration_guide_url}
        - 快速入门：{quickstart_url}
        
        感谢您的理解与支持！
        
        Orion 平台团队
        {current_date}
    
    retired_api_response:
      status_code: 410
      headers:
        Content-Type: "application/json"
        X-API-Retired: "true"
        Link: "<{successor_version_url}>; rel=successor-version"
      
      body: |
        {
          "error": "api_retired",
          "message": "API v{version} has been retired on {sunset_date}",
          "successor_version": "v{successor_version}",
          "migration_guide": "{migration_guide_url}",
          "support_contact": "api-support@orion.io"
        }
```

---

## 七、迁移指南生成 (Migration Guide Generation)

### 7.1 迁移指南生成流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Migration Guide Generation Flow                               │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  新版本发布      │
                                    │  (v2 ready)     │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 1: API Diff Analysis (API 差异分析)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Input:                                                                    │  │
│  │  ├── Old Spec: /api/v1/openapi.yaml                                       │  │
│  │  └── New Spec: /api/v2/openapi.yaml                                       │  │
│  │                                                                            │  │
│  │  Process:                                                                  │  │
│  │  ├── 解析 OpenAPI 规范                                                       │  │
│  │  ├── 端点对比 (新增/删除/修改)                                              │  │
│  │  ├── 参数对比 (新增/删除/类型变更)                                          │  │
│  │  ├── 响应对比 (字段变更/类型变更)                                           │  │
│  │  └── 行为变更检测 (文档分析)                                                │  │
│  │                                                                            │  │
│  │  Output: API Diff Report (JSON)                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 2: Change Classification (变更分类)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Classify Changes:                                                         │  │
│  │  ├── Breaking Changes (需要代码修改)                                        │  │
│  │  │   ├── 删除的接口                                                         │  │
│  │  │   ├── 修改的参数                                                         │  │
│  │  │   └── 变更的行为                                                         │  │
│  │  │                                                                         │  │
│  │  ├── Non-Breaking Changes (可选升级)                                        │  │
│  │  │   ├── 新增的接口                                                         │  │
│  │  │   ├── 新增的字段                                                         │  │
│  │  │   └── 性能优化                                                           │  │
│  │  │                                                                         │  │
│  │  └── Deprecations (废弃标记)                                                │  │
│  │      └── 标记为废弃的接口/字段                                              │  │
│  │                                                                            │  │
│  │  Output: Classified Changes (YAML)                                         │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 3: Migration Pattern Detection (迁移模式检测)                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Detect Migration Patterns:                                                │  │
│  │  ├── Endpoint Mapping (端点映射)                                            │  │
│  │  │   Example: GET /api/v1/users → GET /api/v2/members                     │  │
│  │  │                                                                         │  │
│  │  ├── Field Mapping (字段映射)                                               │  │
│  │  │   Example: user.created_at → member.createdAt                          │  │
│  │  │                                                                         │  │
│  │  ├── Type Conversion (类型转换)                                             │  │
│  │  │   Example: age: int → age: string                                      │  │
│  │  │                                                                         │  │
│  │  └── Behavior Change (行为变更)                                             │  │
│  │      Example: 分页参数从 page → page_number                               │  │
│  │                                                                            │  │
│  │  Output: Migration Patterns (JSON)                                         │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 4: Code Example Generation (代码示例生成)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Generate Code Examples:                                                   │  │
│  │  ├── v1 Example (旧代码)                                                   │  │
│  │  └── v2 Example (新代码)                                                   │  │
│  │                                                                            │  │
│  │  Supported Languages:                                                      │  │
│  │  ├── cURL (命令行示例)                                                      │  │
│  │  ├── Python (Python SDK)                                                   │  │
│  │  ├── JavaScript/Node.js (JavaScript SDK)                                   │  │
│  │  ├── Java (Java SDK)                                                       │  │
│  │  └── Go (Go SDK)                                                           │  │
│  │                                                                            │  │
│  │  Output: Code Snippets (Markdown)                                          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 5: Migration Guide Assembly (迁移指南组装)                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Assemble Migration Guide:                                                 │  │
│  │  ├── Executive Summary (执行摘要)                                           │  │
│  │  ├── Breaking Changes (破坏性变更清单)                                      │  │
│  │  ├── Non-Breaking Changes (非破坏性变更清单)                                │  │
│  │  ├── Migration Steps (迁移步骤)                                             │  │
│  │  ├── Code Examples (代码示例)                                               │  │
│  │  ├── FAQ (常见问题)                                                         │  │
│  │  └── Support Contact (技术支持)                                             │  │
│  │                                                                            │  │
│  │  Output: Migration Guide (Markdown/HTML)                                   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  发布迁移指南    │
                                    │  通知调用方      │
                                    └─────────────────┘
```

### 7.2 自动化检测工具

```yaml
# api-diff-tool-config.yaml
api_diff_tool:
  name: "orion-api-diff"
  version: "1.0.0"
  
  # 输入配置
  input:
    old_spec:
      source: "git"
      repository: "orion-design/api-specs"
      path: "v1/openapi.yaml"
      ref: "v1.0.0"
    
    new_spec:
      source: "git"
      repository: "orion-design/api-specs"
      path: "v2/openapi.yaml"
      ref: "v2.0.0"
  
  # 检测规则
  detection_rules:
    # 端点变更检测
    endpoint_changes:
      - rule: "endpoint_deleted"
        severity: "BREAKING"
        description: "端点被删除"
      
      - rule: "endpoint_path_changed"
        severity: "BREAKING"
        description: "端点路径变更"
      
      - rule: "endpoint_method_changed"
        severity: "BREAKING"
        description: "HTTP 方法变更"
      
      - rule: "endpoint_added"
        severity: "NON_BREAKING"
        description: "新增端点"
    
    # 参数变更检测
    parameter_changes:
      - rule: "required_param_deleted"
        severity: "BREAKING"
        description: "必需参数被删除"
      
      - rule: "required_param_added"
        severity: "BREAKING"
        description: "新增必需参数"
      
      - rule: "optional_param_deleted"
        severity: "NON_BREAKING"
        description: "可选参数被删除"
      
      - rule: "optional_param_added"
        severity: "NON_BREAKING"
        description: "新增可选参数"
      
      - rule: "param_type_changed"
        severity: "BREAKING"
        description: "参数类型变更"
      
      - rule: "param_default_changed"
        severity: "REVIEW_NEEDED"
        description: "参数默认值变更"
    
    # 响应变更检测
    response_changes:
      - rule: "response_field_deleted"
        severity: "BREAKING"
        description: "响应字段被删除"
      
      - rule: "response_field_added"
        severity: "NON_BREAKING"
        description: "新增响应字段"
      
      - rule: "response_type_changed"
        severity: "BREAKING"
        description: "响应类型变更"
      
      - rule: "status_code_changed"
        severity: "BREAKING"
        description: "状态码语义变更"
  
  # 输出配置
  output:
    diff_report:
      format: "json"
      path: "reports/api-diff-report.json"
    
    migration_guide:
      format: "markdown"
      path: "docs/migration/v1-to-v2.md"
    
    code_examples:
      languages: ["curl", "python", "javascript", "java", "go"]
      path: "docs/migration/examples/"
```

### 7.3 迁移指南模板

```markdown
# Orion API v1 到 v2 迁移指南

**文档版本**: 1.0  
**发布日期**: 2026-01-15  
**废弃版本**: v1  
**目标版本**: v2  

---

## 执行摘要

本文档指导您从 Orion API v1 迁移到 v2 版本。

### 迁移概览

| 项目 | 详情 |
|------|------|
| 迁移难度 | 中等 |
| 预计工作量 | 2-5 人天 |
| 破坏性变更 | 12 项 |
| 新增功能 | 25 项 |
| 废弃截止日期 | 2026-07-15 |

### 快速开始

```bash
# 1. 使用迁移评估工具
curl -X POST https://api.orion.io/migration/assess \
  -H "Authorization: Bearer {token}" \
  -d '{"current_version": "v1"}'

# 2. 查看您的 API 使用情况
# 3. 按优先级修改代码
# 4. 测试验证
# 5. 切换流量
```

---

## 破坏性变更清单

### 1. 用户资源路径变更

**变更类型**: BREAKING  
**影响范围**: 所有用户相关接口  

#### v1 (旧)
```http
GET /api/v1/users
GET /api/v1/users/{id}
POST /api/v1/users
```

#### v2 (新)
```http
GET /api/v2/members
GET /api/v2/members/{id}
POST /api/v2/members
```

#### 迁移步骤
```python
# v1 代码
response = requests.get("https://api.orion.io/api/v1/users", headers=headers)

# v2 代码
response = requests.get("https://api.orion.io/api/v2/members", headers=headers)
```

---

### 2. 分页参数变更

**变更类型**: BREAKING  
**影响范围**: 所有列表接口  

#### v1 (旧)
```http
GET /api/v1/users?page=1&per_page=20
```

#### v2 (新)
```http
GET /api/v2/members?page_number=1&page_size=20
```

#### 迁移步骤
```python
# v1 代码
params = {"page": 1, "per_page": 20}

# v2 代码
params = {"page_number": 1, "page_size": 20}
```

---

## 非破坏性变更清单

### 1. 新增字段

v2 响应中新增以下字段（可选使用）：

- `member.last_login_at`: 最后登录时间
- `member.avatar_url`: 头像 URL

### 2. 新增接口

v2 新增以下接口：

- `GET /api/v2/members/{id}/permissions`: 获取成员权限
- `POST /api/v2/members/bulk`: 批量创建成员

---

## 迁移检查清单

- [ ] 更新所有 API 基础 URL (v1 → v2)
- [ ] 更新用户资源路径 (users → members)
- [ ] 更新分页参数 (page → page_number)
- [ ] 更新认证方式 (如有变更)
- [ ] 处理删除的响应字段
- [ ] 添加新增的必需参数
- [ ] 更新错误处理逻辑
- [ ] 完成集成测试
- [ ] 灰度发布验证

---

## 技术支持

- 迁移问题：api-support@orion.io
- 技术文档：https://docs.orion.io
- 状态页面：https://status.orion.io
```

---

## 八、多版本并行支持 (Multi-Version Parallel Support)

### 8.1 版本隔离架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Multi-Version Parallel Architecture                         │
└─────────────────────────────────────────────────────────────────────────────────┘

版本隔离层次:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Layer 1: 路由隔离 (Routing Isolation)                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  API Gateway                                                               │  │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │  │
│  │  │  v1 Router  │     │  v2 Router  │     │  v3 Router  │                  │  │
│  │  │  Rules      │     │  Rules      │  │  Rules      │                  │  │
│  │  └─────────────┘     └─────────────┘     └─────────────┘                  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Layer 2: 服务隔离 (Service Isolation)                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Backend Services                                                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │  │
│  │  │  user-service   │  │  user-service   │  │  user-service   │            │  │
│  │  │  (v1)           │  │  (v2)           │  │  (v3)           │            │  │
│  │  │  :8081          │  │  :8082          │  │  :8083          │            │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Layer 3: 数据隔离 (Data Isolation)                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Databases                                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  orion_users (共享数据库，向后兼容 Schema)                             │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │  │
│  │  │  │  v1 View    │  │  v2 View    │  │  v3 View    │                  │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Layer 4: 资源隔离 (Resource Isolation)                                          │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Kubernetes Resources                                                      │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │  │
│  │  │  Deployment/v1  │  │  Deployment/v2  │  │  Deployment/v3  │            │  │
│  │  │  CPU: 2C, Mem: 4G│  │  CPU: 4C, Mem: 8G│  │  CPU: 2C, Mem: 4G│           │  │
│  │  │  Replicas: 2    │  │  Replicas: 3    │  │  Replicas: 1    │            │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 流量切换机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Traffic Switching Mechanism                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

流量切换策略:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  阶段 1: 新版本发布 (v3 Beta)                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │  v1: ████████████████████████████████████████████████████ 90% (Stable)     │  │
│  │  v2: ████████████ 10% (Stable)                                             │  │
│  │  v3: ████ (Beta, 仅受邀用户)                                                  │  │
│  │                                                                            │  │
│  │  路由规则：                                                                 │  │
│  │  ├── 默认路由：v1                                                           │  │
│  │  └── Header: X-API-Version: 3 → v3                                         │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  阶段 2: v3 稳定后 (v3 Stable)                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │  v1: ████████████████████████████████████████ 70% (Stable)                 │  │
│  │  v2: ████████████ 20% (Stable)                                             │  │
│  │  v3: ████████████ 10% (Stable, 逐步放量)                                     │  │
│  │                                                                            │  │
│  │  路由规则：                                                                 │  │
│  │  ├── 默认路由：v1                                                           │  │
│  │  ├── 新用户：v3 (5%)                                                        │  │
│  │  └── Header: X-Prefer-New-Version: true → v3                               │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  阶段 3: v1 废弃开始 (v1 Sunset)                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │  v1: ████████████ 20% (Sunset, 限流)                                        │  │
│  │  v2: ████████████████████████████ 50% (Stable)                             │  │
│  │  v3: ████████████████████ 30% (Stable)                                     │  │
│  │                                                                            │  │
│  │  路由规则：                                                                 │  │
│  │  ├── 默认路由：v2                                                           │  │
│  │  ├── v1 调用：返回弃用警告                                                   │  │
│  │  └── 新注册：仅支持 v2/v3                                                   │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  阶段 4: v1 下线后 (v1 Retired)                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │  v1: (已下线，返回 410)                                                      │  │
│  │  v2: ████████████████████████████████ 60% (Stable)                         │  │
│  │  v3: █████████████████████████████████████ 40% (Stable)                    │  │
│  │                                                                            │  │
│  │  路由规则：                                                                 │  │
│  │  ├── 默认路由：v2                                                           │  │
│  │  └── v1 请求：返回 410 + 迁移指南                                             │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

流量切换配置:
```yaml
# traffic-switching-config.yaml
traffic_switching:
  versions:
    v1:
      status: sunset  # stable | sunset | retired
      weight: 20
      conditions:
        - header: X-Legacy-Version
          value: "true"
      rate_limit:
        enabled: true
        limit: 50%  # 限流阈值
    
    v2:
      status: stable
      weight: 50
      conditions: []
      default: true
    
    v3:
      status: stable
      weight: 30
      conditions:
        - header: X-Prefer-New-Version
          value: "true"
        - user_group: beta-testers
  
  canary:
    enabled: true
    percentage: 5
    conditions:
      - region: us-west-2
      - user_segment: internal
```

### 8.3 回滚机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Rollback Mechanism                                          │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚触发条件:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Condition                        │  Threshold      │  Action                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  错误率飙升                        │  >5%            │  自动回滚到上一版本       │
│  P99 延迟过高                       │  >500ms         │  告警 + 手动评估          │
│  核心功能故障                      │  任何 P0 故障    │  立即回滚                │
│  数据异常                          │  数据不一致     │  立即回滚 + 数据修复       │
│  安全漏洞                          │  安全告警       │  立即回滚 + 安全修复       │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚流程:
                                    ┌─────────────────┐
                                    │  故障检测        │
                                    │  (监控告警)      │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 故障确认                                                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  ├── 自动检测：监控指标异常                                                 │  │
│  │  ├── 人工确认：On-call 工程师验证                                            │  │
│  │  └── 决策：是否需要回滚                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 流量切换 (立即执行)                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  ├── 更新路由规则：新版本权重 → 0                                          │  │
│  │  ├── 更新路由规则：旧版本权重 → 100%                                       │  │
│  │  └── 生效时间：<1 分钟                                                       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 服务下线 (可选)                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  ├── 停止新版本服务实例                                                    │  │
│  │  ├── 保留现场：保存日志和快照                                              │  │
│  │  └── 通知团队：故障通告                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 根因分析                                                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  ├── 收集故障信息：日志、指标、链路追踪                                     │  │
│  │  ├── 分析根因：代码问题/配置问题/依赖问题                                   │  │
│  │  └── 制定修复方案                                                          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Step 5: 修复验证                                                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  ├── 修复代码/配置                                                         │  │
│  │  ├── 测试环境验证                                                          │  │
│  │  └── 重新灰度发布                                                          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚配置:
```yaml
# rollback-config.yaml
rollback:
  enabled: true
  
  # 自动回滚配置
  automatic:
    enabled: true
    conditions:
      - metric: error_rate
        threshold: 0.05  # 5%
        window: 5m
      
      - metric: p99_latency
        threshold: 500ms
        window: 5m
      
      - metric: availability
        threshold: 0.99  # 99%
        window: 1m
    
    # 回滚目标
    target:
      strategy: previous_stable  # previous_stable | specific_version | canary
      specific_version: null
    
    # 通知配置
    notification:
      channels:
        - slack: "#api-gateway-alerts"
        - pagerduty: "api-gateway-oncall"
        - email: "platform-team@orion.io"
  
  # 手动回滚配置
  manual:
    enabled: true
    approvers:
      - role: oncall-engineer
      - role: platform-lead
    
    # 回滚命令
    commands:
      - "kubectl rollout undo deployment/api-gateway"
      - "consul kv set gateway/traffic/v1_weight 100"
      - "consul kv set gateway/traffic/v2_weight 0"
```

---

## 九、客户端 SDK 版本管理 (Client SDK Version Management)

### 9.1 SDK 与 API 版本映射

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SDK and API Version Mapping                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

SDK 版本命名规范:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Format: {major}.{minor}.{patch}                                                 │
│                                                                                  │
│  ├── major: 对应 API 主版本 (Breaking Changes)                                    │
│  ├── minor: 新增功能 (Non-Breaking Changes)                                      │
│  └── patch: Bug 修复                                                              │
│                                                                                  │
│  Examples:                                                                       │
│  ├── @orion/sdk: 1.0.0  → 支持 API v1                                            │
│  ├── @orion/sdk: 2.0.0  → 支持 API v2 (Breaking)                                 │
│  ├── @orion/sdk: 2.1.0  → 支持 API v2 + 新功能                                   │
│  └── @orion/sdk: 2.1.1  → 支持 API v2 + Bug 修复                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

SDK 与 API 版本兼容性矩阵:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SDK Version  │  API Version  │  Compatibility  │  Status                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1.x.x        │  v1           │  Full           │  Deprecated (2026-07-15)      │
│  2.x.x        │  v2           │  Full           │  Stable                       │
│  2.x.x        │  v1           │  Partial        │  部分接口兼容                  │
│  3.x.x        │  v3           │  Full           │  Beta                         │
│  3.x.x        │  v2           │  Full           │  向后兼容                      │
│  3.x.x        │  v1           │  Limited        │  仅核心接口                    │
└─────────────────────────────────────────────────────────────────────────────────┘

SDK 自动升级建议:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Current SDK  │  Latest SDK  │  Recommendation  │  Urgency                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1.0.0        │  2.5.0       │  Upgrade to 2.x  │  High (v1 deprecated)         │
│  2.0.0        │  2.5.0       │  Upgrade to 2.5  │  Medium (new features)        │
│  2.5.0        │  3.0.0-beta  │  Consider 3.0    │  Low (beta, optional)         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 SDK 发布流程

```yaml
# sdk-release-process.yaml
sdk_release:
  # 发布触发条件
  triggers:
    - event: "api_version_released"
      action: "release_major_sdk"
    
    - event: "api_minor_feature_added"
      action: "release_minor_sdk"
    
    - event: "api_bug_fixed"
      action: "release_patch_sdk"
  
  # 发布流程
  process:
    - step: "代码生成"
      tool: "openapi-generator"
      template: "typescript-axios"
      duration: "5 分钟"
    
    - step: "单元测试"
      coverage_threshold: 80%
      duration: "10 分钟"
    
    - step: "集成测试"
      against: "api-staging"
      duration: "15 分钟"
    
    - step: "文档生成"
      tool: "typedoc"
      duration: "2 分钟"
    
    - step: "发布 npm"
      registry: "npmjs.org"
      duration: "1 分钟"
    
    - step: "发布通知"
      channels:
        - changelog
        - email
        - slack
      duration: "1 分钟"
  
  # 版本兼容性保证
  compatibility:
    sdk_v2:
      supports_api:
        - v2 (full)
        - v1 (partial)
      minimum_api_version: "v1.5"
    
    sdk_v3:
      supports_api:
        - v3 (full)
        - v2 (full)
        - v1 (limited)
      minimum_api_version: "v2.0"
```

---

## 十、监控指标 (Monitoring Metrics)

### 10.1 版本维度监控指标

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      API Version Monitoring Metrics                               │
└─────────────────────────────────────────────────────────────────────────────────┘

核心指标 (Prometheus 格式):
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  # 各版本 QPS (Queries Per Second)                                               │
│  api_version_requests_total{version="v1",endpoint="/users"} 15420                │
│  api_version_requests_total{version="v2",endpoint="/members"} 8230               │
│  api_version_requests_total{version="v3",endpoint="/members"} 1250               │
│                                                                                  │
│  # 各版本错误率 (Error Rate)                                                     │
│  api_version_errors_total{version="v1",error_type="4xx"} 45                      │
│  api_version_errors_total{version="v1",error_type="5xx"} 3                       │
│  api_version_errors_total{version="v2",error_type="4xx"} 12                      │
│  api_version_errors_total{version="v2",error_type="5xx"} 1                       │
│                                                                                  │
│  # 弃用 API 调用次数 (Deprecated API Calls)                                        │
│  api_deprecated_calls_total{version="v1",endpoint="/users/{id}/ban"} 156         │
│  api_deprecated_calls_total{version="v1",endpoint="/users"} 2340                 │
│                                                                                  │
│  # 各版本 P99 延迟 (Latency)                                                      │
│  api_version_latency_seconds{version="v1",quantile="0.99"} 0.234                 │
│  api_version_latency_seconds{version="v2",quantile="0.99"} 0.189                 │
│  api_version_latency_seconds{version="v3",quantile="0.99"} 0.156                 │
│                                                                                  │
│  # 版本分布 (Version Distribution)                                                │
│  api_version_distribution{version="v1"} 0.65  # 65%                              │
│  api_version_distribution{version="v2"} 0.30  # 30%                              │
│  api_version_distribution{version="v3"} 0.05  # 5%                               │
│                                                                                  │
│  # 迁移进度 (Migration Progress)                                                  │
│  api_migration_progress{from_version="v1",to_version="v2"} 0.78  # 78% 已迁移     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

Grafana Dashboard 设计:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard: API Version Health                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Panel 1: Request Volume by Version (Time Series)                                │
│  ├── Query: sum(rate(api_version_requests_total[5m])) by (version)              │
│  ├── Purpose: 观察各版本流量分布                                                  │
│  └── Alert: v1 流量占比 >50% (废弃过渡期)                                          │
│                                                                                  │
│  Panel 2: Error Rate by Version (Time Series)                                    │
│  ├── Query: sum(rate(api_version_errors_total[5m])) by (version,error_type)     │
│  ├── Purpose: 监控各版本错误情况                                                  │
│  └── Alert: 任一版本错误率 >1%                                                   │
│                                                                                  │
│  Panel 3: P99 Latency by Version (Time Series)                                   │
│  ├── Query: histogram_quantile(0.99, rate(api_version_latency_bucket[5m]))      │
│  ├── Purpose: 监控各版本性能表现                                                  │
│  └── Alert: P99 延迟 >500ms                                                       │
│                                                                                  │
│  Panel 4: Deprecated API Calls (Stat + Time Series)                              │
│  ├── Query: sum(rate(api_deprecated_calls_total[1h]))                           │
│  ├── Purpose: 监控弃用 API 调用                                                    │
│  └── Alert: 弃用 API 调用 >100/小时                                                 │
│                                                                                  │
│  Panel 5: Migration Progress (Gauge)                                             │
│  ├── Query: avg(api_migration_progress)                                          │
│  ├── Purpose: 跟踪迁移进度                                                        │
│  └── Target: >90% before sunset_date                                            │
│                                                                                  │
│  Panel 6: Active Consumers by Version (Table)                                    │
│  ├── Query: api_version_active_consumers{version="$version"}                    │
│  ├── Purpose: 识别仍在使用旧版本的调用方                                           │
│  └── Action: 针对性联系迁移                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 告警规则

```yaml
# alerting-rules.yaml
alerting:
  groups:
    - name: api_version_alerts
      rules:
        # 弃用版本流量告警
        - alert: DeprecatedVersionHighTraffic
          expr: |
            sum(rate(api_version_requests_total{version="v1"}[5m])) 
            / 
            sum(rate(api_version_requests_total[5m])) 
            > 0.3
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "弃用版本 v1 流量占比超过 30%"
            description: "v1 版本计划于 {{ $value | humanizePercentage }} 仍在使用，请加速迁移"
        
        # 弃用 API 调用告警
        - alert: DeprecatedAPICalls
          expr: |
            sum(rate(api_deprecated_calls_total[1h])) > 100
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "弃用 API 调用量过高"
            description: "过去 1 小时内弃用 API 调用 {{ $value }} 次"
        
        # 版本错误率告警
        - alert: VersionErrorRateHigh
          expr: |
            sum(rate(api_version_errors_total[5m])) 
            by (version) 
            / 
            sum(rate(api_version_requests_total[5m])) 
            by (version)
            > 0.01
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "{{ $labels.version }} 版本错误率超过 1%"
            description: "当前错误率 {{ $value | humanizePercentage }}"
        
        # 迁移进度滞后告警
        - alert: MigrationProgressLagging
          expr: |
            avg(api_migration_progress) < 0.5
            and
            (now() - api_deprecation_announced_time) > 90 * 24 * 3600
          labels:
            severity: warning
          annotations:
            summary: "API 迁移进度滞后"
            description: "废弃公告已发布 90 天，迁移进度仅 {{ $value | humanizePercentage }}"
```

---

## 附录 (Appendix)

### A. 术语表

| 术语 | 定义 |
|------|------|
| **Breaking Change** | 导致现有调用方需要修改代码才能正常工作的变更 |
| **Non-Breaking Change** | 现有调用方无需修改代码即可正常工作的变更 |
| **Deprecation** | 标记某 API 版本为废弃，进入过渡期 |
| **Sunset** | 废弃状态，API 仍可用但强烈建议迁移 |
| **Retirement** | 已下线状态，API 返回 410 Gone |
| **SDK** | Software Development Kit，客户端开发工具包 |
| **SLA** | Service Level Agreement，服务等级协议 |

### B. 参考文档

| 文档 | 链接 |
|------|------|
| API Gateway Enhancement Design | `docs/architecture/api-gateway-enhancement-design.md` |
| Platform Service Split Implementation | `docs/architecture/platform-service-split-implementation.md` |
| OpenAPI Specification | https://spec.openapis.org/ |
| Semantic Versioning | https://semver.org/ |

### C. 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |

### D. 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 优先级：P1 | 状态：待评审 | 维护团队：Orion Platform Team_