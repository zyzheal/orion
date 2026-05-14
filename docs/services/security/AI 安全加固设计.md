# Orion 平台 AI 安全加固设计方案

## 1. 概述

本设计方案针对安全专家评审发现的三大缺陷进行系统性加固：
- **Prompt 注入防护可绕过**
- **AI Skill 无沙箱隔离**
- **输出无 DLP（数据防泄漏）**

---

## 2. Prompt 注入防护体系

### 2.1 整体防护流程

```mermaid
flowchart TD
    A[用户输入] --> B[输入标准化模块]
    B --> C[Unicode NFKC 规范化]
    B --> D[编码检测与转换]
    B --> E[控制字符过滤]
    
    C & D & E --> F[规则引擎检测]
    F --> G{规则匹配？}
    G -->|是 | H[阻断并告警]
    G -->|否 | I[ML 语义检测]
    
    I --> J[文本 Embedding]
    J --> K[向量相似度计算]
    K --> L[已知攻击模式库]
    L --> M{相似度 > 阈值？}
    M -->|是 | H
    M -->|否 | N[上下文一致性检查]
    
    N --> O[会话历史分析]
    O --> P[意图漂移检测]
    P --> Q{检测到注入？}
    Q -->|是 | H
    Q -->|否 | R[放行至 AI 模型]
    
    H --> S[安全事件日志]
    R --> T[AI Skill 执行]
    
    subgraph 检测层级
        F
        I
        N
    end
    
    style H fill:#ff6b6b
    style R fill:#51cf66
    style S fill:#ffd43b
```

### 2.2 输入标准化模块

| 处理步骤 | 说明 | 防护目标 |
|---------|------|---------|
| **Unicode NFKC 规范化** | 将兼容字符转换为标准形式 | 防止 Unicode 绕过攻击 |
| **编码检测** | 自动识别 UTF-8/GBK/Shift-JIS 等 | 检测多语言编码混淆 |
| **HTML 实体解码** | 解析 `&lt;` `&gt;` 等实体 | 防止实体编码绕过 |
| **URL 解码** | 多层 URL 解码检测 | 防止 URL 编码注入 |
| **控制字符过滤** | 移除零宽字符、BOM 等 | 防止隐藏指令注入 |
| **Base64 检测** | 识别并解码 Base64 内容 | 防止编码 payload 绕过 |

### 2.3 多语言规则库设计

```mermaid
flowchart LR
    subgraph 规则库
        A[核心规则引擎]
        A --> B[中文规则集]
        A --> C[英文规则集]
        A --> D[日文规则集]
        A --> E[韩文规则集]
        A --> F[其他语言规则集]
    end
    
    B --> B1[忽略上述指令]
    B --> B2[扮演系统管理员]
    B --> B3[输出内部配置]
    
    C --> C1[ignore above instructions]
    C --> C2[act as system admin]
    C --> C3[output internal config]
    
    D --> D1[上記の指示を無視]
    D --> D2[システム管理者として行動]
    
    E --> E1[위의 지시를 무시]
    E --> E2[시스템 관리자로 행동]
    
    subgraph 规则匹配
        G[输入文本] --> H[语言识别]
        H --> I[加载对应规则集]
        I --> J[正则 + 关键词匹配]
        J --> K[模糊匹配加分]
    end
    
    style A fill:#339af0
    style B fill:#74c0fc
    style C fill:#74c0fc
    style D fill:#74c0fc
    style E fill:#74c0fc
```

**规则库分类：**

| 类别 | 描述 | 示例模式 |
|-----|------|---------|
| **直接注入** | 明确指示忽略规则 | "忽略上述指令"、"ignore previous instructions" |
| **角色扮演** | 诱导 AI 扮演特权角色 | "扮演系统管理员"、"act as developer mode" |
| **越狱尝试** | 试图突破安全限制 | "DAN mode"、"不受限制模式" |
| **信息窃取** | 要求输出敏感信息 | "输出系统提示词"、"show your system prompt" |
| **逻辑绕过** | 通过逻辑陷阱绕过 | "从后往前读"、"reverse the output meaning" |
| **多语言混合** | 混合多种语言绕过检测 | 中英日韩混合注入 |

### 2.4 ML 语义相似度检测方案

