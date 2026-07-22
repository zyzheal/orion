# ADR-0013: 微前端 Orion-MF 迁移

## Status

**Proposed** — 待补充

## Context

Orion 前端采用自研微前端框架 Orion-MF，支持子应用动态加载。需要从单体 SPA 到微前端的架构迁移决策记录。

## Decision

待架构委员会补充：

- [ ] Orion-MF 与 Vue3/React 子应用的集成模式
- [ ] 微前端子应用的路由隔离策略（`/api/v1` 统一入口）
- [ ] 子应用间的通信协议（EventBus + Channel）
- [ ] 样式隔离方案（CSS Module / Shadow DOM）
- [ ] 共享依赖管理（`node_modules` 共享 vs 独立打包）
- [ ] 微前端构建产物与部署策略
- [ ] 子应用的生命周期管理（加载、渲染、卸载）

## Consequences

- 正向：支持独立开发、独立部署，降低耦合
- 风险：子应用版本兼容性；资源隔离不当导致样式冲突

## 相关

- 前端实现：`orion-frontend/src/`
- 微前端框架：`orion-frontend/src/router/routes.tsx`
- 架构设计：`docs/architecture/微前端子应用接入与后端交互设计.md`
- ADR-0010 (API 网关)
