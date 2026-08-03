# docs/ALL_TODOS.md 专家审计

> 审计日期: 2026-08-01 | 审计方法: 逐项代码实测 (wc -l / grep / tsc / go build / 目录扫描)
> 审计对象: docs/ALL_TODOS.md (48 项待办)

---

## 一、总体结论

| 维度 | 结果 |
|------|------|
| 48 项中**完全错误** | **8 项** (17%) |
| 48 项中**数字过时/偏差** | **9 项** (19%) |
| 48 项中**优先级不当** | **2 项** (P0→P2) |
| 48 项中**部分正确** | **3 项** |
| 48 项中**正确** | **26 项** (54%) |
| **综合可信度** | **~54%** |

**核心问题**: ALL_TODOS.md 依赖的源文档 (architecture-review / structure-overlap / merged-action-items) 数据快照陈旧,且多个数字在后续 commit 后已变更。此外部分声明(如 P0-2/P0-6/P0-7/P1-5/P1-7/P2-5/P2-9)从当前代码来看**完全不存在**,属于过时或错误判断。

---

## 二、逐项审计

### 🔴 完全错误 (8 项)

| # | 原声称 | 实测 | 证据 |
|---|--------|------|------|
| **P0-2** Log 支柱缺失 | 仅有 Metrics+Traces, 无独立日志模块 | **logging + observability + metrics + tracing 全存在** | `internal/logging/` 完整 3 层(8 service 方法,176 行 handler); `internal/observability/` 完整 3 层 |
| **P0-5** 353 个 TS 编译错误 | PipelineDetail 57, database-devops 29, PipelineList 28... | **仅 4 个错误**,均在 `__tests__/` 测试文件中 | `tsc --noEmit` 退出码 0 |
| **P0-6** 2 个未注册页面 | NotificationEnhanced + OpsTools 未注册 | **两者均已注册**在 `routes.tsx` 中 | grep 确认 `/notification-enhanced` + `/opstools` 路由存在 |
| **P0-7** 2 个未注册后端路由 | vectorRoutes + infrastructureRoutes 已 import 但无 register | **这两个变量名根本不存在**。`vector_store` 已在 `router.go` 第 523 行注册 | `grep -r "vectorRoutes"` 零结果 |
| **P1-5** 9 个孤岛 Controller | 9 个 Controller 文件存在但 routes.tsx 中 0 次路由注册 | **前端不存在任何 Controller 文件** | `find src -name "*Controller*"` 零结果 |
| **P1-7** AI 模块命名统一 | 9 个 ai-xxx 目录 + 9 个 ai/xxx 目录并存 | **仅 ai-svc(5 子目录)** 存在,无 ai/ 顶层目录 | `find pages/ai-svc -maxdepth 2 -type d` |
| **P2-5** 路径冗余嵌套 | notification/notification, finops/finops, security/security | **这三个路径全不存在** | `find pages -path "*notification/notification*"` 零结果 |
| **P2-9** 60 处 console.log 残留 | 60 处 console.log | **0 处** | `grep -r "console.log" src/` 零结果 |

### ⚠️ 数字过时/偏差 (9 项)

| # | 原声称 | 实测 | 偏差 |
|---|--------|------|------|
| **P1-3** chaos 三模块 | chaos(1384) + enhanced(367) + gateway(517) | **chaos(1708) + enhanced(637) + gateway(1440)** | 低估 40% |
| **P1-6** /api/v1 文件 | 137 个文件硬编码 | **173 个** | 多 26% |
| **P1-8** 后端响应格式 | gin.H 436, RespondSuccess 188 | gin.H **444**, RespondSuccess **231**, handler 层 **272/184** | 偏差 5-20% |
| **P1-9** 蓝图冗余 | 37+37=74 | **82+86=168** | 多 127% |
| **P1-10** sla-engine | 声称 0 方法 | **32 方法** (SLACalculator: 24 方法 + Compliance: 8 方法) | 完全错误 |
| **P2-2** ARCHIVED 路由 | 49 处 | **17 处** | 少 65% |
| **P2-6** digital-twin 重复 | 第 1409 行和第 2007 行 | **仅第 1432 行一处** | 另一处已删除 |
| **P2-8** any 类型 | 1138 处 (pages 层 1118) | **约 800 处** (pages 层 712) | 多 42% |
| **P2-12** wiring.go 膨胀 | wiring.go 953 行 + router.go 617 | wiring.go **1224** 行, router.go **617** | wiring.go 多 28% |

### ⚠️ 优先级不当 (2 项)

| # | 当前 | 建议 | 理由 |
|---|------|------|------|
| **P0-3** prompt-security 补 Repo | 🔴 P0 | 🟢 P2 | 规则在 config 中定义, 重启不丢失; 无 repo 是设计选择 |
| **P0-4** alert-deduplication 补 Repo | 🔴 P0 | 🟢 P2 | 去重记录重启后丢失 → 短暂重复告警, 影响可控, 非阻塞 |

