# 前端 A11y P0 前置任务设计

**评审对象**：`orion-frontend` 现有 P0 a11y 阻塞项（6 项）实施前置设计
**文档性质**：实施前置设计（Prework Design），非修复代码
**关联文档**：
- 上游：`frontend-fix-tasks-2026-10-03.md` §1（P0-1 ~ P0-6 定义）
- 下游：`frontend-triage-implementation-spec-2026-10-11.md`（P0 完成后才能上线 Triage）
- Playbook 补录：`upgrade-playbook-v6.0-patch-2026-10-11.md`

**硬约束**：
- **RC-03**：设计文档，不修改生产代码。
- **不估算人天/工期**。
- **⚠️ 前置依赖**：本设计定义的 P0-1 ~ P0-6 完成后，任何新页面（含 Triage / UserRole / Command Palette）才能上线。
- **A11y 强制基线**：WCAG 2.1 A 级（键盘可访问 + 焦点可见 + 语义正确 + 动画可关）。

---

## 0. 现状盘点

现有 P0 阻塞项（`frontend-fix-tasks-2026-10-03.md` §1）：

| # | 项 | 现状 | 严重度 | 影响面 |
|---|---|---|---|---|
| **P0-1** | Layout 主导航用 `<div onClick>` | 1 处代码锁死 40+ 入口 | 🔴 阻塞 | 全站导航不可用 |
| **P0-2** | 全仓 101 处 `<div onClick>` | 分散在 30+ 目录 | 🔴 阻塞 | 键盘 / 屏幕阅读器 |
| **P0-3** | 2262 个按钮缺少 `aria-label` | 全仓统计 | 🔴 阻塞 | 屏幕阅读器用户 |
| **P0-4** | 全仓 0 处 `tabIndex` | 0 覆盖 | 🔴 阻塞 | 键盘导航 |
| **P0-5** | 0 处 `aria-describedby` + 0 处 `aria-live` | 0 覆盖 | 🟠 严重 | 表单错误提示 + 状态更新 |
| **P0-6** | 0 处 `prefers-reduced-motion` 媒体查询 | 0 覆盖 | 🟠 严重 | 前庭障碍用户 |

**当前状态**：全部未修复，任何新页面（Triage / UserRole / Command Palette）均**不能上线**。

---

## 1. 修复原则

### 1.1 全局规则（所有修复必须遵守）

1. **语义优先**：`<button>` > `<a>` > 语义 div
2. **可见焦点**：`:focus-visible` 必须显示 2px 蓝色环
3. **屏幕阅读器友好**：`aria-label` / `aria-describedby` / `aria-live` 三件套
4. **可键盘操作**：`tabIndex` 显式设置（可跳转元素 `=0`，隐藏 `=-1`）
5. **动画可关**：所有动效必须响应 `prefers-reduced-motion`
6. **对比度**：所有文字/图标 ≥ 4.5:1（WCAG AA 级）

### 1.2 修复顺序原则

- **先阻塞后严重**（P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6）
- **先全站后局部**（Layout > 通用组件 > 页面组件）
- **先语义后装饰**（button/aria > 焦点环 > 动画）

### 1.3 分批提交原则

每次提交**必须**满足：
- 单一职责（一次修一类问题）
- 可验证（有 e2e / 视觉回归测试）
- 可回滚（feature flag 隔离高风险项）

---

## 2. P0-1 修复设计：Layout 主导航

### 2.1 现状代码

**位置**：`orion-frontend/src/components/Layout/index.tsx:140-194`

```tsx
<div
  onClick={() => onNavigate(item.key, item.label)}
  style={{ cursor: 'pointer', ... }}
>
  ...
</div>
```

### 2.2 问题

- `<div onClick>` 对键盘用户**完全不可访问**
- 无焦点管理（Tab 无法到达）
- 无屏幕阅读器识别
- **1 处代码锁死全站 40+ 菜单入口**（放大问题严重度）

### 2.3 修复方案

**改为 `<button>` 或 `<a>`**（根据语义选择）：

**方案 A（推荐）**：使用 `<button>`

```tsx
<button
  role="menuitem"
  onClick={() => onNavigate(item.key, item.label)}
  className={classNames('nav-item', { active: isActive })}
  aria-current={isActive ? 'page' : undefined}
  tabIndex={isActive ? 0 : -1}
>
  {item.icon && <span aria-hidden="true">{item.icon}</span>}
  <span className="nav-label">{item.label}</span>
</button>
```

