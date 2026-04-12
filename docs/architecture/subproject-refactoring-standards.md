---
title: "Subproject Refactoring Standards (子项目改造统一规范)"
type: spec
domain: architecture
status: draft
version: "1.0"
created: "2026-04-10"
updated: "2026-04-10"
author: "Orion Architecture Team"
tags: [subproject, refactoring, standards, microservices]
related:
  - "docs/architecture/platform-service-split-implementation.md"
  - "docs/文档管理规范.md"
---

# Subproject Refactoring Standards (子项目改造统一规范)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会

---

## 执行摘要 (Executive Summary)

本规范定义 Orion 平台子项目（Subproject）改造的统一标准，确保可插拔模块、独立服务、集成组件三类子项目遵循一致的命名、结构、配置、文档、许可和交付规范。

当前 Orion 生态存在 30+ 子项目，由于缺乏统一规范，导致项目结构混乱、集成成本高昂、维护难度递增。本规范旨在建立一套完整的子项目治理体系，实现：

- **结构统一**: 所有子项目遵循标准目录布局
- **命名一致**: 项目、包、镜像、容器、环境变量命名有据可依
- **配置规范**: 配置文件格式和关系清晰
- **文档完整**: README 包含必备章节和示例
- **许可合规**: 许可证选择和继承规则明确
- **版本可控**: 语义化版本和发布流程标准化
- **CI/CD 统一**: 构建、测试、发布、部署流水线一致
- **集成顺畅**: API 网关、服务发现、认证集成标准化

---

## 一、子项目分类体系 (Subproject Classification)

### 1.1 分类总览

Orion 子项目按耦合度和部署形态分为三大类，每类对应不同的改造标准和集成模式。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Orion Subproject Classification                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────────┐
                                    │   Orion Platform    │
                                    │      (Host)         │
                                    └──────────┬──────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────────┐
              │                                │                                │
              ▼                                ▼                                ▼
    ┌───────────────────┐          ┌───────────────────┐          ┌───────────────────┐
    │  Type A:          │          │  Type B:          │          │  Type C:          │
    │  Pluggable Module │          │  Independent      │          │  Integrated       │
    │  (可插拔模块)      │          │  Service          │          │  Component        │
    │                   │          │  (独立服务)       │          │  (集成组件)       │
    │  - Low Coupling   │          │  - Medium         │          │  - High Coupling  │
    │  - In-Process     │          │  - Cross-Process  │          │  - Embedded       │
    │  - Dynamic Load   │          │  - Network Call   │          │  - Library/SDK    │
    │  - Same Codebase  │          │  - Independent    │          │  - External Dep   │
    └───────────────────┘          └───────────────────┘          └───────────────────┘
              │                                │                                │
              │    示例：技能引擎、规则引擎     │    示例：通知服务、网关服务     │    示例：Prometheus、
              │    告警处理器、事件处理器       │    审计服务、成本服务           │    Grafana、MinIO
              ▼                                ▼                                ▼
    ┌───────────────────┐          ┌───────────────────┐          ┌───────────────────┐
    │  Integration:     │          │  Integration:     │          │  Integration:     │
    │  Plugin Registry  │          │  API Gateway      │          │  Helm Chart       │
    │  SPI Interface    │          │  Service Registry │          │  Sidecar          │
    │  Hot Reload       │          │  Health Check     │          │  Config Injection │
    └───────────────────┘          └───────────────────┘          └───────────────────┘
```

### 1.2 A 类：可插拔模块 (Pluggable Module)

#### 1.2.1 定义与特征

A 类子项目是 Orion 平台主进程内动态加载的模块，通过 SPI（Service Provider Interface）机制注册和扩展平台能力。

| 特征维度 | 详细说明 |
|---------|---------|
| **耦合度** | 低耦合，通过 SPI 接口与平台通信 |
| **部署形态** | 与平台主服务同进程，动态加载 |
| **生命周期** | 随平台启动/停止，支持热插拔 |
| **通信方式** | 方法调用（In-Process） |
| **数据访问** | 通过平台数据访问层，不直连数据库 |
| **技术栈** | 与平台主服务语言一致（Java/Go/Python） |
| **版本依赖** | 强依赖平台主版本，需兼容 SPI 版本 |

#### 1.2.2 适用场景

| 场景 | 示例 | 选择理由 |
|------|------|---------|
| **业务规则扩展** | 自定义告警规则引擎 | 需要访问平台内部状态，实时触发 |
| **AI 技能扩展** | RAG 检索增强、意图识别 | 需要调用平台 AI 服务，处理上下文 |
| **事件处理器** | 审计事件聚合、指标计算 | 需要消费平台事件总线 |
| **通知渠道** | 钉钉/企微/飞书适配器 | 需要集成平台通知框架 |
| **数据源适配器** | 第三方系统数据同步器 | 需要访问平台数据模型 |

#### 1.2.3 约束条件

| 约束项 | 要求 | 违规处理 |
|-------|------|---------|
| **禁止直接数据库访问** | 必须通过平台 Repository 层 | 代码审查拦截 |
| **禁止阻塞主线程** | 耗时操作必须异步执行 | 运行时检测告警 |
| **禁止修改全局状态** | 不得修改平台全局变量 | 单元测试覆盖 |
| **必须实现健康检查** | 提供`isHealthy()` 方法 | 启动时验证 |
| **必须声明 SPI 版本** | 在 `plugin.yaml` 中声明 | 加载时校验 |

### 1.3 B 类：独立服务 (Independent Service)

#### 1.3.1 定义与特征

B 类子项目是独立部署的微服务，通过网络 API 与 Orion 平台及其他服务通信，遵循微服务架构规范。

| 特征维度 | 详细说明 |
|---------|---------|
| **耦合度** | 中耦合，通过 API 契约与平台通信 |
| **部署形态** | 独立进程，可独立部署和扩展 |
| **生命周期** | 独立于平台，可滚动升级 |
| **通信方式** | REST/gRPC/WebSocket |
| **数据访问** | 独立数据库，数据自治 |
| **技术栈** | 可自由选择（推荐 Go/Java/Node.js） |
| **版本依赖** | 通过 API 版本管理，向后兼容 |

#### 1.3.2 适用场景

| 场景 | 示例 | 选择理由 |
|------|------|---------|
| **高并发服务** | 通知服务、消息推送服务 | 需要独立扩展，承载高流量 |
| **计算密集型** | 成本计算服务、报表生成服务 | 需要独立 CPU/内存资源 |
| **安全边界** | 审计服务、合规检查服务 | 需要独立安全域和访问控制 |
| **外部集成** | API 网关、Webhook 服务 | 需要对外暴露 API |
| **专用技术栈** | AI 推理服务（Python+GPU） | 需要特定运行时环境 |

#### 1.3.3 约束条件

| 约束项 | 要求 | 违规处理 |
|-------|------|---------|
| **必须实现健康检查端点** | `GET /actuator/health` | 服务发现校验 |
| **必须实现指标暴露** | `GET /actuator/metrics` | 监控采集要求 |
| **必须声明 API 版本** | URL 包含`/api/v{version}/` | API 网关校验 |
| **必须支持优雅关闭** | SIGTERM 处理，30s 超时 | 部署脚本验证 |
| **必须有数据库迁移脚本** | Flyway/Liquibase 脚本 | CI 流水线检查 |
| **必须实现熔断降级** | Resilience4j/Sentinel | 架构审查 |

### 1.4 C 类：集成组件 (Integrated Component)

#### 1.4.1 定义与特征

C 类子项目是成熟的第三方开源组件或商业软件，通过 Helm Chart/Sidecar 模式集成到 Orion 生态。

| 特征维度 | 详细说明 |
|---------|---------|
| **耦合度** | 高耦合，作为基础设施依赖 |
| **部署形态** | 独立容器，通常以 StatefulSet 部署 |
| **生命周期** | 独立运维，版本升级周期长 |
| **通信方式** | 标准协议（HTTP/gRPC/TCP） |
| **数据访问** | 组件自有存储，Orion 无权直连 |
| **技术栈** | 固定（由组件本身决定） |
| **版本依赖** | 通过 Helm Chart 版本管理 |

#### 1.4.2 适用场景

| 场景 | 示例 | 选择理由 |
|------|------|---------|
| **数据存储** | PostgreSQL、Redis、MinIO | 成熟的存储解决方案 |
| **消息队列** | NATS JetStream、Kafka、RabbitMQ | 成熟的事件驱动基础设施 |
| **监控系统** | Prometheus、Grafana、Alertmanager | 行业标准监控栈 |
| **日志系统** | Elasticsearch、Loki、Fluentd | 成熟的日志收集和分析 |
| **认证系统** | Keycloak、Auth0、CAS | 专业身份和访问管理 |

#### 1.4.3 约束条件

| 约束项 | 要求 | 违规处理 |
|-------|------|---------|
| **必须使用 Helm Chart 部署** | 禁止手动部署 | GitOps 流水线校验 |
| **必须配置持久化存储** | PV/PVC 配置 | 部署前检查 |
| **必须配置备份策略** | Velero/定时快照 | 运维审计 |
| **必须限制资源配额** | requests/limits 配置 | K8s 策略检查 |
| **必须配置网络策略** | NetworkPolicy 隔离 | 安全审查 |
| **必须集成统一监控** | Prometheus metrics 暴露 | 监控平台接入 |

### 1.5 分类决策流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Subproject Classification Decision Tree                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌───────────────────────┐
                              │  Start: New Subproject │
                              └───────────┬───────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ Q1: 是否需要直连数据库？│
                              └───────────┬───────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │ YES                                        │ NO
                   ▼                                            ▼
        ┌───────────────────────┐                   ┌───────────────────────┐
        │ Q2: 是否为成熟开源/   │                   │ Q2: 是否需要独立扩展？ │
        │ 商业软件集成？         │                   │ (高并发/独立资源)      │
        └───────────┬───────────┘                   └───────────┬───────────┘
                     │                                          │
         ┌───────────┴───────────┐                  ┌───────────┴───────────┐
         │ YES                  │ NO                 │ YES                  │ NO
         ▼                       ▼                    ▼                       ▼
  ┌─────────────┐       ┌─────────────┐      ┌─────────────┐       ┌─────────────┐
  │ Type C      │       │ Q3: 是否需要 │      │ Type B      │       │ Type A      │
  │ 集成组件     │       │ 独立技术栈？  │      │ 独立服务     │       │ 可插拔模块  │
  │             │       └─────────────┘      │             │       │             │
  │ 示例：       │                │ YES      │ 示例：       │       │ 示例：       │
  │ PostgreSQL  │                ▼          │ 通知服务     │       │ 规则引擎     │
  │ Prometheus  │       ┌─────────────┐      │ 审计服务     │       │ 技能插件     │
  │ Grafana     │       │ Type B      │      │             │       │             │
  │             │       │ 独立服务     │      │             │       │             │
  │             │       │             │      │             │       │             │
  └─────────────┘       └─────────────┘      └─────────────┘       └─────────────┘
```

