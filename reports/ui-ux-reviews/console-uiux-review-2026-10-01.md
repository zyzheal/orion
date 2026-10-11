# Console UI/UX 评审（ui-ux-pro-max 技能首次实战）

**评审对象**：`orion-frontend/src/pages/Console/`（50 行 index + 4 Components + 1 hook）
**评审日期**：2026-10-01
**评审方法**：ui-ux-pro-max 三角色面板

---

## 三角色评分

| 角色 | 评分 | 主要问题 |
|------|------|----------|
| Interaction Designer | 7/10 | 加载态、错误态、刷新反馈都覆盖；但 QuickNav 用 window.location.href 不是 SPA 导航 |
| UX Researcher | 8/10 | 用户任务模型清晰（管理员查看系统概览），首屏信息密度合理 |
| Visual Designer | 7/10 | Design Token 使用一致，图标语义化（Appstore/Setting/User） |

**综合评分**：**7.3 / 10**（良好，有小问题）

---

## 阻塞项（P0）

### P0-1：QuickNav 用 window.location.href 破坏 SPA 体验

`Components/QuickNav.tsx:47-49`：
```tsx
onClick={() => {
  window.location.href = item.path;
}}
```

**问题**：
- 用 `window.location.href` 而不是 `navigate(item.path)`（React Router）
- 触发完整页面刷新，丢失 SPA 状态（如未保存的表单、路由状态）
- 违反 React SPA 最佳实践

**修复建议**：
```tsx
const navigate = useNavigate();
// ...
onClick={() => navigate(item.path)}
```

---

## 严重项（P1）

### P1-1：错误态回退到硬编码"演示数据"

`useConsoleState.ts:24-29`：
```typescript
const FALLBACK_STATS: ConsoleStats = {
  totalPlugins: 5,
  activePlugins: 3,
  totalFlags: 8,
  enabledFlags: 6,
};
```

`useConsoleState.ts:50-53`：
```typescript
} catch (err) {
  console.error('加载控制台数据失败:', err);
  setError('部分数据加载失败，使用演示数据');
  setStats(FALLBACK_STATS);
}
```

**问题**：
- API 失败时显示假数据（5 插件、3 激活、8 flag、6 启用）
- 用户看到的"5 插件"可能完全不存在
- 是"静默失败"反模式（CLAUDE.md 明确禁止）
- 同 DashboardNew P1-1 问题

**修复建议**：
- 错误态显示真实错误，不填充假数据
- 或明确标注"演示模式"开关

### P1-2：初始加载无错误态（初始 loading 期间不显示 error）

`index.tsx:18-26`：
```tsx
if (initialLoading) {
  return (
    <div style={{ ... }}>
      <Spin size="large" tip="加载中..." />
    </div>
  );
}
```

**问题**：
- 首次加载时只显示 Spin，如果加载失败，用户看不到任何错误提示
- 第二次刷新（`handleRefresh`）会 setInitialLoading(true)，此时错误被吞掉

**修复建议**：
- 初始加载失败时也显示 Alert

### P1-3：handleRefresh 用 message.info 但无禁用态

`useConsoleState.ts:64-68`：
```typescript
const handleRefresh = () => {
  setInitialLoading(true);
  loadStats();
  message.info('正在刷新数据...');
};
```

**问题**：
- 刷新按钮无 disabled/loading 状态（依赖 PageHeader 组件，未验证）
- 用户可能连续点击刷新

**修复建议**：
- PageHeader 的刷新按钮在 loading 时禁用

---

## 良好实践（值得保留）

1. **组件拆分合理**：4 组件 + 1 hook，职责单一
2. **并行 API 请求**：`Promise.all([getInstalledPlugins(), getFeatureFlags()])` 性能优化
3. **错误态完整**：有 `setError` + Alert 显示
4. **刷新反馈**：`message.info('正在刷新数据...')`
5. **Design Token 使用**：`spacing.md`、`colors.primary[500]`、`colors.purple[500]`、`colors.info[500]`
6. **图标语义化**：AppstoreOutlined（插件）/ SettingOutlined（配置）/ UserOutlined（用户）
7. **QuickNav 视觉设计优秀**：hoverable Card + 图标 + 标题 + 描述三层信息

---

## 场景逆向验证

**场景**：管理员进入控制台，查看系统概览，跳转到插件管理

| 步骤 | 期望 | 实际 | 状态 |
|------|------|------|------|
| 1. 页面加载 | 显示 StatsCards + QuickNav + GovernanceCards | 显示，但初始 loading 全屏 Spin | ✅ |
| 2. 点击 QuickNav 卡片 | 跳转到插件管理 | window.location.href 跳转（非 SPA） | ⚠️ |
| 3. 加载失败 | 有 error 提示 | 有 Alert + 假数据回退 | ⚠️ |
| 4. 空数据 | 有引导按钮 | 无（直接显示 0） | ❌ |
| 5. 刷新 | 有 loading 反馈 | 有 message.info | ✅ |

**断点**：
- QuickNav 用 window.location.href 破坏 SPA
- 错误态回退到假数据
- 初始加载失败无错误态

---

## 关键代码引用

| 文件:行号 | 问题 |
|-----------|------|
| `Components/QuickNav.tsx:47-49` | window.location.href 非 SPA 导航 |
| `useConsoleState.ts:24-29` | FALLBACK_STATS 硬编码假数据 |
| `useConsoleState.ts:50-53` | 错误态填充假数据 |
| `index.tsx:18-26` | 初始 loading 无错误态 |
| `useConsoleState.ts:64-68` | handleRefresh 无禁用态 |

---

## 综合结论

Console 页面**结构优秀但有 SPA 破坏和假数据问题**：
- QuickNav window.location.href 破坏 SPA 体验
- 错误态回退到硬编码假数据（5/3/8/6）
- 初始加载失败无错误提示

**修复优先级**：
1. P0-1（SPA 导航）— 架构问题
2. P1-1（假数据回退）— 信誉风险
3. P1-2（初始错误态）— 用户体验
4. P1-3（刷新禁用态）— 边界情况

---

## 与 DashboardNew 的共性问题

| 问题 | DashboardNew | Console |
|------|--------------|---------|
| 假数据回退 | ✅（系统健康 fallback） | ✅（FALLBACK_STATS） |
| 错误提示不一致 | ✅（warning 类型） | ❌（warning 但合理） |
| 初始 loading 无错误态 | ❌ | ✅ |
| window.location.href | ❌ | ✅ |

**系统性问题**：两个页面都有"假数据回退"反模式，建议在项目层面统一处理（如 axios interceptor 或 API wrapper）。
