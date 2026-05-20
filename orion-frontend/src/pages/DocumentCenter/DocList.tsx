/**
 * DocList — 文档列表组件
 *
 * 右侧文档列表表格，支持搜索、筛选、分页
 * 文档类型使用 Tag 区分：design(蓝)、spec(紫)、runbook(绿)、policy(橙)
 */
import React, { useMemo } from 'react';
import { Tag, Typography, Space, Badge } from 'antd';
import { EyeOutlined, ClockCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { colors, spacing, radius } from '@/tokens';
import type { KnowledgeDoc } from '@/api/knowledge';
import dayjs from 'dayjs';

const { Text } = Typography;

// ============================================================================
// Types
// ============================================================================

export type DocType = 'all' | 'design' | 'spec' | 'runbook' | 'policy';

interface DocListProps {
  docs: KnowledgeDoc[];
  loading: boolean;
  onSelectDoc: (doc: KnowledgeDoc) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
  };
  onPageChange?: (page: number, pageSize: number) => void;
}

// ============================================================================
// 文档类型配置
// ============================================================================

const DOC_TYPE_CONFIG: Record<Exclude<DocType, 'all'>, { label: string; color: string }> = {
  design: { label: '设计', color: colors.info[500] },
  spec: { label: '规范', color: colors.purple[500] },
  runbook: { label: '手册', color: colors.success[500] },
  policy: { label: '策略', color: colors.warning[500] },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: colors.neutral[400] },
  published: { label: '已发布', color: colors.success[500] },
  archived: { label: '已归档', color: colors.neutral[500] },
};

// ============================================================================
// Component
// ============================================================================

export default function DocList({
  docs,
  loading,
  onSelectDoc,
  pagination,
  onPageChange,
}: DocListProps) {
  const detectDocType = (doc: KnowledgeDoc): Exclude<DocType, 'all'> => {
    const tags = doc.tags || [];
    if (tags.some((t) => t.toLowerCase().includes('design'))) return 'design';
    if (tags.some((t) => t.toLowerCase().includes('spec'))) return 'spec';
    if (tags.some((t) => t.toLowerCase().includes('runbook'))) return 'runbook';
    if (tags.some((t) => t.toLowerCase().includes('policy'))) return 'policy';
    // Fallback based on doc.type field
    const t = (doc.type || '').toLowerCase();
    if (t === 'design') return 'design';
    if (t === 'spec') return 'spec';
    if (t === 'runbook') return 'runbook';
    if (t === 'policy') return 'policy';
    return 'design'; // default
  };

  const columns: TableColumn<KnowledgeDoc>[] = useMemo(
    () => [
      {
        key: 'title',
        title: '文档标题',
        dataIndex: 'title',
        width: 300,
        render: (value: unknown, record: KnowledgeDoc) => (
          <div>
            <Text
              strong
              style={{
                color: colors.primary[500],
                cursor: 'pointer',
                display: 'block',
                marginBottom: spacing[1],
              }}
              onClick={() => onSelectDoc(record)}
            >
              {String(value)}
            </Text>
            {record.tags && record.tags.length > 0 && (
              <Space size={4} wrap>
                {record.tags.slice(0, 3).map((tag) => (
                  <Tag
                    key={tag}
                    style={{
                      fontSize: 10,
                      padding: '0 6px',
                      lineHeight: '18px',
                      borderRadius: radius[0],
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
                {record.tags.length > 3 && (
                  <Tag style={{ fontSize: 10, padding: '0 6px', lineHeight: '18px' }}>
                    +{record.tags.length - 3}
                  </Tag>
                )}
              </Space>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: 80,
        render: (_: unknown, record: KnowledgeDoc) => {
          const type = detectDocType(record);
          const config = DOC_TYPE_CONFIG[type];
          return (
            <Tag color={config.color} style={{ borderRadius: 6 }}>
              {config.label}
            </Tag>
          );
        },
      },
      {
        key: 'status',
        title: '状态',
        width: 80,
        render: (_: unknown, record: KnowledgeDoc) => {
          const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.draft;
          return (
            <Badge
              status="processing"
              text={config.label}
              style={{ color: config.color }}
            />
          );
        },
      },
      {
        key: 'version',
        title: '版本',
        dataIndex: 'version',
        width: 60,
        render: (value: unknown) => (
          <Text type="secondary">v{String(value)}</Text>
        ),
      },
      {
        key: 'updatedAt',
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 160,
        render: (value: unknown) => (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: colors.neutral[400], fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(String(value)).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Space>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 80,
        render: (_: unknown, record: KnowledgeDoc) => (
          <Tag
            icon={<EyeOutlined />}
            style={{
              cursor: 'pointer',
              color: colors.primary[500],
              borderColor: colors.primary[200],
            }}
            onClick={() => onSelectDoc(record)}
          >
            查看
          </Tag>
        ),
      },
    ],
    [onSelectDoc]
  );

  return (
    <Table
      columns={columns}
      dataSource={docs}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: onPageChange,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `共 ${total} 篇文档`,
            }
          : false
      }
    />
  );
}