### 1.6 分类对照表

| 维度 | Type A: 可插拔模块 | Type B: 独立服务 | Type C: 集成组件 |
|------|------------------|----------------|----------------|
| **代码仓库** | `orion-modules/` 子目录 | 独立仓库 | 第三方仓库 + Helm Chart |
| **构建产物** | JAR/Python Wheel | Docker 镜像 | Helm Chart |
| **部署单元** | 平台主服务内模块 | Kubernetes Deployment | Kubernetes StatefulSet |
| **扩缩容** | 随平台实例扩展 | HPA 自动扩展 | VPA/手动扩展 |
| **配置管理** | `plugin.yaml` | ConfigMap + `.env` | Helm values.yaml |
| **服务发现** | SPI 注册表 | Consul/Nacos | K8s Service |
| **认证集成** | 平台统一认证 | JWT/OAuth2 | 独立认证或委托平台 |
| **监控指标** | 平台统一采集 | 独立 `/metrics` | Prometheus Exporter |
| **日志收集** | 平台日志文件 | stdout/stderr + ELK | 组件自有日志 + ELK |
| **版本管理** | 随平台版本 | 独立语义化版本 | Helm Chart 版本 |

---

## 二、命名规范 (Naming Conventions)

### 2.1 命名总览

所有子项目命名遵循"小写 + 连字符"（kebab-case）原则，避免特殊字符和大小写混用。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Naming Convention Hierarchy                            │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────────┐
  │  Project Name (项目名)                                                      │
  │  Format: orion-{domain}-{module}                                           │
  │  Example: orion-tenant-service, orion-skill-plugin                         │
  └────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
  ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
  │ Package Name  │           │ Image Name    │           │ Container Name│
  │ (包名)        │           │ (镜像名)      │           │ (容器名)      │
  │               │           │               │           │               │
  │ io.orion.xxx  │           │ orion/xxx:tag │           │ orion-xxx     │
  └───────────────┘           └───────────────┘           └───────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │ Environment Variables │
                          │ (环境变量前缀)         │
                          │                       │
                          │ ORION_XXX_...         │
                          └───────────────────────┘
```

### 2.2 项目名规范 (Project Name)

#### 2.2.1 命名格式

```
格式：orion-{domain}-{module}-{type?}

规则:
├── 前缀固定：orion- (所有 Orion 生态项目必须以此开头)
├── 领域标识：{domain} (2-3 个单词，标识业务域)
├── 模块标识：{module} (1-2 个单词，标识具体模块)
└── 类型后缀：{type}? (可选，service/module/plugin/component)
```

#### 2.2.2 领域标识表

| 领域 | 标识符 | 说明 | 示例 |
|------|-------|------|------|
| 租户管理 | tenant | 多租户、团队、协作 | orion-tenant-service |
| 资源管理 | resource | 产物、二方库、工具 | orion-resource-service |
| 安全合规 | governance | 安全、合规、审计 | orion-governance-service |
| 平台基础 | platform | 认证、权限、标签 | orion-platform-service |
| AI 能力 | ai | LLM、RAG、技能 | orion-ai-service |
| 流水线 | pipeline | CI/CD、构建、部署 | orion-pipeline-service |
| CMDB | cmdb | 配置管理、拓扑 | orion-cmdb-service |
| 成本 | cost | 成本核算、FinOps | orion-cost-service |
| 通知 | notification | 通知、消息、渠道 | orion-notification-service |
| 效能 |效能 | 效能度量、洞察 | orion-efficiency-service |

#### 2.2.3 类型后缀使用指南

| 后缀 | 适用类型 | 示例 | 说明 |
|------|---------|------|------|
| `-service` | B 类：独立服务 | orion-tenant-service | 标准微服务 |
| `-plugin` | A 类：可插拔模块 | orion-skill-plugin | SPI 插件 |
| `-module` | A 类：可插拔模块 | orion-rule-module | 功能模块 |
| `-adapter` | C 类：集成组件 | orion-prometheus-adapter | 适配器/包装器 |
| `-sdk` | C 类：集成组件 | orion-kubernetes-sdk | SDK/客户端库 |
| (无后缀) | 核心平台 | orion-platform | 平台主体 |

#### 2.2.4 命名示例

| 项目名称 | 结构分析 | 合规性 |
|---------|---------|-------|
| `orion-tenant-service` | orion + tenant + service | ✅ 合规 |
| `orion-ai-skill-plugin` | orion + ai + skill + plugin | ✅ 合规 |
| `orion-resource-service` | orion + resource + service | ✅ 合规 |
| `tenant-service` | 缺少 orion 前缀 | ❌ 不合规 |
| `orion_TenantService` | 包含大写和下划线 | ❌ 不合规 |
| `orion-service-tenant` | 领域标识位置错误 | ❌ 不合规 |

### 2.3 包名规范 (Package Name)

#### 2.3.1 Java/Kotlin 包名

```
格式：io.orion.{domain}.{module}

示例:
├── io.orion.tenant.service      — 租户服务主包
├── io.orion.tenant.repository   — 数据访问层
├── io.orion.tenant.api          — REST API 层
├── io.orion.tenant.model        — 数据模型
├── io.orion.tenant.config       — 配置类
└── io.orion.tenant.util         — 工具类
```

#### 2.3.2 Python 包名

```
格式：orion_{domain}_{module}

示例:
├── orion_tenant_service         — 租户服务主包
├── orion_tenant_service.api     — REST API 层
├── orion_tenant_service.models  — 数据模型
├── orion_tenant_service.config  — 配置类
└── orion_tenant_service.utils   — 工具类
```

#### 2.3.3 Go 模块名

```
格式：github.com/orion-platform/{domain}/{module}

示例:
├── github.com/orion-platform/tenant/service
├── github.com/orion-platform/tenant/api
├── github.com/orion-platform/tenant/model
└── github.com/orion-platform/tenant/config
```

### 2.4 镜像名规范 (Image Name)

#### 2.4.1 命名格式

```
格式：{registry}/orion/{project-name}:{tag}

规则:
├── Registry: 默认 orion-registry.internal (内部)
├── 命名空间：orion (固定)
├── 镜像名：与项目名一致
└── Tag: 语义化版本 + 构建号
```

#### 2.4.2 Tag 命名规则

```
Tag 格式：{version}-{build}

版本类型:
├── {major}.{minor}.{patch}     — 稳定版 (示例：1.2.3)
├── {version}-rc.{n}            — 候选版 (示例：1.2.3-rc.1)
├── {version}-beta.{n}          — 测试版 (示例：1.2.3-beta.2)
├── {version}-alpha.{n}         — 开发版 (示例：1.2.3-alpha.1)
├── {version}-{git-sha}         — 开发构建 (示例：1.2.3-a1b2c3d)
└── latest                      — 最新稳定版 (仅限内部使用)

示例:
├── orion-registry.internal/orion/orion-tenant-service:1.2.3
├── orion-registry.internal/orion/orion-tenant-service:1.2.3-rc.1
├── orion-registry.internal/orion/orion-tenant-service:1.2.3-a1b2c3d
└── orion-registry.internal/orion/orion-tenant-service:latest
```

### 2.5 容器名规范 (Container Name)

#### 2.5.1 Kubernetes 资源命名

```yaml
# Deployment 命名
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-tenant-service        # 与项目名一致
  namespace: orion-platform

# Pod 模板命名 (由 Deployment 管理)
spec:
  template:
    metadata:
      labels:
        app: orion-tenant-service   # 标签与项目名一致

# Service 命名
apiVersion: v1
kind: Service
metadata:
  name: orion-tenant-service-svc    # 后缀 -svc 避免冲突
