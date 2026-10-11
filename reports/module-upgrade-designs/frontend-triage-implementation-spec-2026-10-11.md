# 前端 Triage 实施规格（F1-F8 + UI 专家评审修订）

**评审对象**：`orion-frontend/src/pages/Triage/` 完整实现规格
**文档性质**：实施规格（Implementation Spec），非代码
**版本**：v1.1（含 UI 专家评审修订，见 §3 修订记录）
**关联文档**：
- F1-F8 原始方案：`frontend-interaction-optimization-design-2026-10-11.md`
- UI 专家评审：`triage-ui-domain-expert-design-analysis-2026-10-11.md`（综合 6.2/10）
- 后端 API 契约：`triage-api-contract-design-2026-10-11.md`
- 后端设计：`role-based-push-and-triage-design-2026-10-11.md` §3.3
- A11y 前置：`frontend-a11y-p0-prework-design-2026-10-11.md`（本目录）
- Playbook 补录：`upgrade-playbook-v6.0-patch-2026-10-11.md`

**硬约束**：
- **RC-03**：实施规格，不修改生产代码。
- **不估算人天/工期**。
- **不引入新依赖**（不新增 cmdk / react-hotkeys / react-window 等；全部用现有依赖）。
- **A11y 前置依赖**：所有新页面必须在 P0-1 ~ P0-6 a11y 修复完成后上线（见 a11y 前置设计）。

---

## 1. 修订记录（UI 专家评审 → F1 修订）

UI 专家评审给出综合 6.2/10，指出 3 处**必须修订**（关闭 "设计 → 评审 → 修订" 回路）：

| 评审意见 | 原 F1 | 修订后 |
|---|---|---|
| **R1**：单一列表覆盖不了 4 类用户 | `MyOverviewCard + MyItemsTable + FilterBar` 单一布局 | **三视图切换** `OverviewView / QueueView / TimelineView`（详见 §3.2） |
| **R2**：归类维度需多维复合 | `FilterBar` 只支持单维度过滤 | `groupBy` 分组维度切换（5 选 1） + 过滤器叠加（对齐 API §3.2） |
| **R3**："值班中"视觉语言缺失 | 复用 `StatusBadge`（无值班状态） | 新增 `OnCallStatusCard`（`animation.pulse` + `colors.success[500]`，见 UI §5.1） |

**修订后 F1 目录结构**：

```
orion-frontend/src/pages/Triage/
├── index.tsx                      # 主入口 + 视图切换器
├── components/
│   ├── ViewSwitcher.tsx           # ★ 新增（三视图切换）
│   ├── OnCallStatusCard.tsx       # ★ 新增（"值班中"视觉语言）
│   ├── SeveritySourceMatrix.tsx   # ★ 新增（4×4 热力矩阵）
│   ├── RecentActivityFeed.tsx     # ★ 新增（Overview 活动流）
│   ├── GroupedListRenderer.tsx    # ★ 新增（Queue 分组渲染）
│   ├── TriageItemRow.tsx          # ★ 新增（单条待办渲染）
│   ├── BulkActionBar.tsx          # ★ 新增（底部批量操作条）
│   ├── FilterBar.tsx              # 扩展（支持 groupBy + filterType 组合）
│   ├── TimelineTrack.tsx          # ★ 新增（Timeline 视图）
│   └── MyOverviewCard.tsx         # 保留（Overview 视图内复用）
├── views/
│   ├── OverviewView.tsx           # ★ 新增视图容器
│   ├── QueueView.tsx              # ★ 新增视图容器
│   └── TimelineView.tsx           # ★ 新增视图容器
├── hooks/
│   ├── useTriageData.ts           # 数据聚合（并行 4 API + WS 增量）
│   ├── useTriageActions.ts        # 动作分发（ack/dismiss 透传）
│   ├── useTriageFilters.ts        # 过滤器 + 分组状态管理
│   └── useHotkeys.ts              # ★ 新增（键盘快捷键，见 §4）
├── commands.ts                    # ★ 新增（命令面板注册表）
├── types.ts                       # TriageItem / MyOverview（对齐 API §2）
├── constants.ts                   # 严重度色映射 / 图标映射 / 快捷键定义
└── __tests__/
    ├── index.test.tsx
    └── hooks/useTriageData.test.ts
```

**新增组件数**：10 个（ViewSwitcher / OnCallStatusCard / SeveritySourceMatrix / RecentActivityFeed / GroupedListRenderer / TriageItemRow / BulkActionBar / TimelineTrack + 3 个视图容器）
**新增 hook 数**：3 个（useTriageData / useTriageActions / useTriageFilters + useHotkeys）

---

## 2. 数据流（Data Flow）

### 2.1 数据源

对齐 API 契约（`triage-api-contract-design-2026-10-11.md` §1.1）：

```
4 个数据源（后端 API）：
├── GET /v1/triage/me             (overview 聚合)
├── GET /v1/triage/me/items       (列表 + 过滤 + 分组)
├── GET /v1/triage/me/alerts      (告警子集)
├── GET /v1/triage/me/tickets     (工单子集)
├── GET /v1/triage/me/oncall      (值班子集)
└── WS /api/v1/ws/triage          (3 事件: item.new/updated, oncall.handoff)

动作端点（写）：
├── POST /v1/triage/me/items/:id/ack
└── POST /v1/triage/me/items/:id/dismiss
```

### 2.2 前端状态管理

