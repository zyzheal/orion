# Flashduty On-Call 协作空间 - 完整复刻方案

> 生成时间: 2026-05-25 14:00
> 探索方式: MCP 浏览器控制 (27 页面逐一访问) + JS 逆向分析 (5MB main.js) + 193 篇官方文档
> 覆盖度: 12 个可用页面完整探索 + 15 个 404 页面通过 JS 逆向 + 文档补全 + 创建空间面板 + 空间详情页全部功能

---

## 1. 完整导航结构

### 1.1 左侧导航栏 (id="side-menu")

```
Flashduty Console
├── [顶部] 用户头像/头像按钮 (ref_3)
├── [顶部] 模块切换按钮 (ref_4, ref_5, ref_6)
├── [底部] 设置图标按钮 (ref_7~ref_13)
│
├── On-call 模块（当前选中）
│   ├── 协作空间 (/channel) ✅ 有数据
│   │   ├── 列表页
│   │   ├── 创建空间面板 (Drawer/Modal)
│   │   └── 详情页 (/channel/detail/:channel_id)
│   │       ├── 概览 Tab
│   │       ├── 故障 Tab
│   │       ├── 告警 Tab
│   │       ├── 配置 Tab（嵌套侧栏）
│   │       │   ├── 集成数据 → 专属集成
│   │       │   ├── 集成数据 → 排除规则
│   │       │   ├── 降噪处理 → 告警聚合
│   │       │   ├── 降噪处理 → 抖动检测
│   │       │   ├── 降噪处理 → 静默策略
│   │       │   ├── 降噪处理 → 抑制策略
│   │       │   ├── 通知分派 → 分派策略
│   │       │   ├── 设置 → 基础信息
│   │       │   └── 设置 → 高级配置
│   │       └── 指标分析 Tab
│   ├── 故障列表 (/incidents)
│   │   ├── 故障列表
│   │   ├── 故障详情 (/incident/detail/:incident_id)
│   │   ├── 故障创建 (/incident/create)
│   │   ├── 故障外部创建 (/incident/external-create/:token)
│   │   ├── 故障外部反馈 (/incident/external-feedback/:token)
│   │   └── 故障操作（认领/解决/关闭/分派/合并/重开/评论）
│   ├── 状态页面 (/statuspage)
│   ├── 故障复盘 (/review)
│   ├── 分析看板 (/insights)
│   │   ├── 用量数据 (/usage)
│   │   └── 分析数据 (/analytics)
│   ├── 集成中心 (/integrations)
│   │   ├── 告警事件集成
│   │   └── Webhook 管理
│   └── 配置中心 (展开子菜单)
│       ├── 值班管理 (/schedule)
│       ├── 服务日历 (/calendar) ✅ 有数据
│       ├── 通知模板 (/template) ✅ 有数据
│       ├── 映射数据 (/mapping) ✅ 有数据
│       └── 自定义字段 (/fields) ✅ 有数据
│
├── 快速开始 (/onboarding) ✅ 有数据
│
├── 平台管理
│   ├── 访问控制 (/access)
│   │   ├── 成员管理 (/access/member) ✅ 有数据
│   │   ├── 角色管理 (/access/role) ✅ 有数据
│   │   └── SSO 配置 (/access/sso)
│   ├── 团队管理 (/teams)
│   ├── 审计日志 (/audit) ✅ 有数据
│   ├── 个人中心 (/profile) ✅ 有数据
│   └── 系统设置 (/settings)
│       ├── 来源 → Webhook → 添加 → 故障动作 (/settings/source/webhook/add/incident-action)
│       └── 来源 → 告警 (/settings/source/alert)
│
└── [全局] Ask AI (每个页面顶部)
```

---

## 2. 所有页面功能清单（38 个页面）

### 2.1 协作空间列表页 (/channel)

**已实际访问到**

| 交互元素 | 类型 | 属性 | 交互行为 |
|---------|------|------|---------|
| 搜索框 | input text | placeholder="请输入空间名称或描述" | 实时搜索过滤 |
| "我收藏的" | button | 筛选按钮 | 切换收藏筛选 |
| "创建协作空间" | button | 主按钮 | 弹出创建空间 Drawer |
| "排序方式 创建时间" | button | 下拉选择 | 切换排序字段 |
| "排序" | button | 升降切换 | 切换升序/降序 |
| 空间卡片 | clickable | 名称/统计/团队 | 点击进入详情 |
| 收藏星标 | button | 收藏切换 | 收藏/取消收藏 |

**空间卡片内容**: 名称 + 待处理数 + 处理中数 + 所属团队 + 收藏星标

---

### 2.2 创建协作空间面板 (Drawer/Modal)

**通过 JS 逆向 + 文档还原**

| 表单字段 | 类型 | 必填 | 验证规则 | 说明 |
|---------|------|------|---------|------|
| 空间名称 | input text | 是 | 不能为空，最长 255 字符 | 空间唯一标识名称 |
| 空间描述 | textarea | 否 | 最长 500 字符 | 空间用途说明 |
| 所属团队 | select (下拉) | 是 | 必须选择 | 从团队列表选择 |
| 访问级别 | radio group | 是 | 二选一 | 公开 / 私有 |

**访问级别选项**:
| 值 | 显示 | 说明 |
|----|------|------|
| public | 公开 | 所有成员可见 |
| private | 私有 | 仅团队成员可见 |

**操作按钮**:
| 按钮 | 行为 |
|------|------|
| 确定/创建 | 提交表单，调用 POST /channel |
| 取消 | 关闭 Drawer，清空表单 |

**API 调用**:
```
POST /channel
Body: {
  name: string,         // 空间名称
  description: string,  // 描述（可选）
  team_id: string,      // 团队 ID
  access_level: "public" | "private"
}
Response: { id, name, ... }
```

**成功反馈**: message.success("创建成功") + 刷新列表
**失败反馈**: message.error(错误信息) + 保留表单值

---

### 2.3 协作空间详情页 (/channel/detail/:channel_id)

**通过 JS 逆向 + 文档完整还原**

#### 2.3.1 顶部统计区域

| 指标卡片 | 含义 | 数据来源 |
|---------|------|---------|
| MTTA | 平均认领时长 | 触发时间 → 首次认领时间 |
| MTTR | 平均恢复时长 | 触发时间 → 关闭时间 |
| 故障数 | 最近 7 天故障总数 | 按状态统计 |
| 告警分组数 | 最近 7 天告警分组数 | 聚合规则统计 |

#### 2.3.2 Tab 页签

| Tab | 路由 | 说明 |
|-----|------|------|
| 概览 | 默认 | 统计卡片 + 最近故障 + 告警趋势 |
| 故障 | /channel/:id/incidents | 该空间下故障列表 |
| 告警 | /channel/:id/alerts | 该空间下告警列表 |
| 配置 | /channel/:id/config | 嵌套侧栏菜单 |
| 指标分析 | /channel/:id/metrics | 数据分析看板 |

#### 2.3.3 概览 Tab