**方案 B**：使用 `<a>`（如果导航语义更强）

```tsx
<a
  role="menuitem"
  href={`#${item.key}`}
  onClick={(e) => { e.preventDefault(); onNavigate(item.key, item.label) }}
  className={classNames('nav-item', { active: isActive })}
  aria-current={isActive ? 'page' : undefined}
  tabIndex={isActive ? 0 : -1}
>
  ...
</a>
```

**推荐 A**（button 更符合"触发动作"语义，a 更适合"跳转到 URL"语义；Layout 是菜单不是链接）。

### 2.4 键盘支持

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusNextMenu()
      break
    case 'ArrowUp':
      e.preventDefault()
      focusPrevMenu()
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      onNavigate(item.key, item.label)
      break
  }
}
```

**⚠️ 折叠菜单**：`ArrowRight` 展开子菜单，`ArrowLeft` 折叠

### 2.5 焦点管理

```tsx
// 使用 roving tabindex 模式
const [activeIndex, setActiveIndex] = useState(0)

{menuItems.map((item, i) => (
  <button
    key={item.key}
    tabIndex={i === activeIndex ? 0 : -1}
    ref={i === activeIndex ? activeRef : undefined}
    ...
  />
))}
```

### 2.6 视觉焦点环

```css
.nav-item:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### 2.7 验证清单

- [ ] 键盘 Tab 进入 Layout 导航
- [ ] Arrow 键上下移动
- [ ] Enter 激活当前项
- [ ] 焦点环可见（`:focus-visible`）
- [ ] 屏幕阅读器朗读"菜单项，选中/未选中"
- [ ] 折叠菜单 Arrow 左右支持
- [ ] e2e 覆盖（8 大菜单模块跳转）

---

## 3. P0-2 修复设计：101 处 `<div onClick>` 批量

### 3.1 现状分布

**位置**：分散在 30+ 目录，`grep` 命令见 `frontend-fix-tasks.md` §1

**分批策略**：

| 批次 | 目录 | 数量 | 优先级 |
|---|---|---|---|
| 1 | `pages/AlertList` | 12 | 🔴 高（核心业务）|
| 2 | `pages/TicketDetail` | 15 | 🔴 高（P1-1 关联）|
| 3 | `pages/DashboardNew` | 10 | 🟠 中（首页）|
| 4 | `pages/Settings/*` | 20 | 🟠 中 |
| 5 | `components/*` | 44 | 🟡 低（含 CardPanel 等弃用组件）|

### 3.2 通用修复模板

**判断逻辑**：
```typescript
function shouldUseButton(element) {
  // 如果是纯动作触发 → button
  // 如果是导航跳转 → a
  // 如果是内容展示（不该点击）→ 移除 onClick
}
```

**替换模板**：

```tsx
// ❌ Before
<div onClick={handler} className="card">
  <span>{title}</span>
</div>

// ✅ After
<button onClick={handler} className="card" aria-label={title}>
  <span>{title}</span>
</button>
```

### 3.3 常见陷阱

1. **`<div onClick>` 包含子元素也带 onClick** → 事件冒泡，需 `e.stopPropagation()`
2. **`cursor: pointer` 但实际不该点击**（如装饰性 div）→ 移除 cursor
3. **`<div onClick>` 内部还有 `<a>`** → 嵌套交互元素违反 ARIA，必须拆开
4. **`onClick` 是导航到 URL** → 应改为 `<a>` 而非 `<button>`

### 3.4 分批策略

**每批 20-30 处**，避免大规模重构。

- **批 1**：AlertList + TicketDetail 关键路径（27 处，1 天）
- **批 2**：DashboardNew + 3 大页面（30 处，1 天）
- **批 3**：Settings 系列（20 处，1 天）
- **批 4**：components 通用组件（含 CardPanel 弃用，需先决定 CardPanel 是否重构）
- **批 5**：其他杂项（14 处）

---

## 4. P0-3 修复设计：2262 按钮 aria-label

### 4.1 现状

`grep -rn '<button[^>]*>[^<]*<[^>]*>[^<]*</button>' orion-frontend/src --include='*.tsx'`

**特点**：2262 个按钮中：
- 文本按钮（有内容）：可自动从内容派生 aria-label
- 图标按钮（`<DeleteOutlined />` 等）：**必须手写 aria-label**
- 图标+文字按钮：aria-label 用文字部分

### 4.2 图标按钮分类

| 图标 | 常见 aria-label | 用途 |
|---|---|---|
| `<DeleteOutlined />` | "删除" | 删除操作 |
| `<CloseOutlined />` | "关闭" | 关闭 Modal/Drawer |
| `<SaveOutlined />` | "保存" | 保存操作 |
| `<RefreshOutlined />` | "刷新" | 刷新数据 |
| `<EditOutlined />` | "编辑" | 编辑操作 |
| `<SearchOutlined />` | "搜索" | 触发搜索 |
| `<FilterOutlined />` | "筛选" | 打开筛选器 |
| `<BellOutlined />` | "通知" | 打开通知面板 |
| `<SettingOutlined />` | "设置" | 打开设置 |
| `<MenuOutlined />` | "菜单" | 打开侧边栏 |

### 4.3 修复策略

**Phase 1：全局搜索 + 批量修复**（图标按钮）

```bash
grep -rn '<button[^>]*>[^<]*<DeleteOutlined' orion-frontend/src --include='*.tsx'
```

按图标分类批量修复。

**Phase 2：静态检查**（CI 集成）

```typescript
// 简单 lint 规则
export const rule = {
  name: 'no-icon-button-without-aria-label',
  test: (node) => {
    if (node.name !== 'button') return
    const hasAriaLabel = hasAttribute(node, 'aria-label')
    const hasTextContent = hasTextContent(node)
    const hasIconOnly = isIconOnly(node)
    return hasAriaLabel || hasTextContent || !hasIconOnly
  }
}
```

### 4.4 特殊情况

- **动态 aria-label**：`aria-label={`删除 ${record.name}`}`
- **多语言**：`aria-label={t('action.delete')}`（i18n）
- **条件 aria-label**：`aria-label={isDisabled ? '已禁用' : '保存'}`

---

## 5. P0-4 修复设计：tabIndex 设置

### 5.1 现状

全仓 0 处 `tabIndex`。

### 5.2 需要设置的位置

| 场景 | tabIndex 值 | 用途 |
|---|---|---|
| 自定义可交互元素（div role=button 等）| `0` | 键盘可到达 |
| 焦点序列中的当前焦点 | `0` | 当前焦点 |
| 焦点序列中的非当前 | `-1` | 键盘不可达但可通过 JS 聚焦 |
| 隐藏/禁用元素 | `-1` | 键盘不可达 |
| 焦点陷阱容器（Modal/Drawer）| `0` | 焦点限制在容器内 |

### 5.3 修复策略

**Roving Tabindex 模式**（用于菜单 / 列表 / 树）：

```tsx
const [activeIndex, setActiveIndex] = useState(0)

<ul role="listbox">
  {items.map((item, i) => (
    <li
      key={item.id}
      role="option"
      aria-selected={i === activeIndex}
      tabIndex={i === activeIndex ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      {item.label}
    </li>
  ))}
</ul>
```

**焦点陷阱**（Modal/Drawer）：

```tsx
function FocusTrap({ children }) {
  const ref = useRef<HTMLDivElement>(null)
  const [prevFocus, setPrevFocus] = useState<HTMLElement>()
  
  useEffect(() => {
    setPrevFocus(document.activeElement)
    ref.current?.focus()
    
    const handleTab = (e: KeyboardEvent) => {
      if (!e.shiftKey && isLastFocusable(ref.current!)) {
        e.preventDefault()
        focusFirst(ref.current!)
      }
    }
    
    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleTab)
      prevFocus?.focus()
    }
  }, [])
  
  return <div ref={ref} tabIndex={-1}>{children}</div>
}
```

### 5.4 修复清单（按 P0-4 定位）

- Layout 菜单项（配合 P0-1 修复）
- 卡片组件的可点击区域
- 表格行的编辑按钮
- 自定义列表项
- 时间线节点

---

## 6. P0-5 修复设计：aria-describedby + aria-live

### 6.1 aria-describedby（表单错误提示）

**位置**：所有表单组件

**修复模板**：

```tsx
<Input
  id="username"
  aria-label="用户名"
  aria-describedby="username-error username-help"
  aria-invalid={hasError}
/>
<span id="username-help" className="help-text">
  长度 3-20 字符
</span>
{hasError && (
  <span id="username-error" role="alert">
    {errorMessage}
  </span>
)}
```

### 6.2 aria-live（状态更新提示）

**场景分类**：

| 场景 | aria-live 值 | 用途 |
|---|---|---|
| Toast / Message | `assertive` | 打断式提示 |
| 状态变更（loading/success）| `polite` | 静默更新 |
| 屏幕阅读器专用 | `assertive` | 重要变更 |

**修复模板**：

```tsx
// Toast / Notification
<Toast aria-live="assertive" role="alert">
  保存成功
</Toast>

// 状态卡片
<Card aria-live="polite" aria-atomic="true">
  <StatusBadge status={status} />
</Card>

// 空态
<EmptyState aria-live="polite">
  暂无数据
</EmptyState>
```

### 6.3 修复清单

- 表单输入（`Input` / `Select` / `DatePicker` 等）：aria-describedby 指向错误消息
- 状态卡片（Loading / Success / Error）：aria-live
- Toast / Message：aria-live + role="alert"
- 数据加载指示：aria-live="polite"

---

## 7. P0-6 修复设计：prefers-reduced-motion

### 7.1 修复方案（全局 CSS）

**位置**：`orion-frontend/src/index.css` 或 `src/tokens/animations.css`

```css
/* 尊重用户的动画偏好设置 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* 保留 opacity 变化，但不做动画 */
  [data-animate-opacity] {
    transition: opacity 0.01ms !important;
  }
}
```

### 7.2 组件级支持

对于动画密集组件，用 `useReducedMotion` hook：

```tsx
function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setPrefersReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  
  return prefersReduced
}
```

```tsx
const prefersReduced = useReducedMotion()

