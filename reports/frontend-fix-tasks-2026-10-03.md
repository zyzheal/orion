# Orion 前端修复任务清单（Layer 3 交付物 · Direction A）

> **生成日期**：2026-10-03
> **来源**：Layer 2 UI/UX 评审（3 份） + A11y 全仓 30 页扩展审计（当前权威 `accessibility-audit-fullrepo-2026-10-03.md`）
> **产出方式**：**只写修复任务清单，不修改生产代码**（Direction A）
> **每项含**：grep 定位命令 + 现状代码 + 修复方案 + 验证命令
> **约束**：不估算人天/工期（用户强制）

---

## TL;DR

- **P0 a11y 阻塞 6 项**（Layout nav 是最大问题，1 处代码锁死 40+ 入口）
- **P1 UI/UX 严重项 10 项**（TicketDetail 5 + Console 3 + DashboardNew 2）
- **P2 次要项 ~15 项**（Response 断点、Token 混用、色值统一等）
- **总代码点位数**：30+ 个位置，涉及 12 个文件
- **建议执行顺序**：先 P0 a11y（Layout nav + tabIndex），再 P1 UI/UX，最后 P2

---

## 目录

1. P0 a11y 阻塞（6 项）
2. P1 UI/UX 严重项（10 项）
3. P2 次要项（15 项）
4. 执行顺序建议
5. 全局风险与注意事项
6. 附录：完整 grep 命令集合

---

## 1. P0 a11y 阻塞（6 项）

### P0-1：Layout 主导航使用 `<div onClick>` 而非 `<button>`

**位置**：`orion-frontend/src/components/Layout/index.tsx:140-194`

**grep 命令**：
```bash
grep -n "onClick\|<div" orion-frontend/src/components/Layout/index.tsx | head -20
```

**现状代码**（第 140-194 行）：
```tsx
<div
  onClick={() => onNavigate(item.key, item.label)}
  style={{ ... cursor: 'pointer', ... }}
>
```

**问题**：
- 1 处代码影响 40+ 导航入口（工作台/控制台/交付/可观测性/AI平台/基础设施/治理/生态）
- 键盘完全不可达（无 tabIndex，无 onKeyDown）
- Screen Reader 无法识别为可操作元素
- WCAG 2.1 原则 2.1.1 Keyboard（A 级）违规

**修复方案**：
```tsx
// 方案 A（推荐）：把 <div> 替换为 <button>
<button
  onClick={() => onNavigate(item.key, item.label)}
  aria-label={item.label}
  aria-current={isActive ? 'page' : undefined}
  style={{
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 56,
    padding: '0 14px',
    margin: '0 1px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: isActive ? 500 : 400,
    color: isActive ? activeTxtColor : txtColor,
    transition: 'color 0.2s, background 0.15s',
    whiteSpace: 'nowrap',
  }}
>
  ...（内部内容不变）
</button>

// 方案 B（若要保持 div 视觉）：加 tabIndex + role + onKeyDown
<div
  role="button"
  tabIndex={0}
  aria-label={item.label}
  aria-current={isActive ? 'page' : undefined}
  onClick={() => onNavigate(item.key, item.label)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(item.key, item.label);
    }
  }}
>
```

**验证命令**：
```bash
# 验证 1：grep 确认没有 <div onClick 用于导航
grep -nE "cursor: 'pointer'" orion-frontend/src/components/Layout/index.tsx
# 期望：只剩非交互用途的 cursor: 'pointer'

# 验证 2：键盘导航测试
# 打开浏览器 → Tab 遍历所有导航项 → Enter 应能跳转
```

**风险**：高（涉及全站导航，需 e2e 测试覆盖 8 大菜单模块）

---

### P0-2：全仓 101 处 `<div onClick>` 反模式

**grep 命令**：
```bash
grep -rn "onClick" orion-frontend/src/ --include="*.tsx" | grep "<div" | wc -l
```

**问题清单**（按目录聚合）：
| 位置 | 数量 | 严重性 |
|------|------|--------|
| `src/pages/TicketDetail/` | 15+ | 高 |
| `src/pages/Console/` | 8+ | 中 |
| `src/pages/DashboardNew/` | 5+ | 中 |
| `src/components/` | 40+ | 中 |
| 其他 pages | 30+ | 中 |

