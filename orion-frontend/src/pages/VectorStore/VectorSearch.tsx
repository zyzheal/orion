/**
 * VectorSearch - Similarity search panel
 */
import React from 'react';
import type { ReactNode } from 'react';
import { Card, Form, Input, Select, Button, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { VectorCollection, SearchHit } from '@/api/vector-store';
import { spacing } from '@/tokens';

const { Text, Paragraph } = Typography;

interface VectorSearchProps {
  collections: VectorCollection[];
  searchText: string;
  searchCollection: string | undefined;
  searchTopK: number;
  searchLoading: boolean;
  searchResults: SearchHit[];
  onSearchTextChange: (value: string) => void;
  onCollectionChange: (value: string | undefined) => void;
  onTopKChange: (value: number) => void;
  onSearch: () => void;
}

const VectorSearch: React.FC<VectorSearchProps> = ({
  collections,
  searchText,
  searchCollection,
  searchTopK,
  searchLoading,
  searchResults,
  onSearchTextChange,
  onCollectionChange,
  onTopKChange,
  onSearch,
}) => {
  return (
    <Card title="相似度检索">
      <Form layout="vertical" onFinish={onSearch}>
        <Form.Item label="搜索内容">
          <Input.TextArea
            rows={3}
            placeholder="输入搜索文本进行语义匹配..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
          />
        </Form.Item>
        <Form.Item label="目标集合 (可选)">
          <Select
            placeholder="选择集合"
            allowClear
            value={searchCollection}
            onChange={onCollectionChange}
            options={collections
              .filter((c) => c.status === 'active')
              .map((c) => ({ label: c.displayName, value: c.name }))}
          />
        </Form.Item>
        <Form.Item label="返回数量 (Top K)">
          <Select
            value={searchTopK}
            onChange={onTopKChange}
            options={[
              { label: 'Top 3', value: 3 },
              { label: 'Top 5', value: 5 },
              { label: 'Top 10', value: 10 },
              { label: 'Top 20', value: 20 },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={onSearch}
            loading={searchLoading}
            block
          >
            语义搜索
          </Button>
        </Form.Item>
      </Form>

      {searchResults.length > 0 && (
        <div style={{ marginTop: spacing[3] }}>
          <Text strong style={{ marginBottom: spacing.sm, display: 'block' }}>
            搜索结果 ({searchResults.length} 条)
          </Text>
          {searchResults.map((hit, idx) => (
            <Card size="small" key={hit.id} style={{ marginBottom: spacing.sm }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <Tag color={idx === 0 ? 'green' : idx === 1 ? 'blue' : 'default'}>
                  相似度 {(hit.score * 100).toFixed(1)}%
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {hit.collection}
                  {hit.metadata?.source && ` | ${hit.metadata.source as string}`}
                </Text>
              </div>
              <Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0, fontSize: 12 }}>
                {hit.content}
              </Paragraph>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default VectorSearch;
