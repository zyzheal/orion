import { Card } from 'antd';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import { ExpandedRow } from '../ExpandedRow';
import { filterDefs } from '../constants';
import type { BackupPlanItem } from '../types';
import type { useBackupState } from '../useBackupState';

type State = ReturnType<typeof useBackupState>;

interface Props {
  state: State;
  columns: any;
}

export function PlanTable({ state: s, columns }: Props) {
  return (
    <Card>
      <div style={{ marginBottom: spacing[4] }}>
        <SearchFilterBar
          onSearch={s.setSearchQuery}
          onFilter={s.setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索计划名称..."
        />
      </div>
      <Table
        columns={columns}
        dataSource={s.filteredData}
        loading={s.loading}
        rowKey="id"
        size="middle"
        striped
        expandable={{
          expandedRowKeys: Object.keys(s.expandedRecords).filter((k) => s.expandedRecords[k as string]),
          expandedRowRender: (record: BackupPlanItem) => (
            <ExpandedRow
              records={s.expandedRecords[record.id] || []}
              openRestore={s.openRestore}
              handleDeleteRecord={s.handleDeleteRecord}
              planId={record.id}
            />
          ),
          expandRowByClick: true,
        }}
      />
    </Card>
  );
}