**修复方案**（模式化）：
```tsx
// 反模式
<div onClick={handleClick}>...</div>

// 正模式（选一）
<button onClick={handleClick}>...</button>
<div role="button" tabIndex={0} onClick={handleClick}
     onKeyDown={e => e.key === 'Enter' && handleClick()}>...</div>
```

**优先级建议**：先修 P0-1（Layout）+ P0-3（TicketDetail 主要交互），其余 30+ 处按模块分批修

**验证命令**：
```bash
# 修复前后对比
grep -rn "<div.*onClick" orion-frontend/src/ --include="*.tsx" | wc -l
# 目标：从 101 降到 <10（保留非交互用途）
```

---

### P0-3：2262 个按钮缺少 `aria-label`

**grep 命令**：
```bash
# 统计所有 button 元素
grep -rnE "<Button\s" orion-frontend/src/ --include="*.tsx" | wc -l

# 统计缺失 aria-label 的
grep -rnE "<Button\s" orion-frontend/src/ --include="*.tsx" | grep -v "aria-label" | wc -l
```

**问题**：
- 2262 个 Button 组件，几乎全部无 `aria-label`
- Antd Button 内部有默认 aria-label，但图标按钮 + 无文本按钮的 100+ 处必须补

**修复方案**：
```tsx
// 反模式：只有图标，无 aria-label
<Button icon={<DeleteOutlined />} onClick={handleDelete} />

// 正模式
<Button icon={<DeleteOutlined />} aria-label="删除" onClick={handleDelete} />
```

**优先级建议**：
1. **P0-a**：所有图标按钮（Delete/Close/Save/Refresh/Edit）必须加 `aria-label`
2. **P1**：无文本的复合按钮补 `aria-label`

**验证命令**：
```bash
grep -rnE "<Button[^>]*icon=[^>]*$" orion-frontend/src/ --include="*.tsx" \
  | grep -v "aria-label"
```

---

### P0-4：全仓 0 处 `tabIndex` 设置

**grep 命令**：
```bash
grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l
```

**问题**：
- 全仓 0 处 `tabIndex` 设置
- 意味着所有 `<div onClick>` 完全无键盘可达

**修复方案**：
- 与 P0-1、P0-2 联动修复
- 所有 `<div onClick>` 改为 `<button>` 或加 `tabIndex={0}` + `role="button"`

**验证命令**：
```bash
grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l
# 目标：>50 处
```

---

### P0-5：全仓 0 处 `aria-describedby` + 0 处 `aria-live`

**grep 命令**：
```bash
grep -rn "aria-describedby\|aria-live\|aria-invalid" orion-frontend/src/ --include="*.tsx" | wc -l
```

**问题**：
- 表单校验错误消息不会自动读给屏幕阅读器
- 表单校验错误提示没有关联到输入框

**修复方案**（以 TicketDetail 为例）：
```tsx
// 反模式
<Input id="resolutionNote" />
{error && <span className="error">{error}</span>}

// 正模式
<Input
  id="resolutionNote"
  aria-describedby={error ? "resolutionNote-error" : undefined}
  aria-invalid={!!error}
/>
{error && <span id="resolutionNote-error" className="error">{error}</span>}
```

**验证命令**：
```bash
grep -rn "aria-describedby\|aria-invalid" orion-frontend/src/ --include="*.tsx" | wc -l
# 目标：>20 处
```

---

### P0-6：全仓 0 处 `prefers-reduced-motion` 媒体查询

**grep 命令**：
```bash
grep -rn "prefers-reduced-motion\|@media.*motion" orion-frontend/src/ --include="*.tsx" --include="*.css" | wc -l
```

**问题**：
- 页面大量动画（Modal fade、Card hover、Tab slide）
- 前庭障碍用户会因动画眩晕

