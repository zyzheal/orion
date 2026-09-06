/**
 * TenantColumns.tsx - Namespace 表格列定义
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import { useMemo } from 'react';
import { Space, Tag, Button, Popconfirm, Tooltip } from 'antd';
import { DatabaseOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { colors } from '@/tokens/colors';
import type { TableColumn } from '@/components/Table';
import type { NamespacePoolEntry } from '@/api/tenant';

const { Text } = Typography;

export interface NamespaceColumnHandlers {
  handleReleaseNamespace: (namespaceName: string) => void;
}

export const useNamespaceColumns = (
  handlers: NamespaceColumnHandlers,
): TableColumn<NamespacePoolEntry>[] => {
  const { handleReleaseNamespace } = handlers;

  return useMemo<TableColumn<NamespacePoolEntry>[]>(
    () => [
      {
        key: 'namespaceName',
        title: 'Namespace',
        dataIndex: 'namespaceName',
        render: (text: unknown) => (
          <Space>
            <DatabaseOutlined style={{ color: colors.primary[500] }} />
            <Text code>{String(text)}</Text>
          </Space>
        ),
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        render: (status: unknown) => {
          const colorMap: Record<string, string> = {
            available: 'green',
            allocated: 'blue',
            reserved: 'orange',
          };
          return <Tag color={colorMap[String(status)]}>{String(status)}</Tag>;
        },
      },
      {
        key: 'runnerCount',
        title: (
          <Space>
            Runner 数
            <Tooltip title="该 Namespace 内部署的 Runner Pod 数量">
              <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
            </Tooltip>
          </Space>
        ),
        dataIndex: 'runnerCount',
        render: (count: unknown) => (
          <Tag color={(count as number) > 0 ? colors.primary[500] : colors.neutral[400]}>
            {String(count)}
          </Tag>
        ),
      },
      {
        key: 'pipelineCount',
        title: 'Pipeline 数',
        dataIndex: 'pipelineCount',
      },
      {
        key: 'activeRuns',
        title: '活跃运行',
        dataIndex: 'activeRuns',
        render: (count: unknown) => (
          <Tag color={(count as number) > 0 ? colors.success[500] : colors.neutral[400]}>
            {(count as number) > 0 ? `${count} 运行中` : '无'}
          </Tag>
        ),
      },
      {
        key: 'allocatedAt',
        title: '分配时间',
        dataIndex: 'allocatedAt',
        render: (ts: unknown) => (ts ? new Date(String(ts)).toLocaleString() : '-'),
      },
      {
        key: 'actions',
        title: '操作',
        render: (_: unknown, record: NamespacePoolEntry) => (
          <Space>
            {record.status === 'allocated' && (record as any).runnerCount === 0 && (
              <Popconfirm
                title="释放 Namespace"
                description={`确定释放 ${record.namespaceName} 回池吗？`}
                okText="确定"
                cancelText="取消"
                onConfirm={() => handleReleaseNamespace(record.namespaceName)}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  释放
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [handleReleaseNamespace],
  );
};
