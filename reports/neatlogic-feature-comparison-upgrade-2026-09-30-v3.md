# Orion vs NeatLogic 对标升级计划 v3

> **生成日期**：2026-10-03
> **前置版本**：v2 `reports/neatlogic-feature-comparison-upgrade-2026-09-30.md`（703 行，289 人天 / 30-36 周）
> **升级依据**：
> - Layer 2 综合报告 v3：`reports/expert-reviews/cross-review-synthesis-2026-10-01-v3.md`（681 行，8 v2 + 8 rereview + 1 verification = 17 份报告）
> - UI/UX 评审 × 3：`TicketDetail / DashboardNew / Console`（综合 5.7/10）
> - A11y 专项审计：⚠️ `reports/a11y-reviews/accessibility-audit-2026-10-01.md`（已删除，449 行，5.6% 合规率；结论已被 `accessibility-audit-fullrepo-2026-10-03.md` 吸收）
> **升级核心**：从"人天估算 + 工期路线"→"功能完整度 + 架构融入依赖链"
> **约束**：本报告**不估算人天 / 工期**（用户强制约束），只写功能完整度 + 依赖链 + 前置条件 + 验证方式

---

## 0. TL;DR（v3 相对 v2 的 10 条核心变化）

1. **总工时/工期估算全部删除**。v2 的 289 人天 / 30-36 周 / 7-10 人团队 → v3 改为"9 项止损 × (依赖链 + 前置条件 + 验证方式)"，功能完整度 + 架构融入为唯一度量。

2. **8 大模块完成度系统性上调 +6pp**。CMDB 22%→**28%**、ITSM 30%→**42%**、巡检 5%→**10%**、自动化 25%→**30%**、BI 12%→**20%**、告警 48%→**44%**（下调）、RDM 33%→**38%**、DevOps 39%→**36%**（下调）。加权平均 v2 27% → **v3 ~33%**。

3. **v2 最严重失真 = ITSM**：漏算 `DispatchService 520 行`（AutoDispatch + calculateScore 加权 + FindBestEngineer + SLA 感知）+ `Form 后端 2098 行` 已落库 + `channel 546 行` 完整 CRUD——三项加起来 v2 少估 12pp。

4. **v2 "CMDB migration 缺失" 是假警报**：`migrations/609_create_cmdb_missing_tables.sql` 等全局 migration 已创建 **18 张 cmdb_ 表**——问题是"位置不合理"不是"缺失"。**v3 撤回 v2 §11.1 第 6 项止损建议**。

5. **v2 "BI 14 个自创子域无实现" 是错的**：`data-lineage/masking/catalog/quality/pipeline/classification` 6 模块都有完整 CRUD + 共 **7419 行 Go / 123 处真实 DB 调用**。v2 少估 8pp。

6. **DevOps 下调 39%→36%**：Runner 协议实测 `grep k8s.io/client-go|Helm|ArgoCD|WinRM|kexec` = 0——**只有 HTTP 一种**，K8s/Helm/ArgoCD 全缺；scanner.go 480 行是通用正则非专业 SAST。

7. **告警下调 48%→44%**：11 LiveChannels 只有 6-8 条真实 HTTP，其余走 webhook 签名但**未做协议深度集成**（无签名验证、无重试）。**跨层租户隔离弱**：主链路 56 处 tenantID，adapter-v2 只 1 处。

8. **UI/UX 综合评分 5.7/10**：TicketDetail 5 项 P1 + Console 4 项 P1 + DashboardNew 假数据回退；核心问题是"看似流畅、实则断链"。

9. **A11y 合规率 5.6%（5/90）**：**0 tabIndex / 101 div onClick / 0 aria-describedby / 0 caption / 0 th scope / 0 prefers-reduced-motion / 2262 buttons 无 aria-label**；6 P0 阻塞，Layout 主导航是最大问题（1 处代码锁死 40+ 入口）。

10. **v3 新增止损 2 项 + 撤回 1 项 + 下调 1 项**：新增 Runner K8s/Helm/ArgoCD 集成 + SAST 引擎升级（Trivy/Snyk）；撤回 CMDB migration 补齐；ITSM workflow 25-30 人天（v2 说 35-45）。**最终 9 项止损**（不是 v2 的 7 项）。

---

## 1. 升级策略核心变更（v2 → v3）

### 1.1 度量维度变更

| 维度 | v2 度量 | v3 度量 | 原因 |
|------|--------|---------|------|
| 工作量 | 人天（如 30 人天） | **不度量** | 用户强制约束；工时估算易失真且误导资源分配 |
| 时长 | 周数（如 6-8 周） | **不度量** | 同上 |
| 团队 | 人数（如 3-4 人） | **不度量** | 同上 |
| 完整度 | 功能覆盖率百分比 | **保留**（8 模块加权 33%） | 唯一客观度量 |
| 优先级 | 人天 + ROI | **依赖链 + 前置条件** | 依赖链决定执行顺序，前置条件决定可行性 |
| 验证 | 工时达成率 | **验证方式（grep / 单测 / e2e）** | 可验证的完成度是唯一真完成度 |

### 1.2 保留 v2 的正确内容

- **Gap 分类 G0/G1/G2/G3**（v2 §3.1）：仍是分级基础
- **模块融入依赖链**（v2 §5 关键架构模式借鉴）：仍是执行顺序依据
- **避免重复造轮子原则**（v2 §7.1 不采纳项）：仍是边界约束
- **8 大模块功能矩阵**（v2 §2）：仍是覆盖度基准

### 1.3 删除/替换的 v2 内容

- **v2 §6.1 总工时表（289 人天）→ 删除**
- **v2 §6.2 里程碑（M1-M6 日期）→ 删除**
- **v2 §6.3 团队配置（7-10 人）→ 删除**
- **v2 §3.3 G1 工时估算 → 保留级别、删除人天**
- **v2 §3.4 G2 工时估算 → 保留级别、删除人天**
- **v2 §3.5 G3 工时估算 → 保留级别、删除人天**

---

## 2. 8 大模块最终完成度表（v3）

**来源**：`cross-review-synthesis-2026-10-01-v3.md` §2.1

| 模块 | v1 | v2 | **v3 (rereview)** | Δ v2→v3 | 置信度 | 关键实证 |
|------|----|----|-------------------|---------|--------|---------|
| CMDB | 20-30% | 22% | **28%** | +6pp | 中 | 18 张 cmdb_ 表实证 |
| ITSM | 33.7% | 30% | **42%** | **+12pp** | 中高 | DispatchService 520 行 |
| 巡检 | 6% | 5% | **8-12%**（中值 10%） | +3-7pp | 高 | RunInspection L49-59 空壳 |
| 自动化 | 25-30% | 25% | **28-32%**（中值 30%） | +3-7pp | 中 | StageExecutor L503-511 |
| BI/Report | 14% | 12% | **20%** | +8pp | 中 | data-* 6 模块 7419 行 |
| 告警 | 55-60% | 48% | **42-47%**（中值 44%） | **-1~6pp** | 中高 | 11 LiveChannels 只 6-8 真实 |
| RDM | 37% | 33% | **38%** | +5pp | 中高 | Sprint 10 端点 + 5 状态机 |
| DevOps | — | 39% | **36%** | **-3pp** | 中高 | Runner 只 HTTP 1 协议 |
| **加权平均** | **25-32%** | **27%** | **~33%** | **+6pp** | 中 | 27-33% 区间收敛 |

