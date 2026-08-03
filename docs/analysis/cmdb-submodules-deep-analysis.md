# CMDB 域深度分析 (2026-08-02)

> **覆盖**: 8 模块 / ~22,200 行 | **原深度分析覆盖率**: CMDB 域 75%

---

## 一、CMDB 域总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **cmdb** (核心) | 4,869 | 1 | 33 | 36 | 26 | ✅ | ✅ | **95%** |
| **cmdb-collector** (采集器) | 3,754 | 0 | 28 | 25 | 35 | ✅ | ❌ | **90%** |
| **cmdb-validator** (校验器) | 2,577 | 1 | 10 | 15 | 13 | ✅ | ❌ | 75% |
| **cmdb-attr-handler** (属性) | 3,065 | 0 | 1 | 0 | 10 | ❌ | ❌ | 40% |
| **cmdb-import** (导入) | 1,405 | 0 | 8 | 35 | 13 | ✅ | ❌ | 70% |
| **cmdb-relationship** (关系) | 1,141 | 0 | 10 | 13 | 13 | ✅ | ❌ | 65% |
| **visor** (可视化) | 2,963 | 4 | 38 | 2 | 0 | ✅ | ✅ | **95%** |
| **visor-exec** (执行器) | 1,686 | 1 | 27 | 28 | 30 | ✅ | ✅ | **95%** |

### 域级 P0 问题

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **未 wiring** | cmdb-collector (3,754 行, 28H/25S) | **最大采集器不可用** |
| 2 | **未 wiring** | cmdb-validator (2,577 行) | 校验器不可用 |
| 3 | **未 wiring** | cmdb-attr-handler (3,065 行) | 属性处理不可用 |
| 4 | **未 wiring** | cmdb-import (1,405 行, 35S) | 导入引擎不可用 |
| 5 | **未 wiring** | cmdb-relationship (1,141 行) | 关系引擎不可用 |
| 6 | **零测试** | cmdb-collector/cmdb-attr-handler/cmdb-import/cmdb-relationship (4 模块) | 核心功能不可信 |
| 7 | **cmdb-attr-handler 异常** | 3,065 行但 1 Handler/0 Service | 非标准三层架构 |

---

## 二、核心模块深度分析

### 2.1 cmdb-collector (CMDB 采集器) — 90% ⚠️ 域内最强但未 wiring

**28 Handler / 25 Service / 35 Repo**，含 **Adapter 模式**：

```
cmdb-collector/
├── adapters/     — 多源采集适配器
├── handler/      — 28 路由
├── interfaces/   — 接口定义
├── registry/     — 适配器注册
├── scheduler/    — 定时采集
├── service/      — 25 业务方法
├── repository/   — 35 持久化方法
├── models/       — 数据模型
└── migrations/   — DB 迁移
```

**核心能力**:
- **多源采集**: Kubernetes/OpenStack/VMware/自定义 API
- **适配器注册**: Registry 模式动态注册适配器
- **定时调度**: 周期性采集
- **增量/全量**: 全量采集 + 增量更新
- **35 Repo 方法**: 全平台数据层最完整的采集器

### 2.2 cmdb-validator (CMDB 校验器) — 75% ⚠️ 未 wiring

| 能力 | 方法 |
|------|------|
| 配置校验 | 校验配置项合法性 |
| 模型校验 | 校验模型定义 |
| 规则校验 | 校验业务规则 |
| 依赖校验 | 校验依赖关系 |

### 2.3 cmdb-import (CMDB 导入) — 70% ⚠️ 未 wiring

**35 Service 方法**，CMDB 数据导入引擎：

| 能力 | 方法 |
|------|------|
| 批量导入 | CSV/JSON/Excel |
| 格式校验 | Schema 校验 |
| 冲突处理 | 覆盖/跳过/合并 |
| 进度追踪 | 导入状态 |

### 2.4 cmdb-relationship (CMDB 关系引擎) — 65% ⚠️ 未 wiring

**BFS/DFS 拓扑分析**，13 Service 方法：

| 能力 | 方法 |
|------|------|
| 关系 CRUD | Create/Get/List/Update/Delete |
| 拓扑分析 | BFS/DFS 遍历 |
| 影响分析 | 依赖链/反向依赖 |

### 2.5 visor (CMDB 可视化) — 95% ⭐

**2,963 行 / 38 Handler / 4 测试**，Xterm.js 8 addon 终端：

| 能力 | 说明 |
|------|------|
| 拓扑可视化 | 服务拓扑图 |
| Xterm.js | Web 终端集成 |
| 8 Addon | Fit/Attach/Unicode/Xterm.js 生态 |

### 2.6 visor-exec (CMDB 执行器) — 95%

**27 Handler / 28 Service / 30 Repo**，CMDB 命令执行：

| 能力 | 说明 |
|------|------|
| 命令执行 | 远程命令执行 |
| 会话管理 | 终端会话 |
| 结果收集 | 执行结果 |

---

*分析完成: 2026-08-02 | CMDB 域 8 模块*
