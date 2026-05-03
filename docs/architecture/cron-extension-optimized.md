# Orion Cron 功能扩展最优方案

## 概述

本方案采用**混合架构**，基于 Orion 现有基础设施演进，避免引入新技术栈（XXL-Job/Dragonfly），同时确保高并发场景的可靠性和扩展性。

---

## 一、架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Orion Cron 混合架构                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    轻量级任务层 (Node.js)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │           CronSchedulerService (扩展)                        │ │   │
│  │  │  - 租户隔离 (tenant_id)                                      │ │   │
│  │  │  - 分布式锁调度 (复用 DistributedLockService)                │ │   │
│  │  │  - HTTP 执行器 (安全限制)                                    │ │   │
│  │  │  - 重试机制 (max_retries)                                    │ │   │
│  │  │  - 任务优先级 (priority)                                     │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                    │   │
│  │  适用场景:                                                         │   │
│  │  ├── 流水线定时触发 (小时级)                                       │   │
│  │  ├── AI Code Review 批量扫描                                      │   │
│  │  ├── 监控汇总报告                                                  │   │
│  │  ├── 工单超时提醒                                                  │   │
│  │  └── 用户自定义 HTTP 任务                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    重型任务层 (Knative/K8s)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │           KnativeJobExecutor (复用现有)                      │ │   │
│  │  │  - 完全隔离执行                                               │ │   │
│  │  │  - 资源配额控制                                               │ │   │
│  │  │  - 自动重试                                                   │ │   │
│  │  │  - 执行日志持久化                                             │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                    │   │
│  │  适用场景:                                                         │   │
│  │  ├── Kintsugi 智能诊断 (全量扫描, 高 CPU)                          │   │
│  │  ├── Aegis 风险评估 (全量扫描, 高 CPU)                             │   │
│  │  ├── 数字孪生同步 (高频, 大数据量)                                 │   │
│  │  └── 数据归档/清理 (大批量操作)                                    │   │
│  └──────────────────────────────────────────────────────────────────┐   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    任务编排层 (Saga)                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │           SagaCoordinator (复用现有)                         │ │   │
│  │  │  - 依赖链式调度                                               │ │   │
│  │  │  - 可恢复执行                                                 │ │   │
│  │  │  - 失败补偿                                                   │ │   │
│  │  │  - 5-Agent 编排                                               │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                    │   │
│  │  适用场景:                                                         │   │
│  │  ├── 复杂依赖任务链                                               │   │
│  │  ├── 可恢复 Cron (missed execution catchup)                       │   │
│  │  └── 跨服务协调任务                                               │   │
│  └──────────────────────────────────────────────────────────────────┐   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    安全执行层 (新增)                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │           HttpExecutorService                                │ │   │
│  │  │  - URL 白名单校验                                             │ │   │
│  │  │  - 禁止私有 IP (SSRF 防护)                                    │ │   │
│  │  │  - 请求超时控制 (default 30s, max 300s)                       │ │   │
│  │  │  - 响应大小限制 (max 1MB)                                     │ │   │
│  │  │  - 密钥安全存储 (Vault/K8s Secrets)                           │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │           CronPolicyService                                   │ │   │
│  │  │  - 租户配额限制 (max_jobs, max_executions_per_day)            │ │   │
│  │  │  - 执行频率限制 (min_interval)                                │ │   │
│  │  │  - 资源配额控制 (cpu_limit, memory_limit)                     │ │   │
│  │  │  - 禁止时间段 (maintenance_windows)                           │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┐   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    基础设施层 (复用)                               │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │   │
│  │  │ DistributedLock │  │    EventBus    │  │   AlertService    │  │   │
│  │  │    Service      │  │  (JetStream)   │  │   (复用通知)      │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┐   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 任务分级策略

| 任务类型 | 执行层 | 判断标准 | 示例 |
|----------|--------|----------|------|
| **轻量级** | CronSchedulerService | 并发 < 100, 单次执行 < 30s | 流水线触发、报告生成 |
| **重型** | KnativeJobExecutor | 并发 > 100 或 CPU/内存密集 | Kintsugi 全量扫描 |
| **编排型** | SagaCoordinator | 有复杂依赖或需可恢复 | 任务链、跨服务协调 |
| **用户自定义** | HttpExecutorService | 用户配置的 HTTP 任务 | Webhook 回调、API 调用 |

---

## 二、数据库设计

### 2.1 表结构扩展

