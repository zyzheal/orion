# 升级执行剧本 v6.0 补录（Patch，非直接修改）

**评审对象**：`reports/upgrade-execution-playbook-2026-10-03.md`（当前 v5.9，122 项任务）
**文档性质**：**补录补丁说明**（Patch），不直接修改 Playbook
**版本**：v6.0 Patch Proposal（2026-10-11）
**说明**：本文件描述应补录进 Playbook 的**新增任务**与**阶段调整**，实际合并由用户/维护者决定。
**关联文档**（本轮 4 份设计，全部已提交）：
1. `role-based-push-and-triage-design-2026-10-11.md`（后端 G1-G4）
2. `frontend-interaction-optimization-design-2026-10-11.md`（前端 F1-F8）
3. `triage-ui-domain-expert-design-analysis-2026-10-11.md`（UI 专家评审）
4. `triage-api-contract-design-2026-10-11.md`（API 契约）
5. `frontend-triage-implementation-spec-2026-10-11.md`（前端实施规格，含 F1 修订）
6. `frontend-a11y-p0-prework-design-2026-10-11.md`（A11y P0 前置）

**硬约束**：
- **RC-03**：本补丁说明，不修改 Playbook 主文件（用户可决定何时合并）。
- **不估算人天/工期**。

---

## 0. 现有 Playbook 版本回顾

**当前**：v5.9（2026-10-11 提交 `5e281f071`），共 **122 项任务**。

**阶段结构**（8 阶段 + 后续批次）：
- S0：基础设施层（6 项）
- S1：A11y 通病批量修复（12 项）
- S2：核心 Service 补齐（10 项）
- S3：新模块建设（14 项）
- S4：协议扩展（6 项）
- S5：前端页面补齐（12 项）
- S6：跨模块集成（8 项）
- S7：RDM 止损（3 项）
- S8：P2 次要项（15 项）
- 4.11：48 子域分批补齐（39 项参考）

**v5.9 未包含**（本轮新发现的缺口）：
- ❌ Triage 盯盘页面（F1）
- ❌ UserRole 管理页面（F2）
- ❌ RecipientEditor 组件（F3）
- ❌ Command Palette + 快捷键（F4）
- ❌ user_role 表 + RecipientSpec 体系（G1 + G2）
- ❌ notification ↔ pipeline 打通（G3）
- ❌ A11y P0 前置任务明确化（frontend-fix-tasks 已有 P0-1~P0-6 定义，但 Playbook 未作为前置阶段）
- ❌ Triage API 契约测试门控

---

## 1. v6.0 变更总览

### 1.1 新增任务数

| 类别 | 数量 | 优先级 |
|---|---|---|
| 后端域建设（G1-G3）| 3 项 | P0 |
| 前端页面（F1-F4）| 4 项 | P0 |
| 前端组件（F3-F5）| 3 项 | P1 |
| 前端页面扩展（F6-F8）| 3 项 | P2 |
| A11y 前置明确化 | 1 项 | P0 |
| Triage 契约测试 | 1 项 | P0 |
| **合计新增** | **15 项** | |

### 1.2 阶段调整

| 阶段 | 原 | v6.0 | 变化 |
|---|---|---|---|
| S0 前置门控 | 6 项 | 7 项 | + 新增 A11y P0 前置（阻塞所有新页面）|
| S1 A11y | 12 项 | 18 项 | + P0-1 ~ P0-6 明确化（+6 项）|
| S2 后端 | 10 项 | 13 项 | + G1 user_role / G2 RecipientSpec / G3 notification adapter |
| S3 新模块 | 14 项 | 15 项 | + Triage 域（读聚合，不新增表）|
| S5 前端 | 12 项 | 21 项 | + F1-F8（9 项）|
| S6 集成 | 8 项 | 9 项 | + Triage 契约测试 |
| **总计** | 122 | **137** | +15 |

---

## 2. 新增任务详细规格

### 2.1 S0 前置门控（+1 项）