<Spin spinning={loading} className={prefersReduced ? 'no-animation' : ''} />
```

### 7.3 修复清单

- 全局 CSS 加媒体查询（1 处）
- 动画密集组件（Card hover / Modal fade / 表格行高亮）加条件（10+ 处）
- 测试：DevTools → Rendering → Emulate CSS media features → prefers-reduced-motion → 验证动画停止

---

## 8. 执行计划（依赖关系）

### 8.1 依赖图

```
P0-6 (prefers-reduced-motion)     [独立]
    ↓
    └─→ 全局 CSS 一处，独立完成
    └─→ 组件级 hook 可延后

P0-1 (Layout nav)  ─┬─→ P0-2 批 1 (AlertList / TicketDetail)
                     │
                     ├─→ P0-4 tabIndex (Layout 部分)
                     │
P0-3 (aria-label)  ──┴─→ [可与 P0-2 并行]

P0-5 (aria-describedby + live)  [独立]
```

### 8.2 提交顺序

| 提交 | 内容 | 依赖 | Feature Flag |
|---|---|---|---|
| #1 | P0-6 全局 CSS（1 处）| 无 | 无（全局）|
| #2 | P0-3 图标按钮 aria-label（2262 处）| 无 | 无 |
| #3 | P0-1 Layout nav（1 处代码，影响 40+ 入口）| #2 | ✅ `layout-nav-a11y-v2` |
| #4 | P0-4 tabIndex + roving tabindex 模式 | #3 | 无 |
| #5 | P0-2 批 1：AlertList + TicketDetail（27 处）| #3 | 无 |
| #6 | P0-2 批 2：DashboardNew + Settings（30 处）| #5 | 无 |
| #7 | P0-2 批 3-5：components + 其他（58 处）| #6 | 无 |
| #8 | P0-5 aria-describedby + aria-live（全仓）| #2 | 无 |

### 8.3 Feature Flag 策略

**唯一使用 flag 的提交**：#3（P0-1 Layout nav）

**原因**：Layout nav 影响全站 40+ 入口，回归风险高。

```tsx
// orion-frontend/src/components/Layout/index.tsx
const layoutNavV2 = useFeatureFlag('layout-nav-a11y-v2')

