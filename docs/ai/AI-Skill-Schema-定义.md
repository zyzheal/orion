# AI Skill Schema 定义

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：AI 团队 + 架构师团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、AI Skill 概念

### 1.1 什么是 AI Skill

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 概念说明                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AI Skill 是 Orion 平台中 AI 能力的标准化封装单元。                 │
│                                                                 │
│  类比理解：                                                      │
│  • 类似 Kubernetes 中的 Pod - 最小部署单元                       │
│  • 类似 VSCode 中的 Extension - 可扩展功能单元                   │
│  • 类似 Slack 中的 App - 第三方能力集成                          │
│                                                                 │
│  AI Skill 特点：                                                 │
│  • 标准化：统一的输入/输出/配置格式                             │
│  • 可组合：多个 Skill 可以组合使用                               │
│  • 可复用：一次开发，多处使用                                   │
│  • 可度量：调用次数/成功率/成本可追踪                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 AI Skill 应用场景

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 应用场景                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  场景 1: 代码审查                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Skill 名称：code-review                                   │   │
│  │ 输入：代码 diff + 编程语言 + 审查规则                       │   │
│  │ 输出：问题列表 + 修复建议 + 风险评分                       │   │
│  │ 使用：PR 提交时自动触发                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 2: 测试生成                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Skill 名称：test-generator                                │   │
│  │ 输入：源代码 + 测试框架 + 覆盖率要求                       │   │
│  │ 输出：测试代码 + 测试用例说明                             │   │
│  │ 使用：开发完成后一键生成测试                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 3: 日志分析                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Skill 名称：log-analyzer                                  │   │
│  │ 输入：日志内容 + 时间范围 + 异常模式                       │   │
│  │ 输出：异常根因 + 影响范围 + 修复建议                       │   │
│  │ 使用：故障排查时自动分析日志                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 4: SQL 审核                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Skill 名称：sql-review                                    │   │
│  │ 输入：SQL 语句 + 表结构 + 数据量                            │   │
│  │ 输出：性能评估 + 索引建议 + 风险评估                       │   │
│  │ 使用：数据库变更前自动审核                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 5: 文档生成                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Skill 名称：doc-generator                                 │   │
│  │ 输入：代码/接口定义 + 文档模板                            │   │
│  │ 输出：API 文档/README/CHANGELOG                           │   │
│  │ 使用：发布前自动生成文档                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、AI Skill Schema 定义

### 2.1 Skill 元数据

```yaml
# AI Skill 元数据定义
# 文件名：skill.yaml

# 基本信息
name: code-review-skill           # Skill 名称（唯一标识）
version: 1.0.0                     # 语义化版本
description: AI 代码审查技能         # 描述

# 作者信息
author: AI 团队
author_email: ai-team@company.com

# 技术信息
provider: ai-team                  # 提供者（团队/组织）
homepage: https://skills.orion.internal/code-review
repository: https://gitlab.internal/ai-skills/code-review
documentation: https://docs.orion.internal/skills/code-review

# 依赖
requires_orion_version: ">=1.0.0"  # 最低 Orion 版本
required_skills: []                # 依赖的其他 Skill（可选）

# 模型配置
model:
  provider: qwen                   # 模型提供商：qwen/openai/claude
  name: qwen-3                     # 模型名称
  version: "3.0"                   # 模型版本
  max_tokens: 4096                 # 最大 Token 数
  temperature: 0.3                 # 温度参数 (0-1)

# 权限
permissions:
  - code.read                      # 读取代码
  - repository.access              # 访问仓库
  - llm.call                       # 调用 LLM

# 标签（用于分类和搜索）
tags:
  - code-review
  - security
  - quality

# 创建/更新时间
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
```

---

### 2.2 输入 Schema

