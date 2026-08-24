# Orion 前端页面交互完整性深度审查报告

**审查日期**: 2026-08-24  
**审查范围**: 207 个前端页面  
**审查规则**: CLAUDE.md 定义的前端交互完整性审查（逐元素交互链/字段读写/CRUD完整性/场景逆向验证/反模式清单）

---

## 一、总览

| 维度 | 数值 |
|------|------|
| 已完成分析页面 | 112 / 207 (54%) |
| 发现 P0 问题 | 26 |
| 发现 P1 问题 | 48 |
| 发现 P2 问题 | 45 |
| 共享组件问题 | 10（影响全局） |

---

## 二、全局共享组件问题（影响所有页面）

| 组件 | 严重程度 | 问题 | 修复建议 |
|------|---------|------|---------|
| OrionForm | P0 | 校验提示英文 `"${label} is required"`、按钮默认英文 `"Submit"`/`"Cancel"` | 改为中文 `"提交"`/`"取消"`，校验提示改为 `"${label}为必填项"` |
| OrionTable | P0 | 列筛选面板全英文 `"Search"`/`"Reset"`/`"Clear All Filters"` | 改为 `"搜索"`/`"重置"`/`"清除所有筛选"` |
| SearchFilterBar | P1 | `"Clear All"` 英文 | 改为 `"清除全部"` |
| OrionActionGroup | P1 | 按钮无 `loading`/`disabled` 属性支持 | 添加 `loading`/`disabled` 透传，防止重复点击 |
| OrionSearchBar | P1 | 无防抖，每次输入触发 API 调用 | 添加 300ms 防抖 |
| OrionForm.handleSubmit | P0 | 无 try/catch，异步异常静默失败 | 包裹 try/catch + message.error |

---

## 三、P0 严重问题清单（26 项）

### AI 平台 + 控制台 + 治理域

| 页面 | 问题 | 修复建议 |
|------|------|---------|
| AIGateway | "配置"按钮无 onClick，点击无反应 | 添加配置 Modal 或移除按钮 |
| AIDashboard | 健康数据加载 catch 为空，失败静默 | 添加 message.error 或 Alert 重试 |
| ModelEvolution | 模型列表为空时无引导按钮 | 添加 Empty + 引导按钮 |
| UserManagement | 重置密码只显示 message.info 不调用 API | 调用管理员重置密码 API 或移除按钮 |
| ApprovalEscalation | 整页纯 Mock，所有数据空数组，StatsCards 硬编码 | 对接后端审批超时升级 API 或标注"开发中" |
| Console | 系统健康度硬编码 98%，API 失败时用假数据 | 对接真实健康检查 API，失败时展示加载失败 |

### 成本 + 安全 + 租户域

| 页面 | 问题 | 修复建议 |
|------|------|---------|
| security/PasswordPolicy | 保存用 setTimeout 模拟，mockHistory 空数组，配置无法持久化 | 对接后端 password-policy API |
| security/UEBA | mockEvents/mockRiskRanks 空数组，检测配置保存用 setTimeout 模拟 | 对接 UEBA 后端 API |
| security/ContainerScan | "查看详情"仅 message.info，扫描策略保存用 setTimeout 模拟 | 实现详情 Drawer，对接保存 API |
| security/SBOM | "查看报告"和"更新版本"仅 message.info/success 无实际操作，licenseData 空 | 实现报告生成/版本更新 API |
| cost/BudgetGuardPage | Update/Delete/Toggle 全部 message.info("待后端支持")，CRUD 断链 | 对接 update/delete/toggle API |
| efficiency/DoraMetricsPage | API 失败时用 fallbackMetrics/fallbackBenchmarks 假数据回填 | 移除 fallback，失败时显示错误状态 |

### 工单 + ITSM + 通知域

