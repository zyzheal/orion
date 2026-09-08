/**
 * SearchBar.tsx - 组件搜索栏
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { Card, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface Props {
  search: string;
  setSearch: (v: string) => void;
}

export function SearchBar({ search, setSearch }: Props) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Input.Search
        placeholder="搜索组件名称或拥有团队..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 400 }}
        enterButton={<SearchOutlined />}
        allowClear
      />
    </Card>
  );
}