```typescript
// useTriageData 返回的完整状态
interface TriageState {
  view: 'overview' | 'queue' | 'timeline'
  data: {
    overview: MyOverview | null
    items: TriageItem[]
    groups: TriageItemGroup[]
    onCall: OnCallInfo | null
  }
  filter: {
    severity: SeverityLevel[]
    kind: TriageItemKind[]
    status: TriageStatus[]
    assignedScope: 'self' | 'role' | 'team' | 'all'
    timeRange: TimeRangePreset
    slaStatus: 'overdue' | 'breaching' | 'healthy' | undefined
    excludeDND: boolean
  }
  groupBy: 'severity' | 'kind' | 'status' | 'assigned' | 'time'
  sortBy: 'recency' | 'severity' | 'sla'
  sortOrder: 'asc' | 'desc'
  pagination: { offset: number; limit: number; total: number }
  selectedIds: Set<string>
  sourceHealth: { alerts: 'ok'|'loading'|'error'; tickets: ...; oncall: ...; notifications: ... }
  lastSync: Date | null
  isDNDActive: boolean
}
```

### 2.3 数据流时序

```
用户访问 /triage
  ↓
useTriageData.loadAll()
  ↓ (Promise.allSettled 并行)
  ├─ GET /triage/me           → overview
  ├─ GET /triage/me/items     → items + groups
  ├─ GET /triage/me/oncall    → onCall
  └─ WS /ws/triage            → subscribe (async)
  ↓
渲染 OverviewView（默认视图）
  ├─ OnCallStatusCard.onCall
  ├─ KPI Cards × 4
  ├─ SeveritySourceMatrix (from overview)
  └─ RecentActivityFeed (from overview.recent_items)
  ↓
用户切换到 QueueView
  ↓
useTriageFilters 应用 → 请求参数变化
  ↓
useTriageData.loadItems()
  ↓
GET /triage/me/items?severity=critical,high&group_by=severity
  ↓
渲染 GroupedListRenderer(groups)
  ├─ GroupHeader (severity=critical, count=3)
  │   └─ TriageItemRow × 3
  ├─ GroupHeader (severity=high, count=8)
  │   └─ TriageItemRow × 8
  └─ ...
  ↓
用户按 `a` 键 → useHotkeys
  ↓
useTriageActions.acknowledge(selectedId)
  ↓
乐观更新（本地 items 移除该条）
  ↓
POST /triage/me/items/:id/ack
  ├─ 成功 → WebSocket 收到 item.updated 事件（幂等处理）
  └─ 失败 → 回滚（100ms fade-in 动画）
```

---

## 3. Hook 规格

### 3.1 `useTriageData` — 数据聚合

```typescript
// hooks/useTriageData.ts (伪代码)
export function useTriageData(): TriageDataResult {
  const [state, setState] = useState<TriageState>(initialState)
  const [wsConnection, setWsConnection] = useState<'connecting'|'connected'|'disconnected'>('connecting')

  // 1. 初始加载（Promise.allSettled 保证单源失败不阻塞）
  const loadAll = useCallback(async () => {
    setState(s => ({ ...s, sourceHealth: markAllLoading(s.sourceHealth) }))
    
    const [ovr, items, oncall, alerts, tickets] = await Promise.allSettled([
      triageApi.getMyOverview({ recent_limit: 10 }),
      triageApi.getMyItems({ ...state.filter, group_by: state.groupBy, ...state.pagination }),
      triageApi.getMyOnCall(),
      triageApi.getMyAlerts(),
      triageApi.getMyTickets(),
    ])
    
    applyResult('overview', ovr, setState)
    applyResult('items', items, setState)
    applyResult('oncall', oncall, setState)
    
    setState({ ...prev, lastSync: new Date() })
  }, [state.filter, state.groupBy, state.pagination])

  // 2. WebSocket 订阅
  useEffect(() => {
    const ws = new WebSocketClient('/api/v1/ws/triage', {
      onEvent: (evt) => {
        switch (evt.event) {
          case 'triage.item.new':
            setState(s => ({ ...s, items: [evt.data.item, ...s.items] }))
            // 更新 KPI 计数
            break
          case 'triage.item.updated':
            setState(s => ({ ...s, items: removeItem(s.items, evt.data.external_id) }))
            break
          case 'triage.oncall.handoff':
            setState(s => ({ ...s, onCall: evt.data.to_user === me ? null : s.onCall }))
            break
        }
      },
      onStatus: setStatus,
    })
    ws.connect()
    return () => ws.close()
  }, [])

  // 3. 轮询降级（WS 断开时 30s 轮询一次）
  useEffect(() => {
    if (wsConnection !== 'connected') {
      const t = setInterval(loadAll, 30000)
      return () => clearInterval(t)
    }
  }, [wsConnection])

  return { ...state, loadAll, loadItems: loadAll }
}
```

**关键实现要点**：
- **Promise.allSettled** 保证单源失败降级（对齐 UI §7.2 + API §3.1）
- **乐观更新**（Ack/Dismiss）：本地立即移除，失败则 100ms fade-in 回滚（对齐 UI §6.3 + R-UI9）
- **WS 增量**：`item.new` 直接追加，`item.updated` 直接移除，无需全量刷新
- **WS 降级**：断开时 30s 轮询
- **节流**：过滤条件变化时 300ms debounce（防抖过滤）

### 3.2 `useTriageActions` — 动作分发

