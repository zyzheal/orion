# TicketDetail UI/UX 评审（ui-ux-pro-max 技能首次实战）

**评审对象**：`orion-frontend/src/pages/TicketDetail/`（index + 6 Components + 2 hooks + types + constants + helpers）
**评审日期**：2026-10-01
**评审方法**：ui-ux-pro-max 三角色面板

---

## 三角色评分

| 角色 | 评分 | 主要问题 |
|------|------|----------|
| Interaction Designer | **5/10** | 关闭工单无二次确认、所有 Modal 缺 confirmLoading、Escalate 未调后端 API（纯前端假动作）、附件无点击行为、Mention Tag 无点击、无键盘可达 |
| UX Researcher | **5/10** | 状态选择器不是"可选"而是分按钮（语义割裂）、评论提交无乐观更新（先提示成功再执行）、"内部备注"标签与"内部备注"Tab 混用、加载态完全隐藏 |
| Visual Designer | **7/10** | Design Token 覆盖尚可，但大量硬编码像素（`padding: '8px 0'`、`fontSize: spacing[3]=12px`）、`<1200px` 无响应式（Row span 16/8 固定）、Tag 色值混用（部分走 Token、部分走 antd 语义色名） |

## 综合结论

- **综合评分：5.7/10**
- **阻塞项（P0）**：无致命阻塞；页面可完成核心任务。
- **严重项（P1）**：5 项，见下。

### P1 严重项

| # | 位置 | 问题 | 违反规则 |
|---|------|------|----------|
| 1 | `TicketHeader.tsx:120` + `useTicketDetailState.ts:177` | **关闭工单无二次确认**，`onClick={onClose}` 直连 `closeTicket` API，无 `Modal.confirm` | 交互规则 6（危险操作二次确认） |
| 2 | `useTicketDetailState.ts:127-130` | **`handleEscalate` 是空实现**：仅 `message.success('工单已升级')` + 关 Modal，未调用任何 API；升级理由表单校验了但用户提交后无效果 | 交互规则 3（异步操作有真实反馈） |
| 3 | `TicketDetailModals.tsx:34-142` | 所有 4 个 Modal **无 `confirmLoading`**、`okButtonProps.disabled`，`useTicketFormWrappers.ts` 中 wrapper 是裸 await，用户可连续点确认 | 交互规则 2（loading/disabled） |
| 4 | `TicketComments.tsx:402` | 附件行 `cursor: 'pointer'` 但**无 onClick**，用户点击无反应 | 交互规则 1（每个可操作元素必须有交互） |
| 5 | `TicketComments.tsx:84` | Mention Tag 有 `cursor: 'pointer'` 但**无 onClick/onKeyDown**，是纯装饰 | 交互规则 1 + 键盘可达 |

### P2 次要项

- `TicketComments.tsx:218-219` 评论先 `message.success` 再 `submitComment.execute()`（未 `await`）；如果 API 失败，用户先看到成功又看到失败，双重通知。且 `setCommentText('')` 立即清空，失败无法回滚。
- `useTicketDetailState.ts:24` `const [_loading, setLoading] = useState(false)` 加载态被下划线丢弃，**页面在拉取工单时是空白渲染**（因为 `!ticket` 直接渲染 `TicketNotFound` 404，实际应该是 `Spin` 骨架），加载中的 `id` 会被误判为 404。
- `TicketSidebar.tsx:61` `未分配` 是纯文字，无 `onClick` 引导用户去分配（当 `canAssign` 为 true 时是死链）。
- `TicketMainColumn.tsx:168-174` 转交历史中 `Avatar` 与 `Text` 无 hover 悬浮用户信息，且时间戳字号用 `fontSize: spacing[3]=12px`（间距 Token 被当字号用，命名误导）。
- `TicketHeader.tsx:69-71` 用 `spacing[3]=12px`、`spacing[2]=8px` 作为 `gap/marginRight`，OK；但 `TicketHeader.tsx:64` `marginBottom: spacing.sm` 在 `Button type="link"` 上会因内联样式覆盖 antd 默认，视觉上偏紧。
- `TicketDetailModals.tsx:22` `engineers: { id; name?; username? }[]` 未使用 `User` 类型，绕过类型安全。
- 无 `<meta>` 键盘导航：所有 `div cursor:pointer`（关联工单跳转、附件、Mention Tag、Mention 候选、Mention 下拉、状态徽章等）**无 role/onKeyDown/tabIndex**，全键盘不可用。
- 所有 Card 都是 `size="small"` + `border`，页面出现 7-8 张相同视觉权重的卡片，**没有主次层级**（描述 vs 基本信息 vs SLA 都是同等权重）。
- 响应式：`Row gutter={24} + Col span={16}/{span=8}` 是**固定 16:8**，无 `xs/sm/md/lg` 断点；<1200px 时右列挤压严重，未适配 CLAUDE.md 定义的 768-1199px 和 <768px 断点。

