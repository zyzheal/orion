# Configuration Drift Detection and Rollback Design

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**优先级**: P1  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会、SRE 团队、安全与合规团队  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台的配置漂移检测与自动回滚机制。在 GitOps 实践当中，Git 仓库中声明的期望状态（Desired State）与 Kubernetes 集群中的实际状态（Actual State）之间可能出现不一致，这种不一致被称为"配置漂移"（Configuration Drift）。

配置漂移是分布式系统中的常见问题，可能由以下原因引起：
- 运维人员通过 `kubectl edit` 直接修改集群资源
- 临时热修复绕过 GitOps 流程
- 自动扩缩容（HPA/VPA）调整副本数或资源规格
- 第三方控制器或 Operator 自动修改配置
- 恶意或未授权的集群访问

### 漂移风险等级分类

| 风险等级 | 漂移类型 | 影响范围 | 检测 SLA | 回滚 SLA |
|---------|---------|---------|---------|---------|
| **P0 - 严重** | 安全策略、网络策略、RBAC 变更 | 全集群/多租户 | < 1 分钟 | < 5 分钟 |
| **P1 - 高** | 资源规格、副本数、探针配置 | 单应用/服务 | < 5 分钟 | < 15 分钟 |
| **P2 - 中** | 环境变量、标签、注解 | 单 Pod/容器 | < 15 分钟 | < 30 分钟 |
| **P3 - 低** | 元数据、描述信息 | 无功能影响 | < 1 小时 | 手动处理 |

### 预期收益量化

| 指标 | 当前状态 | 目标状态 | 改善幅度 |
|------|---------|---------|---------|
| 漂移检测时间 | 人工发现（平均 4 小时） | 自动检测（< 5 分钟） | 98% |
| 配置恢复时间 | 手动回滚（平均 30 分钟） | 自动回滚（< 15 分钟） | 50% |
| 未授权变更 | 无审计追溯 | 100% 可追溯 | - |
| 合规审计通过率 | 75% | 99% | 32% |

---

## 一、漂移检测架构 (Drift Detection Architecture)

### 1.1 核心概念定义

| 术语 | 定义 | 示例 |
|------|------|------|
| **期望状态 (Desired State)** | Git 仓库中声明的资源配置 | `k8s/production/app-deployment.yaml` |
| **实际状态 (Actual State)** | Kubernetes 集群中当前的资源状态 | `kubectl get deployment app -o yaml` |
| **漂移 (Drift)** | 期望状态与实际状态之间的差异 | 副本数从 3 变为 5 |
| **漂移检测 (Drift Detection)** | 对比期望状态与实际状态的过程 | 定时扫描/事件触发 |
| **回滚 (Rollback)** | 将实际状态恢复到期望状态的操作 | `kubectl apply -f git-repo` |

### 1.2 漂移检测架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Configuration Drift Detection Architecture                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   Git Repository │
                                    │   (Source of     │
                                    │    Truth)        │
                                    │                  │
                                    │ ┌──────────────┐ │
                                    │ │ k8s/         │ │
                                    │ │   production/│ │
                                    │ │   staging/   │ │
                                    │ │   dev/       │ │
                                    │ └──────────────┘ │
                                    └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    │  (1) Git Webhook       │ (2)定时扫描             │ (3) K8s Watch
                    │  push/event            │ 5m/15m/60m             │ 资源变更事件
                    ▼                        ▼                        ▼
         ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
         │  Drift Detector  │    │  Drift Detector  │    │  Drift Detector  │
         │  (Webhook Trigger│    │  (Scheduler      │    │  (Watch          │
         │   Mode)          │    │   Trigger Mode)  │    │   Trigger Mode)  │
         └─────────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
                   │                       │                       │
                   └───────────────────────┼───────────────────────┘
                                           │
                                           ▼
                                 ┌─────────────────┐
                                 │  State          │
                                 │  Comparison     │
                                 │  Engine         │
                                 │                 │
                                 │ ┌─────────────┐ │
                                 │ │ 期望状态解析 │ │
                                 │ │ Actual State│ │
                                 │ │ 差异计算    │ │
                                 │ │ 风险评估    │ │
                                 │ └─────────────┘ │
                                 └────────┬────────┘
                                          │
                   ┌──────────────────────┼──────────────────────┐
                   │                      │                      │
                   ▼                      ▼                      ▼
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │  No Drift       │    │  Drift Detected │    │  Drift Detected │
         │  (记录同步日志)   │    │  (P0/P1 高危)     │    │  (P2/P3 低危)    │
         │                 │    │                 │    │                 │
         │ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
         │ │ Sync Log    │ │    │ │ Auto        │ │    │ │ Drift       │ │
         │ │ Entry       │ │    │ │ Rollback    │ │    │ │ Report      │ │
         │ └─────────────┘ │    │ │ (可选审批)   │ │    │ │ + Alert     │ │
         └─────────────────┘    │ └─────────────┘ │    │ └─────────────┘ │
                                └─────────────────┘    └─────────────────┘
```

### 1.3 组件详细职责

#### 1.3.1 Git 期望状态源 (Git Source of Truth)

| 属性 | 详情 |
|------|------|
| **仓库结构** | 单仓库多目录 vs 多仓库 |
| **分支策略** | `main` (生产), `staging` (预发), `develop` (开发) |
| **目录组织** | 按环境/团队/应用分层组织 |
| **版本控制** | Git Commit Hash + Tag |
| **访问控制** | Branch Protection + CODEOWNERS |

```
Git 仓库目录结构:
├── k8s/
│   ├── production/
│   │   ├── platform/
│   │   │   ├── orion-platform-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   ├── configmap.yaml
│   │   │   │   └── kustomization.yaml
│   │   │   └── orion-pipeline-service/
│   │   ├── business/
│   │   └── infrastructure/
│   ├── staging/
│   └── develop/
├── policies/
│   ├── network-policies/
│   ├── rbac-policies/
│   └── security-policies/
└── drift-config/
    ├── detection-rules.yaml
    └── rollback-policies.yaml
```

#### 1.3.2 漂移检测器 (Drift Detector)

| 属性 | 详情 |
|------|------|
| **部署方式** | Kubernetes Deployment (高可用 2+ 副本) |
| **触发模式** | 定时扫描 + Webhook + K8s Watch |
| **对比引擎** | 基于 Kubernetes  declarative 对比 |
| **存储后端** | PostgreSQL (漂移记录) + Redis (缓存) |
| **通知渠道** | NATS 事件 + Webhook + 邮件/IM |

#### 1.3.3 状态对比引擎 (State Comparison Engine)

| 功能模块 | 职责 | 技术实现 |
|---------|------|---------|
| **期望状态解析** | 从 Git 读取并解析 YAML/JSON | go-git + kustomize |
| **实际状态获取** | 从 K8s API Server 获取资源 | Kubernetes Client-Go |
| **规范化处理** | 移除系统生成字段、排序、格式化 | 规范化过滤器 |
| **差异计算** | 计算字段级差异 | JSON Patch / Strategic Merge Patch |
| **风险评估** | 根据变更字段评估风险等级 | 规则引擎 |

### 1.4 数据流架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Data Flow Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Git Repo  │───▶│   Drift     │───▶│   State     │───▶│   Drift     │
│             │    │   Detector  │    │   Compare   │    │   Store     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                    │
                         ▼                    ▼
                  ┌─────────────┐    ┌─────────────┐
                  │   K8s API   │◀───│   Cache     │
                  │   Server    │    │   (Redis)   │
                  └─────────────┘    └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   K8s       │
                  │   Cluster   │
                  └─────────────┘

数据流详细说明:
├── Step 1: Drift Detector 从 Git 读取期望状态
├── Step 2: Drift Detector 从 K8s 获取实际状态
├── Step 3: State Compare 规范化两个状态
├── Step 4: State Compare 计算差异 (JSON Patch)
├── Step 5: State Compare 评估风险等级
├── Step 6: 漂移信息写入 Drift Store (PostgreSQL)
├── Step 7: 缓存期望状态到 Redis (减少 Git 访问)
└── Step 8: 触发通知/回滚流程
```

---

## 二、检测触发机制 (Detection Trigger Mechanisms)

### 2.1 触发机制总览

漂移检测支持三种触发机制，每种机制适用于不同的场景：

