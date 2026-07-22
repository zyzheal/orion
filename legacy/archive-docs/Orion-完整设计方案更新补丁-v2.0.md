# Orion-完整设计方案更新补丁 (v2.0)

> **更新日期**: 2026-04-11  
> **更新内容**: 22 个功能维度→37 个模块，169 功能→251 功能  
> **关联文档**: docs/requirements/需求功能更新汇总.md

---

## 一、第 2 节 功能维度全景图更新

### 更新前
```markdown
Orion 覆盖 22 个功能维度
```

### 更新后
```markdown
Orion 覆盖 37 个核心模块 (251 个功能点)

按层级分类:
- Layer 1 用户交互层：5 个模块 (23 功能)
- Layer 2 业务编排层：6 个模块 (36 功能)
- Layer 3 AI 智能层：7 个模块 (56 功能)
- Layer 4 平台服务层：13 个模块 (97 功能)
- Layer 5 基础设施层：5 个模块 (33 功能)
- 可插拔模块：1 个 (6 功能)

总计：37 模块 | 251 功能 | AI 功能 52 个 (23%)
```

---

## 二、功能维度表更新

### 原表 (22 个维度)
```
① 代码管理 ... ㉒ 安全审计中心
```

### 更新后 (37 个模块)

| # | 模块 | 核心能力 | 功能数 |
|---|------|---------|--------|
| ① | 效能看板 | DORA 四指标、团队对比、趋势分析、AI 改进建议、自动周报 | 5 |
| ② | 流水线可视化 | Pipeline 列表、运行详情、实时日志、触发/取消/重跑 | 5 |
| ③ | 审批工作台 | 审批列表、详情、一键审批、多级审批、移动端审批 | 5 |
| ④ | 安全审计中心 | 审计日志查询、防篡改验证、UEBA 行为分析、合规报告 | 4 |
| ⑤ | 通知中心 | 通知聚合、分类、操作、渠道集成、AI 确认入口 | 5 |
| ⑥ | Pipeline 引擎 | YAML 解析、Stage 编排、Tekton 集成、分支策略 | 4 |
| ⑦ | 多分支产品线 | ProductLine CRD、发布列车、Hotfix 通道 | 3 |
| ⑧ | 配置管理 GitOps | ArgoCD 集成、配置漂移检测、敏感信息管理 | 3 |
| ⑨ | 通知协作 | 多渠道通知、ChatOps、On-Call 调度、告警聚合、交接班 | 5 |
| ⑩ | 人工确认交互 | P0/P1/P2/P3分层确认、工作台收拢、用户偏好 | 4 |
| ⑪ | ChatOps | IM 命令集、机器人集成 | 2 |
| ⑫ | AI 算法引擎 | XGBoost/PageRank/动态基线等 12 种算法 | 12 |
| ⑬ | LLM 推理层 | 多模型接入、Prompt 管理、输出验证、Token 计费 | 4 |
| ⑭ | AI 增强层 | ai-review/test-selector/risk-assess/diagnose Agent | 4 |
| ⑮ | AI Skill 管理 | Skill 注册表、市场、效果评估 | 3 |
| ⑯ | AI 成本优化 | Token 计费、预算管理、成本优化 | 3 |
| ⑰ | AI 文档管理 | 自动文档生成、知识沉淀、RAG 检索、质量审查、主动推送 | 5 |
| ⑱ | AI 需求辅助 | 需求拆解、工作量评估、代码生成辅助、测试生成辅助 | 4 |
| ⑲ | 代码管理 | GitLab 集成、Branch Policy、代码质量门禁 | 3 |
| ⑳ | 构建环境 | Builder 镜像、构建缓存、弹性 Runner | 3 |
| ㉑ | 多工具链 | Plugin SPI、工具生命周期、监控、市场 | 4 |
| ㉒ | 智能部署 | Knative 集成、AI 灰度策略、预测性伸缩、智能回滚 | 4 |
| ㉓ | DB 变更审核 | SQL 语法检查、AI SQL 审核、EXPLAIN 分析、回滚 SQL 生成 | 5 |
| ㉔ | 安全合规 | 安全扫描、依赖漏洞、供应链安全、合规报告、权限智能管理 | 5 |
| ㉕ | 多租户管理 | 租户隔离、资源配额、AI 隔离 | 3 |
| ㉖ | IaC 管理 | Terraform 集成、AI 审查、漂移检测 | 3 |
| ㉗ | SSO/RBAC | SSO 登录、HR 自动同步、RBAC、ABAC、权限审计 | 5 |
| ㉘ | 审计中心 | 操作审计、审计查询、审计导出、防篡改验证、审计告警 | 5 |
| ㉙ | FinOps 成本 | 成本数据采集、成本分摊、成本看板、预算告警、ROI 分析 | 5 |
| ㉚ | 产物管理 | 容器镜像管理、依赖包管理、制品晋升、清理策略、依赖追踪 | 5 |
| ㉛ | 二方库管理 | 内部库创建、版本管理、自动升级 PR、废弃管理 | 4 |
| ㉜ | CMDB | 服务器/应用/终端/文件/脚本管理、关系拓扑、变更历史等 | 12 |
| ㉝ | 事件总线 NATS | NATS 部署、CloudEvents、事件溯源 | 3 |
| ㉞ | 数据存储 | PostgreSQL、Chroma、Neo4j、Harbor/Nexus | 4 |
| ㉟ | 可观测性 | Prometheus、Loki、Jaeger、Grafana | 4 |
| ㊱ | 插件扩展 | Plugin 框架、API Gateway | 2 |
| ㊲ | 知识库 (可插拔) | 文档管理、RAG 问答、知识图谱、多格式解析、多源同步、IM 机器人 | 6 |

