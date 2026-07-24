# 制品/构建（Artifact/Build）模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/artifact/`、`artifact-ops/`、`build/` 及相关路由

---

## 模块概览

Artifact/Build 模块承担**制品管理、版本溯源、构建环境、安全扫描、保留策略**五大职责。当前实现呈现"骨架完整、部分空洞"的特征：核心领域模型、Repository 层、API 路由已经搭好，但部分业务实现仍处于 Mock / 空实现 / 回退模式。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 制品注册中心 | `services/artifact/ArtifactRegistryService.ts` | ✅ 完整（PostgreSQL） |
| 制品元数据与标签 | `models/Artifact.ts` + `repositories/ArtifactRepository.ts` | ✅ 完整 |
| 制品升级（Promotion） | `services/artifact/PromotionService.ts` | ⚠️ 混合（DB + 内存回退） |
| 制品版本溯源 | `services/pipeline/ArtifactVersionService.ts` + `repositories/ArtifactVersionRepository.ts` | ✅ 完整 |
| 制品运维（扫描/保留/操作追踪） | `services/artifact-ops/` 三件套 | ✅ PostgreSQL 持久化 |
| 制品仓库存储 | `storage/ArtifactStorage.ts` | ⚠️ 仅 Local/S3 两种实现，Local 实现有硬伤 |
| Build 环境（构建记录/镜像/缓存/日志） | `api/build-env-routes.ts` + `controllers/build/*` | ❌ 路由存在但大量 Mock，无真实 Service 层调用 |
| Buildx 多架构构建 | `controllers/build/BuildxBuilderController.ts` | ⚠️ 控制器存在，Service 层未在路由中实例化 |
| K8s Build Pod | `controllers/build/K8sBuildController.ts` | ⚠️ 控制器存在，Service 层未在路由中实例化 |

---

## 架构设计

### 分层结构

```
API Routes (*-routes.ts)
    ↓
Controllers (api/controllers/)
    ↓
Service Layer (services/)
    ↓
Repository Layer (repositories/)
    ↓
Storage Layer (storage/)
```

### 关键设计模式

- **Repository Pattern**：7 个 Repository 均已迁移到 PostgreSQL
- **Service Layer**：业务逻辑集中在 services/，控制器只做参数校验和响应封装
- **内存降级**：PromotionService 和 ArtifactOperationService 在无 DB 时回退到 Map()
- **接口隔离**：models/Artifact.ts 定义 ArtifactRegistryService 接口，便于替换存储后端

---

## 功能完整性评估

### 制品注册中心

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建制品 | ✅ | 支持 namespace/name/version 唯一性检查 |
| 查询列表 | ✅ | 支持 namespace/name/type/status/tags 过滤 |
| 更新制品 | ✅ | 仅允许更新 status + metadata |
| 删除制品 | ✅ | 软删除 + 存储文件删除 |
| 标签管理 | ✅ | add/remove/get，支持去重 |
| 下载记录 | ✅ | 记录下载者/IP/UA，返回历史 |
| 搜索 | ✅ | 基于 name/namespace/version/metadata 的 ILIKE |
| 制品升级（Promote） | ⚠️ | 服务层有实现，路由未暴露 |
| 废弃/隔离 | ✅ | 服务层有实现，路由已暴露 |

### 版本溯源

| 功能 | 状态 | 说明 |
|------|------|------|
| 版本创建 | ✅ | 唯一性检查 + PostgreSQL 持久化 |
| 晋升到目标环境 | ✅ | promoted_from 追溯链 |
| 版本对比（Diff） | ✅ | 对比 commit/branch/metadata |
| 溯源链查询 | ✅ | 关联 pipeline_runs + deployments |
| 部署历史 | ✅ | 按 Pipeline 聚合 |
| 标签管理 | ✅ | tag/untag + 按标签查询 |
| 祖先/后代遍历 | ✅ | BFS，支持 maxDepth |

### 制品运维