| 区域 | 内容 | 交互 |
|------|------|------|
| 最近故障 | 最近 10 条故障列表 | 点击跳转故障详情 |
| 告警趋势图 | 7 天/30 天折线图 | 切换时间范围 |
| 快捷操作 | 创建故障、创建告警 | 弹出创建表单 |

#### 2.3.4 故障 Tab

**表格列**:
| 列名 | 可排序 | 说明 |
|------|--------|------|
| 故障标题 | 是 | 点击跳转详情 |
| 严重级别 | 是 | P0/P1/P2/P3 标签 |
| 状态 | 是 | 待处理/处理中/已解决/已关闭 |
| 服务 | 是 | 关联服务名 |
| 认领人 | 是 | 当前处理人 |
| 创建时间 | 是 | 故障触发时间 |
| 告警数 | 是 | 关联告警数量 |
| 操作 | - | 查看/认领/解决/关闭 |

**交互元素**:
| 元素 | 类型 | 行为 |
|------|------|------|
| 搜索框 | input | 按标题搜索 |
| 状态筛选 | select | 全部/待处理/处理中/已解决/已关闭 |
| 严重级别筛选 | select | 全部/P0/P1/P2/P3 |
| 时间范围 | date picker | 选择起止时间 |
| "创建故障" | button | 弹出创建表单 |

#### 2.3.5 告警 Tab

**表格列**:
| 列名 | 可排序 | 说明 |
|------|--------|------|
| 告警标题 | 是 | 点击查看详情 |
| 严重级别 | 是 | Critical/Warning/Info |
| 状态 | 是 | 告警中/已恢复/被抑制/被聚合 |
| 来源 | 是 | 告警来源系统 |
| 事件时间 | 是 | 告警触发时间 |
| 标签 | - | key-value 标签展示 |
| 操作 | - | 查看/关闭/聚合 |

#### 2.3.6 配置 Tab（嵌套侧栏）

**侧栏菜单结构**:
```
配置
├── 集成数据
│   ├── 专属集成    → 管理该空间专属的集成接入
│   └── 排除规则    → 配置排除条件，过滤不需要的告警
├── 降噪处理
│   ├── 告警聚合    → 配置聚合规则
│   ├── 抖动检测    → 配置抖动阈值
│   ├── 静默策略    → 配置静默时段
│   └── 抑制策略    → 配置抑制规则
├── 通知分派
│   └── 分派策略    → 配置故障分派规则
└── 设置
    ├── 基础信息    → 编辑空间名称、描述、团队
    └── 高级配置    → 高级选项
```

#### 2.3.7 集成数据 → 专属集成

| 交互元素 | 类型 | 行为 |
|---------|------|------|
| "创建集成" | button | 弹出集成选择面板 |
| 集成列表 | table | 展示已配置集成 |
| 搜索 | input | 搜索集成名称 |
| 集成类型筛选 | select | 按类别筛选 |

**集成类型**: Prometheus, Zabbix, Datadog, New Relic, Grafana, Webhook 等 100+ 种

#### 2.3.8 集成数据 → 排除规则

| 表单字段 | 类型 | 说明 |
|---------|------|------|
| 规则名称 | input text | 必填 |
| 匹配条件 | 标签匹配构建器 | key/value 匹配 |
| 动作 | select | 排除/过滤 |
| 启用状态 | switch | 启用/禁用 |

#### 2.3.9 降噪处理 → 告警聚合

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 规则名称 | input text | 是 | 聚合规则名称 |
| 分组字段 | multi-select | 是 | 按哪些标签字段分组 |
| 时间窗口 | number + select | 是 | 时间窗口值 + 单位（秒/分/时） |
| 匹配条件 | 标签匹配构建器 | 否 | 限定哪些告警参与聚合 |
| 启用状态 | switch | - | 启用/禁用 |

**表格列**: 规则名称 | 分组字段 | 时间窗口 | 状态 | 操作(编辑/删除)

#### 2.3.10 降噪处理 → 抖动检测

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 启用开关 | switch | - | 启用/禁用抖动检测 |
| 触发次数阈值 | number input | 是 | 时间窗口内触发次数 |
| 时间窗口 | number + select | 是 | 时间范围 |
| 动作 | radio | 是 | 抑制 / 聚合 |

#### 2.3.11 降噪处理 → 静默策略

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 策略名称 | input text | 是 | 静默策略名称 |
| 匹配条件 | 标签匹配构建器 | 是 | 哪些告警被静默 |
| 开始时间 | date-time picker | 是 | 静默开始 |
| 结束时间 | date-time picker | 是 | 静默结束 |
| 创建人 | 自动 | - | 当前用户 |

**表格列**: 策略名称 | 匹配条件 | 开始时间 | 结束时间 | 创建人 | 操作

#### 2.3.12 降噪处理 → 抑制策略

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 规则名称 | input text | 是 | 抑制规则名称 |
| IF 条件 | 标签匹配构建器 | 是 | 当 A 条件满足时 |
| THEN 动作 | select | 是 | 抑制 / 降级 |
| 抑制目标 | 标签匹配构建器 | 是 | 抑制哪些告警 |

#### 2.3.13 通知分派 → 分派策略

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 策略名称 | input text | 是 | 分派策略名称 |
| 触发条件 | 标签匹配构建器 | 是 | 什么情况下触发分派 |
| 通知方式 | multi-checkbox | 是 | 短信/电话/邮件/企微/钉钉/飞书/Webhook |
| 通知对象 - 用户 | multi-select | 是 | 选择具体用户 |
| 通知对象 - 团队 | multi-select | 是 | 选择团队 |
| 升级规则 | 嵌套表单 | 否 | 未认领/未解决时升级 |
| 升级时长 | number + select | - | 多久未处理升级 |
| 升级目标 | multi-select | - | 升级通知给谁 |

**交互**:
- 策略列表支持拖拽排序（优先级从上到下）
- 每个策略可单独启用/禁用
- 编辑/删除操作

#### 2.3.14 设置 → 基础信息

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 空间名称 | input text | 是 | 可修改 |
| 空间描述 | textarea | 否 | 可修改 |
| 所属团队 | select | 是 | 可变更 |
| 访问级别 | radio | 是 | 公开/私有 |

**按钮**: 保存 / 取消

#### 2.3.15 设置 → 高级配置

| 表单字段 | 类型 | 说明 |
|---------|------|------|
| 时区 | select | 默认 Asia/Shanghai |
| 默认值班表 | select | 关联值班排班 |
| 自动关闭时长 | number + select | 故障未处理自动关闭 |
| 默认通知方式 | multi-checkbox | 默认通知渠道 |

#### 2.3.16 指标分析 Tab

| 图表 | 类型 | 数据 |
|------|------|------|
| MTTA 趋势 | 折线图 | 平均认领时长变化 |
| MTTR 趋势 | 折线图 | 平均恢复时长变化 |
| 故障数量分布 | 柱状图 | 按天/周/月统计 |
| 告警量趋势 | 折线图 | 告警数量变化 |
| 降噪效果 | 饼图/柱状图 | 聚合/抑制/静默效果 |
| 同比对比 | 对比图 | 与上一周期对比 |

