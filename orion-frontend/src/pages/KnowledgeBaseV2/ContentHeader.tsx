/**
 * ContentHeader - 顶部空间标题 + 搜索 + 操作按钮
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React from 'react';
import { Typography, Space, Input, Button, Tooltip, Tag } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { spacing, themeVars } from '@/tokens';

export interface ContentHeaderProps {
  spaceName: string;
  docCount: number;
  hasSpace: boolean;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onSearch: () => void;
  searching: boolean;
  onRefresh: () => void;
  onCreateDoc: () => void;
  onOpenSettings: () => void;
}

export const ContentHeader: React.FC<ContentHeaderProps> = (props) => {
  const {
    spaceName, docCount, hasSpace,
    searchQuery, onSearchQueryChange, onSearch, searching,
    onRefresh, onCreateDoc, onOpenSettings,
  } = props;

  return (
    <div
      style={{
        padding: `${spacing.md} ${spacing.lg}`,
        borderBottom: `1px solid ${themeVars.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Space>
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          {spaceName}
        </Typography.Title>
        {hasSpace && <Tag color="blue">{docCount} 篇文档</Tag>}
      </Space>

      <Space>
        <Input.Search
          placeholder="搜索文档..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onSearch={onSearch}
          enterButton={<SearchOutlined />}
          allowClear
          style={{ width: 280 }}
          loading={searching}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} disabled={!hasSpace} />
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateDoc} disabled={!hasSpace}>
          新建文档
        </Button>
        <Tooltip title="空间设置">
          <Button icon={<SettingOutlined />} onClick={onOpenSettings} disabled={!hasSpace} />
        </Tooltip>
      </Space>
    </div>
  );
};
