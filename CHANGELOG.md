# 文档变更日志

> 记录所有文档的新增、修改、废弃操作。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/) 规范。

---

## [2026-04-11] — 自动完成度检查

### Updated
- 执行文档实现细节检查
- 生成综合完成度仪表盘
- 更新模块索引卡

### Metrics
- 总体完成度：5.7%
- 文档总数：103
- 代码文件：2502
- 测试文件：5

### Reports
- 综合完成度仪表盘 (已删除)
- 文档实现细节分析报告 (已删除)
- 模块索引卡汇总 (已删除)

---

## [2026-04-11] — P2 优先级文档完成

### Added
- **`docs/services/plugin/plugin-framework-design.md`** — 插件框架设计 (微内核/生命周期/安全沙箱)
- **`docs/services/iac/iac-management-design.md`** — IaC 管理设计 (Terraform 集成/State 管理/AI 审查)
- **`docs/services/oncall-scheduling-design.md`** — OnCall 排班系统设计 (排班规则/告警路由/升级策略)
- **`docs/services/plugin/tool-marketplace-design.md`** — 工具市场设计 (工具发现/安装/升级/依赖解析)
- **`docs/services/deploy/hotfix-channel-design.md`** — Hotfix 通道设计 (紧急发布/分支策略/快速验证)
- **`docs/services/ai/skill-marketplace-design.md`** — Skill 市场设计 (Skill 发现/安装/评分/审核)
- `docs/services/ai/测试推荐效果评估设计.md` — 测试推荐效果评估 (准确率/采纳率/A-B 测试/反馈收集)
- `docs/efficiency/周报导出与分享设计.md` — 周报导出与分享 (PDF/Excel/邮件/链接分享)

### Fixed
- **Yearning → orion-dba** — SQL 审计平台更名为 orion-dba (整合 Yearning + gemini-next)

### Changed
- `INDEX.md` — 总文档数 150→157 份，新增 7 份 P2 设计文档
- `README.md` — 子项目列表更新 (Yearning 移除，orion-dba 为正式名称)
- `00-文档索引与任务分发.md` — 更新版本至 v4.5

### Summary
- P0 需求覆盖率：100%
- P1 需求覆盖率：96%
- P2 需求覆盖率：95% → 98% (+3%)
- 总体覆盖率：98% → 99% (+1%)

---

## [2026-04-11] — P1 优先级文档补充

### Added
- `docs/services/ai/代码规范规则引擎设计.md` — 代码规范规则引擎设计 (DSL/热更新/优先级/AI 集成)
- `docs/services/ai/测试用例生成设计.md` — 测试用例生成设计 (变更分析/覆盖率缺口/推荐算法)
- `docs/services/knowledge/Orion-Knowledge 集成方案.md` — Orion-Knowledge 集成方案 (RAG 对接/自动积累/SSO)
- `docs/efficiency/自动周报设计.md` — 自动周报设计 (数据采集/模板引擎/定时调度)
- `docs/services/monitor/OnCall 排班系统设计.md` — OnCall 排班系统 (排班规则/告警升级/通知渠道)
- `docs/services/ticket/新人 Onboarding 设计.md` — 新人 Onboarding 设计 (任务清单/导师配对/进度追踪)

### Changed
- `INDEX.md` — 更新文档统计 (122→128 份)，新增 6 份 P1 设计文档
- `00-文档索引与任务分发.md` — 更新版 v4.2→v4.3，标记新增文档状态
## [2026-04-11] — 文档位置优化

### Fixed
- 移动 `docs/工具管理中心设计.md` → `docs/architecture/工具管理中心设计.md` (符合架构设计文档分类)
- 移动 `docs/文档完成度分析报告.md` → `docs/collaboration/文档完成度分析报告.md` (符合协作报告分类)

### Changed
- `INDEX.md` — 更新架构设计文档统计 (17→18 份)，新增协作报告分类
- `00-文档索引与任务分发.md` — 更新文档位置引用

---

## [2026-04-10] — 文档管理体系建立

### Fixed
- ADR-007 → ADR-008 (ProductLine-CRD 多分支产品线)，修复编号空缺
- security/ADR-009 → ADR-010 (Prompt 注入防护)，修复与 adr/ADR-009 编号冲突
- 移出 `docs/adr/工具管理中心设计.md` → `docs/工具管理中心设计.md` (非 ADR)
- 移出 `docs/adr/plugin-spi-examples.md` → `docs/architecture/` (非 ADR)
- 删除空目录 `docs/cicd/`
- 全项目 Wiki.js → Orion-Knowledge 替换 (6 个文档)