return layoutNavV2
  ? <NewLayoutNav />  // 修复后
  : <OldLayoutNav />  // 原代码
```

**灰度策略**：
1. 内部环境打开（100%）
2. 灰度 10% 用户
3. 灰度 50% 用户
4. 全量

---

## 9. 测试要求

### 9.1 单元测试

- **P0-1**：Layout nav 键盘导航（Arrow 键 + Enter + Roving tabindex）
- **P0-2**：每处修复后的 `<button>` / `<a>` 渲染正确
- **P0-3**：aria-label 存在且非空
- **P0-4**：tabIndex 正确设置（0/-1）
- **P0-5**：aria-describedby 指向正确元素；aria-live 区域存在
- **P0-6**：媒体查询匹配时动画类不生效

### 9.2 集成测试（Playwright）

- **键盘导航 e2e**：Tab → Layout nav → Arrow → 进入页面
- **屏幕阅读器 e2e**：使用 `aria-query` 验证角色和属性
- **prefers-reduced-motion e2e**：模拟媒体查询，验证动画停止

### 9.3 视觉回归测试

- Layout nav 修复前后视觉对比
- 焦点环视觉验证
- 无动画模式下的视觉对比

---

## 10. 与 Triage 上线的关系

### 10.1 前置依赖

**Triage 页面必须依赖以下修复**：

| Triage 组件 | 依赖修复 | 说明 |
|---|---|---|
| ViewSwitcher | P0-1, P0-4 | 键盘 ← → + Roving tabindex |
| TriageItemRow | P0-3, P0-4 | 按钮 aria-label + tabIndex |
| BulkActionBar | P0-5 | aria-live 通知选中数 |
| 所有动效 | P0-6 | prefers-reduced-motion |
| 空态/错误态 | P0-5 | aria-live |
| 命令面板 Modal | P0-1, P0-4 | 焦点陷阱 |

### 10.2 门控规则

```
if (P0-1 not completed) or (P0-3 not completed) or (P0-6 not completed):
    Triage 页面禁止上线
    错误：`Triage blocked by P0 a11y prework`
