/**
 * ComplianceScan BaselineTable
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Card, Table, Button, Space, Empty } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ComplianceBaseline } from '../types';
import { spacing } from '@/tokens';

interface BaselineTableProps {
  baselines: ComplianceBaseline[];
  columns: ColumnsType<ComplianceBaseline>;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const BaselineTable = ({ baselines, columns, loading, onRefresh, onCreate }: BaselineTableProps) => (
  <Card
    title="合规基线"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建基线
        </Button>
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    <Table
      dataSource={baselines}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="暂无合规基线，请创建 OWASP/CIS/PCI/SOC2 基线" /> }}
    />
  </Card>
);
