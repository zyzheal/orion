# Orion API 速查手册 (API Quick Reference)

> **状态**: ✅ 已完成 | **优先级**: P0 | **最后更新**: 2026-04-10

---

## 一、API 规范总览

### 1.1 基础规范

| 规范 | 值 | 文档 |
|------|-----|------|
| **API 版本** | v1, v2 | docs/cross-cutting/api/ |
| **认证方式** | JWT / X-Orion-Token | docs/services/security/认证授权与数据加密设计.md |
| **响应格式** | `{code, data, message}` | docs/cross-cutting/api/ |
| **分页策略** | cursor-based / offset-based | docs/cross-cutting/api/ |
| **错误码** | 二级分类 (模块 + 具体) | docs/cross-cutting/api/ |

### 1.2 核心服务 API

| 服务 | 基础路径 | 端口 | 文档 |
|------|---------|------|------|
| **Orion Core** | /api/v1/* | 8080 | - |
| **Pipeline** | /api/v1/pipeline/* | 8081 | - |
| **AI Service** | /api/v1/ai/* | 8082 | docs/services/ai/AI-Skill-Schema-定义.md |
| **CMDB** | /api/v1/cmdb/* | 8083 | docs/services/cmdb/CMDB 集成接口设计.md |
| **Tool Chain** | /api/v1/tool/* | 8084 | docs/adr/工具管理中心设计.md |
| **DB Audit** | /api/v1/db/* | 8090 | orion-dba/README.md |
| **Knowledge** | /api/v1/knowledge/* | 8300 | docs/services/knowledge/Orion-Knowledge 微服务改造方案.md |

---

## 二、核心 API 端点

### 2.1 认证与授权

```http
# 登录
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "mfa_code": "string"  // 可选
}

Response:
{
  "code": 200,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 7200
  }
}

# 刷新 Token
POST /api/v1/auth/refresh
Authorization: Bearer {refresh_token}

# 验证 Token
GET /api/v1/auth/verify
X-Orion-Token: {token}

# 登出
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

### 2.2 用户与权限

```http
# 获取当前用户信息
GET /api/v1/user/me

# 获取用户权限
GET /api/v1/user/permissions

# 获取用户列表
GET /api/v1/users?page=1&pageSize=20

# 创建用户
POST /api/v1/users

# 更新用户
PUT /api/v1/users/{userId}

# 删除用户
DELETE /api/v1/users/{userId}

# 获取角色列表
GET /api/v1/roles

# 创建角色
POST /api/v1/roles

# 分配权限
POST /api/v1/roles/{roleId}/permissions
```

### 2.3 流水线 API

```http
# 获取流水线列表
GET /api/v1/pipelines?page=1&pageSize=20

# 创建流水线
POST /api/v1/pipelines
{
  "name": "string",
  "repo_id": "string",
  "branch": "string",
  "stages": []
}

# 触发流水线
POST /api/v1/pipelines/{id}/run
{
  "branch": "string",
  "variables": {}
}

# 获取运行历史
GET /api/v1/pipelines/{id}/runs

# 获取运行详情
GET /api/v1/pipelineruns/{runId}

# 取消运行
POST /api/v1/pipelineruns/{runId}/cancel

# 获取日志
GET /api/v1/pipelineruns/{runId}/logs?stage=build&step=1
```

### 2.4 AI 服务 API

```http
# AI 代码审查
POST /api/v1/ai/code-review
{
  "diff": "string",
  "repo": "string",
  "pr_number": 123
}

Response:
{
  "code": 200,
  "data": {
    "summary": "总体评价",
    "issues": [],
    "approved": true,
    "comments": []
  }
}

# AI 风险评估
POST /api/v1/ai/risk-assess
{
  "pipeline_id": "string",
  "changes": []
}

# AI 测试选择
POST /api/v1/ai/test-selector
{
  "changed_files": [],
  "test_files": []
}

# AI 诊断
POST /api/v1/ai/diagnose
{
  "error_logs": "string",
  "metrics": {}
}

# 调用 AI Skill
POST /api/v1/ai/skill/{skillName}/invoke
{
  "input": {},
  "context": {}
}
```

### 2.5 CMDB API

```http
# 获取服务器列表
GET /api/v1/cmdb/servers?page=1&pageSize=20

# 获取应用列表
GET /api/v1/cmdb/applications

# 获取终端列表
GET /api/v1/cmdb/terminals

# 批量执行
POST /api/v1/cmdb/batch-execute
{
  "target_ids": [],
  "command": "string",
  "timeout": 300
}

# 获取监控指标
GET /api/v1/cmdb/servers/{id}/metrics

# 同步 K8s 资源
POST /api/v1/cmdb/k8s/sync
```

### 2.6 工具链 API

```http
# 获取工具列表
GET /api/v1/tools?page=1&pageSize=20

# 安装工具
POST /api/v1/tools/install
{
  "name": "string",
  "version": "string"
}

# 卸载工具
POST /api/v1/tools/uninstall/{toolId}

# 更新工具
POST /api/v1/tools/update/{toolId}

# 获取工具状态
GET /api/v1/tools/{toolId}/status

# 调用工具
POST /api/v1/tools/{toolId}/invoke
```

### 2.7 构建缓存 API

```http
# 获取缓存配置
GET /api/v1/build/cache-config

# 更新缓存配置
PUT /api/v1/build/cache-config

# 禁用缓存
POST /api/v1/build/cache-config/disable
{
  "scope": "global|pipeline|task",
  "reason": "string",
  "duration": "2h"
}

# 获取缓存统计
GET /api/v1/build/cache-stats?repoId={id}&timeRange=7d

# 清理缓存
POST /api/v1/build/cache/cleanup
{
  "target": "all|expired|specific",
  "older_than": "30d"
}
```

### 2.8 知识库 API

```http
# 搜索知识
GET /api/v1/knowledge/search?q=keyword&page=1

# 创建文档
POST /api/v1/knowledge/documents

# 更新文档
PUT /api/v1/knowledge/documents/{id}

# 删除文档
DELETE /api/v1/knowledge/documents/{id}

# RAG 问答
POST /api/v1/knowledge/rag/query
{
  "question": "string",
  "context": {}
}

# 知识图谱
GET /api/v1/knowledge/graph?entity=id
```

---

## 三、错误码规范

### 3.1 错误码结构

```
错误码 = 模块码 (2 位) + 具体错误码 (3 位)

示例：
- 10001: 认证模块 - Token 无效
- 20003: 流水线模块 - 运行失败
- 30002: AI 模块 - 模型不可用
```

### 3.2 常见错误码

| 错误码 | 含义 | 处理建议 |
|--------|------|---------|
| 10001 | Token 无效 | 重新登录 |
| 10002 | Token 过期 | 刷新 Token |
| 10003 | 权限不足 | 申请权限 |
| 20001 | 资源不存在 | 检查 ID |
| 20002 | 资源已存在 | 使用不同名称 |
| 20003 | 操作失败 | 查看日志 |
| 30001 | AI 服务不可用 | 稍后重试 |
| 30002 | AI 超时 | 减小输入 |
| 30003 | AI 输出无效 | 检查 Prompt |
| 40001 | 参数错误 | 检查请求体 |
| 40002 | 参数缺失 | 补充必填字段 |
| 50001 | 内部错误 | 联系管理员 |

---

## 四、分页规范

### 4.1 Offset-based 分页

```http
GET /api/v1/resources?page=1&pageSize=20

Response:
{
  "code": 200,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 4.2 Cursor-based 分页

```http
GET /api/v1/resources?cursor=abc123&limit=20

Response:
{
  "code": 200,
  "data": {
    "items": [],
    "pagination": {
      "next_cursor": "def456",
      "has_more": true
    }
  }
}
```

---

## 五、WebSocket API

### 5.1 连接认证

```javascript
// 建立连接
const ws = new WebSocket('ws://orion.internal/ws', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

// 或者使用 Token
const ws = new WebSocket('ws://orion.internal/ws?token=' + token);
```

### 5.2 消息格式

```javascript
// 订阅消息
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'pipeline:123:status'
}));

// 接收消息
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // { type: 'pipeline.status', data: {...} }
};
```

### 5.3 频道规范

| 频道 | 说明 | 示例 |
|------|------|------|
| `pipeline:{id}:status` | 流水线状态 | pipeline:123:status |
| `pipeline:{id}:log` | 流水线日志 | pipeline:123:log |
| `build:{id}:progress` | 构建进度 | build:456:progress |
| `deploy:{id}:status` | 部署状态 | deploy:789:status |
| `user:{id}:notification` | 用户通知 | user:001:notification |

---

## 六、GraphQL API

### 6.1 端点

```http
POST /api/v1/graphql
Content-Type: application/json
Authorization: Bearer {token}
```

### 6.2 查询示例

```graphql
# 查询流水线
query GetPipeline($id: ID!) {
  pipeline(id: $id) {
    id
    name
    repo {
      name
      branch
    }
    stages {
      name
      status
      tasks {
        name
        status
        logs
      }
    }
  }
}

# 查询用户权限
query GetUserPermissions {
  me {
    id
    name
    roles {
      name
      permissions {
        resource
        actions
      }
    }
  }
}

# 查询 AI 技能
query GetAISkills {
  aiSkills {
    name
    description
    version
    status
  }
}
```

---

## 七、速率限制

| 端点类型 | 限制 | 说明 |
|---------|------|------|
| 认证 API | 10 次/分钟 | 防止暴力破解 |
| 普通 API | 100 次/分钟 | 一般限制 |
| AI API | 20 次/分钟 | 成本考虑 |
| WebSocket | 1000 条/分钟 | 消息频率 |
| 文件上传 | 10 次/分钟 | 带宽考虑 |

---

## 八、参考文档

- [API 设计规范](docs/cross-cutting/api/)
- [认证授权与数据加密设计](docs/services/security/认证授权与数据加密设计.md)

---

_文档版本：v1.0 | 最后更新：2026-04-10 | 维护团队：Orion Platform Team_