**修复方案**（全局 CSS）：
```css
/* orion-frontend/src/index.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**验证命令**：
```bash
grep -rn "prefers-reduced-motion" orion-frontend/src/ | wc -l
# 目标：>=1
```

---

## 2. P1 UI/UX 严重项（10 项）

### P1-1（TicketDetail）：关闭工单无二次确认

**位置**：`TicketHeader.tsx:120` + `useTicketDetailState.ts:177`

**grep 命令**：
```bash
grep -n "handleClose\|onClose" orion-frontend/src/pages/TicketDetail/TicketHeader.tsx
```

**现状代码**：
```tsx
<Button danger onClick={onClose}>关闭工单</Button>
```

**问题**：
- 直连 `closeTicket` API，无 `Modal.confirm`
- 关闭是不可逆操作，用户误触后无法恢复

**修复方案**：
```tsx
// useTicketDetailState.ts
const handleClose = useCallback(async () => {
  Modal.confirm({
    title: '确认关闭工单？',
    content: `关闭后工单将不可修改，是否继续？`,
    okText: '确认关闭',
    cancelText: '取消',
    onOk: async () => {
      if (!ticket) return;
      try {
        await closeTicket(ticket.id, { performedBy: 'current-user' });
        message.success('工单已关闭');
        loadTicket();
      } catch (error: unknown) {
        // ... 错误处理不变
      }
    }
  });
}, [ticket, loadTicket]);
```

**验证**：手动测试 — 点关闭按钮应弹出确认框

---

### P1-2（TicketDetail）：handleEscalate 空实现

**位置**：`useTicketDetailState.ts:127-130`

**grep 命令**：
```bash
grep -n "handleEscalate\|escalateTicket" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts
grep -n "escalateTicket" orion-frontend/src/api/ticketing.ts
```

**现状代码**：
```tsx
const handleEscalate = useCallback(async (_values: EscalateValues) => {
  message.success(`工单已升级`);
  setEscalateModalOpen(false);
}, []);
```

**问题**：
- 只 `message.success` + 关 Modal，未调 API
- 用户提交升级理由后无效果，刷新发现无升级记录

**修复方案**：
```tsx
import { escalateTicket } from '@/api/ticketing'; // 如果不存在需新增

const handleEscalate = useCallback(async (values: EscalateValues) => {
  if (!ticket) return;
  try {
    await escalateTicket(ticket.id, {
      toPriority: values.priority,
      reason: values.reason,
      performedBy: 'current-user',
    });
    message.success('工单已升级');
    setEscalateModalOpen(false);
    loadTicket();
  } catch (error: unknown) {
    // ... 错误处理
  }
}, [ticket, loadTicket]);
```

**前置条件**：
- 检查 `ticketing.ts` 是否有 `escalateTicket` API，无则需后端先实现

**验证**：升级后刷新页面应看到升级历史

---

### P1-3（TicketDetail）：4 个 Modal 无 `confirmLoading`

**位置**：`TicketDetailModals.tsx:34-142`

**grep 命令**：
```bash
grep -n "confirmLoading\|okButtonProps" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx
```

**问题**：
- 4 个 Modal 全部无 `confirmLoading` 和 `okButtonProps.disabled`
- wrapper 是裸 await，用户可连点导致重复请求

**修复方案**（模式化）：
```tsx
// 新增 submitting state
const [submitting, setSubmitting] = useState(false);

<Modal
  confirmLoading={submitting}
  okButtonProps={{ disabled: submitting }}
  onOk={async () => {
    setSubmitting(true);
    try {
      await handleSubmit();
    } finally {
      setSubmitting(false);
    }
  }}
