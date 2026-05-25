# BuildEnv 构建工具交互流程深度扫描报告

> 扫描时间: 2026-05-22
> 扫描范围: BuildEnv 模块 8 页面 + 后端 build/ 服务 + API 路由
> 分析人: Claude Agent

---

## 零、范围与发现

| 维度 | 值 | 备注 |
|------|-----|------|
| 前端页面文件数 | 8 | `orion-frontend/src/pages/BuildEnv/` 下 8 .tsx |
| 重复副本 | 8 | `orion-frontend/src/pages/code-svc/BuildEnv/` 下完全相同的 8 .tsx（diff 无差异） |
| 后端 Service 文件数 | 12+ | `build/` 目录下 12 个 .ts（不含 __tests__） |
| 后端 Controller 文件数 | 7 | `controllers/build/` 下 7 个 |
| 前端 API 文件数 | 1 | `build-env.ts` 包含 42 个 API 函数 |

### 关键发现：build-env 路由未注册

**严重问题**：`routes.ts` 中 `artifactRoutes` 和 `artifactVersionRoutes` 已注册（第 452-455 行），但 **`/v1/build-images`、`/v1/build-cache`、`/v1/build-pods`、`/v1/build-logs` 路由全部未注册**。

`controllers/build/` 下的 7 个 Controller 和 `services/build/` 下的 12+ 个 Service 文件全部存在，但 `routes.ts` 没有 import 和 register 这些路由。这意味着前端发起的所有 BuildEnv API 调用都会返回 404。

---

## 一、构建工具生命周期完整性

### 1.1 获取 (Acquisition)

| 能力 | 状态 | 证据 |
|------|------|------|
| 预置镜像列表 | 部分可用 | `BuilderImageService.ts:40-127` 硬编码 9 种预置镜像（Node 18/20, Python 3.11/3.12, Go 1.21/1.22, Java 17/21, .NET 8, Rust 1.77） |
| 注册自定义镜像 | 有实现 | `BuilderImageController.ts:25-53` 有 create handler |
| 从 Registry 导入 | 缺失 | 无 Harbor/Docker Hub 导入入口，前端 `BuilderImageList.tsx` 创建表单只支持手动填写 name/type/baseImage/version |
| 版本选择 | 部分可用 | `BuilderImageList.tsx:369-383` 编辑表单中 version 是手动输入的字符串，无版本矩阵 |
| 获取可用镜像 | 有 API | `getBuilderImagesAvailable()` 调用 `/v1/build-images/available` |
| 按类型获取 | 有 API | `getBuilderImagesByType(type)` 调用 `/v1/build-images/type/:type` |

### 1.2 管理 (Management)

| 能力 | 状态 | 证据 |
|------|------|------|
| 编辑镜像 | 有 | `BuilderImageList.tsx:269-270` Edit 按钮 -> `openEditModal` -> `updateBuilderImage` |
| 删除镜像 | 有 | `BuilderImageList.tsx:275-285` Delete 按钮 + Popconfirm -> `deleteBuilderImage` |
| 弃用/恢复 | 有 | `BuilderImageList.tsx:129-146` `handleToggleDeprecated` |
| 启用/禁用 | 部分 | Service 层有 `disable()` 方法（仅自定义镜像），前端未暴露此功能 |
| 标签/分类 | 缺失 | 只有 type/status 字段，无 tag/label 支持 |
| 缓存配置 CRUD | 完整 | `BuildCachePage.tsx` 支持创建/编辑/删除/清空/清理 |
| 缓存条目 CRUD | 部分 | 支持查看和删除，不支持手动创建/编辑 |
| Pod 取消 | 有 | `BuildPodList.tsx:65-77` `handleCancel` + `BuildPodDetail.tsx:60-73` |
| Pod 清理 | 后端有，前端无 | `K8sBuildController.ts:153-168` 有 cleanupPods 端点，前端无调用 |

### 1.3 使用 (Usage)