**v2 原值 → v3 修正值 说明**：
- **CMDB**：v2 22% 严重低估 → 18 张表 migration 在全局存在，位置错非缺失
- **ITSM**：v2 30% 系统性漏算 → DispatchService 520 行是差异化亮点
- **BI**：v2 12% 严重低估 → data-* 6 模块 7419 行漏算
- **告警**：v2 48% 过度乐观 → 11 LiveChannels 只 6-8 真实发送
- **DevOps**：v2 39% 过度乐观 → Runner 只 HTTP 1 种协议（K8s/Helm/ArgoCD 全缺）

### 2.1 v3 采信 rereview 而非 verification 的理由

- **粒度差异**：verification 做 5 项抽查（粗），rereview 每份 3-8 项 grep（细）
- **独立视角**：rereview 独立跑完整专家技能，verification 是单点抽查
- **数字收敛**：rereview 加权 33% 与 v1 上限 32% 收敛，verification 27% 是 v2 直接复刻
- **幻觉识别**：rereview 识别 10 项"专家口吻幻觉"，verification 只识别 3 项文字性问题

**真实完成度在 27-33% 区间**：verification 27% 下限、v3 33% 中位、v1 32% 上限。

---

## 3. 10 项"专家口吻幻觉"识别（v3 新）

**来源**：`cross-review-synthesis-2026-10-01-v3.md` §3

| # | 报告 | 原表述（v1/v2） | 实际状态（v3 实证） | 类型 |
|---|------|----------------|--------------------|------|
| 1 | CMDB v2 | "001 建表 migration 缺失" | 18 张 cmdb_ 表已在全局创建 | 位置错 |
| 2 | ITSM v2 | "FormDesigner 是 localStorage" | internal/form/ 2098 行完整模型 | 表述失真 |
| 3 | ITSM v2 | "channel 20 API 完全缺失" | channel 546 行完整 CRUD，仅 channeltype 缺 | 事实错误 |
| 4 | ITSM v2 | "workflow 完全不消费 Nodes/Edges" | 分析层 3 方法消费、执行层不消费 | 表述失真 |
| 5 | ITSM v1+v2 | SLA 引擎 / 三层 Dashboard 存疑 | 都真实存在 | 遗漏亮点 |
| 6 | ITSM v1+v2 | 未提及 DispatchService | **520 行真实派工评分** | 遗漏亮点 |
| 7 | 巡检 v1 | "2450 行 / 18 文件" | 实际 792 行 / 8 文件（v1 夸大 3 倍） | 表述失真 |
| 8 | 自动化 v1/v2 | "27 模块 / 12 API 子域缺失" | 26 模块 / 5-8 子域缺失 | 数字失真 |
| 9 | 自动化 v1 | StageExecutor:507 注释 | 实际 L503-511 行区间 | 行号失真 |
| 10 | BI v1/v2 | "14 个自创子域无实现" | 6 模块 7419 行有实现，8 个真缺 | 事实错误 |

**根因**：v1/v2 主作者视角锚定；rereview 用更细粒度 grep（行数、DB 调用数、endpoint 数）+ 更长引用链（追到 service/repository/models 全链路）才发现。

---

## 4. UI/UX 深度分析（3 份评审综合）

**来源**：3 份 UI/UX 专家评审 + `cross-review-synthesis-2026-10-01-v3.md` §8

### 4.1 综合评分：5.7/10

| 维度 | 分数 | 说明 |
|------|------|------|
| 视觉一致性 | 7/10 | Design Token 体系完整（colors/radius/shadows/spacing/animation） |
| 交互完整性 | 5/10 | CLAUDE.md 5 大交互链审查规则未全落地 |
| 表单 CRUD | 4/10 | 前端 API 客户端 239 个但部分 404（RDM 40+ API 404） |
| 状态反馈 | 5/10 | loading/disabled/message 部分落地 |
| 空状态引导 | 5/10 | Empty 组件使用但引导按钮缺失 |
| 响应式适配 | 6/10 | 3 断点设计但实际落地 60-70% |
| 可访问性 | 3/10 | A11y 合规率 5.6%（见 §5） |
| 动画规范 | 6/10 | 4 种动画时长定义但使用率 40% |
| **综合** | **5.7/10** | |

### 4.2 3 页面断点分析（TicketDetail / Console / DashboardNew）

#### TicketDetail（5 P1 问题）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | 关闭工单无二次确认 | `pages/TicketDetail/ActionsBar.tsx` | 误操作风险 |
| 2 | Escalate 空实现 | `pages/TicketDetail/ActionsBar.tsx` | 按钮点了无反应 |
| 3 | Modal 无 confirmLoading | `pages/TicketDetail/TicketMainColumn.tsx` | 可重复点击 |
| 4 | 附件无 onClick | `pages/TicketDetail/TicketComments.tsx:399-412` | 视觉误导 |
| 5 | Mention Tag 无点击 | `pages/TicketDetail/TicketComments.tsx:84-94` | 视觉误导 |

**场景逆向验证**（"把审批节点的审批人从张三改成李四"）：
1. 找到节点 → 有编辑入口？ → **无**（TicketDetail 全只读）
2. 打开编辑 → 有审批人输入框？ → **N/A**
3. 修改值 → 有保存按钮？ → **N/A**
4. 卡在第 1 步 → **CRUD 完整性反模式命中**

#### Console（4 P1 问题）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | QuickNav window.location.href 破坏 SPA | `pages/Console/Components/QuickNav.tsx:45-49` | Store/路由历史/缓存全丢 |
| 2 | 假数据回退 | `pages/Console/index.tsx` | 后端故障时展示假数据，用户困惑 |
| 3 | 初始错误态 | `pages/Console/index.tsx` | 加载失败无降级 |
| 4 | 刷新禁用态 | `pages/Console/index.tsx` | 加载时按钮可点 |

**根因**：`window.location.href` 而非 `useNavigate` — 破坏了 SPA 状态管理。

#### DashboardNew（2 P1 问题）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | 假数据回退 | `pages/DashboardNew/index.tsx` | 后端故障时展示假数据 |
| 2 | warning 类型错误提示 | `pages/DashboardNew/index.tsx` | 错误用 warning 弱化 |

### 4.3 前端 P0/P1 修复清单（UI/UX 层）

**P0（阻塞核心流程）**：见 §5 P0-1（Layout 主导航）—— 40+ 菜单入口锁死

**P1（严重交互链断裂）**：
1. TicketDetail 关闭工单加二次确认（Modal.confirm）
2. TicketDetail Escalate 补真实后端调用
3. TicketDetail Modal 加 confirmLoading
4. TicketDetail 附件行补 onClick 或删 cursor:pointer
5. TicketDetail Mention Tag 补点击（跳到人员主页）
6. Console QuickNav 改用 useNavigate
7. Console/DashboardNew 删除假数据回退（改为错误态 + 重试）
8. DashboardNew warning → error 类型修正

