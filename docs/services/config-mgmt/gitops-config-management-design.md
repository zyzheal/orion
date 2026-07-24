# GitOps Configuration Management Design (GitOps 配置管理详细设计)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 待评审  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会、SRE 团队、安全团队  
**优先级**: P2

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台的 GitOps 配置管理架构与实施方案。GitOps 作为云原生时代的运维范式，通过将 Git 仓库作为配置的唯一可信来源，实现基础设施和应用配置的声明式管理、版本控制、自动化同步与审计追踪。

### GitOps 核心价值

| 价值维度 | 传统运维 | GitOps 运维 | 改善幅度 |
|---------|---------|-----------|---------|
| 配置可见性 | 配置散落于各系统 | 全部配置在 Git 可见 | 100% |
| 变更追溯性 | 部分可追溯 | 完整 Git 历史 | 100% |
| 部署一致性 | 手工操作易出错 | 自动化同步 | 99.9% → 99.99% |
| 回滚能力 | 手动恢复 | Git Revert 一键回滚 | 45 分钟 → 5 分钟 |
| 审计合规 | 日志分散 | Git 历史即审计 | 合规成本 -70% |

### GitOps 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Architecture Overview                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  Configuration  │
                                    │  Authors        │
                                    │  (Developers/   │
                                    │   SRE/Security) │
                                    └────────┬────────┘
                                             │
                                             │ git push / PR
                                             ▼
                                    ┌─────────────────┐
                                    │   Git Repository │
                                    │   (Single Source │
                                    │    of Truth)     │
                                    │                  │
                                    │ • Application    │
                                    │   Configs        │
                                    │ • Environment    │
                                    │   Configs        │
                                    │ • Infrastructure │
                                    │   as Code        │
                                    │ • Policies       │
                                    └────────┬────────┘
                                             │
                                             │ change detected
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ArgoCD Control Plane                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                    ArgoCD Application Controller                           │  │
│  │                                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │   Application   │  │   Application   │  │   Application   │           │  │
│  │  │   Sync Engine   │  │   Health Check  │  │   Drift Detect  │           │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │  │
│  │           │                    │                    │                     │  │
│  │           └────────────────────┼────────────────────┘                     │  │
│  │                                │                                          │  │
│  │                                ▼                                          │  │
│  │                    ┌─────────────────────┐                               │  │
│  │                    │   Reconciliation    │                               │  │
│  │                    │   Engine            │                               │  │
│  │                    └─────────────────────┘                               │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             │ kubectl apply
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Kubernetes Clusters                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Development   │  │   Staging       │  │   Production    │                │
│  │   Cluster       │  │   Cluster       │  │   Cluster       │                │
│  │                 │  │                 │  │                 │                │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │                │
│  │ │   Apps      │ │  │ │   Apps      │ │  │ │   Apps      │ │                │
│  │ │   Workloads │ │  │ │   Workloads │ │  │ │   Workloads │ │                │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             │ state reporting
                                             │ (metrics/logs)
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Observability Stack                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Prometheus    │  │   Grafana       │  │   AlertManager  │                │
│  │   (Metrics)     │  │   (Dashboard)   │  │   (Alerts)      │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### GitOps 核心能力矩阵

| 能力域 | 核心功能 | 优先级 | 实施阶段 |
|-------|---------|--------|---------|
| GitOps 架构 | Git 仓库、ArgoCD、配置同步 | P0 | Phase 1 |
| 配置仓库结构 | 应用配置、环境配置、基础设施配置 | P0 | Phase 1 |
| ArgoCD 集成 | Application CRD、自动同步、健康检查 | P0 | Phase 1 |
| 配置版本管理 | Git Tag、Branch 策略、回滚 | P1 | Phase 2 |
| 敏感信息管理 | Vault 集成、Secret 加密、轮转机制 | P1 | Phase 2 |
| 配置漂移检测 | 期望状态 vs 实际状态、自动修复 | P1 | Phase 2 |
| 配置审批流程 | PR 审批、变更窗口、冻结机制 | P2 | Phase 3 |
| 多环境管理 | Dev/Test/Stage/Prod 配置隔离 | P1 | Phase 2 |
| 配置模板化 | Helm Chart、Kustomize、Jsonnet | P2 | Phase 3 |
| 监控指标 | 同步状态、漂移次数、修复成功率 | P1 | Phase 2 |

---

## 一、GitOps 架构设计 (GitOps Architecture)

### 1.1 架构设计原则

GitOps 架构设计遵循以下核心原则：

| 原则 | 说明 | 实现方式 |
|------|------|---------|
| **声明式 (Declarative)** | 配置描述期望状态，而非操作步骤 | Kubernetes YAML/Helm |
| **版本控制 (Versioned)** | 所有配置纳入 Git 版本管理 | Git Repository |
| **自动化 (Automated)** | 配置变更自动同步到集群 | ArgoCD Auto-Sync |
| **可观测 (Observable)** | 同步状态、漂移、健康度可监控 | Prometheus + Grafana |
| **安全 (Secure)** | 最小权限、审计追踪、加密存储 | RBAC + Vault |
| **幂等 (Idempotent)** | 重复应用配置产生相同结果 | Kubernetes Controller |

### 1.2 架构组件详解

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Component Architecture                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Configuration Authoring Layer                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   VS Code +     │     │   Git CLI /     │     │   Platform      │          │
│   │   GitLens       │     │   GitHub CLI    │     │   Portal UI     │          │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘          │
│            │                       │                       │                    │
│            └───────────────────────┼───────────────────────┘                    │
│                                    │                                            │
│                                    ▼                                            │
│                         ┌─────────────────────┐                                │
│                         │   Git Server        │                                │
│                         │   (GitLab / GitHub) │                                │
│                         └─────────────────────┘                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Git Repository Layer                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    Orion GitOps Repository                               │   │
│   │                                                                         │   │
│   │   /apps             - 应用配置 (Helm Charts / Kustomize)                │   │
│   │   /environments     - 环境配置 (Dev/Test/Stage/Prod)                    │   │
│   │   /infrastructure   - 基础设施配置 (Cluster/Network/Storage)            │   │
│   │   /policies         - 策略配置 (OPA / Kyverno)                          │   │
│   │   /secrets          - Secret 模板 (不包含实际值)                         │   │
│   │   /scripts          - 自动化脚本                                        │   │
│   │   /docs             - 配置文档                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: GitOps Controller Layer                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         ArgoCD Control Plane                            │   │
│   │                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │ ApplicationSet Controller (批量管理 Application)                │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Repo Server (Git 仓库缓存、Manifest 生成)                        │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Application Controller (状态对比、同步执行)                      │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Notification Controller (事件通知)                              │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: Secret Management Layer                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   HashiCorp     │     │   Sealed        │     │   External      │          │
│   │   Vault         │     │   Secrets       │     │   Secrets       │          │
│   │   (动态 Secret)  │     │   (加密存储)     │     │   (拉取模式)     │          │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 5: Target Environment Layer                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│   │   Development   │  │   Staging       │  │   Production    │                │
│   │   Cluster       │  │   Cluster       │  │   Cluster       │                │
│   │                 │  │                 │  │                 │                │
│   │   - Dev Team    │  │   - QA Team     │  │   - End Users   │                │
│   │   - Unstable    │  │   - RC          │  │   - Stable      │                │
│   │   - Auto-Sync   │  │   - Auto-Sync   │  │   - Manual      │                │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 配置同步模式

GitOps 支持多种配置同步模式，按环境风险等级选择：

| 同步模式 | 触发条件 | 适用环境 | 风险等级 |
|---------|---------|---------|---------|
| **自动同步 (Auto-Sync)** | Git 提交后自动同步 | Dev/Test | 低 |
| **手动确认同步 (Manual)** | Git 提交后需手动确认 | Stage | 中 |
| **审批同步 (Approved)** | Git 提交 + 审批后同步 | Prod | 高 |
| **定时同步 (Scheduled)** | 变更窗口内定时同步 | Prod | 高 |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Sync Flow                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

场景 1: 开发环境自动同步
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Developer│────▶│  git    │────▶│ ArgoCD   │────▶│  K8s     │────▶│  App     │
│  commits │     │  push    │     │ detects  │     │  apply   │     │  running │
│          │     │          │     │ change   │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │                │
     │   1. git push  │                  │                │                │
     │   main branch  │                  │                │                │
     │                │   2. webhook     │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │   3. sync      │                │
     │                │                  │───────────────▶│                │
     │                │                  │                │   4. pods      │
     │                │                  │                │   created      │
     │                │                  │                │───────────────▶│
     │                │                  │                │                │
     │                │                  │   5. status:   │                │
     │                │                  │◀───────────────│                │
     │                │   6. Sync OK     │   Synced +     │                │
     │                │◀─────────────────│   Healthy      │                │
     │                │                  │                │                │

