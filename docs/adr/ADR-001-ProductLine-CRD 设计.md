# ADR-001: ProductLine CRD 设计决策

> **状态**: 提议中  
> **提出日期**: 2026-04-10  
> **提出人**: 架构团队  
> **决策人**: 待确认  
> **关联模块**: ③ 多分支产品线

---

## 1. 背景与问题

### 1.1 问题陈述

Orion 需要支持多分支产品线管理，实现：
- 分支与环境的映射关系
- 发布列车机制（版本批量晋升）
- Hotfix 紧急通道
- 分支策略路由

当前设计文档中 ProductLine CRD 定义缺失，无法进行后端数据模型设计和前端页面开发。

### 1.2 约束条件

- 必须与 Tekton Pipeline 集成
- 必须支持 GitOps 工作流
- 必须与 ArgoCD 兼容
- 必须支持多租户隔离

### 1.3 相关方

- 架构团队
- 后端开发团队
- 前端开发团队
- 产品团队

---

## 2. 备选方案

### 方案 A: Kubernetes CRD + 自定义 Controller

**描述**: 使用 Kubernetes Custom Resource Definition 定义 ProductLine，编写自定义 Controller 进行 reconcilation。

**优点**:
- 与 K8s 生态原生集成
- 声明式 API，符合 GitOps 理念
- 可利用 K8s 的 etcd 存储和 watch 机制
- 团队有 Tekton Controller 开发经验

**缺点**:
- 开发复杂度高，需要编写 Controller
- 学习曲线陡峭
- 调试相对困难

**技术细节**:
```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: productlines.orion.dev
spec:
  group: orion.dev
  versions:
    - name: v1alpha1
      served: true
      storage: true
  scope: Namespaced
  names:
    plural: productlines
    singular: productline
    kind: ProductLine
    shortNames:
      - pl
```

**成本估算**: 开发 10 人日，测试 5 人日

---

### 方案 B: PostgreSQL 关系表 + REST API

**描述**: 使用 PostgreSQL 关系表存储产品线数据，通过 REST API 进行管理。

**优点**:
- 技术栈成熟，团队熟悉
- 开发复杂度低
- 查询灵活，支持复杂 JOIN
- 调试方便

**缺点**:
- 不符合 GitOps 理念
- 需要额外实现 watch 机制
- 与 K8s 生态集成度低

**技术细节**:
```sql
CREATE TABLE product_lines (
    id UUID PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    namespace VARCHAR(256) NOT NULL,
    git_repo VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE branch_env_mapping (
    id UUID PRIMARY KEY,
    product_line_id UUID REFERENCES product_lines(id),
    branch_name VARCHAR(256) NOT NULL,
    environment VARCHAR(64) NOT NULL,
    pipeline_template VARCHAR(256),
    UNIQUE(product_line_id, branch_name, environment)
);
```

**成本估算**: 开发 5 人日，测试 3 人日

---

### 方案 C: 混合方案 (CRD + 数据库同步)

**描述**: 使用 CRD 作为声明式接口，Controller 将数据同步到 PostgreSQL 供查询使用。

**优点**:
- 兼具 GitOps 和查询灵活性
- Controller 逻辑简化
- 支持离线查询和分析

**缺点**:
- 架构复杂度最高
- 需要处理数据一致性问题
- 开发和运维成本最高

**成本估算**: 开发 15 人日，测试 8 人日

---

## 3. 决策结果

**选定方案**: **方案 A (Kubernetes CRD + 自定义 Controller)**

**决策理由**:
1. Orion 平台基于 K8s 构建，与 Tekton/ArgoCD 深度集成，CRD 是事实标准
2. 声明式 API 符合 GitOps 理念，支持配置版本化
3. 团队已有 Tekton Custom Task 开发经验，可复用
4. 长期可维护性更好

**否决其他方案的原因**:
- 方案 B: 不符合 GitOps 战略方向，与现有架构不一致
- 方案 C: 过度设计，MVP 阶段不需要，可在规模扩大后考虑

