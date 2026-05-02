> ⚠️ **目标设计，未实现**。当前为单体架构，详见 [`当前系统架构.md`](./当前系统架构.md)。

# Orion Platform Service Split Implementation Design

**文档版本**: v1.0
**创建日期**: 2026-04-10
**状态**: 待评审
**作者**: Orion Architecture Team  
**评审人**: 架构委员会  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述将 `orion-platform-service`（平台服务）拆分为 4 个独立服务的完整实施方案。当前平台服务包含 8 个异质模块，职责过于集中，导致部署耦合、团队协调成本高、迭代速度慢等"上帝服务"问题。

### 拆分方案总览

| 新服务 | 核心职责 | 所属模块 | 团队归属 |
|--------|---------|---------|---------|
| `orion-resource-service` | 资源管理 | 产物管理 + 二方库管理 + 工具管理 | 平台工具团队 |
| `orion-tenant-service` | 租户与协作 | 多租户管理 + 团队管理 + 通知协作 | 平台基础团队 |
| `orion-governance-service` | 安全合规 | 安全策略 + 合规检查 + 审计日志 | 安全与合规团队 |
| `orion-platform-service` (缩减) | 认证授权 | 用户认证 + RBAC + 全局标签 + 集成配置 | 平台基础团队 |

### 预期收益量化

| 指标 | 拆分前 | 拆分后目标 | 改善幅度 |
|------|--------|-----------|---------|
| 部署时间 | 25 分钟（全服务） | 5 分钟（单服务） | 80% |
| 发布频率 | 月级 | 周级 | 4x |
| 代码库规模 | 50,000 行 | 12,000 行（平均/服务） | 76% |
| 测试回归时间 | 45 分钟 | 10 分钟 | 78% |
| 故障 MTTR | 45 分钟 | 15 分钟 | 67% |

---

## 一、拆分背景与理由 (Background and Rationale)

### 1.1 当前平台服务问题分析

`orion-platform-service` 是 Orion 架构中的基础服务，承载平台级共享数据和核心能力。随着平台功能扩展，该服务逐渐成为一个"大而全"的单体模块，包含多个职责各异的子模块。

#### 1.1.1 当前模块组成与数据规模

| 模块编号 | 模块名称 | 核心职责 | 数据表数量 | API 数量 | 代码行数 | 变更频率 |
|---------|---------|---------|-----------|---------|---------|---------|
| M01 | 用户与认证 | 用户管理、角色权限、RBAC | 5 张 | 25+ | 8,000 | 中频 |
| M02 | 多租户管理 | 租户隔离、资源配置、配额管理 | 3 张 | 15+ | 5,000 | 低频 |
| M03 | 团队管理 | 团队组织、成员管理、团队权限 | 2 张 | 12+ | 4,000 | 中频 |
| M04 | 标签系统 | 全局标签、资源打标、标签继承 | 2 张 | 8+ | 3,000 | 低频 |
| M05 | 通知协作 | 通知渠道、消息模板、发送记录 | 2 张 | 10+ | 6,000 | 中频 |
| M06 | 产物管理 | 构建产物、版本管理、制品库集成 | 2 张 | 18+ | 7,000 | 高频 |
| M07 | 二方库管理 | 内部依赖库、版本发布、兼容性 | 2 张 | 12+ | 5,000 | 中频 |
| M08 | 工具管理 | 工具注册、生命周期、配置模板 | 3 张 | 20+ | 8,000 | 高频 |
| M09 | 审计日志 | 操作审计、安全事件、合规记录 | 1 张 | 8+ | 4,000 | 低频 |
| M10 | 安全合规 | 安全策略、合规检查、风险扫描 | 2 张 | 15+ | 6,000 | 低频 |

**总计**: 24 张表，143+ API，56,000+ 代码行

#### 1.1.2 问题数据支撑

**问题 1: 职责过于集中 (Too Many Responsibilities)**

当前平台服务承载了 4 类截然不同的职责：

| 职责类别 | 包含模块 | 代码行数 | 业务领域 | 技术栈特点 |
|---------|---------|---------|---------|-----------|
| **资源管理域** | 产物管理、二方库管理、工具管理 | 20,000 | 软件资产全生命周期 | 高频读写、大对象存储 |
| **租户协作域** | 多租户管理、团队管理、通知协作 | 15,000 | 组织与协作能力 | 读多写少、缓存友好 |
| **安全合规域** | 安全合规、审计日志 | 10,000 | 风险控制与合规 | 写多读少、合规审计 |
| **认证授权域** | 用户与认证、标签系统、集成配置 | 11,000 | 身份与访问管理 | 强一致性、安全敏感 |

这 4 类职责的业务逻辑、数据模型、变更频率完全不同，强行耦合在同一服务中导致：
- 代码库臃肿（超过 56,000 行）
- 测试回归时间长（全量测试 45 分钟）
- 新人理解成本高（需要理解 4 个领域）
- 技术选型受限（无法针对不同域选择最优技术栈）

**问题 2: 部署耦合 (Deployment Coupling)**

现状：任一模块变更需要全服务部署

| 变更场景 | 影响模块 | 影响范围 | 部署时间 | 回归测试范围 |
|---------|---------|---------|---------|-------------|
| 产物管理新增字段 | M06 | 全服务重启 | 25 分钟 | 全量回归 (143 API) |
| 通知渠道新增 | M05 | 全服务重启 | 25 分钟 | 全量回归 (143 API) |
| 安全策略更新 | M10 | 全服务重启 | 25 分钟 | 全量回归 (143 API) |
| 工具配置修复 | M08 | 全服务重启 | 25 分钟 | 全量回归 (143 API) |

**问题**: 小变更引发大部署，发布风险与变更规模不匹配。平均每次部署等待时间 3.5 天（协调窗口）。

**问题 3: 团队协调成本高 (High Coordination Cost)**

当前 4 个团队（资源团队、协作团队、安全团队、基础团队）共用同一代码库：

| 协调场景 | 当前流程 | 平均耗时 | 月度发生次数 |
|---------|---------|---------|-------------|
| 独立需求发布 | 需等其他团队需求合并后一起发布 | 等待 3 天 | 8 次 |
| 代码评审 | 需要跨团队评审（领域知识不足） | 评审周期 2 天 | 15 次 |
| 故障排查 | 需要四方同时在线排查 | MTTR 45 分钟 | 3 次 |
| 数据库变更 | 需要协调统一变更窗口 | 等待窗口 1 周 | 2 次 |

**月度协调成本**: 约 64 人时（8 次×3 天×2 人 + 15 次×2 天×2 人 + 3 次×45 分钟×4 人 + 2 次×1 周×2 人）

**问题 4: 迭代频率差异大 (Different Iteration Frequencies)**

| 模块 | 变更频率 | 合适发布周期 | 当前发布周期 | 被拖慢程度 |
|------|---------|-------------|-------------|-----------|
| 产物管理 (M06) | 高频（每周 2-3 次） | 周级 | 月级 | 4x |
| 工具管理 (M08) | 高频（每周 1-2 次） | 周级 | 月级 | 4x |
| 团队管理 (M03) | 中频（每两周 1 次） | 双周级 | 月级 | 2x |
| 通知协作 (M05) | 中频（每两周 1 次） | 双周级 | 月级 | 2x |
| 多租户管理 (M02) | 低频（每月 1 次） | 月级 | 月级 | 1x |
| 安全合规 (M10) | 低频（每月 1 次） | 月级 | 月级 | 1x |
| 审计日志 (M09) | 低频（每月 1 次） | 月级 | 月级 | 1x |

**结论**: 高频模块被低频模块拖慢，整体发布频率 = 最慢模块频率。资源管理域（M06、M08）迭代速度损失 75%。

### 1.2 多 Agent 架构评审反馈

根据多 Agent 架构评审报告，`orion-platform-service` 被标记为"上帝服务"（God Service），主要问题包括：