```

---

## 11. 风险与降级

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| R-A1 Layout nav 修复破坏视觉 | 中 | 中 | Feature Flag 灰度 + 视觉回归测试 |
| R-A2 101 处 `<div onClick>` 修复引入 bug | 中 | 中 | 分批 + 每批 e2e |
| R-A3 tabIndex 全局改动影响原有焦点顺序 | 高 | 中 | 每批单独测试 + 焦点回归测试 |
| R-A4 prefers-reduced-motion 影响现有动画 | 低 | 低 | 用户主动设置，不默认 |
| R-A5 aria-live 过多导致屏幕阅读器嘈杂 | 中 | 中 | 只在真正需要时加，避免滥用 |
| R-A6 CI 静态检查引入误报 | 中 | 低 | 白名单机制 + 团队评审 |
| R-A7 Triage 上线被阻塞（前置未修）| 中 | 高 | 并行推进 a11y 修复 + Triage 开发 |

---

## 12. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | P0-1 ~ P0-6 现状盘点完整 | §0 |
| 2 | 修复原则 6 条明确 | §1.1 |
| 3 | P0-1 Layout nav 修复方案完整（含键盘 + 焦点环）| §2 |
| 4 | P0-2 101 处分批策略明确（5 批）| §3 |
| 5 | P0-3 2262 按钮 aria-label 分类 + 修复模板 | §4 |
| 6 | P0-4 tabIndex 修复模式（Roving + Focus Trap）| §5 |
| 7 | P0-5 aria-describedby + aria-live 场景分类 | §6 |
| 8 | P0-6 prefers-reduced-motion 全局 + 组件级方案 | §7 |
| 9 | 8 个提交顺序 + Feature Flag 策略 | §8 |
| 10 | 3 类测试要求 | §9 |
| 11 | Triage 上线门控明确 | §10 |
| 12 | 7 项风险与缓解 | §11 |
| 13 | 未修改生产代码 | `git status --porcelain` 生产扩展名 空 |
| 14 | 未估算人天/工期 | 全文检索禁词为空 |

---

*本设计定义了 P0-1 ~ P0-6 六项 a11y 阻塞的完整实施规格，明确了 8 次提交顺序 + 1 个 Feature Flag（P0-1 Layout nav）+ 12 项测试要求。

Triage 页面（frontend-triage-implementation-spec-2026-10-11.md）必须依赖本设计定义的 6 项修复完成后才能上线。

修复原则：语义优先 / 焦点可见 / 屏幕阅读器友好 / 可键盘操作 / 动画可关 / 对比度达标。*
