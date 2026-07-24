# Skill Marketplace Design (Skill 市场设计)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 设计完成  
**作者**: AI 团队 + 架构师团队  
**优先级**: P2  
**评审人**: 架构委员会

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台 Skill 市场的完整架构和实现方案。Skill 市场是 Orion 平台中 AI 能力的分发、管理和运营中心，为开发者和用户提供一站式 AI Skill 发现、安装、使用和反馈平台。

### 设计范围

| 模块 | 核心职责 | 优先级 |
|------|---------|--------|
| Skill 存储 | Skill 包存储、版本管理、元数据管理 | P0 |
| Skill 索引 | 全文索引、分类索引、标签索引 | P0 |
| Skill 搜索 | 关键词搜索、筛选搜索、语义搜索 | P0 |
| Skill 分发 | 下载安装、版本分发、CDN 加速 | P0 |
| Skill 发现 | 分类浏览、热门推荐、个性化推荐 | P1 |
| Skill 安装 | 依赖检查、兼容性验证、权限申请 | P1 |
| Skill 升级 | 版本对比、迁移脚本、回滚支持 | P1 |
| Skill 卸载 | 依赖检查、数据清理、配置恢复 | P1 |
| Skill 评分 | 星级评分、使用统计、用户反馈 | P1 |
| Skill 审核 | 自动扫描、人工审核、安全验证 | P0 |
| Skill 沙箱 | 资源限制、超时控制、输出过滤 | P0 |

### 预期收益量化

| 指标 | 目标值 | 衡量方式 |
|------|--------|---------|
| Skill 数量 | 首年 100+ | 上架 Skill 总数 |
| 安装转化率 | >30% | 浏览→安装转化 |
| 用户满意度 | >4.5 星 | 平均评分 |
| 审核通过率 | >80% | 提交→通过比例 |
| 安装成功率 | >99% | 安装成功/尝试次数 |
| 平均安装时间 | <5 秒 | 点击→完成时间 |

---

## 一、Skill 市场架构 (Skill Marketplace Architecture)

### 1.1 整体架构设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Marketplace Architecture                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   API Gateway   │
                                    │   (Kong/Nginx)  │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   Discovery     │          │   Management    │          │   Execution     │
    │   Service       │          │   Service       │          │   Service       │
    │                 │          │                 │          │                 │
    │ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
    │ │ Search      │ │          │ │ Install     │ │          │ │ Sandbox     │ │
    │ │ Engine      │ │          │ │ Manager     │ │          │ │ Runtime     │ │
    │ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
    │ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
    │ │ Recommend   │ │          │ │ Upgrade     │ │          │ │ Resource    │ │
    │ │ Engine      │ │          │ │ Manager     │ │          │ │ Limiter     │ │
    │ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
    │ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
    │ │ Rank        │ │          │ │ Uninstall   │ │          │ │ Timeout     │ │
    │ │ Calculator  │ │          │ │ Manager     │ │          │ │ Controller  │ │
    │ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
    │                 │          │                 │          │                 │
    │ DB: skill_idx   │          │ DB: skill_meta  │          │ DB: skill_exec  │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
             │                            │                            │
             │         ┌──────────────────┴────────────────────────────┤
             │         │                                               │
             ▼         ▼                                               ▼
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                            Event Bus (NATS JetStream)                        │
    │   Topics: skill.installed, skill.upgraded, skill.uninstalled, skill.rated   │
    └─────────────────────────────────────────────────────────────────────────────┘
             │                            │                            │
             ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   Storage       │          │   Registry      │          │   CDN           │
    │   Service       │          │   Service       │          │   Service       │
    │                 │          │                 │          │                 │
    │ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
    │ │ Object      │ │          │ │ Skill       │ │          │ │ Package     │ │
    │ │ Storage     │ │          │ │ Registry    │ │          │ │ Cache       │ │
    │ │ (MinIO/S3)  │ │          │ │ (PostgreSQL)│ │          │ │ (Edge)      │ │
    │ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
    │ ┌─────────────┐ │          │ ┌─────────────┐ │          │ ┌─────────────┐ │
    │ │ Version     │ │          │ │ Author      │ │          │ │ Download    │ │
    │ │ Store       │ │          │ │ Registry    │ │          │ │ Mirror      │ │
    │ └─────────────┘ │          │ └─────────────┘ │          │ └─────────────┘ │
    │                 │          │                 │          │                 │
    │ Storage: blobs  │          │ DB: skills      │          │ CDN: global     │
    └─────────────────┘          └─────────────────┘          └─────────────────┘
```

### 1.2 核心组件说明

#### 1.2.1 存储服务 (Storage Service)

| 职责 | 详细说明 | 技术选型 |
|------|---------|---------|
| Skill 包存储 | 存储 Skill 的完整包内容（定义 + 实现 + 测试） | MinIO/S3 |
| 版本管理 | 支持多版本并存，版本回滚 | 对象版本控制 |
| 大文件处理 | 支持大 Skill 包分片上传下载 | 分片上传 |
| 存储优化 | 重复数据删除、压缩存储 | 去重 + GZIP |

#### 1.2.2 索引服务 (Index Service)

| 职责 | 详细说明 | 技术选型 |
|------|---------|---------|
| 全文索引 | Skill 名称、描述、文档全文检索 | Elasticsearch |
| 分类索引 | 按分类、标签、作者建立索引 | inverted index |
| 实时更新 | Skill 变更后秒级更新索引 | event-driven |
| 搜索优化 | 拼写纠错、同义词、搜索建议 | ES analyzer |

#### 1.2.3 搜索服务 (Search Service)

| 职责 | 详细说明 | 技术选型 |
|------|---------|---------|
| 关键词搜索 | 支持布尔查询、模糊匹配 | Elasticsearch |
| 筛选搜索 | 按分类、标签、评分、下载量筛选 | filter query |
| 语义搜索 | 基于向量相似度的语义匹配 | Vector DB |
| 搜索排序 | 相关性 + 热度 + 评分综合排序 | custom ranking |

#### 1.2.4 分发服务 (Distribution Service)

| 职责 | 详细说明 | 技术选型 |
|------|---------|---------|
| 下载管理 | 支持断点续传、多线程下载 | HTTP Range |
| CDN 加速 | 全球节点缓存，就近下载 | CloudFront/网宿 |
| 版本选择 | 自动推荐稳定版本，支持指定版本 | version constraint |
| 离线包 | 支持离线安装包导出 | tar.gz 包 |

### 1.3 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Marketplace Data Flow                            │
└─────────────────────────────────────────────────────────────────────────────────┘

Skill 发布者                              Skill 市场                                Skill 使用者
    │                                       │                                          │
    │  1. 提交 Skill 包                        │                                          │
    ├──────────────────────────────────────>│                                          │
    │                                       │                                          │
    │                                       │  2. 自动扫描 (安全/合规/质量)               │
    │                                       │──┐                                       │
    │                                       ││ │                                       │
    │                                       │◄─┘                                       │
    │                                       │                                          │
    │                                       │  3. 人工审核 (可选)                        │
    │                                       │──┐                                       │
    │                                       ││ │                                       │
    │                                       │◄─┘                                       │
    │                                       │                                          │
    │  4. 审核通过，上架                       │                                          │
    │<──────────────────────────────────────│                                          │
    │                                       │                                          │
    │                                       │  5. 浏览/搜索 Skill                        │
    │                                       │<─────────────────────────────────────────│
    │                                       │                                          │
    │                                       │  6. 查看详情                             │
    │                                       │<─────────────────────────────────────────│
    │                                       │                                          │
    │                                       │  7. 点击安装                             │
    │                                       │<─────────────────────────────────────────│
    │                                       │                                          │
    │                                       │  8. 依赖检查 + 权限确认                    │
    │                                       │──┐                                       │
    │                                       ││ │                                       │
    │                                       │◄─┘                                       │
    │                                       │                                          │
    │                                       │  9. 下载 Skill 包                          │
    │                                       │──┐                                       │
    │                                       ││ │                                       │
    │                                       │◄─┘                                       │
    │                                       │                                          │
    │                                       │  10. 安装确认                            │
    │                                       │─────────────────────────────────────────>│
    │                                       │                                          │
    │                                       │  11. 使用 Skill                          │
    │                                       │<─────────────────────────────────────────│
    │                                       │                                          │
    │                                       │  12. 评分/反馈                           │
    │                                       │<─────────────────────────────────────────│
    │                                       │                                          │
```

---

## 二、Skill 元数据模型 (Skill Metadata Model)