**注**: ㉗㉘㉙㉚㉛㉜ 为本次补充模块，详见 `docs/requirements/需求功能更新汇总.md`

---

## 三、第 3 节 系统架构设计更新

### 3.1 核心域 + 支撑域架构

**更新前**:
```
支撑域包含：AI 增强域、效能洞察域、FinOps、CMDB、运维治理、工单协同
```

**更新后**:
```
支撑域包含：
• AI 增强域 (AI 算法/LLM/AI 增强/AI Skill/AI 成本/AI 文档/AI 需求)
• 效能洞察域 (效能看板/FinOps)
• 运维治理域 (智能部署/自愈引擎/可观测性)
• 工单协同域 (智能工单/自动排单/通知协作)
• 安全合规域 (安全合规/审计中心/SSO/RBAC)
• 数据域 (CMDB/数据存储/事件总线)
```

---

## 四、第 24 节 微服务与微前端架构更新

### 24.1 后端微服务拆分

**更新前**: 8 个核心服务

**更新后**: 12 个核心服务

| 服务 | 包含模块 | 技术栈 | 副本 | 端口 |
|------|---------|--------|------|------|
| orion-api-gateway | 路由/认证/限流/服务发现 | Spring Cloud | 3 | 8080 |
| orion-ai-service | AI 推理/算法/Skill/模型治理 | Python/FastAPI | 5 (GPU) | 8000 |
| orion-cmdb-service | 服务器/应用/终端/文件/脚本/拓扑 | Java/Spring Boot | 2 | 8002 |
| orion-pipeline-service | 流水线/构建/工具链/代码/配置 | Java/Spring Boot | 3 | 8003 |
| orion-workflow-service | 智能部署/自愈/事件指挥官/监控/SLO | Python/Java | 3 | 8004 |
| orion-ticket-service | 工单/自动排单/SLA/升级/诊断联动 | Java/Spring Boot | 2 | 8005 |
| orion-insight-service | 效能看板/FinOps/DORA/团队对比 | Java/Spring Boot | 2 | 8006 |
| orion-platform-service | 产物/二方库/工具/多租户/安全/审计 | Java/Spring Boot | 2 | 8007 |
| **orion-ss0-service** | **SSO 登录/RBAC/ABAC/HR 同步** | **Java/Spring Boot** | **3** | **8008** |
| **orion-artifact-service** | **产物管理/二方库/依赖追踪** | **Java/Spring Boot** | **2** | **8009** |
| **orion-governance-service** | **运维治理/智能部署/自愈** | **Python/Java** | **3** | **8010** |
| **orion-knowledge-service** | **知识库/RAG/知识图谱** | **Go + Next.js** | **2** | **8300** |