```
评审意见摘要:
├── 问题 1: 单服务包含 8 个异质模块，违反单一职责原则
├── 问题 2: 模块间耦合度高，无法独立部署
├── 问题 3: 团队边界不清晰，协调成本高
├── 问题 4: 数据模型混杂，查询优化困难
└── 建议: 按业务域拆分为 3-4 个独立服务
```

### 1.3 业界最佳实践参考

| 公司 | 服务拆分案例 | 关键经验 |
|------|-------------|---------|
| Netflix | 从单体拆分为 600+ 微服务 | 按业务域边界拆分，团队自治 |
| Amazon | "两个披萨团队"原则 | 服务与团队对齐，API 清晰 |
| Alibaba | 中台服务拆分 | 数据自治，事件驱动解耦 |
| 字节跳动 | 效能平台服务拆分 | 高频/低频模块分离部署 |

---

## 二、拆分目标与原则 (Goals and Principles)

### 2.1 拆分目标

#### 2.1.1 业务目标

| 目标 | 当前状态 | 目标状态 | 衡量指标 |
|------|---------|---------|---------|
| 团队自治 | 4 团队共用代码库 | 每团队独立代码库 | 发布等待时间 <4 小时 |
| 发布频率 | 月级发布 | 周级发布 | 单服务发布≥4 次/月 |
| 故障隔离 | 单模块故障影响全服务 | 服务间故障隔离 | MTTR <15 分钟 |
| 新人上手 | 4 周理解全模块 | 1 周理解单域 | 培训时间≤5 天 |

#### 2.1.2 技术目标

| 目标 | 当前状态 | 目标状态 | 衡量指标 |
|------|---------|---------|---------|
| 代码规模 | 56,000 行 | ≤15,000 行/服务 | 单文件≤500 行 |
| 测试时间 | 45 分钟全量 | ≤10 分钟/服务 | 单元测试覆盖率≥80% |
| 部署时间 | 25 分钟 | ≤5 分钟/服务 | 零停机部署 |
| 数据自治 | 单库 24 张表 | 每服务独立库 | 无跨库 JOIN |

### 2.2 拆分原则

拆分遵循以下核心原则（SOLID + 微服务最佳实践）：

| 原则 | 说明 | 验证标准 | 违反示例 |
|------|------|---------|---------|
| **单一职责 (SRP)** | 每个服务只负责一个业务域 | 服务名称能清晰表达职责 | 一个服务叫"平台资源安全服务" |
| **开闭原则 (OCP)** | 对扩展开放，对修改关闭 | 新增功能不修改现有代码 | 新增通知渠道需修改核心逻辑 |
| **数据自治** | 每个服务拥有独立数据库 | 无跨服务直接数据库访问 | 服务 A 直接查询服务 B 的表 |
| **API 清晰** | 服务边界通过 API 定义 | API 文档无歧义 | API 路径包含多个域概念 |
| **团队对齐** | 服务与团队组织结构一致 | 一个服务一个负责人 | 多个团队维护同一服务 |
| **向后兼容** | 拆分过程不影响现有调用方 | 零停机迁移 | 迁移期间 API 不可用 |
| **事件驱动** | 服务间优先异步通信 | 核心路径无同步调用链 | 同步调用链>3 层 |

### 2.3 拆分策略选择

#### 2.3.1 拆分策略对比

| 策略 | 描述 | 优点 | 缺点 | 选择 |
|------|------|------|------|------|
| **按功能拆分** | 每个 CRUD 操作独立服务 | 职责清晰 | 调用链过长 | ❌ |
| **按数据拆分** | 每张表独立服务 | 数据自治 | 服务过多 | ❌ |
| **按业务域拆分** | 按领域驱动设计边界 | 业务内聚、团队对齐 | 需要领域分析 | ✅ |
| **按变更频率拆分** | 高频/低频模块分离 | 发布解耦 | 业务逻辑分散 | 辅助策略 |

#### 2.3.2 业务域识别

通过事件风暴（Event Storming）识别出 4 个核心业务域：

```
业务域识别过程:
├── 资源管理域 (Resource Domain)
│   ├── 核心事件：ArtifactCreated, LibraryPublished, ToolUpgraded
│   ├── 聚合根：Artifact, Library, Tool
│   └── 职责：软件资产全生命周期管理
│
├── 租户协作域 (Tenant & Collaboration Domain)
│   ├── 核心事件：TenantCreated, TeamJoined, NotificationSent
│   ├── 聚合根：Tenant, Team, Channel
│   └── 职责：组织结构与协作能力
│
├── 安全合规域 (Governance Domain)
│   ├── 核心事件：PolicyViolated, AuditLogged, ComplianceChecked
│   ├── 聚合根：Policy, AuditLog, ComplianceReport
│   └── 职责：风险控制与合规审计
│
└── 认证授权域 (Auth Domain)
    ├── 核心事件：UserLoggedIn, PermissionGranted, RoleAssigned
    ├── 聚合根：User, Role, Permission
    └── 职责：身份认证与访问控制
```

---

## 三、拆分后服务全景图 (Service Landscape After Split)

### 3.1 整体架构 ASCII 图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Orion Platform Architecture                           │
│                              After Service Split                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   API Gateway   │
                                    │  (Kong/Traefik) │
                                    └────────┬────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                                   │                                   │
         ▼                                   ▼                                   ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Resource       │             │   Tenant        │             │   Governance    │
│  Service        │             │   Service       │             │   Service       │
│                 │             │                 │             │                 │
│ ┌─────────────┐ │             │ ┌─────────────┐ │             │ ┌─────────────┐ │
│ │ Artifact Mgr│ │             │ │ Tenant Mgr  │ │             │ │ Security    │ │
│ └─────────────┘ │             │ └─────────────┘ │             │ │ Policy Mgr  │ │
│ ┌─────────────┐ │             │ ┌─────────────┐ │             │ └─────────────┘ │
│ │ Library Mgr │ │             │ │ Team Mgr    │ │             │ ┌─────────────┐ │
│ └─────────────┘ │             │ └─────────────┘ │             │ │ Compliance  │ │
│ ┌─────────────┐ │             │ ┌─────────────┐ │             │ │ Checker     │ │
│ │ Tool Mgr    │ │             │ │ Notification│ │             │ └─────────────┘ │
│ └─────────────┘ │             │ └─────────────┘ │             │ ┌─────────────┐ │
│                 │             │                 │             │ │ Audit Log   │ │
│ DB: orion_res   │             │ DB: orion_tenant│             │ │ Collector   │ │
│                 │             │                 │             │ └─────────────┘ │
│ Team: Platform  │             │ Team: Platform  │             │ DB: orion_gov   │
│ Tools Team      │             │ Foundation Team │             │ Team: Security  │
└─────────────────┘             └─────────────────┘             │ & Compliance    │
         │                                   │                  └─────────────────┘
         │                                   │                           │
         ▼                                   ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Event Bus (NATS JetStream)                            │
│  Topics: audit.*, resource.*, tenant.*, security.*, notification.*              │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                                   │                           │
         ▼                                   ▼                           ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│   Pipeline      │             │     AI          │             │    CMDB         │