| 触发机制 | 适用场景 | 检测延迟 | 资源消耗 | 配置复杂度 |
|---------|---------|---------|---------|-----------|
| **定时扫描** | 全量对账、兜底检测 | 5-60 分钟 | 中 | 低 |
| **事件触发** | Git 变更实时检测 | < 1 分钟 | 低 | 中 |
| **手动触发** | 应急排查、特定资源 | 即时 | 低 | 低 |

### 2.2 定时扫描 (Scheduled Scan)

#### 2.2.1 扫描策略配置

```yaml
# drift-config/scheduled-scan.yaml
scheduledScan:
  enabled: true
  
  # 全量扫描策略
  fullScan:
    # 全量扫描周期 (Cron 表达式)
    cron: "0 */30 * * * *"  # 每 30 分钟
    timeout: 30m
    resources:
      - apiVersion: apps/v1
        kind: Deployment
      - apiVersion: apps/v1
        kind: StatefulSet
      - apiVersion: batch/v1
        kind: CronJob
      - apiVersion: v1
        kind: ConfigMap
      - apiVersion: v1
        kind: Secret
      
  # 增量扫描策略
  incrementalScan:
    enabled: true
    cron: "0 */5 * * * *"  # 每 5 分钟
    timeout: 10m
    resources:
      - apiVersion: apps/v1
        kind: Deployment
      - apiVersion: apps/v1
        kind: StatefulSet
        
  # 关键资源扫描策略 (P0 级别)
  criticalScan:
    enabled: true
    cron: "0 * * * * *"  # 每 1 分钟
    timeout: 5m
    resources:
      - apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
      - apiVersion: rbac.authorization.k8s.io/v1
        kind: Role
      - apiVersion: rbac.authorization.k8s.io/v1
        kind: ClusterRole
```

#### 2.2.2 扫描执行流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Scheduled Scan Flow Chart                               │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   Scheduler     │
                                    │   Trigger       │
                                    │   (Cron Job)    │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   Acquire       │
                                    │   Distributed   │
                                    │   Lock          │
                                    │   (Redis)       │
                                    └────────┬────────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                          ▼                                     ▼
                  ┌───────────────┐                     ┌───────────────┐
                  │ Lock          │                     │ Lock          │
                  │ Acquired      │                     │ Failed        │
                  │ (继续执行)     │                     │ (跳过本轮)    │
                  └───────┬───────┘                     └───────────────┘
                          │
                          ▼
                  ┌───────────────────┐
                  │ Fetch Scan Config │
                  │ (from Git/Config) │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Iterate Resources │
                  │ (按优先级分组)     │
                  └─────────┬─────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Critical    │ │ Regular     │ │ Low         │
    │ Resources   │ │ Resources   │ │ Resources   │
    │ (P0/P1)     │ │ (P2)        │ │ (P3)        │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Compare & Store   │
                  │ Drift Results     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Release Lock &    │
                  │ Report Metrics    │
                  └───────────────────┘
```

#### 2.2.3 扫描资源配置表

| 资源类型 | API Group | Kind | 扫描优先级 | 建议扫描周期 | 字段白名单 |
|---------|----------|------|-----------|-------------|-----------|
| Deployment | apps/v1 | Deployment | P0 | 5 分钟 | spec.replicas, spec.template.spec, spec.strategy |
| StatefulSet | apps/v1 | StatefulSet | P0 | 5 分钟 | spec.replicas, spec.template.spec |
| ConfigMap | v1 | ConfigMap | P1 | 15 分钟 | data, binaryData |
| Secret | v1 | Secret | P1 | 15 分钟 | data (仅哈希对比) |
| Service | v1 | Service | P2 | 30 分钟 | spec.ports, spec.selector, spec.type |
| Ingress | networking.k8s.io/v1 | Ingress | P1 | 15 分钟 | spec.rules, spec.tls |
| NetworkPolicy | networking.k8s.io/v1 | NetworkPolicy | P0 | 1 分钟 | spec.podSelector, spec.ingress, spec.egress |
| Role | rbac.authorization.k8s.io/v1 | Role | P0 | 1 分钟 | spec.rules |
| ServiceAccount | v1 | ServiceAccount | P1 | 15 分钟 | secrets, imagePullSecrets |

### 2.3 事件触发 (Event Trigger)

#### 2.3.1 Git Webhook 事件

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Git Webhook Event Flow                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   Git Provider  │
│   (GitHub/      │
│   GitLab/       │
│   Gitee)        │
└────────┬────────┘
         │
         │ (1) Push Event
         │ k8s/production/**/*.yaml
         │ OR
         │ (2) PullRequest Merged
         │ target_branch = main
         ▼
┌─────────────────┐
│   Webhook       │
│   Endpoint      │
│   /api/v1/      │
│   drift/webhook │
└────────┬────────┘
         │
         │ (3) 验证 Payload 签名
         │ (4) 解析变更文件列表
         ▼
┌─────────────────┐
│   Changed Files │
│   Filter        │
└────────┬────────┘
         │
         ├─── (仅 k8s 目录变更)
         │
         ▼
┌─────────────────┐
│   Extract       │
│   Resources     │
│   (解析 YAML)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Trigger       │
│   Immediate     │
│   Comparison    │
└─────────────────┘
```

#### 2.3.2 Kubernetes Watch 事件

```yaml
# drift-config/watch-config.yaml
watch:
  enabled: true
  
  # 监听资源列表
  resources:
    - apiVersion: apps/v1
      kind: Deployment
      events: [MODIFIED, DELETED]
      
    - apiVersion: v1
      kind: ConfigMap
      events: [MODIFIED, DELETED]
      
    - apiVersion: v1
      kind: Secret
      events: [MODIFIED, DELETED]
      
    - apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      events: [ADDED, MODIFIED, DELETED]
      
  # 事件过滤规则
  filters:
    # 忽略由 drift-detector 自身引起的变更
    excludeAnnotations:
      - "drift.orion.io/managed-by"
      
    # 忽略特定命名空间
    excludeNamespaces:
      - kube-system
      - drift-detector
      
    # 忽略 HPA/VPA 管理的字段
    ignoreFields:
      - spec.replicas  # 当有 HPA 时
      - spec.template.spec.containers[*].resources
```

#### 2.3.3 Watch 事件处理流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Kubernetes Watch Event Flow                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   K8s API       │
│   Server        │
│   (Watch API)   │
└────────┬────────┘
         │
         │ Watch Stream
         │ Deployment/ConfigMap/Secret
         ▼
┌─────────────────┐
│   Event         │
│   Received      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check if        │
│ Managed by Git  │
│ (检查注解/标签)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌────────┐
│ Managed│  │ Not    │
│ by Git │  │ Managed│
└───┬────┘  └───┬────┘
    │           │
    │           ▼
    │      ┌────────────┐
    │      │ Skip (非   │
    │      │ GitOps 管理)│
    │      └────────────┘
    │
    ▼
┌─────────────────┐
│ Check Filter    │
│ (排除规则)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌────────┐
│ Pass   │  │ Skip   │
│ Filter │  │        │
└───┬────┘  └───┬────┘
    │           │
    ▼           │
┌─────────────┐ │
│ Debounce    │ │
│ (5 秒防抖)    │ │
└──────┬──────┘ │
       │        │
       ▼        │
┌─────────────┐ │
│ Trigger     │ │
│ Comparison  │ │
└─────────────┘ │
                │
                ▼
         ┌──────────────┐
         │ Update       │
         │ LastEventTime│
         └──────────────┘
```

### 2.4 手动触发 (Manual Trigger)

#### 2.4.1 手动触发场景

| 场景 | 命令/API | 适用范围 |
|------|---------|---------|
| 单资源检测 | `orion drift check deployment/app` | 特定资源 |
| 命名空间检测 | `orion drift check namespace --ns production` | 整个命名空间 |
| 全量检测 | `orion drift check --all` | 全集群 |
| 强制回滚 | `orion drift rollback deployment/app --force` | 紧急回滚 |
| 审批回滚 | `orion drift rollback deployment/app --approve` | 需审批回滚 |

#### 2.4.2 手动触发 API

```yaml
# API: POST /api/v1/drift/check
# 手动触发漂移检测

request:
  type: object
  properties:
    scope:
      type: string
      enum: [resource, namespace, cluster]
      
    resourceRef:
      type: object
      properties:
        apiVersion: string
        kind: string
        namespace: string
        name: string
        
    namespace:
      type: string
      
    options:
      type: object
      properties:
        includeDrifted: boolean  # 仅检测已漂移资源
        skipCache: boolean       # 跳过缓存，强制从 Git 读取
        dryRun: boolean          # 仅检测，不存储结果
        