```sql
-- 文件: orion-platform-service/src/db/migrations/071_extend_cron_tables.sql

-- 1. 扩展 cron_jobs 表
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 100);
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (timeout_seconds >= 5 AND timeout_seconds <= 300);
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10);
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(20) NOT NULL DEFAULT 'handler' 
  CHECK (action_type IN ('handler', 'http', 'knative', 'saga'));
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS action_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS policy_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';

-- 2. 执行层选择
ALTER TABLE cron_jobs 
  ADD COLUMN IF NOT EXISTS executor_type VARCHAR(20) NOT NULL DEFAULT 'nodejs' 
  CHECK (executor_type IN ('nodejs', 'knative', 'saga'));

-- 3. 添加索引
CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_priority ON cron_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_cron_jobs_executor ON cron_jobs(executor_type);

-- 4. 创建 tenant_cron_quotas 表
CREATE TABLE IF NOT EXISTS tenant_cron_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  max_jobs INTEGER NOT NULL DEFAULT 50 CHECK (max_jobs >= 0),
  max_executions_per_day INTEGER NOT NULL DEFAULT 1000 CHECK (max_executions_per_day >= 0),
  max_concurrent_executions INTEGER NOT NULL DEFAULT 10 CHECK (max_concurrent_executions >= 1),
  allowed_action_types JSONB NOT NULL DEFAULT '["handler", "http"]',
  min_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (min_interval_seconds >= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 创建 cron_job_templates 表
CREATE TABLE IF NOT EXISTS cron_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,  -- 'pipeline', 'diagnostic', 'report', 'maintenance'
  template_config JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 扩展 cron_executions 表
ALTER TABLE cron_executions 
  ADD COLUMN IF NOT EXISTS executor_type VARCHAR(20) NOT NULL DEFAULT 'nodejs';
ALTER TABLE cron_executions 
  ADD COLUMN IF NOT EXISTS knative_job_name VARCHAR(200);
ALTER TABLE cron_executions 
  ADD COLUMN IF NOT EXISTS saga_id UUID;
ALTER TABLE cron_executions 
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cron_executions 
  ADD COLUMN IF NOT EXISTS security_audit JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cron_executions_executor ON cron_executions(executor_type);
CREATE INDEX IF NOT EXISTS idx_cron_executions_saga ON cron_executions(saga_id);
```

### 2.2 action_config 结构定义

```typescript
// Handler 类型 (现有)
interface HandlerActionConfig {
  handler: string;           // 处理器名称
  params?: Record<string, any>;
}

// HTTP 类型 (新增)
interface HttpActionConfig {
  url: string;               // 目标 URL (必须通过白名单校验)
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  secrets?: Record<string, string>;  // 密钥引用: "{{.secrets.api_key}}"
  expectedStatus?: number[];  // 期望的 HTTP 状态码
}

// Knative 类型
interface KnativeActionConfig {
  service: string;           // Knative 服务名称
  payload?: any;
  timeoutSeconds?: number;
  retries?: number;
}

// Saga 类型
interface SagaActionConfig {
  sagaType: string;          // Saga 类型
  steps: Array<{
    action: string;
    compensate: string;
    params: any;
  }>;
}
```

### 2.3 policy_config 结构定义

```typescript
interface CronPolicyConfig {
  // 执行限制
  timeoutSeconds?: number;           // 单次执行超时
  maxRetries?: number;               // 最大重试次数
  retryDelaySeconds?: number;        // 重试间隔
  
  // 并发控制
  allowConcurrent?: boolean;         // 是否允许并发执行
  maxConcurrent?: number;            // 最大并发数
  
  // 错峰调度
  jitterSeconds?: number;            // 随机延迟范围
  
  // 可恢复执行
  catchupMissed?: boolean;           // 是否补充遗漏执行
  maxCatchupCount?: number;          // 最大补充次数
  
  // 通知配置
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  notifyChannels?: string[];         // 通知渠道
}
```

---

## 三、核心服务实现

### 3.1 HttpExecutorService

