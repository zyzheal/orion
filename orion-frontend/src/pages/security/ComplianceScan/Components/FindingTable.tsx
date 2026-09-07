/**
 * ComplianceScan FindingTable
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Card, Table, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ComplianceFinding } from '../types';

interface FindingTableProps {
  findings: ComplianceFinding[];
  columns: ColumnsType<ComplianceFinding>;
  loading: boolean;
}

export const FindingTable = ({ findings, columns, loading }: FindingTableProps) => (
  <Card title="违规发现列表">
    <Table
      dataSource={findings}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={{ pageSize: 8, showSizeChanger: false }}
      locale={{ emptyText: <Empty description="暂无违规发现，请先执行安全基线扫描" /> }}
    />
  </Card>
);