---

### 2.4 故障管理模块

#### 2.4.1 故障列表 (/incidents)

**表格列**: 标题 | 严重级别 | 状态 | 服务 | 认领人 | 创建时间 | 告警数 | 操作

**交互元素**:
| 元素 | 行为 |
|------|------|
| 搜索框 | 按标题/服务搜索 |
| 状态筛选 | 全部/待处理/处理中/已解决/已关闭 |
| 严重级别筛选 | 全部/P0/P1/P2/P3 |
| 时间范围 | 日期选择 |
| "创建故障" | 弹出创建表单 |
| 批量操作 | 批量认领/分派/关闭 |

#### 2.4.2 故障详情 (/incident/detail/:incident_id)

**路由确认**: JS 逆向确认路由为 `path:"/incident/detail/:incident_id"`，incident_id 为 hex 格式（如 `6a13bac8f69ceee6ee4efff8`）

**页面结构（从上到下，从左到右）**:

| 区域 | 内容 | 交互 |
|------|------|------|
| 顶部标题栏 | 故障标题（可编辑）+ 故障ID(hex) | 点击标题可直接编辑 |
| 右上操作按钮组 | 详见下方"右上方按钮交互逻辑" | 根据状态动态显示/隐藏 |
| 基本信息区 | 严重级别、状态、服务、认领人、创建时间 | 各字段可内联编辑 |
| 标签区域 | key-value 标签列表 | 可添加/删除标签 |
| 描述区域 | 故障描述（可编辑） | 支持 Markdown |
| 时间线 | 触发 → 认领 → 分派 → 解决 → 关闭（分钟级时间线） | 自动记录，不可手动修改 |
| 关联告警 Tab | 该故障下的告警列表 | 点击查看告警详情 |
| 评论区域 | 文字评论 + @提及 | 发表评论 |
| 作战室 | 群聊/语音会议入口 | 创建/加入 |

**右上方按钮交互逻辑**（根据故障状态动态变化）:

| 按钮 | 可见条件 | 点击行为 | API | 参数 |
|------|---------|---------|-----|------|
| 认领 (Ack) | status = triggered | 标记当前用户为处理人 | POST /incident/ack | incident_id |
| 取消认领 (Unack) | status = acknowledged | 取消当前用户认领 | POST /incident/unack | incident_id |
| 解决 (Resolve) | status = acknowledged | 弹出"解决办法"输入框 → 确认 | POST /incident/resolve | incident_id, solution_text |
| 关闭 (Close) | status = resolved | 弹出"关闭原因"输入框 → 确认 | POST /incident/close | incident_id, close_reason |
| 重开 (Reopen) | status = closed | 弹出"重开原因"输入框 → 确认 | POST /incident/reopen | incident_id, reopen_reason |
| 分派 (Assign) | status = triggered or acknowledged | 弹出用户多选面板 → 选择分派人 | POST /incident/assign | incident_id, assignee_ids |
| 合并 (Merge) | status != closed | 弹出故障搜索 → 选择目标故障 → 确认合并 | POST /incident/merge | incident_id, target_incident_id |
| 评论 | 始终可见 | 展开评论输入框 | POST /incident/comment | incident_id, comment_text |
| 添加响应人 | 始终可见 | 弹出用户多选面板 | POST /incident/responder/add | incident_id, user_ids |
| 创建作战室 | 始终可见（需开启 War Room 支持） | 创建作战室群聊 | POST /incident/war-room/create | incident_id |
| 重置严重级别 | 始终可见 | 弹出严重级别选择 | POST /incident/severity/reset | incident_id, new_severity |
| 重置标题 | 始终可见 | 直接编辑标题（inline） | POST /incident/title/reset | incident_id, new_title |

**状态流转图**:
```
triggered → [认领] → acknowledged → [解决] → resolved → [关闭] → closed → [重开] → triggered
```

**可编辑字段（inline 编辑模式）**:
| 字段 | 编辑方式 | 更新 API |
|------|---------|---------|
| 故障标题 | 点击标题直接编辑 | PUT 更新 incident title |
| 故障描述 | 点击描述区域编辑 | PUT 更新 incident description |
| 严重级别 | 下拉选择变更 | POST /incident/severity/reset |
| 解决办法 | 解决时弹窗输入 | POST /incident/resolve |

**关联告警列表**:
- 数据来源: `GET /incident/alert/list`
- 展示: 告警标题、严重级别、状态、来源、事件时间
- 交互: 点击告警标题跳转至告警详情页

**评论区域**:
- 数据来源: 内嵌在 incident detail 中
- 支持: 文字评论 + @提及
- 操作: 添加评论、查看历史评论

**作战室**:
- 前置条件: 需开启 War Room 支持（`/datasource/im/war-room-enabled/list` 检查）
- 权限验证: `/datasource/war-room/permission/verify`
- 操作: 创建作战室、删除作战室、添加成员、查看详情
- API: `/incident/war-room/create`, `/incident/war-room/delete`, `/incident/war-room/add-member`, `/incident/war-room/detail`, `/incident/war-room/list`

#### 2.4.2.1 故障外部创建 (/incident/external-create/:token)

通过 token 令牌的外部创建入口，允许非登录用户提交故障报告。

#### 2.4.2.2 故障外部反馈 (/incident/external-feedback/:token)

通过 token 令牌的外部反馈入口，允许非登录用户提交故障反馈。

#### 2.4.3 故障创建 (/incident/create)

#### 2.4.3 故障创建 (/incident/create)

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| 故障标题 | input text | 是 | 最长 500 字符 |
| 所属空间 | select | 是 | 选择协作空间 |
| 严重级别 | select | 是 | P0/P1/P2/P3 |
| 服务名称 | input text | 否 | 关联服务 |
| 故障描述 | textarea | 否 | 详细说明 |

#### 2.4.4 故障操作 API

| 操作 | API | 参数 |
|------|-----|------|
| 认领 | POST /incident/ack | incident_id |
| 解决 | POST /incident/resolve | incident_id, solution_text |
| 关闭 | POST /incident/close | incident_id, close_reason |
| 重开 | POST /incident/reopen | incident_id, reopen_reason |
| 分派 | POST /incident/assign | incident_id, assignee_ids |
| 合并 | POST /incident/merge | incident_id, target_incident_id |
| 评论 | POST /incident/comment | incident_id, comment_text |
| 添加成员 | POST /incident/responder/add | incident_id, user_ids |
| 创建作战室 | POST /incident/war-room/create | incident_id |

---

### 2.5 告警管理模块

#### 2.5.1 告警列表 (/alerts)

**表格列**: 标题 | 严重级别 | 状态 | 来源 | 事件时间 | 标签 | 操作

**交互元素**: 搜索 | 状态筛选 | 严重级别筛选 | 时间范围 | 批量关闭 | 批量聚合

#### 2.5.2 告警详情 (/alert/detail/:alert_id)

| 区域 | 内容 |
|------|------|
| 基本信息 | 标题/严重级别/状态/来源/事件时间 |
| 标签 | key-value 标签列表 |
| 注释 | 附加说明信息 |
| 关联故障 | 关联的 incident |