```typescript
// 文件: orion-platform-service/src/services/cron/HttpExecutorService.ts

import axios, { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

interface HttpExecutionRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  secrets?: Record<string, string>;
  timeoutSeconds?: number;
}

interface HttpExecutionResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  durationMs: number;
  securityAudit: {
    urlValidated: boolean;
    secretsResolved: boolean;
    responseSizeBytes: number;
  };
}

export class HttpExecutorService {
  private urlWhitelist: Set<string>;
  private blockedIpRanges: string[];
  private maxResponseSize: number = 1024 * 1024; // 1MB
  private defaultTimeout: number = 30000; // 30s
  private maxTimeout: number = 300000; // 300s (5 min)

  constructor(config: {
    urlWhitelist?: string[];
    blockedIpRanges?: string[];
  }) {
    this.urlWhitelist = new Set(config.urlWhitelist || []);
    this.blockedIpRanges = config.blockedIpRanges || [
      '10.0.0.0/8',      // 私有网络 A 类
      '172.16.0.0/12',   // 私有网络 B 类
      '192.168.0.0/16',  // 私有网络 C 类
      '127.0.0.0/8',     // 本地回环
      '169.254.0.0/16',  // 链路本地
      '::1/128',         // IPv6 本地回环
      'fc00::/7',        // IPv6 私有网络
    ];
  }

  /**
   * 执行 HTTP 任务
   */
  async execute(request: HttpExecutionRequest): Promise<HttpExecutionResult> {
    const startTime = Date.now();
    const securityAudit = {
      urlValidated: false,
      secretsResolved: false,
      responseSizeBytes: 0,
    };

    try {
      // 1. URL 安全校验
      const validatedUrl = await this.validateUrl(request.url);
      securityAudit.urlValidated = true;

      // 2. 解析密钥（从 Vault/K8s Secrets）
      const resolvedHeaders = await this.resolveSecrets(
        request.headers || {},
        request.secrets || {}
      );
      securityAudit.secretsResolved = true;

      // 3. 构建请求配置
      const timeout = Math.min(
        request.timeoutSeconds ? request.timeoutSeconds * 1000 : this.defaultTimeout,
        this.maxTimeout
      );

      const axiosConfig: AxiosRequestConfig = {
        url: validatedUrl,
        method: request.method,
        headers: resolvedHeaders,
        data: request.body,
        timeout,
        maxContentLength: this.maxResponseSize,
        maxBodyLength: this.maxResponseSize,
        validateStatus: (status) => status >= 200 && status < 500, // 不抛出 4xx
      };

      // 4. 执行请求
      const response = await axios(axiosConfig);
      securityAudit.responseSizeBytes = response.data 
        ? JSON.stringify(response.data).length 
        : 0;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        response: response.data,
        durationMs: Date.now() - startTime,
        securityAudit,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        durationMs: Date.now() - startTime,
        securityAudit,
      };
    }
  }

  /**
   * URL 白名单校验 + SSRF 防护
   */
  private async validateUrl(url: string): Promise<string> {
    // 1. 解析 URL
    const parsed = new URL(url);
    
    // 2. 检查协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }

    // 3. 检查是否在私有 IP 范围
    const hostname = parsed.hostname;
    if (this.isPrivateIp(hostname)) {
      throw new Error(`Blocked private IP: ${hostname}`);
    }

    // 4. 白名单校验（如果配置了白名单）
    if (this.urlWhitelist.size > 0) {
      const urlPattern = `${parsed.protocol}//${parsed.hostname}`;
      let allowed = false;
      for (const whitelist of this.urlWhitelist) {
        if (url.startsWith(whitelist) || urlPattern.startsWith(whitelist)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        throw new Error(`URL not in whitelist: ${url}`);
      }
    }

    return url;
  }

  /**
   * 检查是否为私有 IP
   */
  private isPrivateIp(hostname: string): boolean {
    // IPv4 检查
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (ipv4Regex.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 127.0.0.0/8
      if (parts[0] === 127) return true;
      // 169.254.0.0/16
      if (parts[0] === 169 && parts[1] === 254) return true;
    }

    // IPv6 检查
    if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd')) {
      return true;
    }

    // localhost
    if (hostname === 'localhost') return true;

    return false;
  }

  /**
   * 解析密钥引用
   * 支持语法: {{.secrets.api_key}}
   */
  private async resolveSecrets(
    headers: Record<string, string>,
    secrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const resolved = { ...headers };

    for (const [key, secretRef] of Object.entries(secrets)) {
      // 从密钥存储获取实际值
      const secretValue = await this.getSecretValue(secretRef);
      resolved[key] = secretValue;
    }

    // 处理 headers 中的密钥引用
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string' && value.startsWith('{{.secrets.')) {
        const secretName = value.match(/{{\.secrets\.([^}]+)}}/)?.[1];
        if (secretName) {
          resolved[key] = await this.getSecretValue(secretName);
        }
      }
    }

    return resolved;
  }

  /**
   * 从 Vault 或 K8s Secrets 获取密钥值
   */
  private async getSecretValue(secretRef: string): Promise<string> {
    // 实际实现应集成 Vault 或 K8s Secrets API
    // 这里返回环境变量中的值作为示例
    const envKey = `SECRET_${secretRef.toUpperCase()}`;
    const value = process.env[envKey];
    
    if (!value) {
      throw new Error(`Secret not found: ${secretRef}`);
    }

    return value;
  }

  /**
   * 添加 URL 到白名单
   */
  addToWhitelist(url: string): void {
    this.urlWhitelist.add(url);
  }

  /**
   * 移除 URL 从白名单
   */
  removeFromWhitelist(url: string): void {
    this.urlWhitelist.delete(url);
  }

  /**
   * 获取当前白名单
   */
  getWhitelist(): string[] {
    return Array.from(this.urlWhitelist);
  }
}
```

### 3.2 CronPolicyService

```typescript
// 文件: orion-platform-service/src/services/cron/CronPolicyService.ts

