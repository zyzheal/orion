# ADR-014: Pipeline ArtifactBus 跨 Stage 传播方案

| 元数据 | |
|--------|------|
| 状态 | 提议中（Proposed）|
| 提出日期 | 2026-10-03 |
| 决策日期 | 待确认 |
| 提出人 | 架构团队 |
| 决策人 | 待确认 |
| 关联模块 | Automation / Pipeline |
| 前置依赖 | ADR-0007 Pipeline Engine 架构、ADR-005 数据库选型、ADR-011 多租户存储隔离 |
| 关联风险 | R-P0-01（StageExecutor artifact 传播破坏现有 pipeline）|
| 参考对标 | NeatLogic TaskHandler 生态（NL-2 一手：TaskHandlerType 10+ 类型）|

---

## 1. 背景与问题

### 1.1 决策背景

**风险登记册 R-P0-01**：StageExecutor artifact 传播破坏现有 pipeline

**需求场景**：
```
Pipeline Stage 1 (Build):  编译 → 产出 binary
Pipeline Stage 2 (Test):   消费 binary → 运行测试 → 产出报告
Pipeline Stage 3 (Deploy): 消费 binary + 报告 → 部署到 K8s
```

**当前 Orion 现状**：
- StageExecutor 只跑单个 stage
- Stage 之间通过 `pipeline_run.stages[i]` 的返回码关联
- **无跨 stage 的 artifact 传递机制**（Stage 2 无法拿到 Stage 1 的产物）

### 1.2 NeatLogic 一手（NL-2）

NeatLogic TaskHandler 生态通过 `TaskHandlerContext` 传递产物：
```java
public class TaskHandlerContext {
    private Map<String, Object> inputs;
    private Map<String, Object> outputs;  // 跨 Task 传递
    private Map<String, byte[]> artifacts;  // 二进制产物
}
```

### 1.3 决策驱动问题

**Q1**：Artifact 是否需要跨 stage 传播？
- 若"是"：Build → Test → Deploy 场景必需
- 若"否"：保持现有 StageExecutor，但能力受限

**Q2**：传播方式选择？
- 内存（channel）
- PG 持久化
- 对象存储（S3/MinIO）

**Q3**：破坏性风险如何控制？
- R-P0-01 明确标注"可能破坏现有 pipeline"
- 需要 feature flag 或渐进式方案

### 1.4 决策目标

- 决策 ArtifactBus 传播方案
- 明确与现有 StageExecutor 的兼容策略
- 定义破坏风险的控制措施

---

## 2. 备选方案对比

### 2.1 方案 A：内存 ArtifactBus（Go channel + map）

**实现**：
```go
type ArtifactBus struct {
    artifacts map[string]*Artifact  // key: pipeline_run_id + stage_id
    mu        sync.RWMutex
}

func (b *ArtifactBus) Publish(pipelineRunID, stageID string, artifact *Artifact) {
    b.mu.Lock()
    defer b.mu.Unlock()
    key := pipelineRunID + "/" + stageID
    b.artifacts[key] = artifact
}

func (b *ArtifactBus) Get(pipelineRunID, stageID string) (*Artifact, bool) {
    b.mu.RLock()
    defer b.mu.RUnlock()
    key := pipelineRunID + "/" + stageID
    a, ok := b.artifacts[key]
    return a, ok
}
```

**优点**：
- ✅ 实现简单
- ✅ 性能高（内存访问）
- ✅ 无外部依赖
- ✅ 现有 StageExecutor 可最小改造

**缺点**：
- ❌ 重启丢失（服务重启后 artifact 消失）
- ❌ 内存占用（大文件堆积）
- ❌ 多实例部署不共享（分布式 pipeline 场景失败）
- ❌ 无法审计（artifact 无持久记录）

### 2.2 方案 B：PG 持久化 Artifact

**实现**：
```sql
CREATE TABLE pipeline_artifacts (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    pipeline_run_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    name TEXT NOT NULL,              -- 'binary', 'report', 'log', ...
    content_type TEXT NOT NULL,      -- 'application/octet-stream'
    size_bytes BIGINT NOT NULL,
    content BYTEA NOT NULL,           -- 直接存 PG
    checksum TEXT,                     -- sha256
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE (pipeline_run_id, stage_id, name)
);

CREATE INDEX idx_pipeline_artifacts_run ON pipeline_artifacts(pipeline_run_id);
CREATE INDEX idx_pipeline_artifacts_stage ON pipeline_artifacts(pipeline_run_id, stage_id);
CREATE INDEX idx_pipeline_artifacts_expires ON pipeline_artifacts(expires_at);
```