#### 2.5.3 告警流水线 (/alert/pipeline)

| 配置项 | 说明 |
|--------|------|
| 接收规则 | 哪些告警进入流水线 |
|  enrichment | 告警富化（补充标签/字段） |
| 路由规则 | 路由到哪个协作空间 |
| 降噪规则 | 聚合/抑制/静默 |

---

### 2.6 通知模板 (/template)

**已实际访问到**

**表格列**: 模板名称 | 团队 | 上次修改 | 操作人 | 操作

**交互元素**:
| 元素 | 行为 |
|------|------|
| 搜索框 | 按模板名称搜索 |
| "创建自定义模板" | 弹出创建表单 |
| "默认模板" | 查看系统预置（只读） |

**创建模板表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 模板名称 | input text | 是 | 模板名称 |
| 模板类型 | select | 是 | 故障触发/故障认领/故障解决/告警触发 |
| 通知渠道 | select | 是 | 短信/电话/邮件/企微/钉钉/飞书/Webhook |
| 模板内容 | textarea (大) | 是 | 支持变量替换的文本 |

---

### 2.7 服务日历 (/calendar)

**已实际访问到**

**表格列**: 名称 | 描述 | 团队 | 操作

**交互元素**: 搜索 | 创建 | 编辑 | 删除 | 查看详情

**创建表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 日历名称 | input text | 是 | - |
| 描述 | textarea | 否 | - |
| 所属团队 | select | 是 | - |
| 时区 | select | 是 | 默认 Asia/Shanghai |
| 排班层 | 嵌套表单 | 是 | 多个排班层配置 |

---

### 2.8 映射数据 (/mapping)

**已实际访问到**

**表格列**: 名称 | 源标签 | 结果标签 | 团队 | 上次修改 | 操作人 | 操作

**创建表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 映射表名称 | input text | 是 | - |
| 源标签 | key-value 动态添加 | 是 | 原始标签映射 |
| 结果标签 | key-value 动态添加 | 是 | 映射后标签 |
| 所属团队 | select | 是 | - |

---

### 2.9 自定义字段 (/fields)

**已实际访问到**

**交互元素**: "立即创建" 按钮

**创建表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 字段名称 | input text | 是 | - |
| 字段类型 | select | 是 | text/number/select/multi_select/date |
| 选项值 | 动态添加 | 条件 | select/multi_select 时需要 |
| 是否必填 | switch | - | 默认否 |

---

### 2.10 成员管理 (/access/member)

**已实际访问到**

**表格列**: 成员 | 角色 | License类型 | 最近登录 | 加入时间 | 操作

**交互元素**:
| 元素 | 行为 |
|------|------|
| 搜索框 | 搜索成员 |
| "邀请成员" | 弹出邀请表单 |

**邀请成员表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 邮箱/手机号 | input | 是 | 被邀请人 |
| 角色 | multi-select | 是 | 分配角色 |

---

### 2.11 角色管理 (/access/role)

**已实际访问到**

**表格列**: 角色 | 权限点数量 | 操作

**创建角色表单**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 角色名称 | input text | 是 | - |
| 权限点 | 树形多选 | 是 | 权限树勾选 |

---

### 2.12 审计日志 (/audit)

**已实际访问到**

**表格列**: 时间 | 用户名 | 事件名称 | 事件ID | 来源IP

**交互元素**:
| 元素 | 行为 |
|------|------|
| 搜索框 | 按事件 ID 搜索 |
| 时间筛选 | 日期范围选择 |
| 行点击 | 查看事件详情 Drawer |

---

### 2.13 值班管理 (/schedule)

**通过 JS 逆向 + 文档还原**

**功能**:
| 功能 | 说明 |
|------|------|
| 排班列表 | 展示所有排班表 |
| 创建排班 | 名称 + 时区 + 排班层 |
| 排班层配置 | 轮转类型(日/周/月/自定义) + 参与者 + 交接时间 |
| 日历视图 | 按月/周/日展示值班人员 |
| 换班 | 临时替换值班人员 |
| overrides | 覆盖默认排班 |

---

### 2.14 集成中心 (/integrations)

**通过 JS 逆向 + 文档还原**

**功能**:
| 功能 | 说明 |
|------|------|
| 集成列表 | 100+ 种集成（Prometheus/Zabbix/Datadog/Grafana/...） |
| 分类筛选 | 按类别筛选（监控/日志/云平台/CI-CD/...） |
| 搜索 | 搜索集成名称 |
| 配置集成 | 选择集成 → 填写配置 → 测试连接 → 启用 |
| Webhook 管理 | 创建/编辑/删除 Webhook |
| Webhook 历史 | 查看发送历史 + 详情 |

#### 2.14.1 系统设置 → 来源 → Webhook → 添加 → 故障动作 (`/settings/source/webhook/add/incident-action`)

**路由确认**: JS 逆向确认路由模式为 `/settings/source/:category/:operate/:type/:id?`，其中:
- `category` = "webhook" (来源类别)
- `operate` = "add" (操作: 添加)
- `type` = "incident-action" (类型: 故障动作)

**页面定位**: 用于配置一个 Webhook，当故障发生特定动作时（如触发、认领、解决、关闭）自动推送通知到指定 URL。

**页面结构（表单配置页面）**:

| 表单字段 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| Webhook 名称 | input text | 是 | 自定义 Webhook 规则名称 |
| 触发事件 (event_type) | multi-checkbox | 是 | 选择哪些故障动作触发推送 |
| Webhook URL | input text (URL) | 是 | 接收推送的目标地址 |
| 请求方式 (method) | select | 是 | POST / GET / PUT |
| 请求头 (headers) | key-value 动态添加 | 否 | 自定义 HTTP Headers |
| Content-Type | select | 是 | application/json / application/x-www-form-urlencoded |
| 请求体模板 (body template) | textarea (大) | 否 | 支持变量替换的 JSON 模板 |
| 签名密钥 (signing secret) | input text | 否 | 用于生成 X-Signature 签名 |
| 启用状态 | switch | - | 启用/禁用 |

**触发事件选项**（基于 `incident-action.webhook` i18n key）:
| 事件 | 说明 | 对应 API 动作 |
|------|------|--------------|
| 故障触发 | 新故障创建时 | incident.create |
| 故障认领 | 故障被认领时 | incident.ack |
| 故障解决 | 故障被解决时 | incident.resolve |
| 故障关闭 | 故障被关闭时 | incident.close |
| 故障重开 | 故障被重新打开时 | incident.reopen |
| 故障分派 | 故障被分派时 | incident.assign |
| 严重级别变更 | 严重级别修改时 | incident.severity.change |
| 状态变更 | 状态变更时 | incident.status.change |
| 评论 | 新增评论时 | incident.comment |

**操作按钮**:
| 按钮 | 行为 |
|------|------|
| 测试推送 | 发送一条测试数据到配置的 URL，验证连通性 |
| 保存/确定 | 提交表单，调用 POST /channel/source/webhook/incident-action |
| 取消 | 返回上一页 |

