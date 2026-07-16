# 模块配置化启用架构设计

**日期**: 2026-05-06
**作者**: Claude (via brainstorming skill)

## Context

Orion 平台有 130+ 服务、95 路由、8 个横切关注点。当前所有服务在启动时加载，无法按功能模块配置启用/禁用。

## 问题陈述

1. 所有服务硬编码加载，内存浪费
2. 无模块依赖管理机制
3. 无法按功能域控制服务启用状态
4. 10 个无路由服务加载但无实际用途
5. routes.ts 601 行手动实例化所有服务

## 设计：四层混合架构

### 层级定义

| 层级 | 粒度 | 配置点 | 可禁用 | 示例 |
|------|------|--------|--------|------|
| **L0 核心** | 横切关注点 | 8 | ✗ | Auth/Tenant/DB/EventBus/Audit/Config/Degradation/Privacy |
| **L1 功能域** | 大组 | ~12 | ✓ | AI/Chaos/FinOps/Community/Federation/MultiCloud |
| **L2 服务级** | 单个服务 | ~30 | ✓ | 无路由模块 + 低依赖服务 |
| **L3 特性级** | 路由/特性 | ~50 | ✓ | Feature Flag 级别 API 控制 |

### 核心组件

**1. ModuleRegistry** (`src/services/module-lifecycle/ModuleRegistry.ts`)
- 服务注册表，跟踪所有模块的状态
- 依赖图构建和校验
- 状态转换：registered → starting → active → stopped

**2. ModuleManager** (`src/services/module-lifecycle/ModuleManager.ts`)
- 生命周期管理：register → validate → start → stop
- 从 UnifiedConfigService 读取配置
- 懒加载支持

**3. ModuleRegistryService** (`src/api/module-routes.ts`)
- API 端点查看模块状态
- 运行时启用/禁用模块（L2/L3）

### 配置格式

```yaml
moduleConfig:
  core:
    auth: { enabled: true }
    tenant: { enabled: true }
    database: { enabled: true }
    eventBus: { enabled: true }
    audit: { enabled: true }
    config: { enabled: true }
    degradation: { enabled: true }
    privacy: { enabled: true }
  domains:
    pipeline: { enabled: true }
    ai: { enabled: true, services: { modelVersion: false } }
    chaos: { enabled: false }
    finops: { enabled: true, services: { costTracking: false } }
    # ...
  services:
    adaptivePipeline: { enabled: true }
    consistency: { enabled: false }
    deploymentWindow: { enabled: true }
```

### 依赖安全

- 启动时构建依赖图
- 检测不满足的依赖 → 报错或自动启用
- 禁用服务的路由不注册
- 定时任务不启动，EventBus 不订阅

## 实现路径

Phase 1: 核心基础设施 (ModuleRegistry + ModuleManager)
Phase 2: 统一配置集成 (moduleConfig 域)
Phase 3: routes.ts 模块化改造
Phase 4: API 端点和管理界面
Phase 5: 测试和验证
