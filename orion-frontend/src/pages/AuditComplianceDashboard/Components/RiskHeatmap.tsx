/**
 * RiskHeatmap (Phase 305)
 *
 * Renders the framework × severity risk matrix as an ECharts heatmap:
 *   y-axis : frameworks (SOC2, ISO27001, PCI-DSS, MLPS2, PDPA)
 *   x-axis : low | medium | high | critical
 *   color  : log-scaled severity intensity, so a single critical finding
 *            is still visible next to a framework with hundreds of low ones.
 *
 * Cell labels show the raw count; the footer shows each framework's total
 * findings and score as a quick triage cue.
 */
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Table } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { FrameworkRiskRow } from '@/api/audit-compliance';

type SeverityKey = 'low' | 'medium' | 'high' | 'critical';

export interface RiskHeatmapProps {
  frameworkRows: FrameworkRiskRow[];
  severityBuckets?: SeverityKey[];
  loading?: boolean;
  height?: number;
}

const DEFAULT_SEVERITIES: SeverityKey[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_LABEL: Record<SeverityKey, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** Small log-scale so critical=1 doesn't disappear behind a row of low=500. */
const heatColor = (count: number): number =>
  count <= 0 ? 0 : Math.round(Math.log10(count + 1) * 100) / 100;

/** Return the row as [frameworkIdx, severityIdx, rawCount]. */
const buildSeriesData = (rows: FrameworkRiskRow[]): Array<[number, number, number]> => {
  const data: Array<[number, number, number]> = [];
  rows.forEach((row, rIdx) => {
    DEFAULT_SEVERITIES.forEach((sev, cIdx) => {
      const v = row[sev] ?? 0;
      data.push([rIdx, cIdx, v]);
    });
  });
  return data;
};

const buildColumns = (): Array<import('antd/es/table').ColumnsType<FrameworkRiskRow>[number]> => [
  { title: 'Framework', dataIndex: 'framework', key: 'framework', width: 140,
    render: (v: string) => <strong>{v}</strong> },
  { title: 'Low', dataIndex: 'low', key: 'low', width: 70, align: 'right' as const },
  { title: 'Medium', dataIndex: 'medium', key: 'medium', width: 80, align: 'right' as const },
  { title: 'High', dataIndex: 'high', key: 'high', width: 70, align: 'right' as const },
  { title: 'Critical', dataIndex: 'critical', key: 'critical', width: 90, align: 'right' as const,
    render: (v: number) => (
      <span style={{ color: v > 0 ? colors.error[600] : colors.neutral[400], fontWeight: 600 }}>
        {v}
      </span>
    ),
  },
  { title: 'Total', dataIndex: 'totalFindings', key: 'totalFindings', width: 80, align: 'right' as const,
    render: (v: number) => <strong>{v}</strong> },
  { title: 'Score', dataIndex: 'score', key: 'score', width: 90, align: 'right' as const,
    render: (v: number) => (
      <span style={{ color: v >= 90 ? colors.success[600] : v >= 70 ? colors.warning[600] : colors.error[600] }}>
        {v.toFixed(1)}
      </span>
    ),
  },
];

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({
  frameworkRows,
  severityBuckets,
  loading = false,
  height = 320,
}) => {
  const severities = severityBuckets && severityBuckets.length > 0
    ? severityBuckets
    : DEFAULT_SEVERITIES;

  const seriesData = buildSeriesData(frameworkRows);
  const maxVal = Math.max(0, ...seriesData.map((d) => d[2]));

  const option = {
    tooltip: {
      position: 'top' as const,
      formatter: (params: unknown) => {
        const p = params as {
          data?: [number, number, number];
          value?: [number, number, number];
        };
        const raw = p.data ?? p.value;
        if (!raw) return '';
        const [rIdx, cIdx, count] = raw;
        const fw = frameworkRows[rIdx]?.framework ?? '?';
        const sev = severities[cIdx] ?? '?';
        return `${fw} · ${SEVERITY_LABEL[sev] ?? sev}: <b>${count}</b>`;
      },
    },
    grid: {
      left: 100,
      right: 30,
      top: 20,
      bottom: 60,
      containLabel: false,
    },
    xAxis: {
      type: 'category' as const,
      position: 'bottom' as const,
      data: severities.map((s) => SEVERITY_LABEL[s] ?? s),
      splitArea: { show: true },
      axisLabel: { color: colors.neutral[700] },
    },
    yAxis: {
      type: 'category' as const,
      data: frameworkRows.map((r) => r.framework),
      splitArea: { show: true },
      axisLabel: { color: colors.neutral[700], fontWeight: 600 },
    },
    visualMap: {
      min: 0,
      max: maxVal > 0 ? maxVal : 1,
      calculable: true,
      orient: 'horizontal' as const,
      left: 'center' as const,
      bottom: 6,
      itemWidth: 12,
      itemHeight: 140,
      text: ['High', 'Low'],
      inRange: {
        color: [
          colors.success[200],
          colors.warning[400],
          colors.error[400],
          colors.error[700],
        ],
      },
    },
    series: [
      {
        name: 'findings',
        type: 'heatmap' as const,
        data: seriesData.map(([rIdx, cIdx, v]) => [rIdx, cIdx, heatColor(v)]),
        label: {
          show: true,
          formatter: (params: unknown) => {
            const p = params as { data?: [number, number, number] };
            const raw = p.data;
            if (!raw) return '';
            const [rIdx, cIdx] = raw;
            const key = severities[cIdx];
            return frameworkRows[rIdx]?.[key] ?? 0;
          },
          color: '#fff',
          fontWeight: 600,
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
      <Table
        columns={buildColumns()}
        dataSource={frameworkRows.map((r, i) => ({ ...r, key: r.framework ?? `row-${i}` }))}
        pagination={false}
        size="small"
        loading={loading}
        footer={() => (
          <div style={{ textAlign: 'right', color: colors.neutral[500], fontSize: 12 }}>
            Total findings:{' '}
            <strong style={{ color: colors.neutral[700] }}>
              {frameworkRows.reduce((s, r) => s + (r.totalFindings ?? 0), 0)}
            </strong>
          </div>
        )}
      />
    </div>
  );
};
