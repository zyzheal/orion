> ⚠️ **目标设计，未实现**。详见 [`当前系统架构.md`](./当前系统架构.md)。

# Orion Tool Marketplace Design (工具市场设计)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**优先级**: P2  
**评审人**: 架构委员会、平台工具团队  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述了 Orion 工具市场（Tool Marketplace）的完整架构与实现方案。工具市场是 Orion 平台的核心能力之一，为开发者和团队提供工具的发现、安装、升级、卸载、评分和监控等全生命周期管理能力。

### 设计目标

| 目标 | 描述 | 衡量指标 |
|------|------|---------|
| **工具发现** | 让开发者快速找到所需工具 | 搜索响应 <500ms，准确率 >90% |
| **一键安装** | 简化安装流程，自动化依赖处理 | 安装成功率 >95%，平均时间 <30s |
| **版本管理** | 支持多版本共存和平滑升级 | 升级失败率 <1%，回滚时间 <60s |
| **质量保障** | 通过评分和监控保障工具质量 | 问题工具发现时间 <5 分钟 |
| **生态扩展** | 支持官方、社区、私有多种仓库 | 仓库接入时间 <1 天 |

### 核心能力

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion Tool Marketplace                                 │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   存储层    │  │   索引层    │  │   分发层    │  │   安装层    │            │
│  │  Storage    │  │   Index     │  │  Distribute │  │   Install   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        工具元数据模型                                    │    │
│  │  Tool Metadata: Name, Version, Description, Category, Dependencies     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   发现层    │  │   评分层    │  │   监控层    │  │   仓库层    │            │
│  │  Discover   │  │   Rating    │  │   Monitor   │  │  Repository │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 预期收益量化

| 指标 | 当前状态 | 目标状态 | 改善幅度 |
|------|---------|---------|---------|
| 工具查找时间 | 5-10 分钟（文档搜索） | <30 秒（市场搜索） | 90% |
| 安装配置时间 | 30-60 分钟（手动） | <5 分钟（自动） | 85% |
| 升级失败率 | 15%（手动升级） | <1%（自动升级） | 93% |
| 工具覆盖率 | 24 个（手动管理） | 150+ 个（市场供应） | 525% |
| 问题发现时间 | 小时级（用户反馈） | 分钟级（自动监控） | 90% |

---

## 一、工具市场架构 (Tool Marketplace Architecture)

### 1.1 整体架构概述

工具市场采用分层架构设计，各层职责清晰、松耦合，支持水平扩展和独立部署。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion Tool Marketplace Architecture                    │
│                                  (工具市场架构图)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   API Gateway   │
                                    │  (REST/GraphQL) │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
    │   Frontend      │           │   Backend       │           │   External      │
    │   Application   │           │   Services      │           │   Interfaces    │
    │                 │           │                 │           │                 │
    │ • Web UI        │           │ • Discovery     │           │ • Git Repos     │
    │ • CLI Client    │           │ • Installation  │           │ • Registry API  │
    │ • IDE Plugin    │           │ • Lifecycle     │           │ • Webhook       │
    │ • Mobile View   │           │ • Monitoring    │           │ • OAuth         │
    └────────┬────────┘           └────────┬────────┘           └─────────────────┘
             │                              │
             └──────────────────────────────┼──────────────────────────────┐
                                            │                              │
              ┌─────────────────────────────┴─────────────────────────────┐│
              │                      Service Layer                         │
              │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
              │  │ Discovery   │ │ Lifecycle   │ │ Rating      │          │
              │  │ Service     │ │ Service     │ │ Service     │          │
              │  └─────────────┘ └─────────────┘ └─────────────┘          │
              │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
              │  │ Monitor     │ │ Repository  │ │ Dependency  │          │
              │  │ Service     │ │ Service     │ │ Resolver    │          │
              │  └─────────────┘ └─────────────┘ └─────────────┘          │
              └────────────────────────────────────────────────────────────┘
                                            │
              ┌─────────────────────────────┴─────────────────────────────┐
              │                      Data Layer                            │
              │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
              │  │ PostgreSQL  │ │ Elasticsearch│ │   Redis     │          │
              │  │ (Metadata)  │ │ (Search)    │ │ (Cache)     │          │
              │  └─────────────┘ └─────────────┘ └─────────────┘          │
              │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
              │  │   MinIO     │ │   NATS      │ │ Prometheus  │          │
              │  │ (Artifacts) │ │ (Events)    │ │ (Metrics)   │          │
              │  └─────────────┘ └─────────────┘ └─────────────┘          │
              └────────────────────────────────────────────────────────────┘
                                            │
              ┌─────────────────────────────┴─────────────────────────────┐
              │                   Repository Layer                         │
              │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
              │  │   Official  │ │   Private   │ │   Git-based │          │
              │  │ Repository  │ │ Repository  │ │ Repository  │          │
              │  └─────────────┘ └─────────────┘ └─────────────┘          │
              └────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件职责

#### 1.2.1 存储层 (Storage Layer)

| 组件 | 职责 | 技术选型 | 数据规模 |
|------|------|---------|---------|
| PostgreSQL | 工具元数据、版本信息、依赖关系 | PostgreSQL 15+ | 100 万条记录 |
| MinIO | 工具包、二进制文件、配置文件 | MinIO 分布式 | 10TB 存储 |
| Redis | 热点数据缓存、会话管理 | Redis Cluster | 100GB 内存 |

#### 1.2.2 索引层 (Index Layer)

| 组件 | 职责 | 技术选型 | 性能指标 |
|------|------|---------|---------|
| Elasticsearch | 全文搜索、模糊匹配、分面搜索 | ES 8.x | P99 <200ms |
| Redis | 热门排行、搜索建议缓存 | Redis SortedSet | P99 <10ms |

#### 1.2.3 分发层 (Distribution Layer)

| 组件 | 职责 | 技术选型 | 性能指标 |
|------|------|---------|---------|
| CDN | 全球加速、静态资源分发 | CloudFront/自建 | 命中率 >95% |
| MinIO | 大文件分片上传下载 | S3 兼容协议 | 10Gbps 吞吐 |

#### 1.2.4 安装层 (Installation Layer)

| 组件 | 职责 | 技术选型 | 性能指标 |
|------|------|---------|---------|
| Install Engine | 依赖解析、兼容性验证、安装执行 | 自研引擎 | 安装时间 <30s |
| Resource Checker | 资源预检、环境检查 | 自研探针 | 检查时间 <5s |

### 1.3 数据流架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Marketplace Data Flow                             │
└─────────────────────────────────────────────────────────────────────────────────┘

用户请求流 (Request Flow):
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户    │────▶│  Gateway │────▶│  Service │────▶│  Cache   │────▶│  Database│
│  Client  │     │          │     │  Layer   │     │  (Redis) │     │  (PG/ES) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                  │                  │                  │                  │
     │  1. 搜索工具     │                  │                  │                  │
     │◀─────────────────────────────────────────────────────────────────────────│
     │                                                                          │
     │  2. 查看详情                                                              │
     │◀─────────────────────────────────────────────────────────────────────────│
     │                                                                          │
     │  3. 安装工具                                                              │
     │─────────────────────────────────────────────────────────────────────────▶│
     │                  │                  │                  │                  │
     │                  │     4. 依赖解析   │                  │                  │
     │                  │─────────────────▶│                  │                  │
     │                  │                  │                  │                  │
     │                  │     5. 下载包     │                  │                  │
     │                  │◀─────────────────│                  │                  │
     │                  │                  │                  │                  │
     │                  │     6. 执行安装   │                  │                  │
     │                  │─────────────────▶│                  │                  │
     │                  │                  │                  │                  │
     │                  │     7. 更新状态   │                  │                  │
     │                  │────────────────────────────────────▶│                  │
     │◀─────────────────────────────────────────────────────────────────────────│
     │                          安装完成                                        │

事件流 (Event Flow):
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Service │────▶│   NATS   │────▶│ Consumer │────▶│  Processor│────▶│  Storage │
│          │     │  Event   │     │          │     │           │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                  │                  │                  │                  │
     │ tool.installed   │                  │                  │                  │
     │─────────────────▶│                  │                  │                  │
     │                  │ tool_installed   │                  │                  │
     │                  │─────────────────▶│                  │                  │
     │                  │                  │ update_stats     │                  │
     │                  │                  │─────────────────▶│                  │
     │                  │                  │                  │ persist_to_db    │
     │                  │                  │                  │─────────────────▶│
     │                                                                          │
     │ tool.upgraded                                                              │
     │─────────────────▶│                  │                  │                  │
     │ tool.uninstalled                                                           │
     │─────────────────▶│                  │                  │                  │
     │ tool.health_changed                                                        │
     │─────────────────▶│                  │                  │                  │
```

### 1.4 服务通信模式

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Service Communication Patterns                           │
└─────────────────────────────────────────────────────────────────────────────────┘

同步通信 (REST/gRPC) - 实线表示:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gateway   │────▶│  Discovery  │────▶│  Metadata   │
│             │     │   Service   │     │    DB       │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │  查询工具列表       │  查询工具详情
      │◀───────────────────│
      │                    │

异步通信 (NATS Events) - 虚线表示:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Install   │- - -▶│   NATS     │- - -▶│   Rating    │- - -▶│   Monitor   │
│   Service   │     │  JetStream │     │   Service   │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │                    │
      │ tool_installed     │                    │                    │
      │───────────────────▶│                    │                    │
      │                    │ tool_installed     │                    │
      │                    │───────────────────▶│                    │
      │                    │                    │ update_rating      │
      │                    │                    │───────────────────▶│
      │                    │                    │                    │
      │                    │ install_audit      │                    │
      │                    │────────────────────────────────────────▶│
```

---

## 二、工具元数据模型 (Tool Metadata Model)

### 2.1 元数据模型总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Metadata Model                                    │
│                           (工具元数据模型图)                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │      Tool       │
                                    │   (核心实体)     │
                                    └────────┬────────┘
                                             │
          ┌──────────────────────────────────┼──────────────────────────────────┐
          │                                  │                                  │
          ▼                                  ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│    Version      │              │    Category     │              │   Maintainer    │
