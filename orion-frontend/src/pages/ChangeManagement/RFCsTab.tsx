/**
 * RFC Tab — create button + RFC table
 *
 * Extracted from index.tsx tabItems array.
 */
import { Button, Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing, radius, shadows } from '@/tokens';
import Table from '@/components/Table';
import type { RFC } from '@/api/change';

interface RFCsTabProps {
  rfcs: RFC[];
  rfcLoading: boolean;
  rfcTotal: number;
  rfcPage: number;
  pageSize: number;
  rfcColumns: any[];
  onCreate: () => void;
  onPageChange: (p: number) => void;
}

export function RFCsTab({
  rfcs,
  rfcLoading,
  rfcTotal,
  rfcPage,
  pageSize,
  rfcColumns,
  onCreate,
  onPageChange,
}: RFCsTabProps) {
  return (
    <>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建 RFC
        </Button>
      </div>
      <Card
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        <Table<RFC>
          columns={rfcColumns}
          dataSource={rfcs}
          loading={rfcLoading}
          rowKey="id"
          pagination={{
            current: rfcPage,
            pageSize,
            total: rfcTotal,
          }}
          onPaginationChange={onPageChange}
        />
      </Card>
    </>
  );
}
