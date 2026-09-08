/**
 * DependenciesCard.tsx - 依赖关系表卡
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import React, { useMemo } from 'react';
import { Card, Empty, Space, Spin, Table, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { TopologyEdge } from '@/api/service-topology';
import { buildDependencyColumns } from '../columns';

const { Text } = Typography;

interface Props {
  subGraphEdges: Array<TopologyEdge | { key: string; source: string; target: string; type: string }>;
  selectedServiceId: string | undefined;
  loading: boolean;
}

export const DependenciesCard: React.FC<Props> = ({ subGraphEdges, selectedServiceId, loading }) => {
  const columns = useMemo(() => buildDependencyColumns(), []);
  const tableLoading = loading && selectedServiceId !== undefined;

  return (
    <Card
      title={
        <Space>
          <Text strong>{selectedServiceId ? '服务依赖详情' : '依赖关系总览'}</Text>
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={tableLoading}>
        {subGraphEdges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <Empty description={selectedServiceId ? '该服务暂无依赖数据' : '暂无依赖数据'} />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={subGraphEdges}
            loading={tableLoading}
            rowKey="key"
            size="middle"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        )}
      </Spin>
    </Card>
  );
};
