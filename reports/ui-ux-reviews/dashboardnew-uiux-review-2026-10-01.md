# DashboardNew UI/UX 评审（ui-ux-pro-max 技能首次实战）

**评审对象**：`orion-frontend/src/pages/DashboardNew/`（100 行 index + 3 Components + 2 hooks）
**评审日期**：2026-10-01
**评审方法**：ui-ux-pro-max 三角色面板（Interaction Designer + UX Researcher + Visual Designer）

---

## 三角色评分

| 角色 | 评分 | 主要问题 |
|------|------|----------|
| Interaction Designer | 7/10 | 加载态、错误态、空状态、重试都覆盖；但 stats 全 0（tasks 硬编码空数组）是"演示模式"假数据 |
| UX Researcher | 6/10 | 首屏信息密度合理，pipeline 概览 + 系统健康 + 快捷操作清晰；但 tasks 永远为空，工作台核心场景断裂 |
| Visual Designer | 7/10 | Design Token 使用一致（spacing.md、Card 组件），图标语义化；响应式 Row/Col 适配合理 |

**综合评分**：**6.7 / 10**（良好，有明确的假数据问题）

---

## 阻塞项（P0）

### P0-1：tasks 永远为空数组（硬编码演示数据）

`useDashboardState.ts:30`：
```typescript
const tasks: TaskRecord[] = [];
```

**问题**：
- "待处理任务" 卡片永远显示 `<Empty description="暂无待处理任务">`
- 用户点击"查看全部"跳转的路由 `/tasks` 可能不存在（未验证）
- 工作台的核心场景（"今日待办"）完全断裂

**影响**：
- 用户打开工作台看不到任何任务 → 认知负荷为 0，但任务模型也断裂
- taskStats 永远全 0（`{total:0, inProgress:0, todo:0, completed:0}`）
- 是"命名列表容器"反模式（同 BI/BI Dashboard 5 字段问题）

**修复建议**：
- 从后端拉取 `/api/tasks` 或 `/api/tickets?assignee=me&status=todo`
- 或暂时隐藏 tasks 卡片，避免"永远为空"的用户困惑

---

## 严重项（P1）

### P1-1：加载失败回退到"演示数据"

`useDashboardState.ts:81-83`：
```typescript
} catch {
  message.error('加载数据失败，使用演示数据展示');
  setError('加载数据失败，使用演示数据展示');
}
```

**问题**：
- 错误态显示"使用演示数据展示"，但实际 `pipelines`/`recentRuns` 保持空数组
- 用户看到的错误提示与实际界面不一致（错误提示说"演示数据"，界面是空的）
- 这是"静默失败"的反模式（CLAUDE.md 明确禁止）

**修复建议**：
- 要么真的填充演示数据（明确标注"演示模式"）
- 要么错误态显示真实错误信息，不误导用户

### P1-2：错误提示 Alert 用 type="warning" 但实际是严重错误

`index.tsx:65-72`：
```tsx
<Alert
  message="提示"
  description={error}
  type="warning"  // ← 应该是 "error"
  ...
/>
```

**问题**：
- API 失败用 "warning" 类型，视觉层级不够
- 用户可能忽略严重的加载失败

**修复建议**：改为 `type="error"`

### P1-3：系统健康数据 fallback 到硬编码假数据

`useDashboardState.ts:64-75`：
```typescript
if (mapped.length > 0) {
  setSystemHealth(mapped);
} else {
  // fallback 到假数据
  setSystemHealth([
    { name: 'API Gateway', status: baseStatus, ... },
    { name: 'Platform Service', status: baseStatus, ... },
    { name: 'Database', status: baseStatus, ... },
    { name: 'Redis', status: baseStatus, ... },
  ]);
}
```

**问题**：
- 当健康 API 无数据时，显示 4 个"假服务"（API Gateway/Platform Service/Database/Redis）
- 状态可能显示"healthy"（`baseStatus = 'healthy'`）但实际服务可能挂了
- 是"假阳性工厂"（同巡检模块 3 个 health checker 硬编码 `{status: "ok"}` 问题）

**修复建议**：
- 无数据时显示 Empty 状态 + 引导按钮"检查服务健康"
- 或显示"服务健康数据加载中/不可用"，不假装健康

---

## 良好实践（值得保留）

1. **组件拆分合理**：8 文件（index + 3 Components + 2 hooks + types + constants），每个文件职责单一
2. **加载态完整**：`initialLoading` 全屏 Spin + 提示文字
3. **响应式适配**：`Col xs={24} xl={16/8}` 适配不同屏幕
4. **重试机制**：`handleRetry` 有 `message.success` 反馈
5. **空状态引导**：Pipeline 卡片空状态有"创建 Pipeline"引导按钮
6. **系统健康 fallback 逻辑存在**：先试 `getServiceHealthList`，失败再试 `getMonitoringHealth`

---

## 场景逆向验证

**场景**：进入工作台查看今日概览，点击 pipeline 快速跳转

| 步骤 | 期望 | 实际 | 状态 |
|------|------|------|------|
| 1. 页面加载 | 首屏显示 pipeline 概览 | 显示 pipeline + tasks（tasks 永远空） | ⚠️ 部分 |
| 2. 卡片点击 | 有跳转入口 | Pipeline 卡片有"查看全部"跳转 /pipeline-runs | ✅ |
| 3. 加载失败 | 有 error 提示 | 有 Alert + message.error，但用 warning 类型 | ⚠️ |
| 4. 空数据 | 有引导按钮 | Pipeline 有"创建 Pipeline"按钮，tasks 无引导 | ⚠️ 部分 |

**断点**：
- tasks 永远为空 → 工作台"今日待办"场景完全断裂
- 加载失败回退到"演示数据"但实际不填充 → 用户困惑

---

## 关键代码引用

| 文件:行号 | 问题 |
|-----------|------|
| `useDashboardState.ts:30` | `const tasks: TaskRecord[] = [];` 永远空 |
| `useDashboardState.ts:67-75` | 系统健康 fallback 到硬编码 4 个假服务 |
| `useDashboardState.ts:81-83` | 错误态显示"演示数据"但实际空 |
| `index.tsx:68` | Alert type="warning" 应为 "error" |
| `Components/MainColumn.tsx:20` | tasks 卡片"查看全部"按钮无 onClick |

---

## 综合结论

DashboardNew 页面**结构优秀但数据层有"假数据"反模式**：
- tasks 永远空 → 工作台核心场景断裂
- 系统健康 fallback 到假服务 → 假阳性工厂
- 错误提示与实际界面不一致 → 静默失败

**修复优先级**：
1. P0-1（tasks 真实数据）— 阻塞用户核心场景
2. P1-3（系统健康不假阳性）— 信誉风险
3. P1-1（错误态一致性）— 用户困惑
4. P1-2（Alert 类型）— 视觉层级
