/**
 * PipelineMonitor - 运行监控面板
 * 展示 Pipeline 运行统计、失败分析、趋势图表、性能指标
 *
 * 拆分结构（P2-9 Phase 26）:
 * - usePipelineMonitorState.ts: 状态 + loadData + 轮询逻辑 + formatDuration
 * - StatsCards.tsx: 第一行 4 卡 + P50/P95 行
 * - TrendChart.tsx: 运行趋势柱状图
 * - FailureAnalysis.tsx: 失败模式分布 + 失败阶段 Top 5
 * - RecentRunsTable.tsx: 最近运行表格
 * - constants.ts: 轮询间隔 + 颜色/标签映射
 */
import React from 'react';
import { Space, Select, Button, Empty } from 'antd';
import {
  ReloadOutlined,
  RadarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import { usePipelineMonitorState } from './usePipelineMonitorState';
import { StatsCards } from './StatsCards';
import { TrendChart } from './TrendChart';
import { FailureAnalysis } from './FailureAnalysis';
import { RecentRunsTable } from './RecentRunsTable';
import { POLLING_INTERVAL_MS, dayRangeOptions } from './constants';

const PipelineMonitor: React.FC = () => {
  const {
    loading,
    stats,
    days,
    setDays,
    failedRuns,
    recentRuns,
    dailyStats,
    failedStageStats,
    p50Duration,
    p95Duration,
    isPolling,
    handleRefresh,
    formatDuration,
  } = usePipelineMonitorState();

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
          <RadarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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
            <RadarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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
            options={dayRangeOptions}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <StatsCards
        stats={stats}
        p50Duration={p50Duration}
        p95Duration={p95Duration}
        formatDuration={formatDuration}
      />

      {/* 趋势图 */}
      <div style={{ marginBottom: spacing.md }}>
        <CardPanel
          title={
            <span>
              <LineChartOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
              运行趋势
            </span>
          }
          bodyStyle={{ padding: spacing.lg }}
        >
          {dailyStats.length > 0 ? (
            <TrendChart dailyStats={dailyStats} formatDuration={formatDuration} />
          ) : (
            <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </CardPanel>
      </div>

      {/* Failure Analysis & Top Failed Stages */}
      <FailureAnalysis
        failedRuns={failedRuns}
        failedStageStats={failedStageStats}
        stats={stats}
      />

      {/* Recent Runs */}
      <RecentRunsTable
        recentRuns={recentRuns}
        totalRuns={stats?.totalRuns ?? 0}
        successRate={stats?.successRate ?? 0}
        formatDuration={formatDuration}
      />

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
