/**
 * SbomDashboard SbomTableCard (SBOM 文档列表)
 * 抽取自 index.tsx (P2-9 Phase 170)
 */
import { Card } from 'antd';
import { spacing } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import Table from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import type { SbomDocument } from '@/api/sbom';

interface SbomTableCardProps {
  columns: TableColumn<SbomDocument>[];
  dataSource: SbomDocument[];
  loading: boolean;
  onSearch: (v: string) => void;
  onFilter: (v: Record<string, string | string[] | undefined>) => void;
  filterDefs: FilterDefinition[];
}

export const SbomTableCard = ({
  columns,
  dataSource,
  loading,
  onSearch,
  onFilter,
  filterDefs,
}: SbomTableCardProps) => (
  <Card title="SBOM 文档列表" style={{ marginBottom: spacing.lg }}>
    <div style={{ marginBottom: spacing.md }}>
      <SearchFilterBar
        onSearch={onSearch}
        onFilter={onFilter}
        filters={filterDefs}
        searchPlaceholder="搜索文档 ID、构建 ID..."
      />
    </div>
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