| 能力 | 状态 | 证据 |
|------|------|------|
| Pipeline 选择镜像 | 缺失 | Pipeline 配置页面无 builder image 选择器 |
| 构建执行 | Mock 实现 | `K8sBuildExecutor.ts:100-213` `MockK8sClient` 使用 setTimeout 模拟，非真实 K8s 调用 |
| 构建日志实时展示 | 有 | `BuildLogViewer.tsx:51-94` 使用 SSE（EventSource）实时流 |
| 构建日志批量查看 | 有 | `BuildLogList.tsx:25-44` 列表 + `getBuildLogs` API |
| 构建缓存管理 | 有 | `BuildCachePage.tsx` 双 Tab（Configs/Entries）|
| 产物下载 | 有 | `ArtifactList.tsx:72-94` `handleDownload` 创建 Blob 下载 |
| 产物删除 | 有 | `ArtifactList.tsx:96-108` `handleDelete` + Popconfirm |
| 产物清理 | 有 | `ArtifactList.tsx:110-122` `handleCleanup` |
| Pod 监控 | 有 | `BuildPodList.tsx` + `BuildPodDetail.tsx` |
| Pod 详情 | 有 | `BuildPodDetail.tsx` Descriptions + 内嵌 BuildLogViewer |
| Buildx 多架构构建 | 后端有，前端无 | `BuildxBuilderService.ts` 完整实现，但前端无对应页面/入口 |
| 证书管理 | 后端有，前端无 | `CertificateService.ts` iOS/Android 证书上传/下载/过期管理，但前端无页面 |
| 移动构建 (iOS/Android/Harmony) | 后端有，前端无 | `iOSBuildService.ts`/`AndroidBuildService.ts`/`HarmonyBuildService.ts` |
| C++ 构建 | 后端有，前端无 | `CppBuildService.ts` |
| 桌面构建 | 后端有，前端无 | `DesktopBuildService.ts` |
| 构建签名 | 缺失 | 无 artifact signing 入口 |
| 构建超时配置 | 缺失 | 无超时配置页面 |
| 构建环境变量管理 | 缺失 | 无 BuildEnv 变量管理页面 |
| 构建 Pod 资源配额 | 后端有，前端无 | `K8sBuildExecutor.ts:58-61` 有 resources limits 支持，前端无配置入口 |

---

## 二、逐页交互审计

### BuilderImageList (pages/BuildEnv/BuilderImageList.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 389 |
| 异步函数数 | 3 |
| 缺 loading | 1 |
| 缺反馈 | 0 |
| 缺空状态 | 1 |
| API 调用数 | 5 |
| Mock 逻辑 | 0 |
| .data.data | 1 |
| as any | 1 |
| 颜色违规 | 0 |
| CRUD 完整率 | 80% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadImages` | Y | Y | 无 | Y | 47-62 |
| 2 | `handleSave` | 无 | Y | Y | Y | 85-113 |
| 3 | `handleDelete` | 无 | Y | Y | Y | 115-127 |
| 4 | `handleToggleDeprecated` | 无 | Y | Y | Y | 129-146 |

#### 具体问题清单

- [P0] **`loadImages` 缺 loading**：`setLoading(true)` 在 try 前，但 `handleSave`/`handleDelete`/`handleToggleDeprecated` 均未设 loading，操作期间可重复点击按钮（BuilderImageList.tsx:85, 115, 129）
- [P0] **缺空状态**：当 images 数组为空时，Table 组件只显示空行，无 `<Empty>` 引导组件（BuilderImageList.tsx:327-334）
- [P1] **`.data.data` 解包**：`response.data.data` 在行 51，应封装在 API 层而非页面层
- [P1] **`as any` 类型违规**：行 52 `(apiData as any).items`，缺少类型定义
- [P1] **CRUD 缺 Create 独立入口的 loading 状态**：创建/保存操作期间 Modal 的 OK 按钮无 loading/disabled
- [P2] **Create 表单字段不全**：创建表单只有 name/type/baseImage/version 四个字段，缺少 description/pullPolicy/env 等字段

### BuildCachePage (pages/BuildEnv/BuildCachePage.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 543 |
| 异步函数数 | 6 |
| 缺 loading | 5 |
| 缺反馈 | 0 |
| 缺空状态 | 1 |
| API 调用数 | 7 |
| Mock 逻辑 | 0 |
| .data.data | 2 |
| as any | 0 |
| 颜色违规 | 0 |
| CRUD 完整率 | 75% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadConfigs` | Y | Y | 无 | Y | 50-65 |
| 2 | `loadEntries` | Y | Y | 无 | Y | 67-82 |
| 3 | `handleSaveConfig` | 无 | Y | Y | Y | 89-112 |
| 4 | `handleDeleteConfig` | 无 | Y | Y | Y | 114-126 |
| 5 | `handleDeleteEntry` | 无 | Y | Y | Y | 128-140 |
| 6 | `handleCleanupExpired` | 无 | Y | Y | Y | 142-155 |
| 7 | `handleClearConfig` | 无 | Y | Y | Y | 157-169 |

