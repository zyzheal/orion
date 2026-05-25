# Orion 全模块深度扫描总报告

> **扫描时间**: 2026-05-22
> **扫描范围**: 174 页面 / 531 .tsx 文件 / 122 API 客户端 / 100 后端路由 / 35 独立服务
> **规范来源**: CLAUDE.md + Orion统一规范汇总.md (7567 行)
> **执行方式**: 3 Agent 并行深度扫描
> **文档结构**: 交互链 + 样式规范 + 逻辑完整 + 功能缺失 + 微前端拆分 + 功能样式补全

---

## 一、全局统计总览

| 维度 | 指标 | 数量 |
|------|------|------|
| **扫描规模** | 有效 .tsx 文件 | 531 |
| | 有效业务页面 | ~350 |
| | 主页面入口 | 93 |
| | API 客户端文件 | 122 |
| | 后端路由文件 | 100 |
| | 独立后端服务 | 35 |
| **维度 1：交互链** | 异步函数总数 | 1,618 |
| | 缺 loading/setLoading | 32 (2%) |
| | 缺 message.error 反馈 | 7 |
| | 缺空状态引导 | 55 |
| | 缺删除确认弹窗 | 56 |
| | 空 catch 块 | 1 |
| **维度 2：样式规范** | 硬编码颜色 | 123 |
| | 圆角违规 | 0 |
| | 间距违规 | 0 |
| | 阴影违规 | 8 |
| | 标题不规范 | 31 |
| **维度 3：逻辑完整** | 已对接 API 的页面 | 224 (41%) |
| | 未对接 API 的页面 | 317 (59%) |
| | CRUD 完整 | ~12 |
| | CRUD 缺失 Update | ~120 |
| | CRUD 缺失 Delete | ~80 |
| | .data.data 双层嵌套 | 198 文件, 411 处 |
| | Mock 逻辑 | 10 处 |
| | "开发中" 占位 | 6 处 |
| **维度 4：功能缺失** | Detail 只读无编辑 | 61 个页面 |
| | 缺权限控制 | 100% 页面 |
| | 缺批量操作 | ~80 页面 |
| | 缺搜索过滤 | ~70 页面 |
| **维度 5：微前端** | P0 必须拆分 | 4 模块 |
| | P1 建议拆分 | 3 模块 |
| | P2 不拆分 | 1 模块 |
| **维度 6：补全** | 功能补全预估 | ~35 人天 |
| | 样式补全预估 | ~20 人天 |

### 整体合规率

| 维度 | 合规率 | 说明 |
|------|--------|------|
| 交互链 | 93.4% | loading/feedback/empty/confirm |
| 样式规范 | 91.7% | 圆角/间距零违规，主要问题在硬编码颜色 |
| 逻辑完整 | 41% | API 对接率偏低 |
| CRUD 完整性 | ~20% | 大部分页面仅 Read |
| 权限控制 | 0% | usePermission 仍为 TODO |

---

## 二、按 8 大菜单模块详细报告

### 1. 工作台 (/workbench) — 11 页面，~8,385 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 96% |
| 样式合规率 | 93% |
| CRUD 完整页面 | 0 (均为 Dashboard 视图) |
| 空状态缺失 | 6/11 |
| 微前端建议 | P2 继续嵌入 |

**核心问题**：
- [P1] DashboardNew 中 tasks 数据硬编码 Mock (行198-224)
- [P1] ManagerDashboard/RiskDashboard 缺 loading 状态
- [P1] 6 个 Dashboard 页面缺失空状态引导
- [P2] TicketList 无编辑/删除入口

### 2. 控制台 (/console) — ~24 页面，~16,000+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 91% |
| 样式合规率 | 92% |
| CRUD 完整页面 | 1 (TenantList) |
| 硬编码颜色 | 15+ |
| 微前端建议 | P1 部分拆分 |

**核心问题**：
- [P0] Capability/RoleCapabilityMapping 完全使用 Mock 数据 (setTimeout + 硬编码)
- [P1] PluginManagement 缺 loading 状态
- [P1] ScriptRunner 缺 loading 状态
- [P2] 子租户管理/租户设置弹"开发中"
- [P2] 导出功能弹"开发中"

