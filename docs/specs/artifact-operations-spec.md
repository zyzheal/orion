# Spec: 制品运营 (Artifact Operations)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 制品运营
> **目标成熟度**: L1 → L2
> **关键交付**: 清理策略、归档管理、生命周期、存储分析、合规审计

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Artifact Registry API（制品 CRUD）
- 前端制品管理页面
- 制品上传/下载/删除基础能力
- 制品版本管理基础

**不足**：
- 无自动清理策略（制品堆积占用存储）
- 无归档机制（冷存储归档）
- 无制品生命周期管理（hot → warm → cold → deleted）
- 无存储用量分析与优化建议
- 无制品合规审计（哪些制品含敏感信息）
- 无跨 Registry 复制能力

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 清理策略 | 基于时间/数量/标签自动清理 | L2 |
| 归档管理 | 冷存储归档、恢复、检索 | L2 |
| 生命周期 | 制品全流程自动迁移 | L2 |
| 存储分析 | 用量分析、趋势、优化建议 | L2 |
| 合规审计 | 制品扫描、合规标签、审计追溯 | L1.5 |

## 二、验收标准

### 2.1 清理策略

| # | 标准 | 验证方式 |
|---|------|----------|
| AO1 | 支持清理策略：保留最近 N 个版本、保留 N 天、按标签保留 | API 测试 |
| AO2 | 清理策略按项目/仓库粒度配置 | API 测试 |
| AO3 | 清理策略支持 cron 定时执行和手动触发 | API 测试 |
| AO4 | 清理执行前生成预览（显示将被影响的制品列表和释放空间估算） | 前端验证 |
| AO5 | 清理操作记录完整日志（清理数量、释放空间、时间） | 单元测试 |

### 2.2 归档管理

| # | 标准 | 验证方式 |
|---|------|----------|
| AO6 | 支持将制品归档到 S3 兼容存储 | 集成测试 |
| AO7 | 归档制品保留元数据，可通过 API 搜索 | API 测试 |
| AO8 | 支持从归档恢复制品到热存储 | 集成测试 |
| AO9 | 归档操作异步执行，支持进度查看 | 前端验证 |
| AO10 | 归档制品自动设置过期时间，过期后自动删除 | 单元测试 |

### 2.3 生命周期管理

| # | 标准 | 验证方式 |
|---|------|----------|
| AO11 | 制品生命周期阶段：hot（热存储）→ warm（低频）→ cold（归档）→ deleted | 集成测试 |
| AO12 | 阶段转换规则可配置（如 30 天未访问→warm，90 天→cold） | API 测试 |
| AO13 | 生命周期转换自动执行，无需人工干预 | 集成测试 |
| AO14 | 生命周期状态变更可追溯（时间、操作类型、新旧状态） | 单元测试 |

### 2.4 存储分析

| # | 标准 | 验证方式 |
|---|------|----------|
| AO15 | 存储用量按项目/类型/时间维度统计 | 前端验证 |
| AO16 | 存储趋势图展示最近 30/90/180 天 | 前端验证 |
| AO17 | 自动识别可清理的大文件（> 1GB）和重复制品 | 前端验证 |
| AO18 | 存储优化建议（如"制品 X 已有 90 天未访问，建议归档"） | 前端验证 |

### 2.5 合规审计

| # | 标准 | 验证方式 |
|---|------|----------|
| AO19 | 制品上传时自动扫描敏感信息（密钥/密码/Token） | 集成测试 |
| AO20 | 含敏感信息的制品自动标记为"受限"，阻止非授权下载 | 集成测试 |
| AO21 | 制品合规审计日志完整（上传/下载/删除/清理/归档操作全记录） | 单元测试 |
| AO22 | 合规报告按时间段导出（谁、什么时间、操作了哪些制品） | API 测试 |

## 三、API 设计

```
Base: /api/v1/artifact-operations
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/policies` | 清理策略列表 |
| POST | `/policies` | 创建清理策略 |
| PUT | `/policies/:id` | 更新清理策略 |
| DELETE | `/policies/:id` | 删除清理策略 |
| POST | `/policies/:id/dry-run` | 策略模拟运行 |
| POST | `/policies/:id/execute` | 执行清理策略 |
| POST | `/archive` | 归档制品 |
| GET | `/archive` | 已归档制品列表 |
| POST | `/archive/:id/restore` | 恢复归档制品 |
| GET | `/lifecycle-rules` | 生命周期规则列表 |
| PUT | `/lifecycle-rules/:id` | 更新生命周期规则 |
| GET | `/storage-usage` | 存储用量分析 |
| GET | `/compliance-report` | 合规审计报告 |
| POST | `/scan` | 扫描制品敏感信息 |

## 四、数据模型

```sql
-- 清理策略
CREATE TABLE IF NOT EXISTS artifact_cleanup_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  project_id      UUID,
  repository_type VARCHAR(50) NOT NULL,
  rules           JSONB NOT NULL,
  schedule        VARCHAR(50) DEFAULT '0 2 * * *',
  enabled         BOOLEAN DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  last_cleaned_count INT DEFAULT 0
);

-- 归档制品
CREATE TABLE IF NOT EXISTS archived_artifacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id),
  original_artifact_id UUID,
  name                VARCHAR(500),
  version             VARCHAR(100),
  repository_type     VARCHAR(50),
  size_bytes          BIGINT,
  archive_location    VARCHAR(500),
  archived_at         TIMESTAMPTZ DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  restored            BOOLEAN DEFAULT false
);

-- 制品生命周期事件
CREATE TABLE IF NOT EXISTS artifact_lifecycle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     UUID NOT NULL,
  from_stage      VARCHAR(20) NOT NULL,
  to_stage        VARCHAR(20) NOT NULL,
  trigger_reason  VARCHAR(200),
  performed_by    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_artifact_lifecycle_events_artifact ON artifact_lifecycle_events(artifact_id);
```

## 五、前端设计

**路由**: `/artifact-operations`

主要页面：
- 运营总览页：存储用量、清理状态、归档统计
- 清理策略页：策略列表、创建/编辑、执行预览
- 归档管理页：归档列表、搜索、恢复
- 存储分析页：用量趋势、Top N 大文件、优化建议
- 合规审计页：敏感信息扫描结果、审计报告

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | CleanupEngine、ArchiveService、LifecycleManager、ComplianceScanner |
| 集成测试 | 6 | 清理策略→执行→验证、归档→恢复、生命周期完整流程 |
| 安全测试 | 2 | 敏感信息扫描准确率、合规审计完整性 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
