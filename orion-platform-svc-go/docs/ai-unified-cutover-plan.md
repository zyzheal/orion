# Orion AI 统一切换计划（Unified Cutover Plan）

**文档版本**: v1.0
**生成日期**: 2026-07-17
**状态**: 草案（待评审）
**适用范围**: AI 域（`orion-platform-service/src/services/ai/*` + `services/ai-agents/*` + `services/ai-review/*` + `services/llm-trace/*` + `services/ai-training/*` + `services/mlops/*`）从 TypeScript 单体迁移至 Python 微服务（`orion-ai-service` + `orion-ai-agents-svc`）的完整切换方案。

---

## 一、概述

### 1.1 背景

AI 域迁移是 Orion 平台从 TypeScript 单体（`orion-platform-service`，端口 `:3001`）向微服务架构演进的关键一环。核心 AI 能力（LLM 网关、文本生成、Prompt 安全、向量搜索、Agent 框架、MLOps 等）将统一迁至两个 Python 服务：

| 目标服务 | 端口 | 职责 |
|---------|------|------|
| `orion-ai-service` | `:8000` | AI 核心引擎：LLM 网关、生成、安全、向量、MLOps、训练 |
| `orion-ai-agents-svc` | `:8001` | Agent 框架：BaseAgent、5 类专项 Agent、工具适配器 |

本计划覆盖五大领域：**数据库共存策略**、**网关灰度路由**、**TS 退役计划**、**部署顺序**、**监控告警**。

### 1.2 术语约定

| 术语 | 含义 |
|------|------|
| **TS** | 源端，TypeScript 单体服务（`orion-platform-service`） |
| **PY** | 目标端，Python 微服务（`orion-ai-service` + `orion-ai-agents-svc`） |
| **双写期** | TS 和 PY 同时接收写入请求的阶段 |
| **只读期** | TS 仅接收读请求、PY 接收全部请求的阶段 |
| **灰度** | 基于权重/租户的渐进式流量切换 |
| **一致性** | TS 与 PY 数据/行为的结果对等性 |
| **回滚** | 从 PY 切回 TS 的紧急操作 |

### 1.3 依赖文档

| 文档 | 路径 | 用途 |
|------|------|------|
| AI Python 迁移计划 | `docs/ai-python-migration-plan.md` | 端点映射、功能映射、迁移优先级 |
| Gray Release 服务 | `orion-api-gateway/src/services/gray-release.service.ts` | 灰度路由核心实现 |
| Gray Route 中间件 | `orion-api-gateway/src/middleware/gray-route.ts` | 灰度路由 Hook |
| Gray Config 定义 | `orion-api-gateway/src/config/gray-config.ts` | 灰度配置结构 |
| Gateway API 路由 | `orion-api-gateway/src/routes/api.ts` | 静态路由配置 |

### 1.4 当前路由现状（迁移前）

所有 AI 相关请求经 API Gateway（`:3000`）转发至 TS 单体（`:3001`）：

| Gateway 路由前缀 | 目标端口 | 说明 |
|-----------------|---------|------|
| `/api/v1/ai/*` | `:3012`（或 `:3001` fallback） | AI 核心端点（generate/chat/embed/search 等） |
| `/api/v1/ai-models/*` | `:3012` | AI 模型管理 |
| `/api/v1/ai-gateway/*` | `:3006` | AI 网关（智能决策） |
| `/api/v1/ai-decision/*` | `:3006` | AI 决策 |
| `/api/v1/ai-review/*` | `:3006` | AI 代码审查 |
| `/api/v1/ai-security/*` | `:3006` | Prompt 安全 |
| `/api/v1/agents/*` | `:3007` | Agent 服务 |
| `/api/v1/llm/*` | `:3012` | LLM 相关 |
| `/api/v1/vector-store/*` | `:3012` | 向量存储 |
| `/api/v1/training/*` | `:3012` | 训练任务 |
| `/api/v1/mlops/*` | `:3012` | MLOps |

---

## 二、数据库共存策略（DB Coexistence）

### 2.1 核心挑战

AI 域当前采用**内存 Map 存储**（无 PostgreSQL 持久化），迁移到 Python 服务后需首次引入持久化存储。这使得"双写期"具有特殊性——不是"同一份数据的双写"，而是"从无持久化到有持久化的平滑过渡"。

**两阶段数据策略**：

```
阶段 1（双写期）：TS 内存 + PY 内存 → 数据一致靠业务逻辑保证
阶段 2（持久化）：TS 内存 + PY PostgreSQL → 以 PY 为权威数据源
阶段 3（只读期）：TS 只读（降级兜底） + PY PostgreSQL（权威）
阶段 4（退役）：TS 完全下线，PY PostgreSQL 唯一数据源
```

### 2.2 Schema 分离方案

采用 **完全分离 Schema**，而非共享 Schema。理由：

1. **解耦**：TS 和 PY 的表结构演进互不影响
2. **迁移安全**：PY 独立建表，不触碰 TS 现有数据
3. **回滚简单**：回滚时不需要同步 Schema 变更

| 维度 | TS 侧 | PY 侧 |
|------|-------|-------|
| 存储类型 | 内存 Map（应用生命周期内） | PostgreSQL + pgvector |
| 表前缀 | 无（无表） | `ai_` |
| 连接方式 | 进程内对象引用 | SQLAlchemy AsyncSession |
| 迁移文件 | 无 | `migrations/050-056_ai_*.sql` |

**PY 服务表结构**（与 `docs/ai-python-migration-plan.md` §6.2 一致）：

```sql
-- 核心表（7 张）
ai_llm_providers          -- LLM 提供商配置
ai_model_versions         -- 模型版本管理
ai_generation_logs        -- 生成调用日志（含 prompt/response）
ai_embeddings             -- 向量嵌入存储（pgvector vector(1536)）
ai_training_jobs          -- 训练任务
ai_llm_traces             -- LLM 追踪记录
ai_agent_tasks            -- Agent 任务

-- 索引
CREATE INDEX idx_ai_embeddings_vector ON ai_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_ai_generation_logs_created ON ai_generation_logs (created_at DESC);
CREATE INDEX idx_ai_llm_traces_spent_tokens ON ai_llm_traces (spended_tokens DESC);
```

