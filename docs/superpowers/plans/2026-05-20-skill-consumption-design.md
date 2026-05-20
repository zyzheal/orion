# 技能消费与使用场景设计方案

> 本文档补充技能安装后的使用场景、入口设计和交互流程
> **版本**: v2.1 (修复评审问题)
> **更新说明**: 复用现有组件，消除冗余设计

---

## 1. 核心设计原则

| 原则 | 说明 |
|------|------|
| **复用优先** | 技能消费复 Pipeline TaskRunner，执行日志复用 task_executions |
| **标准权限** | 对接现有 RBAC (requirePermission) |
| **统一通知** | 复用 NotificationService |
| **事件驱动** | 复用 EventBus |
| **数据一致** | 执行日志复用现有 task_executions 表 |

---

## 2. 数据模型设计 (v2.1 修复)

### 2.1 技能表扩展 (对齐现有模型)

```sql
-- 技能表扩展 - 新增字段
ALTER TABLE skill_packages 
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]',  -- 技能能力数组
ADD COLUMN IF NOT EXISTS schemas JSONB DEFAULT '[]',        -- 消费配置 JSON
ADD COLUMN IF NOT EXISTS is_version_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS version_locked_at TIMESTAMP;

-- 技能实例表 (新增 - 复用 Pipeline config 模式)
CREATE TABLE skill_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
  tenant_id VARCHAR(100) NOT NULL,
  project_id VARCHAR(100),
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(skill_id, tenant_id, project_id, name)
);

CREATE INDEX idx_skill_instances_tenant ON skill_instances(tenant_id);
CREATE INDEX idx_skill_instances_skill ON skill_instances(skill_id);

-- 技能版本历史表 (新增)
CREATE TABLE skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  schema_snapshot JSONB,  -- 当时版本的 schema 快照
  is_locked BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(skill_id, version)
);

-- 注意: 执行日志复用现有 task_executions 表，不再新建
```

### 2.2 TypeScript 类型定义

```typescript
// 技能能力类型
type SkillCapability = 
  | 'CUSTOM_TASK'
  | 'WEBHOOK_HANDLER'
  | 'AI_SKILL'
  | 'NOTIFICATION_CHANNEL'
  | 'APPROVAL_PROVIDER'
  | 'DEPLOYMENT_STRATEGY'
  | 'SECURITY_SCANNER'
  | 'CODE_ANALYZER'
  | 'TEST_RUNNER';

// 技能元数据 (扩展现有模型)
interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  
  // v2.1 新增字段
  capabilities: SkillCapability[];       // 能力列表
  schemas: SkillSchemaForConsumer[];     // 消费配置
  isVersionLocked: boolean;              // 版本锁定
  
  installCount: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

// 消费配置 (每个能力对应一个 schema)
interface SkillSchemaForConsumer {
  consumer: SkillCapability;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  ui?: {
    icon?: string;
    color?: string;
    description?: string;
  };
  runtime: {
    taskType: string;  // 对应 Pipeline task type
    docker?: { image: string; command?: string; resources?: {...} };
    script?: { interpreter: string; content?: string };
    api?: { endpoint: string; method: string };
    builtin?: { service: string; action: string };
    timeout?: number;
    retryPolicy?: { maxRetries: number; backoffMs: number };
  };
}

// 技能实例 (复用 Pipeline config 模式)
interface SkillInstance {
  id: string;
  skillId: string;
  tenantId: string;
  projectId?: string;
  name: string;
  config: Record<string, any>;  // 实际配置参数
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Pipeline 集成设计 (v2.1 修复)

### 3.1 TaskRunner 扩展

```typescript
// 扩展 TaskRunner - 新增技能任务处理
// 文件: services/pipeline/TaskRunner.ts

// 新增任务类型常量
const TASK_TYPE_SKILL = 'skill';

class TaskRunner {
  // v2.1: 技能任务执行入口
  async executeSkillTask(task: SkillTaskDefinition, context: TaskContext): Promise<TaskResult> {
    const { skillId, skillVersion, instanceId, input, runtime } = task;
    
    // 1. 获取技能信息
    const skill = await this.skillService.getSkill(skillId);
    
    // 2. 版本校验
    if (skill.isVersionLocked && skillVersion !== skill.version) {
      throw new Error(`技能版本已锁定至 ${skill.version}`);
    }
    
    // 3. 获取实例配置（合并输入）
    let config = input;
    if (instanceId) {
      const instance = await this.skillService.getInstance(instanceId);
      config = { ...instance.config, ...input };
    }
    
    // 4. 获取对应能力 schema
    const schema = skill.schemas.find(s => s.consumer === task.capability);
    if (!schema?.runtime) {
      throw new Error(`技能未配置 ${task.capability} 能力`);
    }
    
    // 5. 执行 (复用现有执行器)
    return this.executeByRuntime(schema.runtime, config, context);
  }
  