│   Service       │             │   Service       │             │   Service       │
│                 │             │                 │             │                 │
│ ┌─────────────┐ │             │ ┌─────────────┐ │             │ ┌─────────────┐ │
│ │ Pipeline    │ │             │ │ LLM         │ │             │ │ Server      │ │
│ │ Engine      │ │             │ │ Inference   │ │             │ │ Mgr         │ │
│ └─────────────┘ │             │ └─────────────┘ │             │ └─────────────┘ │
│ ┌─────────────┐ │             │ ┌─────────────┐ │             │ ┌─────────────┐ │
│ │ Build Mgr   │ │             │ │ AI Skill    │ │             │ │ App         │ │
│ └─────────────┘ │             │ │ Engine      │ │             │ │ Mgr         │ │
│ ┌─────────────┐ │             │ └─────────────┘ │             │ └─────────────┘ │
│ │ Deploy Mgr  │ │             │                 │             │ ┌─────────────┐ │
│ └─────────────┘ │             │ DB: orion_ai    │             │ │ Topology    │ │
│                 │             │                 │             │ │ Mgr         │ │
│ DB: orion_pl    │             │ Team: AI        │             │ └─────────────┘ │
│                 │             │                 │             │ DB: orion_cmdb  │
│ Team: Pipeline  │             └─────────────────┘             │ Team: SRE       │
└─────────────────┘                                             └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ PostgreSQL   │ │   NATS       │ │   Redis      │ │   MinIO      │           │
│  │ (Primary/    │ │ JetStream    │ │ (Sentinel)   │ │ (Distributed)│           │
│  │  Replica)    │ │ (3 Nodes)    │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 服务间依赖关系图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Service Dependency Graph                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────┐
                        │   API Gateway       │
                        │   (No Dependencies) │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ Platform        │  │ Resource        │  │ Tenant          │
    │ Service         │  │ Service         │  │ Service         │
    │ (Auth Core)     │  │                 │  │                 │
    │ Deps: None      │  │ Deps: Tenant    │  │ Deps: None      │
    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
             │                    │                    │
             │         ┌──────────┴────────────────────┘
             │         │
             ▼         ▼
    ┌─────────────────────────────────┐
    │      Governance Service         │
    │      (Deps: Tenant, Platform)   │
    └─────────────────────────────────┘

             服务间通信模式:
             ├── 同步 REST (实线): 权限验证、配置获取
             └── 异步事件 (虚线): 审计日志、通知发送
```

### 3.3 服务注册与发现

```
服务注册中心 (Service Registry):
┌─────────────────────────────────────────────────────────────────┐
│                     Consul / Nacos / Eureka                      │
├─────────────────────────────────────────────────────────────────┤
│  Registered Services:                                            │
│  ├── orion-api-gateway:8080 (3 instances)                       │
│  ├── orion-platform-service:8081 (2 instances)                  │
│  ├── orion-resource-service:8082 (2 instances)                  │
│  ├── orion-tenant-service:8083 (2 instances)                    │
│  ├── orion-governance-service:8084 (2 instances)                │
│  ├── orion-pipeline-service:8085 (3 instances)                  │
│  ├── orion-ai-service:8086 (5 instances, GPU)                   │
│  └── orion-cmdb-service:8087 (2 instances)                      │
└─────────────────────────────────────────────────────────────────┘

