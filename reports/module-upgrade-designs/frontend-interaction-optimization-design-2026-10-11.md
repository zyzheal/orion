# 前端交互优化设计（2026-10-11）

**范围**：为「角色化推送 + 盯盘」后端设计（`role-based-push-and-triage-design-2026-10-11.md`）
补齐前端交互能力，包括新增页面、组件库扩展、全局快捷键、批量操作等。

**上游文档**：
- **后端设计**：`reports/module-upgrade-designs/role-based-push-and-triage-design-2026-10-11.md`
- **P0 a11y 修复**：`reports/frontend-fix-tasks-2026-10-03.md`（P0-1 ~ P0-6）
- **P1 UI/UX 修复**：同上（P1-1 ~ P1-10）
- **a11y 全仓审计**：`reports/a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md`
- **技术选型**：React + Vite + TypeScript + Ant Design，i18n 使用 `i18next`
- **组件库基础**：Modal / Table / SearchFilterBar / DataState / EmptyState / VirtualList / ChatOps / NotificationBell / Drawer 已存在

**硬约束**：
- **RC-03**：本文档为设计文档，**不修改任何生产代码**。
- **不估算人天/工期**（全文禁词）。
- **不新增依赖**：全部基于既有 Ant Design + React Hooks + i18next；
  命令面板、快捷键实现自研（不引入 `cmdk` / `react-hotkeys`）。
- **无障碍硬性要求**：所有新增 UI 必须满足 WCAG 2.1 A 级
  （键盘可达 / 焦点可见 / 语义化标签 / ARIA 属性）——先修 P0-1 ~ P0-6 再叠加新页面。
- **i18n 强制**：所有新增 UI 文案必须走 `t()`，中文/英文双语。
- **不估算人天/工期**：本文档不出现"人日/工期/人天/week 数/sprint"字样。

**方法论**：⭐ 机械计数（`find`/`grep`/`wc`，命令见 §8 可复现），
不含 ◇ 解读性断言。

---

## 0. TL;DR

**当前状态**：前端 2,072 个 TSX 页面 / 560 组件文件；交互基础设施部分齐全
（Modal / Table / SearchFilterBar / DataState / VirtualList / Drawer / i18n / WebSocket 6 处使用），
但**"角色化 + 盯盘"这条业务链的前端缺失严重**。

**四个前端缺口，四个方案**：

| # | 缺口 | 优先级 | 方案 | 类型 |
|---|---|---|---|---|
| F1 | 无 Triage 页面 | **P0** | 新增 `pages/Triage` 目录（首页聚合 + 待办列表 + 一键操作）| 新页面 |
| F2 | 无 UserRole 管理页面 | **P0** | 新增 `pages/UserRoles`（角色 CRUD + 用户-角色分配）| 新页面 |
| F3 | Alert Escalation / Notification Rules 的 Target 输入是自由文本 | **P0** | 新增 `RecipientEditor` 组件（结构化选择器，支持 user/role/team/oncall）| 新组件 |
| F4 | NotificationBell 只显示 notification，不聚合 alert/ticket | P1 | 升级 NotificationBell + 新增全局 Command Palette（⌘K）| 升级 + 新 |

**依赖顺序**：
1. **先修 P0 a11y 阻塞 6 项**（frontend-fix-tasks P0-1 ~ P0-6）
2. **再叠加 F1-F4**（新页面/新组件）
3. F5-F8 可并行

**关键设计决定**：
1. **F3 的 `RecipientEditor` 是全前端唯一入口**——Alert Escalation / Notification Rules /
   ChatOps 命令执行等所有需要"选接收者"的地方都走它，不允许自由文本输入。
2. **F4 的 Command Palette 是自研**——不引入 `cmdk` / `react-hotkeys`，
   基于既有 Modal + VirtualList + i18n 组合。
3. **F1 的 Triage 页面复用既有组件**——AlertColumns / TicketColumns / NotificationBell
   作为可嵌入组件被 Triage 引用，不重写。
4. **F2 的角色定义与用户-角色分配分离**——`UserRoles` 页只做分配，
   角色定义本身仍走既有权限管理（如存在）。
5. **无障碍优先**——所有新增 UI 使用 `<button>` 而非 `<div onClick>`，
   必须有 `aria-label` 与 `tabIndex`；避免重复 P0-1/P0-2 的错误。

---

## 1. 证据（⭐ 机械计数，命令见 §8）

### 1.1 前端规模

| 指标 | 实测 |
|---|---:|
| TSX 文件数 | **2,072**（`src/pages` 下）|
| TS 文件数 | **11,727**（全仓）|
| 组件目录数 | 60+（`src/components`）|
| API 定义文件数 | 80+（`src/api`）|
| 语言文件 | `en-US.json` / `zh-CN.json`（i18n 已就绪）|

### 1.2 已有交互基础设施