```typescript
export function useTriageActions(): {
  acknowledge: (id: string) => Promise<void>
  dismiss: (id: string, reason?: string) => Promise<void>
  batchAcknowledge: (ids: string[]) => Promise<{ success: number; failed: number }>
} {
  const optimisticUpdate = useOptimisticUpdate()
  
  const acknowledge = async (id: string) => {
    // 1. 乐观更新
    const prev = optimisticUpdate('remove', id)
    
    // 2. Idempotency-Key（防重复点击）
    const idempotencyKey = crypto.randomUUID()
    
    try {
      await triageApi.ackItem(id, { idempotencyKey })
      // 成功：保留乐观更新
    } catch (err) {
      if (err.code === 'TRIAGE_ITEM_ALREADY_ACKNOWLEDGED') {
        // 幂等场景：静默成功
        return
      }
      // 回滚
      optimisticUpdate('restore', id, prev)
      throw err
    }
  }
  
  // 批量：客户端循环 + 限流（对齐 API §3.7）
  const batchAcknowledge = async (ids: string[]) => {
    if (ids.length > 100) {
      await confirmDialog({
        title: '批量操作警告',
        message: `选中的 ${ids.length} 项较多，建议分批处理`,
        danger: true,
      })
    }
    
    let success = 0, failed = 0
    const queue = new Queue(ids, {
      concurrency: 5,          // 并发 5
      delayBetween: 100,       // 每条间隔 100ms
    })
    
    for (const id of queue) {
      try {
        await acknowledge(id)
        success++
      } catch {
        failed++
      }
    }
    
    return { success, failed }
  }
}
```

**关键实现要点**：
- **Idempotency-Key** 强制（`crypto.randomUUID()`，对齐 API §3.6）
- **幂等错误静默**（`TRIAGE_ITEM_ALREADY_ACKNOWLEDGED` → 视为成功）
- **批量限流**：并发 5 + 每条间隔 100ms（对齐 UI §6.2 的 100+ 条警告约束）
- **二次确认**：> 100 条时弹警告对话框

### 3.3 `useTriageFilters` — 过滤器状态

```typescript
export function useTriageFilters(): {
  filter: FilterState
  groupBy: GroupByKey
  updateFilter: (patch: Partial<FilterState>) => void
  resetFilter: () => void
  getURLSearchParams: () => URLSearchParams
  applyURLSearchParams: (params: URLSearchParams) => void
} {
  const [filter, setFilter] = useState(initialFilter)
  const [groupBy, setGroupBy] = useState<GroupByKey>('severity')
  
  // URL 深链支持（对齐 F1 §3.1 要点 4）
  const applyURLSearchParams = (params) => {
    setFilter({
      severity: params.getAll('severity'),
      kind: params.getAll('kind'),
      status: params.getAll('status'),
      assignedScope: params.get('assigned_scope') || 'self',
      timeRange: (params.get('time_range') || '24h') as TimeRangePreset,
      excludeDND: params.get('exclude_dnd') !== 'false',
    })
    setGroupBy((params.get('group_by') || 'severity') as GroupByKey)
  }
  
  // URL 状态同步（浏览器前进后退支持）
  useEffect(() => {
    window.history.replaceState({}, '', `?${getURLSearchParams()}`)
  }, [filter, groupBy])
}
```

**关键实现要点**：
- **URL 深链**：`?severity=critical&kind=alert&group_by=severity`（对齐 F1 §3.1 要点 4）
- **浏览器导航支持**：`history.replaceState` + 支持前进后退
- **Filter 与 GroupBy 独立**：过滤器叠加 vs 分组维度切换互不干扰

### 3.4 `useHotkeys` — 键盘快捷键

```typescript
// hooks/useHotkeys.ts (伪代码)
type HotkeyMap = Record<string, HotkeyHandler>

export function useHotkeys(map: HotkeyMap, options: {
  ignoreWhen?: string[]
  ignoreInputs?: boolean
  enabled?: boolean
} = {}) {
  const { ignoreWhen = ['INPUT', 'TEXTAREA', '[contenteditable]'], enabled = true } = options
  
  useEffect(() => {
    if (!enabled) return
    
    const handler = (e: KeyboardEvent) => {
      // 1. 忽略输入框
      if (ignoreWhen.some(sel => document.activeElement?.matches(sel))) return
      
      // 2. 组合键支持（g→t 序列）
      // 用 sequence state 追踪
   
      const key = `${e.ctrlKey||e.metaKey?'Cmd':''}${e.shiftKey?'Shift':''}${e.key}`
      const action = map[key] || map[e.key]
      
      if (action) {
        e.preventDefault()
        action(e)
      }
    }
    
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [map, enabled])
}
```

**快捷键定义**（对齐 UI §6.1）：

```typescript
// constants/hotkeys.ts
export const TRIAGE_HOTKEYS: HotkeyMap = {
  'Cmd+K':     openCommandPalette,
  '1':         switchToView('overview'),
  '2':         switchToView('queue'),
  '3':         switchToView('timeline'),
  'j':         moveCursorDown,
  'k':         moveCursorUp,
  'Enter':     openSelectedItem,
  'a':         acknowledgeSelected,
  'd':         dismissSelected,
  'Space':     toggleSelectSelected,
  'x':         selectAllInGroup,
  '/':         focusSearch,
  '?':         showHotkeyHelp,
  'Esc':       closeModal,
}
```

---

## 4. 组件规格（10 个新增组件）

### 4.1 `<ViewSwitcher />`

**用途**：三视图切换（对齐 UI §3 三视图设计）

**Props**：

```typescript
interface ViewSwitcherProps {
  value: 'overview' | 'queue' | 'timeline'
  onChange: (v: 'overview' | 'queue' | 'timeline') => void
  items?: { key: string; label: string; badge?: number }[]  // 快捷显示各视图 badge
}
```

**视觉**：Ant Design `<Segmented>` 或自定义 `<div role="tablist">` + 3 个 `<button role="tab">`

**A11y**：
- `role="tablist"` + `role="tab"` + `aria-selected`
- 键盘 ← → 切换
- 激活时 `aria-selected="true"` + 焦点环

**代码骨架**：