response:
  type: object
  properties:
    checkId: string
    status: string  # pending, running, completed, failed
    driftSummary:
      totalResources: int
      driftedResources: int
      criticalDrifts: int
      highDrifts: int
      mediumDrifts: int
      lowDrifts: int
```

### 2.5 触发机制对比总结

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Trigger Mechanism Comparison                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                    定时扫描              事件触发              手动触发
                    ────────              ────────              ────────
检测延迟              5-60 分钟             <1 分钟              即时
资源消耗              中等                  低                   低
覆盖率               100%                 仅变更资源             可配置
误报率               低                    中 (需防抖)            无
配置复杂度            低                    中                   低
适用场景             兜底对账              实时检测              应急排查

推荐配置:
├── 生产环境：定时扫描 (30m 全量 + 5m 增量) + Git Webhook + K8s Watch
├── 预发环境：定时扫描 (60m 全量) + Git Webhook
└── 开发环境：定时扫描 (60m 全量)
```

---

## 三、漂移类型分类 (Drift Type Classification)

### 3.1 漂移分类总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Drift Type Taxonomy                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

漂移类型 (Drift Types)
│
├── 按风险等级分类 (By Risk Level)
│   ├── P0 - 严重 (Critical)
│   │   └── 安全策略、网络隔离、RBAC 权限、数据持久化
│   ├── P1 - 高 (High)
│   │   └── 资源规格、副本数、健康检查、服务发现
│   ├── P2 - 中 (Medium)
│   │   └── 环境变量、配置变更、日志级别
│   └── P3 - 低 (Low)
│       └── 元数据、标签、注解、描述信息
│
├── 按变更来源分类 (By Change Source)
│   ├── 人为变更 (Manual Change)
│   │   └── kubectl edit, kubectl patch, kubectl apply
│   ├── 自动变更 (Automated Change)
│   │   └── HPA, VPA, Cluster Autoscaler, Operator
│   ├── 恶意变更 (Malicious Change)
│   │   └── 未授权访问、凭证泄露、内部威胁
│   └── 系统变更 (System Change)
│       └── K8s 版本升级、控制器自动修复、节点故障迁移
│
└── 按影响范围分类 (By Impact Scope)
    ├── 集群级 (Cluster Level)
    │   └── ClusterRole, ClusterRoleBinding, StorageClass
    ├── 命名空间级 (Namespace Level)
    │   └── NetworkPolicy, ResourceQuota, LimitRange
    ├── 应用级 (Application Level)
    │   └── Deployment, StatefulSet, Service, ConfigMap
    └── Pod 级 (Pod Level)
        └── 单 Pod 配置、容器环境变量
```

### 3.2 漂移类型详细分类表

#### 3.2.1 P0 - 严重漂移 (Critical Drift)

| 漂移类型 | 影响资源 | 具体字段 | 风险描述 | 自动回滚 |
|---------|---------|---------|---------|---------|
| **安全策略变更** | NetworkPolicy | spec.podSelector, spec.ingress, spec.egress | 可能导致网络隔离失效，未授权访问 | 是 |
| **RBAC 权限变更** | Role, ClusterRole, RoleBinding | spec.rules, subjects, roleRef | 可能导致权限提升，越权访问 | 是 |
| **ServiceAccount 变更** | ServiceAccount | secrets, imagePullSecrets | 可能导致凭证泄露 | 是 |
| **Secret 数据变更** | Secret | data (内容哈希变化) | 敏感数据可能被篡改 | 是 (需审批) |
| **存储配置变更** | PersistentVolumeClaim | spec.accessModes, spec.resources | 可能导致数据丢失风险 | 是 (需审批) |
| **Pod 安全策略** | PodSecurityPolicy | spec.privileged, spec.runAsUser | 可能导致容器逃逸风险 | 是 |

#### 3.2.2 P1 - 高危漂移 (High Drift)

| 漂移类型 | 影响资源 | 具体字段 | 风险描述 | 自动回滚 |
|---------|---------|---------|---------|---------|
| **副本数变更** | Deployment, StatefulSet | spec.replicas | 可能导致容量不足或资源浪费 | 条件触发 |
| **资源规格变更** | Deployment, StatefulSet | spec.containers[*].resources | 可能导致 OOM、CPU 争抢 | 条件触发 |
| **镜像版本变更** | Deployment, StatefulSet | spec.containers[*].image | 可能运行未经验证的镜像 | 是 |
| **健康检查变更** | Deployment, StatefulSet | spec.livenessProbe, spec.readinessProbe | 可能导致错误实例不被剔除 | 是 |
| **启动参数变更** | Deployment, StatefulSet | spec.containers[*].args, command | 可能改变应用行为 | 是 |
| **服务端口变更** | Service | spec.ports | 可能导致服务不可用 | 是 |
| **路由规则变更** | Ingress | spec.rules, spec.tls | 可能导致流量错误或 HTTPS 失效 | 是 |

#### 3.2.3 P2 - 中等漂移 (Medium Drift)

| 漂移类型 | 影响资源 | 具体字段 | 风险描述 | 自动回滚 |
|---------|---------|---------|---------|---------|
| **环境变量变更** | Deployment, StatefulSet | spec.containers[*].env | 可能改变应用配置 | 可选 |
| **ConfigMap 内容变更** | ConfigMap | data, binaryData | 应用配置可能不一致 | 可选 |
| **调度策略变更** | Deployment, StatefulSet | spec.affinity, spec.tolerations | 可能影响资源分布 | 可选 |
| **服务标签变更** | Service | spec.selector | 可能导致服务找不到 Pod | 是 |
| **更新策略变更** | Deployment | spec.strategy | 可能影响发布过程 | 可选 |

#### 3.2.4 P3 - 低漂移 (Low Drift)

| 漂移类型 | 影响资源 | 具体字段 | 风险描述 | 自动回滚 |
|---------|---------|---------|---------|---------|
| **元数据变更** | 所有资源 | metadata.labels, metadata.annotations | 无功能影响 | 否 |
| **描述信息变更** | 所有资源 | metadata.description | 无功能影响 | 否 |
| **资源备注变更** | 所有资源 | metadata.title | 无功能影响 | 否 |

### 3.3 漂移类型分类决策树

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Drift Type Classification Decision Tree                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                               ┌─────────────────┐
                               │ Drift Detected  │
                               │ (发现漂移)       │
                               └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ Check Resource  │
                               │ Type            │
                               └────────┬────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌───────────────┐             ┌───────────────┐             ┌───────────────┐
│ Security-     │             │ Workload      │ │ Config      │
│ Related       │             │ Related       │ │ Related     │
│               │             │               │ │             │
│ NetworkPolicy │             │ Deployment    │ │ ConfigMap   │
│ RBAC          │             │ StatefulSet   │ │ Secret      │
│ ServiceAccount│             │ Service       │ │             │
└───────┬───────┘             │ Ingress       │ └───────┬───────┘
        │                     └───────┬───────┘         │
        │                             │                 │
        ▼                             ▼                 ▼
┌───────────────┐             ┌───────────────┐ ┌───────────────┐
│ Risk: P0      │             │ Check Field   │ │ Risk: P1/P2   │
│ (Critical)    │             │ Change Type   │ │               │
└───────────────┘             └───────┬───────┘ └───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │ Scale/        │ │ Image/        │ │ Env/          │
            │ Resources     │ │ Probe/        │ │ Labels/       │
            │               │ │ Ports         │ │ Annotations   │
            └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │ P1 (High)     │ │ P1 (High)     │ │ P2 (Medium)   │
            │ 副本数/资源     │ │ 镜像/探针      │ │ 环境/元数据    │
            └───────────────┘ └───────────────┘ └───────────────┘
```

### 3.4 漂移类型 ASCII 分类图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Drift Type Classification Matrix                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                              影响范围 (Impact Scope)
                          低 ←─────────────────────────→ 高
        ┌─────────────────────────────────────────────────────────────────┐
        │                                                                  │
        │   ┌──────────────────────────────────────────────────────────┐  │
     高 │   │  P3: 元数据变更         │  P2: 环境变量变更              │  │
     │   │  Labels, Annotations    │  ConfigMap, Env Vars            │  │
     │   ├─────────────────────────┼─────────────────────────────────┤  │
