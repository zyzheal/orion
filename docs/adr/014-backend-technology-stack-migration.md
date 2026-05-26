# ADR-014: Backend Technology Stack Migration — Node.js → Go/Rust/Python

## Status

**Accepted** — 2026-05-25

## Context

Orion 平台当前后端全部基于 Node.js + TypeScript + Fastify，包括：

| 组件 | 文件数 | 模块数 |
|------|--------|--------|
| `orion-platform-service/` | 1070 .ts | 131 services + 100 routes |
| `orion-api-gateway/` | 53 .ts | 网关路由 + 代理 |
| 34 个 `orion-*-svc/` | ~900 .ts | 34 个独立微服务 |
| **合计** | **~2023 .ts** | **~265 功能模块** |

### Node.js 在当前架构中的根本性限制

1. **单线程事件循环限制高并发场景**：APM 性能监控需要处理 >5000 QPS 的指标采集和分布式追踪，Node.js 事件循环在 CPU 密集型任务（如 JSON 序列化、加密、正则匹配）下会阻塞，导致 P99 延迟飙升
2. **类型安全不足以覆盖安全关键路径**：TypeScript 的类型在运行时不强制执行，`as any` 绕过类型检查，加密/签名/密钥管理等安全路径需要编译时 + 运行时双重保证
3. **K8s 集成需要 client-go**：构建、部署、环境管理等模块需要深度集成 Kubernetes，官方 `client-go` 是 Go 原生 SDK，Node.js 的 `@kubernetes/client-node` 功能滞后且社区活跃度低
4. **AI/ML 能力依赖 Python 生态**：LLM Trace、RAG 向量检索、Agent 框架需要 LangChain、LlamaIndex、Faiss 等 Python 库，Node.js 生态不成熟
5. **内存限制计算密集型工作负载**：V8 堆内存默认 4GB 上限，大规模数据分析、策略引擎计算、风险评分等场景容易触发 OOM

### 驱动因素

- 平台需要从 L2（被动响应）升级到 L4（主动预防 + 自治），需要更高的性能和更低的延迟
- 现有 34 个微服务蓝图全部是 Node.js 实现，生产部署以单体 `orion-platform-service` 为主，微服务拆分需要独立进程
- 云原生生态标准语言是 Go，K8s/Prometheus/Istio/Tekton 等全部用 Go 编写

## Decision

将所有 Node.js 后端实现替换为 **Go / Rust / Python**，具体分配如下：

### Go（~55 模块，65%，~18 人月）

**选型理由**：高并发 goroutine 模型、K8s client-go 原生支持、云原生生态标准语言、开发效率高于 Rust、二进制体积小、部署简单

**适用模块**：

| 功能域 | 模块 | 理由 |
|--------|------|------|
| **基础设施** | Tenant、Auth、User/Role/Permission、Session、API Key | 全局基础设施，需要高可用 + 低延迟 |
| **CI/CD** | Pipeline、Deploy、Build、Artifact、Approval、Canary、Queue、Scheduler | 高并发执行 + Tekton/K8s 集成 |
| **可观测性** | APM、Alert、Self-Healing、Diagnostic、FinOps、Efficiency | OTel SDK + Prometheus 集成 + 5000+ QPS |
| **业务应用** | Ticketing、CMDB、Incident、Environment、Database、Cache | 标准 CRUD + 高并发查询 |
| **治理** | SBOM、Guardian、Degradation、API Governance、SubApp | 策略执行 + 流量控制 |
| **高级能力** | Chaos Engineering、Cross-Domain Orchestrator、Data Pipeline、Smart Deploy、Release Train、Quality Gate | 复杂编排 + K8s 集成 |
| **API 网关** | API Gateway（替换 Node.js Fastify 网关） | 高性能路由 + 限流 + 认证 + 代理 |
| **其余模块** | Webhook、Notification、Plugin、Config、Audit、Event Bus、Developer Portal、Product Line、Project、Team、Issue、Lowcode、Workbench、Module Lifecycle、Community、API Market、Backup、Disaster Recovery、Digital Twin、Change Intelligence、Multi-Cloud、K8s Provisioner、Ephemeral Env | — |

