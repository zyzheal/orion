# 全局系统低代码能力分析报告

## 1. 分析概述

分析 Orion 系统中哪些模块适合支持**低代码能力**，即允许用户通过可视化配置、模板、规则引擎等方式自定义业务逻辑，而无需编写代码。

---

## 2. 低代码能力判断标准

| 标准 | 说明 |
|------|------|
| **配置灵活性** | 用户需要自定义配置，而非固定流程 |
| **模板化需求** | 存在可复用的配置模式 |
| **规则引擎需求** | 业务逻辑可以通过条件+动作表达 |
| **工作流需求** | 存在多步骤流程，可视化编排 |
| **扩展性需求** | 需要用户自定义扩展，而非预置 |

---

## 3. 适合低代码的模块分析

### 3.1 P0 - 强烈推荐（已有模板/配置机制）

| 模块 | 服务 | 低代码形态 | 优先级 |
|------|------|-----------|--------|
| **流水线** | PipelineTemplateService | 可视化流水线编辑器、阶段模板 | P0 |
| **告警规则** | CustomAlertRuleService | 可视化告警规则配置、条件编辑器 | P0 |
| **审批流程** | ApprovalTemplateService | 可视化审批流程设计器 | P0 |
| **工单工作流** | TicketWorkflowService | 可视化工单流转配置 | P0 |
| **配置管理** | ConfigService | GitOps 配置、配置模板 | P0 |

### 3.2 P1 - 高度适合

| 模块 | 服务 | 低代码形态 | 优先级 |
|------|------|-----------|--------|
| **分支策略** | BranchPolicyService | 可视化分支规则配置 | P1 |
| **升级策略** | EscalationConfigService | 可视化升级规则配置 | P1 |
| **监控仪表盘** | MonitoringDashboard | 可视化仪表盘构建器 | P1 |
| **降级规则** | DegradationConfigService | 可视化降级策略配置 | P1 |
| **数据管道** | DataPipelineService | 可视化数据处理流程 | P1 |
| **定时任务** | CronService | 可视化 Cron 表达式配置 | P1 |

### 3.3 P2 - 中等适合

| 模块 | 服务 | 低代码形态 | 优先级 |
|------|------|-----------|--------|
| **策略管理** | PolicyService | 可视化策略规则配置 | P2 |
| **知识库分类** | KnowledgeService | 可视化知识分类结构 | P2 |
| **通知规则** | NotificationService | 可视化通知渠道/模板配置 | P2 |
| **自愈策略** | SelfHealingService | 可视化自愈触发条件 | P2 |
| **混沌实验** | ChaosExperimentService | 可视化故障注入配置 | P2 |
| **数字孪生** | TwinConfigService | 可视化映射关系配置 | P2 |

### 3.4 P3 - 可选支持

| 模块 | 服务 | 低代码形态 | 优先级 |
|------|------|-----------|--------|
| **ABAC 策略** | AbacPolicyEngine | 可视化属性策略配置 | P3 |
| **质量门禁** | QualityGateService | 可视化质量检查规则 | P3 |
| **部署策略** | DeploymentStrategyService | 可视化部署策略配置 | P3 |
| **成本预算** | BudgetService | 可视化预算规则配置 | P3 |

---

## 4. 不适合低代码的模块

| 模块 | 原因 |
|------|------|
| **认证/鉴权** | 安全基础设施，不应开放配置 |
| **租户管理** | 基础设施级别配置 |
| **会话管理** | 安全相关，不宜开放 |
| **角色管理** | 权限核心，不宜开放配置 |
| **审计日志** | 只读数据，无需配置 |
| **事件总线** | 基础设施，不宜开放 |
| **队列管理** | 基础设施，不宜开放 |

---

## 5. 低代码能力形态分类

### 5.1 模板型低代码

适用于有固定模式但需自定义内容的模块：

```
├── 流水线模板
│   └── 用户选择模板 → 填写参数 → 生成流水线
├── 告警规则模板
│   └── 用户选择指标 → 设置阈值 → 生成规则
├── 配置模板
│   └── 用户选择模板 → 填写配置 → 生成配置项
```