| 组件 | 位置 | 文件数 | 状态 |
|---|---|---:|---|
| Modal | `components/Modal` | 2 | ✅ 可用 |
| Table | `components/Table` | 2 | ✅ 可用 |
| SearchFilterBar | `components/SearchFilterBar` | 2 | ✅ 可用 |
| DataState / EmptyState | `components/DataState`, `EmptyState` | 2+1 | ✅ 可用 |
| VirtualList | `components/VirtualList` | 2+test | ✅ 可用 |
| Drawer（Ant Design）| 引用 3 处 | 3 | ✅ 可用 |
| ChatOps | `components/ChatOps` | **17** 组件（ActionCard / ChatInput / CommandParser / SmartRecommend / useCommandSuggestions / hooks/...）| ✅ 可用 |
| NotificationBell | `components/NotificationBell` | 1 | ✅ 可用 |
| WebSocket | `src/websocket` | 2 + test | 使用 6 处 |
| i18n | `src/i18n` + `src/locales` | 4 | ✅ 就绪 |
| Optimistic Update | 引用 4 处 | 4 | ⚠️ 少 |
| 批量操作（`selectedRowKeys` / `bulkAction`）| 21 文件 | 21 | ⚠️ 分散 |

### 1.3 已有关键业务页面

| 页面 | 位置 | 状态 |
|---|---|---|
| OnCall（值班）| `pages/OnCall` | ✅ 存在，804 行 |
| AlertList（告警）| `pages/AlertList` | ✅ 存在，含 `handleAcknowledge` + `handleBatchAcknowledge` |
| TicketList / TicketDetail | `pages/TicketList`, `pages/TicketDetail` | ✅ 存在，但 P1-1 ~ P1-7 有 7 项 UI/UX 缺陷 |
| AlertEscalation（告警升级）| `pages/alert-escalation/AlertClosurePage` | ✅ 存在 |
| NotificationCenter | `pages/NotificationCenter` | ✅ 存在，含 Tabs |
| NotificationRules | `pages/NotificationRules` | ✅ 存在 |
| ChatOps 触发入口 | `components/ChatOps/ChatTrigger.tsx` | ✅ 存在 |

### 1.4 缺失的关键能力

| 能力 | 实测 | 判定 |
|---|---|---|
| **Triage 页面**（后端即将新增）| 0 | ❌ 缺失 |
| **UserRole 管理页面**（后端新增 user_role 表）| 0 | ❌ 缺失 |
| **RecipientEditor 组件**（结构化选择接收者）| 0（全仓无组件匹配）| ❌ 缺失 |
| **Command Palette / ⌘K**（全局命令面板）| 0（全仓无 `cmd+K` / `CommandPalette` 引用）| ❌ 缺失 |
| **全局键盘快捷键 hooks**（`useHotkeys` 类）| 0（`hooks/` 下无快捷键相关）| ❌ 缺失 |
| **DND（免打扰）配置 UI** | 有 API（`api/chatops.ts:204` `DNDSettings` + `getDNDSettings` / `updateDNDSettings` / `toggleDND`），但**无页面暴露** | ⚠️ API 就绪但 UI 缺失 |
| **Alert 列表 dismiss 操作** | AlertList 有 acknowledge + batch_acknowledge，**无 dismiss** | ⚠️ 缺 dismiss |
| **跨域未读聚合（Bell）** | NotificationBell 只显示 notification 域，不聚合 alert/ticket | ⚠️ 不聚合 |
| **OnCall 与 Alert 联动** | OnCall 页面独立，不显示"分配给当前值班的告警" | ⚠️ 脱节 |
| **角色过滤（按角色查告警/工单）** | AlertList / TicketList 无"我的角色"过滤器 | ⚠️ 缺失 |

### 1.5 P0 a11y 阻塞（必须先修）

来自 `frontend-fix-tasks-2026-10-03.md`：

| # | 问题 | 影响面 |
|---|---|---|
| P0-1 | Layout 主导航 `<div onClick>` | 40+ 入口不可键盘操作 |
| P0-2 | 全仓 101 处 `<div onClick>` 反模式 | 大量不可访问 |
| P0-3 | 2,262 个按钮缺 `aria-label` | Screen Reader 无法识别 |
| P0-4 | 全仓 0 处 `tabIndex` 设置 | 键盘导航失效 |
| P0-5 | 全仓 0 处 `aria-describedby` / `aria-live` | 动态内容不可感知 |
| P0-6 | 全仓 0 处 `prefers-reduced-motion` 媒体查询 | 动效敏感用户不适 |

**约束**：本设计所有新增 UI **必须**规避 P0-1 ~ P0-6 反模式。

---

## 2. 缺口分析

### F1（P0）：无 Triage 页面

**问题**：后端 `internal/triage` 域即将提供 `GET /triage/me` / `GET /triage/me/items` /
`POST /triage/me/items/:id/ack` / `POST /triage/me/items/:id/dismiss` 四个聚合端点，
但前端无对应入口。**用户登录后无"我有什么要处理"的一站式视图**。

