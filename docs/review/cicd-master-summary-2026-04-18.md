# CI/CD 模块完成度审计汇总

**日期**: 2026-04-18
**审计方式**: 4 Agent并行审计6个模块，设计文档 vs 代码比对

---

## 总体评分: 42/100 (严重不足)

| # | 模块 | 完成度 | 评级 | 核心问题 |
|---|------|--------|------|----------|
| 1 | Pipeline引擎 | 48% | 严重不足 | TaskRunner全Mock，Saga是硬编码，取消不终止任务 |
| 2 | 构建管理 | 55% | 不足 | K8sExecutor全Mock，Artifact无真实存储，但前端最丰富 |
| 3 | 智能部署 | 40% | 严重不足 | 部署流程全模拟，DeploymentDetail 100% Mock数据，无API调用 |
| 4 | 代码仓库 | 35% | 严重不足 | GitLab/Gerrit适配器全Mock，从未调用registerStartup，10+路径不匹配 |
| 5 | 配置管理 | 50% | 不足 | Service层有真实逻辑(Map)，前端缺GitOps/Diff/审批/版本历史页面 |
| 6 | 确认工作台 | 5% | 未开始 | 后端0实现(无路由/控制器/服务)，前端5页面调不存在API |

---

## 跨模块共性

### 1. Mock架构 (所有6模块)
- **所有服务**使用 `Map()` 存储，Phase 1已创建DB迁移但未迁移
- **TaskRunner** 5种任务类型全部模拟(sleep+返回假数据)
- **K8sBuildExecutor** 内联MockK8sClient，`@kubernetes/client-node`从未import
- **外部适配器** GitLabAdapter(745行)、GerritAdapter(563行)全部返回硬编码数据

### 2. 前端-后端不对齐 (31处不匹配)
| 模块 | 前端调用 | 后端期望 | 结果 |
|------|---------|---------|------|
| 部署 | `GET /v1/deployments` | `POST/GET /api/v1/deploy/` | 404 |
| 代码仓库 | `/v1/code-repo/:id/repos` | `/api/v1/code-repo/:adapterId/repositories` | 404 |
| 配置 | 发送 `category`/`sensitive` | 期望 `createdBy`/`updatedBy` | 字段名不匹配 |
| 确认工作台 | 7个API调用 `/v1/confirmations/*` | 0个路由 | 全部404 |

### 3. 前端丰富度不均
| 页面 | 丰富度 | 备注 |
|------|--------|------|
| PipelineEditor | ⭐⭐⭐⭐⭐ 85% | 拖拽编排、YAML预览、Stage CRUD、缓存/产物配置 |
| BuildLogViewer | ⭐⭐⭐⭐⭐ 90% | SSE实时日志、暂停/恢复、搜索高亮、暗色终端主题 |
| BuildEnv | ⭐⭐⭐⭐ 75% | 表格+排序+搜索+弹窗表单+状态徽章 |
| PipelineList | ⭐⭐⭐ 70% | 表格+过滤，但调错API |
| DeploymentList | ⭐⭐⭐ 55% | 有过滤+状态，但调不存在API |
| DeploymentDetail | ⭐ 10% | 100% Mock数据，无API调用 |
| ConfigManagement | ⭐⭐⭐ 50% | 单一页面419行，缺GitOps/Diff/审批子页面 |
| ConfirmationWorkbench | ⭐⭐ 25% | 5个页面全Mock，无后端 |

---

## 关键Bug (P0级)

| # | Bug | 位置 | 影响 |
|---|-----|------|------|
| P0-1 | PipelineList调 `getPipelineRuns()` 而非 `getPipelines()` | PipelineList/index.tsx | 列表页显示运行数据而非Pipeline数据 |
| P0-2 | DeploymentDetail无API调用，100% Mock数据 | DeploymentDetail/index.tsx | 页面永远显示假数据 |
| P0-3 | Stage超时不取消底层Task | StageExecutor.ts | 资源泄漏 |
| P0-4 | cancelRun只改状态，不停止运行中Stage | PipelineRunService.ts | 取消无效 |
| P0-5 | PipelineSaga executeStages硬编码返回SUCCESS | PipelineSaga.ts | 分布式事务安全网失效 |
| P0-6 | 确认工作台后端0实现 | 无文件 | 7个前端API全部404 |
| P0-7 | GitLab/Gerrit适配器从未注册 | index.ts | 外部集成完全不通 |
| P0-8 | PipelineEditor生成YAML格式后端不兼容 | YAML schema不一致 | 即使真实DB也无法解析 |

---

## 设计文档缺失项 (按优先级)

### P1 高优
1. Pipeline实时日志WebSocket流
2. 部署对比视图(Diff View)
3. 部署时间线可视化
4. 回滚历史UI
5. GitOps管理页面
6. 配置Diff分析页面
7. 配置版本历史
8. 配置审批工作流页面
9. 构建历史趋势图
10. 缓存统计监控面板

### P2 中优
11. Pipeline多环境触发器
12. 构建缓存自动语言检测
13. LFU/FIFO缓存淘汰策略
14. 缓存清理定时任务
15. 部署蓝绿/金丝雀策略真实执行
16. 部署健康检查(真实K8s)
17. 部署指标采集(真实监控)
18. 流量切换(真实Ingress)
19. 代码仓库Webhook自动注册
20. 确认工作台后端CRUD+执行

---

## 各报告路径

| 报告 | 路径 |
|------|------|
| Pipeline引擎 | `docs/review/cicd-pipeline-audit-2026-04-18.md` |
| 构建管理 | `docs/review/cicd-build-audit-2026-04-18.md` |
| 智能部署 | `docs/review/cicd-deployment-audit-2026-04-18.md` |
| 代码仓库/配置/确认 | `docs/review/cicd-misc-audit-2026-04-18.md` |
