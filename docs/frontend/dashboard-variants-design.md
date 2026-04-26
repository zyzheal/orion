# Frontend Dashboard Variants Design

> 创建日期: 2026-04-23 | 关联: M1 效能看板

---

## 1. 概述

Orion 平台提供多种 Dashboard 视图以满足不同角色用户的需求。本文档记录各 Dashboard 变体的设计和使用场景。

## 2. Dashboard 变体

### 2.1 Console (主控制台)

| 属性 | 值 |
|------|------|
| 路径 | `/console` |
| 组件 | `pages/Console/index.tsx` |
| 目标用户 | 所有登录用户 |
| 功能 | 快速概览、最近活动、快捷入口 |

**页面结构**:
- 顶部: 用户信息 + 通知
- 左侧: 导航菜单
- 中央: 仪表盘卡片网格
- 底部: 快捷操作栏

### 2.2 Dashboard (默认仪表盘)

| 属性 | 值 |
|------|------|
| 路径 | `/dashboard` |
| 组件 | `pages/Dashboard/index.tsx` |
| 目标用户 | 普通用户 |
| 功能 | 流水线状态、部署概览、告警摘要 |

### 2.3 DashboardCore (核心仪表盘)

| 属性 | 值 |
|------|------|
| 路径 | `/dashboard-core` |
| 组件 | `pages/DashboardCore/index.tsx` |
| 功能 | 核心指标展示、简化视图 |

### 2.4 DashboardNew (新版仪表盘)

| 属性 | 值 |
|------|------|
| 路径 | `/dashboard-new` |
| 组件 | `pages/DashboardNew/index.tsx` |
| 功能 | 实验性新布局、新组件 |

### 2.5 EngineerDashboard (工程师视图)

| 属性 | 值 |
|------|------|
| 路径 | `/engineer-dashboard` |
| 组件 | `pages/EngineerDashboard/index.tsx` |
| 目标用户 | 开发工程师 |

**功能特点**:
- 我的流水线
- 我的代码审查
- 我的部署
- 构建历史
- 测试结果

### 2.6 ExecutiveDashboard (管理层视图)

| 属性 | 值 |
|------|------|
| 路径 | `/executive-dashboard` |
| 组件 | `pages/ExecutiveDashboard/index.tsx` |
| 目标用户: CTO/VP/总监 |

**功能特点**:
- 业务指标大屏
- 团队效能排名
- 成本概览
- 风险告警
- 趋势图表

### 2.7 ManagerDashboard (经理视图)

| 属性 | 值 |
|------|------|
| 路径 | `/manager-dashboard` |
| 组件: `pages/ManagerDashboard/index.tsx` |
| 目标用户: 团队经理、项目经理 |

**功能特点**:
- 团队概览
- 资源使用
- 任务分配
- 进度跟踪

## 3. 路由配置

```typescript
// 路由映射关系
const routes = {
  '/console': Console,
  '/dashboard': Dashboard,
  '/dashboard-core': DashboardCore,
  '/dashboard-new': DashboardNew,
  '/engineer-dashboard': EngineerDashboard,
  '/executive-dashboard': ExecutiveDashboard,
  '/manager-dashboard': ManagerDashboard,
};
```

## 4. 角色权限

| Dashboard | Admin | Engineer | Manager | Executive |
|-----------|-------|----------|---------|-----------|
| Console | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| DashboardCore | ✅ | ✅ | ✅ | - |
| DashboardNew | ✅ | ✅ | - | - |
| EngineerDashboard | ✅ | ✅ | - | - |
| ManagerDashboard | ✅ | - | ✅ | - |
| ExecutiveDashboard | ✅ | - | - | ✅ |

## 5. 已知问题

- ⚠️ 部分 Dashboard 变体路由未在 `App.tsx` 中注册
- ⚠️ ExecutiveDashboard 和 ManagerDashboard 数据可能为空 (Mock 数据)
- ⚠️ 响应式布局需进一步优化

## 6. 后续计划

- [ ] 完成所有 Dashboard 路由注册
- [ ] 补充各 Dashboard 的真实数据源
- [ ] 优化响应式布局
- [ ] 添加个性化配置