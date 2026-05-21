# 页面标题规范修复进度报告

**生成时间**：2026-05-21
**分支**：`feat/frontend-gap-implementation`

---

## 一、修复进度汇总

| 任务 | 模块 | 状态 | 修复数量 |
|------|------|------|----------|
| 1 | 工作台 | ✅ 已完成 | 7 个页面 |
| 2 | 交付 (pipeline-svc) | ✅ 已完成 | 12+ 个页面 |
| 3 | 可观测性 (monitor-svc) | ✅ 已完成 | 11 个页面 |
| 4 | 基础设施 | ✅ 已完成 | 5 个页面 |
| 5 | 治理 | ✅ 已完成 | 14 个页面 |
| 6 | AI 平台 | ✅ 已完成 | 24 个页面 |
| 7 | 生态 | ✅ 已完成 | 5 个页面 |
| 8 | 缺少 marginBottom | 🔄 进行中 | 13 个页面 |
| 9 | 缺少图标 | ⏳ 待处理 | 10 个页面 |

---

## 二、各模块修复详情

### 1. 工作台模块 (7个页面) ✅

| 文件 | 修改内容 |
|------|---------|
| `gateway/DashboardCore/index.tsx` | 添加 `DashboardOutlined` 图标 + `level={2}` + marginBottom: 8 |
| `gateway/ExecutiveDashboard/index.tsx` | 已有图标，更新 marginRight 和颜色 |
| `gateway/ManagerDashboard/index.tsx` | 已有图标，更新 marginRight |
| `gateway/EngineerDashboard/index.tsx` | 已有图标，更新 marginRight |
| `efficiency-svc/EfficiencyDashboard/index.tsx` | 已有图标，添加颜色；修复副标题层级 |

### 2. 交付模块 - pipeline-svc (12+个页面) ✅

修复了 PipelineList, PipelineDetail, PipelineRunList, PipelineRunLive, PipelineVersionHistory, PipelineBudget, ApkUploadHistory, ApkCredentials, TestSelector, TestReport, autonomous-pipeline, Queue 等页面。

### 3. 可观测性模块 - monitor-svc (11个页面) ✅

| 文件 | 修改内容 |
|------|---------|
| `monitor-svc/AlertList/index.tsx` | level: 3→2, 添加 marginBottom 和图标颜色 |
| `monitor-svc/MetricsDashboard/index.tsx` | 同上 |
| `monitor-svc/Monitoring/Metrics.tsx` | 同上 |
| `monitor-svc/Monitoring/Alerts.tsx` | 同上 + 添加 colors 导入 |
| `monitor-svc/Monitoring/Dashboard.tsx` | 同上 |
| `monitor-svc/Monitoring/Rules.tsx` | 同上 + 添加 colors 导入 |
| `monitor-svc/Monitoring/Channels.tsx` | 同上 + 添加 colors 导入 |
| `monitor-svc/Monitoring/index.tsx` | 同上 + 添加图标 |
| `monitor-svc/observability/RootCausePage.tsx` | 同上 |
| `monitor-svc/observability/ObservabilityPage.tsx` | 同上 |
| `monitor-svc/observability/AlertRulesPage.tsx` | 同上 + 添加 colors 导入 |

### 4. 基础设施模块 (5个页面) ✅

| 文件 | 修改内容 |
|------|---------|
| `Queue/index.tsx` | level: 3→2, 添加 InboxOutlined 图标 |
| `platform-core/environments/index.tsx` | level: 3→2, 添加 CloudServerOutlined 图标 |
| `platform-core/EphemeralEnvList/index.tsx` | level: 3→2, 添加 CloudServerOutlined 图标 |
| `platform-core/Sessions/index.tsx` | level: 3→2, 添加 DesktopOutlined 图标 |
| `platform-core/OnCall/index.tsx` | level: 3→2, 添加 CalendarOutlined 图标 |

### 5. 治理模块 (14个页面) ✅