```yaml
# AI Skill 输入 Schema 定义
# 使用 JSON Schema 标准

input_schema:
  type: object
  required:
    - diff                          # 必填字段
  properties:
    diff:
      type: string
      description: 代码 diff 内容
      example: |
        diff --git a/src/main.py b/src/main.py
        index 1234567..8901234 100644
        --- a/src/main.py
        +++ b/src/main.py
        @@ -1,5 +1,6 @@
        +import logging
        +
         def process_data(data):
        -    print(data)
        +    logging.info(f"Processing: {data}")
    
    language:
      type: string
      description: 编程语言
      enum:
        - python
        - java
        - javascript
        - typescript
        - go
        - rust
      default: python
    
    file_path:
      type: string
      description: 文件路径
      example: src/main.py
    
    review_rules:
      type: array
      description: 审查规则列表
      items:
        type: string
        enum:
          - security         # 安全检查
          - performance      # 性能检查
          - best-practice    # 最佳实践
          - style           # 代码风格
      default:
        - security
        - performance
        - best-practice
    
    context:
      type: object
      description: 上下文信息
      properties:
        project_name:
          type: string
        branch_name:
          type: string
        pr_id:
          type: integer
```

---

### 2.3 输出 Schema

```yaml
# AI Skill 输出 Schema 定义

output_schema:
  type: object
  properties:
    success:
      type: boolean
      description: 执行是否成功
    
    result:
      type: object
      description: 审查结果
      properties:
        passed:
          type: boolean
          description: 是否通过审查
        
        score:
          type: integer
          description: 代码质量评分 (0-100)
          minimum: 0
          maximum: 100
        
        issues:
          type: array
          description: 发现的问题列表
          items:
            type: object
            properties:
              id:
                type: string
                description: 问题 ID
              severity:
                type: string
                description: 严重级别
                enum: [critical, high, medium, low, info]
              category:
                type: string
                description: 问题类别
                enum: [security, performance, best-practice, style]
              message:
                type: string
                description: 问题描述
              location:
                type: object
                properties:
                  file:
                    type: string
                  line:
                    type: integer
                  column:
                    type: integer
              suggestion:
                type: string
                description: 修复建议
              code_fix:
                type: string
                description: 建议的修复代码（可选）
        
        summary:
          type: string
          description: 审查摘要
        
        positive_feedback:
          type: array
          description: 正面反馈（代码亮点）
          items:
            type: string
    
    confidence:
      type: number
      description: 置信度 (0-1)
      minimum: 0
      maximum: 1
    
    metadata:
      type: object
      description: 元数据
      properties:
        model_used:
          type: string
          description: 使用的模型
        tokens_used:
          type: integer
          description: 消耗的 Token 数
        processing_time_ms:
          type: integer
          description: 处理时间（毫秒）
    
    error:
      type: string
      description: 错误信息（失败时）
```

---

### 2.4 配置 Schema

```yaml
# AI Skill 配置 Schema 定义
# 用户可以在使用 Skill 时自定义这些配置

config_schema:
  type: object
  properties:
    # 模型配置
    model:
      type: object
      properties:
        provider:
          type: string
          description: 模型提供商
          enum: [qwen, openai, claude]
          default: qwen
        name:
          type: string
          description: 模型名称
          default: qwen-3
        max_tokens:
          type: integer
          description: 最大 Token 数
          default: 4096
          minimum: 100
          maximum: 32768
        temperature:
          type: number
          description: 温度参数
          default: 0.3
          minimum: 0
          maximum: 1
    
    # 审查规则配置
    review_rules:
      type: object
      properties:
        enabled:
          type: array
          description: 启用的规则
          items:
            type: string
            enum: [security, performance, best-practice, style]
          default: [security, performance, best-practice]
        
        custom_rules:
          type: array
          description: 自定义规则
          items:
            type: object
            properties:
              name:
                type: string
              pattern:
                type: string
              message:
                type: string
              severity:
                type: string
                enum: [critical, high, medium, low, info]
    
    # 输出配置
    output:
      type: object
      properties:
        format:
          type: string
          description: 输出格式
          enum: [json, markdown, plain]
          default: json
        include_code_fix:
          type: boolean
          description: 是否包含修复代码
          default: true
        max_issues:
          type: integer
          description: 最大返回问题数
          default: 50
    
    # 缓存配置
    cache:
      type: object
      properties:
        enabled:
          type: boolean
          description: 是否启用缓存
          default: true
        ttl_seconds:
          type: integer
          description: 缓存过期时间（秒）
          default: 3600
    
    # 成本配置
    cost:
      type: object
      properties:
        budget_limit:
          type: number
          description: 单次调用预算上限（元）
          default: 1.0
        alert_threshold:
          type: number
          description: 成本告警阈值（元）
          default: 0.5
```

