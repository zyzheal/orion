/**
 * DocTree — 文档分类树组件
 *
 * 左侧导航树，支持按文档类型筛选（design/spec/runbook/policy）
 * 使用 Ant Design Tree 组件渲染
 */
import React, { useEffect, useState } from 'react';
import { Tree, Spin, Badge } from 'antd';
import {
  FileTextOutlined,
  ToolOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import { getDocToc, type KnowledgeSpace } from '@/api/knowledge';

// ============================================================================
// Types
// ============================================================================

export type DocType = 'all' | 'design' | 'spec' | 'runbook' | 'policy';

export interface TreeNode {
  key: string;
  title: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  count?: number;
  type?: DocType;
}

interface DocTreeProps {
  selectedType: DocType;
  onTypeChange: (type: DocType) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
}

// ============================================================================
// 文档类型配置
// ============================================================================

const DOC_TYPE_CONFIG: Record<Exclude<DocType, 'all'>, { label: string; color: string; icon: React.ReactNode }> = {
  design: {
    label: '设计文档',
    color: colors.info[500],
    icon: <ToolOutlined />,
  },
  spec: {
    label: '规范文档',
    color: colors.purple[500],
    icon: <BookOutlined />,
  },
  runbook: {
    label: '操作手册',
    color: colors.success[500],
    icon: <SafetyCertificateOutlined />,
  },
  policy: {
    label: '策略文档',
    color: colors.warning[500],
    icon: <FileTextOutlined />,
  },
};

// ============================================================================
// Component
// ============================================================================

export default function DocTree({
  selectedType,
  onTypeChange,
  selectedTag,
  onTagChange,
}: DocTreeProps) {
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root', 'doc-types']);

  useEffect(() => {
    loadTreeData();
  }, []);

  const loadTreeData = async () => {
    setLoading(true);
    try {
      const tocData = await getDocToc();
      const nodes = buildTree(tocData);
      setTreeData(nodes);
    } catch (error) {
      console.error('[DocTree] Failed to load TOC:', error);
      // Fallback to static tree if API fails
      setTreeData(buildFallbackTree());
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (data: { spaces: KnowledgeSpace[]; tags: string[] }): TreeNode[] => {
    const nodes: TreeNode[] = [
      {
        key: 'root',
        title: '文档中心',
        icon: <UnorderedListOutlined />,
        children: [
          {
            key: 'doc-types',
            title: '按类型',
            icon: <FileTextOutlined />,
            children: (Object.keys(DOC_TYPE_CONFIG) as Exclude<DocType, 'all'>[]).map((type) => ({
              key: `type-${type}`,
              title: DOC_TYPE_CONFIG[type].label,
              icon: DOC_TYPE_CONFIG[type].icon,
              type,
            })),
          },
        ],
      },
    ];

    // Add tags if available
    if (data.tags && data.tags.length > 0) {
      const tagChildren = data.tags.map((tag) => ({
        key: `tag-${tag}`,
        title: tag,
        icon: <FileTextOutlined />,
      }));
      nodes[0].children!.push({
        key: 'tags',
        title: '按标签',
        icon: <BookOutlined />,
        children: tagChildren,
      });
    }

    // Add spaces if available
    if (data.spaces && data.spaces.length > 0) {
      const spaceChildren = data.spaces.map((space) => ({
        key: `space-${space.id}`,
        title: space.name,
        icon: <FileTextOutlined />,
        count: space.doc_count,
      }));
      nodes[0].children!.push({
        key: 'spaces',
        title: '按知识库',
        icon: <BookOutlined />,
        children: spaceChildren,
      });
    }

    return nodes;
  };

  const buildFallbackTree = (): TreeNode[] => [
    {
      key: 'root',
      title: '文档中心',
      icon: <UnorderedListOutlined />,
      children: [
        {
          key: 'doc-types',
          title: '按类型',
          icon: <FileTextOutlined />,
          children: (Object.keys(DOC_TYPE_CONFIG) as Exclude<DocType, 'all'>[]).map((type) => ({
            key: `type-${type}`,
            title: DOC_TYPE_CONFIG[type].label,
            icon: DOC_TYPE_CONFIG[type].icon,
            type,
          })),
        },
      ],
    },
  ];

  const handleSelect = (selectedKeys: React.Key[]) => {
    const key = String(selectedKeys[0] || '');

    // Type node
    if (key.startsWith('type-')) {
      const type = key.replace('type-', '') as DocType;
      onTypeChange(type);
      onTagChange(null);
      return;
    }

    // Tag node
    if (key.startsWith('tag-')) {
      const tag = key.replace('tag-', '');
      onTagChange(tag);
      onTypeChange('all');
      return;
    }

    // All
    if (key === 'root' || key === 'doc-types') {
      onTypeChange('all');
      onTagChange(null);
    }
  };

  // Custom title renderer with icon and badge
  const renderTitle = (node: TreeNode) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
      {node.icon && <span style={{ color: colors.neutral[500] }}>{node.icon}</span>}
      <span>{node.title}</span>
      {node.count !== undefined && node.count > 0 && (
        <Badge count={node.count} style={{ backgroundColor: colors.neutral[300], color: colors.neutral[700] }} />
      )}
    </span>
  );

  // Convert TreeNode to Ant Design Tree DataNode
  const convertToTreeData = (nodes: TreeNode[]): any[] =>
    nodes.map((node) => ({
      key: node.key,
      title: renderTitle(node),
      children: node.children ? convertToTreeData(node.children) : undefined,
    }));

  return (
    <div
      style={{
        padding: spacing[4],
        background: colors.light.bg.primary,
        borderRadius: radius[3],
        boxShadow: shadows.card,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <Spin spinning={loading}>
        <Tree
          treeData={convertToTreeData(treeData)}
          selectedKeys={
            selectedType !== 'all'
              ? [`type-${selectedType}`]
              : selectedTag
                ? [`tag-${selectedTag}`]
                : ['root']
          }
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          onSelect={handleSelect}
          showLine={false}
          blockNode
          style={{ background: 'transparent' }}
        />
      </Spin>
    </div>
  );
}
