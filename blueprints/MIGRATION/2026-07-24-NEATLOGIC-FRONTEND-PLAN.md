# NeatLogic 前端页面功能补全计划

> 基于 `ANALYSIS_web_pages_deep.md` (312路由/1496 Vue文件) + `ANALYSIS-FIX-vs-FEATURE.md` (40项任务)
> 融合实施日期: 2026-07-24

## 一、总体规划

| 维度 | 数量 |
|------|:----:|
| **NeatLogic 参考页面** | 312 路由 / 15 模块 |
| **Orion 现有页面** | 212 页面目录 |
| **Gap 模块** | 10 大模块 |
| **后端任务 (FIX-vs-FEATURE)** | 40 项 (11修复 + 29新功能) |
| **前端补全任务** | 10 个 agent 并行 |
| **预计总工期** | 16 周 / 95 人天 (后端) + 前端并行 |

## 二、10个并行Agent任务

| # | Agent | 模块 | NeatLogic 页面数 | 对应后端任务 | 状态 |
|---|-------|------|:----------------:|-------------|:----:|
| 1 | `a5cc4500c64580373` | CMDB 自动发现与同步 | 8 | N-19 CMDB属性值处理器 | 🔄 运行中 |
| 2 | `a33ad1d1a89be7c1e` | 自动化作业与工具库 | 25 | N-14 作业操作处理器 + N-15 参数类型 | 🔄 运行中 |
| 3 | `a63225dfe7ca00da8` | 系统管理与运维工具 | 26 | F-07 定时任务增强 | 🔄 运行中 |
| 4 | `aed3381459337b051` | 通知管理与消息订阅 | 17 | F-06 通知工厂深度不足 | 🔄 运行中 |
| 5 | `a864081bbe0ccd8d2` | 报表与Dashboard设计器 | 6 | N-27/N-28 仪表板/报表数据源 | 🔄 运行中 |
| 6 | `a4da682cd142fc825` | 研发管理RDM | 10 | — 独立模块 | 🔄 运行中 |
| 7 | `ac96f4a603bc2701c` | 发布管理Deploy | 10 | N-18 执行模式 | 🔄 运行中 |
| 8 | `a6db0a330f02e1702` | Go 后端编译修复 | — | F-01~F-05 编译错误 | 🔄 运行中 |
| 9 | `a3df625783e241b9d` | ITSM 流程步骤处理器 | 6 | N-06 (前后端同步) | 🔄 运行中 |
| 10 | `a6d2ed68fea239209` | 表单引擎与条件引擎 | 3 | N-07 + N-08 (前后端同步) | 🔄 运行中 |

## 三、前后端融合点

| 融合项 | 后端接口 | 前端组件 | 联动说明 |
|-------|---------|---------|---------|
| CMDB发现 | `cmdb-discovery-routes.ts` | `CMDBDiscovery/index.tsx` | 发现规则/任务/结果/同步API |
| 自动化作业 | `automation-routes.ts` | `Automation/index.tsx` | 作业/工具/脚本/组合工具API |
| 系统运维 | `ops-tool-routes.ts` | `OpsTools/index.tsx` | Tagent/批量操作/文件管理API |
| 通知管理 | `notification-enhanced-routes.ts` | `NotificationEnhanced/index.tsx` | 策略/集成/订阅API |
| 报表Dashboard | `report-dashboard-routes.ts` | `ReportDashboard/index.tsx` | 仪表盘/报表/模板API |
| RDM | `rdm-routes.ts` | `RDM/index.tsx` | 需求/缺陷/迭代/任务API |
| 发布管理 | `deploy-enhanced-routes.ts` | `DeployEnhanced/index.tsx` | 计划/策略/窗口/回滚API |
| ITSM流程 | `process-step-routes.ts` | `ProcessStep/index.tsx` | 流程步骤处理器20+生命周期 |
| 表单引擎 | `form-condition-routes.ts` | `FormDesigner/index.tsx` | JSON Schema表单 + 条件求值器 |

## 四、前端统一规范（强制遵守）

### 4.1 导入路径

```tsx
import { colors, spacing, radius, shadows } from '@/tokens';
import { Typography, Button, Card, Table, Tabs, Modal, Form } from 'antd';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
```

### 4.2 页面标题规范

```tsx
<Title level={2} style={{ marginBottom: 16 }}>
  <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面主标题
</Title>
```

### 4.3 色彩 Token

