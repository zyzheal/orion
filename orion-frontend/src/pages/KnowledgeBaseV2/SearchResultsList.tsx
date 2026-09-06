/**
 * SearchResultsList - 搜索结果卡片 (跨空间导航)
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React from 'react';
import { Card, Space, Typography, Tag } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, themeVars } from '@/tokens';
import type { SearchHit } from './useKnowledgeBaseState';

const { Text, Paragraph } = Typography;

export interface SearchResultsListProps {
  searchResults: SearchHit[];
  selectedSpaceId: string;
  onNavigateDoc: (item: SearchHit) => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  searchResults, selectedSpaceId, onNavigateDoc,
}) => {
  if (searchResults.length === 0) return null;

  return (
    <Card
      size="small"
      title={<Space><SearchOutlined /> 搜索结果 ({searchResults.length} 条)</Space>}
    >
      {searchResults.map((item) => (
        <div
          key={item.id}
          style={{
            padding: '8px 0',
            borderBottom: `1px solid ${themeVars.borderLight}`,
            cursor: 'pointer',
          }}
          onClick={() => onNavigateDoc(item)}
        >
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            <Text strong>{item.title}</Text>
            <Tag color="orange">相关度: {(item.score * 100).toFixed(1)}%</Tag>
          </Space>
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ marginTop: 4, marginLeft: 24, fontSize: 12, color: '#8c8c8c' }}
          >
            {item.content.replace(/<[^>]*>/g, '')}
          </Paragraph>
        </div>
      ))}
    </Card>
  );
};