影    │   │  P2: 调度策略           │  P1: 资源规格/副本数            │  │
响    │   │  Affinity, Tolerations │  Replicas, Resources, Image     │  │
程    │   ├─────────────────────────┼─────────────────────────────────┤  │
度    │   │  P1: 健康检查/端口       │  P0: 安全策略/RBAC              │  │
     │   │  Probes, Ports         │  NetworkPolicy, RBAC, Secrets   │  │
        │   └──────────────────────────────────────────────────────────┘  │
        │                                                                  │
        └─────────────────────────────────────────────────────────────────┘

自动回滚策略:
├── P0: 立即回滚 + 告警 + 审计 (需审批)
├── P1: 自动回滚 + 通知 (可配置阈值)
├── P2: 生成报告 + 通知 (可选回滚)
└── P3: 仅记录日志 (不回滚)
```

---

## 四、漂移报告生成 (Drift Report Generation)

### 4.1 报告生成架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Drift Report Generation Flow                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Drift          │
│  Detection      │
│  Completed      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Collect        │
│  Drift Details  │
└────────┬────────┘
         │
         ├───┬─────────────────────────────────────────┐
         │   │                                         │
         ▼   ▼                                         ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Difference     │ │  Impact         │ │  Risk           │
│  Comparison     │ │  Assessment     │ │  Assessment     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Generate       │
                    │  Drift Report   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  JSON Report    │ │  HTML Report    │ │  Alert          │
│  (API)          │ │  (Dashboard)    │ │  (NATS/Slack)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 4.2 差异对比格式

#### 4.2.1 JSON Patch 格式

```json
{
  "driftId": "drift-20260410-001",
  "timestamp": "2026-04-10T14:30:00Z",
  "resource": {
    "apiVersion": "apps/v1",
    "kind": "Deployment",
    "namespace": "production",
    "name": "orion-platform-service"
  },
  "driftType": "P1",
  "driftCategory": "Workload",
  "difference": {
    "patchType": "JSONPatch",
    "patches": [
      {
        "op": "replace",
        "path": "/spec/replicas",
        "oldValue": 3,
        "newValue": 5,
        "field": "spec.replicas",
        "riskLevel": "P1"
      },
      {
        "op": "replace",
        "path": "/spec/template/spec/containers/0/resources/limits/cpu",
        "oldValue": "1000m",
        "newValue": "2000m",
        "field": "spec.template.spec.containers[0].resources.limits.cpu",
        "riskLevel": "P1"
      }
    ]
  },
  "impactAssessment": {
    "affectedPods": 2,
    "affectedServices": ["orion-platform-service"],
    "estimatedDowntime": "0s",
    "businessImpact": "Low"
  },
  "riskAssessment": {
    "riskLevel": "P1",
    "riskScore": 75,
    "riskFactors": [
      {
        "factor": "Capacity Change",
        "weight": 0.4,
        "score": 60
      },
      {
        "factor": "Resource Change",
        "weight": 0.6,
        "score": 85
      }
    ],
    "recommendation": "Rollback recommended due to unapproved resource change"
  },
  "rollbackInfo": {
    "autoRollbackEnabled": true,
    "rollbackThreshold": 70,
    "approvalRequired": false,
    "estimatedRollbackTime": "30s"
  }
}
```

#### 4.2.2 可视化差异对比

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Drift Detail Report                                     │
│  ID: drift-20260410-001                                        Risk: P1 (High)  │
└─────────────────────────────────────────────────────────────────────────────────┘

Resource: Deployment/production/orion-platform-service

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Drifted Fields                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Field: spec.replicas                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ - Expected (Git): 3                                                         │ │
│  │ + Actual (K8s):   5                                                         │ │
│  │                                                                              │ │
│  │ Risk: P1 | Impact: 增加 2 个 Pod 副本，可能导致资源浪费                          │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  Field: spec.template.spec.containers[0].resources.limits.cpu                    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ - Expected (Git): 1000m                                                      │ │
│  │ + Actual (K8s):   2000m                                                      │ │
│  │                                                                              │ │
│  │ Risk: P1 | Impact: CPU 限制翻倍，可能掩盖性能问题                               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Impact Assessment                                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Affected Pods:      orion-platform-service-7d4f8b6c9-abc123                      │
│                     orion-platform-service-7d4f8b6c9-def456                      │
│ Affected Services:  orion-platform-service                                       │
│ Estimated Cost:     +$150/month (额外 2 副本)                                     │
│ Business Impact:    Low (无服务中断)                                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Recommended Actions                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [✓] Auto Rollback Available (阈值 75 > 70)                                      │
│ [ ] Approval Required (No)                                                      │
│ [ ] Change Freeze Active (No)                                                   │
│                                                                                  │
│ Actions:  [Rollback]  [Ignore]  [Snooze 1h]  [View Audit Log]                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 影响评估模型

#### 4.3.1 影响评估维度

| 评估维度 | 评估指标 | 权重 | 计算方法 |
|---------|---------|------|---------|
| **服务可用性** | 受影响服务数量 | 0.3 | count(affectedServices) |
| **容量影响** | Pod 副本变化比例 | 0.25 \|newReplicas - oldReplicas\| / oldReplicas |
| **资源影响** | CPU/内存变化比例 | 0.25 | (newLimit - oldLimit) / oldLimit |
| **业务影响** | 关键业务标记 | 0.2 | app.orion.io/criticality |

#### 4.3.2 影响等级划分

```
影响等级计算:
├── 综合得分 = Σ(维度得分 × 权重)
├── 等级划分:
│   ├── Score >= 80: Critical (严重)
│   ├── Score 60-79: High (高)
│   ├── Score 40-59: Medium (中)
│   └── Score < 40: Low (低)
└── 推荐动作:
    ├── Critical: 立即回滚 + 电话告警
    ├── High: 自动回滚 + IM 告警
    ├── Medium: 生成报告 + 邮件通知
    └── Low: 记录日志
```

### 4.4 风险等级评估

#### 4.4.1 风险评分算法

```python
# 风险评分伪代码

def calculate_risk_score(drift):
    base_score = get_base_score_by_field(drift.field)
    
    # 风险因子调整
    risk_factors = {
        'is_production': 1.5 if drift.namespace == 'production' else 1.0,
        'is_critical_app': 1.3 if drift.annotations.get('criticality') == 'high' else 1.0,
        'change_magnitude': get_magnitude_factor(drift.old_value, drift.new_value),
        'change_source': get_source_factor(drift.detected_source),
        'drift_history': get_history_factor(drift.resource_id),
    }
    
    # 计算最终风险分
    final_score = base_score
    for factor, value in risk_factors.items():
        final_score *= value
    
    # 风险等级映射
    if final_score >= 90:
        return 'P0', final_score
    elif final_score >= 70:
        return 'P1', final_score
    elif final_score >= 40:
        return 'P2', final_score
    else:
        return 'P3', final_score
```

#### 4.4.2 基础风险分表

| 字段类型 | 基础风险分 | 说明 |
|---------|-----------|------|
| spec.podSelector (NetworkPolicy) | 95 | 网络隔离变更 |
| spec.rules (Role/ClusterRole) | 95 | 权限变更 |
| spec.ingress/egress (NetworkPolicy) | 90 | 网络规则变更 |
| data (Secret) | 90 | 敏感数据变更 |
| spec.replicas | 65 | 副本数变更 |
| spec.containers[*].resources | 70 | 资源规格变更 |
| spec.containers[*].image | 75 | 镜像变更 |
| spec.containers[*].env | 45 | 环境变量变更 |
| data (ConfigMap) | 50 | 配置变更 |
| metadata.labels | 15 | 标签变更 |
| metadata.annotations | 10 | 注解变更 |

### 4.5 漂移报告模板

```yaml
# drift-report-template.yaml
apiVersion: drift.orion.io/v1
kind: DriftReport
metadata:
  name: drift-report-template
spec:
  reportFormat:
    json:
      enabled: true
      includeRawDiff: true
    html:
      enabled: true
      template: standard
    markdown:
      enabled: true
      
  sections:
    - name: summary
      include:
        - driftId
        - timestamp
        - resourceRef
        - riskLevel
        - status
        
    - name: details
      include:
        - fieldDifferences
        - expectedVsActual
        - changeMagnitude
        
    - name: impact
      include:
        - affectedResources
        - serviceImpact
        - costImpact
        
    - name: risk
      include:
        - riskScore
        - riskFactors
        - recommendation
        
    - name: actions
      include:
        - rollbackOptions
        - approvalStatus
        - auditTrail