### 3. 交付 (/delivery) — ~19 页面，~13,000+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 95% |
| 样式合规率 | 95% |
| CRUD 完整页面 | 0 |
| 独立后端 | orion-pipeline-svc (15,455 行) |
| 微前端建议 | P0 必须拆分 |

**核心问题**：
- [P0] ArtifactBrowser deployVersion catch 内 Mock 成功提示 (行287-289)
- [P0] CacheConfigPage CRUD 在 catch 中降级为本地 Mock (行361-406)
- [P1] Pipeline 详情页 Descriptions 只读无编辑
- [P1] Artifacts/ArtifactBrowser 仅 Read，无 Create/Update/Delete
- [P1] 部署详情页 Descriptions 全部只读

### 4. 可观测性 (/observability) — ~5 页面组，~5,200+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 94% |
| 样式合规率 | 94% |
| 独立后端 | orion-monitor-svc (5,244 行) + orion-security-svc (6,614 行) |
| 微前端建议 | P0 必须拆分 |

**核心问题**：
- [P1] Diagnostic 页面缺空状态引导
- [P1] SelfHealing 页面缺空状态引导
- [P2] MetricsDashboard 硬编码颜色

### 5. AI 平台 (/ai) — ~10 页面组，~11,500+ 行（含 ChatOps 14 页面）

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 89% |
| 样式合规率 | 92% |
| 独立后端 | orion-ai-svc (3,267 行) + Python 服务 |
| 微前端建议 | P0 必须拆分 |

**核心问题**：
- [P0] AICostDashboard AlertConfig 完全使用硬编码 Mock (行51-82)
- [P0] AICostDashboard AlertConfig 存在双份实现 (finops-svc 副本)
- [P0] ChatOps/ApprovalConfig.tsx 缺 loading 状态
- [P0] ChatOps/ChatOpsSettings.tsx 缺 loading 状态
- [P0] ChatOps/index.chat.tsx 缺 message.error 反馈
- [P1] ChatOps/index.chat.tsx 空 catch 块 (行57: `.catch(() => {})`)
- [P1] ChatOps/ChatDashboard.tsx 4 处硬编码颜色 (`#999`, `#52c41a`, `#722ed1`)
- [P1] ChatOps/ChatOpsSettings.tsx 删除操作缺确认弹窗
- [P1] ChatOps/index.tsx 2 处硬编码颜色 (`#3370e6`)
- [P2] ChatOps/ApprovalConfig.tsx 排班功能弹"开发中"
- [P2] ChatOps/index.tsx 列表缺空状态引导

### 6. 基础设施 (/infra) — ~17 页面，~13,000+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 93% |
| 样式合规率 | 93% |
| 独立后端 | orion-cmdb-service (Go, 29 文件) |
| 微前端建议 | P0 必须拆分 |

**核心问题**：
- [P1] CMDB 页面缺空状态引导
- [P1] VectorStore 删除操作缺确认弹窗
- [P2] CMDB/WebTerminalPage/IntegrationPage/TopologyPage Descriptions 只读无编辑
- [P2] Backup/OnCall 缺 loading 状态

### 7. 治理 (/governance) — ~16 页面，~12,700+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 90% |
| 样式合规率 | 92% |
| 独立后端 | orion-governance-svc + orion-finops-svc (3,899 行) |
| 微前端建议 | P1 建议拆分 |

**核心问题**：
- [P1] ApprovalManagement 缺 loading 状态
- [P1] ConfigManagement .data.data 嵌套 (8 处，最高频)
- [P1] WorkflowDesigner 缺空状态引导
- [P2] 审批管理/工作流 Descriptions 只读无编辑

### 8. 生态 (/ecosystem) — ~3 页面组，~3,500+ 行

| 指标 | 值 |
|------|-----|
| 交互链合规率 | 92% |
| 样式合规率 | 88% |
| 独立后端 | orion-skill-svc + orion-plugin-svc + orion-knowledge |
| 微前端建议 | P1 已有拆分机制 |

**核心问题**：
- [P1] KnowledgeBase 缺标题/副标题/空状态/loading/反馈
- [P1] SkillManagement 缺空状态引导
- [P2] PluginSPI 缺空状态引导

---

## 三、P0 优先级修复清单