### 24.2 前端微前端架构

**更新前**: 1 基座 + 7 子应用

**更新后**: 1 基座 + 11 子应用

```
orion-base (基座应用，端口 3000)
├── pipeline-app (端口 3001) → 对应 orion-pipeline-service
├── ai-app (端口 3002)       → 对应 orion-ai-service
├── cmdb-app (端口 3003)     → 对应 orion-cmdb-service
├── workflow-app (端口 3004) → 对应 orion-workflow-service
├── ticket-app (端口 3005)   → 对应 orion-ticket-service
├── insight-app (端口 3006)  → 对应 orion-insight-service
├── platform-app (端口 3007) → 对应 orion-platform-service
├── **sso-app (端口 3008)**  → **对应 orion-sso-service**
├── **artifact-app (端口 3009)** → **对应 orion-artifact-service**
├── **governance-app (端口 3010)** → **对应 orion-governance-service**
└── **knowledge-app (端口 3011)** → **对应 orion-knowledge-service**
```

---

## 五、文档导航更新

### 更新前
```markdown
| [模块功能与交互评审报告.md](./模块功能与交互评审报告.md) | 26 个模块功能细节评审 + 11 个页面交互设计评审 |
```

### 更新后
```markdown
| [模块功能与交互评审报告.md](./模块功能与交互评审报告.md) | 37 个模块功能细节评审 + 11 个页面交互设计评审 |
| [需求功能更新汇总.md](./docs/requirements/需求功能更新汇总.md) | 53 个补充功能详情 (AI 算法/LLM/SSO/产物/二方库/知识库/CMDB) |
```

### 更新前
```markdown
_新增：模块功能与交互评审报告（26 个模块 + 11 个页面）、CI/CD 能力增强（4.3 节）、多角色综合评审报告_
```

### 更新后
```markdown
_新增：模块功能与交互评审报告（37 个模块 + 11 个页面）、CI/CD 能力增强（4.3 节）、多角色综合评审报告、需求功能更新汇总（53 个补充功能）_
```

---

## 六、统计数字更新

### 全文档替换规则

| 原内容 | 更新为 | 出现位置 |
|--------|--------|---------|
| 26 个模块 | 37 个模块 | 第 2 节、第 24 节、文档导航 |
| 26 个核心模块 | 37 个核心模块 | 第 2 节功能维度全景图 |
| 22 个功能维度 | 37 个核心模块 (251 个功能点) | 第 2 节开头 |
| 8 个微服务 | 12 个微服务 | 第 24.1 节 |
| 7 个子应用 | 11 个子应用 | 第 24.2 节 |

---

## 七、实施说明

### 直接替换命令
```bash
# 备份原文件
cp Orion-完整设计方案.md Orion-完整设计方案.md.bak

# 替换统计数字
sed -i 's/26 个模块/37 个模块/g' Orion-完整设计方案.md
sed -i 's/26 个核心模块/37 个核心模块/g' Orion-完整设计方案.md
sed -i 's/22 个功能维度/37 个核心模块 (251 个功能点)/g' Orion-完整设计方案.md
sed -i 's/8 个微服务/12 个微服务/g' Orion-完整设计方案.md
sed -i 's/7 个子应用/11 个子应用/g' Orion-完整设计方案.md
```

### 手动更新内容
- 第 2 节功能维度表需要扩展为 37 个模块
- 第 24.1 节微服务列表需要添加 4 个新服务
- 第 24.2 节微前端需要添加 4 个子应用
- 文档导航需要添加需求功能更新汇总.md 链接

---

_更新完成日期：2026-04-11 | 维护团队：Orion 产品团队_