健康检查配置:
├── 检查间隔: 10s
├── 超时时间: 5s
├── 失败阈值: 3 次
└── 健康端点: GET /actuator/health
```

---

## 四、各服务详细职责 (Detailed Service Responsibilities)

### 4.1 orion-resource-service（资源管理服务）

#### 4.1.1 服务定位

**服务名称**: `orion-resource-service`  
**端口**: 8082  
**定位**: Orion 平台的软件资产管理中心，统一管理构建产物、二方库依赖、工具插件三类核心资源。  
**命名理由**: "Resource"在研发语境中明确指向软件制品/资源，区别于基础设施资源（CMDB 管辖）。

#### 4.1.2 核心职责与功能边界

| 职责域 | 详细功能描述 | 不包含功能 |
|-------|-------------|-----------|
| **产物管理** | 管理 Pipeline 产生的构建产物（Docker 镜像、JAR 包、Python Wheel、Helm Chart 等），包括产物元数据、版本标签、生命周期策略（自动清理快照）、签名验证、SBOM 关联 | 产物实际存储（由 MinIO/Harbor 负责） |
| **二方库管理** | 管理组织内部发布的共享库（Maven/npm/PyPI 包），包括版本发布审批、兼容性检查、依赖关系图、废弃通知、替代版本推荐 | 包仓库存储（由 Nexus/Artifactory 负责） |
| **工具管理** | 管理 CI/CD 工具链（Semgrep、SonarQube、Trivy 等）的注册、安装、升级、配置模板、版本兼容性矩阵、健康检查、使用统计 | 工具实际运行（工具独立部署） |

#### 4.1.3 API 边界定义

| API 路径 | 方法 | 功能 | 调用方 | 频率 |
|---------|------|------|-------|------|
| `/api/v1/artifacts` | POST/GET/LIST | 产物 CRUD | Pipeline 服务、前端 | 高 |
| `/api/v1/artifacts/{id}/download` | GET | 产物下载链接 | 运维治理服务、用户 | 中 |
| `/api/v1/artifacts/{id}/promote` | POST | 产物晋升（snapshot→rc→stable） | Pipeline 服务 | 中 |
| `/api/v1/artifacts/{id}/sbom` | GET | 获取 SBOM | 安全合规服务 | 低 |
| `/api/v1/libraries` | POST/GET/LIST | 二方库 CRUD | 前端、Pipeline 服务 | 中 |
| `/api/v1/libraries/{id}/publish` | POST | 库版本发布 | CI 工具 | 中 |
| `/api/v1/libraries/{id}/deprecate` | POST | 库版本废弃 | 团队负责人 | 低 |
| `/api/v1/libraries/{id}/dependencies` | GET | 获取依赖关系图 | 前端、AI 服务 | 中 |
| `/api/v1/tools` | GET/LIST | 工具列表 | 前端、AI 服务 | 高 |
| `/api/v1/tools/{id}/install` | POST | 工具安装 | 团队负责人 | 低 |
| `/api/v1/tools/{id}/upgrade` | POST | 工具升级 | 团队负责人 | 低 |
| `/api/v1/tools/{id}/configs` | GET/POST | 工具配置管理 | 前端、Pipeline 服务 | 高 |
| `/api/v1/tools/{id}/health` | GET | 工具健康检查 | 运维治理服务 | 高 |
| `/api/v1/tools/{id}/stats` | GET | 工具使用统计 | 效能洞察服务 | 中 |

#### 4.1.4 团队归属与运维

| 属性 | 详情 |
|------|------|
| **负责团队** | 平台工具团队（Platform Tools Team） |
| **团队规模** | 3-4 人 |
| **服务负责人** | 待定 |
| **主要协作团队** | Pipeline 团队、AI 团队、SRE 团队 |
| **SLA** | 99.9% |
| **RTO/RPO** | RTO<30min, RPO<5min |

---

### 4.2 orion-tenant-service（租户协作服务）

#### 4.2.1 服务定位

**服务名称**: `orion-tenant-service`  
**端口**: 8083  
**定位**: Orion 平台的组织与协作中心，管理多租户隔离、团队结构、通知协作、插件扩展等组织能力。  
**命名理由**: "Tenant"明确表达多租户场景，"Collaboration"体现协作属性。

#### 4.2.2 核心职责与功能边界

| 职责域 | 详细功能描述 | 不包含功能 |
|-------|-------------|-----------|
| **多租户管理** | 管理租户的创建、配置、资源配额（CPU/内存/存储配额）、隔离策略（Namespace/RLS）、账单归属、租户间数据隔离 | 租户计费（由 FinOps 模块负责） |
| **团队与成员** | 管理租户下的团队组织结构、成员加入/退出、团队负责人变更、跨团队成员关系、团队继承权限 | 用户认证（由 platform-service 负责） |
| **通知协作** | 管理通知渠道（钉钉/企微/Slack/邮件）、消息模板、发送策略（节流/合并）、发送历史、@提及规则、ChatOps 命令解析 | 通知实际发送（由消息队列负责） |
| **插件扩展** | 管理用户自定义插件注册、Skill 扩展点、Webhook 订阅、事件处理器、第三方集成适配器 | 插件运行沙箱（独立运行环境） |

#### 4.2.3 API 边界定义

| API 路径 | 方法 | 功能 | 调用方 | 频率 |
|---------|------|------|-------|------|
| `/api/v1/tenants` | POST/GET/LIST | 租户 CRUD | 平台管理员、前端 | 低 |
| `/api/v1/tenants/{id}/quotas` | GET/PUT | 租户配额管理 | 平台管理员 | 低 |
| `/api/v1/tenants/{id}/usage` | GET | 租户资源使用统计 | 效能洞察服务 | 中 |
| `/api/v1/teams` | POST/GET/LIST/DELETE | 团队 CRUD | 租户管理员、前端 | 中 |
| `/api/v1/teams/{id}/members` | POST/GET/DELETE | 成员管理 | 团队负责人、前端 | 中 |
| `/api/v1/teams/{id}/permissions` | GET | 团队权限继承 | 所有服务 | 高 |
| `/api/v1/channels` | POST/GET/LIST/DELETE | 通知渠道管理 | 租户管理员、前端 | 低 |
| `/api/v1/channels/{id}/test` | POST | 渠道测试 | 前端 | 低 |
| `/api/v1/notifications/send` | POST | 发送通知 | 所有服务 | 高 |
| `/api/v1/notifications/templates` | GET/POST | 模板管理 | 租户管理员 | 中 |
| `/api/v1/plugins` | GET/LIST/REGISTER | 插件注册与发现 | 开发者、前端 | 低 |
| `/api/v1/plugins/{id}/enable` | POST | 插件启用/禁用 | 租户管理员 | 低 |
| `/api/v1/webhooks` | POST/GET/LIST | Webhook 订阅管理 | 开发者、外部系统 | 中 |

#### 4.2.4 团队归属与运维

| 属性 | 详情 |
|------|------|
| **负责团队** | 平台基础团队（Platform Foundation Team） |
| **团队规模** | 3-4 人 |
| **服务负责人** | 待定 |
| **主要协作团队** | 所有业务团队（通用依赖） |
| **SLA** | 99.95% |
| **RTO/RPO** | RTO<15min, RPO<1min |

---

### 4.3 orion-governance-service（安全合规服务）

#### 4.3.1 服务定位

**服务名称**: `orion-governance-service`  
**端口**: 8084  
**定位**: Orion 平台的安全与合规中心，负责安全策略执行、合规检查、审计日志采集与分析、风险预警。  
**命名理由**: "Governance"涵盖治理、合规、审计等含义，比"Security"更准确表达服务职责。

#### 4.3.2 核心职责与功能边界

| 职责域 | 详细功能描述 | 不包含功能 |
|-------|-------------|-----------|
| **安全策略管理** | 定义和执行安全策略（密码复杂度、MFA 强制、会话超时、IP 白名单）、策略版本管理、策略例外审批流程 | 策略执行（由各服务自行实施） |
| **合规检查** | 执行合规扫描（等保 2.0、ISO27001、SOC2）、生成合规报告、不合规项整改跟踪、合规证据自动采集 | 外部审计对接（由人工负责） |
| **审计日志** | 采集全平台操作日志、日志结构化、敏感操作标记、日志完整性校验、日志归档与保留策略、审计查询 API | 日志存储（由 Elasticsearch 负责） |
| **风险预警** | 基于审计日志的风险识别（异常登录、越权访问、数据泄露风险）、实时告警、风险评分 | 告警发送（由通知服务负责） |

#### 4.3.3 API 边界定义

| API 路径 | 方法 | 功能 | 调用方 | 频率 |
|---------|------|------|-------|------|
| `/api/v1/security/policies` | GET/POST/PUT | 安全策略 CRUD | 安全管理员、前端 | 低 |
| `/api/v1/security/policies/{id}/exceptions` | POST/GET | 策略例外申请 | 用户、安全管理员 | 低 |
| `/api/v1/compliance/checks` | POST/GET | 执行合规检查 | 安全管理员、定时任务 | 低 |
| `/api/v1/compliance/reports` | GET | 获取合规报告 | 审计员、前端 | 低 |
| `/api/v1/compliance/findings/{id}/remediate` | POST | 问题项整改标记 | 责任人 | 中 |
| `/api/v1/audit/logs` | GET | 审计日志查询 | 审计员、合规工具 | 中 |
| `/api/v1/audit/export` | POST | 审计日志导出 | 审计员 | 低 |
| `/api/v1/audit/stream` | GET (SSE) | 审计日志实时流 | 安全监控大屏 | 中 |
| `/api/v1/risks/events` | GET | 风险事件列表 | 安全管理员、前端 | 中 |
| `/api/v1/risks/scores/{entityId}` | GET | 实体风险评分 | 前端、AI 服务 | 中 |
| `/api/v1/risks/alerts` | POST | 风险告警 | AI 服务、定时任务 | 中 |

#### 4.3.4 团队归属与运维

| 属性 | 详情 |
|------|------|
| **负责团队** | 安全与合规团队（Security & Compliance Team） |
| **团队规模** | 2-3 人 |
| **服务负责人** | 待定 |
| **主要协作团队** | 所有业务团队、外部审计系统 |
| **SLA** | 99.99% |
| **RTO/RPO** | RTO<10min, RPO<0 (数据零丢失) |

---

### 4.4 orion-platform-service（缩减后平台服务）

#### 4.4.1 服务定位

**服务名称**: `orion-platform-service`（保持向后兼容）  
**端口**: 8081  
**定位**: Orion 平台的身份认证与权限中心，负责用户认证、RBAC 授权、全局标签、集成配置。  
**缩减理由**: 保留最核心、最高频、最强一致性的认证授权功能。

#### 4.4.2 保留模块与移除模块

| 模块 | 归属 | 说明 |
|------|------|------|
| **保留：用户与认证** | platform-service | 用户基础信息、登录认证、Session 管理 |
| **保留：角色权限** | platform-service | RBAC 核心逻辑、权限评估引擎 |
| **保留：全局标签** | platform-service | 跨服务共享的标签定义 |
| **保留：集成配置** | platform-service | 外部系统（GitLab/Jira/Confluence）集成配置 |
| **移除：多租户管理** | → tenant-service | 移至租户协作服务 |
| **移除：团队管理** | → tenant-service | 移至租户协作服务 |
| **移除：通知协作** | → tenant-service | 移至租户协作服务 |
| **移除：产物管理** | → resource-service | 移至资源管理服务 |
| **移除：二方库管理** | → resource-service | 移至资源管理服务 |
| **移除：工具管理** | → resource-service | 移至资源管理服务 |
| **移除：审计日志** | → governance-service | 移至安全合规服务 |
| **移除：安全合规** | → governance-service | 移至安全合规服务 |

#### 4.4.3 API 边界定义

| API 路径 | 方法 | 功能 | 调用方 | 频率 |
|---------|------|------|-------|------|
| `/api/v1/users` | POST/GET/LIST | 用户 CRUD | 所有服务、前端 | 高 |
| `/api/v1/users/{id}/login` | POST | 用户登录 | API Gateway | 高 |
| `/api/v1/users/{id}/logout` | POST | 用户登出 | API Gateway | 中 |
| `/api/v1/users/{id}/permissions` | GET | 获取用户权限 | 所有服务 | 高 |
| `/api/v1/roles` | POST/GET/LIST/PUT | 角色 CRUD | 平台管理员、前端 | 中 |
| `/api/v1/roles/{id}/permissions` | GET/PUT | 角色权限管理 | 平台管理员 | 中 |
| `/api/v1/permissions` | GET/LIST | 权限定义列表 | 前端、AI 服务 | 中 |
| `/api/v1/permissions/evaluate` | POST | 权限评估（RBAC+ABAC） | API Gateway、所有服务 | 高 |
| `/api/v1/tags` | POST/GET/LIST/DELETE | 全局标签 CRUD | 所有服务、前端 | 中 |
| `/api/v1/tags/{id}/assign` | POST | 标签关联资源 | 所有服务 | 中 |
| `/api/v1/integrations` | POST/GET/LIST | 集成配置 CRUD | 管理员、前端 | 低 |
| `/api/v1/integrations/{id}/test` | POST | 连接测试 | 前端 | 低 |
| `/api/v1/sessions` | GET/DELETE | 会话管理 | 前端、安全合规服务 | 中 |
| `/api/v1/sso/config` | GET | SSO 配置 | API Gateway | 中 |

#### 4.4.4 团队归属与运维

| 属性 | 详情 |
|------|------|
| **负责团队** | 平台基础团队（Platform Foundation Team） |
| **团队规模** | 3-4 人 |
| **服务负责人** | 待定 |
| **主要协作团队** | 所有业务团队（基础依赖） |
| **SLA** | 99.99% |
| **RTO/RPO** | RTO<10min, RPO<1min |

---

## 五、数据库拆分方案 (Database Split Strategy)

### 5.1 数据所有权划分

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Database Ownership After Split                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  orion_platform (原数据库，缩减后)                                               │
│  Owner: orion-platform-service                                                  │
│  ├── users                  - 用户基础信息                                       │
│  ├── roles                  - 角色定义                                           │
│  ├── permissions            - 权限定义                                           │
│  ├── role_permissions       - 角色权限关联                                       │
│  ├── user_roles             - 用户角色关联                                       │
│  ├── tags                   - 全局标签                                           │
│  ├── integrations           - 外部系统集成配置                                   │
│  └── sessions               - 用户会话                                           │
│                                                                                   │
│  移除表：tenants, teams, tenant_members, artifacts, tools, audit_logs, policies  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  orion_resource (新数据库)                                                       │
│  Owner: orion-resource-service                                                  │
│  ├── artifacts              - 构建产物元数据                                     │
│  ├── artifact_versions      - 产物版本详情                                       │
│  ├── artifact_sbom          - SBOM 关联                                          │
│  ├── internal_libraries     - 二方库元数据                                       │
│  ├── library_versions       - 库版本详情                                         │
│  ├── library_dependencies   - 库依赖关系                                         │
│  ├── tools                  - 工具注册信息                                       │
│  ├── tool_versions          - 工具版本信息                                       │
│  ├── tool_configs           - 工具配置模板                                       │
│  └── tool_health_checks     - 工具健康检查记录                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  orion_tenant (新数据库)                                                         │
│  Owner: orion-tenant-service                                                    │
│  ├── tenants                - 租户元数据                                         │
│  ├── tenant_configs         - 租户配置                                           │
│  ├── tenant_quotas          - 租户配额                                           │
│  ├── tenant_usage           - 租户资源使用统计                                   │
│  ├── teams                  - 团队信息                                           │
│  ├── team_members           - 团队成员关系                                       │
│  ├── team_permissions       - 团队权限继承                                       │
│  ├── notification_channels  - 通知渠道配置                                       │
│  ├── notification_templates - 消息模板                                           │
│  ├── notification_records   - 通知发送记录                                       │
│  ├── plugins                - 插件注册信息                                       │
│  ├── plugin_configs         - 插件配置                                           │
│  └── webhook_subscriptions  - Webhook 订阅                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  orion_governance (新数据库)                                                     │
│  Owner: orion-governance-service                                                │
│  ├── security_policies      - 安全策略定义                                       │
│  ├── policy_exceptions      - 策略例外审批                                       │
│  ├── compliance_checks      - 合规检查记录                                       │
│  ├── compliance_findings    - 合规问题项                                         │
│  ├── compliance_reports     - 合规报告                                           │
│  ├── audit_logs             - 审计日志 (分区表，按月)                            │
│  ├── audit_log_integrity    - 审计日志完整性校验                                 │
│  ├── risk_events            - 风险事件记录                                       │
│  └── risk_scores            - 风险评分快照                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 数据库迁移策略

#### 5.2.1 表迁移映射

| 原表名 | 新数据库 | 新表名 | 迁移方式 | 数据量 |
|-------|---------|-------|---------|-------|
| `tenants` | orion_tenant | `tenants` | 直接迁移 | 1,000 条 |
| `tenant_configs` | orion_tenant | `tenant_configs` | 直接迁移 | 1,000 条 |
| `tenant_quotas` | orion_tenant | `tenant_quotas` | 直接迁移 | 1,000 条 |
| `teams` | orion_tenant | `teams` | 直接迁移 | 10,000 条 |
| `team_members` | orion_tenant | `team_members` | 直接迁移 | 100,000 条 |
| `notification_channels` | orion_tenant | `notification_channels` | 直接迁移 | 5,000 条 |
| `notification_templates` | orion_tenant | `notification_templates` | 直接迁移 | 1,000 条 |
| `notification_records` | orion_tenant | `notification_records` | 分页迁移 | 10,000,000 条 |
| `artifacts` | orion_resource | `artifacts` | 直接迁移 | 500,000 条 |
| `artifact_versions` | orion_resource | `artifact_versions` | 分页迁移 | 2,000,000 条 |
| `internal_libraries` | orion_resource | `internal_libraries` | 直接迁移 | 10,000 条 |
| `library_versions` | orion_resource | `library_versions` | 直接迁移 | 100,000 条 |
| `tools` | orion_resource | `tools` | 直接迁移 | 500 条 |
| `tool_versions` | orion_resource | `tool_versions` | 直接迁移 | 5,000 条 |
| `tool_configs` | orion_resource | `tool_configs` | 直接迁移 | 2,000 条 |
| `audit_logs` | orion_governance | `audit_logs` | 分区迁移 | 500,000,000 条 |
| `security_policies` | orion_governance | `security_policies` | 直接迁移 | 500 条 |
| `compliance_checks` | orion_governance | `compliance_checks` | 直接迁移 | 100,000 条 |

#### 5.2.2 迁移脚本示例

```sql
-- 阶段 1: 创建新数据库和 Schema
CREATE DATABASE orion_resource CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE orion_tenant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE orion_governance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 阶段 2: 创建目标表结构 (以 orion_tenant 为例)
USE orion_tenant;

