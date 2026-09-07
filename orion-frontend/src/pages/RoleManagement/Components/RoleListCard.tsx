/**
 * Role Management list card (search + table)
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { Card, Input } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import { spacing } from '@/tokens';
import type { Role } from '@/api/roles';

interface RoleListCardProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  columns: TableColumn<Role>[];
  dataSource: Role[];
  loading: boolean;
}

export const RoleListCard = ({
  searchQuery,
  onSearchQueryChange,
  columns,
  dataSource,
  loading,
}: RoleListCardProps) => (
  <Card>
    <Input.Search
      placeholder="搜索角色名称或描述..."
      allowClear
      style={{ marginBottom: spacing.md, maxWidth: 400 }}
      value={searchQuery}
      onChange={(e) => onSearchQueryChange(e.target.value)}
    />
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  </Card>
);
