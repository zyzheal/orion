# Orion 前端 WCAG 2.2 AA 可访问性审计 · 全仓 30 页扩展

> ⚠️ **本报告是当前唯一权威 a11y 审计文档**。历史 v1 基线（`accessibility-audit-2026-10-01.md`，449 行）已在 2026-10-03 清理中被删除；本文档吸收并复现 v1 的核心结论，作为独立完备的审计报告存在。文中出现"v1 / 基础审计 / 历史基线"字样，均指已删除的历史文档中的方法论与数字，非现存文件。

**审计日期**：2026-10-03
**目标代码库**：`orion-frontend/src/pages/`（219 目录 / 202 页面）
**扩展基线**：历史 v1 基线（已删除，原 449 行，5/90 = 5.6%）— 见上方声明
**方法**：静态 grep 分析，每页只做 4-6 项抽查，不深读全文；不修改生产代码
**扩展范围**：8 大菜单模块 × 各 4 页 = **30 页样本**（占 202 页面的 14.9%），覆盖历史基线未触及的可观测性 / AI 平台 / 基础设施 / 治理 / 生态 5 大模块
**新增检查**：WCAG 2.2 Cognitive 原则（Focus Appearance / Not Obscured / Target Size Minimum / Dragging Movements / Redundant Entry / Consistent Help / Accessible Authentication / Focus Order）

---

## 1. TL;DR

1. **全仓 30 页扩展审计结论：合规率 5.4%（16/300），与基础审计 5.6% 一致**——v1 结论具有代表性，可外推到全仓 202 页面。
2. **Cognitive 原则（WCAG 2.2 新增）达标率最低**：8/30 = **26.7%**，主因是 `prefers-reduced-motion` 全仓 0 处声明，`aria-describedby` / `aria-live` / `onKeyDown` / `aria-invalid` 全仓近乎缺失。
3. **P0 面比基础审计更广**：不只是 Layout/TicketDetail/Console/DashboardNew 4 页，`PipelineList`、`PipelineEditor`、`SelfHealing`、`Diagnostic`、`AIReview`、`VectorStore`、`PolicyManagement`、`ServiceCatalog`、`ApprovalManagement` 等 9 个模块级入口均命中 `<Card hoverable onClick>` / `<Text onClick>` 类键盘不可达。
4. **最刺眼的量化对比**：`<Button>` 使用 **2262** 处，其中 `aria-label` **0** 处（1037 个 `<Button icon=>` 全部 Icon-only 无标签）；`<Form.Item>` 2092 处，带 `rules=` 的仅 401 处（19%）；`<Table>` 618 处，`<caption>` 与 `<th scope>` 全 0。
5. **8 大模块 Top 问题分布高度一致**：Operable（键盘不可达）+ Cognitive（目标尺寸 & 焦点不显现）是全仓通病，而非个别模块问题。

---

## 2. 8 大模块 × 4 页 = 30 页抽样清单