```tsx
export function ViewSwitcher({ value, onChange, items }: ViewSwitcherProps) {
  const defaultItems = items || [
    { key: 'overview', label: '全景', badge: 0 },
    { key: 'queue', label: '队列', badge: 30 },
    { key: 'timeline', label: '时间线', badge: 0 },
  ]
  
  return (
    <div role="tablist" aria-label="Triage 视图切换" className="triage-view-switcher">
      {defaultItems.map(item => (
        <button
          key={item.key}
          role="tab"
          aria-selected={value === item.key}
          aria-controls={`panel-${item.key}`}
          tabIndex={value === item.key ? 0 : -1}
          className={classNames('view-switcher-item', { active: value === item.key })}
          onClick={() => onChange(item.key as any)}
        >
          <span>{item.label}</span>
          {item.badge && <Badge count={item.badge} />}
        </button>
      ))}
    </div>
  )
}
```

### 4.2 `<OnCallStatusCard />`

**用途**：显示"值班中"视觉语言（对齐 UI §5.1 R3 新增）

**Props**：

```typescript
interface OnCallStatusCardProps {
  onCall: OnCallInfo | null
  onHandoff: (toUserId: string) => Promise<void>
}
```

**视觉**：
- 有值班：绿色脉冲点（`animation.pulse 1.5s infinite` + `colors.success[500]`）+ 排班信息
- 无值班：空心圆（`colors.neutral[300]`）+ "未在值班"

**A11y**：
- `role="status"` + `aria-live="polite"`（值班状态变更时朗读）
- 交接按钮有 `aria-label="交接给"`

```tsx
export function OnCallStatusCard({ onCall, onHandoff }: OnCallStatusCardProps) {
  if (!onCall?.active) {
    return (
      <Card className="orion-card oncall-card inactive">
        <EmptyState icon="clock" description="当前未在值班" />
      </Card>
    )
  }
  
  const remaining = formatDuration(onCall.remaining_seconds)
  
  return (
    <Card className="orion-card oncall-card active" role="status" aria-live="polite">
      <div className="oncall-header">
        <span className="pulse-dot" aria-hidden="true" />
        <strong>您当前在值班</strong>
        <Tag color="success">{onCall.schedule_name}</Tag>
        <Tag>L{onCall.level}</Tag>
        <span className="remaining">剩余 {remaining}</span>
      </div>
      <div className="oncall-actions">
        <RecipientEditor
          kinds={user}
          placeholder="交接给..."
          onChange={(v) => v.ref && onHandoff(v.ref)}
          accept={singlePicker}
        />
      </div>
    </Card>
  )
}
```

### 4.3 `<SeveritySourceMatrix />`

**用途**：4×4 热力矩阵（对齐 UI §3.1 全景视图）

**Props**：

```typescript
interface SeveritySourceMatrixProps {
  data: MatrixData  // { severity: string[]; kind: string[]; cells: number[][] }
  onCellClick: (severity: SeverityLevel, kind: TriageItemKind) => void
}

type MatrixData = {
  severity: SeverityLevel[]  // [critical, high, medium, low]
  kind: TriageItemKind[]     // [alert, ticket, oncall, change]
  cells: number[][]          // 4×4 矩阵
}
```

**视觉**：
- CSS Grid `grid-template-columns: 100px repeat(4, 1fr)`
- 单元格背景色按数字大小映射到 `colors.error[50]` → `colors.error[500]`
- 点击单元格 → `onCellClick(severity, kind)` → 跳到 QueueView 并自动应用过滤器

**A11y**：
- `role="grid"` + `role="row"` + `role="gridcell"`
- 方向键导航（Tab 进入 + Arrow 上下左右）
- Enter 激活单元格

```tsx
export function SeveritySourceMatrix({ data, onCellClick }: SeveritySourceMatrixProps) {
  return (
    <Card className="orion-card matrix-card" role="grid" aria-label="严重度-来源矩阵">
      <div className="matrix-grid">
        {/* 表头行 */}
        <div className="matrix-corner" />
        {data.kind.map(k => <div key={k} className="matrix-col-header">{KIND_LABEL[k]}</div>)}
        
        {/* 数据行 */}
        {data.severity.map((sev, i) => (
          <React.Fragment key={sev}>
            <div className="matrix-row-header">
              <SeverityBadge severity={sev} />
              {SEVERITY_LABEL[sev]}
            </div>
            {data.kind.map((k, j) => {
              const count = data.cells[i][j]
              const bgAlpha = count === 0 ? 0 : Math.min(count / 20, 1) * 0.6
              return (
                <button
                  key={k}
                  role="gridcell"
                  aria-label={`${SEVERITY_LABEL[sev]} ${KIND_LABEL[k]} ${count} 条`}
                  tabIndex={0}
                  className="matrix-cell"
                  style={{
                    backgroundColor: count === 0 ? undefined :
                      `${SEVERITY_COLOR[sev]}${hexAlpha(bgAlpha)}`,
                  }}
                  onClick={() => onCellClick(sev, k)}
                >
                  {count}
                </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </Card>
  )
}
```

### 4.4 `<TriageItemRow />`

**用途**：单条待办渲染（对齐 UI §4.1 组件树）

**Props**：

```typescript
interface TriageItemRowProps {
  item: TriageItem
  selected: boolean
  isLastInGroup?: boolean
  onAck: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
  onOpen: (item: TriageItem) => void
  onSelect: (id: string, checked: boolean) => void
}
```

**视觉**：
- 左侧：复选框 + 图标（Kind 图标）
- 中部：标题 + 严重度徽章 + 归属/时限元信息
- 右侧：Ack / Dismiss / Open 按钮

