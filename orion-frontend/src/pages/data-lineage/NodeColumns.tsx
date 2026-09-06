/**
 * NodeColumns.tsx - 血缘节点表格列定义
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import { useMemo } from 'react';
import { Space, Tag, Button, Typography, Badge } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import { nodeTypeConfig, deriveColumns } from './constants.tsx';
import type { DisplayNode } from './types';
import type { LineageNode as ApiLineageNode } from '@/api/data-lineage';

const { Text } = Typography;

export interface NodeColumnHandlers {
  nodes: DisplayNode[];
  openNodeDetail: (node: ApiLineageNode) => void;
}

export const useNodeColumns = (
  handlers: NodeColumnHandlers,
): ColumnsType<DisplayNode> => {
  const { nodes, openNodeDetail } = handlers;

  return useMemo<ColumnsType<DisplayNode>>(
    () => [
      {
        title: '名称',
        key: 'name',
        width: 220,
        render: (_: unknown, record: DisplayNode) => {
          const cfg = nodeTypeConfig[record.type] || nodeTypeConfig.source;
          return (
            <Space>
              <Badge dot={false} count={null} />
              <span style={{ color: colors.primary[500] }}>{cfg.icon}</span>
              <div>
                <Text strong>{record.name}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {record.pipelineId || '—'}
                  </Text>
                </div>
              </div>
            </Space>
          );
        },
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 90,
        render: (v: string) => {
          const cfg = nodeTypeConfig[v] || nodeTypeConfig.source;
          return <Tag color={cfg.color}>{cfg.label}</Tag>;
        },
      },
      {
        title: '列数',
        key: 'columns',
        width: 70,
        render: (_: unknown, record: DisplayNode) => {
          const cols = deriveColumns(record);
          return <Tag color="default">{cols.length}</Tag>;
        },
      },
      {
        title: '上游',
        key: 'upstream',
        width: 140,
        render: (_: unknown, record: DisplayNode) => (
          <Space size="small" wrap>
            {record.upstreamIds.length > 0 ? (
              record.upstreamIds.map((uId) => {
                const u = nodes.find((n) => n.id === uId);
                return u ? <Tag key={uId}>{u.name}</Tag> : null;
              })
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Space>
        ),
      },
      {
        title: '下游',
        key: 'downstream',
        width: 140,
        render: (_: unknown, record: DisplayNode) => (
          <Space size="small" wrap>
            {record.downstreamIds.length > 0 ? (
              record.downstreamIds.map((dId) => {
                const d = nodes.find((n) => n.id === dId);
                return d ? (
                  <Tag key={dId} color="green">
                    {d.name}
                  </Tag>
                ) : null;
              })
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Space>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        render: (_: unknown, record: ApiLineageNode) => (
          <Space size="small">
            <Button
              size="small"
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => openNodeDetail(record)}
            >
              影响分析
            </Button>
          </Space>
        ),
      },
    ],
    [nodes, openNodeDetail],
  );
};