### 2.3 `_source` 列模式（Source Column Pattern）

所有 PY 持久化表包含 `_source` 列，标识数据写入来源，用于双写期间的数据一致性追踪：

```python
# orion-ai-service/src/models/base.py
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

class BaseModel(DeclarativeBase):
    __abstract__ = True

    id = Column(String(64), primary_key=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))

    # === 双写期安全列 ===
    _source = Column(String(16), nullable=False, default="py")  # "py" | "ts-sync" | "direct"
    _source_ref = Column(String(128), nullable=True)             # TS 侧对应的 id（双写同步时）
    _synced_at = Column(DateTime, nullable=True)                 # 最后同步时间戳
```

**取值说明**：

| `_source` 值 | 含义 | 场景 |
|-------------|------|------|
| `"py"` | Python 服务原生写入 | 直接调用 PY API |
| `"ts-sync"` | TS 侧同步写入 | 双写期 TS 写入后同步到 PY |
| `"direct"` | 管理员直接操作 | 数据修复/迁移脚本 |

### 2.4 双写期读写策略

#### 2.4.1 写策略（Write）

双写期内，每次写操作按优先级顺序执行：

```python
# orion-ai-service/src/services/dual_write.py
async def dual_write(request: WriteRequest) -> WriteResult:
    """双写期写入协调器"""
    try:
        # Step 1: 写入 PY（权威写入）
        py_result = await py_repository.upsert(request.entity)

        # Step 2: 同步写入 TS（通过 HTTP API，降级容忍）
        try:
            ts_result = await ts_http_client.upsert(request.entity)
            return WriteResult(py=py_result, ts=ts_result, status="ok")
        except TsWriteError as e:
            logger.warning("TS write failed, PY only", error=e)
            return WriteResult(py=py_result, ts=None, status="degraded")

    except PyWriteError as e:
        # PY 写入失败 → 降级到 TS（保证可用性）
        ts_result = await ts_http_client.upsert(request.entity)
        return WriteResult(py=None, ts=ts_result, status="fallback")
```

**降级规则**：

| 场景 | PY 写入 | TS 写入 | 返回给客户端 |
|------|---------|---------|------------|
| 正常 | 成功 | 成功 | 正常响应 |
| PY 失败 | 失败 | 成功（降级） | 正常响应 + warning header |
| TS 失败 | 成功 | 失败（容忍） | 正常响应（PY 是权威） |
| 两者失败 | 失败 | 失败 | 503 + retry hint |

#### 2.4.2 读策略（Read）

双写期内，读请求按阶段演进：

| 阶段 | 读来源 | 策略 | 一致性窗口 |
|------|--------|------|-----------|
| 双写期初期 | TS（默认）+ PY（对比） | 双读，日志记录差异 | 即时 |
| 双写期中期 | PY（默认）+ TS（fallback） | 以 PY 为准，PY 空读时读 TS | 即时 |
| 只读期 | TS 仅 fallback | 优先 PY，PY 不可用时降级 TS | 无 |
| 退役期 | PY 唯一 | 仅读 PY | 无 |

**读降级实现**（在 PY 服务的 API 层）：

```python
# orion-ai-service/src/api/dual_read.py
async def dual_read(entity_type: str, entity_id: str) -> Entity:
    """双读协调器"""
    try:
        entity = await py_repository.get(entity_type, entity_id)
        if entity:
            return entity
    except PyReadError:
        pass

    # 降级到 TS（仅双写期内有效）
    if settings.DUAL_READ_ENABLED:
        try:
            entity = await ts_http_client.get(entity_type, entity_id)
            # 回填到 PY（缓存预热）
            await py_repository.cache(entity)
            return entity
        except TsReadError:
            pass

    raise EntityNotFoundError(entity_type=entity_type, entity_id=entity_id)
```

### 2.5 一致性校验机制

双写期内每小时运行一次一致性校验（CronJob）：

```python
# orion-ai-service/src/services/consistency_checker.py
async def check_consistency() -> ConsistencyReport:
    """一致性校验：对比 PY 与 TS 的数据差异"""
    # 1. 枚举 PY 中所有实体类型
    entity_types = ["llm_provider", "model_version", "training_job", "agent_task"]

    discrepancies = []
    for etype in entity_types:
        py_entities = await py_repository.list_all(etype)
        ts_entities = await ts_http_client.list_all(etype)

        py_ids = {e.id for e in py_entities}
        ts_ids = {e.id for e in ts_entities}

        # PY 有但 TS 没有（正常：PY 新增）
        only_py = py_ids - ts_ids
        # TS 有但 PY 没有（异常：双写遗漏）
        only_ts = ts_ids - py_ids
        # 两边都有但值不同（异常：双写冲突）
        common = py_ids & ts_ids
        for eid in common:
            py_val = next(e for e in py_entities if e.id == eid)
            ts_val = next(e for e in ts_entities if e.id == eid)
            if py_val.updated_at != ts_val.updated_at:
                discrepancies.append(ConsistencyDiff(id=eid, type="value_mismatch"))

    return ConsistencyReport(discrepancies=discrepancies, only_py_count=len(only_py), only_ts_count=len(only_ts))
```

**告警阈值**：

| 指标 | 警告阈值 | 严重阈值 | 动作 |
|------|---------|---------|------|
| `only_ts_count`（PY 遗漏） | > 0 | > 5 | 自动重试同步 |
| `value_mismatch`（值不一致） | > 3 | > 10 | 阻断流量切换 |
| `ts_write_failure_rate`（TS 写失败率） | > 5% | > 20% | 降级到 PY-only |

---

## 三、网关路由策略（Gateway Routing）

### 3.1 灰度路由架构

基于已有的 `GrayReleaseService`（`orion-api-gateway/src/services/gray-release.service.ts`）实现 AI 域流量渐进式切换。

**架构层次**：