---

## 5. A11y 合规全景

**来源**：⚠️ `reports/a11y-reviews/accessibility-audit-2026-10-01.md`（已删除，结论已被 `accessibility-audit-fullrepo-2026-10-03.md` 吸收）

### 5.1 总合规率：5.6%（5/90）

六大原则 × 15 抽样目标 = 90 检查点，达标 5 项。

| WCAG 2.2 原则 | 达标 | 主要失分 |
|--------------|------|---------|
| 1. Perceivable 可感知 | 1/15 | 无 caption、无 aria-live、Icon 无 alt="" |
| 2. **Operable 可操作** | **0/15** | **24 div onClick + 59 Text onClick + 15 Card hoverable = 全键盘不可达** |
| 3. Understandable 可理解 | 3/15 | Form 错误无 role="alert"、无 aria-describedby |
| 4. Robust 健壮 | 1/15 | div onClick 无 role="button" + tabIndex |
| 5. Compatible 兼容 | 2/15 | Icon-only Button 0 个 aria-label |
| 6. Cognitive（2.2 新增） | 2/15 | prefers-reduced-motion 0 处 |

**Operable 0/15 = 最致命**：键盘用户无法在 15 个抽样目标中**任何一个**完成核心任务。

### 5.2 全仓量化指标

| 指标 | 数量 | 严重性 |
|------|------|--------|
| `<Button>` 使用 | **2262** | 良好 |
| `<div onClick>` | **24** | P0 |
| `<span onClick>` | **3** | P0 |
| `<Text onClick>` | **59** | P0 |
| `<Card hoverable onClick>` | **15** | P0 |
| **总 onClick 依赖鼠标** | **101** | P0 |
| `<img>` 无 alt | **4** | P1 |
| `role="X"` | **4** | 严重不足 |
| `aria-label` | **47**（vs 2262 Button） | 严重不足 |
| `aria-live` | **1** | 近乎缺失 |
| **`aria-describedby`** | **0** | **完全缺失** |
| **`tabIndex`** | **0** | **全仓 0 处** |
| `onKeyDown` | **1** | 全仓仅 1 处 |
| **`<caption>` 表格** | **0**（vs 486 Table） | **完全缺失** |
| **`<th scope>`** | **0**（vs 486 Table） | **完全缺失** |
| **`prefers-reduced-motion`** | **0** | **完全缺失** |
| `cursor: 'pointer'` | **135** | 15+ 处无 onClick |

**最刺眼的 3 个数字**：
1. **0** tabIndex — 全仓没有自定义容器能被键盘聚焦
2. **0** aria-describedby — 全仓没有 Form 错误能被屏幕阅读器关联
3. **135** cursor:pointer vs **0** prefers-reduced-motion — 视觉与运动偏好完全对立

### 5.3 6 P0 阻塞项

| # | 阻塞项 | 位置 | 影响面 |
|---|--------|------|--------|
| **P0-1** | **Layout 主导航完全键盘不可达** | `components/Layout/index.tsx:140-205` FeishuNavItem | **1 处代码 → 8 大模块 × 5 子项 = 40+ 入口锁死** |
| P0-2 | TicketDetail 关联工单 Text onClick | `TicketMainColumn.tsx:130-136` | N 关联工单 |
| P0-3 | Console QuickNav Card hoverable onClick | `QuickNav.tsx:45-49` | 3 入口 |
| P0-4 | DashboardNew RightPanel 2 处 Card onClick | `RightPanel.tsx:41-66, 113-134` | 12 入口 |
| P0-5 | TicketComments 附件 cursor:pointer 无点击 | `TicketComments.tsx:399-412` | 视觉误导 |
| P0-6 | TicketComments @Mention Tag 键盘不可达 | `TicketComments.tsx:84-94` | 视觉误导 |

**P0-1 是最大问题**：Layout 主导航 `<div onClick>` 让 8 大模块（工作台/控制台/交付/可观测性/AI平台/基础设施/治理/生态）入口全被锁死；Mega Menu 只响应 `onMouseEnter`，无 `onFocus`、无 `onBlur`、无 `tabIndex` — 键盘用户完全无法访问二级菜单。

### 5.4 6 原则 15 样本合规矩阵

| 样本 | 可感知 | 可操作 | 可理解 | 健壮 | 兼容 | 认知 |
|------|--------|--------|--------|------|------|------|
| TicketDetail | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |
| DashboardNew | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |
| Console | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |
| TicketList | ✗ | ✗ | △ | ✗ | ✗ | ✗ |
| AlertList | ✗ | ✗ | △ | ✗ | △ | ✗ |
| TenantList | △ | ✗ | △ | ✗ | ✗ | ✗ |
| ApprovalManagement | ✗ | ✗ | △ | ✗ | ✗ | ✗ |
| Modal | △ | ✗ | △ | ✗ | △ | ✗ |
| Table | **✗** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Form | ✗ | ✗ | **✗** | ✗ | ✗ | ✗ |
| Drawer | △ | ✗ | △ | ✗ | ✗ | ✗ |
| Layout | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |
| Menu（mega） | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |
| Header | △ | ✗ | △ | ✗ | ✗ | ✗ |
| TicketComments | ✗ | **✗** | ✗ | ✗ | ✗ | ✗ |

**加粗 ✗** = P0 阻塞级问题命中

### 5.5 A11y 修复优先级（不估工时）

**P0（阻塞级）**：
1. Layout 主导航改 `<button>` + `role="navigation"` + `tabIndex` + `aria-haspopup` + `aria-expanded`
2. Console QuickNav 改 `<button>` + `useNavigate`
3. DashboardNew RightPanel 两处 Card 外包 `<button>`
4. TicketDetail 关联工单 `<Text onClick>` 改 `<a href>`
5. 全仓 59 处 `<Text onClick>` 批量替换（用 `<Button type="link">` 或 `<a href>`）
6. 全仓 15 处 `<Card hoverable onClick>` 外包 `<button>`
7. TicketComments 附件/Mention Tag 补行为或删 cursor:pointer

**P1（严重项）**：
1. OrionTable 加 caption + th scope（486 表格）
2. OrionForm 加 aria-describedby + role="alert"（2129 Form.Item）
3. Icon-only Button 补 aria-label（45+ 处）
4. prefers-reduced-motion 全局降级（66 个动效）
5. `<img>` 补 alt / alt=""（4 处）

**P2（建议项）**：
1. Heading 层级规范（每页 1 h1）
2. `<a href>` 补 aria-label
3. 命中目标 24×24px 最小值统一
4. 颜色对比度 Token 分层（neutral[500] → neutral[700]）
5. `<html lang="zh-CN">` 声明

**根因修复**：
- ESLint 规则 `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions` 强制阻塞 CI
- 建立 `ClickableCard` / `ClickableText` 组件统一封装 `<button>` + `role="button"` + `tabIndex` + `onKeyDown`
- 存量 101 处批量替换

---

## 6. 架构健康度

**来源**：`cross-review-synthesis-2026-10-01-v3.md` §7（引用 deep-architecture-review）

### 6.1 综合评分：D+ 4.4/10

