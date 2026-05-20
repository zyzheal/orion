# CMDB + Visor 集成设计文档

> 2026-05-19: 分析 orion-visor-ui 前端功能，设计集成到 CMDB 的方案

## 1. 现状分析

### 1.1 CMDB 当前功能（3 Tab）

| Tab | 功能 | 实现状态 |
|-----|------|---------|
| 配置项管理 | CI CRUD + 详情 Drawer | 已实现，API 对接完整 |
| 拓扑图 | ReactFlow CI 拓扑可视化 | 已实现，支持自定义节点 |
| 集成资源 | 主机列表 + K8s 资源 + 同步 | 已实现，基础功能可用 |

### 1.2 orion-visor-ui 功能范围（8 模块，22 页面）

| 模块 | 路由 | 页面数 | 核心功能 |
|------|------|--------|---------|
| Dashboard | `/dashboard` | 1 | 工作台 |
| Asset | `/asset-module` | 5 | 主机列表、密钥、身份、授权、分组 |
| Terminal | `/terminal` | 1 | Web SSH 终端（xterm.js） |
| Exec | `/exec-module` | 8 | 命令执行、日志、定时任务、上传、模板 |
| Monitor | `/monitor-module` | 6 | 指标、告警策略/事件/规则、监控详情 |
| Asset-Audit | `/asset-audit-module` | 3 | 连接日志、会话审计、文件日志 |
| User | `/user-module` | 6 | 角色、用户、会话、操作日志 |
| System | `/system-module` | 6 | 菜单、字典、通知、标签、设置 |

### 1.3 功能覆盖矩阵

| visor 功能 | CMDB 是否覆盖 | 说明 |
|-----------|-------------|------|
| 主机列表 | 部分覆盖 | CMDB 集成资源 Tab 有主机列表，但缺少 visor 的 表/卡片双视图 |
| CI 拓扑图 | CMDB 独有 | visor 无此功能 |
| Web SSH 终端 | **缺失** | visor 核心功能 |
| 批量命令执行 | **缺失** | visor 核心功能 |
| 执行日志 | **缺失** | |
| 脚本模板 | **缺失** | |
| 定时任务 | **缺失** | |
| 批量文件上传 | **缺失** | |
| 主机密钥管理 | **缺失** | |
| 主机身份配置 | **缺失** | |
| 资产授权 | **缺失** | |
| 主机组管理 | **缺失** | |
| SSH 审计 | **缺失** | |
| 主机监控指标 | 部分覆盖 | 已有独立 alerts/metrics 模块 |
| 告警策略/事件 | 不集成 | 已有独立 alerts 模块，功能重叠 |
| 用户/系统管理 | 不集成 | 已有独立 console/users、console/settings |

## 2. 集成方案设计

### 2.1 设计原则

1. **CMDB 是配置权威**：配置项、拓扑、主机/ K8s 资源管理保留在 CMDB
2. **运维操作能力引入**：Web SSH 终端、批量执行、审计作为 CMDB 新 Tab
3. **不重复建设**：告警、用户管理、系统配置已有独立模块，不重复引入
4. **渐进式实现**：分 3 期完成，优先核心运维能力

### 2.2 CMDB 增强后的 Tab 结构（6 Tab）

| Tab | 名称 | 图标 | 来源 | 优先级 |
|-----|------|------|------|--------|
| 1 | 配置项管理 | CloudServerOutlined | 现有 | - |
| 2 | 拓扑图 | DeploymentUnitOutlined | 现有 | - |
| 3 | 集成资源 | LinkOutlined | 现有 | - |
| 4 | **Web 终端** | DesktopOutlined | visor terminal | **P0** |
| 5 | **批量执行** | CodeOutlined | visor exec | **P0** |
| 6 | **审计日志** | EyeOutlined | visor asset-audit | **P1** |

### 2.3 各 Tab 详细设计

#### Tab 4: Web 终端（P0）

**功能**：
- Web SSH 终端（使用 xterm.js + WebSocket）
- 主机选择器（从 CMDB 主机列表选择）
- 命令片段库（快捷命令）
- 路径书签
- 文件传输（上传/下载）
- 全屏模式
- 多 Tab 终端（可选）

**技术选型**：
- `@xterm/xterm` — 终端渲染
- `@xterm/addon-fit` — 自适应尺寸
- `@xterm/addon-webgl` — WebGL 加速
- WebSocket — SSH 代理连接（通过后端 `/visor/terminal/ws` 端点）

**与现有集成**：
- 主机列表从 CMDB `getCIs()` 或 `getHosts()` 获取
- SSH 连接通过 `orion-visor` 后端 WebSocket 代理

#### Tab 5: 批量执行（P0）

**功能**：
- 命令执行面板（选择主机 + 输入命令）
- 实时执行日志（SSE/WebSocket 流式输出）
- 执行历史列表
- 脚本模板管理
- 定时任务管理
- 批量文件上传
- 上传任务历史