| 用途 | Token |
|------|-------|
| 主色 | `colors.primary[500]` (#3370E6) |
| 成功 | `colors.success[500]` (#52c41a) |
| 警告 | `colors.warning[500]` (#faad14) |
| 错误 | `colors.error[500]` (#f5222d) |
| 信息 | `colors.info[500]` (#3a98f4) |

### 4.4 圆角 Token

| 组件 | Token |
|------|-------|
| Card | `radius.lg` (12px) |
| Modal | `radius.xl` (16px) |
| Button | `radius.sm` (6px) |
| Input | `radius.sm` (6px) |

### 4.5 阴影 Token

| 组件 | Token |
|------|-------|
| Card | `shadows.sm` |
| Dropdown | `shadows.dropdown` |
| Modal | `shadows.modal` |

### 4.6 间距 Token

| 场景 | Token |
|------|-------|
| Card 之间 | `spacing.md` (16px) |
| 表单元素间距 | `componentSpacing.formItemGap.md` (16px) |
| 按钮组间距 | `spacing.sm` (8px) |
| Card 内边距 | `componentSpacing.cardPadding.lg` (24px) |

### 4.7 交互完整性（强制）

- 每个按钮操作：`loading` 状态 + `disabled` 防重复点击
- 每个异步操作：`message.success` / `message.error` 反馈
- 列表为空：`Empty` 组件 + 引导操作
- 删除操作：`Modal.confirm` 二次确认

## 五、Go 后端规范

- 编译通过：`go build ./internal/...` 必须 100%
- 每个包有 `internal/<module>/handler/` + `internal/<module>/service/` + `internal/<module>/repository/`
- PostgreSQL Repository 模式
- 统一错误码：`OrionError` / `CLIENT.` / `SERVER.`
- 结构化日志：`logger.Error({...}).Error()`

## 六、50项任务清单

### 6.1 修复类任务 (11项)

| ID | 任务 | 状态 |
|:---:|------|:----:|
| F-01 | Go编译错误修复-260包编译通过率100% | 🔄 Agent执行中 |
| F-02 | ticket.go语法损坏修复(第163行sed注入错误) | 🔄 Agent执行中 |
| F-03 | auth-enhanced/wechat model导入修复 | 🔄 Agent执行中 |
| F-04 | keyrotation JwtKeyRepository导入修复 | 🔄 Agent执行中 |
| F-05 | orchestration/service未使用import修复 | 🔄 Agent执行中 |
| F-06 | 通知工厂深度增强-多渠道/策略/触发点 | ⏳ Batch 1 |
| F-07 | 定时任务IJob接口模式增强 | 🔄 Agent执行中 |
| F-08 | SLA计算ITSM级增强 | ⏳ Batch 3 |
| F-09 | 告警管道链式执行+插件化 | ⏳ Batch 3 |
| F-10 | 告警熔断器3策略+5状态机 | ⏳ Batch 3 |
| F-11 | 自动化执行引擎42动作+20参数插件 | ⏳ Batch 5 |

### 6.2 新功能任务 (29项)

| ID | 任务 | 状态 |
|:---:|------|:----:|
| N-01 | 统一扩展点框架 | ⏳ Batch 4 |
| N-02 | 管道执行器 | ⏳ Batch 4 |
| N-03 | API组件化 | ⏳ Batch 4 |
| N-04 | Crossover跨模块调用 | ⏳ Batch 4 |
| N-05 | 集成处理器 | ⏳ Batch 4 |
| N-06 | 流程步骤处理器 | 🔄 Agent执行中 |
| N-07 | 表单引擎 | 🔄 Agent执行中 |
| N-08 | 条件引擎 | 🔄 Agent执行中 |
| N-09 | 定时任务框架 | ⏳ Batch 4 |
| N-10 | 方法级缓存 | ⏳ Batch 4 |
| N-11 | SLA计算引擎 | ⏳ Batch 4 |
| N-12 | 处理人分派器 | ⏳ Batch 4 |
| N-13 | 告警适配器SPI | ⏳ Batch 4 |
| N-14 | 作业操作处理器 | 🔄 Agent执行中 |
| N-15 | 参数类型 | 🔄 Agent执行中 |
| N-16 | 启动初始化 | ⏳ Batch 5 |
| N-17 | 文件类型/存储 | ⏳ Batch 5 |
| N-18 | 执行模式 | 🔄 Agent执行中 |
| N-19 | CMDB属性值处理器 | 🔄 Agent执行中 |
| N-20 | CMDB验证器 | ⏳ Batch 5 |
| N-21 | 告警事件管道 | ⏳ Batch 5 |
| N-22 | 告警熔断器 | ⏳ Batch 5 |
| N-23 | 作业来源 | ⏳ Batch 5 |
| N-24 | 版本图表 | ⏳ Batch 5 |
| N-25 | 统计处理器 | ⏳ Batch 5 |
| N-26 | 行编辑器 | ⏳ Batch 5 |
| N-27 | 仪表板组件 | 🔄 Agent执行中 |
| N-28 | 报表数据源 | 🔄 Agent执行中 |
| N-29 | 巡检报告扩展 | ⏳ Batch 5 |

### 6.3 前端任务 (10项)

| ID | 任务 | 状态 |
|:---:|------|:----:|
| FE-01 | CMDB自动发现与同步前端 | 🔄 Agent执行中 |
| FE-02 | 自动化作业与工具库前端 | 🔄 Agent执行中 |
| FE-03 | 系统管理与运维工具前端 | 🔄 Agent执行中 |
| FE-04 | 通知管理与消息订阅前端 | 🔄 Agent执行中 |
| FE-05 | 报表与Dashboard设计器前端 | 🔄 Agent执行中 |
| FE-06 | 研发管理RDM前端 | 🔄 Agent执行中 |
| FE-07 | 发布管理Deploy前端 | 🔄 Agent执行中 |
| FE-08 | ITSM流程步骤处理器前端 | 🔄 Agent执行中 |
| FE-09 | 表单引擎与条件引擎前端 | 🔄 Agent执行中 |
| FE-10 | 前端路由与菜单集成 | ⏳ Batch 2 |

### 6.4 进度统计

```
✅ 已完成: 0/50
🔄 执行中: 25/50 (当前Batch 1+2)
⏳ 待启动: 25/50
```

## 七、进度更新规则

| 阶段 | 条件 | 动作 |
|------|------|------|
| Batch 1 完成 | 6个前端agent完成 | 启动Batch 2，更新TRACKER |
| Batch 2 完成 | 4个agent完成 | 启动Batch 3（Go后端深度） |
| Batch 3 完成 | Go后端Phase3-6完成 | 启动Batch 4（扩展点框架） |
| Batch 4 完成 | 所有agent完成 | 最终验证 + 更新MEMORY |
