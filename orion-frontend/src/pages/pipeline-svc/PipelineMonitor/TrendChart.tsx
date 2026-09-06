/**
 * TrendChart
 * 运行趋势柱状图（抽取自 index.tsx 的 renderTrendChart）
 */
import React from 'react';
import { Tooltip } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { DailyRunStats } from './api';
import { CHART_HEIGHT } from './constants';

export interface TrendChartProps {
  dailyStats: DailyRunStats[];
  formatDuration: (ms: number) => string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ dailyStats, formatDuration }) => {
  if (dailyStats.length === 0) return null;

  const maxCount = Math.max(...dailyStats.map((d) => d.total), 1);
  const barGroupWidth = Math.max(20, Math.min(40, 500 / dailyStats.length));
  const barWidth = barGroupWidth / 4;
  const showXLabels = dailyStats.length <= 14;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: spacing.md }} >
      <div style={{ minWidth: dailyStats.length * barGroupWidth, position: 'relative' }} >
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
