# Scheduler Service Design

> 状态: 🟡 后端已实现 | 数据存储: Map() 内存模拟
> 创建日期: 2026-04-23 | 关联: M25 数据存储

---

## 1. 服务概述

Scheduler Service (定时调度服务) 提供分布式定时任务能力，支持 Cron 表达式、一次性任务、周期性任务。

## 2. 代码位置

```
orion-platform-service/src/services/scheduler/
├── CronSchedulerService.ts      # Cron 调度器
├── DistributedLockService.ts    # 分布式锁
└── index.ts                     # 模块导出
```

## 3. 核心功能

### 3.1 CronSchedulerService

| 功能 | 说明 | 状态 |
|------|------|------|
| scheduleCron() | 创建 Cron 任务 | ✅ 已实现 |
| scheduleOnce() | 创建一次性任务 | ✅ 已实现 |
| scheduleInterval() | 创建间隔任务 | ✅ 已实现 |
| cancelJob() | 取消任务 | ✅ 已实现 |
| getJobStatus() | 获取任务状态 | ✅ 已实现 |

**支持特性**:
- Cron 表达式解析 (支持秒级)
- 时区配置
- 任务超时处理
- 失败重试策略
- 任务链 (Task Chain)

### 3.2 DistributedLockService

| 功能 | 说明 |
|------|------|
| acquireLock() | 获取分布式锁 |
| releaseLock() | 释放分布式锁 |
| isLocked() | 检查锁状态 |
| extendLock() | 延长锁时间 |

**实现方式**: Redis 分布式锁 (基于 SETNX)

## 4. 数据模型

```typescript
interface ScheduledJob {
  id: string;
  name: string;
  type: 'cron' | 'once' | 'interval';
  expression: string;        // Cron 表达式或间隔
  handler: string;           // 处理函数标识
  params: Record<string, any>;
  timezone: string;
  enabled: boolean;
  nextRunTime?: Date;
  lastRunTime?: Date;
  runCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
```

## 5. 集成服务

| 服务 | 集成方式 |
|------|---------|
| BackupService | 定时备份任务 |
| MonitoringService | 定时指标采集 |
| FinOpsService | 定时成本计算 |
| IaCService | 定时 Plan/Apply |

## 6. 已知问题

- ⚠️ 数据存储使用 `Map()` 内存模拟
- ⚠️ 无独立的 API 路由文件 (通过其他服务间接调用)
- ⚠️ 未实现任务执行日志持久化

## 7. 后续计划

- [ ] 补充数据库持久化
- [ ] 添加独立 API 路由
- [ ] 实现任务执行历史记录
- [ ] 添加任务监控仪表盘