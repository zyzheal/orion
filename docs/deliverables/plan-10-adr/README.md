# Plan 10 — ADR 架构决策记录自动化

> **优先级**: P2
> **来源**: v3.5 系统评审
> **语言**: TS/Docs

## 本地代码扫描结果

- **本地已有**: `docs/adr/` — 22 个 ADR 文件 (0001~0015 + 历史 ADR-002~009)
- **缺口**:
  - 无 arc42 标准模板生成器
  - 无 ADR 覆盖率审计工具
  - 15 个 ADR 中 7 个标注"待补充"
  - 无自动化 ADR 状态追踪 (proposed/accepted/deprecated/superseded)

## 设计方案

### 1. ADR 模板 (arc42 格式)

```markdown
# ADR-XXXX: {标题}

| 字段 | 值 |
|------|-----|
| 状态 | proposed / accepted / deprecated / superseded |
| 日期 | YYYY-MM-DD |
| 决策者 | {角色} |
| 相关 ADR | {ADR-XXXX} (可选) |

## 1. 背景
{问题描述、驱动因素}

## 2. 约束
{技术/业务/合规约束列表}

## 3. 决策
{选择的方案 + 理由}

## 4. 备选方案
{每个备选方案 + 否决理由}

## 5. 影响
{正面/负面影响、风险、后续行动}

## 6. 验证
{如何验证决策有效性的检查点}
```

### 2. ADR 生成器 (CLI)

```typescript
interface ADRGenerator {
  generate(title: string, options: ADROptions): string;
  nextNumber(): number;
  updateStatus(adrID: string, status: ADRStatus): void;
  detectSuperseded(): SupersedeLink[];
}

interface ADRStatus {
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  supersededBy?: string;
}

interface SupersedeLink {
  from: string;
  to: string;
  reason: string;
}
```

### 3. ADR 覆盖率审计

```typescript
interface ADRAuditReport {
  total: number;
  byStatus: Record<ADRStatus['status'], number>;
  pending: string[];          // "待补充" 列表
  orphans: string[];          // 无反向引用的 superseded
  missingDecisions: string[]; // 重大架构变更但无对应 ADR
  coverageScore: number;      // 0-100
}
```

### 4. 待补充 ADR 清单 (基于本地扫描)

| 编号 | 主题 | 状态 |
|------|------|:----:|
| 006 | Saga 分布式事务补偿 | 待补充 |
| 007 | Pipeline Engine 架构 | 待补充 |
| 008 | Feature Flag 系统 | 待补充 |
| 009 | Gin 中间件栈设计 | 待补充 |
| 010 | API 网关架构 | 待补充 |
| 011 | OTel 可观测性集成 | 待补充 |
| 012 | Prometheus 监控 | 待补充 |
| 013 | 微前端迁移 | 待补充 |

### 5. CI 集成

```yaml
# .github/workflows/adr-check.yml
- name: ADR Coverage Check
  run: npx adr-tools check --min-coverage 80 --require-status accepted
```

## 与本地代码的关系

- 复用已有 `docs/adr/` 目录结构和编号体系
- 生成的 ADR 文件直接写入 `docs/adr/` 目录
- 审计工具扫描 `docs/adr/*.md` 提取状态字段
