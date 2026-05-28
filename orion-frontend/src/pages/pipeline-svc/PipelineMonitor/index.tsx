/**
 * PipelineMonitor - 运行监控面板
 * 展示 Pipeline 运行统计、失败分析、趋势图表、性能指标
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Space,
  Select,
  Button,
  Empty,
  message,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  RadarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import {
  getRunStats,
  buildDailyStats,
  calculatePercentile,
  getFailedStageStats,
  type RunStats,
  type DailyRunStats,
  type FailedStageStat,
} from './api';
import { getAllPipelineRuns, type PipelineRunSummary } from '@/api/pipelineRuns';
import dayjs from 'dayjs';

// ============ 实时监控轮询间隔 ============
const POLLING_INTERVAL_MS = 10000;

const PipelineMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [days, setDays] = useState(7);
  const [failedRuns, setFailedRuns] = useState<PipelineRunSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRunSummary[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyRunStats[]>([]);
  const [failedStageStats, setFailedStageStats] = useState<FailedStageStat[]>([]);
  const [p50Duration, setP50Duration] = useState(0);
  const [p95Duration, setP95Duration] = useState(0);

  // 实时监控相关
  const [isPolling, setIsPolling] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 失败阶段缓存
  const stageCacheRef = useRef<Map<string, Array<{ name: string; status: string }>>>(new Map());

  // 加载主数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取统计数据
      try {
        const statsRes = await getRunStats({ days });
        if (statsRes.data && statsRes.data.totalRuns !== undefined) {
          setStats(statsRes.data);
        }
      } catch {
        // API 不存在，使用 fallback 逻辑
      }

      // 使用 getAllPipelineRuns 聚合数据
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const runsRes = await getAllPipelineRuns({
        limit: 500,
      });

      const apiData = runsRes.data;
      const runs = Array.isArray(apiData.data) ? apiData.data : [];
      // 按日期过滤
      const filteredRuns = runs.filter((run: PipelineRunSummary) => {
        if (!run.createdAt) return false;
        const runDate = dayjs(run.createdAt);
        return runDate.isAfter(startDate) && runDate.isBefore(endDate.add(1, 'day'));
      });

      // 计算统计数据
      const totalRuns = filteredRuns.length;
      const successRuns = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'success'
      ).length;
      const failedCount = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'failed'
      ).length;
      const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0;

      // 计算平均耗时
      const completedRuns = filteredRuns.filter((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur && dur > 0;
      });
      const totalDuration = completedRuns.reduce((sum: number, r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return sum + (dur || 0);
      }, 0);
      const avgDuration = completedRuns.length > 0 ? totalDuration / completedRuns.length : 0;

      // 计算 P50/P95
      const durations = completedRuns.map((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur || 0;
      });
      const p50 = calculatePercentile(durations, 50);
      const p95 = calculatePercentile(durations, 95);
      setP50Duration(p50);
      setP95Duration(p95);

      setStats({
        totalRuns,
        successRate,
        avgDuration,
        failedCount,
      });

      // 记录失败的运行
      setFailedRuns(filteredRuns.filter((r: PipelineRunSummary) => r.status === 'failed'));

      // 记录最近的运行
      setRecentRuns(
        [...filteredRuns]
          .sort((a: PipelineRunSummary, b: PipelineRunSummary) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 10)
      );

      // 构建每日趋势数据
      const daily = buildDailyStats(filteredRuns);
      setDailyStats(daily);

      // 加载失败阶段统计
      const failedRunIds = filteredRuns
        .filter((r: PipelineRunSummary) => r.status === 'failed')
        .map((r: PipelineRunSummary) => r.id);

      if (failedRunIds.length > 0) {
        const stageStats = await getFailedStageStats(failedRunIds, stageCacheRef.current);
        setFailedStageStats(stageStats);
      } else {
        setFailedStageStats([]);
      }
    } catch (error) {
      console.error('Failed to load pipeline monitor data:', error);
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  // 检查是否有正在运行的 Pipeline，决定是否启动轮询
  const checkAndStartPolling = useCallback(
    async (runs: PipelineRunSummary[]) => {
      const hasRunning = runs.some((r) => r.status === 'running');

      if (hasRunning && !isPolling) {
        setIsPolling(true);
        pollingTimerRef.current = setInterval(() => {
          loadData();
        }, POLLING_INTERVAL_MS);
      } else if (!hasRunning && isPolling) {
        setIsPolling(false);
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    },
    [isPolling, loadData]
  );

  // 修改 loadData 以在完成后检查轮询
  const loadDataWithPollingCheck = useCallback(async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取统计数据
      try {
        const statsRes = await getRunStats({ days });
        if (statsRes.data && statsRes.data.totalRuns !== undefined) {
          setStats(statsRes.data);
        }
      } catch {
        // API 不存在，使用 fallback 逻辑
      }

      // 使用 getAllPipelineRuns 聚合数据
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const runsRes = await getAllPipelineRuns({
        limit: 500,
      });

      const apiData = runsRes.data;
      const runs = Array.isArray(apiData.data) ? apiData.data : [];
      // 按日期过滤
      const filteredRuns = runs.filter((run: PipelineRunSummary) => {
        if (!run.createdAt) return false;
        const runDate = dayjs(run.createdAt);
        return runDate.isAfter(startDate) && runDate.isBefore(endDate.add(1, 'day'));
      });

      // 计算统计数据
      const totalRuns = filteredRuns.length;
      const successRuns = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'success'
      ).length;
      const failedCount = filteredRuns.filter(
        (r: PipelineRunSummary) => r.status === 'failed'
      ).length;
      const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0;

      // 计算平均耗时
      const completedRuns = filteredRuns.filter((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur && dur > 0;
      });
      const totalDuration = completedRuns.reduce((sum: number, r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return sum + (dur || 0);
      }, 0);
      const avgDuration = completedRuns.length > 0 ? totalDuration / completedRuns.length : 0;

      // 计算 P50/P95
      const durations = completedRuns.map((r: PipelineRunSummary) => {
        const dur = typeof r.durationMs === 'string' ? parseFloat(r.durationMs) : r.durationMs;
        return dur || 0;
      });
      const p50 = calculatePercentile(durations, 50);
      const p95 = calculatePercentile(durations, 95);
      setP50Duration(p50);
      setP95Duration(p95);

      setStats({
        totalRuns,
        successRate,
        avgDuration,
        failedCount,
      });

      // 记录失败的运行
      setFailedRuns(filteredRuns.filter((r: PipelineRunSummary) => r.status === 'failed'));

      // 记录最近的运行
      const sortedRecent = [...filteredRuns]
        .sort((a: PipelineRunSummary, b: PipelineRunSummary) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 10);
      setRecentRuns(sortedRecent);

      // 构建每日趋势数据
      const daily = buildDailyStats(filteredRuns);
      setDailyStats(daily);

      // 加载失败阶段统计
      const failedRunIds = filteredRuns
        .filter((r: PipelineRunSummary) => r.status === 'failed')
        .map((r: PipelineRunSummary) => r.id);

      if (failedRunIds.length > 0) {
        const stageStats = await getFailedStageStats(failedRunIds, stageCacheRef.current);
        setFailedStageStats(stageStats);
      } else {
        setFailedStageStats([]);
      }

      // 检查是否需要启动/停止轮询
      checkAndStartPolling(filteredRuns);
    } catch (error) {
      console.error('Failed to load pipeline monitor data:', error);
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [days, checkAndStartPolling]);

  useEffect(() => {
    loadDataWithPollingCheck();
  }, [days, loadDataWithPollingCheck]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  // 手动刷新时重置轮询状态
  const handleRefresh = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setIsPolling(false);
    stageCacheRef.current.clear();
    loadDataWithPollingCheck();
  };

  // 格式化耗时
  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  // 最近运行表格列
  const recentColumns = [
    {
      title: 'Pipeline ID',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          success: colors.success[500],
          failed: colors.error[500],
          running: colors.primary[500],
          cancelled: colors.neutral[500],
          pending: colors.warning[500],
        };
        const iconMap: Record<string, React.ReactNode> = {
          success: <CheckCircleOutlined />,
          failed: <CloseCircleOutlined />,
          running: <SyncOutlined spin />,
          cancelled: <CloseCircleOutlined />,
          pending: <ClockCircleOutlined />,
        };
        return (
          <Tag
            color={colorMap[status] || colors.neutral[500]}
            style={{ borderRadius: 4, minWidth: 60, textAlign: 'center' }}
          >
            {iconMap[status]} {status}
          </Tag>
        );
      },
    },
    {
      title: '触发方式',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 100,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          manual: '手动',
          push: '推送',
          schedule: '定时',
          api: 'API',
        };
        return <span>{typeMap[type] || type}</span>;
      },
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (ms: number | string) => {
        const dur = typeof ms === 'string' ? parseFloat(ms) : ms;
        return <span>{dur ? formatDuration(dur) : '-'}</span>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time: string) => (
        <span>{time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
      ),
    },
  ];

  // ============ 趋势图最大高度 ============
  const CHART_HEIGHT = 160;

  // 渲染趋势图
  const renderTrendChart = () => {
    if (dailyStats.length === 0) return null;

    const maxCount = Math.max(...dailyStats.map((d) => d.total), 1);
    const barGroupWidth = Math.max(20, Math.min(40, 500 / dailyStats.length));
    const barWidth = barGroupWidth / 4;
    const showXLabels = dailyStats.length <= 14;

    return (
      <div style={{ overflowX: 'auto', paddingBottom: spacing.md }}>
        <div style={{ minWidth: dailyStats.length * barGroupWidth, position: 'relative' }}>
          {/* Y 轴刻度线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <div
              key={ratio}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: CHART_HEIGHT * (1 - ratio) + 10,
                borderTop: `1px dashed ${colors.neutral[200]}`,
                zIndex: 0,
              }}
            />
          ))}

          {/* 柱状图 */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              height: CHART_HEIGHT + 30,
              alignItems: 'flex-end',
            }}
          >
            {dailyStats.map((day) => {
              const successH = (day.success / maxCount) * CHART_HEIGHT;
              const failedH = (day.failed / maxCount) * CHART_HEIGHT;
              const runningH = (day.running / maxCount) * CHART_HEIGHT;
              const cancelledH = (day.cancelled / maxCount) * CHART_HEIGHT;

              return (
                <Tooltip
                  key={day.date}
                  title={
                    <div style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 4, fontWeight: 600 }}>{day.date}</div>
                      <div>总计: {day.total}</div>
                      <div style={{ color: colors.success[500] }}>成功: {day.success}</div>
                      <div style={{ color: colors.error[500] }}>失败: {day.failed}</div>
                      {day.running > 0 && (
                        <div style={{ color: colors.primary[500] }}>运行中: {day.running}</div>
                      )}
                      {day.cancelled > 0 && (
                        <div style={{ color: colors.neutral[500] }}>取消: {day.cancelled}</div>
                      )}
                      {day.avgDuration > 0 && (
                        <div>平均耗时: {formatDuration(day.avgDuration)}</div>
                      )}
                    </div>
                  }
                >
                  <div
                    style={{
                      width: barGroupWidth,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        height: CHART_HEIGHT,
                        gap: 1,
                      }}
                    >
                      {/* 成功 - 绿色 */}
                      <div
                        style={{
                          width: barWidth,
                          height: Math.max(0, successH),
                          background: colors.success[500],
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 200ms ease',
                        }}
                      />
                      {/* 失败 - 红色 */}
                      <div
                        style={{
                          width: barWidth,
                          height: Math.max(0, failedH),
                          background: colors.error[500],
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 200ms ease',
                        }}
                      />
                      {/* 运行中 - 蓝色 */}
                      <div
                        style={{
                          width: barWidth,
                          height: Math.max(0, runningH),
                          background: colors.primary[500],
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 200ms ease',
                        }}
                      />
                      {/* 取消 - 灰色 */}
                      <div
                        style={{
                          width: barWidth,
                          height: Math.max(0, cancelledH),
                          background: colors.neutral[400],
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 200ms ease',
                        }}
                      />
                    </div>
                    {/* X 轴标签 */}
                    {showXLabels && (
                      <div
                        style={{
                          fontSize: 10,
                          color: colors.neutral[500],
                          marginTop: 4,
                          whiteSpace: 'nowrap',
                          transform: 'rotate(-30deg)',
                          transformOrigin: 'top left',
                        }}
                      >
                        {day.date.slice(5)}
                      </div>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* 图例 */}
        <div
          style={{
            display: 'flex',
            gap: spacing.lg,
            marginTop: spacing.sm,
            justifyContent: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colors.success[500],
                marginRight: 4,
                display: 'inline-block',
              }}
            />
            成功
          </span>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colors.error[500],
                marginRight: 4,
                display: 'inline-block',
              }}
            />
            失败
          </span>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colors.primary[500],
                marginRight: 4,
                display: 'inline-block',
              }}
            />
            运行中
          </span>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colors.neutral[400],
                marginRight: 4,
                display: 'inline-block',
              }}
            />
            取消
          </span>
        </div>
      </div>
    );
  };

  // 空状态
  if (!loading && (!stats || stats.totalRuns === 0)) {
    return (
      <div style={{ padding: spacing.xl }}>
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: spacing.sm,
            fontSize: 20,
            fontWeight: 600,
            color: colors.neutral[900],
          }}
        >
          <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          运行监控
        </h2>
        <CardPanel>
          <Empty
            description={
              <div>
                <span style={{ color: colors.neutral[500] }}>暂无 Pipeline 运行记录</span>
                <div style={{ marginTop: spacing.sm, fontSize: 13, color: colors.neutral[400] }}>
                  创建并运行 Pipeline 后，此处将显示运行监控数据
                </div>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </CardPanel>
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.md,
        }}
      >
        <div>
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 4,
              fontSize: 20,
              fontWeight: 600,
              color: colors.neutral[900],
            }}
          >
            <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            运行监控
          </h2>
          {/* 实时监控指示器 */}
          {isPolling && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 4,
                fontSize: 12,
                color: colors.success[500],
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colors.success[500],
                  marginRight: 6,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              实时监控中
              <span style={{ marginLeft: 4, color: colors.neutral[500] }}>
                (每 {POLLING_INTERVAL_MS / 1000}s 刷新)
              </span>
            </div>
          )}
        </div>
        <Space>
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 120 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards - 第一行 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="总运行次数"
              value={stats?.totalRuns ?? 0}
              prefix={<ClockCircleOutlined style={{ color: colors.primary[500] }} />}
              valueStyle={{ fontSize: 28 }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="成功率"
              value={(stats?.successRate ?? 0).toFixed(1)}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
              valueStyle={{ color: colors.success[500], fontSize: 28 }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="失败次数"
              value={stats?.failedCount ?? 0}
              prefix={<CloseCircleOutlined style={{ color: colors.error[500] }} />}
              valueStyle={{ color: colors.error[500], fontSize: 28 }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CardPanel>
            <Statistic
              title="平均耗时"
              value={formatDuration(stats?.avgDuration ?? 0)}
              prefix={<ClockCircleOutlined style={{ color: colors.info[500] }} />}
              valueStyle={{ fontSize: 28 }}
            />
          </CardPanel>
        </Col>
      </Row>

      {/* Stats Cards - P50/P95 百分位 */}
      {(p50Duration > 0 || p95Duration > 0) && (
        <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
          <Col xs={24} sm={12} lg={12}>
            <CardPanel>
              <Statistic
                title="P50 耗时 (中位数)"
                value={formatDuration(p50Duration)}
                prefix={<LineChartOutlined style={{ color: colors.primary[500] }} />}
                valueStyle={{ fontSize: 28 }}
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={12}>
            <CardPanel>
              <Statistic
                title="P95 耗时 (95百分位)"
                value={formatDuration(p95Duration)}
                prefix={<LineChartOutlined style={{ color: colors.purple[500] }} />}
                valueStyle={{ color: colors.purple[500], fontSize: 28 }}
              />
            </CardPanel>
          </Col>
        </Row>
      )}

      {/* 趋势图 */}
      <div style={{ marginBottom: spacing.md }}>
        <CardPanel
          title={
            <span>
              <LineChartOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              运行趋势
            </span>
          }
          bodyStyle={{ padding: spacing.lg }}
        >
          {dailyStats.length > 0 ? (
            renderTrendChart()
          ) : (
            <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </CardPanel>
      </div>

      {/* Failure Analysis & Top Failed Stages */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} lg={12}>
          <CardPanel title="失败模式分布">
            {failedRuns.length > 0 ? (
              <div>
                <div style={{ marginBottom: spacing.sm }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
                    {failedRuns.length}
                  </span>
                  <span style={{ marginLeft: spacing.sm, color: colors.neutral[500] }}>
                    次失败 (
                    {stats?.totalRuns
                      ? ((failedRuns.length / stats.totalRuns) * 100).toFixed(1)
                      : 0}
                    %)
                  </span>
                </div>
                {/* 简化版进度条展示 */}
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stats?.totalRuns ? stats.successRate : 0}%`,
                      background: colors.success[500],
                      transition: 'width 300ms ease',
                    }}
                  />
                  <div
                    style={{
                      width: `${stats?.totalRuns ? ((stats.failedCount || 0) / stats.totalRuns) * 100 : 0}%`,
                      background: colors.error[500],
                      transition: 'width 300ms ease',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      background: colors.neutral[200],
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: spacing.xs,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: colors.success[500] }}>成功</span>
                  <span style={{ color: colors.error[500] }}>失败</span>
                </div>
              </div>
            ) : (
              <Empty description="暂无失败记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </CardPanel>
        </Col>
        <Col xs={24} lg={12}>
          <CardPanel title="失败阶段 Top 5">
            {failedStageStats.length > 0 ? (
              <div>
                {failedStageStats.map((item, index) => (
                  <div
                    key={item.stageName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing.xs} 0`,
                      borderBottom:
                        index < failedStageStats.length - 1
                          ? `1px solid ${colors.neutral[200]}`
                          : 'none',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: index < 3 ? colors.error[500] : colors.neutral[300],
                          color: colors.neutral[0],
                          fontSize: 12,
                          marginRight: spacing.sm,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        style={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.stageName}
                      </span>
                    </span>
                    <span style={{ fontWeight: 500, color: colors.error[500] }}>
                      {item.count} 次
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无失败数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </CardPanel>
        </Col>
      </Row>

      {/* Recent Runs */}
      <CardPanel title="最近运行">
        {recentRuns.length > 0 ? (
          <Table
            dataSource={recentRuns}
            columns={recentColumns}
            rowKey="id"
            pagination={false}
            size="small"
            rowClassName={(record: PipelineRunSummary) =>
              record.status === 'running' ? 'pipeline-running-row' : ''
            }
          />
        ) : (
          <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {recentRuns.length > 0 && (
          <div style={{ fontSize: spacing[3], color: colors.neutral[600], marginTop: spacing.sm }}>
            共 {stats?.totalRuns ?? 0} 次运行，成功率 {(stats?.successRate ?? 0).toFixed(1)}%
          </div>
        )}
      </CardPanel>

      {/* 内联脉冲动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .pipeline-running-row {
          background-color: ${colors.primary[50]} !important;
        }
        .pipeline-running-row:hover td {
          background-color: ${colors.primary[50]} !important;
        }
      `}</style>
    </div>
  );
};

export default PipelineMonitor;