```

#### 2.5.2 Docker Compose 命名

```yaml
# docker-compose.yaml
services:
  orion-tenant-service:    # 服务名与项目名一致
    image: orion/orion-tenant-service:1.2.3
    container_name: orion-tenant-service-1  # 容器实例名：{project}-{instance}
```

### 2.6 环境变量前缀规范 (Environment Variable Prefix)

#### 2.6.1 前缀规则

```
格式：ORION_{DOMAIN}_

规则:
├── 统一前缀：ORION_ (大写 + 下划线)
├── 领域标识：{DOMAIN} (大写，与项目名领域对应)
├── 分隔符：下划线 _
└── 变量名：大写 + 下划线
```

#### 2.6.2 环境变量分类

| 类别 | 前缀 | 示例 | 说明 |
|------|------|------|------|
| **服务配置** | `ORION_{DOMAIN}_` | `ORION_TENANT_PORT=8080` | 服务特有配置 |
| **数据库** | `ORION_DB_` | `ORION_DB_HOST=localhost` | 所有服务共享 |
| **消息队列** | `ORION_MQ_` | `ORION_MQ_HOST=nats://localhost:4222` | 所有服务共享 |
| **认证** | `ORION_AUTH_` | `ORION_AUTH_JWT_SECRET=xxx` | 所有服务共享 |
| **日志** | `ORION_LOG_` | `ORION_LOG_LEVEL=INFO` | 所有服务共享 |
| **监控** | `ORION_METRICS_` | `ORION_METRICS_ENABLED=true` | 所有服务共享 |

#### 2.6.3 环境变量示例

```bash
# orion-tenant-service 环境变量示例

# 服务配置
ORION_TENANT_PORT=8083
ORION_TENANT_NAME=orion-tenant-service
ORION_TENANT_ENV=production

# 数据库配置 (共享前缀)
ORION_DB_HOST=postgres.orion.svc
ORION_DB_PORT=5432
ORION_DB_NAME=orion_tenant
ORION_DB_USER=tenant_user
ORION_DB_PASSWORD=${DB_PASSWORD_SECRET}

# 认证配置 (共享前缀)
ORION_AUTH_ENDPOINT=http://orion-platform-service:8081
ORION_AUTH_JWT_ISSUER=orion-platform

# 日志配置 (共享前缀)
ORION_LOG_LEVEL=INFO
ORION_LOG_FORMAT=json
ORION_LOG_OUTPUT=stdout

# 监控配置 (共享前缀)
ORION_METRICS_ENABLED=true
ORION_METRICS_PORT=9090
ORION_METRICS_PATH=/actuator/metrics
```

### 2.7 命名冲突避免

| 场景 | 避免策略 | 示例 |
|------|---------|------|
| **项目名冲突** | 全局仓库 `orion-projects` 登记 | 禁止重复命名 |
| **端口冲突** | 端口注册表，按服务类型分配 | B 类服务 8080-8999 |
| **数据库名冲突** | 数据库名 = `orion_{domain}` | orion_tenant, orion_resource |
| **环境变量冲突** | 强制使用领域前缀 | ORION_TENANT_*, ORION_RESOURCE_* |
| **API 路径冲突** | URL 包含领域标识 | `/api/v1/tenants/...` |

---

## 三、目录结构规范 (Directory Structure)

### 3.1 标准目录结构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Standard Subproject Directory Structure                  │
└─────────────────────────────────────────────────────────────────────────────────┘

{project-root}/
│
├── backend/                    # 后端代码 (B 类服务必需，A 类在 modules/)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/          # Java 源代码 (Go/Python 对应调整)
│   │   │   ├── resources/     # 资源文件
│   │   │   └── kotlin/        # Kotlin 源代码 (可选)
│   │   └── test/              # 测试代码
│   ├── build.gradle           # 构建配置 (或 pom.xml, go.mod, requirements.txt)
│   └── Dockerfile             # Docker 构建文件
│
├── frontend/                   # 前端代码 (可选，有 UI 时必需)
│   ├── src/
│   │   ├── components/        # 可复用组件
│   │   ├── pages/             # 页面
│   │   ├── styles/            # 样式文件
│   │   └── utils/             # 工具函数
│   ├── public/                # 静态资源
│   ├── package.json           # 依赖配置
│   └── vite.config.ts         # 构建配置
│
├── deploy/                     # 部署配置 (必需)
│   ├── kubernetes/            # K8s 资源
│   │   ├── base/              # Kustomize base
│   │   ├── overlays/          # Kustomize overlays
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   ├── deployment.yaml    # Deployment 定义
│   │   ├── service.yaml       # Service 定义
│   │   ├── configmap.yaml     # ConfigMap 定义
│   │   └── ingress.yaml       # Ingress 定义
│   ├── helm/                  # Helm Chart (可选)
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   ├── docker-compose/        # Docker Compose (本地开发)
│   │   └── docker-compose.yaml
│   └── scripts/               # 部署脚本
│       ├── deploy.sh
│       └── rollback.sh
│
├── docs/                       # 文档 (必需)
│   ├── README.md              # 项目说明 (指向根目录 README)
│   ├── architecture.md        # 架构设计
│   ├── api.md                 # API 文档
│   ├── deployment.md          # 部署指南
│   └── changelog.md           # 变更日志
│
├── scripts/                    # 辅助脚本 (必需)
│   ├── build.sh               # 构建脚本
│   ├── test.sh                # 测试脚本
│   ├── lint.sh                # 代码检查脚本
│   └── dev.sh                 # 本地开发启动脚本
│
├── tests/                      # 集成测试 (必需)
│   ├── e2e/                   # 端到端测试
│   ├── integration/           # 集成测试
│   └── fixtures/              # 测试数据
│
├── modules/                    # A 类模块特有 (仅 A 类项目)
│   ├── plugin.yaml            # 插件描述文件
│   └── src/                   # 模块源代码
│
├── .github/                    # GitHub Actions (必需)
│   └── workflows/
│       ├── ci.yaml            # CI 流水线
│       └── cd.yaml            # CD 流水线
│
├── .env.example                # 环境变量示例 (必需)
├── .gitignore                  # Git 忽略规则 (必需)
├── .dockerignore               # Docker 忽略规则 (必需)
├── LICENSE                     # 许可证 (必需)
├── CHANGELOG.md                # 变更日志 (必需)
└── README.md                   # 项目说明 (必需)
```

### 3.2 各类项目目录差异

#### 3.2.1 A 类：可插拔模块目录结构

```
orion-skill-plugin/
├── modules/                    # 模块源码 (核心目录)
│   ├── plugin.yaml            # 插件元数据 (必需)
│   └── src/
│       ├── main/
│       │   └── java/io/orion/skill/
│       │       ├── SkillPlugin.java
│       │       ├── SkillRegistry.java
│       │       └── handler/
│       └── test/
│
├── docs/                       # 文档
│   ├── README.md
│   └── api.md
│
├── scripts/                    # 辅助脚本
│   ├── build.sh
│   └── test.sh
│
├── .github/
│   └── workflows/ci.yaml
│
├── .env.example
├── LICENSE
└── README.md
```

**A 类项目特殊要求:**
- 必须包含 `modules/plugin.yaml`
- 不包含 `backend/` 目录 (代码在 `modules/src/`)
- 不包含 `deploy/` 目录 (随平台部署)

#### 3.2.2 B 类：独立服务目录结构

```
orion-tenant-service/
├── backend/                    # 后端源码 (核心目录)
│   ├── src/main/java/io/orion/tenant/
│   │   ├── TenantServiceApplication.java
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── model/
│   │   └── config/
│   ├── src/test/
│   ├── build.gradle
│   └── Dockerfile
│
├── frontend/                   # 前端源码 (可选)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── deploy/                     # 部署配置 (核心目录)
│   ├── kubernetes/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── docker-compose/
│       └── docker-compose.yaml
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── deployment.md
│
├── tests/
│   ├── e2e/
│   └── integration/
│
├── scripts/
│   ├── build.sh
│   ├── test.sh
│   └── deploy.sh
│
├── .github/workflows/
├── .env.example
├── LICENSE
├── CHANGELOG.md
└── README.md
```

**B 类项目特殊要求:**
- 必须包含 `backend/` 目录
- 必须包含 `deploy/` 目录
- 必须包含 `Dockerfile`

#### 3.2.3 C 类：集成组件目录结构

```
orion-prometheus-integration/
├── deploy/                     # 部署配置 (核心目录)
│   ├── helm/
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   ├── kubernetes/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   └── scripts/
│       └── install.sh
│
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   └── troubleshooting.md
│
├── scripts/
│   ├── validate.sh            # 配置验证脚本
│   └── backup.sh              # 备份脚本
│
├── .github/workflows/
├── LICENSE
└── README.md
```

**C 类项目特殊要求:**
- 不包含 `backend/` 目录 (第三方代码)
- 必须包含 `deploy/helm/` 目录
- 必须包含配置验证脚本

### 3.3 目录命名规则

| 目录类型 | 命名规则 | 示例 |
|---------|---------|------|
| **一级目录** | 小写 + 连字符 | `backend/`, `frontend/`, `deploy/` |
| **源码目录** | 小写 + 连字符 | `src/`, `modules/`, `tests/` |
| **配置目录** | 小写 + 连字符 | `config/`, `scripts/`, `docs/` |
| **测试目录** | 小写 + 连字符 | `e2e/`, `integration/`, `fixtures/` |
| **K8s 目录** | 小写 + 连字符 | `kubernetes/`, `overlays/`, `templates/` |

### 3.4 文件命名规则

| 文件类型 | 命名规则 | 示例 |
|---------|---------|------|
| **源代码** | 大驼峰 (Java/Go) / 小写 + 下划线 (Python) | `TenantService.java`, `tenant_service.py` |
| **配置文件** | 小写 + 连字符 | `application.yaml`, `docker-compose.yaml` |
| **文档** | 小写 + 连字符 | `architecture.md`, `deployment.md` |
| **脚本** | 小写 + 连字符 | `build.sh`, `deploy.sh` |
| **测试** | `{被测试类}Test` 或 `test_{被测试模块}` | `TenantServiceTest.java`, `test_tenant_service.py` |

### 3.5 目录深度限制

```
规则:
├── 源码目录深度：≤ 5 层
│   示例：src/main/java/io/orion/tenant/service/ (5 层) ✅
│   示例：src/main/java/io/orion/tenant/service/impl/v2/factory/ (7 层) ❌
│
├── 配置目录深度：≤ 3 层
│   示例：deploy/kubernetes/overlays/dev/ (4 层) ❌
│
└── 测试目录深度：≤ 4 层
    示例：tests/integration/tenant/api/ (4 层) ✅
