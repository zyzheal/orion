/**
 * PermissionAudit StatsTable
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Button, Card, Select, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import type { AuditStats } from '@/api/permission-audit';

const { Option } = Select;

interface StatsTableProps {
  stats: AuditStats[];
  columns: ColumnsType<AuditStats>;
  hours: number;
  onHoursChange: (v: number) => void;
  onRefresh: () => void;
}

export const StatsTable = ({ stats, columns, hours, onHoursChange, onRefresh }: StatsTableProps) => (
  <Card
    title="拒绝原因统计 (按用户)"
    extra={
      <Space>
        <span>时段:</span>
        <Select value={hours} onChange={onHoursChange} style={{ width: 100 }}>
          <Option value={1}>1小时</Option>
          <Option value={6}>6小时</Option>
          <Option value={24}>24小时</Option>
          <Option value={72}>3天</Option>
          <Option value={168}>7天</Option>
        </Select>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    <Table dataSource={stats} columns={columns} rowKey="user_id" pagination={false} size="small" />
  </Card>
);
