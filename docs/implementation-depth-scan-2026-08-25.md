# Orion 系统实现深度全景扫描报告（Anti-Demo Guard）

> 报告日期：2026-08-25
> 扫描依据：`docs/review-prompt-optimization-2026-08-25.md` v2.1 提示词 Step 3 深度探针
> 目的：区分「宣称的能力」与「真实可用的能力」，识别空壳（壳页面）、Stub（有 UI 无数据）、假深度（行数大但数据 mock）

---

## 一、核心结论

| 层级 | 前端页面(209) | 后端服务(303) | 判定 |
|------|-------------|-------------|------|
| **真实实现**（>400行 / >2000行） | **163** (78%) | **46** (15%) | 完整 CRUD + 真实数据流 |
| **部分实现**（150-400行 / 800-2000行） | **41** (20%) | **121** (40%) | 核心链路有，边缘缺失 |
| **Stub**（50-150行 / 250-800行） | 0 | **131** (43%) | 有工程骨架，需验证数据真实性 |
| **空壳**（<50行 / <250行） | **5** (2%) | **5** (2%) | 空白/仅重定向/轻脚手架 |
| **假深度**（mock/硬编码数据） | **30+ 页面** | - | 行数达标但数据非真实 API |

> ⚠️ **后端 Stub 的 131 需谨慎解读**：多数为 handler/repository/models 三层的**标准 CRUD 脚手架**（如 database-devops 已确认真实可用）。「Stub」代表**能力深度待验证**，而非全部是假实现。真实判断需抽查每个服务的 repository 是否有 DB 查询 + 前端是否可寻址到具体端点。

---

## 二、前端深度分布（209 页目录，按最深非测试 tsx 行数）

### 空壳（<50 行，5 项）——必须修复

| 页面目录 | 主文件行数 | 现状 |
|---------|----------|------|
| service-catalog | 39 行 | 报告已标 P0，至今 stub |
| ci-type-designer | 35 行 | 报告已标 P0，至今 stub |
| service-portal | 35 行 | 报告已标 P0，至今 stub |
| digital-twin | 35 行 | 报告已标 P0，至今 stub |
| ServiceRegistry | 5 行 | 仅重导出，指向 canonical service-registry/ServiceRegistry |

> 注意：另有 `ServerError`(183)、`NotFound`(184) 是标准错误页，非业务空壳；`dba/graph/inception/pandawiki/visor/Workbench/SubApps` 等表浅页面实为**重导出或子目录结构**，真实实现在对应 `*Page.tsx` 或子目录。

### 浅实现（150-300 行，41 项部分实现中较浅的 20 项）

| 页面 | 行数 | 页面 | 行数 |
|------|------|------|------|
| ScriptRunner | 223 | AIGateway | 302 |
| PipelineVersionHistory | 235 | EfficacyMetrics | 303 |
| SubApps | 257 | SelfHealing | 304 |
| artifact-ops | 267 | CronJobs | 305 |
| plugin-marketplace | 268 | QueueTasks | 305 |
| disaster-recovery | 269 | ArtifactVersion | 306 |
| canary-traffic | 277 | NotificationDetail | 306 |
| AIDashboard | 279 | UserProfile | 309 |
| supply-chain | 288 | AuditLog | 318 |
| LLMTraceDashboard | 291 | AgentDashboard | 323 |

### 真实实现（>400 行，Top 10）

| 页面 | 行数 | 页面 | 行数 |
|------|------|------|------|
| developer-portal | 2686 | Incident | 1752 |
| ChangeManagement | 2111 | pipeline-svc | 1497 |
| deploy | 1984 | WorkflowDesigner | 1401 |
| OpsTools | 1825 | Problem | 1388 |

---

## 三、后端深度分布（303 服务，全深度非测试行数）

### 空目录聚合容器（已排除误报）

| 目录 | 子文件数 | 结论 |
|------|---------|------|
| ci-cd | 122 | 真实聚合容器（artifact-registry/build/canary/deploy/pipeline 等） |
| governance | 66 | 真实聚合容器 |
| identity | 80 | 真实聚合容器（auth/tenant/user/sso 等） |
| workflow | 44 | 真实聚合容器 |