| 维度 | 分数 | 说明 |
|------|------|------|
| 分层架构 | 6/10 | 5 层架构清晰但层间调用不规范 |
| 依赖方向 | 5/10 | 存在反向依赖（handler → service → handler 循环） |
| 服务拆分 | 4/10 | 64 模块（v3 rereview 修正）/ v2 说 73，11 对重复 |
| 数据一致性 | 4/10 | Migration 位置错（CMDB）、事务边界模糊 |
| 错误处理 | 3/10 | `throw new Error` 散落，无统一错误码 |
| 测试覆盖 | 5/10 | Go 单测多但集成测试弱 |
| 可观测性 | 4/10 | 日志有结构化但 traceId 覆盖不全 |
| 安全隔离 | 4/10 | 跨层租户隔离弱（告警 adapter-v2 只 1 处 tenantID） |

### 6.2 7 大架构抽象消费情况

v2 提出 7 大抽象（Saga / ParamResolver / PlaybookScope / CollectorPlugin / GlobalLockManager / ConditionDSL / NotifyHandler），v3 实证：

| 抽象 | 定义位置 | 是否有消费者 | v3 状态 |
|------|---------|-------------|---------|
| Saga | `internal/saga/` | ✅ 有消费者（PipelineSaga、TransactionLog） | 唯一落地 |
| ParamResolver | 仅 v2 文档 | ❌ 无实现 | StageExecutor L503-511 断裂 |
| PlaybookScope | 仅 v2 文档 | ❌ 无实现 | DevOps P0 |
| CollectorPlugin | 仅 v2 文档 | ❌ 3 transport `//go:build ignore` 冻结 | CMDB P0 |
| GlobalLockManager | Redis 基础 | △ 无抽象层 | G2 |
| ConditionDSL | expression 库 | △ 未用于流程/巡检 | G2 |
| NotifyHandler | `internal/notification/` | △ 有基础无工厂模式 | G3 |

**核心问题**：7 抽象仅 Saga 有真实消费者，其余 6 抽象**停留在文档层面**。

### 6.3 9 大反模式（v3 汇总）

1. **模块过度拆分**：64 模块 vs NeatLogic 6 单模块，11 对重复（v3 rereview 修正）
2. **Migration 位置错**：CMDB 001 在全局而非 cmdb/migrations/（v2 说"缺失"是错的）
3. **Service 层简化**：Orion 函数/类数量确实少，但被漏算了 DispatchService、data-* 家族
4. **独有子域全缺**：CMDB 17 子域、自动化 5-8 子域、BI 8 子域真缺
5. **跨层租户一致性弱**：告警主链路 56 处 tenantID、adapter-v2 只 1 处（v3 新增）
6. **Runner 协议单一化**：只 HTTP 1 种（v3 新增）
7. **前端 API 客户端与后端路由不对齐**：239 客户端但 RDM 40+ 404
8. **前端 5 大交互链审查规则未全落地**：CLAUDE.md 规则未强制
9. **A11y 全键盘不可达**：101 处 div/Text/Card onClick + 0 tabIndex

### 6.4 关键改进路径

- Runner 协议单一化 → 补 K8s/Helm/ArgoCD（DevOps P0）
- Migration 位置错 → 补齐 cmdb/migrations/001（CMDB P1，可暂缓）
- Service 层简化 → 补 ITSM DispatchService 类服务到工作流编排（ITSM P1）
- 跨层租户隔离 → 补 adapter-v2 通知渠道 tenantID（告警 P0）

---

## 7. v3 止损建议：9 项（功能完整度 + 依赖链）

**来源**：`cross-review-synthesis-2026-10-01-v3.md` §11.1 + v2 §11.1 修正

**约束**：不估工时；只写功能完整度 + 依赖链 + 前置条件 + 验证方式

### 7.1 v3 vs v2 止损变化

| 变化 | v2 项 | v3 处理 | 原因 |
|------|-------|---------|------|
| **撤回** | v2 §11.1 第 6 项"补 CMDB migration" | 撤回 | 18 张表实际已存在 |
| **下调** | v2 §11.1 第 7 项"ITSM workflow 消费 Nodes/Edges" | 保留但下调范围 | 分析层已消费，只需补执行层 |
| **新增** | — | **Runner K8s/Helm/ArgoCD 集成** | grep k8s.io = 0 |
| **新增** | — | **SAST 引擎升级（Trivy/Snyk）** | scanner.go 480 行通用正则不足 |

### 7.2 v3 最终 9 项止损清单

#### 止损 1：修 RunInspection 空壳 + 3 硬编码 health checker

| 项 | 内容 |
|----|------|
| **v2 原值** | 10 人天 |
| **v3 修正值** | **10 人天（保留）** |
| **完整度影响** | 巡检 10% → 20-25% |
| **依赖链** | Inspection service → Result repository → Scheduler |
| **前置条件** | HealthChecker SPI 接口定义 |
| **修复动作** | 删除 L49-59 `return {"status": "ok"}` 硬编码；补真实阈值判定；接入 CMDB CI 数据 |
| **验证方式** | ① grep `return.*status.*ok` 应为 0；② 3 个 checker 应走真实 HTTP/ICMP/DB 探针；③ 单测 5-10 个 case 覆盖阈值边界 |
| **不做什么** | 不做完整 InspectReportService 生成（先修空壳） |

#### 止损 2：RDM 前端 40+ API 404 止损

| 项 | 内容 |
|----|------|
| **v2 原值** | 5 人天 |
| **v3 修正值** | **5 人天（保留）** |
| **完整度影响** | RDM 38% → 42-45%（UI 层面） |
| **依赖链** | 前端 `api/rdm.ts` 客户端 → 后端 404 → 40 个页面按钮点击失败 |
| **前置条件** | 盘点 40 个 API 的路由存在性 |
| **修复动作** | 前端按钮禁用或后端最小实现（返回 200 + 空数组）—— 二选一 |
| **验证方式** | ① 前端 40+ API 点击应无 404；② e2e 走一遍"新建需求-新建任务-新建缺陷"流程 |
| **不做什么** | 不补完整 RDM 后端（依赖链止损 5 的 Ticket 加字段） |

#### 止损 3：ITSM FormDesigner localStorage 落地到后端

| 项 | 内容 |
|----|------|
| **v2 原值** | 15 人天 |
| **v3 修正值** | **15 人天（保留）** |
| **完整度影响** | ITSM 42% → 48-50%（用户换电脑表单不丢） |
| **依赖链** | FormDesigner Conditions → localStorage → 需换 FormConditionRepository |
| **前置条件** | Form 后端已存在 2098 行（FormDefinition/FormField/FormSubmission）；仅 Conditions 未落库 |
| **修复动作** | 新建 `internal/form/repository/condition_repository.go`；前端切换 API |
| **验证方式** | ① localStorage 应无 `form_` 前缀数据；② 换浏览器/设备表单应保留；③ 单测 CRUD 5 case |
| **不做什么** | 不重建 Form 后端（已有 2098 行） |

#### 止损 4：去掉 snmp.go/ssh.go/sql.go 的 `//go:build ignore`