CREATE TABLE tenants (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 阶段 3: 数据迁移 (小表直接迁移)
INSERT INTO orion_tenant.tenants 
SELECT * FROM orion_platform.tenants;

-- 阶段 4: 数据迁移 (大表分页迁移)
-- 使用存储过程分批迁移 notification_records
DELIMITER $$
CREATE PROCEDURE migrate_notification_records()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE batch_size INT DEFAULT 10000;
    DECLARE offset INT DEFAULT 0;
    DECLARE total_count INT;
    
    SELECT COUNT(*) INTO total_count FROM orion_platform.notification_records;
    
    migrate_loop: LOOP
        IF offset >= total_count THEN
            LEAVE migrate_loop;
        END IF;
        
        INSERT INTO orion_tenant.notification_records
        SELECT * FROM orion_platform.notification_records
        LIMIT offset, batch_size;
        
        SET offset = offset + batch_size;
        
        -- 记录迁移进度
        INSERT INTO migration_progress (table_name, migrated_rows, total_rows, status)
        VALUES ('notification_records', offset, total_count, 'in_progress')
        ON DUPLICATE KEY UPDATE migrated_rows = offset;
        
        -- 避免锁表，每批间隔 100ms
        DO SLEEP(0.1);
    END LOOP;
END$$
DELIMITER ;

-- 阶段 5: 验证数据一致性
SELECT 
    'tenants' AS table_name,
    (SELECT COUNT(*) FROM orion_platform.tenants) AS source_count,
    (SELECT COUNT(*) FROM orion_tenant.tenants) AS target_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM orion_platform.tenants) = 
             (SELECT COUNT(*) FROM orion_tenant.tenants) 
        THEN 'OK' 
        ELSE 'MISMATCH' 
    END AS status;