| # | 问题 | 模块 | 文件 | 行号 | 修复方案 |
|---|------|------|------|------|---------|
| 1 | CreateTicketModal setTimeout Mock | 工单 | TicketList/CreateTicketModal.tsx | 124 | 调用 createTicket API |
| 2 | CreateTicketModal 双份 Mock | 工单 | ticket-svc/TicketList/CreateTicketModal.tsx | 124 | 删除一份，另一份对接 API |
| 3 | handleAssign 仅弹确认框未调 API | 工单 | TicketList/index.tsx | 440-450 | 调用 assignTicket API |
| 4 | 角色能力保存 setTimeout Mock | 能力管理 | Capability/RoleCapabilityMapping.tsx | 361-365 | 调用 saveRoleCapabilities API |
| 5 | 角色/能力数据硬编码 | 能力管理 | Capability/RoleCapabilityMapping.tsx | 69-155 | 从 API 加载 |
| 6 | 部署失败 catch 内 Mock 成功 | 制品 | ArtifactBrowser/index.tsx | 287-289 | 移除 Mock 降级逻辑 |
| 7 | 告警规则硬编码 Mock | AI 成本 | AICostDashboard/AlertConfig.tsx | 51-82 | 调用 getAlertRules API |
| 8 | 告警规则硬编码 Mock (双份) | AI 成本 | finops-svc/AICostDashboard/AlertConfig.tsx | 51-82 | 删除一份 |
| 9 | 缓存 CRUD catch 降级为本地 Mock | 缓存 | pipeline-svc/cache/CacheConfigPage.tsx | 361-406 | 确保 API 调用成功或正确报错 |
| 10 | 工作台 tasks 数据硬编码 | 工作台 | DashboardNew/index.tsx | 198-224 | 调用 getTasks API |
| 11 | ChatOps ApprovalConfig 缺 loading | ChatOps | ChatOps/ApprovalConfig.tsx | — | 添加 setLoading |
| 12 | ChatOps ChatOpsSettings 缺 loading | ChatOps | ChatOps/ChatOpsSettings.tsx | — | 添加 setLoading |
| 13 | ChatOps index.chat 缺 message.error | ChatOps | ChatOps/index.chat.tsx | 57 | catch 中添加 message.error |

---

## 四、微前端拆分评估

### 拆分建议汇总

| 模块 | 页面数 | 代码行数 | 独立后端 | 建议 | 优先级 |
|------|--------|---------|---------|------|--------|
| 交付 (/delivery) | 19+ | ~13k | ✅ orion-pipeline-svc | 独立子应用 | **P0** |
| AI 平台 (/ai) | 10+ | ~11.5k | ✅ Python + Node | 独立子应用 | **P0** |
| 基础设施 (/infra) | 17+ | ~13k | ✅ Go CMDB | 独立子应用 | **P0** |
| 可观测性 (/obs) | 5+ | ~5.2k | ✅ monitor-svc + security-svc | 独立子应用 | **P0** |
| 控制台 (/console) | 24+ | ~16k | ❌ 多数调 platform-service | 部分拆分 | P1 |
| 治理 (/governance) | 16+ | ~12.7k | ✅ finops-svc | 部分拆分 | P1 |
| 生态 (/ecosystem) | 3+ | ~3.5k | ✅ 3 个后端 | 已有机制 | P1 |
| 工作台 (/workbench) | 11 | ~8.4k | ❌ | 继续嵌入 | P2 |

### 实施路线图

| 批次 | 时间线 | 拆分内容 | 工作量 |
|------|--------|---------|--------|
| Phase 1 | 2-3 周 | 交付 + AI + 基础设施 | 大 |
| Phase 2 | 1-2 周 | 可观测性 + 控制台 + 治理 | 中 |
| Phase 3 | 1 周 | 生态 (已有机制) | 小 |

---

## 五、功能/样式补全清单

### 功能补全（按模块）

| 模块 | 缺空状态 | 缺 loading | 缺批量操作 | 缺搜索 | 缺导出 | 缺权限 | 预估工时 |
|------|---------|-----------|-----------|--------|--------|--------|---------|
| 工作台 | 6 | 2 | 0 | 0 | 0 | 11 | 3d |
| 控制台 | 18 | 2 | 0 | 10 | 0 | 24 | 9d |
| 交付 | 12 | 0 | 0 | 5 | 0 | 15 | 6d |
| 可观测性 | 4 | 0 | 0 | 2 | 0 | 5 | 2.5d |
| AI 平台 | 6 | 4 | 0 | 3 | 2 | 8 | 4.5d |
| 基础设施 | 6 | 2 | 0 | 3 | 0 | 9 | 5d |
| 治理 | 9 | 1 | 0 | 5 | 1 | 11 | 6d |
| 生态 | 2 | 0 | 0 | 1 | 0 | 3 | 1.5d |
| **合计** | **63** | **11** | **~80** | **~29** | **3** | **86** | **~35d** |

