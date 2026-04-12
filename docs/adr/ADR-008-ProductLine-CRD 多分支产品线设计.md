# ADR-007: ProductLine CRD 设计（多分支产品线架构）

> **状态**: 已批准  
> **提出日期**: 2026-04-10  
> **提出人**: 架构团队  
> **决策人**: 架构委员会  
> **关联模块**: ③ 多分支产品线  
> **替代**: ADR-001（第一版 CRD 设计）  
> **合并**: ADR-010-ProductLine-CRD-定义

---

## 1. 背景与问题

### 1.1 问题陈述

在 ADR-001 的基础上，产品评审发现以下关键缺失：

1. **分支策略定义不完整**：缺少对 GitFlow、GitHub Flow、Trunk Based 等主流工作流的支持
2. **分支 - 环境映射规则模糊**：无法明确指导多环境部署配置
3. **Code Ownership 缺失**：无法支持多团队协作场景
4. **环境变量与 Secret 管理未定义**：影响实际落地使用

### 1.2 设计目标

- 提供完整的 CRD 定义，覆盖所有产品线配置场景
- 明确分支策略与环境映射规则
- 支持多团队、多环境、多集群部署
- 保持与 Tekton/ArgoCD 生态兼容

---

## 2. CRD 定义总览

### 2.1 CRD 列表

| CRD 名称 | 用途 | Scope | 示例 |
|---------|------|-------|------|
| ProductLine | 定义产品线/多分支 | Namespaced | payment-service |
| BranchMapping | 分支 - 环境映射 | Namespaced | main→prod, develop→staging |
| ReleaseTrain | 发布列车配置 | Namespaced | weekly-release |
| HotfixChannel | 紧急修复通道 | Namespaced | critical-hotfix |

### 2.2 CRD 架构关系