| 页面 | 问题 | 修复建议 |
|------|------|---------|
| TicketComments | handleSubmit 仅 message.success 不调用 createComment API，评论未持久化 | 调用 createComment API |
| NotificationCenter | handleClearRead 仅前端过滤，刷新后已读通知重新出现 | 调用 clearReadNotifications API |
| NotificationDetail | actions 按钮完全无 onClick，点击无响应 | 绑定 onClick 执行对应操作 |
| TicketDetail | history 状态声明为 any[] 但从未赋值，工作流历史 Timeline 永远为空 | 在 useEffect 中调用 getTicketHistory |
| RDM | assignee 字段纯文本 Input，无用户搜索/校验 | 改为 Select + 用户搜索 |
| TicketList | handleStatusTransition 无 loading/disabled，可重复点击导致状态跳变 | 添加 submitting 状态 |
| Automation | handleToggle 切换失败后 Switch UI 已翻转但状态未变更 | catch 中恢复 job.enabled |
| Queue | "重试"按钮显示硬编码 "需要后端支持重试队列" 占位提示 | 实现 retryJob API 或明确 disabled |
| ScriptRunner | taskId 用 Date.now() 生成，后端不认可；success/error 同时调用存在竞态 | 使用后端返回的 taskId |
| RunbookManagement | catch 对所有错误（含校验失败）统一报"保存失败" | 检查 errorFields 跳过校验错误提示 |
| CronJobs | 无刷新按钮，列表无法手动刷新 | 添加刷新按钮 |
| ScriptLibrary | handleExecute 执行后未刷新执行历史，用户看不到新结果 | 执行成功后调用 fetchExecutions |

---

## 四、P1 重要问题（共 48 项，部分高频代表）

### 高频问题类型

| 反模式 | 涉及页面数 | 代表页面 |
|--------|----------|---------|
| 按钮/Modal 无 loading/confirmLoading | 18+ | PromptCanary、mlops、GlobalParams、CapabilityAdmin、plugin-marketplace |
| 操作后无错误反馈（静默吞错） | 8+ | Assistant、SubApps、ApprovalManagement、DocumentCenter |
| Modal/Drawer 全只读无编辑入口 | 6+ | ai-decision、PromptCanary、AIAgents |
| 空数据无 Empty 引导按钮 | 8+ | mlops、ChangeRequestManagement、ai-decision |
| 假 loading（setTimeout 模拟）/伪造数据 | 6+ | cost-operations、EfficiencyPage、EfficiencyDashboard |
| 字段校验缺失（URL/格式/唯一性） | 5+ | ProductLine.gitUrl、NotificationRules.events、CITypeDesigner.name |

---

## 五、优质页面参考（交互链完整）

| 页面 | 亮点 |
|------|------|
| finops/FinOpsPage | 完整 CRUD + loading/error/empty + Popconfirm |
| TenantList | CRUD + 批量操作 + 搜索筛选 + CSV 导出 + 子 Modal |
| feature-flags/FeatureFlagsPage | CRUD + 开关切换 + 评估 Modal + 错误提示 |
| SecretsManagement | CRUD + 编辑确认 Modal + 搜索筛选 + 安全掩码 |
| GatewayRoutes | CRUD + 搜索筛选 + Drawer 详情 + loading/error |
| EvalSetManagement | Create + Delete + Run + 对比分析 + 详情 Modal |

---

## 六、修复优先级建议

1. **立即修复（本周）**：26 个 P0 — 集中在安全域(4页)、BudgetGuard CRUD、DoraMetrics 假数据、TicketComments 无 API
2. **两周内**：48 个 P1 — confirmLoading 缺失、Modal 只读、静默吞错
3. **一月内**：45 个 P2 — 中英混用、空状态引导、原始 JSON 展示
4. **持续改进**：共享组件 i18n 修复（OrionForm/OrionTable/SearchFilterBar 影响全局）

---

## 七、工作台 + 交付 + 监控域