```

### 3.6 目录清理规则

以下目录和文件禁止出现在子项目中:

| 禁止项 | 说明 | 清理方式 |
|-------|------|---------|
| `node_modules/` | NPM 依赖 | 加入 `.gitignore` |
| `__pycache__/` | Python 缓存 | 加入 `.gitignore` |
| `*.class` | Java 编译产物 | 加入 `.gitignore` |
| `target/`, `build/`, `dist/` | 构建输出 | 加入 `.gitignore` |
| `.DS_Store`, `Thumbs.db` | 系统文件 | 加入 `.gitignore` |
| `*.log` | 日志文件 | 加入 `.gitignore` |
| `.env` | 敏感配置 | 加入 `.gitignore`, 使用 `.env.example` |
| `*.key`, `*.pem`, `*.crt` | 证书密钥 | 使用 Secret 管理 |

---

## 四、配置文件规范 (Configuration Files)

### 4.1 配置文件总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Configuration File Relationship Diagram                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Development Phase (开发阶段)                                                    │
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐               │
│  │ .env.example│  ──────▶│   .env      │  ──────▶│  IDE/Shell  │               │
│  │ (模板/提交) │  复制    │ (本地/忽略) │  加载     │  (运行时)   │               │
│  └─────────────┘         └─────────────┘         └─────────────┘               │
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐               │
│  │docker-compose│ ──────▶│   .env      │  ──────▶│  Containers │               │
│  │  .yaml      │  引用    │ (本地/忽略) │  注入     │  (运行时)   │               │
│  └─────────────┘         └─────────────┘         └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Deployment Phase (部署阶段)                                                     │
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐               │
│  │  Helm       │  ──────▶│  ConfigMap  │  ──────▶│     Pods    │               │
│  │ values.yaml │  渲染    │  (K8s)      │  挂载     │  (运行时)   │               │
│  └─────────────┘         └─────────────┘         └─────────────┘               │
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐               │
│  │  Kustomize  │  ──────▶│  ConfigMap  │  ──────▶│     Pods    │               │
│  │ overlays/   │  构建    │  (K8s)      │  挂载     │  (运行时)   │               │
│  └─────────────┘         └─────────────┘         └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Plugin Phase (插件加载 - 仅 A 类)                                                │
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐               │
│  │ plugin.yaml │  ──────▶│    SPI      │  ──────▶│   Platform  │               │
│  │ (插件元数据)│  解析    │  Registry   │  注册     │   Loader    │               │
│  └─────────────┘         └─────────────┘         └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 docker-compose.yaml 规范

#### 4.2.1 标准模板

```yaml
# deploy/docker-compose/docker-compose.yaml
version: '3.8'

# 命名空间：orion-{domain}
name: orion-tenant

services:
  # 主服务
  orion-tenant-service:
    image: orion-registry.internal/orion/orion-tenant-service:${VERSION:-latest}
    container_name: orion-tenant-service-${INSTANCE:-1}
    restart: unless-stopped

    # 端口映射：主机端口 : 容器端口
    ports:
      - "${SERVICE_PORT:-8083}:8080"

    # 环境变量：从 .env 文件加载
    env_file:
      - ../../.env
    environment:
      - ORION_TENANT_PORT=8080
      - ORION_TENANT_NAME=orion-tenant-service
      - ORION_DB_HOST=postgres
      - ORION_MQ_HOST=nats

    # 依赖服务
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy

    # 健康检查
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

    # 网络
    networks:
      - orion-platform

    # 日志
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # 依赖：PostgreSQL
  postgres:
    image: postgres:15-alpine
    container_name: orion-tenant-postgres
    restart: unless-stopped

    environment:
      - POSTGRES_DB=orion_tenant
      - POSTGRES_USER=tenant_user
      - POSTGRES_PASSWORD=${DB_PASSWORD:-tenant_password}

    volumes:
      - tenant-postgres-data:/var/lib/postgresql/data

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tenant_user -d orion_tenant"]
      interval: 10s
      timeout: 5s
      retries: 5

    networks:
      - orion-platform

  # 依赖：NATS
  nats:
    image: nats:2.9-alpine
    container_name: orion-tenant-nats
    restart: unless-stopped

    command: "-js"

    networks:
      - orion-platform

# 持久化卷
volumes:
  tenant-postgres-data:
    driver: local

# 网络
networks:
  orion-platform:
    driver: bridge
```

#### 4.2.2 配置规则

| 配置项 | 规则 | 示例 |
|-------|------|------|
| **name** | `orion-{domain}` | `orion-tenant` |
| **image** | 使用内部镜像仓库 | `orion-registry.internal/orion/...` |
| **ports** | 使用环境变量 | `${SERVICE_PORT:-8083}` |
| **env_file** | 引用上级 `.env` | `- ../../.env` |
| **depends_on** | 定义健康检查条件 | `condition: service_healthy` |
| **healthcheck** | 必须配置 | `test`, `interval`, `timeout` |
| **deploy.resources** | 必须配置限制 | `cpus`, `memory` |
| **logging** | 配置日志轮转 | `max-size: "10m"` |

### 4.3 .env.example 规范

#### 4.3.1 标准模板

```bash
# .env.example
# Orion Subproject Environment Configuration Template
# Copy to .env and fill in actual values

# =============================================================================
# Project Configuration
# =============================================================================

# Project version (semantic versioning)
VERSION=1.0.0

# Instance number (for scaling)
INSTANCE=1

# Environment (dev/staging/production)
ENVIRONMENT=dev

# =============================================================================
# Service Configuration
# =============================================================================

# Service port
SERVICE_PORT=8083

# Log level (DEBUG/INFO/WARN/ERROR)
LOG_LEVEL=INFO

# =============================================================================
# Database Configuration
# =============================================================================

# PostgreSQL connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=orion_tenant
DB_USER=tenant_user
DB_PASSWORD=change_me_in_production

# Connection pool
DB_POOL_MIN=5
DB_POOL_MAX=20

# =============================================================================
# Message Queue Configuration
# =============================================================================

# NATS connection
MQ_HOST=nats://localhost:4222
MQ_CLUSTER=nats-cluster

# =============================================================================
# Authentication Configuration
# =============================================================================

# Platform auth endpoint
AUTH_ENDPOINT=http://localhost:8081

# JWT configuration
JWT_ISSUER=orion-platform
JWT_SECRET=change_me_in_production

# =============================================================================
# Monitoring Configuration
# =============================================================================

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090

# Tracing
TRACING_ENABLED=false
TRACING_ENDPOINT=http://localhost:4317

# =============================================================================
# Feature Flags
# =============================================================================

# Enable/disable features
FEATURE_NOTIFICATION_V2=false
FEATURE_CACHE_V2=true
```

#### 4.3.2 配置规则

| 规则 | 说明 | 示例 |
|------|------|------|
| **必须提交** | `.env.example` 必须提交到 Git | ✅ |
| **禁止提交** | `.env` 必须加入 `.gitignore` | ✅ |
| **敏感值** | 使用占位符 | `DB_PASSWORD=change_me_in_production` |
| **注释** | 每个配置项必须有注释 | `# Service port` |
| **分组** | 使用注释分隔配置组 | `# Database Configuration` |
| **默认值** | 提供合理的开发默认值 | `ENVIRONMENT=dev` |

### 4.4 plugin.yaml 规范 (A 类项目)

#### 4.4.1 标准模板

