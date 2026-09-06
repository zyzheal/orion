/**
 * FinOps 优化建议 Tab
 *
 * 展示系统自动识别的成本优化机会，支持批准/拒绝/删除操作。
 */
import React from 'react';
import { Button, Empty, Table, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { OptimizationRecommendation } from '@/types/finops';
import { spacing } from '@/tokens';
import { buildRecommendationsColumns } from './columns';

const { Text } = Typography;

export interface RecommendationsTabProps {
  recommendations: OptimizationRecommendation[];
  loading: boolean;
  updatingRecommendation: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export const RecommendationsTab: React.FC<RecommendationsTabProps> = ({
  recommendations,
  loading,
  updatingRecommendation,
  onApprove,
  onReject,
  onDelete,
  onRefresh,
}) => (
  <div>
    <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
      <Text type="secondary">系统自动识别的成本优化机会</Text>
      <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
        刷新建议
      </Button>
    </div>

    <Table<OptimizationRecommendation>
      columns={buildRecommendationsColumns({
        onApprove,
        onReject,
        onDelete,
        updatingRecommendation,
      })}
      dataSource={recommendations}
      rowKey="id"
      loading={loading}
      locale={{
        emptyText: (
          <Empty description="暂无优化建议" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={onRefresh}>
              <ReloadOutlined /> 刷新优化建议
            </Button>
          </Empty>
        ),
      }}
    />
  </div>
);