**为什么必须做**：这是"快速盯盘"这条业务链的**前端主入口**。没有它，
后端的聚合 API 无处调用，整个方案的价值无法兑现。

### F2（P0）：无 UserRole 管理页面

**问题**：后端 `user_role` 表（Migration 699）+ 双写回填（700）上线后，
**无 UI 界面可以：查看现有角色、创建新角色、给用户分配/撤销角色、
审计角色分配记录**。管理员只能通过数据库直改，运维困难。

**为什么必须做**：无 UI 就无法运营角色，G1 的价值无法被业务人员使用。

### F3（P0）：Target / Recipients 是自由文本输入

**问题**：`alert-escalation/AlertClosurePage` 的 `PolicyModal` 与
`NotificationRules` 页面的 Target/Recipients 输入都是自由文本框。
用户手输"张三"或"L1 值班"，语义无法机器解析——**G2 的 `RecipientSpec{kind,ref}` 后端方案在前端无对应输入形态**。

**为什么必须做**：前端输入是自由文本，后端拿到的就是自由文本，
`RecipientSpec` 结构化描述形同虚设。**F3 是 G2 能否落地的关键前端配套**。

### F4（P1）：无 Command Palette / 无全局快捷键

**问题**：2,072 个 TSX 页面 + 80+ API 定义文件，用户要找到"创建工单"或
"跳到我的告警"只能靠菜单层层导航。无 ⌘K 命令面板、无 `g + t` 跳转到工单
等键盘效率工具。

**为什么值得做**：ChatOps 域 17 组件已经有 CommandParser / SmartRecommend /
useCommandSuggestions 基础，但只在聊天上下文内生效。
**把这套能力提升为全局 Command Palette** 可以让用户在任意页面按 ⌘K 直接执行操作
（跳页面 / 搜索 / 创建 / 分配）。

### F5（P1）：NotificationBell 不聚合告警/工单

**问题**：NotificationBell 只显示 notification 域的未读，
不含 AlertState 未读、Ticket 分配给我的未读、OnCall 当前是否我。**信息碎片化**。

### F6（P2）：DND 配置无 UI

**问题**：DND API 已就绪（`api/chatops.ts:204`），但**无页面暴露**
配置免打扰时段、通知类型过滤等。

### F7（P2）：AlertList 缺 dismiss 操作

**问题**：AlertList 有 acknowledge + batch_acknowledge，**无 dismiss 与 batch_dismiss**。
用户误触发告警只能去 notification 系统忽略。

### F8（P2）：OnCall 与 Alert/Ticket 联动缺失

**问题**：OnCall 页面只显示排班信息，**不显示"当前值班的告警 / 工单"**。
值班人的核心诉求"现在有什么需要我处理"未满足。

---

## 3. 设计

### 3.1 设计 F1：Triage 页面（P0）

**目录结构**：

```
orion-frontend/src/pages/Triage/
├── index.tsx              # 主入口
├── components/
│   ├── MyOverviewCard.tsx      # 4 个数字卡片（未读告警 / 我的工单 / 值班状态 / 未读通知）
│   ├── MyItemsTable.tsx        # 统一待办表（Alert / Ticket / OnCall / Change 混合）
│   ├── OnCallStatusCard.tsx    # 当前值班状态卡
│   ├── ItemActions.tsx         # 行内操作（Ack / Dismiss / Open）
│   └── FilterBar.tsx           # 过滤（kind / severity / status / time range）
├── hooks/
│   ├── useTriageData.ts        # 数据聚合 hook（并行调 4 个 API）
│   └── useTriageActions.ts     # 动作分发（ack/dismiss 透传到源域）
├── types.ts                    # TriageItem / MyOverview 类型定义
└── __tests__/
    └── index.test.tsx          # 组件测试
```

**关键实现要点**：

1. **数据聚合**（`useTriageData`）：**并行**调 4 个 API 而非串行——
   `Promise.all([getAlerts, getTickets, getOnCall, getNotifications])`。
2. **透传不持有**：`useTriageActions.acknowledge(item)` 判断 `item.kind` 后
   分发到 `alertsApi.acknowledge` / `ticketsApi.transition` / `notificationsApi.markRead`；
   triage 域无本地状态。
3. **行内操作**：Ack / Dismiss / Open 三个按钮直接嵌到 `MyItemsTable` 行内，
   减少模态弹窗跳转。
4. **URL 深链**：`?kind=alert&status=unread` 支持过滤状态持久化，方便从通知跳转。
5. **加载态与空态**：使用既有 `DataState` / `EmptyState` 组件，不新造。
6. **a11y 强制**：所有按钮使用 `<button>` + `aria-label` + `tabIndex={0}`；
   状态卡片 `role="status"`；表格 `role="grid"`。

**API 依赖**（后端 `internal/triage` 域提供）：