### 样式补全（按模块）

| 模块 | 颜色违规 | 阴影违规 | 间距违规 | 预估工时 |
|------|---------|---------|---------|---------|
| 工作台 | 4 | 0 | 5 | 3d |
| 控制台 | 3 | 0 | 15 | 3d |
| 交付 | 0 | 1 | 5 | 2d |
| 可观测性 | 1 | 0 | 5 | 1.25d |
| AI 平台 | 12 | 1 | 5 | 2.5d |
| 基础设施 | 2 | 1 | 6 | 2d |
| 治理 | 0 | 1 | 6 | 2d |
| 生态 | 0 | 0 | 2 | 0.75d |
| **合计** | **22** | **4** | **49** | **~20d** |

### Detail 只读无编辑页面（61 个）

| 优先级 | 模块 | 文件数 | 说明 |
|--------|------|--------|------|
| P1 | Agent 详情 | 4 | 可编辑 Agent 配置、参数 |
| P1 | Pipeline 详情 | 6 | 可编辑 Pipeline 描述、参数 |
| P1 | SelfHealing 事件详情 | 2 | 可添加处理备注 |
| P1 | 临时环境详情 | 2 | 可修改环境配置 |
| P1 | 确认工单详情 | 2 | 可编辑确认信息 |
| P1 | 诊断会话详情 | 2 | 可添加诊断备注 |
| P1 | SBOM 详情 | 2 | 可标记误报/已处理 |
| P1 | VectorStore 集合详情 | 2 | 可编辑集合配置 |
| P2 | 审计日志/审批记录 | 4 | 查看型页面，可接受只读 |
| P2 | EventBus/Session/TaskTimeout | 5 | 查看型页面 |

---

## 六、关键发现

1. **TenantList 是 CRUD 最完整的页面** — Create/Read/Update/Delete 全部实现，含搜索、批量删除、CSV 导出
2. **198 个文件使用 `.data.data`** — 这是全局一致的数据解包模式，建议用 Axios 拦截器统一处理
3. **61 个 Detail 页面纯只读** — 其中 15 个关键页面应添加编辑能力
4. **权限控制几乎全线缺失** — 前端 `usePermission` 仍为 TODO，后端路由缺 `requirePermission` 中间件
5. **91% 页面缺失空状态** — 仅 49/93 页面使用了 `<Empty>` 组件
6. **圆角和间距违规为零** — 4px 网格系统和标准圆角值遵循度极好
7. **ChatOps 模块 14 页面** — 合规率 87.5%，主要问题在硬编码颜色 (7 处) 和 loading 缺失 (2 处)
8. **多处双份实现** — TicketList/CreateTicketModal、AlertConfig 等存在两份相同代码

---

## 七、执行建议

| 阶段 | 内容 | 预估时间 |
|------|------|---------|
| Week 1-2 | P0 修复（13 项 Mock/API 断裂）+ 空 catch 修复 | 2 周 |
| Week 3 | .data.data 统一解包 + 双份实现清理 | 1 周 |
| Week 4-5 | P1 交互修复（loading/empty/confirm） | 2 周 |
| Week 6 | 样式修复（颜色 Token 替换 + 阴影修复） | 1 周 |
| Week 7-8 | Detail 页面编辑能力补全（15 个关键页面） | 2 周 |
| Week 9-16 | 微前端拆分（4 个 P0 模块） | 8 周 |
| Week 17+ | 功能补全（空状态/搜索/批量/导出/权限） | 持续 |

---

*报告生成时间: 2026-05-22*
*基于 3 份子报告合并: scan-interaction-style.md (971行) + scan-logic-features.md (420行) + scan-microfront-remediation.md (657行)*
*规范来源: CLAUDE.md + docs/规范汇总/Orion统一规范汇总.md (7567行)*