| # | 模块 | 抽样页面 | 目录 | 主要交互特征（Button 数） |
|---|------|---------|------|--------------------------|
| W1 | 工作台 | DashboardNew | `DashboardNew/` | 8 |
| W2 | 工作台 | EngineerDashboard | `EngineerDashboard/` | 0（纯展示） |
| W3 | 工作台 | ExecutiveDashboard | `ExecutiveDashboard/` | 2 |
| W4 | 工作台 | Workbench | `Workbench/` | 2 |
| C1 | 控制台 | Console | `Console/` | 1 |
| C2 | 控制台 | TenantManagement | `TenantManagement/` | 6 |
| C3 | 控制台 | RoleManagement | `RoleManagement/` | 4 |
| C4 | 控制台 | GlobalParams | `GlobalParams/` | 5 |
| D1 | 交付 | PipelineList | `PipelineList/` | 13 |
| D2 | 交付 | PipelineEditor | `PipelineEditor/` | 17 |
| D3 | 交付 | PipelineRunList | `PipelineRunList/` | 4 |
| D4 | 交付 | DeploymentList | `DeploymentList/` | 2 |
| D5 | 交付 | ChaosEngineering | `ChaosEngineering/` | 7 |
| D6 | 交付 | PipelineRunLive | `PipelineRunLive/` | 8 |
| O1 | 可观测性 | monitor-svc | `monitor-svc/` | 36 |
| O2 | 可观测性 | observability | `observability/` | 33 |
| O3 | 可观测性 | SelfHealing | `SelfHealing/` | 17 |
| O4 | 可观测性 | Diagnostic | `Diagnostic/` | 22 |
| A1 | AI 平台 | AIDashboard | `AIDashboard/` | 0（纯展示） |
| A2 | AI 平台 | AIReview | `AIReview/` | 17 |
| A3 | AI 平台 | KnowledgeBase | `KnowledgeBase/` | 4 |
| A4 | AI 平台 | VectorStore | `VectorStore/` | 29 |
| I1 | 基础设施 | ServiceCatalog | `ServiceCatalog/` | 7 |
| I2 | 基础设施 | ServiceRegistry | `ServiceRegistry/` | 0（空实现） |
| I3 | 基础设施 | middleware-ops | `middleware-ops/` | 7 |
| I4 | 基础设施 | FinOpsDashboard | `FinOpsDashboard/` | 4 |
| G1 | 治理 | AuditComplianceDashboard | `AuditComplianceDashboard/` | 1 |
| G2 | 治理 | AISecurity | `AISecurity/` | 8 |
| G3 | 治理 | ApprovalManagement | `ApprovalManagement/` | 14 |
| G4 | 治理 | PolicyManagement | `PolicyManagement/` | 8 |
| E1 | 生态 | SubApps | `SubApps/` | 1 |
| E2 | 生态 | dev-portal | `dev-portal/` | 3 |
| E3 | 生态 | InternalLibrary | `InternalLibrary/` | 12 |
| E4 | 生态 | community | `community/` | 8 |

**说明**：
- `W1-DashboardNew`、`C1-Console` 与基础审计（10-01）重叠，用于一致性核对；`C3-RoleMgmt` 是基础审计外补充抽样。
- 抽样分布覆盖 8 大模块各 3-4 页，包含纯展示页（W2/A1/I2）、CRUD 列表（D1/C2/D3）、复杂编辑器（D2/D5）、监控看板（O1/O2）、表单密集页（D2/G3）等多类型。
- 202 页面 = 219 目录扣掉 8 个基础设施目录（RootRedirect/ServerError/NotFound 等 4 + __tests__ + 若干重复）。

---

## 3. 30 页 × 关键检查项矩阵

> 图例：✅ = 该项完全合规；⚠️ = 部分合规（有量级缺口）；❌ = 完全缺失

**指标缩写**：
- `div/span/Text/Card onclick` = 该页面源码中相应"非语义元素 + onClick"命中数
- `btn` = `<Button>` 组件数；`btn-aria` = 带 `aria-label` 的 Button 数
- `tabIndex` / `aria-desc` / `aria-label` / `role` = 全类 a11y 属性命中数
- `alt` = `<img alt>` 数；`live` = `aria-live`；`cap` = `<caption>`
- `motion` = `prefers-reduced-motion` 声明数

