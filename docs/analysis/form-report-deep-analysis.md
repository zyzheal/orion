# 表单与报表设计（Form & Report Designer）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/form/` + `report-designer/` + 相关路由

---

## 模块概览

Form & Report Designer 模块承担**动态表单定义与实例化、报表设计器（可视化）、数据源绑定、定时调度**四大职责。当前实现已完成 PostgreSQL 持久化迁移，核心 CRUD 功能完整。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 表单定义管理 | `services/form/FormService.ts` + `FormRepository.ts` | ✅ PostgreSQL |
| 表单字段定义 | `FormService.createDefinition()` + 字段 CRUD | ✅ PostgreSQL |
| 表单实例 | `FormService.createInstance()` + 提交管理 | ✅ PostgreSQL |
| 表单验证 | `FormService.validateInstance()` | ✅ 规则验证 |
| 报表定义 | `services/report-designer/ReportDesignerService.ts` | ✅ PostgreSQL |
| 报表数据源 | `services/report-designer/ReportDatasourceRepository.ts` | ✅ PostgreSQL |
| 报表调度 | `services/report-designer/ReportScheduleRepository.ts` | ✅ PostgreSQL |
| 报表执行 | `services/report-designer/ReportExecutionRepository.ts` | ✅ PostgreSQL |
| 报表布局 | `components/layout` 可视化设计 | ⚠️ 服务层完整，前端待验证 |

---

## 架构设计

### 分层结构

```
API Routes (form-routes.ts, report-designer-routes.ts)
    ↓
Controllers (FormController, ReportDesignerController)
    ↓
Service Layer (FormService, ReportDesignerService)
    ↓
Repository Layer (FormRepository, ReportDefinitionRepository, 
                   ReportDatasourceRepository, ReportScheduleRepository,
                   ReportExecutionRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **表单模板实例化**：Form Definition（模板）+ Form Instance（实例）分离
- **字段级权限**：每个 FormField 可配置可见性/可编辑性
- **报表数据源绑定**：ReportDefinition 绑定多个 Datasource，支持动态刷新
- **调度执行**：ReportSchedule 支持 Cron 表达式定时生成报表

---

## 功能完整性评估

### 动态表单

| 功能 | 状态 | 说明 |
|------|------|------|
| 表单定义 CRUD | ✅ | 创建/查询/更新/删除表单模板 |
| 字段管理 | ✅ | 支持多种字段类型（text/select/date/number） |
| 字段排序 | ✅ | sort_order 控制 |
| 表单实例化 | ✅ | 基于定义创建实例 |
| 表单提交 | ✅ | 实例提交 + 数据持久化 |
| 表单验证 | ✅ | 必填/格式/自定义验证 |
| 表单查询 | ✅ | 多条件过滤查询 |
| 表单启用/禁用 | ✅ | enabled 字段控制 |

### 报表设计器

| 功能 | 状态 | 说明 |
|------|------|------|
| 报表定义 CRUD | ✅ | 创建/查询/更新/删除报表 |
| 数据源管理 | ✅ | 多数据源绑定 |
| 布局设计 | ✅ | JSON 格式布局配置 |
| 组件配置 | ✅ | 可视化组件配置 |
| 定时调度 | ✅ | Cron 表达式 + 导出格式 |
| 执行历史 | ✅ | ReportExecution 追踪 |
| 报表导出 | ⚠️ | 支持 PDF/Excel 配置，实际导出待验证 |
| 模板系统 | ⚠️ | templateId 支持，模板库待完善 |

---

## API 端点清单

### 表单（`/api/v1/forms`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/definitions` | 创建表单定义 |
| GET | `/definitions` | 表单列表 |
| GET | `/definitions/:id` | 表单详情（含字段） |
| PUT | `/definitions/:id` | 更新表单定义 |
| DELETE | `/definitions/:id` | 删除表单 |
| POST | `/instances` | 创建表单实例 |
| POST | `/instances/:id/submit` | 提交表单 |
| GET | `/instances` | 实例列表 |
| GET | `/instances/:id` | 实例详情 |
| POST | `/instances/validate` | 验证表单 |

