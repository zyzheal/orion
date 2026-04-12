# Orion API 设计规范

> 版本：v1.0  
> 创建日期：2026-04-10  
> 适用范围：所有 REST/GraphQL API

---

## 一、API 设计原则

### 1.1 核心原则

| 原则 | 说明 |
|------|------|
| RESTful | 资源导向，使用标准 HTTP 方法 |
| 版本化 | URL 路径包含版本号 (/api/v1/) |
| 一致性 | 命名、格式、错误处理统一 |
| 可发现 | 提供 OpenAPI/Swagger 文档 |
| 安全 | 默认认证，细粒度授权 |
| 高效 | 支持分页、过滤、字段选择 |

### 1.2 API 版本策略

```
URL 路径版本化：/api/v1/{resource}
- v1: 初始版本 (当前)
- v2: 破坏性变更时升级

Header 版本化 (可选)：
Orion-API-Version: 1.0
```

---

## 二、REST API 规范

### 2.1 标准 HTTP 方法

| 方法 | 用途 | 幂等 | 示例 |
|------|------|------|------|
| GET | 读取资源 | 是 | GET /api/v1/pipelines |
| POST | 创建资源 | 否 | POST /api/v1/pipelines |
| PUT | 替换资源 | 是 | PUT /api/v1/pipelines/{id} |
| PATCH | 部分更新 | 是 | PATCH /api/v1/pipelines/{id} |
| DELETE | 删除资源 | 是 | DELETE /api/v1/pipelines/{id} |

### 2.2 标准响应格式

**成功响应 (200/201)**:
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-04-10T09:00:00Z"
  }
}
```

**列表响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20,
      "totalPages": 5
    }
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-04-10T09:00:00Z"
  }
}
```

**错误响应**:
```json
{
  "code": 10001,
  "message": "资源不存在",
  "error": "NOT_FOUND",
  "details": {
    "resource": "pipeline",
    "id": "pl-123"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-04-10T09:00:00Z"
  }
}
```

### 2.3 HTTP 状态码映射

| HTTP 状态 | 业务场景 | code |
|----------|---------|------|
| 200 | 成功 | 0 |
| 201 | 创建成功 | 0 |
| 204 | 删除成功 (无内容) | 0 |
| 400 | 请求参数错误 | 10000 系列 |
| 401 | 未认证 | 10101 |
| 403 | 无权限 | 10103 |
| 404 | 资源不存在 | 10104 |
| 409 | 资源冲突 | 10109 |
| 422 | 验证失败 | 10122 |
| 429 | 请求限流 | 10129 |
| 500 | 服务器错误 | 20000 系列 |
| 502 | 网关错误 | 20002 |
| 503 | 服务不可用 | 20003 |
| 504 | 网关超时 | 20004 |

### 2.4 错误码定义

```yaml
# 错误码规范：XYYYY
# X: 系统类别 (1=客户端，2=服务端)
# YYYY: 具体错误编号

错误码范围:
  10000-10099: 通用错误
    - 10000: 无效请求参数
    - 10001: 资源不存在
    - 10002: 资源已存在
    - 10003: 参数必填
    - 10004: 参数格式错误
    - 10005: 参数超出范围
  
  10100-10199: 认证授权错误
    - 10101: 未认证
    - 10102: Token 过期
    - 10103: 无权限
    - 10104: 资源不存在
    - 10105: 资源已删除
  
  10200-10299: 业务错误
    - 10200: 业务规则校验失败
    - 10201: 状态不允许此操作
    - 10202: 依赖资源不存在
    - 10203: 操作超时
  
  20000-20099: 系统错误
    - 20000: 内部服务器错误
    - 20001: 数据库错误
    - 20002: 外部服务调用失败
    - 20003: 服务不可用
    - 20004: 系统繁忙
```

---

## 三、通用查询参数

### 3.1 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | integer | 1 | 页码 (从 1 开始) |
| page_size | integer | 20 | 每页数量 (最大 100) |
| cursor | string | - | 游标 (用于下一页) |

**示例**:
```
GET /api/v1/pipelines?page=1&page_size=20
GET /api/v1/pipelines?cursor=eyJpZCI6MTAwfQ==
```

### 3.2 过滤参数

| 参数 | 说明 | 示例 |
|------|------|------|
| {field} | 精确匹配 | ?status=running |
| {field}_in | 多值匹配 | ?status_in=running,success |
| {field}_ne | 不匹配 | ?status_ne=failed |
| {field}_gt | 大于 | ?created_at_gt=2026-04-01 |
| {field}_lt | 小于 | ?created_at_lt=2026-04-10 |
| {field}_contains | 包含 | ?name_contains=payment |