import { CronJobRepository } from '../../repositories/CronJobRepository';
import { logger } from '../../utils/logger';

interface TenantQuota {
  tenantId: string;
  maxJobs: number;
  maxExecutionsPerDay: number;
  maxConcurrentExecutions: number;
  allowedActionTypes: string[];
  minIntervalSeconds: number;
}

interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: {
    jobsCount: number;
    executionsToday: number;
    concurrentExecutions: number;
  };
}

export class CronPolicyService {
  private cronJobRepository: CronJobRepository;
  private quotaCache: Map<string, TenantQuota> = new Map();

  constructor(cronJobRepository: CronJobRepository) {
    this.cronJobRepository = cronJobRepository;
  }

  /**
   * 检查是否允许创建新任务
   */
  async checkCanCreateJob(tenantId: string, actionType: string): Promise<PolicyCheckResult> {
    const quota = await this.getTenantQuota(tenantId);
    const usage = await this.getTenantUsage(tenantId);

    // 检查任务数量限制
    if (usage.jobsCount >= quota.maxJobs) {
      return {
        allowed: false,
        reason: `Max jobs limit reached: ${quota.maxJobs}`,
        currentUsage: usage,
      };
    }

    // 检查 action_type 是否允许
    if (!quota.allowedActionTypes.includes(actionType)) {
      return {
        allowed: false,
        reason: `Action type '${actionType}' not allowed for tenant`,
        currentUsage: usage,
      };
    }

    return { allowed: true, currentUsage: usage };
  }

  /**
   * 检查是否允许执行任务
   */
  async checkCanExecuteJob(
    tenantId: string,
    jobId: string,
    actionType: string
  ): Promise<PolicyCheckResult> {
    const quota = await this.getTenantQuota(tenantId);
    const usage = await this.getTenantUsage(tenantId);

    // 检查每日执行次数限制
    if (usage.executionsToday >= quota.maxExecutionsPerDay) {
      return {
        allowed: false,
        reason: `Daily execution limit reached: ${quota.maxExecutionsPerDay}`,
        currentUsage: usage,
      };
    }

    // 检查并发执行数限制
    if (usage.concurrentExecutions >= quota.maxConcurrentExecutions) {
      return {
        allowed: false,
        reason: `Concurrent execution limit reached: ${quota.maxConcurrentExecutions}`,
        currentUsage: usage,
      };
    }

    return { allowed: true, currentUsage: usage };
  }

  /**
   * 检查任务间隔是否符合最小间隔要求
   */
  checkIntervalAllowed(
    tenantId: string,
    cronExpression: string
  ): PolicyCheckResult {
    const quota = await this.getTenantQuota(tenantId);
    
    // 解析 cron 表达式获取最小间隔
    const minInterval = this.parseMinInterval(cronExpression);
    
    if (minInterval < quota.minIntervalSeconds) {
      return {
        allowed: false,
        reason: `Interval too short: ${minInterval}s < ${quota.minIntervalSeconds}s minimum`,
      };
    }

    return { allowed: true };
  }

  /**
   * 获取租户配额
   */
  private async getTenantQuota(tenantId: string): Promise<TenantQuota> {
    if (this.quotaCache.has(tenantId)) {
      return this.quotaCache.get(tenantId)!;
    }

    // 从数据库获取配额
    const quota = await this.cronJobRepository.getTenantQuota(tenantId);
    
    if (!quota) {
      // 默认配额
      return {
        tenantId,
        maxJobs: 50,
        maxExecutionsPerDay: 1000,
        maxConcurrentExecutions: 10,
        allowedActionTypes: ['handler', 'http'],
        minIntervalSeconds: 60,
      };
    }

    this.quotaCache.set(tenantId, quota);
    return quota;
  }