> 初扫将其误判为"0 行空目录"被修正剔除，它们实际是最厚重的服务域（ci-cd 23346 行全站第二）。

### 轻实现候选（<310 行，需逐项验证）

| 服务 | 主代码行数 | 说明 |
|------|-----------|------|
| agents | 140 | 三层骨架，需验证真实 CRUD |
| database-devops | 140 | **已确认标准 CRUD 脚手架可用**（tenant 过滤 + Repository） |
| gateway-routes | 140 | 待验证 |
| rate-limiting | 140 | 待验证 |
| test-reports | 140 | 待验证 |
| user-status | 261 | 待验证 |
| pipeline-run-history | 271 | 待验证 |
| project | 274 | 待验证 |
| incident-action | 281 | 待验证 |
| user-profile | 285 | 待验证 |

### 真实重型服务（>9000 行，Top 8）

| 服务 | 行数 | 服务 | 行数 |
|------|------|------|------|
| ai | 23346 | finops | 14503 |
| ci-cd | 21797 | ticketing | 13084 |
| notification | 15103 | monitoring | 10077 |
| infrastructure | 14995 | governance | 9590 |

---

## 四、假深度检测（关键发现：行数 ≠ 深度）

> 仅靠行数探针会漏掉"行数大但数据 mock 化"的页面。扫描到 **30+ 页面**含 mock/硬编码/模拟数据标记，包括多个人们以为"真实"的高行数页面：

| 页面 | 行数 | 问题证据 |
|------|------|---------|
| TicketDetail/TicketComments | 516 | 注释明确 `mockTicketComments` `mockTicketAttachments` |
| MLOpsPage | 1057 | 含 mock 标记 |
| DashboardCore | 437 | 注释"Replaced mock data imports with real API"，历史 mock 已修 |
| TenantManagement | 784 | 含 mock 标记 |
| DoraMetricsPage | 591 | `fallbackBenchmarks` 注释"保留为展示文本映射（不含数值，非假数据）"——已部分修复 |
| AIGateway | 302 | 含 mock 标记 |
| 其它 25+ | - | 见审查报告 P1/P2 硬编码项 |

**结论**：前端 `TicketComments`、`MLOpsPage` 等高行数页面存在**数据 mock 假深度**，行数探针不足，必须叠加 mock 关键词探针。

---

## 五、推荐：深度探针 v2.3（在 v2.1 Step 3 基础上增强第二层）

```bash
# 第一层：行数分级（已有）
# 第二层：mock/硬编码/假数据关键词（新增，抓"假深度"）
grep -rlnE "mock|Mock|硬编码|开发中|功能开发中|假数据|模拟数据|const\s+\w+\s*=\s*\[" \
  orion-frontend/src/pages --include="*.tsx" 2>/dev/null | grep -v __tests__

# 第三层：页面是否 import 真实 api client（抓"只渲染不联调"）
for f in orion-frontend/src/pages/*/[a-z]*.tsx; do
  api_imports=$(grep -c "from '@/api/" "$f" 2>/dev/null || echo 0)
  echo "$api_imports|$f"
done | sort -n | head -30
```

**判定规则**：行数 >400 **但** 命中第二层 mock 标记 → 降级为「Stub/假深度」；同时 import 0 个 api client → 降级为「只读壳」。

---

## 六、待验证清单（评审执行时优先）

| 类型 | 项数 | 具体 |
|------|------|------|
| 前端空壳 P0 | 4 | service-catalog / ci-type-designer / service-portal / digital-twin |
| 后端轻实现 | 5 | agents / gateway-routes / rate-limiting / test-reports（database-devops 已通过） |
| 假深度高优 | 3 | TicketComments / MLOpsPage / AIGateway |
| 假深度待查 | 25+ | 见审查报告 P1/P2 硬编码项 |

---

## 附：修正记录

- 2026-08-25 初扫：将 ci-cd/governance/identity/workflow 误判"0 行空目录"，实为聚合容器，全深度复扫后剔除
- 2026-08-25 前端探针升级：从 `-maxdepth 1` 只测 index.tsx，改为递归取最深非测试主文件，避免把重导出页误判为空壳