```tsx
export function TriageItemRow({
  item, selected, isLastInGroup, onAck, onDismiss, onOpen, onSelect
}: TriageItemRowProps) {
  const isOverdue = item.sla_deadline && new Date(item.sla_deadline) < new Date()
  const isBreaching = isBreachingSLA(item)  // 距离 deadline < 15min
  
  return (
    <div
      role="listitem"
      tabIndex={0}
      className={classNames('triage-item-row', {
        selected,
        [item.severity]: true,
        'is-overdue': isOverdue,
        'is-breaching': isBreaching,
        'is-last-in-group': isLastInGroup,
      })}
      aria-label={`${item.title} ${item.severity || '普通'} ${item.status}`}
      onClick={(e) => !e.target.closest('button, input') && onOpen(item)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(item)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(item.external_id, e.target.checked)}
        aria-label={`选择 ${item.title}`}
      />
      <span className="item-icon">{KIND_ICON[item.kind]}</span>
      <div className="item-content">
        <div className="item-title">{item.title}</div>
        <div className="item-meta">
          <SeverityBadge severity={item.severity} />
          <span>· {formatTimeAgo(item.created_at)}</span>
          <span>· 分配给 {item.assigned_to}</span>
          {item.sla_deadline && (
            <span className={classNames('sla-badge', isOverdue && 'overdue')}>
              {isOverdue ? '⚠️ 已超时' : `SLA 剩 ${formatDuration(remaining)}`}
            </span>
          )}
        </div>
      </div>
      <div className="item-actions">
        <button
          onClick={() => onAck(item.external_id)}
          aria-label={`确认 ${item.title}`}
          disabled={item.kind === 'oncall'}
        >
          Ack
        </button>
        <button
          onClick={() => onDismiss(item.external_id)}
          aria-label={`忽略 ${item.title}`}
          disabled={item.kind === 'oncall' || item.kind === 'change'}
        >
          Dismiss
        </button>
        <button
          onClick={() => onOpen(item)}
          aria-label={`打开 ${item.title} 详情`}
        >
          Open ↗
        </button>
      </div>
    </div>
  )
}
```

### 4.5 `<BulkActionBar />`

**用途**：底部批量操作条（对齐 UI §6.2）

**Props**：

```typescript
interface BulkActionBarProps {
  selectedCount: number
  onBatchAck: () => Promise<void>
  onBatchDismiss: () => Promise<void>
  onBatchOpen: () => void
  onClearSelection: () => void
}
```

**视觉**：固定在底部（`position: sticky; bottom: 0`），选中 > 0 时显示

**A11y**：
- `role="toolbar"` + `aria-label="批量操作"`
- `aria-live="polite"` 通知选中数变化

### 4.6 `<GroupedListRenderer />`

**用途**：Queue 视图分组列表渲染

**Props**：

```typescript
interface GroupedListRendererProps {
  groups: TriageItemGroup[]
  groupBy: GroupByKey
  selectedIds: Set<string>
  // + 各种回调
}
```

**视觉**：
- 每组：`<div role="group">` + `<GroupHeader />` + `<TriageItemRow /> × N`
- 空组显示"（无）"
- 分组标题：图标 + 名称 + 数量 + 批量操作下拉

```tsx
export function GroupedListRenderer({ groups, groupBy, ... }: GroupedListRendererProps) {
  return (
    <div className="grouped-list" role="list">
      {groups.length === 0 && <EmptyState state="empty" />}
      {groups.map(group => (
        <section key={group.group_key} role="group" aria-label={group.group_label}>
          <GroupHeader
            group={group}
            groupBy={groupBy}
            onBatchAction={...}
          />
          <div role="list">
            {group.items.map((item, idx) => (
              <TriageItemRow
                key={item.external_id}
                item={item}
                isLastInGroup={idx === group.items.length - 1}
                selected={selectedIds.has(item.external_id)}
                onAck={...}
                onDismiss={...}
                onOpen={...}
                onSelect={...}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

### 4.7 `<TimelineTrack />`

**用途**：Timeline 视图时间轴

**Props**：

```typescript
interface TimelineTrackProps {
  items: TimelineItem[]
  virtualScroll?: boolean  // 1000+ 条时使用虚拟滚动
}