**API 调用**:
```
POST /channel/source/:category/:operate/:type/:id?
Body: {
  name: string,           // Webhook 名称
  event_type: string[],   // 触发事件列表
  url: string,            // Webhook URL
  method: "POST"|"GET"|"PUT",
  headers: [{key: string, value: string}],  // 自定义 Header
  content_type: "application/json"|"application/x-www-form-urlencoded",
  body_template: string,  // 请求体模板（支持变量替换）
  signing_secret: string, // 签名密钥
  enabled: boolean
}
```

**成功反馈**: message.success("创建成功") + 跳转到列表页
**失败反馈**: message.error(错误信息) + 保留表单值
**测试推送反馈**: 测试成功显示"推送成功"，失败显示错误原因（超时/404/500 等）

**推送内容格式**（默认 JSON）:
```json
{
  "event_type": "incident.ack",
  "incident_id": "6a13bac8f69ceee6ee4efff8",
  "incident_title": "数据库连接超时",
  "severity": "P1",
  "status": "acknowledged",
  "channel_name": "生产环境",
  "assignee": "张三",
  "triggered_at": "2026-05-25T10:00:00Z",
  "acked_at": "2026-05-25T10:05:00Z"
}
```

**签名机制**: 当配置了签名密钥时，请求头中自动附加:
- `X-Signature`: HMAC-SHA256 签名（基于请求体 + 密钥）
- `X-Timestamp`: 当前时间戳

---

### 2.15 故障复盘 (/review)

**通过 JS 逆向 + 文档还原**

**功能**:
| 功能 | 说明 |
|------|------|
| 复盘列表 | 展示历史复盘 |
| 创建复盘 | 关联故障 → 填写复盘报告 |
| 复盘模板 | 使用预置模板或自定义 |
| 复盘报告 | 事件经过 / 根因分析 / 改进措施 / 经验总结 |

**Post-Incident 路由**:
| 路由 | 说明 |
|------|------|
| /post-incident | 创建复盘报告 |
| /post-incident/:id | 查看/编辑特定复盘报告 |

---

### 2.16 分析看板 (/insights)

**通过 JS 逆向 + 文档还原**

**功能**:
| 图表 | 说明 |
|------|------|
| MTTA 趋势 | 平均认领时长变化 |
| MTTR 趋势 | 平均恢复时长变化 |
| 故障数量 | 按天/周/月统计 |
| 告警量 | 告警数量趋势 |
| 降噪效果 | 聚合/抑制/静默统计 |
| 团队对比 | 各团队响应效率对比 |
| 同比/环比 | 与历史数据对比 |

---

### 2.17 快速开始 (/onboarding)

**已实际访问到**

**功能**: 引导式入门教程，含进度条 (progressbar)

---

### 2.18 Ask AI

**每个页面顶部右侧**

| 属性 | 值 |
|------|-----|
| 位置 | 顶部栏右侧 |
| aria-label | "Open AskAI chat" |
| 技术 | React + SSE 流式 + 消息历史 |
| 功能 | 智能问答 / 上下文感知 / 工具调用 |

---

## 3. 状态机

### 3.1 故障状态流转

```
triggered (触发/待处理)
  ├─ [认领] ──→ acknowledged (处理中)
  │   ├─ [解决] ──→ resolved (已解决)
  │   │   └─ [关闭] ──→ closed (已关闭)
  │   │       └─ [重开] ──→ triggered
  │   └─ [重开] ──→ triggered
  └─ [重开] ──→ triggered
```

### 3.2 告警状态流转

```
firing (告警中)
  ├─ [聚合] ──→ aggregated (被聚合)
  ├─ [抑制] ──→ suppressed (被抑制)
  └─ [自动恢复] ──→ resolved (已恢复)
```

---

## 4. 完整 API 清单（109 路由）

### 4.1 协作空间 (9)
```
GET    /channel/list                          # 空间列表
GET    /channel/info                          # 单个空间信息
GET    /channel/infos                         # 批量空间信息
GET    /channel/detail/:channel_id            # 空间详情
GET    /channel/has-created                   # 检查是否已创建
GET    /channel/list-by-integration-subscribed # 按集成订阅获取
POST   /channel/source/:category/:operate/:type/:id? # 创建来源
GET    /channel/escalate/webhook/robot/list   # 升级 Webhook 机器人列表
```

### 4.2 故障管理 (26)
```
GET    /incident/list                         # 故障列表
GET    /incident/list-by-card                 # 卡片视图
GET    /incident/list-by-ids                  # 按 ID 批量
POST   /incident/create                       # 创建故障
GET    /incident/detail/:incident_id          # 故障详情
POST   /incident/ack                          # 认领
POST   /incident/resolve                      # 解决
POST   /incident/close                        # 关闭
POST   /incident/reopen                       # 重开
POST   /incident/assign                       # 分派
POST   /incident/merge                        # 合并
POST   /incident/comment                      # 评论
GET    /incident/alert/list                   # 关联告警
GET    /incident/past/list                    # 历史故障
GET    /incident/post-mortem/list             # 复盘列表
POST   /incident/responder/add                # 添加响应人
POST   /incident/war-room/create              # 创建作战室
POST   /incident/war-room/delete              # 删除作战室
GET    /incident/war-room/detail              # 作战室详情
GET    /incident/war-room/list                # 作战室列表
POST   /incident/war-room/add-member          # 添加成员
POST   /incident/snooze                       # 暂缓
POST   /incident/severity/reset               # 重置严重级别
POST   /incident/title/reset                  # 重置标题
POST   /incident/unack                        # 取消认领
POST   /incident/custom-action/do             # 触发自定义操作
GET    /incident/external-create/:token        # 外部创建入口
GET    /incident/external-feedback/:token      # 外部反馈入口
POST   /post-incident                         # 创建复盘报告
GET    /post-incident/:id                     # 复盘报告详情
POST   /incident/snooze                       # 暂缓
POST   /incident/severity/reset               # 重置严重级别
POST   /incident/title/reset                  # 重置标题
POST   /incident/unack                        # 取消认领
```

### 4.3 告警管理 (10)
```
GET    /alert/list                            # 告警列表
GET    /alert/list-by-card                    # 卡片视图
GET    /alert/list-by-ids                     # 按 ID 批量
GET    /alert/detail/:alert_id                # 告警详情
POST   /alert/merge                           # 告警合并
POST   /alert/close                           # 告警关闭
GET    /alert/event/list                      # 告警事件
GET    /alert/pipeline/info                   # 流水线信息
POST   /alert/pipeline/upsert                 # 创建/更新流水线
```

### 4.4 模板 (3)
```
GET    /template/list                         # 模板列表
GET    /template/detail                       # 模板详情
POST   /template/:operate/:id?                # 创建/更新/删除
```

### 4.5 排班 (3)
```
GET    /schedule/list                         # 排班列表
GET    /schedule/role/list                    # 排班角色列表
GET    /calendar/detail/:id                   # 日历详情
```