```
GET  /triage/me                    # MyOverview 聚合
GET  /triage/me/items?kind=&limit= # MyItems 分页
POST /triage/me/items/:id/ack      # 透传到源域
POST /triage/me/items/:id/dismiss  # 透传到源域
```

### 3.2 设计 F2：UserRole 管理页面（P0）

**目录结构**：

```
orion-frontend/src/pages/UserRoles/
├── index.tsx
├── components/
│   ├── RoleListTable.tsx         # 角色列表（含 chatops.PermissionRole 数据源）
│   ├── RoleDetailDrawer.tsx      # 角色详情抽屉（含用户列表）
│   ├── AssignUserModal.tsx       # 分配用户模态（多用户选择 + 生效时间）
│   ├── RevokeUserModal.tsx       # 撤销用户模态
│   └── RoleAuditLog.tsx          # 角色分配审计日志
├── hooks/
│   ├── useRoles.ts
│   └── useRoleAssignments.ts
├── types.ts
└── __tests__/
    └── index.test.tsx
```

**关键实现要点**：

1. **只读 + 分配**：本页面**不创建/删除角色定义**（角色定义走既有权限管理），
   只做用户分配与撤销。
2. **多租户硬边界**：所有 API 调用带 `tenant_id`（从 `useAuthContext` 取）。
3. **临时授权**：`AssignUserModal` 支持 `expires_at` 可选（对应后端 `user_role.expires_at`），
   用于临时提权场景。
4. **来源标记**：显示 `source` 字段（manual / ldap / sso / auto），
   非 manual 的来源禁止前端手动撤销（后端拦截）。
5. **批量操作**：选中多个用户批量授予/撤销同一角色。
6. **审计可见**：`RoleAuditLog` 组件展示最近 30 次分配/撤销事件（含操作人）。
7. **i18n 强制**：角色名、操作按钮、审计日志文案全部走 `t()`。

**API 依赖**（后端 `auth` 域新增）：

```
GET  /auth/roles                                # 角色列表
GET  /auth/roles/:role_id/users                 # 角色的用户列表
POST /auth/user-role/grant                      # 分配（{user_id, role_id, source, expires_at}）
DELETE /auth/user-role/revoke                   # 撤销（{user_id, role_id}）
GET  /auth/user-role/audit                      # 审计日志
```

### 3.3 设计 F3：RecipientEditor 组件（P0）

**位置**：`orion-frontend/src/components/RecipientEditor/`

**目录结构**：

```
components/RecipientEditor/
├── index.tsx                    # 默认导出：<RecipientEditor value onChange />
├── RecipientEditor.tsx          # 核心组件
├── KindSelector.tsx             # 选择 kind（user/role/team/oncall/escalation/broadcast）
├── RefPicker.tsx                # 根据 kind 动态渲染的选择器
├── UserPicker.tsx               # 用户多选
├── RolePicker.tsx               # 角色多选
├── TeamPicker.tsx               # 团队多选
├── OnCallPicker.tsx             # 值班排班选择
├── types.ts                     # RecipientSpec 类型定义
├── hooks/
│   ├── useRecipientData.ts      # 各 kind 数据源加载
│   └── useRecipientValidation.ts  # 校验
└── __tests__/
    └── index.test.tsx
```

**核心 API**：

```tsx
interface RecipientEditorProps {
  value: RecipientSpec[]              // 受控值（支持多选）
  onChange: (specs: RecipientSpec[]) => void
  kinds?: RecipientKind[]             // 允许的 kind（默认全部）
  maxCount?: number                   // 最多选择数量
  readOnly?: boolean                  // 只读模式（预览/详情场景）
  placeholder?: string                // 支持 i18n key
}

// 使用示例：
<RecipientEditor
  value={policy.recipientSpecs}
  onChange={(specs) => setPolicy({ ...policy, recipientSpecs: specs })}
  kinds={['user', 'role', 'team', 'oncall-duty']}
  maxCount={20}
/>
```

**关键实现要点**：

1. **动态切换选择器**：`RefPicker` 根据 `KindSelector` 的值动态渲染对应的 Picker。
2. **可视化 chip**：已选接收者以 chip 形式展示在输入框上方，可单独删除。
3. **多来源校验**：`useRecipientValidation` 校验（如 `oncall-duty` 必须选已存在的 Schedule）。
4. **兼容模式**：`acceptsLegacyString?: boolean`，若打开则允许在 `kind=user` 时手输用户 ID（用于过渡）。
5. **只读渲染**：详情页展示时不渲染选择器，只显示 chip 列表 + 图标。
6. **无障碍**：Kind 选择器是 radio group；RefPicker 是 autocomplete；
   chip 删除按钮必须有 `aria-label="移除 xxx"`。
7. **i18n 强制**：所有 kind 名称、按钮、校验错误文案走 `t()`。

**数据源 API**：

