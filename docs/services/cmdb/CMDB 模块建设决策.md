# CMDB 模块建设决策 - 自研 vs 改造

> 版本：v1.0  
> 日期：2026-04-10  
> 状态：决策完成

---

## 一、决策摘要

**决策结果**：采用「**复用 50% + 改造 30% + 自研 20%**」的混合策略

**预计工期**：4 周（相比纯自研 8 周节省 50% 时间）

**目标系统**：orion-visor（Dromara 社区运维平台，Apache-2.0 协议）

---

## 二、orion-visor 资产模块分析

### 2.1 核心功能清单（已通过代码分析确认）

| 模块 | 功能 | 实现状态 | 代码位置 |
|------|------|---------|---------|
| **主机管理** | 主机 CRUD、分组、标签 | ✅ 已实现 | `module-asset-provider` |
| **连接配置** | SSH/RDP/VNC 配置管理 | ✅ 已实现 | `module-asset-provider` |
| **Agent 管理** | Agent 注册、心跳、状态监控 | ✅ 已实现 | `module-monitor` |
| **数据权限** | 基于角色的数据授权 | ✅ 已实现 | `module-asset-provider` |
| **数据分组** | 树形分组管理 | ✅ 已实现 | `module-asset-provider` |
| **命令片段** | 常用命令 snippets | ✅ 已实现 | `module-asset-provider` |
| **字典配置** | 动态配置管理 | ✅ 已实现 | `module-asset-provider` |
| **批量执行** | 批量命令执行、文件分发 | ✅ 已实现 | `module-exec` |
| **终端连接** | Web SSH/RDP/VNC | ✅ 已实现 | `module-terminal` |
| **系统监控** | CPU/内存/磁盘/网络监控 | ✅ 已实现 | `module-monitor` |

### 2.2 数据库 Schema（核心表）

```sql
-- 资产管理
host                  - 主机表
host_ssh_config       - SSH 配置表
host_rdp_config       - RDP 配置表
host_vnc_config       - VNC 配置表

-- 权限与分组
data_group            - 数据分组表（树形结构）
data_group_rel        - 分组关联表
data_permission       - 数据权限表
data_extra            - 数据扩展信息表（JSON 扩展字段）

-- 执行与日志
command_snippet       - 命令片段表
exec_host_log         - 主机执行日志表

-- 配置管理
dict_key              - 字典配置项
dict_value            - 字典配置值
```

### 2.3 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端 | Spring Boot | 2.7+ |
| 前端 | Vue 3 + Arco Design | 3.5+ / 2.56+ |
| 数据库 | MySQL | 8.0+ |
| 缓存 | Redis | 6.0+ |
| 时序库 | InfluxDB | 2.7+ |
| 架构 | 模块化单体 | 6 个模块 |

---

## 三、Orion 平台 CMDB 需求对比

| 需求维度 | Orion 平台需求 | orion-visor 现状 | 匹配度 | 处理方式 |
|---------|---------------|-----------------|--------|---------|
| **主机资产管理** | 物理机/虚拟机/容器 | 物理机/虚拟机 | ✅ 80% | 复用 + 扩展 |
| **K8s 资源管理** | Pod/Deployment/Service | ❌ 无 | ❌ 0% | 自研 |
| **CI/CD 资源** | PipelineRun/TaskRun | ❌ 无 | ❌ 0% | 自研 |
| **GitOps 资源** | ArgoCD Application | ❌ 无 | ❌ 0% | 自研 |
| **AI 算力资源** | GPU 池/向量库实例 | ❌ 无 | ❌ 0% | 自研 |
| **多租户隔离** | Namespace 级隔离 | 简单数据权限 | ⚠️ 20% | 改造 |
| **事件驱动** | NATS 事件总线 | ❌ 无 | ❌ 0% | 自研 |
| **监控存储** | Prometheus + ClickHouse | InfluxDB | ⚠️ 40% | 改造 |
| **终端连接** | SSH/RDP 基础连接 | 完整 Web Terminal | ✅ 100% | 复用 |
| **批量操作** | 批量命令执行 | 完整批量执行 | ✅ 100% | 复用 |
| **Agent 监控** | Agent 心跳/状态 | Agent 心跳/状态 | ✅ 100% | 复用 |

---

## 四、建设策略

### 4.1 复用清单（50%，无需修改或微调）

| 组件 | 路径 | 复用方式 | 工作量 |
|------|------|---------|--------|
| 主机 CRUD | `module-asset-provider` | 复制代码 | 0.5 天 |
| SSH 连接 | `module-terminal` | 复制代码 | 0.5 天 |
| RDP/VNC 连接 | `module-terminal` | 复制代码 | 0.5 天 |
| 批量执行 | `module-exec` | 复制代码 | 1 天 |
| Agent 心跳 | `module-monitor` | 复制代码 | 0.5 天 |
| 数据分组 | `module-asset-provider` | 复制代码 | 0.5 天 |
| 前端组件 | `orion-visor-ui` | 参考 + 适配 | 2 天 |

**小计**：5 天

### 4.2 改造清单（30%，需修改适配）

| 组件 | 改造内容 | 工作量 |
|------|---------|--------|
| 数据权限 | 增加多租户 + RBAC+ABAC 混合授权 | 3 天 |
| 数据库 Schema | 扩展 K8s 资源表、CI/CD 资源表、AI 资源表 | 2 天 |
| 监控存储 | InfluxDB → ClickHouse（API 适配） | 5 天 |
| 认证模块 | 对接 Orion SSO（Keycloak） | 2 天 |
| 日志模块 | 适配 Orion 统一日志规范 | 1 天 |

**小计**：13 天

### 4.3 自研清单（20%，Orion 专属需求）

