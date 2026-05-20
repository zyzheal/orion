# 技能审核工作流接入低代码平台方案设计

> **版本**: v1.1 (根据评审意见更新)
> **更新日期**: 2026-05-20

## 1. 背景与目标

### 1.1 现状问题

| 问题 | 描述 | 影响 |
|------|------|------|
| 审核流程缺失 | 技能提交后无审核机制，直接变为 draft | 质量无法保证 |
| 状态流转混乱 | draft/published 手动切换，无规范流程 | 管理不规范 |
| 通知不到位 | 审核结果无通知提交者 | 用户体验差 |
| 记录缺失 | 审核历史无记录可查 | 审计困难 |

### 1.2 目标

- 将技能审核接入低代码工作流平台
- 实现：提交 → 审核 → 通知 → 完成 的完整流程
- 支持管理员审批/拒绝操作
- 记录完整的审核历史

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              前端层                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  /skills/marketplace    │  /skills/my    │  /skills/submit  │ 审核管理  │
│  (浏览安装)             │  (我的技能)     │  (提交技能)       │  /skills/admin│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API 层                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  CRUD:  GET/POST/PUT/DELETE /api/v1/skills/*                           │
│  审核:  POST /api/v1/skills/:id/submit    (提交审核)                    │
│         POST /api/v1/skills/:id/approve   (批准)                        │
│         POST /api/v1/skills/:id/reject    (拒绝)                        │
│         POST /api/v1/skills/:id/archive   (下架)                        │
│  查询:  GET  /api/v1/skills/pending-review (待审核列表)                 │
│         GET  /api/v1/skills/:id/audit     (审核历史)                    │
│         GET  /api/v1/skills/:id/review-detail (审核详情)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           业务逻辑层                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                         SkillService                                    │
│  ├── submitForReview()       → 更新状态 + 记录日志 + 触发工作流          │
│  ├── approveSkill()          → 更新状态 + 记录审核 + 触发通知            │
│  ├── rejectSkill()           → 更新状态 + 记录审核 + 触发通知            │
│  ├── archiveSkill()          → 下架技能 (published → archived)          │
│  └── onWorkflowCompleted()   ← 工作流回调处理                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           工作流层 (低代码平台)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                       WorkflowEngine                                    │
│  ┌──────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐      │
│  │  Start   │───→│  Condition │───→│Notification│───→│   End    │      │
│  │  技能提交 │    │  基础校验  │    │  通知结果  │    │   完成   │      │
│  └──────────┘    └────────────┘    └───────────┘    └──────────┘      │
│                                                                     │
│  注意: 本方案采用简化实现，审批操作通过 API 完成，不使用工作流审批节点  │
│        工作流仅用于触发通知和记录日志，确保审核历史完整性              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           通知层 (NotificationService)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  钉钉/飞书/企微/邮件 通知                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 技能状态机

```typescript
type SkillStatus = 'draft' | 'review' | 'published' | 'archived' | 'rejected';

// 状态流转图 (更新版)
draft ──[提交审核]──→ review ──[批准]──→ published
                         │
                         └──[拒绝]──→ rejected

published ──[下架]──→ archived ──[重新提交]──→ draft
```

**状态说明**:
| 状态 | 说明 | 可见性 |
|------|------|--------|
| `draft` | 草稿，只有作者可见 | 作者 |
| `review` | 待审核，管理员可见 | 管理员 |
| `published` | 已发布，市场可见 | 所有人 |
| `rejected` | 被拒绝，作者可修改后重新提交 | 作者 |
| `archived` | 已下架，只有管理员可见 | 管理员 |

### 3.2 数据库表结构

```sql
-- 技能审核历史表 (新增)
CREATE TABLE skill_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skill_packages(id),
  action VARCHAR(50) NOT NULL,  -- 'submitted', 'auto_approved', 'approved', 'rejected', 'archived', 'resubmitted'
  operator_id VARCHAR(100) NOT NULL,  -- 操作人
  operator_name VARCHAR(100),  -- 操作人名称
  comment TEXT,  -- 审批意见/拒绝原因
  workflow_instance_id VARCHAR(100),  -- 工作流实例ID
  created_at TIMESTAMP DEFAULT NOW()
);

-- 添加索引 (修复评审问题 6)
CREATE INDEX idx_skill_audit_logs_skill_id ON skill_audit_logs(skill_id);
CREATE INDEX idx_skill_audit_logs_created_at ON skill_audit_logs(created_at);
CREATE INDEX idx_skill_audit_logs_action ON skill_audit_logs(action);

-- 技能关联表 (新增，用于记录安装用户)
CREATE TABLE user_skill_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  skill_id UUID NOT NULL REFERENCES skill_packages(id),
  installed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_user_skill_installs_user ON user_skill_installs(user_id);
CREATE INDEX idx_user_skill_installs_skill ON user_skill_installs(skill_id);
```

### 3.3 技能 API 类型增强

```typescript
// api/skills.ts 新增类型

export interface SkillAuditLog {
  id: string;
  skillId: string;
  action: 'submitted' | 'auto_approved' | 'approved' | 'rejected' | 'archived' | 'resubmitted';
  operatorId: string;
  operatorName?: string;
  comment?: string;
  workflowInstanceId?: string;
  createdAt: string;
}

export interface SubmitReviewInput {
  submitterId: string;
  submitterName?: string;
}

export interface ApproveSkillInput {
  comment?: string;
}

export interface RejectSkillInput {
  reason: string;
  comment?: string;
}

export interface ArchiveSkillInput {
  reason: string;
  comment?: string;
}

export interface SkillReviewDetail extends SkillPackage {
  submitter?: string;
  submittedAt?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  auditLogs?: SkillAuditLog[];
}

export interface PaginatedSkills {
  items: SkillPackage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## 4. API 设计

### 4.1 接口清单

| 方法 | 路径 | 描述 | 权限 | 状态 |
|------|------|------|------|------|
| POST | `/api/v1/skills/:id/submit` | 提交审核 | 技能作者 | 新增 |
| POST | `/api/v1/skills/:id/approve` | 批准技能 | 管理员 | 新增 |
| POST | `/api/v1/skills/:id/reject` | 拒绝技能 | 管理员 | 新增 |
| POST | `/api/v1/skills/:id/archive` | 下架技能 | 管理员 | 新增 |
| GET | `/api/v1/skills/pending-review` | 待审核列表 | 管理员 | 新增 |
| GET | `/api/v1/skills/audit-logs` | 审核历史列表 | 管理员 | 新增 |
| GET | `/api/v1/skills/:id/audit` | 技能审核历史 | 作者/管理员 | 新增 (修复权限) |
| GET | `/api/v1/skills/:id/review-detail` | 审核详情 | 管理员 | 新增 |

### 4.2 接口详细设计

#### 4.2.1 提交审核

```
POST /api/v1/skills/:id/submit

Request:
{
  "submitterId": "user-123",
  "submitterName": "张三"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "skill-uuid",
    "status": "review",
    "submittedAt": "2026-05-20T10:00:00Z"
  }
}

Error:
- 404: 技能不存在
- 403: 无权限（非作者）
- 400: 状态不允许（只能在 draft 状态提交）

Logic:
1. 校验技能状态为 draft
2. 校验必填字段 (name, version, category, description)
3. 更新状态为 review
4. 写入 audit log (action: 'submitted')
5. 触发工作流 (用于通知)
```

#### 4.2.2 批准技能

```
POST /api/v1/skills/:id/approve

Request:
{
  "comment": "技能符合规范，批准发布"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "skill-uuid",
    "status": "published",
    "approvedAt": "2026-05-20T10:30:00Z"
  }
}

Logic:
1. 校验技能状态为 review
2. 更新状态为 published
3. 写入 audit log (action: 'approved')
4. 触发通知 (技能已发布)
```

#### 4.2.3 拒绝技能

```
POST /api/v1/skills/:id/reject

Request:
{
  "reason": "描述不规范",
  "comment": "请完善技能描述后重新提交"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "skill-uuid",
    "status": "rejected"
  }
}

Logic:
1. 校验技能状态为 review
2. 更新状态为 rejected
3. 写入 audit log (action: 'rejected')
4. 触发通知 (审核未通过)
```

#### 4.2.4 下架技能

```
POST /api/v1/skills/:id/archive

Request:
{
  "reason": "存在安全问题",
  "comment": "请尽快修复后重新提交"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "skill-uuid",
    "status": "archived"
  }
}

Note: 新增功能，修复评审问题 8
```

#### 4.2.5 待审核列表 (带分页)

```
GET /api/v1/skills/pending-review

Query Parameters:
- page: number (default: 1)
- pageSize: number (default: 20, max: 100)
- category: string (optional)
- search: string (optional)

Response (200):
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "skill-uuid",
        "name": "K8s 健康检查",
        "version": "1.0.0",
        "category": "security",
        "author": "张三",
        "submittedAt": "2026-05-20T10:00:00Z"
      }
    ],
    "total": 28,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

#### 4.2.6 审核历史 (修复权限)

```
GET /api/v1/skills/:id/audit

Auth: 技能作者 或 管理员

Response (200):
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "log-uuid",
        "action": "submitted",
        "operatorId": "user-123",
        "operatorName": "张三",
        "comment": null,
        "createdAt": "2026-05-20T10:00:00Z"
      },
      {
        "id": "log-uuid",
        "action": "approved",
        "operatorId": "admin-001",
        "operatorName": "管理员A",
        "comment": "技能符合规范",
        "createdAt": "2026-05-20T10:30:00Z"
      }
    ]
  }
}
```

---

## 5. 工作流设计

### 5.1 设计决策

**采用简化方案 B**：手动 API 审批，不使用工作流审批节点

**原因**：
1. 工作流审批节点需要额外的前端集成
2. 简化实现更易维护
3. 仍保留工作流用于通知和日志记录

### 5.2 技能审核工作流

```yaml
# 技能审核工作流 (skill-review-workflow)
id: skill-review-workflow
name: 技能审核流程
version: 1
enabled: true

nodes:
  - id: start
    type: start
    name: 技能提交
    config:
      triggerType: api

  - id: validate
    type: condition
    name: 基础校验
    config:
      expression: "${skill.category != null && skill.version != null && skill.description != null}"
      # 修复评审问题 4: 即使自动通过也记录日志

  - id: log-submit
    type: webhook
    name: 记录提交日志
    config:
      url: /api/v1/skills/${skillId}/audit
      method: POST
      body:
        action: submitted
        operatorId: ${submitterId}

  - id: notify-submit
    type: notification
    name: 通知管理员
    config:
      channels: [dingtalk]
      template: skill-submitted
      receivers:
        - type: role
          value: skill-admin

  - id: end
    type: end
    name: 完成

edges:
  - from: start
    to: validate
  - from: validate
    to: log-submit
  - from: log-submit
    to: notify-submit
  - from: notify-submit
    to: end
```

**说明**：
- 工作流仅用于记录日志和发送通知
- 审批操作通过 API 完成
- 修复评审问题 4：自动通过也会通过 webhook 记录 audit log

---

## 6. 前端页面设计

### 6.1 路由结构

```
/skills
├── marketplace        (现有) 技能市场
├── my                 (现有) 我的技能
├── submit             (现有) 技能提交
└── admin              (新增) 审核管理
    ├── /skills/admin/pending        待审核列表
    ├── /skills/admin/history        审核历史
    └── /skills/admin/detail/:id     审核详情
```

### 6.2 权限控制

| 路由 | 权限要求 |
|------|---------|
| `/skills/marketplace` | 登录用户 |
| `/skills/my` | 登录用户 |
| `/skills/submit` | 登录用户 |
| `/skills/admin/*` | 管理员 (skill-admin 角色) |

### 6.3 页面设计 (同前版)

待审核列表、审核详情、审核历史页面设计保持不变。

---

## 7. 实现计划

### Phase 1: 基础功能 (API + 后端)

| 任务 | 文件 | 描述 |
|------|------|------|
| 1.1 修复 API 响应解包 | `frontend/src/api/skills.ts` | 统一响应格式 |
| 1.2 添加审核类型定义 | `frontend/src/api/skills.ts` | 新增类型 |
| 1.3 后端添加审核 API | `skill-routes.ts` | submit/approve/reject/archive |
| 1.4 状态校验逻辑 | `SkillService.ts` | 状态流转校验 + 修复 archived/rejected 歧义 |
| 1.5 审核历史记录 | `SkillService.ts` | 写入 audit logs (修复自动通过无记录) |
| 1.6 数据库索引 | 新增 migration | 添加必要索引 |

### Phase 2: 工作流集成

| 任务 | 文件 | 描述 |
|------|------|------|
| 2.1 工作流触发 | `SkillService.submitForReview()` | 调用 WorkflowEngine |
| 2.2 工作流回调 | `SkillService.onWorkflowCompleted()` | 处理结果 |
| 2.3 工作流定义 | 配置文件 | skill-review-workflow |
| 2.4 通知集成 | `NotificationService` | 审核结果通知 |

### Phase 3: 前端实现

| 任务 | 文件 | 描述 |
|------|------|------|
| 3.1 API 调用 | `frontend/src/api/skills.ts` | 审核 API + 响应解包 |
| 3.2 审核列表页 | `pages/SkillManagement/admin/PendingReviews.tsx` | 待审核列表 |
| 3.3 审核详情页 | `pages/SkillManagement/admin/ReviewDetail.tsx` | 审核操作 |
| 3.4 审核历史页 | `pages/SkillManagement/admin/AuditHistory.tsx` | 历史记录 |
| 3.5 路由配置 | `router/routes.tsx` | /skills/admin + 权限守卫 |

### Phase 4: 优化

| 任务 | 描述 |
|------|------|
| 4.1 校验增强 | 提交时的格式校验 (version semver) |
| 4.2 权限控制 | 区分普通用户/管理员 + 路由守卫 |
| 4.3 通知模板 | 定制通知内容 |
| 4.4 乐观锁 | 审核操作添加 version 字段防止并发 |

---

## 8. 风险与缓解 (更新)

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 工作流集成复杂度 | 调试困难 | ✅ 采用简化方案，审批通过 API 完成 |
| 循环依赖 | SkillService ↔ WorkflowEngine | 通过事件/回调解耦 |
| 通知失败 | 用户收不到消息 | 记录重试日志 |
| 并发审核 | 多人同时审核同一技能 | ✅ 乐观锁 + 状态校验 |
| 状态歧义 | archived/rejected 混淆 | ✅ 统一使用 rejected，下架用 archived |

---

## 9. 验收标准

- [ ] 技能提交后可查看待审核列表 (带分页)
- [ ] 管理员可批准/拒绝技能
- [ ] 管理员可下架已发布技能
- [ ] 审核结果通知到提交者
- [ ] 审核历史完整记录 (包括自动通过)
- [ ] 审核历史权限控制 (作者/管理员)
- [ ] 前端页面交互流畅
- [ ] 数据库查询有适当索引

---

## 10. 附录：API 路径对照表

| 评审问题 | 原设计 | 更新后 |
|----------|--------|--------|
| 问题 1 | `/v1/skills/*` | `/api/v1/skills/*` (统一) |
| 问题 3 | archived/rejected 混用 | 明确: rejected=拒绝, archived=下架 |
| 问题 4 | 自动通过无记录 | 写入 audit log (action: 'auto_approved') |
| 问题 5 | 审核历史公开 | 改为作者/管理员可见 |
| 问题 6 | 缺少索引 | 添加 skill_id, created_at 等索引 |
| 问题 8 | 缺少下架功能 | 新增 archiveSkill API |