### 2.1 元数据全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Metadata Model                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Skill                                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                       │
│  │   Basic Info        │                                                       │
│  │   ─────────         │                                                       │
│  │   • id (UUID)       │                                                       │
│  │   • name            │                                                       │
│  │   • version         │                                                       │
│  │   • description     │                                                       │
│  │   • homepage        │                                                       │
│  │   • repository      │                                                       │
│  │   • documentation   │                                                       │
│  └─────────────────────┘                                                       │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   Author Info       │  │   Category Info     │  │   Version Info      │     │
│  │   ───────────       │  │   ────────────      │  │   ────────────      │     │
│  │   • author_name     │  │   • category_id     │  │   • semver          │     │
│  │   • author_email    │  │   • subcategory_id  │  │   • changelog       │     │
│  │   • author_id       │  │   • tags[]          │  │   • release_date    │     │
│  │   • organization    │  │   • categories[]    │  │   • is_stable       │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   IO Schema         │  │   Config Schema     │  │   Dependency Info   │     │
│  │   ─────────         │  │   ─────────────     │  │   ──────────────    │     │
│  │   • input_schema    │  │   • config_schema   │  │   • orion_version   │     │
│  │   • output_schema   │  │   • config_items[]  │  │   • required_skills │     │
│  │   • examples[]      │  │   • defaults{}      │  │   • optional_deps   │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   Permission Info   │  │   Runtime Info      │  │   Quality Info      │     │
│  │   ──────────────    │  │   ────────────      │  │   ────────────      │     │
│  │   • permissions[]   │  │   • timeout_ms      │  │   • rating          │     │
│  │   • scope           │  │   • memory_limit    │  │   • review_count    │     │
│  │   • data_access[]   │  │   • cpu_limit       │  │   • download_count  │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   Lifecycle Info    │  │   Audit Info        │  │   Distribution Info │     │
│  │   ─────────────     │  │   ──────────        │  │   ───────────────   │     │
│  │   • status          │  │   • created_at      │  │   • cdn_urls{}      │     │
│  │   • published_at    │  │   • updated_at      │  │   • mirror_urls{}   │     │
│  │   • deprecated_at   │  │   • published_by    │  │   • checksum        │     │
│  │   • end_of_life     │  │   • audit_status    │  │   • size_bytes      │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 元数据详细定义

```yaml
# Skill 元数据完整定义
# 文件名：skill.yaml

# ==================== 基本信息 ====================
id: "skill_01a2b3c4d5e6f7g8h9i0"  # 全局唯一 ID (UUID)
name: "code-review-skill"         # Skill 名称（唯一标识，小写字母 + 连字符）
version: "1.2.3"                   # 语义化版本 (SemVer)
description: "AI 代码审查技能，自动检测代码中的安全漏洞、性能问题和最佳实践违例"
keywords:                          # 搜索关键词
  - code-review
  - security
  - static-analysis
  - ai-assistant
homepage: "https://skills.orion.internal/code-review"
repository: "https://gitlab.internal/ai-skills/code-review"
documentation: "https://docs.orion.internal/skills/code-review"
license: "Apache-2.0"              # 开源许可证

# ==================== 作者信息 ====================
author:
  name: "AI 团队"
  email: "ai-team@company.com"
  id: "team_ai_001"                # 作者 ID（关联用户/团队系统）
  organization: "Orion Platform"
  verified: true                   # 是否认证作者

# ==================== 分类信息 ====================
category:
  primary: "code-development"      # 主分类
  secondary: "code-quality"        # 子分类
  tags:                            # 标签列表（用于筛选和推荐）
    - code-review
    - security
    - performance
    - best-practice
    - static-analysis

# ==================== 版本信息 ====================
version_info:
  semver:
    major: 1
    minor: 2
    patch: 3
  prerelease: ""                   # 预发布标识（如 rc1, beta2）
  build_metadata: ""               # 构建元数据
  changelog: |
    ## [1.2.3] - 2026-04-10
    ### Added
    - 新增 TypeScript 语言支持
    - 新增自定义规则配置
    
    ### Fixed
    - 修复 Python 缩进检测误报问题
    - 修复大文件处理超时问题
    
    ### Changed
    - 优化审查速度，减少 30% 响应时间
  release_date: "2026-04-10T10:00:00Z"
  is_stable: true                  # 是否稳定版本
  is_latest: true                  # 是否最新版本
  is_deprecated: false             # 是否已废弃

# ==================== 依赖信息 ====================
dependencies:
  orion_version: ">=1.0.0"         # 最低 Orion 版本要求
  required_skills:                 # 依赖的其他 Skill
    - name: "llm-call-skill"
      version: ">=2.0.0"
    - name: "file-read-skill"
      version: ">=1.0.0"
  optional_dependencies:           # 可选依赖
    - name: "git-integration-skill"
      version: ">=1.0.0"
      reason: "用于获取 Git 上下文信息"
  external_dependencies:           # 外部依赖
    - name: "node"
      version: ">=16.0.0"
      optional: true
    - name: "python"
      version: ">=3.8.0"
      optional: false

# ==================== 输入输出 Schema ====================
input_schema:
  type: "object"
  required:
    - "diff"
  properties:
    diff:
      type: "string"
      description: "代码 diff 内容"
      max_length: 100000
    language:
      type: "string"
      description: "编程语言"
      enum:
        - "python"
        - "java"
        - "javascript"
        - "typescript"
        - "go"
        - "rust"
      default: "python"
    review_rules:
      type: "array"
      description: "审查规则列表"
      items:
        type: "string"
        enum:
          - "security"
          - "performance"
          - "best-practice"
          - "style"
      default:
        - "security"
        - "performance"
        - "best-practice"

output_schema:
  type: "object"
  properties:
    success:
      type: "boolean"
    result:
      type: "object"
      properties:
        passed:
          type: "boolean"
        score:
          type: "integer"
          minimum: 0
          maximum: 100
        issues:
          type: "array"
          items:
            type: "object"
            properties:
              severity:
                type: "string"
                enum: ["critical", "high", "medium", "low", "info"]
              message:
                type: "string"
              location:
                type: "object"
                properties:
                  file:
                    type: "string"
                  line:
                    type: "integer"

# ==================== 配置 Schema ====================
config_schema:
  type: "object"
  properties:
    model:
      type: "object"
      properties:
        provider:
          type: "string"
          enum: ["qwen", "openai", "claude"]
          default: "qwen"
        name:
          type: "string"
          default: "qwen-3"
        max_tokens:
          type: "integer"
          default: 4096
          minimum: 100
          maximum: 32768
    review_rules:
      type: "object"
      properties:
        enabled:
          type: "array"
          items:
            type: "string"
          default:
            - "security"
            - "performance"
            - "best-practice"
        custom_rules:
          type: "array"
          items:
            type: "object"
            properties:
              name:
                type: "string"
              pattern:
                type: "string"
              severity:
                type: "string"
                enum: ["critical", "high", "medium", "low", "info"]

# ==================== 权限信息 ====================
permissions:
  - "code.read"                    # 读取代码
  - "repository.access"            # 访问仓库
  - "llm.call"                     # 调用 LLM
  - "file.read"                    # 读取文件
  - "file.write"                   # 写入文件（建议报告）
scope:
  - "project"                      # 作用域：project/tenant/global
data_access:
  - "source_code"                 # 访问源代码
  - "commit_history"              # 访问提交历史
  - "issue_tracker"               # 访问问题跟踪（只读）

# ==================== 运行时信息 ====================
runtime:
  timeout_ms: 60000                # 超时时间（毫秒）
  memory_limit_mb: 512             # 内存限制（MB）
  cpu_limit: "1.0"                 # CPU 限制（核数）
  disk_limit_mb: 100               # 磁盘限制（MB）
  network_access: false            # 是否允许网络访问
  allowed_network_hosts: []        # 允许访问的网络主机（白名单）

# ==================== 质量指标 ====================
quality:
  rating: 4.8                      # 平均评分（1-5 星）
  rating_count: 256                # 评分次数
  review_count: 128                # 评论数量
  download_count: 15000            # 下载量
  active_install_count: 8500       # 活跃安装量
  success_rate: 99.5               # 执行成功率（%）
  avg_response_time_ms: 1200       # 平均响应时间（毫秒）

# ==================== 生命周期信息 ====================
lifecycle:
  status: "published"              # 状态：draft/published/deprecated/removed
  published_at: "2026-01-15T10:00:00Z"
  deprecated_at: null              # 废弃时间（null 表示未废弃）
  end_of_life: null                # 停止支持时间
  migration_guide: null            # 迁移指南（废弃时提供）
  replacement_skill: null          # 替代 Skill（废弃时推荐）

# ==================== 审计信息 ====================
audit:
  created_at: "2026-01-10T08:00:00Z"
  updated_at: "2026-04-10T10:00:00Z"
  published_by: "user_12345"       # 发布者 ID
  audit_status: "approved"         # 审核状态：pending/auto_approved/approved/rejected
  audit_date: "2026-01-15T09:00:00Z"
  auditor: "auto_system"           # 审核者（自动/人工 ID）
  audit_notes: "自动审核通过，无安全问题"
  security_scan_result:            # 安全扫描结果
    status: "passed"
    vulnerabilities: []
    risk_score: 0.1

# ==================== 分发信息 ====================
distribution:
  cdn_urls:
    global: "https://cdn.orion.internal/skills/code-review/1.2.3/skill.tar.gz"
    cn: "https://cdn-cn.orion.internal/skills/code-review/1.2.3/skill.tar.gz"
    us: "https://cdn-us.orion.internal/skills/code-review/1.2.3/skill.tar.gz"
  mirror_urls:
    - "https://mirror1.orion.internal/skills/code-review/1.2.3/skill.tar.gz"
    - "https://mirror2.orion.internal/skills/code-review/1.2.3/skill.tar.gz"
  checksum:
    md5: "abc123def456..."
    sha256: "789xyz012uvw..."
  size_bytes: 245760               # 包大小（字节）
  file_count: 15                   # 文件数量
  compression: "gzip"              # 压缩格式
```

### 2.3 数据库表设计