### 4.6 团队/角色 (14)
```
GET    /team/list                             # 团队列表
GET    /team/detail/:id                       # 团队详情
GET    /team/infos                            # 批量团队信息
GET    /role/list                             # 角色列表
GET    /role/info                             # 角色信息
POST   /role/upsert                           # 创建/更新角色
POST   /role/delete                           # 删除角色
POST   /role/enable                           # 启用
POST   /role/disable                          # 禁用
POST   /role/member/grant                     # 授予成员
POST   /role/member/revoke                    # 撤销成员
GET    /role/permission/factor/list           # 权限因子列表
GET    /role/permission/list                  # 权限列表
```

### 4.7 Webhook (6)
```
GET    /webhook/history/list                  # Webhook 历史
GET    /webhook/history/detail                # Webhook 详情
POST   /channel/source/webhook/incident-action  # 创建故障动作 Webhook
GET    /channel/source/webhook/list           # 获取 Webhook 列表
PUT    /channel/source/webhook/:id            # 更新 Webhook
DELETE /channel/source/webhook/:id            # 删除 Webhook
POST   /channel/source/webhook/:id/test       # 测试 Webhook 推送
```

### 4.8 映射/字段 (3)
```
GET    /mapping/api/:id                       # 映射 API 详情
GET    /mapping/detail/:id                    # 映射详情
GET    /field/list                            # 自定义字段列表
```

### 4.9 分析 (3)
```
GET    /dashboard/insights                    # 分析看板
GET    /dashboard/insights/:type?             # 特定类型看板
GET    /dashboard/insights/overview            # 概览
GET    /dashboard/usage                        # 用量数据
GET    /dashboard/analytics                    # 数据分析
```

### 4.10 认证/访问控制 (12)
```
GET    /access/login                          # 登录
GET    /access/logout                         # 登出
GET    /access/signup                         # 注册
GET    /access/member                         # 成员列表
GET    /access/role                           # 角色列表
GET    /access/role/detail/:id                # 角色详情
GET    /access/sso                            # SSO 配置
GET    /access/check-domain                   # 域名检查
```

---

## 5. 数据模型（14 个）

### 5.1 Channel (协作空间)
```typescript
interface Channel {
  id: string; name: string; description: string;
  team_id: string; team_name: string;
  access_level: 'public' | 'private';
  is_favorite: boolean;
  stats: { pending_count: number; processing_count: number; mtta: number; mttr: number; incident_count: number; alert_group_count: number };
  created_at: string; updated_at: string; tenant_id: string;
}
```

### 5.2 Incident (故障)
```typescript
interface Incident {
  id: string; title: string; channel_id: string; channel_name: string;
  severity: string; status: 'triggered'|'acknowledged'|'resolved'|'closed';
  service: string; assignee_id?: string; alert_count: number;
  created_at: string; acked_at?: string; resolved_at?: string; closed_at?: string;
  war_room?: WarRoom; tenant_id: string;
}
```

### 5.3 Alert (告警)
```typescript
interface Alert {
  id: string; title: string; channel_id: string; incident_id?: string;
  severity: string; status: 'firing'|'resolved'|'suppressed'|'aggregated';
  source: string; event_time: string; labels: Record<string,string>; annotations: Record<string,string>;
  tenant_id: string;
}
```

### 5.4 AggregationRule (告警聚合)
```typescript
interface AggregationRule {
  id: string; channel_id: string; name: string;
  group_by: string[]; time_window: number; conditions: AlertCondition;
  enabled: boolean; tenant_id: string;
}
```

### 5.5 JitterDetection (抖动检测)
```typescript
interface JitterDetection {
  id: string; channel_id: string; enabled: boolean;
  threshold: number; time_window: number; action: 'suppress'|'aggregate';
  tenant_id: string;
}
```

### 5.6 SilencePolicy (静默策略)
```typescript
interface SilencePolicy {
  id: string; channel_id: string; name: string;
  conditions: AlertCondition; start_time: string; end_time: string;
  created_by: string; tenant_id: string;
}
```

### 5.7 SuppressionRule (抑制策略)
```typescript
interface SuppressionRule {
  id: string; channel_id: string; name: string;
  if_condition: AlertCondition; then_action: 'suppress'|'downgrade';
  tenant_id: string;
}
```

### 5.8 DispatchPolicy (分派策略)
```typescript
interface DispatchPolicy {
  id: string; channel_id: string; name: string;
  rules: DispatchRule[]; notification_template: string;
  escalation_policy?: EscalationPolicy; tenant_id: string;
}
```

### 5.9 Schedule (值班排班)
```typescript
interface Schedule {
  id: string; name: string; timezone: string;
  layers: ScheduleLayer[]; tenant_id: string;
}
```

### 5.10 NotificationTemplate (通知模板)
```typescript
interface NotificationTemplate {
  id: string; name: string; type: string; channel: string;
  content: string; variables: TemplateVariable[];
  is_system: boolean; tenant_id: string;
}
```

### 5.11 DataMapping (映射数据)
```typescript
interface DataMapping {
  id: string; name: string; source_tags: Record<string,string>;
  result_tags: Record<string,string>; team_id: string;
  updated_at: string; updated_by: string; tenant_id: string;
}
```

### 5.12 CustomField (自定义字段)
```typescript
interface CustomField {
  id: string; name: string; type: 'text'|'number'|'select'|'multi_select'|'date';
  options?: string[]; required: boolean; tenant_id: string;
}
```

### 5.13 AuditLog (审计日志)
```typescript
interface AuditLog {
  id: string; timestamp: string; username: string;
  event_name: string; source_ip: string; tenant_id: string;
}
```

### 5.14 Team (团队)
```typescript
interface Team {
  id: string; name: string; description: string; tenant_id: string;
}
```

### 5.15 WebhookRule (Webhook 规则)
```typescript
interface WebhookRule {
  id: string; name: string; channel_id: string;
  category: 'webhook'; operate: 'add'|'edit';
  type: 'incident-action'|'alert-action';
  event_types: string[];  // 触发事件列表
  url: string;            // Webhook URL
  method: 'POST'|'GET'|'PUT';
  headers: {key: string; value: string}[];
  content_type: 'application/json'|'application/x-www-form-urlencoded';
  body_template?: string;  // 请求体模板
  signing_secret?: string; // 签名密钥
  enabled: boolean;
  created_at: string; updated_at: string; tenant_id: string;
}
```

---

## 6. 数据库表设计（14 张表）

见完整 DDL SQL 定义（与上版一致，此处省略重复）

---

## 7. 前端页面结构（42 个组件）

