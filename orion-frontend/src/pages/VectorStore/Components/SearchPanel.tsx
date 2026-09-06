/**
 * SearchPanel.tsx - 相似度检索面板
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import React from 'react';
import { Card, Form, Input, Select, Button, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { VectorCollection, SearchHit } from '@/api/vector-store';
import { TOP_K_OPTIONS } from '../constants';

const { Text } = Typography;

interface SearchPanelProps {
  collections: VectorCollection[];
  searchText: string;
  setSearchText: (v: string) => void;
  searchCollection: string | undefined;
  setSearchCollection: (v: string | undefined) => void;
  searchTopK: number;
  setSearchTopK: (v: number) => void;
  searchLoading: boolean;
  searchResults: SearchHit[];
  onSearch: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  collections,
  searchText,
  setSearchText,
  searchCollection,
  setSearchCollection,
  searchTopK,
  setSearchTopK,
  searchLoading,
  searchResults,
  onSearch,
}) => (
  <Card title="相似度检索" style={{ marginBottom: spacing.md }}>
    <Form layout="vertical" onFinish={onSearch}>
      <Form.Item label="搜索内容">
        <Input.TextArea
          rows={3}
          placeholder="输入搜索文本进行语义匹配..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </Form.Item>
      <Form.Item label="目标集合 (可选)">
        <Select
          placeholder="选择集合"
          allowClear
          value={searchCollection}
          onChange={setSearchCollection}
          options={collections
            .filter((c) => c.status === 'active')
            .map((c) => ({ label: c.displayName, value: c.name }))}
        />
      </Form.Item>
      <Form.Item label="返回数量 (Top K)">
        <Select value={searchTopK} onChange={setSearchTopK} options={TOP_K_OPTIONS} />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          htmlType="submit"
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
                {(() => {
                  const s = hit.metadata?.source;
                  return s ? ` | ${String(s)}` : null;
                })()}
              </Text>
            </div>
            <Text ellipsis style={{ fontSize: 12, display: 'block' }}>
              {hit.content}
            </Text>
          </Card>
        ))}
      </div>
    )}
  </Card>
);
