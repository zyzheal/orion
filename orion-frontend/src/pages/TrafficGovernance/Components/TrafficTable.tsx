/**
 * Traffic Governance table
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { Button, Card, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { componentRadius, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import type { TrafficRule } from '../types';

interface TrafficTableProps {
  columns: ColumnsType<TrafficRule>;
  dataSource: TrafficRule[];
  loading: boolean;
  onCreate: () => void;
}

export const TrafficTable = ({ columns, dataSource, loading, onCreate }: TrafficTableProps) => (
  <Card
    style={{
      borderRadius: componentRadius.card,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <div style={{ marginBottom: spacing.md }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        创建流量规则
      </Button>
    </div>

    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  </Card>
);
