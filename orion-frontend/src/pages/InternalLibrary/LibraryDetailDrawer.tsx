/**
 * LibraryDetailDrawer.tsx - 二方库详情抽屉
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import React from 'react';
import { Drawer, Descriptions, Typography, Tag, Tabs } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { InternalLibrary } from '@/api/internal-library';

const { Text } = Typography;

const languageLabels: Record<string, string> = {
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
};

const statusColors: Record<string, string> = {
  active: 'green',
  deprecated: 'orange',
  archived: 'default',
  development: 'blue',
};

interface LibraryDetailDrawerProps {
  visible: boolean;
  selectedLib: InternalLibrary | null;
  onClose: () => void;
  detailActiveKey: string;
  detailTabChange: (key: string) => void;
  detailTabItems: unknown;
}

export const LibraryDetailDrawer: React.FC<LibraryDetailDrawerProps> = ({
  visible,
  selectedLib,
  onClose,
  detailActiveKey,
  detailTabChange,
  detailTabItems,
}) => {
  return (
    <Drawer
      title={selectedLib ? `${selectedLib.displayName || selectedLib.name}` : '详情'}
      open={visible}
      onClose={onClose}
      width={900}
      destroyOnClose
    >
      {selectedLib && (
        <Descriptions size="small" style={{ marginBottom: spacing.md }} column={3} bordered>
          <Descriptions.Item label="名称">
            <Text code>{selectedLib.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="语言">
            <Tag color="cyan">{languageLabels[selectedLib.language] || selectedLib.language}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[selectedLib.status] || 'default'}>
              {selectedLib.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前版本">
            <Text code>{selectedLib.currentVersion}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="团队">
            <TeamOutlined /> {selectedLib.owner}
          </Descriptions.Item>
          <Descriptions.Item label="依赖项目">
            {selectedLib.dependents?.totalRepos ?? 0}
          </Descriptions.Item>
        </Descriptions>
      )}
      <Tabs
        activeKey={detailActiveKey}
        onChange={detailTabChange}
        items={detailTabItems as import('antd').TabsProps['items']}
      />
    </Drawer>
  );
};
