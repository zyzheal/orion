/**
 * ServerlessPage table column definitions.
 *
 * Extracted from ServerlessPage.tsx for reusability.
 *
 * Only self-contained column definitions are extracted here.
 * Columns that reference component state or handlers (e.g., handleViewDetail,
 * handleDelete, setCurrentFn) remain inline in their respective tab components.
 */
import React from 'react';
import { Tag, Tooltip, Space, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ServerlessLog } from '@/api/serverless';
import { AutoScalingRecommendation } from '@/api/serverless';
import { logLevelColorMap, scaleActionColorMap, scaleActionLabelMap } from './ServerlessConfig';
import { colors } from '@/tokens/colors';

// ============================================================================
// Functions Tab — Logs Drawer columns (self-contained, no handler references)
// ============================================================================

export const logsColumns: ColumnsType<ServerlessLog> = [
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 80,
    render: (l: string) => <Tag color={logLevelColorMap[l]}>{l}</Tag>,
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    key: 'duration',
    width: 80,
    render: (v: number) => (v ? `${v}ms` : '-'),
  },
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 180,
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

// ============================================================================
// Metrics Tab — Auto-scaling recommendations columns (self-contained)
// ============================================================================

export const autoscalingColumns: ColumnsType<AutoScalingRecommendation> = [
  {
    title: '函数',
    dataIndex: 'functionName',
    key: 'functionName',
  },
  {
    title: '当前副本',
    dataIndex: 'currentReplicas',
    key: 'currentReplicas',
  },
  {
    title: '建议副本',
    dataIndex: 'suggestedReplicas',
    key: 'suggestedReplicas',
    render: (v: number, r: AutoScalingRecommendation) => (
      <span
        style={{
          color:
            r.action === 'scale_up'
              ? colors.error[500]
              : r.action === 'scale_down'
                ? colors.warning[500]
                : colors.neutral[900],
        }}
      >
        {r.currentReplicas} -> {v}
      </span>
    ),
  },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    render: (a: string) => (
      <Tag color={scaleActionColorMap[a]}>{scaleActionLabelMap[a]}</Tag>
    ),
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    ellipsis: true,
    render: (v: string) => v || '-',
  },
];

// ============================================================================
// Common empty state components (self-contained)
// ============================================================================

export const functionsEmpty: React.FC<{ onCreateClick: () => void }> = ({ onCreateClick }) => (
  <Empty description="暂无函数" image={Empty.PRESENTED_IMAGE_SIMPLE}>
    <a onClick={onCreateClick}>创建第一个函数</a>
  </Empty>
);

export const triggersEmpty: React.FC<{ onCreateClick: () => void }> = ({ onCreateClick }) => (
  <Empty description="暂无触发器" image={Empty.PRESENTED_IMAGE_SIMPLE}>
    <a onClick={onCreateClick}>创建第一个触发器</a>
  </Empty>
);