---

## 三、Skill 生命周期

### 3.1 Skill 开发流程

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 开发流程                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  步骤 1: 需求分析                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 明确 Skill 应用场景                                     │   │
│  │ • 定义输入/输出格式                                       │   │
│  │ • 确定使用的 AI 模型                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  步骤 2: 编写 Skill 定义                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 创建 skill.yaml（元数据）                               │   │
│  │ • 定义 input_schema（输入格式）                           │   │
│  │ • 定义 output_schema（输出格式）                          │   │
│  │ • 定义 config_schema（配置项）                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  步骤 3: 实现 Skill 逻辑                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 编写 Prompt 模板                                        │   │
│  │ • 实现输入预处理                                          │   │
│  │ • 调用 LLM API                                            │   │
│  │ • 实现输出后处理                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  步骤 4: 测试验证                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 单元测试：验证输入/输出格式                             │   │
│  │ • 集成测试：验证 LLM 调用                                 │   │
│  │ • 效果测试：验证输出质量                                  │   │
│  │ • 性能测试：验证响应时间                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  步骤 5: 发布上架                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 打包 Skill（包含定义 + 实现 + 测试）                     │   │
│  │ • 提交到 Skill 市场                                        │   │
│  │ • 通过审核后上架                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Skill 版本管理

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 版本管理规则                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  语义化版本规范 (SemVer):                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  主版本。次版本。修订版本                                  │   │
│  │     │      │      │                                     │   │
│  │     │      │      └─ 向后兼容的问题修复                   │   │
│  │     │      └─ 向后兼容的功能新增                         │   │
│  │     └─ 不向后兼容的重大变更                              │   │
│  │                                                         │   │
│  │  示例：                                                   │   │
│  │  • 1.0.0 → 初始版本                                      │   │
│  │  • 1.0.1 → 修复 bug                                      │   │
│  │  • 1.1.0 → 新增功能                                      │   │
│  │  • 2.0.0 → 破坏性变更                                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  版本兼容性规则：                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  • 主版本相同 → 完全兼容，可无缝升级                       │   │
│  │  • 主版本不同 → 可能不兼容，需迁移                         │   │
│  │  • 废弃功能 → 提前 1 个主版本标记 deprecated                │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  版本发布流程：                                                  │
│  开发版本 (dev) → 测试版本 (rc) → 稳定版本 (release) → 生产版本  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、Skill 组合与编排