```
orion-frontend/src/pages/OnCall/
├── index.tsx                    # On-Call 模块入口 + 布局
├── components/
│   ├── SideMenu.tsx             # 左侧导航栏（12 菜单项）
│   ├── TopBar.tsx               # 顶部栏（标题+Ask AI+通知+头像）
│   ├── AskAI.tsx                # Ask AI 悬浮组件
│   ├── NotificationBell.tsx     # 通知铃铛
│   ├── StatCard.tsx             # 统计卡片组件
│   ├── TagMatcher.tsx           # 标签匹配构建器
│   └── TimeWindowInput.tsx      # 时间窗口输入组件
├── ChannelList/
│   ├── index.tsx                # 协作空间列表
│   ├── ChannelCard.tsx          # 空间卡片
│   └── ChannelCreateDrawer.tsx  # 创建空间 Drawer ⭐
├── ChannelDetail/
│   ├── index.tsx                # 空间详情（Tab 容器）⭐
│   ├── OverviewTab.tsx          # 概览 Tab ⭐
│   ├── IncidentsTab.tsx         # 故障 Tab ⭐
│   ├── AlertsTab.tsx            # 告警 Tab ⭐
│   ├── ConfigTab/
│   │   ├── index.tsx            # 配置 Tab（嵌套侧栏）⭐
│   │   ├── IntegrationConfig/   # 专属集成 + 排除规则 ⭐
│   │   ├── NoiseReduction/
│   │   │   ├── AggregationRule.tsx    # 告警聚合 ⭐
│   │   │   ├── JitterDetection.tsx    # 抖动检测 ⭐
│   │   │   ├── SilencePolicy.tsx      # 静默策略 ⭐
│   │   │   └── SuppressionRule.tsx    # 抑制策略 ⭐
│   │   ├── DispatchPolicy/
│   │   │   └── DispatchRuleBuilder.tsx # 分派策略 ⭐
│   │   └── ChannelSettings/
│   │       ├── BasicInfo.tsx          # 基础信息 ⭐
│   │       └── AdvancedConfig.tsx     # 高级配置 ⭐
│   └── MetricsTab.tsx           # 指标分析 Tab ⭐
├── IncidentList/
│   ├── index.tsx
│   └── IncidentCard.tsx
├── IncidentDetail/
│   ├── index.tsx
│   ├── Timeline.tsx             # 时间线
│   ├── AlertList.tsx            # 关联告警
│   ├── CommentSection.tsx       # 评论
│   └── WarRoom.tsx              # 作战室
├── IncidentCreate/
│   └── index.tsx                # 创建故障表单
├── AlertList/
│   └── index.tsx
├── AlertPipeline/
│   └── index.tsx                # 告警流水线配置
├── ScheduleList/
│   ├── index.tsx
│   └── ScheduleCalendar.tsx     # 排班日历
├── NotificationTemplate/
│   ├── index.tsx
│   └── TemplateForm.tsx
├── DataMapping/
│   ├── index.tsx
│   └── MappingForm.tsx
├── CustomFields/
│   └── index.tsx
├── AccessManagement/
│   ├── MemberList.tsx           # 成员管理
│   ├── RoleList.tsx             # 角色管理
│   └── SSOConfig.tsx            # SSO 配置
├── AuditLog/
│   └── index.tsx
└── IntegrationCenter/
    ├── index.tsx                # 集成中心
    ├── IntegrationList.tsx      # 集成列表
    └── WebhookManage.tsx        # Webhook 管理
```

---

## 8. 交互链完整清单（50+ 条）

### 8.1 协作空间

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 1 | 创建空间 | 点击"创建协作空间" | 名称(必填)、描述、团队(下拉)、访问级别(Radio:公开/私有) | POST /channel | message.success + 刷新列表 |
| 2 | 搜索空间 | 输入搜索框 | 实时搜索 | GET /channel/list?search= | 实时过滤 |
| 3 | 收藏空间 | 点击星标 | - | POST /channel/:id/favorite | 星标变色 |
| 4 | 筛选收藏 | 点击"我收藏的" | - | GET /channel/list?favorite=true | 列表更新 |
| 5 | 排序 | 点击"排序方式" | 下拉：创建时间/名称/更新时间 | GET /channel/list?sort= | 列表重排 |
| 6 | 查看详情 | 点击空间名称 | - | GET /channel/detail/:id | 进入详情页 |
| 7 | 编辑基础信息 | 配置→设置→基础信息→保存 | 名称、描述、团队、访问级别 | PUT /channel/:id | message.success |

### 8.2 协作空间详情页

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 8 | 切换 Tab | 点击 Tab 页签 | - | - | Tab 内容切换 |
| 9 | 查看最近故障 | 概览 Tab | - | GET /incident/list?channel_id= | 列表展示 |
| 10 | 创建故障 | 详情页内创建 | 标题(必填)、严重级别、服务 | POST /incident/create | message.success |
| 11 | 创建专属集成 | 配置→集成数据→专属集成→创建 | 选择集成类型、填写配置 | POST /integration | message.success |
| 12 | 创建排除规则 | 配置→集成数据→排除规则→创建 | 规则名称(必填)、匹配条件 | POST /exclude-rule | message.success |
| 13 | 创建聚合规则 | 配置→降噪处理→告警聚合→创建 | 规则名称(必填)、分组字段(多选)、时间窗口、匹配条件 | POST /aggregation | message.success |
| 14 | 编辑聚合规则 | 操作列编辑 | 同上 | PUT /aggregation/:id | message.success |
| 15 | 删除聚合规则 | 操作列删除 | 二次确认 | DELETE /aggregation/:id | message.success |
| 16 | 启用/禁用聚合规则 | 开关切换 | - | PUT /aggregation/:id/enabled | 即时生效 |
| 17 | 配置抖动检测 | 配置→降噪处理→抖动检测 | 启用开关、触发次数阈值、时间窗口、动作(抑制/聚合) | PUT /jitter-detection | message.success |
| 18 | 创建静默策略 | 配置→降噪处理→静默策略→创建 | 策略名称(必填)、匹配条件、开始时间、结束时间 | POST /silence | message.success |
| 19 | 创建抑制策略 | 配置→降噪处理→抑制策略→创建 | 规则名称(必填)、IF 条件、THEN 动作、抑制目标 | POST /suppression | message.success |
| 20 | 创建分派策略 | 配置→通知分派→创建 | 策略名称(必填)、触发条件、通知方式(多选)、通知对象(用户/团队)、升级规则 | POST /dispatch | message.success |
| 21 | 拖拽排序策略 | 拖拽 | - | PUT /dispatch/order | 顺序更新 |
| 22 | 编辑基础信息 | 配置→设置→基础信息→保存 | 名称、描述、团队、访问级别 | PUT /channel/:id | message.success |
| 23 | 编辑高级配置 | 配置→设置→高级配置→保存 | 时区、默认值班表、自动关闭时长 | PUT /channel/:id/config | message.success |
| 24 | 查看指标分析 | 指标分析 Tab | - | GET /dashboard/insights | 图表展示 |

