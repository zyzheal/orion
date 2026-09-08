import { Card, Table, Select, Space, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { EscalationStatus } from '../types';

const { Text } = Typography;
const { Option } = Select;

interface Props {
  statusFilter: EscalationStatus | 'all';
  onStatusFilterChange: (v: EscalationStatus | 'all') => void;
  filteredData: any[];
  columns: any[];
}

export function ApprovalTableCard({ statusFilter, onStatusFilterChange, filteredData, columns }: Props) {
  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: colors.error[500] }} />
          <Text strong>超时审批列表</Text>
        </Space>
      }
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <div>
          <Text type="secondary" style={{ marginRight: 8 }}>
            状态筛选：
          </Text>
          <Select
            value={statusFilter}
            onChange={onStatusFilterChange}
            style={{ width: 180 }}
            size="small"
          >
            <Option value="all">全部</Option>
            <Option value="warning">即将超时</Option>
            <Option value="timeout">已超时</Option>
            <Option value="escalated">已升级</Option>
            <Option value="normal">正常</Option>
          </Select>
        </div>
        <Text type="secondary">共 {filteredData.length} 条记录</Text>
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        size="middle"
        rowClassName={() => 'ant-table-row-hoverable'}
        pagination={{ pageSize: 8, showSizeChanger: false }}
      />
    </Card>
  );
}