```

---

## 五、自动回滚策略 (Automatic Rollback Strategy)

### 5.1 回滚策略总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Automatic Rollback Strategy Overview                    │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚触发条件:
├── 阈值触发 (Threshold Trigger)
│   └── 风险评分 > 配置阈值 → 自动回滚
├── 审批触发 (Approval Trigger)
│   └── 高危操作 → 需审批 → 批准后回滚
└── 手动触发 (Manual Trigger)
    └── 运维人员手动触发回滚

回滚执行模式:
├── 立即回滚 (Immediate)
│   └── P0 漂移，无需审批，直接回滚
├── 延迟回滚 (Delayed)
│   └── 等待 N 分钟，如无人工干预则自动回滚
├── 审批回滚 (Approval Required)
│   └── 需指定角色审批后执行
└── 禁止回滚 (Blocked)
    └── 变更冻结期间，禁止自动回滚
```

### 5.2 阈值触发策略

#### 5.2.1 风险阈值配置

```yaml
# rollback-policies.yaml
apiVersion: drift.orion.io/v1
kind: RollbackPolicy
metadata:
  name: default-rollback-policy
spec:
  # 按风险等级配置回滚策略
  riskThresholds:
    P0:
      autoRollback: true
      approvalRequired: true
      approvalTimeout: 5m
      approverRoles: ["platform-admin", "security-admin"]
      
    P1:
      autoRollback: true
      approvalRequired: false
      delayBeforeRollback: 2m
      ignoreDuringChangeFreeze: false
      
    P2:
      autoRollback: false
      approvalRequired: false
      notifyOnly: true
      
    P3:
      autoRollback: false
      approvalRequired: false
      logOnly: true
      
  # 按资源类型配置
  resourcePolicies:
    Deployment:
      riskScoreThreshold: 70
      maxRollbackReplicas: 10
      
    StatefulSet:
      riskScoreThreshold: 80
      requireBackup: true
      
    ConfigMap:
      riskScoreThreshold: 50
      ignoreFields: ["metadata.annotations"]
      
    Secret:
      riskScoreThreshold: 90
      approvalRequired: true
      approverRoles: ["security-admin"]
      
    NetworkPolicy:
      riskScoreThreshold: 60
      autoRollback: true
      
  # 按环境配置
  environmentPolicies:
    production:
      riskScoreMultiplier: 1.5
      approvalRequired: true
      changeFreezeEnabled: true
      
    staging:
      riskScoreMultiplier: 1.0
      approvalRequired: false
      changeFreezeEnabled: false
      
    development:
      riskScoreMultiplier: 0.5
      autoRollback: false
      changeFreezeEnabled: false
```

#### 5.2.2 阈值触发决策流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Threshold Trigger Decision Flow                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │ Drift Detected  │
                                    │ (发现漂移)       │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Calculate Risk  │
                                    │ Score           │
                                    │ (计算风险评分)    │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Get Threshold   │
                                    │ (from Policy)   │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                        ▼                    ▼                    ▼
                ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
                │ Score >= P0   │    │ P0 > Score    │    │ Score < P2    │
                │ Threshold     │    │ >= P1         │    │ Threshold     │
                │ (>=90)        │    │ Threshold     │    │ (<40)         │
                │               │    │ (60-89)       │    │               │
                └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
                        │                    │                    │
                        ▼                    ▼                    ▼
                ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
                │ Check Change  │    │ Check Delay   │    │ Log Only      │
                │ Freeze        │    │ Timer (2m)    │    │ (No Rollback) │
                └───────┬───────┘    └───────┬───────┘    └───────────────┘
                        │                    │
          ┌─────────────┴─────────────┐      │
          │                           │      ▼
          ▼                           ▼  ┌───────────────┐
┌───────────────┐             ┌───────────────┐    │ Require       │
│ Change Freeze │             │ Wait Approval │    │ Approval      │
│ Active?       │             │ (5m timeout)  │    └───────┬───────┘
└───────┬───────┘             └───────┬───────┘            │
        │                             │                    │
   ┌────┴────┐                   ┌────┴────┐          ┌────┴────┐
   │         │                   │         │          │         │
   ▼         ▼                   ▼         ▼          ▼         ▼
┌─────┐  ┌─────┐            ┌─────────┐ ┌─────────┐ ┌─────┐ ┌─────┐
│ Yes │  │ No  │            │ Timeout │ │Approved │ │ Yes │ │ No │
└──┬──┘  └──┬──┘            └────┬────┘ └────┬────┘ └──┬──┘ └──┬──┘
   │        │                   │         │         │        │
   │        ▼                   │         ▼         │        ▼
   │   ┌───────────────┐        │    ┌──────────┐  │   ┌────────────┐
   │   │ Delay Rollback│        │    │ Execute  │  │   │ Skip       │
   │   │ (Notify Only) │        │    │ Rollback │  │   │ Rollback   │
   │   └───────────────┘        │    └──────────┘  │   └────────────┘
   │                            │                  │
   ▼                            ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Execute / Skip Rollback                      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 审批触发策略

#### 5.3.1 审批配置

```yaml
# approval-policy.yaml
apiVersion: drift.orion.io/v1
kind: ApprovalPolicy
metadata:
  name: drift-rollback-approval
spec:
  # 需要审批的场景
  approvalRules:
    - name: P0 Drift Rollback
      condition: drift.riskLevel == "P0"
      approvers:
        roles: ["platform-admin", "security-admin"]
        minApprovals: 1
        timeout: 5m
        
    - name: Secret Change Rollback
      condition: resource.kind == "Secret"
      approvers:
        roles: ["security-admin"]
        minApprovals: 1
        timeout: 10m
        
    - name: Production Rollback
      condition: resource.namespace == "production" && drift.riskLevel in ["P0", "P1"]
      approvers:
        roles: ["team-lead", "platform-admin"]
        minApprovals: 2
        timeout: 15m
        
  # 审批超时处理
  timeoutAction:
    P0: autoApprove  # P0 超时后自动批准 (安全优先)
    P1: autoReject   # P1 超时后自动拒绝
    default: notify  # 默认仅通知
    
  # 审批通知
  notifications:
    onPending:
      - type: slack
        channel: "#drift-alerts"
      - type: email
        recipients: ["oncall@example.com"]
    onApproved:
      - type: slack
        channel: "#drift-actions"
    onRejected:
      - type: slack
        channel: "#drift-actions"
```

#### 5.3.2 审批流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Approval Flow for Rollback                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Rollback       │
│  Pending        │
│  Approval       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send           │
│  Notifications  │
│  (Slack/Email)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Start          │
│  Timeout Timer  │
│  (5m/10m/15m)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Timeout │ │ Approval│
│ Reached │ │ Received│
└────┬────┘ └────┬────┘
     │           │
     │     ┌─────┴─────┐
     │     │           │
     │     ▼           ▼
     │ ┌─────────┐ ┌─────────┐
     │ │Approved │ │Rejected │
     │ └────┬────┘ └────┬────┘
     │      │           │
     ▼      ▼           ▼
┌─────────────────────────────────┐
│  Execute Rollback / Skip        │
│  + Update Audit Log             │
└─────────────────────────────────┘
```

### 5.4 手动触发策略

#### 5.4.1 手动回滚 API

```yaml
# API: POST /api/v1/drift/{driftId}/rollback
# 手动触发回滚

request:
  type: object
  properties:
    driftId:
      type: string
      required: true
      
    force:
      type: boolean
      description: "强制回滚，跳过审批和检查"
      default: false
      
    dryRun:
      type: boolean
      description: "仅预览回滚效果，不实际执行"
      default: false
      
    comment:
      type: string
      description: "回滚原因说明"
      maxLength: 500
      
response:
  type: object
  properties:
    rollbackId: string
    status: string  # pending, executing, completed, failed, blocked
    message: string
    estimatedTime: string
    affectedResources:
      type: array
      items:
        type: object
        properties:
          kind: string
          namespace: string
          name: string
          action: string  # rollback, skip, failed