### 5.2 规则型低代码

适用于条件→动作的业务逻辑：

```
├── 告警升级规则
│   └── IF 告警持续 X 分钟 THEN 升级到 Y
├── 自愈触发规则
│   └── IF 指标持续 Y 分钟 > 阈值 THEN 触发动作 Z
├── 分支策略规则
│   └── IF 提交包含关键词 THEN 需要审批
```

### 5.3 工作流型低代码

适用于多步骤流程：

```
├── 审批流程
│   └── 开始 → 审批节点 → 条件分支 → 结束
├── 工单流转
│   └── 创建 → 自动分配 → 人工处理 → 关闭
├── 部署流程
│   └── 构建 → 测试 → 预发 → 生产 (可配置)
```

### 5.4 可视化构建型低代码

适用于复杂配置组装：

```
├── 监控仪表盘
│   └── 拖拽组件 → 配置数据源 → 设置展示方式
├── 数据管道
│   └── 拖拽节点 → 连接数据流 → 配置处理逻辑
├── 混沌实验
│   └── 选择故障类型 → 配置参数 → 设定范围
```

---

## 6. 推荐的低代码实现方案

### 6.1 统一低代码平台架构

```
┌─────────────────────────────────────────────────────────────┐
│                      低代码配置平台                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  模板中心    │ │  规则引擎    │ │  工作流引擎  │        │
│  │  Template    │ │    Rule      │ │   Workflow   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              可视化配置编辑器 (统一 UI)                │   │
│  │  - 拖拽式表单构建                                      │   │
│  │  - 条件可视化配置                                      │   │
│  │  - 流程可视化编排                                      │   │
│  │  - 实时预览                                            │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   验证引擎   │ │   执行引擎   │ │   审计日志   │        │
│  │   Validate   │ │   Execute    │ │    Audit     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 模块接入方式

```typescript
// 统一的低代码配置接口
interface LowCodeConfigurable {
  // 获取配置模板
  getTemplate(): ConfigTemplate;
  
  // 验证用户配置
  validate(config: UserConfig): ValidationResult;
  
  // 执行配置
  execute(config: UserConfig, context: ExecutionContext): Result;
  
  // 获取历史版本
  getVersions(): ConfigVersion[];
}