---

## 4. ProductLine CRD 完整定义

### 4.1 CRD YAML 定义

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: productlines.orion.dev
  labels:
    app.kubernetes.io/name: orion
    app.kubernetes.io/component: productline
spec:
  group: orion.dev
  scope: Namespaced
  names:
    plural: productlines
    singular: productline
    kind: ProductLine
    shortNames:
      - pl
    categories:
      - all
  
  versions:
    - name: v1alpha1
      served: true
      storage: true
      subresources:
        status: {}
      additionalPrinterColumns:
        - name: Git Repo
          type: string
          jsonPath: .spec.gitRepo
        - name: Default Branch
          type: string
          jsonPath: .spec.defaultBranch
        - name: Environments
          type: integer
          jsonPath: .spec.environments
        - name: Status
          type: string
          jsonPath: .status.phase
        - name: Age
          type: date
          jsonPath: .metadata.creationTimestamp
      
      schema:
        openAPIV3Schema:
          type: object
          required:
            - spec
          properties:
            spec:
              type: object
              required:
                - gitRepo
                - branchMappings
              properties:
                # 基础信息
                gitRepo:
                  type: string
                  description: Git 仓库地址 (支持 GitLab/GitHub)
                  pattern: '^(https?|git@)[^/]+/[^/]+/[^/]+$'
                
                defaultBranch:
                  type: string
                  description: 默认分支
                  default: main
                
                description:
                  type: string
                  description: 产品线描述
                
                # 分支 - 环境映射
                branchMappings:
                  type: array
                  description: 分支与环境的映射关系
                  items:
                    type: object
                    required:
                      - branch
                      - pattern
                    properties:
                      branch:
                        type: string
                        description: 分支名称或模式 (支持通配符)
                      
                      pattern:
                        type: string
                        description: 分支匹配模式 (regex/glob/exact)
                        enum: [regex, glob, exact]
                        default: exact
                      
                      environments:
                        type: array
                        description: 关联的环境列表
                        items:
                          type: string
                      
                      pipelineTemplate:
                        type: string
                        description: 使用的流水线模板名称
                      
                      autoDeploy:
                        type: boolean
                        description: 是否自动部署
                        default: false
                      
                      requireApproval:
                        type: boolean
                        description: 是否需要审批
                        default: true
                      
                      approvalRoles:
                        type: array
                        description: 审批角色列表
                        items:
                          type: string
                      
                      conditions:
                        type: array
                        description: 触发条件
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                              enum: [path_change, label, pr_approval]
                            value:
                              type: string
                
                # 环境定义
                environments:
                  type: array
                  description: 环境列表
                  items:
                    type: object
                    required:
                      - name
                      - namespace
                    properties:
                      name:
                        type: string
                        description: 环境名称
                        enum: [dev, staging, prod]
                      
                      namespace:
                        type: string
                        description: K8s Namespace
                      
                      cluster:
                        type: string
                        description: K8s Cluster (多集群部署)
                        default: ""
                      
                      argocdApp:
                        type: string
                        description: ArgoCD Application 名称
                      
                      deploymentStrategy:
                        type: string
                        description: 部署策略
                        enum: [automatic, manual, canary, blue-green]
                        default: automatic
                
                # 发布列车配置
                releaseTrain:
                  type: object
                  description: 发布列车配置
                  properties:
                    enabled:
                      type: boolean
                      default: false
                    
                    schedule:
                      type: string
                      description: Cron 表达式
                      example: "0 10 * * 1-5"  # 工作日每天 10 点
                    
                    targetBranch:
                      type: string
                      description: 目标分支
                      default: main
                    
                    targetEnvironment:
                      type: string
                      description: 目标环境
                      default: prod
                    
                    batchSize:
                      type: integer
                      description: 每批次 PR 数量
                      default: 10
                    
                    requireTests:
                      type: boolean
                      description: 要求测试通过
                      default: true
                    
                    requireCodeReview:
                      type: boolean
                      description: 要求 Code Review
                      default: true
                
                # Hotfix 配置
                hotfix:
                  type: object
                  description: Hotfix 通道配置
                  properties:
                    enabled:
                      type: boolean
                      default: true
                    
                    branchPattern:
                      type: string
                      description: Hotfix 分支模式
                      default: "hotfix/*"
                    
                    skipEnvironments:
                      type: array
                      description: 可跳过的环境
                      items:
                        type: string
                      default: ["dev", "staging"]
                    
                    requireApproval:
                      type: boolean
                      default: true
                    
                    approvers:
                      type: array
                      description: Hotfix 审批人
                      items:
                        type: string
                    
                    notificationChannels:
                      type: array
                      description: 通知渠道
                      items:
                        type: string
                
                # 分支策略
                branchPolicy:
                  type: object
                  description: 分支策略配置
                  properties:
                    protectedBranches:
                      type: array
                      items:
                        type: string
                      default: ["main", "release/*"]
                    
                    requirePullRequest:
                      type: boolean
                      default: true
                    
                    requireCiPass:
                      type: boolean
                      default: true
                    
                    requiredReviewers:
                      type: integer
                      default: 1
                    
                    allowedMergeMethods:
                      type: array
                      items:
                        type: string
                        enum: [merge, squash, rebase]
                      default: ["merge", "squash"]
                
                # 通知配置
                notifications:
                  type: object
                  properties:
                    onSuccess:
                      type: array
                      items:
                        type: string
                    onFailure:
                      type: array
                      items:
                        type: string
                    channels:
                      type: array
                      items:
                        type: object
                        properties:
                          type:
                            type: string
                            enum: [slack, dingtalk, wechat, email]
                          target:
                            type: string
                
                # 资源配额
                quotas:
                  type: object
                  properties:
                    maxConcurrentPipelines:
                      type: integer
                      default: 10
                    maxBuildCacheSize:
                      type: string
                      default: "10Gi"
                    dailyPipelineLimit:
                      type: integer
            
            status:
              type: object
              properties:
                phase:
                  type: string
                  enum: [Pending, Active, Suspended, Error]
                
                conditions:
                  type: array
                  items:
                    type: object
                    properties:
                      type:
                        type: string
                      status:
                        type: string
                        enum: ["True", "False", "Unknown"]
                      reason:
                        type: string
                      message:
                        type: string
                      lastTransitionTime:
                        type: string
                        format: date-time
                
                activePipelines:
                  type: integer
                
                totalPipelines:
                  type: integer
                
                lastReleaseTrain:
                  type: string
                  format: date-time
                
                observedGeneration:
                  type: integer
