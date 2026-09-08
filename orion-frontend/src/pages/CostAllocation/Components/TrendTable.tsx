/**
 * TrendTable - 费用趋势表格卡片
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Card, Col, Empty, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BarChartOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { summaryCardStyle } from './SummaryCards';

const { Text } = Typography;

import type { CostTrend } from '@/api/cost-allocation';

interface Props {
  trend: CostTrend[];
  columns: ColumnsType<CostTrend>;
  loading: boolean;
}

export const TrendTable = ({ trend, columns, loading }: Props) => (
  <Col xs={24} lg={12}>
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: colors.primary[500] }} />
          <Text strong>费用趋势（近 6 个月）</Text>
        </Space>
      }
      style={summaryCardStyle}
    >
      {trend.length === 0 ? (
        <Empty description="暂无数据" />
      ) : (
        <Table
          columns={columns}
          dataSource={[...trend].reverse()}
          rowKey="month"
          size="small"
          pagination={false}
          loading={loading}
        />
      )}
    </Card>
  </Col>
);
