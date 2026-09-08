/**
 * PermissionAudit RiskUsersTable
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Card, Space, Table, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { UEBARiskUser } from '@/api/permission-audit';

interface RiskUsersTableProps {
  riskUsers: UEBARiskUser[];
  columns: Parameters<typeof Table>[0]['columns'];
}

export const RiskUsersTable = ({ riskUsers, columns }: RiskUsersTableProps) => {
  if (riskUsers.length === 0) return null;
  return (
    <Card
      title={
        <Space>
          <UserOutlined style={{ color: colors.purple[500] }} />
          高风险用户列表 (UEBA)
        </Space>
      }
      extra={<Tag color="purple">{riskUsers.length} 位高风险用户</Tag>}
      style={{ marginBottom: spacing.md }}
    >
      <Table dataSource={riskUsers} columns={columns} rowKey="userId" pagination={false} size="small" />
    </Card>
  );
};
