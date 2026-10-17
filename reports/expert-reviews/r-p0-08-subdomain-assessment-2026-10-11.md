# R-P0-08 子域过度设计评估

**日期**: 2026-10-11  
**风险项**: R-P0-08 — 5 新子域过度设计 / 与现有 pipeline 生态不兼容  
**结论**: 全部 5 个新子域与现有模块重叠，不应创建

## 1. 评估方法

逐个检查 automation-upgrade-design-2026-10-03.md §4.1 提出的 5 个新子域，对比现有代码库中已存在的模块，判断功能重叠度。

## 2. 逐项分析

### 2.1 automation-catalog vs service-catalog

| 维度 | automation-catalog (提案) | service-catalog (现有) |
|------|--------------------------|----------------------|
| 路径 | `/api/v1/automation/catalog/*` | `/api/v1/service-catalogs/*` |
| 模型 | 服务条目 + 分类 | ServiceCatalog(id, name, value, enabled) |
| 代码 | 未创建 | 已有 models/handler/repository/service |
| 重叠度 | **100%** — 服务目录功能完全已由 service-catalog 模块覆盖 |

### 2.2 automation-scenario vs autonomous-pipeline

| 维度 | automation-scenario (提案) | autonomous-pipeline (现有) |
|------|--------------------------|--------------------------|
| 路径 | `/api/v1/automation/scenarios/*` | `/api/v1/autonomous-pipelines/*` |
| 模型 | 可组合自动化场景模板 | Record(id, name, status, metadata, config) |
| 代码 | 未创建 | 已有 models/handler/repository/service + 测试 |
| 重叠度 | **~90%** — 场景模板 = 自治管线的子集，metadata+config 已覆盖组合参数 |

### 2.3 automation-profile vs env-profile

| 维度 | automation-profile (提案) | env-profile (现有) |
|------|--------------------------|------------------|
| 路径 | `/api/v1/automation/profiles/*` | `/api/v1/env-profiles/*` |
| 模型 | 可复用变量集 | EnvProfile(id, name) |
| 代码 | 未创建 | 已有 models/handler/repository/service |
| 重叠度 | **100%** — 配置模板 = 环境配置文件，现有模块已覆盖 |

### 2.4 automation-combop vs pipeline-batch-operations

| 维度 | automation-combop (提案) | pipeline-batch-operations (现有) |
|------|--------------------------|--------------------------------|
| 路径 | `/api/v1/automation/combops/*` | `/api/v1/pipeline-batch-operations/*` |
| 模型 | 多 pipeline 组合操作 | 批量操作(多管线编排) |
| 代码 | 未创建 | 已有 models/handler/repository/service |
| 重叠度 | **~85%** — 组合操作 = 批量操作的子集，现有模块已依赖 pipelineSvc 做编排 |

### 2.5 automation-customtemplate vs pipeline-templates

| 维度 | automation-customtemplate (提案) | pipeline-templates (现有, R-P0-06 刚合并) |
|------|--------------------------------|---------------------------------------|
| 路径 | `/api/v1/automation/custom-templates/*` | `/api/v1/pipeline-templates/*` |
| 模型 | 用户自定义模板 | PipelineTemplate(id, name, displayName, status, visibility, category, config, parameters, tags, version, readme, icon, ...) |
| 代码 | 未创建 | 已有完整 CRUD + publish/deprecate/versions/star/instantiate |
| 重叠度 | **100%** — 自定义模板 = 管线模板，现有模块功能远超提案 |

## 3. 结论

| 新子域 | 重叠模块 | 重叠度 | 处置 |
|--------|---------|--------|------|
| automation-catalog | service-catalog | 100% | 不创建，复用 service-catalog |
| automation-scenario | autonomous-pipeline | 90% | 不创建，扩展 autonomous-pipeline |
| automation-profile | env-profile | 100% | 不创建，复用 env-profile |
| automation-combop | pipeline-batch-operations | 85% | 不创建，扩展 pipeline-batch-operations |
| automation-customtemplate | pipeline-templates | 100% | 不创建，复用 pipeline-templates |

**5/5 新子域均为过度设计**。所有功能可由现有模块覆盖或通过扩展现有模块实现。

## 4. 建议行动

1. **不创建** 任何 5 个新子域目录
2. **不创建** 对应的 721-728 迁移文件
3. automation-upgrade-design 文档应标注 5 新子域章节为 "已评估, 不执行"
4. 如需服务目录/场景/配置模板/组合操作/自定义模板功能, 扩展现有模块而非新建

## 5. 风险降级建议

R-P0-08 从 P0 降级为 **已关闭**（非 P1），因为评估结论为"不执行"，无执行风险。