type TimelineItem = TriageItem & { timeline_type: 'created' | 'updated' | 'handoff' | 'ack' | 'dismiss' }
```

**视觉**：
- 左侧时间轴：垂直线 + 节点（圆形/方形按类型）
- 右侧内容：时间戳 + 图标 + 标题 + 状态徽章 + 行内按钮

**性能**：
- 1000+ 条时使用 `<VirtualList />`（复用既有组件）
- 每组时间（hourly）作为分组头

### 4.8 视图容器（3 个）

**OverviewView.tsx**：

```tsx
export function OverviewView({ data, filter, groupBy, ... }: Props) {
  return (
    <div className="overview-view" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <OnCallStatusCard onCall={data.onCall} onHandoff={...} />
      <StatsRow>
        <MetricCard title="未读告警" value={data.overview.unread_alerts} trend={...} />
        <MetricCard title="我的工单" value={data.overview.my_tickets} />
        <MetricCard title="未读通知" value={data.overview.unread_notifications} />
        <MetricCard title="待办变更" value={data.overview.pending_changes} footer={overdue} />
      </StatsRow>
      <SeveritySourceMatrix data={matrixData} onCellClick={...} />
      <RecentActivityFeed items={data.overview.recent_items.slice(0, 10)} />
    </div>
  )
}
```

**QueueView.tsx**：

```tsx
export function QueueView({ data, filter, groupBy, ... }: Props) {
  return (
    <div className="queue-view" id="panel-queue" role="tabpanel" aria-labelledby="tab-queue">
      <SearchFilterBar
        filterType={TriageFilterSchema}  // 扩展支持 kind/severity/status/time
        value={filter}
        onChange={updateFilter}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />
      <GroupedListRenderer
        groups={data.groups}
        groupBy={groupBy}
        selectedIds={selectedIds}
        onAck={acknowledge}
        onDismiss={dismiss}
        onOpen={openItem}
        onSelect={toggleSelect}
      />
      <BulkActionBar
        selectedCount={selectedIds.size}
        onBatchAck={batchAcknowledge}
        onBatchDismiss={batchDismiss}
        onBatchOpen={batchOpen}
        onClearSelection={clearSelection}
      />
    </div>
  )
}
```

**TimelineView.tsx**：

```tsx
export function TimelineView({ data, ... }: Props) {
  return (
    <div className="timeline-view" id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline">
      <TimeRangeSelector
        value={timeRange}
        onChange={setTimeRange}
        presets={[today, '24h', '7d', '30d', custom]}
      />
      <TimelineFilter filter={filter} onChange={updateFilter} />
      <TimelineTrack items={timelineItems} virtualScroll />
    </div>
  )
}
```

---

## 5. 命令面板注册

**位置**：`orion-frontend/src/pages/Triage/commands.ts`

对齐 UI §6.5（7 条命令）：

```typescript
export const TRIAGE_COMMANDS = [
  {
    id: 'triage.ack-unread-alerts',
    title: '处理我的未读告警',
    shortcut: 'H+A',
    keywords: ['告警', 'alert', 'ack'],
    permissions: ['triage:write'],
    action: () => navigate('/triage', { view: 'queue', kind: 'alert', status: 'unread' }),
  },
  {
    id: 'triage.open-my-tickets',
    title: '处理我的工单',
    shortcut: 'H+T',
    keywords: ['工单', 'ticket'],
    permissions: ['triage:write'],
    action: () => navigate('/triage', { view: 'queue', kind: 'ticket' }),
  },
  {
    id: 'triage.view-oncall',
    title: '处理我的值班任务',
    shortcut: 'H+O',
    keywords: ['值班', 'oncall'],
    permissions: ['oncall:read'],
    action: () => navigate('/triage', { view: 'overview' }),
  },
  {
    id: 'triage.handoff-oncall',
    title: '交接值班',
    shortcut: 'O+H',
    keywords: ['交接', 'handoff'],
    permissions: ['oncall:write'],
    action: () => showHandoffDialog(),
  },
  {
    id: 'triage.batch-ack-current',
    title: '批量 Ack 当前组',
    shortcut: 'B+A',
    keywords: ['批量', 'batch'],
    permissions: ['triage:write'],
    action: () => batchAckCurrentGroup(),
  },
  {
    id: 'triage.batch-dismiss-low',
    title: '批量 Dismiss 低严重度',
    shortcut: 'B+D',
    keywords: ['批量', 'dismiss', '低严重度'],
    permissions: ['triage:write'],
    action: () => batchDismissBySeverity('low'),
  },
  {
    id: 'triage.refresh',
    title: '刷新 Triage 数据',
    shortcut: 'R+T',
    keywords: ['刷新', 'refresh'],
    permissions: [],
    action: () => refreshTriageData(),
  },
]

// 注册到全局 Command Palette（在 Triage 页面 mount 时）
export function registerTriageCommands() {
  commandPaletteRegistry.registerAll(TRIAGE_COMMANDS)
  return () => commandPaletteRegistry.unregisterAll(TRIAGE_COMMANDS)
}
```

---

## 6. 键盘快捷键表

对齐 UI §6.1（15 条）：

| 快捷键 | 动作 | 上下文 | 冲突检测 |
|---|---|---|---|
| `⌘/Ctrl + K` | 打开 Command Palette | 全局 | 全局唯一 |
| `1` | 切换到 Overview | Triage 页面 | 只在 Triage 激活 |
| `2` | 切换到 Queue | Triage 页面 | 只在 Triage 激活 |
| `3` | 切换到 Timeline | Triage 页面 | 只在 Triage 激活 |
| `j` / `k` | 列表上下移动 | Queue / Timeline | 无冲突 |
| `Enter` | 打开选中项详情 | Queue / Timeline | 无冲突 |
| `a` | Ack 选中项 | Queue / Timeline | 无冲突 |
| `d` | Dismiss 选中项 | Queue / Timeline | 无冲突 |
| `Space` | 勾选/取消勾选 | Queue | 无冲突 |
| `x` | 全选当前组 | Queue | 无冲突 |
| `/` | 聚焦搜索框 | Queue | 无冲突 |
| `?` | 显示快捷键帮助 | Triage 页面 | 无冲突 |
| `Esc` | 关闭 Modal / 取消筛选 | 全局 | 无冲突 |
| `→` | 视图切换向右 | ViewSwitcher focus | 无冲突 |
| `←` | 视图切换向左 | ViewSwitcher focus | 无冲突 |

**冲突处理**：
- `useHotkeys` 默认 `ignoreWhen: ['INPUT', 'TEXTAREA', '[contenteditable]']`
- Command Palette 打开时，其他快捷键自动禁用
- Modal 打开时，除 Esc 外其他快捷键禁用

---

## 7. 视觉设计（对齐 UI §5）

### 7.1 颜色映射（复用 Design Token，无新增）

```typescript
// constants/colors.ts
export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  critical: colors.error[500],
  high:     colors.warning[500],
  medium:   colors.primary[500],
  low:      colors.neutral[400],
}

export const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: colors.error[50],
  high:     colors.warning[50],
  medium:   colors.primary[50],
  low:      colors.neutral[50],
}

