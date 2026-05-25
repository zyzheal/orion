# Orion 全模块深度扫描与改造设计

> **分析日期**: 2026-05-22
> **状态**: Phase 1 广扫描已完成，本文档为 Phase 2 深扫描与修复计划
> **目标**: 对 Orion 平台全部前端页面进行 6 维度深度扫描 + 功能/样式补全方案

---

## 一、分析范围

### 1.1 目标模块（实际数据）

> **注意**: 原始设计文档对各模块页面数量估算严重偏低（174 vs 实际 540）。以下数据来自 Phase 1 实际扫描结果。

| 菜单 | 路径 | 主页面数 | 含子页面 | 代码行数 | 说明 |
|------|------|---------|---------|---------|------|
| 工作台 | /workbench | 11 | ~11 | ~8,400 | 总览看板/个人工作台/工单/产品线/项目/效能/风险 |
| 控制台 | /console | ~24 | ~50+ | ~16,000+ | 控制台/插件/配置/用户/子应用/IaC/BuildEnv/代码/Runner 等 |
| 交付 | /delivery | ~19 | ~35+ | ~13,000+ | 流水线/部署/灰度/代码/制品/二方库/测试/密钥/模板 |
| 可观测性 | /observability | 5 | ~20 | ~5,200+ | 监控/告警/指标/诊断/自愈 |
| AI 平台 | /ai | ~10 | ~40+ | ~11,500+ | ChatOps/AI Review/AI 网关/Agent/Trace/成本/文档/安全 |
| 基础设施 | /infra | ~17 | ~30+ | ~13,000+ | 环境/临时/构建/IaC/队列/向量/事件/CMDB/备份/值班 |
| 治理 | /governance | ~16 | ~20+ | ~12,700+ | 策略/审计/SBOM/租户/角色/配置/审批/工作流/FinOps |
| 生态 | /ecosystem | ~3 | ~12 | ~3,500+ | Skill 市场/SPI 扩展/知识库 |

**合计**: 540 个 .tsx 文件（排除测试/模拟/共享），93 个主页面入口，~350 有效业务页面，~83,300+ 行代码

### 1.2 规范来源

- `docs/规范汇总/Orion统一规范汇总.md`（7567 行，15 章节）
- `CLAUDE.md` 前端交互完整性审查规则
- `orion-frontend/src/tokens/` Design Token 体系（14 文件）
- `orion-frontend/src/stores/menuConfigStore.ts` 8 大菜单定义

### 1.3 Phase 1 已完成产出

Phase 1 广扫描（3 Agent 并行）已完成，产出文件如下：

| 产出文件 | 路径 | 状态 |
|---------|------|------|
| 交互链与样式报告 | `docs/reports/scan-interaction-style.md` | ✅ 已完成 |
| 逻辑完整度与功能缺失报告 | `docs/reports/scan-logic-features.md` | ✅ 已完成 |
| 微前端拆分与补全报告 | `docs/reports/scan-microfront-remediation.md` | ✅ 已完成 |
| 全模块总报告 | `docs/reports/full-module-scan-report-2026-05-22.md` | ✅ 已完成 |

---

## 二、6 维度分析框架

### 维度 1：交互链完整性

参照 CLAUDE.md "逐元素交互链审查" + 反模式清单：

| 检查项 | 通过标准 | 反模式 |
|--------|---------|--------|
| 可操作元素有 onClick | 每个按钮/列表项有交互 | 只渲染无点击事件 |
| 操作后有反馈 | 成功 message.success，失败 message.error | 操作后无提示 |
| 有 loading 状态 | 异步操作有 loading/disabled | 点击后无状态变化 |
| 空状态引导 | 列表为空时 Empty + 引导按钮 | 空白区域 |
| 危险操作有确认 | 删除/危险操作有 Popconfirm | 无二次确认 |

### 维度 2：样式规范符合度

参照 `Orion统一规范汇总.md` 第四节"前端代码规范"：

| 检查项 | 通过标准 | 工具 |
|--------|---------|------|
| 色彩 | 使用 `colors.*` Token | Grep `color: '#` 排除 Token |
| 圆角 | 使用 `componentRadius.*` | Grep `borderRadius: \d+px` 非 Token |
| 间距 | 4px 网格倍数 | Grep `margin/Padding: \d+px` |
| 阴影 | 使用 `shadows.*` | Grep `boxShadow:` 非 Token 值 |
| 字体 | 符合页面标题规范 | Title level={2}/3 + marginBottom |

### 维度 3：逻辑完整度