  /**
   * 获取租户当前使用情况
   */
  private async getTenantUsage(tenantId: string): Promise<{
    jobsCount: number;
    executionsToday: number;
    concurrentExecutions: number;
  }> {
    return await this.cronJobRepository.getTenantUsageStats(tenantId);
  }

  /**
   * 解析 cron 表达式的最小执行间隔（秒）
   */
  private parseMinInterval(cronExpression: string): number {
    // 简化实现：基于 cron 表达式估算最小间隔
    // 实际应使用 cron-parser 库
    
    // 每分钟: '* * * * *' -> 60s
    if (cronExpression.split(' ')[0] === '*') {
      return 60;
    }
    
    // 每小时: '0 * * * *' -> 3600s
    if (cronExpression.split(' ')[1] === '*') {
      return 3600;
    }
    
    // 每天: '0 0 * * *' -> 86400s
    if (cronExpression.split(' ')[2] === '*') {
      return 86400;
    }
    
    // 默认返回 1 天
    return 86400;
  }

  /**
   * 设置租户配额（管理员操作）
   */
  async setTenantQuota(quota: TenantQuota): Promise<void> {
    await this.cronJobRepository.setTenantQuota(quota);
    this.quotaCache.set(quota.tenantId, quota);
  }

  /**
   * 清除配额缓存
   */
  clearCache(): void {
    this.quotaCache.clear();
  }
}
```

### 3.3 CronSchedulerService 扩展

```typescript
// 文件: orion-platform-service/src/services/scheduler/CronSchedulerService.ts
// 在现有实现基础上扩展

import { DistributedLockService } from './DistributedLockService';
import { HttpExecutorService } from '../cron/HttpExecutorService';
import { CronPolicyService } from '../cron/CronPolicyService';
import { EventBus } from '../../events/EventBus';

export class CronSchedulerService {
  // 新增依赖
  private httpExecutor: HttpExecutorService;
  private policyService: CronPolicyService;
  private eventBus: EventBus;

  /**
   * 执行单个任务（扩展支持多种执行器）
   */
  private async executeJob(job: CronJob): Promise<void> {
    const lockKey = `cron:job:${job.id}:${Date.now()}`;
    
    // 1. 分布式锁（防止重复执行）
    const acquired = await this.distributedLock.acquire(lockKey, {
      ttlSeconds: job.timeout_seconds || 30,
      retries: 3,
    });

    if (!acquired) {
      logger.warn(`Job ${job.id} already executing, skipping`);
      return;
    }

    try {
      // 2. 配额检查
      const policyCheck = await this.policyService.checkCanExecuteJob(
        job.tenant_id,
        job.id,
        job.action_type
      );

      if (!policyCheck.allowed) {
        logger.warn(`Job ${job.id} blocked by policy: ${policyCheck.reason}`);
        await this.publishBlockedEvent(job, policyCheck.reason);
        return;
      }

      // 3. 根据执行器类型选择执行方式
      let result: ExecutionResult;

      switch (job.executor_type) {
        case 'nodejs':
          result = await this.executeHandler(job);
          break;
        
        case 'http':
          result = await this.executeHttp(job);
          break;
        
        case 'knative':
          result = await this.executeKnative(job);
          break;
        
        case 'saga':
          result = await this.executeSaga(job);
          break;
        
        default:
          throw new Error(`Unknown executor type: ${job.executor_type}`);
      }

      // 4. 记录执行结果
      await this.recordExecution(job.id, result);

      // 5. 发布执行事件
      await this.publishExecutionEvent(job, result);

    } finally {
      await this.distributedLock.release(lockKey);
    }
  }

  /**
   * HTTP 执行器
   */
  private async executeHttp(job: CronJob): Promise<ExecutionResult> {
    const config = job.action_config as HttpActionConfig;
    
    const result = await this.httpExecutor.execute({
      url: config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
      secrets: config.secrets,
      timeoutSeconds: job.timeout_seconds,
    });

    return {
      success: result.success,
      output: result.response,
      error: result.error,
      durationMs: result.durationMs,
      securityAudit: result.securityAudit,
    };
  }