```sql
-- ==================== Skill 主表 ====================
CREATE TABLE skills (
    id VARCHAR(64) PRIMARY KEY,              -- Skill 全局 ID
    name VARCHAR(128) NOT NULL,              -- Skill 名称
    version VARCHAR(32) NOT NULL,            -- 版本号
    description TEXT,                        -- 描述
    status VARCHAR(32) DEFAULT 'draft',      -- 状态
    category_id BIGINT,                      -- 分类 ID
    author_id VARCHAR(64),                   -- 作者 ID
    
    -- 质量指标
    rating DECIMAL(3,2) DEFAULT 0,           -- 平均评分
    rating_count INT DEFAULT 0,              -- 评分次数
    download_count BIGINT DEFAULT 0,         -- 下载量
    active_install_count INT DEFAULT 0,      -- 活跃安装量
    
    -- 审计信息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    published_by VARCHAR(64),
    
    -- 索引
    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_category (category_id),
    INDEX idx_author (author_id),
    INDEX idx_rating (rating DESC),
    INDEX idx_downloads (download_count DESC)
);

-- ==================== Skill 版本表 ====================
CREATE TABLE skill_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) NOT NULL,           -- 关联 Skill ID
    version VARCHAR(32) NOT NULL,            -- 版本号
    version_major INT,                       -- 主版本
    version_minor INT,                       -- 次版本
    version_patch INT,                       -- 修订版本
    prerelease VARCHAR(32),                  -- 预发布标识
    changelog TEXT,                          -- 变更日志
    is_stable BOOLEAN DEFAULT TRUE,          -- 是否稳定版
    is_latest BOOLEAN DEFAULT FALSE,         -- 是否最新版
    is_deprecated BOOLEAN DEFAULT FALSE,     -- 是否已废弃
    
    -- 存储信息
    storage_path VARCHAR(512),               -- 存储路径
    checksum_sha256 VARCHAR(64),             -- SHA256 校验和
    size_bytes BIGINT,                       -- 包大小
    
    -- 依赖
    orion_version_min VARCHAR(32),           -- 最低 Orion 版本
    orion_version_max VARCHAR(32),           -- 最高 Orion 版本
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL,
    
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    UNIQUE KEY uk_skill_version (skill_id, version),
    INDEX idx_skill_latest (skill_id, is_latest)
);

-- ==================== Skill 分类表 ====================
CREATE TABLE skill_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT NULL,                   -- 父分类 ID
    code VARCHAR(64) NOT NULL UNIQUE,        -- 分类代码
    name VARCHAR(128) NOT NULL,              -- 分类名称
    description TEXT,                        -- 分类描述
    icon VARCHAR(256),                       -- 分类图标
    sort_order INT DEFAULT 0,                -- 排序顺序
    is_active BOOLEAN DEFAULT TRUE,          -- 是否启用
    
    FOREIGN KEY (parent_id) REFERENCES skill_categories(id),
    INDEX idx_parent (parent_id)
);

-- ==================== Skill 标签表 ====================
CREATE TABLE skill_tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) NOT NULL,           -- Skill ID
    tag VARCHAR(64) NOT NULL,                -- 标签名
    
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    UNIQUE KEY uk_skill_tag (skill_id, tag),
    INDEX idx_tag (tag)
);

-- ==================== Skill 评分表 ====================
CREATE TABLE skill_ratings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) NOT NULL,           -- Skill ID
    user_id VARCHAR(64) NOT NULL,            -- 评分用户 ID
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),  -- 评分 1-5
    comment TEXT,                            -- 评论
    pros TEXT,                               -- 优点
    cons TEXT,                               -- 缺点
    helpful_count INT DEFAULT 0,             -- 有帮助计数
    is_verified_purchase BOOLEAN DEFAULT FALSE,  -- 是否已验证安装
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    UNIQUE KEY uk_skill_user (skill_id, user_id),
    INDEX idx_skill_rating (skill_id, rating)
);

-- ==================== Skill 安装记录表 ====================
CREATE TABLE skill_installations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) NOT NULL,           -- Skill ID
    skill_version VARCHAR(32),               -- 安装版本
    tenant_id VARCHAR(64),                   -- 租户 ID
    user_id VARCHAR(64),                     -- 安装用户
    status VARCHAR(32) DEFAULT 'active',     -- 状态：active/inactive/uninstalled
    config JSON,                             -- 用户配置
    
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uninstalled_at TIMESTAMP NULL,
    
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);
```

---

## 三、Skill 发现机制 (Skill Discovery Mechanism)

### 3.1 发现机制全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Discovery Mechanism                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                              用户
                               │
                               ▼
        ┌──────────────────────────────────────────────────────┐
        │                   发现入口                            │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
        │  │ 首页推荐 │  │ 搜索框   │  │ 分类导航 │          │
        │  └──────────┘  └──────────┘  └──────────┘          │
        └──────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  分类浏览        │  │  关键词搜索      │  │  智能推荐        │
│  ─────────      │  │  ─────────      │  │  ─────────      │
│  • 一级分类     │  │  • 全文检索     │  │  • 个性化推荐   │
│  • 二级分类     │  │  • 模糊匹配     │  │  • 热门排行     │
│  • 标签筛选     │  │  • 拼写纠错     │  │  • 相关 Skill   │
│  • 排序         │  │  • 筛选排序     │  │  • 新上架       │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    │                    │
         └────────────────────┴────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────────────┐
        │                   结果展示                            │
        │  ┌────────────────────────────────────────────────┐  │
        │  │  Skill 卡片列表                                 │  │
        │  │  • 名称 + 图标 + 评分 + 下载量                   │  │
        │  │  • 简短描述 + 标签                             │  │
        │  │  • 作者信息 + 认证标识                         │  │
        │  └────────────────────────────────────────────────┘  │
        └──────────────────────────────────────────────────────┘
```

### 3.2 分类浏览流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Category Browse Flow                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  开始   │────>│ 选择    │────>│ 选择    │────>│ 应用    │────>│ 展示    │
│         │     │ 一级分类 │     │ 二级分类 │     │ 筛选器  │     │ 结果    │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  用户进入      显示所有一级      显示选中一级的    用户可选择:     按条件查询
  Skill 市场      分类列表          二级分类列表      • 标签         数据库并
                • 代码开发        • 代码审查        • 评分范围      展示结果
                • 安全合规        • 测试生成        • 下载量
                • 运维监控        • 文档生成        • 更新时间
                • 数据库          • ...           • 认证状态
                • ...

分类层级示例:
├── 代码开发 (code-development)
│   ├── 代码审查 (code-review)
│   ├── 测试生成 (test-generation)
│   ├── 代码重构 (code-refactoring)
│   └── 文档生成 (documentation)
├── 安全合规 (security-compliance)
│   ├── 安全扫描 (security-scan)
│   ├── 合规检查 (compliance-check)
│   └── 漏洞检测 (vulnerability-detection)
├── 运维监控 (ops-monitoring)
│   ├── 日志分析 (log-analysis)
│   ├── 告警分诊 (alert-triage)
│   └── 根因分析 (root-cause)
└── 数据库 (database)
    ├── SQL 审核 (sql-review)
    ├── 索引优化 (index-optimization)
    └── 性能分析 (performance-analysis)
```

### 3.3 搜索流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Search Flow                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

用户输入查询
     │
     ▼
┌─────────────────┐
│  查询预处理      │
│  ────────────   │
│  • 去除特殊字符  │
│  • 统一大小写    │
│  • 分词处理      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  拼写检查       │────>│  同义词扩展      │
│  ───────────    │     │  ────────────   │
│  • 纠错建议     │     │  • 近义词       │
│  • 自动修正     │     │  • 缩写扩展     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│                    搜索执行                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Elasticsearch Query                            │   │
│  │  {                                              │   │
│  │    "multi_match": {                             │   │
│  │      "query": "code review",                    │   │
│  │      "fields": ["name^3", "description^2",      │   │
│  │                 "keywords", "tags"]             │   │
│  │    },                                           │   │
│  │    "filter": [                                  │   │
│  │      {"term": {"status": "published"}},         │   │
│  │      {"range": {"rating": {"gte": 4}}}          │   │
│  │    ],                                           │   │
│  │    "sort": [                                    │   │
│  │      {"_score": "desc"},                        │   │
│  │      {"download_count": "desc"}                 │   │
│  │    ]                                            │   │
│  │  }                                              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  结果后处理      │
│  ───────────    │
│  • 去重         │
│  • 高亮标记     │
│  • 分页         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  返回结果        │
│  ───────────    │
│  • Skill 列表    │
│  • 总数量       │
│  • 聚合统计     │
│  • 搜索建议     │
└─────────────────┘
```

### 3.4 推荐流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Recommendation Flow                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                          推荐引擎输入
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  用户画像       │  │  行为历史       │  │  上下文信息     │
│  ───────────    │  │  ──────────     │  │  ──────────     │
│  • 职业角色     │  │  • 浏览记录     │  │  • 当前页面     │
│  • 技术栈       │  │  • 安装历史     │  │  • 时间位置     │
│  • 兴趣标签     │  │  • 使用频率     │  │  • 设备类型     │
│  • 团队领域     │  │  • 评分反馈     │  │  • 搜索查询     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    │                    │
         └────────────────────┴────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    推荐策略选择      │
                    │    ────────────     │
                    │    • 协同过滤       │
                    │    • 内容推荐       │
                    │    • 热门推荐       │
                    │    • 混合推荐       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    候选集生成       │
                    │    ───────────      │
                    │    • 召回 1000      │
                    │    • 粗排 100       │
                    │    • 精排 20        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    多样性打散       │
                    │    ───────────      │
                    │    • 分类打散       │
                    │    • 作者打散       │
                    │    • 去重           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    返回推荐列表     │
                    │    ────────────     │
                    │    • Top 10         │
                    │    • 推荐原因       │
                    └─────────────────────┘

推荐算法说明:
├── 协同过滤 (Collaborative Filtering)
│   • 基于用户相似度：安装了相同 Skill 的用户
│   • 基于 Skill 相似度：被相同用户安装的 Skill
│   • 矩阵分解：SVD/ALS 隐语义模型
│
├── 内容推荐 (Content-Based)
│   • 基于标签相似度：相同标签的 Skill
│   • 基于分类：同分类或相近分类
│   • 基于描述文本：TF-IDF/词向量相似度
│
├── 热门推荐 (Popularity-Based)
│   • 下载量排行
│   • 评分排行
│   • 趋势排行（增长率）
│
└── 混合推荐 (Hybrid)
    • 加权融合：多策略结果加权
    • 级联融合：多阶段过滤排序
    • 特征融合：多源特征输入学习排序模型
```