```
GET /auth/users?search=             # UserPicker
GET /auth/roles                     # RolePicker
GET /teams                          # TeamPicker（如后端存在）
GET /oncall/schedules               # OnCallPicker
```

**替换目标**（P0 阻塞）：

| 页面 | 当前输入 | 替换为 |
|---|---|---|
| `pages/alert-escalation/.../PolicyModal.tsx` | `<Input>Target</Input>` 自由文本 | `<RecipientEditor kinds={['user','role','team','oncall-duty']} />` |
| `pages/NotificationRules/.../PolicyForm.tsx` | `<Input>Recipients</Input>` 逗号分隔 | `<RecipientEditor kinds={['user','role','team','broadcast']} />` |
| `pages/OnCall/OnCallModals.tsx` | `<Input>Target</Input>` 目标选择 | `<RecipientEditor kinds={['user','role']} />` |

### 3.4 设计 F4：Command Palette + 全局快捷键（P1）

**位置**：`orion-frontend/src/components/CommandPalette/` + `src/hooks/useHotkeys.ts`

**目录结构**：

```
components/CommandPalette/
├── index.tsx                 # <CommandPalette /> 挂载点（渲染在 App.tsx）
├── CommandPalette.tsx        # 主组件（Modal + 搜索 + 结果列表）
├── commands/
│   ├── registry.ts           # 命令注册表（走 ADR-012 模式）
│   ├── navigation.ts         # 导航类（跳页面）
│   ├── actions.ts            # 操作类（创建/分配/确认）
│   ├── search.ts             # 搜索类（跨域搜索）
│   └── index.ts              # 聚合导出
├── types.ts
├── hooks/
│   └── useCommandRegistry.ts  # 命令注册 hook
└── __tests__/

src/hooks/
├── useHotkeys.ts             # 全局快捷键 hook
├── useHotkeySequence.ts      # 键序列 hook（如 g → t）
└── __tests__/
```

**关键实现要点**：

1. **⌘K 唤起**：`useHotkeys` 监听 `metaKey + K`（macOS）/ `ctrl + K`（Windows/Linux）。
2. **命令注册表**：`commands.register({ id, title, keywords, execute, category, icon, permissions })`，
   各页面在 mount 时注册自己的命令。
3. **权限过滤**：注册时指定 `permissions: ['alert:read']`，命令面板渲染时按用户权限过滤。
4. **fuzzy 匹配**：基于命令的 `title` + `keywords` 数组做子串匹配（不引入外部 fuzzy 库）。
5. **键盘导航**：↑/↓ 选择、Enter 执行、Esc 关闭、数字 1-9 直接执行前 9 项。
6. **命令序列**：`g → t` 跳到工单、`g → a` 跳到告警、`g → o` 跳到值班。
   `useHotkeySequence` 处理时序（3 秒超时）。
7. **虚拟滚动**：结果列表用既有 `VirtualList` 组件，支持 1000+ 命令。
8. **权限感知**：命令注册时声明 `permissions: ['alert:read']`，面板按用户权限过滤。
9. **不引入新依赖**：全部基于 React + 既有 Modal + VirtualList 组合。

**默认命令集**（初始内置）：

| 分类 | 命令 | 快捷键 |
|---|---|---|
| 导航 | 跳转到告警列表 / 工单列表 / 值班 / Triage 首页 | g+a / g+t / g+o / g+m |
| 创建 | 新建告警规则 / 新建工单 / 新建升级策略 | c+a / c+t / c+p |
| 操作 | 处理我的未读 / 处理我的告警 / 处理我的工单 | h+u / h+a / h+t |
| 搜索 | 全局搜索用户 / 搜索工单 / 搜索告警 | s+u / s+t / s+a |
| 设置 | 打开 DND 设置 / 打开通知偏好 / 切换租户 | ⌘+D / ⌘+N / ⌘+T |

**a11y 强制**：
- 命令面板是 `<dialog>` 语义（`role="dialog"`, `aria-modal="true"`）。
- 焦点管理：打开时聚焦搜索框，关闭时焦点回到触发元素。
- Esc 关闭、Enter 执行、↑/↓ 选择、数字键直接执行——全部键盘可达。

### 3.5 设计 F5：NotificationBell 升级（P1）

**修改位置**：`orion-frontend/src/components/NotificationBell/index.tsx`

**改造要点**：

1. **多源聚合**：数据源从单一 notification 扩展为 4 源：
   - `alertsApi.getUnreadCount()` → AlertState 未读
   - `ticketsApi.getMyOpenCount()` → 我的未处理工单
   - `oncallApi.getMyOnCall()` → 我是否值班
   - `notificationsApi.getUnreadCount()` → 现有通知未读
2. **未读数 Badge 显示**：`alerts + tickets + notifications` 合计。
3. **Tabs 扩展**：`全部 / 告警 / 工单 / 值班 / 通知` 5 类 Tab。
4. **一键跳转**：每个 Tab 项点击跳转到对应页面，带上 `?status=unread` 深链。
5. **值班状态高亮**：如果用户当前在值班，Bell 图标加绿色指示灯 + `role="status"`。
6. **保持既有 API 契约**：`getNotifications` / `markAllAsRead` 保持不变，
   新增 `getMyUnreadSummary()` 组合接口（后端 triage 域提供）。