| 页面 | 严重程度 | 问题 | 修复建议 |
|------|---------|------|---------|
| PipelineList | P0 | 删除用 Select 下拉直接触发删除，无 Popconfirm/Modal.confirm 二次确认 | 改为 Popconfirm 二次确认 |
| DeploymentList | P0 | "回滚"按钮无 onClick 回调，PermissionActions 中未提供 onClick | 添加 onClick 调用 rollbackDeployment API |
| DashboardNew | P0 | tasks 硬编码空数组，"处理"和"查看全部"按钮无 onClick | 对接真实任务 API + 绑定按钮 |
| DashboardNew | P1 | 系统健康状态 API 失败后 fallback 4 条硬编码数据 | 失败时显示错误状态或骨架屏 |
| DashboardCore | P1 | 系统健康面板 4 条记录完全硬编码，Event Bus 永久 warning | 对接 getMonitoringHealth API |
| DashboardNew | P1 | Pipeline 失败"重试"仅 navigate 跳转，无重跑 API | 调用 retryPipelineRun API |
| PipelineDetail | P1 | 任务输出 Tab dataSource 永久为空，无 Empty 引导 | 显示 Empty + "开发中"提示 |
| PipelineRunAnalytics | P1 | Cancel/Retry 无 try/catch 无 loading | 添加 loading + try/catch + message 反馈 |
| DashboardNew | P1 | 空状态无引导按钮 | Empty + 引导按钮 |
| DeploymentList | P1 | 空状态无创建引导 | Empty + 跳转部署创建 |
| PipelineList | P2 | 批量触发仅 message.info("功能开发中") | 对接 API 或 disabled + tooltip |
| PipelineDetail | P2 | 重跑按钮无 loading/try/catch | 添加 loading + 错误处理 |
| PipelineDetail | P2 | DAG 节点点击空函数 | 实现跳转阶段详情 |
| PipelineBudget | P2 | 标题重复两个 DollarOutlined 图标 | 移除重复图标 |
| PipelineRunAnalytics | P2 | 标题/描述英文 | 改为中文 |
| DashboardCore | P2 | API 失败无 message.error 即时反馈 | catch 中添加 message.error |
| WorkbenchPage | P2 | 空状态无引导 | Empty + 引导按钮 |
| PipelineEditor | P2 | YAML 预览 Drawer 打开时为空 | 打开 Drawer 时自动生成 YAML |

---

## 八、CMDB + 基础设施域

| 页面 | 严重程度 | 问题 | 修复建议 |
|------|---------|------|---------|
| service-catalog | P0 | 目录为空/无源文件，页面完全空白 | 创建页面，对接服务目录 API |
| service-portal | P0 | 目录为空/无源文件，页面完全空白 | 创建开发者门户页面 |
| digital-twin | P0 | 目录为空/无源文件，页面完全空白 | 创建数字孪生页面 |
| ci-type-designer | P0 | 目录为空/无源文件，页面完全空白 | 创建 CI 类型设计器页面 |
| disaster-recovery | P0 | 删除无 Modal.confirm/Popconfirm | 增加二次确认 |
| disaster-recovery | P0 | 恢复 Modal 无 Alert 组件提示不可逆 | 增加 Alert type="warning" |
| federation | P1 | Cluster/Job/Pool 三 Tab 均无删除/编辑入口 | 增加操作列 + 编辑 Modal |
| canary-traffic | P1 | Promote/Rollback 无二次确认 | 增加 Modal.confirm |
| canary-traffic | P1 | Configs Tab 只读无操作 | 增加编辑/删除操作 |
| multi-cloud | P1 | 云账号无编辑/删除入口 | 增加编辑/删除 |
| multi-cloud | P1 | 成本趋势 6 个月中 5 个月为硬编码模拟数据 | 调用真实成本趋势 API |
| backup | P1 | 备份无编辑入口 | 增加编辑入口 |
| supply-chain | P1 | SBOM 文档无删除/编辑入口，Vulnerability Tab 只读 | 增加完整操作 |
| iac | P1 | 需确认完整 CRUD | 进一步审查 |
| developer-portal | P1 | 需确认交互链完整性 | 进一步审查 |
| multi-cloud | P2 | setTimeout 2s 模拟同步刷新 | 使用轮询 API 状态 |
| federation | P2 | 三 Tab 空数据无引导 | Empty + 引导 |
| disaster-recovery | P2 | 恢复操作无 confirmLoading、无详情查看 | 加 confirmLoading + 详情 Drawer |
| CMDB 各页 | P2 | CITable/Topology/Integration/AuditLog 多处空数据无 Empty 引导 | 统一加 Empty + 引导 |
| WebTerminal | P2 | 多 Tab 共享单一 WebSocket 连接，切换后连接丢失 | 每 Tab 独立 WebSocket |
| batch-exec | P2 | 脚本模板"使用"按钮仅 message.info，未填充命令表单 | 跨 Tab 通信填充 |
| canary-traffic | P3 | 全英文界面 | 翻译为中文 |
| supply-chain | P3 | 全英文界面 | 翻译为中文 |
| federation | P3 | 全英文界面 | 翻译为中文 |
| disaster-recovery | P3 | 英文界面 | 翻译为中文 |
| multi-cloud | P3 | 混合语言 | 统一中文 |
