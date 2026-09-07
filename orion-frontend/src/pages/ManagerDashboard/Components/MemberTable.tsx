/**
 * ManagerDashboard MemberTable
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Table, Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import { spacing } from '@/tokens';
import type { ManagerDashboardData } from '@/types/pages';
import { buildMemberColumns } from '../columns';

type MemberMetrics = ManagerDashboardData['memberMetrics'];

interface MemberTableProps {
  memberMetrics: MemberMetrics;
}

export const MemberTable = ({ memberMetrics }: MemberTableProps) => (
  <div style={{ marginBottom: spacing.lg }}>
    <CardPanel title="成员效能明细" extra={<Tag color="blue">{memberMetrics.length} 人</Tag>}>
      <Table
        dataSource={memberMetrics}
        columns={buildMemberColumns()}
        rowKey="engineerId"
        pagination={false}
        scroll={{ x: 900 }}
        size="middle"
      />
    </CardPanel>
  </div>
);