**技术栈**：Gin（HTTP 框架）+ sqlx/GORM（数据库）+ zap（日志）+ OTel Go SDK（可观测性）+ client-go（K8s 集成）

### Python（~15 模块，18%，~8 人月）

**选型理由**：LangChain/LlamaIndex 原生支持、向量数据库生态（Faiss/Milvus/Pinecone）、ML 推理（scikit-learn/PyTorch）、Agent 框架成熟

**适用模块**：

| 功能域 | 模块 | 理由 |
|--------|------|------|
| **AI 平台** | LLM Trace、AI Agents、Knowledge Base、Model Version、Vector Store、Skill、MCP | LangChain + RAG + 向量检索 |
| **AI 分析** | AI Review、AI Security、UEBA、Decision Explanation | LLM 代码分析 + Prompt 注入检测 + 用户行为异常检测 |
| **Agent 执行** | Agent（沙箱执行环境）、AI Cost（Token 计费 + 用量分析） | Agent 框架 + 资源计量 |

**技术栈**：FastAPI（HTTP 框架）+ LangChain（Agent 框架）+ SQLAlchemy（数据库）+ Milvus/Faiss（向量检索）+ OTel Python SDK

### Rust（~5 模块，6%，~3.5 人月）

**选型理由**：零成本抽象、内存安全无 GC、SIMD 优化、编译时类型安全、加密/签名场景最佳选择

**适用模块**：

| 功能域 | 模块 | 理由 |
|--------|------|------|
| **安全** | Security（加密/签名/密钥管理） | 内存安全要求，不能有任何泄漏风险 |
| **风险** | Risk Engine（风险计算 + 策略引擎） | 计算密集型，需要 SIMD 加速 |
| **策略** | Policy/ABAC（策略评估引擎） | 高性能 + 零信任，每次请求都需要评估 |
| **隐私** | Privacy（数据脱敏 + 合规检查） | 敏感数据处理，编译时保证 |

**技术栈**：Axum（HTTP 框架）+ sqlx（数据库）+ ring/aes-gcm（加密）+ OTel Rust SDK

### 不替换的服务（已存在非 Node.js 实现）

| 服务 | 技术栈 | 说明 |
|------|--------|------|
| `orion-ai-service/` | Python | AI 微服务，已存在 |
| `orion-visor/` | Java/Spring | 运维可视化，已存在 |
| `orion-knowledge/` | PandaWiki fork | 知识库，独立项目 |
| `orion-dba/` | 独立平台 | DB 管理，独立项目 |

## Alternatives Considered

### 方案 A：保持 Node.js + 优化（已拒绝）

- **理由**：V8 事件循环的根本限制无法通过优化解决；`@kubernetes/client-node` 功能滞后；AI 生态不成熟
- **适用场景**：仅适合轻量级 CRUD 服务，但 Orion 有高并发 + K8s + AI 需求

### 方案 B：全部使用 Java/Spring Boot（已拒绝）

- **理由**：JVM 内存占用大（每个服务 256MB+），启动慢（10-30 秒），开发迭代周期长；与现有 K8s 生态（Go 语言）集成需要额外 SDK
- **适用场景**：适合传统企业级应用，但不适合云原生平台

### 方案 C：全部使用 Go（已拒绝）

- **理由**：AI/ML 生态（LangChain、向量检索、LLM SDK）Python 占绝对主导，Go 的 AI 库成熟度低
- **适用场景**：如果不做 AI 能力，Go 可以覆盖 100%

### 方案 D：全部使用 Rust（已拒绝）

- **理由**：开发复杂度高（借用检查器、生命周期），CRUD 服务开发效率低；团队学习曲线陡峭
- **适用场景**：适合安全关键 + 计算密集场景，不适合大量 CRUD