### 3.5 热门排行计算

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Hot Ranking Calculation                                │
└─────────────────────────────────────────────────────────────────────────────────┘

排名分数计算公式:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   Hot Score = D × (R/5) × log(1 + C) × (1 + B) × T                              │
│                                                                                 │
│   其中:                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ D (Download Score) 下载得分                                             │   │
│   │   = log10(download_count + 1) × 10                                      │   │
│   │   范围：0-50                                                            │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ R (Rating Score) 评分得分                                               │   │
│   │   = average_rating                                                      │   │
│   │   范围：1-5                                                             │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ C (Comment Score) 评论得分                                              │   │
│   │   = review_count                                                        │   │
│   │   使用对数平滑，避免刷榜                                                │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ B (Boost Factor) 加权因子                                               │   │
│   │   = 0.2 (官方认证) + 0.1 (新上架 7 天内) + 0.1 (趋势上升)                  │   │
│   │   范围：0-0.4                                                           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ T (Time Decay) 时间衰减                                                 │   │
│   │   = exp(-days_since_published / 365)                                    │   │
│   │   范围：0-1，新 Skill 衰减慢，老 Skill 衰减快                               │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

排行更新策略:
├── 实时排行
│   • 更新频率：每 5 分钟
│   • 计算范围：Top 100
│   • 数据源：缓存 + 增量更新
│
├── 小时排行
│   • 更新频率：每小时
│   • 计算范围：Top 500
│   • 数据源：全量重算
│
├── 日排行
│   • 更新频率：每天
│   • 计算范围：全量
│   • 数据源：全量重算
│
└── 周排行
    • 更新频率：每周
    • 计算范围：全量
    • 数据源：全量重算 + 历史对比

示例计算:
Skill: code-review-skill
├── download_count = 15000
├── average_rating = 4.8
├── review_count = 256
├── is_official = true (boost +0.2)
├── days_since_published = 30
│
├── D = log10(15000 + 1) × 10 = 41.76
├── R/5 = 4.8/5 = 0.96
├── log(1 + C) = log(1 + 256) = 5.55
├── (1 + B) = 1 + 0.2 = 1.2
├── T = exp(-30/365) = 0.92
│
└── Hot Score = 41.76 × 0.96 × 5.55 × 1.2 × 0.92 = 244.8
```

---

## 四、Skill 安装流程 (Skill Installation Flow)

### 4.1 安装流程全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Installation Flow                                │
└─────────────────────────────────────────────────────────────────────────────────┘

用户                                                        系统
 │                                                           │
 │  1. 点击安装按钮                                           │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │                                                           │ 2. 检查已安装状态
 │                                                           │──┐
 │                                                           ││ │
 │                                                           │◄─┘
 │                                                           │
 │  3. 显示安装确认对话框                                     │
 │<──────────────────────────────────────────────────────────│
 │                                                           │
 │  4. 确认安装                                               │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │                                                           │ 5. 依赖检查
 │                                                           │──┐
 │                                                           ││ ├─ 检查 Orion 版本   │
 │                                                           ││ ├─ 检查依赖 Skill  │
 │                                                           ││ └─ 检查外部依赖   │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 6. 兼容性验证
 │                                                           │──┐
 │                                                           ││ ├─ 版本兼容性     │
 │                                                           ││ └─ 平台兼容性     │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 7. 权限申请
 │                                                           │──┐
 │                                                           ││ └─ 列出所需权限   │
 │                                                           │◄─┘
 │                                                           │
 │  8. 显示依赖/兼容性/权限信息                                │
 │<──────────────────────────────────────────────────────────│
 │                                                           │
 │  9. 确认所有条件                                           │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │                                                           │ 10. 下载 Skill 包
 │                                                           │──┐
 │                                                           ││ ├─ 从 CDN 下载    │
 │                                                           ││ └─ 校验完整性    │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 11. 解压安装
 │                                                           │──┐
 │                                                           ││ ├─ 解压包内容    │
 │                                                           ││ ├─ 注册 Skill    │
 │                                                           ││ └─ 初始化配置    │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 12. 发送安装事件
 │                                                           │──┐
 │                                                           ││ └─ skill.installed
 │                                                           │◄─┘
 │                                                           │
 │  13. 安装完成通知                                          │
 │<──────────────────────────────────────────────────────────│
 │                                                           │
```

### 4.2 依赖检查详细流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Dependency Check Flow                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                     开始依赖检查
                          │
                          ▼
              ┌───────────────────────┐
              │   1. Orion 版本检查     │
              │   ────────────────    │
              │   当前版本：1.2.0      │
              │   要求版本：>=1.0.0    │
              │   结果：✓ 通过         │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   2. 依赖 Skill 检查    │
              │   ────────────────    │
              │   检查每个 required:   │
              │   • llm-call-skill   │
              │     >=2.0.0          │
              │     已安装：2.1.0 ✓  │
              │   • file-read-skill  │
              │     >=1.0.0          │
              │     已安装：1.0.0 ✓  │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   3. 外部依赖检查      │
              │   ────────────────    │
              │   • python >=3.8.0   │
              │     当前：3.10.2 ✓   │
              │   • node >=16.0.0    │
              │     当前：未安装 ✗   │
              │     (可选依赖)       │
              └───────────┬───────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │ 检查结果汇总 │
                    │ ─────────── │
                    │ Orion 版本：  │
                    │ ✓           │
                    │ 依赖 Skill:  │
                    │ ✓ 2/2       │
                    │ 外部依赖：   │
                    │ ⚠ 1/1 (可选)│
                    │             │
                    │ 结论：可安装 │
                    └─────────────┘
```

### 4.3 权限申请界面

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Permission Request Dialog                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  安装 "code-review-skill" v1.2.3                                                │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  权限请求                                                                │   │
│  │  ──────────                                                              │   │
│  │                                                                          │   │
│  │  此 Skill 需要以下权限才能正常运行：                                       │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │  🔓 code.read        读取代码文件                                  │     │   │
│  │  │                        用于分析和审查代码内容                       │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │  🔓 repository.access  访问代码仓库                               │     │   │
│  │  │                        用于获取 Git 上下文和历史信息                │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │  🔓 llm.call         调用 AI 模型                                  │     │   │
│  │  │                        用于执行代码审查分析                       │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                          │   │
│  │  作用域：当前项目 (project)                                                │   │
│  │  数据访问：源代码、提交历史 (只读)                                         │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠  请仔细审查权限请求，确保您信任此 Skill 的作者                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│     ┌─────────────────────────┐           ┌─────────────────────────┐          │
│     │      取消               │           │      同意并安装          │          │
│     └─────────────────────────┘           └─────────────────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、Skill 升级机制 (Skill Upgrade Mechanism)

### 5.1 升级机制全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Upgrade Mechanism                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                    升级触发
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  用户手动   │ │  系统自动   │ │  强制升级   │
│  检查升级   │ │  检查升级   │ │  (安全漏洞) │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┴───────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  版本对比分析   │
              │  ───────────    │
              │  • 当前版本     │
              │  • 最新版本     │
              │  • 变更内容     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  兼容性评估     │
              │  ──────────     │
              │  • 主版本变更   │
              │  • 配置迁移     │
              │  • API 变更      │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  无缝升级   │ │  迁移升级   │ │  阻断升级   │
│  (patch)    │ │  (minor)    │ │  (major)    │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       │               │               │
       ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│              升级执行                            │
│  ┌─────────────────────────────────────────┐   │
│  │  1. 备份当前版本配置和数据               │   │
│  │  2. 下载新版本 Skill 包                   │   │
│  │  3. 执行迁移脚本 (如有)                  │   │
│  │  4. 更新配置                             │   │
│  │  5. 验证升级结果                         │   │
│  │  6. 清理旧版本 (保留回滚点)              │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  升级结果       │
              │  ──────────     │
              │  • 成功 → 通知  │
              │  • 失败 → 回滚  │
              └─────────────────┘
```

### 5.2 版本对比策略

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Version Comparison Strategy                            │
└─────────────────────────────────────────────────────────────────────────────────┘

版本变更类型判断:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  当前版本：1.2.3                                                                │
│  最新版本：X.Y.Z                                                                │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Patch 版本 (修订版本变更)                                               │   │
│  │  ─────────────────────                                                   │   │
│  │  条件：X=1, Y=2, Z>3                                                    │   │
│  │  示例：1.2.3 → 1.2.4                                                    │   │
│  │  升级类型：无缝升级 (推荐自动)                                           │   │
│  │  风险等级：低                                                            │   │
│  │  变更内容：Bug 修复、性能优化，无功能变更                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Minor 版本 (次版本变更)                                                 │   │
│  │  ─────────────────────                                                   │   │
│  │  条件：X=1, Y>2                                                         │   │
│  │  示例：1.2.3 → 1.3.0                                                    │   │
│  │  升级类型：迁移升级 (需用户确认)                                         │   │
│  │  风险等级：中                                                            │   │
│  │  变更内容：新功能、配置变更，向后兼容                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Major 版本 (主版本变更)                                                 │   │
│  │  ─────────────────────                                                   │   │
│  │  条件：X>1                                                              │   │
│  │  示例：1.2.3 → 2.0.0                                                    │   │
│  │  升级类型：阻断升级 (需手动处理)                                         │   │
│  │  风险等级：高                                                            │   │
│  │  变更内容：破坏性变更，配置迁移，API 不兼容                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