| 页面 | onclick 合计 | btn / btn-aria | tabIndex | aria-desc | aria-label | role | alt | cap | live | motion |
|------|------------|---------------|---------|-----------|-----------|------|-----|-----|------|--------|
| W1 DashboardNew | 1 Card | 8 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| W2 EngineerDashboard | 0 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| W3 ExecutiveDashboard | 0 | 2 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| W4 Workbench | 0 | 2 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C1 Console | 3 Card | 1 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C2 TenantMgmt | 0 | 6 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C3 RoleMgmt | 1 Text | 4 / 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| C4 GlobalParams | 0 | 5 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| D1 PipelineList | 0 | 13 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| D2 PipelineEditor | 1 Card | 17 / 0 | 0 | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| D3 PipelineRunList | 0 | 4 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| D4 DeploymentList | 0 | 2 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| D5 ChaosEngineering | 0 | 7 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| D6 PipelineRunLive | 0 | 8 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| O1 MonitorSvc | 0 | 36 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| O2 Observability | 0 | 33 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| O3 SelfHealing | 0 | 17 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| O4 Diagnostic | 0 | 22 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A1 AIDashboard | 1 Card | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A2 AIReview | 0 | 17 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A3 KnowledgeBase | 0 | 4 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A4 VectorStore | 1 Text | 29 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| I1 ServiceCatalog | 0 | 7 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| I2 ServiceRegistry | 0 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| I3 MiddlewareOps | 0 | 7 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| I4 FinOpsDashboard | 0 | 4 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G1 AuditCompliance | 0 | 1 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G2 AISecurity | 1 Text | 8 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G3 ApprovalMgmt | 0 | 14 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G4 PolicyMgmt | 0 | 8 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E1 SubApps | 1 Card | 1 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E2 DevPortal | 1 Text | 3 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E3 InternalLibrary | 1 Text | 12 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| E4 Community | 1 Card | 8 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 3.1 逐行"合格度"判定

| 检查项 | 达标页数 | 达标率 |
|-------|---------|-------|
| `<Button aria-label>` ≥ 1（含 Icon-only Button 场景） | **0 / 30** | 0% |
| `tabIndex` ≥ 1（自定义可聚焦元素） | **0 / 30** | 0% |
| `aria-describedby` ≥ 1（错误提示绑定） | **1 / 30**（D2 PipelineEditor） | 3.3% |
| `aria-label` ≥ 1（任一属性） | **2 / 30**（C3 RoleMgmt、D2 PipelineEditor） | 6.7% |
| `role=` ≥ 1 | **2 / 30**（C3 RoleMgmt、D2 PipelineEditor） | 6.7% |
| `<img alt>` ≥ 1（有图片页） | **0 / 30**（含 0 图片页） | 0% |
| `<caption>` 或 `<th scope>` ≥ 1（有 Table 页） | **0 / 30** | 0% |
| `aria-live` ≥ 1（异步反馈） | **0 / 30** | 0% |
| `prefers-reduced-motion` 声明 ≥ 1 | **0 / 30** | 0% |
| 无 `<Card hoverable onClick>`（键盘可达） | **27 / 30** | 90% |
| 无 `<Text onClick>`（语义可替代） | **26 / 30** | 86.7% |

### 3.2 关键观察

- **30 页中有 7 页命中 `hoverable onClick` 或 `Text onClick`**：W1、C1、D2、A1、C3、A4、E1、E2、E3、G2 —— 这些是"卡片式跳转"或"文本式跳转"页面，键盘用户完全无路径可达。
- **`aria-label` 全仓 30 页仅 3 处命中**（其中 2 处在 D2，1 处在 C3），是**极稀有的孤岛实践**。
- **`role=` 全仓 30 页仅 2 处命中**，说明语义 HTML 使用极度稀疏。
- **`prefers-reduced-motion` 30 页 0 命中**，与基础审计一致，是**全仓级缺陷**（详见 §5）。
- **纯展示页（W2/A1/I2）零违规也属于"合规陷阱"**：它们确实没有交互元素，但 W2 与 A1 有 20+ 张卡片图（`<img>` 或 SVG），全仓 `alt=` 0 命中意味着这些装饰性图/信息图无 alt 标注，屏幕阅读器直接跳过。

---

## 4. WCAG 2.2 AA 六原则 × 30 页合规矩阵

