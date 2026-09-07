/**
 * TemplateMarket Filters Card
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Card, Input, Select, Space, Row, Col, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Option } = Select;
const { Text } = Typography;

interface TemplateFiltersCardProps {
  categories: string[];
  searchText: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  total: number;
}

export const TemplateFiltersCard: React.FC<TemplateFiltersCardProps> = ({
  categories,
  searchText,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  total,
}) => (
  <Card size="small" style={{ marginBottom: spacing.md }} >
    <Row gutter={12} align="middle">
      <Col flex="auto">
        <Space size="middle" wrap>
          <Input
            placeholder="搜索模板名称、描述、标签..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="选择分类"
            value={categoryFilter || undefined}
            onChange={(val) => onCategoryChange(val || '')}
            style={{ width: 150 }}
            allowClear
          >
            {categories.map((cat) => (
              <Option key={cat} value={cat}>
                {cat}
              </Option>
            ))}
          </Select>
          <Text type="secondary">共 {total} 个模板</Text>
        </Space>
      </Col>
    </Row>
  </Card>
);