**优点**：
- ✅ 数据持久（重启不丢）
- ✅ 多实例共享
- ✅ 可审计（PG WAL）
- ✅ 与 ADR-005 单库策略一致
- ✅ 事务一致性（artifact 与 pipeline_run 同事务）

**缺点**：
- ⚠️ PG 存储大文件性能下降（>10MB 建议外部存储）
- ⚠️ 事务持锁时间长（大文件写入）
- ⚠️ 需定期清理过期 artifact

### 2.3 方案 C：对象存储（S3/MinIO）

**实现**：
```go
type ArtifactBus struct {
    s3Client *s3.Client
    bucket   string
}

func (b *ArtifactBus) Publish(pipelineRunID, stageID, name string, content []byte) (string, error) {
    key := fmt.Sprintf("%s/%s/%s", pipelineRunID, stageID, name)
    result, err := b.s3Client.PutObject(ctx, &s3.PutObjectInput{
        Bucket: &b.bucket,
        Key:    &key,
        Body:   bytes.NewReader(content),
    })
    return result.Location, err
}

// PG 只存引用
CREATE TABLE pipeline_artifacts (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    pipeline_run_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    name TEXT NOT NULL,
    s3_key TEXT NOT NULL,             -- S3 object key
    size_bytes BIGINT NOT NULL,
    checksum TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);
```

**优点**：
- ✅ 大文件友好（无 PG 性能问题）
- ✅ 可扩展（S3 容量无上限）
- ✅ 事务与存储解耦（artifact 写入独立于 pipeline 事务）
- ✅ 可生命周期管理（S3 lifecycle policy 自动清理）

**缺点**：
- ⚠️ 引入新依赖（S3/MinIO）
- ⚠️ 违反 ADR-005 单库原则
- ⚠️ 一致性较弱（S3 写入成功但 PG 记录失败 → 孤立 artifact）
- ⚠️ 运维复杂度高（MinIO 部署）

### 2.4 方案 D：保持现状（不传播）

**优点**：
- ✅ 零改动
- ✅ 无破坏性风险

**缺点**：
- ❌ 无跨 stage 传播能力
- ❌ R-P0-01 无法解决
- ❌ Build/Test/Deploy 场景仍需人工干预

### 2.5 方案对比矩阵

| 维度 | A: 内存 | B: PG | C: S3 | D: 现状 |
|------|--------|-------|-------|---------|
| 实现复杂度 | 低 | 中 | 中 | 无 |
| 性能（小文件 <1MB）| ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | — |
| 性能（大文件 >10MB）| ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | — |
| 持久性 | ❌ | ✅ | ✅ | ❌ |
| 多实例共享 | ❌ | ✅ | ✅ | ❌ |
| 事务一致性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | — |
| 运维复杂度 | 低 | 低 | 高（MinIO 部署）| 低 |
| ADR-005 合规 | ✅ | ✅ | ❌ | ✅ |
| R-P0-01 缓解 | ✅ | ✅ | ✅ | ❌ |

---

## 3. 决策

### 3.1 选定方案

**方案 B：PG 持久化 Artifact**

理由：
1. **一致性优先**：与 pipeline_run 同事务，避免数据不一致
2. **合规 ADR-005**：不引入新依赖
3. **可审计**：PG WAL 记录所有 artifact 变更
4. **渐进式**：小文件友好，大文件未来可切方案 C
5. **多实例共享**：分布式 pipeline 场景必需

**限制**：
- 单个 artifact 上限 10MB（超过需切方案 C）
- 定期清理过期 artifact（7 天默认保留）

### 3.2 关键设计决定

#### 3.2.1 Migration 结构