│   (版本信息)     │              │   (分类标签)     │              │   (维护者)      │
├─────────────────┤              ├─────────────────┤              ├─────────────────┤
│ • version       │              │ • id            │              │ • id            │
│ • release_date  │              │ • name          │              │ • name          │
│ • status        │              │ • parent_id     │              │ • email         │
│ • changelog     │              │ • level         │              │ • organization  │
│ • deprecated    │              │ • icon          │              │ • verified      │
└────────┬────────┘              └─────────────────┘              └────────┬────────┘
         │                                                                 │
         │ 1:N                                                             │ 1:N
         ▼                                                                 ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Dependency     │              │     Config      │              │    Resource     │
│  (依赖关系)     │              │   (配置 Schema)  │              │   (资源要求)     │
├─────────────────┤              ├─────────────────┤              ├─────────────────┤
│ • tool_id       │              │ • schema_type   │              │ • cpu_min       │
│ • version_range │              │ • properties    │              │ • memory_min    │
│ • optional      │              │ • required      │              │ • disk_min      │
│ • condition     │              │ • default       │              │ • network       │
└─────────────────┘              │ • validation    │              │ • permissions   │
                                 └─────────────────┘              └─────────────────┘
```

### 2.2 核心元数据字段定义

#### 2.2.1 工具基础信息 (Tool Base Info)

```yaml
tool_base:
  # ── 必需字段 ──
  name: "semgrep"                          # 工具唯一标识符（小写，连字符分隔）
  display_name: "Semgrep"                  # 显示名称
  version: "1.31.0"                        # 语义化版本号
  description: "静态代码安全扫描工具"        # 简短描述（<200 字）
  long_description: "..."                  # 详细描述（Markdown 格式）
  category: "security"                     # 主分类
  subcategory: "sast"                      # 子分类
  
  # ── 维护者信息 ──
  maintainer:
    name: "r2c"                            # 维护者名称
    email: "support@semgrep.com"           # 联系邮箱
    organization: "r2c Inc."               # 所属组织
    verified: true                         # 是否官方认证
  
  # ── 许可证信息 ──
  license:
    type: "LGPL-2.1"                       # SPDX 许可证标识
    url: "https://..."                     # 许可证文本 URL
  
  # ── 时间信息 ──
  created_at: "2026-01-01T00:00:00Z"       # 创建时间
  updated_at: "2026-04-01T00:00:00Z"       # 更新时间
  published_at: "2026-04-01T00:00:00Z"     # 发布时间
```

#### 2.2.2 版本信息 (Version Info)

```yaml
version_info:
  version: "1.31.0"                        # 语义化版本号
  status: "stable"                         # 版本状态：stable | beta | alpha | deprecated
  release_date: "2026-04-01"               # 发布日期
  release_notes: "..."                     # 发布说明
  
  # ── 兼容性信息 ──
  compatibility:
    orion_min_version: "1.0.0"             # 最低 Orion 版本
    orion_max_version: "*"                 # 最高 Orion 版本
    platforms:                             # 支持的平台
      - os: "linux"
        arch: ["amd64", "arm64"]
      - os: "darwin"
        arch: ["amd64", "arm64"]
      - os: "windows"
        arch: ["amd64"]
  
  # ── 变更日志 ──
  changelog:
    - type: "feature"
      description: "新增 Python 3.12 支持"
    - type: "fix"
      description: "修复规则解析错误"
    - type: "breaking"
      description: "配置文件格式变更"
  
  # ── 废弃信息 ──
  deprecated:
    is_deprecated: false
    deprecation_date: ""
    sunset_date: ""
    replacement_version: ""
    migration_guide: ""
```

#### 2.2.3 依赖关系 (Dependencies)

```yaml
dependencies:
  # ── 工具依赖 ──
  tool_dependencies:
    - name: "java"
      version: ">=11"
      optional: false
      reason: "运行时需要"
    
    - name: "postgres"
      version: ">=14"
      optional: false
      reason: "数据存储"
    
    - name: "redis"
      version: ">=6"
      optional: true
      reason: "缓存加速（可选）"
  
  # ── 系统依赖 ──
  system_dependencies:
    - name: "git"
      version: ">=2.0"
      package_manager: ["apt", "yum", "brew"]
    
    - name: "openssl"
      version: ">=1.1"
  
  # ── 冲突检测 ──
  conflicts:
    - tool: "codeql"
      reason: "功能重叠，不建议同时使用"
      severity: "warning"  # warning | error
```

#### 2.2.4 配置 Schema (Configuration Schema)

```yaml
config_schema:
  type: "object"
  required:
    - scan_mode
    - ruleset
  
  properties:
    scan_mode:
      type: "string"
      enum: ["fast", "normal", "deep"]
      default: "normal"
      description: "扫描模式"
    
    ruleset:
      type: "array"
      items:
        type: "string"
      default: ["p/security-audit"]
      description: "规则集列表"
    
    severity_threshold:
      type: "string"
      enum: ["INFO", "WARNING", "ERROR", "CRITICAL"]
      default: "ERROR"
      description: "严重程度阈值"
    
    exclude_patterns:
      type: "array"
      items:
        type: "string"
      default: ["*.test.ts", "test-fixtures/"]
      description: "排除文件模式"
    
    max_concurrent:
      type: "integer"
      minimum: 1
      maximum: 16
      default: 4
      description: "最大并发数"
    
    timeout_seconds:
      type: "integer"
      minimum: 60
      maximum: 3600
      default: 300
      description: "扫描超时时间"
```

#### 2.2.5 资源要求 (Resource Requirements)

```yaml
resource_requirements:
  # ── CPU 要求 ──
  cpu:
    min_cores: 2
    recommended_cores: 4
    max_cores: 16
  
  # ── 内存要求 ──
  memory:
    min_mb: 512
    recommended_mb: 2048
    max_mb: 8192
  
  # ── 磁盘要求 ──
  disk:
    min_gb: 1
    recommended_gb: 10
    max_gb: 100
  
  # ── 网络要求 ──
  network:
    outbound_allowed: true
    inbound_ports: [8080, 8443]
    external_services:
      - name: "semgrep.dev"
        purpose: "规则下载"
        required: true
```

#### 2.2.6 安装配置 (Installation Config)

```yaml
installation:
  # ── 安装方法 ──
  method: "binary"  # binary | container | plugin | source
  
  # ── 下载信息 ──
  downloads:
    - platform: "linux"
      arch: "amd64"
      url: "https://.../semgrep-linux-amd64"
      sha256: "abc123..."
      size_mb: 50
    
    - platform: "darwin"
      arch: "arm64"
      url: "https://.../semgrep-darwin-arm64"
      sha256: "def456..."
      size_mb: 45
  
  # ── 安装脚本 ──
  scripts:
    pre_install: |
      #!/bin/bash
      echo "检查依赖..."
      check_java_version
    
    post_install: |
      #!/bin/bash
      echo "验证安装..."
      semgrep --version
      
      # 注册到工具管理器
      orion-tool register semgrep
  
  # ── 环境变量 ──
  env_vars:
    SEMGREP_RULES_URL: "https://semgrep.dev/rules"
    SEMGREP_TIMEOUT: "300"
```

### 2.3 分类体系 (Taxonomy)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Category Tree                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

orion-tools/
├── security/                    # 安全工具
│   ├── sast/                    # 静态应用安全测试
│   │   ├── semgrep
│   │   ├── codeql
│   │   └── fortify
│   ├── dast/                    # 动态应用安全测试
│   │   ├── owasp-zap
│   │   └── burp
│   ├── sca/                     # 软件成分分析
│   │   ├── trivy
│   │   ├── snyk
│   │   └── dependency-check
│   ├── secret-scan/             # 密钥扫描
│   │   ├── gitleaks
│   │   └── trufflehog
│   └── iac-scan/                # 基础设施即代码扫描
│       ├── checkov
│       └── terrascan
│
├── code-quality/                # 代码质量
│   ├── static-analysis/         # 静态分析
│   │   ├── sonarqube
│   │   └── pmd
│   ├── linting/                 # 代码风格检查
│   │   ├── eslint
│   │   ├── prettier
│   │   └── black
│   └── review/                  # 代码审查
│       ├── ai-code-review
│       └── gerrit
│
├── testing/                     # 测试工具
│   ├── unit-test/               # 单元测试
│   │   ├── junit
│   │   └── pytest
│   ├── integration-test/        # 集成测试
│   │   └── testcontainers
│   ├── performance-test/        # 性能测试
│   │   ├── jmeter
│   │   └── k6
│   └── e2e-test/                # 端到端测试
│       ├── selenium
│       └── playwright
│
├── build/                       # 构建工具
│   ├── compiler/                # 编译器
│   │   ├── gcc
│   │   └── javac
│   ├── bundler/                 # 打包工具
│   │   ├── webpack
│   │   └── vite
│   └── task-runner/             # 任务运行器
│       ├── make
│       └── gradle
│
├── deploy/                      # 部署工具
│   ├── container/               # 容器化
│   │   ├── docker
│   │   └── podman
│   ├── orchestrator/            # 编排工具
│   │   ├── kubernetes
│   │   └── nomad
│   └── gitops/                  # GitOps 工具
│       ├── argocd
│       └── flux
│
├── ci-cd/                       # CI/CD 工具
│   ├── pipeline/                # 流水线引擎
│   │   ├── jenkins
│   │   ├── tekton
│   │   └── github-actions
│   └── artifact/                # 产物管理
│       ├── nexus
│       └── artifactory
│
├── monitoring/                  # 监控工具
│   ├── metrics/                 # 指标监控
│   │   ├── prometheus
│   │   └── grafana
│   ├── logging/                 # 日志管理
│   │   ├── elasticsearch
│   │   └── loki
│   └── tracing/                 # 链路追踪
│       ├── jaeger
│       └── zipkin
│
└── ai/                          # AI 工具
    ├── code-generation/         # 代码生成
    │   └── copilot
    ├── code-explanation/        # 代码解释
    │   └── claude
    └── test-generation/         # 测试生成
        └── test-gen-ai
```

### 2.4 数据库表设计

