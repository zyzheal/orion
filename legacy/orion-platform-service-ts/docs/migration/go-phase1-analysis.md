# Task 6.1: Go 迁移第一阶段可行性分析

> **任务级别**: 🔴 人工决策任务
> **分析日期**: 2026-07-04
> **分析范围**: 5 个核心服务 TS → Go 迁移可行性

---

## 1. 总体评估

| 服务 | 迁移难度 | TS 代码量 | Go 蓝图进度 | 建议顺序 | 关键风险 |
|------|---------|----------|------------|---------|---------|
| **Pipeline** | 🔴 高 | ~8 个核心服务文件 | 60% | 3 | 引擎状态机复杂，SSE 集成 |
| **Deploy** | 🟡 中高 | ~10 个文件 | 70% | 2 | 策略模式迁移 |
| **Auth** | 🟡 中 | ~15 个文件 | 20% | 4 | JWT/MFA/清理任务待实现 |
| **Notification** | 🟢 中低 | ~7 个文件 | 50% | 5 | 相对独立，依赖 EventBus |
| **EventBus** | 🟢 中低 | 嵌入式实现 | 40% | 1 | 需解耦 Notification 依赖 |

**建议迁移顺序**: EventBus → Deploy → Pipeline → Auth → Notification

---

## 2. 迁移分析摘要

### EventBus（事件总线）
- TS 端无独立目录，嵌入在 NotificationService 中
- Go 蓝图已有 60% 核心结构
- 建议先迁移，解耦下游依赖

### Deploy（部署服务）
- 核心 CRUD + 状态机已完整
- 缺失：部署策略、Git 集成、发布说明
- API 兼容度 70%

### Pipeline（流水线引擎）
- 最复杂：引擎状态机、YAML 解析、SSE 流
- Go 蓝图完成 60%，缺执行引擎核心
- 建议分阶段：先只读 API，再迁移执行引擎

### Auth（认证服务）
- 安全敏感：密码/JWT/MFA
- Go 蓝图仅 20%，大量功能缺失
- 建议最后迁移，双跑验证

### Notification（通知服务）
- 相对独立，多渠道投递需对接第三方
- Go 蓝图 50%，核心 CRUD 已对齐

---

## 3. 关键依赖关系

```
EventBus → Deploy → Pipeline → Auth → Notification
```

EventBus 需最先迁移（下游依赖），Pipeline 最复杂需最多时间。

---

## 4. 数据迁移策略

双写过渡方案：
1. TS 写入 → PostgreSQL（已完成）
2. Go 服务读取 → PostgreSQL（新增）
3. 双写（TS + Go）→ PostgreSQL
4. Go 服务主写，TS 只读
5. TS 下线

---

## 5. 人工决策清单

### 必须决策（P0）
1. EventBus 是否保留独立服务，还是合并到 Notification？
2. Pipeline 执行引擎 Go 采用什么架构（队列 vs goroutine）？
3. Auth 迁移顺序：先 JWT 还是先用户管理？
4. 哪些表需要双写？

### 建议决策（P1）
5. JWT 密钥存储：K8s Secret 还是 Vault？
6. 定时任务：Go cron vs 分布式调度？
7. 多渠道投递：保留在 Notification 还是拆分？
8. SSE 实现：原生 streaming vs 引入库？

---

## 6. 下一步

1. 确认人工决策清单
2. 建立 PoC（建议 Deploy 服务，2 周）
3. 开发双写 + 对账工具
4. 端到端测试覆盖核心流程

**文档状态**: 待人工确认后进入 Task 6.2 详细设计阶段