## 场景逆向验证

**"把工单状态从 Open 改成 Resolved，添加评论"**

| 步骤 | 用户动作 | 现状 | 结果 |
|------|----------|------|------|
| 1 | 找到状态选择器 | `TicketHeader` 是 5 个独立按钮（分配/升级/解决/关闭/转交），**不是状态 Select**；由 `canResolve = status === 'in-progress' || status === 'assigned'` 决定是否显示 | ⚠️ Open 状态**看不到"解决"按钮**（须先分配→in-progress） |
| 2 | 修改状态 → 有确认按钮 | Modal 有 `okText="确认解决"` | ✅ 有 |
| 3 | 点击确认 → 调 API | `handleResolveWrapper` → `handleResolve` → `resolveTicket(...)` | ✅ 真实调用 |
| 4 | 保存成功 | `message.success('工单已标记为已解决')` + `loadTicket()` 刷新 | ✅ 有提示+刷新 |
| 5 | 保存失败 | `message.error('解决失败')` + Modal 不关 | ⚠️ 有 error 但 **Modal 无 confirmLoading**，用户可能连点，导致重复请求；`resolutionNote` 已输入但因 `loadTicket` 未清空 form，可再次提交（好），但也可能重复触发 |
| 6 | 添加评论 | `TextArea` + 提交按钮 + 字数限制 | ✅ 有输入框 + 提交 |
| 6a | 提交评论 | 立即 `message.success('评论已提交')` 再 fire-and-forget `submitComment.execute()` | ⚠️ **无 await，无 loading 阻塞 UI 刷新**；若 API 失败用户已看到"已提交"再看到"操作失败" |

**断点**：
- **断点 1（P1）**：状态选择不是"下拉"而是"多个独立按钮 + 状态机白名单"，Open → Resolved 需两步（先 Assign→assigned，再 Resolve），场景"直接改状态"被产品模型阻断；建议增加"批量状态跳转"或在 Open 状态下提供"分配并解决"合并入口。
- **断点 2（P1）**：加载中的 ticket 被误判为 404（`!ticket` 直接渲染 `TicketNotFound`），首次访问慢网络时会闪 404。
- **断点 3（P1）**：Escalate 是假提交，用户填完升级理由后点确认 → 看到"工单已升级"→ 刷新页面发现升级历史里根本没有这条记录。

## 关键代码引用

- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketHeader.tsx:120` — 关闭按钮无 `Modal.confirm` 二次确认，直连 `handleClose`。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts:127-130` — `handleEscalate` 空实现，未调 API 却提示成功。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/useTicketDetailState.ts:24,49` — `_loading` 被丢弃 + `if (!ticket) return <TicketNotFound>` 组合，加载态被误渲染成 404。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketDetailModals.tsx:34-142` — 4 个 Modal 全部无 `confirmLoading` / `okButtonProps.disabled`。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/useTicketFormWrappers.ts:17-55` — wrapper 裸 await，无 submitting 状态回传给 Modal。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketComments.tsx:218-220` — 先 `message.success` 后 fire-and-forget `submitComment.execute()`，无 await 且立即清空输入。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketComments.tsx:399-412` — 附件行 `cursor: pointer` 但无 onClick。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketComments.tsx:84-94` — Mention Tag `cursor: pointer` 但无 onClick / onKeyDown。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/index.tsx:70-83` — `Row + Col span={16}/{8}` 固定布局，无响应式断点。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/TicketSidebar.tsx:60-62` — "未分配" 纯文字，无引导 CTA。
- `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/constants.ts:9-11` — 优先级色值混用（`colors.error[400]` vs `'blue'` 语义色名），违反 Token 一致性。

## 修复优先级建议

1. **P1-a**：给 4 个 Modal 加 `confirmLoading={wrapper.submitting}` + `okButtonProps.disabled`（复用 `useSubmit`）。
2. **P1-b**：`handleClose` 前面包一层 `Modal.confirm`。
3. **P1-c**：`handleEscalate` 接 `escalateTicket` API。
4. **P1-d**：评论提交改成 `await submitComment.execute()` 后再提示成功/清空。
5. **P1-e**：加载态用 `Spin`，仅当 `!loading && !ticket` 时才 404。
6. **P2**：附件、Mention Tag 补 onClick / 移除 `cursor: pointer`。
7. **P2**：`Row/Col` 加 `xs sm md lg` 断点，<768px 切 Stack。
8. **P3**：合并/统一优先级色值到 Token；把 `size="small"` 的次级 Card 收敛成 `Descriptions` 分组降低视觉噪音。