  // 运行时分发 - 复用现有方法
  private async executeByRuntime(
    runtime: SkillRuntimeConfig, 
    input: Record<string, any>, 
    context: TaskContext
  ): Promise<TaskResult> {
    // Docker: 复用现有 docker executor
    if (runtime.docker) {
      return this.executeDockerTask({
        image: runtime.docker.image,
        command: runtime.docker.command,
        env: runtime.docker.env,
        resources: runtime.docker.resources,
        input,
        timeout: runtime.timeout,
        retry: runtime.retryPolicy,
      }, context);
    }
    
    // Script: 复用现有 script executor  
    if (runtime.script) {
      return this.executeScriptTask({
        script: runtime.script.content,
        interpreter: runtime.script.interpreter,
        input,
        timeout: runtime.timeout,
      }, context);
    }
    
    // API: 复用现有 http executor
    if (runtime.api) {
      return this.executeHttpTask({
        url: runtime.api.endpoint,
        method: runtime.api.method,
        input,
      }, context);
    }
    
    // Builtin: 调用内置服务
    if (runtime.builtin) {
      return this.executeBuiltinTask(runtime.builtin, input, context);
    }
    
    throw new Error('未配置的运行时类型');
  }
}
```

### 3.2 执行日志复用 (v2.1 修复)

**关键决策**: 技能执行日志**复用现有 task_executions 表**，不新建表

```typescript
// 技能通过 Pipeline 执行时
// 复用 task_executions 表记录日志

interface TaskExecutionRecord {
  id: string;
  run_id: string;              // Pipeline Run ID
  task_id: string;              // Pipeline Task ID
  task_type: 'skill';           // 标记为技能任务
  task_name: string;
  
  // 技能特定信息 (JSON 存储)
  skill_id: string;
  skill_name: string;
  skill_version: string;
  instance_id?: string;
  
  // 执行信息 (复用现有字段)
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: {...};                 // 技能输入参数
  output: {...};                // 技能输出结果
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
}

// 查询技能执行日志 (复用 Pipeline API)
GET /api/v1/pipelines/:runId/tasks?task_type=skill

// 或独立查询
GET /api/v1/skills/executions?task_type=skill&tenantId=xxx
```

---

## 4. API 设计 (v2.1 修复)

### 4.1 技能管理 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/skills` | 获取技能列表 | skill:read |
| GET | `/api/v1/skills/:id` | 获取技能详情 | skill:read |
| POST | `/api/v1/skills` | 创建技能 | skill:write |
| PUT | `/api/v1/skills/:id` | 更新技能 | skill:write |
| DELETE | `/api/v1/skills/:id` | 删除技能 | skill:admin |
| POST | `/api/v1/skills/:id/publish` | 发布技能 | skill:admin |

### 4.2 技能实例 API (新增)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/skills/:id/instances` | 获取实例列表 | skill:use |
| POST | `/api/v1/skills/:id/instances` | 创建实例 | skill:config |
| PUT | `/api/v1/skills/:id/instances/:instanceId` | 更新实例 | skill:config |
| DELETE | `/api/v1/skills/:id/instances/:instanceId` | 删除实例 | skill:config |

### 4.3 技能执行 API (新增 - 非 Pipeline 场景)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/skills/:id/execute` | 直接执行技能 | skill:use |
| GET | `/api/v1/skills/:id/executions` | 执行历史 | skill:use |
| GET | `/api/v1/skills/executions` | 全量执行历史 | skill:admin |

**直接执行 API 说明**:
```typescript
// 直接执行 (非 Pipeline 场景: Webhook 触发、AI Skill 调用)
POST /api/v1/skills/:id/execute

Request:
{
  "tenantId": "tenant-123",
  "projectId": "project-456",
  "userId": "user-789",
  "capability": "WEBHOOK_HANDLER",  // 消费场景
  "instanceId": "instance-uuid",     // 可选
  "input": { /* 技能参数 */ },
  "options": {
    "sync": true,
    "timeout": 300
  }
}

Response:
{
  "success": true,
  "data": {
    "executionId": "exec-uuid",
    "status": "completed",
    "output": { /* 执行结果 */ },
    "duration": 45
  }
}
```

---

## 5. 权限模型 (v2.1 修复)

### 5.1 权限定义

```typescript
const SkillPermissions = {
  // 读取
  READ: { resource: 'skill', action: 'read' },
  
  // 写入 (创建/更新技能)
  WRITE: { resource: 'skill', action: 'write' },
  
  // 使用 (执行技能 - 包含安装后使用)
  USE: { resource: 'skill', action: 'use' },
  
  // 安装 (技能市场安装到我的技能)
  INSTALL: { resource: 'skill', action: 'install' },
  
  // 配置 (管理实例)
  CONFIG: { resource: 'skill', action: 'config' },
  
  // 管理 (删除/发布/锁定)
  ADMIN: { resource: 'skill', action: 'admin' },
};
```

