# Task 4.42: 低代码前端流程设计器页面

## 需求概述

Orion 低代码模块的后端 API 已完成（`lowcode-routes.ts`，7 个 RESTful 端点），前端流程设计器页面缺失。本任务实现前端页面，对接后端 API。

## 后端 API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/v1/lowcode/flows | 列出所有流程 |
| GET | /api/v1/lowcode/flows/:id | 获取流程详情 |
| POST | /api/v1/lowcode/flows | 创建流程 |
| PUT | /api/v1/lowcode/flows/:id | 更新流程 |
| DELETE | /api/v1/lowcode/flows/:id | 删除流程 |
| POST | /api/v1/lowcode/flows/:id/publish | 发布流程 |
| POST | /api/v1/lowcode/flows/:id/execute | 执行流程 |

## 实现目标

- 创建 `orion-frontend/src/api/lowcode.ts` API client
- 创建 `orion-frontend/src/pages/lowcode-svc/FlowDesigner/index.tsx` 页面
- 页面包含：流程列表、创建流程弹窗、执行流程弹窗、查看流程详情
- 符合 Orion Design Token 规范

## 验收标准

1. `npm run type-check` 通过，无 TypeScript 错误
2. `npm run lint` 通过
3. 页面能正常加载流程列表
4. 创建流程功能正常
5. 执行流程功能正常