#### 具体问题清单

- [P0] **5 个异步函数缺 loading**：`handleSaveConfig`/`handleDeleteConfig`/`handleDeleteEntry`/`handleCleanupExpired`/`handleClearConfig` 均未使用 setLoading，操作期间无禁用/加载状态
- [P0] **缺空状态**：configs 和 entries 为空时，Table 只显示空行，无 `<Empty>` 组件
- [P0] **缺 Create 按钮**：有 `openCreateConfigModal` 函数但页面上**没有 Create 按钮入口**，用户无法触发创建操作。只有 Add Config 按钮（行 472），但它在标题区域旁边，不是缺失
- [P1] **`.data.data` 解包**：行 53 和 行 70 两处 `response.data.data` 手动解包
- [P1] **Cache Entry 缺创建入口**：entries tab 只能删除，不能手动创建新缓存条目
- [P2] **保存成功后提示为英文**：`'Cache config updated'` 应统一为中文

### BuildLogList (pages/BuildEnv/BuildLogList.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 230 |
| 异步函数数 | 1 |
| 缺 loading | 0 |
| 缺反馈 | 1 |
| 缺空状态 | 1 |
| API 调用数 | 1 |
| Mock 逻辑 | 0 |
| .data.data | 1 |
| as any | 1 |
| 颜色违规 | 0 |
| CRUD 完整率 | 50% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadLogs` | Y | Y | 无 | Y | 25-40 |

#### 具体问题清单

- [P0] **只有 Read 操作**：整个页面只有加载列表一个异步操作，无创建/删除/清理入口，CRUD 仅支持 Read
- [P0] **缺空状态**：logs 为空时无 `<Empty>` 引导组件
- [P1] **`.data.data` 解包**：行 29 `response.data.data`
- [P1] **`as any` 类型违规**：行 30 `(apiData as any).items`
- [P1] **statusMap 类型**：行 142 `Record<string, any>` 应使用具体联合类型

### BuildLogViewer (pages/BuildEnv/BuildLogViewer.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 299 |
| 异步函数数 | 0 |
| 缺 loading | 0 |
| 缺反馈 | 0 |
| 缺空状态 | 1 |
| API 调用数 | 0（直接 EventSource） |
| Mock 逻辑 | 0 |
| .data.data | 0 |
| as any | 0 |
| 颜色违规 | 0 |
| CRUD 完整率 | N/A（纯查看组件） |

#### 具体问题清单

- [P1] **无空状态提示**：当 logId 为空或 SSE 连接失败且无数据时，显示 `Waiting for logs...` 但无 `<Empty>` 组件（行 211）
- [P1] **连接断开无重试提示**：SSE `onerror` 时只显示错误文本，无自动重连机制（行 77-87）
- [P2] **maxLines 限制无提示**：超过 10000 行时静默截断，无用户提示（行 73）

### BuildPodList (pages/BuildEnv/BuildPodList.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 282 |
| 异步函数数 | 2 |
| 缺 loading | 1 |
| 缺反馈 | 0 |
| 缺空状态 | 1 |
| API 调用数 | 2 |
| Mock 逻辑 | 0 |
| .data.data | 1 |
| as any | 2 |
| 颜色违规 | 0 |
| CRUD 完整率 | 50% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadPods` | Y | Y | 无 | Y | 25-40 |
| 2 | `handleCancel` | 无 | Y | Y | Y | 65-77 |

#### 具体问题清单

- [P0] **`handleCancel` 缺 loading**：取消操作期间 Cancel 按钮无 disabled/loading 状态，可重复点击
- [P0] **缺空状态**：pods 为空时无 `<Empty>` 引导
- [P0] **只有 Read + Cancel**：CRUD 仅支持 Read 和 Cancel（Update），缺 Create 和 Delete
- [P1] **`.data.data` 解包**：行 29 `response.data.data`
- [P1] **`as any` 类型违规**：行 23 `useState<any[]>([])` 和行 30 `(apiData as any).items`
- [P1] **statusMap 类型**：行 175 `Record<string, any>` 应使用具体联合类型