### 3.3 排序参数

```
GET /api/v1/pipelines?sort=-created_at,name
# - 表示降序，升序不加符号

支持字段：
- created_at
- updated_at
- name
- status
```

### 3.4 字段选择

```
GET /api/v1/pipelines?fields=id,name,status,created_at
# 只返回指定字段，减少网络传输
```

---

## 四、核心资源 API

### 4.1 流水线 (Pipeline) API

```yaml
# 流水线列表
GET /api/v1/pipelines
  参数：
    - team_id: 团队 ID
    - status: 状态过滤
    - page, page_size: 分页
  响应：PipelineList

# 创建流水线
POST /api/v1/pipelines
  请求：CreatePipelineRequest
  响应：Pipeline

# 获取流水线详情
GET /api/v1/pipelines/{pipeline_id}
  响应：Pipeline

# 更新流水线
PUT /api/v1/pipelines/{pipeline_id}
  请求：UpdatePipelineRequest
  响应：Pipeline

# 删除流水线
DELETE /api/v1/pipelines/{pipeline_id}
  响应：204 No Content

# 触发流水线运行
POST /api/v1/pipelines/{pipeline_id}/run
  请求：TriggerPipelineRequest
  响应：PipelineRun

# 获取运行历史
GET /api/v1/pipelines/{pipeline_id}/runs
  参数：
    - status: 状态过滤
    - page, page_size: 分页
  响应：PipelineRunList

# 获取运行详情
GET /api/v1/pipelines/{pipeline_id}/runs/{run_id}
  响应：PipelineRun

# 获取运行日志
GET /api/v1/pipelines/{pipeline_id}/runs/{run_id}/logs
  参数：
    - stage: Stage 名称
    - tail: 只显示末尾 N 行
  响应：LogStream (SSE)

# 停止运行
POST /api/v1/pipelines/{pipeline_id}/runs/{run_id}/stop
  请求：StopPipelineRequest
  响应：PipelineRun

# 重试运行
POST /api/v1/pipelines/{pipeline_id}/runs/{run_id}/retry
  响应：PipelineRun
```

### 4.2 审批 (Approval) API

```yaml
# 审批列表
GET /api/v1/approvals
  参数：
    - status: pending | approved | rejected
    - type: 审批类型
    - page, page_size: 分页
  响应：ApprovalList

# 获取审批详情
GET /api/v1/approvals/{approval_id}
  响应：Approval

# 审批通过
POST /api/v1/approvals/{approval_id}/approve
  请求：ApproveRequest
    - comment: 审批意见
  响应：Approval

# 审批拒绝
POST /api/v1/approvals/{approval_id}/reject
  请求：RejectRequest
    - reason: 拒绝原因
  响应：Approval

# 转交审批
POST /api/v1/approvals/{approval_id}/transfer
  请求：TransferRequest
    - to_user_id: 接收人 ID
    - reason: 转交原因
  响应：Approval

# 批量审批
POST /api/v1/approvals/batch-approve
  请求：BatchApproveRequest
    - approval_ids: []
    - comment: 审批意见
  响应：BatchApproveResponse
```

### 4.3 部署 (Deployment) API

```yaml
# 部署列表
GET /api/v1/deployments
  参数：
    - environment: 环境
    - status: 状态
    - page, page_size: 分页
  响应：DeploymentList

# 创建部署
POST /api/v1/deployments
  请求：CreateDeploymentRequest
  响应：Deployment

# 获取部署详情
GET /api/v1/deployments/{deployment_id}
  响应：Deployment

# 获取部署进度
GET /api/v1/deployments/{deployment_id}/progress
  响应：DeploymentProgress

# 暂停部署
POST /api/v1/deployments/{deployment_id}/pause
  响应：Deployment

# 恢复部署
POST /api/v1/deployments/{deployment_id}/resume
  响应：Deployment

# 回滚部署
POST /api/v1/deployments/{deployment_id}/rollback
  请求：RollbackRequest
    - target_version: 目标版本
  响应：Deployment

# 获取部署历史
GET /api/v1/deployments/{deployment_id}/history
  响应：DeploymentHistoryList
```

### 4.4 效能 (Efficiency) API