| 功能 | 状态 | 说明 |
|------|------|------|
| 操作追踪 | ✅ | PostgreSQL 持久化 + 内存降级 |
| 操作历史查询 | ✅ | 支持多条件过滤 |
| 统计信息 | ✅ | 按 tenant 聚合 |
| 安全扫描 | ⚠️ | 扫描结果生成是模拟数据（基于 hash 确定性生成） |
| 恶意检测 | ⚠️ | 基于名称关键词 + hash 模拟，非真实检测 |
| 保留策略 | ✅ | 策略 CRUD + 评估 + 报告 |
| 清理过期 | ✅ | 按策略评估 + 批量清理 |

### Build 集成

| 功能 | 状态 | 说明 |
|------|------|------|
| 构建记录 CRUD | ❌ | 路由返回 Mock 数据，无 Service 调用 |
| 构建镜像管理 | ❌ | 路由返回 Mock 数据，无 Service 调用 |
| 构建缓存 | ⚠️ | 控制器有完整 CRUD，但路由未实例化 Service |
| 构建日志 | ❌ | 路由返回空数组 |
| Cache Monitor | ⚠️ | 路由有实现，但依赖外部 Service |
| Buildx 多架构构建 | ⚠️ | 控制器有验证逻辑，路由未暴露 |
| K8s Build Pod | ⚠️ | 控制器有完整方法，路由未暴露 |

### 制品仓库集成

| 功能 | 状态 | 说明 |
|------|------|------|
| 本地存储 | ⚠️ | 实现有硬伤 |
| S3 存储 | ⚠️ | 实现存在，但 getArtifactKey 返回硬编码路径 |
| Registry 对接（Docker/Helm） | ❌ | 无 OCI/Docker Registry 客户端对接 |

---

## API 端点清单

### 制品注册中心（`/api/v1/artifacts`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/artifacts` | 创建制品 |
| GET | `/artifacts` | 列表查询 |
| GET | `/artifacts/:id` | 详情 |
| PUT | `/artifacts/:id` | 更新 |
| DELETE | `/artifacts/:id` | 删除 |
| POST | `/artifacts/:id/tags` | 加标签 |
| DELETE | `/artifacts/:id/tags` | 删标签 |
| GET | `/artifacts/:id/tags` | 标签列表 |
| GET | `/artifacts/:id/download` | 下载（返回 JSON，非文件流） |
| GET | `/artifacts/:id/downloads` | 下载历史 |
| GET | `/artifacts/search` | 搜索 |
| POST | `/artifacts/:id/promote` | 晋升 |
| GET | `/artifacts/:id/stage` | 当前阶段 |
| GET | `/artifacts/:id/history` | 晋升历史 |
| POST | `/artifacts/:id/deprecate` | 废弃 |
| POST | `/artifacts/:id/quarantine` | 隔离 |
| GET | `/artifacts/stats` | 统计 |
| GET | `/artifacts/types` | 类型统计 |
| GET | `/artifacts/namespaces` | 命名空间列表 |

**权限问题**：上述路由全部未接入 authenticateUser / requirePermission，属于 P0 安全缺陷。

### 制品版本溯源（`/api/v1/artifact-versions`）

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/` | artifact-version:read | 版本列表 |
| GET | `/:id` | artifact-version:read | 版本详情 |
| GET | `/:id/traceability` | artifact-version:read | 溯源链 |
| GET | `/diff` | artifact-version:read | 版本对比 |
| GET | `/history/:pipelineId` | artifact-version:read | 部署历史 |
| GET | `/commit/:commitSha` | artifact-version:read | 代码溯源 |
| POST | `/:id/tags` | artifact-version:write | 加标签 |
| DELETE | `/:id/tags/:tag` | artifact-version:write | 删标签 |
| POST | `/:id/promote` | artifact-version:write | 晋升版本 |

### 制品运维（`/api/v1/artifact-ops`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/track` | 操作追踪 |
| GET | `/history/:artifactId` | 操作历史 |
| GET | `/stats` | 统计 |
| POST | `/scan/:artifactId` | 扫描制品 |
| GET | `/scan/report/:scanId` | 扫描报告 |
| GET | `/scan/:artifactId/reports` | 扫描报告列表 |
| POST | `/scan/detect` | 恶意检测 |
| POST | `/retention` | 定义保留策略 |
| POST | `/retention/evaluate` | 评估策略 |
| POST | `/retention/report` | 保留报告 |
| GET | `/retention/policies` | 策略列表 |
| DELETE | `/retention/policies/:policyId` | 删除策略 |
| POST | `/cleanup` | 清理操作记录 |