| 检查项 | 通过标准 |
|--------|---------|
| CRUD 完整性 | 每个数据实体有 Create/Read/Update/Delete 入口 |
| API 对接 | 前端调用 → 后端路由 → Controller → Service → Repository 全链路 |
| 异常处理 | try/catch + message.error + HTTP 错误拦截 |
| 数据流 | loading 在 finally 中重置、成功后刷新列表 |
| 响应格式 | 使用统一 `unwrapResponse` 或拦截器解包 |

### 维度 4：功能缺失识别

| 检查项 | 常见缺失 |
|--------|---------|
| 编辑入口 | Drawer/Modal 内全部 Descriptions 只读 |
| 保存按钮 | 改了但没有保存入口 |
| 批量操作 | 列表无批量选择/批量操作 |
| 搜索过滤 | 列表无搜索/过滤能力 |
| 导出导入 | 无 CSV/JSON 导入导出 |
| 报表分析 | 按钮弹"开发中" |
| 权限控制 | 无角色/权限判断，任何人都能操作 |

### 维度 5：微前端拆分评估

| 评估项 | 判断标准 | 建议 |
|--------|---------|------|
| 代码规模 | 页面 > 8 个或代码 > 2000 行 | 独立子应用 |
| 团队独立性 | 独立团队维护 | 独立子应用 |
| 技术栈差异 | 不同构建配置/依赖版本 | 独立子应用 |
| 部署频率差异 | 高频 vs 低频混编 | 高频独立子应用 |
| 故障隔离 | 崩溃影响主应用 | 高隔离需求独立子应用 |
| 已有独立后端 | 有独立服务目录（Go/Java/Python） | 前端也拆分 |
| 已有子应用实现 | 已在 `microfront/apps.ts` 注册 | 无需改或联调 |

**输出**: 每个模块给出"独立子应用 / 继续嵌入 / 已有无需改"建议 + 拆分优先级 P0/P1/P2

### 维度 6：8 大菜单模块功能/样式补全

参照 `menuConfigStore.ts` 定义的 8 大菜单 + 统一规范：

#### 6.1 功能补全矩阵

> 以下矩阵为框架模板，完整逐页面补全数据见 `docs/reports/scan-microfront-remediation.md` 第二部分"功能补全清单"。

| 能力项 | 规范值 | Phase 1 发现 | 缺失规模 | 补全方案 |
|--------|--------|-------------|---------|---------|
| 页面标题 | Title level={2} + 图标 + marginBottom:8/16 | 31 处不规范 | 31 页面 | 统一替换为 Title 组件 + 图标 |
| 副标题 | Typography.Text + colors.neutral[500] + fontSize:14 | ~80% 页面缺失 | ~70 页面 | 添加描述文字 |
| 空状态 | Empty + 引导按钮 + colors.primary[500] | 91% 主页面缺失 Empty | 85/93 主页 | 添加 Empty + 创建/引导按钮 |
| 表单 | maxWidth:700 + 居中 | 部分表单缺 Form 布局 | ~10 页面 | 修改布局 |
| 表格 | 行高 48px + 悬停 #EBF0FB + striped | 多数已符合 | ~5 页面 | 替换 Table 样式 |
| 按钮 | 高度 36px + borderRadius:6px | 基本符合 | 0 | 保持 |
| 卡片 | 圆角 12px + 阴影 + 左侧 3px 装饰线 | 基本符合 | 0 | 保持 |
| 模态框 | 圆角 16px + 阴影 | 基本符合 | 0 | 保持 |

#### 6.2 样式补全清单

> 完整逐页面样式数据见 `docs/reports/scan-microfront-remediation.md` 第三部分"样式补全清单"。

| 样式项 | Phase 1 发现 | 违规规模 | 补全方案 |
|--------|-------------|---------|---------|
| 颜色硬编码 | grep `color: '#` 排除 Token | 123 处 | 替换为 colors.* Token |
| 圆角硬编码 | grep `borderRadius: \d+px` | 0 处 | 已合规 |
| 间距硬编码 | grep `margin/Padding: \d+px` | ~50 处（16px/24px 等） | 替换为 spacing.* Token |
| 阴影非 Token | grep `boxShadow:` 非 Token 值 | 8 处 | 替换为 shadows.* Token |
| 标题不规范 | Title level 不符合规范 | 31 处 | 统一 level={2}/3 |

### 6.3 各菜单模块补全优先级（实际扫描数据）

> 以下数据来自 Phase 1 实际扫描报告，详见 `docs/reports/scan-microfront-remediation.md`。

