/**
 * TopologyOverviewCard.tsx - 拓扑总览卡
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import React from 'react';
import { Card, Empty, Select, Space, Spin, Tag, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import type { TopologyGraph } from '@/api/service-topology';

const { Text } = Typography;

interface Props {
  topology: TopologyGraph | null;
  loading: boolean;
  nodeOptions: Array<{ label: string; value: string }>;
  onServiceChange: (value: string) => void;
}

export const TopologyOverviewCard: React.FC<Props> = ({
  topology,
  loading,
  nodeOptions,
  onServiceChange,
}) => (
  <Card
    title={
      <Space>
        <Text strong>拓扑总览</Text>
        {topology && (
          <Space size="small">
            <Tag color={colors.primary[500]}>{topology.nodes.length} 个服务</Tag>
            <Tag color={colors.info[500]}>{topology.edges.length} 条依赖</Tag>
          </Space>
        )}
      </Space>
    }
    style={{ marginBottom: spacing.lg }}
    styles={{ body: { padding: spacing.md } }}
  >
    <Spin spinning={loading && !topology}>
      {!topology && !loading ? (
        <Empty description="暂无拓扑数据" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
          <Text type="secondary">
            当前注册服务共 <Text strong>{topology?.nodes.length ?? 0}</Text> 个， 依赖关系共{' '}
            <Text strong>{topology?.edges.length ?? 0}</Text> 条。
          </Text>

          {/* Service selector */}
          <div>
            <Text
              style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 500 }}
            >
              选择服务查看子拓扑
            </Text>
            <Select
              style={{ width: 320 }}
              placeholder="请选择要查看的服务"
              allowClear
              onChange={onServiceChange}
              options={nodeOptions}
              showSearch
              optionFilterProp="label"
            />
          </div>
        </Space>
      )}
    </Spin>
  </Card>
);