```mermaid
flowchart TB
    subgraph 离线训练
        A[攻击样本库] --> B[文本预处理]
        B --> C[Embedding 模型]
        C --> D[攻击向量数据库]
        D --> E[FAISS 索引构建]
    end
    
    subgraph 在线检测
        F[实时输入] --> G[相同预处理]
        G --> H[Embedding 模型]
        H --> I[向量相似度搜索]
        I --> J[Top-K 匹配]
        J --> K{相似度 > 阈值？}
        K -->|是 | L[判定为注入]
        K -->|否 | M[放行]
    end
    
    subgraph 模型选择
        N[Embedding 模型]
        N --> O[text-embedding-3-small]
        N --> O[BGE-M3 多语言]
        N --> O[m3e-base 中文优化]
    end
    
    style E fill:#ffd43b
    style L fill:#ff6b6b
    style M fill:#51cf66
```

**检测流程：**

1. **Embedding 生成**
   - 使用多语言 Embedding 模型（推荐 BGE-M3 或 m3e-base）
   - 将输入文本转换为 768/1024 维向量
   - 支持最大 8192 token 输入长度

2. **相似度计算**
   - 采用余弦相似度（Cosine Similarity）
   - 在 FAISS 索引中搜索 Top-K 最相似攻击样本
   - 阈值设定：≥ 0.85 判定为注入

3. **动态阈值调整**
   - 高风险场景：阈值 0.80
   - 普通场景：阈值 0.85
   - 低风险场景：阈值 0.90

4. **攻击样本库持续更新**
   - 收集真实攻击样本
   - 人工标注 + 自动聚类
   - 每周更新向量索引

---

## 3. AI Skill 沙箱隔离架构

### 3.1 沙箱整体架构

```mermaid
flowchart TB
    subgraph 宿主层
        A[Orion 主控节点]
        B[容器编排平台 Kubernetes]
    end
    
    subgraph 沙箱管理层
        C[沙箱调度器]
        D[资源配额管理]
        E[网络策略控制器]
    end
    
    subgraph gVisor 轻量沙箱
        F[gVisor Runtime]
        F --> F1[Sentry 内核模拟]
        F --> F2[Gofer 文件系统]
        F1 --> F3[受限系统调用]
        F2 --> F4[临时文件系统]
    end
    
    subgraph Firecracker 重型沙箱
        G[Firecracker VMM]
        G --> G1[MicroVM 隔离]
        G --> G2[独立内核]
        G1 --> G3[完整系统调用]
        G2 --> G4[独立命名空间]
    end
    
    subgraph AI Skill 执行
        H[Skill A - 数据分析]
        I[Skill B - 图像处理]
        J[Skill C - 代码执行]
    end
    
    A --> C
    B --> C
    C -->|低风险 Skill| F
    C -->|高风险 Skill| G
    D --> F & G
    E --> F & G
    F --> H & I
    G --> J
    
    style F fill:#74c0fc
    style G fill:#ff6b6b
    style H fill:#51cf66
    style I fill:#51cf66
    style J fill:#ffd43b
```

### 3.2 沙箱选型策略

| 沙箱类型 | 适用场景 | 隔离强度 | 启动时间 | 资源开销 |
|---------|---------|---------|---------|---------|
| **gVisor** | 低风险 Skill、快速执行 | 中等 | < 100ms | 低 |
| **Firecracker** | 高风险 Skill、代码执行 | 高 | 100-500ms | 中 |
| **传统容器** | 仅内部可信 Skill | 低 | < 50ms | 极低 |

**决策流程：**

```mermaid
flowchart TD
    A[Skill 请求执行] --> B{风险等级评估}
    
    B -->|低风险<br/>只读操作、数据查询 | C[gVisor 沙箱]
    B -->|中风险<br/>文件写入、网络访问 | C
    B -->|高风险<br/>代码执行、系统调用 | D[Firecracker MicroVM]
    B -->|可信内部<br/>经过审计的官方 Skill| E[受限容器]
    
    C --> F[执行并监控]
    D --> F
    E --> F
    
    F --> G{执行完成？}
    G -->|是 | H[结果返回 + 资源清理]
    G -->|超时/异常 | I[强制终止 + 告警]
    
    style C fill:#74c0fc
    style D fill:#ff6b6b
    style E fill:#51cf66
    style I fill:#ffd43b
```

### 3.3 资源配额管理

**配额维度：**