```

---

## 六、回滚执行流程 (Rollback Execution Flow)

### 6.1 回滚流程总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Rollback Execution Flow                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │ Rollback        │
                                    │ Triggered       │
                                    │ (回滚触发)        │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Pre-Rollback    │
                                    │ Checks          │
                                    │ (前置检查)        │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
            ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
            │ Check Change  │        │ Check Resource│        │ Check Pending │
            │ Freeze Status │        │ Lock          │        │ Deployments   │
            └───────┬───────┘        └───────┬───────┘        └───────┬───────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                          ▼                                     ▼
                  ┌───────────────┐                     ┌───────────────┐
                  │ All Checks    │                     │ Check Failed  │
                  │ Passed        │                     │ (Block/Abort) │
                  └───────┬───────┘                     └───────────────┘
                          │
                          ▼
                  ┌───────────────────┐
                  │ Step 1: Backup    │
                  │ Current State     │
                  │ (备份当前状态)     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Step 2: Apply     │
                  │ Expected State    │
                  │ (应用期望状态)     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Step 3: Verify    │
                  │ Rollback Result   │
                  │ (验证回滚结果)     │
                  └─────────┬─────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
            ┌───────────────┐ ┌───────────────┐
            │ Success       │ │ Failed        │
            └───────┬───────┘ └───────┬───────┘
                    │                 │
                    ▼                 ▼
            ┌───────────────┐ ┌───────────────┐
            │ Update Audit  │ │ Trigger Alert │
            │ Log + Notify  │ │ + Manual      │
            │               │ │ Intervention  │
            └───────────────┘ └───────────────┘
```

### 6.2 前置检查 (Pre-Rollback Checks)

#### 6.2.1 检查项清单

| 检查项 | 检查内容 | 失败处理 |
|-------|---------|---------|
| **变更冻结检查** | 检查是否处于变更冻结期 | 阻止回滚 (P0 除外) |
| **资源锁检查** | 检查资源是否被其他操作锁定 | 等待锁释放或超时 |
| **部署中检查** | 检查是否有其他部署在进行 | 等待部署完成 |
| **权限检查** | 检查是否有回滚所需权限 | 失败并告警 |
| **依赖检查** | 检查依赖资源是否可用 | 失败并告警 |

#### 6.2.2 前置检查流程

```
PreRollbackCheck(resourceRef):
    checks = []
    
    # Check 1: Change Freeze
    if ChangeFreeze.isActive(resourceRef.namespace):
        if drift.riskLevel != "P0":
            return CheckResult.FAIL("Change freeze active")
            
    # Check 2: Resource Lock
    lock = ResourceLock.get(resourceRef)
    if lock and not lock.isExpired():
        return CheckResult.WAIT("Resource locked", ttl=lock.ttl)
        
    # Check 3: Pending Deployments
    if Deployment.isPending(resourceRef):
        return CheckResult.WAIT("Deployment in progress")
        
    # Check 4: Permissions
    if not RBAC.canRollback(currentUser, resourceRef):
        return CheckResult.FAIL("Insufficient permissions")
        
    return CheckResult.PASS()
```

### 6.3 备份当前状态 (Backup Current State)

#### 6.3.1 备份内容

```yaml
# 备份内容清单
backup:
  metadata:
    backupId: "backup-20260410-001"
    timestamp: "2026-04-10T14:30:00Z"
    reason: "drift-rollback"
    driftId: "drift-20260410-001"
    
  resourceState:
    # 完整资源 YAML
    yaml: |
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: orion-platform-service
        namespace: production
        ...
    # 关键状态字段
    status:
      replicas: 5
      readyReplicas: 5
      availableReplicas: 5
      
  checksums:
    # 用于验证备份完整性
    yamlSha256: "abc123..."
    
  storage:
    # 备份存储位置
    location: "s3://orion-backup/drift/2026/04/10/backup-001.yaml"
    retentionDays: 30
```

#### 6.3.2 备份执行流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Backup Current State Flow                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Get Current     │
│ State from K8s  │
│ (kubectl get)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Add Backup      │
│ Metadata        │
│ (timestamp,     │
│  driftId, etc.) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │
│ Checksum        │
│ (SHA256)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store to        │
│ Backup Storage  │
│ (S3/MinIO)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Record Backup   │
│ in Database     │
└─────────────────┘
```

### 6.4 应用期望状态 (Apply Expected State)

#### 6.4.1 应用策略

```yaml
# apply-policy.yaml
apiVersion: drift.orion.io/v1
kind: ApplyPolicy
metadata:
  name: default-apply-policy
spec:
  # 应用策略
  strategy: ServerSideApply
  
  # 字段管理
  fieldManager: drift-detector
  
  # 冲突处理
  conflictResolution:
    strategy: Force  # Force / Abort / Merge
    forceOwners: true
    
  # 渐进式回滚 (仅 Deployment/StatefulSet)
  progressiveRollback:
    enabled: true
    maxSurge: 1
    maxUnavailable: 0
    
  # 超时配置
  timeout:
    apply: 2m
    rollout: 5m
    
  # 回滚验证
  verification:
    enabled: true
    checks:
      - type: ReplicaStatus
        timeout: 3m
      - type: HealthCheck
        timeout: 1m
      - type: ReadyProbe
        timeout: 2m
```

#### 6.4.2 应用执行命令

```bash
# 回滚执行命令示例

# 1. 应用期望状态
kubectl apply --server-side \
  --field-manager=drift-detector \
  --force-conflicts \
  -f git://k8s/production/orion-platform-service/deployment.yaml

# 2. 等待回滚完成
kubectl rollout status deployment/orion-platform-service \
  --namespace=production \
  --timeout=5m

# 3. 验证回滚结果
kubectl get deployment/orion-platform-service \
  --namespace=production \
  -o jsonpath='{.spec.replicas}'
# 期望输出：3
```

### 6.5 验证回滚结果 (Verify Rollback Result)

#### 6.5.1 验证检查清单

| 验证项 | 验证方法 | 超时时间 | 失败处理 |
|-------|---------|---------|---------|
| **副本数验证** | 检查 spec.replicas 是否匹配期望值 | 1 分钟 | 重试 3 次 |
| **Pod 状态验证** | 检查 Pod 是否 Running/Ready | 3 分钟 | 告警 |
| **资源规格验证** | 检查 containers[*].resources 是否匹配 | 1 分钟 | 重试 3 次 |
| **配置验证** | 检查 ConfigMap/Secret 是否挂载正确 | 1 分钟 | 告警 |
| **服务可用性** | 检查 Service/Ingress 是否正常 | 2 分钟 | 告警 |

#### 6.5.2 验证流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Rollback Verification Flow                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Wait for        │
│ Rollout         │
│ Complete        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check 1:        │
│ Replica Count   │
│ Expected: 3     │
│ Actual: ?       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Match   │ │Mismatch │
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Retry (3x)  │
     │      │ or Alert    │
     │      └─────────────┘
     │
     ▼
┌─────────────────┐
│ Check 2:        │
│ Pod Health      │
│ (Ready/Running) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Healthy │ │Unhealthy│
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Alert +     │
     │      │ Debug Info  │
     │      └─────────────┘
     │
     ▼
┌─────────────────┐
│ Check 3:        │
│ Resource Spec   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verification    │
│ Complete        │
│ Status: Success │
└─────────────────┘
```

---

## 七、审计日志与追溯 (Audit Logging and Traceability)

### 7.1 审计日志架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Audit Logging Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Drift Detector │    │  Rollback       │    │  Approval       │
│                 │    │  Executor       │    │  Service        │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                     │                      │
         │   (1) Emit Events   │                      │
         ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NATS Event Bus                                      │
│  Topics: drift.*, rollback.*, approval.*, audit.*                               │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                     │                      │
         ▼                     ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Audit Log      │    │  Real-time      │    │  Long-term      │
│  Collector      │    │  Dashboard      │    │  Storage        │
└────────┬────────┘    └─────────────────┘    └────────┬────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────┐                          ┌─────────────────┐
│  PostgreSQL     │                          │  ClickHouse     │
│  (Hot Storage,  │                          │  (Cold Storage, │
│   30 days)      │                          │   1 year)       │
└─────────────────┘                          └─────────────────┘
```

### 7.2 审计日志数据模型

```yaml
# audit-log-schema.yaml
apiVersion: audit.orion.io/v1
kind: AuditLog
metadata:
  name: audit-log-schema