```yaml
# modules/plugin.yaml
# Orion Plugin Manifest

# 插件元数据
apiVersion: plugin.orion.io/v1
kind: Plugin

metadata:
  # 插件唯一标识 (与项目名一致)
  name: orion-skill-plugin
  # 显示名称
  displayName: Orion Skill Plugin
  # 插件版本 (语义化版本)
  version: 1.0.0
  # 描述
  description: AI Skill extension plugin for Orion platform
  # 作者
  author: Orion Team
  # 许可证
  license: AGPL-3.0

# SPI 配置
spec:
  # 兼容的 SPI 版本
  spiVersion: v1.2.0
  # 兼容的平台版本
  platformVersion: ">=2.0.0 <3.0.0"

  # 插件类型
  type: skill-extension

  # 入口类 (Java 全限定名)
  entryPoint: io.orion.skill.SkillPlugin

  # 提供的扩展点
  provides:
    - extensionPoint: orion.ai.skill
      implementation: io.orion.skill.handler.CustomSkillHandler
      priority: 100

  # 依赖的其他插件
  requires:
    - name: orion-ai-plugin
      version: ">=1.0.0"

  # 需要的权限
  permissions:
    - ai:skill:invoke
    - ai:context:read

  # 配置项定义
  config:
    - name: MAX_CONTEXT_LENGTH
      type: integer
      default: 4096
      description: Maximum context length for skill processing
      required: false

    - name: ENABLE_CACHE
      type: boolean
      default: true
      description: Enable skill result caching
      required: false

  # 健康检查配置
  healthCheck:
    endpoint: /health
    interval: 30s
    timeout: 10s

  # 生命周期钩子
  lifecycle:
    onEnable: io.orion.skill.SkillPlugin::onEnable
    onDisable: io.orion.skill.SkillPlugin::onDisable
```

#### 4.4.2 配置规则

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `apiVersion` | ✅ | SPI API 版本 | `plugin.orion.io/v1` |
| `kind` | ✅ | 资源类型 | `Plugin` |
| `metadata.name` | ✅ | 插件标识 | `orion-skill-plugin` |
| `metadata.version` | ✅ | 插件版本 | `1.0.0` |
| `spec.spiVersion` | ✅ | 兼容 SPI 版本 | `v1.2.0` |
| `spec.entryPoint` | ✅ | 入口类 | `io.orion.skill.SkillPlugin` |
| `spec.provides` | ✅ | 扩展点实现 | `orion.ai.skill` |
| `spec.permissions` | ✅ | 权限声明 | `ai:skill:invoke` |

---

## 五、README 规范 (README Standards)

### 5.1 README 结构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              README Structure                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. Header (页眉)                                                                │
│     ├── Project Name & Logo                                                    │
│     ├── Badge Bar (版本、构建、覆盖率、许可证)                                   │
│     └── One-line Description                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  2. Quick Start (快速启动)                                                       │
│     ├── Prerequisites (前置条件)                                                │
│     ├── Installation (安装)                                                    │
│     └── First Run (首次运行)                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  3. Overview (项目概述)                                                          │
│     ├── Features (特性列表)                                                    │
│     ├── Architecture (架构图)                                                   │
│     └── Use Cases (使用场景)                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  4. Project Structure (项目结构)                                                 │
│     └── Directory Tree (目录树)                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  5. Configuration (配置说明)                                                     │
│     ├── Environment Variables (环境变量)                                        │
│     └── Configuration Files (配置文件)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  6. Development (开发指南)                                                       │
│     ├── Local Development (本地开发)                                            │
│     ├── Build & Test (构建测试)                                                 │
│     └── Code Style (代码风格)                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  7. Deployment (部署指南)                                                        │
│     ├── Docker Compose (本地部署)                                               │
│     ├── Kubernetes (生产部署)                                                   │
│     └── Helm (Helm 部署)                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  8. API Reference (API 参考)                                                     │
│     └── API Documentation Link (API 文档链接)                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  9. Contributing (贡献指南)                                                      │
│     ├── How to Contribute (如何贡献)                                            │
│     └── Pull Request Process (PR 流程)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  10. License (许可证)                                                            │
│     └── License Type & Link (许可证类型和链接)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 README 模板

```markdown
# {Project Name}

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/orion-platform/{project}/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/orion-platform/{project}/ci.yaml)](https://github.com/orion-platform/{project}/actions)
[![Coverage](https://img.shields.io/codecov/c/github/orion-platform/{project})]
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE)

{一句话项目描述}

---

## Quick Start

### Prerequisites

- Docker 24+
- Docker Compose 2.20+
- (可选) Kubernetes 1.28+

### Installation

```bash
# 克隆项目
git clone https://github.com/orion-platform/{project}.git
cd {project}

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改配置

# 启动服务
docker-compose up -d
```

### First Run

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 访问服务
curl http://localhost:{port}/actuator/health
```

---

## Overview

### Features

- ✨ **Feature 1**: {描述}
- ✨ **Feature 2**: {描述}
- ✨ **Feature 3**: {描述}

### Architecture

```
{ASCII 架构图}
```

### Use Cases

| Use Case | Description |
|----------|-------------|
| {场景 1} | {描述} |
| {场景 2} | {描述} |

---

## Project Structure

```
{project}/
├── backend/           # 后端代码
├── frontend/          # 前端代码 (可选)
├── deploy/            # 部署配置
├── docs/              # 文档
├── scripts/           # 辅助脚本
├── tests/             # 测试
└── README.md          # 本文件
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERSION` | `1.0.0` | 服务版本 |
| `SERVICE_PORT` | `8080` | 服务端口 |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PASSWORD` | - | 数据库密码 |

### Configuration Files

| File | Description |
|------|-------------|
| `.env` | 环境变量配置 |
| `deploy/docker-compose/docker-compose.yaml` | Docker Compose 配置 |
| `deploy/kubernetes/deployment.yaml` | Kubernetes 配置 |

---

## Development

### Local Development

```bash
# 安装依赖
./scripts/build.sh

# 运行测试
./scripts/test.sh

# 本地启动
./scripts/dev.sh
```

### Build & Test

```bash
# 构建
docker build -t orion/{project}:dev .

# 单元测试
docker run --rm orion/{project}:dev npm test

# 集成测试
docker-compose -f docker-compose.test.yaml up
```

### Code Style

- Java: Google Java Style
- Python: PEP 8
- JavaScript: ESLint + Prettier

---

## Deployment

### Docker Compose

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 查看状态
docker-compose ps
```

### Kubernetes

```bash
# 应用配置
kubectl apply -f deploy/kubernetes/

# 查看状态
kubectl get pods -l app={project}

# 查看日志
kubectl logs -f deployment/{project}
```

### Helm

```bash
# 安装
helm install {project} ./deploy/helm -f values.yaml

# 升级
helm upgrade {project} ./deploy/helm -f values.yaml

# 卸载
helm uninstall {project}
```

---

## API Reference

