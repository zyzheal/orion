/**
 * BudgetManagement - 预算管理卡片
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Button, Card, Empty, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined, PlusOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { summaryCardStyle } from './SummaryCards';

const { Text } = Typography;

import type { FinopsBudget } from '@/api/cost-allocation';

interface Props {
  budgets: FinopsBudget[];
  columns: ColumnsType<FinopsBudget>;
  loading: boolean;
  onCreate: () => void;
}

export const BudgetManagement = ({ budgets, columns, loading, onCreate }: Props) => (
  <Card
    title={
      <Space>
        <DollarOutlined style={{ color: colors.primary[500] }} />
        <Text strong>预算管理</Text>
      </Space>
    }
    extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        创建预算
      </Button>
    }
    style={summaryCardStyle}
  >
    {budgets.length === 0 ? (
      <Empty description="暂无预算">
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          创建第一个预算
        </Button>
      </Empty>
    ) : (
      <Table
        columns={columns}
        dataSource={budgets}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    )}
  </Card>
);