```
┌─────────────────────────────────────────────────────────────────┐
│                    ProductLine CRD                               │
│  • Git 仓库配置                                                  │
│  • 分支策略 (GitFlow/GitHub Flow/Trunk Based)                   │
│  • 环境映射                                                      │
│  • 团队绑定                                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 引用
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BranchMapping CRD                              │
│  • 分支→环境路由规则                                             │
│  • 多集群部署配置                                                │
│  • 自动部署策略                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 触发
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ReleaseTrain CRD                               │
│  • 发布列车调度 (Cron)                                           │
│  • 环境晋升链                                                    │
│  • 审批流程                                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   HotfixChannel CRD                              │
│  • 紧急修复通道                                                  │
│  • 跳过 Stage 配置                                                 │
│  • 快速审批                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ProductLine CRD 完整定义

### 3.1 CRD YAML 定义

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: productlines.orion.io
  labels:
    app.kubernetes.io/name: orion
    app.kubernetes.io/component: productline
spec:
  group: orion.io
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
    - name: v1
      served: true
      storage: true
      subresources:
        status: {}
      additionalPrinterColumns:
        - name: Display Name
          type: string
          jsonPath: .spec.displayName
        - name: Git Repo
          type: string
          jsonPath: .spec.gitRepo.url
        - name: Branch Mode
          type: string
          jsonPath: .spec.branchPolicies.mode
        - name: Environments
          type: integer
          jsonPath: .spec.environmentMappings.mappings[*].environment
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
                - displayName
                - gitRepo
                - branchPolicies
                - environmentMappings
              properties:
                # ==================== 基础信息 ====================
                displayName:
                  type: string
                  description: 产品线显示名称
                  minLength: 1
                  maxLength: 64
                
                description:
                  type: string
                  description: 产品线详细描述
                  maxLength: 1024
                
                # ==================== Git 仓库配置 ====================
                gitRepo:
                  type: object
                  description: Git 仓库配置
                  required:
                    - url
                  properties:
                    url:
                      type: string
                      description: Git 仓库地址
                      pattern: '^(https?://|git@|ssh://)[^\s]+$'
                    
                    provider:
                      type: string
                      description: Git 服务提供商
                      enum: [github, gitlab, gitea, azure-devops]
                      default: github
                    
                    defaultBranch:
                      type: string
                      description: 默认分支名称
                      default: main
                    
                    credentialRef:
                      type: object
                      description: 凭证引用
                      required:
                        - name
                      properties:
                        name:
                          type: string
                          description: Secret 名称
                        namespace:
                          type: string
                          description: Secret 命名空间
                          default: orion-system
                    
                    sshKeyRef:
                      type: object
                      description: SSH 密钥引用
                      properties:
                        secretName:
                          type: string
                        key:
                          type: string
                          default: id_rsa
                    
                    cloneOptions:
                      type: object
                      properties:
                        depth:
                          type: integer
                          default: 1
                        submodules:
                          type: boolean
                          default: false
                        lfs:
                          type: boolean
                          default: false
                
                # ==================== 分支策略 ====================
                branchPolicies:
                  type: object
                  description: 分支策略配置
                  required:
                    - mode
                  properties:
                    mode:
                      type: string
                      description: 分支工作流模式
                      enum: [gitflow, github-flow, trunk-based]
                      default: github-flow
                    
                    # 分支保护规则
                    protectedBranches:
                      type: array
                      description: 受保护分支列表
                      items:
                        type: object
                        required:
                          - pattern
                        properties:
                          pattern:
                            type: string
                            description: 分支匹配模式
                          
                          patternType:
                            type: string
                            enum: [exact, glob, regex]
                            default: exact
                          
                          allowForcePush:
                            type: boolean
                            default: false
                          
                          allowDelete:
                            type: boolean
                            default: false
                          
                          requirePullRequest:
                            type: boolean
                            default: true
                          
                          requiredReviewers:
                            type: integer
                            default: 1
                          
                          requireCiPass:
                            type: boolean
                            default: true
                          
                          requiredChecks:
                            type: array
                            items:
                              type: string
                          
                          allowedMergeMethods:
                            type: array
                            items:
                              type: string
                              enum: [merge, squash, rebase, fast-forward]
                            default: [merge, squash]
                    
                    # Code Ownership 配置
                    codeOwnership:
                      type: object
                      description: 代码所有权配置
                      properties:
                        enabled:
                          type: boolean
                          default: false
                        
                        owners:
                          type: array
                          items:
                            type: object
                            required:
                              - path
                              - reviewers
                            properties:
                              path:
                                type: string
                                description: 文件路径模式
                              
                              reviewers:
                                type: array
                                items:
                                  type: string
                                description: 负责人/团队列表
                              
                              requiredReviews:
                                type: integer
                                default: 1
                              
                              labels:
                                type: array
                                items:
                                  type: string
                                description: 自动添加的标签
                        
                        defaultReviewers:
                          type: array
                          items:
                            type: string
                          description: 默认评审人
                        
                        autoAssign:
                          type: boolean
                          default: false
                    
                    # 分支命名规范
                    namingConvention:
                      type: object
                      properties:
                        feature:
                          type: string
                          default: "feature/*"
                          pattern: '^[a-zA-Z0-9/*_-]+$'
                        
                        bugfix:
                          type: string
                          default: "bugfix/*"
                        
                        hotfix:
                          type: string
                          default: "hotfix/*"
                        
                        release:
                          type: string
                          default: "release/*"
                        
                        enforce:
                          type: boolean
                          default: false
                    
                    # 合并策略
                    mergeStrategy:
                      type: object
                      properties:
                        method:
                          type: string
                          enum: [merge, squash, rebase]
                          default: squash
                        
                        commitMessage:
                          type: object
                          properties:
                            includePRTitle:
                              type: boolean
                              default: true
                            includePRBody:
                              type: boolean
                              default: false
                            includeCoAuthors:
                              type: boolean
                              default: true
                            prefix:
                              type: string
                              example: "[auto-merge]"
                        
                        deleteSourceBranch:
                          type: boolean
                          default: true
                
                # ==================== 分支 - 环境映射 ====================
                environmentMappings:
                  type: object
                  description: 分支与环境的映射规则
                  required:
                    - mappings
                  properties:
                    defaultEnvironment:
                      type: string
                      description: 默认环境名称
                      default: dev
                    
                    mappings:
                      type: array
                      description: 分支 - 环境映射列表
                      items:
                        type: object
                        required:
                          - branch
                          - patternType
                          - environment
                        properties:
                          branch:
                            type: string
                            description: 分支名称或模式
                          
                          patternType:
                            type: string
                            description: 匹配类型
                            enum: [exact, glob, regex]
                            default: exact
                          
                          environment:
                            type: string
                            description: 目标环境名称
                          
                          priority:
                            type: integer
                            description: 优先级（数字越小优先级越高）
                            default: 100
                          
                          autoDeploy:
                            type: boolean
                            description: 是否自动部署
                            default: false
                          
                          requireApproval:
                            type: boolean
                            default: true
                          
                          approvalConfig:
                            type: object
                            properties:
                              requiredApprovers:
                                type: integer
                                default: 1
                              
                              approverRoles:
                                type: array
                                items:
                                  type: string
                              
                              approverUsers:
                                type: array
                                items:
                                  type: string
                              
                              timeoutSeconds:
                                type: integer
                                default: 3600
                          
                          pipelineTemplate:
                            type: string
                            description: 使用的流水线模板
                          
                          conditions:
                            type: array
                            items:
                              type: object
                              properties:
                                type:
                                  type: string
                                  enum: [path_change, label, file_exists]
                                
                                value:
                                  type: string
                                
                                action:
                                  type: string
                                  enum: [trigger, skip, require_approval]
                    
                    # 环境晋升配置
                    promotion:
                      type: object
                      description: 环境晋升配置
                      properties:
                        enabled:
                          type: boolean
                          default: false
                        
                        chain:
                          type: array
                          items:
                            type: string
                          description: 环境晋升链，如 [dev, staging, prod]
                        
                        autoPromote:
                          type: array
                          items:
                            type: object
                            properties:
                              from:
                                type: string
                              to:
                                type: string
                              conditions:
                                type: array
                                items:
                                  type: string
                                  description: 触发条件，如 tests_passed, approval_received
                
                # ==================== 环境配置 ====================
                environments:
                  type: array
                  description: 环境详细配置
                  items:
                    type: object
                    required:
                      - name
                      - namespace
                    properties:
                      name:
                        type: string
                        description: 环境名称
                        enum: [dev, test, staging, preprod, prod]
                      
                      displayName:
                        type: string
                        description: 环境显示名称
                      
                      namespace:
                        type: string
                        description: K8s Namespace
                      
                      # 多集群部署
                      cluster:
                        type: string
                        description: K8s Cluster 名称
                        default: ""
                      
                      clusterRef:
                        type: object
                        description: 集群引用
                        properties:
                          name:
                            type: string
                          
                          apiServer:
                            type: string
                          
                          credentialRef:
                            type: object
                            properties:
                              name:
                                type: string
                              namespace:
                                type: string
                      
                      # ArgoCD 集成
                      argocd:
                        type: object
                        properties:
                          application:
                            type: string
                            description: ArgoCD Application 名称
                          
                          project:
                            type: string
                            default: default
                          
                          repoURL:
                            type: string
                          
                          path:
                            type: string
                            default: "."
                          
                          targetRevision:
                            type: string
                          
                          syncPolicy:
                            type: object
                            properties:
                              automated:
                                type: boolean
                                default: false
                              prune:
                                type: boolean
                                default: true
                              selfHeal:
                                type: boolean
                                default: false
                      
                      # 部署策略
                      deploymentStrategy:
                        type: string
                        description: 部署策略
                        enum: [recreate, rolling, canary, blue-green]
                        default: rolling
                      
                      canaryConfig:
                        type: object
                        description: 金丝雀配置
                        properties:
                          steps:
                            type: array
                            items:
                              type: object
                              properties:
                                weight:
                                  type: integer
                                pause:
                                  type: object
                                  properties:
                                    duration:
                                      type: string
                                    enabled:
                                      type: boolean
                          
                          metrics:
                            type: array
                            items:
                              type: object
                              properties:
                                name:
                                  type: string
                                threshold:
                                  type: string
                      
                      # 环境变量
                      env:
                        type: array
                        description: 环境变量列表
                        items:
                          type: object
                          required:
                            - name
                          properties:
                            name:
                              type: string
                            value:
                              type: string
                            valueFrom:
                              type: object
                              properties:
                                configMapKeyRef:
                                  type: object
                                  properties:
                                    name:
                                      type: string
                                    key:
                                      type: string
                                secretKeyRef:
                                  type: object
                                  properties:
                                    name:
                                      type: string
                                    key:
                                      type: string
                      
                      # Secret 管理
                      secrets:
                        type: array
                        description: Secret 引用列表
                        items:
                          type: object
                          required:
                            - name
                          properties:
                            name:
                              type: string
                            mountPath:
                              type: string
                            items:
                              type: array
                              items:
                                type: object
                                properties:
                                  key:
                                    type: string
                                  path:
                                    type: string
                      
                      # 资源配额
                      resourceQuota:
                        type: object
                        properties:
                          maxPods:
                            type: integer
                          maxCPU:
                            type: string
                          maxMemory:
                            type: string
                          maxStorage:
                            type: string
                      
                      # 副本数配置
                      replicas:
                        type: object
                        properties:
                          min:
                            type: integer
                            default: 1
                          max:
                            type: integer
                          target:
                            type: integer
                      
                      # 自动扩缩容
                      hpa:
                        type: object
                        properties:
                          enabled:
                            type: boolean
                            default: false
                          minReplicas:
                            type: integer
                            default: 1
                          maxReplicas:
                            type: integer
                          targetCPUUtilization:
                            type: integer
                            default: 80
                          targetMemoryUtilization:
                            type: integer
                
                # ==================== 流水线模板 ====================
                pipelineTemplates:
                  type: object
                  description: 流水线模板配置
                  properties:
                    defaultTemplate:
                      type: string
                      description: 默认流水线模板
                    
                    templates:
                      type: array
                      items:
                        type: object
                        required:
                          - name
                        properties:
                          name:
                            type: string
                          
                          type:
                            type: string
                            enum: [tekton, argo-workflow, jenkins, custom]
                            default: tekton
                          
                          ref:
                            type: string
                            description: 模板引用（Pipeline/Task 名称）
                          
                          namespace:
                            type: string
                            default: orion-system
                          
                          params:
                            type: array
                            items:
                              type: object
                              properties:
                                name:
                                  type: string
                                value:
                                  type: string
                                default:
                                  type: string
                          
                          workspaces:
                            type: array
                            items:
                              type: object
                              properties:
                                name:
                                  type: string
                                volumeClaimTemplate:
                                  type: object
                                emptyDir:
                                  type: object
                          
                          when:
                            type: array
                            items:
                              type: object
                              properties:
                                input:
                                  type: string
                                operator:
                                  type: string
                                  enum: [in, notin]
                                values:
                                  type: array
                                  items:
                                    type: string
                
                # ==================== 团队绑定 ====================
                teamBindings:
                  type: array
                  description: 团队绑定配置
                  items:
                    type: object
                    required:
                      - teamRef
                      - role
                    properties:
                      teamRef:
                        type: string
                        description: 团队引用
                        
                      role:
                        type: string
                        description: 角色
                        enum: [admin, maintainer, developer, viewer]
                      
                      permissions:
                        type: array
                        items:
                          type: string
                          enum: [deploy, approve, configure, view_logs, manage_secrets]
                      
                      environments:
                        type: array
                        items:
                          type: string
                        description: 可访问的环境列表
                
                # ==================== 资源配额 ====================
                resourceQuotas:
                  type: object
                  description: 资源配额限制
                  properties:
                    pipeline:
                      type: object
                      properties:
                        maxConcurrent:
                          type: integer
                          default: 10
                        maxDaily:
                          type: integer
                          default: 100
                        timeoutSeconds:
                          type: integer
                          default: 3600
                    
                    build:
                      type: object
                      properties:
                        maxCacheSize:
                          type: string
                          default: "10Gi"
                        maxBuildTime:
                          type: integer
                          default: 1800
                        maxParallelBuilds:
                          type: integer
                          default: 5
                    
                    storage:
                      type: object
                      properties:
                        maxArtifactSize:
                          type: string
                          default: "1Gi"
                        maxRetentionDays:
                          type: integer
                          default: 30
                    
                    compute:
                      type: object
                      properties:
                        maxCPU:
                          type: string
                          default: "8"
                        maxMemory:
                          type: string
                          default: "16Gi"
                        maxEphemeralStorage:
                          type: string
                          default: "50Gi"
                
                # ==================== 通知配置 ====================
                notifications:
                  type: object
                  description: 通知配置
                  properties:
                    channels:
                      type: array
                      items:
                        type: object
                        required:
                          - type
                          - target
                        properties:
                          type:
                            type: string
                            enum: [slack, dingtalk, wechat, email, webhook]
                          
                          target:
                            type: string
                            description: 目标地址（频道/邮箱/URL）
                          
                          secretRef:
                            type: object
                            properties:
                              name:
                                type: string
                              namespace:
                                type: string
                          
                          events:
                            type: array
                            items:
                              type: string
                              enum: [pipeline_started, pipeline_succeeded, pipeline_failed, deployment_started, deployment_succeeded, deployment_failed, approval_required]
                    
                    rules:
                      type: array
                      items:
                        type: object
                        properties:
                          event:
                            type: string
                          severity:
                            type: string
                            enum: [info, warning, error]
                          channels:
                            type: array
                            items:
                              type: string
                
                # ==================== 标签与注解 ====================
                labels:
                  type: object
                  additionalProperties:
                    type: string
                  description: 自定义标签
                
                annotations:
                  type: object
                  additionalProperties:
                    type: string
                  description: 自定义注解
            
            status:
              type: object
              properties:
                phase:
                  type: string
                  description: 产品线状态
                  enum: [Pending, Active, Suspended, Error, Terminating]
                
                conditions:
                  type: array
                  items:
                    type: object
                    required:
                      - type
                      - status
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
                      lastUpdateTime:
                        type: string
                        format: date-time
                
                # 统计信息
                statistics:
                  type: object
                  properties:
                    totalPipelines:
                      type: integer
                    activePipelines:
                      type: integer
                    successfulPipelines:
                      type: integer
                    failedPipelines:
                      type: integer
                    totalDeployments:
                      type: integer
                    lastDeploymentTime:
                      type: string
                      format: date-time
                
                # Git 仓库状态
                gitStatus:
                  type: object
                  properties:
                    lastSyncTime:
                      type: string
                      format: date-time
                    lastCommit:
                      type: object
                      properties:
                        sha:
                          type: string
                        message:
                          type: string
                        author:
                          type: string
                        time:
                          type: string
                          format: date-time
                    branches:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          lastCommit:
                            type: string
                          protected:
                            type: boolean
                
                # 环境状态
                environments:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      phase:
                        type: string
                        enum: [Pending, Ready, Error]
                      lastDeployment:
                        type: object
                        properties:
                          version:
                            type: string
                          time:
                            type: string
                            format: date-time
                          status:
                            type: string
                
                observedGeneration:
                  type: integer
```