```
客户端请求
    │
    ▼
API Gateway (:3000)
    │
    ├── gray-route.ts (onRequest hook)
    │     │
    │     ├── GrayReleaseService.getTarget(path, request)
    │     │     │
    │     │     ├── Redis 热配置 (gray-release:config)  ← 优先
    │     │     ├── MODULE_ROUTING 环境变量降级
    │     │     └── 默认目标 (ts)
    │     │
    │     └── 设置响应头:
    │           X-Gray-Release-Source: redis | fallback | static
    │           X-Gray-Release-Target: ts | go | py
    │
    ▼
目标服务 (TS :3001 或 PY :8000/:8001)
```

### 3.2 Redis 配置 Schema

灰度配置存储于 Redis key `gray-release:config`，通过 channel `gray-release:config` 广播更新。

**AI 域灰度配置示例**（version 1.0，仅切 `/api/v1/ai/generate` 到 PY，权重 10%）：

```json
{
  "version": 1,
  "defaultTarget": "ts",
  "routeTargets": [
    {
      "path": "/api/v1/ai/generate",
      "target": "py",
      "weight": 10,
      "comment": "AI 生成端点，10% 流量切到 orion-ai-service:8000"
    },
    {
      "path": "/api/v1/ai/chat",
      "target": "py",
      "weight": 10
    },
    {
      "path": "/api/v1/mlops",
      "target": "py",
      "weight": 100,
      "comment": "MLOps 已完整迁移，全量切到 PY"
    },
    {
      "path": "/api/v1/training",
      "target": "py",
      "weight": 100,
      "comment": "Training 已完整迁移，全量切到 PY"
    },
    {
      "path": "/api/v1/ai/review",
      "target": "py",
      "weight": 100,
      "comment": "AI Review 已完整迁移，全量切到 PY"
    },
    {
      "path": "/api/v1/ai/traces",
      "target": "py",
      "weight": 100,
      "comment": "LLM Trace 已完整迁移，全量切到 PY"
    }
  ]
}
```

### 3.3 路由目标扩展

当前 `GrayReleaseService` 的目标为 `ts | go`。AI 迁移需扩展至 `ts | go | py`：

```typescript
// orion-api-gateway/src/config/gray-config.ts — 需新增字段
export interface GrayReleaseRuntimeConfig {
  // ... 现有字段 ...
  pyServiceUrl: string;       // 新增：Python AI 服务 URL（默认 http://localhost:8000）
  pyAgentsUrl: string;        // 新增：Python Agent 服务 URL（默认 http://localhost:8001）
}

export interface RouteTargetRef {
  path: string;
  target: 'ts' | 'go' | 'py';  // 扩展：支持 'py'
  weight: number;
  service?: 'ai' | 'agents';   // 新增：指定具体 PY 服务（ai → :8000, agents → :8001）
}
```

**target 到 URL 的映射**：

| target | service | 实际 URL |
|--------|---------|---------|
| `ts` | — | `GRAY_RELEASE_TS_SERVICE_URL` 或 `PLATFORM_SERVICE_URL`（默认 `:3001`） |
| `go` | — | `GRAY_RELEASE_GO_SERVICE_URL` 或 `PLATFORM_GO_SERVICE_URL`（默认 `:8080`） |
| `py` | `ai` | `GRAY_RELEASE_PY_SERVICE_URL`（默认 `:8000`） |
| `py` | `agents` | `GRAY_RELEASE_PY_AGENTS_URL`（默认 `:8001`） |

### 3.4 租户级路由 vs 百分比路由

灰度服务已内置两种路由模式：

#### 3.4.1 百分比路由（默认）

基于 `tenantId` 的 FNV-1a 32-bit 一致哈希：

```typescript
// gray-release.service.ts:449-459
private consistentHash(tenantId: string): number {
  if (!tenantId || tenantId === 'unknown') return 101; // 始终路由到 TS
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash ^= tenantId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash % 100;
}
```

**特点**：
- 同一 tenantId 始终路由到同一目标（会话亲和性）
- 修改 weight 时，只有跨哈希边界的租户会切换目标
- 未携带 `x-tenant-id` 的请求始终路由到 TS（安全默认）

#### 3.4.2 租户级显式路由

通过配置中的 `tenantOverrides` 字段实现（需扩展 `GrayReleaseConfig`）：

```json
{
  "version": 2,
  "defaultTarget": "ts",
  "routeTargets": [...],
  "tenantOverrides": {
    "tenant-alpha": { "target": "py", "reason": "Alpha 租户试点" },
    "tenant-beta":  { "target": "py", "reason": "Beta 租户试点" }
  }
}
```

**路由优先级**：

```
tenantOverrides（最高优先级）
    → header override (x-gray-release-override)
    → weight 一致哈希
    → defaultTarget（最低优先级）
```

### 3.5 Header 覆盖（调试用）

灰度服务支持 `x-gray-release-override` 请求头，用于调试：

```bash
# 强制路由到 PY
curl -H "x-gray-release-override: py" http://gateway:3000/api/v1/ai/generate \
  -d '{"prompt": "hello"}'

# 强制路由到 TS
curl -H "x-gray-release-override: ts" http://gateway:3000/api/v1/ai/generate \
  -d '{"prompt": "hello"}'

# 查看响应头确认路由
curl -v http://gateway:3000/api/v1/ai/generate 2>&1 | grep "X-Gray-Release"
# X-Gray-Release-Source: redis
# X-Gray-Release-Target: py
```

### 3.6 路由配置演进计划

| 阶段 | 配置变更 | 效果 |
|------|---------|------|
| **Phase 0** | 无灰度配置（空） | 所有 AI 流量走 TS（默认） |
| **Phase 1** | `mlops/training/review/llm-trace` weight=100 → py | 已完成的 4 个模块全量切 PY |
| **Phase 2** | `ai/generate` weight=10 → py | 10% 流量切 PY（P0 核心端点） |
| **Phase 3** | `ai/generate` weight=50 → py | 50% 流量切 PY |
| **Phase 4** | `ai/*` weight=100 → py | 全量切 PY |
| **Phase 5** | 移除所有 AI 路由规则 | 仅 PY 接收 AI 流量 |

**Redis 操作示例**：

```bash
# 写入灰度配置
redis-cli SET gray-release:config '{
  "version": 3,
  "defaultTarget": "ts",
  "routeTargets": [
    {"path": "/api/v1/ai/generate", "target": "py", "weight": 50}
  ]
}'

# 广播更新（所有网关实例自动生效，无需重启）
redis-cli PUBLISH gray-release:config '{
  "version": 3,
  "defaultTarget": "ts",
  "routeTargets": [
    {"path": "/api/v1/ai/generate", "target": "py", "weight": 50}
  ]
}'
```

