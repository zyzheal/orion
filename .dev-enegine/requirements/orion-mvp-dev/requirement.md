# Orion MVP 开发需求

## 需求描述

基于 wujie 微前端框架，实现 Orion 平台的完整开发，包括：
- 微前端主应用（React 18 + wujie）
- 外部子应用改造（orion-dba, orion-knowledge, orion-visor）
- 后端服务（Pipeline 引擎、AI 服务、CMDB 等）
- 基础设施（NATS 事件总线、PostgreSQL、Redis）

## 优先级

P0 - MVP 核心功能

## 成功标准

1. 用户可以登录系统
2. 微前端主应用可以加载子应用
3. Pipeline 可以创建和执行
4. 效能看板可以展示数据

## 约束条件

1. 使用 wujie 微前端框架
2. 主应用采用 React 18
3. 子应用保持原有技术栈（Vue 3/React）
4. 所有功能需要符合 WCAG AA 标准

## 相关文档

- [开发任务清单](../../docs/tasks/开发任务.md)
- [任务依赖关系](../../docs/tasks/task-dependencies.md)
- [Sprint 计划](../../docs/tasks/sprint-plan.md)
