# Orion 数据库 Schema 设计

> 版本：v2.0 (合并通用 Schema 与 CMDB Schema)  
> 创建日期：2026-04-10  
> 适用范围：MySQL 8.0+ (主数据库), Redis 7+ (缓存), MongoDB 6+ (日志/文档), ClickHouse (分析)

---

## 一、设计概述

### 1.1 数据库选型

| 数据类型 | 数据库 | 用途 |
|---------|--------|------|
| 关系型数据 | MySQL 8.0 | 用户、团队、流水线、审批、部署、CMDB 等核心业务 |
| 缓存数据 | Redis 7 | Session、热点数据、分布式锁、限流计数 |
| 文档数据 | MongoDB 6 | 日志、审计记录、AI 对话历史 |
| 时序数据 | MySQL Partition | 监控指标、效能指标（分区表） |
| 分析数据 | ClickHouse | 效能分析、日志分析、审计分析 |

### 1.2 数据库隔离策略

```sql
-- 多租户 Database 隔离
-- 每个团队一个 Database，实现数据隔离

-- 公共数据库 (所有团队共享)
CREATE DATABASE orion_public;

-- 团队数据库 (隔离访问)
CREATE DATABASE team_payment;
CREATE DATABASE team_order;
CREATE DATABASE team_user;

-- 系统数据库
CREATE DATABASE orion_system;  -- 系统配置
CREATE DATABASE orion_audit;   -- 审计日志
```

### 1.3 表分类总览

| 分类 | 表数量 | 说明 |
|------|--------|------|
| 核心业务表 | 20+ 表 | 用户/团队/产品线/流水线/审批/部署等 |
| 主机资产 | 8 表 | 物理机/虚拟机/容器主机 |
| K8s 资源 | 10 表 | Pod/Deployment/Service 等 |
| CI/CD 资源 | 6 表 | PipelineRun/TaskRun 等 |
| GitOps 资源 | 4 表 | ArgoCD Application |
| AI 资源 | 4 表 | GPU 池/向量库实例 |
| 公共能力 | 10 表 | 权限/分组/字典/审计 |
| **总计** | **62+ 表** | |

---

## 二、核心业务表（orion_public，20+ 表）

### 2.1 用户与团队