---

## 四、TS 退役计划（TS Deprecation Plan）

### 4.1 退役原则

1. **分模块退役**：按 `ai-python-migration-plan.md` §2.2 优先级，P0→P1→P2 依次退役
2. **保留代码但禁用路由**：不删除文件，只移除路由注册和 barrel 导出
3. **可逆**：退役后 2 周内保留 `git revert` 能力
4. **测试先行**：每个模块退役前必须通过 E2E 回归

### 4.2 退役步骤（每模块）

#### Step 1：标记为 `[ARCHIVED]`

在每个待退役的 TS 文件顶部添加归档标记：

```typescript
/**
 * [ARCHIVED] — 此模块已迁移至 orion-ai-service (Python)。
 * 退役日期: 2026-07-XX
 * 替代实现: orion-ai-service/src/services/generation.py
 * 路由状态: 已禁用
 *
 * 保留原因: 2 周回滚窗口期内保留，之后可删除。
 */
export class AIGenerateService {
  // ... 原有代码保持不变 ...
}
```

#### Step 2：从 `routes.ts` 移除路由注册

找到 `orion-platform-service/src/api/routes.ts` 中所有 AI 相关路由注册，注释或移除：

```typescript
// orion-platform-service/src/api/routes.ts
//
// [ARCHIVED 2026-07-XX] 以下路由已迁移至 orion-ai-service (Python :8000)
// 迁移前路由：
//   aiRoutes.register(app)
//   aiModelsRoutes.register(app)
//   aiReviewRoutes.register(app)
//   aiTrainingRoutes.register(app)
//   aiMlopsRoutes.register(app)
//
// 迁移后：流量由 API Gateway 灰度路由到 orion-ai-service
//
// import { aiRoutes } from './ai-routes';           // 已禁用
// import { aiModelsRoutes } from './ai-models-routes'; // 已禁用
// import { aiReviewRoutes } from './ai-review-routes'; // 已禁用

// ... 其他路由保持不变 ...
```

#### Step 3：从 `index.ts` 移除 barrel 导出

移除 `orion-platform-service/src/services/ai/index.ts` 中的所有导出：

```typescript
// orion-platform-service/src/services/ai/index.ts
/**
 * [ARCHIVED] 此 barrel 文件已弃用。
 * AI 域服务已迁移至 orion-ai-service (Python)。
 */
// 以下导出已禁用：
// export { AIGenerateService } from './AIGenerateService';
// export { AIGateway } from './AIGateway';
// export { PromptSecurity } from './PromptSecurity';
// ...
```

#### Step 4：清理依赖引用

全局搜索并修复所有 import 路径：

```bash
# 在 orion-platform-service/src/ 中搜索被退役模块的 import
grep -rn "services/ai/" src/ --include="*.ts" | grep -v "__tests__"
grep -rn "services/ai-agents/" src/ --include="*.ts" | grep -v "__tests__"
grep -rn "services/ai-review/" src/ --include="*.ts" | grep -v "__tests__"
grep -rn "services/llm-trace/" src/ --include="*.ts" | grep -v "__tests__"
```

对于仍被引用的模块，改用 HTTP 调用 Python 服务：

```typescript
// 修改前：直接 import（进程内调用）
import { AIGenerateService } from '../services/ai/AIGenerateService';
const result = await aiGenerateService.generate(prompt);

// 修改后：HTTP 调用（跨服务调用）
import { http } from '../utils/http';
const result = await http.post('http://localhost:8000/api/v1/ai/generate', { prompt });
```

#### Step 5：删除测试文件（可选）

将 `__tests__/` 目录重命名为 `__tests__-archived/`，保留但排除出测试套件：

```bash
# 重命名测试目录
mv src/services/ai/__tests__ src/services/ai/__tests__-archived

# 在 jest.config.ts 中添加排除
testPathIgnorePatterns: [
  '/node_modules/',
  '/__tests__-archived/',
]
```

### 4.3 退役时间表

| 日期 | 退役模块 | 涉及文件 | 优先级 |
|------|---------|---------|--------|
| **Week 1** | MLOps、Training、AI Review、LLM Trace | `services/mlops/*`、`services/ai-training/*`、`services/ai-review/*`、`services/llm-trace/*` | P2 |
| **Week 2** | Prompt Security、AIGateway、AIGenerateService | `services/ai/PromptSecurity.ts`、`AIGateway.ts`、`AIGenerateService.ts`、`PromptInjectionDetector.ts`、`PromptSanitizer.ts` | P0 |
| **Week 3** | VectorStore、CodeEmbedding、SemanticSearch、MLInference、ModelVersion | `services/ai/VectorStore.ts`、`CodeEmbeddingService.ts`、`SemanticSearchService.ts`、`MLInferenceService.ts`、`ModelVersionService.ts`、`services/vector-store/*`、`services/model-version/*` | P1 |
| **Week 4** | Agent 框架（BaseAgent、ToolAdapter、5 类 Agent） | `services/ai-agents/base/*`、`services/ai-agents/monitoring/*`、`services/ai-agents/performance/*`、`services/ai-agents/pipeline/*`、`services/ai-agents/release/*` | P0/P1 |
| **Week 5** | CostOptimizer、AIDiagnosis、DecisionExplanation、RuleEngine、DegradationRouter | `services/ai/CostOptimizerService.ts`、`AIDiagnosisService.ts`、`DecisionExplanationService.ts`、`RuleEngine.ts`、`AIDegradationRouter.ts` | P2 |
| **Week 6** | services/ai/ 目录整体清理 | 确认无剩余引用后，整体移动至 `archived/services/ai/` | — |

### 4.4 退役检查清单

每模块退役前必须通过以下检查：

