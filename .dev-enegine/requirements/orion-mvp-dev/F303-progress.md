# F303 - Plugin SPI 接口实现进度

## 实现时间
2026-04-12

## 实现状态
✅ 完成

## 实现内容

### 1. Protobuf 接口定义

#### task.proto (`proto/task.proto`)
定义 Custom Task Plugin 的 gRPC 接口：
- `GetMetadata()`: 获取插件元数据
- `ExecuteTask()`: 执行任务
- `StreamLogs()`: 流式输出日志

#### lifecycle.proto (`proto/lifecycle.proto`)
定义插件生命周期管理接口：
- `ListAvailablePlugins()`: 列出可用插件
- `InstallPlugin()`: 安装插件
- `UninstallPlugin()`: 卸载插件
- `ActivatePlugin()`: 激活插件
- `DeactivatePlugin()`: 停用插件
- `ConfigurePlugin()`: 配置插件
- `GetPluginDetails()`: 获取插件详情
- `ListInstalledPlugins()`: 列出已安装插件

### 2. 核心服务

#### PluginManagerService (`src/services/plugin-manager-service.ts`)
插件生命周期管理服务：
- 插件注册表管理
- 插件状态机（AVAILABLE → DOWNLOADED → INSTALLED → ACTIVE → CONFIGURED → INACTIVE → UNINSTALLED）
- 运行时管理（根据安全等级选择 WASM/容器/进程运行时）
- 配置验证
- 事件发布

#### PluginExecutorService (`src/services/plugin-executor-service.ts`)
插件任务执行服务：
- 根据插件安全等级选择执行方式：
  - HIGH (WASM): gRPC 调用
  - MEDIUM (容器): HTTP/gRPC 调用
  - LOW (进程): SDK 直接调用
- 任务执行结果缓存
- 事件发布（task.started, task.completed）

### 3. API 控制器

#### PluginController (`src/api/controllers/PluginController.ts`)
处理插件管理相关的 HTTP 请求：
- `GET /api/v1/plugins/available` - 列出可用插件
- `GET /api/v1/plugins/installed` - 列出已安装插件
- `GET /api/v1/plugins/:pluginId` - 获取插件详情
- `POST /api/v1/plugins/:pluginId/install` - 安装插件
- `POST /api/v1/plugins/:pluginId/uninstall` - 卸载插件
- `POST /api/v1/plugins/:pluginId/activate` - 激活插件
- `POST /api/v1/plugins/:pluginId/deactivate` - 停用插件
- `POST /api/v1/plugins/:pluginId/configure` - 配置插件
- `POST /api/v1/plugins/:pluginId/execute` - 执行插件任务

### 4. 路由集成

#### routes-plugin.ts (`src/routes-plugin.ts`)
创建插件 API 路由器，并集成到主 API 路由：
```typescript
router.use('/plugins', pluginRouter);
```

### 5. SDK 实现

#### TypeScript SDK (`sdk/typescript/src/plugin.ts`)
提供 TypeScript 插件开发能力：
- `TaskPlugin` 基类
- 日志方法（debug/info/warn/error）
- 配置读取（getConfig, getEnv）
- 工作区访问（getWorkspaceRoot, readWorkspaceFile）
- 结果创建（createSuccessResult, createFailedResult）

#### Python SDK (`sdk/python/orion_plugin_sdk/plugin.py`)
提供 Python 插件开发能力：
- 与 TypeScript SDK 相同的功能接口
- 异步支持（async execute）

### 6. 示例插件

#### Code Quality Task (`sdk/typescript/examples/code-quality-task.ts`)
基于 ESLint 的代码质量检查插件：
- 支持 TypeScript/JavaScript
- 可配置 eslint 配置文件路径
- 可配置 include/exclude 模式
- 支持 failOnError 和 maxWarnings 配置

#### Security Scan Task (`sdk/python/examples/security-scan-task.py`)
基于 Trivy/Semgrep 的安全扫描插件：
- 支持 fs/image/sbom 扫描类型
- 可配置严重程度过滤
- 支持 skipDirs 配置
- 支持 failOnCritical 和 failOnHigh 配置

### 7. 测试覆盖

#### plugin-manager.test.ts
- 列出可用插件测试
- 安装/卸载插件测试
- 激活/停用插件测试
- 配置插件测试
- 运行时信息测试

#### plugin-executor.test.ts
- 任务执行测试
- 不同安全等级执行方式测试
- 事件发布测试
- 执行结果缓存测试

### 测试结果
```
Test Suites: 2 passed
Tests:       23 passed
```

## 数据类型定义

### PluginMetadata
```typescript
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  type: PluginType;
  securityLevel: SecurityLevel;
  configSchema: Record<string, ConfigField>;
}
```

### PluginType
```typescript
type PluginType =
  | 'CUSTOM_TASK'
  | 'WEBHOOK_HANDLER'
  | 'AI_SKILL'
  | 'APPROVAL_PROVIDER'
  | 'NOTIFICATION_CHANNEL'
  | 'DEPLOYMENT_STRATEGY';
```

### SecurityLevel
```typescript
type SecurityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
// HIGH: WASM 沙箱
// MEDIUM: 容器隔离
// LOW: 独立进程
```

### PluginState
```typescript
type PluginState =
  | 'AVAILABLE'
  | 'DOWNLOADED'
  | 'INSTALLED'
  | 'ACTIVE'
  | 'CONFIGURED'
  | 'INACTIVE'
  | 'UNINSTALLED';
```

## 安全等级与运行时对应关系

| 安全等级 | 运行时类型 | 隔离机制 | 适用场景 |
|---------|-----------|---------|---------|
| HIGH | WASM | 沙箱隔离 | 高信任插件（如安全扫描） |
| MEDIUM | 容器 | Docker/K8s 隔离 | 中等信任插件（如代码质量） |
| LOW | 进程 | 进程隔离 | 低信任插件（如内部工具） |

## 后续工作

- 实现真实的 WASM 运行时（使用 wasmtime 或 similar）
- 实现容器运行时（使用 Docker API 或 Kubernetes API）
- 实现插件市场/注册表中心
- 添加插件签名与验证机制
- 添加插件版本兼容性检查
- 实现 gRPC 服务端（用于 WASM/容器插件通信）