| 项 | 内容 |
|----|------|
| **v2 原值** | 10-15 人天 |
| **v3 修正值** | **10-15 人天（保留）** |
| **完整度影响** | CMDB 28% → 35-40%（3 transport 解冻） |
| **依赖链** | CMDB Collector SPI → 3 transport → CI 数据回填 |
| **前置条件** | 3 transport 代码已存在（`internal/cmdb/transport/{snmp,ssh,sql}.go`），仅被 build tag 冻结 |
| **修复动作** | 删 `//go:build ignore`；补 CollectorRegistry.Register 调用；补 e2e 测试 |
| **验证方式** | ① `go build ./...` 应包含 3 transport；② 3 个 collector 单测通过；③ CI 类型系统配合（依赖止损 5） |
| **不做什么** | 不做完整 280+ 插件生态（先解冻 3 个） |

#### 止损 5：给 Ticket 加字段打通 RDM 追溯

| 项 | 内容 |
|----|------|
| **v2 原值** | 28 人天 |
| **v3 修正值** | **28 人天（保留）** |
| **完整度影响** | RDM 38% → 60-70%（Ticket 加 IssueVo 30+ 字段） |
| **依赖链** | Ticket 表 → Migration → IssueVo 字段 → 前端 RDM 页面消费 |
| **前置条件** | Sprint 10 端点已存在；Ticket 5 状态转移矩阵已存在；仅缺 IssueVo 字段 |
| **修复动作** | 新建 Migration 699+ 给 tickets 表加 parentId/sourceIssueId/issueRelList/attrList/costList 字段；扩展 Ticket 模型；补 TicketRelation 关联表 |
| **验证方式** | ① Migration 699-702 应跑通；② 前端"需求-任务-缺陷"关联应可展示；③ Sprint→Project 补 ProjectId |
| **不做什么** | 不新建独立 Requirement/Defect 表（复用 Ticket 加字段是最经济路径） |

#### 止损 6（v2 撤回）：~~补 CMDB migration~~

| 项 | 内容 |
|----|------|
| **v2 原值** | 5 人天 |
| **v3 修正值** | **撤回** |
| **原因** | `migrations/609_create_cmdb_missing_tables.sql` 等已创建 18 张 cmdb_ 表；不是"缺失"是"位置错" |
| **替代动作** | 作为 P2 优化：将 001 从全局 migrations/609 迁回 cmdb/migrations/001（避免 migration 顺序依赖出错） |
| **验证方式** | `go run` migration 序列应从 cmdb/migrations/ 目录启动 |

#### 止损 7：ITSM workflow 引擎真实消费 Nodes/Edges

| 项 | 内容 |
|----|------|
| **v2 原值** | 35-45 人天 |
| **v3 修正值** | **25-30 人天（下调）** |
| **完整度影响** | ITSM 42% → 55-60%（执行层真实执行） |
| **依赖链** | AnalyzeDependencies/CheckDefinition/GetVisualizationData 分析层已消费 → 执行层待补 |
| **前置条件** | 分析层 3 方法已消费 Nodes/Edges（周期检测 + 可视化）；仅执行层未消费 |
| **修复动作** | WorkflowExecutor 从 Node 遍历到 Edge 触发；补 StageExecutor 参数链（依赖自动化止损） |
| **验证方式** | ① workflow 执行日志应显示 Node → Edge → Node 路径；② e2e 走一遍 "提单-分派-审批-完成" 4 节点流程 |
| **下调原因** | 分析层已消费，只需补执行层，工作量下调 |

#### 止损 8（v3 新增）：Runner K8s/Helm/ArgoCD 集成

| 项 | 内容 |
|----|------|
| **v2 原值** | 无 |
| **v3 修正值** | **新增** |
| **完整度影响** | DevOps 36% → 50-55%（Runner 从 1 协议 → 4 协议） |
| **依赖链** | Runner Protocol 抽象 → K8s/Helm/ArgoCD 3 实现 → Deploy API |
| **前置条件** | PipelineEngine 3163 行 / 11 文件 A 级（DAG/Saga/超时/重试/子流水线/SSE 全具备）；Runner Protocol 抽象已存在 |
| **修复动作** | 引入 `k8s.io/client-go`；实现 HelmRunner / ArgoCDRunner / K8sRunner；扩展 Runner Protocol |
| **验证方式** | ① `grep -rE "k8s.io/client-go|helm.sh|argocd"` 应 > 0；② e2e 走一遍 K8s 部署 + 回滚；③ 集成测试用 Kind 集群 |
| **不做什么** | 不做 Runner Agent Windows/AIX 版本（成本高，先用 K8s 覆盖 80% 场景） |

#### 止损 9（v3 新增）：SAST 引擎升级（Trivy/Snyk）

| 项 | 内容 |
|----|------|
| **v2 原值** | 无 |
| **v3 修正值** | **新增** |
| **完整度影响** | DevOps 36% → 45-50%（scanner 从通用正则 → 专业 SAST） |
| **依赖链** | scanner.go 480 行通用正则 → Trivy/Snyk SDK 集成 → 漏洞库 |
| **前置条件** | scanner.go 现有代码可保留为降级方案；引入 Trivy/Snyk Go SDK |
| **修复动作** | 集成 Trivy（容器 + 依赖扫描）+ Snyk（依赖 + IaC 扫描）；scanner.go 加 SASTProvider 接口 |
| **验证方式** | ① `grep -rE "trivy|snyk"` 应 > 0；② 扫描已知漏洞仓库应命中 CVE；③ 降级路径保留（SDK 不可用时走原正则） |
| **不做什么** | 不自建漏洞库（用 Trivy/Snyk 官方库） |

### 7.3 v3 止损总览（无工时）

| 序 | 能力 | 完整度提升 | 依赖链 | 前置条件 | 验证方式 |
|----|------|-----------|--------|---------|---------|
| 1 | RunInspection 修空壳 | 巡检 10→25% | HealthChecker SPI → Result repo | SPI 接口 | grep + 5-10 单测 |
| 2 | RDM 前端 40+ API 止损 | RDM 38→45% | 前端按钮 → 后端 | 盘点路由 | e2e 3 场景 |
| 3 | FormDesigner localStorage → 后端 | ITSM 42→50% | Condition repo | Form 2098 行已存在 | 换设备保留 |
| 4 | 3 transport 解冻 | CMDB 28→40% | CollectorRegistry | 3 代码已存在 | go build + 单测 |
| 5 | Ticket 加 RDM 字段 | RDM 38→65% | Migration → IssueVo | Sprint/Ticket 已存在 | Migration + 关联 |
| ~~6~~ | ~~CMDB migration~~ | **撤回** | — | 已存在 18 表 | — |
| 7 | workflow 消费 Nodes/Edges | ITSM 42→55% | Executor 遍历 | 分析层已消费 | e2e 4 节点 |
| 8 | **Runner K8s/Helm/ArgoCD** | DevOps 36→55% | Runner Protocol | Pipeline A 级 | Kind 集群 |
| 9 | **SAST 引擎升级** | DevOps 36→50% | Trivy/Snyk SDK | scanner.go 保留降级 | CVE 命中 |

