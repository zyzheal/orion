import { Input, Select } from 'antd';
import { spacing } from '@/tokens';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: any) => void;
}

export function FilterBar({ searchQuery, setSearchQuery, statusFilter, setStatusFilter }: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
      <Input.Search
        placeholder="搜索审批标题、描述或申请人..."
        allowClear
        style={{ width: 320 }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onSearch={setSearchQuery}
      />
      <Select
        style={{ width: 140 }}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v)}
        options={[
          { label: '全部状态', value: 'all' },
          { label: '待审批', value: 'pending' },
          { label: '已通过', value: 'approved' },
          { label: '已拒绝', value: 'rejected' },
          { label: '已取消', value: 'cancelled' },
        ]}
      />
    </div>
  );
}