- [ ] PY 端点对应端点已部署并通过健康检查
- [ ] E2E 测试全量通过（至少覆盖核心 CRUD 路径）
- [ ] 灰度路由已配置为该模块 weight=100
- [ ] 一致性校验通过（`only_ts_count == 0`）
- [ ] 无其他 TS 模块仍 import 该模块（`grep -rn` 确认）
- [ ] 前端 API 客户端 baseURL 已切换（如适用）
- [ ] 已添加 `[ARCHIVED]` 标记
- [ ] 已从 `routes.ts` 移除注册
- [ ] 已从 `index.ts` 移除导出
- [ ] 已通知相关团队

---

## 五、部署顺序（Deployment Order）

### 5.1 部署总体流程

```
Day 0:  准备
Day 1:  Python 服务部署
Day 2:  Gateway 灰度配置上线
Day 3-7: 渐进式切流（P0 端点）
Day 8-14: 渐进式切流（P1 端点）
Day 15-21: 渐进式切流（P2 端点）
Day 22-28: TS 退役清理
Day 29-30: 最终验证 + 发布
```

### 5.2 预部署检查清单（Pre-deployment Checklist）

#### 5.2.1 Python 服务就绪检查

```bash
# 1. orion-ai-service 构建
cd /Users/heal/orion-design/orion-ai-service
pip install -r requirements.txt
pytest --tb=short -q   # 预期：全部通过

# 2. orion-ai-agents-svc 构建
cd /Users/heal/orion-design/orion-ai-agents-svc
pip install -r requirements.txt
pytest --tb=short -q   # 预期：全部通过

# 3. 数据库迁移
# 执行 migrations/050-056_ai_*.sql
psql $DATABASE_URL -f migrations/050_ai_llm_providers.sql
psql $DATABASE_URL -f migrations/051_ai_model_versions.sql
psql $DATABASE_URL -f migrations/052_ai_generation_logs.sql
psql $DATABASE_URL -f migrations/053_ai_embeddings.sql
psql $DATABASE_URL -f migrations/054_ai_training_jobs.sql
psql $DATABASE_URL -f migrations/055_ai_llm_traces.sql
psql $DATABASE_URL -f migrations/056_ai_agent_tasks.sql

# 4. 验证 pgvector 扩展
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'pgvector';"
# 预期输出：pgvector

# 5. 健康检查
curl -f http://localhost:8000/api/v1/ai/healthz
curl -f http://localhost:8001/api/v1/agents/healthz
```

#### 5.2.2 Gateway 就绪检查

```bash
# 1. 环境变量检查
echo $GRAY_RELEASE_ENABLED    # 预期: true
echo $GRAY_RELEASE_REDIS_URL  # 预期: redis://...
echo $GRAY_RELEASE_PY_SERVICE_URL    # 预期: http://localhost:8000
echo $GRAY_RELEASE_PY_AGENTS_URL     # 预期: http://localhost:8001

# 2. Redis 连接测试
redis-cli -h $REDIS_HOST PING  # 预期: PONG

# 3. Gateway 构建
cd /Users/heal/orion-design/orion-api-gateway
npm run build   # 预期：无错误

# 4. Gateway 健康检查
curl -f http://localhost:3000/healthz   # 预期: {status: "healthy"}
curl -f http://localhost:3000/readyz    # 预期: {status: "ready"}
```

#### 5.2.3 TS 服务就绪检查

```bash
# 1. TypeScript 编译
cd /Users/heal/orion-design/orion-platform-service
npm run build   # 预期：无类型错误

# 2. 测试套件
npm run test    # 预期：全部通过

# 3. 健康检查
curl -f http://localhost:3001/healthz
```

### 5.3 部署序列（Deployment Sequence）

#### Phase A：Python 服务部署（Day 1）

```bash
# Step A1: 启动 orion-ai-service
cd /Users/heal/orion-design/orion-ai-service
nohup uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4 &
sleep 5
curl -f http://localhost:8000/api/v1/ai/healthz || { echo "AI service failed"; exit 1; }

# Step A2: 启动 orion-ai-agents-svc
cd /Users/heal/orion-design/orion-ai-agents-svc
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4 &
sleep 5
curl -f http://localhost:8001/api/v1/agents/healthz || { echo "Agents service failed"; exit 1; }

# Step A3: 确认服务在进程列表中
ps aux | grep -E "uvicorn.*main:app" | grep -v grep
# 预期：2 个进程
```

**健康检查通过标准**：
- `GET /api/v1/ai/healthz` → 200 `{"status": "healthy"}`
- `GET /api/v1/ai/status` → 200 `{"status": "running"}`
- `GET /api/v1/agents/healthz` → 200 `{"status": "healthy"}`

#### Phase B：Gateway 灰度配置上线（Day 2）

```bash
# Step B1: 启用灰度发布
export GRAY_RELEASE_ENABLED=true

# Step B2: 写入初始灰度配置（仅已完成的模块）
redis-cli SET gray-release:config '{
  "version": 1,
  "defaultTarget": "ts",
  "routeTargets": [
    {"path": "/api/v1/mlops", "target": "py", "weight": 100},
    {"path": "/api/v1/training", "target": "py", "weight": 100},
    {"path": "/api/v1/ai/review", "target": "py", "weight": 100},
    {"path": "/api/v1/ai/traces", "target": "py", "weight": 100}
  ]
}'

# Step B3: 广播更新
redis-cli PUBLISH gray-release:config "$(redis-cli GET gray-release:config)"

# Step B4: 重启 Gateway（加载新环境变量）
pm2 restart orion-api-gateway 2>/dev/null || npm run dev

# Step B5: 验证灰度生效
curl -v http://localhost:3000/api/v1/mlops/register -d '{"name":"test"}' 2>&1 | grep "X-Gray-Release"
# 预期：X-Gray-Release-Target: py
```

**健康检查通过标准**：
- 网关 `readyz` 返回 200
- `X-Gray-Release-Target: py` 对已配置路径生效
- `X-Gray-Release-Target: ts` 对未配置路径生效

#### Phase C：渐进式切流（Day 3-21）

按以下节奏执行，每步间隔 3-5 天：

```
Day 3:  P0 端点 10% → /api/v1/ai/generate, /api/v1/ai/chat
Day 5:  P0 端点 50% → 同上
Day 7:  P0 端点 100% → 同上
Day 10: P1 端点 10% → /api/v1/ai/embed, /api/v1/ai/search, /api/v1/ai/models
Day 14: P1 端点 100% → 同上
Day 17: P2 端点 10% → /api/v1/ai/diagnose, /api/v1/ai/optimize-cost
Day 21: P2 端点 100% → 同上
```