#### 任务 S0-7（新增）：A11y P0 前置明确化

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md`

**描述**：
在 S0 启动前，必须确认 P0-1 ~ P0-6 六项 a11y 阻塞项的修复计划已明确，作为所有新页面的上线前置。

**验证方式**：
- [ ] P0-1 Layout nav 修复方案文档已 review
- [ ] P0-2 101 处 `<div onClick>` 分批策略明确
- [ ] P0-3 2262 按钮 aria-label 分类计划
- [ ] P0-4 tabIndex 全局设置规则
- [ ] P0-5 aria-describedby + aria-live 使用规范
- [ ] P0-6 prefers-reduced-motion 全局 CSS 已合入

**回滚步骤**：N/A（文档级任务）

**依赖**：无

---

### 2.2 S1 A11y 通病（+6 项）

#### 任务 S1-13（新增）：P0-1 Layout 主导航修复

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §2

**位置**：`orion-frontend/src/components/Layout/index.tsx:140-194`

**修复**：`<div onClick>` → `<button role="menuitem">` + Roving tabindex + Arrow 键导航

**验证**：
```bash
grep -n 'onClick' orion-frontend/src/components/Layout/index.tsx
# 目标：0 处 `<div onClick>` 用于导航
```

**依赖**：S0-7
**回滚**：Feature Flag `layout-nav-a11y-v2`（10% → 50% → 100% 灰度）

#### 任务 S1-14（新增）：P0-2 101 处 `<div onClick>` 分批修复

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §3

**分批**：
- 批 1：AlertList + TicketDetail（27 处）
- 批 2：DashboardNew + Settings（30 处）
- 批 3：components（44 处，含 CardPanel 决策）
- 批 4-5：其他杂项（14 处）

**验证**：
```bash
grep -rn '<div[^>]*onClick' orion-frontend/src --include='*.tsx' | wc -l
# 目标：0 处
```

**依赖**：S1-13
**回滚**：无（局部改动）

#### 任务 S1-15（新增）：P0-3 2262 按钮 aria-label 批量修复

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §4

**修复策略**：
- Phase 1：图标按钮分类批量修复（10 类常见图标）
- Phase 2：CI 静态检查加入 `no-icon-button-without-aria-label` 规则

**验证**：
```bash
# 图标按钮应有 aria-label
grep -rn '<button[^>]*>' orion-frontend/src --include='*.tsx' \
  | grep -v 'aria-label' | grep -E '<(Delete|Close|Save|Refresh|Edit|Search|Filter|Bell|Setting|Menu)Outlined' \
  | wc -l
