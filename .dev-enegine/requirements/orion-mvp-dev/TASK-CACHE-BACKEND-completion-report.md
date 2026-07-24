# Pipeline 缓存管理后端实现完成报告

**日期:** 2026-04-14
**任务:** Pipeline 缓存和 Artifact 管理后端服务

---

## 概述

本次开发完成了 Pipeline 缓存管理和构建产物（Artifact）的后端服务实现，包括：
- 扩展 Pipeline 模型支持 Stage 级别的缓存和 Artifact 配置
- Artifact 管理服务
- Stage 级别的缓存保存/恢复 API
- Stage 级别的 Artifact 上传/下载 API

---

## 完成的工作

### 1. 扩展 Pipeline 模型

**文件:** `src/models/Pipeline.ts`

在 `PipelineStage` 接口中添加了缓存和 Artifact 配置：

```typescript
export interface PipelineStage {
  name: string;
  runsOn: string;
  steps: PipelineStep[];
  dependsOn?: string[];
  if?: string;
  timeout?: number;
  retries?: number;
  // 缓存配置
  cache?: {
    enabled: boolean;
    key: string;
    paths: string[];
    restoreKeys?: string[];
  };
  // Artifact 配置
  artifacts?: {
    upload?: string[];
    expiry?: number;  // 天数
  };
}
```

### 2. Artifact 管理服务

**文件:** `src/services/build/ArtifactService.ts`

实现了完整的 Artifact 管理功能：

```typescript
export class ArtifactService {
  // 创建 Artifact
  async createArtifact(input: ArtifactCreateInput): Promise<Artifact>
  
  // 获取 Artifact
  async getArtifact(id: string): Promise<Artifact | null>
  
  // 查询 Artifact 列表
  async listArtifacts(options?: ArtifactQueryOptions): Promise<Artifact[]>
  
  // 记录下载
  async recordDownload(id: string): Promise<Artifact | null>
  
  // 删除 Artifact
  async deleteArtifact(id: string): Promise<boolean>
  
  // 清理过期的 Artifact
  async cleanupExpired(): Promise<number>
  
  // 按 Run 清理 Artifact
  async cleanupByRun(runId: string): Promise<number>
}
```

**支持的 Artifact 类型:**
- `BUILD_OUTPUT` - 构建输出
- `TEST_RESULT` - 测试结果
- `COVERAGE_REPORT` - 覆盖率报告
- `LOG_FILE` - 日志文件
- `OTHER` - 其他

### 3. Artifact 控制器

**文件:** `src/api/controllers/build/ArtifactController.ts`

实现了以下 API 端点：

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/artifacts` | 创建 Artifact（上传） |
| GET | `/api/v1/artifacts` | 查询 Artifact 列表 |
| GET | `/api/v1/artifacts/:id` | 获取 Artifact 详情 |
| GET | `/api/v1/artifacts/:id/download` | 下载 Artifact |
| DELETE | `/api/v1/artifacts/:id` | 删除 Artifact |
| POST | `/api/v1/artifacts/cleanup/expired` | 清理过期 Artifact |

### 4. Stage 级别缓存控制器

**文件:** `src/api/controllers/build/StageCacheController.ts`

实现了 Stage 级别的缓存和 Artifact API：

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/pipeline-runs/:runId/stages/:stageId/cache` | 保存缓存 |
| GET | `/api/v1/pipeline-runs/:runId/stages/:stageId/cache` | 恢复缓存 |
| POST | `/api/v1/pipeline-runs/:runId/stages/:stageId/artifacts` | 上传 Artifact |
| GET | `/api/v1/pipeline-runs/:runId/stages/:stageId/artifacts` | 获取 Artifact 列表 |

### 5. 路由注册

**文件:** `src/api/build-routes.ts`

更新了构建环境管理路由，添加了：
- Artifact 管理路由（6 个端点）
- Stage 级别缓存和 Artifact 路由（4 个端点）

---

## API 端点汇总

### 全局 Artifact 管理