>
```

**验证**：连点确认按钮，应只发 1 次请求

---

### P1-4（TicketDetail）：评论提交无 await + 立即清空

**位置**：`TicketComments.tsx:218-220`

**grep 命令**：
```bash
grep -n "submitComment\|message.success" orion-frontend/src/pages/TicketDetail/TicketComments.tsx
```

**现状代码**：
```tsx
message.success('评论已提交');
submitComment.execute();
setCommentText('');
```

**问题**：
- 无 `await`，fire-and-forget
- 失败时用户已看到"已提交"再看到"失败"
- 输入立即清空，失败无法回滚

**修复方案**：
```tsx
const handleSubmit = async () => {
  setSubmitting(true);
  try {
    await submitComment.execute({ content: commentText });
    message.success('评论已提交');
    setCommentText('');
  } catch (err) {
    message.error('评论提交失败，请稍后重试');
    // 不 setCommentText('')，保留用户输入
  } finally {
    setSubmitting(false);
  }
};
```

**验证**：断网测试 — 应看到"失败"，输入保留

---

### P1-5（TicketDetail）：加载态被误判为 404

**位置**：`useTicketDetailState.ts:24,49` + `index.tsx`

**grep 命令**：
```bash
grep -n "_loading\|if (!ticket)\|TicketNotFound" orion-frontend/src/pages/TicketDetail/
```

**现状代码**：
```tsx
const [_loading, setLoading] = useState(false);
// ...
if (!ticket) return <TicketNotFound />;  // 加载中也误判为 404
```

**问题**：
- 首次访问慢网络时会闪 404
- `_loading` 下划线丢弃，无用

**修复方案**：
```tsx
const [loading, setLoading] = useState(false);  // 去掉下划线

// index.tsx
if (loading) return <Spin size="large" />;
if (!ticket) return <TicketNotFound />;
```

**验证**：慢网络测试，加载期间应看到 Spin 而非 404

---

### P1-6（TicketDetail）：附件行 `cursor: pointer` 无 onClick

**位置**：`TicketComments.tsx:399-412`

**grep 命令**：
```bash
grep -n "cursor: 'pointer'" orion-frontend/src/pages/TicketDetail/TicketComments.tsx
```

**修复方案**（选一）：
1. **有下载功能**：加 `onClick={handleDownload}`
2. **无下载功能**：移除 `cursor: 'pointer'`

```tsx
// 方案 1
<div onClick={() => handleDownload(attachment.url)}>
  <PaperClipOutlined />
  <span>{attachment.name}</span>
</div>

// 方案 2
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <PaperClipOutlined />
  <span>{attachment.name}</span>
</div>
```

---

### P1-7（TicketDetail）：Mention Tag 无 onClick/onKeyDown

**位置**：`TicketComments.tsx:84-94`

**grep 命令**：
```bash
grep -n "MentionTag\|cursor: 'pointer'" orion-frontend/src/pages/TicketDetail/TicketComments.tsx
```

**修复方案**（选一）：
1. **有点击行为**：跳转到用户详情
2. **无点击行为**：移除 `cursor: 'pointer'`

```tsx
// 方案 1
<Tag
  role="button"
  tabIndex={0}
  onClick={() => navigate(`/users/${mention.userId}`)}
  onKeyDown={e => e.key === 'Enter' && navigate(`/users/${mention.userId}`)}
>
  @{mention.name}
</Tag>
```

---

### P1-8（Console）：QuickNav 用 `window.location.href` 破坏 SPA

**位置**：`Console/Components/QuickNav.tsx:47-49`

**grep 命令**：
```bash
grep -n "window.location.href" orion-frontend/src/pages/Console/Components/QuickNav.tsx
```

**修复方案**：
```tsx
import { useNavigate } from 'react-router-dom';

const QuickNav = ({ items }: Props) => {
  const navigate = useNavigate();
  return (
    <div>
      {items.map(item => (
        <Card
          key={item.path}
          hoverable
          onClick={() => navigate(item.path)}  // 用 navigate 代替 window.location.href
        >
          ...
        </Card>
      ))}
    </div>
  );
};
```

**验证**：跳转应无页面刷新（`performance.getEntriesByType('navigation')` 无新记录）

---

### P1-9（Console）：错误态回退到硬编码"演示数据"

**位置**：`useConsoleState.ts:24-29, 50-53`

**grep 命令**：
```bash
grep -n "FALLBACK_STATS\|演示数据" orion-frontend/src/pages/Console/useConsoleState.ts
```

**修复方案**：
```tsx
// 删除 FALLBACK_STATS 常量
// catch 中显示真实错误，不填充假数据
} catch (err) {
  console.error('加载控制台数据失败:', err);
  setError('控制台数据加载失败，请检查后端服务或稍后重试');
  // 不 setStats(FALLBACK_STATS)，让组件显示 Empty 或 Error 状态
}
```

**验证**：断网测试，应看到错误提示而非假数据

---

### P1-10（Console）：初始加载失败无错误态

**位置**：`Console/index.tsx:18-26`

**grep 命令**：
```bash
grep -n "initialLoading\|Spin" orion-frontend/src/pages/Console/index.tsx
```

**修复方案**：
```tsx
if (initialLoading) {
  return <div style={{ padding: '60px' }}><Spin size="large" tip="加载中..." /></div>;
}