-- 阶段 6: 创建外键和索引 (迁移后)
ALTER TABLE orion_tenant.team_members 
ADD INDEX idx_user_id (user_id),
ADD INDEX idx_team_id (team_id);
```

### 5.3 数据一致性保证

#### 5.3.1 迁移期间一致性策略

| 阶段 | 策略 | 说明 |
|------|------|------|
| **迁移前** | 只读模式 | 暂停写操作，确保数据静止 |
| **迁移中** | 增量同步 | 使用 CDC 捕获变更，实时同步 |
| **迁移后** | 双向比对 | 抽样验证数据一致性 |

#### 5.3.2 跨服务数据一致性

| 场景 | 一致性要求 | 实现方案 |
|------|-----------|---------|
| 产物创建 + 审计记录 | 最终一致 | 本地事务 + 事件通知 |
| 租户创建 + 权限初始化 | 强一致 | Saga 事务（补偿回滚） |
| 工具升级 + 配置更新 | 最终一致 | 事件驱动 + 重试 |
| 审计日志写入 | 至少一次 | NATS JetStream 持久化 |

#### 5.3.3 Saga 事务流程

```
租户创建 Saga 流程:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Step 1: tenant-service 创建租户                                         │
│          └─ 成功 → 发布 TenantCreated 事件                               │
│          └─ 失败 → 回滚，结束                                            │
│                                    │                                    │
│                                    ▼                                    │
│  Step 2: platform-service 初始化权限                                      │
│          └─ 成功 → 发布 PermissionInitialized 事件                       │
│          └─ 失败 → 发布 TenantCreationFailed 事件 → 触发补偿             │
│                                    │                                    │
│                                    ▼                                    │
│  Step 3: governance-service 记录审计日志                                  │
│          └─ 成功 → Saga 完成                                             │
│          └─ 失败 → 记录错误，不影响主流程                                │
│                                                                         │
│  补偿流程 (Rollback):                                                   │
│  TenantCreationFailed → platform-service 删除权限 → tenant-service      │
│  删除租户 → 发送 TenantDeleted 事件                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 六、迁移路线图 (Migration Roadmap)

### 6.1 迁移总览 (4 阶段 12 周)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              Orion Platform Service Split Migration Timeline                     │
│              Total Duration: 12 Weeks (3 Months)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Phase 1: 准备阶段 (Week 1-3)
├── Week 1: 数据库 Schema 设计
├── Week 2: 数据迁移脚本开发
└── Week 3: 测试环境搭建 + 基线测试

Phase 2: 开发阶段 (Week 4-8)
├── Week 4-5: orion-tenant-service 开发
├── Week 5-6: orion-resource-service 开发
├── Week 6-7: orion-governance-service 开发
└── Week 8: API 网关配置 + 集成测试

Phase 3: 迁移阶段 (Week 9-11)
├── Week 9: 灰度 10% → 监控验证
├── Week 10: 灰度 50% → 性能对比
└── Week 11: 灰度 100% → 旧 API 下线

Phase 4: 收尾阶段 (Week 12)
├── 旧服务代码清理
├── 文档更新 + 团队培训
└── 复盘总结