每次切流后执行验证：

```bash
# 验证脚本：check-cutover.sh
#!/bin/bash
ENDPOINT=$1
WEIGHT=$2

echo "=== 验证 $ENDPOINT (weight=$WEIGHT) ==="

# 发送 100 次请求，统计路由分布
TS_COUNT=0
PY_COUNT=0
ERROR_COUNT=0

for i in $(seq 1 100); do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-gray-release-override:" \
    "http://localhost:3000$ENDPOINT/test" 2>/dev/null)
  
  HEADER=$(curl -s -D - -o /dev/null \
    "http://localhost:3000$ENDPOINT/healthz" 2>/dev/null | grep "X-Gray-Release-Target")
  
  if echo "$HEADER" | grep -q "py"; then
    PY_COUNT=$((PY_COUNT + 1))
  elif echo "$HEADER" | grep -q "ts"; then
    TS_COUNT=$((TS_COUNT + 1))
  else
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

echo "TS: $TS_COUNT | PY: $PY_COUNT | Error: $ERROR_COUNT"
echo "预期 PY ≈ $WEIGHT%"
```

#### Phase D：TS 退役清理（Day 22-28）

见 §4.3 退役时间表。

### 5.4 回滚触发条件（Rollback Triggers）

| 触发条件 | 阈值 | 回滚范围 | 执行时间 |
|---------|------|---------|---------|
| PY 服务错误率 | > 5%（5 分钟窗口） | 受影响端点 weight → 0 | 5 分钟内 |
| PY 服务 P99 延迟 | > 5s（3 个连续样本） | 受影响端点 weight → 0 | 10 分钟内 |
| TS 双写失败率 | > 20% | 降级为 PY-only 写 | 立即 |
| 一致性校验异常 | `only_ts_count > 5` | 阻断进一步切流 | 下一次切流前 |
| 数据库连接池耗尽 | connection pool 100% 使用 | PY 服务重启 + 扩容 | 15 分钟内 |
| Gateway 灰度配置异常 | Redis 不可用 > 30s | 自动降级到 MODULE_ROUTING | 自动 |

**回滚操作**：

```bash
# 紧急回滚：将所有 AI 流量切回 TS
redis-cli SET gray-release:config '{
  "version": 999,
  "defaultTarget": "ts",
  "routeTargets": [
    {"path": "/api/v1/ai", "target": "ts", "weight": 0}
  ]
}'
redis-cli PUBLISH gray-release:config "$(redis-cli GET gray-release:config)"

# 验证回滚
curl -v http://localhost:3000/api/v1/ai/generate 2>&1 | grep "X-Gray-Release-Target"
# 预期：X-Gray-Release-Target: ts
```

**回滚后动作**：
1. 检查 PY 服务日志定位问题
2. 修复后先走测试环境验证
3. 在低峰期重新执行灰度切流
4. 记录回滚事件到运维日志

---

## 六、监控与告警（Monitoring & Alerting）

### 6.1 关键指标定义

所有指标通过 Prometheus client 暴露，Gateway 和 PY 服务分别暴露到各自 `/metrics` 端点。

#### 6.1.1 Gateway 层指标

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `orion_gray_release_requests_total` | Counter | `target`, `path`, `source` | 灰度路由请求总数 |
| `orion_gray_release_latency_seconds` | Histogram | `target`, `path` | 灰度路由耗时分布 |
| `orion_gray_release_errors_total` | Counter | `target`, `path`, `status_code` | 灰度路由错误数 |
| `orion_gray_release_config_version` | Gauge | — | 当前灰度配置版本号 |
| `orion_gray_release_redis_connected` | Gauge | — | Redis 连接状态（1=连接，0=断开） |

```prometheus
# 示例
orion_gray_release_requests_total{target="py",path="/api/v1/ai/generate",source="redis"} 15234
orion_gray_release_latency_seconds_bucket{target="py",le="0.1"} 12000
orion_gray_release_config_version 5
orion_gray_release_redis_connected 1
```

#### 6.1.2 Python 服务层指标

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `orion_ai_requests_total` | Counter | `endpoint`, `status_code` | AI 服务请求数 |
| `orion_ai_request_duration_seconds` | Histogram | `endpoint` | 请求耗时 |
| `orion_ai_generation_tokens_total` | Counter | `provider`, `model` | 生成 token 数 |
| `orion_ai_llm_errors_total` | Counter | `provider`, `error_type` | LLM 调用错误 |
| `orion_ai_db_connection_pool_size` | Gauge | `db` | 数据库连接池大小 |
| `orion_ai_db_connection_pool_used` | Gauge | `db` | 已使用连接数 |
| `orion_ai_consistency_only_ts_count` | Gauge | `entity_type` | 一致性校验：TS 有 PY 无的实体数 |
| `orion_ai_dual_write_ts_failures_total` | Counter | `entity_type` | TS 双写失败次数 |

```prometheus
# 示例
orion_ai_requests_total{endpoint="/api/v1/ai/generate",status_code="200"} 15234
orion_ai_request_duration_seconds_bucket{endpoint="/api/v1/ai/generate",le="1.0"} 14500
orion_ai_consistency_only_ts_count{entity_type="llm_provider"} 0
```

### 6.2 告警规则

