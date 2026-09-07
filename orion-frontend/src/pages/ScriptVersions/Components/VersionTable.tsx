/**
 * ScriptVersions VersionTable
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { Button, Empty, Table } from 'antd';
import { type ColumnType, type ColumnGroupType } from 'antd/es/table';
import type { ScriptVersion } from '@/api/script-versions';

interface VersionTableProps {
  columns: (ColumnGroupType<ScriptVersion> | ColumnType<ScriptVersion>)[];
  versions: ScriptVersion[];
  loading: boolean;
  onCreate: () => void;
}

export const VersionTable = ({ columns, versions, loading, onCreate }: VersionTableProps) => {
  if (versions.length === 0 && !loading) {
    return (
      <Empty description="暂无版本，点击「创建版本」开始">
        <Button type="primary" onClick={onCreate}>
          创建版本
        </Button>
      </Empty>
    );
  }
  return (
    <Table
      columns={columns}
      dataSource={versions}
      loading={loading}
      rowKey="id"
      size="middle"
      pagination={{ pageSize: 20 }}
    />
  );
};