| 资源类型 | 限制项 | 默认值 | 可配置范围 |
|---------|-------|-------|-----------|
| **CPU** | 核心数上限 | 1 核 | 0.1 - 4 核 |
| **CPU** | 时间片（每次调用） | 30 秒 | 1 - 300 秒 |
| **内存** | 最大内存 | 512MB | 64MB - 4GB |
| **磁盘** | 临时存储 | 100MB | 10MB - 1GB |
| **网络** | 出站连接数 | 10 | 0 - 100 |
| **执行** | 总时长（单次请求） | 60 秒 | 10 - 600 秒 |

**配额执行机制：**

```mermaid
flowchart LR
    subgraph 配额检查
        A[Skill 启动] --> B[检查可用配额]
        B --> C{配额充足？}
        C -->|否 | D[拒绝执行]
        C -->|是 | E[分配资源]
    end
    
    subgraph 运行时监控
        E --> F[周期性资源采样]
        F --> G{超出配额？}
        G -->|是 | H[限流或终止]
        G -->|否 | I[继续执行]
    end
    
    subgraph 结束处理
        I --> J[执行完成]
        H --> K[强制终止]
        D --> K
        J & K --> L[释放资源 + 记录用量]
    end
    
    style D fill:#ff6b6b
    style H fill:#ff6b6b
    style L fill:#51cf66
```

### 3.4 网络访问白名单（SSRF 防护）

```mermaid
flowchart TB
    subgraph 网络策略
        A[Skill 网络请求] --> B[网络策略控制器]
        B --> C{目标地址检查}
    end
    
    subgraph 黑名单拦截
        C --> D[内网地址？<br/>10.0.0.0/8<br/>172.16.0.0/12<br/>192.168.0.0/16]
        C --> E[元数据端点？<br/>169.254.169.254]
        C --> F[localhost/127.0.0.1]
        D & E & F --> G[直接阻断]
    end
    
    subgraph 白名单放行
        C --> H{在白名单中？}
        H -->|是 | I[DNS 解析]
        I --> J{解析后 IP 检查}
        J -->|内网 IP| G
        J -->|公网 IP| K[放行]
        H -->|否 | G
    end
    
    subgraph 白名单配置
        L[允许的域名列表]
        M[允许的 IP 段列表]
        N[允许的端口列表]
        L & M & N --> H
    end
    
    style G fill:#ff6b6b
    style K fill:#51cf66
    style L fill:#ffd43b
```

**白名单配置示例：**

| 类型 | 配置项 | 说明 |
|-----|-------|------|
| **域名白名单** | `api.openai.com` | 允许的 API 端点 |
| **域名白名单** | `*.azure.com` | 允许的通配符域名 |
| **IP 白名单** | `52.0.0.0/8` | 允许的 IP 段 |
| **端口限制** | `443, 8443` | 仅允许 HTTPS 端口 |
| **协议限制** | `HTTPS only` | 禁止 HTTP/FTP 等明文协议 |

---

## 4. 输出 DLP（数据防泄漏）

### 4.1 DLP 处理流程

```mermaid
flowchart TD
    A[AI 模型输出] --> B[DLP 检测引擎]
    
    B --> C[敏感信息识别]
    C --> D[PII 检测]
    C --> E[凭证检测]
    C --> F[业务数据检测]
    
    D --> D1[身份证号]
    D --> D2[手机号]
    D --> D3[邮箱地址]
    D --> D4[银行卡号]
    
    E --> E1[API Key]
    E --> E2[密码/Token]
    E --> E3[私钥证书]
    
    F --> F1[客户数据]
    F --> F2[财务数据]
    F --> F3[源代码]
    
    D1 & D2 & D3 & D4 & E1 & E2 & E3 & F1 & F2 & F3 --> G{检测到敏感信息？}
    
    G -->|是 | H[脱敏处理]
    G -->|否 | I[原样输出]
    
    H --> J[脱敏策略应用]
    J --> K[记录审计日志]
    K --> L[输出脱敏后内容]
    
    I --> M[输出原始内容]
    
    subgraph 脱敏策略
        J --> N[掩码替换 ****]
        J --> O[哈希替代]
        J --> P[占位符替换]
    end
    
    style G fill:#ffd43b
    style H fill:#ff6b6b
    style I fill:#51cf66
    style L fill:#51cf66
```