### 报表设计器（`/api/v1/report-designer`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/reports` | 创建报表 |
| GET | `/reports` | 报表列表 |
| GET | `/reports/:id` | 报表详情 |
| PUT | `/reports/:id` | 更新报表 |
| DELETE | `/reports/:id` | 删除报表 |
| POST | `/reports/:id/execute` | 执行报表 |
| GET | `/reports/:id/executions` | 执行历史 |
| POST | `/datasources` | 创建数据源 |
| GET | `/datasources` | 数据源列表 |
| POST | `/schedules` | 创建定时任务 |
| GET | `/schedules` | 定时任务列表 |

---

## 数据模型

### FormDefinition

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 表单 ID |
| tenant_id | string | 租户 ID |
| name | string | 表单名称 |
| description | text | 表单描述 |
| layout | JSONB | 表单布局配置 |
| enabled | boolean | 是否启用 |
| created_by | string | 创建人 |
| created_at | timestamp | 创建时间 |

### FormFieldDefinition

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 字段 ID |
| form_id | UUID | 关联表单 |
| name | string | 字段名 |
| label | string | 字段标签 |
| type | string | 字段类型 |
| required | boolean | 是否必填 |
| validation | JSONB | 验证规则 |
| sort_order | integer | 排序 |
| config | JSONB | 字段配置 |

### ReportDefinition

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 报表 ID |
| tenant_id | string | 租户 ID |
| name | string | 报表名称 |
| description | text | 报表描述 |
| category | string | 报表分类 |
| layout | JSONB | 报表布局 |
| components | JSONB[] | 组件配置 |
| datasource_bindings | JSONB | 数据源绑定 |
| template_id | UUID | 模板 ID |
| enabled | boolean | 是否启用 |
| created_by | string | 创建人 |
| created_at | timestamp | 创建时间 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Pipeline | 构建结果自动生成报表 | ⚠️ 未对接 |
| Approval | 审批表单 | ⚠️ 未对接 |
| ITSM | 工单自定义字段 | ⚠️ 未对接 |
| Data Platform | 报表数据源 | ⚠️ 未对接 |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端设计器 | 用户无法可视化设计表单/报表 | 开发可视化设计器页面 |
| 报表导出未验证 | 导出功能可能不完整 | 验证 PDF/Excel 导出 |
| 无模板市场 | 用户无法复用模板 | 增加模板库 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无表单流程 | 表单无法串联审批 | 增加表单流程引擎 |
| 无报表订阅 | 用户无法订阅报表 | 增加订阅/分发功能 |
| 数据源配置复杂 | 需手动配置数据源 | 增加数据源向导 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无 A/B 测试 | 无法对比表单转化率 | 增加表单分析 |
| 无国际化 | 表单字段不支持多语言 | 增加 i18n 支持 |
| 无版本管理 | 表单修改无历史 | 增加版本控制 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 前端缺失 | 无可视化设计器 | 高 | 开发 React 设计器 |
| 导出未验证 | PDF/Excel 导出未测试 | 中 | 完整测试导出流程 |
| 模板库空 | templateId 无实际模板 | 中 | 增加内置模板 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/form/FormService.ts` | 表单核心服务 | ⭐⭐⭐ |
| `services/form/FormRepository.ts` | 表单数据访问 | ⭐⭐⭐ |
| `services/report-designer/ReportDesignerService.ts` | 报表核心服务 | ⭐⭐⭐ |
| `services/report-designer/ReportDefinitionRepository.ts` | 报表定义访问 | ⭐⭐⭐ |
| `services/report-designer/ReportDatasourceRepository.ts` | 数据源访问 | ⭐⭐⭐ |
| `services/report-designer/ReportScheduleRepository.ts` | 调度访问 | ⭐⭐⭐ |
| `services/report-designer/ReportExecutionRepository.ts` | 执行记录访问 | ⭐⭐⭐ |
| `api/report-designer-routes.ts` | 报表路由 | ⭐⭐⭐ |

---

## 结论

**Form & Report Designer 模块**的后端核心功能完整，PostgreSQL 持久化到位，表单 CRUD + 报表设计器服务层已搭好。

**当前最大缺口**：
1. 无前端可视化设计器（核心功能缺失）
2. 报表导出未验证
3. 无模板市场

建议优先开发前端可视化设计器，这是该模块的核心价值所在。
