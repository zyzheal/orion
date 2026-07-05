/**
 * DocDetail — 文档详情查看组件
 *
 * 显示文档完整内容，使用 react-markdown 渲染 Markdown
 * 包含文档元信息、版本历史、目录导航
 */
import _React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Typography, Tag, Space, Divider, Button, Tooltip, Spin, Drawer,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TagOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import type { KnowledgeDoc } from '@/api/knowledge';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

type DocType = 'design' | 'spec' | 'runbook' | 'policy';

interface DocDetailProps {
  doc: KnowledgeDoc | null;
  loading: boolean;
  onBack: () => void;
  onRefresh?: () => void;
}

// ============================================================================
// 文档类型配置
// ============================================================================

const DOC_TYPE_CONFIG: Record<DocType, { label: string; color: string; borderColor: string; bgColor: string }> = {
  design: {
    label: '设计文档',
    color: colors.info[500],
    borderColor: colors.info[200],
    bgColor: colors.info[50],
  },
  spec: {
    label: '规范文档',
    color: colors.purple[500],
    borderColor: colors.purple[200],
    bgColor: colors.purple[50],
  },
  runbook: {
    label: '操作手册',
    color: colors.success[500],
    borderColor: colors.success[200],
    bgColor: colors.success[50],
  },
  policy: {
    label: '策略文档',
    color: colors.warning[500],
    borderColor: colors.warning[200],
    bgColor: colors.warning[50],
  },
};

// ============================================================================
// 提取 Markdown 标题生成目录
// ============================================================================

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function extractToc(content: string): TocItem[] {
  const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
  return headings.map((h) => {
    const level = h.match(/^#+/)?.[0].length || 1;
    const text = h.replace(/^#+\s+/, '');
    return {
      level,
      text,
      id: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
    };
  });
}

// ============================================================================
// Component
// ============================================================================

export default function DocDetail({ doc, loading, onBack, onRefresh }: DocDetailProps) {
  const [tocVisible, setTocVisible] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    if (doc?.content) {
      setToc(extractToc(doc.content));
    } else {
      setToc([]);
    }
  }, [doc]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载文档中..." />
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ textAlign: 'center', padding: spacing[16], color: colors.neutral[500] }}>
        <Text type="secondary">选择一篇文档查看详情</Text>
      </div>
    );
  }

  const docType = detectDocType(doc);
  const typeConfig = DOC_TYPE_CONFIG[docType];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: colors.light.bg.primary, borderRadius: radius[3], boxShadow: shadows.card }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing[3]}px ${spacing[4]}px`,
          borderBottom: `1px solid ${colors.light.border.light}`,
          position: 'sticky',
          top: 0,
          background: colors.light.bg.primary,
          zIndex: 10,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} type="text" />
          <Text strong style={{ fontSize: 16 }}>{doc.title}</Text>
          <Tag color={typeConfig.color}>{typeConfig.label}</Tag>
        </Space>
        <Space>
          {onRefresh && (
            <Tooltip title="刷新">
              <Button icon={<ReloadOutlined />} onClick={onRefresh} type="text" />
            </Tooltip>
          )}
          {toc.length > 0 && (
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => setTocVisible(true)}
              type="text"
            >
              目录
            </Button>
          )}
        </Space>
      </div>

      {/* 文档内容 */}
      <div style={{ padding: spacing[6], maxWidth: 900, margin: '0 auto' }}>
        {/* 标题区 */}
        <Title level={2} style={{ marginTop: 0, marginBottom: spacing[3] }}>
          {doc.title}
        </Title>

        {/* 元信息 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[6],
            padding: spacing[4],
            background: colors.light.bg.secondary,
            borderRadius: radius[3],
            marginBottom: spacing[6],
          }}
        >
          <Space size={4}>
            <UserOutlined style={{ color: colors.neutral[400] }} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {doc.author_id || 'Unknown'}
            </Text>
          </Space>
          <Space size={4}>
            <ClockCircleOutlined style={{ color: colors.neutral[400] }} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {dayjs(doc.updated_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Space>
          <Space size={4}>
            <TagOutlined style={{ color: colors.neutral[400] }} />
            {doc.tags && doc.tags.length > 0 ? (
              doc.tags.map((tag) => (
                <Tag key={tag} style={{ margin: 0, fontSize: 12 }}>{tag}</Tag>
              ))
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>无标签</Text>
            )}
          </Space>
        </div>

        {/* 版本信息 */}
        <div style={{ marginBottom: spacing[4] }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            版本 v{doc.version} | 状态: <Tag color={doc.status === 'published' ? 'success' : doc.status === 'archived' ? 'default' : 'default'}>
              {doc.status}
            </Tag>
          </Text>
        </div>

        <Divider style={{ margin: `${spacing[4]}px 0` }} />

        {/* Markdown 内容渲染 */}
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {doc.content || '_暂无内容_'}
          </ReactMarkdown>
        </div>
      </div>

      {/* 目录 Drawer */}
      <Drawer
        title="文档目录"
        placement="right"
        width={280}
        onClose={() => setTocVisible(false)}
        open={tocVisible}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: spacing[4] }}>
          {toc.map((item, index) => (
            <div
              key={index}
              style={{
                paddingLeft: (item.level - 1) * spacing[4],
                paddingTop: spacing[2],
                paddingBottom: spacing[2],
                cursor: 'pointer',
                color: colors.neutral[600],
                fontSize: item.level === 1 ? 14 : 13,
                fontWeight: item.level === 1 ? 600 : 400,
              }}
            >
              {item.text}
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function detectDocType(doc: KnowledgeDoc): DocType {
  const tags = doc.tags || [];
  if (tags.some((t) => t.toLowerCase().includes('design'))) return 'design';
  if (tags.some((t) => t.toLowerCase().includes('spec'))) return 'spec';
  if (tags.some((t) => t.toLowerCase().includes('runbook'))) return 'runbook';
  if (tags.some((t) => t.toLowerCase().includes('policy'))) return 'policy';
  const t = (doc.type || '').toLowerCase();
  if (t === 'design') return 'design';
  if (t === 'spec') return 'spec';
  if (t === 'runbook') return 'runbook';
  if (t === 'policy') return 'policy';
  return 'design';
}