**Migration 730**：`pipeline_artifacts` 表创建
```sql
CREATE TABLE pipeline_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    pipeline_run_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    content BYTEA NOT NULL,
    checksum TEXT,               -- sha256
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    UNIQUE (pipeline_run_id, stage_id, name)
);

CREATE INDEX idx_pipeline_artifacts_run ON pipeline_artifacts(pipeline_run_id);
CREATE INDEX idx_pipeline_artifacts_stage ON pipeline_artifacts(pipeline_run_id, stage_id);
CREATE INDEX idx_pipeline_artifacts_expires ON pipeline_artifacts(expires_at);
CREATE INDEX idx_pipeline_artifacts_tenant ON pipeline_artifacts(tenant_id);
```

**Migration 731**：pipeline_run 加 artifact_count 字段（可选）
```sql
ALTER TABLE pipeline_runs
  ADD COLUMN artifact_count INT DEFAULT 0;
```

#### 3.2.2 ArtifactBus 接口

```go
type Artifact struct {
    ID          string
    TenantID    string
    PipelineRunID string
    StageID     string
    Name        string
    ContentType string
    SizeBytes   int64
    Content     []byte
    Checksum    string
    Metadata    map[string]any
    ExpiresAt   time.Time
}

type ArtifactBus interface {
    // 发布 artifact
    Publish(ctx context.Context, a *Artifact) error
    
    // 获取 artifact
    Get(ctx context.Context, tenantID, pipelineRunID, stageID, name string) (*Artifact, error)
    
    // 列出 pipeline run 的所有 artifact
    List(ctx context.Context, tenantID, pipelineRunID string) ([]*Artifact, error)
    
    // 删除 artifact
    Delete(ctx context.Context, tenantID string, id string) error
    
    // 清理过期 artifact
    Cleanup(ctx context.Context) (int, error)  // 返回删除数量
}

// PG 实现
type PGArtifactBus struct {
    db *sql.DB
    maxSize int64  // 10MB
}

func (b *PGArtifactBus) Publish(ctx context.Context, a *Artifact) error {
    if int64(len(a.Content)) > b.maxSize {
        return ErrArtifactTooLarge
    }
    a.Checksum = sha256.Sum256(a.Content)
    // INSERT INTO pipeline_artifacts ...
    return nil
}
```

#### 3.2.3 StageExecutor 集成

**改造前**：
```go
type StageResult struct {
    ExitCode int
    Logs     string
}
```

**改造后**：
```go
type StageResult struct {
    ExitCode  int
    Logs      string
    Artifacts []*Artifact  // 新增
}

func (s *StageExecutor) Execute(ctx context.Context, stage *Stage) (*StageResult, error) {
    result, err := s.runner.Run(ctx, stage)
    if err != nil {
        return nil, err
    }
    
    // 新增：artifact 传播
    if s.artifactBus != nil && len(result.Artifacts) > 0 {
        for _, a := range result.Artifacts {
            a.PipelineRunID = s.pipelineRunID
            a.StageID = stage.ID
            a.TenantID = s.tenantID
            if err := s.artifactBus.Publish(ctx, a); err != nil {
                log.Warn("artifact publish failed", zap.Error(err))
            }
        }
    }
    
    return result, nil
}
```

#### 3.2.4 Feature Flag（R-P0-01 缓解）

**关键设计**：ArtifactBus 通过 feature flag 控制启用
```go
type ArtifactBusConfig struct {
    Enabled bool
    EnabledPipelineTypes []string  // 灰度：仅特定 pipeline 启用
}

func newArtifactBus(ctx context.Context, cfg ArtifactBusConfig) ArtifactBus {
    if !cfg.Enabled {
        return noopArtifactBus{}  // 空实现，不传播
    }
    return &PGArtifactBus{db: db, maxSize: 10 * 1024 * 1024}
}
```

**灰度策略**：
1. **Dev 环境**：全量启用
2. **Staging**：启用 + 观察 24h
3. **Prod-Canary**：仅对特定 pipeline 启用（白名单）
4. **Prod-Full**：全量启用（2 周后）

### 3.3 破坏风险控制

**R-P0-01 缓解措施**：

1. **Feature Flag**：默认关闭，逐步开启
2. **降级路径**：ArtifactBus.Publish 失败不阻断 stage 执行（仅 log warning）
3. **大小限制**：单 artifact 10MB 上限
4. **事务隔离**：artifact 发布失败不影响 pipeline_run 事务

