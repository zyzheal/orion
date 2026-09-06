/**
 * TraceHeader.tsx - Trace 页头（标题 + 3 张基本信息卡 + Trace ID 行）
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React from 'react';
import { Typography, Space, Card, Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { spacing, shadows } from '@/tokens';
import { colors } from '@/tokens/colors';
import type { TraceDetail } from '@/api/trace';
import { formatDuration, statusColor, statusLabel } from './TraceDetailConfig';

const { Title, Text } = Typography;

export interface TraceHeaderProps {
  detail: TraceDetail;
  rootStatusCode: string;
}

export const TraceHeader: React.FC<TraceHeaderProps> = ({ detail, rootStatusCode }) => (
  <div style={{ marginBottom: spacing.lg }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <EyeOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          Trace 详情
        </Title>
        <Text type="secondary">分布式追踪 Waterfall 视图</Text>
      </div>

      <Space>
        <Card size="small" style={{ minWidth: 140, boxShadow: shadows.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              总时长
            </Text>
            <Text strong>{formatDuration(detail.totalDurationNs)}</Text>
          </div>
        </Card>
        <Card size="small" style={{ minWidth: 100, boxShadow: shadows.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Span 数
            </Text>
            <Text strong>{detail.spanCount}</Text>
          </div>
        </Card>
        <Card size="small" style={{ minWidth: 140, boxShadow: shadows.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              状态
            </Text>
            <Tag color={statusColor(rootStatusCode)}>
              {statusLabel(rootStatusCode)}
            </Tag>
          </div>
        </Card>
      </Space>
    </div>

    <div style={{ marginTop: spacing.sm }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Trace ID:{' '}
      </Text>
      <Text code>{detail.traceId}</Text>
      <Text type="secondary" style={{ fontSize: 12, marginLeft: spacing.md }}>
        Root:{' '}
      </Text>
      <Text strong>{detail.rootSpanName}</Text>
      <Text type="secondary" style={{ fontSize: 12, marginLeft: spacing.md }}>
        Service:{' '}
      </Text>
      <Text>{detail.rootService}</Text>
    </div>
  </div>
);