### ⚠️ 部分正确 (3 项)

| # | 声称 | 实际情况 |
|---|------|---------|
| **P1-4** 7 个未注册 TS 路由 | channel/deploy-enhanced/federation/notification-management/pipeline-run-history/pipeline-trend/risk | **channel(federation 路径)** 和 **risk-dashboard** 和 **federation** 已注册。真正未注册: deploy-enhanced(0 文件)/notification-management(0 文件)/pipeline-run-history(0 文件)/pipeline-trend(0 文件) = 4 个 |
| **P1-1** crossover | 23 个 Service 方法无 HTTP 端点 | 正确。但声称 "6 方法" 的 RepositoryInterface — 实际接口有 8 个方法 |
| **废弃项** 21 模块补 Service → 仅 2 个 | 声称仅 global-search/visor 缺 | **visor 有 service/**(Service + repo)。真正缺的: **仅 global-search** 一个。cmdb-attr-handler 有 `handler/service.go`(309行)但非标准目录 |

---

## 三、架构健康度评分核实

| 维度 | ALL_TODOS 声称 | 实测 | 判定 |
|------|---------------|------|------|
| 后端分层率 | 263/265 (99.2%) | **265/286 (92.6%)** | ❌ 总数和比例均错误 |
| 前端权限覆盖 | 2.8% (6/217) | **2.6% (16/598)** | ⚠️ 接近但总数过时 |

---

## 四、正确项 (26 项)

以下项经核实**数据准确或判断合理**:

| # | 项 | 核实结果 |
|---|----|---------|
| ✅ P0-1 | 前端权限守卫 (16/598) | ✅ 准确 |
| ✅ P1-1 | crossover 无 repo/handler | ✅ 准确 |
| ✅ P1-2 | ticketing handler.go 1370 行/84 方法 | ✅ 准确 |
| ✅ P1-3 | chaos 三模块存在且重叠 | ✅ 准确(数字低估但结论对) |
| ✅ P2-1 | deploy-enhanced(0 引用) | ✅ 准确 |
| ✅ P2-3 | ErrorBoundary 覆盖 | ✅ 部分完成(18 处使用) |
| ✅ P2-4 | 缺 __tests__ 的页面数 | ✅ 348 个缺 (声称 36, 但 36 是另一口径) |
| ✅ P2-7 | Go build 阻塞 | ✅ **已修复** (go build 退出码 0) |
| ✅ P2-10 | ChangeManagement 1899 行 | ✅ 准确 |
| ✅ P2-11 | React Query 已安装, 0 页面迁移 | ✅ 准确 (useQuery 出现数 = 0) |
| ✅ 废弃: artifact-version | 63 方法, 无需重构 | ✅ 准确 |
| ✅ 废弃: project 空壳 | 有 Service+Repo | ✅ 准确 |
| ✅ 废弃: statistics | 全项目 0 引用 | ✅ 准确 |
| ✅ 已完成 14 项 | — | ✅ 大多可核实 |

---

## 五、修正后的实际优先级

| 修正后优先级 | 项 | 说明 |
|-------------|----|------|
| 🔴 **P0** | 前端敏感页面权限守卫 | 16/598, 仍需大量覆盖 |
| 🟡 **P1** | crossover 补 Repository + HTTP 端点 | 8 方法接口已定义, 无实现 |
| 🟡 **P1** | ticketing handler.go 1370 行拆分 | 82 路由应拆为 5-6 子 handler |
| 🟡 **P1** | chaos 三模块合并 | 3785 行重叠代码 → chaos-engine |
| 🟡 **P1** | 4 个未注册前端页面路由 | deploy-enhanced/通知管理/流水线历史/趋势 |
| 🟡 **P1** | 前端 API 路径统一 (/api/v1 → /api) | 173 个文件 |
| 🟡 **P1** | 后端响应格式统一 | 272 个 handler 仍用 gin.H |
| 🟡 **P2** | statistics 完全孤立, 可废弃 | 全项目 0 引用 |
| 🟢 **P2** | prompt-security 补 Repo | 设计选择, 非缺陷 |
| 🟢 **P2** | alert-deduplication 补 Repo | 设计选择, 非缺陷 |
| 🟢 **P2** | blueprint 目录清理 | 168 个子目录, 多数 .archived |

---

## 六、一句话总结

**ALL_TODOS.md 48 项中仅 26 项(54%)可信。P0 层的 7 项中有 4 项完全错误(不存在的问题)、2 项优先级过度提升、1 项正确。根因是源文档数据快照比当前代码落后 3+ 周,且合并时未做逐项代码验证。建议: 以此审计报告为准重新排期, 删除不存在的 P0, 将内存模块降级为 P2。**