升级推荐策略:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Patch 升级 (1.2.3 → 1.2.4)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  推荐方式：自动升级                                                       │   │
│  │  通知时机：升级完成后通知                                                 │   │
│  │  回滚策略：自动回滚（失败时）                                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Minor 升级 (1.2.3 → 1.3.0)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  推荐方式：提示升级                                                       │   │
│  │  通知时机：检测到新版本时                                                 │   │
│  │  展示内容：变更日志、迁移影响                                             │   │
│  │  回滚策略：一键回滚（用户手动）                                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Major 升级 (1.2.3 → 2.0.0)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  推荐方式：强制确认                                                       │   │
│  │  通知时机：多次提醒（至少 3 次）                                           │   │
│  │  展示内容：破坏性变更、迁移指南、替代方案                                 │   │
│  │  回滚策略：完整备份 + 手动回滚                                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 迁移脚本机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Migration Script Mechanism                             │
└─────────────────────────────────────────────────────────────────────────────────┘

迁移脚本结构:

skill-package/
├── skill.yaml              # Skill 元数据
├── src/                    # 源代码
├── migrations/             # 迁移脚本目录
│   ├── 001_add_config.sql  # 迁移脚本 1
│   ├── 002_update_schema.sql
│   └── 003_migrate_data.py
└── rollback/               # 回滚脚本目录
    ├── 001_rollback.sql
    ├── 002_rollback.sql
    └── 003_rollback.py

迁移脚本定义 (YAML):

migrations:
  - version: "1.3.0"
    scripts:
      - type: "sql"
        file: "migrations/001_add_config.sql"
        description: "新增 user_config 配置表"
        rollback: "migrations/001_rollback.sql"
      - type: "python"
        file: "migrations/002_migrate_data.py"
        description: "迁移旧配置到新格式"
        rollback: "migrations/002_rollback.py"
    pre_check:
      - type: "version"
        min_version: "1.2.0"
      - type: "disk_space"
        min_mb: 100
    post_check:
      - type: "health"
        endpoint: "/health"
      - type: "data_integrity"
        table: "user_config"

迁移执行流程:

┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  开始   │────>│  前置   │────>│  执行   │────>│  后置   │────>│  完成   │
│  迁移   │     │  检查   │     │  脚本   │     │  验证   │     │  /回滚  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  读取迁移        检查版本        按顺序执行      运行健康        成功→标记
  计划            检查空间        每个脚本        检查数据        完成
                                                      完整性        失败→回滚
```

### 5.4 回滚支持

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Rollback Mechanism                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚触发条件:
├── 升级后健康检查失败
├── 升级后功能异常（用户报告）
├── 迁移脚本执行失败
├── 数据完整性校验失败
└── 用户手动触发回滚

回滚流程:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  升级失败                                                                       │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Step 1: 检测失败                                                         │   │
│  │  • 健康检查失败告警                                                       │   │
│  │  • 用户反馈异常                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Step 2: 自动暂停                                                         │   │
│  │  • 停止新 Skill 执行                                                       │   │
│  │  • 保持旧版本可用（宽限期）                                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Step 3: 执行回滚                                                         │   │
│  │  • 执行回滚脚本                                                           │   │
│  │  • 恢复旧版本配置                                                         │   │
│  │  • 恢复旧版本数据                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Step 4: 验证回滚                                                         │   │
│  │  • 健康检查                                                               │   │
│  │  • 数据完整性校验                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Step 5: 完成回滚                                                         │   │
│  │  • 通知用户回滚成功                                                       │   │
│  │  • 记录回滚日志                                                           │   │
│  │  • 保留回滚报告                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚保留策略:
├── 保留旧版本数量：最近 3 个版本
├── 保留时间：升级后 30 天
├── 保留数据：配置 + 用户数据 + 执行日志
└── 清理策略：超过保留期自动清理（提前通知）
```

---

## 六、Skill 卸载流程 (Skill Uninstallation Flow)

### 6.1 卸载流程全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Uninstallation Flow                              │
└─────────────────────────────────────────────────────────────────────────────────┘

用户                                                        系统
 │                                                           │
 │  1. 进入已安装 Skill 列表                                    │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │  2. 选择要卸载的 Skill                                      │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │                                                           │ 3. 检查依赖关系
 │                                                           │──┐
 │                                                           ││ ├─ 检查被谁依赖  │
 │                                                           ││ └─ 检查依赖状态 │
 │                                                           │◄─┘
 │                                                           │
 │  4. 显示卸载确认（含依赖警告）                              │
 │<──────────────────────────────────────────────────────────│
 │                                                           │
 │  5. 确认卸载                                               │
 ├──────────────────────────────────────────────────────────>│
 │                                                           │
 │                                                           │ 6. 停止 Skill 执行
 │                                                           │──┐
 │                                                           ││ └─ 停止运行中实例│
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 7. 清理数据
 │                                                           │──┐
 │                                                           ││ ├─ 删除临时文件 │
 │                                                           ││ ├─ 清理缓存     │
 │                                                           ││ └─ 删除配置     │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 8. 注销 Skill
 │                                                           │──┐
 │                                                           ││ └─ 从注册表移除 │
 │                                                           │◄─┘
 │                                                           │
 │                                                           │ 9. 发送卸载事件
 │                                                           │──┐
 │                                                           ││ └─ skill.uninstalled
 │                                                           │◄─┘
 │                                                           │
 │  10. 卸载完成通知                                          │
 │<──────────────────────────────────────────────────────────│
 │                                                           │
```

### 6.2 依赖检查详细流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Uninstall Dependency Check                             │
└─────────────────────────────────────────────────────────────────────────────────┘

卸载请求：code-review-skill v1.2.3
                          │
                          ▼
              ┌───────────────────────┐
              │   1. 检查依赖关系       │
              │   ───────────────     │
              │   查询：哪些 Skill     │
              │   依赖此 Skill？       │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   发现依赖关系：        │
              │   ───────────────     │
              │   • ci-pipeline-skill │
              │     (依赖版本>=1.0.0) │
              │   • pr-automation-skill│
              │     (依赖版本>=1.2.0) │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   2. 评估影响          │
              │   ──────────────      │
              │   • ci-pipeline-skill │
              │     将无法正常执行     │
              │   • pr-automation-skill│
              │     将无法正常执行     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   3. 生成卸载警告      │
              │   ──────────────      │
              │   ⚠ 卸载此 Skill 将影响  │
              │     2 个已安装 Skill      │
              │                        │
              │   选项：               │
              │   □ 同时卸载依赖技能   │
              │   □ 保留（取消卸载）   │
              └───────────┬───────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  用户决策   │
                    │  ───────    │
                    │  • 取消卸载 │
                    │  • 继续卸载 │
                    │  • 批量卸载 │
                    └─────────────┘
```

### 6.3 卸载确认对话框

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Uninstall Confirmation Dialog                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  卸载 "code-review-skill" v1.2.3                                                │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠  警告：依赖关系                                                       │   │
│  │  ─────────────────────                                                   │   │
│  │                                                                          │   │
│  │  以下 Skill 依赖于 "code-review-skill"，卸载后将无法正常运行：              │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  📦 ci-pipeline-skill v2.1.0                                     │   │   │
│  │  │     依赖条件：code-review-skill >=1.0.0                          │   │   │
│  │  │     状态：已安装                                                  │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  📦 pr-automation-skill v1.5.0                                   │   │   │
│  │  │     依赖条件：code-review-skill >=1.2.0                          │   │   │
│  │  │     状态：已安装                                                  │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  清理选项                                                                │   │
│  │  ──────────                                                              │   │
│  │                                                                          │   │
│  │  ☑ 删除配置文件 (约 2.5 KB)                                               │   │
│  │  ☑ 删除缓存数据 (约 15 MB)                                                │   │
│  │  ☐ 删除执行日志 (约 120 MB)                                               │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  请选择操作：                                                                   │
│                                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────┐ │
│  │      取消               │  │  继续卸载（仅当前）      │  │  批量卸载所有   │ │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、Skill 评分系统 (Skill Rating System)

### 7.1 评分系统全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Rating System                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                         评分数据来源
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  星级评分       │  │  使用统计       │  │  用户反馈       │
│  ──────────     │  │  ──────────     │  │  ──────────     │
│  • 1-5 星        │  │  • 下载量       │  │  • 文字评论     │
│  • 加权平均      │  │  • 活跃安装数   │  │  • 优点/缺点    │
│  • 防刷机制      │  │  • 执行成功率   │  │  • 有用性投票   │
│                  │  │  • 响应时间     │  │  • 问题反馈     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   综合评分计算   │
                    │   ──────────    │
                    │   多维度加权     │
                    │   时间衰减       │
                    │   置信度调整     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   评分展示      │
                    │   ─────────     │
                    │   • 总评分      │
                    │   • 分布图      │
                    │   • 评论列表    │
                    └─────────────────┘