### Build 环境（`/api/v1/build-env`）

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/builds` | 构建列表 | ❌ Mock |
| GET | `/builds/:id` | 构建详情 | ❌ Mock |
| POST | `/builds` | 创建构建 | ❌ Mock |
| GET | `/build-images` | 构建镜像列表 | ❌ Mock |
| POST | `/build-images` | 创建构建镜像 | ❌ Mock |
| GET | `/build-cache` | 缓存配置列表 | ⚠️ Mock |
| GET | `/cache-monitor/dashboard` | 监控仪表板 | ✅ |
| GET | `/cache-monitor/metrics/:cacheId` | 缓存指标 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 制品注册中心路由缺少认证授权 | 全部 18 个端点未接入权限中间件 | 接入 authenticateUser + requirePermission |
| Build 路由全部为 Mock 实现 | 前端调用返回假数据 | 替换为真实 Service 层调用 |
| 安全扫描结果为模拟数据 | 误导安全决策 | 接入 Trivy/Grype 真实扫描引擎 |
| 恶意检测为模拟逻辑 | 无法接入真实恶意检测引擎 | 接入行为分析/沙箱报告 |
| S3/Local 存储实现存在硬伤 | 下载/删除不正确 | 修复硬编码路径 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无 OCI/Docker Registry 对接 | 无法直接推送/拉取镜像 | 实现 Registry 客户端 |
| PromotionService 内存降级模式 | 无 DB 时数据丢失 | 强制 PostgreSQL |
| ArtifactOperationService 内存降级 | 同上 | 强制 PostgreSQL |
| Buildx Builder 路由未暴露 | 控制器完整但路由未注册 | 注册路由 |
| K8s Build Pod 路由未暴露 | 控制器完整但路由未注册 | 注册路由 |
| Build Cache Service 未实例化 | 路由未挂载 Service | 实例化 Service |
| 制品下载返回 JSON 而非文件流 | 接口语义不符 | 返回实际文件流 |
| 重复的 ArtifactController | 命名空间容易混淆 | 统一职责 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无制品生命周期自动化 | 缺少自动晋升/扫描/清理 | 实现 Pipeline 触发 |
| 无制品副本/镜像复制 | 不支持跨 Registry 复制 | 实现镜像同步 |
| 无制品访问权限精细化 | 缺少按命名空间/标签的 ACL | 增加 ACL 控制 |
| 无制品元数据 schema 校验 | metadata 无约束 | 增加 schema 校验 |
| 无制品大小限制 enforcement | 上传时未校验 | 增加大小限制 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 内存 Map 持久化回退 | PromotionService, ArtifactOperationService | 高 | 强制 PostgreSQL |
| 硬编码存储路径 | ArtifactStorage Local/S3 | 中 | 修复路径计算逻辑 |
| Mock 扫描生成 | ArtifactScanService | 高 | 接入真实扫描引擎 |
| 路由缺少认证 | artifact-routes.ts | 高 | 接入 authenticateUser + requirePermission |
| 下载接口未返回文件流 | ArtifactController | 中 | 返回 reply.send(fileStream) |
| 重复的 ArtifactController | controllers/artifact/ vs controllers/build/ | 中 | 统一职责 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Pipeline | ArtifactVersionService 关联 pipeline_runs + deployments | ✅ |
| Pipeline | Build 过程中产出 Artifact | ⚠️ Service 存在，路由 Mock |
| Tenant | 多租户隔离 tenant_id 字段 | ✅ |
| Auth | 认证授权 | ❌ artifact-routes 未接入 |
| Approval | 晋升审批 promoteWithApproval | ✅ 服务层有实现 |
| SBOM/SupplyChain | 漏洞扫描与制品关联 | ⚠️ 数据模型已对接，扫描逻辑为模拟 |
| Monitoring | 制品统计 / Cache Monitor | ✅ |
| Storage | 实际文件存储 ArtifactStorage | ⚠️ Local/S3 实现均有硬伤 |

---

## 建议优先级

### Phase 1：安全与功能修复（1-2 周）

1. 为 artifact-routes.ts 全部端点接入 authenticateUser + requirePermission
2. 修复 ArtifactStorage 的硬编码路径问题
3. 将 PromotionService 和 ArtifactOperationService 的内存降级模式改为强制 PostgreSQL
4. 修复 download 接口，返回实际文件流

### Phase 2：Build 模块真实化（2-3 周）

5. 在 build-env-routes.ts 中实例化 BuildxBuilderService、BuilderImageService、BuildCacheService
6. 注册 Buildx 和 K8sBuild 控制器的路由
7. 将 BuildCacheService 的三级级联逻辑完整接入控制器

### Phase 3：安全扫描真实化（1-2 周）

8. 替换 ArtifactScanService.generateFindings 的模拟逻辑，接入 Trivy/Grype
9. 将恶意检测从名称关键词匹配升级为行为分析

### Phase 4：制品仓库集成（2-3 周）

10. 实现 OCI Registry 客户端
11. 实现 SBOM 生成真实逻辑
12. 实现供应链签名/验签

### Phase 5：治理与自动化（1-2 周）

13. 实现制品生命周期自动化
14. 增加制品元数据 schema 校验
15. 增加上传大小限制 enforcement
16. 实现跨 Registry 复制

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/artifact/ArtifactRegistryService.ts` | 制品注册中心核心 | ⭐⭐⭐ |
| `repositories/ArtifactRepository.ts` | 数据访问层 | ⭐⭐⭐ |
| `models/Artifact.ts` | 领域模型 + 仓储接口 | ⭐⭐⭐ |
| `api/artifact-routes.ts` | 制品注册中心路由 | ⭐⭐⭐ |
| `services/artifact/PromotionService.ts` | 晋升状态机 | ⭐⭐⭐ |
| `services/pipeline/ArtifactVersionService.ts` | 版本溯源核心 | ⭐⭐⭐ |
| `repositories/ArtifactVersionRepository.ts` | 版本溯源数据访问 | ⭐⭐⭐ |
| `services/artifact-ops/ArtifactOperationService.ts` | 操作追踪 | ⭐⭐⭐ |
| `services/artifact-ops/ArtifactScanService.ts` | 安全扫描 | ⭐⭐⭐ |
| `services/artifact-ops/ArtifactRetentionService.ts` | 保留策略 | ⭐⭐⭐ |
| `api/build-env-routes.ts` | Build 环境路由 | ⭐⭐ |
| `storage/ArtifactStorage.ts` | 存储抽象层 | ⭐⭐ |

---

## 结论

**Artifact 注册中心 + 版本溯源** 是当前模块中完成度最高的子域，PostgreSQL 持久化完整，API 路由齐全。

**Build 环境模块** 停留在路由骨架 + Mock 响应阶段，核心 Service 层未与路由对接，是当前最大的功能空洞。

**安全扫描** 和 **恶意检测** 的数据是模拟生成的，存在 P0 级别的功能虚假风险。

**权限控制** 在 artifact-routes.ts 中完全缺失，是所有 P0 中最危险的安全缺陷。

建议优先填补权限缺口、修复存储实现、真实化 Build 模块和安全扫描。