```sql
-- ── 工具主表 ──
CREATE TABLE tools (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    display_name    VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    long_description TEXT,
    icon_url        VARCHAR(500),
    category_id     BIGINT REFERENCES categories(id),
    subcategory_id  BIGINT REFERENCES subcategories(id),
    maintainer_id   BIGINT REFERENCES maintainers(id),
    license_type    VARCHAR(50),
    license_url     VARCHAR(500),
    homepage_url    VARCHAR(500),
    documentation_url VARCHAR(500),
    source_code_url VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'active',
    is_official     BOOLEAN DEFAULT false,
    is_featured     BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 工具版本表 ──
CREATE TABLE tool_versions (
    id              BIGSERIAL PRIMARY KEY,
    tool_id         BIGINT REFERENCES tools(id) ON DELETE CASCADE,
    version         VARCHAR(50) NOT NULL,
    status          VARCHAR(20) DEFAULT 'stable',
    release_date    DATE,
    release_notes   TEXT,
    changelog       JSONB,
    is_deprecated   BOOLEAN DEFAULT false,
    deprecation_date DATE,
    sunset_date     DATE,
    replacement_version VARCHAR(50),
    compatibility   JSONB,  -- 兼容性信息
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tool_id, version)
);

-- ── 版本下载表 ──
CREATE TABLE version_downloads (
    id              BIGSERIAL PRIMARY KEY,
    version_id      BIGINT REFERENCES tool_versions(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL,
    architecture    VARCHAR(20) NOT NULL,
    download_url    VARCHAR(1000) NOT NULL,
    sha256          VARCHAR(64) NOT NULL,
    size_mb         INTEGER NOT NULL,
    download_count  BIGINT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 依赖关系表 ──
CREATE TABLE tool_dependencies (
    id              BIGSERIAL PRIMARY KEY,
    tool_id         BIGINT REFERENCES tools(id) ON DELETE CASCADE,
    dependent_tool_id BIGINT REFERENCES tools(id),
    dependency_name VARCHAR(100) NOT NULL,
    version_range   VARCHAR(100),
    is_optional     BOOLEAN DEFAULT false,
    dependency_type VARCHAR(20) DEFAULT 'tool',  -- tool | system | library
    reason          VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 配置 Schema 表 ──
CREATE TABLE tool_config_schemas (
    id              BIGSERIAL PRIMARY KEY,
    tool_id         BIGINT REFERENCES tools(id) ON DELETE CASCADE,
    version_id      BIGINT REFERENCES tool_versions(id),
    schema_type     VARCHAR(50) DEFAULT 'json',
    schema_content  JSONB NOT NULL,
    is_default      BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 分类表 ──
CREATE TABLE categories (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    display_name    VARCHAR(200) NOT NULL,
    description     TEXT,
    parent_id       BIGINT REFERENCES categories(id),
    level           INTEGER DEFAULT 1,
    icon            VARCHAR(100),
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 维护者表 ──
CREATE TABLE maintainers (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(200),
    organization    VARCHAR(200),
    is_verified     BOOLEAN DEFAULT false,
    homepage_url    VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 安装记录表 ──
CREATE TABLE tool_installations (
    id              BIGSERIAL PRIMARY KEY,
    tool_id         BIGINT REFERENCES tools(id),
    version_id      BIGINT REFERENCES tool_versions(id),
    tenant_id       BIGINT NOT NULL,
    team_id         BIGINT,
    environment     VARCHAR(50) DEFAULT 'production',
    status          VARCHAR(20) DEFAULT 'installed',
    installed_by    BIGINT REFERENCES users(id),
    installed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    upgraded_at     TIMESTAMP,
    uninstalled_at  TIMESTAMP,
    config_snapshot JSONB,
    UNIQUE(tool_id, tenant_id, environment)
);

-- 创建索引
CREATE INDEX idx_tools_category ON tools(category_id);
CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tool_versions_tool_id ON tool_versions(tool_id);
CREATE INDEX idx_tool_dependencies_tool_id ON tool_dependencies(tool_id);
CREATE INDEX idx_tool_installations_tenant ON tool_installations(tenant_id);
```

---

## 三、工具发现机制 (Tool Discovery Mechanism)