```yaml
# prometheus-rules.yaml
groups:
  - name: ai-cutover
    rules:
      # === 可用性告警 ===
      - alert: AI服务不可用
        expr: orion_gray_release_requests_total{target="py"} == 0
          and on() (time() - orion_ai_service_up) > 60
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "orion-ai-service 已接收灰度流量但无请求"
          description: "PY 服务可能无响应或连接池耗尽"

      - alert: PY服务错误率过高
        expr: |
          rate(orion_gray_release_errors_total{target="py",status_code=~"5.."}[5m])
          / rate(orion_gray_release_requests_total{target="py"}[5m])
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "PY 服务错误率 > 5%"
          description: "当前错误率: {{ $value | humanizePercentage }}"

      - alert: PY服务延迟过高
        expr: |
          histogram_quantile(0.99,
            rate(orion_gray_release_latency_seconds_bucket{target="py"}[5m]))
          > 5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "PY 服务 P99 延迟 > 5s"
          description: "当前 P99: {{ $value }}s"

      # === 一致性告警 ===
      - alert: 数据一致性问题
        expr: orion_ai_consistency_only_ts_count > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "数据一致性异常：TS 有但 PY 无的实体 > 5"
          description: "entity_type: {{ $labels.entity_type }}, count: {{ $value }}"

      - alert: 双写TS失败率过高
        expr: |
          rate(orion_ai_dual_write_ts_failures_total[5m])
          > 0
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "TS 双写持续失败（已降级为 PY-only）"
          description: "entity_type: {{ $labels.entity_type }}"

      # === 基础设施告警 ===
      - alert: Redis连接断开
        expr: orion_gray_release_redis_connected == 0
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Gateway Redis 连接断开"
          description: "已降级到 MODULE_ROUTING 环境变量"

      - alert: 数据库连接池接近耗尽
        expr: |
          orion_ai_db_connection_pool_used
          / orion_ai_db_connection_pool_size
          > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "数据库连接池使用率 > 90%"
          description: "used: {{ $value }} / {{ $labels.pool_size }}"

      # === 回滚建议告警 ===
      - alert: 建议回滚
        expr: |
          (rate(orion_gray_release_errors_total{target="py",status_code=~"5.."}[5m])
           / rate(orion_gray_release_requests_total{target="py"}[5m])
           > 0.05)
          or
          (histogram_quantile(0.99,
           rate(orion_gray_release_latency_seconds_bucket{target="py"}[5m]))
           > 5)
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "持续异常，建议执行回滚"
          description: "错误率或延迟已持续异常 10 分钟，执行回滚脚本"
```

### 6.3 Grafana 仪表盘配置

#### 6.3.1 灰度切流总览仪表盘

```json
{
  "dashboard": {
    "title": "AI Cutover — Gray Release Monitor",
    "uid": "ai-cutover",
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "流量分布（TS vs PY）",
        "type": "piechart",
        "targets": [
          {
            "expr": "rate(orion_gray_release_requests_total{target=\"py\"}[5m])",
            "legendFormat": "PY (Python)"
          },
          {
            "expr": "rate(orion_gray_release_requests_total{target=\"ts\"}[5m])",
            "legendFormat": "TS (TypeScript)"
          }
        ]
      },
      {
        "title": "PY 错误率（5 分钟窗口）",
        "type": "graph",
        "thresholds": [
          {"value": 0.02, "color": "yellow"},
          {"value": 0.05, "color": "red"}
        ],
        "targets": [
          {
            "expr": "rate(orion_gray_release_errors_total{target=\"py\",status_code=~\"5..\"}[5m]) / rate(orion_gray_release_requests_total{target=\"py\"}[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "title": "PY P99 延迟",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(orion_gray_release_latency_seconds_bucket{target=\"py\"}[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "数据一致性状态",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(orion_ai_consistency_only_ts_count)",
            "legendFormat": "TS-only entities"
          }
        ],
        "thresholds": [
          {"value": 0, "color": "green"},
          {"value": 1, "color": "yellow"},
          {"value": 5, "color": "red"}
        ]
      },
      {
        "title": "灰度配置版本",
        "type": "stat",
        "targets": [
          {
            "expr": "orion_gray_release_config_version",
            "legendFormat": "Config Version"
          }
        ]
      },
      {
        "title": "端点级流量热力图",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(orion_gray_release_requests_total{target=\"py\"}[1m])",
            "legendFormat": "{{path}}"
          }
        ]
      },
      {
        "title": "数据库连接池使用率",
        "type": "gauge",
        "targets": [
          {
            "expr": "orion_ai_db_connection_pool_used / orion_ai_db_connection_pool_size * 100",
            "legendFormat": "Pool Usage %"
          }
        ],
        "thresholds": [
          {"value": 50, "color": "green"},
          {"value": 80, "color": "yellow"},
          {"value": 90, "color": "red"}
        ]
      },
      {
        "title": "双写 TS 失败次数",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(orion_ai_dual_write_ts_failures_total[1h])",
            "legendFormat": "Failures (1h)"
          }
        ]
      }
    ]
  }
}
```

#### 6.3.2 告警面板

在仪表盘右上角配置告警通知：

| 告警级别 | 通知渠道 | 延迟要求 |
|---------|---------|---------|
| `critical` | 钉钉/Slack 群 + 短信 | 立即 |
| `warning` | 钉钉/Slack 群 | 5 分钟内 |
| `info` | 日志记录 | 不推送 |

### 6.4 可观测性链路

完整的请求追踪链路：

```
请求到达 Gateway
    │
    ├── gray-route hook: 记录路由决策
    │     → metric: orion_gray_release_requests_total
    │     → header: X-Gray-Release-Source, X-Gray-Release-Target
    │
    ├── proxy: 转发到 PY/TS
    │     → metric: orion_gray_release_latency_seconds
    │     → 错误: orion_gray_release_errors_total
    │
    └── PY 服务内部
          ├── LLM 调用追踪 (orion_ai_llm_errors_total)
          ├── 数据库操作追踪 (orion_ai_db_connection_pool_*)
          ├── 一致性校验 (orion_ai_consistency_only_ts_count)
          └── 双写状态 (orion_ai_dual_write_ts_failures_total)
```

---

## 七、验证清单（Verification Checklist）

### 7.1 切流前验证

| # | 检查项 | 方法 | 通过标准 |
|---|--------|------|---------|
| 1 | PY 服务健康检查 | `curl /api/v1/ai/healthz` | 200 OK |
| 2 | TS 服务健康检查 | `curl /api/v1/healthz` | 200 OK |
| 3 | Gateway 灰度配置生效 | `curl -v /api/v1/mlops/register 2>&1 \| grep X-Gray-Release` | `X-Gray-Release-Target: py` |
| 4 | Gateway 降级正常 | Redis 断开后发请求 | 自动降级到 TS |
| 5 | Header 覆盖有效 | `curl -H "x-gray-release-override: py"` | 强制路由到 PY |
| 6 | 数据库迁移完成 | `psql -c "\dt ai_*"` | 7 张表存在 |
| 7 | pgvector 扩展 | `psql -c "SELECT extname FROM pg_extension"` | `pgvector` 存在 |
| 8 | 一致性校验通过 | 运行 `consistency_checker.py` | `discrepancies == 0` |
| 9 | 前端 API 连通 | 前端 E2E 测试 | 全部通过 |
| 10 | Grafana 仪表盘加载 | 访问 `http://grafana/d/ai-cutover` | 所有 panel 有数据 |