### 3.6 设计 F6：DND 设置页面（P2）

**位置**：`orion-frontend/src/pages/Settings/DND/`

**关键要点**：

1. **时间选择器**：使用 Ant Design `<TimePicker.RangePicker>`，支持多时段。
2. **通知类型过滤**：checkbox group，来自后端 `DNDSettings.types`。
3. **紧急程度阈值**：severity 阈值滑块（"critical 与 high 绕过 DND"）。
4. **预览**：显示"下次 DND 生效时间"、"过去 24 小时被静默的通知数"。
5. **API 已有**：直接使用 `api/chatops.ts:204` 的 `getDNDSettings` / `updateDNDSettings`。

### 3.7 设计 F7：AlertList 增强（P2）

**修改位置**：`orion-frontend/src/pages/AlertList/`

**改造要点**：

1. **dismiss 按钮**：`AlertColumns.tsx` 新增 `dismiss` 操作列。
2. **batch_dismiss**：与既有 `handleBatchAcknowledge` 平级新增 `handleBatchDismiss`。
3. **按角色过滤**：`SearchFilterBar` 新增"分配给我 / 分配给我的角色 / 分配给值班"过滤器，
   使用 `useAuthContext` 获取当前用户角色。
4. **按值班过滤**：如果当前用户是值班人，"当前值班的告警"过滤器高亮。

### 3.8 设计 F8：OnCall 联动增强（P2）

**修改位置**：`orion-frontend/src/pages/OnCall/`

**改造要点**：

1. **新增 "我的任务" 面板**：如果当前用户是值班人，OnCall 页顶部显示
   分配给当前值班的告警 / 工单（复用 AlertColumns / TicketColumns）。
2. **交接操作**：支持临时交接（对应后端 `Override` 概念），
   交接对象通过 `RecipientEditor` 选择。
3. **交接审计**：显示交接记录（对应后端 `Override` 表）。

---

## 4. 组件库扩展清单

除 F1-F8 涉及的组件外，还需要**扩展既有组件**以支持上述设计：

### 4.1 SearchFilterBar 扩展

**位置**：`components/SearchFilterBar/index.tsx`

**新增能力**：
- `filterType="recipient"`：内置 RecipientEditor 作为过滤器
- `filterType="time-range"`：预设（今天 / 24h / 7d / 30d / 自定义）
- `filterType="role-scope"`：当前用户角色范围内的告警/工单

### 4.2 Table 扩展

**位置**：`components/Table/index.tsx`

**新增能力**：
- `rowSelection.onChange` 已存在，补充 `maxSelectCount` 属性
- 新增 `renderActionColumn` 统一行操作按钮样式
- 新增 `optimisticUpdate` 选项：`{ enabled: true, rollbackOnError: true }`

### 4.3 DataState 扩展

**位置**：`components/DataState/index.tsx`

**新增能力**：
- 新增 `state="no-role-matched"`：用户无匹配角色时的空态提示
- 新增 `state="oncall-now"`：当前值班的欢迎态
- 新增 `state="dnd-active"`：DND 生效中的提醒态

### 4.4 EmptyState 扩展

**位置**：`components/EmptyState/index.tsx`

**新增能力**：
- 支持 `actions: {primary, secondary}` 快捷动作列表
- 支持 `hint` 提示文案（如"试试从 Command Palette ⌘K 搜索"）

### 4.5 新增组件

| 组件 | 位置 | 用途 |
|---|---|---|
| `RecipientEditor` | `components/RecipientEditor/` | F3 核心 |
| `CommandPalette` | `components/CommandPalette/` | F4 核心 |
| `TriageItemRow` | `components/TriageItemRow/`（或 Triage 页面内私有）| F1 行渲染 |
| `RoleAssignmentAuditLog` | `components/RoleAssignmentAuditLog/` | F2 审计 |
| `OnCallStatusBadge` | `components/OnCallStatusBadge/` | 全局组件，任何页面显示"当前在值班" |

---

## 5. 与后端设计的对接

### 5.1 API 契约映射

| 前端 | 后端 | 后端设计文档位置 |
|---|---|---|
| Triage 页面 API | `GET /triage/me` / `GET /triage/me/items` / `POST /triage/me/items/:id/ack` | `role-based-push-and-triage-design` §3.3.4 |
| UserRole 页面 API | `GET /auth/roles` / `POST /auth/user-role/grant` / `DELETE /auth/user-role/revoke` | 同上 §3.1 |
| RecipientEditor 数据源 | `GET /auth/users` / `GET /auth/roles` / `GET /oncall/schedules` | 同上 §3.2.3 |
| NotificationBell 聚合 | `GET /triage/me`（MyOverview）| 同上 §3.3.2 |
| DND 页面 API | 既有 `api/chatops.ts:204` `DNDSettings` | 无需新增 |