| 菜单 | 主页面数 | P0 缺失 | P1 缺失 | P2 缺失 | 功能补全工时 | 样式补全工时 |
|------|---------|--------|--------|--------|-------------|-------------|
| 工作台 | 11 | 0 | 4 (空状态/loading) | 7 (标题/副标题) | 3d | 3d |
| 控制台 | ~24 | 4 (Mock/假 API) | 20 (空状态/副标题) | ~30 (间距硬编码) | 9d | 3d |
| 交付 | ~19 | 0 | 15 (空状态/副标题) | ~20 (间距硬编码) | 6d | 2d |
| 可观测性 | 5 | 0 | 5 (空状态/副标题) | ~5 (间距硬编码) | 2.5d | 1.25d |
| AI 平台 | ~10 | 1 (空 catch) | 8 (空状态/副标题) | ~10 (间距硬编码) | 4.5d | 2.5d |
| 基础设施 | ~17 | 0 | 9 (空状态/副标题) | ~10 (间距硬编码) | 5d | 2d |
| 治理 | ~16 | 0 | 11 (空状态/副标题) | ~12 (间距硬编码) | 6d | 2d |
| 生态 | ~3 | 0 | 3 (空状态) | ~3 (全面补全) | 1.5d | 0.75d |

---

## 三、执行方案

### 3.1 Phase 1：广扫描（✅ 已完成）

Phase 1 广扫描（3 Agent 并行深度扫描）已全部完成，产出 4 份报告：

| 报告 | 路径 | 核心发现 |
|------|------|---------|
| 交互链与样式 | `docs/reports/scan-interaction-style.md` | 1618 异步函数，32 缺 loading，7 缺反馈，123 硬编码颜色 |
| 逻辑与功能缺失 | `docs/reports/scan-logic-features.md` | API 对接率 41%，CRUD 完整率 ~20%，61 页面只读无编辑 |
| 微前端与补全 | `docs/reports/scan-microfront-remediation.md` | P0 必须拆分 4 模块，91% 页面缺空状态引导 |
| 全模块总报告 | `docs/reports/full-module-scan-report-2026-05-22.md` | 6 维度全局统计 + 8 大模块详细报告 |

### 3.2 Phase 2：深扫描与修复（本计划）

Phase 1 结果中识别出的 P0 问题，按优先级分配 Agent 做逐页修复。

**P0 问题清单（来自实际扫描）**：

| 优先级 | 问题 | 影响页面 | 修复方案 | 负责 Agent |
|--------|------|---------|---------|-----------|
| P0-1 | CreateTicketModal setTimeout Mock | TicketList | 对接 createTicket API | Agent 1 |
| P0-2 | handleAssign 假调用后端 | TicketList | 对接 assignTicket API | Agent 1 |
| P0-3 | ChatOps 空 catch 块 | ChatOps/index.chat.tsx | 补全错误处理 | Agent 1 |
| P0-4 | 10 处 Mock 逻辑（setTimeout/硬编码） | 多模块 | 替换为真实 API 调用 | Agent 2 |
| P0-5 | 32 处异步函数缺 loading 状态 | 多模块 | 添加 setLoading/disabled | Agent 2 |
| P0-6 | 7 处异步函数缺 message.error | 多模块 | 补全 catch + message.error | Agent 2 |
| P0-7 | .data.data 双层嵌套（411 处） | 198 文件 | 统一使用 unwrapResponse | Agent 3 |
| P0-8 | 56 处删除操作缺二次确认 | 多模块 | 添加 Popconfirm | Agent 3 |

**P1 问题清单（Phase 2.5 或 Phase 3）**：

| 优先级 | 问题 | 影响规模 | 修复方案 |
|--------|------|---------|---------|
| P1-1 | 123 处硬编码颜色 | ~80 文件 | 替换为 colors.* Token |
| P1-2 | 55 处缺空状态引导 | ~55 页面 | 添加 Empty + 引导按钮 |
| P1-3 | 61 页面只读无编辑 | 61 页面 | 添加编辑入口 + 编辑表单 + 保存按钮 |
| P1-4 | 31 处标题不规范 | 31 页面 | 统一 Title level={2} + 图标 |
| P1-5 | 全量页面缺权限控制 | 100% 页面 | 实现 usePermission（当前为 TODO） |

### 3.3 最终产出

Phase 2 完成后更新 `docs/reports/full-module-scan-report-2026-05-22.md`，包含：

1. **P0 问题修复清单**（每个问题的修复文件链接）
2. **P1 修复进度**（按优先级跟踪）
3. **合规率变化**（修复前后对比）
4. **微前端拆分实施计划**（基于 scan-microfront-remediation.md 建议）

---

## 四、验收标准（基于 Phase 1 实际数据）

