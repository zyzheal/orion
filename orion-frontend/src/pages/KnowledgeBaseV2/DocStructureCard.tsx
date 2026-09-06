/**
 * DocStructureCard - 文档结构树卡片 (Tree + Empty 空态)
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React from 'react';
import { Card, Space, Tree, Spin, Empty } from 'antd';
import { FolderOutlined, FolderOpenOutlined, FileTextOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { spacing } from '@/tokens';
import { buildDocTree, type DocTreeNode } from './tree';
import type { WikiDocument } from '@/api/pandawiki';

export interface DocStructureCardProps {
  documents: WikiDocument[];
  docsLoading: boolean;
  expandedKeys: React.Key[];
  onExpand: (keys: React.Key[]) => void;
  onOpenDoc: (doc: { id: string }) => void;
}

function treeNodeToDataNode(node: DocTreeNode): DataNode {
  const hasChildren = node.children && node.children.length > 0;
  return {
    key: node.id,
    title: node.title,
    icon: hasChildren ? <FolderOpenOutlined /> : <FileTextOutlined />,
    isLeaf: !hasChildren,
    ...(hasChildren ? { children: node.children!.map(treeNodeToDataNode) } : {}),
  };
}

export const DocStructureCard: React.FC<DocStructureCardProps> = ({
  documents, docsLoading, expandedKeys, onExpand, onOpenDoc,
}) => {
  const docTreeData: DataNode[] = React.useMemo(
    () => buildDocTree(documents).map(treeNodeToDataNode),
    [documents],
  );

  return (
    <Card
      size="small"
      style={{ marginBottom: spacing.md }}
      title={<Space><FolderOutlined /> 文档结构</Space>}
    >
      <Spin spinning={docsLoading}>
        {documents.length > 0 ? (
          <Tree
            treeData={docTreeData}
            expandedKeys={expandedKeys}
            onExpand={onExpand}
            onSelect={(_keys, { node, selected }) => {
              if (selected && node) {
                const doc = documents.find((d) => d.id === (node.key as string));
                if (doc) onOpenDoc(doc);
              }
            }}
            showLine
            blockNode
          />
        ) : (
          <Empty
            description="暂无文档，点击「新建文档」创建第一篇文章"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Spin>
    </Card>
  );
};