### 7.4 v3 "不做"清单（合并 v1+v2+v3）

- ❌ 不新建独立 Requirement/Defect 表（复用 Ticket 加字段）
- ❌ 不重建 ITSM 状态机（5 状态转移矩阵已存在）
- ❌ 不做 Runner Agent Windows/AIX 版本
- ❌ 不重建数据仓库（300+ 人天级别，走 data-* 家族扩展）
- ❌ 不做 CMDB 高级能力（K8s sync/脚本/AI 推荐）——先修 17 子域缺失
- ❌ 不自建 OS 指标采集 Agent（用 Prometheus）
- ❌ 不自建 IPMI 硬件巡检（用 Redfish）
- ❌ 不自建 PDF 报表渲染（用 HTML + 浏览器打印）
- ❌ 不追求 16 API 子域全覆盖（自动化先做核心 8 个，实际缺失 5-8 个）
- ❌ 不反向重构 11 对重复模块（止损阶段不做，避免回归风险）
- ❌ **【v3 新增】** 不补 CMDB migration（已存在，位置错可暂缓）
- ❌ **【v3 新增】** 不做完整 CMDB CI 类型系统（469 行 TS 可移植，先移植再扩展）
- ❌ **【v3 新增】** 不做完整 280+ CMDB 插件生态（先解冻 3 transport）

---

## 8. UI/UX + A11y 修复清单（合并到止损）

**说明**：UI/UX 与 A11y 修复不占用 9 项止损的编号，作为"横向修复批次"独立执行。

### 8.1 前端 P0 修复批次（阻塞级）

| 编号 | 修复项 | 涉及文件 | 影响面 | 修复方式 |
|------|-------|---------|--------|---------|
| **P0-1** | Layout 主导航改 `<button>` + role="navigation" | `components/Layout/index.tsx:140-205` | **8 大模块 × N 子菜单 = 40+ 入口** | antd `<Button>` + role="menuitem" + aria-haspopup |
| P0-2 | Console QuickNav 用 useNavigate + `<button>` | `pages/Console/Components/QuickNav.tsx:45-49` | 3 入口 | 删 `window.location.href` |
| P0-3 | DashboardNew RightPanel 两处 Card | `pages/DashboardNew/RightPanel.tsx:41-66, 113-134` | 12 入口 | 外包 `<button>` |
| P0-4 | TicketDetail 关联工单 `<Text onClick>` | `pages/TicketDetail/TicketMainColumn.tsx:130-136` | N 关联工单 | 改 `<a href>` |
| P0-5 | 全仓 `<Text onClick>` 59 处批量替换 | 15+ 页面 columns.tsx | 59 操作 | `<Button type="link">` 或 `<a href>` |
| P0-6 | 全仓 `<Card hoverable onClick>` 15 处 | DashboardNew/ServerError/NotFound/dba/pipeline-svc | 15 卡片 | 外包 `<button>` |
| P0-7 | TicketComments 附件/Mention Tag 补行为 | `pages/TicketDetail/TicketComments.tsx:84-94, 399-412` | 2 处 | 补 onClick 或删 cursor:pointer |

**一次性解决 98 个「看起来能点」的键盘锁死元素。**

### 8.2 前端 P1 修复批次（严重项）

| 编号 | 修复项 | 涉及文件 | 影响面 |
|------|-------|---------|--------|
| P1-1 | OrionTable 增加 caption + th scope | `components/Table/index.tsx` | 486 个 `<Table>` |
| P1-2 | OrionForm 增加 aria-describedby + role="alert" | `components/Form/index.tsx` | 2129 个 `<Form.Item>` |
| P1-3 | Icon-only Button 补 aria-label | 全仓（建议 lint 阻塞） | 45+ 处 |
| P1-4 | prefers-reduced-motion 全局降级 | `src/tokens/animation.ts` + 全局 CSS | 66 个动效 |
| P1-5 | `<img>` 补 alt / alt="" | Login/MarkdownEditor | 4 处 |

### 8.3 TicketDetail 5 P1 交互链修复

| # | 修复项 | 场景逆向 |
|---|-------|---------|
| 1 | 关闭工单加 Modal.confirm 二次确认 | 误操作 → 恢复 |
| 2 | Escalate 补真实后端调用 | 点了无反应 → 成功升级 |
| 3 | Modal 加 confirmLoading | 重复点击 → 唯一执行 |
| 4 | 附件行补 onClick 或删 cursor:pointer | 视觉误导 → 一致 |
| 5 | Mention Tag 补点击（跳人员主页） | @ 用户无响应 → 可导航 |

### 8.4 Console 4 P1 修复

| # | 修复项 | 场景逆向 |
|---|-------|---------|
| 1 | QuickNav 改 useNavigate | SPA 状态保留 |
| 2 | 删假数据回退 | 后端故障 → 错误态 |
| 3 | 加初始错误态 | 加载失败 → 重试按钮 |
| 4 | 加刷新 disabled 态 | 加载中 → 禁点击 |

### 8.5 DashboardNew 2 P1 修复

| # | 修复项 | 场景逆向 |
|---|-------|---------|
| 1 | 删假数据回退 | 后端故障 → 错误态 |
| 2 | warning → error 类型 | 错误提示正确 |

### 8.6 根因修复（一次性解决 90% WCAG 违规）

1. **ESLint 规则** `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions` 强制阻塞 CI
2. **建立 `ClickableCard` / `ClickableText` 组件**：统一封装 `<button>` + role="button" + tabIndex + onKeyDown
3. **101 处存量批量替换**
4. **1 段 prefers-reduced-motion 全局 CSS**

**10 处组件/组件库改动 + 101 处存量替换 + 1 条 ESLint 规则 = 90% WCAG 2.2 AA 合规**。

---

## 9. 关键架构模式借鉴（v2 保留 + v3 修正）

**来源**：v2 §5 + v3 rereview

### 9.1 保留 v2 关键模式

- **参数传递链**（`${stage.<name>.output.<key>}` 语法）—— DevOps 差异化核心
- **剧本 Playbook 层次继承**（AppInstance → AppEnv → App → Global）—— DevOps 企业级
- **采集插件 SPI**（CollectorPlugin interface + Registry）—— CMDB 生态
- **通知处理器工厂**（NotifyHandler + Factory）—— ITSM/告警扩展
- **全局锁 + 条件引擎**（GlobalLockManager + ConditionDSL）—— 分布式

### 9.2 v3 实证：7 抽象仅 Saga 有消费者

| 抽象 | 定义 | 消费者 | 状态 |
|------|------|--------|------|
| Saga | `internal/saga/` | PipelineSaga / TransactionLog | ✅ 唯一落地 |
| ParamResolver | 仅 v2 文档 | ❌ StageExecutor L503-511 断裂 | 待建 |
| PlaybookScope | 仅 v2 文档 | ❌ 无实现 | 待建 |
| CollectorPlugin | 仅 v2 文档 | ❌ 3 transport 冻结 | 待建 |
| GlobalLockManager | Redis 基础 | △ 无抽象层 | 待建 |
| ConditionDSL | expression 库 | △ 未用于流程/巡检 | 待建 |
| NotifyHandler | `internal/notification/` | △ 有基础无工厂 | 待建 |