// 关键：initialLoading 结束后如果 error 存在，展示 Alert
if (error) {
  return (
    <div style={{ padding: '60px' }}>
      <Alert message="加载失败" description={error} type="error" showIcon />
    </div>
  );
}

// 正常渲染
```

---

## 3. P2 次要项（15 项，摘要）

### 3.1 TicketDetail 次要项（4 项）

- **P2-1**：`TicketSidebar.tsx:61` "未分配" 无 onClick 引导
- **P2-2**：`TicketMainColumn.tsx:168-174` 转交历史 Avatar 无 hover 悬浮
- **P2-3**：`TicketHeader.tsx:69-71` `spacing[3]=12px` 被当字号用（命名误导）
- **P2-4**：`TicketDetailModals.tsx:22` `engineers` 未用 `User` 类型

### 3.2 Console 次要项（3 项）

- **P2-5**：`useConsoleState.ts:64-68` `handleRefresh` 无禁用态
- **P2-6**：初始 loading 期间 `handleRefresh` 被点击不阻止
- **P2-7**：`QuickNav` 视觉层级可再优化（当前 3 卡平铺）

### 3.3 DashboardNew 次要项（3 项）

- **P2-8**：`useDashboardState.ts:30` `tasks: TaskRecord[] = []` 硬编码空
- **P2-9**：`useDashboardState.ts:64-75` 系统健康 fallback 到假数据
- **P2-10**：`index.tsx:65-72` Alert `type="warning"` 应为 `"error"`

### 3.4 全局次要项（5 项）

- **P2-11**：全仓 30+ 处 `Row gutter` 无响应式断点（`<768px` 挤压）
- **P2-12**：Token 混用（`colors.primary[500]` vs `'blue'` 语义色名）
- **P2-13**：Card `size="small"` 过多导致视觉层级扁平
- **P2-14**：`fontSize: spacing[3]` 命名误导（12px 是间距不是字号）
- **P2-15**：`Empty` 无引导按钮（多处）

---

## 4. 执行顺序建议

### 4.1 依赖链

```
P0-1 (Layout nav)                    ─┐
                                       │  ──→ P0-2 (101 div onClick 分批)
P0-3 (2262 buttons aria-label)      ─┘
                                       │
P0-4 (tabIndex) ← 依赖 P0-1 + P0-2   │
                                       │
P0-5 (aria-describedby)               │
                                       │
P0-6 (prefers-reduced-motion)         │  (独立，可并行)