| 维度 | 验收项 | Phase 1 基线 | 目标 | 当前差距 |
|------|--------|-------------|------|---------|
| 维度 1 | 交互链覆盖率 | 93.4% (32/1618 缺 loading) | ≥ 98% | 16 处 |
| | 操作反馈 | 7/1618 缺 message.error | 100% | 7 处 |
| | 删除确认 | 56 处缺 Popconfirm | ≥ 95% | ~3 处 |
| | 空状态引导 | 55/93 主页面缺 Empty | ≥ 80% | ~30 处 |
| 维度 2 | 颜色 Token 化 | 123 处硬编码颜色 | ≥ 98% | ~15 处 |
| | 圆角/间距 | 0 圆角违规，0 间距违规 | 100% | 保持 |
| | 标题规范 | 31 处不规范 | 100% | 31 处 |
| 维度 3 | API 对接率 | 41% (224/540) | ≥ 60% | ~110 页面 |
| | CRUD 完整率 | ~20% (仅 12 页面完整) | ≥ 40% | ~100 页面 |
| | .data.data 嵌套 | 198 文件 411 处 | 100% unwrapResponse | 411 处 |
| 维度 4 | 只读无编辑 | 61 页面 | P0 100% 修复 | ~61 页面 |
| | Mock 逻辑 | 10 处 setTimeout/假调用 | 0 | 10 处 |
| 维度 5 | 拆分建议采纳率 | 4 P0 + 3 P1 模块 | 建议需有代码级证据 | 已有实际扫描数据 |
| 维度 6 | 补全覆盖率 | 8 模块清单已完成 | 每个模块输出修复计划 | 已完成 |

---

## 五、规范速查表（Agent 执行时直接使用）

> 以下值直接从 CLAUDE.md 和 Orion统一规范汇总.md 提取，避免 Agent 查阅外部文件。

### 色彩

| 用途 | Token |
|------|-------|
| 主操作色 | `colors.primary[500]` = `#3370E6` |
| 成功 | `colors.success[500]` = `#52c41a` |
| 警告 | `colors.warning[500]` = `#faad14` |
| 错误 | `colors.error[500]` = `#f5222d` |
| 信息 | `colors.info[500]` = `#3a98f4` |
| 审批（紫） | `colors.purple[500]` = `#7C5CFC` |
| 中性灰 | `colors.neutral[500]` = `#8c8c8c` |
| 深色文字 | `colors.neutral[900]` = `#1f1f1f` |
| 次要背景 | `colors.light.bg.secondary` = `#F5F5F7` |

### 圆角

| 组件 | Token | 值 |
|------|-------|-----|
| Card | `componentRadius.card` | 12px |
| Modal | `componentRadius.modal` | 16px |
| Button | `componentRadius.button.md` | 6px |
| Input | `componentRadius.input` | 6px |
| Tag | `componentRadius.tag` | 6px |

### 间距

| 场景 | Token | 值 |
|------|-------|-----|
| Card 之间 | `spacing.md` | 16px |
| 表单元素 | `componentSpacing.formItemGap.sm` | 12px |
| 按钮组 | `spacing.sm` | 8px |
| Card 内边距 | `componentSpacing.cardPadding.lg` | 24px |

### 页面标题

```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <IconOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面标题
</Title>
<Typography.Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>页面描述</Typography.Text>
```

### 异步操作模板

```tsx
const [loading, setLoading] = useState(false);
const handleAction = async () => {
  setLoading(true);
  try {
    await api.doSomething();
    message.success('操作成功');
    await fetchData();
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : '操作失败');
  } finally {
    setLoading(false);
  }
};
```

### 反模式清单（禁止出现）

| 反模式 | 正确做法 |
|--------|---------|
| Descriptions 全部只读 | 可编辑字段用 Form.Item + Input |
| 操作后无 message | 每个异步操作加 success/error |
| 按钮无 loading/disabled | 异步操作时同时设置 |
| Empty 无引导按钮 | Empty + 创建按钮 |
| 表单无提交按钮 | 底部固定保存按钮 |
| catch (error: any) | catch (error: unknown) + instanceof |
| color: '#3370E6' | color: colors.primary[500] |
| style={{ marginBottom: 13 }} | marginBottom: spacing.md (16px) |

---

*设计文档创建时间: 2026-05-22*
*最后更新: 2026-05-22 — Phase 1 广扫描已完成，更新为 Phase 2 修复计划，修正页面数量 (174→540)，引用实际扫描数据*
*规范来源: CLAUDE.md + docs/规范汇总/Orion统一规范汇总.md (7567行) + menuConfigStore.ts*
*Phase 1 产出: docs/reports/scan-interaction-style.md, scan-logic-features.md, scan-microfront-remediation.md, full-module-scan-report-2026-05-22.md*