```

### 4.2 ProductLine 使用示例

```yaml
apiVersion: orion.dev/v1alpha1
kind: ProductLine
metadata:
  name: payment-service
  namespace: payment-team
  labels:
    team: payment-team
    business-unit: core
spec:
  gitRepo: https://gitlab.company.com/payment-team/payment-service
  defaultBranch: main
  
  branchMappings:
    # 开发分支 → dev 环境
    - branch: "feature/*"
      pattern: glob
      environments: ["dev"]
      pipelineTemplate: feature-pipeline
      autoDeploy: true
      requireApproval: false
    
    # 主分支 → dev → staging → prod
    - branch: main
      pattern: exact
      environments: ["dev", "staging", "prod"]
      pipelineTemplate: production-pipeline
      autoDeploy: false
      requireApproval: true
      approvalRoles: ["tech_lead", "sre"]
      conditions:
        - type: path_change
          value: "src/**"
    
    # 发布分支 → staging → prod
    - branch: "release/*"
      pattern: glob
      environments: ["staging", "prod"]
      pipelineTemplate: release-pipeline
      requireApproval: true
      approvalRoles: ["tech_lead"]
  
  environments:
    - name: dev
      namespace: payment-dev
      argocdApp: payment-service-dev
      deploymentStrategy: automatic
    
    - name: staging
      namespace: payment-staging
      argocdApp: payment-service-staging
      deploymentStrategy: canary
    
    - name: prod
      namespace: payment-prod
      argocdApp: payment-service-prod
      deploymentStrategy: canary
  
  releaseTrain:
    enabled: true
    schedule: "0 10 * * 1-5"
    targetBranch: main
    targetEnvironment: prod
    batchSize: 5
    requireTests: true
    requireCodeReview: true
  
  hotfix:
    enabled: true
    branchPattern: "hotfix/*"
    skipEnvironments: ["dev", "staging"]
    requireApproval: true
    approvers: ["oncall-lead", "tech_lead"]
    notificationChannels: ["slack-hotfix", "dingtalk-oncall"]
  
  branchPolicy:
    protectedBranches: ["main", "release/*"]
    requirePullRequest: true
    requireCiPass: true
    requiredReviewers: 2
    allowedMergeMethods: ["merge", "squash"]
  
  quotas:
    maxConcurrentPipelines: 5
    maxBuildCacheSize: "5Gi"
    dailyPipelineLimit: 50