```sql
-- 用户表
CREATE TABLE orion_public.users (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id         VARCHAR(64) UNIQUE NOT NULL,  -- 企业微信/钉钉 ID
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    avatar_url      VARCHAR(512),
    department      VARCHAR(255),
    title           VARCHAR(128),
    phone           VARCHAR(32),
    
    -- 认证信息
    password_hash   VARCHAR(255),  -- 可选，SSO 用户为空
    totp_secret     VARCHAR(64),   -- 2FA 密钥
    last_login_at   DATETIME,
    last_login_ip   VARCHAR(45),   -- IPv6 最大长度
    
    -- 状态
    status          ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    email_verified  TINYINT(1) DEFAULT FALSE,
    
    -- 元数据
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      CHAR(36),
    
    -- 索引
    INDEX idx_users_email (email),
    INDEX idx_users_department (department),
    INDEX idx_users_status (status),
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 团队表
CREATE TABLE orion_public.teams (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    team_id         VARCHAR(64) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    parent_id       CHAR(36),
    
    -- 负责人
    owner_id        CHAR(36) NOT NULL,
    
    -- 配置
    timezone        VARCHAR(64) DEFAULT 'Asia/Shanghai',
    notification_channel VARCHAR(255),
    
    -- 配额 (JSON 格式)
    quota           JSON,
    
    -- 状态
    status          ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    
    -- 元数据
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_teams_parent (parent_id),
    INDEX idx_teams_owner (owner_id),
    CONSTRAINT fk_teams_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT fk_teams_parent FOREIGN KEY (parent_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 团队成员关系表
CREATE TABLE orion_public.team_members (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    team_id         CHAR(36) NOT NULL,
    user_id         CHAR(36) NOT NULL,
    role            ENUM('owner', 'admin', 'member', 'viewer') NOT NULL,
    
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by      CHAR(36),
    
    UNIQUE KEY uk_team_user (team_id, user_id),
    INDEX idx_team_members_user (user_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 产品线 (ProductLine)

```sql
-- 产品线主表
CREATE TABLE orion_public.product_lines (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    pl_id               VARCHAR(64) UNIQUE NOT NULL,
    name                VARCHAR(128) NOT NULL,
    description         TEXT,
    
    -- 归属
    team_id             CHAR(36) NOT NULL,
    owner_id            CHAR(36) NOT NULL,
    
    -- 仓库信息
    git_repo            VARCHAR(512) NOT NULL,
    default_branch      VARCHAR(64) DEFAULT 'main',
    
    -- 技术栈
    language            VARCHAR(64),
    framework           VARCHAR(64),
    build_tool          VARCHAR(64),
    
    -- 部署配置
    deploy_type         ENUM('kubernetes', 'ecs', 'serverless', 'static') DEFAULT 'kubernetes',
    runtime             VARCHAR(64),
    
    -- 状态
    status              ENUM('active', 'archived', 'deleted') DEFAULT 'active',
    
    -- 元数据
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by          CHAR(36),
    
    UNIQUE KEY uk_team_pl (team_id, pl_id),
    INDEX idx_product_lines_team (team_id),
    INDEX idx_product_lines_status (status),
    CONSTRAINT fk_pl_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_pl_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT fk_pl_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3 流水线 (Pipeline)

```sql
-- 流水线定义表
CREATE TABLE orion_public.pipelines (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    pipeline_id         VARCHAR(64) UNIQUE NOT NULL,
    
    -- 关联
    product_line_id     CHAR(36) NOT NULL,
    
    -- 基本信息
    name                VARCHAR(128) NOT NULL,
    description         TEXT,
    
    -- 触发配置
    trigger_type        ENUM('manual', 'auto', 'scheduled', 'webhook') NOT NULL,
    cron_expression     VARCHAR(64),
    
    -- 流水线配置 (JSON)
    stages              JSON NOT NULL,
    timeout_minutes     INT DEFAULT 60,
    
    -- 状态
    enabled             TINYINT(1) DEFAULT TRUE,
    is_template         TINYINT(1) DEFAULT FALSE,
    
    -- 统计
    total_runs          INT DEFAULT 0,
    success_rate        DECIMAL(5,2) DEFAULT 0,
    
    -- 元数据
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by          CHAR(36),
    
    INDEX idx_pipelines_pl (product_line_id),
    INDEX idx_pipelines_enabled (enabled),
    CONSTRAINT fk_pipe_pl FOREIGN KEY (product_line_id) REFERENCES product_lines(id),
    CONSTRAINT fk_pipe_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 流水线运行表
CREATE TABLE orion_public.pipeline_runs (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    run_id              VARCHAR(64) UNIQUE NOT NULL,
    
    -- 关联
    pipeline_id         CHAR(36) NOT NULL,
    product_line_id     CHAR(36) NOT NULL,
    
    -- 触发信息
    trigger_type        ENUM('manual', 'auto', 'scheduled', 'webhook') NOT NULL,
    trigger_by          CHAR(36),
    trigger_reason      TEXT,
    
    -- Git 信息
    git_sha             VARCHAR(64),
    git_branch          VARCHAR(128),
    git_tag             VARCHAR(128),
    git_commit_message  TEXT,
    git_author          CHAR(36),
    
    -- 运行状态
    status              ENUM('pending', 'queued', 'running', 'success', 'failed', 'cancelled', 'timeout') DEFAULT 'pending',
    current_stage       VARCHAR(64),
    
    -- 时间
    queued_at           DATETIME,
    started_at          DATETIME,
    finished_at         DATETIME,
    duration_seconds    INT,
    
    -- Tekton 信息
    tekton_pipeline_uid VARCHAR(128),
    tekton_pipelinerun_name VARCHAR(255),
    tekton_namespace    VARCHAR(128) DEFAULT 'orion-pipelines',
    
    -- 重试信息
    retry_count         INT DEFAULT 0,
    retry_of_run_id     CHAR(36),
    
    -- 元数据
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_pipeline_runs_pipeline (pipeline_id),
    INDEX idx_pipeline_runs_status (status),
    INDEX idx_pipeline_runs_created (created_at DESC),
    INDEX idx_pipeline_runs_pl_status (product_line_id, status),
    CONSTRAINT fk_run_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipelines(id),
    CONSTRAINT fk_run_pl FOREIGN KEY (product_line_id) REFERENCES product_lines(id),
    CONSTRAINT fk_run_trigger_by FOREIGN KEY (trigger_by) REFERENCES users(id),
    CONSTRAINT fk_run_git_author FOREIGN KEY (git_author) REFERENCES users(id),
    CONSTRAINT fk_run_retry FOREIGN KEY (retry_of_run_id) REFERENCES pipeline_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.4 审批 (Approval)

```sql
-- 审批定义表
CREATE TABLE orion_public.approval_definitions (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- 关联
    product_line_id     CHAR(36),
    pipeline_id         CHAR(36),
    stage_name          VARCHAR(128),
    
    -- 审批配置
    name                VARCHAR(128) NOT NULL,
    description         TEXT,
    
    -- 审批类型
    approval_type       ENUM('manual', 'auto', 'weighted', 'unanimous') NOT NULL,
    
    -- 审批人
    approver_type       ENUM('user', 'role', 'team', 'oncall') NOT NULL,
    approver_ids        JSON NOT NULL,
    min_approvals       INT DEFAULT 1,
    
    -- 超时
    timeout_hours       INT DEFAULT 48,
    timeout_action      ENUM('reject', 'auto_approve', 'escalate') DEFAULT 'reject',
    escalate_to         JSON,
    
    -- 条件 (JSON)
    conditions          JSON,
    
    enabled             TINYINT(1) DEFAULT TRUE,
    
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by          CHAR(36),
    
    INDEX idx_approval_definitions_pl (product_line_id),
    CONSTRAINT fk_def_pl FOREIGN KEY (product_line_id) REFERENCES product_lines(id),
    CONSTRAINT fk_def_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipelines(id),
    CONSTRAINT fk_def_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审批实例表
CREATE TABLE orion_public.approvals (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    approval_id         VARCHAR(64) UNIQUE NOT NULL,
    
    -- 关联
    definition_id       CHAR(36) NOT NULL,
    run_id              CHAR(36) NOT NULL,
    product_line_id     CHAR(36) NOT NULL,
    
    -- 审批信息
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    context             JSON,
    
    -- 状态
    status              ENUM('pending', 'approved', 'rejected', 'transferred', 'cancelled', 'timeout') DEFAULT 'pending',
    
    -- 审批进度
    total_approvers     INT NOT NULL,
    approved_count      INT DEFAULT 0,
    rejected_count      INT DEFAULT 0,
    
    -- 时间
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at          DATETIME,
    finished_at         DATETIME,
    
    -- 元数据
    created_by          CHAR(36),
    
    INDEX idx_approvals_run (run_id),
    INDEX idx_approvals_status (status),
    INDEX idx_approvals_created (created_at DESC),
    CONSTRAINT fk_approval_def FOREIGN KEY (definition_id) REFERENCES approval_definitions(id),
    CONSTRAINT fk_approval_run FOREIGN KEY (run_id) REFERENCES pipeline_runs(id),
    CONSTRAINT fk_approval_pl FOREIGN KEY (product_line_id) REFERENCES product_lines(id),
    CONSTRAINT fk_approval_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.5 部署 (Deployment)

```sql
-- 部署记录表
CREATE TABLE orion_public.deployments (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    deploy_id           VARCHAR(64) UNIQUE NOT NULL,
    
    -- 关联
    product_line_id     CHAR(36) NOT NULL,
    run_id              CHAR(36),
    approval_id         CHAR(36),
    
    -- 部署信息
    environment         VARCHAR(64) NOT NULL,
    version             VARCHAR(64) NOT NULL,
    previous_version    VARCHAR(64),
    
    -- 部署策略
    strategy            ENUM('rolling', 'blue-green', 'canary') NOT NULL,
    config              JSON,
    
    -- 状态
    status              ENUM('pending', 'in_progress', 'paused', 'success', 'failed', 'rolled_back', 'cancelled') DEFAULT 'pending',
    progress_percentage INT DEFAULT 0,
    
    -- 时间
    started_at          DATETIME,
    finished_at         DATETIME,
    duration_seconds    INT,
    
    -- 回滚信息
    is_rollback         TINYINT(1) DEFAULT FALSE,
    rollback_of_id      CHAR(36),
    
    -- 元数据
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by          CHAR(36),
    
    INDEX idx_deployments_pl (product_line_id),
    INDEX idx_deployments_environment (environment),
    INDEX idx_deployments_status (status),
    INDEX idx_deployments_created (created_at DESC),
    CONSTRAINT fk_deploy_pl FOREIGN KEY (product_line_id) REFERENCES product_lines(id),
    CONSTRAINT fk_deploy_run FOREIGN KEY (run_id) REFERENCES pipeline_runs(id),
    CONSTRAINT fk_deploy_approval FOREIGN KEY (approval_id) REFERENCES approvals(id),
    CONSTRAINT fk_deploy_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_deploy_rollback FOREIGN KEY (rollback_of_id) REFERENCES deployments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 三、CMDB 主机资产表（8 表）

### 3.1 host - 主机表

```sql
CREATE TABLE `host` (
    `id`            bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`     bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`          varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主机名称',
    `hostname`      varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '主机名',
    `ip`            varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'IP 地址',
    `port`          int(0) NOT NULL DEFAULT 22 COMMENT '端口',
    `os_type`       varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '操作系统类型',
    `os_version`    varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '操作系统版本',
    `cpu_cores`     int(0) NULL DEFAULT NULL COMMENT 'CPU 核心数',
    `memory_bytes`  bigint(0) NULL DEFAULT NULL COMMENT '内存字节数',
    `disk_bytes`    bigint(0) NULL DEFAULT NULL COMMENT '磁盘字节数',
    `arch`          varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '架构',
    `status`        varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '状态',
    `agent_key`     varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Agent 密钥',
    `agent_status`  varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Agent 状态',
    `last_seen_at`  datetime(0) NULL DEFAULT NULL COMMENT '最后心跳时间',
    `create_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    `creator`       varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '创建人',
    `updater`       varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '更新人',
    `deleted`       tinyint(0) NULL DEFAULT 0 COMMENT '是否删除 0 未删除 1 已删除',
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_ip` (`ip`),
    INDEX `idx_agent_key` (`agent_key`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='主机表';
```

### 3.2 host_ssh_config - SSH 配置表

```sql
CREATE TABLE `host_ssh_config` (
    `id`            bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `host_id`       bigint(0) NOT NULL COMMENT '主机 id',
    `auth_type`     varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '认证类型 PASSWORD/KEY',
    `username`      varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户名',
    `password`      text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '密码（加密）',
    `private_key`   text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '私钥（加密）',
    `passphrase`    text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT '私钥密码（加密）',
    `timeout`       int(0) NULL DEFAULT 30 COMMENT '超时秒数',
    `extra`         json NULL COMMENT '扩展配置',
    `create_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    `creator`       varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '创建人',
    `updater`       varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '更新人',
    PRIMARY KEY (`id`),
    INDEX `idx_host_id` (`host_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSH 配置表';
```

---

## 四、K8s 资源表（10 表）

### 4.1 k8s_cluster - K8s 集群表

```sql
CREATE TABLE `k8s_cluster` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`              varchar(128) NOT NULL COMMENT '集群名称',
    `api_server`        varchar(512) NOT NULL COMMENT 'API Server 地址',
    `version`           varchar(32) NULL DEFAULT NULL COMMENT 'K8s 版本',
    `provider`          varchar(64) NULL DEFAULT NULL COMMENT '提供商 (eks/aks/gke/self-hosted)',
    `region`            varchar(128) NULL DEFAULT NULL COMMENT '区域',
    
    -- 认证配置
    `credential_type`   varchar(32) NOT NULL COMMENT '认证类型 (kubeconfig/service-account)',
    `credential_ref`    varchar(255) NOT NULL COMMENT '凭证引用 (Secret 名称)',
    
    -- 状态
    `status`            varchar(16) NOT NULL DEFAULT 'pending' COMMENT '状态 (pending/connected/error)',
    `last_connected_at` datetime(0) NULL DEFAULT NULL COMMENT '最后连接时间',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    `creator`           varchar(64) NULL DEFAULT NULL COMMENT '创建人',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_name` (`name`),
    UNIQUE KEY `uk_tenant_name` (`tenant_id`, `name`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='K8s 集群表';
```

### 4.2 k8s_deployment - K8s 部署表

```sql
CREATE TABLE `k8s_deployment` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `cluster_id`        bigint(0) NOT NULL COMMENT '集群 id',
    `namespace`         varchar(128) NOT NULL COMMENT '命名空间',
    `name`              varchar(255) NOT NULL COMMENT '部署名称',
    
    -- 配置
    `replicas`          int(0) NOT NULL DEFAULT 1 COMMENT '副本数',
    `image`             varchar(512) NOT NULL COMMENT '镜像地址',
    `containers`        json NULL COMMENT '容器配置列表 (JSON)',
    
    -- 状态
    `ready_replicas`    int(0) DEFAULT 0 COMMENT '就绪副本数',
    `available_replicas` int(0) DEFAULT 0 COMMENT '可用副本数',
    `status`            varchar(16) NOT NULL DEFAULT 'pending' COMMENT '状态',
    
    -- 同步信息
    `last_synced_at`    datetime(0) NULL DEFAULT NULL COMMENT '最后同步时间',
    `sync_error`        text COMMENT '同步错误信息',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_cluster_ns` (`cluster_id`, `namespace`),
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='K8s 部署表';
```

---

## 五、CI/CD 资源表（6 表）

### 5.1 cicd_pipeline - 流水线定义表

```sql
CREATE TABLE `cicd_pipeline` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`              varchar(255) NOT NULL COMMENT '流水线名称',
    `description`       text COMMENT '描述',
    
    -- 关联
    `product_line_id`   bigint(0) NULL DEFAULT NULL COMMENT '产品线 id',
    
    -- 配置
    `trigger_type`      varchar(32) NOT NULL COMMENT '触发类型 (manual/auto/scheduled/webhook)',
    `cron_expression`   varchar(64) NULL DEFAULT NULL COMMENT 'Cron 表达式',
    `stages`            json NOT NULL COMMENT '流水线阶段配置 (JSON)',
    `timeout_minutes`   int(0) DEFAULT 60 COMMENT '超时时间 (分钟)',
    
    -- 状态
    `enabled`           tinyint(0) NOT NULL DEFAULT 1 COMMENT '是否启用',
    `is_template`       tinyint(0) NOT NULL DEFAULT 0 COMMENT '是否模板',
    
    -- 统计
    `total_runs`        int(0) DEFAULT 0 COMMENT '总运行次数',
    `success_rate`      decimal(5,2) DEFAULT 0 COMMENT '成功率',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    `creator`           varchar(64) NULL DEFAULT NULL COMMENT '创建人',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_product_line` (`product_line_id`),
    INDEX `idx_enabled` (`enabled`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流水线定义表';
```

### 5.2 cicd_pipeline_run - 流水线运行表

```sql
CREATE TABLE `cicd_pipeline_run` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `pipeline_id`       bigint(0) NOT NULL COMMENT '流水线 id',
    `run_id`            varchar(64) NOT NULL COMMENT '运行 ID (唯一)',
    
    -- 触发信息
    `trigger_type`      varchar(32) NOT NULL COMMENT '触发类型',
    `trigger_by`        bigint(0) NULL DEFAULT NULL COMMENT '触发人',
    `trigger_reason`    text COMMENT '触发原因',
    
    -- Git 信息
    `git_sha`           varchar(64) NULL DEFAULT NULL COMMENT '提交 SHA',
    `git_branch`        varchar(128) NULL DEFAULT NULL COMMENT '分支',
    `git_tag`           varchar(128) NULL DEFAULT NULL COMMENT '标签',
    `git_commit_message` text COMMENT '提交信息',
    
    -- 状态
    `status`            varchar(32) NOT NULL DEFAULT 'pending' COMMENT '状态 (pending/running/success/failed/cancelled)',
    `current_stage`     varchar(128) NULL DEFAULT NULL COMMENT '当前阶段',
    
    -- 时间
    `queued_at`         datetime(0) NULL DEFAULT NULL COMMENT '入队时间',
    `started_at`        datetime(0) NULL DEFAULT NULL COMMENT '开始时间',
    `finished_at`       datetime(0) NULL DEFAULT NULL COMMENT '结束时间',
    `duration_seconds`  int(0) NULL DEFAULT NULL COMMENT '耗时 (秒)',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_pipeline` (`pipeline_id`),
    INDEX `idx_run_id` (`run_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created` (`create_time` DESC)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流水线运行表';

-- 分片建议：按 tenant_id + 时间分区 (见数据库分片与同步设计)
```

---

## 六、GitOps 资源表（4 表）

### 6.1 gitops_application - GitOps 应用表

```sql
CREATE TABLE `gitops_application` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`              varchar(255) NOT NULL COMMENT '应用名称',
    `namespace`         varchar(128) NOT NULL COMMENT '目标命名空间',
    `cluster_id`        bigint(0) NULL DEFAULT NULL COMMENT '目标集群 id',
    
    -- Git 配置
    `git_repo`          varchar(512) NOT NULL COMMENT 'Git 仓库地址',
    `git_revision`      varchar(128) NOT NULL DEFAULT 'HEAD' COMMENT '跟踪分支/标签',
    `git_path`          varchar(512) NOT NULL COMMENT 'Manifest 路径',
    
    -- 同步配置
    `sync_policy`       varchar(32) NOT NULL DEFAULT 'manual' COMMENT '同步策略 (manual/auto)',
    `sync_options`      json NULL COMMENT '同步选项 (JSON)',
    `prune_enabled`     tinyint(0) NOT NULL DEFAULT 1 COMMENT '是否修剪废弃资源',
    `self_heal_enabled` tinyint(0) NOT NULL DEFAULT 1 COMMENT '是否自愈',
    
    -- 状态
    `sync_status`       varchar(32) NOT NULL DEFAULT 'unknown' COMMENT '同步状态 (in-sync/out-of-sync/unknown)',
    `health_status`     varchar(32) NOT NULL DEFAULT 'unknown' COMMENT '健康状态 (healthy/unhealthy/unknown)',
    `last_synced_at`    datetime(0) NULL DEFAULT NULL COMMENT '最后同步时间',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    `creator`           varchar(64) NULL DEFAULT NULL COMMENT '创建人',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_cluster_ns` (`cluster_id`, `namespace`),
    UNIQUE KEY `uk_tenant_name` (`tenant_id`, `name`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GitOps 应用表';
```

---

## 七、AI 资源表（4 表）

### 7.1 ai_gpu_pool - GPU 资源池表

```sql
CREATE TABLE `ai_gpu_pool` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`              varchar(128) NOT NULL COMMENT '资源池名称',
    
    -- GPU 配置
    `gpu_type`          varchar(64) NOT NULL COMMENT 'GPU 型号 (A100/V100/H100)',
    `total_gpus`        int(0) NOT NULL COMMENT 'GPU 总数',
    `total_memory_gb`   int(0) NOT NULL COMMENT '总显存 (GB)',
    
    -- 分配
    `allocated_gpus`    int(0) DEFAULT 0 COMMENT '已分配 GPU 数',
    `allocated_memory_gb` int(0) DEFAULT 0 COMMENT '已分配显存 (GB)',
    
    -- 状态
    `status`            varchar(16) NOT NULL DEFAULT 'active' COMMENT '状态 (active/inactive/maintenance)',
    
    -- 元数据
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `update_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '修改时间',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GPU 资源池表';
```

### 7.2 ai_inference_log - AI 推理日志表

```sql
CREATE TABLE `ai_inference_log` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `skill_id`          bigint(0) NOT NULL COMMENT 'Skill ID',
    
    -- 输入
    `input_data`        json NOT NULL COMMENT '输入数据',
    `prompt`            text COMMENT 'Prompt 内容',
    
    -- 输出
    `output_data`       json NULL COMMENT '输出数据',
    `raw_response`      text COMMENT '原始响应',
    
    -- 执行信息
    `status`            varchar(32) NOT NULL COMMENT '状态 (success/failed/timeout/fallback)',
    `latency_ms`        int(0) NULL DEFAULT NULL COMMENT '耗时 (ms)',
    
    -- 模型信息
    `model_provider`    varchar(32) NULL DEFAULT NULL COMMENT '模型提供商',
    `model_name`        varchar(64) NULL DEFAULT NULL COMMENT '模型名称',
    `tokens_used`       int(0) NULL DEFAULT NULL COMMENT 'Token 使用数',
    
    -- 关联
    `user_id`           bigint(0) NULL DEFAULT NULL COMMENT '用户 ID',
    `run_id`            bigint(0) NULL DEFAULT NULL COMMENT '流水线运行 ID',
    
    -- 降级
    `is_fallback`       tinyint(0) NOT NULL DEFAULT 0 COMMENT '是否降级',
    `fallback_reason`   text COMMENT '降级原因',
    
    -- 时间
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_skill` (`skill_id`),
    INDEX `idx_created` (`create_time` DESC)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 推理日志表';

-- 分片建议：按时间分区 (见数据库分片与同步设计)
```

---

## 八、公共能力表（10 表）

### 8.1 data_group - 数据分组表

```sql
CREATE TABLE `data_group` (
    `id`            bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`     bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `name`          varchar(128) NOT NULL COMMENT '分组名称',
    `parent_id`     bigint(0) NULL DEFAULT NULL COMMENT '父分组 id',
    `level`         varchar(64) NULL DEFAULT NULL COMMENT '分组层级路径 (如：/1/5/12/)',
    `type`          varchar(32) NOT NULL COMMENT '分组类型 (host/k8s/pipeline/...)',
    `description`   text COMMENT '描述',
    `sort_order`    int(0) DEFAULT 0 COMMENT '排序',
    `extra`         json NULL COMMENT '扩展信息',
    `create_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `creator`       varchar(64) NULL DEFAULT NULL COMMENT '创建人',
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_parent` (`parent_id`),
    INDEX `idx_level` (`level`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据分组表';
```

### 8.2 data_permission - 数据权限表

```sql
CREATE TABLE `data_permission` (
    `id`            bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`     bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `resource_type` varchar(64) NOT NULL COMMENT '资源类型',
    `resource_id`   bigint(0) NOT NULL COMMENT '资源 id',
    `user_id`       bigint(0) NULL DEFAULT NULL COMMENT '用户 id',
    `role_id`       bigint(0) NULL DEFAULT NULL COMMENT '角色 id',
    `team_id`       bigint(0) NULL DEFAULT NULL COMMENT '团队 id',
    `permissions`   varchar(64) NOT NULL COMMENT '权限 (read/write/admin)',
    `create_time`   datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `creator`       varchar(64) NULL DEFAULT NULL COMMENT '创建人',
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_resource` (`resource_type`, `resource_id`),
    INDEX `idx_user` (`user_id`),
    INDEX `idx_role` (`role_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据权限表';
```

### 8.3 audit_log - 审计日志表

```sql
CREATE TABLE `audit_log` (
    `id`                bigint(0) NOT NULL AUTO_INCREMENT COMMENT 'id',
    `tenant_id`         bigint(0) NULL DEFAULT NULL COMMENT '租户 id',
    `user_id`           bigint(0) NULL DEFAULT NULL COMMENT '用户 id',
    `action`            varchar(64) NOT NULL COMMENT '操作类型',
    `resource_type`     varchar(64) NOT NULL COMMENT '资源类型',
    `resource_id`       bigint(0) NULL DEFAULT NULL COMMENT '资源 id',
    `request_data`      json NULL COMMENT '请求数据',
    `response_data`     json NULL COMMENT '响应数据',
    `ip_address`        varchar(64) NULL DEFAULT NULL COMMENT 'IP 地址',
    `user_agent`        varchar(512) NULL DEFAULT NULL COMMENT 'User-Agent',
    `status`            varchar(16) NOT NULL DEFAULT 'success' COMMENT '状态 (success/failure)',
    `error_message`     text COMMENT '错误信息',
    `duration_ms`       int(0) NULL DEFAULT NULL COMMENT '耗时 (ms)',
    `create_time`       datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_user` (`user_id`),
    INDEX `idx_action` (`action`),
    INDEX `idx_resource` (`resource_type`, `resource_id`),
    INDEX `idx_created` (`create_time` DESC)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表';

-- 分片建议：按 tenant_id + 时间分区 (见数据库分片与同步设计)
```

---

## 九、索引优化

### 9.1 通用索引策略

```sql
-- 复合索引示例
CREATE INDEX idx_pipeline_runs_pl_status_created 
ON orion_public.pipeline_runs(product_line_id, status, created_at DESC);

-- 覆盖索引
CREATE INDEX idx_approvals_status_created 
ON orion_public.approvals(status, created_at DESC, id);

-- 前缀索引 (长字符串字段)
CREATE INDEX idx_users_email_prefix 
ON orion_public.users(email(20));

-- 全文索引 (搜索字段)
CREATE FULLTEXT INDEX idx_pipelines_search 
ON orion_public.pipelines(name, description);
```

---

## 十、数据迁移与备份

### 10.1 分区表管理

```sql
-- 按月份自动添加分区 (存储过程)
DELIMITER $$

CREATE PROCEDURE add_monthly_partition(IN table_name VARCHAR(64), IN partition_date DATE)
BEGIN
    DECLARE partition_name VARCHAR(64);
    DECLARE next_date DATE;
    
    SET partition_name = CONCAT('p', DATE_FORMAT(partition_date, '%Y%m'));
    SET next_date = DATE_ADD(partition_date, INTERVAL 1 MONTH);
    
    SET @sql = CONCAT(
        'ALTER TABLE ', table_name, 
        ' ADD PARTITION (PARTITION ', partition_name,
        ' VALUES LESS THAN (', UNIX_TIMESTAMP(next_date), '))'
    );
    
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$

DELIMITER ;
```

### 10.2 数据备份

```bash
#!/bin/bash
# 全量备份脚本
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份所有数据库
mysqldump -u root -p --all-databases \
    --single-transaction \
    --master-data=2 \
    --compress \
    --quick \
    > ${BACKUP_DIR}/full_backup_${DATE}.sql

# 压缩备份文件
gzip ${BACKUP_DIR}/full_backup_${DATE}.sql

# 保留最近 30 天的备份
find ${BACKUP_DIR} -name "full_backup_*.sql.gz" -mtime +30 -delete
```

---

_文档版本：v2.0 (合并通用 Schema 与 CMDB Schema)_  
_创建日期：2026-04-10_  
_状态：设计完成_

---

## 九、P0 数据库修复（2026-04-10）

### 9.1 分片策略

**问题**：42 张表无分片策略，大数据量性能下降

**修复方案**：详见 [数据库分片与同步设计](./数据库分片与同步设计.md)

**分片表分类**：
| 表名 | 分片键 | 分片算法 | 归档策略 |
|------|--------|---------|---------|
| audit_log | tenant_id + 时间 | Hash(tenant_id)%10 + 按月分区 | 90 天归档 ClickHouse |
| event_log | 时间 | 按月分区 | 1 年冷存储 |
| cicd_pipeline_run | pipeline_id + 时间 | Hash(pipeline_id)%20 + 按月分区 | 180 天归档 |
| ai_inference_log | 时间 | 按月分区 | 90 天归档 |
| k8s_sync_log | cluster_id + 时间 | 按集群 + 按月分区 | 30 天自动清理 |

### 9.2 CDC 同步架构

```
MySQL Binlog → Flink CDC → Kafka → ETL → ClickHouse
                  │                       │
                  ▼                       ▼
            延迟监控 (<5s)          一致性校验 (每日)
```

**数据一致性**：
- 延迟容忍：5-10 秒最终一致
- 冲突解决：以 MySQL 为准
- 每日校验：自动对账 + 告警

### 9.3 tenant_id 索引优化

**问题**：tenant_id 列需要频繁查询，但无法每个表都加索引

**修复方案**：
1. **高频查询表**：单独 tenant_id 索引
2. **低频查询表**：复合索引包含 tenant_id
3. **超大表**：按 tenant_id 分片

---

_文档版本：v2.0（P0 修复） | 创建日期：2026-04-10 | 状态：已批准_