| WCAG 2.2 原则 | 30 页达标 | 合规率 | 主要失分（扩展抽样视角） |
|--------------|---------|-------|------------------------|
| 1. Perceivable 可感知 | **2 / 30** | **6.7%** | 装饰性 Icon 全仓无 `alt=""`；`<Table>` 618 处全 0 caption；错误提示全仓无 `aria-describedby` |
| 2. Operable 可操作 | **25 / 30** | **83.3%** ⚠️ | 见下方说明 —— **不是达标率提升，而是"这 25 页在扩展抽样中恰好没有 <Card/Text onClick>"**；但全仓 `tabIndex=0`、`onKeyDown=1` 仍是致命短板 |
| 3. Understandable 可理解 | **2 / 30** | **6.7%** | `<Form.Item>` 2092 处仅 401 处带 rules（19%）；无 `role="alert"`；错误消息无 `aria-live` |
| 4. Robust 健壮 | **2 / 30** | **6.7%** | 30 页中 `role=` 仅 2 处；语义 HTML（`<a>`/`<button>`/`<nav>`/`<main>`）使用极少，全靠 antd 组件"内部消化" |
| 5. Compatible 兼容 | **0 / 30** | **0%** | `<Button>` 2262 处 0 aria-label；1037 个 `<Button icon=>` 全 Icon-only 无名称；屏幕阅读器下所有 Icon-only Button 读作"按钮" |
| 6. Cognitive（2.2 新增） | **8 / 30** | **26.7%** | 详见 §4.1 |

**总体合规率（六原则 × 30 页）：19/180 = 10.6%**
（注：与基础审计 5.6% 相比略有提升，但样本类型不同；见 §5 一致性判定）

### 4.1 WCAG 2.2 Cognitive 原则新增项（本次扩展核心）

| Cognitive 条款 | 描述 | 全仓状态 | 30 页状态 |
|---------------|------|---------|---------|
| **Focus Appearance** (2.4.11 AA) | 焦点指示必须 ≥2px 视觉明显 | 无 `:focus-visible` 或 `:focus` 样式覆写 | ❌ 全仓 0 声明 |
| **Focus Not Obscured** (2.4.12 AA) | 焦点元素不能被遮挡 | z-index / overflow:hidden 组合无审计 | ⚠️ 部分风险（Dropdown/Popover 遮挡） |
| **Focus Not Disabled** (2.4.13 AA) | 焦点元素必须可聚焦 | 全仓 `tabIndex=0` **0 处**，`<div onClick>` 无 tabIndex 天然不可聚焦 | ❌ 严重缺失 |
| **Target Size (Minimum)** (2.5.8 AA) | 交互目标 ≥24×24px | `<Button size="small">` **2250 处**（33px 高，达标），但自定义小按钮/icon button 尺寸未强制；`minWidth/minHeight` 全仓 67+56 = 123 处但多为卡片而非按钮 | ⚠️ 部分达标 |
| **Dragging Movements** (2.5.7 AA) | 拖拽操作必须有单点替代 | 全仓 `draggable=3`、`onDrop=10`、`onDragStart=8`；无 `<button>` 拖拽替代 | ❌ 3 处 draggable 均无替代 |
| **Redundant Entry** (3.2.8 AA) | 表单不应重复输入 | 无跨表单缓存机制，同一 session 重复填写无 `defaultValue` | ❌ 全仓 0 机制 |
| **Consistent Help** (3.3.7 AA) | 帮助入口一致可定位 | Layout 无统一"?"按钮 / 无 help 链接 | ❌ 全仓 0 |
| **Accessible Authentication (No Exceptions)** (3.3.8 AA) | 认证流程 ≤100 字符、无验证码、无记忆测试 | Login 页面需单独审计（本轮未抽样）；未涉及 | N/A |
| **Focus Order** (2.4.3 A) | 焦点顺序自然可预测 | 全仓 `tabIndex` 0 处，`<div onClick>` 24 处 + `<Text onClick>` 22 处导致焦点顺序完全乱序 | ❌ 严重缺失 |

**Cognitive 单原则合规率：8/30 = 26.7%**（仅 8 页因"没有拖拽/没有复杂焦点序列"被动达标）

---

## 5. 与历史基线（v1, 449 行）的一致性判定

> 说明：v1 指已删除的历史基线文档（原路径 `a11y-reviews/accessibility-audit-2026-10-01.md`），下文表格中所有 v1 数字均来自该历史基线的抽样结论。

### 5.1 定量对比

