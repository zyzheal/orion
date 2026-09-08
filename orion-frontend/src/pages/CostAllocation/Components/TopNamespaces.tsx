/**
 * TopNamespaces - Top 10 高费用命名空间卡片
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Card, Col, Empty, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClusterOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { summaryCardStyle } from './SummaryCards';

const { Text } = Typography;

interface Props {
  topNamespaces: { namespace: string; cost: number }[];
  columns: ColumnsType<{ namespace: string; cost: number }>;
  loading: boolean;
}

export const TopNamespaces = ({ topNamespaces, columns, loading }: Props) => (
  <Col xs={24} lg={12}>
    <Card
      title={
        <Space>
          <ClusterOutlined style={{ color: colors.primary[500] }} />
          <Text strong>Top 10 高费用命名空间</Text>
        </Space>
      }
      style={summaryCardStyle}
    >
      {topNamespaces.length === 0 ? (
        <Empty description="暂无数据" />
      ) : (
        <Table
          columns={columns}
          dataSource={topNamespaces}
          rowKey="namespace"
          size="small"
          pagination={false}
          loading={loading}
        />
      )}
    </Card>
  </Col>
);