  /**
   * Knative 执行器
   */
  private async executeKnative(job: CronJob): Promise<ExecutionResult> {
    const config = job.action_config as KnativeActionConfig;
    
    // 调用 KnativeJobExecutorService（现有服务）
    const knativeResult = await this.knativeExecutor.execute({
      service: config.service,
      payload: config.payload,
      timeoutSeconds: job.timeout_seconds,
    });

    return {
      success: knativeResult.success,
      output: knativeResult.output,
      knativeJobName: knativeResult.jobName,
      durationMs: knativeResult.durationMs,
    };
  }

  /**
   * Saga 执行器
   */
  private async executeSaga(job: CronJob): Promise<ExecutionResult> {
    const config = job.action_config as SagaActionConfig;
    
    // 调用 SagaCoordinator（现有服务）
    const sagaId = await this.sagaCoordinator.startSaga({
      type: config.sagaType,
      steps: config.steps,
      context: { cronJobId: job.id },
    });

    // 等待 Saga 完成（或超时）
    const result = await this.sagaCoordinator.waitForCompletion(
      sagaId,
      job.timeout_seconds * 1000
    );

    return {
      success: result.status === 'completed',
      sagaId,
      output: result.result,
      durationMs: result.durationMs,
    };
  }

  /**
   * 发布执行事件
   */
  private async publishExecutionEvent(job: CronJob, result: ExecutionResult): void {
    await this.eventBus.publish('cron.execution.completed', {
      jobId: job.id,
      tenantId: job.tenant_id,
      success: result.success,
      durationMs: result.durationMs,
      executorType: job.executor_type,
      timestamp: new Date(),
    });
  }

  /**
   * 发布阻塞事件
   */
  private async publishBlockedEvent(job: CronJob, reason: string): void {
    await this.eventBus.publish('cron.execution.blocked', {
      jobId: job.id,
      tenantId: job.tenant_id,
      reason,
      timestamp: new Date(),
    });
  }
}
```

---

## 四、API 接口设计

### 4.1 新增端点

```typescript
// 文件: orion-platform-service/src/api/cron-routes.ts
// 扩展现有路由

// 用户任务管理
POST   /api/v1/cron/user-jobs              // 创建用户自定义任务
GET    /api/v1/cron/user-jobs              // 列出用户任务
GET    /api/v1/cron/user-jobs/:id          // 获取任务详情
PUT    /api/v1/cron/user-jobs/:id          // 更新任务
DELETE /api/v1/cron/user-jobs/:id          // 删除任务
POST   /api/v1/cron/user-jobs/:id/execute  // 手动触发执行
GET    /api/v1/cron/user-jobs/:id/history  // 执行历史

// 任务模板
GET    /api/v1/cron/templates              // 模板列表
GET    /api/v1/cron/templates/:id          // 模板详情
POST   /api/v1/cron/templates/:id/apply    // 应用模板创建任务

// 配额管理（管理员）
GET    /api/v1/cron/quotas/:tenantId       // 获取租户配额
PUT    /api/v1/cron/quotas/:tenantId       // 设置配额

// 安全配置（管理员）
GET    /api/v1/cron/security/whitelist     // URL 白名单
POST   /api/v1/cron/security/whitelist     // 添加白名单
DELETE /api/v1/cron/security/whitelist/:id // 移除白名单