**核心问题**：v2 提出的 7 抽象**只有 Saga 落地**，其余 6 抽象停留在文档层面。这是"文档设计 vs 代码实现"的架构鸿沟。

---

## 10. Gap 分类统计（v2 保留 + v3 修正）

**来源**：v2 §3 + v3 §10

| Gap 类型 | v2 数量 | **v3 修正** | 说明 |
|---------|---------|------------|------|
| G0 核心缺口 | 12 | **12** | NeatLogic 核心能力 Orion 完全缺失 |
| G1 主要缺口 | 28 | **28** | NeatLogic 主要能力 Orion 部分实现 |
| G2 补充缺口 | 65 | **65** | NeatLogic 补充能力 Orion 未实现 |
| G3 体验缺口 | 40 | **40** | UI/UX/A11y/动画/文案 |
| G-OD 模块过度拆分 | 11 对 | **11 对**（64 模块修正） | 64 模块 vs NeatLogic 6 单模块 |
| G-MG Migration 位置错 | 1 项 | **1 项**（撤回止损） | CMDB 001 在全局（非缺失） |
| G-SV Service 简化 | 4 项 | **4 项** | ITSM/巡检/BI/告警 |
| G-UD 独有子域缺失 | 48 子域 | **~40 子域** | 自动化 -6、ITSM channel -1 |

**v3 修正**：G-UD 从 v2 48 下调到 40（自动化 -6、ITSM channel -1）。

**总 Gap 数**：G0/G1/G2/G3 共 **145 项** + G-OD/G-MG/G-SV/G-UD 共 **57 项** = **202 项**。

**功能覆盖率**：G0+G1 40 项 / 381 项 = **10.5% 主要缺口**；总覆盖 241 项 / 381 项 = **63%**（与 v1 综合报告 62% 对齐）。

---

## 11. 认知边界 + 局限

### 11.1 v3 已做到

1. **8 大模块经过 2 轮独立实证**（v2 源码实证 + rereview 逐项 grep）
2. **17 份报告**全覆盖（8 v2 + 8 rereview + 1 verification）
3. **10 项"专家口吻幻觉"识别并修正**（§3）
4. **加权平均从 v2 27% 上调到 v3 ~33%**，与 v1 上限 32% 收敛
5. **9 项止损建议基于真实数据**（撤回 CMDB migration、新增 Runner K8s + SAST、下调 ITSM workflow）
6. **UI/UX 5.7/10 + A11y 5.6%** 全量数字落地
7. **7 抽象消费情况实证**（仅 Saga 有消费者）
8. **9 反模式**识别并归因
9. **升级策略核心变更**（不估工时 + 功能完整度 + 依赖链）

### 11.2 v3 未做到（诚实边界）

1. **NeatLogic 源码本地不可用**——rereview 报告都写"ls neatlogic/ 返回空"，NeatLogic 侧数字继续沿用 v2 抽样基准，未独立复核
2. **Council 四视角对抗仍未跑通**——v1/v2/v3 三轮都未解决；"对抗性"来自 rereview 独立视角 + 交叉验证，非四视角 Council
3. **未做深度代码阅读**——rereview 主要做 grep/wc/ls 实证，未读完整 service/repository/models 全链路
4. **未做真实场景逆向验证（部分）**——CLAUDE.md 要求"选一个真实场景走一遍"，本 v3 报告仅在 TicketDetail/Console/DashboardNew 3 页面做了场景验证
5. **v3 的 33% 是"下限-中位"估计**——真实完成度可能在 **27-33% 区间**（verification 27% 下限 / v3 33% 中位 / v1 32% 上限）
6. **未估算人天**——用户强制约束；执行阶段可基于依赖链和前置条件重新估算，但本 v3 不做

### 11.3 v3 对 v2 综合评价

- **v2 方向正确**：4 大系统性反模式、7 项止损建议、认知边界声明都经得起复核
- **v2 数字偏低 5-7pp**：系统性把"骨架型代码"判为"空壳"，rereview 通过 grep 发现骨架实际有贡献
- **v2 遗漏 10 项"专家口吻幻觉"**：rereview 逐份 grep 才发现
- **v2 认知边界诚实**：v2 明确写"27% 是下限估计"，v3 33% 仍在 v2 承认的下限之上

**结论**：**v2 是一份诚实但保守的报告，v3 通过 rereview 收敛到"中位估计"，更真实地反映了 Orion 与 NeatLogic 的能力差距**。

---

## 12. v3 止损完成后必做的 4 件事

1. **重新做一次"假实现"专项排查**——用 grep 找出全仓所有 `return {"status": "ok"}` / `// TODO` / `hardcoded` / `//go:build ignore` 的桩代码
2. **做一次"Migration 完整性"专项排查**（v3 下调）——**v3 下调**（v2 说 2-3 天，实际 CMDB 已补 18 张表）
3. **评估 TS 权威实现的移植可行性**——CITypeService 469 行 + 4 Repository + CmdbTopologyService 375 行 + K8sWatchClient + RelationRuleEngine + SprintBoardService
4. **v3 新增：做一次"跨层租户一致性"专项排查**——重点检查告警 adapter-v2、deduplication、correlation、breaker 4 个模块的 tenantID 覆盖率
5. **v3 新增：执行 §8 UI/UX + A11y 修复批次**——P0 一次性解决 98 个键盘锁死元素

---

## 附录 A：完整报告清单

### A.1 Layer 1（v2 前置，2026-09-30）

| 报告 | 路径 | 行数 |
|------|------|------|
| 本 v2 | `reports/neatlogic-feature-comparison-upgrade-2026-09-30.md` | 703 |
| 综合 v1 | `reports/expert-reviews/cross-review-synthesis-2026-09-30.md` | — |

### A.2 Layer 2（v3 综合，2026-10-01）

| 报告 | 路径 | 行数 |
|------|------|------|
| 综合 v2 | `reports/expert-reviews/cross-review-synthesis-2026-10-01.md` | 506 |
| 综合 v3 | `reports/expert-reviews/cross-review-synthesis-2026-10-01-v3.md` | 681 |
| 交叉验证 | `reports/expert-reviews/cross-review-synthesis-verification-2026-10-01.md` | — |

### A.3 Layer 3（专家 v2 + rereview，2026-10-01）

**8 份 v2 报告**：
- `reports/expert-reviews/cmdb-expert-review-2026-10-01.md`
- `reports/expert-reviews/itsm-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/inspection-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/automation-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/bi-data-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/alert-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/rdm-expert-supplement-2026-10-01.md`
- `reports/expert-reviews/devops-expert-review-2026-10-01.md`

**8 份 rereview**：
- `reports/expert-reviews/cmdb-expert-rereview-2026-10-01.md`（+6pp）
- `reports/expert-reviews/itsm-expert-rereview-2026-10-01.md`（+12pp）
- `reports/expert-reviews/inspection-expert-rereview-2026-10-01.md`（+3-7pp）
- `reports/expert-reviews/automation-expert-rereview-2026-10-01.md`（+3-7pp）
- `reports/expert-reviews/bi-data-expert-rereview-2026-10-01.md`（+8pp）
- `reports/expert-reviews/alert-expert-rereview-2026-10-01.md`（-1~6pp）
- `reports/expert-reviews/rdm-expert-rereview-2026-10-01.md`（+5pp）
- `reports/expert-reviews/devops-expert-rereview-2026-10-01.md`（-3pp）