### Added
- `INDEX.md` — 结构化文档索引 (101 份文档，按领域+模块双维度)
- `CHANGELOG.md` — 本文档
- `docs/文档管理规范.md` — 文档管理完整规范 (命名/分类/frontmatter/生命周期)
- `docs/knowledge/Orion-Knowledge 微服务改造方案.md` — 知识库改造方案

### Changed
- `Orion-完整设计方案.md` — 新增 5.5 知识库模块、导航入口、知识永动机引擎说明
- `docs/architecture/架构重构设计.md` — 新增知识管理域 SD7
- `服务拆分与数据库划分详解.md` — 新增知识库服务 + Redis 隔离
- `跨时代颠覆性亮点设计.md` — 新增 Orion-Knowledge 底层引擎
- `00-文档索引与任务分发.md` — 新增 M28 模块 + Layer 6

---

## [2026-04-10] — AI 技术栈增强

### Added
- **`docs/services/ai/mlops-and-ml-frameworks-design.md`** — MLOps 与 ML 框架设计 (PyTorch/TensorFlow/MLflow/Kubeflow)
- **`docs/services/ai/gnn-and-rl-design.md`** — GNN 与强化学习设计 (根因分析/自愈决策/部署优化)
- **`docs/services/ai/code-representation-learning-design.md`** — 代码表示学习设计 (AST/Code2Vec/CodeBERT/LangChain)
- `docs/services/dba/sql-audit-design.md` — SQL 审计详细设计 (Yearning + gemini-next 集成)
- `docs/services/knowledge/knowledge-base-design.md` — 知识库详细设计 (RAG/向量数据库/知识图谱)
- `docs/architecture/外部服务集成清单.md` — 外部服务集成总览 (28 个服务)

### Changed
- `Orion-完整设计方案.md` — 新增 29-31 功能维度 (MLOps/GNN+RL/代码表示学习)，更新技术选型
- `00-文档索引与任务分发.md` — AI 设计文档从 5 份扩展到 8 份
- `INDEX.md` — 更新 AI/算法文档统计 (9 份→12 份)

---

## [2026-04-10] — 架构改进专项

### Added
- **`docs/architecture/platform-service-split-design.md`** — 平台服务拆分设计 (orion-platform-service → 3 个服务)
- **`docs/architecture/grpc-integration-design.md`** — gRPC 集成设计 (6 个 gRPC 服务定义，Istio 集成)
- **`docs/architecture/circuit-breaker-degradation-design.md`** — 熔断降级设计 (L0-L3 级别，11 服务配置矩阵)
- **`docs/services/dba/database-migration-and-query-design.md`** — 数据库迁移与查询设计 (Flyway+CQRS 模式)
- **`docs/architecture/ Orion-架构流程图.md`** — 完整架构图 (10 个：核心域 + 支撑域/服务拆分/数据流/自愈引擎等)

### Changed
- `docs/architecture/外部组件集成架构设计.md` — Yearning/gemini-next 统一命名为 orion-dba
- `docs/services/dba/sql-audit-design.md` — 更新服务名称为 orion-dba
- `00-文档索引与任务分发.md` — 新增架构改进文档 4 份
- `INDEX.md` — 架构设计从 13 份扩展到 18 份，总文档数 107→112 份

---

## [2026-04-10] — P1 优先级文档完善

### Added
- **`docs/event-bus/event-schema-registry-design.md`** — 事件 Schema 注册表设计 (CloudEvents 规范/版本管理/兼容性保障)
- **`docs/architecture/api-gateway-enhancement-design.md`** — API 网关增强设计 (限流/熔断/版本化/路由)
- **`docs/services/ai/ai-cost-control-design.md`** — AI 成本控制设计 (Token 计费/预算管理/成本优化)
- **`docs/services/config-mgmt/configuration-drift-detection-design.md`** — 配置漂移检测与回滚设计 (GitOps 漂移检测/自动回滚)

### Changed
- `INDEX.md` — 总文档数 118→122 份，新增 P1 设计文档 4 份
- `00-文档索引与任务分发.md` — 更新版本至 v4.1，标记 P1 文档状态

### Added
- **`docs/architecture/api-version-management-design.md`** — API 版本管理设计 (版本化策略/生命周期/迁移指南)
- **`docs/services/dba/database-migration-strategy-design.md`** — 数据库迁移策略设计 (Flyway/零停机/一致性保障)
- **`docs/architecture/cache-layer-design.md`** — 缓存层设计 (Redis/失效策略/一致性/热点 Key)
- **`docs/services/knowledge/orion-knowledge-integration-design.md`** — Orion-Knowledge 集成设计 (Nginx/SSO/RAG API)

### Changed
- `INDEX.md` — 总文档数 122→126 份，新增 P1 设计文档 4 份
- `00-文档索引与任务分发.md` — 更新版本至 v4.2，标记 P1 文档完成

---