```yaml
# 效能指标
GET /api/v1/efficiency/metrics
  参数：
    - team_id: 团队 ID
    - start_date: 开始日期
    - end_date: 结束日期
  响应：EfficiencyMetrics
    - deployment_frequency: 部署频率
    - lead_time: Lead Time
    - change_failure_rate: 变更失败率
    - mttr: MTTR

# 团队对比
GET /api/v1/efficiency/team-comparison
  参数：
    - metric: 对比指标
    - period: 时间范围
  响应：TeamComparisonList

# 趋势分析
GET /api/v1/efficiency/trend
  参数：
    - metric: 指标名称
    - granularity: day | week | month
  响应：TrendData

# AI 改进建议
GET /api/v1/efficiency/suggestions
  响应：SuggestionList

# 自动周报
GET /api/v1/efficiency/weekly-report
  参数：
    - team_id: 团队 ID
    - week: 周数
  响应：WeeklyReport
```

### 4.5 工具管理 API

```yaml
# 工具列表
GET /api/v1/tools
  参数：
    - category: 分类
    - status: 状态
    - page, page_size: 分页
  响应：ToolList

# 工具详情
GET /api/v1/tools/{tool_name}
  响应：Tool

# 工具版本列表
GET /api/v1/tools/{tool_name}/versions
  响应：ToolVersionList

# 安装工具
POST /api/v1/tools/{tool_name}/install
  请求：InstallRequest
    - version: 版本号
  响应：Task

# 升级工具
POST /api/v1/tools/{tool_name}/upgrade
  请求：UpgradeRequest
    - target_version: 目标版本
  响应：Task

# 卸载工具
POST /api/v1/tools/{tool_name}/uninstall
  响应：Task

# 回滚工具
POST /api/v1/tools/{tool_name}/rollback
  请求：RollbackRequest
    - target_version: 目标版本
  响应：Task

# 获取工具健康状态
GET /api/v1/tools/{tool_name}/health
  响应：HealthStatus

# 获取工具指标
GET /api/v1/tools/{tool_name}/metrics
  响应：ToolMetrics

# 获取工具配置
GET /api/v1/tools/{tool_name}/config
  响应：ToolConfig

# 更新工具配置
PUT /api/v1/tools/{tool_name}/config
  请求：ToolConfig
  响应：ToolConfig

# 获取配置历史
GET /api/v1/tools/{tool_name}/config/history
  响应：ConfigHistoryList

# 获取工具依赖
GET /api/v1/tools/{tool_name}/dependencies
  响应：DependencyList

# 获取依赖图
GET /api/v1/tools/dependency-graph
  响应：DependencyGraph

# 工具市场列表
GET /api/v1/marketplace/tools
  响应：MarketplaceToolList

# 工具市场详情
GET /api/v1/marketplace/tools/{tool_name}
  响应：MarketplaceTool

# 评分工具
POST /api/v1/marketplace/tools/{tool_name}/rate
  请求：RateRequest
    - rating: 1-5
    - comment: 评论
  响应：RateResponse

# 评论工具
POST /api/v1/marketplace/tools/{tool_name}/review
  请求：ReviewRequest
  响应：Review
```

### 4.6 产物管理 API

```yaml
# 产物列表
GET /api/v1/artifacts
  参数：
    - type: 类型
    - status: 状态
    - page, page_size: 分页
  响应：ArtifactList

# 产物详情
GET /api/v1/artifacts/{artifact_id}
  响应：Artifact

# 提升产物版本
POST /api/v1/artifacts/{artifact_id}/promote
  请求：PromoteRequest
    - target_stage: 目标阶段
  响应：Artifact

# 获取部署记录
GET /api/v1/artifacts/{artifact_id}/deployments
  响应：DeploymentList

# 产物清理
POST /api/v1/artifacts/cleanup
  请求：CleanupRequest
    - policy: 清理策略
    - dry_run: 是否预演
  响应：CleanupResult

# 获取清理预览
GET /api/v1/artifacts/cleanup/preview
  参数：
    - policy: 清理策略
  响应：CleanupPreview
```

### 4.7 二方库管理 API

```yaml
# 二方库列表
GET /api/v1/libraries
  参数：
    - language: 语言
    - status: 状态
    - page, page_size: 分页
  响应：LibraryList

# 二方库详情
GET /api/v1/libraries/{library_id}
  响应：Library

# 获取依赖项目
GET /api/v1/libraries/{library_id}/dependents
  响应：DependentList

# 获取版本历史
GET /api/v1/libraries/{library_id}/versions
  响应：VersionList

# 创建新版本
POST /api/v1/libraries/{library_id}/versions
  请求：CreateVersionRequest
  响应：Version

# 标记废弃
POST /api/v1/libraries/{library_id}/deprecate
  请求：DeprecateRequest
    - eol_date: 停止支持日期
    - migration_guide: 迁移指南
  响应：Library

# 自动升级 PR
POST /api/v1/libraries/{library_id}/upgrade-prs
  请求：CreateUpgradePRsRequest
    - target_version: 目标版本
  响应：BatchPRResult

# 获取依赖看板
GET /api/v1/libraries/dashboard
  参数：
    - project: 项目名称
  响应：Dashboard
```