场景 2: 生产环境审批同步
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Developer│────▶│  PR      │────▶│ Security │────▶│ ArgoCD   │────▶│  K8s     │
│  creates │     │  Review  │     │  Scan    │     │  sync    │     │  apply   │
│    PR    │     │          │     │          │     │(approved)│     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │                │
     │   1. create PR │                  │                │                │
     │   feature→main │                  │                │                │
     │                │   2. request     │                │                │
     │                │◀─────────────────│                │                │
     │                │   approval       │                │                │
     │                │                  │                │                │
     │                │   3. approve     │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │   4. auto scan │                │
     │                │                  │───────────────▶│                │
     │                │                  │                │                │
     │                │   5. scan pass   │                │                │
     │                │◀─────────────────│                │                │
     │                │                  │                │                │
     │                │   6. merge PR    │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │                │                │
     │                │   7. trigger     │                │                │
     │                │─────────────────▶│                │                │
     │                │   sync (manual)  │                │                │
     │                │                  │   8. sync      │                │
     │                │                  │───────────────▶│                │
```

### 1.4 ArgoCD 部署架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ArgoCD Deployment Architecture                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────────┐
                           │   ArgoCD Management     │
                           │   Cluster (Primary)     │
                           │                         │
                           │   ┌─────────────────┐   │
                           │   │ argocd-server │   │
                           │   │ (UI + API)    │   │
                           │   └────────────────┘   │
                           │   ┌─────────────────┐   │
                           │   │ argocd-       │   │
                           │   │ repo-server   │   │
                           │   └────────────────┘   │
                           │   ┌─────────────────┐   │
                           │   │ argocd-       │   │
                           │   │ application   │   │
                           │   │ controller    │   │
                           │   └────────────────┘   │
                           │   ┌─────────────────┐   │
                           │   │ argocd-       │   │
                           │   │ notification  │   │
                           │   │ controller    │   │
                           │   └────────────────┘   │
                           │   ┌─────────────────┐   │
                           │   │ Redis (Cache) │   │
                           │   └────────────────┘   │
                           └───────────┬─────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
                  ▼                    ▼                    ▼
        ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
        │   Dev Cluster   │  │   Stage Cluster │  │   Prod Cluster  │
        │   (Namespace)   │  │   (Namespace)   │  │   (Namespace)   │
        │                 │  │                 │  │                 │
        │ argocd-         │  │ argocd-         │  │ argocd-         │
        │ application-    │  │ application-    │  │ application-    │
        │ set (optional)  │  │ set (optional)  │  │ set (optional)  │
        └─────────────────┘  └─────────────────┘  └─────────────────┘

高可用配置:
├── ArgoCD Server: 2+ 副本，负载均衡
├── Application Controller: 1 副本 (有状态)
├── Repo Server: 2+ 副本，负载均衡
├── Redis: Sentinel 模式 (1 主 2 从 3 哨兵)
└── PostgreSQL: 主从复制 + 自动故障转移
```

---

## 二、配置仓库结构设计 (Configuration Repository Structure)

### 2.1 仓库组织模式

Orion 采用"单仓库多目录"与"多仓库"混合模式：

| 模式 | 说明 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|---------|
| **单仓库 (Mono-Repo)** | 所有配置在一个 Git 仓库 | 全局可见、易于治理 | 仓库大、权限粗粒度 | 中小型组织 |
| **多仓库 (Multi-Repo)** | 按域拆分多个仓库 | 权限细粒度、独立管理 | 跨仓库引用复杂 | 大型组织 |
| **混合模式** | 核心配置单仓 + 应用多仓 | 平衡治理与灵活 | 管理复杂度高 | 推荐方案 |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion GitOps Repository Structure                      │
└─────────────────────────────────────────────────────────────────────────────────┘

orion-gitops/                              # GitOps 主仓库 (Mono-Repo)
│
├── apps/                                  # 应用配置目录
│   ├── orion-platform/                    # Orion 平台应用
│   │   ├── base/                          # 基础配置 (Kustomize base)
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── configmap.yaml
│   │   │   ├── serviceaccount.yaml
│   │   │   └── kustomization.yaml
│   │   │
│   │   └── overlays/                      # 环境覆盖配置
│   │       ├── dev/
│   │       │   ├── replica-patch.yaml
│   │       │   ├── resource-patch.yaml
│   │       │   └── kustomization.yaml
│   │       ├── test/
│   │       ├── stage/
│   │       └── prod/
│   │
│   ├── orion-pipeline/                    # Pipeline 应用
│   │   ├── base/
│   │   └── overlays/
│   │
│   └── orion-ai/                          # AI 应用
│       ├── base/
│       └── overlays/
│
├── environments/                          # 环境配置目录
│   ├── dev/                               # 开发环境
│   │   ├── namespace.yaml
│   │   ├── resource-quota.yaml
│   │   ├── limit-range.yaml
│   │   ├── network-policy.yaml
│   │   └── applications.yaml              # ArgoCD Application 定义
│   │
│   ├── test/                              # 测试环境
│   │   ├── namespace.yaml
│   │   ├── resource-quota.yaml
│   │   ├── limit-range.yaml
│   │   ├── network-policy.yaml
│   │   └── applications.yaml
│   │
│   ├── stage/                             # 预发环境
│   │   ├── namespace.yaml
│   │   ├── resource-quota.yaml
│   │   ├── limit-range.yaml
│   │   ├── network-policy.yaml
│   │   └── applications.yaml
│   │
│   └── prod/                              # 生产环境
│       ├── namespace.yaml
│       ├── resource-quota.yaml
│       ├── limit-range.yaml
│       ├── network-policy.yaml
│       ├── pdb.yaml                       # Pod Disruption Budget
│       └── applications.yaml
│
├── infrastructure/                        # 基础设施配置目录
│   ├── clusters/                          # 集群配置
│   │   ├── management/
│   │   ├── dev/
│   │   ├── stage/
│   │   └── prod/
│   │
│   ├── networking/                        # 网络配置
│   │   ├── ingress-nginx/
│   │   ├── external-dns/
│   │   └── cert-manager/
│   │
│   ├── storage/                           # 存储配置
│   │   ├── rook-ceph/
│   │   ├── nfs-provisioner/
│   │   └── backup-velero/
│   │
│   ├── monitoring/                        # 监控配置
│   │   ├── prometheus-stack/
│   │   ├── grafana/
│   │   ├── alertmanager/
│   │   └── loki/
│   │
│   ├── logging/                           # 日志配置
│   │   ├── fluent-bit/
│   │   └── elasticsearch/
│   │
│   └── security/                          # 安全配置
│       ├── vault/
│       ├── external-secrets/
│       ├── kyverno/
│       └── opa-gatekeeper/
│
├── policies/                              # 策略配置目录
│   ├── kyverno/                           # Kyverno 策略
│   │   ├── require-labels/
│   │   ├── disallow-privileged/
│   │   ├── image-registry/
│   │   └── resource-limits/
│   │
│   └── opa/                               # OPA Gatekeeper 策略
│       ├── k8srequiredlabels/
│       ├── k8sallowedrepos/
│       └── k8sdenynsdefault/
│
├── secrets/                               # Secret 模板目录 (不包含实际值)
│   ├── templates/                         # Secret 模板
│   │   ├── database-credentials.yaml
│   │   ├── api-keys.yaml
│   │   └── tls-certificates.yaml
│   │
│   └── external-secrets/                  # External Secrets 配置
│       ├── dev/
│       ├── stage/
│       └── prod/
│
├── scripts/                               # 自动化脚本目录
│   ├── bootstrap/                         # 初始化脚本
│   ├── migrate/                           # 迁移脚本
│   ├── validate/                          # 验证脚本
│   └── backup/                            # 备份脚本
│
├── docs/                                  # 配置文档目录
│   ├── standards/                         # 配置标准
│   ├── runbooks/                          # 运维手册
│   └── adr/                               # 架构决策记录
│
├── .github/                               # GitHub Actions 配置
│   ├── workflows/
│   └── policies/
│
└── .gitlab/                               # GitLab CI 配置
    └── workflows/
```

### 2.2 应用配置结构详解

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Application Configuration Structure                    │
└─────────────────────────────────────────────────────────────────────────────────┘

orion-platform-app/                        # 应用配置仓库
│
├── helm/                                  # Helm Chart 配置
│   └── orion-platform/
│       ├── Chart.yaml                     # Chart 元数据
│       ├── values.yaml                    # 默认配置值
│       ├── values-dev.yaml                # 开发环境配置
│       ├── values-test.yaml               # 测试环境配置
│       ├── values-stage.yaml              # 预发环境配置
│       ├── values-prod.yaml               # 生产环境配置
│       │
│       └── templates/                     # Helm 模板
│           ├── _helpers.tpl
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── configmap.yaml
│           ├── secret.yaml
│           ├── serviceaccount.yaml
│           ├── ingress.yaml
│           ├── hpa.yaml
│           ├── pdb.yaml
│           └── networkpolicy.yaml
│
├── kustomize/                             # Kustomize 配置
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   └── overlays/
│       ├── dev/
│       │   ├── kustomization.yaml
│       │   ├── replica-patch.yaml
│       │   └── resource-patch.yaml
│       │
│       ├── test/
│       ├── stage/
│       └── prod/
│
└── argocd/                                # ArgoCD 配置
    └── application.yaml                   # Application CRD 定义
```