API 文档：[Swagger UI](http://localhost:{port}/swagger-ui.html)

详细 API 文档：[docs/api.md](docs/api.md)

---

## Contributing

### How to Contribute

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### Pull Request Process

- 确保所有测试通过
- 更新文档
- 添加变更日志
- 等待代码审查

---

## License

本项目采用 {License Name} 许可证。详见 [LICENSE](LICENSE) 文件。

---

**维护团队**: Orion Platform Team  
**联系邮箱**: orion-team@example.com  
**文档版本**: v1.0
```

### 5.3 README 检查清单

| 章节 | 必选 | 检查项 |
|------|------|--------|
| Header | ✅ | 徽章齐全 (版本、构建、许可证) |
| Quick Start | ✅ | 前置条件、安装、首次运行 |
| Overview | ✅ | 特性、架构图、使用场景 |
| Project Structure | ✅ | 目录树 |
| Configuration | ✅ | 环境变量表、配置文件 |
| Development | ✅ | 本地开发、构建测试、代码风格 |
| Deployment | ✅ | Docker Compose、Kubernetes、Helm |
| API Reference | ✅ | API 文档链接 |
| Contributing | ✅ | 贡献流程、PR 要求 |
| License | ✅ | 许可证类型、链接 |

---

## 六、许可证规范 (License Standards)

### 6.1 许可证选择规则

| 项目类型 | 推荐许可证 | 备选许可证 | 说明 |
|---------|-----------|-----------|------|
| **A 类：可插拔模块** | AGPL-3.0 | Apache-2.0 | 与平台主体保持一致 |
| **B 类：独立服务** | AGPL-3.0 | Apache-2.0 | 核心服务用 AGPL，可选服务可用 Apache |
| **C 类：集成组件** | 继承上游 | - | 保持原项目许可证 |
| **前端 UI** | AGPL-3.0 | MIT | 与后端一致或更宽松 |
| **SDK/客户端库** | Apache-2.0 | MIT | 鼓励广泛使用 |
| **文档** | CC-BY-4.0 | CC0-1.0 | 知识共享许可 |

### 6.2 许可证继承规则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        License Inheritance Rules                                │
└─────────────────────────────────────────────────────────────────────────────────┘

Orion Platform (AGPL-3.0)
        │
        ├── Core Services (必须 AGPL-3.0)
        │   ├── orion-platform-service
        │   ├── orion-tenant-service
        │   ├── orion-resource-service
        │   └── orion-governance-service
        │
        ├── Optional Services (可选 Apache-2.0)
        │   ├── orion-notification-service
        │   ├── orion-cost-service
        │   └── orion-efficiency-service
        │
        ├── Plugins (继承平台或 Apache-2.0)
        │   ├── orion-skill-plugin (AGPL-3.0)
        │   └── orion-rule-plugin (AGPL-3.0)
        │
        └── Integrated Components (继承上游)
            ├── orion-prometheus-integration (Apache-2.0)
            ├── orion-grafana-integration (AGPL-3.0)
            └── orion-minio-integration (Apache-2.0)
```

### 6.3 许可证文件模板

```
# LICENSE

## Orion Subproject License

{Project Name} is part of the Orion Platform.

### License Type: {AGPL-3.0 | Apache-2.0}

{完整许可证文本}

### Additional Terms

This project is distributed under the {License} license with the following additional terms:

1. **Attribution**: Redistributions must retain the original copyright notice.
2. **Patent Grant**: Contributors grant a perpetual patent license to users.
3. **Trademarks**: The "Orion" name and logo are trademarks of Orion Team.

### Third-Party Dependencies

This project includes third-party libraries with their own licenses:

| Library | License |
|---------|---------|
| {Library 1} | {License 1} |
| {Library 2} | {License 2} |

See NOTICE file for complete third-party attributions.
```

### 6.4 LICENSE 文件放置

| 位置 | 要求 | 说明 |
|------|------|------|
| 项目根目录 | 必需 | `LICENSE` 或 `LICENSE.md` |
| 源码文件头 | 推荐 | 添加简短版权声明 |
| 第三方依赖 | 必需 | 保留原始 LICENSE 文件 |

### 6.5 源码文件头模板

```java
/*
 * Copyright 2026 Orion Platform. All rights reserved.
 *
 * Licensed under the {AGPL-3.0 | Apache-2.0} License.
 * See LICENSE file for full license text.
 */
```

```python
# Copyright 2026 Orion Platform. All rights reserved.
#
# Licensed under the {AGPL-3.0 | Apache-2.0} License.
# See LICENSE file for full license text.
```

---

## 七、版本管理规范 (Version Management)

### 7.1 语义化版本 (Semantic Versioning)

所有子项目遵循语义化版本规范 (SemVer 2.0.0):

```
格式：MAJOR.MINOR.PATCH

规则:
├── MAJOR (主版本号): 不兼容的 API 变更
├── MINOR (次版本号): 向后兼容的功能性新增
└── PATCH (修订号): 向后兼容的问题修正

示例:
├── 1.0.0     — 初始稳定版本
├── 1.0.1     — 问题修正
├── 1.1.0     — 新增功能
├── 2.0.0     — 不兼容变更
├── 2.0.1-rc.1 — 候选版本
└── 2.0.1-beta.1 — 测试版本
```

### 7.2 版本号递增规则

| 变更类型 | 版本递增 | 示例 |
|---------|---------|------|
| **Bug 修复** | PATCH++ | 1.0.0 → 1.0.1 |
| **新功能 (向后兼容)** | MINOR++, PATCH=0 | 1.0.0 → 1.1.0 |
| **破坏性变更** | MAJOR++, MINOR=0, PATCH=0 | 1.0.0 → 2.0.0 |
| **预发布版本** | 添加后缀 | 1.0.0-alpha.1, 1.0.0-rc.1 |

### 7.3 版本演进流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Version Evolution Flow                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

  Development Phase                    Release Phase                    Stable Phase
  ─────────────────                    ─────────────                    ────────────

  ┌─────────┐
  │ 0.1.0   │  Initial development
  └────┬────┘
       │
       ▼
  ┌─────────┐
  │ 0.2.0   │  Feature iteration
  └────┬────┘
       │
       ▼
  ┌─────────┐
  │ 0.9.0   │  Feature complete
  └────┬────┘
       │
       ▼
  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
  │ 1.0.0-  │─────▶│ 1.0.0-  │─────▶│ 1.0.0-  │─────▶│ 1.0.0   │
  │ alpha.1 │      │ rc.1    │      │ rc.2    │      │         │
  └─────────┘      └─────────┘      └─────────┘      └────┬────┘
                                                          │
                    ┌─────────────────────────────────────┤
                    │                                     │
                    ▼                                     ▼
              ┌─────────┐                           ┌─────────┐
              │ 1.0.1   │  Bug fixes                 │ 1.1.0   │  New features
              └────┬────┘                           └────┬────┘
                   │                                     │
                   ▼                                     ▼
              ┌─────────┐                           ┌─────────┐
              │ 1.1.0-  │  Next minor cycle          │ 2.0.0   │  Breaking changes
              │ alpha.1 │                           └─────────┘
              └─────────┘

  Legend:
  ├── 实线箭头：标准版本演进路径
  ├── 分支箭头：并行维护多个版本
  └── 虚线框：预发布版本 (alpha/beta/rc)
```

### 7.4 发布流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Release Process                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  Step 1: Release Planning              Step 2: Code Freeze
  ─────────────────────                  ─────────────────
  ┌─────────────────────┐               ┌─────────────────────┐
  │ - 确定版本号         │               │ - 创建 release 分支   │
  │ - 审查变更日志       │               │ - 停止新功能合并     │
  │ - 确认测试覆盖       │               │ - 只接受 bug 修复     │
  └─────────────────────┘               └─────────────────────┘
              │                                     │
              ▼                                     ▼
  Step 4: Publish                  Step 3: Release Testing
  ──────────────────                  ─────────────────────
  ┌─────────────────────┐               ┌─────────────────────┐
  │ - 推送 Git Tag       │               │ - 全量回归测试      │
  │ - 发布 GitHub        │               │ - 性能基准测试      │
  │   Release           │               │ - 文档审查          │
  │ - 推送镜像         │               │ - 签署发布说明      │
  └─────────────────────┘               └─────────────────────┘
              │                                     │
              ▲                                     │
              └─────────────────────────────────────┘
                                    │
                                    ▼
                          Step 5: Post-Release
                          ────────────────────
                          ┌─────────────────────┐
                          │ - 监控错误率         │
                          │ - 收集用户反馈       │
                          │ - 准备补丁版本       │
                          └─────────────────────┘
```

### 7.5 变更日志规范

#### 7.5.1 CHANGELOG.md 格式

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature description

### Changed
- Changed feature description

## [1.0.0] - 2026-04-10

### Added
- Initial release
- Feature A implementation
- Feature B integration

### Changed
- Updated dependency X to v2.0
- Improved performance of module Y

### Deprecated
- Legacy API v1 (will be removed in v2.0)

### Removed
- Obsolete feature Z

### Fixed
- Bug fix description (#123)
- Security vulnerability patch

### Security
- Added input validation for API endpoint
- Updated cryptographic library
```

#### 7.5.2 变更日志规则

| 类别 | 说明 | 示例 |
|------|------|------|
| **Added** | 新增功能 | 新功能、新 API、新配置 |
| **Changed** | 变更行为 | API 变更、配置默认值变更 |
| **Deprecated** | 即将废弃 | 标记为废弃的功能 |
| **Removed** | 已删除 | 删除的功能、API |
| **Fixed** | 已修复 | Bug 修复、问题修正 |
| **Security** | 安全相关 | 安全补丁、漏洞修复 |

---

## 八、CI/CD 规范 (CI/CD Standards)

### 8.1 CI/CD 流水线总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CI/CD Pipeline Overview                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Continuous Integration (CI) Pipeline                                            │
│                                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │  Push   │───▶│  Lint   │───▶│  Build  │───▶│  Test   │───▶│ Package │      │
│  │  (Git)  │    │  Code   │    │  Compile│    │  Unit   │    │ Artifact│      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                                                  │              │
│                                                                  ▼              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           Artifact Registry                              │   │
│  │  - Docker Image: orion-registry.internal/orion/{project}:{sha}          │   │
│  │  - JAR/Wheel: orion-registry.internal/maven/{group}/{artifact}          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Continuous Delivery (CD) Pipeline                                               │
│                                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │Trigger  │───▶│ Deploy  │───▶│ Health  │───▶│ Smoke   │───▶│ Notify  │      │
│  │(Manual) │    │  Dev    │    │  Check  │    │  Test   │    │ Success │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                                                  │              │
│                                                                  ▼              │
│                   ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│                   │ Deploy  │───▶│ Health  │───▶│ Notify  │                     │
│                   │ Staging │    │  Check  │    │ Success │                     │
│                   └─────────┘    └─────────┘    └─────────┘                     │
│                                                                  │              │
│                                                                  ▼              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│  │ Manual  │───▶│ Deploy  │───▶│ Health  │───▶│ Monitor │                     │
│  │ Approval│    │  Prod   │    │  Check  │    │  24h    │                     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 GitHub Actions CI 模板

```yaml
# .github/workflows/ci.yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: orion-registry.internal
  IMAGE_NAME: ${{ github.event.repository.name }}

jobs:
  # Job 1: Code Lint
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Run Lint
        run: ./scripts/lint.sh

      - name: Upload Lint Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: lint-report
          path: build/reports/lint/

  # Job 2: Build
  build:
    name: Build Artifact
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Build with Gradle
        run: ./scripts/build.sh

      - name: Upload Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-jar
          path: backend/build/libs/*.jar

  # Job 3: Unit Test
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Run Unit Tests
        run: ./scripts/test.sh

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: build/reports/jacoco/test/jacocoTestReport.xml

  # Job 4: Build Docker Image
  docker:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/orion/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/orion/${{ env.IMAGE_NAME }}:latest

  # Job 5: Integration Test
  integration-test:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: docker
    steps:
      - uses: actions/checkout@v4

      - name: Start Services
        run: |
          docker-compose -f deploy/docker-compose/docker-compose.test.yaml up -d

      - name: Wait for Services
        run: |
          ./scripts/wait-for-services.sh

      - name: Run Integration Tests
        run: |
          ./scripts/test-integration.sh

      - name: Stop Services
        run: |
          docker-compose -f deploy/docker-compose/docker-compose.test.yaml down
```

### 8.3 GitHub Actions CD 模板

```yaml
# .github/workflows/cd.yaml
name: CD Pipeline

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment Environment'
        required: true
        default: 'dev'
        type: choice
        options:
        - dev
        - staging
        - production
      version:
        description: 'Version to Deploy'
        required: true
        type: string

env:
  REGISTRY: orion-registry.internal
  IMAGE_NAME: ${{ github.event.repository.name }}
  IMAGE_TAG: ${{ github.event.inputs.version }}

jobs:
  # Job 1: Deploy to Dev
  deploy-dev:
    name: Deploy to Dev
    if: github.event.inputs.environment == 'dev'
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Dev
        run: |
          ./deploy/scripts/deploy.sh dev ${{ env.IMAGE_TAG }}

      - name: Health Check
        run: |
          ./deploy/scripts/health-check.sh dev

      - name: Smoke Test
        run: |
          ./deploy/scripts/smoke-test.sh dev

  # Job 2: Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    if: github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Staging
        run: |
          ./deploy/scripts/deploy.sh staging ${{ env.IMAGE_TAG }}

      - name: Health Check
        run: |
          ./deploy/scripts/health-check.sh staging

      - name: Smoke Test
        run: |
          ./deploy/scripts/smoke-test.sh staging

  # Job 3: Deploy to Production
  deploy-production:
    name: Deploy to Production
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Production
        run: |
          ./deploy/scripts/deploy.sh production ${{ env.IMAGE_TAG }}

      - name: Health Check
        run: |
          ./deploy/scripts/health-check.sh production

      - name: Monitor 24h
        run: |
          ./deploy/scripts/monitor.sh production
```

### 8.4 构建规范

| 构建阶段 | 要求 | 产出物 |
|---------|------|--------|
| **Lint** | 代码风格检查 | Lint 报告 |
| **Build** | 编译源代码 | JAR/Wheel/二进制 |
| **Test** | 单元测试 | 覆盖率报告 |
| **Package** | 打包镜像 | Docker 镜像 |
| **Integration Test** | 集成测试 | 集成测试报告 |

### 8.5 测试规范

| 测试类型 | 覆盖率要求 | 执行时机 | 超时时间 |
|---------|-----------|---------|---------|
| **单元测试** | ≥80% | 每次提交 | 10 分钟 |
| **集成测试** | ≥70% | 每日构建 | 30 分钟 |
| **端到端测试** | 核心流程 | 发布前 | 60 分钟 |
| **性能测试** | 关键 API | 每周构建 | 30 分钟 |

### 8.6 发布规范

| 环境 | 触发条件 | 审批要求 | 回滚策略 |
|------|---------|---------|---------|
| **Dev** | 自动触发 | 无审批 | 自动回滚 |
| **Staging** | 手动触发 | 技术负责人 | 手动回滚 |
| **Production** | 手动触发 | 架构委员会 | 手动回滚 + 热修复 |

---

## 九、集成规范 (Integration Standards)

### 9.1 集成架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Integration Architecture                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   API Gateway   │
                                    │  (Kong/Traefik) │
                                    │  - Routing      │
                                    │  - Auth         │
                                    │  - Rate Limit   │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │  Platform       │          │  Tenant         │          │  Resource       │
    │  Service        │          │  Service        │          │  Service        │
    │  (Auth Core)    │          │                 │          │                 │
    │  Port: 8081     │          │  Port: 8083     │          │  Port: 8082     │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
             │                            │                            │
             │         ┌──────────────────┴────────────────────────────┤
             │         │
             ▼         ▼
    ┌─────────────────────────────────┐
    │      Governance Service         │
    │      (Security & Audit)         │
    │      Port: 8084                 │
    └─────────────────────────────────┘

             ┌─────────────────────────────────────────────────────────────────┐
             │                         Data Layer                               │
             │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
             │  │ PostgreSQL │ │   NATS     │ │   Redis    │ │   MinIO    │   │
             │  │ (Primary)  │ │ JetStream  │ │  (Cache)   │ │  (Storage) │   │
             │  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
             └─────────────────────────────────────────────────────────────────┘
```

### 9.2 API 网关集成

#### 9.2.1 网关配置规范

```yaml
# Kong Gateway 配置示例

# 路由配置
routes:
  - name: tenant-route
    paths:
      - /api/v1/tenants
    methods:
      - GET
      - POST
      - PUT
      - DELETE
    service: tenant-service
    strip_prefix: false

  - name: resource-route
    paths:
      - /api/v1/resources
    service: resource-service

# 认证插件
plugins:
  - name: jwt
    config:
      key_claim_name: iss
      secret_is_base64: false
      claims_to_verify:
        - exp

  - name: rate-limiting
    config:
      minute: 100
      policy: redis
      redis_host: redis.orion.svc
      redis_port: 6379

  - name: cors
    config:
      origins:
        - https://orion.example.com
      methods:
        - GET
        - POST
        - PUT
        - DELETE
      credentials: true
```

#### 9.2.2 网关集成规则

| 规则 | 说明 | 示例 |
|------|------|------|
| **统一入口** | 所有外部请求必须经过网关 | 禁止直连服务 |
| **认证委托** | 认证由网关统一处理 | JWT 验证在网关层 |
| **服务发现** | 网关自动发现后端服务 | Consul/K8s Service |
| **限流配置** | 网关层统一限流 | 100 请求/分钟 |
| **日志收集** | 网关记录访问日志 | ELK 统一收集 |

### 9.3 服务发现集成

#### 9.3.1 服务注册规范

```yaml
# Consul 服务注册配置

service:
  name: orion-tenant-service
  id: orion-tenant-service-1
  port: 8083
  tags:
    - api-v1
    - tenant
    - production
  meta:
    version: 1.0.0
    team: platform-foundation
  check:
    http: http://localhost:8083/actuator/health
    interval: 10s
    timeout: 5s
    deregister_critical_service_after: 30s
```

#### 9.3.2 服务发现方式

| 方式 | 适用场景 | 配置示例 |
|------|---------|---------|
| **Consul** | 多服务、多实例 | `@EnableDiscoveryClient` |
| **K8s Service** | K8s 原生环境 | `tenant-service.orion.svc:8083` |
| **Nacos** | 阿里技术栈 | `spring.cloud.nacos` |
| **Eureka** | Spring Cloud | `@EnableEurekaServer` |

### 9.4 认证集成

#### 9.4.1 认证流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Authentication Flow                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  Client                          API Gateway                    Platform Service
    │                                  │                                │
    │  1. POST /auth/login             │                                │
    │─────────────────────────────────▶│                                │
    │                                  │  2. Validate credentials       │
    │                                  │───────────────────────────────▶│
    │                                  │                                │
    │                                  │  3. Return user info + roles   │
    │                                  │◀───────────────────────────────│
    │                                  │                                │
    │                                  │  4. Generate JWT               │
    │  5. Return JWT                   │                                │
    │◀─────────────────────────────────│                                │
    │                                  │                                │
    │  6. Subsequent requests          │                                │
    │     with JWT                     │                                │
    │─────────────────────────────────▶│                                │
    │                                  │  7. Validate JWT               │
    │                                  │───────────────────────────────▶│
    │                                  │                                │
    │                                  │  8. JWT valid, forward request │
    │                                  │───────────────────────────────▶│
    │                                  │                                │
    │  9. Return response              │                                │
    │◀─────────────────────────────────│───────────────────────────────▶│
    │                                  │                                │
```

#### 9.4.2 JWT 令牌格式

```
JWT Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

JWT Payload:
{
  "sub": "user-123",           # 用户 ID
  "iss": "orion-platform",     # 签发者
  "aud": ["orion-api"],        # 受众
  "exp": 1712764800,           # 过期时间
  "iat": 1712678400,           # 签发时间
  "roles": ["admin", "user"],  # 角色列表
  "permissions": ["read", "write"], # 权限列表
  "tenant_id": "tenant-456"    # 租户 ID
}
```

### 9.5 事件驱动集成

#### 9.5.1 事件命名规范

```
格式：{domain}.{entity}.{action}

示例:
├── tenant.created         — 租户创建
├── tenant.deleted         — 租户删除
├── team.member_added      — 团队成员加入
├── team.member_removed    — 团队成员移除
├── artifact.uploaded      — 产物上传
├── artifact.promoted      — 产物晋升
├── security.policy_violated — 安全策略违规
└── audit.log_written      — 审计日志写入
```

#### 9.5.2 事件格式

```json
{
  "specversion": "1.0",
  "type": "tenant.created",
  "source": "orion-tenant-service",
  "id": "evt-123456789",
  "time": "2026-04-10T10:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "tenant_id": "tenant-456",
    "tenant_name": "Acme Corp",
    "created_by": "user-789",
    "created_at": "2026-04-10T10:00:00Z"
  }
}
```

---

## 十、验收标准 (Acceptance Criteria)

### 10.1 改造完成度检查清单

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Refactoring Completion Checklist Matrix                       │
└─────────────────────────────────────────────────────────────────────────────────┘

  Checklist Item                          │ Type A │ Type B │ Type C │ Priority
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  1. 命名规范                                      │        │        │        │
  ├─ 项目名符合 orion-{domain}-{type} 格式           │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包名符合语言规范                               │   ✅   │   ✅   │   N/A  │   P0
  ├─ 镜像名符合 registry/orion/{project}:tag 格式   │   N/A  │   ✅   │   ✅   │   P0
  ├─ 容器名符合 orion-{project} 格式                │   N/A  │   ✅   │   ✅   │   P1
  └─ 环境变量使用 ORION_{DOMAIN}_ 前缀             │   ✅   │   ✅   │   ✅   │   P0
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  2. 目录结构                                      │        │        │        │
  ├─ 包含 docs/ 目录                               │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 scripts/ 目录                            │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 .github/workflows/ 目录                  │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 modules/ 目录 (Type A)                   │   ✅   │   N/A  │   N/A  │   P0
  ├─ 包含 backend/ 目录 (Type B)                   │   N/A  │   ✅   │   N/A  │   P0
  ├─ 包含 deploy/ 目录 (Type B/C)                  │   N/A  │   ✅   │   ✅   │   P0
  └─ 无禁止的文件/目录                              │   ✅   │   ✅   │   ✅   │   P1
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  3. 配置文件                                      │        │        │        │
  ├─ 包含 .env.example                             │   ✅   │   ✅   │   N/A  │   P0
  ├─ .env 在 .gitignore 中                        │   ✅   │   ✅   │   N/A  │   P0
  ├─ 包含 plugin.yaml (Type A)                     │   ✅   │   N/A  │   N/A  │   P0
  ├─ 包含 docker-compose.yaml (Type B)             │   N/A  │   ✅   │   ✅   │   P0
  ├─ 包含 Helm Chart (Type C)                      │   N/A  │   N/A  │   ✅   │   P0
  └─ 配置文件格式正确                             │   ✅   │   ✅   │   ✅   │   P0
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  4. README                                        │        │        │        │
  ├─ 包含徽章栏 (版本、构建、许可证)                 │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Quick Start 章节                        │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Overview 章节                           │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Project Structure 章节                  │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Configuration 章节                      │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Development 章节                        │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 Deployment 章节                         │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 API Reference 章节                      │   ✅   │   ✅   │   N/A  │   P1
  ├─ 包含 Contributing 章节                       │   ✅   │   ✅   │   ✅   │   P1
  └─ 包含 License 章节                            │   ✅   │   ✅   │   ✅   │   P0
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  5. 许可证                                        │        │        │        │
  ├─ 包含 LICENSE 文件                             │   ✅   │   ✅   │   ✅   │   P0
  ├─ 许可证类型正确                                │   ✅   │   ✅   │   ✅   │   P0
  ├─ 源码文件头包含版权声明                        │   ✅   │   ✅   │   N/A  │   P1
  └─ 第三方依赖有 NOTICE 文件                      │   ✅   │   ✅   │   ✅   │   P1
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  6. 版本管理                                      │        │        │        │
  ├─ 遵循语义化版本                                │   ✅   │   ✅   │   ✅   │   P0
  ├─ 包含 CHANGELOG.md                             │   ✅   │   ✅   │   ✅   │   P0
  ├─ 变更日志格式符合 Keep a Changelog             │   ✅   │   ✅   │   ✅   │   P1
  └─ Git Tag 与版本一致                            │   ✅   │   ✅   │   ✅   │   P0
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  7. CI/CD                                         │        │        │        │
  ├─ 包含 CI 流水线配置                            │   ✅   │   ✅   │   ✅   │   P0
  ├─ CI 包含 Lint 检查                            │   ✅   │   ✅   │   ✅   │   P0
  ├─ CI 包含 Build 步骤                           │   ✅   │   ✅   │   ✅   │   P0
  ├─ CI 包含 Unit Test                            │   ✅   │   ✅   │   ✅   │   P0
  ├─ CI 包含 Docker 构建 (Type B/C)                │   N/A  │   ✅   │   ✅   │   P0
  ├─ 包含 CD 流水线配置                            │   N/A  │   ✅   │   ✅   │   P0
  ├─ 单元测试覆盖率≥80%                            │   ✅   │   ✅   │   N/A  │   P1
  └─ 集成测试通过                                 │   ✅   │   ✅   │   ✅   │   P0
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  8. 集成规范                                      │        │        │        │
  ├─ API 通过网关暴露                              │   N/A  │   ✅   │   ✅   │   P0
  ├─ 服务注册到服务发现                            │   N/A  │   ✅   │   ✅   │   P0
  ├─ 使用统一认证 (JWT)                            │   N/A  │   ✅   │   ✅   │   P0
  ├─ 实现健康检查端点                             │   N/A  │   ✅   │   ✅   │   P0
  ├─ 暴露 Prometheus metrics                      │   N/A  │   ✅   │   ✅   │   P0
  └─ 事件格式符合 CloudEvents                      │   N/A  │   ✅   │   ✅   │   P1
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  9. 监控与日志                                    │        │        │        │
  ├─ 日志输出到 stdout/stderr                     │   N/A  │   ✅   │   ✅   │   P0
  ├─ 日志格式为 JSON                               │   N/A  │   ✅   │   ✅   │   P1
  ├─ 包含关键业务指标                              │   N/A  │   ✅   │   ✅   │   P1
  ├─ 配置告警规则                                 │   N/A  │   ✅   │   ✅   │   P1
  └─ Dashboard 可用                               │   N/A  │   ✅   │   ✅   │   P1
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────
  10. 安全合规                                     │        │        │        │
  ├─ 无硬编码密码/密钥                             │   ✅   │   ✅   │   ✅   │   P0
  ├─ 敏感信息使用 Secret 管理                      │   N/A  │   ✅   │   ✅   │   P0
  ├─ 依赖无已知安全漏洞                            │   ✅   │   ✅   │   ✅   │   P0
  ├─ 实现输入验证                                 │   ✅   │   ✅   │   N/A  │   P1
  └─ 实现输出编码                                 │   ✅   │   ✅   │   N/A  │   P1
  ────────────────────────────────────────────────┼────────┼────────┼────────┼─────────

  Legend:
  ✅ = Required (必需)
  N/A = Not Applicable (不适用)
  P0 = Must Have (必须有)
  P1 = Should Have (应该有)
```

### 10.2 验收流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Acceptance Process                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

  Step 1: Self-Assessment          Step 2: Peer Review
  ──────────────────────            ──────────────────
  ┌─────────────────────┐          ┌─────────────────────┐
  │ 项目负责人完成       │          │ 架构委员会审查       │
  │ 检查清单自评         │          │ - 代码审查          │
  │                     │          │ - 文档审查          │
  │ 得分: ≥90%          │          │ - 架构审查          │
  └─────────┬───────────┘          └─────────┬───────────┘
            │                                │
            ▼                                ▼
  Step 4: Sign-off                 Step 3: Verification
  ──────────────────                ────────────────────
  ┌─────────────────────┐          ┌─────────────────────┐
  │ 正式批准入库         │          │ 自动化验证          │
  │                     │          │ - CI 流水线通过      │
  │ 状态: Approved      │          │ - 集成测试通过      │
  │                     │          │ - 安全扫描通过      │
  └─────────────────────┘          └─────────────────────┘
```

### 10.3 评分标准

| 得分率 | 评级 | 说明 |
|-------|------|------|
| 100% | ✅ Approved | 完全符合规范 |
| 90-99% | ✅ Approved with Notes | 基本符合，有少量改进建议 |
| 70-89% | ⚠️ Needs Improvement | 需要改进后重新评审 |
| <70% | ❌ Rejected | 不符合规范，重新改造 |

### 10.4 违规处理

| 违规级别 | 处理方式 | 示例 |
|---------|---------|------|
| **P0 违规** | 禁止入库 | 无 LICENSE、无 README、无 CI |
| **P1 违规** | 限期整改 | 无代码风格、无 Dashboard |
| **P2 违规** | 记录技术债务 | 命名不规范、文档不完整 |

---

## 附录 (Appendix)

### A. 术语表

| 术语 | 定义 |
|------|------|
| **SPI** | Service Provider Interface，服务提供者接口 |
| **SemVer** | Semantic Versioning，语义化版本 |
| **HPA** | Horizontal Pod Autoscaler，K8s 水平 Pod 自动扩展 |
| **VPA** | Vertical Pod Autoscaler，K8s 垂直 Pod 自动扩展 |
| **CloudEvents** | 云原生事件格式规范 |
| **Kustomize** | K8s 配置管理工具 |
| **GitOps** | 基于 Git 的运维实践 |

### B. 参考文档

| 文档 | 链接 |
|------|------|
| [语义化版本规范](https://semver.org/) | https://semver.org/ |
| [Keep a Changelog](https://keepachangelog.com/) | https://keepachangelog.com/ |
| [CloudEvents 规范](https://cloudevents.io/) | https://cloudevents.io/ |
| [OpenAPI 规范](https://swagger.io/specification/) | https://swagger.io/specification/ |
| [12-Factor App](https://12factor.net/) | https://12factor.net/ |

### C. 模板文件

| 模板 | 路径 |
|------|------|
| README 模板 | `templates/template-readme.md` |
| LICENSE 模板 | `templates/LICENSE-AGPL` |
| .env.example 模板 | `templates/template-env.example` |
| docker-compose 模板 | `templates/template-docker-compose.yaml` |
| plugin.yaml 模板 | `templates/template-plugin.yaml` |
| CI 流水线模板 | `templates/template-ci.yaml` |
| CD 流水线模板 | `templates/template-cd.yaml` |

### D. 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