**子页面**：
1. 命令执行 — 主机选择 → 命令输入 → 实时日志
2. 执行历史 — 表格展示历史执行记录
3. 脚本模板 — 预定义脚本 CRUD
4. 定时任务 — Cron 表达式 + 任务配置
5. 文件上传 — 多主机文件分发

**与现有集成**：
- 复用 CronJobs 模块的定时任务能力
- 主机选择从 CMDB 获取
- 通过 `orion-visor` 后端 API 执行

#### Tab 6: 审计日志（P1）

**功能**：
- 终端连接日志（谁、何时、连接了哪台主机）
- 终端连接会话（实时会话监控）
- 终端文件传输日志（文件上传/下载记录）

**与现有集成**：
- 复用 audit-log 模块的通用审计能力
- 数据来源于 visor 后端审计 API

### 2.4 后端 API 依赖

| API | 来源 | 说明 |
|-----|------|------|
| `/visor/terminal/ws` | orion-visor | WebSocket SSH 代理 |
| `/visor/exec/command` | orion-visor | 批量命令执行 |
| `/visor/exec/command-log/:id` | orion-visor | 执行日志查询 |
| `/visor/exec/template` | orion-visor | 脚本模板 CRUD |
| `/visor/exec/job` | orion-visor | 定时任务 CRUD |
| `/visor/exec/upload` | orion-visor | 文件上传 |
| `/visor/audit/terminal-log` | orion-visor | 终端审计日志 |
| `/visor/hosts` | orion-platform-service | 主机列表（已有） |

### 2.5 前端文件结构

```
orion-frontend/src/pages/CMDB/
├── index.tsx              # 主页面（6 Tab 入口）
├── CITablePage.tsx        # 配置项管理（拆分）
├── TopologyPage.tsx       # 拓扑图（拆分）
├── IntegrationPage.tsx    # 集成资源（拆分）
├── WebTerminalPage.tsx    # Web SSH 终端（新增）
├── BatchExecPage.tsx      # 批量执行（新增）
└── AuditLogPage.tsx       # 审计日志（新增）

orion-frontend/src/api/
├── cmdb.ts                # 现有
└── visor-exec.ts          # 批量执行 API（新增）
└── visor-audit.ts         # 审计日志 API（新增）
```

## 3. 实施计划

### 第一期（P0）：Web 终端 + 批量执行

1. 安装 xterm.js 依赖
2. 实现 WebTerminalPage（SSH 终端）
3. 实现 BatchExecPage（命令执行 + 执行历史）
4. 添加后端 API 对接（visor 端点）
5. 将新 Tab 注册到 CMDB

### 第二期（P1）：审计日志 + 脚本模板

1. 实现 AuditLogPage
2. 实现脚本模板管理
3. 定时任务集成

### 第三期（P2）：文件传输 + 主机组

1. 批量文件上传/下载
2. 主机组管理
3. 主机密钥/身份管理

## 4. 菜单配置更新

在 `menuConfigStore.ts` 中更新 `/cmdb` 模块：

```typescript
'/cmdb': {
  key: '/cmdb',
  label: 'CMDB',
  description: '配置管理与运维终端',
  systemTitle: '配置管理数据库',
  systemDescription: '配置项管理、拓扑可视化、Web终端与批量执行',
  enabled: true,
  children: [
    { key: '/cmdb', label: '配置项管理', description: 'CI CRUD 与详情', category: '配置管理', enabled: true },
    { key: '/cmdb/topology', label: '拓扑图', description: 'CI 关系可视化', category: '配置管理', enabled: true },
    { key: '/cmdb/integration', label: '集成资源', description: '主机 + K8s 资源', category: '集成管理', enabled: true },
    { key: '/cmdb/terminal', label: 'Web 终端', description: 'SSH 远程终端', category: '运维操作', enabled: true },
    { key: '/cmdb/batch-exec', label: '批量执行', description: '命令执行与脚本模板', category: '运维操作', enabled: true },
    { key: '/cmdb/audit', label: '审计日志', description: '终端操作审计', category: '审计', enabled: true },
  ],
}
```

## 5. 与独立 visor 子系统的关系

当前 `/visor/*` 路由通过 `SubAppRoute` 加载微前端子应用。集成后的架构：

- **CMDB 内嵌终端/执行**：日常运维操作在 CMDB 内完成
- **独立 visor 子系统保留**：高级功能（如完整终端全屏模式、复杂执行任务编排）仍可通过 `/visor/*` 访问
- **统一后端**：终端和执行都通过 `orion-platform-service` 的 visor 路由代理到 `orion-visor` Java 后端

## 6. 风险与约束

| 风险 | 缓解措施 |
|------|---------|
| xterm.js 与 Ant Design 样式冲突 | 使用独立容器 + scoped 样式 |
| WebSocket 连接稳定性 | 心跳检测 + 自动重连 |
| visor 后端 API 兼容性 | 先在 platform-service 添加代理层，不直接调用 visor |
| 终端安全风险 | 通过 platform-service 权限中间件拦截，集成 Capability 权限检查 |