spec:
  # 核心字段
  fields:
    # 谁 (Who)
    - name: actor
      type: object
      required: true
      properties:
        userId: string
        username: string
        userType: string  # human, service-account, automated
        roles: array[string]
        sourceIP: string
        
    # 何时 (When)
    - name: timestamp
      type: timestamp
      required: true
      
    # 什么 (What)
    - name: action
      type: string
      required: true
      enum: [drift_detected, rollback_started, rollback_completed, rollback_failed, approval_requested, approval_granted, approval_denied]
      
    - name: resource
      type: object
      required: true
      properties:
        apiVersion: string
        kind: string
        namespace: string
        name: string
        uid: string
        
    # 为什么 (Why)
    - name: reason
      type: string
      required: false
      maxLength: 1000
      
    - name: driftDetails
      type: object
      required: false
      properties:
        driftId: string
        riskLevel: string
        changedFields: array
        expectedState: object
        actualState: object
        
    # 结果 (Result)
    - name: result
      type: object
      required: true
      properties:
        status: string  # success, failure, partial
        message: string
        duration: string
        rollbackId: string
```

### 7.3 审计日志数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Audit Log Data Flow Diagram                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Event Source │
│ (Who)        │
│ - User       │
│ - Service    │
│ - Automated  │
└──────┬───────┘
       │
       │ Action Triggered
       │ (What)
       ▼
┌──────────────┐
│ Event        │
│ Generation   │
│              │
│ + Timestamp  │
│ + Reason     │
│ + Context    │
└──────┬───────┘
       │
       │ Publish to NATS
       │ Topic: audit.*
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Audit Log    │────▶│ Validation   │────▶│ Enrichment   │
│ Collector    │     │ (Schema)     │     │ (Add Context)│
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       │ Write to Storage
       ▼
┌──────────────┐     ┌──────────────┐
│ PostgreSQL   │────▶│ ClickHouse   │
│ (Hot, 30d)   │ CDC │ (Cold, 1y)   │
└──────────────┘     └──────────────┘
       │
       │ Query API
       ▼
┌──────────────┐
│ Audit Query  │
│ Dashboard    │
└──────────────┘
```

### 7.4 审计追溯查询

#### 7.4.1 追溯查询 API

```yaml
# API: GET /api/v1/audit/trail
# 审计追溯查询

request:
  type: object
  properties:
    # 按资源追溯
    resourceRef:
      type: object
      properties:
        kind: string
        namespace: string
        name: string
        
    # 按时间范围
    timeRange:
      type: object
      properties:
        startTime: timestamp
        endTime: timestamp
        
    # 按操作者
    actor:
      type: object
      properties:
        userId: string
        username: string
        
    # 按操作类型
    action:
      type: string
      enum: [drift_detected, rollback_started, rollback_completed, rollback_failed]
      
    # 按漂移 ID
    driftId:
      type: string
      
response:
  type: object
  properties:
    trail:
      type: array
      items:
        type: AuditLog
    pagination:
      total: int
      page: int
      size: int
```

#### 7.4.2 追溯查询示例

```
# 查询某 Deployment 的完整漂移历史
GET /api/v1/audit/trail?kind=Deployment&namespace=production&name=orion-platform-service

Response:
{
  "trail": [
    {
      "timestamp": "2026-04-10T14:30:00Z",
      "action": "drift_detected",
      "actor": { "username": "drift-detector", "userType": "automated" },
      "driftId": "drift-20260410-001",
      "details": { "changedFields": ["spec.replicas", "spec.resources"] }
    },
    {
      "timestamp": "2026-04-10T14:31:00Z",
      "action": "rollback_started",
      "actor": { "username": "drift-detector", "userType": "automated" },
      "rollbackId": "rb-20260410-001",
      "details": { "reason": "Auto rollback triggered by drift detection" }
    },
    {
      "timestamp": "2026-04-10T14:32:30Z",
      "action": "rollback_completed",
      "actor": { "username": "drift-detector", "userType": "automated" },
      "rollbackId": "rb-20260410-001",
      "result": { "status": "success", "duration": "90s" }
    }
  ]
}
```

### 7.5 审计报表

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Monthly Audit Report                                    │
│  Period: 2026-03-01 to 2026-03-31                                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Summary Statistics                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Total Drift Events:          245                                                 │
│ Auto Rollbacks:              180                                                 │
│ Manual Rollbacks:            35                                                  │
│ Failed Rollbacks:            5                                                   │
│ Pending Approvals:           25                                                  │
│ Compliance Score:            98.5%                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Drift by Risk Level                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ P0 (Critical):   12  events  ████████                                            │
│ P1 (High):       68  events  ████████████████████████████████████████            │
│ P2 (Medium):     125 events  ████████████████████████████████████████████████████│
│ P3 (Low):        40  events  ████████████████████                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Top Drifted Resources                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. Deployment/production/orion-platform-service    25 drifts                    │
│ 2. Deployment/production/orion-pipeline-service    18 drifts                    │
│ 3. ConfigMap/production/app-config                 15 drifts                    │
│ 4. Deployment/staging/orion-platform-service       12 drifts                    │
│ 5. Service/production/orion-api-gateway            10 drifts                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Top Actors (Drift Sources)                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. kubectl (user: zhangsan)                          45 drifts                  │
│ 2. HPA (automated)                                   38 drifts                  │
│ 3. kubectl (user: lisi)                            32 drifts                  │
│ 4. Argo CD (automated)                             28 drifts                  │
│ 5. Emergency Script (user: wangwu)                 22 drifts                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、预防机制 (Prevention Mechanisms)

### 8.1 变更冻结 (Change Freeze)

#### 8.1.1 变更冻结策略

```yaml
# change-freeze-policy.yaml
apiVersion: drift.orion.io/v1
kind: ChangeFreezePolicy
metadata:
  name: default-change-freeze
spec:
  # 冻结级别
  freezeLevels:
    - name: Level1-SoftFreeze
      description: "仅允许 P0 回滚"
      allowedActions:
        - drift_detection
        - P0_rollback
      blockedActions:
        - P1_rollback
        - P2_rollback
        - manual_changes
        
    - name: Level2-HardFreeze
      description: "仅允许 P0 自动回滚"
      allowedActions:
        - drift_detection
        - P0_auto_rollback
      blockedActions:
        - all_manual_changes
        - non_critical_rollbacks
        
    - name: Level3-CompleteFreeze
      description: "完全冻结，仅检测"
      allowedActions:
        - drift_detection
        - audit_logging
      blockedActions:
        - all_actions
        
  # 冻结调度
  schedules:
    # 定期冻结 (发布窗口)
    - name: Release Freeze
      cron: "0 2 * * 1-5"  # 周一到周五凌晨 2 点
      duration: 2h
      level: Level2-HardFreeze
      namespaces: ["production"]
      
    # 节假日冻结
    - name: Holiday Freeze
      dates: ["2026-01-01", "2026-05-01", "2026-10-01"]
      duration: 24h
      level: Level3-CompleteFreeze
      namespaces: ["production", "staging"]
      
    # 紧急冻结
    - name: Emergency Freeze
      trigger: manual
      level: Level3-CompleteFreeze
      approverRoles: ["platform-admin"]
```

#### 8.1.2 变更冻结状态机

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Change Freeze State Machine                             │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │ Normal          │
                                    │ (正常状态)       │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                        │ Scheduled Freeze   │ Manual Trigger     │ Emergency
                        │ (定时)             │ (手动)             │ Detection
                        ▼                    ▼                    ▼
                ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
                │ Level 1       │    │ Level 2       │    │ Level 3       │
                │ Soft Freeze   │    │ Hard Freeze   │    │ Complete      │
                │               │    │               │    │ Freeze        │
                └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
                        │                    │                    │
                        └────────────────────┼────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Auto Expiry     │
                                    │ or Manual       │
                                    │ Unfreeze        │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Return to       │
                                    │ Normal          │
                                    └─────────────────┘
```

### 8.2 审批门禁 (Approval Gate)

#### 8.2.1 审批门禁配置

```yaml
# approval-gate-policy.yaml
apiVersion: drift.orion.io/v1
kind: ApprovalGatePolicy
metadata:
  name: production-approval-gate