### 7.2 切流中验证

| # | 检查项 | 频率 | 通过标准 |
|---|--------|------|---------|
| 1 | PY 错误率 < 5% | 每 5 分钟 | 连续 3 次通过 |
| 2 | PY P99 延迟 < 5s | 每 5 分钟 | 连续 3 次通过 |
| 3 | 数据一致性 | 每 1 小时 | `only_ts_count == 0` |
| 4 | 双写成功率 > 80% | 每 5 分钟 | 连续 3 次通过 |
| 5 | 无 5xx 响应 | 实时 | 0 |
| 6 | 数据库连接池 < 80% | 每 5 分钟 | 连续 3 次通过 |

### 7.3 切流后验证

| # | 检查项 | 方法 | 通过标准 |
|---|--------|------|---------|
| 1 | 所有 AI 流量已切到 PY | `curl -v` 检查响应头 | 100% `X-Gray-Release-Target: py` |
| 2 | TS 路由已禁用 | 直接调用 TS 端点 | 404 或无路由 |
| 3 | 前端功能正常 | 手动走一遍核心流程 | 无异常 |
| 4 | 回滚脚本就绪 | 测试执行回滚脚本 | 能切回 TS |

---

## 八、附录

### 8.1 环境变量速查表

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `GRAY_RELEASE_ENABLED` | `false` | 启用灰度发布 |
| `GRAY_RELEASE_REDIS_URL` | — | Redis 连接 URL |
| `GRAY_RELEASE_REDIS_KEY` | `gray-release:config` | Redis 配置键 |
| `GRAY_RELEASE_REDIS_CHANNEL` | `gray-release:config` | Redis 广播频道 |
| `GRAY_RELEASE_DEFAULT_TARGET` | `ts` | 默认目标 |
| `GRAY_RELEASE_GO_SERVICE_URL` | `http://localhost:8080` | Go 服务 URL |
| `GRAY_RELEASE_TS_SERVICE_URL` | `http://localhost:3001` | TS 服务 URL |
| `GRAY_RELEASE_PY_SERVICE_URL` | `http://localhost:8000` | Python AI 服务 URL（需新增） |
| `GRAY_RELEASE_PY_AGENTS_URL` | `http://localhost:8001` | Python Agent 服务 URL（需新增） |

### 8.2 端口总览

| 服务 | 端口 | 说明 |
|------|------|------|
| API Gateway | `:3000` | 入口网关 |
| TS 单体 | `:3001` | TypeScript 平台服务（源） |
| Python AI 服务 | `:8000` | orion-ai-service（目标） |
| Python Agent 服务 | `:8001` | orion-ai-agents-svc（目标） |
| Go 服务 | `:8080` | orion-platform-svc-go |

### 8.3 参考文件索引

| 文件 | 绝对路径 |
|------|---------|
| 灰度发布服务 | `/Users/heal/orion-design/orion-api-gateway/src/services/gray-release.service.ts` |
| 灰度路由中间件 | `/Users/heal/orion-design/orion-api-gateway/src/middleware/gray-route.ts` |
| 灰度配置定义 | `/Users/heal/orion-design/orion-api-gateway/src/config/gray-config.ts` |
| Gateway API 路由 | `/Users/heal/orion-design/orion-api-gateway/src/routes/api.ts` |
| AI Python 迁移计划 | `/Users/heal/orion-design/docs/ai-python-migration-plan.md` |
| Python AI 服务入口 | `/Users/heal/orion-design/orion-ai-service/src/main.py` |
| Python AI API 路由 | `/Users/heal/orion-design/orion-ai-service/src/api/routes.py` |
| Python AI 配置 | `/Users/heal/orion-design/orion-ai-service/src/config.py` |
| AI 模型管理路由（TS） | `/Users/heal/orion-design/orion-api-gateway/src/routes/ai-models.routes.ts` |

### 8.4 回滚脚本（`rollback-ai.sh`）

```bash
#!/bin/bash
# rollback-ai.sh — 紧急回滚所有 AI 流量到 TS
# 用法: ./rollback-ai.sh

set -euo pipefail

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "=== AI Cutover Rollback ==="
echo "时间: $(date -Iseconds)"

# Step 1: 写入全量 TS 配置
cat > /tmp/rollback-config.json << 'EOF'
{
  "version": 999,
  "defaultTarget": "ts",
  "routeTargets": [
    {"path": "/api/v1/ai", "target": "ts", "weight": 0},
    {"path": "/api/v1/ai-models", "target": "ts", "weight": 0},
    {"path": "/api/v1/mlops", "target": "ts", "weight": 0},
    {"path": "/api/v1/training", "target": "ts", "weight": 0},
    {"path": "/api/v1/ai-review", "target": "ts", "weight": 0},
    {"path": "/api/v1/agents", "target": "ts", "weight": 0},
    {"path": "/api/v1/llm", "target": "ts", "weight": 0},
    {"path": "/api/v1/vector-store", "target": "ts", "weight": 0}
  ]
}
EOF

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET gray-release:config "$(cat /tmp/rollback-config.json)"
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH gray-release:config "$(cat /tmp/rollback-config.json)"

echo "回滚配置已写入 Redis"

# Step 2: 验证回滚
sleep 2
RESPONSE=$(curl -s -D - -o /dev/null "http://localhost:3000/api/v1/ai/models" 2>/dev/null || true)
if echo "$RESPONSE" | grep -q "X-Gray-Release-Target: ts"; then
  echo "✅ 回滚成功：流量已切回 TS"
else
  echo "⚠️ 回滚后验证未通过，请手动检查"
fi

echo "=== 回滚完成 ==="
```
