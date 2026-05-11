# 下一步行动计划

> 更新日期: 2026-05-11

## 计划 1: 完成架构评审报告

**优先级**: P0
**预计时间**: 1-2 小时

### 步骤

- [ ] 读取 `orion-frontend/src/router/routes.ts` 完整内容，分析域分组
- [ ] 分析 98 个 API client 与后端服务的映射关系
- [ ] 读取各服务的核心源文件 (app.ts, routes, services) 评估骨架质量
- [ ] 编写完整评审报告，包含:
  - 微服务拆分合理性评分 (按域)
  - 前端拆分方案对比 (monorepo / 独立包 / 按域分包)
  - P0/P1/P2 问题清单 + 修复建议
  - 依赖关系图
- [ ] 保存报告到 `docs/review/architecture-review-report.md`

## 计划 2: 修复 platform-core 已知问题

**优先级**: P0
**预计时间**: 30 分钟

### 步骤

- [ ] 修复 `orion-platform-core/src/services/ProjectService.ts`
  - 将 `require('pg')` 替换为 `import { getPool } from '../utils/database'`
  - 使用 `getPool()` 替代直接创建连接池
- [ ] 验证修复后编译通过

## 计划 3: 修复端口不一致

**优先级**: P1
**预计时间**: 15 分钟

### 步骤

- [ ] 统一 `orion-ticket-svc/docker-compose.yml` 端口为 3004
- [ ] 统一 `orion-agent-svc/docker-compose.yml` 端口为 3007
- [ ] 检查其他服务 docker-compose 端口是否与 orchestrator 一致
- [ ] 更新 `docs/architecture.md` 中的端口表 (如需要)

## 计划 4: 创建 workspace 配置

**优先级**: P1
**预计时间**: 20 分钟

### 步骤

- [ ] 在 `orion-microservices/` 根目录创建 `pnpm-workspace.yaml`
- [ ] 配置各服务 package.json 的 name 和 version
- [ ] 验证 workspace 依赖解析

## 计划 5: 创建 orion-knowledge-svc 骨架

**优先级**: P1
**预计时间**: 30 分钟

### 步骤

- [ ] 参照其他服务骨架创建目录结构
- [ ] 创建 Fastify 应用入口 + 路由 + 配置
- [ ] 创建 Dockerfile + docker-compose.yml
- [ ] 在 orchestrator 中验证引用一致性

## 计划 6: 前端拆分方案设计

**优先级**: P2 (依赖计划 1 的评审结果)

### 待决策

- [ ] 是否拆分前端？(评审报告结论)
- [ ] 拆分粒度: 按域 (pipeline/deploy/ticket/monitor/agent) 还是按功能
- [ ] 打包方式: pnpm monorepo vs 独立 Vite 项目 vs wujie 子应用
- [ ] 路由策略: 主应用路由 vs 子应用自治路由

## 当前阻塞项

**无** — 所有工作可并行推进，优先完成评审报告再决策前端拆分。