### 3.2 ProductLine 使用示例

```yaml
apiVersion: orion.io/v1
kind: ProductLine
metadata:
  name: payment-service
  namespace: orion-system
  labels:
    team: payment-team
    business-unit: core
  annotations:
    description: "支付服务产品线"
    owner: "payment-team@company.com"
spec:
  displayName: 支付服务
  description: 处理支付交易的核心服务
  
  gitRepo:
    url: https://gitlab.company.com/payment-team/payment-service
    provider: gitlab
    defaultBranch: main
    credentialRef:
      name: gitlab-payment-credential
      namespace: orion-system
  
  branchPolicies:
    mode: gitflow
    
    protectedBranches:
      - pattern: main
        requirePullRequest: true
        requiredReviewers: 2
        requireCiPass: true
      - pattern: develop
        requirePullRequest: true
        requiredReviewers: 1
        requireCiPass: true
      - pattern: release/*
        patternType: glob
        requirePullRequest: false
        requireCiPass: true
    
    codeOwnership:
      enabled: true
      owners:
        - path: "src/core/**"
          reviewers: ["@core-team"]
          requiredReviews: 2
  
  environmentMappings:
    defaultEnvironment: dev
    mappings:
      - branch: feature/*
        patternType: glob
        environment: dev
        autoDeploy: true
        requireApproval: false
        pipelineTemplate: feature-pipeline
      
      - branch: develop
        patternType: exact
        environment: test
        autoDeploy: true
        requireApproval: false
        pipelineTemplate: integration-pipeline
      
      - branch: release/*
        patternType: glob
        environment: preprod
        autoDeploy: false
        requireApproval: true
        approvalConfig:
          requiredApprovers: 1
          approverRoles: ["tech-lead"]
        pipelineTemplate: release-pipeline
      
      - branch: main
        patternType: exact
        environment: prod
        autoDeploy: false
        requireApproval: true
        approvalConfig:
          requiredApprovers: 2
          approverRoles: ["tech-lead", "sre"]
        pipelineTemplate: production-pipeline
    
    promotion:
      enabled: true
      chain: [dev, test, preprod, prod]
  
  environments:
    - name: dev
      namespace: payment-dev
      cluster: dev-cluster
      deploymentStrategy: rolling
      env:
        - name: LOG_LEVEL
          value: debug
        - name: ENV
          value: dev
    
    - name: test
      namespace: payment-test
      cluster: dev-cluster
      deploymentStrategy: rolling
    
    - name: preprod
      namespace: payment-preprod
      cluster: staging-cluster
      deploymentStrategy: canary
      canaryConfig:
        steps:
          - weight: 10
            pause: { duration: 5m }
          - weight: 50
            pause: { duration: 10m }
          - weight: 100
    
    - name: prod
      namespace: payment-prod
      cluster: prod-cluster
      deploymentStrategy: canary
      canaryConfig:
        steps:
          - weight: 5
            pause: { duration: 15m, enabled: true }
          - weight: 25
            pause: { duration: 30m, enabled: true }
          - weight: 100
      resourceQuota:
        maxPods: 50
        maxCPU: "32"
        maxMemory: "128Gi"
  
  pipelineTemplates:
    defaultTemplate: production-pipeline
    templates:
      - name: feature-pipeline
        type: tekton
        ref: feature-pipeline
        namespace: orion-system
      
      - name: production-pipeline
        type: tekton
        ref: production-pipeline
        namespace: orion-system
        params:
          - name: image-registry
            value: harbor.company.com
          - name: enable-security-scan
            value: "true"
  
  teamBindings:
    - teamRef: payment-team
      role: admin
      permissions: [deploy, approve, configure]
      environments: [dev, test, preprod, prod]
    
    - teamRef: sre-team
      role: maintainer
      permissions: [deploy, approve]
      environments: [prod]
  
  resourceQuotas:
    pipeline:
      maxConcurrent: 5
      maxDaily: 50
    build:
      maxCacheSize: "5Gi"
  
  notifications:
    channels:
      - type: slack
        target: "#payment-alerts"
        events:
          - pipeline_failed
          - deployment_failed
          - approval_required
      - type: dingtalk
        target: "webhook-url"
        events:
          - deployment_succeeded
```