```

### 7.2 综合评分计算

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Comprehensive Rating Calculation                       │
└─────────────────────────────────────────────────────────────────────────────────┘

综合评分公式:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   Final Score = S × W_s + U × W_u + F × W_f                                     │
│                                                                                 │
│   其中:                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ S (Star Rating) 星级评分                                                 │   │
│   │   = weighted_average(stars)                                             │   │
│   │   权重：近期评分×1.5, 已验证安装×1.2                                    │   │
│   │   范围：1-5                                                             │   │
│   │   W_s = 0.5 (权重 50%)                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ U (Usage Score) 使用得分                                                │   │
│   │   = (success_rate/100) × log(1 + active_installs) / 10                  │   │
│   │   范围：0-5                                                             │   │
│   │   W_u = 0.3 (权重 30%)                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ F (Feedback Score) 反馈得分                                             │   │
│   │   = 5 × (positive_ratio) × log(1 + review_count) / 5                    │   │
│   │   positive_ratio = (好评数 + 有用数) / 总反馈数                            │   │
│   │   范围：0-5                                                             │   │
│   │   W_f = 0.2 (权重 20%)                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   置信度调整 (Confidence Adjustment):                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │   if rating_count < 10:     confidence = 0.6                            │   │
│   │   elif rating_count < 50:   confidence = 0.8                            │   │
│   │   elif rating_count < 100:  confidence = 0.9                            │   │
│   │   else:                     confidence = 1.0                            │   │
│   │                                                                         │   │
│   │   Final Score = Final Score × confidence                                │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

示例计算:

Skill: code-review-skill
├── 星级评分数据:
│   • 5 星：180 条 (权重 1.0)
│   • 4 星：50 条 (权重 0.8)
│   • 3 星：15 条 (权重 0.6)
│   • 2 星：8 条 (权重 0.4)
│   • 1 星：3 条 (权重 0.2)
│   • 近期 (30 天内)：50 条
│   • 已验证安装：200 条
│
├── 使用统计数据:
│   • active_installs = 8500
│   • success_rate = 99.5%
│
├── 反馈数据:
│   • review_count = 128
│   • positive_reviews = 110
│   • helpful_votes = 450
│
└── 计算过程:
    S = (180×5 + 50×4 + 15×3 + 8×2 + 3×1) / 256 = 4.45
    S_weighted = 4.45 × 1.1 (近期 + 验证) = 4.90
    
    U = 0.995 × log(1 + 8500) / 10 = 0.995 × 3.93 = 3.91
    
    F = 5 × (110/128) × log(1 + 128) / 5 = 4.29 × 0.42 = 1.80
    F_normalized = 1.80 × 5 / 5 = 4.29
    
    Final = 4.90 × 0.5 + 3.91 × 0.3 + 4.29 × 0.2 = 4.48
    
    confidence = 1.0 (rating_count > 100)
    
    Final Score = 4.48 × 1.0 = 4.48 ≈ 4.5 星
```

### 7.3 评分分布展示

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Rating Distribution Display                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  code-review-skill v1.2.3                                                       │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │     ⭐⭐⭐⭐⭐   4.5                              │   │
│  │              基于 256 条评分                           │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────┐     │   │
│  │  │  5 星  ████████████████████████████████████████  180 (70%)       │     │   │
│  │  │  4 星  ██████████  50 (20%)                                   │     │   │
│  │  │  3 星  ███  15 (6%)                                         │     │   │
│  │  │  2 星  █  8 (3%)                                           │     │   │
│  │  │  1 星  █  3 (1%)                                           │     │   │
│  │  └────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  评分维度                                                                │   │
│  │  ──────────                                                              │   │
│  │  • 功能性：⭐⭐⭐⭐⭐  4.6                              │   │
│  │  • 易用性：⭐⭐⭐⭐⭐  4.5                              │   │
│  │  • 性能：  ⭐⭐⭐⭐☆  4.3                               │   │
│  │  • 稳定性：⭐⭐⭐⭐⭐  4.7                              │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  精选评论                                                                │   │
│  │  ──────────                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  👤 张三  ⭐⭐⭐⭐⭐  2026-04-08                     │   │   │
│  │  │  非常好用的代码审查工具，帮助我们发现了很多潜在的安全问题。          │   │   │
│  │  │  审查速度快，建议也很合理。强烈推荐！                            │   │   │
│  │  │  👍 25 人认为这条评论有用                                          │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  👤 李四  ⭐⭐⭐⭐☆  2026-04-05                      │   │   │
│  │  │  整体很好，但是对 TypeScript 的支持还可以加强。                   │   │   │
│  │  │  👍 12 人认为这条评论有用                                          │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、Skill 审核机制 (Skill Review Mechanism)

### 8.1 审核机制全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Review Mechanism                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                         Skill 提交
                              │
                              ▼
                    ┌─────────────────┐
                    │   格式校验      │
                    │   ─────────     │
                    │   • YAML 语法   │
                    │   • Schema 验证  │
                    │   • 必填字段    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ 通过                       │ 失败
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │   自动安全扫描   │           │   驳回并通知    │
    │   ──────────    │           │   修复后重交    │
    │   • 恶意代码检测 │           └─────────────────┘
    │   • 敏感信息检测 │
    │   • 依赖安全扫描 │
    └────────┬────────┘
             │
              ──────────────┐
              │ 通过       │ 失败
              ▼             ▼
    ┌─────────────────┐ ┌─────────────────┐
    │   质量检查      │ │   驳回并通知    │
    │   ─────────     │ │   说明原因      │
    │   • 功能完整性  │ └─────────────────┘
    │   • 测试覆盖率  │
    │   • 文档完整性  │
    └────────┬────────┘
             │
              ──────────────┐
              │             │
              ▼             ▼
    ┌─────────────────┐ ┌─────────────────┐
    │   人工审核      │ │   自动通过      │
    │   (可选/高风险) │ │   (低风险)      │
    │   • 功能验证    │ └────────┬────────┘
    │   • 安全复核    │          │
    └────────┬────────┘          │
             │                   │
             └─────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   审核通过      │
              │   ─────────     │
              │   • 上架        │
              │   • 通知作者    │
              │   • 发布事件    │
              └─────────────────┘
```

### 8.2 审核状态机

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Review State Machine                             │
└─────────────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────┐
                          │    draft     │
                          │   (草稿)     │
                          └──────┬───────┘
                                 │
                                 │ 提交
                                 ▼
                          ┌──────────────┐
                          │   pending    │
                          │  (待审核)    │
                          └──────┬───────┘
                                 │
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
    │  auto_scanning  │ │   rejected    │ │   withdrawn     │
    │  (自动扫描中)   │ │   (已驳回)    │ │   (已撤回)      │
    └────────┬────────┘ └───────────────┘ └─────────────────┘
             │                  │                  │
             │                  │ 重新提交           │ 重新编辑
             ▼                  │                  │
    ┌─────────────────┐         │                  │
    │  quality_check  │         │                  │
    │  (质量检查中)   │         │                  │
    └────────┬────────┘         │                  │
             │                  │                  │
             │                  └──────────────────┤
             │                                     │
     ┌───────┴───────┐                             │
     │               │                             │
     ▼               ▼                             │
┌─────────┐    ┌─────────┐                        │
│  auto   │    │ manual  │                        │
│ approved│    │ review  │                        │
│(自动通过)│    │(人工审核)│                        │
└────┬────┘    └────┬────┘                        │
     │              │                              │
     │              │ 通过      ┌──────────────────┤
     │              │           │
     │              ▼           │
     │     ┌─────────────────┐ │
     │     │    approved     │ │
     │     │    (已通过)     │ │
     │     └────────┬────────┘ │
     │              │          │
     │              │ 不通过   │
     │              └──────────┤
     │                         │
     └─────────────────────────┘
```

### 8.3 自动扫描检查项

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Automated Security Scan                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  检查类别                    检查项                        风险等级              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. 恶意代码检测                                                                  │
│     ├── 系统命令执行检测                 critical                                │
│     ├── 文件写入操作检测                 high                                    │
│     ├── 网络请求检测                     medium                                  │
│     ├── 环境变量读取检测                 medium                                  │
│     └── 敏感 API 调用检测                  high                                    │
│                                                                                 │
│  2. 敏感信息检测                                                                  │
│     ├── API Key/Token 硬编码检测          critical                                │
│     ├── 密码硬编码检测                   critical                                │
│     ├── 私钥文件检测                     critical                                │
│     ├── 数据库连接串检测                 high                                    │
│     └── 个人身份信息检测                 medium                                  │
│                                                                                 │
│  3. 依赖安全扫描                                                                  │
│     ├── 依赖漏洞扫描 (CVE)               high                                    │
│     ├── 依赖许可证合规检查               medium                                  │
│     ├── 依赖来源可信度检查               medium                                  │
│     └── 依赖版本安全性检查               low                                     │
│                                                                                 │
│  4. 代码质量检查                                                                  │
│     ├── 代码注入风险                     high                                    │
│     ├── 资源泄露风险                     medium                                  │
│     ├── 无限循环检测                     medium                                  │
│     └── 异常处理完整性                   low                                     │
│                                                                                 │
│  5. 权限合规检查                                                                  │
│     ├── 权限最小化原则                   medium                                  │
│     ├── 权限与功能匹配度                 medium                                  │
│     └── 敏感权限使用说明                 low                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