### 4.1 Skill 组合模式

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 组合模式                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  模式 1: 串行组合（Pipeline）                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Skill A  →  Skill B  →  Skill C                         │   │
│  │     │         │          │                              │   │
│  │     └─────────┴──────────┘                              │   │
│  │           输出作为下一个输入                               │   │
│  │                                                         │   │
│  │  示例：代码审查流水线                                     │   │
│  │  style-check → security-check → performance-check       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  模式 2: 并行组合（Fan-out）                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              ┌→  Skill A  ─┐                             │   │
│  │  输入  ──────┼→  Skill B  ─┼→  结果聚合                   │   │
│  │              └→  Skill C  ─┘                             │   │
│  │                                                         │   │
│  │  示例：多维度代码分析                                     │   │
│  │  同时执行：安全检查 + 性能分析 + 规范检查 → 汇总报告       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  模式 3: 条件组合（Conditional）                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │           ┌─ 条件 A ─→  Skill A ─┐                       │   │
│  │  输入  ───┼─ 条件 B ─→  Skill B  ┼→  结果                │   │
│  │           └─ 条件 C ─→  Skill C ─┘                       │   │
│  │                                                         │   │
│  │  示例：根据文件类型选择审查规则                           │   │
│  │  • .py 文件 → Python 审查 Skill                           │   │
│  │  • .java 文件 → Java 审查 Skill                           │   │
│  │  • .sql 文件 → SQL 审查 Skill                             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Skill 编排配置

```yaml
# Skill 编排定义
# 文件名：workflow.yaml

name: comprehensive-code-review
description: 综合代码审查工作流
version: 1.0.0

# 使用的 Skill 列表
skills:
  - id: style-check
    skill_name: code-style-check
    version: "1.0"
  
  - id: security-check
    skill_name: security-review
    version: "2.0"
  
  - id: performance-check
    skill_name: performance-review
    version: "1.0"
  
  - id: summary
    skill_name: review-summary
    version: "1.0"

# 执行流程
workflow:
  # 第一阶段：并行执行各项检查
  - stage: parallel-check
    type: parallel
    skills:
      - style-check
      - security-check
      - performance-check
  
  # 第二阶段：汇总结果
  - stage: generate-summary
    type: sequential
    skills:
      - summary
    inputs:
      from_previous_stage: true

# 错误处理
error_handling:
  on_skill_failure: continue  # 单个 Skill 失败继续执行
  max_retries: 2              # 最大重试次数
  timeout_seconds: 300        # 总超时时间

# 输出配置
output:
  format: markdown
  include_all_results: true   # 包含所有中间结果
```

---

## 五、Skill 市场

### 5.1 Skill 市场架构

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 市场架构                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Skill 来源：                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Orion 官方    │  │ 社区贡献     │  │ 企业内部     │         │
│  │ (官方维护)   │  │ (开发者投稿)  │  │ (团队开发)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Skill 分类：                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  代码开发类：                                            │   │
│  │  • code-review      代码审查                            │   │
│  │  • test-generator   测试生成                            │   │
│  │  • doc-generator    文档生成                            │   │
│  │  • code-refactor    代码重构                            │   │
│  │                                                         │   │
│  │  安全合规类：                                            │   │
│  │  • security-scan    安全扫描                            │   │
│  │  • compliance-check 合规检查                            │   │
│  │  • secret-detect    敏感信息检测                        │   │
│  │                                                         │   │
│  │  运维监控类：                                            │   │
│  │  • log-analyzer     日志分析                            │   │
│  │  • alert-triage     告警分诊                            │   │
│  │  • root-cause       根因分析                            │   │
│  │                                                         │   │
│  │  数据库类：                                              │   │
│  │  • sql-review       SQL 审查                             │   │
│  │  • index-advisor    索引优化                            │   │
│  │  • migration-check  迁移检查                            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Skill 质量评级：                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ⭐⭐⭐⭐⭐ 官方认证 + 高使用量 + 好评率>95%                  │   │
│  │  ⭐⭐⭐⭐  社区认可 + 使用量>1000 + 好评率>90%              │   │
│  │  ⭐⭐⭐   已验证 + 使用量>100 + 好评率>80%                 │   │
│  │  ⭐⭐    新上架 + 测试通过                                │   │
│  │  ⭐     开发中 + 未验证                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Skill 安装与使用

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 安装与使用流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  安装流程：                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  1. 浏览 Skill 市场                                        │   │
│  │     • 按分类浏览                                         │   │
│  │     • 搜索关键词                                         │   │
│  │     • 查看评分和评价                                     │   │
│  │                                                         │   │
│  │  2. 查看 Skill 详情                                        │   │
│  │     • 功能说明                                           │   │
│  │     • 输入/输出示例                                       │   │
│  │     • 配置说明                                           │   │
│  │     • 使用成本预估                                       │   │
│  │                                                         │   │
│  │  3. 一键安装                                              │   │
│  │     • 点击安装按钮                                       │   │
│  │     • 确认权限和成本                                     │   │
│  │     • 安装完成，立即可用                                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  使用流程：                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  方式 1: 在流水线中使用                                    │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │ stages:                                            │ │   │
│  │  │   - name: code-review                              │ │   │
│  │  │     skill: code-review-skill                       │ │   │
│  │  │     config:                                        │ │   │
│  │  │       review_rules: [security, performance]        │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  │  方式 2: 在 UI 中调用                                      │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │ 1. 选择 Skill                                       │ │   │
│  │  │ 2. 输入参数                                         │ │   │
│  │  │ 3. 点击执行                                         │ │   │
│  │  │ 4. 查看结果                                         │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  │  方式 3: 通过 CLI 调用                                     │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │ $ orion skill run code-review-skill \              │ │   │
│  │  │   --input diff.txt \                               │ │   │
│  │  │   --config review_rules=security,performance       │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、Skill 测试与验证

