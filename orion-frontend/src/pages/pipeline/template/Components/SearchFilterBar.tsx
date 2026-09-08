/**
 * SearchFilterBar.tsx - 搜索与分类筛选栏
 * 抽取自 index.tsx (P2-9 Phase 240)
 */
import { Card, Space, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface Props {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  onSearch: () => void;
}

const CATEGORIES = [
  { value: 'all', label: '全部分类' },
  { value: 'Language', label: '语言' },
  { value: 'Container', label: '容器' },
  { value: 'ML/AI', label: 'ML/AI' },
  { value: 'K8s', label: 'K8s' },
  { value: 'Security', label: '安全' },
];

export function SearchFilterBar({ search, setSearch, category, setCategory, onSearch }: Props) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Space size="middle">
        <Input.Search
          placeholder="搜索模板名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={onSearch}
          style={{ width: 300 }}
          enterButton={<SearchOutlined />}
        />
        <Select value={category} onChange={setCategory} style={{ width: 150 }}>
          {CATEGORIES.map((c) => (
            <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
          ))}
        </Select>
      </Space>
    </Card>
  );
}