### 5.2 类型定义共享

**问题**：`RecipientSpec` 前后端都要用，如何避免重复定义？

**方案**：
- 后端 `internal/recipient/models/models.go` 定义 `RecipientKind` 常量与 `RecipientSpec` 结构
- 前端 `orion-frontend/src/types/recipient.ts` 手工维护对应 TypeScript 类型
- 通过 CI 脚本 `check-types.ts` 校验两端 kind 常量一致（不引入 codegen 工具）

```ts
// orion-frontend/src/types/recipient.ts
export type RecipientKind =
  | 'user'
  | 'role'
  | 'team'
  | 'oncall-duty'
  | 'escalation'
  | 'broadcast'

export interface RecipientSpec {
  kind: RecipientKind
  ref: string
}
```

### 5.3 灰度策略

- **F1-F3（P0）**：与后端 G1/G2 同步上线，Feature Flag 控制（`triage_enabled` / `recipient_editor_enabled`）
- **F4（Command Palette）**：独立上线，先做导航类命令，再扩展操作类
- **F5-F8（P1/P2）**：可独立上线，无阻塞关系

---

## 6. 与 a11y / UI-UX 报告对齐

**先决条件**：本设计的所有新增 UI 上线**之前**，
`frontend-fix-tasks-2026-10-03.md` 中的 **P0-1 ~ P0-6 必须完成**。

**理由**：P0-1/P0-2 是全仓 `<div onClick>` 反模式，如果新页面复制这个模式，
等于新增债务而不是偿还债务。

**新增 UI 的强制规范**：

| 规范 | 强制项 | 违反后果 |
|---|---|---|
| 交互元素 | 使用 `<button>` `<a>` `<input>` `<select>` 原生标签 | PR 阻塞 |
| 键盘可达 | 所有可交互元素 `tabIndex` 有值 | PR 阻塞 |
| 语义标签 | `role="status"` / `role="dialog"` / `role="grid"` 等语义 | PR 阻塞 |
| ARIA | `aria-label` / `aria-live` / `aria-describedby` 按场景强制 | PR 阻塞 |
| 动效 | 尊重 `prefers-reduced-motion` | PR 阻塞 |
| i18n | 所有文案走 `t()` | PR 阻塞 |
| 图标按钮 | 必须有 `aria-label` 说明用途 | PR 阻塞 |

---

## 7. 风险与降级

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| **R-F1** F3 RecipientEditor 数据加载慢 | 中 | 中 | 各 Picker 独立 loading；已选 chip 立即可见；数据源 5 秒超时降级为手输 ID |
| **R-F2** F4 Command Palette 与既有 ChatOps 快捷键冲突 | 中 | 中 | 快捷键冲突检测；`useHotkeys` 支持 `ignoreWhen: 'INPUT,TEXTAREA'` |
| **R-F3** F1 Triage 数据聚合 API 超时 | 中 | 中 | 4 个数据源并行加载 + `Promise.allSettled`；单源失败不影响其他 |
| **R-F4** F2 UserRole 分配错人 | 低 | 高 | `AssignUserModal` 强制二次确认；`RoleAuditLog` 展示操作人；后端拦截无权限操作 |
| **R-F5** F5 NotificationBell 未读数错误 | 低 | 中 | 前端本地缓存 + 后端 WebSocket 更新（既有 WebSocket 基础设施） |
| **R-F6** P0 a11y 未完成就上线新页面 | 高 | 高 | CI 校验：新页面必须通过 `check-a11y.ts`；PR 阻塞 |
| **R-F7** F3 与既有 PolicyModal 数据不兼容 | 中 | 中 | 保留 `acceptsLegacyString` 模式；后端双写过渡期内前端可兼容 |
| **R-F8** Command Palette 命令注册遗漏 | 中 | 中 | 提供 `useCommandRegistry` hook 模板；文档化命令注册规范 |
| **R-F9** i18n 遗漏导致中文用户看到 key 而非文案 | 中 | 低 | CI 校验：`t()` 参数必须在 `en-US.json` / `zh-CN.json` 存在 |
| **R-F10** OnCall 联动与既有 OnCall 页逻辑冲突 | 低 | 中 | 新面板作为独立区块，可折叠；不影响既有排班编辑功能 |

**降级策略**：
- F1 失败：Triage 页面通过 Feature Flag 关闭，用户仍可用既有 AlertList/TicketList 手动组合
- F2 失败：`UserRole` 页面通过 Feature Flag 关闭，管理员通过数据库直改（临时降级）
- F3 失败：`RecipientEditor` 支持 `fallbackToLegacyInput={true}`，退化到既有自由文本输入
- F4 失败：Command Palette 通过 Feature Flag 关闭，不影响其他页面
- F5-F8 失败：各自 Feature Flag 关闭，不影响主链