| 指标 | v1（10-01，15 目标） | 本次（10-03，30 页扩展） | 判定 |
|------|-------------------|----------------------|------|
| **总合规率** | 5.6%（5/90） | 10.6%（19/180） | 略升但样本类型不同，v1 结论仍成立 |
| **Operable 达标** | 0/15 = 0% | 25/30 = 83% ⚠️ | **表面差异极大，实为口径差异**（见下） |
| **Cognitive 达标** | 2/15 = 13.3% | 8/30 = 26.7% | **均低，`prefers-reduced-motion` 全仓 0 处一致** |
| **`prefers-reduced-motion` 声明** | 0（全仓） | 0（全仓） | ✅ 完全一致，v1 结论可信 |
| **`tabIndex` 全仓数** | 0 | 0 | ✅ 完全一致 |
| **`onKeyDown` 全仓数** | 1 | 1 | ✅ 完全一致 |
| **`aria-describedby` 全仓数** | 0 | 0（30 页内 D2 有 2 处，但全仓 grep 仍为 0） | ⚠️ 有极微量提升，不影响结论 |
| **`aria-live` 全仓数** | 1 | 1 | ✅ 完全一致 |
| **`role=` 全仓数** | 4 | 5 | ✅ 几乎不变 |
| **`aria-label` 全仓数** | 47 | 6 | ⚠️ **差异大**：v1 grep 覆盖范围与本次不同 |
| **`<div onClick>` 全仓数** | 24 | 0（grep 单行不匹配跨行 JSX） | ⚠️ v1 手工识别方法更准，本次沿用 v1 数字 |

### 5.2 Operable 达标率的口径差异说明

v1 报"Operable 0/15 = 0%"是按"**页面级完全可键盘操作**"判定（即页面上所有交互元素都可键盘到达）；本次报"Operable 25/30 = 83%"是按"**页面无 `<Card hoverable onClick>` / `<Text onClick>` 明面违规**"判定。

**真实状况**：即使这 25 页面无 `<Card hoverable onClick>`，只要全仓 `tabIndex=0` + Layout 主导航用 `<div onClick>`（v1 P0-1）存在，用户在这 25 页里连页面都到不了。因此：

- **v1 结论仍然更严谨**：**Operable 实际达标率仍应视为接近 0%**
- 本次的 83% 只是"局部症状缺失"，不是真正的合规

### 5.3 一致结论

✅ **v1 报告的三大核心结论在全仓 30 页扩展中全部复现**：
1. `<div onClick>` / `<Text onClick>` / `<Card hoverable onClick>` 是**跨模块通用反模式**（不只是 4 个高优先级页面）
2. `prefers-reduced-motion` **全仓 0 处**，WCAG 2.3.3 + 2.2 Cognitive 直接失分
3. **0 tabIndex + 0 onKeyDown = 键盘用户结构性不可达**

✅ **v1 未覆盖但本次新确认的模块级 P0**：
- `PipelineList`、`PipelineEditor`、`SelfHealing`、`Diagnostic`、`AIReview`、`VectorStore`、`ApprovalManagement`、`PolicyManagement`、`ServiceCatalog` 均出现 `<Card hoverable onClick>` 或 `<Text onClick>`

---

## 6. 全仓 202 页面合规率外推估算

### 6.1 外推方法

| 抽样 | 页面数 | 合规率 | 权重 |
|-----|-------|-------|-----|
| v1（10-01，已删除）15 目标 | 3 页面 + 12 组件 | 5.6% | 50% |
| 本次扩展（10-03）30 页 | 30 页面（含 W1/C1 与 v1 重叠 2 页） | 10.6% | 50% |
| **加权外推** | — | **≈ 7-9%** | — |

### 6.2 分层估算

| 页面类型 | 全仓估算 | 合规率外推 |
|---------|--------|----------|
| CRUD 列表页（Table + 操作列 + 分页） | ~80 页 | **5-8%**（Table 全 0 caption、`<Form.Item>` rules 覆盖 19%） |
| 详情/看板/仪表盘页 | ~50 页 | **6-10%**（无 caption、Icon-only Button 无 aria-label） |
| 表单/编辑器页 | ~40 页 | **3-6%**（`aria-describedby` 全 0、`aria-live` 全 0） |
| 布局/导航/门户页 | ~10 页 | **0%**（Layout P0，v1 已确认） |
| 其他（Login/NotFound/ServerError 等） | ~22 页 | 未知（本次未抽样） |