---

## 4. BranchMapping CRD

### 4.1 CRD YAML 定义

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: branchmappings.orion.io
spec:
  group: orion.io
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          required:
            - spec
          properties:
            spec:
              type: object
              required:
                - productLine
                - mappings
              properties:
                productLine:
                  type: string
                  description: 关联的产品线名称
                
                mappings:
                  type: array
                  items:
                    type: object
                    required:
                      - branch
                      - environments
                    properties:
                      branch:
                        type: string
                        description: 分支名称（支持通配符）
                      
                      environments:
                        type: array
                        items:
                          type: object
                          required:
                            - name
                            - namespace
                          properties:
                            name:
                              type: string
                              enum: [development, staging, production]
                            namespace:
                              type: string
                              description: K8s Namespace
                            cluster:
                              type: string
                              description: K8s 集群名称
                            deployStrategy:
                              type: string
                              enum: [auto, manual, approval]
                              default: auto
```

### 4.2 BranchMapping 使用示例

```yaml
apiVersion: orion.io/v1
kind: BranchMapping
metadata:
  name: payment-service-mapping
  namespace: orion-product-lines
spec:
  productLine: payment-service
  
  mappings:
    # develop 分支 → Dev 环境
    - branch: develop
      environments:
        - name: development
          namespace: payment-dev
          cluster: dev-cluster
          deployStrategy: auto
    
    # main 分支 → Staging 环境
    - branch: main
      environments:
        - name: staging
          namespace: payment-staging
          cluster: staging-cluster
          deployStrategy: auto
    
    # production 分支 → Production 环境
    - branch: production
      environments:
        - name: production
          namespace: payment-prod
          cluster: prod-cluster
          deployStrategy: approval
    
    # hotfix 分支 → 所有环境
    - branch: hotfix/*
      environments:
        - name: development
          namespace: payment-dev
          cluster: dev-cluster
          deployStrategy: auto
        - name: staging
          namespace: payment-staging
          cluster: staging-cluster
          deployStrategy: auto
        - name: production
          namespace: payment-prod
          cluster: prod-cluster
          deployStrategy: approval
```

---

## 5. ReleaseTrain CRD

### 5.1 CRD YAML 定义

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: releasetrains.orion.io
spec:
  group: orion.io
  versions:
    - name: v1
      served: true
      storage: true
      subresources:
        status: {}
      schema:
        openAPIV3Schema:
          type: object
          required:
            - productLine
            - schedule
          properties:
            spec:
              type: object
              required:
                - productLine
                - schedule
              properties:
                productLine:
                  type: string
                  description: 关联的产品线
                
                schedule:
                  type: string
                  description: Cron 表达式
                  example: "0 10 * * 1"
                
                targetBranch:
                  type: string
                  default: production
                
                sourceBranch:
                  type: string
                  default: main
                
                autoPromote:
                  type: boolean
                  default: false
                
                approvalRequired:
                  type: boolean
                  default: true
                
                approvers:
                  type: array
                  items:
                    type: string
                  description: 审批人列表
                
                preChecks:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      type:
                        type: string
                        enum: [test, security, performance, manual]
                      required:
                        type: boolean
                        default: true
                
                postActions:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      type:
                        type: string
                        enum: [notify, tag, changelog, sync]
                      config:
                        type: object
            
            status:
              type: object
              properties:
                lastRun:
                  type: string
                  format: date-time
                nextRun:
                  type: string
                  format: date-time
                state:
                  type: string
                  enum: [Idle, Running, Completed, Failed, Skipped]
                lastRelease:
                  type: string
```

### 5.2 ReleaseTrain 使用示例

```yaml
apiVersion: orion.io/v1
kind: ReleaseTrain
metadata:
  name: payment-weekly-release
  namespace: orion-product-lines
spec:
  productLine: payment-service
  schedule: "0 10 * * 1"  # 每周一 10 点
  targetBranch: production
  sourceBranch: main
  autoPromote: false
  approvalRequired: true
  
  approvers:
    - tech-lead-zhangsan
    - product-manager-lisi
    - sre-wangwu
  
  preChecks:
    - name: 所有测试通过
      type: test
      required: true
    - name: 安全扫描通过
      type: security
      required: true
    - name: 性能测试达标
      type: performance
      required: false
  
  postActions:
    - name: 通知发布完成
      type: notify
      config:
        channels: [dingtalk, email]
        recipients: [release-team@company.com]
    - name: 创建 Git Tag
      type: tag
      config:
        pattern: v{version}
    - name: 生成 CHANGELOG
      type: changelog
      config:
        format: markdown
```

---

## 6. HotfixChannel CRD

### 6.1 CRD YAML 定义

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: hotfixchannels.orion.io
spec:
  group: orion.io
  versions:
    - name: v1
      served: true
      storage: true
      subresources:
        status: {}
      schema:
        openAPIV3Schema:
          type: object
          required:
            - productLine
          properties:
            spec:
              type: object
              required:
                - productLine
              properties:
                productLine:
                  type: string
                
                enabled:
                  type: boolean
                  default: true
                
                branchPattern:
                  type: string
                  default: "^hotfix/.*$"
                
                skipStages:
                  type: array
                  items:
                    type: string
                    enum: [scan, build, test, database-review, release, deploy]
                
                requiredStages:
                  type: array
                  items:
                    type: string
                  description: 必须执行的 Stage（优先级高于 skipStages）
                
                approvalRequired:
                  type: boolean
                  default: true
                
                approvalTimeout:
                  type: integer
                  description: 审批超时时间（分钟）
                  default: 30
                
                autoMerge:
                  type: boolean
                  default: false
                
                notifyOnCall:
                  type: boolean
                  default: true
                
                maxDuration:
                  type: integer
                  description: 最长执行时间（分钟）
                  default: 60
            
            status:
              type: object
              properties:
                activeHotfixes:
                  type: integer
                lastHotfix:
                  type: string
```

### 6.2 HotfixChannel 使用示例

```yaml
apiVersion: orion.io/v1
kind: HotfixChannel
metadata:
  name: payment-hotfix
  namespace: orion-product-lines
spec:
  productLine: payment-service
  enabled: true
  branchPattern: "^hotfix/.*$"
  
  # 紧急修复可跳过非关键 Stage
  skipStages:
    - test  # 跳过完整测试套件
    - performance  # 跳过性能测试
  
  # 但必须执行的关键 Stage
  requiredStages:
    - scan  # 安全扫描必须执行
    - build  # 构建必须执行
    - deploy  # 部署必须执行
  
  approvalRequired: true
  approvalTimeout: 30  # 30 分钟超时
  autoMerge: false
  notifyOnCall: true
  maxDuration: 60  # 最长 60 分钟
```

---

## 7. 状态机设计

### 7.1 ProductLine 状态机

```
┌─────────────────────────────────────────────────────────────┐
│              ProductLine 状态机                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐                                               │
│  │ Pending  │ ←─ 创建时初始状态                              │
│  └────┬─────┘                                               │
│       │                                                      │
│       │ 条件：Repository 可访问 + 分支存在                    │
│       ▼                                                      │
│  ┌──────────┐                                               │
│  │  Active  │ ←─ 正常可用状态                                │
│  └────┬─────┘                                               │
│       │                                                      │
│       │ 操作：suspend                                        │
│       ▼                                                      │
│  ┌──────────┐                                               │
│  │ Suspended│ ←─ 暂停状态，不触发流水线                       │
│  └────┬─────┘                                               │
│       │                                                      │
│       │ 操作：resume                                         │
│       ▼                                                      │
│  ┌──────────┐                                               │
│  │  Active  │                                               │
│  └──────────┘                                               │
│                                                             │
│  异常状态：Error（配置错误/Repository 不可访问）               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 ReleaseTrain 状态机

```
┌─────────────────────────────────────────────────────────────┐
│              ReleaseTrain 状态机                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     ┌─────────┐                                             │
│     │  Idle   │ ←─ 等待下次触发                              │
│     └────┬────┘                                             │
│          │                                                   │
│          │ Cron 触发                                         │
│          ▼                                                   │
│     ┌─────────┐                                             │
│     │ Running │ ←─ 执行发布列车                              │
│     └────┬────┘                                             │
│          │                                                   │
│     ┌────┴────┐                                             │
│     │         │                                             │
│     ▼         ▼                                             │
│ ┌─────────┐ ┌─────────┐                                     │
│ │Completed│ │ Failed  │ ←─ 失败可手动重试                    │
│ └─────────┘ └─────────┘                                     │
│                                                             │
│  跳过条件：前一次发布仍在进行中                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 分支策略详解

### 8.1 支持的分支模式

| 模式 | 描述 | 适用场景 |
|------|------|---------|
| **GitFlow** | 严格的双主线模型（main + develop） | 传统企业、多版本并行维护 |
| **GitHub Flow** | 单主线模型，基于 PR 的简单工作流 | SaaS 产品、快速迭代 |
| **Trunk Based** | 主干开发，小批量频繁提交 | 持续交付成熟团队 |

### 8.2 分支 - 环境映射规则表

| 分支模式 | 开发分支 | 测试分支 | 预发分支 | 生产分支 | 说明 |
|---------|---------|---------|---------|---------|------|
| **GitFlow** | `feature/*` → dev | `develop` → test | `release/*` → preprod | `main` → prod | develop 集成功能，release 准备发布 |
| **GitHub Flow** | - | PR 目标 → test | - | `main` → prod | 所有变更通过 PR 合并到 main |
| **Trunk Based** | `feature/*` → dev | `main` → test | - | `main` + tag → prod | 特性开关控制，打 tag 发布 |

---

## 9. kubectl 操作命令

```bash
# 创建 ProductLine
kubectl apply -f payment-service-pl.yaml

# 查看 ProductLine 列表
kubectl get productlines -n orion-system

# 查看 ProductLine 详情
kubectl get productline payment-service -n orion-system -o yaml

# 查看状态
kubectl get productline payment-service -n orion-system -o jsonpath='{.status}'

# 编辑 ProductLine
kubectl edit productline payment-service -n orion-system

# 删除 ProductLine
kubectl delete productline payment-service -n orion-system

# 查看特定环境状态
kubectl get productline payment-service -n orion-system \
  -o jsonpath='{.status.environments[?(@.name=="prod")]}'

# 监控状态变化
kubectl get productline payment-service -n orion-system -w
```

---

## 10. 验收标准

- [ ] CRD 定义通过架构评审
- [ ] 支持三种分支模式（GitFlow/GitHub Flow/Trunk Based）
- [ ] 分支 - 环境映射正确触发流水线
- [ ] Code Ownership 正确分配评审人
- [ ] 多集群部署配置生效
- [ ] 环境变量与 Secret 正确挂载
- [ ] 资源配额限制生效
- [ ] 状态正确反映在 status 字段

---

## 11. Revisit 条件

- 分支策略在实际使用中需要额外模式，需扩展枚举值
- 环境晋升逻辑复杂，需引入工作流引擎
- 多集群部署需要支持跨云厂商

---

_文档版本：v2.0 (合并 ADR-007/ADR-010)_  
_创建日期：2026-04-10_  
_状态：已批准，可进入开发_