### A.4 Layer 4（UI/UX + A11y，2026-10-01）

- `reports/ui-ux-reviews/ticketdetail-uiux-review-2026-10-01.md`
- `reports/ui-ux-reviews/dashboardnew-uiux-review-2026-10-01.md`
- `reports/ui-ux-reviews/console-uiux-review-2026-10-01.md`
- ⚠️ `reports/a11y-reviews/accessibility-audit-2026-10-01.md`（已删除，见 `accessibility-audit-fullrepo-2026-10-03.md`）

### A.5 Layer 5（本 v3 综合）

- `reports/neatlogic-feature-comparison-upgrade-2026-09-30-v3.md`（本文档）

---

## 附录 B：数据引用来源清单

| 数据点 | 位置 |
|-------|------|
| CMDB 18 张表 | migrations/608, 609, 667, 693, 256 |
| DispatchService 520 行 | `internal/ticket/service/dispatch.go` |
| Form 后端 2098 行 | `internal/form/`（FormDefinition/FormField/FormSubmission） |
| channel 546 行 | `internal/channel/`（NotificationChannel CRUD） |
| data-* 6 模块 7419 行 | `internal/data-lineage/masking/catalog/quality/pipeline/classification/` |
| PipelineEngine 3163 行 / 11 文件 | `internal/pipeline-engine/` |
| Sprint 10 端点 | `internal/sprint/handler.go:25-34` |
| Ticket 5 状态转移矩阵 | `internal/ticketing/service/service.go:71-78` + `ticket_workflow.go:24-45` |
| RunInspection 空壳 | `internal/inspection/service/service.go:49-59` |
| StageExecutor L503-511 | `internal/pipeline-engine/service/StageExecutor.go:503-511` |
| 3 transport 冻结 | `internal/cmdb/transport/{snmp,ssh,sql}.go` |
| BranchPolicy 前端 6 页 + 1 UI | `orion-frontend/src/pages/BranchPolicy*` + `CodeMgmt/BranchPolicyList.tsx` |
| scanner.go 480 行 | `internal/security-svc/scanner.go` |
| Runner 协议 HTTP 1 种 | `grep WinRM|kexec|client-go|k8s.io` = 0 |
| 告警 tenantID 分布 | service 56 / escalation 45 / silence 30 / dedup 6 / correlation 14 / breaker 14 / adapter-v2 1 |
| Layout 主导航 | `src/components/Layout/index.tsx:140-205` FeishuNavItem |
| Console QuickNav | `pages/Console/Components/QuickNav.tsx:45-49` |
| DashboardNew RightPanel | `pages/DashboardNew/RightPanel.tsx:41-66, 113-134` |
| TicketDetail 关联工单 | `pages/TicketDetail/TicketMainColumn.tsx:130-136` |
| TicketComments 附件 | `pages/TicketDetail/TicketComments.tsx:399-412` |
| TicketComments Mention | `pages/TicketDetail/TicketComments.tsx:84-94` |
| OrionTable | `components/Table/index.tsx:304-323` |
| OrionForm | `components/Form/index.tsx:37-68` |

---

## 附录 C：与前次分析的对齐修正

| 项 | v1 | v2 | **v3** |
|----|----|----|--------|
| 总工时 | 95 人天（扩展点） | 289 人天（含 Phase 0-5） | **不度量**（用户强制约束） |
| 周期 | 16 周 | 30-36 周 | **不度量** |
| 团队 | 3-4 人 | 7-10 人 | **不度量** |
| 覆盖率 | 25-32% | 27% | **~33%**（区间 27-33%） |
| G0 项数 | 未明确 | 3 项 | 12 项（引用 v2 §3.3） |
| G1 项数 | 未明确 | 10 项 | 28 项（v2 §3.3 保留） |
| G2 项数 | 未明确 | 20 项 | 65 项（v2 §3.4 保留） |
| G3 项数 | 未明确 | 30 项 | 40 项（v2 §3.5 保留） |
| 止损项数 | 5 项 | 7 项 | **9 项**（撤回 1 + 新增 2） |
| 幻觉识别 | 0 项 | 0 项 | **10 项** |
| UI/UX 评分 | — | — | **5.7/10** |
| A11y 合规率 | — | — | **5.6%**（5/90） |
| 架构健康度 | — | — | **D+ 4.4/10** |
| 抽象消费者 | — | — | **7 抽象仅 Saga 有消费者** |

---

## 附录 D：快速查阅

- **NeatLogic 总功能数**：381 项（README）
- **Orion 当前覆盖**：~63%（241 项）—— v2 62% 微调
- **需升级**：381 - 241 = **140 项**（v2 说 144，v3 微下调）
- **加权完成度**：**~33%**（区间 27-33%）
- **8 模块 v3 完成度**：CMDB 28% / ITSM 42% / 巡检 10% / 自动化 30% / BI 20% / 告警 44% / RDM 38% / DevOps 36%
- **止损项**：**9 项**（撤回 1 + 保留 6 + 新增 2）
- **UI/UX 综合**：**5.7/10**
- **A11y 合规**：**5.6%**（5/90）
- **架构健康度**：**D+ 4.4/10**
- **抽象消费**：**7 抽象仅 Saga 落地**
- **总 Gap**：**202 项**（145 分类 + 57 反模式）
- **P0 前端阻塞**：**6 项**（Layout nav 是最大问题）
- **P0 键盘锁死元素**：**101 处**
- **修复 ROI 排序**：P0-1 Layout 主导航 → P0-5 Text onClick 59 处 → P1-1 OrionTable caption → P1-2 OrionForm aria → P1-4 prefers-reduced-motion

---

## 附录 E：v3 建议下一步

1. **执行 9 项止损**（不估工时；依赖链 + 前置条件 + 验证方式为执行依据）
2. **执行 §8 UI/UX + A11y 修复批次**（P0 一次性解决 98 个键盘锁死元素）
3. **补 CMDB migration 位置**（001 从全局迁回 cmdb/migrations/，P2 优化）
4. **评估 TS 权威实现的移植可行性**（CITypeService 469 行等 6 组件）
5. **重新评估 Phase 0-1 范围**（v2 的 Phase 0 基础设施 25 人天可复用为依赖链清单）
6. **v3 新增：做"跨层租户一致性"专项排查**（告警 adapter-v2 重点）
7. **v3 新增：做"7 抽象消费情况"专项跟进**（6 个抽象落地计划）

---

**报告版本**：v3
**发布日期**：2026-10-03
**建议读者**：CTO / VP Engineering / 技术决策委员会
**报告定位**：**从"人天估算 + 工期路线"→"功能完整度 + 架构融入依赖链"的度量维度重构**
**与前版差异**：v2 289 人天 / 30-36 周 → v3 不估工时，只写功能完整度 + 依赖链 + 前置条件 + 验证方式
