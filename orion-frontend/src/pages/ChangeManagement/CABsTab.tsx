/**
 * CAB Tab — create button + CAB meeting table
 *
 * Extracted from index.tsx tabItems array.
 */
import { Button, Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing, radius, shadows } from '@/tokens';
import Table from '@/components/Table';
import type { CABMeeting } from '@/api/change';

interface CABsTabProps {
  cabMeetings: CABMeeting[];
  cabLoading: boolean;
  cabTotal: number;
  cabPage: number;
  pageSize: number;
  cabColumns: any[];
  onCreate: () => void;
  onPageChange: (p: number) => void;
}

export function CABsTab({
  cabMeetings,
  cabLoading,
  cabTotal,
  cabPage,
  pageSize,
  cabColumns,
  onCreate,
  onPageChange,
}: CABsTabProps) {
  return (
    <>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建 CAB 会议
        </Button>
      </div>
      <Card
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        <Table<CABMeeting>
          columns={cabColumns}
          dataSource={cabMeetings}
          loading={cabLoading}
          rowKey="id"
          pagination={{
            current: cabPage,
            pageSize,
            total: cabTotal,
          }}
          onPaginationChange={onPageChange}
        />
      </Card>
    </>
  );
}