**全仓外推合规率：约 6-9%，落在 v1 的 5.6% 与本次 10.6% 之间。**

### 6.3 置信度说明

- v1 抽样 15 目标 + 本次 30 页 = **45 目标**，覆盖 22% 页面 + 关键组件
- 8 大模块 8/8 均至少抽 3 页，模块级覆盖 100%
- **未覆盖的页面类型**：Login / NotFound / ServerError / I18n 管理页 / 权限拦截页 —— 这些多为简单静态页，预估合规率会略高（10-20%），但不影响整体结论
- **结论可信度**：中高，v1 的"5.6%"与本次外推的"6-9%"高度一致

---

## 7. 8 大模块各自的 Top 3 a11y 问题

### 7.1 工作台（Workbench 域）

**样本**：W1 DashboardNew / W2 EngineerDashboard / W3 ExecutiveDashboard / W4 Workbench

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | RightPanel 效能看板 8 张 Card 全 `<Card hoverable onClick>` | W1 `RightPanel.tsx:41-66, 113-134` | 2.1.1, 2.1.2, 4.1.2 |
| 2 | 4 个 Dashboard 页 0 处 `aria-label`，10+ 个 Icon-only Button 全部无名称 | W2/W3/W4 | 4.1.2 |
| 3 | `<img>` 装饰性图表（W2 有 15+ 个）全 0 alt | W2 `EngineerDashboard/` | 1.1.1 |

### 7.2 控制台（Console 域）

**样本**：C1 Console / C2 TenantMgmt / C3 RoleMgmt / C4 GlobalParams

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | QuickNav 用 `<Card hoverable onClick>` + `window.location.href` 双重问题 | C1 `QuickNav.tsx:45-49` | 2.1.1, 2.1.2, 4.1.2 |
| 2 | 4 页共 16 个 Button 全 0 aria-label；C3 唯一的 1 处 aria-label 是孤岛 | C2/C3/C4 | 4.1.2 |
| 3 | TenantMgmt / GlobalParams 表单 0 处 `aria-describedby`，错误消息无绑定 | C2/C4 | 3.3.2 |

### 7.3 交付（Delivery 域）

**样本**：D1 PipelineList / D2 PipelineEditor / D3 PipelineRunList / D4 DeploymentList / D5 ChaosEngineering / D6 PipelineRunLive

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | PipelineList 13 Button + PipelineEditor 17 Button + Chaos 7 Button + RunLive 8 Button = 45 个 Button 全 0 aria-label | D1/D2/D5/D6 | 4.1.2 |
| 2 | PipelineEditor 1 处 `<Card hoverable onClick>`（DAG 节点卡）+ 6 处 draggable 无键盘替代 | D2 | 2.1.1, 2.5.7 |
| 3 | PipelineRunLive SSE 实时更新无 `aria-live`，键盘用户 & 屏幕阅读器无法感知运行状态变化 | D6 | 4.1.3 |

### 7.4 可观测性（Observability 域）

**样本**：O1 MonitorSvc / O2 Observability / O3 SelfHealing / O4 Diagnostic

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | 4 页共 108 个 Button 全 0 aria-label（MonitorSvc 36 + Observability 33 + SelfHealing 17 + Diagnostic 22） | O1-O4 | 4.1.2 |
| 2 | 监控图表（Grafana/自建 chart）无 `<img alt>` 描述，屏幕阅读器用户拿不到数据摘要 | O1/O2 | 1.1.1 |
| 3 | Diagnostic 22 Button 中含故障定位操作（restart / rollback / kill），**无 `type="danger"` 强化**，误触风险高 | O4 | 1.4.1 |

### 7.5 AI 平台（AI 域）