| 组件 | 功能 | 工作量 |
|------|------|--------|
| K8s 集成服务 | CRD 管理、PipelineRun/TaskRun 同步 | 10 天 |
| GitOps 服务 | ArgoCD Application 管理、配置漂移检测 | 5 天 |
| 事件总线服务 | NATS 事件发布/订阅、JetStream 持久化 | 3 天 |
| AI 资源服务 | GPU 池管理、向量库实例管理 | 5 天 |
| 成本采集服务 | FinOps 成本数据采集与分摊 | 3 天 |

**小计**：26 天

---

## 五、架构设计

### 5.1 orion-visor 当前架构

```
┌────────────────────────────────────┐
│   Vue 3 Frontend (Arco Design)     │
├────────────────────────────────────┤
│   Spring Boot Monolith             │
│   ├── module-asset    (主机管理)   │
│   ├── module-terminal (终端连接)   │
│   ├── module-exec     (批量执行)   │
│   ├── module-monitor  (系统监控)   │
│   ├── module-infra    (基础设施)   │
│   └── module-common   (公共模块)   │
├────────────────────────────────────┤
│   MySQL 8.0 + Redis 6.0 + InfluxDB │
└────────────────────────────────────┘
```

### 5.2 改造后 Orion CMDB 架构

```
┌─────────────────────────────────────────┐
│   Vue 3 Frontend (复用 + 新增)          │
│   ├── 主机管理页面 (复用)               │
│   ├── K8s 资源页面 (新增)               │
│   ├── CI/CD 资源页面 (新增)             │
│   └── AI 资源页面 (新增)                │
├─────────────────────────────────────────┤
│   Orion CMDB Service (微服务)           │
│   ├── Host Service      (复用)          │
│   ├── K8s Service       (自研)          │
│   ├── CICD Service      (自研)          │
│   ├── GitOps Service    (自研)          │
│   ├── Event Service     (自研)          │
│   └── AI Resource Svc   (自研)          │
├─────────────────────────────────────────┤
│   MySQL 8.0 + Redis 7.0 + ClickHouse    │
│   + NATS JetStream                      │
├─────────────────────────────────────────┤
│   K8s Cluster                           │
│   ├── PipelineRun CRD                   │
│   ├── TaskRun CRD                       │
│   └── Application CRD (ArgoCD)          │
└─────────────────────────────────────────┘
```

---

## 六、工期估算

### 6.1 分阶段计划

| 阶段 | 工作内容 | 工期 | 产出 |
|------|---------|------|------|
| **Phase 1** | 代码分析 + 复用提取 | 3 天 | 复用代码清单、License 合规检查 |
| **Phase 2** | 数据库 Schema 改造 | 5 天 | CMDB 完整 Schema、迁移脚本 |
| **Phase 3** | K8s/GitOps 集成自研 | 10 天 | K8s Client、ArgoCD 集成 |
| **Phase 4** | 事件总线 + AI 资源 | 8 天 | NATS 集成、GPU 池管理 |
| **Phase 5** | 前端适配 + 联调 | 7 天 | 完整前端页面 |
| **Phase 6** | 测试 + 文档 | 5 天 | 测试报告、运维手册 |
| **总计** | | **~4 周 (28 人天)** | |

### 6.2 里程碑

```
Week 1: Phase 1 + Phase 2 (代码提取 + Schema 改造)
Week 2: Phase 3 (K8s/GitOps 集成)
Week 3: Phase 4 + Phase 5 (事件总线 + 前端适配)
Week 4: Phase 5 + Phase 6 (联调 + 测试)
```

---

## 七、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| orion-visor 协议限制 | 低 | 高 | Apache-2.0 允许商用，已确认 |
| 代码耦合度高 | 中 | 中 | 提前进行代码解耦分析 |
| InfluxDB → ClickHouse 迁移复杂 | 中 | 中 | 预留 5 天工期，必要时保留双写 |
| K8s CRD 同步延迟 | 低 | 中 | 采用 Watch + 定时对账双机制 |
| 前端适配工作量大 | 中 | 低 | 优先复用核心页面，渐进式替换 |

---

## 八、决策理由

### 8.1 为什么不纯自研？

| 因素 | 纯自研 | 混合策略 |
|------|--------|---------|
| 工期 | 8 周 | 4 周 |
| 风险 | 高（所有功能从头开发） | 中（核心功能已验证） |
| 质量 | 未知 | 高（orion-visor 已生产验证） |
| 成本 | 高 | 中 |

### 8.2 为什么不全盘复用？

| 因素 | 全盘复用 | 混合策略 |
|------|---------|---------|
| Orion 专属需求 | 无法满足 | 可满足 |
| 技术栈统一 | 部分冲突 (InfluxDB) | 完全统一 |
| 架构灵活性 | 单体限制 | 微服务可扩展 |
| 长期维护 | 依赖社区节奏 | 自主可控 |

---

## 九、合规检查

### 9.1 orion-visor 协议

```
License: Apache License 2.0
Copyright: 2023 - present Dromara
Members: Jiahang Li - ljh1553488six@139.com

允许商用、修改、分发，需保留版权声明
```

### 9.2 合规要求

- ✅ 保留原版权声明
- ✅ 修改文件需标注变更
- ✅ 分发时包含 License 副本
- ⚠️ 需在 Orion 项目文档中声明使用了 orion-visor 代码

---

## 十、下一步行动

| 任务 | 负责人 | 截止日期 |
|------|--------|---------|
| 代码复用清单细化 | 待认领 | - |
| License 合规检查 | 待认领 | - |
| 数据库 Schema 设计 | 待认领 | - |
| K8s 集成技术方案 | 待认领 | - |
| 前端复用评估 | 待认领 | - |

---

_文档版本：v1.0_  
_创建日期：2026-04-10_
