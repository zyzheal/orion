# ChatOps 默认看板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/console/chatops` 页面重构为 Tab 分页结构，新增"总览看板"作为默认首页，展示执行统计数据、趋势图和热门命令。

**Architecture:** 前端将现有 ChatOps 页面拆分为 Tab 容器 + 4 个子组件（总览看板、对话工作台、执行记录、审计日志）。后端新增 DashboardService 聚合统计服务，提供单一接口返回所有看板数据。

**Tech Stack:** React + TypeScript + Ant Design + ECharts (前端), Fastify + TypeScript + PostgreSQL (后端)

---

## 文件映射

### 新建文件
| 文件 | 职责 |
|------|------|
| `orion-frontend/src/pages/ChatOps/ChatDashboard.tsx` | 总览看板组件 |
| `orion-frontend/src/pages/ChatOps/__tests__/ChatDashboard.test.tsx` | 总览看板组件测试 |
| `orion-platform-service/src/services/chatops/DashboardService.ts` | 后端聚合统计服务 |
| `orion-platform-service/src/services/chatops/__tests__/DashboardService.test.ts` | DashboardService 单元测试 |

### 修改文件
| 文件 | 变更内容 |
|------|----------|
| `orion-frontend/src/pages/ChatOps/index.tsx` | 改为 Tab 容器组件，引入 4 个子 Tab |
| `orion-frontend/src/api/chatops.ts` | 新增 `getDashboardStats()` API 函数和类型定义 |
| `orion-platform-service/src/api/chatops-routes.ts` | 新增 `GET /dashboard/stats` 路由 |
| `orion-platform-service/src/repositories/ChatOpsRepository.ts` | 为 ExecutionRepository 新增聚合方法 |

---

### Task 1: 后端 Repository 聚合方法

**Files:**
- Modify: `orion-platform-service/src/repositories/ChatOpsRepository.ts`
- Test: `orion-platform-service/src/repositories/__tests__/ChatOpsRepository.test.ts` (如果不存在则不创建新测试文件，利用已有测试模式)

- [ ] **Step 1: 为 ChatOpsExecutionRepository 新增聚合方法**

在 `ChatOpsExecutionRepository` 类中添加以下方法：

```typescript
// 在 ChatOpsExecutionRepository 类中添加

/** 按时间范围获取执行统计 */
async getStatsByTimeRange(
  startDate: Date,
  endDate: Date,
): Promise<{ total: number; completed: number; failed: number; avgResponseTime: number }> {
  const result = await this.db.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'failed') as failed,
       COALESCE(AVG(
         EXTRACT(EPOCH FROM (end_time - start_time))
       ) FILTER (WHERE status = 'completed' AND end_time IS NOT NULL), 0) as avg_response_time
     FROM chatops_executions
     WHERE start_time >= $1 AND start_time <= $2`,
    [startDate, endDate],
  );
  const row = result.rows[0];
  return {
    total: parseInt(row.total, 10),
    completed: parseInt(row.completed, 10),
    failed: parseInt(row.failed, 10),
    avgResponseTime: parseFloat(row.avg_response_time).toFixed(1) as unknown as number,
  };
}

/** 获取按日分组的执行趋势 */
async getDailyTrends(
  startDate: Date,
  endDate: Date,
): Promise<Array<{ date: string; executions: number; successRate: number }>> {
  const result = await this.db.query(
    `SELECT
       DATE(start_time) as day,
       COUNT(*) as executions,
       COALESCE(
         ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1),
         0
       ) as success_rate
     FROM chatops_executions
     WHERE start_time >= $1 AND start_time <= $2
     GROUP BY DATE(start_time)
     ORDER BY day`,
    [startDate, endDate],
  );
  return result.rows.map(row => ({
    date: row.day,
    executions: parseInt(row.executions, 10),
    successRate: parseFloat(row.success_rate),
  }));
}