# 目标：0 处
```

**依赖**：无（可与 S1-14 并行）

#### 任务 S1-16（新增）：P0-4 tabIndex 全局设置

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §5

**修复内容**：
- Layout 菜单项（配合 S1-13）
- 卡片组件可点击区域
- 表格行编辑按钮
- 自定义列表项
- Modal/Drawer 焦点陷阱

**验证**：
```bash
grep -rn 'tabIndex' orion-frontend/src --include='*.tsx' | wc -l
# 目标：>= 50（关键可交互元素）
```

**依赖**：S1-13, S1-14

#### 任务 S1-17（新增）：P0-5 aria-describedby + aria-live

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §6

**修复内容**：
- 表单输入 aria-describedby 指向错误消息
- 状态卡片 aria-live="polite"
- Toast/Message aria-live="assertive" + role="alert"

**验证**：
```bash
grep -rn 'aria-describedby\|aria-live' orion-frontend/src --include='*.tsx' | wc -l
# 目标：>= 30
```

**依赖**：S1-15（表单修复后）

#### 任务 S1-18（新增）：P0-6 prefers-reduced-motion 全局 CSS

**来源**：`frontend-a11y-p0-prework-design-2026-10-11.md` §7

**修复**：`orion-frontend/src/index.css` 添加媒体查询

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**验证**：
```bash
grep -rn 'prefers-reduced-motion' orion-frontend/src | wc -l
# 目标：>= 1（全局 CSS）+ 组件级 hook
```

**依赖**：无（全局 CSS 独立）

---

### 2.3 S2 核心 Service 补齐（+3 项）

#### 任务 S2-11（新增）：G1 user_role 表 + 双写回填

**来源**：`role-based-push-and-triage-design-2026-10-11.md` §2.1

**Migration**：
- 699（up）：创建 `user_role` 表
- 700（up）：从 `UserInfo.Role` 单值字段双写回填
- 699-down / 700-down（下）：可回退

**Schema**：
```sql
CREATE TABLE user_role (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    role_id         VARCHAR(64) NOT NULL,
    source          VARCHAR(32) NOT NULL,  -- manual/ldap/sso/auto
    granted_by      UUID,
    granted_at      TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,           -- 临时授权
    UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX idx_user_role_active 
    ON user_role (tenant_id, role_id) 
    WHERE expires_at IS NULL OR expires_at > now();
```

**验证**：
- [ ] Migration 699 up/down 可执行
- [ ] Migration 700 up/down 可执行
- [ ] 双写回填数据完整性测试（100% 迁移率）
- [ ] 部分索引工作正常

**依赖**：S0 完成 + Migration 治理（见 ADR-010 §2.1）
**回滚**：Migration down 文件

#### 任务 S2-12（新增）：G2 RecipientSpec/Resolver 注册表

**来源**：`role-based-push-and-triage-design-2026-10-11.md` §2.2

**实现**：
- `internal/recipient/` 新域
- `RecipientSpec{kind, ref}` 类型
- `Resolver` 接口 + 6 个 Kind 实现（user / role / team / oncall-duty / escalation / broadcast）
- 注册到 ADR-012 Handler 注册表
- 升级 `EscalationRule` / `NotificationPolicyEntity` 加 `TargetSpec` / `RecipientSpecs` 字段（向后兼容）

**验证**：
- [ ] Resolver 接口正确定义
- [ ] 6 个 Kind 的 Resolver 全部注册
- [ ] 现有 Alert Escalation 规则不受影响（向后兼容）
- [ ] NotificationPolicy 升级兼容旧字段

**依赖**：S2-11
**回滚**：字段 nullable 保证向后兼容

#### 任务 S2-13（新增）：G3 notification ↔ pipeline adapter

**来源**：`role-based-push-and-triage-design-2026-10-11.md` §3.4

**实现**：
- `internal/notification/adapter/pipeline_adapter.go`
- 实现 pipeline 的 `NotificationChannel` 接口
- 内部调用 notification.Service 走统一投递
- Feature Flag `notification.pipeline_adapter.enabled`

**验证**：
- [ ] adapter 实现 pipeline 接口
- [ ] Feature Flag off 时 pipeline 走原路径
- [ ] Feature Flag on 时 pipeline 走 notification.Service
- [ ] DND 策略在 pipeline 路径生效

**依赖**：S2-11, S2-12
**回滚**：Feature Flag off

---

### 2.4 S3 新模块建设（+1 项）

#### 任务 S3-15（新增）：G3 triage 域建设

**来源**：`role-based-push-and-triage-design-2026-10-11.md` §3.3

**实现**：
- `internal/triage/` 新域（**只读聚合，无自有表**）
- 4 个 Reader 接口：AlertReader / TicketReader / OnCallReader / NotificationReader
- 4 个 Reader 实现（依赖注入到 Service）
- Handler 注册 7 个端点（对齐 API 契约）
- Feature Flag `triage.enabled` + `triage.websocket.enabled`

**验证**：
- [ ] 4 个 Reader 接口注册到 ADR-012 注册表
- [ ] 7 个端点全部有单测覆盖
- [ ] 4 个 Reader mock 单测
- [ ] Feature Flag off 时端点返回 503

**依赖**：S2-11, S2-12
**回滚**：Feature Flag off

---

### 2.5 S5 前端页面补齐（+9 项）

#### 任务 S5-13（新增）：F1 Triage 页面（三视图版）

**来源**：`frontend-triage-implementation-spec-2026-10-11.md`

**实现**：
- `pages/Triage/` 目录（13 个新增 TSX 组件 + 4 个 Hook）
- 三视图切换：Overview / Queue / Timeline
- 15 条键盘快捷键 + Command Palette 集成
- 8 个 API 契约端点全部集成

**验证**：
- [ ] 三视图切换正确
- [ ] 4 个 Hook 全部有单测
- [ ] 10 个组件全部有单测
- [ ] 4 个 e2e 场景通过
- [ ] 键盘导航可用（无 a11y 阻塞）

**依赖**：
- S0-7（a11y 前置）
- S1-13 ~ S1-18（P0-1 ~ P0-6 全部）
- S3-15（后端 triage 域）

#### 任务 S5-14（新增）：F2 UserRole 管理页面

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.2

**实现**：
- `pages/UserRoles/`
- 角色列表 + 分配 + 撤销 + 审计日志
- 临时授权（expires_at）+ source 标记（manual/ldap/sso/auto）

**依赖**：S0-7, S2-11

#### 任务 S5-15（新增）：F3 RecipientEditor 组件

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.3

**实现**：
- `components/RecipientEditor/`
- 6 Kind 选择器 + 6 Pickers（User/Role/Team/OnCall/etc）
- 受控值 + chip 可视化 + acceptsLegacyString 兼容模式

**验证**：
- [ ] 6 种 Kind 全部支持
- [ ] 与 F1/F2/通知策略页集成测试
- [ ] 向后兼容旧字符串

**依赖**：S2-12

#### 任务 S5-16（新增）：F4 Command Palette + useHotkeys

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.4

**实现**：
- `components/CommandPalette/`
- `hooks/useHotkeys.ts`
- ⌘K 唤起 + 命令注册表 + 权限过滤 + 键盘序列（g→t）

**依赖**：S0-7, S5-15

#### 任务 S5-17（新增）：F5 NotificationBell 多源聚合升级

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.5

**实现**：
- 升级 NotificationBell 支持 alerts + tickets + oncall + notifications 4 源聚合
- WebSocket 实时刷新
- 子菜单按 kind 分组

**依赖**：S5-13（复用 Triage 数据 hook）

#### 任务 S5-18（新增）：F6 DND 设置页面

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.6

**实现**：
- `pages/Settings/DND/`
- 时间选择器 + 类型过滤器 + 严重度阈值
- 保存到 user_preference 表

**依赖**：S5-16（复用快捷键）

#### 任务 S5-19（新增）：F7 AlertList 增强

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.7

**实现**：
- 添加 dismiss 按钮
- 添加 role/oncall 过滤器

**依赖**：S5-13（对齐 Triage Queue 视图 UX）

#### 任务 S5-20（新增）：F8 OnCall 页面"我的任务"面板

**来源**：`frontend-interaction-optimization-design-2026-10-11.md` §3.8

**实现**：
- OnCall 页面右侧新增"当前值班相关的 Triage 项"面板
- 数据源：`GET /v1/triage/me/items?assigned_scope=oncall&limit=20`

**依赖**：S5-13

#### 任务 S5-21（新增）：F1-F8 集成测试

**来源**：`frontend-triage-implementation-spec-2026-10-11.md` §10

**实现**：
- Playwright e2e 场景测试（4+ 个）
- 键盘导航测试
- 命令面板测试
- 多页面联动测试

**依赖**：S5-13 ~ S5-20

---

### 2.6 S6 跨模块集成（+1 项）

#### 任务 S6-9（新增）：Triage 契约测试

**来源**：`triage-api-contract-design-2026-10-11.md` §10

**实现**：
- JSON Schema 快照（7 个端点响应体）
- 错误码穷举（前端 `switch error.code` 覆盖 9 项）
- 枚举扩展测试（后端注入未知值，前端降级"未知"）
- WebSocket 事件契约测试
- 多租户隔离测试（跨租户返回 403）

**验证**：
- [ ] Schema 快照 100% 覆盖 7 端点
- [ ] 错误码处理覆盖率 100%
- [ ] 跨租户测试通过

**依赖**：S3-15, S5-13

---

## 3. 阶段依赖 DAG 更新

### 3.1 原 v5.9 关键路径

```
S0 (6) → S1 (12) → S2 (10) → S3 (14) → S4 (6) → S5 (12) → S6 (8) → S7 (3) → S8 (15)
```

### 3.2 v6.0 新增依赖

```
S0-7 (a11y 前置)
  ↓
S1-13 (P0-1 Layout) ← S1-14 (P0-2 101 div)
  ↓                       ↓
  └── S1-15 (P0-3 aria-label) ── S1-17 (P0-5 aria-live)
       ↓
     S1-16 (P0-4 tabIndex)
       ↓
S1-18 (P0-6 motion) [独立]

S2-11 (user_role) → S2-12 (RecipientSpec) → S3-15 (triage 域)
                                        ↓
                              S6-9 (契约测试)
                                        ↓
                              S5-13 (Triage 页面) → S5-17, S5-19, S5-20
                                        ↓
                              S5-14 (UserRole 页面)
                              S5-15 (RecipientEditor)
                                        ↓
                              S5-16 (Command Palette) → S5-18 (DND 页面)
                                        ↓
                              S5-21 (集成测试)
```

### 3.3 关键路径扩展

**新关键路径**：
```
S0 (7) → S1 (18) → S2 (13) → S3 (15) → S4 (6) → S5 (21) → S6 (9) → S7 (3) → S8 (15)
```

**说明**：
- S0 增加 a11y 前置
- S1 增加 6 项 P0 a11y
- S2 增加 3 项后端域（G1/G2/G3）
- S3 增加 1 项 triage 域
- S5 增加 9 项前端页面
- S6 增加 1 项契约测试

---

## 4. 阶段门控更新

### 4.1 S0 出口门控新增

**原**：
- [ ] 基础设施层 6 项完成

**新增**：
- [ ] A11y P0-1 ~ P0-6 修复计划已 review
- [ ] `frontend-a11y-p0-prework-design-2026-10-11.md` 已提交

### 4.2 S1 出口门控新增

**新增**：
- [ ] P0-1 Layout nav 无 `<div onClick>`
- [ ] P0-2 全仓 0 处 `<div onClick>`
- [ ] P0-3 图标按钮 aria-label 覆盖率 100%
- [ ] P0-4 tabIndex 关键元素覆盖 >= 50 处
- [ ] P0-5 aria-describedby/aria-live 覆盖 >= 30 处
- [ ] P0-6 prefers-reduced-motion 全局 CSS 已合入

### 4.3 S2 出口门控新增

**新增**：
- [ ] user_role 表 Migration 699/700 up/down 通过
- [ ] 双写回填数据完整性 100%
- [ ] RecipientSpec/Resolver 注册表 6 种 Kind 全注册
- [ ] notification.pipeline_adapter.enabled Flag 默认 off
- [ ] 现有 Escalation/NotificationPolicy 向后兼容测试通过

### 4.4 S3 出口门控新增

**新增**：
- [ ] triage 域 4 Reader 接口全部注册
- [ ] 7 个端点全部有单测
- [ ] Feature Flag `triage.enabled` 默认 off
- [ ] 契约 JSON Schema 已生成

### 4.5 S5 出口门控新增

**新增**：
- [ ] Triage 页面三视图切换可用
- [ ] F1-F8 前端页面全部可访问
- [ ] Command Palette ⌘K 唤起正常
- [ ] 15 条键盘快捷键全部工作
- [ ] Playwright e2e 4 场景通过
- [ ] A11y 验收清单通过（WCAG 2.1 A 级）

### 4.6 S6 出口门控新增

**新增**：
- [ ] Triage 契约测试通过
- [ ] 错误码穷举覆盖 100%
- [ ] 多租户隔离测试通过

---

## 5. 优先级与关键路径

### 5.1 优先级矩阵

| 优先级 | 项 | 原因 |
|---|---|---|
| 🔴 **P0 阻塞** | S0-7, S1-13 ~ S1-18, S2-11 ~ S2-13, S3-15, S5-13, S6-9 | 所有新页面前置 |
| 🟠 **P1 重要** | S5-14, S5-15, S5-16, S5-21 | 前端核心功能 |
| 🟡 **P2 次要** | S5-17, S5-18, S5-19, S5-20 | 增强功能，可延后 |

### 5.2 最小升级集（Critical Path）

若资源受限，按此最小集执行：

```
S0-7 → S1-13 → S1-18 (motion 全局) 
     → S2-11 → S2-12 → S3-15 
     → S5-13 → S6-9
```

**理由**：
- 覆盖 Triage 页面（P0 目标）
- 覆盖 A11y 前置（新页面上线必要条件）
- 覆盖后端 3 个新域（G1/G2/G3）
- 覆盖契约测试（质量保障）

---

## 6. 风险登记

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R-P1 | S1-13 ~ S1-18 修复引入 UI 回归 | 中 | 中 | Feature Flag 灰度 + 视觉回归测试 |
| R-P2 | user_role 双写回填数据丢失 | 低 | 高 | 回填前全量备份 + 分批验证 |
| R-P3 | RecipientSpec 破坏现有规则 | 中 | 高 | 字段 nullable + 向后兼容测试 |
| R-P4 | Triage 契约与前端不一致 | 中 | 中 | JSON Schema 快照 + 契约测试 |
| R-P5 | A11y 前置阻塞 Triage 上线 | 高 | 高 | 并行推进 a11y + Triage 开发 |
| R-P6 | Command Palette 快捷键冲突 | 中 | 低 | ignoreWhen + 冲突检测 |
| R-P7 | Migration 699-703 编号冲突 | 中 | 中 | 依赖 S0 Migration 治理 |

---

## 7. 与 v5.9 的差异对比

| 维度 | v5.9 | v6.0 | 变化 |
|---|---|---|---|
| 任务总数 | 122 | 137 | +15 |
| 阶段数 | 8 + 后续 | 8 + 后续 | 不变 |
| S0 前置 | 6 项 | 7 项 | +1 |
| S1 A11y | 12 项 | 18 项 | +6 |
| S2 后端 | 10 项 | 13 项 | +3 |
| S3 新模块 | 14 项 | 15 项 | +1 |
| S5 前端 | 12 项 | 21 项 | +9 |
| S6 集成 | 8 项 | 9 项 | +1 |
| 门控项 | ~40 | ~55 | +15 |
| Feature Flag | ~10 | ~12 | +2 |
| 新增 ADR | 0 | 0 | 无新增 |
| 新增 Migration | 0 | 5 | +5（699-703）|
| 新增端点 | 0 | 7 | +7（triage API）|
| 新增域 | 0 | 2 | +2（recipient + triage）|

---

## 8. 合并策略

### 8.1 合并步骤（用户手动执行）

```bash
# Step 1: 备份现有 Playbook
cp reports/upgrade-execution-playbook-2026-10-03.md \
   reports/upgrade-execution-playbook-2026-10-03.md.bak

# Step 2: 添加本轮文档到 Playbook 头部"参考文档"节
# Step 3: 添加本补丁描述的 15 项任务到对应阶段章节
# Step 4: 更新关键路径 DAG
# Step 5: 更新门控项
# Step 6: 提交 Playbook v6.0

# Step 7: 验证
git diff reports/upgrade-execution-playbook-2026-10-03.md.bak \
        reports/upgrade-execution-playbook-2026-10-03.md
```

### 8.2 版本命名

- 文件名保持 `upgrade-execution-playbook-2026-10-03.md`
- 头部版本号改为 v6.0
- 变更日志增加 v6.0 条目

---

## 9. 参考文档索引（本轮新增）

| 文档 | 路径 | 用途 |
|---|---|---|
| 后端 G1-G4 设计 | `reports/module-upgrade-designs/role-based-push-and-triage-design-2026-10-11.md` | 后端域建设 |
| 前端 F1-F8 设计 | `reports/module-upgrade-designs/frontend-interaction-optimization-design-2026-10-11.md` | 前端页面 |
| UI 专家评审 | `reports/expert-reviews/triage-ui-domain-expert-design-analysis-2026-10-11.md` | 设计评审 |
| API 契约 | `reports/module-upgrade-designs/triage-api-contract-design-2026-10-11.md` | 前后端契约 |
| 前端实施规格 | `reports/module-upgrade-designs/frontend-triage-implementation-spec-2026-10-11.md` | F1 修订版 + 组件规格 |
| A11y P0 前置 | `reports/module-upgrade-designs/frontend-a11y-p0-prework-design-2026-10-11.md` | 前置任务 |
| Playbook 补丁 | **本文件** | 补录说明 |

---

## 10. 复现命令（⭐ 机械计数）

```bash
cd /Users/heal/orion-design

# 1. Playbook 主文件
ls reports/upgrade-execution-playbook-2026-10-03.md
wc -l reports/upgrade-execution-playbook-2026-10-03.md

# 2. 本补丁文件
ls reports/upgrade-playbook-v6.0-patch-2026-10-11.md
wc -l reports/upgrade-playbook-v6.0-patch-2026-10-11.md

# 3. 本轮新增 15 项任务
grep -c '^\*\*新增任务' reports/upgrade-playbook-v6.0-patch-2026-10-11.md
# 期望: 15（S0+1, S1+6, S2+3, S3+1, S5+9, S6+1）

# 4. 阶段门控更新数
grep -c '门控更新\|门控新增' reports/upgrade-playbook-v6.0-patch-2026-10-11.md

# 5. 风险数
grep -cE '^\| R-[A-Z][0-9]+' reports/upgrade-playbook-v6.0-patch-2026-10-11.md

# 6. 参考文档索引
grep -c '^\| `' reports/upgrade-playbook-v6.0-patch-2026-10-11.md

# 7. 所有引用文档存在性
for f in \
  reports/module-upgrade-designs/role-based-push-and-triage-design-2026-10-11.md \
  reports/module-upgrade-designs/triage-api-contract-design-2026-10-11.md \
  reports/module-upgrade-designs/frontend-triage-implementation-spec-2026-10-11.md \
  reports/module-upgrade-designs/frontend-interaction-optimization-design-2026-10-11.md \
  reports/module-upgrade-designs/frontend-a11y-p0-prework-design-2026-10-11.md \
  reports/expert-reviews/triage-ui-domain-expert-design-analysis-2026-10-11.md; do
  test -f "$f" && echo "OK: $f" || echo "MISS: $f"
done

# 8. 未修改 Playbook 主文件（本补丁作为独立文档）
git diff --name-only reports/upgrade-execution-playbook-2026-10-03.md
# 期望: 空（除非人工合并）
```

---

## 11. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 新增 15 项任务描述完整 | §2 |
| 2 | 阶段依赖 DAG 更新 | §3 |
| 3 | 6 项阶段门控更新 | §4 |
| 4 | 优先级矩阵 + 最小升级集 | §5 |
| 5 | 7 项风险登记 | §6 |
| 6 | 与 v5.9 差异对比完整 | §7 |
| 7 | 合并策略明确 | §8 |
| 8 | 参考文档索引齐全 | §9 |
| 9 | 未修改 Playbook 主文件（用户手动合并）| 本文件为补丁说明 |
| 10 | 未修改生产代码 | `git status --porcelain` 生产扩展名 空 |
| 11 | 未估算人天/工期 | 全文检索禁词为空 |

---

*本补丁说明汇总了本轮 6 份设计文档（后端 G1-G4 / 前端 F1-F8 / UI 专家评审 / API 契约 / 前端实施规格 / A11y P0 前置）
对现有 Playbook v5.9 的影响，明确列出 15 项新增任务 + 6 项阶段门控更新 + 关键路径扩展。

由于不修改 Playbook 主文件（避免与并发会话冲突），本补丁作为独立文档供用户/维护者手动合并。

合并后 Playbook 版本升级为 v6.0（122 → 137 项任务）。*
