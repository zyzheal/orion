/**
 * ScoreTrendChart (Phase 305)
 *
 * Multi-line trend chart showing overall + per-framework compliance scores
 * across a user-selected day window (7/14/30/60/90).
 *
 * - `overall` is rendered as a bold, smooth primary-colored line.
 * - Each framework gets a stable color from a fixed palette so re-queries
 *   and re-renders don't shuffle colors.
 * - A 70 threshold line marks the "partial / non-compliant" cutover used
 *   by the backend.
 */
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Empty } from 'antd';
import { colors } from '@/tokens/colors';
import type { ComplianceScoreTrend } from '@/api/audit-compliance';

export interface ScoreTrendChartProps {
  trend: ComplianceScoreTrend | undefined;
  loading?: boolean;
  height?: number;
}

/** Fixed palette so framework colors stay stable across queries. */
const FRAMEWORK_COLORS: Record<string, string> = {
  SOC2: colors.primary[500],
  ISO27001: colors.success[500],
  'PCI-DSS': colors.warning[500],
  MLPS2: colors.purple[500],
  PDPA: colors.info[500],
  COMBINED: colors.neutral[600],
};

const FALLBACK_COLORS = [
  colors.primary[500],
  colors.success[500],
  colors.warning[500],
  colors.purple[500],
  colors.info[500],
  colors.error[500],
];

const colorFor = (fw: string, idx: number): string =>
  FRAMEWORK_COLORS[fw] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  trend,
  loading = false,
  height = 340,
}) => {
  const { dates, series } = useMemo(() => {
    const perFramework = trend?.perFramework ?? {};
    const fwNames = Object.keys(perFramework).sort();
    const overall = trend?.overall ?? [];
    const fw = (name: string) => perFramework[name] ?? [];
    const allDates = (() => {
      const set = new Set<string>();
      overall.forEach((p) => set.add(p.date));
      fwNames.forEach((n) => fw(n).forEach((p) => set.add(p.date)));
      return Array.from(set).sort();
    })();

    const byDate = (points: typeof overall) => {
      const map = new Map<string, number>();
      points.forEach((p) => map.set(p.date, p.score));
      return allDates.map((d) => {
        const v = map.get(d);
        return v === undefined ? null : Math.round(v * 10) / 10;
      });
    };

    return {
      dates: allDates,
      series: [
        {
          name: 'Overall',
          data: byDate(overall),
          color: colors.neutral[700],
          bold: true,
        },
        ...fwNames.map((name, i) => ({
          name,
          data: byDate(fw(name)),
          color: colorFor(name, i),
          bold: false,
        })),
      ],
    };
  }, [trend]);

  if (!trend || dates.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无趋势数据"
        style={{ padding: '40px 0' }}
      />
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (v: unknown) => {
        const n = typeof v === 'number' ? v : null;
        return n === null ? '-' : `${n.toFixed(1)}`;
      },
    },
    legend: {
      data: series.map((s) => s.name),
      bottom: 0,
      textStyle: { color: colors.neutral[600] },
      type: 'scroll' as const,
    },
    grid: { left: '3%', right: '4%', top: 30, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: dates,
      axisLabel: {
        color: colors.neutral[600],
        hideOverlap: true,
        rotate: dates.length > 20 ? 30 : 0,
      },
      axisLine: { lineStyle: { color: colors.neutral[300] } },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      name: 'Score',
      nameTextStyle: { color: colors.neutral[500] },
      axisLabel: { color: colors.neutral[600] },
      splitLine: { lineStyle: { color: colors.neutral[100], type: 'dashed' as const } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: true,
      showSymbol: dates.length <= 32,
      symbol: 'circle' as const,
      symbolSize: 6,
      connectNulls: true,
      itemStyle: { color: s.color },
      lineStyle: {
        color: s.color,
        width: s.bold ? 3 : 1.5,
      },
      emphasis: { focus: 'series' as const },
      areaStyle: s.bold
        ? { color: colors.primary[100], opacity: 0.15 }
        : undefined,
      // Threshold lines (90 = compliant, 70 = partial) are nested on the
      // first series only — ECharts attaches markLine to a series, not to
      // the option root.
      markLine: i === 0
        ? {
            symbol: 'none' as const,
            silent: true,
            data: [
              {
                yAxis: 90,
                lineStyle: { color: colors.success[400], type: 'dashed' as const, width: 1 },
                label: {
                  formatter: 'Compliant ≥90',
                  color: colors.success[600],
                  position: 'end' as const,
                },
              },
              {
                yAxis: 70,
                lineStyle: { color: colors.warning[400], type: 'dashed' as const, width: 1 },
                label: {
                  formatter: 'Partial ≥70',
                  color: colors.warning[600],
                  position: 'end' as const,
                },
              },
            ],
          }
        : undefined,
    })),
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge
      showLoading={loading}
    />
  );
};