### 2.3 环境配置差异矩阵

| 配置项 | Dev | Test | Stage | Prod |
|-------|-----|------|-------|------|
| 副本数 | 1 | 2 | 2 | 3+ |
| 资源限制 | 宽松 | 中等 | 严格 | 严格 |
| 自动同步 | 开启 | 开启 | 开启 | 手动 |
| 健康检查 | 基本 | 标准 | 严格 | 严格 |
| 告警级别 | Info | Warning | Error | Critical |
| 备份策略 | 无 | 每日 | 每日 | 实时 |
| 网络策略 | 开放 | 限制 | 严格 | 严格 |
| 日志级别 | Debug | Info | Warn | Error |

---

## 三、ArgoCD 集成设计 (ArgoCD Integration)

### 3.1 Application CRD 规范

ArgoCD 使用 Kubernetes CRD 定义应用，核心字段如下：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orion-platform
  namespace: argocd
  labels:
    app.kubernetes.io/name: orion-platform
    app.kubernetes.io/part-of: orion
    environment: production
spec:
  # ========== 项目与源配置 ==========
  project: orion-platform                    # ArgoCD 项目名称
  
  source:
    repoURL: https://github.com/orion/orion-gitops.git
    targetRevision: HEAD                     # 分支/Tag/Commit
    path: apps/orion-platform/overlays/prod  # 配置路径
    
    # Helm 特定配置
    helm:
      releaseName: orion-platform
      valueFiles:
        - values-prod.yaml
      parameters:
        - name: replicaCount
          value: "3"
        - name: image.tag
          value: "v1.2.3"
  
  # ========== 部署目标 ==========
  destination:
    server: https://kubernetes.default.svc
    namespace: orion-platform
  
  # ========== 同步策略 ==========
  syncPolicy:
    # 自动同步配置
    automated:
      prune: true                            # 自动清理多余资源
      selfHeal: true                         # 自动修复漂移
      allowEmpty: false                      # 禁止空列表同步
    
    # 同步选项
    syncOptions:
      - CreateNamespace=true                 # 自动创建命名空间
      - Validate=true                        # 验证 YAML
      - PruneLast=true                       # 最后清理删除资源
      - ApplyOutOfSyncOnly=true              # 仅应用不同步资源
      - ServerSideApply=true                 # 服务端 Apply
    
    # 同步窗口 (生产环境)
    # syncWindow:
    #   - kind: allow
    #     schedule: "02:00-04:00 * * 1-5"   # 工作日凌晨 2-4 点
    #     duration: 2h
    #     manualSync: true
  
  # ========== 健康检查配置 ==========
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas                    # 忽略副本数差异 (HPA 管理)
  
  # ========== 资源钩子 ==========
  # hooks defined in manifests
  
  # ========== 修订历史限制 ==========
  revisionHistoryLimit: 10                   # 保留修订历史数
```

### 3.2 ApplicationSet 批量管理

对于多环境、多应用的场景，使用 ApplicationSet 简化配置：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: orion-applications
  namespace: argocd
spec:
  generators:
    # ========== 列表生成器 ==========
    - list:
        elements:
          - app: orion-platform
            env: dev
            cluster: dev-cluster
          - app: orion-platform
            env: test
            cluster: stage-cluster
          - app: orion-platform
            env: stage
            cluster: stage-cluster
          - app: orion-platform
            env: prod
            cluster: prod-cluster
          - app: orion-pipeline
            env: dev
            cluster: dev-cluster
          - app: orion-pipeline
            env: prod
            cluster: prod-cluster
    
    # ========== Git 目录生成器 ==========
    - git:
        repoURL: https://github.com/orion/orion-gitops.git
        revision: HEAD
        directories:
          - path: apps/*/overlays/prod
    
    # ========== Cluster 生成器 ==========
    - clusters:
        selector:
          matchLabels:
            environment: production
  
  template:
    metadata:
      name: '{{app}}-{{env}}'
      labels:
        app: '{{app}}'
        env: '{{env}}'
    spec:
      project: '{{app}}'
      source:
        repoURL: https://github.com/orion/orion-gitops.git
        targetRevision: HEAD
        path: apps/{{app}}/overlays/{{env}}
      destination:
        server: '{{cluster}}'
        namespace: '{{app}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
```

### 3.3 健康检查定制

ArgoCD 支持自定义资源健康检查逻辑：

```lua
-- health.lua 自定义健康检查脚本 (以 Deployment 为例)
hs = {}

hs.status = "Unknown"
hs.message = ""

if obj.status == nil then
  hs.status = "Unknown"
  hs.message = "Waiting for status"
  return hs
end

if obj.status.conditions ~= nil then
  for i, condition in ipairs(obj.status.conditions) do
    if condition.type == "Available" and condition.status == "True" then
      hs.status = "Healthy"
      hs.message = "Deployment is available"
      return hs
    end
    if condition.type == "Progressing" and condition.status == "False" and condition.reason == "ProgressDeadlineExceeded" then
      hs.status = "Degraded"
      hs.message = condition.message
      return hs
    end
  end
end

if obj.status.replicas == obj.status.readyReplicas then
  hs.status = "Healthy"
  hs.message = "All replicas ready"
else
  hs.status = "Progressing"
  hs.message = string.format("Waiting for %d replicas", obj.status.replicas)
end

return hs
```

### 3.4 资源钩子 (Hooks)

Hooks 用于在同步前后执行特定操作：

```yaml
# PreSync Hook: 数据库迁移
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: orion-platform
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
    argocd.argoproj.io/sync-wave: "-5"
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: orion-platform:v1.2.3
          command: ["./migrate.sh"]
      restartPolicy: Never
  backoffLimit: 1

---
# PostSync Hook: 发送通知
apiVersion: batch/v1
kind: Job
metadata:
  name: notify-deployment
  namespace: orion-platform
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: notify
          image: curlimages/curl:latest
          command:
            - /bin/sh
            - -c
            - |
              curl -X POST https://notify.company.com/webhook \
                -H "Content-Type: application/json" \
                -d '{"app": "orion-platform", "env": "prod", "status": "deployed"}'
      restartPolicy: Never
```

---

## 四、配置版本管理设计 (Configuration Version Management)

### 4.1 Git Branch 策略

Orion 采用 Git-Flow 变体策略：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Git Branch Strategy                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