### 4.8 AI Skill 管理 API

```yaml
# Skill 列表
GET /api/v1/skills
  参数：
    - category: 分类
    - status: 状态
    - page, page_size: 分页
  响应：SkillList

# Skill 详情
GET /api/v1/skills/{skill_id}
  响应：Skill

# 创建 Skill
POST /api/v1/skills
  请求：CreateSkillRequest
  响应：Skill

# 更新 Skill
PUT /api/v1/skills/{skill_id}
  请求：UpdateSkillRequest
  响应：Skill

# 删除 Skill
DELETE /api/v1/skills/{skill_id}
  响应：204 No Content

# Skill 版本列表
GET /api/v1/skills/{skill_id}/versions
  响应：SkillVersionList

# 测试 Skill
POST /api/v1/skills/{skill_id}/test
  请求：TestSkillRequest
    - input: 测试输入
  响应：TestSkillResponse

# 执行 Skill
POST /api/v1/skills/{skill_id}/execute
  请求：ExecuteSkillRequest
    - input: 输入数据
    - config: 配置参数
  响应：ExecuteSkillResponse

# Skill 组合
POST /api/v1/skills/compose
  请求：ComposeSkillRequest
    - steps: Skill 步骤列表
  响应：ComposedSkill

# Skill 市场列表
GET /api/v1/marketplace/skills
  响应：MarketplaceSkillList

# Skill 市场详情
GET /api/v1/marketplace/skills/{skill_id}
  响应：MarketplaceSkill
```

### 4.9 通知中心 API

```yaml
# 通知列表
GET /api/v1/notifications
  参数：
    - status: unread | read
    - type: 通知类型
    - page, page_size: 分页
  响应：NotificationList

# 获取通知详情
GET /api/v1/notifications/{notification_id}
  响应：Notification

# 标记已读
POST /api/v1/notifications/{notification_id}/read
  响应：Notification

# 批量标记已读
POST /api/v1/notifications/read-all
  请求：ReadAllRequest
    - before: 在此时间之前
  响应：ReadAllResponse

# 删除通知
DELETE /api/v1/notifications/{notification_id}
  响应：204 No Content

# 通知设置
GET /api/v1/notifications/settings
  响应：NotificationSettings

# 更新通知设置
PUT /api/v1/notifications/settings
  请求：NotificationSettings
  响应：NotificationSettings

# 免打扰设置
GET /api/v1/notifications/dnd
  响应：DNDSettings

# 更新免打扰设置
PUT /api/v1/notifications/dnd
  请求：DNDSettings
  响应：DNDSettings
```

---

## 五、WebSocket API

### 5.1 连接建立

```javascript
// 建立 WebSocket 连接
const ws = new WebSocket('wss://orion.internal/ws');

// 认证
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer eyJ...'
  }));
};
```

### 5.2 订阅频道

```javascript
// 订阅频道
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'pipeline:run:pl-123',
    'stage:pl-123:build',
    'approval:user-456'
  ]
}));
```

### 5.3 消息类型

```typescript
// 流水线状态更新
interface PipelineUpdateMessage {
  type: 'pipeline_update';
  data: {
    runId: string;
    status: 'running' | 'success' | 'failed';
    stages: Stage[];
  };
}

// Stage 日志
interface StageLogMessage {
  type: 'stage_log';
  data: {
    runId: string;
    stageName: string;
    log: string;
    timestamp: string;
  };
}

// 通知
interface NotificationMessage {
  type: 'notification';
  data: {
    id: string;
    title: string;
    content: string;
    type: 'pipeline' | 'approval' | 'alert';
    timestamp: string;
  };
}

// 心跳
interface HeartbeatMessage {
  type: 'ping';
  timestamp: string;
}

interface PongMessage {
  type: 'pong';
  timestamp: string;
}
```

### 5.4 心跳机制

```
客户端 → 服务端：ping (每 30 秒)
服务端 → 客户端：pong

超时处理:
- 60 秒无心跳 → 关闭连接
- 客户端自动重连 (指数退避)
```

