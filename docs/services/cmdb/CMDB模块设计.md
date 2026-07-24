# Orion CMDB 模块设计

> 参照 Orion Visor (https://gitee.com/dromara/orion-visor) 的服务器与应用管理能力，构建 Orion AI DevOps 平台的 CMDB (配置管理数据库) 模块。

---

## 一、Orion Visor 功能分析

### 1.1 项目概述

**Orion Visor** 是一款轻量级、易用的服务器与应用管理系统，定位为堡垒机的完美替代方案。

- **Gitee**: https://gitee.com/dromara/orion-visor
- **文档**: https://www.orion-visor.site
- **Stars**: 4.1k+ (Gitee), 1.8k+ (GitHub)
- **定位**: 服务器与应用管理

### 1.2 核心功能模块

| 模块 | 功能 | 说明 |
|------|------|------|
| 服务器管理 | 批量导入、标签管理、状态监控 | CMDB 核心 |
| 终端管理 | WebSocket 在线终端、多 Tab、录屏回放 | 远程运维 |
| 文件管理 | 在线浏览/编辑 (Monaco Editor)、下载、权限控制 | 文件运维 |
| 脚本管理 | 脚本库、批量执行、定时任务、执行记录 | 自动化运维 |
| 审计日志 | 操作审计、终端录屏回放、登录日志 | 安全合规 |
| 用户权限 | RBAC 权限控制、用户管理、角色管理 | 安全管理 |

### 1.3 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Spring Boot 3 + MyBatis-Plus + Sa-Token |
| 前端 | Vue3 + TypeScript + Arco Design + Pinia |
| 终端 | Xterm.js (WebSocket) |
| 编辑 | Monaco Editor |
| 构建 | Vite + pnpm |

---

## 二、CMDB 模块设计

### 2.1 模块定位

CMDB 是 Orion AI DevOps 平台的**基础设施底座**，为流水线、监控、工单、AI 诊断等所有上层功能提供准确的配置数据。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orion 平台                                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  上层应用                                                  │  │
│  │  流水线 │ 监控告警 │ 工单系统 │ AI 诊断 │ 效能看板 │ 成本   │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │ 依赖 CMDB 数据                        │
│  ┌───────────────────────▼───────────────────────────────────┐  │
│  │                  CMDB 模块 (基础设施底座)                    │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ 服务器   │ │ 应用    │ │ 数据库  │ │ 中间件  │        │  │
│  │  │ 管理    │ │ 管理    │ │ 管理    │ │ 管理    │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ 终端    │ │ 文件    │ │ 脚本    │ │ 审计    │        │  │
│  │  │ 管理    │ │ 管理    │ │ 管理    │ │ 日志    │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  │  ┌─────────┐ ┌─────────┐                                 │  │
│  │  │ 关系    │ │ 变更    │                                 │  │
│  │  │ 拓扑    │ │ 历史    │                                 │  │
│  │  └─────────┘ └─────────┘                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  数据源                                                    │  │
│  │  自动发现 │ API 同步 │ 手动录入 │ 导入导出                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 服务器管理

#### 2.2.1 数据模型

```yaml
server:
  # 基础信息
  id: "SRV-2026-0001"
  hostname: "order-service-prod-01"
  ip: "10.0.1.100"
  internal_ip: "10.0.1.100"
  public_ip: "47.100.1.100"
  
  # 系统信息
  os: "Ubuntu 22.04 LTS"
  kernel: "5.15.0-91-generic"
  architecture: "x86_64"
  cpu:
    cores: 8
    model: "Intel Xeon Platinum 8369B"
  memory: "32 GB"
  disk:
    - mount: "/"
      size: "100 GB"
      used: "45 GB"
      usage: "45%"
    - mount: "/data"
      size: "500 GB"
      used: "320 GB"
      usage: "64%"
  
  # 归属信息
  team: "order-team"
  environment: prod  # dev / staging / prod
  datacenter: "aliyun-shanghai"
  zone: "cn-shanghai-a"
  
  # 状态信息
  status: online  # online / offline / maintenance / decommissioned
  last_heartbeat: "2026-04-10T15:30:00Z"
  agent_version: "1.2.0"
  
  # 标签
  tags:
    - "order-service"
    - "prod"
    - "critical"
  
  # 关联信息
  applications: ["order-service:v2.3.0"]
  databases: ["mysql-order-prod"]
  middleware: ["redis-order-prod"]
  
  # 时间信息
  created_at: "2025-06-01T10:00:00Z"
  updated_at: "2026-04-10T15:30:00Z"
  last_scan: "2026-04-10T15:00:00Z"
```

#### 2.2.2 核心功能

```yaml
server_management:
  # ── 批量导入 ──
  import:
    methods:
      - excel_import          # Excel 批量导入
      - api_sync              # 从云平台 API 同步 (阿里云/AWS/腾讯云)
      - agent_auto_register   # Agent 自动注册
      - terraform_state       # 从 Terraform State 导入
    
    validation:
      - ip_format              # IP 格式校验
      - ip_duplicate           # IP 去重
      - hostname_unique        # 主机名唯一
      - ssh_connection_test    # SSH 连接测试
  
  # ── 标签管理 ──
  tags:
    system_tags:
      - environment: [dev, staging, prod]
      - os: [ubuntu, centos, debian, windows]
      - cloud: [aliyun, aws, tencent, huawei]
    custom_tags:
      - user_defined           # 用户自定义标签
    operations:
      - batch_add_tags         # 批量添加标签
      - batch_remove_tags      # 批量移除标签
      - filter_by_tags         # 按标签筛选
  
  # ── 状态监控 ──
  monitoring:
    agent_based:
      - cpu_usage              # CPU 使用率
      - memory_usage           # 内存使用率
      - disk_usage             # 磁盘使用率
      - disk_io                # 磁盘 IO
      - network_io             # 网络 IO
      - load_average           # 系统负载
      - process_count          # 进程数
      - connection_count       # 连接数
    
    agentless:
      - ping_check             # Ping 检测
      - ssh_check              # SSH 端口检测
      - snmp_polling           # SNMP 轮询
    
    alerting:
      - cpu > 90% for 5m      → 告警
      - memory > 85% for 5m   → 告警
      - disk > 90%            → 告警
      - offline for 3m        → 告警
  
  # ── 批量操作 ──
  batch_operations:
    - restart_server           # 批量重启
    - execute_command          # 批量执行命令
    - run_script               # 批量执行脚本
    - update_tags              # 批量更新标签
    - change_environment       # 批量变更环境
    - decommission             # 批量下线
  
  # ── 快速操作 ──
  quick_actions:
    - open_terminal            # 打开终端
    - browse_files             # 浏览文件
    - view_logs                # 查看日志
    - view_metrics             # 查看指标
    - view_applications        # 查看部署的应用
    - view_change_history      # 查看变更历史
```

#### 2.2.3 服务器列表页 (参照 Orion Visor 风格)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🖥️ 服务器管理                                                               │
│  ────────────                                                              │
│                                                                             │
│  [添加服务器] [批量导入] [批量操作 ▼] [导出] [同步云平台]                    │
│                                                                             │
│  🔍 筛选:                                                                    │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────┐        │
│  │ 环境       │ 状态       │ 标签       │ 团队       │ 搜索       │        │
│  │ [全部 ▼]  │ [全部 ▼]  │ [全部 ▼]  │ [全部 ▼]  │ [IP/主机名]│ [重置] │
│  └────────────┴────────────┴────────────┴────────────┴────────────┘        │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ │ 主机名          │ IP          │ 环境  │ 状态  │ CPU │ 内存 │ 磁盘 │   │
│  ├───┼────────────────┼─────────────┼───────┼───────┼─────┼──────┼──────┤   │
│  │ ☐ │ order-svc-01   │ 10.0.1.100  │ 生产  │ 🟢在线 │ 45% │ 62%  │ 64%  │   │
│  │   │                │             │       │       │     │      │      │   │
│  │   │ [标签:order]   │             │       │       │     │      │      │   │
│  ├───┼────────────────┼─────────────┼───────┼───────┼─────┼──────┼──────┤   │
│  │ ☐ │ order-svc-02   │ 10.0.1.101  │ 生产  │ 🟢在线 │ 38% │ 58%  │ 61%  │   │
│  │   │                │             │       │       │     │      │      │   │
│  │   │ [标签:order]   │             │       │       │     │      │      │   │
│  ├───┼────────────────┼─────────────┼───────┼───────┼─────┼──────┼──────┤   │
│  │ ☐ │ payment-svc-01 │ 10.0.2.100  │ 生产  │ 🟢在线 │ 52% │ 71%  │ 55%  │   │
│  │   │                │             │       │       │     │      │      │   │
│  │   │ [标签:payment] │             │       │       │     │      │      │   │
│  ├───┼────────────────┼─────────────┼───────┼───────┼─────┼──────┼──────┤   │
│  │ ☐ │ user-svc-01    │ 10.0.3.100  │ 预发  │ 🟡维护 │ --  │ --   │ --   │   │
│  │   │                │             │       │       │     │      │      │   │
│  │   │ [标签:user]    │             │       │       │     │      │      │   │
│  ├───┼────────────────┼─────────────┼───────┼───────┼─────┼──────┼──────┤   │
│  │ ☐ │ db-mysql-01    │ 10.0.4.100  │ 生产  │ 🔴离线 │ --  │ --   │ --   │   │
│  │   │                │             │       │       │     │      │      │   │
│  │   │ [标签:db,mysql]│             │       │       │     │      │      │   │
│  └───┴────────────────┴─────────────┴───────┴───────┴─────┴──────┴──────┘   │
│                                                                             │
│  共 256 台  [←] [1] [2] [3] ... [26] [→]  每页 10 条 [10 ▼]               │
│                                                                             │
│  底部状态栏: 🟢 在线 245 | 🟡 维护 6 | 🔴 离线 5 | 总计 256                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 应用管理

#### 2.3.1 数据模型

```yaml
application:
  id: "APP-2026-0001"
  name: "order-service"
  type: microservice  # microservice / monolith / web / worker / cron
  language: java
  framework: spring-boot
  version: 3.2.0
  
  # 部署信息
  servers:
    - server_id: SRV-2026-0001
      role: primary
      status: running
    - server_id: SRV-2026-0002
      role: secondary
      status: running
  
  # 运行信息
  port: 8080
  health_check: "/actuator/health"
  process_name: "java -jar order-service.jar"
  pid: 12345
  
  # 关联信息
  team: "order-team"
  environment: prod
  git_repo: "git.company.com/services/order-service"
  pipeline: "order-service-pipeline"
  
  # 依赖
  depends_on:
    - "user-service"
    - "payment-service"
  dependents:
    - "notification-service"
    - "analytics-service"
  
  # 状态
  status: healthy  # healthy / degraded / unhealthy / stopped
  instances: 2
  healthy_instances: 2
```

#### 2.3.2 核心功能

```yaml
application_management:
  # ── 应用发现 ──
  discovery:
    - process_scanning         # 进程扫描发现应用
    - port_scanning            # 端口扫描
    - container_discovery      # 容器应用发现
    - k8s_discovery            # K8s 应用发现
  
  # ── 应用拓扑 ──
  topology:
    - auto_discover_dependencies  # 自动发现依赖关系
    - manual_define_dependencies  # 手动定义依赖
    - visualize_topology          # 可视化拓扑 (G6/AntV)
  
  # ── 健康检查 ──
  health_check:
    - http_check               # HTTP 健康检查
    - tcp_check                # TCP 端口检查
    - process_check            # 进程存在检查
    - custom_check             # 自定义检查
  
  # ── 日志管理 ──
  log_management:
    - log_collection           # 日志采集
    - log_search               # 日志搜索
    - log_tail                 # 实时日志
    - log_download             # 日志下载
```

### 2.4 终端管理 (参照 Orion Visor)

```yaml
terminal_management:
  # ── 在线终端 ──
  features:
    - websocket_terminal       # WebSocket 终端
    - multi_tab                # 多 Tab 支持
    - copy_paste               # 复制粘贴
    - file_upload              # 文件上传
    - file_download            # 文件下载
    - screen_recording         # 终端录屏
    - playback                 # 录屏回放
    - session_sharing          # 会话共享 (协助)
    - command_history          # 命令历史
  
  # ── 安全控制 ──
  security:
    - session_timeout          # 会话超时
    - command_blocklist        # 命令黑名单
    - sensitive_command_alert  # 敏感命令告警
    - screen_watermark         # 屏幕水印
    - ip_whitelist             # IP 白名单
  
  # ── 审计 ──
  audit:
    - all_sessions_recorded    # 所有会话录制
    - command_log              # 命令日志
    - searchable_recordings    # 可搜索的录屏
    - download_recordings      # 录屏下载
```

### 2.5 文件管理 (参照 Orion Visor)

```yaml
file_management:
  # ── 在线浏览 ──
  features:
    - file_browser             # 文件浏览器
    - file_preview             # 文件预览 (文本/图片/日志)
    - file_edit                # 在线编辑 (Monaco Editor)
    - file_download            # 文件下载
    - file_upload              # 文件上传
    - file_search              # 文件搜索
  
  # ── 安全控制 ──
  security:
    - path_restriction         # 路径限制
    - file_type_whitelist      # 文件类型白名单
    - file_size_limit          # 文件大小限制
    - edit_permission          # 编辑权限控制
    - download_permission      # 下载权限控制
    - edit_history             # 编辑历史记录
    - edit_rollback            # 编辑回滚
```

### 2.6 脚本管理 (参照 Orion Visor)

```yaml
script_management:
  # ── 脚本库 ──
  features:
    - script_library           # 脚本库
    - script_versioning        # 脚本版本管理
    - script_categories        # 脚本分类
    - script_sharing           # 脚本共享
    - script_import_export     # 脚本导入导出
  
  # ── 执行 ──
  execution:
    - single_server            # 单台执行
    - batch_server             # 批量执行
    - scheduled_execution      # 定时执行
    - parameterized_execution  # 参数化执行
    - dry_run                  # 预执行 (不实际执行)
  
  # ── 执行记录 ──
  records:
    - execution_history        # 执行历史
    - execution_log            # 执行日志
    - execution_statistics     # 执行统计
    - failure_analysis         # 失败分析
  
  # ── 预置脚本 ──
  presets:
    - cpu_info                 # 查看 CPU 信息
    - memory_info              # 查看内存信息
    - disk_usage               # 查看磁盘使用
    - network_status           # 查看网络状态
    - process_list             # 查看进程列表
    - service_restart          # 重启服务
    - log_cleanup              # 日志清理
    - system_update            # 系统更新
```

### 2.7 关系拓扑

```yaml
relationship_topology:
  # ── 自动发现 ──
  auto_discovery:
    - network_connection       # 网络连接发现
    - process_dependency       # 进程依赖发现
    - k8s_relationship         # K8s 关系发现
    - dns_resolution           # DNS 解析关系
  
  # ── 可视化 ──
  visualization:
    - service_topology         # 服务拓扑 (G6/AntV)
    - dependency_graph         # 依赖关系图
    - network_topology         # 网络拓扑
    - interactive_exploration  # 交互式探索
  
  # ── 变更影响分析 ──
  impact_analysis:
    - server_down_impact       # 服务器下线影响
    - service_change_impact    # 服务变更影响
    - network_change_impact    # 网络变更影响
```

### 2.8 变更历史

```yaml
change_history:
  # ── 自动记录 ──
  auto_record:
    - server_creation          # 服务器创建
    - server_update            # 服务器信息变更
    - server_decommission      # 服务器下线
    - application_deploy       # 应用部署
    - application_update       # 应用更新
    - configuration_change     # 配置变更
  
  # ── 手动记录 ──
  manual_record:
    - maintenance_record       # 维护记录
    - incident_record          # 事件记录
    - change_record            # 变更记录
  
  # ── 时间线 ──
  timeline:
    - visual_timeline          # 可视化时间线
    - filter_by_type           # 按类型筛选
    - filter_by_date           # 按日期筛选
    - diff_view                # 变更对比
```

---

## 三、数据模型总览

```yaml
cmdb_data_model:
  # ── 核心实体 ──
  entities:
    - server                   # 服务器
    - application              # 应用
    - database                 # 数据库
    - middleware               # 中间件
    - network_device           # 网络设备
    - load_balancer            # 负载均衡
    - storage                  # 存储
    - container                # 容器
    - k8s_cluster              # K8s 集群
    - k8s_namespace            # K8s 命名空间
    - k8s_pod                  # K8s Pod
    - cloud_resource           # 云资源
  
  # ── 关系 ──
  relationships:
    - runs_on                  # 应用运行在服务器上
    - depends_on               # 服务依赖
    - connected_to             # 网络连接
    - belongs_to               # 归属关系 (团队/项目)
    - deployed_in              # 部署在环境中
  
  # ── 属性 ──
  attributes:
    - static                   # 静态属性 (不常变)
    - dynamic                  # 动态属性 (实时监控)
    - relationship             # 关系属性
    - custom                   # 自定义属性
```

---

## 四、与其他模块的集成

```
CMDB 作为基础设施底座，为上层应用提供数据:

┌─────────────────────────────────────────────────────────────────┐
│  流水线 (Pipeline)                                               │
│  ├── 部署目标: 从 CMDB 获取服务器/应用列表                        │
│  ├── 环境信息: 从 CMDB 获取环境配置                              │
│  └── 回滚目标: 从 CMDB 获取历史部署信息                          │
│                                                                 │
│  监控告警 (Monitoring)                                           │
│  ├── 告警路由: 根据 CMDB 中的团队/环境信息路由告警                 │
│  ├── 关联分析: 结合 CMDB 拓扑进行根因分析                         │
│  └── 阈值配置: 根据 CMDB 中的应用类型配置不同阈值                 │
│                                                                 │
│  工单系统 (Ticketing)                                            │
│  ├── 资产关联: 工单关联 CMDB 中的服务器/应用                       │
│  ├── 影响分析: 基于 CMDB 拓扑分析影响范围                         │
│  └── 自动填充: 工单自动填充 CMDB 中的资产信息                     │
│                                                                 │
│  AI 诊断 (AI Diagnosis)                                          │
│  ├── 上下文: 从 CMDB 获取服务拓扑和依赖关系                       │
│  ├── 历史: 从 CMDB 获取变更历史辅助诊断                           │
│  └── 修复: 从 CMDB 获取服务器信息执行修复                         │
│                                                                 │
│  成本 (FinOps)                                                   │
│  ├── 资源统计: 按 CMDB 中的团队/项目统计成本                       │
│  ├── 闲置发现: 结合 CMDB 发现闲置资源                            │
│  └── 优化建议: 基于 CMDB 信息给出优化建议                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、技术实现

```yaml
implementation:
  # ── 技术栈 (参照 Orion Visor) ──
  frontend:
    - Vue3 + TypeScript
    - Arco Design
    - Pinia
    - Xterm.js (终端)
    - Monaco Editor (文件编辑)
    - G6 / AntV (拓扑图)
    - ECharts (指标图表)
  
  backend:
    - Spring Boot 3 (或 FastAPI)
    - MyBatis-Plus (或 SQLAlchemy)
    - Sa-Token (或 JWT)
    - WebSocket (终端)
    - SSH Library (远程执行)
  
  agent:
    - lightweight_agent        # 轻量级 Agent (可选)
    - agentless_ssh            # 无 Agent 模式 (SSH)
    - auto_register            # 自动注册
  
  data_sync:
    - cloud_api_sync           # 云平台 API 同步 (阿里云/AWS)
    - k8s_api_sync             # K8s API 同步
    - terraform_state_sync     # Terraform State 同步
    - cmdb_api_sync            # 外部 CMDB API 同步
```

---

## 六、页面风格 (参照 Orion Visor)

### 6.1 服务器详情页

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← 返回    服务器: order-service-prod-01                    [编辑] [终端]   │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 基本信息                                                                │ │
│  │ ┌─────────┬──────────────┬─────────┬─────────────┐                    │ │
│  │ │ 状态: 🟢 在线           │ 环境: 生产             │                    │ │
│  │ │ IP: 10.0.1.100         │ 团队: order-team       │                    │ │
│  │ │ OS: Ubuntu 22.04       │ 机房: 阿里云-上海      │                    │ │
│  │ └─────────┴──────────────┴─────────┴─────────────┘                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 资源指标                                                                │ │
│  │ ┌─────────┬──────────────┬─────────┬─────────────┐                    │ │
│  │ │ CPU     │ 内存         │ 磁盘    │ 网络        │                    │ │
│  │ │ 45%     │ 62% (19.8GB) │ 64%     │ ↑ 12MB/s   │                    │ │
│  │ │ 8 核    │ 32 GB        │ 320/500G│ ↓ 8MB/s    │                    │ │
│  │ └─────────┴──────────────┴─────────┴─────────────┘                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ 📦 部署的应用    │ │ 🔗 依赖关系      │ │ 📋 变更历史      │               │
│  │                 │ │                 │ │                 │               │
│  │ order-service   │ │ 依赖:           │ │ 04-10 部署 v2.3 │               │
│  │ v2.3.0:8080     │ │   user-service  │ │ 04-08 配置变更  │               │
│  │                 │ │   payment-svc   │ │ 04-05 系统更新  │               │
│  │ 被依赖:          │ │                 │ │ 04-01 服务器扩容│               │
│  │   notification  │ │ [查看完整拓扑 →]│ │ [查看全部 →]    │               │
│  │   analytics     │ │                 │ │                 │               │
│  │                 │ │                 │ │                 │               │
│  │ [查看全部 →]    │ │                 │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

_Orion CMDB 模块参照 Orion Visor (https://gitee.com/dromara/orion-visor) 的服务器与应用管理理念，结合 Arco Design 简洁风格，构建 AI DevOps 平台的基础设施底座。_