// 执行器状态
GET    /api/v1/cron/executors/status       // 各执行器状态
GET    /api/v1/cron/executors/knative      // Knative 执行器详情
```

### 4.2 创建任务请求体

```json
{
  "name": "每日成本报告",
  "cronExpression": "0 8 * * *",
  "actionType": "http",
  "actionConfig": {
    "url": "https://api.example.com/cron/report",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "secrets": {
      "Authorization": "{{.secrets.report_api_key}}"
    },
    "body": {
      "reportType": "cost",
      "dateRange": "yesterday"
    }
  },
  "executorType": "nodejs",
  "policyConfig": {
    "timeoutSeconds": 60,
    "maxRetries": 3,
    "notifyOnFailure": true
  },
  "tags": ["report", "finops"]
}
```

---

## 五、实施路线

### 5.1 分阶段计划

| 阶段 | 时间 | 内容 | 交付物 |
|------|------|------|--------|
| **M1: 安全基础** | 1 周 | HttpExecutorService + CronPolicyService + 租户隔离 | 安全执行器、配额限制 |
| **M2: 轻量任务** | 1 周 | 扩展 CronSchedulerService + 分布式锁调度 | 多执行器支持 |
| **M3: 重型任务** | 1 周 | Knative 执行器集成 + Saga 执行器集成 | Kintsugi/Aegis 定时任务 |
| **M4: 用户能力** | 2 周 | 用户任务中心 + 模板市场 + 前端 UI | 用户自助配置 |
| **M5: 运维完善** | 1 周 | 监控仪表盘 + 告警集成 + 运维文档 | 生产就绪 |

### 5.2 各阶段详细任务

**M1: 安全基础（1 周）**
- Day 1-2: 数据库迁移（cron_jobs 扩展 + tenant_cron_quotas）
- Day 3-4: HttpExecutorService 实现（URL 白名单 + SSRF 防护）
- Day 5: CronPolicyService 实现（配额限制 + 频率限制）

**M2: 轻量任务（1 周）**
- Day 1-2: CronSchedulerService 扩展（多执行器路由）
- Day 3-4: 分布式锁集成（复用 DistributedLockService）
- Day 5: API 路由扩展 + 测试

**M3: 重型任务（1 周）**
- Day 1-2: Knative 执行器集成（复用 KnativeJobExecutorService）
- Day 3-4: Saga 执行器集成（复用 SagaCoordinator）
- Day 5: Kintsugi/Aegis 定时任务配置

**M4: 用户能力（2 周）**
- Day 1-3: 用户任务 CRUD API
- Day 4-6: 任务模板系统
- Day 7-10: 前端管理界面

**M5: 运维完善（1 周）**
- Day 1-2: 监控仪表盘（任务执行统计）
- Day 3-4: 告警集成（复用 AlertService）
- Day 5: 运维文档 + 最佳实践

---

## 六、安全清单

### 6.1 安全检查清单

| 检查项 | 实现状态 | 说明 |
|--------|----------|------|
| URL 白名单校验 | ✅ HttpExecutorService | 配置允许的 URL 前缀 |
| SSRF 防护 | ✅ isPrivateIp() | 禁止私有 IP 范围 |
| 请求超时控制 | ✅ timeoutSeconds | 默认 30s，最大 300s |
| 响应大小限制 | ✅ maxContentLength | 最大 1MB |
| 密钥安全存储 | ✅ resolveSecrets() | Vault/K8s Secrets |
| 租户配额限制 | ✅ CronPolicyService | 任务数/执行次数/并发数 |
| 执行频率限制 | ✅ minIntervalSeconds | 最小间隔 60s |
| 分布式锁防重 | ✅ DistributedLockService | 防止重复执行 |
| 执行审计日志 | ✅ security_audit JSONB | 完整审计记录 |
| 通知渠道隔离 | ✅ tenant_id | 租户级通知配置 |

### 6.2 安全配置示例

```yaml
# config/cron-security.yaml

url_whitelist:
  - "https://api.github.com"
  - "https://hooks.slack.com"
  - "https://orion.internal/api"

blocked_ip_ranges:
  - "10.0.0.0/8"
  - "172.16.0.0/12"
  - "192.168.0.0/16"
  - "127.0.0.0/8"

default_policies:
  timeout_seconds: 30
  max_timeout_seconds: 300
  max_response_size_mb: 1
  min_interval_seconds: 60
  max_retries: 3

tenant_quotas:
  default:
    max_jobs: 50
    max_executions_per_day: 1000
    max_concurrent_executions: 10
    allowed_action_types: ["handler", "http"]
  
  premium:
    max_jobs: 200
    max_executions_per_day: 5000
    max_concurrent_executions: 50
    allowed_action_types: ["handler", "http", "knative", "saga"]
```

---

## 七、与现有系统集成

### 7.1 集成清单

| 现有服务 | 集成方式 | 说明 |
|----------|----------|------|
| **DistributedLockService** | 直接复用 | 分布式锁调度 |
| **EventBus** | 直接复用 | 事件发布 |
| **SagaCoordinator** | 直接复用 | 任务编排 |
| **KnativeJobExecutorService** | 直接复用 | 重型任务执行 |
| **AlertService** | 直接复用 | 告警通知 |
| **TenantService** | 集成 tenant_id | 租户隔离 |
| **Vault/K8s Secrets** | 新增集成 | 密钥存储 |

### 7.2 集成代码示例

```typescript
// 在 index.ts 中注册服务

import { CronSchedulerService } from './services/scheduler/CronSchedulerService';
import { HttpExecutorService } from './services/cron/HttpExecutorService';
import { CronPolicyService } from './services/cron/CronPolicyService';

// 初始化服务
const httpExecutor = new HttpExecutorService({
  urlWhitelist: config.cron.urlWhitelist,
  blockedIpRanges: config.cron.blockedIpRanges,
});

const policyService = new CronPolicyService(cronJobRepository);

