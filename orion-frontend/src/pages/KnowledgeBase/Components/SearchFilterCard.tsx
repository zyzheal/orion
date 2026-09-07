/**
 * KnowledgeBase SearchFilterCard
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import { Card, Col, Input, Row, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface SearchFilterCardProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSearch: () => void;
  selectedCategory: string | undefined;
  onCategoryChange: (v: string | undefined) => void;
  categories: string[];
}

export const SearchFilterCard = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  selectedCategory,
  onCategoryChange,
  categories,
}: SearchFilterCardProps) => (
  <Card style={{ marginBottom: spacing[4] }}>
    <Row gutter={spacing[4]}>
      <Col span={12}>
        <Input.Search
          placeholder="搜索知识库..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={onSearch}
          enterButton={<SearchOutlined />}
          allowClear
        />
      </Col>
      <Col span={6}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择分类"
          value={selectedCategory}
          onChange={(v) => {
            onCategoryChange(v);
            setSearchQuery('');
          }}
          allowClear
          options={categories.map((c) => ({ label: c, value: c }))}
        />
      </Col>
    </Row>
  </Card>
);