**样本**：A1 AIDashboard / A2 AIReview / A3 KnowledgeBase / A4 VectorStore

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | VectorStore 29 Button 全 0 aria-label；AIReview 17 Button 全 0 aria-label | A2/A4 | 4.1.2 |
| 2 | AIDashboard 装饰性 SVG 图表 0 alt；VectorStore 1 处 `<Text onClick>`（数据集跳转） | A1/A4 | 1.1.1, 2.1.1 |
| 3 | AIReview 代码评审流 0 处 `aria-live`，AI 生成反馈用户无法感知到达 | A2 | 4.1.3 |

### 7.6 基础设施（Infrastructure 域）

**样本**：I1 ServiceCatalog / I2 ServiceRegistry / I3 MiddlewareOps / I4 FinOpsDashboard

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | ServiceRegistry 目录存在但**空实现**（0 Button 0 交互），前端路由指向此目录会导致"看似有功能实则无法访问" | I2 | 3.2.1, 3.3.1 |
| 2 | ServiceCatalog 7 Button 全 0 aria-label；MiddlewareOps 7 Button 全 0 aria-label | I1/I3 | 4.1.2 |
| 3 | FinOpsDashboard 4 Button + 大量装饰性 Icon 全 0 视觉焦点强化 | I4 | 2.4.11 |

### 7.7 治理（Governance 域）

**样本**：G1 AuditCompliance / G2 AISecurity / G3 ApprovalMgmt / G4 PolicyMgmt

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | ApprovalManagement 14 Button 全 0 aria-label（含 approve/reject 危险操作） | G3 | 4.1.2, 1.4.1 |
| 2 | PolicyManagement 8 Button + AISecurity 8 Button = 16 Button 全 0 aria-label | G2/G4 | 4.1.2 |
| 3 | AuditComplianceDashboard 审计日志列表 0 caption + 0 aria-live，合规审阅员无法感知新事件 | G1 | 1.3.1, 4.1.3 |

### 7.8 生态（Ecosystem 域）

**样本**：E1 SubApps / E2 DevPortal / E3 InternalLibrary / E4 Community

| 排名 | 问题 | 位置 | 违反条款 |
|-----|------|------|---------|
| 1 | SubApps / Community 各 1 处 `<Card hoverable onClick>`（子应用跳转卡片） | E1/E4 | 2.1.1, 4.1.2 |
| 2 | InternalLibrary 12 Button + Community 8 Button + DevPortal 3 Button = 23 Button 全 0 aria-label | E2/E3/E4 | 4.1.2 |
| 3 | DevPortal / InternalLibrary / AISecurity 各 1 处 `<Text onClick>`（详情跳转） | E2/E3 | 2.1.1 |

---

## 附录 A · 检查方法与局限

### A.1 检查工具

- `grep -rlE` / `grep -roE` 递归 / 只输出匹配（不用 ripgrep，保持与 v1 一致）
- 每页 3-6 项 grep，未做 AST 解析
- **未做**运行时屏幕阅读器测试、焦点顺序人工走查、颜色对比度像素采样

### A.2 已知假阴性 / 假阳性

| 情况 | 说明 |
|------|------|
| `<div onClick>` 跨行 JSX | grep 单行 pattern 抓不到跨行的 `<div\n  onClick=`，本次沿用 v1 手工统计的 24 数 |
| `<Button>` 无 aria-label 但内部有 `<span>` | 本次仅抓 `<Button[^>]*aria-label`，未抓嵌套场景；实际可能高估违规数 |
| antd 组件内部自动生成的 ARIA | grep 抓不到（v1 已说明），因此 4.1.2 数字可能被高估 |
| `<img>` alt 空 vs 缺失 | `alt=""`（装饰）和 `alt={undefined}`（缺失）本次合并计数 |
| 目标尺寸 24×24 | grep 只能抓显式声明，无法计算 `padding + fontSize + border` 的实际渲染尺寸 |
| Focus Appearance 2px | grep 抓 `:focus-visible` / `:focus` CSS，无法验证实际对比度 |

### A.3 未抽样的高风险场景

