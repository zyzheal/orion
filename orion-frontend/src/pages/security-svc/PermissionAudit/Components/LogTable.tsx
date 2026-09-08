/**
 * PermissionAudit LogTable
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Button, Card, FilterOutlined, Select, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { AuditLogEntry } from '@/api/permission-audit';

const { Option } = Select;

interface LogTableProps {
  logs: AuditLogEntry[];
  loading: boolean;
  columns: Parameters<typeof Table>[0]['columns'];
  limit: number;
  onLimitChange: (v: number) => void;
  onRefresh: () => void;
}

export const LogTable = ({ logs, loading, columns, limit, onLimitChange, onRefresh }: LogTableProps) => (
  <Card
    title="权限拒绝日志"
    extra={
      <Space>
        <FilterOutlined />
        <span>显示:</span>
        <Select value={limit} onChange={onLimitChange} style={{ width: 100 }}>
          <Option value={50}>50条</Option>
          <Option value={100}>100条</Option>
          <Option value={200}>200条</Option>
          <Option value={500}>500条</Option>
        </Select>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
    }
  >
    <Table
      dataSource={logs}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1200 }}
      size="small"
    />
  </Card>
);