**降级剧本**（若 artifact 传播破坏现有 pipeline）：
```bash
# 1. Feature flag 关闭
UPDATE feature_flags SET enabled=false WHERE key='artifact_bus';

# 2. 停止 artifact 发布
# (代码已通过 flag 判断，自动降级)

# 3. 清理已发布 artifact（可选）
DELETE FROM pipeline_artifacts WHERE created_at > now() - INTERVAL '1 hour';
```

---

## 4. 风险与缓解

### 4.1 已知风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 大文件写入阻塞 PG | 中 | 中 | 10MB 上限 + 未来切方案 C |
| Artifact 表膨胀 | 中 | 中 | 7 天过期 + 定期清理 |
| 破坏现有 pipeline | 中 | 高 | Feature flag + 灰度 + 降级剧本 |
| 多实例 artifact 重复 | 低 | 低 | UNIQUE 约束防重复 |
| Artifact 写入超时 | 低 | 中 | 事务超时 30s |

### 4.2 监控指标

| 指标 | 类型 | 阈值 |
|------|------|------|
| `pipeline_artifact_publish_total` | Counter | 按成功/失败分组 |
| `pipeline_artifact_publish_duration_ms` | Histogram | p99 > 5000ms 告警 |
| `pipeline_artifact_size_bytes` | Histogram | 按大小分组 |
| `pipeline_artifact_publish_failures_total` | Counter | >10/min 告警 |
| `pipeline_artifact_cleanup_deleted_total` | Counter | 按分钟分组 |
| `pipeline_artifact_expires_soon_count` | Gauge | > 100 告警 |

---

## 5. 影响面

### 5.1 对风险登记册的影响

- **R-P0-01**（StageExecutor artifact 传播破坏现有 pipeline）：本 ADR 通过 feature flag + 灰度 + 降级剧本缓解，**从 P0 降至 P1**（阻塞级 → 严重级）
- 新增 **R-P1-16**：Artifact 表膨胀（中-中）
- 新增 **R-P1-17**：大文件写入阻塞 PG（低-中）

### 5.2 对执行阶段的影响

| 阶段 | 影响 | 门控 |
|------|------|------|
| S0 基础设施 | 新增 Migration 730-731 | 必过 |
| S4 Automation | ArtifactBus 落地 + Feature flag | 必过 |
| S6 Alert | Alert 可消费 pipeline artifact | 可选 |
| 全局 | 定期清理 job 部署 | 必过 |

### 5.3 对 AA 数据模型设计的影响

- Migration 730-731 用于 ArtifactBus（原方案 728-729 是 automation artifact）
- Automation 相关 Migration 需重排

---

## 6. 与 NeatLogic 的对齐细节

### 6.1 语义对齐

| 概念 | NeatLogic | Orion ADR-014 |
|------|-----------|---------------|
| TaskContext | `Map<String, byte[]> artifacts` | `PipelineArtifact.content BYTEA` |
| 跨 Task 传递 | 通过 context 参数 | 通过 ArtifactBus 显式 Get |
| 大小限制 | 无（内存限制）| 10MB（PG 限制）|

### 6.2 差异点

| 维度 | NeatLogic | Orion ADR-014 |
|------|-----------|---------------|
| 存储 | 内存 | PG 持久化 |
| 大小 | 无限制 | 10MB 上限 |
| 生命周期 | Task 结束即清理 | 7 天保留 |
| 一致性 | 内存共享 | PG 事务 |

---

## 7. 相关 ADR

- **ADR-0007** Pipeline Engine 架构（StageExecutor 改造）
- **ADR-005** 数据库选型（PG 存储 artifact）
- **ADR-011** 多租户存储隔离（tenant_id 在 artifact 表）
- **ADR-012** Factory+Handler（TaskRunner 通过 Factory 注册）

---

## 8. 参考

- NL-2 一手证据：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` §Automation
- v5 综合报告：`cross-review-synthesis-2026-10-03-v5.md` §Automation
- 风险登记册：`risk-fallback-design-2026-10-03.md` R-P0-01
- AA 数据模型：`data-model-migration-design-2026-10-03.md` Migration 728-729

---

**文档编号**：`ADR-014-Pipeline-ArtifactBus-方案.md`
**下一步**：本 ADR 决策批准 → S4 阶段新增 ArtifactBus + Feature flag → 灰度上线
