# F402 - CMDB 集成接口实现进度

## 实现时间
2026-04-12

## 实现状态
✅ 完成

## 实现内容

### 1. CMDB 集成服务 (`src/services/cmdb-integration-service.ts`)

**Read API 实现**:
- `listHosts()`: 获取主机列表（从 CMDB 查询 SERVER 类型 CI）
- `getHost()`: 获取主机详情
- `listK8sResources()`: 获取 K8s 资源列表（Cluster/Deployment/Pod）
- `listCICDResources()`: 获取 CI/CD 资源列表（Pipeline）
- `getTopology()`: 获取拓扑图（节点 + 边）

**K8s 同步双机制**:
- `startK8sSync()`: 启动 K8s 同步
  - 立即执行一次全量同步
  - 启动 Watch（模拟实现）
  - 启动定时对账（默认 5 分钟）
- `stopK8sSync()`: 停止 K8s 同步
- `fullReconciliation()`: 全量对账
- `startK8sWatch()`: K8s Watch 监听

**脚本执行能力**:
- `executeScript()`: 执行脚本
  - 支持 bash/python/powershell
  - 支持参数替换
  - 超时控制
- `executeScriptOnCI()`: 在单个 CI 上执行脚本

### 2. CMDB 集成控制器 (`src/api/controllers/CmdbIntegrationController.ts`)

**API 端点**:
- `listHosts()`: GET /api/v1/cmdb/hosts
- `getHost()`: GET /api/v1/cmdb/hosts/:ciId
- `listK8sResources()`: GET /api/v1/cmdb/k8s
- `listCICDResources()`: GET /api/v1/cmdb/cicd
- `getTopology()`: GET /api/v1/cmdb/topology
- `startK8sSync()`: POST /api/v1/cmdb/k8s/sync/start
- `stopK8sSync()`: POST /api/v1/cmdb/k8s/sync/stop
- `executeScript()`: POST /api/v1/cmdb/execute

### 3. 路由集成 (`src/routes-cmdb.ts`)

**新增路由**:
- /hosts - 主机 Read API
- /k8s - K8s Read API
- /cicd - CI/CD Read API
- /topology - 拓扑 API
- /k8s/sync/* - K8s 同步 API
- /execute - 脚本执行 API

### 4. 验证器增强 (`src/api/validators/schemas.ts`)

**新增函数**:
- `validateTenantId(req)`: 从 x-orion-tenant-id header 验证并解析 tenantId
- `validateUserId(req)`: 从 x-orion-user-id header 获取 userId

### 5. 路由注册 (`src/api/routes.ts`)

**更新内容**:
- 将 CMDB 路由集成到主 API 路由器
- EventBusService 适配器转换

## 测试结果

```
Test Suites: 2 passed (CmdbController, CmdbService)
Tests:       39 passed
```

## 数据类型定义

### HostResource
```typescript
interface HostResource {
  hostname: string;
  ip: string;
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  status: 'online' | 'offline' | 'unknown';
  tags?: string[];
}
```

### K8sResource
```typescript
interface K8sResource {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: Record<string, any>;
  status?: Record<string, any>;
}
```

### TopologyResponse
```typescript
interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}
```

### ScriptExecutionRequest
```typescript
interface ScriptExecutionRequest {
  targetCiIds: string[];
  script: string;
  scriptType: 'bash' | 'python' | 'powershell';
  timeout?: number;
  parameters?: Record<string, string>;
}
```

## K8s 同步机制详解

### Watch 机制
```typescript
// 实际场景中：
// 1. 连接 K8s API Server 的 Watch 端点
// 2. 监听资源变更事件（ADDED/MODIFIED/DELETED）
// 3. 实时同步到 CMDB
```

### 定时对账机制
```typescript
// 每 5 分钟执行一次：
// 1. 从 K8s 获取当前资源列表
// 2. 与 CMDB 中的资源对比
// 3. 创建不存在的 CI
// 4. 更新已变更的 CI
// 5. 软删除不存在的 CI
```

## 事件发布

### K8s 对账完成事件
```typescript
{
  type: 'cmdb.k8s.reconciliation.completed',
  data: {
    tenantId: string,
    reconciledAt: string
  }
}
```

### 脚本执行完成事件
```typescript
{
  type: 'cmdb.script.executed',
  data: ScriptExecutionResult
}
```

## 后续工作

- 实现真实的 K8s API Server 连接（当前为模拟）
- 实现真实的脚本执行（当前为模拟）
- 添加脚本执行结果存储
- 添加 K8s 同步状态持久化