// 示例：告警规则接入
class AlertRuleLowCode implements LowCodeConfigurable {
  getTemplate() {
    return {
      type: 'rule',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'condition', type: 'condition', required: true },
        { name: 'action', type: 'action', required: true },
        { name: 'severity', type: 'select', options: ['critical', 'warning', 'info'] },
      ],
      ui: {
        condition: { type: 'condition-builder', allowedOperators: ['>', '<', '==', 'contains'] },
        action: { type: 'action-selector', allowedActions: ['notify', 'webhook', 'auto-scale'] },
      },
    };
  }
}
```

---

## 7. 实施建议

### 7.1 实施优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| **P0** | 流水线模板、告警规则、审批流程 | 用户强需求，已有基础 |
| **P1** | 工单工作流、分支策略、监控仪表盘 | 高价值功能 |
| **P2** | 升级策略、降级规则、数据管道 | 提升自动化能力 |
| **P3** | 其他模块 | 按需扩展 |

### 7.2 技术选型

| 能力 | 推荐方案 | 说明 |
|------|---------|------|
| 可视化流程编排 | React Flow / X6 | 流程图/节点编排 |
| 表单构建 | @formily/react | 可视化表单配置 |
| 条件规则 | 自研规则引擎 | 参考 JSON Logic |
| 模板存储 | PostgreSQL JSONB | 结构化存储+查询 |
| 实时预览 | React Hook Form | 表单预览 |

---

## 8. 当前实现状态

### 8.1 已支持低代码的模块

| 模块 | 后端服务 | 前端页面 | 说明 |
|------|---------|---------|------|
| **流水线编辑器** | PipelineTemplateService | PipelineEditor | ✅ 已支持：拖拽式 Stage 编排 |
| **流水线模板** | PipelineTemplateService | PipelineTemplatePage | ✅ 已支持：模板选择+参数填写 |
| **定时任务** | CronService | CronManagement | ✅ 已支持：Cron 表达式配置 |
| **配置管理** | ConfigService | ConfigManagement | ✅ 基础配置页面 |

### 8.2 需要改造的模块

| 模块 | 后端服务 | 现状 | 需要改造 |
|------|---------|------|----------|
| **告警规则** | CustomAlertRuleService | 无可视化编辑器 | 新增 AlertRuleEditor 页面 |
| **审批流程** | ApprovalTemplateService | 无可视化编辑器 | 新增 ApprovalEditor 页面 |
| **工单工作流** | TicketWorkflowService | 无可视化配置 | 新增 WorkflowEditor 页面 |
| **监控仪表盘** | MonitoringDashboard | 无可视化构建器 | 新增 DashboardBuilder 页面 |
| **分支策略** | BranchPolicyService | 无可视化配置 | 新增 BranchPolicyEditor 页面 |
| **升级策略** | EscalationConfigService | 无可视化配置 | 新增 EscalationEditor 页面 |
| **降级规则** | DegradationConfigService | 无可视化配置 | 新增 DegradationEditor 页面 |
| **数据管道** | DataPipelineService | 无可视化配置 | 新增 PipelineBuilder 页面 |
| **策略管理** | PolicyService | 无可视化配置 | 新增 PolicyEditor 页面 |
| **自愈策略** | SelfHealingService | 无可视化配置 | 新增 SelfHealingEditor 页面 |
| **混沌实验** | ChaosExperimentService | 无可视化配置 | 新增 ChaosExperimentBuilder 页面 |
| **数字孪生** | TwinConfigService | 无可视化配置 | 新增 TwinConfigEditor 页面 |
| **知识库分类** | KnowledgeService | 基础管理页面 | 增强分类可视化配置 |
| **通知规则** | NotificationService | 基础配置 | 新增可视化通知配置 |
| **质量门禁** | QualityGateService | 基础配置 | 新增 QualityGateEditor 页面 |
| **部署策略** | DeploymentStrategyService | 基础配置 | 新增 StrategyEditor 页面 |
| **成本预算** | BudgetService | 基础配置 | 新增 BudgetRuleEditor 页面 |

### 8.3 改造工作量估算

| 优先级 | 模块 | 预计工作量 | 依赖 |
|--------|------|-----------|------|
| **P0** | 告警规则编辑器 | 3 人日 | AlertRuleEngine 后端已完善 |
| **P0** | 审批流程编辑器 | 4 人日 | ApprovalTemplateService 后端已完善 |
| **P1** | 工单工作流编辑器 | 4 人日 | TicketWorkflowService 后端已完善 |
| **P1** | 监控仪表盘构建器 | 5 人日 | MonitoringDashboard 后端已完善 |
| **P1** | 分支策略编辑器 | 2 人日 | BranchPolicyService 后端已完善 |
| **P2** | 升级策略编辑器 | 2 人日 | EscalationConfigService 后端已完善 |
| **P2** | 降级规则编辑器 | 2 人日 | DegradationConfigService 后端已完善 |
| **P2** | 数据管道构建器 | 4 人日 | DataPipelineService 后端已完善 |
| **P3** | 其他模块 | 按需 | — |

---

## 9. 总结

| 分类 | 模块数 | 说明 |
|------|--------|------|
| **已支持** | 4 | 流水线编辑器、模板、定时任务、配置管理 |
| **需改造** | 16 | 告警、审批、工单、仪表盘等 |
| **不适合** | 7 | 认证、租户等基础设施 |

### 建议实施路线

1. **第一阶段 (P0)**：告警规则编辑器 + 审批流程编辑器
2. **第二阶段 (P1)**：工单工作流 + 监控仪表盘 + 分支策略
3. **第三阶段 (P2)**：升级/降级规则、数据管道
4. **第四阶段 (P3)**：其他模块

---

## 10. 相关文档

| 文档 | 说明 |
|------|------|
| 全局权限管控体系设计 | Capability 系统架构 |
| 模块权限控制独立性分析 | 能力域划分 |
| 权限配置页面设计 | 管理页面方案 |