扫描结果示例:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Scan Report: code-review-skill v1.2.3                                          │
│  Scan Time: 2026-04-10T10:30:00Z                                                │
│  Overall Status: PASSED                                                         │
│  Risk Score: 0.1 (Low)                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Findings:                                                                       │
│                                                                                 │
│  ✅ 恶意代码检测：通过 (0 issues)                                                │
│  ✅ 敏感信息检测：通过 (0 issues)                                                │
│  ✅ 依赖安全扫描：通过 (0 vulnerabilities)                                       │
│  ⚠️  代码质量检查：注意 (1 suggestion)                                           │
│     └─ [LOW] src/reviewer.py:45 - 建议添加异常处理                               │
│  ✅ 权限合规检查：通过 (权限配置合理)                                            │
│                                                                                 │
│  Recommendation: 自动审核通过，可以上架                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、Skill 分发渠道 (Skill Distribution Channels)

### 9.1 分发渠道全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Distribution Channels                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                              Skill 来源
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   内置市场      │    │   私有仓库      │    │   Git 仓库       │
│   ─────────     │    │   ─────────     │    │   ─────────     │
│   • 官方市场    │    │   • 企业私有    │    │   • GitHub      │
│   • 社区市场    │    │   • 团队私有    │    │   • GitLab      │
│   • 认证市场    │    │   • 个人私有    │    │   • Bitbucket   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │    统一安装入口     │
                    │    ────────────     │
                    │    • CLI 命令        │
                    │    • UI 界面         │
                    │    • API 调用        │
                    └─────────────────────┘
```

### 9.2 内置市场分发

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Built-in Marketplace                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  内置市场层级                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Orion 官方市场 (Official Marketplace)                                   │   │
│  │  ─────────────────────                                                   │   │
│  │  • 官方审核 + 官方维护                                                   │   │
│  │  • 质量保证金：高                                                        │   │
│  │  • 更新频率：稳定                                                        │   │
│  │  • 推荐权重：最高                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  认证市场 (Certified Marketplace)                                        │   │
│  │  ───────────────────                                                     │   │
│  │  • 官方审核 + 第三方维护                                                 │   │
│  │  • 质量保证金：中高                                                      │   │
│  │  • 更新频率：较高                                                        │   │
│  │  • 推荐权重：高                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  社区市场 (Community Marketplace)                                        │   │
│  │  ───────────────────                                                     │   │
│  │  • 自动审核 + 社区监督                                                   │   │
│  │  • 质量保证金：中                                                        │   │
│  │  • 更新频率：高                                                          │   │
│  │  • 推荐权重：中                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

分发流程:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  作者提交 ──> 自动审核 ──> (人工审核) ──> 上架 ──> CDN 分发 ──> 用户安装       │
│      │            │            │           │         │           │              │
│      │            │            │           │         │           │              │
│      ▼            ▼            ▼           ▼         ▼           ▼              │
│  上传包      安全扫描    高风险检查   注册索引   缓存加速    下载安装           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 私有仓库分发

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Private Repository                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

私有仓库配置:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  {                                                                               │
│    "name": "acme-corp-skill-repo",                                              │
│    "type": "private",                                                           │
│    "url": "https://skills.acme-corp.internal",                                 │
│    "auth": {                                                                    │
│      "type": "bearer",                                                          │
│      "token_env": "SKILL_REPO_TOKEN"                                            │
│    },                                                                           │
│    "scope": "tenant",        // 作用域：tenant/team/user                        │
│    "scope_id": "tenant_123", // 作用域 ID                                        │
│    "skills": [               // 可配置白名单                                     │
│      "internal-code-review",                                                    │
│      "compliance-checker"                                                       │
│    ]                                                                            │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

分发流程:

企业 Skill 开发者                                    私有仓库                            用户
     │                                                 │                                 │
     │  1. 发布内部 Skill                               │                                 │
     ├────────────────────────────────────────────────>│                                 │
     │                                                 │                                 │
     │                                                 │  2. 存储并索引                    │
     │                                                 │──┐                              │
     │                                                 ││ │                              │
     │                                                 │◄─┘                              │
     │                                                 │                                 │
     │                                                 │  3. 同步到租户目录                 │
     │                                                 │────────────────────────────────>│
     │                                                 │                                 │
     │                                                 │  4. 浏览内部市场                   │
     │                                                 │<────────────────────────────────│
     │                                                 │                                 │
     │                                                 │  5. 点击安装                      │
     │                                                 │<────────────────────────────────│
     │                                                 │                                 │
     │                                                 │  6. 从私有仓库下载                  │
     │                                                 │────────────────────────────────>│
     │                                                 │                                 │
     │                                                 │  7. 安装完成                      │
     │                                                 │────────────────────────────────>│
     │                                                 │                                 │
```

### 9.4 Git 仓库分发

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Git Repository Distribution                            │
└─────────────────────────────────────────────────────────────────────────────────┘

Git 仓库 Skill 结构:

skill-repo/
├── README.md                 # 仓库说明
├── catalog.json              # Skill 目录索引
├── skills/
│   ├── code-review/
│   │   ├── skill.yaml        # Skill 元数据
│   │   ├── src/
│   │   │   └── reviewer.py
│   │   ├── tests/
│   │   └── package.tar.gz    # 打包文件
│   └── test-generator/
│       ├── skill.yaml
│       ├── src/
│       │   └── generator.py
│       ├── tests/
│       └── package.tar.gz
└── signatures/               # 签名文件
    ├── code-review.sig
    └── test-generator.sig

安装命令:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  # 从 GitHub 仓库安装                                                             │
│  $ orion skill install github:owner/repo/skill-name@version                     │
│                                                                                 │
│  # 从 GitLab 仓库安装                                                             │
│  $ orion skill install gitlab:group/project/skill-name@version                  │
│                                                                                 │
│  # 从任意 Git 仓库安装                                                             │
│  $ orion skill install https://git.example.com/repo.git/skill-name@version      │
│                                                                                 │
│  # 带认证安装                                                                   │
│  $ orion skill install github:owner/repo/skill-name \                           │
│      --token $GITHUB_TOKEN                                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

验证流程:

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   克隆仓库      │────>│   验证签名      │────>│   下载安装      │
│   ─────────     │     │   ─────────     │     │   ─────────     │
│   git clone     │     │   gpg verify    │     │   解压安装      │
│   拉取 skill    │     │   检查完整性    │     │   注册 Skill    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 十、Skill 沙箱执行 (Skill Sandbox Execution)

### 10.1 沙箱架构全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Skill Sandbox Architecture                             │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   Skill 请求     │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   请求网关      │
                                    │   ─────────     │
                                    │   • 身份验证    │
                                    │   • 权限检查    │
                                    │   • 限流        │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   沙箱调度器    │
                                    │   ──────────    │
                                    │   • 资源分配    │
                                    │   • 实例管理    │
                                    │   • 负载均衡    │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │   Sandbox 1     │          │   Sandbox 2     │          │   Sandbox N     │
    │   ─────────     │          │   ─────────     │          │   ─────────     │
    │   ┌───────────┐ │          │   ┌───────────┐ │          │   ┌───────────┐ │
    │   │ Resource  │ │          │   │ Resource  │ │          │   │ Resource  │ │
    │   │ Limiter   │ │          │   │ Limiter   │ │          │   │ Limiter   │ │
    │   └───────────┘ │          │   └───────────┘ │          │   └───────────┘ │
    │   ┌───────────┐ │          │   ┌───────────┐ │          │   ┌───────────┐ │
    │   │ Timeout   │ │          │   │ Timeout   │ │          │   │ Timeout   │ │
    │   │ Monitor   │ │          │   │ Monitor   │ │          │   │ Monitor   │ │
    │   └───────────┘ │          │   └───────────┘ │          │   └───────────┘ │
    │   ┌───────────┐ │          │   ┌───────────┐ │          │   ┌───────────┐ │
    │   │ Output    │ │          │   │ Output    │ │          │   │ Output    │ │
    │   │ Filter    │ │          │   │ Filter    │ │          │   │ Filter    │ │
    │   └───────────┘ │          │   └───────────┘ │          │   └───────────┘ │
    │                 │          │                 │          │                 │
    │   Skill 执行    │          │   Skill 执行    │          │   Skill 执行    │
    └─────────────────┘          └─────────────────┘          └─────────────────┘