---

## 六、认证与授权

### 6.1 认证方式

```yaml
认证方案：Bearer Token (JWT)

请求头：
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Token 获取：
  1. SSO 登录后获取
  2. Token 有效期：24 小时
  3. 刷新 Token：7 天
```

### 6.2 权限检查

```python
# 权限装饰器示例
@require_permission("pipeline:run")
def trigger_pipeline(pipeline_id: str):
    pass

# 权限格式
权限格式："{resource}:{action}:{scope}"
示例:
  - pipeline:run
  - deployment:approve:prod
  - artifact:read:team
```

---

## 七、限流与配额

### 7.1 限流配置

```yaml
限流维度:
  - 用户级别：100 请求/分钟
  - 团队级别：1000 请求/分钟
  - IP 级别：500 请求/分钟

限流响应：
  HTTP 429 Too Many Requests
  Retry-After: 60  # 秒
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 1649587200
```

### 7.2 配额管理

```yaml
团队配额:
  - max_pipelines: 100
  - max_concurrent_runs: 10
  - max_storage: 100Gi
  - max_build_cache: 10Gi

配额响应头:
  X-Quota-Used: 50
  X-Quota-Limit: 100
  X-Quota-Reset: 2026-05-01T00:00:00Z
```

---

## 八、API 文档

### 8.1 OpenAPI 规范

```
OpenAPI 3.0 规范
文档地址：https://orion.internal/api/docs
Swagger UI: https://orion.internal/api/swagger
ReDoc: https://orion.internal/api/redoc
```

### 8.2 API 变更管理

```yaml
变更流程:
  1. 提出 RFC
  2. 技术评审
  3. 实现
  4. 文档更新
  5. 发布通知

破坏性变更:
  - 必须升级 API 版本 (v1 → v2)
  - 旧版本至少保留 90 天
  - 提前 30 天通知
```

---

_文档版本：v1.0_  
_创建日期：2026-04-10_  
_状态：草稿，待评审_

---

## 九、P0 API 规范更新（2026-04-10）

### 9.1 分页策略分离

**问题**：分页策略混用，实时数据使用 Offset 分页导致数据重复/遗漏

**修复方案**：详见 [API 分页与错误码规范](./API 分页与错误码规范.md)

**分页决策树**：
```
需要"跳页"功能？
├─ 是 → Offset 分页 (page/total/total_pages)
└─ 否 →
    ├─ 数据实时变化？→ Cursor 分页 (cursor/has_more)
    └─ 数据量>100 万？→ Cursor 分页
```

**适用场景**：
| 分页类型 | 适用场景 | 响应结构 |
|---------|---------|---------|
| Offset | 静态数据、需要总数量 | `{ page, page_size, total, total_pages, data }` |
| Cursor | 实时数据、大数据量 | `{ cursor, has_more, data }` |

### 9.2 错误码二级分类

**问题**：错误码笼统，无法快速定位问题

**修复方案**：XYYZZ 二级分类

**格式**：
```
XYYZZ
X: 系统类别 (1=通用，2=认证，3=参数，4=业务，5=系统)
YY: 一级分类
ZZ: 二级分类

示例:
30101 = 参数错误。参数缺失 (pipeline_id 必填)
30202 = 参数错误。格式错误 (时间格式无效)
40101 = 业务错误。资源不存在
50301 = 系统错误。服务不可用
```

### 9.3 N+1 查询解决方案

**问题**：列表查询产生 N+1 次数据库查询

**修复方案**：
1. **JOIN 查询**（一对一关系）
2. **批量查询/DataLoader**（一对多关系）
3. **冗余存储**（空间换时间）
4. **应用层缓存**

**示例**：
```typescript
// ❌ 错误：N+1 查询
const pipelines = await db.query('SELECT * FROM pipelines');
for (const p of pipelines) {
  p.team = await db.query('SELECT * FROM teams WHERE id = ?', [p.team_id]);
}

// ✅ 正确：批量查询
const pipelines = await db.query('SELECT * FROM pipelines');
const teamIds = pipelines.map(p => p.team_id);
const teams = await db.query('SELECT * FROM teams WHERE id IN (?)', [teamIds]);
const teamMap = new Map(teams.map(t => [t.id, t]));
pipelines.forEach(p => {
  p.team = teamMap.get(p.team_id);
});
```

---

_文档版本：v2.0（P0 修复） | 创建日期：2026-04-10 | 状态：已批准_