### 3.1 发现机制总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Discovery Flow                                    │
│                           (工具发现流程图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   用户访问   │
                                    │  工具市场   │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
            ┌───────────────┐                             ┌───────────────┐
            │   主动搜索     │                             │   被动浏览     │
            │  (Search)     │                             │  (Browse)     │
            └───────┬───────┘                             └───────┬───────┘
                    │                                             │
        ┌───────────┼───────────┐                 ┌───────────────┼───────────────┐
        │           │           │                 │               │               │
        ▼           ▼           ▼                 ▼               ▼               ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ 关键词搜索 │ │ 模糊搜索   │ │ 过滤搜索   │ │ 分类浏览   │ │ 热门排行   │ │ 个性推荐  │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │             │             │
      └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
                                        │
                                        ▼
                                ┌───────────────┐
                                │   结果排序     │
                                │   & 展示      │
                                └───────┬───────┘
                                        │
                                        ▼
                                ┌───────────────┐
                                │   用户选择     │
                                │   查看工具     │
                                └───────────────┘
```

### 3.2 分类浏览 (Category Browsing)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Category Browse UI                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  🔧 工具市场 > 浏览                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  全部分类                                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  🔒 安全工具 (45)                                                            │ │
│  │     ├── 📊 SAST 静态分析 (12)  ▶ semgrep, codeql, fortify                 │ │
│  │     ├── 🌐 DAST 动态分析 (8)   ▶ owasp-zap, burp                          │ │
│  │     ├── 📦 SCA 成分分析 (10)   ▶ trivy, snyk, dependency-check            │ │
│  │     ├── 🔑 密钥扫描 (5)        ▶ gitleaks, trufflehog                      │ │
│  │     └── 🏗️ IaC 扫描 (10)       ▶ checkov, terrascan                        │ │
│  │                                                                             │ │
│  │  📈 代码质量 (38)                                                            │ │
│  │     ├── 🔍 静态分析 (15)       ▶ sonarqube, pmd                            │ │
│  │     ├── ✨ 代码风格 (12)       ▶ eslint, prettier, black                   │ │
│  │     └── 👀 代码审查 (11)       ▶ ai-code-review, gerrit                    │ │
│  │                                                                             │ │
│  │  🧪 测试工具 (32)                                                            │ │
│  │     ├── 📝 单元测试 (10)       ▶ junit, pytest                             │ │
│  │     ├── 🔗 集成测试 (8)        ▶ testcontainers                            │ │
│  │     ├── ⚡ 性能测试 (8)        ▶ jmeter, k6                                │ │
│  │     └── 🎯 E2E 测试 (6)        ▶ selenium, playwright                      │ │
│  │                                                                             │ │
│  │  🔨 构建工具 (18)                                                            │ │
│  │  🚀 部署工具 (15)                                                            │ │
│  │  🔄 CI/CD (20)                                                               │ │
│  │  📊 监控工具 (22)                                                            │ │
│  │  🤖 AI 工具 (10)                                                              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  筛选条件: [状态：全部 ▼] [许可证：全部 ▼] [维护者：全部 ▼] [排序：热门 ▼]       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 搜索功能 (Search)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Search Architecture                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

搜索流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户    │────▶│  Query   │────▶│ Search   │────▶│  Rank    │────▶│  返回    │
│  输入    │     │  预处理   │     │  Engine  │     │  排序    │     │  结果    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘

查询预处理:
├── 拼写纠正: "semgreop" → "semgrep"
├── 同义词扩展: "扫描" → ["scan", "sast", "security"]
├── 停用词过滤: "的", "工具", "如何"
└── 意图识别: 工具名？分类？功能？

搜索引擎 (Elasticsearch):
├── 字段权重:
│   ├── name: 10 (工具名精确匹配权重最高)
│   ├── display_name: 8
│   ├── description: 5
│   ├── tags: 3
│   └── long_description: 1
│
├── 模糊匹配:
│   ├── 编辑距离 <= 2
│   ├── 前缀匹配 (自动补全)
│   └── 正则匹配 (高级搜索)
│
└── 分面搜索:
    ├── 分类过滤
    ├── 许可证过滤
    ├── 状态过滤
    └── 评分过滤

排序算法:
score = (text_relevance * 0.4) + 
        (popularity * 0.3) + 
        (rating * 0.2) + 
        (freshness * 0.1)

其中:
├── text_relevance: ES 相关性分数 (0-1)
├── popularity: 安装量归一化分数 (0-1)
├── rating: 用户评分归一化 (0-1)
└── freshness: 更新时间归一化 (0-1)
```

### 3.4 热门排行 (Popular Rankings)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Popular Rankings                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

排行维度:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  📊 热门排行 (最近更新 7 天)                                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  🔥 安装量排行                        ⭐ 评分排行                                 │
│  ┌────────────────────────────┐      ┌────────────────────────────┐             │
│  │  1. semgrep      +15,234   │      │  1. sonarqube    4.9 ⭐    │             │
│  │  2. trivy        +12,456   │      │  2. semgrep      4.8 ⭐    │             │
│  │  3. sonarqube    +10,890   │      │  3. checkov      4.7 ⭐    │             │
│  │  4. gitleaks     +8,765    │      │  4. trivy        4.7 ⭐    │             │
│  │  5. checkov      +7,654    │      │  5. gitleaks     4.6 ⭐    │             │
│  │  6. eslint       +6,543    │      │  6. eslint       4.6 ⭐    │             │
│  │  7. jmeter       +5,432    │      │  7. jmeter       4.5 ⭐    │             │
│  │  8. k6           +4,321    │      │  8. k6           4.5 ⭐    │             │
│  │  9. prometheus   +3,210    │      │  9. prometheus   4.4 ⭐    │             │
│  │ 10. grafana      +2,109    │      │ 10. grafana      4.4 ⭐    │             │
│  └────────────────────────────┘      └────────────────────────────┘             │
│                                                                                  │
│  📈 趋势上升 (增长速度最快)             ⚡ 高频使用 (调用次数最多)                 │
│  ┌────────────────────────────┐      ┌────────────────────────────┐             │
│  │  1. ai-code-review  +256%  │      │  1. ai-code-review  50K/天 │             │
│  │  2. gitleaks        +189%  │      │  2. semgrep         35K/天 │             │
│  │  3. checkov         +145%  │      │  3. sonarqube       25K/天 │             │
│  │  4. trivy           +120%  │      │  4. trivy           20K/天 │             │
│  │  5. k6              +98%   │      │  5. eslint          15K/天 │             │
│  └────────────────────────────┘      └────────────────────────────┘             │
│                                                                                  │
│  🏆 官方认证工具                          🆕 最新上架                              │
│  ┌────────────────────────────┐      ┌────────────────────────────┐             │
│  │  semgrep ✓                 │      │  test-gen-ai    2026-04-08│             │
│  │  sonarqube ✓               │      │  flux           2026-04-05│             │
│  │  trivy ✓                   │      │  argocd         2026-04-01│             │
│  │  checkov ✓                 │      │  playwright     2026-03-28│             │
│  │  gitleaks ✓                │      │  k6             2026-03-25│             │
│  └────────────────────────────┘      └────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────┘

排行榜计算逻辑:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Redis SortedSet 配置                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  # 安装量排行 (每日更新)                                                         │
│  ZADD marketplace:ranking:installs:weekly                                       │
│       <score> <tool_id>                                                          │
│       其中 score = 本周新增安装数                                                 │
│                                                                                  │
│  # 评分排行 (实时更新)                                                           │
│  ZADD marketplace:ranking:rating                                                │
│       <score> <tool_id>                                                          │
│       其中 score = 加权平均分 (考虑评分人数)                                      │
│                                                                                  │
│  # 趋势排行 (每小时更新)                                                         │
│  ZADD marketplace:ranking:trending                                              │
│       <score> <tool_id>                                                          │
│       其中 score = (本周安装量 - 上周安装量) / 上周安装量 * 100                   │
│                                                                                  │
│  # 活跃度排行 (每分钟更新)                                                       │
│  ZADD marketplace:ranking:active                                                │
│       <score> <tool_id>                                                          │
│       其中 score = 最近 1 小时调用次数                                             │
│                                                                                  │
│  缓存过期策略:                                                                    │
│  ├── 安装量排行: TTL = 1 小时                                                     │
│  ├── 评分排行: TTL = 5 分钟 (实时更新)                                            │
│  ├── 趋势排行: TTL = 15 分钟                                                      │
│  └── 活跃度排行: TTL = 1 分钟                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 个性推荐 (Personalized Recommendation)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Recommendation System                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

推荐策略:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  基于团队的推荐                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  如果团队已安装 [semgrep, trivy]，推荐 [gitleaks]                          │ │
│  │  理由: 同类安全工具，互补功能                                               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  基于使用历史的推荐                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  用户频繁使用 semgrep 进行 Python 扫描，推荐 [bandit]                         │ │
│  │  理由: Python 专用安全扫描工具，更精准                                       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  基于相似团队的推荐                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  与 payment-team 工具栈相似的 order-team 安装了 [sonarqube]                  │ │
│  │  推荐: sonarqube                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  基于热门趋势的推荐                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  最近 7 天安装量增长最快的工具: ai-code-review (+256%)                       │ │
│  │  推荐: ai-code-review                                                       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

推荐算法:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  协同过滤 (Collaborative Filtering):                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  用户 - 工具矩阵分解                                                         │ │
│  │                                                                              │ │
│  │            semgrep  trivy  sonar  gitleaks  checkov                         │ │
│  │  team1      ✅       ✅     ✅      ❌        ❌                              │ │
│  │  team2      ✅       ❌     ✅      ✅        ❌                              │ │
│  │  team3      ❌       ✅     ❌      ❌        ✅                              │ │
│  │  team4      ✅       ✅     ❌      ✅        ❌                              │ │
│  │  target     ✅       ✅     ?      ?         ?                               │ │
│  │                                                                              │ │
│  │  预测: target 团队可能需要的工具 = 与相似团队的交集                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  基于内容的推荐 (Content-Based):                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具特征向量:                                                               │ │
│  │  semgrep   = [security, sast, python, java, js, fast, ...]                 │ │
│  │  gitleaks  = [security, secret, scan, fast, ...]                           │ │
│  │  checkov   = [security, iac, terraform, k8s, ...]                          │ │
│  │                                                                              │ │
│  │  计算余弦相似度，推荐相似度高且用户未安装的工具                              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、工具安装流程 (Tool Installation Flow)

### 4.1 安装流程总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Installation Flow                                 │
│                           (工具安装流程图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │  用户点击    │
                                    │  "安装" 按钮  │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   前置检查   │
                                    │ Pre-flight  │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   依赖检查       │          │   兼容性验证    │          │   资源预检      │
    │ Dependency      │          │ Compatibility │          │ Resource        │
    │ Check           │          │ Check         │          │ Check           │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
              │                            │                            │
              │ ✅ 通过                     │ ✅ 通过                     │ ✅ 通过
              │ ❌ 失败 → 提示解决          │ ❌ 失败 → 提示升级          │ ❌ 失败 → 提示扩容
              └────────────────────────────┴────────────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  下载工具包   │
                                    │  Download   │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  校验完整性   │
                                    │ Verify Hash │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  执行安装    │
                                    │   Install   │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   执行脚本       │          │   配置写入      │          │   服务注册      │
    │ Run Scripts     │          │ Write Config  │          │ Register        │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
              │                            │                            │
              └────────────────────────────┴────────────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  健康检查    │
                                    │ Health Check│
                                    └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌───────────────┐         ┌───────────────┐
                    │ ✅ 安装成功    │         │ ❌ 安装失败    │
                    │               │         │               │
                    │ • 更新状态     │         │ • 自动回滚     │
                    │ • 发送通知     │         │ • 记录错误     │
                    │ • 记录日志     │         │ • 发送告警     │
                    └───────────────┘         └───────────────┘
```

### 4.2 前置检查详解

#### 4.2.1 依赖检查 (Dependency Check)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Dependency Check Flow                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

依赖检查流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  获取    │────▶│  解析    │────▶│  检查    │────▶│  解决    │────▶│  输出    │
│  依赖列表 │     │  依赖图   │     │  已安装  │     │  缺失项   │     │  结果    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘

依赖类型:
├── 工具依赖 (Tool Dependencies)
│   └── 其他已安装的工具
│
├── 系统依赖 (System Dependencies)
│   └── OS 级软件 (git, java, openssl 等)
│
└── 库依赖 (Library Dependencies)
    └── 运行时库 (Maven/npm/PyPI 包)

检查结果:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  依赖检查结果                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  目标工具: semgrep v1.31.0                                                       │
│                                                                                  │
│  ✅ 已满足的依赖:                                                                  │
│  ├── java >= 11.0           (已安装：java 17.0.2)                                │
│  ├── git >= 2.0             (已安装：git 2.38.1)                                 │
│  └── openssl >= 1.1         (已安装：openssl 3.0.7)                              │
│                                                                                  │
│  ⚠️ 可选依赖 (未安装，不影响安装):                                                 │
│  └── redis >= 6.0           (未安装，启用后可提升缓存性能)                        │
│                                                                                  │
│  ❌ 缺失的依赖:                                                                    │
│  └── postgres >= 14.0       (未安装，需要安装后继续使用)                          │
│                                                                                  │
│  建议操作:                                                                        │
│  ├── 一键安装 postgres [立即安装]                                                │
│  └── 跳过依赖检查 (不推荐) [强制安装]                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 兼容性验证 (Compatibility Check)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Compatibility Check Matrix                               │
└─────────────────────────────────────────────────────────────────────────────────┘

兼容性检查维度:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. Orion 版本兼容性                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具要求：Orion >= 1.0.0, < 3.0.0                                         │ │
│  │  当前版本：Orion 2.1.0                                                      │ │
│  │  检查结果：✅ 兼容                                                           │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  2. 操作系统兼容性                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具支持：Linux (amd64/arm64), macOS (amd64/arm64), Windows (amd64)       │ │
│  │  当前系统：macOS 14.0 (arm64)                                               │ │
│  │  检查结果：✅ 兼容                                                           │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  3. 已安装工具兼容性                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  检查与已安装工具的兼容性矩阵:                                               │ │
│  │                                                                              │ │
│  │  工具              已安装版本    兼容性检查           结果                    │ │
│  │  ─────────────────────────────────────────────────────────────────          │ │
│  │  trivy             0.46.0      semgrep 与 trivy 兼容   ✅                     │ │
│  │  sonarqube         9.9.2       semgrep 与 sonar 兼容   ✅                     │ │
│  │  codeql            2.12.0      功能重叠警告           ⚠️                     │ │
│  │                                                                              │ │
│  │  警告：codeql 与 semgrep 功能重叠，建议选择一个作为主要 SAST 工具                 │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  4. 配置兼容性                                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  检查是否与现有配置冲突:                                                     │ │
│  │  ├── 端口占用检查：8080 (空闲) ✅                                           │ │
│  │  ├── 环境变量检查：SEMGREP_* (无冲突) ✅                                    │ │
│  │  └── 文件路径检查：/opt/tools/semgrep (空闲) ✅                             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.3 资源预检 (Resource Pre-check)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Resource Pre-check                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

资源检查流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  获取    │────▶│  检查    │────▶│  对比    │────▶│  输出    │
│  要求    │     │  当前    │     │  阈值    │     │  结果    │
│  配置    │     │  资源    │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘

资源检查结果:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  资源预检报告 - semgrep v1.31.0                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  CPU 检查:                                                                       │
│  ├── 要求：最低 2 核，推荐 4 核                                                   │ │
│  ├── 可用：8 核                                                                  │ │
│  └── 结果：✅ 通过                                                                │ │
│                                                                                  │
│  内存检查:                                                                       │
│  ├── 要求：最低 512MB，推荐 2048MB                                               │ │
│  ├── 可用：4096MB (空闲)                                                         │ │
│  └── 结果：✅ 通过                                                                │ │
│                                                                                  │
│  磁盘检查:                                                                       │
│  ├── 要求：最低 1GB，推荐 10GB                                                   │ │
│  ├── 可用：50GB (空闲)                                                           │ │
│  └── 结果：✅ 通过                                                                │ │
│                                                                                  │
│  网络检查:                                                                       │
│  ├── 要求：允许出站连接 (semgrep.dev)                                            │ │
│  ├── 当前：出站连接正常 ✅                                                        │ │
│  └── 结果：✅ 通过                                                                │ │
│                                                                                  │
│  权限检查:                                                                       │
│  ├── 要求：/opt/tools 目录写权限                                                 │ │
│  ├── 当前：用户有写权限 ✅                                                        │ │
│  └── 结果：✅ 通过                                                                │ │
│                                                                                  │
│  总体结果: ✅ 所有检查通过，可以安装                                               │ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 安装执行流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Installation Execution                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

安装步骤时序图:
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  User   │  │  CLI    │  │  Server │  │ Storage │  │  Tool   │  │  Monitor│
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │            │            │            │
     │ 1. 安装请求 │            │            │            │            │
     │───────────▶│            │            │            │            │
     │            │            │            │            │            │
     │            │ 2. 创建安装任务         │            │            │
     │            │───────────▶│            │            │            │
     │            │            │            │            │            │
     │            │            │ 3. 下载工具包          │            │
     │            │            │───────────▶│            │            │
     │            │            │            │            │            │
     │            │            │ 4. 返回下载链接         │            │
     │            │            │◀───────────│            │            │
     │            │            │            │            │            │
     │            │ 5. 校验 Hash          │            │            │
     │            │◀───────────│            │            │            │
     │            │            │            │            │            │
     │            │ 6. 执行安装脚本        │            │            │
     │            │─────────────────────────────────────▶│            │
     │            │            │            │            │            │
     │            │            │ 7. 更新安装状态         │            │
     │            │───────────▶│            │            │            │
     │            │            │            │            │            │
     │            │            │ 8. 发布安装完成事件     │            │
     │            │            │────────────────────────────────────▶│
     │            │            │            │            │            │
     │ 9. 安装结果 │            │            │            │            │
     │◀───────────│            │            │            │            │
     │            │            │            │            │            │

安装脚本执行顺序:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. pre_install 脚本                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  #!/bin/bash                                                                │ │
│  │  echo "开始预安装检查..."                                                    │ │
│  │  check_disk_space                                                           │ │
│  │  backup_existing_config                                                     │ │
│  │  stop_existing_service                                                      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  2. install 步骤                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  ├── 解压工具包到 /opt/tools/semgrep/1.31.0                                 │ │
│  │  ├── 创建软链接 /opt/tools/semgrep/current -> 1.31.0                        │ │
│  │  ├── 添加 PATH: /opt/tools/semgrep/current/bin                              │ │
│  │  └── 设置文件权限 (chmod +x)                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  3. configure 步骤                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  ├── 创建配置目录 ~/.config/semgrep                                         │ │
│  │  ├── 写入默认配置文件                                                       │ │
│  │  └── 设置环境变量 SEMGREP_*                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  4. post_install 脚本                                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  #!/bin/bash                                                                │ │
│  │  echo "验证安装..."                                                          │ │
│  │  semgrep --version                                                          │ │
│  │  semgrep --health-check                                                     │ │
│  │  orion-tool register semgrep                                                │ │
│  │  echo "安装完成!"                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、工具升级机制 (Tool Upgrade Mechanism)

### 5.1 升级策略

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Upgrade Strategies                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

升级策略对比:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. 滚动升级 (Rolling Upgrade) - 推荐                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  适用场景：多实例部署，要求零停机                                           │ │
│  │                                                                              │ │
│  │  流程:                                                                       │ │
│  │  ├── Step 1: 升级实例 A (25% 流量)                                          │ │
│  │  ├── Step 2: 健康检查通过                                                   │ │
│  │  ├── Step 3: 升级实例 B (50% 流量)                                          │ │
│  │  ├── Step 4: 健康检查通过                                                   │ │
│  │  └── Step 5: 升级实例 C/D (100% 流量)                                       │ │
│  │                                                                              │ │
│  │  优点：零停机，风险可控                                                      │ │
│  │  缺点：升级时间较长                                                          │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  2. 蓝绿升级 (Blue-Green Upgrade) - 零停机                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  适用场景：关键业务，要求快速回滚                                           │ │
│  │                                                                              │ │
│  │  流程:                                                                       │ │
│  │  ├── 当前：Blue 环境运行 v1.0                                                │ │
│  │  ├── Step 1: 部署新版本到 Green 环境 (v2.0)                                  │ │
│  │  ├── Step 2: Green 环境健康检查                                              │ │
│  │  ├── Step 3: 切换流量到 Green 环境                                          │ │
│  │  └── Step 4: 保留 Blue 环境 24 小时作为备份                                    │ │
│  │                                                                              │ │
│  │  优点：瞬间切换，快速回滚                                                    │ │
│  │  缺点：需要双倍资源                                                          │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  3. 金丝雀升级 (Canary Upgrade) - 小流量验证                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  适用场景：重大版本升级，需要验证稳定性                                     │ │
│  │                                                                              │ │
│  │  流程:                                                                       │ │
│  │  ├── Step 1: 5% 流量导入新版本                                             │ │
│  │  ├── Step 2: 观察 1 小时 (指标正常)                                         │ │
│  │  ├── Step 3: 25% 流量导入新版本                                            │ │
│  │  ├── Step 4: 观察 2 小时 (指标正常)                                         │ │
│  │  ├── Step 5: 100% 流量导入新版本                                           │ │
│  │  └── Step 6: 完成升级                                                        │ │
│  │                                                                              │ │
│  │  优点：风险最小，问题影响范围小                                              │ │
│  │  缺点：升级周期长                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 升级流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Upgrade Flow                                      │
│                           (工具升级流程图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │  检测新版本  │
                                    │   Check     │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  读取发布说明 │
                                    │Release Notes│
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  兼容性检查   │
                                    │   Check     │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  备份当前状态 │
                                    │  Backup     │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   下载新版本     │          │   停止旧服务    │          │   通知用户      │
    │   Download      │          │   Stop Old    │          │   Notify        │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
              │                            │                            │
              └────────────────────────────┴────────────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  执行升级    │
                                    │  Upgrade    │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  启动新服务   │
                                    │  Start New  │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  健康检查    │
                                    │ Health Check│
                                    └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌───────────────┐         ┌───────────────┐
                    │ ✅ 升级成功    │         │ ❌ 升级失败    │
                    │               │         │               │
                    │ • 清理旧版本   │         │ • 自动回滚     │
                    │ • 更新注册表   │         │ • 通知管理员   │
                    │ • 发送通知     │         │ • 记录日志     │
                    └───────────────┘         └───────────────┘
```

### 5.3 回滚机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Rollback Mechanism                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚触发条件:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  自动回滚 (Auto Rollback):                                                       │
│  ├── 健康检查连续失败 3 次                                                         │
│  ├── 错误率超过阈值 (>5% in 5min)                                                │
│  ├── P99 延迟超过阈值 (>10s)                                                     │
│  └── 核心功能不可用                                                               │
│                                                                                  │
│  手动回滚 (Manual Rollback):                                                     │
│  ├── 管理员主动触发                                                               │
│  ├── 用户反馈严重问题                                                             │
│  └── 业务方要求回退                                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  触发    │────▶│  停止    │────▶│  恢复    │────▶│  启动    │────▶│  验证    │
│  回滚    │     │  新版本   │     │  旧版本   │     │  旧版本   │     │  回滚    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                │                │                │
                      │ 1. 停止新服务   │                │                │
                      │                │ 2. 恢复配置     │                │
                      │                │ 3. 恢复数据     │                │
                      │                │                │ 4. 启动旧服务   │
                      │                │                │                │ 5. 健康检查
                      │                │                │                │

版本保留策略:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  保留规则:                                                                       │
│  ├── 最多保留：最近 3 个版本                                                       │
│  ├── 保留时间：升级后保留 30 天                                                    │
│  └── 特殊情况：LTS 版本永久保留                                                   │
│                                                                                  │
│  示例 (semgrep):                                                                  │
│  ├── v1.32.0 (当前版本) - ✅ 保留                                                 │
│  ├── v1.31.0 (上一版本) - ✅ 保留                                                 │
│  ├── v1.30.0 (上上版本) - ✅ 保留                                                 │
│  └── v1.29.0 (更早版本) - ❌ 已清理                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、工具卸载流程 (Tool Uninstall Flow)

### 6.1 卸载流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Uninstall Flow                                    │
│                           (工具卸载流程图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │  用户点击    │
                                    │  "卸载" 按钮  │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   依赖检查   │
                                    │  Check If   │
                                    │  Dependent  │
                                    └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌───────────────┐         ┌───────────────┐
                    │ 有其他工具    │         │ 无依赖工具    │
                    │ 依赖此工具    │         │               │
                    │               │         │               │
                    │ ⚠️ 警告提示    │         │ ✅ 继续卸载    │
                    └───────┬───────┘         └───────┬───────┘
                              │                         │
                              │  用户确认强制卸载        │
                              └────────────┬────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  停止服务    │
                                    │   Stop      │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  数据备份    │
                                    │  Backup     │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   删除文件      │          │   清理配置      │          │   注销注册      │
    │   Delete Files  │          │   Clean Config  │          │   Unregister    │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
              │                            │                            │
              └────────────────────────────┴────────────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  发送事件    │
                                    │   Emit      │
                                    │   Event     │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  卸载完成    │
                                    │  Complete   │
                                    └─────────────┘
```

### 6.2 依赖检查详解

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Uninstall Dependency Check                             │
└─────────────────────────────────────────────────────────────────────────────────┘

依赖检查流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  查询    │────▶│  查找    │────▶│  分析    │────▶│  输出    │
│  依赖图   │     │  依赖项   │     │  影响    │     │  报告    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘

检查结果示例:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  卸载依赖检查报告 - semgrep v1.31.0                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ⚠️ 警告：以下工具依赖 semgrep                                                    │
│                                                                                  │
│  直接依赖:                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具              依赖类型    影响程度          建议                       │ │
│  │  ───────────────────────────────────────────────────────────────────        │ │
│  │  ai-code-review    强依赖     高 (功能失效)     先卸载此工具或切换规则引擎   │ │
│  │  security-scan     强依赖     高 (功能失效)     先卸载此工具                 │ │
│  │  pipeline-check    弱依赖     中 (降级)         可继续，部分功能受限         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  建议操作:                                                                       │
│  ├── 选项 1: 先卸载依赖工具 [查看依赖工具列表]                                   │
│  ├── 选项 2: 强制卸载 (不推荐，可能导致依赖工具故障) [强制卸载]                  │
│  └── 选项 3: 取消卸载 [取消]                                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 数据清理策略

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Data Cleanup Strategy                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

清理选项:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  默认选项 (推荐):                                                                 │
│  ├── ✅ 保留配置文件 (~/.config/semgrep)                                        │
│  ├── ✅ 保留扫描历史数据                                                         │
│  └── ✅ 保留自定义规则                                                           │
│                                                                                  │
│  可选选项:                                                                       │
│  ├── □ 删除配置文件 (卸载后无法恢复)                                             │
│  ├── □ 删除所有数据 (扫描历史、规则等)                                           │
│  └── □ 完全清理 (包括缓存和日志)                                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

清理范围:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  清理项目                     默认    可配置    恢复可能性                        │
│  ─────────────────────────────────────────────────────────────────               │
│  二进制文件                   删除    否        不可恢复                          │
│  系统 PATH 配置               删除    否        重新安装可恢复                    │
│  服务注册信息                 删除    否        重新安装可恢复                    │
│  配置文件                     保留    是        永久保留                          │
│  扫描历史数据                 保留    是        永久保留                          │
│  自定义规则                   保留    是        永久保留                          │
│  缓存数据                     删除    是        可重新生成                        │
│  日志文件                     保留    是        永久保留                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、工具评分系统 (Tool Rating System)

### 7.1 评分模型

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Rating Model                                      │
│                           (工具评分计算图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   综合评分      │
                                    │ Overall Score │
                                    │    (0-5 星)     │
                                    └────────┬────────┘
                                             │
          ┌──────────────────────────────────┼──────────────────────────────────┐
          │                                  │                                  │
          ▼                                  ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│   用户评分      │              │   使用统计      │              │   健康度        │
│ User Rating     │              │ Usage Stats     │              │ Health Score    │
│ (权重 40%)       │              │ (权重 35%)      │              │ (权重 25%)      │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                │                                │
         ▼                                ▼                                ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ • 平均星级       │              │ • 安装量        │              │ • 可用性        │
│ • 评分人数       │              │ • 活跃度        │              │ • 错误率        │
│ • 评价质量       │              │ • 留存率        │              │ • 响应时间      │
└─────────────────┘              └─────────────────┘              └─────────────────┘
```

### 7.2 评分计算算法

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Rating Calculation Algorithm                           │
└─────────────────────────────────────────────────────────────────────────────────┘

综合评分公式:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  overall_score = (user_rating * 0.40) + (usage_score * 0.35) + (health * 0.25)  │
│                                                                                  │
│  其中:                                                                           │
│  ├── user_rating: 用户评分归一化 (0-5)                                           │
│  │   └── 计算方式：加权平均 (考虑评分质量和时间衰减)                             │
│  │                                                                              │
│  ├── usage_score: 使用统计归一化 (0-5)                                           │
│  │   └── 计算方式：(安装量分位 + 活跃度分位 + 留存率分位) / 3                    │
│  │                                                                              │
│  └── health_score: 健康度归一化 (0-5)                                            │
│      └── 计算方式：(可用性 * 0.5 + (1-错误率) * 0.3 + 响应时间分 * 0.2)          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

用户评分计算:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  基础平均分:                                                                     │
│  base_avg = Σ(rating_i) / count                                                  │
│                                                                                  │
│  加权评分 (考虑评分者信誉和时间衰减):                                             │
│  weighted_rating = Σ(rating_i * credibility_i * decay_i) / Σ(credibility_i * decay_i)│
│                                                                                  │
│  其中:                                                                           │
│  ├── credibility_i: 评分者信誉分 (0.5-1.5)                                       │
│  │   └── 基于：历史评分质量、活跃程度、认证状态                                  │
│  │                                                                              │
│  └── decay_i: 时间衰减因子 (0.5-1.0)                                             │
│      └── 最近评分权重高，久远评分权重低                                          │
│      └── decay = exp(-days_since_rating / 90)                                    │
│                                                                                  │
│  贝叶斯平滑 (处理少量评分情况):                                                   │
│  final_rating = (count * weighted_rating + prior_count * prior_avg) / (count + prior_count)│
│                                                                                  │
│  其中:                                                                           │
│  ├── prior_count: 先验计数 (默认 10)                                             │
│  └── prior_avg: 先验平均分 (默认 3.5)                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 使用统计指标

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Usage Statistics Metrics                               │
└─────────────────────────────────────────────────────────────────────────────────┘

统计维度:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. 安装量 (Install Count)                                                       │
│  ├── 总安装数                                                                    │
│  ├── 新增安装数 (日/周/月)                                                       │
│  └── 活跃安装数 (最近 30 天使用过)                                                 │
│                                                                                  │
│  2. 活跃度 (Activity Level)                                                      │
│  ├── 日调用次数                                                                  │
│  ├── 周活跃用户数                                                                │
│  └── 月活跃团队数                                                                │
│                                                                                  │
│  3. 留存率 (Retention Rate)                                                      │
│  ├── 次日留存率                                                                  │
│  ├── 7 日留存率                                                                   │
│  └── 30 日留存率                                                                  │
│                                                                                  │
│  4. 使用深度 (Usage Depth)                                                       │
│  ├── 平均使用时长                                                                │
│  ├── 功能使用覆盖率                                                              │
│  └── 配置复杂度                                                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

指标采集:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  采集方式:                                                                       │
│  ├── 工具调用时自动上报                                                          │
│  │   └── 每次工具执行后发送指标到 NATS                                           │
│  │                                                                              │
│  ├── 定时聚合                                                                    │
│  │   └── 每小时聚合一次指标                                                      │
│  │                                                                              │
│  └── 实时计算                                                                    │
│      └── 使用 Flink/Spark Streaming 实时计算指标                                  │
│                                                                                  │
│  数据结构:                                                                       │
│  {                                                                               │
│    "tool_id": "semgrep",                                                         │
│    "version": "1.31.0",                                                          │
│    "tenant_id": 123,                                                             │
│    "team_id": 456,                                                               │
│    "operation": "scan",                                                          │
│    "timestamp": "2026-04-10T09:00:00Z",                                          │
│    "duration_ms": 3250,                                                          │
│    "status": "success",                                                          │
│    "input_size_bytes": 1024000,                                                  │
│    "resource_usage": {                                                           │
│      "cpu_ms": 2800,                                                             │
│      "memory_mb": 256                                                            │
│    }                                                                             │
│  }                                                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 健康度指标

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Health Score Metrics                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

健康度组成:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  健康度 = (可用性 * 0.5) + ((1 - 错误率) * 0.3) + (响应时间分 * 0.2)             │
│                                                                                  │
│  1. 可用性 (Availability) - 50% 权重                                             │
│  ├── 定义：健康检查通过率                                                        │
│  ├── 计算：成功检查次数 / 总检查次数                                             │
│  └── 检查频率：每 5 分钟一次                                                       │
│                                                                                  │
│  2. 错误率 (Error Rate) - 30% 权重                                               │
│  ├── 定义：工具调用失败率                                                        │
│  ├── 计算：失败次数 / 总调用次数                                                 │
│  └── 统计周期：最近 1 小时                                                         │
│                                                                                  │
│  3. 响应时间 (Response Time) - 20% 权重                                          │
│  ├── 定义：P95 响应时间                                                           │
│  ├── 评分标准:                                                                   │
│  │   ├── < 1s:    5 分 (优秀)                                                    │
│  │   ├── < 3s:    4 分 (良好)                                                    │
│  │   ├── < 5s:    3 分 (一般)                                                    │
│  │   ├── < 10s:   2 分 (较差)                                                    │
│  │   └── >= 10s:  1 分 (很差)                                                    │
│  └── 统计周期：最近 1 小时                                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

健康状态:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  健康分        状态        颜色        说明                                      │
│  ─────────────────────────────────────────────────────────────────────          │
│  4.5 - 5.0    🟢 Healthy   绿色        一切正常                                  │
│  3.5 - 4.5    🟡 Degraded  黄色        部分指标异常                              │
│  2.0 - 3.5    🟠 Warning   橙色        需要关注                                  │
│  0.0 - 2.0    🔴 Unhealthy 红色        需要立即处理                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、工具仓库管理 (Tool Repository Management)

### 8.1 仓库架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Repository Architecture                           │
│                           (工具仓库架构图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  Tool Market    │
                                    │    Client       │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
    │   Official      │            │   Private       │            │   Git-based     │
    │   Repository    │            │   Repository    │            │   Repository    │
    │   (官方仓库)     │            │   (私有仓库)     │            │   (Git 仓库)     │
    ├─────────────────┤            ├─────────────────┤            ├─────────────────┤
    │ • 官方认证工具   │            │ • 内部工具       │            │ • GitHub        │
    │ • 高质量保障     │            │ • 定制工具       │            │ • GitLab        │
    │ • 全球 CDN 加速   │            │ • 私有部署       │            │ • Bitbucket     │
    │ • 自动更新       │            │ • 内网访问       │            │ • 源码即仓库    │
    └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
              │                              │                              │
              └──────────────────────────────┴──────────────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  Repository     │
                                    │  Aggregation    │
                                    │  (仓库聚合层)    │
                                    └─────────────────┘
```

### 8.2 仓库类型详解

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Repository Types                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. 官方仓库 (Official Repository)                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  特点:                                                                           │
│  ├── 由 Orion 团队维护和运营                                                      │
│  ├── 所有工具经过严格审核和测试                                                  │
│  ├── 提供 SLA 保障 (99.9% 可用性)                                                 │
│  └── 全球 CDN 加速，下载速度快                                                    │
│                                                                                  │
│  工具来源:                                                                       │
│  ├── Orion 官方开发工具                                                          │
│  ├── 知名开源工具 (semgrep, trivy, sonarqube 等)                                  │
│  └── 商业工具的免费版本                                                          │
│                                                                                  │
│  接入流程:                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  1. 提交申请 → 2. 安全审查 → 3. 功能测试 → 4. 性能测试 → 5. 文档审查 → 6. 上架   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. 私有仓库 (Private Repository)                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  特点:                                                                           │
│  ├── 企业/组织自建仓库                                                           │
│  ├── 内网部署，数据不出境                                                        │
│  ├── 支持自定义工具                                                              │
│  └── 可与官方仓库同步                                                            │
│                                                                                  │
│  适用场景:                                                                       │
│  ├── 内部自研工具分享                                                            │
│  ├── 修改版开源工具                                                              │
│  ├── 敏感/合规要求工具                                                           │
│  └── 网络隔离环境                                                                │
│                                                                                  │
│  部署方式:                                                                       │
│  ├── Docker 容器部署 (推荐)                                                       │
│  ├── Helm Chart 部署                                                             │
│  └── 二进制直接部署                                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. Git 仓库 (Git-based Repository)                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  特点:                                                                           │
│  ├── 以 Git 仓库形式存储工具元数据和包                                             │
│  ├── 支持 GitHub, GitLab, Bitbucket 等                                           │
│  ├── 版本控制天然支持                                                            │
│  └── 社区贡献友好                                                                │
│                                                                                  │
│  目录结构:                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  orion-tools/                                                                │ │
│  │  ├── index.json                    # 工具索引                               │ │
│  │  ├── tools/                                                                  │ │
│  │  │   ├── semgrep/                                                           │ │
│  │  │   │   ├── metadata.json         # 工具元数据                             │ │
│  │  │   │   ├── versions/             # 版本目录                               │ │
│  │  │   │   │   ├── 1.31.0.json                                                │ │
│  │  │   │   │   └── 1.30.0.json                                                │ │
│  │  │   │   └── packages/             # 工具包                                 │ │
│  │  │   │       ├── semgrep-linux-amd64                                        │ │
│  │  │   │       └── semgrep-darwin-arm64                                       │ │
│  │  │   └── trivy/                                                             │ │
│  │  │       └── ...                                                            │ │
│  │  └── categories/                   # 分类索引                                │ │
│  │      └── security.json                                                      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 仓库同步机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Repository Sync Mechanism                              │
└─────────────────────────────────────────────────────────────────────────────────┘

同步策略:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. 官方仓库 → 私有仓库 (下行同步)                                               │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  同步模式:                                                                   │ │
│  │  ├── 全量同步：定期 (每周) 全量同步所有工具                                     │ │
│  │  ├── 增量同步：检测变更，同步更新 (每日)                                     │ │
│  │  └── 按需同步：用户触发时同步指定工具                                        │ │
│  │                                                                              │ │
│  │  冲突处理:                                                                   │ │
│  │  ├── 官方版本优先                                                              │ │
│  │  ├── 私有修改可保留 (重命名)                                                 │ │
│  │  └── 手动解决冲突                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  2. 私有仓库 → 官方仓库 (上行贡献)                                               │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  贡献流程:                                                                   │ │
│  │  ├── 提交 PR 到官方仓库                                                       │ │
│  │  ├── 官方审核 (安全 + 功能)                                                   │ │
│  │  ├── 测试验证                                                                │ │
│  │  └── 合并上架                                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

同步状态监控:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  仓库              最后同步时间     同步状态     待同步工具     错误数            │
│  ─────────────────────────────────────────────────────────────────────          │
│  官方仓库          -                ✅ 正常       -              0                │
│  私有仓库 (内网)    2026-04-10 08:00  ✅ 正常       0              0                │
│  GitHub Mirror     2026-04-10 06:00  ⚠️ 延迟       3              0                │
│  GitLab Mirror     2026-04-09 22:00  ❌ 失败       -              2                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、工具依赖解析 (Tool Dependency Resolution)

### 9.1 依赖解析算法

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Dependency Resolution                                  │
│                           (工具依赖解析图)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

依赖解析流程:
                                    ┌─────────────┐
                                    │  解析请求    │
                                    │   Request   │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  构建依赖图   │
                                    │  Build Graph│
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  检测环      │
                                    │Detect Cycle │
                                    └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌───────────────┐         ┌───────────────┐
                    │  发现环        │         │  无环         │
                    │               │         │               │
                    │ ❌ 报告错误    │         │ ✅ 拓扑排序    │
                    └───────────────┘         └───────┬───────┘
                                                      │
                                                      ▼
                                            ┌─────────────┐
                                            │  版本选择    │
                                            │Version Select│
                                            └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  冲突解决    │
                                            │  Resolve    │
                                            └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │  安装顺序    │
                                            │  Order      │
                                            └─────────────┘
```

### 9.2 循环依赖检测

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Circular Dependency Detection                          │
└─────────────────────────────────────────────────────────────────────────────────┘

检测算法 (DFS):
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  function detectCycle(graph):                                                    │
│      visited = set()      # 已访问节点                                           │
│      recStack = set()     # 当前递归栈                                           │
│      path = []            # 当前路径                                              │
│      cycles = []          # 检测到的环                                           │
│                                                                                  │
│      for node in graph.nodes:                                                    │
│          if node not in visited:                                                 │
│              dfs(node, visited, recStack, path, cycles)                          │
│                                                                                  │
│      return cycles                                                               │
│                                                                                  │
│  function dfs(node, visited, recStack, path, cycles):                            │
│      visited.add(node)                                                           │
│      recStack.add(node)                                                          │
│      path.append(node)                                                           │
│                                                                                  │
│      for neighbor in graph.neighbors(node):                                      │
│          if neighbor not in visited:                                             │
│              dfs(neighbor, visited, recStack, path, cycles)                      │
│          elif neighbor in recStack:                                              │
│              # 发现环！                                                           │
│              cycle_start = path.index(neighbor)                                  │
│              cycle = path[cycle_start:] + [neighbor]                             │
│              cycles.append(cycle)                                                │
│                                                                                  │
│      path.pop()                                                                  │
│      recStack.remove(node)                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

环检测示例:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  依赖图:                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                              │ │
│  │    semgrep ──────→ ai-code-review                                            │ │
│  │       ↑               │                                                      │ │
│  │       │               ▼                                                      │ │
│  │    security-scan ←────┘                                                      │ │
│  │       │                                                                      │ │
│  │       └──────────────┘ (环!)                                                 │ │
│  │                                                                              │ │
│  │  检测到的环：semgrep → ai-code-review → security-scan → semgrep              │ │
│  │                                                                              │ │
│  │  解决方案:                                                                   │ │
│  │  ├── 移除 security-scan 对 semgrep 的依赖                                      │ │
│  │  └── 或将依赖改为可选                                                         │ │
│  │                                                                              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 版本冲突解决

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Version Conflict Resolution                            │
└─────────────────────────────────────────────────────────────────────────────────┘

冲突场景:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  场景 1: 直接版本冲突                                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具 A 依赖 semgrep >= 1.30                                                  │ │
│  │  工具 B 依赖 semgrep < 1.30                                                   │ │
│  │                                                                              │ │
│  │  解决方案:                                                                   │ │
│  │  ├── 选项 1: 选择满足所有约束的版本 (如果存在)                                 │ │
│  │  ├── 选项 2: 升级冲突的工具到兼容版本                                        │ │
│  │  └── 选项 3: 使用多版本共存 (沙箱隔离)                                       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  场景 2: 传递依赖冲突                                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具 A → 工具 C → semgrep v1.30                                             │ │
│  │  工具 B → 工具 D → semgrep v1.31                                             │ │
│  │                                                                              │ │
│  │  解决方案:                                                                   │ │
│  │  ├── 选项 1: 统一升级到 v1.31 (如果 A→C 兼容)                                  │ │
│  │  ├── 选项 2: 降级到 v1.30 (如果 B→D 兼容)                                      │ │
│  │  └── 选项 3: 允许两个版本共存                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  场景 3: 平台版本冲突                                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  工具 A 要求 Orion >= 2.0                                                     │ │
│  │  工具 B 要求 Orion < 2.0                                                      │ │
│  │  当前 Orion = 1.5                                                            │ │
│  │                                                                              │ │
│  │  解决方案:                                                                   │ │
│  │  └── 升级 Orion 到 2.0+ (如果工具 B 有新版本支持)                               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

解决策略优先级:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  策略                          优先级    适用场景                                │
│  ─────────────────────────────────────────────────────────────────────          │
│  1. 寻找兼容版本               最高     存在满足所有约束的版本                    │
│  2. 升级冲突方                 高       冲突方有新版本                            │
│  3. 降级请求方                 中       请求方可接受旧版本                        │
│  4. 多版本共存                 低       无法解决时                               │
│  5. 手动干预                   最低     上述都失败时                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 依赖图可视化

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Dependency Graph Visualization                         │
└─────────────────────────────────────────────────────────────────────────────────┘

示例依赖图 (以安全扫描场景为例):
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                           ┌─────────────┐                                        │
│                           │  Pipeline   │                                        │
│                           └──────┬──────┘                                        │
│                                  │                                                 │
│              ┌───────────────────┼───────────────────┐                            │
│              │                   │                   │                            │
│              ▼                   ▼                   ▼                            │
│    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                        │
│    │ ai-code-    │     │ security-   │     │ quality-    │                        │
│    │ review      │     │ scan        │     │ check       │                        │
│    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                        │
│           │                   │                   │                                │
│     ┌─────┴─────┐       ┌─────┴─────┐           │                                │
│     │           │       │           │           │                                │
│     ▼           ▼       ▼           ▼           ▼                                │
│ ┌───────┐  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐                          │
│ │semgrep│  │llm-   │ │trivy  │ │gitleaks│ │sonarqube  │                          │
│ │       │  │api    │ │       │ │       │ │           │                          │
│ └───┬───┘  └───┬───┘ └───┬───┘ └───┬───┘ └─────┬─────┘                          │
│     │          │         │         │           │                                  │
│     │          │    ┌────┴────┐   │           │                                  │
│     │          │    │postgres │   │           │                                  │
│     │          │    └─────────┘   │           │                                  │
│     │          │                 │           │                                  │
│     └──────────┴─────────────────┴───────────┘                                  │
│                                │                                                  │
│                                ▼                                                  │
│                         ┌─────────────┐                                          │
│                         │   harbor    │                                          │
│                         └─────────────┘                                          │
│                                                                                  │
│  图例:                                                                            │
│  ├── 实线箭头：强依赖 (必须安装)                                                  │
│  └── 虚线箭头：弱依赖 (可选)                                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

安装顺序 (拓扑排序结果):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  顺序    工具              依赖                         说明                     │
│  ─────────────────────────────────────────────────────────────────────────      │
│  1       postgres          无                           基础依赖                  │
│  2       harbor            无                           基础依赖                  │
│  3       semgrep           postgres                     无其他依赖                │
│  4       trivy             harbor                       依赖 harbor               │
│  5       gitleaks          无                           无其他依赖                │
│  6       sonarqube         postgres                     依赖 postgres             │
│  7       llm-api           无                           无其他依赖                │
│  8       ai-code-review    semgrep, llm-api             依赖两者                  │
│  9       security-scan     trivy, gitleaks              依赖两者                  │
│  10      quality-check     sonarqube                    依赖 sonarqube            │
│  11      Pipeline          ai-code-review,              最后安装                  │
│                          security-scan, quality-check                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 十、工具监控 (Tool Monitoring)

### 10.1 监控指标体系

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Monitoring Metrics                                │
└─────────────────────────────────────────────────────────────────────────────────┘

监控维度:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  1. 安装成功率 (Installation Success Rate)                                       │
│  ├── 定义：成功安装次数 / 总安装尝试次数                                         │
│  ├── 目标：> 95%                                                                 │
│  ├── 告警阈值：< 90% 持续 5 分钟                                                   │
│  └── 细分维度：按工具、按平台、按版本                                            │
│                                                                                  │
│  2. 活跃度 (Activity Level)                                                      │
│  ├── 定义：工具调用频率                                                          │
│  ├── 指标：调用次数/分钟、活跃安装数                                             │
│  └── 细分维度：按团队、按环境、按操作类型                                        │
│                                                                                  │
│  3. 错误率 (Error Rate)                                                          │
│  ├── 定义：工具调用失败次数 / 总调用次数                                         │
│  ├── 目标：< 1%                                                                  │
│  ├── 告警阈值：> 5% 持续 5 分钟                                                    │
│  └── 细分维度：按错误类型、按工具版本                                            │
│                                                                                  │
│  4. 资源使用 (Resource Usage)                                                    │
│  ├── CPU 使用率：平均、P95、峰值                                                  │
│  ├── 内存使用：平均、P95、峰值                                                   │
│  ├── 磁盘 IO：读写速率                                                            │
│  └── 网络 IO：出入向流量                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

指标采集架构:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │   Tool      │────▶│   Agent     │────▶│   NATS      │────▶│ Prometheus  │    │
│  │  Runtime    │     │  (Sidecar)  │     │  JetStream  │     │   (TSDB)    │    │
│  └─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘    │
│                                                                     │            │
│                                                                     ▼            │
│                                                             ┌─────────────┐      │
│                                                             │  Grafana    │      │
│                                                             │ (Dashboard) │      │
│                                                             └─────────────┘      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 监控 Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Tool Monitoring Dashboard                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  🔧 工具监控大屏 - semgrep                          刷新：每 30 秒     导出报告     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  📊 概览 (最近 1 小时)                                                            │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────┐             │
│  │ 调用次数    │ 成功率      │ P95 耗时    │ CPU 使用    │ 内存使用    │             │
│  │ 2,345      │ 99.8%      │ 4.2s       │ 45%        │ 1.2GB       │             │
│  │ ↑ 15%      │ ↑ 0.2%     │ ↓ 0.3s     │ ↑ 5%       │ ↓ 50MB      │             │
│  └────────────┴────────────┴────────────┴────────────┴────────────┘             │
│                                                                                  │
│  📈 调用趋势 (最近 24 小时)                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  00:00  ▓▓▓▓▓▓▓▓ 150                                                       │ │
│  │  02:00  ▓▓▓▓▓▓▓▓▓▓ 200                                                      │ │
│  │  04:00  ▓▓▓▓▓▓▓▓ 150                                                       │ │
│  │  06:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 400                                             │ │
│  │  08:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 800                                     │ │
│  │  10:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 1000                            │ │
│  │  12:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 850                                     │ │
│  │  14:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 900                               │ │
│  │  16:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 1200                    │ │
│  │  18:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 1100                          │ │
│  │  20:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 800                                     │ │
│  │  22:00  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 400                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ⚠️ 异常检测                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  • 16:30 调用量突增 50% (原因：批量扫描任务)             [已解决] [忽略]      │ │
│  │  • 14:15 错误率短暂升高到 3% (原因：网络抖动)            [已解决] [忽略]      │ │
│  │  • 10:00 P99 延迟升高到 8s (原因：大文件扫描)            [观察中] [忽略]      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  👥 团队使用排行                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  1. payment-team     ████████████████████████ 3,456 次  (成功率 99.9%)      │ │
│  │  2. order-team       ███████████████████ 2,890 次        (成功率 99.7%)     │ │
│  │  3. user-team        █████████████████ 2,100 次          (成功率 99.5%)     │ │
│  │  4. platform-team    ████████████ 1,234 次               (成功率 99.9%)     │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  📉 错误分布                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  timeout           ████████ 45%   ████████████████████                      │ │
│  │  parse_error       ████ 25%       ██████████                                │ │
│  │  config_error      ██ 15%         ██████                                    │ │
│  │  other             ███ 15%        ██████                                    │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 告警规则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Alert Rules                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

告警规则配置:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  P0 - 严重告警 (立即响应)                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  规则 1: 工具不可用                                                           │ │
│  │  ├── 条件：健康检查失败 > 3 次连续                                             │ │
│  │  ├── 持续时间：15 分钟                                                         │ │
│  │  ├── 通知渠道：电话 + 短信 + Slack                                            │ │
│  │  └── 自动操作：尝试重启                                                      │ │
│  │                                                                              │ │
│  │  规则 2: 安装成功率下降                                                       │ │
│  │  ├── 条件：成功率 < 80%                                                       │ │
│  │  ├── 持续时间：5 分钟                                                         │ │
│  │  ├── 通知渠道：电话 + Slack                                                   │ │
│  │  └── 自动操作：暂停新版本发布                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  P1 - 重要告警 (1 小时内响应)                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  规则 3: 错误率升高                                                           │ │
│  │  ├── 条件：错误率 > 5%                                                        │ │
│  │  ├── 持续时间：5 分钟                                                         │ │
│  │  ├── 通知渠道：Slack + 邮件                                                   │ │
│  │  └── 自动操作：记录详细日志                                                  │ │
│  │                                                                              │ │
│  │  规则 4: 响应时间变慢                                                         │ │
│  │  ├── 条件：P95 延迟 > 10s                                                      │ │
│  │  ├── 持续时间：10 分钟                                                         │ │
│  │  ├── 通知渠道：Slack                                                          │ │
│  │  └── 自动操作：增加实例 (如适用)                                             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  P2 - 警告告警 (24 小时内处理)                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  规则 5: 资源使用过高                                                         │ │
│  │  ├── 条件：CPU > 80% 或 内存 > 90%                                           │ │
│  │  ├── 持续时间：15 分钟                                                         │ │
│  │  ├── 通知渠道：Slack                                                          │ │
│  │  └── 自动操作：发送扩容建议                                                  │ │
│  │                                                                              │ │
│  │  规则 6: 工具版本过旧                                                         │ │
│  │  ├── 条件：当前版本 < 最新稳定版 - 2                                          │ │
│  │  ├── 持续时间：7 天                                                            │ │
│  │  ├── 通知渠道：邮件                                                            │ │
│  │  └── 自动操作：发送升级通知                                                  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 十一、附录 (Appendix)

### 11.1 API 设计参考

```yaml
# 工具市场 REST API 设计
api:
  base_path: /api/v1/marketplace
  
  endpoints:
    # 工具发现
    - GET    /tools                          # 获取工具列表
    - GET    /tools/{tool_name}              # 获取工具详情
    - GET    /tools/{tool_name}/versions     # 获取版本列表
    - GET    /tools/{tool_name}/stats        # 获取使用统计
    
    # 搜索
    - GET    /search                         # 搜索工具
    - GET    /search/suggest                 # 搜索建议
    - GET    /categories                     # 获取分类列表
    - GET    /categories/{id}/tools          # 获取分类下工具
    
    # 排行榜
    - GET    /rankings/installs              # 安装量排行
    - GET    /rankings/rating                # 评分排行
    - GET    /rankings/trending              # 趋势排行
    - GET    /rankings/active                # 活跃度排行
    
    # 工具操作
    - POST   /tools/{tool_name}/install      # 安装工具
    - POST   /tools/{tool_name}/upgrade      # 升级工具
    - POST   /tools/{tool_name}/uninstall    # 卸载工具
    - GET    /tools/{tool_name}/install-status # 获取安装状态
    
    # 评分系统
    - GET    /tools/{tool_name}/ratings      # 获取评分
    - POST   /tools/{tool_name}/ratings      # 提交评分
    - GET    /tools/{tool_name}/reviews      # 获取评论
    - POST   /tools/{tool_name}/reviews      # 提交评论
    
    # 依赖管理
    - GET    /tools/{tool_name}/dependencies # 获取工具依赖
    - GET    /tools/{tool_name}/dependents   # 获取依赖此工具的工具
    - GET    /tools/dependency-graph         # 获取依赖图
    - POST   /tools/resolve-dependencies     # 解析依赖
    
    # 仓库管理
    - GET    /repositories                   # 获取仓库列表
    - POST   /repositories                   # 添加仓库
    - DELETE /repositories/{id}              # 删除仓库
    - POST   /repositories/{id}/sync         # 同步仓库
    
    # 监控
    - GET    /metrics/{tool_name}            # 获取工具指标
    - GET    /health/{tool_name}             # 获取健康状态
    - GET    /alerts                         # 获取告警列表
```

### 11.2 术语表

| 术语 | 定义 |
|------|------|
| **Tool Marketplace** | 工具市场，提供工具发现、安装、升级、卸载等能力的平台 |
| **Repository** | 工具仓库，存储工具元数据和工具包的存储位置 |
| **Dependency Resolution** | 依赖解析，确定工具安装顺序和版本选择的过程 |
| **Health Check** | 健康检查，定期检查工具可用性的机制 |
| **Rolling Upgrade** | 滚动升级，逐实例升级以实现零停机的策略 |
| **Blue-Green Deployment** | 蓝绿部署，通过切换流量实现快速升级和回滚的策略 |
| **Canary Release** | 金丝雀发布，小流量验证新版本稳定性的策略 |
| **SLA** | Service Level Agreement，服务等级协议 |

### 11.3 参考文档

| 文档 | 链接 |
|------|------|
| 工具管理中心设计 | `docs/architecture/工具管理中心设计.md` |
| 平台服务拆分设计 | `docs/architecture/platform-service-split-implementation.md` |

### 11.4 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

### 11.5 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 优先级：P2 | 维护团队：Orion Platform Team_