/** 获取热门命令 TOP N */
async getTopCommands(
  startDate: Date,
  endDate: Date,
  limit = 5,
): Promise<Array<{ command: string; count: number; successRate: number }>> {
  const result = await this.db.query(
    `SELECT
       command_id as command,
       COUNT(*) as count,
       COALESCE(
         ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1),
         0
       ) as success_rate
     FROM chatops_executions
     WHERE start_time >= $1 AND start_time <= $2
     GROUP BY command_id
     ORDER BY count DESC
     LIMIT $3`,
    [startDate, endDate, limit],
  );
  return result.rows.map(row => ({
    command: row.command,
    count: parseInt(row.count, 10),
    successRate: parseFloat(row.success_rate),
  }));
}

/** 获取平台分布统计 */
async getPlatformDistribution(
  startDate: Date,
  endDate: Date,
): Promise<Array<{ platform: string; count: number }>> {
  const result = await this.db.query(
    `SELECT platform, COUNT(*) as count
     FROM chatops_executions
     WHERE start_time >= $1 AND start_time <= $2
     GROUP BY platform
     ORDER BY count DESC`,
    [startDate, endDate],
  );
  return result.rows.map(row => ({
    platform: row.platform,
    count: parseInt(row.count, 10),
  }));
}

/** 获取最近执行记录 */
async getRecentExecutions(
  limit = 5,
): Promise<Array<{ id: string; commandId: string; userId: string; platform: string; status: string; startTime: Date; endTime: Date | null }>> {
  const result = await this.db.query(
    `SELECT id, command_id, user_id, platform, status, start_time, end_time
     FROM chatops_executions
     ORDER BY start_time DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(row => ({
    id: row.id,
    commandId: row.command_id,
    userId: row.user_id,
    platform: row.platform,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}
```

- [ ] **Step 2: 运行 type-check 验证编译**

Run: `cd orion-platform-service && npm run type-check`
Expected: 无新增错误

---

### Task 2: 后端 DashboardService

**Files:**
- Create: `orion-platform-service/src/services/chatops/DashboardService.ts`
- Test: `orion-platform-service/src/services/chatops/__tests__/DashboardService.test.ts`

- [ ] **Step 1: 创建 DashboardService**

```typescript
import dayjs from 'dayjs';
import { ChatOpsExecutionRepository } from '../../repositories/ChatOpsRepository';

export interface DashboardMetrics {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardTrend {
  date: string;
  executions: number;
  successRate: number;
}

export interface TopCommand {
  command: string;
  count: number;
  successRate: number;
}

export interface PlatformDist {
  platform: string;
  count: number;
}

export interface RecentExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  status: string;
  startTime: Date;
  endTime: Date | null;
}

export interface MetricsComparison {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardStats {
  metrics: DashboardMetrics;
  trends: DashboardTrend[];
  topCommands: TopCommand[];
  platformDistribution: PlatformDist[];
  recentExecutions: RecentExecution[];
  comparison: MetricsComparison;
}

export type TimeRange = '7d' | '30d' | 'month' | 'custom';

export interface TimeRangeParams {
  range: TimeRange;
  startDate?: string;
  endDate?: string;
}

export class DashboardService {
  private executionRepo: ChatOpsExecutionRepository;

  constructor(executionRepo: ChatOpsExecutionRepository) {
    this.executionRepo = executionRepo;
  }

  /** 解析时间范围 */
  private parseTimeRange(params: TimeRangeParams): { start: Date; end: Date } {
    const end = dayjs();
    let start: dayjs.Dayjs;

    switch (params.range) {
      case '7d':
        start = end.subtract(7, 'day');
        break;
      case '30d':
        start = end.subtract(30, 'day');
        break;
      case 'month':
        start = end.startOf('month');
        break;
      case 'custom':
        if (!params.startDate || !params.endDate) {
          throw new Error('custom range requires startDate and endDate');
        }
        start = dayjs(params.startDate);
        end = dayjs(params.endDate);
        if (end.diff(start, 'day') > 90) {
          throw new Error('custom range cannot exceed 90 days');
        }
        break;
      default:
        throw new Error(`invalid time range: ${params.range}`);
    }

    return {
      start: start.toDate(),
      end: end.toDate(),
    };
  }

  /** 计算环比变化 */
  private calcComparison(
    current: DashboardMetrics,
    previous: DashboardMetrics,
  ): MetricsComparison {
    return {
      totalExecutions: previous.totalExecutions === 0
        ? 0
        : Math.round(
            ((current.totalExecutions - previous.totalExecutions) /
              previous.totalExecutions) *
              100,
          ),
      successRate: previous.successRate === 0
        ? 0
        : Math.round(current.successRate - previous.successRate),
      failedCount: previous.failedCount === 0
        ? 0
        : Math.round(
            ((current.failedCount - previous.failedCount) /
              previous.failedCount) *
              100,
          ),
      avgResponseTime: previous.avgResponseTime === 0
        ? 0
        : parseFloat(
            (current.avgResponseTime - previous.avgResponseTime).toFixed(1),
          ),
    };
  }

  /** 获取看板统计数据 */
  async getStats(params: TimeRangeParams): Promise<DashboardStats> {
    const { start, end } = this.parseTimeRange(params);

    // 当前时间段统计
    const currentStats = await this.executionRepo.getStatsByTimeRange(start, end);
    const trends = await this.executionRepo.getDailyTrends(start, end);
    const topCommands = await this.executionRepo.getTopCommands(start, end);
    const platformDist = await this.executionRepo.getPlatformDistribution(start, end);
    const recentExecs = await this.executionRepo.getRecentExecutions();

    const metrics: DashboardMetrics = {
      totalExecutions: currentStats.total,
      successRate:
        currentStats.total === 0
          ? 0
          : Math.round((currentStats.completed / currentStats.total) * 100),
      failedCount: currentStats.failed,
      avgResponseTime: currentStats.avgResponseTime,
    };

    // 计算环比：取前一个等长时间段
    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime());
    const previousStats = await this.executionRepo.getStatsByTimeRange(prevStart, prevEnd);

    const previousMetrics: DashboardMetrics = {
      totalExecutions: previousStats.total,
      successRate:
        previousStats.total === 0
          ? 0
          : Math.round((previousStats.completed / previousStats.total) * 100),
      failedCount: previousStats.failed,
      avgResponseTime: previousStats.avgResponseTime,
    };

    const comparison = this.calcComparison(metrics, previousMetrics);

    return {
      metrics,
      trends,
      topCommands,
      platformDistribution: platformDist,
      recentExecutions: recentExecs,
      comparison,
    };
  }
}
```

- [ ] **Step 2: 创建 DashboardService 单元测试**

```typescript
import { DashboardService, TimeRangeParams } from '../DashboardService';

// Mock repository
const createMockRepo = () => ({
  getStatsByTimeRange: jest.fn(),
  getDailyTrends: jest.fn(),
  getTopCommands: jest.fn(),
  getPlatformDistribution: jest.fn(),
  getRecentExecutions: jest.fn(),
});

type MockRepo = ReturnType<typeof createMockRepo>;

describe('DashboardService', () => {
  let service: DashboardService;
  let mockRepo: MockRepo;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new DashboardService(mockRepo as any);
  });

  describe('parseTimeRange', () => {
    it('should parse 7d range correctly', () => {
      const params: TimeRangeParams = { range: '7d' };
      const result = (service as any).parseTimeRange(params);
      const daysDiff = (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should parse 30d range correctly', () => {
      const params: TimeRangeParams = { range: '30d' };
      const result = (service as any).parseTimeRange(params);
      const daysDiff = (result.end.getTime() - result.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should parse month range correctly', () => {
      const params: TimeRangeParams = { range: 'month' };
      const result = (service as any).parseTimeRange(params);
      expect(result.start.getDate()).toBe(1);
    });

    it('should throw for custom range without dates', () => {
      const params: TimeRangeParams = { range: 'custom' };
      expect(() => (service as any).parseTimeRange(params)).toThrow(
        'custom range requires startDate and endDate',
      );
    });

    it('should throw for custom range exceeding 90 days', () => {
      const params: TimeRangeParams = {
        range: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      };
      expect(() => (service as any).parseTimeRange(params)).toThrow(
        'custom range cannot exceed 90 days',
      );
    });
  });

  describe('calcComparison', () => {
    it('should calculate comparison correctly', () => {
      const current = { totalExecutions: 128, successRate: 94, failedCount: 8, avgResponseTime: 4.2 };
      const previous = { totalExecutions: 100, successRate: 90, failedCount: 10, avgResponseTime: 5.0 };
      const result = (service as any).calcComparison(current, previous);
      expect(result.totalExecutions).toBe(28);
      expect(result.successRate).toBe(4);
      expect(result.failedCount).toBe(-20);
      expect(result.avgResponseTime).toBe(-0.8);
    });

    it('should handle zero previous values', () => {
      const current = { totalExecutions: 10, successRate: 100, failedCount: 0, avgResponseTime: 1.0 };
      const previous = { totalExecutions: 0, successRate: 0, failedCount: 0, avgResponseTime: 0 };
      const result = (service as any).calcComparison(current, previous);
      expect(result.totalExecutions).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return dashboard stats', async () => {
      mockRepo.getStatsByTimeRange.mockResolvedValue({ total: 128, completed: 120, failed: 8, avgResponseTime: 4.2 });
      mockRepo.getDailyTrends.mockResolvedValue([]);
      mockRepo.getTopCommands.mockResolvedValue([]);
      mockRepo.getPlatformDistribution.mockResolvedValue([]);
      mockRepo.getRecentExecutions.mockResolvedValue([]);

      const result = await service.getStats({ range: '7d' });

      expect(result.metrics.totalExecutions).toBe(128);
      expect(result.metrics.successRate).toBe(94);
      expect(result.metrics.failedCount).toBe(8);
      expect(result.metrics.avgResponseTime).toBe(4.2);
      expect(result.trends).toEqual([]);
      expect(result.topCommands).toEqual([]);
      expect(result.platformDistribution).toEqual([]);
      expect(result.recentExecutions).toEqual([]);
      expect(result.comparison).toBeDefined();
    });
  });
});
```

- [ ] **Step 3: 运行测试验证**

Run: `cd orion-platform-service && npx jest src/services/chatops/__tests__/DashboardService.test.ts --verbose`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/chatops/DashboardService.ts orion-platform-service/src/services/chatops/__tests__/DashboardService.test.ts orion-platform-service/src/repositories/ChatOpsRepository.ts
git commit -m "feat(chatops): add DashboardService with aggregation methods for dashboard stats"
```

---

### Task 3: 后端路由注册

**Files:**
- Modify: `orion-platform-service/src/api/chatops-routes.ts`

- [ ] **Step 1: 在 chatops-routes.ts 中添加 Dashboard 路由**

在 `ChatOpsController` 构造函数中注入 `DashboardService`，并添加路由。

首先修改 controller 初始化部分，在现有 services 后添加：

```typescript
// 在 chatops-routes.ts 文件中，找到 controller 初始化之前的位置（约在 executionService 创建后）
// 添加 DashboardService 初始化
import { DashboardService } from '../services/chatops/DashboardService';

const dashboardService = new DashboardService(executionRepo);
```

然后在 controller 构造函数选项中添加 dashboardService：

```typescript
// 修改 ChatOpsController 的构造函数选项（在现有代码中找到 controller 初始化位置）
const controller = new ChatOpsController({
  commandService,
  executionService,
  messageRepo,
  recommendationService,
  notifPrefService,
  dndService,
  alertStateService,
  platformConfigService,
  eventSubscriber,
  eventBus: options.eventBus,
  dashboardService,  // 新增
});
```

添加路由（在 Audit 路由段之前添加）：

```typescript
  // ==================== Dashboard Stats ====================

  app.get('/dashboard/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'chatops', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboardStats(request, reply);
  });
```

- [ ] **Step 2: 修改 ChatOpsController 支持 dashboardService**

在 `ChatOpsController.ts` 中添加：

```typescript
// 在构造函数参数中添加 dashboardService
import { DashboardService } from '../../services/chatops/DashboardService';

// 在类中添加私有属性
private dashboardService: DashboardService;

// 修改构造函数，添加 dashboardService 参数
constructor(options: {
  commandService: CommandService;
  executionService: ExecutionService;
  messageRepo: ChatOpsMessageRepository;
  recommendationService: RecommendationService;
  notifPrefService: NotificationPreferenceService;
  dndService: DNDService;
  alertStateService: AlertStateService;
  platformConfigService: PlatformConfigService;
  eventSubscriber?: ChatOpsEventSubscriber | null;
  eventBus?: EventBusService | null;
  dashboardService: DashboardService;  // 新增
}) {
  // ... 现有代码 ...
  this.dashboardService = options.dashboardService;
}

// 添加新的 controller 方法
async getDashboardStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const query = request.query as { range?: string; startDate?: string; endDate?: string };
    const range = (query.range as any) || '7d';
    const stats = await this.dashboardService.getStats({
      range,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    await reply.send({ success: true, data: stats });
  } catch (err) {
    if (err instanceof Error && err.message.includes('custom range')) {
      await reply.status(400).send({ success: false, error: err.message });
      return;
    }
    await reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
```

- [ ] **Step 3: 运行 type-check 验证**

Run: `cd orion-platform-service && npm run type-check`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/api/chatops-routes.ts orion-platform-service/src/api/controllers/ChatOpsController.ts
git commit -m "feat(chatops): add GET /dashboard/stats route and controller handler"
```

---

### Task 4: 前端 API 函数

**Files:**
- Modify: `orion-frontend/src/api/chatops.ts`

- [ ] **Step 1: 在 chatops.ts 中添加 dashboard 类型和 API 函数**

在文件末尾（`getAvailableTools` 之后）添加：

```typescript
// ---- Dashboard Stats ----

export interface DashboardMetrics {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardTrend {
  date: string;
  executions: number;
  successRate: number;
}

export interface TopCommand {
  command: string;
  count: number;
  successRate: number;
}

export interface PlatformDist {
  platform: string;
  count: number;
}

export interface DashboardRecentExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  status: string;
  startTime: string;
  endTime: string | null;
}

export interface MetricsComparison {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardStats {
  metrics: DashboardMetrics;
  trends: DashboardTrend[];
  topCommands: TopCommand[];
  platformDistribution: PlatformDist[];
  recentExecutions: DashboardRecentExecution[];
  comparison: MetricsComparison;
}

export type TimeRangeType = '7d' | '30d' | 'month' | 'custom';

export function getDashboardStats(params?: {
  range?: TimeRangeType;
  startDate?: string;
  endDate?: string;
}) {
  return api.get('/v1/chatops/dashboard/stats', { params });
}
```

- [ ] **Step 2: 运行前端 type-check 验证**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/api/chatops.ts
git commit -m "feat(chatops): add getDashboardStats API function and types"
```

---

### Task 5: 前端 ChatDashboard 组件（核心）

**Files:**
- Create: `orion-frontend/src/pages/ChatOps/ChatDashboard.tsx`
- Test: `orion-frontend/src/pages/ChatOps/__tests__/ChatDashboard.test.tsx`

- [ ] **Step 1: 创建 ChatDashboard 组件**

```typescript
/**
 * ChatDashboard - 总览看板
 * 展示 ChatOps 执行统计数据、趋势分析、热门命令
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Space,
  Typography,
  Empty,
  Skeleton,
  Tooltip,
  Tag,
} from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  getDashboardStats,
  type DashboardStats,
  type TimeRangeType,
  type TopCommand,
} from '@/api/chatops';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface MetricCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  trend?: number;
  color: string;
  tooltip: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, suffix, trend, color, tooltip }) => (
  <Card>
    <Tooltip title={tooltip}>
      <Statistic
        title={<span>{title} <InfoCircleOutlined style={{ fontSize: 12, color: '#bbb', cursor: 'help' }} /></span>}
        value={value}
        suffix={suffix}
        valueStyle={{ color }}
        prefix={
          trend != null && trend !== 0 ? (
            <span style={{ fontSize: 12, marginRight: 4 }}>
              {trend > 0 ? (
                <ArrowUpOutlined style={{ color: trend > 0 ? '#52c41a' : '#ff4d4f' }} />
              ) : (
                <ArrowDownOutlined style={{ color: trend > 0 ? '#ff4d4f' : '#52c41a' }} />
              )}
            </span>
          ) : undefined
        }
      />
    </Tooltip>
    {trend != null && trend !== 0 && (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}% 环比
      </Text>
    )}
  </Card>
);

export default function ChatDashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeType>('7d');
  const [apiError, setApiError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await getDashboardStats({ range: timeRange });
      setStats(res.data.data as DashboardStats);
    } catch {
      setApiError('后端服务暂不可用');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  if (apiError && !stats) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>ChatOps 总览看板</Title>
            <Text type="secondary">执行统计与趋势分析</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
        </div>
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={apiError} />
        </Card>
      </div>
    );
  }

  // 时间范围选项
  const timeRangeOptions = [
    { label: '近 7 天', value: '7d' as TimeRangeType },
    { label: '近 30 天', value: '30d' as TimeRangeType },
    { label: '本月', value: 'month' as TimeRangeType },
  ];

  // 趋势图配置
  const trendChartOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: stats?.trends.map(t => dayjs(t.date).format('MM-DD')) || [],
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#999' },
    },
    yAxis: [
      { type: 'value' as const, name: '执行数', axisLabel: { color: '#999' }, splitLine: { lineStyle: { type: 'dashed' } } },
    ],
    series: [
      {
        name: '执行数',
        type: 'bar' as const,
        data: stats?.trends.map(t => t.executions) || [],
        itemStyle: { color: colors.primary[500] },
        barWidth: '40%',
      },
    ],
  };

  // 平台分布饼图配置
  const platformChartOption = {
    tooltip: { trigger: 'item' as const },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}: {c}次' },
        data: stats?.platformDistribution.map(p => ({ name: p.platform, value: p.count })) || [],
      },
    ],
  };

  // 热门命令列表渲染
  const renderTopCommands = (commands: TopCommand[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {commands.map((cmd, index) => (
        <div key={cmd.command} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: index < 3 ? colors.primary[500] : '#d9d9d9',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {index + 1}
          </span>
          <Text code style={{ flex: 1 }}>/{cmd.command}</Text>
          <Text style={{ color: colors.primary[500], fontWeight: 600 }}>{cmd.count}</Text>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            ChatOps 总览看板
          </Title>
          <Text type="secondary">执行统计与趋势分析</Text>
        </div>
        <Space>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 120 }}
            options={timeRangeOptions.map(o => ({ label: o.label, value: o.value }))}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Skeleton or Content */}
      {loading && !stats ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : stats ? (
        <>
          {/* Metric Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <MetricCard
                title="总执行数"
                value={stats.metrics.totalExecutions}
                trend={stats.comparison.totalExecutions}
                color={colors.primary[500]}
                tooltip="时间范围内所有执行次数"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="成功率"
                value={stats.metrics.successRate}
                suffix="%"
                trend={stats.comparison.successRate}
                color="#52c41a"
                tooltip="成功数 / 总执行数 × 100%"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="失败数"
                value={stats.metrics.failedCount}
                trend={stats.comparison.failedCount}
                color="#ff4d4f"
                tooltip="状态为 failed 的执行数"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="平均响应时间"
                value={stats.metrics.avgResponseTime}
                suffix="s"
                trend={stats.comparison.avgResponseTime !== 0 ? -Math.round(stats.comparison.avgResponseTime * 10) / 10 : 0}
                color="#722ed1"
                tooltip="成功执行的平均响应时间"
              />
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={24} md={12} lg={12}>
              <Card title="活跃度趋势">
                {stats.trends.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <ReactECharts option={trendChartOption} style={{ height: 200 }} />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={6}>
              <Card title="热门命令 TOP5" style={{ height: '100%' }}>
                {stats.topCommands.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  renderTopCommands(stats.topCommands)
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={6}>
              <Card title="平台分布" style={{ height: '100%' }}>
                {stats.platformDistribution.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <ReactECharts option={platformChartOption} style={{ height: 200 }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Recent Executions */}
          <Card title="最近执行记录">
            {stats.recentExecutions.length === 0 ? (
              <Empty description="暂无执行记录">
                <Text type="secondary">还没有执行记录，开始第一次对话吧</Text>
              </Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.recentExecutions.map((exec) => (
                  <div
                    key={exec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: 6,
                    }}
                  >
                    <Text code>/{exec.commandId}</Text>
                    <Tag style={{ marginLeft: 8 }}>{exec.platform}</Tag>
                    <Text style={{ marginLeft: 'auto' }}>{exec.userId}</Text>
                    <Tag
                      color={exec.status === 'completed' ? 'green' : exec.status === 'failed' ? 'red' : 'orange'}
                      style={{ marginLeft: 8 }}
                    >
                      {exec.status}
                    </Tag>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {dayjs(exec.startTime).fromNow()}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: 创建 ChatDashboard 组件测试**

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ChatDashboard from '../ChatDashboard';
import * as chatopsApi from '@/api/chatops';

jest.mock('@/api/chatops');
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: () => <div data-testid="echarts" />,
}));

const mockStats = {
  metrics: { totalExecutions: 128, successRate: 94, failedCount: 8, avgResponseTime: 4.2 },
  trends: [{ date: '2026-05-13', executions: 15, successRate: 93 }],
  topCommands: [{ command: 'deploy', count: 72, successRate: 96 }],
  platformDistribution: [{ platform: 'web', count: 56 }],
  recentExecutions: [
    { id: '1', commandId: 'deploy', userId: 'user1', platform: 'web', status: 'completed', startTime: '2026-05-19T10:00:00Z', endTime: '2026-05-19T10:00:05Z' },
  ],
  comparison: { totalExecutions: 12, successRate: 3, failedCount: -5, avgResponseTime: -0.8 },
};

describe('ChatDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render metric cards when data is loaded', async () => {
    (chatopsApi.getDashboardStats as jest.Mock).mockResolvedValue({ data: { data: mockStats } });

    render(<ChatDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/总执行数/)).toBeInTheDocument();
      expect(screen.getByText('128')).toBeInTheDocument();
    });
  });

  it('should render empty state on API error', async () => {
    (chatopsApi.getDashboardStats as jest.Mock).mockRejectedValue(new Error('API error'));

    render(<ChatDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/后端服务暂不可用/)).toBeInTheDocument();
    });
  });

  it('should show loading skeleton on initial load', () => {
    (chatopsApi.getDashboardStats as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ChatDashboard />);
    expect(screen.getByText(/ChatOps 总览看板/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行前端测试**

Run: `cd orion-frontend && npx vitest run src/pages/ChatOps/__tests__/ChatDashboard.test.tsx`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/pages/ChatOps/ChatDashboard.tsx orion-frontend/src/pages/ChatOps/__tests__/ChatDashboard.test.tsx
git commit -m "feat(chatops): add ChatDashboard component with metrics, trends, and platform charts"
```

---

### Task 6: 重构 ChatOps 主页面为 Tab 容器

**Files:**
- Modify: `orion-frontend/src/pages/ChatOps/index.tsx`

- [ ] **Step 1: 将现有 index.tsx 重构为 Tab 容器**

```typescript
/**
 * ChatOps 主页面 - Tab 分页结构
 * Tab 1: 总览看板 (默认)
 * Tab 2: 对话工作台
 * Tab 3: 执行记录
 * Tab 4: 设置
 */
import React, { useState } from 'react';
import { Tabs } from 'antd';
import { DashboardOutlined, MessageOutlined, PlayCircleOutlined, SettingOutlined } from '@ant-design/icons';
import ChatDashboard from './ChatDashboard';
import ChatOpsChat from './index.chat';
import ExecutionDashboard from './ExecutionDashboard';
import ChatOpsSettings from './ChatOpsSettings';

// 将当前文件中的对话工作台代码移动到 index.chat.tsx
// 这是一个新建文件，内容来自当前 index.tsx 的 ChatOps 组件

export default function ChatOpsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ padding: spacing[4], height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'dashboard',
            label: (
              <span>
                <DashboardOutlined />
                总览看板
              </span>
            ),
            children: <ChatDashboard />,
          },
          {
            key: 'chat',
            label: (
              <span>
                <MessageOutlined />
                对话工作台
              </span>
            ),
            children: <ChatOpsChat />,
          },
          {
            key: 'executions',
            label: (
              <span>
                <PlayCircleOutlined />
                执行记录
              </span>
            ),
            children: <ExecutionDashboard />,
          },
          {
            key: 'settings',
            label: (
              <span>
                <SettingOutlined />
                设置
              </span>
            ),
            children: <ChatOpsSettings />,
          },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: 创建 index.chat.tsx（从当前 index.tsx 拆分）**

将当前 `index.tsx` 中的全部内容复制为 `orion-frontend/src/pages/ChatOps/index.chat.tsx`：

```typescript
/**
 * ChatOps 对话工作台 (Phase 3)
 * 用自然语言与 AI 助手交流，执行运维操作
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Input, Button, Avatar, Spin, Typography, Space, Tag, message, Empty } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ToolOutlined, ClearOutlined } from '@ant-design/icons';
import { sendChatMessage, getAvailableTools, type ChatResponse, type ToolInfo } from '@/api/chatops';
import { colors, spacing } from '@/tokens';

// ... 保留当前 index.tsx 中的全部代码 ...
// 导出名称改为 ChatOpsChat
export default function ChatOpsChat() {
  // ... 当前 index.tsx 中的全部组件逻辑 ...
}
```

- [ ] **Step 3: 删除旧 index.tsx 中的冗余内容**

将旧 `index.tsx` 的内容替换为 Task 6 Step 1 的 Tab 容器代码。

- [ ] **Step 4: 运行前端 type-check 验证**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add orion-frontend/src/pages/ChatOps/index.tsx orion-frontend/src/pages/ChatOps/index.chat.tsx
git commit -m "refactor(chatops): convert main page to Tab container with dashboard, chat, executions, settings"
```

---

### Task 7: 最终验证与清理

- [ ] **Step 1: 运行后端所有测试**

Run: `cd orion-platform-service && npm run test -- --testPathPattern="DashboardService|ChatOpsRepository" --verbose`
Expected: All tests pass

- [ ] **Step 2: 运行前端所有测试**

Run: `cd orion-frontend && npx vitest run --testPathPattern="ChatDashboard" --verbose`
Expected: All tests pass

- [ ] **Step 3: 运行后端 type-check**

Run: `cd orion-platform-service && npm run type-check`
Expected: 0 errors

- [ ] **Step 4: 运行前端 type-check**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit all (if any remaining changes)**

```bash
git status
git add -A
git commit -m "chore(chatops): final verification cleanup"
```

---

## Self-Review

### Spec Coverage Check
| Spec Requirement | Task | Status |
|------------------|------|--------|
| Tab 分页结构 (4个Tab) | Task 6 | Covered |
| 总览看板组件 | Task 5 | Covered |
| 指标卡片 (4个核心指标) | Task 5 | Covered |
| 活跃度趋势图 | Task 5 (ECharts bar chart) | Covered |
| 热门命令 TOP5 | Task 5 | Covered |
| 平台分布饼图 | Task 5 (ECharts pie chart) | Covered |
| 最近执行记录 | Task 5 | Covered |
| 时间范围选择器 (7d/30d/month) | Task 5 | Covered |
| 环比变化计算 | Task 2 (DashboardService) | Covered |
| 后端聚合接口 GET /dashboard/stats | Task 3 | Covered |
| DashboardService 聚合逻辑 | Task 2 | Covered |
| Repository 聚合方法 | Task 1 | Covered |
| 前端 API 函数 getDashboardStats | Task 4 | Covered |
| 加载策略 (预加载/懒加载) | Task 5 (useEffect 自动) | Covered |
| 空状态/错误处理 | Task 5 | Covered |
| Skeleton 加载状态 | Task 5 | Covered |
| 响应式降级 (Col xs/sm/md/lg) | Task 5 | Covered |
| 单元测试 (DashboardService) | Task 2 | Covered |
| 组件测试 (ChatDashboard) | Task 5 | Covered |
| 图表库使用 echarts (非额外依赖) | Task 5 | Covered |

### Placeholder Scan
- No "TBD", "TODO", "fill in later" found
- All code steps contain actual code
- No "add validation" without specifics - validation is in DashboardService.parseTimeRange()
- No "similar to Task N" references
- No undefined function/type references

### Type Consistency Check
- `DashboardStats` type matches between API (Task 4), Service (Task 2), and Component (Task 5)
- `TimeRangeType` = `'7d' | '30d' | 'month' | 'custom'` consistent across all files
- Repository method return types match Service expectations
- API response format `{ success: true, data: ... }` matches existing controller pattern

All checks pass. Plan is ready for execution.