关键里程碑:
├── M1 (Week 3): 数据库 Schema 冻结
├── M2 (Week 8): 新服务开发完成
├── M3 (Week 11): 流量完全切换
└── M4 (Week 12): 项目关闭
```

### 6.2 Phase 1: 准备阶段 (Week 1-3)

#### 6.2.1 Week 1: 数据库 Schema 设计

| 任务 | 负责人 | 产出物 | 验收标准 |
|------|--------|--------|---------|
| 新数据库 Schema 设计 | DBA | DDL 脚本 | 评审通过 |
| 表迁移映射定义 | 架构师 | 迁移映射表 | 无遗漏 |
| 外键和索引设计 | DBA | 索引定义 | 性能预估通过 |
| 分区策略定义 | DBA | 分区方案 | 可支持 3 年数据增长 |

#### 6.2.2 Week 2: 数据迁移脚本开发

| 任务 | 负责人 | 产出物 | 验收标准 |
|------|--------|--------|---------|
| 小表迁移脚本 | 开发工程师 | SQL 脚本 | 测试环境验证通过 |
| 大表分页迁移脚本 | 高级工程师 | 存储过程 | 无锁表、可恢复 |
| 数据验证脚本 | 测试工程师 | 验证 SQL | 可检测数据不一致 |
| 回滚脚本 | 开发工程师 | 回滚 SQL | 回滚测试通过 |

#### 6.2.3 Week 3: 测试环境搭建 + 基线测试

| 任务 | 负责人 | 产出物 | 验收标准 |
|------|--------|--------|---------|
| 测试环境部署 | SRE | 独立测试集群 | 4 服务独立部署 |
| 生产数据脱敏 | DBA | 脱敏数据集 | 无敏感信息泄露 |
| 性能基线测试 | 测试工程师 | 基线报告 | P99 延迟、吞吐量 |
| 迁移演练 | 全体 | 演练报告 | 问题清单 |

### 6.3 Phase 2: 开发阶段 (Week 4-8)

#### 6.3.1 Week 4-5: orion-tenant-service 开发

| 任务 | 产出物 | 验收标准 |
|------|--------|---------|
| 代码提取与重构 | 独立代码库 | 编译通过 |
| API 适配层开发 | 新旧 API 兼容 | 契约测试通过 |
| 数据库连接配置 | 独立数据源 | 连接池测试通过 |
| 单元测试 | 覆盖率≥80% | CI 通过 |

#### 6.3.2 Week 5-6: orion-resource-service 开发

| 任务 | 产出物 | 验收标准 |
|------|--------|---------|
| 代码提取与重构 | 独立代码库 | 编译通过 |
| API 适配层开发 | 新旧 API 兼容 | 契约测试通过 |
| 大对象存储集成 | MinIO/Harbor 连接 | 上传下载测试通过 |
| 缓存层实现 | Caffeine 缓存 | 命中率>90% |

#### 6.3.3 Week 6-7: orion-governance-service 开发

| 任务 | 产出物 | 验收标准 |
|------|--------|---------|
| 代码提取与重构 | 独立代码库 | 编译通过 |
| 审计日志分区表 | 分区表结构 | 查询性能测试通过 |
| 事件订阅实现 | NATS 消费者 | 消息不丢失 |
| 合规扫描集成 | 扫描任务 | 扫描报告生成 |

#### 6.3.4 Week 8: API 网关配置 + 集成测试

| 任务 | 产出物 | 验收标准 |
|------|--------|---------|
| API 路由配置 | Kong/Traefik 配置 | 路由测试通过 |
| 认证集成 | JWT/OAuth2 配置 | 认证测试通过 |
| 限流配置 | 限流策略 | 压测不超限 |
| 全链路集成测试 | 测试报告 | 所有场景通过 |

### 6.4 Phase 3: 迁移阶段 (Week 9-11)

#### 6.4.1 Week 9: 灰度 10%

| 任务 | 详细说明 | 验收标准 |
|------|---------|---------|
| 流量切 10% | API Gateway 路由规则 | 新服务接收 10% 请求 |
| 双写比对 | 新旧数据源同时写入 | 数据一致 |
| 监控告警 | 新服务指标监控 | 错误率<0.1% |
| 用户反馈 | 收集灰度用户反馈 | 无 P0 问题 |

#### 6.4.2 Week 10: 灰度 50%

| 任务 | 详细说明 | 验收标准 |
|------|---------|---------|
| 流量切 50% | 扩大灰度范围 | 新服务接收 50% 请求 |
| 性能对比 | 新旧服务 P99 延迟对比 | 新服务≤旧服务 110% |
| 容量评估 | 新服务资源使用率 | CPU<70%, 内存<80% |
| 故障演练 | 新服务故障切换 | 自动切回旧服务 |

#### 6.4.3 Week 11: 灰度 100%

| 任务 | 详细说明 | 验收标准 |
|------|---------|---------|
| 流量切 100% | 全部请求到新服务 | 旧服务请求量=0 |
| 旧 API 下线 | 移除旧 API 路由 | 监控无旧 API 调用 |
| 双写关闭 | 停止旧数据源写入 | 只写新数据源 |
| 稳定性观察 | 连续 7 天监控 | 无 P0/P1 故障 |

### 6.5 Phase 4: 收尾阶段 (Week 12)

#### 6.5.1 旧服务代码清理

| 任务 | 产出物 | 验收标准 |
|------|--------|---------|
| 移除已拆分模块代码 | 精简后代码库 | 编译通过 |
| 清理废弃 API | API 列表 | 无 404 错误 |
| 删除废弃数据库表 | 清理 SQL | 数据备份完成 |

#### 6.5.2 文档更新

| 文档 | 更新内容 | 负责人 |
|------|---------|--------|
| 架构图 | 更新服务拆分后架构 | 架构师 |
| API 文档 | 更新 API 路径和定义 | 技术文档工程师 |
| 运维手册 | 更新部署和监控流程 | SRE |
| 故障排查手册 | 更新故障处理流程 | 技术支持 |

#### 6.5.3 团队培训

| 培训内容 | 受众 | 时长 | 产出物 |
|---------|------|------|--------|
| 新架构培训 | 全体开发 | 2 小时 | 培训录屏 |
| 新运维流程 | SRE | 2 小时 | 操作手册 |
| 故障演练 | 值班工程师 | 4 小时 | 演练报告 |

---

## 七、风险评估与缓解 (Risk Assessment and Mitigation)

### 7.1 风险矩阵

| 风险 | 影响 | 概率 | 风险值 | 优先级 |
|------|------|------|--------|--------|
| 数据不一致 | 高 | 中 | 高 | P0 |
| API 兼容性 | 高 | 中 | 高 | P0 |
| 性能下降 | 中 | 中 | 中 | P1 |
| 部署协调 | 中 | 高 | 中 | P1 |
| 团队适应成本 | 中 | 高 | 中 | P1 |
| 服务依赖循环 | 高 | 低 | 中 | P2 |

### 7.2 详细风险缓解策略

#### 7.2.1 数据不一致风险 (P0)

**风险描述**: 拆分后数据分散到 4 个服务，可能出现跨服务数据不一致。

**影响**: 数据错误、业务异常、用户投诉

**缓解措施**:
1. **双写过渡期**: 迁移期间新旧数据源同时写入，定期比对
2. **对账任务**: 每日定时数据对账，自动修复不一致
3. **最终一致性**: 非核心数据接受秒级延迟（如统计信息）
4. **分布式事务**: 核心操作使用 Saga 模式

**监控指标**:
- 数据一致性比率 ≥ 99.99%
- 对账任务执行时间 < 30 分钟
- 不一致数据修复时间 < 1 小时

**应急预案**:
```
应急流程:
1. 发现数据不一致 → 告警触发
2. 自动执行修复脚本 → 记录修复日志
3. 修复失败 → 升级人工处理
4. 严重不一致 → 暂停迁移，回滚
```

#### 7.2.2 API 兼容性风险 (P0)

**风险描述**: 新服务 API 与旧 API 不兼容，导致调用方失败。

**影响**: 集成方调用失败、业务中断

**缓解措施**:
1. **API 版本化**: 新 API 使用`/api/v2/`前缀，旧 API 保持`/api/v1/`
2. **适配层**: 在 API Gateway 层实现 API 转发和参数转换
3. **契约测试**: 自动化测试确保 API 兼容 OpenAPI 规范
4. **消费者驱动**: 邀请主要调用方参与 API 评审

**监控指标**:
- API 兼容性测试通过率 100%
- 旧 API 调用量下降曲线
- API 错误率 < 0.1%

**应急预案**:
```
应急流程:
1. 发现 API 错误率升高 → 告警触发
2. 立即切换 Gateway 路由回旧 API
3. 热修复适配层（无需重启服务）
4. 验证修复后重新灰度
```

#### 7.2.3 性能下降风险 (P1)

**风险描述**: 服务拆分后网络调用增加，可能导致延迟上升。

**影响**: 用户体验下降、吞吐量降低

**缓解措施**:
1. **基准测试**: 拆分前后性能对比（P99 延迟、吞吐量）
2. **缓存策略**: 高频读取数据本地缓存（Caffeine）
3. **连接池优化**: 服务间连接池预热、长连接
4. **异步化**: 非核心路径异步处理

**性能目标**:
| 指标 | 拆分前 | 拆分后目标 | 告警阈值 |
|------|--------|-----------|---------|
| P99 延迟 | 200ms | <250ms | >300ms |
| 吞吐量 | 1000 RPS | >900 RPS | <800 RPS |
| 错误率 | 0.01% | <0.05% | >0.1% |

**应急预案**:
```
应急流程:
1. 发现性能下降 → 告警触发
2. 扩容新服务实例（自动/手动）
3. 降级非核心功能（如审计日志异步化）
4. 必要时切回旧服务
```

#### 7.2.4 部署协调风险 (P1)

**风险描述**: 4 个新服务需要协调部署顺序，可能导致部署窗口冲突。

**影响**: 部署延迟、服务不可用

**缓解措施**:
1. **独立 CI/CD**: 每个服务有独立流水线，可单独触发
2. **部署顺序文档**: 明确定义启动顺序
3. **健康检查依赖**: 服务启动时自动检查依赖服务是否就绪
4. **部署窗口**: 预留专用部署窗口（每周二、四凌晨）

**部署顺序**:
```
1. orion-platform-service (无服务依赖)
2. orion-tenant-service (依赖 platform-service)
3. orion-resource-service (依赖 tenant-service)
4. orion-governance-service (依赖 tenant-service, platform-service)
5. 其他服务 (按需调用新服务)
```

**应急预案**:
```
应急流程:
1. 部署失败 → 自动回滚
2. 服务启动失败 → 检查依赖服务状态
3. 协调失败 → 手动部署协调（建立临时指挥群）
4. 保留旧服务直到所有新服务稳定
```

#### 7.2.5 团队适应成本风险 (P1)

**风险描述**: 团队需要适应新架构，短期效率可能下降。

**影响**: 开发效率降低、故障率上升

**缓解措施**:
1. **培训计划**: 组织 3 场架构培训 + 2 场运维培训
2. **示例代码**: 提供新服务调用示例、最佳实践
3. **检查清单**: 开发/测试/发布检查清单
4. **专人支持**: 设立"架构大使"角色，提供一对一支持
5. **延长过渡期**: 从 4 周延长到 8 周

**培训内容**:
| 培训主题 | 内容 | 时长 | 受众 |
|---------|------|------|------|
| 新架构概览 | 服务拆分后架构、依赖关系 | 1 小时 | 全体 |
| API 调用规范 | 新服务 API 调用示例 | 1 小时 | 开发 |
| 数据访问规范 | 数据自治、跨服务查询 | 1 小时 | 开发 |
| 运维流程 | 部署、监控、故障处理 | 2 小时 | SRE |
| 故障演练 | 模拟故障场景处理 | 4 小时 | 值班 |

**应急预案**:
```
应急流程:
1. 发现团队适应困难 → 收集反馈
2. 增加一对一支持 → 架构大使介入
3. 延长过渡期 → 保留旧服务更长时间
4. 必要时回退 → 重新评估拆分方案
```

#### 7.2.6 服务依赖循环风险 (P2)

**风险描述**: 新服务之间可能出现循环依赖。

**影响**: 服务启动失败、死锁

**缓解措施**:
1. **依赖图扫描**: CI 阶段自动检测循环依赖
2. **架构评审**: 每次代码变更需架构负责人审批
3. **事件驱动**: 优先使用异步事件替代同步调用

**检测工具**:
```
# CI 阶段依赖检测脚本
./scripts/check-circular-dependencies.sh