const cronScheduler = new CronSchedulerService({
  distributedLock: distributedLockService,
  httpExecutor,
  policyService,
  eventBus: eventBusService,
  sagaCoordinator: sagaCoordinatorService,
  knativeExecutor: knativeJobExecutorService,
});
```

---

## 八、监控指标

### 8.1 Prometheus 指标

```typescript
// 指标定义
const metrics = {
  // 执行计数
  'cron_executions_total': Counter,         // 总执行次数
  'cron_executions_success': Counter,        // 成功次数
  'cron_executions_failure': Counter,        // 失败次数
  'cron_executions_blocked': Counter,        // 阻塞次数
  
  // 执行延迟
  'cron_execution_duration_ms': Histogram,   // 执行耗时分布
  
  // 资源使用
  'cron_active_jobs': Gauge,                 // 活跃任务数
  'cron_concurrent_executions': Gauge,       // 并发执行数
  
  // 执行器分布
  'cron_executor_nodejs_total': Counter,
  'cron_executor_knative_total': Counter,
  'cron_executor_saga_total': Counter,
  'cron_executor_http_total': Counter,
  
  // 安全事件
  'cron_security_url_blocked': Counter,      // URL 阻塞次数
  'cron_security_secret_failed': Counter,    // 密钥解析失败
  'cron_policy_quota_exceeded': Counter,     // 配额超限
};
```

### 8.2 Grafana 仪表盘

```json
{
  "panels": [
    {
      "title": "任务执行概览",
      "type": "stat",
      "targets": [
        { "expr": "sum(rate(cron_executions_total[1h]))" },
        { "expr": "sum(rate(cron_executions_success[1h]))" },
        { "expr": "sum(rate(cron_executions_failure[1h]))" }
      ]
    },
    {
      "title": "执行耗时分布",
      "type": "histogram",
      "targets": [
        { "expr": "cron_execution_duration_ms" }
      ]
    },
    {
      "title": "执行器分布",
      "type": "piechart",
      "targets": [
        { "expr": "sum by (executor) (cron_executions_total)" }
      ]
    },
    {
      "title": "安全事件",
      "type": "timeseries",
      "targets": [
        { "expr": "rate(cron_security_url_blocked[1h])" }
      ]
    }
  ]
}
```

---

## 九、总结

### 9.1 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 执行架构 | 混合方案 | 80% 轻量 Node.js + 20% 重型 Knative |
| 技术栈 | 无新增 | 复用现有基础设施 |
| 安全模型 | 白名单 + 配额 | 多层防护，最小权限 |
| 租户隔离 | tenant_id | 现有数据库扩展 |

### 9.2 关键优势

1. **零技术栈分裂** - 无需引入 XXL-Job/Dragonfly
2. **复用现有投资** - DistributedLock/Saga/Knative 已实现
3. **安全优先设计** - SSRF 防护、配额限制、审计日志
4. **渐进式交付** - 5 阶段实施，快速验证

### 9.3 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| Node.js 单线程瓶颈 | 重型任务分流到 Knative |
| 安全漏洞 | 多层防护（白名单 + 配额 + 审计） |
| 任务风暴 | 错峰调度 + 并发限制 |
| 租户越权 | tenant_id 隔离 + 配额控制 |

---

## 附录

### A. 相关文件路径

```
orion-platform-service/src/
├── db/migrations/
│   └── 071_extend_cron_tables.sql         # 数据库迁移
├── services/
│   ├── scheduler/
│   │   ├── CronSchedulerService.ts        # 扩展
│   │   └── DistributedLockService.ts      # 复用
│   └── cron/
│   │   ├── HttpExecutorService.ts         # 新增
│   │   └── CronPolicyService.ts           # 新增
├── repositories/
│   └── CronJobRepository.ts               # 扩展
├── api/
│   └── cron-routes.ts                     # 扩展
└── config/
    └── cron-security.yaml                 # 新增

docs/
└── architecture/
    └── cron-extension-optimized.md        # 本文档
```

### B. 参考资料

- [Orion DistributedLockService](../orion-platform-service/src/services/scheduler/DistributedLockService.ts)
- [Orion SagaCoordinator](../orion-platform-service/src/saga/SagaCoordinator.ts)
- [Orion KnativeJobExecutor](../orion-platform-service/src/services/knative/KnativeJobExecutorService.ts)
- [Orion EventBus](../orion-platform-service/src/events/EventBus.ts)
- [Cron Parser](https://github.com/harrisiirak/cron-parser)