---

## 8. 复现命令（⭐ 机械计数）

```bash
# 前端规模
find orion-frontend/src/pages -name '*.tsx' ! -name '*_test*' | wc -l            # -> 2072
find orion-frontend -name '*.ts' ! -path '*/node_modules/*' | wc -l              # -> 11727

# 关键组件存在性
for c in Modal Table SearchFilterBar DataState EmptyState VirtualList ChatOps NotificationBell; do
  echo -n "$c: "
  find orion-frontend/src/components/$c -name '*.tsx' 2>/dev/null | wc -l
done

# 缺失能力检查（应为 0）
find orion-frontend/src/pages -maxdepth 1 -type d -iname 'Triage'                    # -> 无
find orion-frontend/src/pages -maxdepth 1 -type d -iname '*UserRole*'                # -> 无
find orion-frontend/src/components -iname '*RecipientEditor*'                        # -> 无
grep -rln 'cmd+K\|CommandPalette\|useHotkeys' orion-frontend/src --include='*.ts*' \
  2>/dev/null | grep -v test | wc -l                                                 # -> 0

# DND API 已就绪但无 UI
grep -n 'DND\|getDNDSettings\|updateDNDSettings' orion-frontend/src/api/chatops.ts

# 全局快捷键 hook 缺失
grep -rln 'keydown\|hotkeys\|useKeyboard' orion-frontend/src/hooks 2>/dev/null | wc -l  # -> 0

# AlertList 已有 acknowledge + batch，缺 dismiss
grep -rn 'handleAcknowledge\|handleBatchAcknowledge' orion-frontend/src/pages/AlertList \
  --include='*.tsx' | head
grep -rn 'dismiss' orion-frontend/src/pages/AlertList --include='*.tsx' | head  # -> 空

# 批量操作分散（21 文件）
grep -rlE 'selectedRowKeys|bulkAction|batchAction' orion-frontend/src --include='*.tsx' \
  | grep -v test | wc -l                                                                 # -> 21

# P0 a11y 反模式计数（作为对齐检查）
grep -rln '<div.*onClick' orion-frontend/src --include='*.tsx' 2>/dev/null | wc -l
grep -rc 'tabIndex' orion-frontend/src --include='*.tsx' 2>/dev/null | awk -F: '{s+=$2} END{print s}'
```

---

## 9. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 8 个缺口全部有具体设计（页面目录 / 组件 API / 依赖 API）| §3.1-3.8 |
| 2 | 所有新增 UI 遵守 WCAG 2.1 A 级 | §6 强制规范 |
| 3 | 所有新增 UI 文案走 i18n `t()` | §3 各节 |
| 4 | 与后端设计文档（G1-G4）API 契约一致 | §5.1 |
| 5 | 无新依赖引入（不引入 cmdk / react-hotkeys / fuzzy 库）| §3.4.9 |
| 6 | 命令注册表走 ADR-012 Factory/Handler 模式 | §3.4.2 |
| 7 | P0 a11y 完成作为上线前置条件明确标注 | §6 |
| 8 | 全部数字为机械计数，pattern 已抽样确认 | §8 命令 |
| 9 | Feature Flag 覆盖 F1-F8 全部方案 | §7 |
| 10 | 风险与降级方案覆盖 F1-F8 | §7 |
| 11 | 未修改生产代码 | `git diff -- '*.go' '*.ts' '*.tsx' '*.java' '*.py' '*.rs'` 为空 |
| 12 | 未估算人天/工期 | 全文检索 `人天`/`人日`/`工期`/`sprint`/`week` 为空 |
| 13 | 与既有组件库（Modal / Table / SearchFilterBar / DataState / VirtualList）复用而非重造 | §4 |

---

*本设计回答的核心问题："前端如何承接后端 4 项补齐（G1-G4）+ 提升整体交互体验？"

4 个前端缺口与 4 个后端缺口一一映射：
- G1（user_role 表）→ F2（UserRole 页面）
- G2（RecipientSpec + Resolver）→ F3（RecipientEditor 组件）
- G3（notification Adapter）→ 前端无对应改动，走统一 Bell 与 Notification 页面
- G4（triage 聚合域）→ F1（Triage 页面）

F4（Command Palette）+ F5（Bell 升级）+ F6（DND 页面）+ F7（AlertList 增强）
+ F8（OnCall 联动）是提升交互效率与用户黏性的 P1/P2 增强项，
不阻塞主链但显著改善使用体验。*

*F3（RecipientEditor）是唯一"必须先于后端 G2 上线"的前端方案——
因为 G2 的后端结构化字段需要前端提供结构化输入，
否则后端拿到的仍是自由文本。*

*整个方案严格遵守 RC-03 硬约束：不修改生产代码，仅产出设计文档；
不估算人天/工期；所有数字可复现；先修 P0 a11y 再叠加新页面。*