export const KIND_COLOR: Record<TriageItemKind, string> = {
  alert:  colors.error[500],
  ticket: colors.primary[500],
  oncall: colors.warning[500],
  change: colors.info[500],
}
```

### 7.2 排版（复用 typography.ts）

见 UI §5.2（页面标题 / KPI 数字 / 组头 / 行标题 / 元信息）

### 7.3 间距（复用 spacing.ts）

- 页面 padding：`spacing.xl`
- 卡片间距：`spacing.lg`
- 卡片内 padding：`spacing.md`
- 行间距：`spacing.sm`

### 7.4 动效（复用 animation.ts）

- KPI 数字变化：`numberRoll 300ms`
- 新条目进入：`slideInFromRight 200ms`
- 条目退出（Ack/Dismiss）：`slideOutToLeft 300ms + opacity 0`
- Critical 项红色脉冲：`pulse 2s infinite`
- 值班状态点：`pulse 1.5s infinite`

**⚠️ 尊重 `prefers-reduced-motion`**（承接 P0-6 a11y）：
```css
@media (prefers-reduced-motion: reduce) {
  .triage-item-row,
  .oncall-card .pulse-dot,
  .matrix-cell {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 8. 状态模型（对齐 UI §7）

### 8.1 加载态

**初始加载**：全页 `<Spin>` + 骨架屏（复用既有 Skeleton）

**部分源失败**：
```tsx
{state.sourceHealth.alerts === 'error' && (
  <Alert
    type="warning"
    message="告警数据加载失败"
    description="其他数据源正常显示，告警数据暂不可用"
    action={<Button onClick={retryAlerts}>重试</Button>}
  />
)}
```

**全部失败**：`<DataState state="error">` + 重试按钮

**空数据**：`<DataState state="empty">` + "暂无待办事项" + 上次同步时间

### 8.2 乐观更新

**Ack**：
```typescript
const ackItem = async (id: string) => {
  // 1. 乐观更新（本地移除）
  const prev = itemsRef.current
  setItems(items => items.filter(i => i.external_id !== id))
  
  // 2. API 调用
  try {
    await triageApi.ackItem(id, { idempotencyKey: uuid() })
  } catch (err) {
    // 3. 回滚（fade-in 动画）
    setItems(prev)
    message.error(err.message)
  }
}
```

**批量 Ack/Dismiss**：
- 不乐观更新（等待后端确认）
- 进度显示：`已处理 12/47`

### 8.3 DND 状态

**DND 生效中**：
- 过滤掉低严重度项（对齐 UI §6.4）
- 显示"因 DND 隐藏 N 项"提示
- 用户可关闭过滤按钮

---

## 9. 权限控制（对齐 API §6）

```typescript
// 权限检查
const userPermissions = useUserPermissions()

// ViewSwitcher 项根据权限过滤
const availableViews = ['overview', 'queue', 'timeline'].filter(v => {
  // overview 需要 triage:read 或 oncall:read
  // queue 需要 triage:read
  // timeline 需要 triage:read
  return hasPermission(v)
})

// 行内按钮根据 kind + 权限禁用
<TriageItemRow
  item={item}
  disableAck={item.kind === 'oncall' || !hasPermission('triage:write')}
  disableDismiss={item.kind === 'oncall' || item.kind === 'change' || !hasPermission('triage:write')}
/>
```

---

## 10. 测试要求

### 10.1 单元测试

**Hooks**：
- `useTriageData`：初始加载 / 单源失败 / WS 事件处理 / WS 降级轮询
- `useTriageActions`：乐观更新成功 / 乐观更新失败回滚 / 幂等错误静默
- `useTriageFilters`：URL 深链 / 浏览器导航
- `useHotkeys`：快捷键触发 / ignoreWhen

**组件**：
- `ViewSwitcher`：切换 / 键盘 ← → / ARIA 属性
- `OnCallStatusCard`：有值班 / 无值班 / 交接成功 / 交接失败
- `SeveritySourceMatrix`：点击单元格 / 键盘导航 / 0 单元格 / 大数字单元格
- `TriageItemRow`：Ack / Dismiss / Open / 键盘 Enter / 选中态
- `BulkActionBar`：显示 / 隐藏 / 批量操作 / 二次确认

### 10.2 集成测试（Playwright）

- **场景 1**：用户访问 /triage → 看到 overview → 切换到 queue → 按 `a` ack → 项从列表移除
- **场景 2**：WebSocket 收到新告警 → 顶栏 NotificationBell 数字 +1 → 列表自动追加
- **场景 3**：键盘操作流：`2` (Queue) → `j` × 3 (下移) → `a` (Ack) → `Esc` (关闭消息)
- **场景 4**：命令面板：`⌘+K` → 输入 "批量 ack" → Enter → 弹二次确认

### 10.3 契约测试

- **Schema 快照**：`triage/me` 响应体 JSON Schema
- **错误码穷举**：前端 `switch error.code` 必须覆盖 API §4.1 全部 9 项
- **枚举扩展测试**：后端返回 `kind='unknown_kind'` → 前端显示"未知类型"而非崩溃

---

## 11. 目录树（最终）

```
orion-frontend/src/pages/Triage/
├── index.tsx
├── commands.ts                     ★ 命令面板注册
├── types.ts
├── constants.ts
├── hooks/
│   ├── useTriageData.ts
│   ├── useTriageActions.ts
│   ├── useTriageFilters.ts
│   └── useHotkeys.ts
├── components/
│   ├── ViewSwitcher.tsx            ★ 三视图切换
│   ├── OnCallStatusCard.tsx        ★ 值班视觉语言
│   ├── SeveritySourceMatrix.tsx    ★ 4×4 热力矩阵
│   ├── RecentActivityFeed.tsx      ★ Overview 活动流
│   ├── GroupedListRenderer.tsx     ★ Queue 分组渲染
│   ├── TriageItemRow.tsx           ★ 单条待办
│   ├── BulkActionBar.tsx           ★ 底部批量条
│   ├── FilterBar.tsx               扩展（支持 groupBy）
│   ├── TimelineTrack.tsx           ★ Timeline 视图
│   └── TimeRangeSelector.tsx       ★ 时间范围选择
├── views/
│   ├── OverviewView.tsx            ★ 视图容器
│   ├── QueueView.tsx               ★ 视图容器
│   └── TimelineView.tsx            ★ 视图容器
└── __tests__/
    ├── index.test.tsx
    ├── commands.test.ts
    ├── hooks/
    │   ├── useTriageData.test.ts
    │   ├── useTriageActions.test.ts
    │   └── useHotkeys.test.ts
    └── components/
        ├── ViewSwitcher.test.tsx
        ├── OnCallStatusCard.test.tsx
        ├── SeveritySourceMatrix.test.tsx
        ├── TriageItemRow.test.tsx
        └── BulkActionBar.test.tsx
```

**统计**：
- **13 个新增 TSX 组件**（含 3 个视图容器 + 10 个基础组件）
- **4 个新增 Hooks**（3 个 Triage 专用 + useHotkeys 通用）
- **2 个配置文件**（commands.ts + constants.ts）
- **测试文件**：10 个

---

## 12. F2-F8 其他页面实施规格摘要

对齐 F1-F8 前端方案，简要说明各页面实施要点（详细规格另案）：

### F2 UserRole 管理页面
- **目录**：`pages/UserRoles/`
- **权限**：`user_role:admin`
- **关键组件**：RoleListTable + RoleDetailDrawer + AssignUserModal + RoleAuditLog
- **API**：CRUD user_role 表（对齐 G1 设计）
- **A11y**：Modal 焦点管理 + 表单 aria-describedby + 审计日志表格 role=grid

### F3 RecipientEditor 组件
- **目录**：`components/RecipientEditor/`
- **6 Kind**：user / role / team / oncall-duty / escalation / broadcast
- **受控值 + chip 可视化**：`value: RecipientSpec[]` + `onChange`
- **兼容旧字符串**：`acceptsLegacyString` 模式（过渡期用）
- **复用**：多个页面共享（Triage 交接 / 通知策略 / 升级规则）

### F4 Command Palette + useHotkeys
- **目录**：`components/CommandPalette/` + `hooks/useHotkeys.ts`
- **无新依赖**：Modal + VirtualList + 全局快捷键 hook
- **权限过滤**：命令按 userPermissions 过滤后展示
- **命令注册**：各页面 mount 时注册，unmount 时注销

### F5 NotificationBell 多源聚合
- **升级**：从"只通知"到"聚合 alerts + tickets + oncall + notifications"
- **数据源**：`GET /v1/triage/me` (reuse) + WebSocket 增量
- **子菜单**：按 kind 分组显示（对齐 UI §6.5 命令面板）

### F6 DND 设置页面
- **目录**：`pages/Settings/DND/`
- **UI**：时间选择器 + 类型过滤器 + 严重度阈值
- **持久化**：`user_preference` 表（后端设计）
- **实时效果**：DND 生效时通知 + 告警过滤生效

### F7 AlertList 增强
- **目录**：`pages/AlertList/`（既有，扩展）
- **新增功能**：dismiss 按钮 + role/oncall 过滤器
- **对齐**：与 Triage Queue 视图保持一致 UX

### F8 OnCall 页面"我的任务"面板
- **目录**：`pages/OnCall/`（既有，扩展）
- **新增面板**：右侧显示"当前值班相关的 Triage 项"
- **数据源**：`GET /v1/triage/me/items?assigned_scope=oncall&limit=20`

---

## 13. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 修订记录 3 项对齐 UI 专家建议 | §1 |
| 2 | 数据流完整（4 数据源 + 3 WS 事件 + 乐观更新）| §2 |
| 3 | 4 个 Hook 完整规格（含伪代码）| §3 |
| 4 | 10 个新增组件完整规格（含代码骨架）| §4 |
| 5 | 命令面板 7 条命令注册 | §5 |
| 6 | 键盘快捷键 15 条完整表 | §6 |
| 7 | 视觉规范复用既有 Token（无新增）| §7 |
| 8 | 状态模型含 3 类（加载 / 乐观 / DND）| §8 |
| 9 | 权限控制（权限点映射到视图 + 按钮）| §9 |
| 10 | 测试要求 3 类（单元 / 集成 / 契约）| §10 |
| 11 | 最终目录树完整 | §11 |
| 12 | F2-F8 摘要齐全 | §12 |
| 13 | 未修改生产代码 | `git status --porcelain` 生产扩展名 空 |
| 14 | 未估算人天/工期 | 全文检索禁词为空 |

---

*本实施规格闭合了 UI 专家评审的 3 处必须修订（R1 三视图 / R2 多维归类 / R3 值班视觉语言），
并提供了 4 个 Hook + 10 个组件的完整规格（含伪代码 / ARIA / 键盘导航 / 乐观更新），
可直接进入开发实施。

对齐 API 契约 `triage-api-contract-design-2026-10-11.md`，
复用既有 Design Token + 既有基础组件（Modal / Table / SearchFilterBar / DataState /
MetricCard / StatusBadge / VirtualList / Timeline / RecipientEditor），
不引入新依赖。*

*⚠️ 前置条件：P0 a11y 阻塞项（P0-1 ~ P0-6）必须完成后上线（见 `frontend-a11y-p0-prework-design-2026-10-11.md`）。*