status:
  phase: Active
  activePipelines: 2
  totalPipelines: 156
  lastReleaseTrain: "2026-04-10T10:00:00Z"
```

---

## 5. Controller 设计

### 5.1 Controller 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ProductLine Controller                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  K8s Informer   │───→│ Reconciler      │───→│ Status Updater  │         │
│  │  (watch PL CR)  │    │ (协调逻辑)       │    │ (更新状态)       │         │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘         │
│                                  │                                         │
│                     ┌────────────┼────────────┐                           │
│                     ↓            ↓            ↓                            │
│            ┌─────────────┐ ┌───────────┐ ┌───────────┐                    │
│            │ Pipeline    │ │ ArgoCD    │ │ Event     │                    │
│            │ Reconciler  │ │ Reconciler│ │ Publisher │                    │
│            │ (创建/更新)  │ │ (应用同步) │ │ (发布事件) │                    │
│            └─────────────┘ └───────────┘ └───────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Reconciler 伪代码

```go
func (r *ProductLineReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. 获取 ProductLine 资源
    pl := &orionv1alpha1.ProductLine{}
    if err := r.Get(ctx, req.NamespacedName, pl); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 2. 处理删除
    if !pl.DeletionTimestamp.IsZero() {
        return r.handleDeletion(ctx, pl)
    }
    
    // 3. 验证配置
    if err := r.validateProductLine(pl); err != nil {
        return r.updateStatus(ctx, pl, orionv1alpha1.PhaseError, err.Error())
    }
    
    // 4. 协调分支映射
    if err := r.reconcileBranchMappings(ctx, pl); err != nil {
        return ctrl.Result{RequeueAfter: 5 * time.Minute}, err
    }
    
    // 5. 协调环境
    if err := r.reconcileEnvironments(ctx, pl); err != nil {
        return ctrl.Result{RequeueAfter: 5 * time.Minute}, err
    }
    
    // 6. 协调发布列车
    if pl.Spec.ReleaseTrain.Enabled {
        if err := r.reconcileReleaseTrain(ctx, pl); err != nil {
            return ctrl.Result{RequeueAfter: 10 * time.Minute}, err
        }
    }
    
    // 7. 更新状态
    return r.updateStatus(ctx, pl, orionv1alpha1.PhaseActive, "Ready")
}
```

---

## 6. API 设计

### 6.1 REST API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/productlines | 获取产品线列表 |
| GET | /api/v1/productlines/{name} | 获取产品线详情 |
| POST | /api/v1/productlines | 创建产品线 |
| PUT | /api/v1/productlines/{name} | 更新产品线 |
| DELETE | /api/v1/productlines/{name} | 删除产品线 |
| POST | /api/v1/productlines/{name}/trigger | 触发流水线 |
| POST | /api/v1/productlines/{name}/release-train | 触发发布列车 |
| POST | /api/v1/productlines/{name}/hotfix | 创建 Hotfix 分支 |
| GET | /api/v1/productlines/{name}/pipelines | 获取流水线历史 |
| GET | /api/v1/productlines/{name}/environments | 获取环境状态 |

### 6.2 API 响应示例

```json
// GET /api/v1/productlines/payment-service
{
  "code": 0,
  "data": {
    "metadata": {
      "name": "payment-service",
      "namespace": "payment-team",
      "createdAt": "2026-04-01T00:00:00Z",
      "updatedAt": "2026-04-10T00:00:00Z"
    },
    "spec": {
      "gitRepo": "https://gitlab.company.com/payment-team/payment-service",
      "defaultBranch": "main",
      "branchMappings": [...],
      "environments": [...],
      "status": {
        "phase": "Active",
        "activePipelines": 2,
        "totalPipelines": 156
      }
    }
  }
}
```

---

## 7. 影响分析

### 7.1 对其他模块的影响

| 模块 | 影响类型 | 需要配合的工作 |
|------|---------|---------------|
| ⑥ 流水线引擎 | 接口依赖 | 支持 ProductLine 标签的 Pipeline 创建 |
| ② 配置管理 | 数据同步 | ArgoCD Application 自动创建 |
| ① 代码管理 | 事件触发 | GitLab Webhook 路由到 ProductLine |
| ⑩ 效能看板 | 数据源 | 按 ProductLine 聚合 DORA 指标 |

### 7.2 对运维的影响

- 需要部署 ProductLine Controller
- 需要配置 CRD RBAC 权限
- 需要监控 Controller 健康状态

### 7.3 对安全的影响

- ProductLine 需要租户隔离（Namespace 级别）
- Hotfix 通道需要额外审批流程
- 分支策略需要与 GitLab 保护分支同步

---

## 8. 实施计划

| 阶段 | 任务 | 负责人 | 预计完成 |
|------|------|--------|---------|
| 1 | CRD 定义评审与确认 | 架构师 | 2026-04-12 |
| 2 | Controller 骨架代码 | 后端开发 | 2026-04-19 |
| 3 | Reconciler 逻辑实现 | 后端开发 | 2026-04-26 |
| 4 | REST API 实现 | 后端开发 | 2026-05-03 |
| 5 | 单元测试 + 集成测试 | 测试工程师 | 2026-05-10 |
| 6 | 前端对接 | 前端开发 | 2026-05-17 |

---

## 9. 验收标准

- [ ] CRD 定义通过架构评审
- [ ] Controller 通过单元测试（覆盖率≥80%）
- [ ] 支持创建/更新/删除 ProductLine
- [ ] 分支映射能正确触发 Pipeline
- [ ] 发布列车能按计划执行
- [ ] Hotfix 通道能跳过环境部署
- [ ] 状态能正确反映在 status 字段

---

## 10. Revisit 条件

- ProductLine 数量超过 1000 个，需评估性能
- Controller 成为性能瓶颈，需考虑方案 C
- 团队 K8s 开发资源不足，需考虑方案 B

---

## 附录

### A. 分支模式匹配规则

| 模式类型 | 示例 | 匹配结果 |
|---------|------|---------|
| exact | main | 仅匹配 main 分支 |
| glob | feature/* | 匹配 feature/login, feature/payment 等 |
| regex | ^(release|hotfix)/.*$ | 匹配 release/* 和 hotfix/* |

### B. 状态机

```
Pending ──→ Active
   │          │
   │          ├──→ Suspended
   │          │        │
   │          └───────→┘
   │
   └─────→ Error
```

### C. 参考资料

- [Kubernetes CRD 文档](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Tekton Pipeline 源码](https://github.com/tektoncd/pipeline)
- [Kubebuilder 框架](https://book.kubebuilder.io/)

---

_文档版本：v1.0_
_创建日期：2026-04-10_
_状态：提议中，待评审_