P1-1~P1-7 (TicketDetail)              │  (P0 完成后启动)
P1-8~P1-10 (Console)                  │
```

### 4.2 推荐批次

**批次 1（P0 a11y 核心）**：
- P0-1（Layout nav）— 单独提交，e2e 覆盖
- P0-6（prefers-reduced-motion CSS）— 全局 CSS，独立
- P0-3（icons-only buttons 加 aria-label）— grep 定位后批量

**批次 2（P0 a11y 剩余）**：
- P0-2（101 div onClick 分批）— 按目录分批
- P0-4（tabIndex）— 与 P0-2 联动
- P0-5（aria-describedby/invalid）— 表单类组件

**批次 3（P1 UI/UX）**：
- TicketDetail 5 项（P1-1 ~ P1-5）
- TicketDetail 2 项（P1-6 ~ P1-7）
- Console 3 项（P1-8 ~ P1-10）
- DashboardNew 2 项（P2-8 ~ P2-10）

**批次 4（P2 次要项）**：
- 响应式断点补齐
- Token 色值统一
- Empty 引导按钮

### 4.3 独立执行原则

- **每个 P0 单独 PR**（便于 review + 回滚）
- **P1 按页面组织 PR**（TicketDetail 一个 PR，Console 一个 PR）
- **P2 按类型组织 PR**（响应式一个 PR，Token 一个 PR）

---

## 5. 全局风险与注意事项

### 5.1 高风险项（需 e2e 测试）

| 项 | 风险 | 验证方式 |
|----|------|---------|
| P0-1 Layout nav | 影响全站导航 | 覆盖 8 大菜单模块跳转 |
| P0-2 101 div onClick 批量 | 破坏性改动多 | 逐目录测试 |
| P1-1 关闭工单 confirm | 业务逻辑变更 | 关闭流程测试 |
| P1-2 Escalate 空实现 | 后端 API 依赖 | 后端 escalateTicket API 就绪检查 |

### 5.2 前置条件

| 项 | 前置条件 |
|----|---------|
| P1-2 | 后端需实现 `escalateTicket` API（`ticketing.ts`） |
| P1-3 | 需评估 `useTicketFormWrappers.ts` wrapper 是否可复用 |
| P2-10 | 需确认后端错误响应的 severity 字段 |

### 5.3 回滚策略

- 每个 PR 独立可回滚
- 修复前备份关键组件（可选）
- 使用 feature flag 隔离高风险项（如 P0-1 Layout nav）

### 5.4 测试覆盖要求

| 类别 | 覆盖要求 |
|------|---------|
| 单测 | 每个 handler 覆盖成功/失败 2 分支 |
| 集成 | TicketDetail/Console/DashboardNew 3 页 e2e |
| 键盘可达 | Tab 遍历所有交互元素，Enter/Space 应响应 |
| Screen Reader | 至少 VoiceOver 走一遍主流程 |

---

## 6. 附录：完整 grep 命令集合

### 6.1 P0 a11y 定位

```bash
# Layout nav 反模式
grep -rnE "cursor: 'pointer'" orion-frontend/src/components/Layout/index.tsx

# 全仓 div onClick
grep -rn "<div.*onClick" orion-frontend/src/ --include="*.tsx" | wc -l

# Button aria-label 缺失
grep -rnE "<Button[^>]*icon=[^>]*$" orion-frontend/src/ --include="*.tsx" | grep -v "aria-label"

# tabIndex 全仓
grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l

# aria-describedby/invalid
grep -rn "aria-describedby\|aria-invalid\|aria-live" orion-frontend/src/ --include="*.tsx" | wc -l

# prefers-reduced-motion
grep -rn "prefers-reduced-motion" orion-frontend/src/ --include="*.tsx" --include="*.css"
```

### 6.2 P1 UI/UX 定位

```bash
# TicketDetail 5 P1
grep -n "handleClose\|onClose" orion-frontend/src/pages/TicketDetail/TicketHeader.tsx
grep -n "handleEscalate\|escalateTicket" orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts
grep -n "confirmLoading" orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx
grep -n "submitComment\|message.success" orion-frontend/src/pages/TicketDetail/TicketComments.tsx
grep -n "cursor: 'pointer'" orion-frontend/src/pages/TicketDetail/TicketComments.tsx

# Console 3 P1
grep -n "window.location.href" orion-frontend/src/pages/Console/Components/QuickNav.tsx
grep -n "FALLBACK_STATS\|演示数据" orion-frontend/src/pages/Console/useConsoleState.ts
grep -n "initialLoading" orion-frontend/src/pages/Console/index.tsx

# DashboardNew
grep -n "tasks: TaskRecord" orion-frontend/src/pages/DashboardNew/useDashboardState.ts
grep -n "systemHealth\|fallback" orion-frontend/src/pages/DashboardNew/useDashboardState.ts
grep -n "type=\"warning\"" orion-frontend/src/pages/DashboardNew/index.tsx
```

### 6.3 验证清单（修复后）

```bash
# 修复进度追踪
echo "=== P0 验证 ==="
echo "Layout nav onClick 剩余："
grep -c "onClick.*onNavigate" orion-frontend/src/components/Layout/index.tsx
echo "全仓 div onClick 剩余："
grep -rn "<div.*onClick" orion-frontend/src/ --include="*.tsx" | wc -l
echo "tabIndex 数量："
grep -rn "tabIndex" orion-frontend/src/ --include="*.tsx" | wc -l
echo "aria-label 数量："
grep -rn "aria-label" orion-frontend/src/ --include="*.tsx" | wc -l
echo "prefers-reduced-motion："
grep -rn "prefers-reduced-motion" orion-frontend/src/ | wc -l