### BuildPodDetail (pages/BuildEnv/BuildPodDetail.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 173 |
| 异步函数数 | 3 |
| 缺 loading | 1 |
| 缺反馈 | 0 |
| 缺空状态 | 0（有 "not found" 提示） |
| API 调用数 | 3 |
| Mock 逻辑 | 0 |
| .data.data | 2 |
| as any | 2 |
| 颜色违规 | 0 |
| CRUD 完整率 | 50% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadPod` | Y | Y | 无 | Y | 23-39 |
| 2 | `loadLogs` | 无 | Y | 无 | Y | 41-53 |
| 3 | `handleCancel` | 无 | Y | Y | Y | 60-73 |

#### 具体问题清单

- [P0] **`handleCancel` 缺 loading**：取消操作期间 Cancel 按钮无 disabled 状态
- [P0] **`loadLogs` 缺 loading**：日志加载无 loading 状态，用户看不到加载中提示
- [P1] **`.data.data` 解包**：行 28 和 行 45 两处 `response.data.data`
- [P1] **`as any` 类型违规**：行 45 `as any[]` 和行 47 `as any`
- [P1] **`as any` status**：行 114 和 行 142 `pod.status as any` 传递给 StatusBadge

### ArtifactList (pages/BuildEnv/ArtifactList.tsx)

| 指标 | 值 |
|------|-----|
| 代码行数 | 309 |
| 异步函数数 | 4 |
| 缺 loading | 3 |
| 缺反馈 | 0 |
| 缺空状态 | 1 |
| API 调用数 | 4 |
| Mock 逻辑 | 0 |
| .data.data | 1 |
| as any | 2 |
| 颜色违规 | 0 |
| CRUD 完整率 | 60% |

#### 异步函数清单

| # | 函数 | loading | try/catch | message.success | message.error | 行号 |
|---|------|---------|-----------|-----------------|---------------|------|
| 1 | `loadArtifacts` | Y | Y | 无 | Y | 33-48 |
| 2 | `handleDownload` | 无 | Y | Y | Y | 72-94 |
| 3 | `handleDelete` | 无 | Y | Y | Y | 96-108 |
| 4 | `handleCleanup` | 无 | Y | Y | Y | 110-122 |

#### 具体问题清单

- [P0] **3 个异步函数缺 loading**：`handleDownload`/`handleDelete`/`handleCleanup` 操作期间对应按钮无 disabled/loading
- [P0] **缺空状态**：artifacts 为空时无 `<Empty>` 引导
- [P0] **只有 Read + Delete + Download**：缺 Create 入口，无法手动创建/上传 Artifact
- [P1] **`as any` 类型违规**：行 31 `useState<any[]>([])` 和行 38 `(apiData as any).items`
- [P1] **`.data.data` 解包**：行 37 `response.data.data`

### BuildEnv/index.tsx (Layout)

| 指标 | 值 |
|------|-----|
| 代码行数 | 47 |
| 异步函数数 | 0 |
| 颜色违规 | 0 |

#### 具体问题清单

- [P2] **菜单项硬编码**：menuItems 数组写死，未从后端动态获取

### code-svc/BuildEnv/ 重复副本

所有 8 个文件与 `pages/BuildEnv/` 下的文件**完全相同**（diff 无差异）。这是冗余代码，建议删除其中一套。

---

## 三、后端服务完整性

| 服务文件 | 行数 | 存储方式 | 有 Controller | 有 API 路由注册 | 有 Repository |
|---------|------|---------|--------------|----------------|--------------|
| BuilderImageService.ts | 340 | **Map (内存)** | BuilderImageController.ts | **否** | 否 |
| BuildCacheService.ts | 365 | PostgreSQL Repository | BuildCacheController.ts | **否** | BuildCacheRepository |
| BuildService.ts | 305 | PostgreSQL Repository | 无 | **否** | BuildRepository |
| BuildLogService.ts | 338 | **Map (内存)** + 可选 Repository | BuildLogController.ts | **否** | BuildLogRepository |
| ArtifactService.ts | 376 | PostgreSQL Repository + Map fallback | controllers/build/ArtifactController.ts | **部分** | BuildArtifactRepository |
| K8sBuildExecutor.ts | 455 | **Map (内存)** + MockK8sClient | K8sBuildController.ts | **否** | 无 |
| BuildxBuilderService.ts | 649 | 无（直接 exec docker） | BuildxBuilderController.ts | **否** | 无 |
| CacheRestoreSaveService.ts | - | 内存 | 无 | **否** | 无 |
| CacheStorageDriver.ts | - | 抽象接口 | 无 | **否** | 无 |
| CertificateService.ts | 182 | **Map (内存)** | 无 | **否** | 无 |
| CppBuildService.ts | - | 无 | 无 | **否** | 无 |
| DesktopBuildService.ts | - | 无 | 无 | **否** | 无 |
| AndroidBuildService.ts | 78 | 无 | 无 | **否** | 无 |
| iOSBuildService.ts | - | 无 | 无 | **否** | 无 |
| HarmonyBuildService.ts | - | 无 | **否** | 无 |
| BuildRepository.ts | 404 | PostgreSQL | 无 | **否** | 自身 |
| ArtifactRepository.ts | 251 | PostgreSQL | 无 | **部分** | 自身 |

### 关键问题

1. **BuilderImageService 使用 Map 存储**：所有预置镜像和自定义镜像都存储在内存中（`BuilderImageService.ts:132`），服务重启后丢失。应迁移到 PostgreSQL Repository。
2. **BuildLogService 使用 Map 为主**：日志数据主要存储在内存中（`BuildLogService.ts:38`），PostgreSQL Repository 是可选的 fallback。
3. **K8sBuildExecutor 使用 MockK8sClient**：K8s 操作全部是 `setTimeout` 模拟（`K8sBuildExecutor.ts:100-213`），不是真实的 K8s API 调用。
4. **CertificateService 使用 Map 存储**：证书数据存储在内存中（`CertificateService.ts:25`），且有硬编码的加密密钥回退（行 38 `crypto.randomBytes(32)`）。
5. **artifactRoutes.ts 缺少 cleanup 端点**：`/artifacts/cleanup/expired` 端点在 `ArtifactController.ts:174-183` 有实现，但 artifact-routes.ts 未注册此端点。

---

## 四、构建工具特定能力

| 能力 | 状态 | 说明 |
|------|------|------|
| Builder image 版本管理 | 部分 | Service 层有版本字段，前端只有手动输入，无版本矩阵 |
| Build tool 版本矩阵 | 缺失 | 无 Node/Go/Java/Python 版本矩阵页面 |
| 自定义构建工具注册 | 有（后端） | `BuilderImageService.register()`，但前端创建表单字段不完整 |
| Build 环境变量管理 | 缺失 | 无 BuildEnv 变量管理页面/API |
| Build 缓存策略 | 有 | `BuildCacheService` 支持三级级联（全局/流水线/任务）、Volume/S3/Registry 策略 |
| Build Pod 资源配额 | 后端有 | `K8sBuildExecutor` 支持 resources limits，但前端无配置入口 |
| Build 超时配置 | 缺失 | 无超时配置页面 |
| 多平台构建 (amd64/arm64) | 后端有 | `BuildxBuilderService` + `ArtifactService.buildMultiArch()`，前端无入口 |
| 移动构建 (iOS/Android/Harmony) | 后端有 | `iOSBuildService`/`AndroidBuildService`/`HarmonyBuildService`，前端无页面 |
| C++ 构建 | 后端有 | `CppBuildService.ts`，前端无页面 |
| 桌面构建 | 后端有 | `DesktopBuildService.ts`，前端无页面 |
| Build 证书/密钥管理 | 后端有 | `CertificateService` 支持 iOS/Android 证书，前端无页面 |
| Build 产物签名 | 缺失 | 无 artifact signing 功能 |
| Build 工具插件系统 | 缺失 | 无 build plugin/extension 机制 |
| Runner 管理 | 缺失 | `routes.ts:695` 注释说 Runner Agent 路由已迁移到 orion-code-svc |
| Harbor/Registry 集成导入 | 缺失 | 无从外部 Registry 导入镜像功能 |

---

## 五、缺失能力汇总

### P0（阻塞性问题）

1. **build-env 路由未注册**：`routes.ts` 未 import/注册 `/v1/build-images`、`/v1/build-cache`、`/v1/build-pods`、`/v1/build-logs` 路由。前端所有 BuildEnv API 调用返回 404
2. **多个操作缺 loading/disabled**：BuilderImageList（3个）、BuildCachePage（5个）、BuildPodList（1个）、BuildPodDetail（2个）、ArtifactList（3个）的异步操作按钮可重复点击
3. **所有页面缺空状态**：8 个页面中 7 个在数据为空时只显示空 Table，无 `<Empty>` 组件
4. **BuilderImageService 使用 Map 存储**：服务重启后所有自定义镜像丢失
5. **K8sBuildExecutor 使用 MockK8sClient**：构建 Pod 创建是 setTimeout 模拟，不是真实 K8s

### P1（重要但非阻塞）

1. **`.data.data` 手动解包**：5 个页面都在页面层手动解包 `response.data.data`，应封装在 API 层
2. **`as any` 类型违规**：4 个页面使用 `as any` 绕过类型检查（BuilderImageList/BuildPodList/BuildPodDetail/ArtifactList）
3. **CRUD 不完整**：
   - BuilderImageList：创建表单缺 description/pullPolicy/env 字段
   - BuildCachePage：Cache Entry 缺创建入口
   - BuildLogList：只有 Read，无 Create/Delete
   - ArtifactList：缺 Create 入口
   - BuildPodList：只有 Read + Cancel，缺 Create/Delete
4. **code-svc/BuildEnv/ 冗余副本**：8 个文件与主目录完全相同，应删除
5. **artifact-routes 缺 cleanup/expired 端点注册**
6. **BuildLogService 日志持久化依赖可选**：无 PostgreSQL 连接时日志数据全在内存中
7. **CertificateService 加密密钥回退不安全**：无环境变量时使用 `crypto.randomBytes(32)` 每次重启不同

### P2（优化建议）

1. **Pipeline 构建选择器**：Pipeline 配置页面无 builder image 选择器
2. **Buildx 多架构构建前端入口**：`BuildxBuilderService` 后端实现完整，但前端无对应页面
3. **构建工具版本矩阵**：建议增加 Node/Go/Java/Python 等语言的版本矩阵管理
4. **Build 超时配置页面**
5. **Build Pod 资源配额配置页面**
6. **Build 产物签名功能**
7. **Harbor/Docker Hub 导入镜像**
8. **移动构建/C++/桌面构建前端页面**
9. **Build 环境变量管理**
10. **Build 工具插件系统**
11. **菜单项动态化**：BuildEnv/index.tsx 菜单硬编码

---

## 六、建议

### 立即修复（P0）

1. **注册 build-env 路由**：在 `routes.ts` 中添加 BuilderImageController、BuildCacheController、K8sBuildController、BuildLogController 的路由注册。参考 artifactRoutes 的注册模式
2. **添加操作 loading 状态**：所有 async handler 在操作开始时设 `setLoading(true)`，按钮绑定 `loading` 属性
3. **添加空状态**：每个页面在数据为空时显示 `<Empty>` + 引导操作按钮
4. **BuilderImageService 迁移到 PostgreSQL**：创建 `BuilderImageRepository`，替换 Map 存储
5. **实现真实 K8s 集成**：用 `@kubernetes/client-node` 替换 `MockK8sClient`

### 短期改进（P1）

1. **封装 API 响应解包**：在 `build-env.ts` 中统一处理 `response.data.data`，页面直接使用数据
2. **移除 `as any`**：为所有 API 响应定义 TypeScript 接口
3. **补全 CRUD**：为每个实体添加缺失的 Create/Update/Delete 入口
4. **删除 code-svc/BuildEnv/ 副本**：保留一套即可
5. **注册 artifact cleanup 端点**：在 artifact-routes.ts 添加 `/artifacts/cleanup/expired`

### 中期规划（P2）

1. **Build 工具版本矩阵管理页**
2. **Pipeline builder image 选择器**
3. **Buildx 多架构构建前端页**
4. **证书管理前端页**（iOS/Android）
5. **移动/C++/桌面构建前端页**
6. **Build 超时和资源配额配置页**
7. **Registry 集成导入功能**
8. **Build 环境变量管理**
