# Task 4.42 技术方案：低代码前端流程设计器页面

## 架构决策

### 1. API Client

使用已有的 `orion-frontend/src/api/lowcode.ts`，扩展 `lowcodeApi` 对象方法：

```typescript
export const lowcodeApi = {
  listFlows: async (): Promise<{ flows: LowcodeFlow[] }> => {
    const response = await listFlows();
    return { flows: response.data.data };
  },
  createFlow: async (data: CreateFlowInput): Promise<LowcodeFlow> => {
    const response = await createFlow(data);
    return response.data.data;
  },
  executeFlow: async (id: string, input?: Record<string, unknown>): Promise<{ result: Record<string, unknown> }> => {
    const response = await executeFlow(id, input);
    return { result: response.data.data };
  },
};
```

### 2. FlowDesigner 页面

文件：`orion-frontend/src/pages/lowcode-svc/FlowDesigner/index.tsx`

布局：
- 顶部：页面标题（PlayCircleOutlined + "流程设计器"）
- 搜索栏 + 新建流程按钮（Card 内）
- 流程卡片网格（响应式 grid）
- 空状态：Empty

交互：
- 新建流程 Modal（名称、描述、类型）
- 执行流程 Modal（输入参数 JSON）
- 查看流程详情（Descriptions 展示）
- 所有异步操作带 loading + message 反馈

### 3. 响应格式适配

后端 `GET /api/v1/lowcode/flows` 返回：
```json
{ "success": true, "data": [...], "total": 10, "limit": 50, "offset": 0 }
```

axios interceptor 解包后：`response.data = { data: [...], total, limit, offset }`

`POST /api/v1/lowcode/flows/:id/execute` 返回：
```json
{ "success": true, "data": { "id": "...", "status": "pending", ... }, "message": "..." }
```

### 4. 路由

路由已在 `src/router/routes.tsx` 中配置 `/workflows` → `@/pages/WorkflowDesigner`。

本页面创建于 `src/pages/lowcode-svc/FlowDesigner/index.tsx`，作为独立页面模块存在。

## 设计 Token

| 元素 | 值 |
|------|-----|
| 页面 padding | `spacing.lg` (24px) |
| 标题间距 | `spacing.md` (16px) |
| 卡片间距 | `spacing.md` (16px) |
| 主操作色 | `colors.primary[500]` (#3370E6) |
| 中性次要文字 | `colors.neutral[500]` (#8c8c8c) |
| 中性辅助文字 | `colors.neutral[400]` |