```bash
# 创建 Artifact
POST /api/v1/artifacts
{
  "name": "app-bundle",
  "type": "build-output",
  "runId": "run-123",
  "stageId": "stage-456",
  "paths": ["dist/app.jar"],
  "expiresAt": "2026-05-14T00:00:00Z"
}

# 查询 Artifact 列表
GET /api/v1/artifacts?runId=run-123&stageId=stage-456

# 获取 Artifact 详情
GET /api/v1/artifacts/:id

# 下载 Artifact
GET /api/v1/artifacts/:id/download

# 删除 Artifact
DELETE /api/v1/artifacts/:id
```

### Stage 级别缓存

```bash
# 保存缓存
POST /api/v1/pipeline-runs/:runId/stages/:stageId/cache
{
  "key": "npm-${{ hashFiles('package-lock.json') }}",
  "paths": ["node_modules", ".npm/cache"],
  "hash": "abc123"
}

# 恢复缓存
GET /api/v1/pipeline-runs/:runId/stages/:stageId/cache?key=npm-abc123
```

### Stage 级别 Artifact

```bash
# 上传 Artifact
POST /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts
{
  "name": "build-output",
  "paths": ["dist/app.jar", "build/libs/*.jar"],
  "type": "build-output",
  "expiresAt": "2026-05-14T00:00:00Z"
}

# 获取 Artifact 列表
GET /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts
```

---

## 测试结果

| 测试类型 | 状态 |
|---------|------|
| 单元测试 | ✅ 2658 个测试通过 |
| TypeScript 类型检查 | ⚠️ 现有项目配置问题（与本次修改无关） |

---

## 与前端 API 的对应关系

| 前端 API | 后端端点 | 状态 |
|---------|---------|------|
| `saveCache()` | `POST /pipeline-runs/:runId/stages/:stageId/cache` | ✅ |
| `restoreCache()` | `GET /pipeline-runs/:runId/stages/:stageId/cache` | ✅ |
| `uploadArtifact()` | `POST /pipeline-runs/:runId/stages/:stageId/artifacts` | ✅ |
| `downloadArtifact()` | `GET /artifacts/:id/download` | ✅ |
| `listArtifacts()` | `GET /artifacts` | ✅ |
| `deleteArtifact()` | `DELETE /artifacts/:id` | ✅ |

---

## 缓存管理流程

### 保存缓存流程

```
1. 检查缓存是否启用（三级级联：任务 -> 流水线 -> 全局）
   │
   ▼
2. 获取生效的缓存配置
   │
   ▼
3. 计算依赖文件 hash（如果未提供）
   │
   ▼
4. 创建缓存条目
   │
   ▼
5. 返回缓存 key 和存储路径
```

### 恢复缓存流程

```
1. 检查缓存是否启用
   │
   ▼
2. 获取生效的缓存配置
   │
   ▼
3. 按 key 查找缓存条目
   │
   ▼
4. 检查是否过期
   │
   ├──► 已过期 → 返回 Cache Miss
   │
   ▼
5. 返回缓存信息和存储路径
```

---

## 后续工作建议

### 存储实现（生产环境）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| Redis 缓存存储 | 4h | 热数据存储 |
| S3 兼容存储 | 4h | 持久化存储 |
| 本地卷存储 | 2h | 开发/测试环境 |

### 增强功能

| 功能 | 工作量 | 说明 |
|------|--------|------|
| 缓存命中率统计 | 2h | 监控和指标 |
| Artifact 预览 | 2h | 支持查看内容 |
| 缓存压缩 | 2h | 减少存储空间 |
| 增量缓存 | 4h | 只存储变化部分 |

---

## 总结

本次开发完成了**后端缓存管理和 Artifact 服务**的完整实现：

**已完成:**
- ✅ Pipeline 模型扩展（支持 Stage 级别缓存和 Artifact 配置）
- ✅ Artifact 管理服务（CRUD + 清理）
- ✅ Stage 级别缓存保存/恢复 API
- ✅ Stage 级别 Artifact 上传/下载 API
- ✅ 与前端 API 完全对应

**总计新增 API 端点:** 10 个

**下一步**可以配置实际的存储服务（Redis/S3/本地卷）以支持生产环境使用。