### 4.2 敏感信息检测规则

| 数据类型 | 检测模式 | 脱敏方式 | 示例 |
|---------|---------|---------|------|
| **身份证号** | 18 位数字 + 校验码 | 显示前 3 后 4 | `110***********1234` |
| **手机号** | 11 位数字 | 显示前 3 后 4 | `138****5678` |
| **邮箱地址** | 标准邮箱格式 | 隐藏用户名 | `ab**@example.com` |
| **银行卡号** | 16-19 位数字 | 显示后 4 位 | `**** **** **** 1234` |
| **API Key** | 特定前缀 + 随机串 | 完全隐藏 | `[REDACTED]` |
| **密码** | 常见密码字段名 | 完全隐藏 | `[REDACTED]` |
| **私钥** | `-----BEGIN.*KEY-----` | 完全隐藏 | `[REDACTED]` |
| **IP 地址** | IPv4/IPv6 格式 | 隐藏后两段 | `192.168.*.*` |

### 4.3 DLP 架构

```mermaid
flowchart TB
    subgraph 检测层
        A[正则表达式引擎]
        B[命名实体识别 NER]
        C[自定义关键词匹配]
    end
    
    subgraph 决策层
        D[风险评分计算]
        E[脱敏策略选择]
        F[审计日志记录]
    end
    
    subgraph 执行层
        G[内容替换]
        H[格式保持]
        I[输出验证]
    end
    
    A & B & C --> D
    D --> E
    E --> F
    E --> G
    G --> H
    H --> I
    
    style A fill:#74c0fc
    style B fill:#74c0fc
    style D fill:#ffd43b
    style G fill:#51cf66
```

---

## 5. 安全事件审计与告警

### 5.1 审计日志结构

```mermaid
flowchart LR
    subgraph 日志字段
        A[时间戳]
        B[事件类型]
        C[风险等级]
        D[源 IP/用户]
        E[Skill 标识]
        F[事件详情]
        G[处置动作]
    end
    
    subgraph 存储与分析
        H[Elasticsearch 集群]
        I[实时告警]
        J[离线分析]
        K[报表生成]
    end
    
    A & B & C & D & E & F & G --> H
    H --> I & J & K
    
    style I fill:#ff6b6b
    style K fill:#51cf66
```

### 5.2 告警分级

| 级别 | 触发条件 | 响应方式 |
|-----|---------|---------|
| **P0 - 严重** | 成功注入攻击、数据泄露 | 立即通知 + 自动阻断 |
| **P1 - 高** | 多次注入尝试、沙箱逃逸 | 5 分钟内通知 |
| **P2 - 中** | 规则匹配、配额超限 | 每小时汇总通知 |
| **P3 - 低** | 异常输入模式 | 日报汇总 |

---

## 6. 实施路线图

```mermaid
gantt
    title AI 安全加固实施计划
    dateFormat YYYY-MM-DD
    section 第一阶段
    输入标准化模块 :done, des1, 2024-01-01, 14d
    规则引擎开发 :active, des2, 2024-01-15, 21d
    section 第二阶段
    ML 检测模型训练 : des3, 2024-02-01, 28d
    向量数据库部署 : des4, 2024-02-15, 14d
    section 第三阶段
    gVisor 沙箱集成 : des5, 2024-03-01, 21d
    Firecracker 集成 : des6, 2024-03-15, 21d
    section 第四阶段
    DLP 引擎开发 : des7, 2024-04-01, 28d
    审计告警系统 : des8, 2024-04-15, 14d
    section 第五阶段
    全量测试 : des9, 2024-05-01, 14d
    灰度发布 : des10, 2024-05-15, 14d
```

---

## 7. 总结

本方案针对 Orion 平台 AI 安全薄弱环节提供系统性加固：

| 缺陷 | 解决方案 | 核心能力 |
|-----|---------|---------|
| **Prompt 注入可绕过** | 多层检测体系 | 规则引擎 + ML 语义检测 + 上下文分析 |
| **AI Skill 无沙箱** | gVisor/Firecracker 双沙箱 | 资源隔离 + 网络白名单 + 配额管理 |
| **输出无 DLP** | 敏感信息自动脱敏 | PII 检测 + 凭证识别 + 审计日志 |

通过三层防护（输入检测、执行隔离、输出脱敏）构建完整的 AI 安全闭环。