### 5.2 权限矩阵

| 操作 | 普通用户 | 技能作者 | 审核人员 | 管理员 |
|------|---------|---------|---------|--------|
| 浏览市场 | ✅ | ✅ | ✅ | ✅ |
| 安装技能 | ❌ | ✅ | ✅ | ✅ |
| 使用技能 | ✅ | ✅ | ✅ | ✅ |
| 创建技能 | ❌ | ✅ | ❌ | ✅ |
| 管理实例 | ❌ | ✅(自己的) | ✅ | ✅ |
| 发布/下架 | ❌ | ❌ | ✅ | ✅ |
| 锁定版本 | ❌ | ❌ | ❌ | ✅ |

### 5.3 路由守卫

```typescript
const skillRoutePermissions = {
  '/skills/marketplace': [SkillPermissions.READ],
  '/skills/my': [SkillPermissions.READ, SkillPermissions.INSTALL],
  '/skills/submit': [SkillPermissions.WRITE],
  '/skills/use/*': [SkillPermissions.USE],
  '/skills/:id/instances': [SkillPermissions.CONFIG],  // 自己的或管理员
  '/skills/admin/*': [SkillPermissions.ADMIN],
};
```

---

## 6. 通知集成 (v2.1 修复)

### 6.1 事件订阅设计

```typescript
// 在 orion-notify-svc 中订阅事件 (建议位置)
class SkillEventSubscriber {
  constructor(
    private notificationService: NotificationService,
    private eventBus: EventBus
  ) {}
  
  async subscribe() {
    // 订阅技能执行完成事件
    await this.eventBus.subscribe('skill.execution.completed', async (event) => {
      const { skillName, status, userId, tenantId, output } = event.data;
      
      // 发送应用内通知
      await this.notificationService.send({
        tenantId,
        userId,
        type: 'skill_execution',
        title: `技能执行${status === 'completed' ? '成功' : '失败'}`,
        content: `${skillName} 执行${status === 'completed' ? '完成' : '失败'}`,
        data: event.data,
      });
      
      // 检查用户通知配置，发送多渠道通知
      if (user.prefersDingtalk) {
        await this.sendDingtalkNotification(user, event.data);
      }
    });
  }
}
```

---

## 7. 实现计划 (v2.1 更新)

### Phase 1: 数据模型

| 任务 | 说明 |
|------|------|
| 1.1 数据库迁移 | 添加 capabilities, schemas 字段，新建 skill_instances 表 |
| 1.2 扩展 SkillRepository | 添加实例 CRUD |
| 1.3 扩展 SkillService | 添加实例管理逻辑 |

### Phase 2: Pipeline 集成

| 任务 | 说明 |
|------|------|
| 2.1 扩展 TaskRunner | 新增 executeSkillTask 方法 |
| 2.2 技能选择器 | Pipeline 任务配置组件 |
| 2.3 执行日志 | 复用 task_executions |

### Phase 3: API 与权限

| 任务 | 说明 |
|------|------|
| 3.1 实例 API | /instances CRUD |
| 3.2 执行 API | /execute 直接执行 |
| 3.3 权限对接 | requirePermission |

### Phase 4: 消费入口

| 任务 | 说明 |
|------|------|
| 4.1 统一入口 | /skills/use 路由 |
| 4.2 技能选择器 | 9 个消费场景 |
| 4.3 实例管理 UI | 创建/编辑/删除 |

---

## 8. 验收标准 (v2.1)

- [ ] 技能执行日志复用 task_executions 表
- [ ] 技能实例支持租户/项目隔离
- [ ] Pipeline 可选择技能作为任务类型
- [ ] 非 Pipeline 场景可直接执行技能
- [ ] 权限正确区分安装/使用/管理
- [ ] 执行完成触发通知

---

## 9. 附录：评审问题修复对照

| 评审问题 | 原设计 | 更新后 |
|----------|--------|--------|
| 问题1: 数据模型缺失 | 新建表 | 扩展现有表 + 新建实例表 |
| 问题2: 执行日志冗余 | 新建 skill_execution_logs | **复用 task_executions** |
| 问题3: TaskRunner 细节 | 描述不足 | 新增 executeSkillTask 方法 |
| 问题4: 权限区分 | 简单矩阵 | 区分 INSTALL/USE/CONFIG |
| 问题5: 执行 API 缺失 | 只通过 Pipeline | 新增 /execute 直接执行 |
| 问题6: 通知位置 | 描述模糊 | 明确在 notify-svc 订阅 |