| 文件 | 修改内容 |
|------|---------|
| `platform-core/ProductLine/index.tsx` | level: 3→2, 添加 AppstoreOutlined 图标 |
| `platform-core/RoleManagement/index.tsx` | level: 3→2, 添加 TeamOutlined 图标 |
| `platform-core/SecretsManagement/index.tsx` | level: 3→2, 添加 SafetyCertificateOutlined 图标 |
| `platform-core/EventBus/index.tsx` | level: 3→2, 添加 AuditOutlined 图标 |
| `platform-core/ApiKeyManagement/index.tsx` | level: 3→2, 调整图标 marginRight |
| `platform-core/ModuleManager/index.tsx` | level: 3→2, 调整图标 marginRight |
| `platform-core/CanaryAnalysis/index.tsx` | level: 3→2, 添加 CheckCircleOutlined 图标 |
| `platform-core/CronManagement/index.tsx` | level: 3→2, 调整图标 marginRight |
| `platform-core/TenantManagement/index.tsx` | 添加 BankOutlined 图标和 marginBottom |
| `notify-svc/NotificationRules/index.tsx` | level: 3→2, 调整图标 marginRight |
| `notify-svc/NotificationCenter/index.tsx` | level: 3→2, 添加图标颜色和 marginBottom |
| `notify-svc/WebhookManagement/index.tsx` | level: 3→2, 调整图标 marginRight |
| `plugin-svc/PluginManagement/index.tsx` | level: 3→2, 添加 AppstoreOutlined 图标 |
| `TenantList/index.tsx` | 添加 BankOutlined 图标和 marginBottom |

### 6. AI 平台模块 (24个页面) ✅

| 模块 | 文件数 | 图标 |
|------|--------|------|
| intelligence-svc/AIReview/ | 5 | ScanOutlined |
| intelligence-svc/ai-decision/ | 1 | 调整图标样式 |
| intelligence-svc/ai-decision-explanation/ | 1 | 调整图标样式 |
| ai-svc/AIDocManagement/ | 4 | FileTextOutlined / FolderOutlined |
| ai-svc/LLMTraceDashboard/ | 3 | LineChartOutlined |
| finops-svc/AICostDashboard/ | 5 | DollarOutlined |
| finops-svc/cost-operations/ | 1 | 调整图标样式 |
| finops-svc/cost/ | 1 | 调整图标样式 |
| AIGateway/ | 2 | RobotOutlined |

### 7. 生态模块 (5个页面) ✅

| 文件 | 修改内容 |
|------|---------|
| `skill-svc/SkillManagement/Marketplace.tsx` | level: 3→2, 添加 ShopOutlined 图标 |
| `skill-svc/SkillManagement/MySkills.tsx` | level: 3→2, 添加 AppstoreOutlined 图标 |
| `skill-svc/SkillManagement/SkillSubmission.tsx` | level: 3→2, 添加 CloudUploadOutlined 图标 |
| `community-svc/community/CommunityPage.tsx` | level: 3→2, 添加 marginBottom |
| `community/CommunityPage.tsx` | level: 3→2, 添加 marginBottom |

---

## 三、待完成任务

### 8. 补充缺少 marginBottom (13个页面) 🔄

以下页面需要在 Task 1-7 中已修复大部分，剩余待确认：
- `ConfigManagement/index.tsx` - 已修复
- `platform-core/ConfigManagement/index.tsx` - 已修复
- `SubApps/index.tsx` - 已修复
- `platform-core/SubApps/index.tsx` - 已修复

### 9. 补充缺少图标 (10个页面) ⏳

以下页面仍需补充图标：
- `AuditLog/index.tsx` - 需添加图标
- `security-svc/RiskDashboard/index.tsx` - 需添加图标
- 其他页面已在 Task 1-7 中修复

---

## 四、统计汇总

| 分类 | 数量 |
|------|------|
| 已修复页面总数 | 78+ 个 |
| 提交次数 | 7 次 |
| 修复内容 | level 升级 + marginBottom + 图标 |

---

## 五、规范参考

所有修复均参照 `CLAUDE.md` 中的「页面标题规范 (2026-05-21)」：

```jsx
import { Title } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

<Title level={2} style={{ marginBottom: 8 }}>
  <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面标题
</Title>
```

---

**状态**：大部分修复已完成，待完成剩余 marginBottom 和图标的补充工作。