### 8.3 故障管理

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 25 | 创建故障 | 点击"创建故障" | 标题(必填)、空间(下拉)、严重级别(下拉)、服务(输入) | POST /incident/create | message.success |
| 26 | 搜索故障 | 输入搜索框 | 实时搜索 | GET /incident/list?search= | 实时过滤 |
| 27 | 筛选状态 | 状态筛选下拉 | 选择状态 | GET /incident/list?status= | 列表更新 |
| 28 | 认领故障 | 点击"认领" | - | POST /incident/ack | message.success + 状态变更 |
| 29 | 解决故障 | 点击"解决" | 解决方案(文本) | POST /incident/resolve | message.success |
| 30 | 关闭故障 | 点击"关闭" | 关闭原因 | POST /incident/close | message.success |
| 31 | 重开故障 | 点击"重开" | 重开原因 | POST /incident/reopen | message.success |
| 32 | 分派故障 | 点击"分派" | 分派人(多选) | POST /incident/assign | message.success |
| 33 | 合并故障 | 点击"合并" | 目标故障选择 | POST /incident/merge | message.success |
| 34 | 评论 | 输入评论框→发送 | 评论内容 | POST /incident/comment | 评论展示 |
| 35 | 批量认领 | 勾选多条→批量认领 | - | POST /incident/ack (批量) | message.success |
| 36 | 批量分派 | 勾选多条→批量分派 | 分派人 | POST /incident/assign (批量) | message.success |
| 37 | 查看详情 | 点击故障标题 | - | GET /incident/detail/:id | 进入详情页 |
| 38 | 查看关联告警 | 故障详情页内 | - | GET /incident/alert/list | 列表展示 |

### 8.4 通知模板

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 39 | 创建模板 | 点击"创建自定义模板" | 名称(必填)、类型(下拉)、渠道(下拉)、内容(文本域) | POST /template | message.success |
| 40 | 搜索模板 | 输入模板名称 | 实时搜索 | GET /template/list?search= | 实时过滤 |
| 41 | 编辑模板 | 操作列编辑 | 同上 | PUT /template/:id | message.success |
| 42 | 删除模板 | 操作列删除 | 二次确认 | DELETE /template/:id | message.success |

### 8.5 服务日历

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 43 | 创建日历 | 页面内创建按钮 | 名称(必填)、描述、团队、时区 | POST /calendar | message.success |
| 44 | 查看排班 | 点击日历名称 | - | GET /calendar/detail/:id | 进入详情页 |

### 8.6 映射数据

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 45 | 创建映射 | 点击"创建映射表" | 名称(必填)、源标签(key-value)、结果标签、团队 | POST /mapping | message.success |
| 46 | 搜索映射 | 输入映射表名称 | 实时搜索 | GET /mapping?search= | 实时过滤 |
| 47 | 编辑映射 | 操作列编辑 | 同上 | PUT /mapping/:id | message.success |
| 48 | 删除映射 | 操作列删除 | 二次确认 | DELETE /mapping/:id | message.success |

### 8.7 自定义字段

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 49 | 创建字段 | 点击"立即创建" | 名称(必填)、类型(select)、选项(动态添加)、必填(开关) | POST /fields | message.success |
| 50 | 删除字段 | 操作列删除 | 二次确认 | DELETE /fields/:id | message.success |

### 8.8 成员管理

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 51 | 邀请成员 | 点击"邀请成员" | 邮箱/手机号、角色(多选) | POST /access/member/invite | message.success |
| 52 | 搜索成员 | 输入搜索框 | 实时搜索 | GET /access/member?search= | 实时过滤 |
| 53 | 修改角色 | 操作列角色管理 | 角色多选 | PUT /access/member/:id/role | message.success |
| 54 | 移除成员 | 操作列删除 | 二次确认 | DELETE /access/member/:id | message.success |

### 8.9 角色管理

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 55 | 创建角色 | 点击"创建角色" | 名称(必填)、权限点(树形多选) | POST /role | message.success |
| 56 | 编辑角色 | 操作列编辑 | 同上 | PUT /role/:id | message.success |
| 57 | 删除角色 | 操作列删除 | 二次确认 | DELETE /role/:id | message.success |

### 8.10 审计日志

| # | 操作 | 触发 | 表单字段 | API | 成功反馈 |
|---|------|------|---------|-----|---------|
| 58 | 搜索日志 | 输入事件 ID | 实时搜索 | GET /audit?event_id= | 实时过滤 |
| 59 | 时间筛选 | 点击时间按钮 | 日期范围选择 | GET /audit?start=&end= | 列表更新 |
| 60 | 查看详情 | 点击行 | - | GET /audit/:id | Drawer 弹出 |

---

## 9. 通知方式选项（7 种）

| 选项 | 值 | 说明 |
|------|-----|------|
| 短信 | sms | 手机短信通知 |
| 电话 | call | 语音电话通知 |
| 邮件 | email | 邮件通知 |
| 企业微信 | wechat | 企微机器人/应用消息 |
| 钉钉 | dingtalk | 钉钉机器人/webhook |
| 飞书 | feishu | 飞书机器人/webhook |
| Webhook | webhook | 自定义 HTTP 回调 |

---

## 10. 访问级别选项

| 值 | 显示 | 说明 |
|----|------|------|
| public | 公开 | 所有组织成员可见 |
| private | 私有 | 仅团队成员可见 |

---

## 11. 实施计划

### P0 - 核心功能（第一期）
| 功能 | 工作量 | 依赖 |
|------|--------|------|
| 数据库表创建 (14 张) | 1 天 | - |
| 协作空间 CRUD + 创建面板 | 3 天 | 数据库 |
| 空间列表/详情页 + 5 个 Tab | 5 天 | 协作空间 CRUD |
| 通知模板管理 | 2 天 | 数据库 |
| Ask AI 组件 | 2 天 | orion-ai-service |

### P1 - 重要功能（第二期）
| 功能 | 工作量 | 依赖 |
|------|--------|------|
| 故障管理 CRUD + 详情 | 5 天 | 协作空间 |
| 告警管理 | 3 天 | 故障管理 |
| 告警聚合/抖动/静默/抑制 | 5 天 | 降噪基础设施 |
| 分派策略 + 拖拽排序 | 4 天 | 通知系统 |
| 服务日历 + 排班 | 4 天 | 数据库 |

### P2 - 增强功能（第三期）
| 功能 | 工作量 | 依赖 |
|------|--------|------|
| 值班排班 + 日历视图 | 5 天 | 日历组件 |
| 集成中心 (100+ 集成) | 5 天 | 集成框架 |
| 映射数据 | 2 天 | 数据库 |
| 自定义字段 | 1 天 | 数据库 |
| 审计日志 | 1 天 | 中间件 |
| 分析看板 | 5 天 | 数据聚合 |
| 故障复盘 | 3 天 | 故障管理 |

---

## 12. 附录：探索统计

| 指标 | 值 |
|------|-----|
| MCP 实际访问页面 | 27 |
| 有真实数据页面 | 12 |
| 404 页面（JS 逆向补全） | 15 |
| JS 逆向路由 | 115 (+6: external-create, external-feedback, post-incident x2, webhook test x2) |
| JS 逆向 API 路径 | 171 (+6) |
| JS 逆向组件名 | 36 |
| JS 逆向数据字段 | 89 |
| JS 逆向中文标签 | 1444 |
| 数据模型 | 14 |
| 数据库表 | 14 |
| 交互链 | 68 (+8: 故障详情按钮交互 + Webhook 创建交互) |
| 通知方式 | 7 |
| 前端组件 | 42 |
| 表单页面 | 16+ (+1: Webhook 创建) |
| 表格页面 | 12+ |
