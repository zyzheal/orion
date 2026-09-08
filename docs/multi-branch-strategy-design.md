# 多分支并行部署策略设计（Multi-Branch Deployment Strategy）

> 文档版本：v1.0  
> 创建日期：2026-08-26  
> 状态：待评审  
> 目标：解决 Git 仓库下多个长期分支并行维护、独立编译部署、避免部署错乱的完整方案

---

## 1. 背景与问题定义

### 1.1 场景描述
一个 Git 仓库下存在多个长期分支（release/*、customer/*、lts/*），每个分支：
- 承载独立个性化功能，需要长期维护
- 需要独立的编译部署流水线
- 需要独立的环境隔离
- 不允许与其他分支的构建产物混用

### 1.2 核心痛点
| # | 痛点 | 后果 |
|---|---|---|
| 1 | 分支合并冲突难以预知 | 上线延迟 / 人工介入 |
| 2 | 多分支部署互相干扰 | 环境数据污染 |
| 3 | Image tag 复用导致二进制串用 | 严重线上事故 |
| 4 | 分支回滚时误拉取其他分支产物 | P0 事故 |
| 5 | Hotfix 合入 main 后忘记同步到 release/* | 用户看到不一致行为 |

### 1.3 适用边界
- ✅ 长期分支（生命周期 > 1 个月）
- ✅ 多租户 SaaS / 政企定制 / LTSS 版本
- ❌ 短期 feature 分支（应走 trunk-based + feature flag）

---

## 2. 现状审计

### 2.1 Orion 当前覆盖
| 能力 | 位置 | 覆盖度 |
|---|---|---|
| 单分支 Pipeline 触发 | `pipelines/[id]/runs` | ✅ |
| Pipeline 版本历史 + 回滚 | `pipeline-svc/PipelineVersionHistory` (Phase 228) | ✅ |
| 变更管理 | `ChangeManagement` | ⚠️ 缺分支字段 |
| GitOps / ArgoCD | `OpsTools`、`GatewayRoutes` | ⚠️ 部分 |
| 代码管理 | `CodeMgmt` | ✅ |
| 分支 → 环境映射 | ❌ | ❌ |
| 制品 digest 强制 | ❌ | ❌ |
| 同步策略自动化 | ❌ | ❌ |
| 冲突预检查 | ❌ | ❌ |

### 2.2 差距等级
- **P0（必须立即解决）**：制品 digest 强制、分支-环境强绑定
- **P1（近期解决）**：分支语义化、同步策略、冲突预检查
- **P2（长期完善）**：审计扩展、指标监控

---

## 3. 设计目标

### 3.1 功能目标
1. 支持任意数量的长期分支并行
2. 每个分支的构建产物独立、不可互用
3. 部署错乱自动阻断
4. 分支合并冲突提前预知
5. 主干变更自动同步到长期分支

### 3.2 非功能目标
- 部署防错零漏报（准确率 ≥ 99.99%）
- 分支管理自动化（人工介入率 < 10%）
- 冲突预检查覆盖率 ≥ 95%

---

## 4. 架构设计（五层防护）

```
┌───────────────────────────────────────────────┐
│ L5 变更审计层  DeployEvent (可追溯)             │
├───────────────────────────────────────────────┤
│ L4 同步策略层  SyncPolicy (自动化)              │
├───────────────────────────────────────────────┤
│ L3 制品指纹层  BuildArtifact (不可篡改)         │
├───────────────────────────────────────────────┤
│ L2 环境隔离层  Namespace (物理隔离)             │
├───────────────────────────────────────────────┤
│ L1 分支语义层  BranchProfile (元数据)           │
└───────────────────────────────────────────────┘
```

### 4.1 L1 - 分支语义层（BranchProfile）

每个分支必须携带显式语义：

```ts
interface BranchProfile {
  name: string;              // 'release/enterprise-2026'
  semantic: 'main' | 'release' | 'hotfix' | 'lts' | 'customer-custom';
  owner: string;             // 负责人
  ltsUntil?: string;         // LTS 截止日期
  mergeTargets: string[];    // 允许合入哪些分支
  mergeSources: string[];    // 允许从哪些分支同步
  protectedEnv: string[];    // 绑定到哪些环境
  createdAt: string;
  archivedAt?: string;
}
```

**校验规则**：
- `semantic !== 'main'` 且 `mergeTargets` 为空 → 拒绝
- `semantic === 'lts'` 必须指定 `ltsUntil`
- 分支创建必须走审批（ChangeManagement 集成）

### 4.2 L2 - 环境隔离层（Namespace）

每个"分支 × 环境"组合落到独立命名空间：

| 资源 | 命名规则 | 示例 |
|---|---|---|
| Image | `registry/orion:${branch}-${commit}` | `orion:release-ent-abc1234` |
| K8s Namespace | `orion-${branch}` | `orion-release-ent` |
| Config Namespace | `nacos/orion-${branch}` | Nacos 命名空间 |
| Database | `orion_${branch}` | Postgres 数据库 |
| MQ Topic | `orion-${branch}-*` | Kafka topic 前缀 |
| Redis Key | `orion:${branch}:*` | Redis key prefix |

**强制校验**：部署前 image tag 前缀必须匹配目标环境的 branch 声明。

### 4.3 L3 - 制品指纹层（BuildArtifact）

每个构建产物携带不可变元数据：

```ts
interface BuildArtifact {
  imageDigest: string;       // sha256:xxx（不可变，防 tag 覆盖）
  imageTag: string;          // 人类可读标签
  branch: string;            // 构建时分支
  commitSha: string;         // Git commit
  builtAt: string;
  buildPipeline: string;     // 构建的 pipeline id
  targetEnv: string;         // 允许部署到哪
  signedBy: string;          // 签名（防篡改）
  checksums: {
    binary: string;
    config: string;
    migrations: string;
  };
}
```

**关键原则**：
1. **只信 digest，不信 tag** —— 部署 API 只接受 digest 参数
2. **签名强制** —— 未签名产物拒绝部署
3. **元数据不可改** —— 部署后 digest → branch 关系不可变

### 4.4 L4 - 同步策略层（SyncPolicy）

分支间的定期同步：

```ts
interface SyncPolicy {
  id: string;
  source: string;            // 源分支
  targets: string[];         // 目标分支列表
  frequency: 'daily' | 'weekly' | 'monthly';
  strategy: 'rebase' | 'cherry-pick' | 'merge';
  autoResolve: 'none' | 'skip-conflict' | 'manual-required';
  notifyOnConflict: string[]; // 冲突时通知谁
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'conflict' | 'failed';
}
```

**关键原则**：
- `autoResolve === 'manual-required'` 时冲突必须阻断
- 同步触发后立即跑测试 Pipeline
- 失败自动告警，不允许静默失败

### 4.5 L5 - 变更审计层（DeployEvent）

所有"分支 → 环境"变更留下不可伪造轨迹：

```ts
interface DeployEvent {
  id: string;
  timestamp: string;
  actor: string;             // 执行人
  branch: string;
  env: string;
  fromCommit: string;        // 变更前
  toCommit: string;          // 变更后
  imageDigest: string;
  approvalId: string;        // ChangeManagement 变更单 id
  outcome: 'success' | 'rolled-back' | 'failed';
  rollbackTo?: string;
  duration: number;          // 部署耗时
  metrics: {
    errorRate: number;
    p99Latency: number;
  };
}
```

**关键原则**：
- 双向可追溯：环境 → 分支、分支 → 环境
- 变更单审批必须存在
- 支持一键回滚到 `rollbackTo` 指定的 commit

---

## 5. 部署错乱防护规则

### 5.1 阻断规则（Pre-deploy Gate）

| # | 规则 | 触发条件 | 处置 |
|---|---|---|---|
| R1 | Branch-Env 匹配 | image tag 前缀 ≠ 目标 env 的 branch | 拒绝部署 |
| R2 | Digest 完整性 | imageDigest 未签名 | 拒绝部署 |
| R3 | 变更单审批 | approvalId 缺失或未审批 | 拒绝部署 |
| R4 | 分支状态 | 分支已 archived | 拒绝部署 |
| R5 | Pipeline 匹配 | buildPipeline 不在 branch 的 allowedPipelines | 拒绝部署 |
| R6 | Schema 兼容 | DB migration 版本回退 | 拒绝部署 |

### 5.2 同步规则（Post-merge Sync）

| # | 规则 | 触发条件 | 处置 |
|---|---|---|---|
| S1 | 主干同步 | main 有新 commit | 按 SyncPolicy 同步到 targets |
| S2 | Hotfix 广播 | hotfix/* 合入 main | 强制同步到所有 release/* 和 lts/* |
| S3 | 依赖锁定 | lockfile 变更 | 通知所有下游分支负责人 |
| S4 | 冲突告警 | 同步失败 | 通知 owner，阻断下次同步 |

---

## 6. 页面与 API 设计

### 6.1 新增页面

| 页面 | 路径 | 功能 |
|---|---|---|
| 分支画像管理 | `/devops/branch-profiles` | 分支语义 CRUD + 状态看板 |
| 多分支部署矩阵 | `/devops/branch-deployments` | 分支 × 环境矩阵视图 |
| 同步策略管理 | `/devops/sync-policies` | 同步规则 CRUD + 历史 |
| 冲突预检查 | `/devops/merge-preview` | 分支合并冲突预览 |
| 部署审计 | `/devops/deploy-audit` | 变更事件查询 + 追溯 |

### 6.2 新增 API

```
GET/POST    /api/v1/branch-profiles
GET/PUT     /api/v1/branch-profiles/:id
GET/POST    /api/v1/deploy-events
POST        /api/v1/deploy-events/rollback
GET/POST    /api/v1/sync-policies
POST        /api/v1/sync-policies/:id/run-now
POST        /api/v1/merge-preview        # 冲突预检查
GET         /api/v1/build-artifacts      # 制品清单
POST        /api/v1/build-artifacts/sign # 制品签名
```

### 6.3 扩展现有 API

| API | 新增字段 |
|---|---|
| `triggerPipeline` | `branchProfileId`（可选但推荐） |
| `ChangeManagement.create` | `targetBranches[]` |
| `CodeMgmt.createMR` | `conflictPreview`（自动计算） |

---

## 7. 实施路线图

### Phase 231：基础数据模型（L1 + L3）
- 新建 `BranchProfile` API + 页面
- 新建 `BuildArtifact` digest 强制
- **预估工时**：3 人日

### Phase 232：环境隔离强化（L2）
- 部署 API 强校验 image tag 前缀
- Namespace 命名规则强制
- **预估工时**：2 人日

### Phase 233：同步策略（L4）
- 新建 `SyncPolicy` 页面 + 自动化调度
- 集成 ChangeManagement 通知
- **预估工时**：3 人日

### Phase 234：变更审计（L5）
- `DeployEvent` 审计增强
- 一键回滚能力
- **预估工时**：2 人日

### Phase 235：冲突预检查（L1 增强）
- `CodeMgmt.createMR` 集成冲突预览
- 冲突文件列表可视化
- **预估工时**：2 人日

**总预估**：12 人日

---

## 8. 参考架构

- AWS CodeCatalyst：Branch → Pipeline 强绑定
- GitLab Protected Branches：分支语义化
- GitHub Environments：环境保护规则
- ArgoCD：应用级 deployment 隔离
- ByteDance 一码多形态：编译期 flag（作为对比方案）

---

## 9. 评审要点

1. 是否覆盖所有错乱场景？（见 §1.2 + §5.1）
2. 是否可自动化？（见 §4.4 + §5.2）
3. 是否有可回滚的兜底？（见 §4.5）
4. 是否可观测？（见 DeployEvent metrics）
5. 是否与 Orion 现有模块兼容？（见 §6.3）

---

**下一步**：等待架构评审通过后，按 §7 路线图启动 Phase 231 实施。