```

### 10.2 资源限制机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Resource Limiting Mechanism                            │
└─────────────────────────────────────────────────────────────────────────────────┘

资源限制配置:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  runtime:                                                                        │
│    # CPU 限制                                                                      │
│    cpu_limit: "1.0"              # CPU 核数（支持小数）                             │
│    cpu_burst: "0.5"              # CPU 突发额度                                   │
│                                                                                 │
│    # 内存限制                                                                    │
│    memory_limit_mb: 512          # 内存上限（MB）                                 │
│    memory_swap_mb: 256           # 交换空间上限（MB）                             │
│                                                                                 │
│    # 磁盘限制                                                                    │
│    disk_limit_mb: 100            # 磁盘上限（MB）                                 │
│    disk_iops: 1000               # IOPS 上限                                      │
│                                                                                 │
│    # 网络限制                                                                    │
│    network_enabled: false        # 是否允许网络访问                              │
│    allowed_hosts: []             # 允许访问的主机白名单                           │
│    bandwidth_limit_mbps: 10      # 带宽限制（Mbps）                               │
│                                                                                 │
│    # 进程限制                                                                    │
│    max_processes: 10             # 最大进程数                                     │
│    max_threads: 50               # 最大线程数                                     │
│                                                                                 │
│    # 文件限制                                                                    │
│    max_open_files: 100           # 最大打开文件数                                 │
│    max_file_size_mb: 50          # 单文件最大大小（MB）                           │
└─────────────────────────────────────────────────────────────────────────────────┘

资源监控与限制流程:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Skill 执行开始                                                                 │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  资源配额分配                                                             │   │
│  │  • 根据 Skill 配置分配资源配额                                             │   │
│  │  • 创建 cgroup/容器限制                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  实时监控                                                                 │   │
│  │  • CPU 使用率监控（每秒采样）                                             │   │
│  │  • 内存使用监控（每秒采样）                                               │   │
│  │  • 磁盘 IO 监控（每次 IO 操作）                                            │   │
│  │  • 网络流量监控（持续监控）                                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  超限处理                                                                 │   │
│  │  • CPU 超限 → 限流 (throttle)                                             │   │
│  │  • 内存超限 → 终止执行 (OOM kill)                                         │   │
│  │  • 磁盘超限 → 拒绝写入                                                   │   │
│  │  • 网络超限 → 阻断连接                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                          │
│      ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  执行完成/异常终止                                                          │   │
│  │  • 释放资源配额                                                           │   │
│  │  • 清理临时文件                                                           │   │
│  │  • 记录资源使用统计                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 超时控制机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Timeout Control Mechanism                              │
└─────────────────────────────────────────────────────────────────────────────────┘

超时层级设计:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Level 1: Skill 级别超时 (配置在 skill.yaml)                                     │
│  ─────────────────────────────                                                   │
│  runtime:                                                                        │
│    timeout_ms: 60000           # 默认超时 60 秒                                    │
│                                                                                 │
│  Level 2: 租户级别超时 (配置在租户配额)                                           │
│  ────────────────────────────                                                    │
│  tenant_quotas:                                                                  │
│    skill_timeout_ms: 120000    # 租户最大超时 120 秒                               │
│                                                                                 │
│  Level 3: 系统级别超时 (全局配置)                                                 │
│  ─────────────────────────                                                       │
│  system_config:                                                                  │
│    max_skill_timeout_ms: 300000  # 系统最大超时 300 秒                             │
│                                                                                 │
│  实际超时 = min(Skill 配置，租户配额，系统上限)                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

超时处理流程:

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   开始执行      │────>│   倒计时监控    │────>│   剩余<10 秒      │
│   ─────────     │     │   ─────────     │     │   ─────────     │
│   启动定时器    │     │   每秒递减      │     │   发送警告      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────────┐
                                               │   超时到达      │
                                               │   ─────────     │
                                               │   发送终止信号  │
                                               └────────┬────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   宽限期        │
                                               │   ─────────     │
                                               │   5 秒清理时间   │
                                               └────────┬────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   强制终止      │
                                               │   ─────────     │
                                               │   kill -9       │
                                               │   清理资源      │
                                               └─────────────────┘

超时通知:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  Skill 执行超时警告                                                         │
│  ──────────────────────                                                         │
│                                                                                 │
│  Skill: code-review-skill                                                       │
│  已执行：50 秒 / 60 秒                                                            │
│  剩余时间：10 秒                                                                 │
│                                                                                 │
│  如未及时完成，执行将被终止。                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 输出过滤机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Output Filtering Mechanism                             │
└─────────────────────────────────────────────────────────────────────────────────┘

输出过滤规则:

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  1. 敏感信息过滤                                                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │  过滤模式                          替换为                            │    │
│     │  ──────────                          ─────                           │    │
│     │  API Key/Token                     [REDACTED]                       │    │
│     │  密码                              [REDACTED]                       │    │
│     │  私钥                              [REDACTED]                       │    │
│     │  身份证号                          [ID_REDACTED]                    │    │
│     │  手机号                            [PHONE_REDACTED]                 │    │
│     │  邮箱                              [EMAIL_REDACTED]                 │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  2. 输出大小限制                                                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │  限制项                          限制值                              │    │
│     │  ──────                          ─────                              │    │
│     │  单次输出最大大小                10 MB                              │    │
│     │  单次输出最大行数                10000 行                             │    │
│     │  单行最大长度                    10000 字符                           │    │
│     │  总输出大小 (累积)                 100 MB                             │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  3. 内容安全过滤                                                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │  过滤内容                          处理方式                          │    │
│     │  ──────────                          ────────                        │    │
│     │  恶意代码片段                      截断 + 警告                        │    │
│     │  攻击指令                          阻断 + 记录                        │    │
│     │  违规内容                          过滤 + 审计                        │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  4. 格式标准化                                                                   │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │  处理项                          处理方式                          │    │
│     │  ──────                          ────────                        │    │
│     │  控制字符                          移除 (保留换行)                    │    │
│     │  超长空白                          压缩为单空格                      │    │
│     │  二进制数据                        Base64 编码                       │    │
│     │  编码不一致                        统一为 UTF-8                       │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

输出过滤流程:

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Skill 输出    │────>│   格式标准化    │────>│   敏感信息过滤  │
│   ─────────     │     │   ─────────     │     │   ───────────   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   大小限制检查  │
                                               │   ──────────    │
                                               └────────┬────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   内容安全检查  │
                                               │   ──────────    │
                                               └────────┬────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   最终输出      │
                                               │   ─────────     │
                                               │   给用户/调用方  │
                                               └─────────────────┘
```

### 10.5 沙箱执行流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Sandbox Execution Flow                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

用户/调用方                         沙箱调度器                          Sandbox 实例
    │                                   │                                   │
    │  1. 请求执行 Skill                 │                                   │
    ├──────────────────────────────────>│                                   │
    │                                   │                                   │
    │                                   │  2. 资源检查                       │
    │                                   │──┐                                │
    │                                   ││ │                                │
    │                                   │◄─┘                                │
    │                                   │                                   │
    │                                   │  3. 分配 Sandbox 实例               │
    │                                   │──────────────────────────────────>│
    │                                   │                                   │
    │                                   │                                   │ 4. 创建执行环境
    │                                   │                                   │──┐
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
    │                                   │                                   │ 5. 加载 Skill 代码
    │                                   │                                   │──┐
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
    │                                   │                                   │ 6. 执行 Skill
    │                                   │                                   │──┐
    │  7. 实时进度 (可选)                │                                   ││ │
    │<──────────────────────────────────────────────────────────────────────││ │
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
    │                                   │                                   │ 7. 监控资源/超时
    │                                   │                                   │──┐
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
    │                                   │                                   │ 8. 输出过滤
    │                                   │                                   │──┐
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
    │  9. 返回结果                      │                                   │
    │<──────────────────────────────────────────────────────────────────────│
    │                                   │                                   │
    │                                   │  10. 清理 Sandbox                  │
    │                                   │──────────────────────────────────>│
    │                                   │                                   │
    │                                   │                                   │ 11. 释放资源
    │                                   │                                   │──┐
    │                                   │                                   ││ │
    │                                   │                                   │◄─┘
    │                                   │                                   │
```

---

## 十一、总结与展望 (Summary and Future Work)

### 11.1 功能清单

| 功能模块 | 功能点 | 优先级 | 状态 |
|---------|--------|--------|------|
| **存储** | Skill 包存储 | P0 | 设计完成 |
| **存储** | 版本管理 | P0 | 设计完成 |
| **索引** | 全文索引 | P0 | 设计完成 |
| **索引** | 分类索引 | P0 | 设计完成 |
| **搜索** | 关键词搜索 | P0 | 设计完成 |
| **搜索** | 筛选搜索 | P0 | 设计完成 |
| **分发** | CDN 加速 | P0 | 设计完成 |
| **分发** | 断点续传 | P1 | 设计完成 |
| **发现** | 分类浏览 | P1 | 设计完成 |
| **发现** | 热门推荐 | P1 | 设计完成 |
| **发现** | 个性化推荐 | P2 | 设计完成 |
| **安装** | 依赖检查 | P1 | 设计完成 |
| **安装** | 兼容性验证 | P1 | 设计完成 |
| **安装** | 权限申请 | P1 | 设计完成 |
| **升级** | 版本对比 | P1 | 设计完成 |
| **升级** | 迁移脚本 | P1 | 设计完成 |
| **升级** | 回滚支持 | P1 | 设计完成 |
| **卸载** | 依赖检查 | P1 | 设计完成 |
| **卸载** | 数据清理 | P1 | 设计完成 |
| **评分** | 星级评分 | P1 | 设计完成 |
| **评分** | 使用统计 | P1 | 设计完成 |
| **评分** | 用户反馈 | P1 | 设计完成 |
| **审核** | 自动扫描 | P0 | 设计完成 |
| **审核** | 人工审核 | P0 | 设计完成 |
| **沙箱** | 资源限制 | P0 | 设计完成 |
| **沙箱** | 超时控制 | P0 | 设计完成 |
| **沙箱** | 输出过滤 | P0 | 设计完成 |

### 11.2 后续演进方向

| 方向 | 描述 | 优先级 |
|------|------|--------|
| **AI 驱动推荐** | 基于大模型的语义理解和个性化推荐 | P2 |
| **Skill 组合市场** | 支持 Skill 工作流/编排模板的交易 | P2 |
| **开发者生态** | 开发者中心、收益分成、激励计划 | P2 |
| **企业增强** | 私有市场、审批流、审计合规 | P1 |
| **国际化** | 多语言支持、区域市场 | P3 |
| **开放 API** | 第三方集成、Webhook、事件订阅 | P2 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成 | 维护团队：AI 团队 + 架构师团队_