### 方案 E：Go + Python + Rust 混合（✅ 采纳）

- **理由**：各取所长，Go 覆盖 65% 的标准服务，Python 覆盖 18% 的 AI 能力，Rust 覆盖 6% 的安全关键路径
- **代价**：需要维护三种技术栈，迁移工作量 ~35 人月

## Consequences

### 正面影响

| 维度 | Node.js | Go | Rust | Python |
|------|---------|----|------|--------|
| **QPS（单实例）** | ~5000（事件循环瓶颈） | ~50000+（goroutine） | ~100000+（零拷贝） | ~3000（GIL） |
| **P99 延迟** | 50-200ms（GC 停顿） | 5-20ms | 1-10ms | 30-100ms |
| **内存占用** | 128-512MB（V8 堆） | 20-50MB | 5-20MB | 100-300MB |
| **二进制体积** | 需要 Node.js 运行时 | 5-15MB 静态二进制 | 3-10MB 静态二进制 | 需要 Python 运行时 |
| **K8s 集成** | `@kubernetes/client-node`（功能滞后） | `client-go`（官方原生） | 社区 SDK | 社区 SDK |
| **类型安全** | TypeScript（运行时不保证） | 编译时 + 运行时 | 编译时严格保证 | 运行时（Pydantic 可选） |
| **AI 生态** | 不成熟 | 一般 | 不成熟 | 成熟（LangChain/LlamaIndex） |

### 负面影响

1. **迁移工作量**：~35 人月，~20 个月（6 个 Phase）
2. **团队技能缺口**：需要学习 Go/Rust，Python 团队可能已有
3. **双份维护成本**：迁移期间同时运行 Node.js 和新服务，人力翻倍
4. **API 兼容性风险**：迁移过程中可能引入不兼容变更
5. **数据迁移风险**：数据库迁移脚本需要严格审计

### 实施时间线

| Phase | 时间 | 模块 | 技术栈 |
|-------|------|------|--------|
| A: 基础设施 | 3 个月 | API Gateway + Auth + Tenant + User + Session + API Key + Audit | Go |
| B: CI/CD 核心 | 4 个月 | Pipeline + Deploy + Build + Artifact + Approval + Canary + Queue + Scheduler + Config | Go |
| C: 可观测性 + 治理 | 3 个月 | APM + Alert + Self-Healing + Diagnostic + Security(Rust) + Risk(Rust) + Policy(Rust) + Privacy(Rust) + FinOps + Efficiency | Go + Rust |
| D: AI 平台 | 3 个月 | LLM Trace + AI Agents + Knowledge + AI Review + AI Security + Model Version + Vector + Skill + AI Cost + Decision Explanation | Python |
| E: 业务应用 | 4 个月 | Ticketing + Incident + CMDB + Environment + Database + Cache + Digital Twin + Disaster Recovery + Backup + Community + API Market + API Governance + Product Line + Project + Team + Issue + Lowcode + SubApp + Workbench + Change Intelligence | Go |
| F: 高级能力 + 收尾 | 3 个月 | Chaos + CrossDomain + DataPipeline + Agent + Smart Deploy + Release Train + Quality Gate + UEBA + MCP + Node.js 清理 | Go + Python |

### 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| API 不兼容 | 保持路径/方法/参数完全一致；契约测试保障 |
| 数据迁移丢失 | 双写验证 + 迁移脚本审计 + 回滚预案 |
| 性能回退 | 压测对比，Go 应该优于 Node.js |
| 团队技能缺口 | 提供 Go/Python/Rust 模板 + 代码生成工具 |
| 迁移周期过长 | 绞杀者模式，每次只替换一个模块 |

## References

- 升级计划文档：`docs/plans/orion-upgrade-executable-plan-2026-05-22.md` 第十六节
- Orion 架构文档：`CLAUDE.md`
- Node.js 后端规模分析：orion-platform-service (1070 .ts) + orion-api-gateway (53 .ts) + 34 orion-*-svc (~900 .ts) = ~2023 .ts