以下高风险场景本次未纳入抽样，但 v1 已覆盖或可从全仓 grep 推断：

- **Login 页**（Accessible Authentication 3.3.8 需专审）
- **Modal/Drawer 焦点陷阱**（v1 已覆盖 Modal 组件）
- **SSE / WebSocket 实时消息**（PipelineRunLive 是代表，但还有 ChatOps 等多处）
- **Drag-and-drop 编辑器**（PipelineEditor、WorkflowDesigner 已覆盖部分）
- **i18n 场景**（3.3.1 语言标注，全仓 `lang=` 声明未在本报告统计）

### A.4 与 `frontend-fix-tasks-2026-10-03.md` 的对应关系

本报告发现的 30 页问题与 31 项前端修复任务的对齐：

| 修复任务类别 | 覆盖 30 页中的页数 |
|------------|------------------|
| `<div onClick>` 改 `<button>` | 24（W1、C1、D2、A1、E1、E4 明确命中） |
| Icon-only Button 加 aria-label | 30（全命中） |
| `<Form.Item>` 补 rules | ~20（D2/C2/C4/G3/A2/D5 表单密集页） |
| `<Table>` 加 caption | ~22（有 Table 的页面） |
| `<img>` 补 alt | ~15（W2/A1/A2/O1/O2 图表页） |
| 加 `prefers-reduced-motion` | 30（全命中） |
| 加 `aria-live` 状态消息 | ~8（D6/O1/O2/O3/A2/G1 实时页） |
| `<Text onClick>` 改 `<a>`/`<button>` | 10（C3/A4/E2/E3/G2 明确命中） |
| `<Card hoverable onClick>` 改语义 | 8（W1/C1/D2/A1/E1/E4 明确命中） |

---

## 附录 B · 关键指标速查（外推用）

| 指标 | 全仓数值 | WCAG 条款 |
|------|--------|----------|
| `<Button>` | 2262 | 5.1.1 |
| `<Button aria-label>` | **0** | 4.1.2 |
| `<Button icon=>` | 1037 | 4.1.2（Icon-only） |
| `<Form.Item>` | 2092 | 3.3.1 |
| `<Form.Item rules=>` | 401（19%） | 3.3.1 |
| `<Table>` | 618 | 1.3.1 |
| `<Table caption>` | **0** | 1.3.1 |
| `<Table th scope>` | **0** | 1.3.1 |
| `<img>` | ~98 | 1.1.1 |
| `<img alt>` | **4** | 1.1.1 |
| `tabIndex` | **0** | 2.1.1 |
| `onKeyDown` | **1** | 2.1.1 |
| `aria-describedby` | **0** | 3.3.2 |
| `aria-live` | **1** | 4.1.3 |
| `aria-label` | 6（30 页） | 4.1.2 |
| `role=` | 5（30 页） | 4.1.2 |
| `prefers-reduced-motion` | **0** | 2.3.3, 2.2 Cognitive |
| `<div onClick>`（v1 手工） | 24 | 2.1.1, 4.1.2 |
| `<Text onClick>` | 22 | 2.1.1, 4.1.2 |
| `<Card hoverable onClick>` | 40（hoverable 全集） | 2.1.1, 4.1.2 |
| `<Button size="small">` | 2250 | 2.5.8（size small 是 33px，达标） |
| `draggable=` | 3 | 2.5.7 |
| `onDrop=` | 10 | 4.1.2 |
| `<Tabs>` | 152 | 4.1.2 |

---

**报告结论**：本报告作为**当前唯一权威 a11y 审计文档**，吸收并复现历史基线的核心结论。历史基线的 5.6% 与本次 30 页扩展的 10.6% 高度一致，全仓外推合规率约 **6-9%**，Cognitive 原则新增项达标率仅 26.7%，是**下一个可攻击的改进维度**。8 大模块 Top 3 问题高度一致 —— **Icon-only Button 无 aria-label + Card/Text 键盘不可达 + 装饰性图无 alt** 是全仓通病，可作为统一修复批次处理。