echo "=== 目标达成 ==="
# 目标值
echo "  div onClick: <10 (从 101)"
echo "  tabIndex: >50 (从 0)"
echo "  aria-label: >200 (从 <100)"
echo "  aria-describedby: >20 (从 0)"
echo "  prefers-reduced-motion: >=1 (从 0)"
```

---

## 7. 附录：修复方案参考代码模板

### 7.1 通用 `<div onClick>` → `<button>` 转换

```tsx
// Before
<div onClick={handleClick} style={{ cursor: 'pointer', ... }}>
  <Content />
</div>

// After 方案 A（推荐）
<button
  onClick={handleClick}
  aria-label="..."
  style={{
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: 0,
    textAlign: 'left',
    ...原有样式
  }}
>
  <Content />
</button>

// After 方案 B（保持 div）
<div
  role="button"
  tabIndex={0}
  aria-label="..."
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  style={{ cursor: 'pointer', ...原有样式 }}
>
  <Content />
</div>
```

### 7.2 图标按钮加 `aria-label`

```tsx
// Before
<Button icon={<DeleteOutlined />} onClick={handleDelete} />

// After
<Button icon={<DeleteOutlined />} aria-label="删除" onClick={handleDelete} />

// 或
<Button icon={<DeleteOutlined />} aria-label={`删除 ${item.name}`} onClick={handleDelete}>
  删除
</Button>
```

### 7.3 Modal `confirmLoading` 模式

```tsx
const [submitting, setSubmitting] = useState(false);

<Modal
  confirmLoading={submitting}
  okButtonProps={{ disabled: submitting, loading: submitting }}
  onOk={async () => {
    setSubmitting(true);
    try {
      await handleSubmit();
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }}
>
```

### 7.4 `aria-describedby` 表单错误模式

```tsx
<Input
  id="resolutionNote"
  aria-describedby={error ? "resolutionNote-error" : undefined}
  aria-invalid={!!error}
/>
{error && (
  <span id="resolutionNote-error" className="error">
    {error}
  </span>
)}
```

### 7.5 全局 `prefers-reduced-motion` CSS

```css
/* orion-frontend/src/index.css 或 app.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* 具体到 antd 动画禁用 */
  .ant-modal-mask,
  .ant-modal-content,
  .ant-card,
  .ant-tabs-content-holder {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 8. 认知边界

- **本清单不含人天/工期估算**（用户强制约束）
- **不修改生产代码**（Direction A）
- **修复方案已给出参考代码模板**，具体实现由后续开发团队执行
- **依赖后端 API** 的项（如 P1-2 Escalate）需先确认后端就绪
- **测试覆盖要求** 已列出，具体测试用例由团队编写

---

## 9. 报告元信息

| 项 | 值 |
|----|----|
| 生成日期 | 2026-10-03 |
| 生成方式 | 手工整合 3 份 UI/UX 评审 + 1 份 a11y 审计 |
| 报告长度 | ~400 行 |
| P0 项数 | 6 |
| P1 项数 | 10 |
| P2 项数 | 15 |
| 涉及文件数 | 12 |
| 代码点位数 | 30+ |

**上游报告引用**：
- `reports/ui-ux-reviews/dashboardnew-uiux-review-2026-10-01.md`
- `reports/ui-ux-reviews/ticketdetail-uiux-review-2026-10-01.md`
- `reports/ui-ux-reviews/console-uiux-review-2026-10-01.md`
- `reports/a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md`（当前唯一权威 a11y 报告；历史 v1 449 行已于 2026-10-03 清理中删除，其核心结论已吸收进本文档）
- `reports/expert-reviews/cross-review-synthesis-2026-10-03-v4.md`（当前权威综合报告；2026-10-01-v3 已删除，v4 吸收其结论）
- `reports/neatlogic-feature-comparison-upgrade-2026-09-30-v3.md`