spec:
  # 需要审批的操作
  gates:
    # 直接集群变更
    - name: Direct Cluster Change
      trigger:
        type: K8sAdmissionWebhook
        resources:
          - Deployment
          - StatefulSet
          - ConfigMap
          - Secret
      approval:
        required: true
        approverRoles: ["team-lead", "platform-admin"]
        minApprovals: 1
        timeout: 30m
        
    # 生产环境变更
    - name: Production Change
      trigger:
        type: NamespaceLabel
        label: environment=production
      approval:
        required: true
        approverRoles: ["platform-admin"]
        minApprovals: 2
        timeout: 1h
        
    # 安全相关变更
    - name: Security Change
      trigger:
        type: ResourceType
        resources:
          - NetworkPolicy
          - Role
          - ClusterRole
          - Secret
      approval:
        required: true
        approverRoles: ["security-admin"]
        minApprovals: 1
        timeout: 4h
        
  # 审批 bypass 条件
  bypassConditions:
    - name: Emergency Bypass
      condition: annotation "drift.orion.io/emergency" == "true"
      audit: true
      postApproval: true
      
    - name: Auto-Approved Bots
      condition: actor in ["argocd", "flux", "drift-detector"]
      audit: true
```

#### 8.2.2 审批门禁流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Approval Gate Flow                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Change Request  │
│ (kubectl apply) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admission       │
│ Webhook         │
│ (拦截请求)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check if        │
│ Approval Gate   │
│ Required        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ No Gate │ │ Gate    │
│         │ │ Required│
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Create      │
     │      │ Approval    │
     │      │ Request     │
     │      └──────┬──────┘
     │             │
     │             ▼
     │      ┌─────────────┐
     │      │ Wait for    │
     │      │ Approval    │
     │      └──────┬──────┘
     │             │
     │       ┌─────┴─────┐
     │       │           │
     │       ▼           ▼
     │ ┌─────────┐ ┌─────────┐
     │ │Approved │ │Denied/  │
     │ │         │ │Timeout  │
     │ └────┬────┘ └────┬────┘
     │      │           │
     ▼      ▼           ▼
┌─────────────────────────────────┐
│ Allow / Deny Change Request     │
└─────────────────────────────────┘
```

### 8.3 GitOps 合规检查 (GitOps Compliance Check)

#### 8.3.1 合规检查规则

```yaml
# gitops-compliance-policy.yaml
apiVersion: drift.orion.io/v1
kind: GitOpsCompliancePolicy
metadata:
  name: default-gitops-compliance
spec:
  # 合规规则
  rules:
    # 规则 1: 所有生产变更必须通过 Git
    - name: GitOps Required for Production
      scope:
        namespaces: ["production"]
      rule:
        type: SourceRequired
        source: git
        requiredLabels:
          - app.kubernetes.io/managed-by
        requiredValues:
          - argocd
          - flux
          - drift-detector
      violation:
        severity: high
        action: block
        
    # 规则 2: 禁止 kubectl apply --force
    - name: No Force Apply
      scope:
        all: true
      rule:
        type: CommandPattern
        forbiddenPatterns:
          - "kubectl apply --force"
          - "kubectl replace --force"
      violation:
        severity: high
        action: block
        
    # 规则 3: 变更必须有 Git commit 关联
    - name: Change Must Link to Git Commit
      scope:
        namespaces: ["production", "staging"]
      rule:
        type: AnnotationRequired
        annotations:
          - drift.orion.io/git-commit
          - drift.orion.io/git-pr
      violation:
        severity: medium
        action: warn
        
    # 规则 4: 敏感配置必须加密
    - name: Sensitive Config Must Be Encrypted
      scope:
        resources:
          - Secret
      rule:
        type: EncryptionRequired
        encryptionProviders:
          - sealed-secrets
          - external-secrets
          - sops
      violation:
        severity: high
        action: block
```

#### 8.3.2 合规检查流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          GitOps Compliance Check Flow                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Change Request  │
│ Incoming        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check 1:        │
│ Is Resource     │
│ Git-Managed?    │
│ (检查注解)       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Yes     │ │ No      │
│ (GitOps)│ │ (Skip)  │
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Log as      │
     │      │ Non-GitOps  │
     │      │ Resource    │
     │      └─────────────┘
     │
     ▼
┌─────────────────┐
│ Check 2:        │
│ Has Git Commit  │
│ Association?    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Yes     │ │ No      │
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Violation:  │
     │      │ Medium      │
     │      │ (Warn)      │
     │      └─────────────┘
     │
     ▼
┌─────────────────┐
│ Check 3:        │
│ All Compliance  │
│ Rules Pass?     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Pass    │ │ Fail    │
└────┬────┘ └────┬────┘
     │           │
     │           ▼
     │      ┌─────────────┐
     │      │ Block +     │
     │      │ Report      │
     │      │ Violation   │
     │      └─────────────┘
     │
     ▼
┌─────────────────┐
│ Allow Change    │
│ + Record Audit  │
└─────────────────┘
```

### 8.4 预防机制总结

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Prevention Mechanism Summary                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ 预防层级 (Prevention Layers)                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Layer 4: 审计追溯 (Audit & Traceability)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ • 完整的变更历史记录                                                       │ │
│  │ • 谁、何时、为什么、从哪里                                                  │ │
│  │ • 合规报表与告警                                                           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                      ▲                                          │
│                                      │                                          │
│  Layer 3: 审批门禁 (Approval Gates)                                            │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ • 生产变更审批                                                             │ │
│  │ • 安全变更审批                                                             │ │
│  │ • Admission Webhook 拦截                                                   │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                      ▲                                          │
│                                      │                                          │
│  Layer 2: 变更冻结 (Change Freeze)                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ • 发布窗口冻结                                                             │ │
│  │ • 节假日冻结                                                               │ │
│  │ • 紧急冻结                                                                 │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                      ▲                                          │
│                                      │                                          │
│  Layer 1: GitOps 合规 (GitOps Compliance)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ • 所有变更必须通过 Git                                                      │ │
│  │ • 禁止 kubectl --force                                                     │ │
│  │ • 敏感配置必须加密                                                         │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                      ▲                                          │
│                                      │                                          │
│                              变更请求 (Change Request)                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

预期效果:
├── 漂移事件减少：60-80%
├── 未授权变更：接近 0
├── 合规通过率：>99%
└── MTTR 降低：50%
```

---

## 九、附录 (Appendix)

### 9.1 术语表

| 术语 | 定义 |
|------|------|
| **Configuration Drift** | 配置漂移，指 Git 期望状态与 K8s 实际状态之间的不一致 |
| **Desired State** | 期望状态，Git 仓库中声明的资源配置 |
| **Actual State** | 实际状态，Kubernetes 集群中当前的资源状态 |
| **GitOps** | 以 Git 作为唯一事实来源的运维实践 |
| **Reconciliation** | 对账，将实际状态同步到期望状态的过程 |
| **Admission Webhook** | Kubernetes 准入控制器，用于拦截和验证资源变更 |
| **Change Freeze** | 变更冻结，在特定时期禁止非紧急变更 |

### 9.2 配置示例汇总

| 配置文件 | 用途 | 路径 |
|---------|------|------|
| scheduled-scan.yaml | 定时扫描配置 | drift-config/scheduled-scan.yaml |
| watch-config.yaml | K8s Watch 配置 | drift-config/watch-config.yaml |
| rollback-policies.yaml | 回滚策略配置 | drift-config/rollback-policies.yaml |
| approval-policy.yaml | 审批策略配置 | drift-config/approval-policy.yaml |
| apply-policy.yaml | 应用策略配置 | drift-config/apply-policy.yaml |
| change-freeze-policy.yaml | 变更冻结配置 | drift-config/change-freeze-policy.yaml |
| approval-gate-policy.yaml | 审批门禁配置 | drift-config/approval-gate-policy.yaml |
| gitops-compliance-policy.yaml | GitOps 合规配置 | drift-config/gitops-compliance-policy.yaml |

### 9.3 参考文档

| 文档 | 链接 |
|------|------|
| 架构设计详解 | `docs/architecture/架构设计详解.md` |
| 平台服务拆分实施 | `docs/architecture/platform-service-split-implementation.md` |
| GitOps 最佳实践 | `docs/practices/gitops-best-practices.md` |
| Kubernetes 漂移检测 | 外部参考：https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/ |

### 9.4 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |
| 2026-04-10 | SRE 团队 | 待评审 | 待评审 |
| 2026-04-10 | 安全与合规团队 | 待评审 | 待评审 |

### 9.5 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 优先级：P1 | 状态：待评审 | 维护团队：Orion Platform Team_