Branch 类型:
├── main (protected)
│   ├── 保护规则：Require PR + 2  approvals + CI pass
│   ├── 用途：生产环境配置来源
│   └── 同步：自动 Tag (semver)
│
├── release/* (protected)
│   ├── 保护规则：Require PR + 1 approval
│   ├── 用途：预发/测试环境配置
│   └── 生命周期：发布后合并到 main 并删除
│
├── feature/* (ephemeral)
│   ├── 保护规则：无
│   ├── 用途：新功能配置开发
│   └── 生命周期：功能完成后合并到 develop
│
├── develop (protected)
│   ├── 保护规则：Require PR + 1 approval + CI pass
│   ├── 用途：开发环境配置
│   └── 同步：自动同步到 Dev 集群
│
└── hotfix/* (ephemeral)
    ├── 保护规则：Require PR + 1 approval
    ├── 用途：紧急修复
    └── 生命周期：修复后合并到 main 和 develop

分支流向:
feature/* ──────┐
                ▼
develop ──────▶ release/* ──────▶ main
     ▲              │               │
     │              │               │
hotfix/* ───────────┴───────────────┘
```

### 4.2 Git Tag 规范

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Git Tag Naming Convention                              │
└─────────────────────────────────────────────────────────────────────────────────┘

Tag 格式：<app>-v<major>.<minor>.<patch>[-<prerelease>]

示例:
├── orion-platform-v1.0.0          # 正式版
├── orion-platform-v1.0.0-rc.1     # Release Candidate
├── orion-platform-v1.0.0-beta.3   # Beta 版
├── orion-platform-v1.0.0-alpha.5  # Alpha 版
└── orion-pipeline-v2.1.3          # Pipeline 应用

Tag 创建流程:
1. CI 验证通过 → 2. 自动创建 Tag → 3. 触发 GitHub Release → 4. ArgoCD 同步

Tag 保护规则:
├── 禁止 force push
├── 禁止删除 (除维护期外)
└── 必须关联 GPG 签名 (生产 Tag)
```

### 4.3 配置回滚机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Rollback Flow                            │
└─────────────────────────────────────────────────────────────────────────────────┘

回滚场景:
├── 应用故障 → 回滚到上一稳定版本
├── 配置错误 → 回滚到错误前版本
├── 安全漏洞 → 回滚到漏洞前版本
└── 性能下降 → 回滚到性能正常版本

回滚方式 1: Git Revert (推荐)
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Identify │────▶│  Create  │────▶│   PR +   │────▶│  ArgoCD  │
│  Bad     │     │  Revert  │     │  Merge   │     │  Sync    │
│ Commit   │     │  Commit  │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │
     │   发现故障     │                  │                │
     │   定位问题     │                  │                │
     │   commit       │                  │                │
     │                │   git revert     │                │
     │                │   <bad-commit>   │                │
     │                │─────────────────▶│                │
     │                │                  │                │
     │                │                  │   快速审批     │
     │                │                  │   (hotfix)     │
     │                │                  │───────────────▶│
     │                │                  │                │
     │                │                  │                │   自动同步
     │                │                  │                │────────▶
     │                │                  │                │   回滚完成

回滚方式 2: ArgoCD Rollback (快速)
┌──────────┐     ┌──────────┐     ┌──────────┐
│ argocd   │────▶│ argocd   │────▶│ argocd   │
│ app      │     │ app      │     │ app      │
│ history  │     │ rollback │     │ status   │
└──────────┘     └──────────┘     └──────────┘
     │                │                  │
     │   argocd app   │                  │
     │   history      │                  │
     │   <app-name>   │                  │
     │                │   argocd app     │
     │                │   rollback       │
     │                │   <app-name>     │
     │                │   --revision 2   │
     │                │─────────────────▶│
     │                │                  │   验证状态
     │                │                  │────────▶

回滚决策矩阵:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 故障等级     │ 影响范围     │ 回滚方式     │ 审批要求     │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ P0 (宕机)    │ 全量用户     │ ArgoCD 秒级    │ 事后补审批   │
│ P1 (严重)    │ 大部分用户   │ Git Revert   │ 1 人审批      │
│ P2 (一般)    │ 部分用户     │ Git Revert   │ 2 人审批      │
│ P3 (轻微)    │ 少量用户     │ PR 修复        │ 正常流程      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 4.4 配置版本演进图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Version Evolution                        │
└─────────────────────────────────────────────────────────────────────────────────┘

时间线:

Day 1: 初始部署
│
│ commit-a1b2c3 (initial)
│ └─▶ Tag: orion-platform-v1.0.0
│     └─▶ ArgoCD Sync → Prod: v1.0.0
│
▼
Day 3: 功能更新
│
│ commit-d4e5f6 (feat: add new API endpoint)
│ └─▶ PR merged → main
│     └─▶ Tag: orion-platform-v1.1.0
│         └─▶ ArgoCD Sync → Prod: v1.1.0
│
▼
Day 5: Bug 修复
│
│ commit-g7h8i9 (fix: resolve memory leak)
│ └─▶ PR merged → main
│     └─▶ Tag: orion-platform-v1.1.1
│         └─▶ ArgoCD Sync → Prod: v1.1.1
│
▼
Day 7: 配置错误 (需要回滚)
│
│ commit-j0k1l2 (config: increase replicas to 10)  ← 错误配置
│ └─▶ 导致 OOM
│     └─▶ git revert j0k1l2 → commit-m3n4o5
│         └─▶ ArgoCD Sync → Prod: v1.1.1 (回滚)
│
▼
Day 10: 安全补丁
│
│ commit-p6q7r8 (security: update base image)
│ └─▶ Hotfix PR merged → main
│     └─▶ Tag: orion-platform-v1.1.2
│         └─▶ ArgoCD Sync → Prod: v1.1.2
│
▼

版本历史:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Version  │ Commit    │ Date       │ Status    │ Deployed To │ Change Type │
├──────────┼───────────┼────────────┼───────────┼─────────────┼─────────────┤
│ v1.0.0   │ a1b2c3    │ Day 1      │ Stable    │ All         │ Initial     │
│ v1.1.0   │ d4e5f6    │ Day 3      │ Stable    │ All         │ Feature     │
│ v1.1.1   │ g7h8i9    │ Day 5      │ Stable    │ All         │ Bug Fix     │
│ v1.1.1   │ m3n4o5    │ Day 7      │ Stable    │ All         │ Rollback    │
│ v1.1.2   │ p6q7r8    │ Day 10     │ Stable    │ All         │ Security    │
└──────────┴───────────┴────────────┴───────────┴─────────────┴─────────────┘
```

---

## 五、敏感信息管理设计 (Secret Management)

### 5.1 Secret 管理架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Secret Management Architecture                         │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Secret Storage                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   HashiCorp     │     │   Kubernetes    │     │   Cloud         │          │
│   │   Vault         │     │   Secrets       │     │   Secrets Mgr   │          │
│   │   (Primary)     │     │   (Sealed)      │     │   (AWS/GCP/Azure)│          │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Secret Injection                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   External      │     │   Sealed        │     │   Vault         │          │
│   │   Secrets       │     │   Secrets       │     │   Agent         │          │
│   │   Operator      │     │   Controller    │     │   Injector      │          │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Secret Consumption                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │   Environment   │     │   Volume        │     │   CSI Driver    │          │
│   │   Variables     │     │   Mounts        │     │   Secrets Store │          │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Vault 集成方案

```yaml
# ExternalSecret 配置示例
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: orion-platform-db-credentials
  namespace: orion-platform
spec:
  refreshInterval: 1h                          # 刷新间隔
  secretStoreRef:
    name: vault-backend                        # SecretStore 名称
    kind: ClusterSecretStore
  target:
    name: orion-platform-db-credentials        # 创建的 Secret 名称
    creationPolicy: Owner
    deletionPolicy: Retain
  data:
    - secretKey: username
      remoteRef:
        key: secret/orion/platform/database   # Vault 路径
        property: username
    - secretKey: password
      remoteRef:
        key: secret/orion/platform/database
        property: password
    - secretKey: host
      remoteRef:
        key: secret/orion/platform/database
        property: host
    - secretKey: port
      remoteRef:
        key: secret/orion/platform/database
        property: port

---
# ClusterSecretStore 配置
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.company.com"
      path: "secret"
      version: "v2"
      auth:
        appRole:
          path: approvation
          roleId: "${VAULT_ROLE_ID}"
          secretRef:
            name: vault-approle-secret
            key: secret
```

### 5.3 Secret 轮转机制

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Secret Rotation Mechanism                              │
└─────────────────────────────────────────────────────────────────────────────────┘

轮转策略:
├── 定期轮转
│   ├── 数据库密码：30 天
│   ├── API Keys: 90 天
│   ├── TLS 证书：365 天 (或自动续期)
│   └── Service Account Token: 7 天
│
├── 事件驱动轮转
│   ├── 员工离职 → 立即轮转相关 Secret
│   ├── 安全事件 → 紧急轮转所有 Secret
│   └── 审计要求 → 按需轮转
│
└── 自动轮转
    ├── Vault 动态 Secret (TTL 自动续期)
    ├── cert-manager (自动续期 TLS)
    └── IRSA (AWS IAM Roles for Service Accounts)

轮转流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Trigger │────▶│ Generate │────▶│  Store   │────▶│  Deploy  │────▶│ Validate │
│ Rotation │     │  New     │     │  in      │     │  to      │     │          │
│          │     │  Secret  │     │  Vault   │     │  K8s     │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │                │
     │   定时/事件    │                  │                │                │
     │   触发         │                  │                │                │
     │                │   生成新 Secret  │                │                │
     │                │   (不中断服务)   │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │   存储到 Vault │                │
     │                │                  │   保留旧版本   │                │
     │                │                  │───────────────▶│                │
     │                │                  │                │   更新 K8s     │
     │                │                  │                │   Secret       │
     │                │                  │                │───────────────▶│
     │                │                  │                │                │
     │                │                  │                │                │   验证新
     │                │                  │                │                │   Secret
     │                │                  │                │                │   有效性
     │                │                  │                │                │────────▶
     │                │                  │                │                │
     │                │                  │                │   轮转完成     │
     │                │                  │                │◀───────────────│
     │                │                  │                │   清理旧 Secret │

无缝轮转实现 (双写过渡):
1. 生成新 Secret → 2. 同时保留新旧 Secret → 3. 应用更新 → 4. 清理旧 Secret
```

### 5.4 Sealed Secrets 方案

对于无法使用 Vault 的场景，使用 Sealed Secrets：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Sealed Secrets Flow                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

开发本地:                          Git 仓库:                          Kubernetes:

┌─────────────┐
│  Secret YAML│
│ (plaintext) │
└──────┬──────┘
       │
       │ kubeseal --format yaml > sealed-secret.yaml
       ▼
┌─────────────┐
│  Sealed     │
│  Secret     │  ──────git push─────▶  ┌─────────────┐
│  (encrypted)│                        │  Git        │
└─────────────┘                        │  Repo       │
                                       └──────┬──────┘
                                              │
                                              │ ArgoCD sync
                                              ▼
                                       ┌─────────────┐
                                       │  Sealed     │
                                       │  Secrets    │
                                       │  Controller │
                                       └──────┬──────┘
                                              │
                                              │ decrypt with private key
                                              ▼
                                       ┌─────────────┐
                                       │  Secret     │
                                       │  (created)  │
                                       └─────────────┘

优势:
├── Secret 可安全提交到 Git
├── 无需外部 Secret 存储
├── 支持多集群 (共享私钥)
└── 审计追踪完整

劣势:
├── 私钥管理复杂
├── 不支持动态 Secret
└── 轮转需重新加密
```

---

## 六、配置漂移检测设计 (Configuration Drift Detection)

### 6.1 漂移检测架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Drift Detection Architecture             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│期望状态 (Git)                         实际状态 (Cluster)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────┐                     ┌─────────────────┐                   │
│   │   Git           │                     │   Kubernetes    │                   │
│   │   Repository    │                     │   Cluster       │                   │
│   │                 │                     │                 │                   │
│   │   deployment:   │                     │   deployment:   │                   │
│   │     replicas: 3 │                     │     replicas: 5 │  ← 漂移!         │
│   │     image: v1.0 │                     │     image: v1.0 │                   │
│   │     cpu: 1000m  │                     │     cpu: 500m   │  ← 漂移!         │
│   └─────────────────┘                     └─────────────────┘                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ArgoCD 持续对比
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Drift Detection Engine                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        Reconciliation Loop                              │   │
│   │                                                                         │   │
│   │   1. Fetch desired state from Git                                       │   │
│   │   2. Fetch actual state from Cluster                                    │   │
│   │   3. Compare states (3-way merge)                                       │   │
│   │   4. Detect drift (replicas, resources, env vars, etc.)                 │   │
│   │   5. Report drift status                                                │   │
│   │   6. Auto-heal (if enabled) or alert                                    │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Drift Response                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                   │
│   │   Auto-Heal  │     │   Alert      │     │   Audit      │                   │
│   │   (Dev/Test) │     │   (Stage)    │     │   (Prod)     │                   │
│   └──────────────┘     └──────────────┘     └──────────────┘                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 漂移检测流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Drift Detection Flow                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

检测周期 (可配置):
├── 开发环境：30 秒
├── 测试环境：30 秒
├── 预发环境：60 秒
└── 生产环境：60 秒

检测流程:
┌──────────────────┐
│  Reconciliation  │  ← 定时触发 (sync.reconciliation.timeout)
│  Loop Start      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Fetch Git State │  ← 从 Git 读取期望状态
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Fetch Cluster   │  ← 从 K8s API 读取实际状态
│  State           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Compare States  │  ← 三向对比 (Git vs Cluster vs Last-Applied)
└────────┬─────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  In Sync      │ │  Drifted      │ │  Unknown      │
│  (No Action)  │ │  (Alert/Heal) │ │  (Retry)      │
└───────────────┘ └───────┬───────┘ └───────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  Classify     │  ← 按类型分类
                  │  Drift Type   │
                  └───────┬───────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Spec Drift   │ │  Status       │ │  Orphan       │
│  (replicas,   │ │  Drift Only   │ │  Resources    │
│   resources)  │ │  (ready       │ │  (no Git      │
│               │ │   replicas)   │ │   source)     │
└───────┬───────┘ └───────────────┘ └───────┬───────┘
        │                                   │
        ▼                                   ▼
┌───────────────┐                   ┌───────────────┐
│  Auto-Heal or │                   │  Prune or     │
│  Alert        │                   │  Alert        │
└───────────────┘                   └───────────────┘
```

### 6.3 漂移分类与响应

| 漂移类型 | 描述 | 检测方式 | 响应策略 |
|---------|------|---------|---------|
| **Spec Drift** | 资源配置变更 (replicas, cpu, memory) | 对比 spec 字段 | Auto-Heal / Alert |
| **Status Drift** | 仅状态字段差异 (ready replicas) | 忽略 status 字段 | Ignore |
| **Orphan Resources** | 集群中存在但 Git 中没有的资源 | 资源列表对比 | Prune / Alert |
| **Missing Resources** | Git 中有但集群中缺失的资源 | 资源列表对比 | Auto-Create |
| **Field Drift** | 字段值被手动修改 | 字段级对比 | Auto-Heal / Alert |
| **Schema Drift** | 资源 API 版本变更 | API 版本检查 | Alert (需人工) |

### 6.4 自动修复策略

```yaml
# ArgoCD 自动修复配置
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orion-platform
spec:
  syncPolicy:
    automated:
      prune: true          # 自动清理孤儿资源
      selfHeal: true       # 自动修复漂移
      allowEmpty: false
    
    # 忽略特定漂移 (HPA 管理的副本数)
    # ignoreDifferences 定义在 Application 级别
    
    # 同步选项
    syncOptions:
      - CreateNamespace=true
      - Validate=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true

# 漂移容忍配置 (某些漂移可接受)
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orion-platform
spec:
  ignoreDifferences:
    # HPA 管理的副本数漂移
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
    
    # 某些 annotation 由其他 controller 管理
    - group: apps
      kind: Deployment
      jmePath: .metadata.annotations["deployment.kubernetes.io/revision"]
```

---

## 七、配置审批流程设计 (Configuration Approval Workflow)

### 7.1 审批流程架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Approval Workflow                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Stage 1: PR Creation & Validation                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│   │ Developer│────▶│  Create  │────▶│  CI      │────▶│  Security│             │
│   │          │     │  PR      │     │  Check   │     │  Scan    │             │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘             │
│                                                                                 │
│   CI Checks:                                                                    │
│   ├── YAML 语法验证 (yamllint)                                                  │
│   ├── Kubernetes 资源验证 (kubeval/kubeconform)                                 │
│   ├── 策略合规检查 (OPA/Conftest)                                               │
│   ├── 安全扫描 (Trivy/Hadolint)                                                 │
│   └── 成本估算 (Infracost)                                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Approval Routing                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   审批路由规则 (基于变更内容):                                                    │
│                                                                                 │
│   变更类型                    审批人                      审批人数              │
│   ┌─────────────────────────────────────────────────────────────────────┐      │
│   │ 应用配置 (replicas, resources)    → Tech Lead            1 人       │      │
│   │ 环境配置 (namespace, quota)       → SRE Lead             1 人       │      │
│   │ 安全配置 (policies, RBAC)         → Security Team        2 人       │      │
│   │ 基础设施 (cluster, network)       → Infra Team + SRE     2 人       │      │
│   │ 生产环境变更                      → Tech Lead + SRE      2 人       │      │
│   │ 跨多环境变更                      → Platform Team        2 人       │      │
│   └─────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Approval Execution                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│   │ Tech     │────▶│  Review  │────▶│  Comment │────▶│ Approve  │             │
│   │ Lead/SRE │     │  Changes │     │  (opt)   │     │          │             │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘             │
│                                                                                 │
│   审批检查清单:                                                                 │
│   ├── 变更是否符合预期？                                                        │
│   ├── 是否有回滚方案？                                                          │
│   ├── 是否影响其他服务？                                                        │
│   ├── 是否在变更窗口内？                                                        │
│   └── 是否已通知相关方？                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Stage 4: Merge & Sync                                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│   │ Merge PR │────▶│  Tag     │────▶│  ArgoCD  │────▶│  Verify  │             │
│   │          │     │  Release │     │  Sync    │     │  Deploy  │             │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 变更窗口管理

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Change Window Management                               │
└─────────────────────────────────────────────────────────────────────────────────┘

变更窗口定义:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Window Name    │ Schedule            │ Duration │ Environment │ Change Type   │
├────────────────┼─────────────────────┼──────────┼─────────────┼───────────────┤
│ daily-window   │ 02:00-04:00 * * *   │ 2h       │ All         │ Standard      │
│ weekly-window  │ 02:00-06:00 * * 1   │ 4h       │ Prod        │ Major         │
│ emergency      │ * * * * *           │ -        │ All         │ Emergency     │
│ freeze         │ (adhoc)             │ -        │ Prod        │ None          │
└─────────────────────────────────────────────────────────────────────────────────┘

变更类型与窗口映射:
├── Standard Changes (标准变更)
│   ├── 定义：预审批的低风险变更
│   ├── 窗口：daily-window
│   └── 审批：1 人 (或自动化)
│
├── Normal Changes (普通变更)
│   ├── 定义：常规配置变更
│   ├── 窗口：daily-window
│   └── 审批：2 人
│
├── Major Changes (重大变更)
│   ├── 定义：影响面广的变更
│   ├── 窗口：weekly-window
│   └── 审批：3 人 + CAB
│
└── Emergency Changes (紧急变更)
    ├── 定义：故障修复/安全补丁
    ├── 窗口：随时 (事后补审批)
    └── 审批：1 人 (事后补齐)

变更冻结 (Change Freeze):
├── 计划冻结：重大活动期间 (双 11, 春节)
├── 紧急冻结：重大故障期间
└── 冻结规则：
    ├── 禁止 Normal/Major 变更
    ├── 仅允许 Emergency 变更
    └── 需 VP 级别审批
```

### 7.3 配置审批流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Approval Flow                            │
└─────────────────────────────────────────────────────────────────────────────────┘

标准变更流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│   CI/    │────▶│   Tech   │────▶│  Merge   │────▶│  ArgoCD  │
│    PR    │     │   CD     │     │  Lead    │     │          │     │  Sync    │
│          │     │  Check   │     │  Approve │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │                │
     │   1. 创建 PR   │                  │                │                │
     │   修改配置     │                  │                │                │
     │                │   2. 自动检查    │                │                │
     │                │   YAML/安全/策略 │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │   3. 审批      │                │
     │                │                  │   (1 人)        │                │
     │                │                  │───────────────▶│                │
     │                │                  │                │   4. 合并      │
     │                │                  │                │───────────────▶│
     │                │                  │                │                │
     │                │                  │                │   5. 自动同步  │
     │                │                  │                │                │

生产变更流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│ Security │────▶│  Tech    │────▶│   SRE    │────▶│  Merge   │
│    PR    │     │  Scan    │     │  Lead    │     │  Lead    │     │          │
│          │     │          │     │  Approve │     │  Approve │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │                │                │
     │   1. 创建 PR   │                  │                │                │
     │   生产配置     │                  │                │                │
     │                │   2. 安全扫描    │                │                │
     │                │   漏洞/合规检查  │                │                │
     │                │─────────────────▶│                │                │
     │                │                  │   3. Tech 审批  │                │
     │                │                  │───────────────▶│                │
     │                │                  │                │   4. SRE 审批   │
     │                │                  │                │───────────────▶│
     │                │                  │                │                │
     │                │                  │                │   5. 合并 + Tag │
     │                │                  │                │                │

紧急变更流程:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│ On-Call  │────▶│  Merge   │────▶│  ArgoCD  │
│    PR    │     │  Approve │     │          │     │  Sync    │
│          │     │  (15min) │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │   紧急修复     │                │                │
     │   快速创建     │                │                │
     │                │   快速审批     │                │
     │                │   (15 分钟内)    │                │
     │                │───────────────▶│                │
     │                │                │   立即合并     │
     │                │                │───────────────▶│
     │                │                │                │
     │                │                │   事后补齐审批 │
     │                │◀───────────────│────────────────│
```

---

## 八、多环境管理设计 (Multi-Environment Management)

### 8.1 环境隔离策略

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Multi-Environment Isolation Strategy                   │
└─────────────────────────────────────────────────────────────────────────────────┘

隔离级别选择:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Isolation Level  │ Resource Boundary │ Network │ Cost │ Complexity │ Recommended│
├─────────────────────────────────────────────────────────────────────────────────┤
│ Namespace        │ Soft              │ NS Policy│ Low │ Low        │ Dev/Test   │
│ Cluster          │ Hard              │ Network  │ Med │ Med        │ Stage      │
│ Account/Project  │ Hard              │ VPC      │ High│ High       │ Prod       │
└─────────────────────────────────────────────────────────────────────────────────┘

Orion 环境架构:
├── Development (命名空间隔离)
│   ├── Cluster: orion-dev-cluster
│   ├── Namespaces: orion-platform-dev, orion-pipeline-dev, ...
│   └── 特点：资源共享、宽松策略
│
├── Test (命名空间隔离)
│   ├── Cluster: orion-test-cluster
│   ├── Namespaces: orion-platform-test, orion-pipeline-test, ...
│   └── 特点：资源共享、标准策略
│
├── Staging (集群隔离)
│   ├── Cluster: orion-stage-cluster
│   ├── Namespaces: orion-platform, orion-pipeline, ...
│   └── 特点：独立集群、严格策略、生产镜像
│
└── Production (集群 + 账号隔离)
    ├── Cluster: orion-prod-cluster (独立 VPC)
    ├── Namespaces: orion-platform, orion-pipeline, ...
    └── 特点：完全隔离、最高安全、多 AZ
```

### 8.2 环境配置差异

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Environment Configuration Matrix                       │
└─────────────────────────────────────────────────────────────────────────────────┘

配置维度          Dev             Test            Stage           Prod
─────────────────────────────────────────────────────────────────────────────────
集群规模          3 nodes         3 nodes         5 nodes         9+ nodes
节点规格          4C8G            4C8G            8C16G           16C32G
副本数           1               2               2               3+
资源请求          50% limit       70% limit       80% limit       100% limit
资源限制          宽松            中等            严格            严格
HPA              禁用            启用            启用            启用
PDB              无              宽松            标准            严格
网络策略          开放            基础            严格            严格
准入控制          基础            标准            严格            严格 + OPA
镜像拉取          Always          Always          IfNotPresent    IfNotPresent
日志级别          Debug           Info            Warn            Error
监控采样          100%            50%             10%             1%
告警级别          Info            Warning         Error           Critical
自动同步          开启            开启            开启            手动 + 审批
备份策略          无              每日            每日            实时 + 异地
DR 策略           无              无              基础            多活
变更窗口          无限制          工作日          凌晨            严格窗口
```

### 8.3 多环境配置图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Multi-Environment Configuration                        │
└─────────────────────────────────────────────────────────────────────────────────┘

Git Repository Structure:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ orion-gitops/                                                                    │
│                                                                                 │
│ ├── apps/orion-platform/                                                        │
│ │   ├── base/                  # 共享基础配置                                    │
│ │   └── overlays/                                                               │
│ │       ├── dev/      ────────▶ Dev Environment                                 │
│ │       ├── test/     ────────▶ Test Environment                                │
│ │       ├── stage/    ────────▶ Stage Environment                               │
│ │       └── prod/     ────────▶ Prod Environment                                │
│                                                                                 │
│ ├── environments/                                                               │
│ │   ├── dev/                  # Dev 环境特定配置                                 │
│ │   ├── test/                 # Test 环境特定配置                                │
│ │   ├── stage/                # Stage 环境特定配置                               │
│ │   └── prod/                 # Prod 环境特定配置                                │
│                                                                                 │
│ └── infrastructure/                                                             │
│     ├── dev-cluster/          # Dev 集群配置                                     │
│     ├── test-cluster/         # Test 集群配置                                    │
│     ├── stage-cluster/        # Stage 集群配置                                   │
│     └── prod-cluster/         # Prod 集群配置                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

配置继承关系:
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                    ┌─────────────────────┐                                     │
│                    │   base/             │  ← 基础配置 (所有环境共享)             │
│                    │   - deployment.yaml │     包含通用资源定义                   │
│                    │   - service.yaml    │                                     │
│                    │   - configmap.yaml  │                                     │
│                    └──────────┬──────────┘                                     │
│                               │                                                 │
│         ┌─────────────────────┼─────────────────────┐                          │
│         │                     │                     │                          │
│         ▼                     ▼                     ▼                          │
│ ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                    │
│ │ overlays/dev/ │    │ overlays/stage/│   │ overlays/prod/│                    │
│ │               │    │               │    │               │                    │
│ │ replicas: 1   │    │ replicas: 2   │    │ replicas: 3   │                    │
│ │ cpu: 500m     │    │ cpu: 1000m    │    │ cpu: 2000m    │                    │
│ │ memory: 512Mi │    │ memory: 1Gi   │    │ memory: 2Gi   │                    │
│ │ log: debug    │    │ log: warn     │    │ log: error    │                    │
│ └───────────────┘    └───────────────┘    └───────────────┘                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

环境 promotion 流程:
Dev ──▶ Test ──▶ Stage ──▶ Prod
 │       │        │        │
 │       │        │        │
 └───────┴────────┴────────┘
         │
         │ 同一镜像版本逐级提升
         │ 配置通过 overlays 调整
```

---

## 九、配置模板化设计 (Configuration Templating)

### 9.1 模板技术选型

| 技术 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **Helm** | 成熟生态、包管理、版本控制 | 模板语法复杂、调试困难 | 复杂应用部署 |
| **Kustomize** | 原生支持、无需额外工具、易调试 | 功能相对简单 | 环境差异配置 |
| **Jsonnet** | 强大表达能力、可组合 | 学习曲线陡峭 | 超大规模配置 |
| **Cue** | 类型安全、验证能力强 | 生态较新 | 配置验证场景 |

Orion 采用 Helm + Kustomize 混合方案：
- Helm：用于复杂应用 (Prometheus, Kafka, etc.)
- Kustomize：用于自研应用 (Orion 服务)

### 9.2 Helm Chart 规范

```yaml
# Chart.yaml 规范
apiVersion: v2
name: orion-platform
description: Orion Platform Service
type: application
version: 1.0.0             # Chart 版本 (semver)
appVersion: "1.2.3"        # 应用版本
keywords:
  - orion
  - platform
  - microservice
home: https://github.com/orion/orion
sources:
  - https://github.com/orion/orion-platform
maintainers:
  - name: Orion Team
    email: orion-team@company.com

# values.yaml 结构规范
# 必须包含的顶层键:
replicaCount: 1

image:
  repository: registry.company.com/orion/platform
  pullPolicy: IfNotPresent
  tag: ""                    # 默认使用 Chart.appVersion

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext: {}
securityContext: {}

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

# 应用特定配置
config:
  logLevel: info
  metricsEnabled: true
```

### 9.3 Kustomize 规范

```yaml
# kustomization.yaml 规范
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 资源引用
resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

# 命名空间
namespace: orion-platform

# 通用标签
commonLabels:
  app.kubernetes.io/name: orion-platform
  app.kubernetes.io/managed-by: kustomize

# 通用注解
commonAnnotations:
  app.kubernetes.io/version: "1.2.3"

# 名称前缀/后缀
namePrefix: ""
nameSuffix: ""

# 配置 Map/Secret 生成
configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=info
      - METRICS_ENABLED=true
    files:
      - config.properties

secretGenerator:
  - name: db-credentials
    literals:
      - username=admin
      - password=secret
    type: Opaque

# 资源补丁
patches:
  - path: replica-patch.yaml
    target:
      kind: Deployment
      name: orion-platform

patchesJson6902:
  - target:
      group: apps
      version: v1
      kind: Deployment
      name: orion-platform
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3

# 变量替换 (不推荐，使用 patches 替代)
# variables: []

# 组件 (可复用配置块)
# components: []

# 生成器选项
generatorOptions:
  disableNameSuffixHash: false
  labels:
    generated-by: kustomize
```

---

## 十、监控指标设计 (Monitoring Metrics)

### 10.1 GitOps 核心指标

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Core Metrics                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

指标分类:
├── 同步状态指标 (Sync Status Metrics)
├── 配置漂移指标 (Drift Metrics)
├── 健康状态指标 (Health Metrics)
├── 性能指标 (Performance Metrics)
└── 业务指标 (Business Metrics)
```

### 10.2 Prometheus 指标定义

```yaml
# ArgoCD 导出指标

## 同步状态指标
argocd_app_info{app,project,dest_server,dest_namespace,sync_status,health_status}
# 应用信息，包含同步和健康状态

argocd_app_sync_status{app,sync_status="Synced|OutOfSync|Unknown"}
# 同步状态 (1=Synced, 0=OutOfSync)

argocd_app_health_status{app,health_status="Healthy|Degraded|Progressing|Unknown"}
# 健康状态 (1=Healthy, 0=其他)

argocd_app_operation_phase{app,operation_phase="Running|Succeeded|Failed"}
# 操作执行状态

argocd_app_sync_result{app,sync_result="Success|Failed"}
# 同步结果

## 配置漂移指标
argocd_app_drift_status{app,resource,drift_type}
# 配置漂移状态

argocd_app_drift_count{app,drift_type="spec|status|orphan"}
# 漂移资源数量

## 性能指标
argocd_app_reconcile_duration_seconds{app,quantile}
# 调和耗时 (直方图)

argocd_app_reconcile_queue_depth{app}
# 调和队列深度

argocd_app_last_reconcile_timestamp{app}
# 最后调和时间

## 仓库指标
argocd_repo_server_lock_acquire_duration_seconds{quantile}
# 仓库服务锁等待时间

argocd_git_request_total{repo,type="ls_remote|fetch|commit"}
# Git 请求次数

## 通知指标
argocd_notification_deliver_total{service,success="true|false"}
# 通知发送次数
```

### 10.3 GitOps Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Dashboard Overview                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Row 1: 总体健康状态                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Total Apps │  │   Healthy   │  │  Out of     │  │  Error      │           │
│  │     24      │  │     22      │  │   Sync: 2   │  │     0       │           │
│  │             │  │   (91.7%)   │  │   (8.3%)    │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Row 2: 同步趋势 (24h)                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │    Sync Events (24h)                                                    │   │
│  │    ┌────────────────────────────────────────────────────────────────┐   │   │
│  │    │    ╱╲    ╱╲                                                    │   │   │
│  │    │   ╱  ╲  ╱  ╲  ╱╲                                               │   │   │
│  │    │  ╱    ╲╱    ╲╱  ╲  ╱╲                                          │   │   │
│  │    │ ╱                 ╱  ╲  ╱╲                                     │   │   │
│  │    │╱                   ╱    ╱  ╲  ╱╲                               │   │   │
│  │    └────────────────────────────────────────────────────────────────┘   │   │
│  │         00  04  08  12  16  20  00 (hours)                              │   │
│  │         Success: 45   Failed: 2                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Row 3: 配置漂移监控                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐              │
│  │  Drift Count by Type        │  │  Drift Events (7d)          │              │
│  │                             │  │                             │              │
│  │  Spec:    ████████ 8        │  │  ┌──────────────────────┐   │              │
│  │  Status:  ██ 2              │  │  │ ╱╲ ╱╲     ╱╲         │   │              │
│  │  Orphan:  █ 1               │  │  │╱  ╲  ╲   ╱  ╲  ╱╲    │   │              │
│  │                             │  │  └──────────────────────┘   │              │
│  │  Total:   11               │  │  Mon Tue Wed Thu Fri Sat Sun │              │
│  └─────────────────────────────┘  └─────────────────────────────┘              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Row 4: 同步性能指标                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐              │
│  │  Sync Duration (P50/P95/P99)│  │  Queue Depth                │              │
│  │                             │  │                             │              │
│  │  P50: 12s                   │  │  ┌──────────────────────┐   │              │
│  │  P95: 45s                   │  │  │██ ██ ██ ██ ██ ██ ██   │   │              │
│  │  P99: 120s                  │  │  │██ ██ ██ ██ ██ ██ ██   │   │              │
│  │                             │  │  └──────────────────────┘   │              │
│  │  ┌──────────────────────┐   │  │  Avg: 2.3  Max: 8          │              │
│  │  │████████░░░░░░░░░░░░░░│   │  │                             │              │
│  │  │████████████████░░░░░░│   │  └─────────────────────────────┘              │
│  │  │██████████████████████│   │                                                 │
│  │  └──────────────────────┘   │                                                 │
│  │  P50  P95  P99              │                                                 │
│  └─────────────────────────────┘                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Row 5: 应用列表详情                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  App Name          Project    Env    Sync      Health    Last Sync    Drift    │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  orion-platform    orion      prod   ✅ Synced   ✅ Healthy   2m ago     0      │
│  orion-platform    orion      stage  ✅ Synced   ✅ Healthy   5m ago     0      │
│  orion-platform    orion      dev    ✅ Synced   ⚠️ Progressing 1m ago   0      │
│  orion-pipeline    pipeline   prod   ✅ Synced   ✅ Healthy   10m ago    0      │
│  orion-ai          ai         prod   ⚠️ OutSync  ✅ Healthy   1h ago     2      │
│  ...                                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 告警规则

```yaml
# GitOps Alert Rules (Prometheus)

groups:
  - name: gitops
    rules:
      ## 同步失败告警
      - alert: ArgoCDSyncFailed
        expr: argocd_app_sync_result{sync_result="Failed"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "ArgoCD sync failed for {{ $labels.app }}"
          description: "Sync failed for application {{ $labels.app }} in {{ $labels.project }}"
      
      ## 应用未健康告警
      - alert: ArgoCDAppUnhealthy
        expr: argocd_app_health_status{health_status!="Healthy"} == 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ArgoCD app unhealthy: {{ $labels.app }}"
          description: "Application {{ $labels.app }} is {{ $labels.health_status }}"
      
      ## 配置漂移告警
      - alert: ArgoCDConfigDrift
        expr: sum(argocd_app_drift_count) by (app) > 0
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Configuration drift detected: {{ $labels.app }}"
          description: "{{ $value }} resources have drifted in {{ $labels.app }}"
      
      ## 同步耗时过长告警
      - alert: ArgoCDSyncDurationHigh
        expr: histogram_quantile(0.95, rate(argocd_app_reconcile_duration_seconds_bucket[5m])) > 60
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ArgoCD sync duration P95 > 60s"
          description: "P95 sync duration is {{ $value }}s"
      
      ## 队列堆积告警
      - alert: ArgoCDQueueDepthHigh
        expr: argocd_app_reconcile_queue_depth > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ArgoCD reconcile queue depth high"
          description: "Queue depth is {{ $value }}"
```

---

## 十一、实施路线图 (Implementation Roadmap)

### 11.1 分阶段实施计划

| 阶段 | 时间 | 目标 | 交付物 | 优先级 |
|------|------|------|--------|--------|
| **Phase 1** | 4 周 | 基础 GitOps 架构 | ArgoCD 部署、配置仓库、应用接入 | P0 |
| **Phase 2** | 4 周 | 核心能力完善 | 版本管理、Secret 管理、漂移检测、监控 | P1 |
| **Phase 3** | 4 周 | 治理能力提升 | 审批流程、多环境、配置模板化 | P2 |
| **Phase 4** | 4 周 | 优化与推广 | 性能优化、文档培训、最佳实践 | P3 |

### 11.2 Phase 1 详细计划 (Week 1-4)

| 周 | 任务 | 产出物 | 验收标准 |
|----|------|--------|---------|
| W1 | ArgoCD 部署与配置 | ArgoCD 集群、Dashboard | 可访问 UI、可连接集群 |
| W1 | Git 仓库初始化 | 配置仓库结构、分支策略 | 仓库可用、权限配置 |
| W2 | 首个应用接入 | orion-platform GitOps 配置 | 应用可自动同步 |
| W2 | 基础监控配置 | Prometheus + Grafana | Dashboard 可见 |
| W3 | 多环境配置 | Dev/Test 环境隔离 | 环境独立同步 |
| W3 | 基础告警配置 | AlertManager 规则 | 告警可发送 |
| W4 | Phase 1 验收 | 验收报告 | 所有验收标准通过 |

### 11.3 Phase 2 详细计划 (Week 5-8)

| 周 | 任务 | 产出物 | 验收标准 |
|----|------|--------|---------|
| W5 | Vault 集成 | External Secrets | Secret 自动注入 |
| W5 | Git Tag 规范 | 版本管理流程 | Tag 自动创建 |
| W6 | 漂移检测完善 | 漂移报告、自动修复 | 漂移可检测修复 |
| W6 | 回滚流程 | 回滚脚本、文档 | 可一键回滚 |
| W7 | 监控指标完善 | 完整指标集 | 所有指标采集 |
| W7 | 告警规则完善 | 告警规则集 | 告警准确 |
| W8 | Phase 2 验收 | 验收报告 | 所有验收标准通过 |

### 11.4 Phase 3 详细计划 (Week 9-12)

| 周 | 任务 | 产出物 | 验收标准 |
|----|------|--------|---------|
| W9 | PR 审批流程 | GitHub/GitLab 规则 | 审批流程可用 |
| W9 | 变更窗口配置 | Sync Window | 窗口限制生效 |
| W10 | 多环境完善 | Stage/Prod 配置 | 环境隔离完整 |
| W10 | Helm Chart 规范 | Chart 模板 | Chart 可复用 |
| W11 | Kustomize 规范 | Kustomize 配置 | 覆盖可完成 |
| W11 | 配置冻结机制 | 冻结流程 | 冻结可生效 |
| W12 | Phase 3 验收 | 验收报告 | 所有验收标准通过 |

---

## 十二、风险与缓解 (Risks and Mitigation)

### 12.1 风险矩阵

| 风险 | 影响 | 概率 | 风险值 | 缓解措施 |
|------|------|------|--------|---------|
| Git 单点故障 | 高 | 低 | 中 | Git 高可用 + 本地缓存 |
| ArgoCD 故障 | 高 | 低 | 中 | ArgoCD HA 部署 |
| 配置错误导致故障 | 高 | 中 | 高 | CI 验证 + 审批流程 |
| Secret 泄露 | 高 | 低 | 中 | Vault + 加密 + 审计 |
| 漂移误报 | 中 | 中 | 中 | 忽略规则 + 调优 |
| 团队适应成本 | 中 | 高 | 中 | 培训 + 文档 + 支持 |

### 12.2 应急预案

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Emergency Response                              │
└─────────────────────────────────────────────────────────────────────────────────┘

场景 1: Git 服务不可用
├── 影响：无法拉取新配置，ArgoCD 使用缓存继续运行
├── 应急：
│   ├── 短期：ArgoCD 缓存可维持现有应用运行
│   ├── 中期：启用备用 Git 仓库
│   └── 长期：修复 Git 服务
└── 恢复：Git 恢复后验证同步

场景 2: ArgoCD 故障
├── 影响：无法同步新配置，现有应用继续运行
├── 应急：
│   ├── 重启 ArgoCD 组件
│   ├── 必要时 kubectl apply 手动部署
│   └── 切换备用 ArgoCD 实例
└── 恢复：ArgoCD 恢复后验证状态

场景 3: 错误配置导致故障
├── 影响：应用异常、服务中断
├── 应急：
│   ├── Git revert 错误 commit
│   ├── argocd app rollback 快速回滚
│   └── kubectl rollout undo 紧急回滚
└── 恢复：验证回滚后服务正常

场景 4: Secret 泄露
├── 影响：敏感信息泄露
├── 应急：
│   ├── 立即轮转泄露 Secret
│   ├── 撤销相关访问权限
│   └── 审计泄露范围
└── 恢复：更新所有引用位置
```

---

## 十三、验收标准 (Acceptance Criteria)

### 13.1 功能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| F1 | ArgoCD 正常部署 | 检查 Pod 状态 | 所有组件 Running |
| F2 | 配置仓库可用 | git clone/push | 操作成功 |
| F3 | 应用自动同步 | 修改配置 push | 集群自动更新 |
| F4 | 多环境隔离 | 检查环境配置 | 配置独立 |
| F5 | Secret 注入 | 检查 Secret | 可正确注入 |
| F6 | 漂移检测 | 手动修改资源 | 检测并告警/修复 |
| F7 | 回滚功能 | 执行回滚 | 成功恢复到历史版本 |
| F8 | 监控指标 | 检查 Grafana | 指标正常显示 |
| F9 | 告警功能 | 触发告警 | 告警正确发送 |
| F10 | 审批流程 | 创建 PR | 审批流程正常 |

### 13.2 性能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| P1 | 同步延迟 P95 | 压测 | < 60s |
| P2 | 同步延迟 P99 | 压测 | < 120s |
| P3 | 队列深度 | 监控 | 平均<5 |
| P4 | Git 请求延迟 | 监控 | < 5s |
| P5 | 资源使用率 | 监控 | CPU<70%, Mem<80% |

### 13.3 运维验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| O1 | HA 部署 | 故障演练 | 组件故障不影响服务 |
| O2 | 备份恢复 | 恢复演练 | 可成功恢复 |
| O3 | 日志收集 | 检查日志 | 完整可查询 |
| O4 | 文档完整 | 检查文档 | 覆盖所有功能 |
| O5 | 培训完成 | 培训考核 | 团队可独立操作 |

---

## 十四、附录 (Appendix)

### 14.1 术语表

| 术语 | 定义 |
|------|------|
| **GitOps** | 以 Git 为唯一可信来源的运维范式 |
| **ArgoCD** | Kubernetes GitOps 持续交付工具 |
| **Application CRD** | ArgoCD 定义应用的 Kubernetes 资源 |
| **Reconciliation** | 对比期望状态与实际状态并同步的过程 |
| **Drift** | 期望状态与实际状态的差异 |
| **Self-Heal** | 自动修复配置漂移的能力 |
| **Prune** | 清理 Git 中不存在但集群中存在的资源 |
| **Sync Wave** | 控制资源同步顺序的机制 |
| **Health Check** | 检查资源健康状态的逻辑 |
| **External Secrets** | 从外部 Secret 存储同步到 K8s 的 Operator |

### 14.2 参考文档

| 文档 | 链接 |
|------|------|
| ArgoCD 官方文档 | https://argo-cd.readthedocs.io/ |
| GitOps 原则 | https://opengitops.dev/ |
| External Secrets Operator | https://external-secrets.io/ |
| HashiCorp Vault | https://www.vaultproject.io/ |
| Kubernetes 最佳实践 | https://kubernetes.io/docs/concepts/ |

### 14.3 工具清单

| 工具 | 用途 | 版本 |
|------|------|------|
| ArgoCD | GitOps 控制器 | v2.9+ |
| ArgoCD Notifications | 事件通知 | v1.4+ |
| External Secrets Operator | Secret 同步 | v0.9+ |
| HashiCorp Vault | Secret 存储 | v1.15+ |
| Prometheus | 指标采集 | v2.45+ |
| Grafana | 可视化 | v10.0+ |
| kubeconform | YAML 验证 | v0.6+ |
| conftest | 策略检查 | v0.44+ |
| trivy | 安全扫描 | v0.45+ |

### 14.4 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 2026-04-10 | 架构委员会 | 待评审 | 待评审 |
| 2026-04-10 | SRE 团队 | 待评审 | 待评审 |
| 2026-04-10 | 安全团队 | 待评审 | 待评审 |

### 14.5 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