# 输出示例:
✓ orion-platform-service: No circular dependencies
✓ orion-tenant-service: No circular dependencies
✓ orion-resource-service: No circular dependencies
✓ orion-governance-service: No circular dependencies
```

**应急预案**:
```
应急流程:
1. 发现循环依赖 → 告警触发
2. 临时引入防腐层（Facade 模式）
3. 紧急重构依赖最重的调用链路
4. 架构评审确认修复方案
```

---

## 八、预期收益量化 (Expected Benefits)

### 8.1 量化收益总览

| 指标 | 拆分前 | 拆分后目标 | 改善幅度 | 计算方法 |
|------|--------|-----------|---------|---------|
| **部署时间** | 25 分钟（全服务） | 5 分钟（单服务） | 80% | 部署脚本执行时间 |
| **发布频率** | 月级（协调困难） | 周级（独立发布） | 4x | 每月发布次数 |
| **代码库规模** | 56,000 行（单体） | 14,000 行（平均/服务） | 75% | 代码行数/服务 |
| **测试回归时间** | 45 分钟（全量） | 10 分钟（单服务） | 78% | 测试执行时间 |
| **团队并行度** | 串行（1 团队发布） | 并行（4 团队同时发布） | 4x | 同时发布团队数 |
| **故障 MTTR** | 45 分钟（四方排查） | 15 分钟（单方排查） | 67% | 故障恢复时间 |
| **新人上手时间** | 4 周（理解全模块） | 1 周（理解单域） | 75% | 独立开发时间 |
| **代码耦合度** | 模块间依赖 45 处 | 服务间依赖 12 处 | 73% | 依赖计数 |

### 8.2 收益详解

#### 8.2.1 部署效率提升

```
部署时间对比:
┌─────────────────────────────────────────────────────────────────┐
│  拆分前                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 编译 (8m) → 测试 (10m) → 打包 (2m) → 部署 (5m) = 25m   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  拆分后 (单服务)                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 编译 (2m) → 测试 (2m) → 打包 (0.5m) → 部署 (0.5m) = 5m │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

收益:
├── 部署窗口释放：从每周 1 次 25 分钟窗口 → 每周 4 次 5 分钟窗口
├── 发布风险降低：小步快跑，单次发布影响范围缩小 75%
└── 紧急修复能力：从 25 分钟 → 5 分钟，故障恢复更快
```

#### 8.2.2 团队效率提升

```
团队并行度对比:
┌─────────────────────────────────────────────────────────────────┐
│  拆分前                                                          │
│  │                                                              │
│  Team A: ████等待████等待████发布 ████等待                      │
│  Team B: ████等待████等待████等待 ████发布                      │
│  Team C: ████等待████等待████等待 ████发布                      │
│  Team D: ████等待████等待████等待 ████发布                      │
│                                                                  │
│  拆分后                                                          │
│  │                                                              │
│  Team A: ████发布████发布████发布 ████发布                      │
│  Team B:   ████发布████发布████发布 ████发布                    │
│  Team C:     ████发布████发布████发布 ████发布                  │
│  Team D:       ████发布████发布████发布 ████发布                │
└─────────────────────────────────────────────────────────────────┘

收益:
├── 发布等待时间：从 3 天 → 4 小时
├── 月度协调成本：从 64 人时 → 8 人时
└── 需求交付周期：从 4 周 → 1 周
```

#### 8.2.3 代码质量提升

```
代码指标对比:
┌─────────────────────────────────────────────────────────────────┐
│  指标               拆分前        拆分后        改善             │
│  代码行数           56,000        14,000/服务   75%              │
│  平均文件大小       450 行         280 行        38%              │
│  圈复杂度 (平均)    15            8             47%              │
│  重复代码率         12%           5%            58%              │
│  单元测试覆盖率     65%           85%           31%              │
│  技术债务           高            低            -                │
└─────────────────────────────────────────────────────────────────┘

收益:
├── 代码可读性提升：新人理解时间从 4 周 → 1 周
├── 测试质量提升：覆盖率从 65% → 85%
└── 技术债务减少：重构需求降低 50%
```

### 8.3 成本分析

#### 8.3.1 一次性投入

| 成本项 | 投入 | 说明 |
|-------|------|------|
| 开发成本 | 3 人 × 8 周 = 24 人周 | 新服务开发 |
| 测试成本 | 2 人 × 4 周 = 8 人周 | 测试用例、集成测试 |
| 运维成本 | 1 人 × 2 周 = 2 人周 | 部署脚本、监控配置 |
| 培训成本 | 2 人 × 1 周 = 2 人周 | 培训材料、演练 |
| **总计** | **36 人周** | 约 1.5 人月 |

#### 8.3.2 持续成本

| 成本项 | 增量 | 说明 |
|-------|------|------|
| 服务实例 | +3 个服务 ×2 副本 = 6 实例 | 约 15% 基础设施成本 |
| 监控告警 | +3 个服务监控 | 约 5% 监控成本 |
| CI/CD 流水线 | +3 条流水线 | 约 3% 构建成本 |
| **总计** | **约 23% 增量** | 月度运营成本 |

#### 8.3.3 ROI 分析

```
投资回收期计算:
┌─────────────────────────────────────────────────────────────────┐
│  月度收益:                                                       │
│  ├── 减少协调成本：64 人时 → 8 人时 = 56 人时 × $50/时 = $2,800  │
│  ├── 减少故障时间：3 次×(45m-15m) = 90 分钟 × $100/分 = $9,000  │
│  ├── 提升发布效率：4 次/月 × 20 分钟 × $50/分 = $4,000          │
│  └── 月度总收益：$15,800                                         │
│                                                                  │
│  投入成本:                                                       │
│  ├── 一次性投入：36 人周 × $2,000/周 = $72,000                  │
│  ├── 持续成本增量：$5,000/月                                     │
│  └── 净月度收益：$15,800 - $5,000 = $10,800                      │
│                                                                  │
│  投资回收期：$72,000 / $10,800 ≈ 6.7 个月                          │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 质化收益

| 收益类别 | 描述 | 影响 |
|---------|------|------|
| **架构清晰度** | 服务边界清晰，新人更容易理解职责 | 降低培训成本 |
| **团队自治** | 每个团队独立决策、独立发布、独立运维 | 提升团队满意度 |
| **技术选型自由** | 不同服务可选择不同技术栈 | 优化技术适配 |
| **故障隔离** | 单服务故障不影响其他服务 | 提升系统稳定性 |
| **成本优化** | 可按服务独立伸缩 | 降低资源浪费 |
| **合规审计** | 安全合规模块独立，更容易通过外部审计 | 降低合规成本 |

---

## 九、验收标准 (Acceptance Criteria)

### 9.1 功能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| F1 | 新服务独立部署 | 单独部署每个服务 | 所有服务启动成功 |
| F2 | API 向后兼容 | 调用旧 API | 响应与拆分前一致 |
| F3 | 数据迁移完整 | 数据比对 | 数据一致性 100% |
| F4 | 跨服务调用正常 | 集成测试 | 所有调用链成功 |
| F5 | 事件驱动正常 | 消息验证 | 事件不丢失、不重复 |

### 9.2 性能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| P1 | P99 延迟 | 压测 | <250ms |
| P2 | 吞吐量 | 压测 | >900 RPS |
| P3 | 错误率 | 压测 | <0.05% |
| P4 | 数据库查询性能 | 基准测试 | 不超过拆分前 110% |
| P5 | 缓存命中率 | 监控 | >90% |

### 9.3 运维验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| O1 | 监控指标完整 | 检查 Dashboard | 所有关键指标可见 |
| O2 | 告警配置正确 | 告警演练 | 告警准确触发 |
| O3 | 日志收集完整 | 日志查询 | 所有服务日志可见 |
| O4 | 部署脚本可用 | 部署演练 | 一键部署成功 |
| O5 | 回滚方案可用 | 回滚演练 | 10 分钟内回滚 |

---

## 十、附录 (Appendix)

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| **Saga** | 分布式事务模式，通过补偿操作实现最终一致性 |
| **双写** | 同时写入新旧数据源，用于迁移过渡期 |
| **灰度发布** | 逐步将流量从旧服务切换到新服务 |
| **CDC** | Change Data Capture，变更数据捕获 |
| **SLA** | Service Level Agreement，服务等级协议 |
| **RTO** | Recovery Time Objective，恢复时间目标 |
| **RPO** | Recovery Point Objective，恢复点目标 |

### 10.2 参考文档

| 文档 | 链接 |
|------|------|
| 架构重构设计 | `docs/architecture/架构重构设计.md` |
| 服务拆分与数据库划分 | `docs/architecture/服务拆分与数据库划分详解.md` |
| 外部组件集成架构 | `docs/architecture/外部组件集成架构设计.md` |
| 多租户隔离设计 | `docs/architecture/多租户隔离设计.md` |
| 微服务与微前端架构设计 | `docs/architecture/微服务与微前端架构设计.md` |

### 10.3 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |

### 10.4 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