### 6.1 测试流程

```
┌─────────────────────────────────────────────────────────────────┐
│              AI Skill 测试验证流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  测试类型：                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  1. 格式测试                                             │   │
│  │     • 验证输入 Schema 符合性                              │   │
│  │     • 验证输出 Schema 符合性                              │   │
│  │     • 验证配置 Schema 符合性                              │   │
│  │                                                         │   │
│  │  2. 功能测试                                             │   │
│  │     • 验证核心功能正确性                                 │   │
│  │     • 验证边界条件处理                                   │   │
│  │     • 验证错误处理                                       │   │
│  │                                                         │   │
│  │  3. 效果测试                                             │   │
│  │     • 使用验证集测试输出质量                             │   │
│  │     • 计算准确率/召回率/F1 值                             │   │
│  │     • 人工评审输出质量                                   │   │
│  │                                                         │   │
│  │  4. 性能测试                                             │   │
│  │     • 测试响应时间                                       │   │
│  │     • 测试并发能力                                       │   │
│  │     • 测试资源消耗                                       │   │
│  │                                                         │   │
│  │  5. 成本测试                                             │   │
│  │     • 测试 Token 消耗                                     │   │
│  │     • 验证成本预估准确性                                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  验证集要求：                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  • 每个 Skill 至少需要 100 条验证用例                       │   │
│  │  • 验证集需覆盖各种场景和边界条件                         │   │
│  │  • 验证集需定期更新（至少每季度）                         │   │
│  │  • 验证集需包含预期输出（用于自动化测试）                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、总结

### 7.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| Skill 元数据定义 | ✅ | 完整 YAML Schema |
| 输入 Schema | ✅ | JSON Schema 标准 |
| 输出 Schema | ✅ | JSON Schema 标准 |
| 配置 Schema | ✅ | 用户可自定义配置 |
| 版本管理 | ✅ | 语义化版本规范 |
| Skill 组合 | ✅ | 串行/并行/条件组合 |
| Skill 市场 | ✅ | 官方/社区/企业来源 |
| 测试验证 | ✅ | 5 层测试 + 验证集要求 |

### 7.2 与 Plugin SPI 关系

| 特性 | AI Skill | Plugin |
|------|---------|--------|
| 用途 | AI 能力标准化 | 通用扩展能力 |
| 范围 | 专注 AI 场景 | 全场景扩展 |
| 复杂度 | 低（配置为主） | 高（需编码） |
| 开发门槛 | 低（定义 YAML） | 高（实现接口） |
| 运行环境 | Orion 托管 | 沙箱隔离 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，可进入开发_
