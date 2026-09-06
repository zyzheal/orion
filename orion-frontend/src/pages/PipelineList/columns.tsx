/**
 * PipelineList 列定义
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import { Button, Space, Tag, Typography, Tooltip, Modal } from 'antd';
import { ColumnHeightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { Pipeline } from '@/api/pipelines';
import { STATUS_COLOR_MAP } from './constants';

const { Text } = Typography;

export interface BuildColumnsDeps {
  navigate: (path: string) => void;
  canEdit: boolean;
  columnVisible: Record<string, boolean>;
  handleDelete: (id: string) => void;
}

export const buildPipelineColumns = ({
  navigate,
  canEdit,
  columnVisible,
  handleDelete,
}: BuildColumnsDeps): TableColumn<Pipeline>[] => {
  const columns: TableColumn<Pipeline>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      render: (name: unknown, record: Pipeline) => (
        <a onClick={() => navigate(`/pipelines/${record.id}`)}>{String(name ?? '')}</a>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => (
        <Tag color={STATUS_COLOR_MAP[String(status)] || 'default'}>{String(status)}</Tag>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 80,
    },
    {
      key: 'stages',
      title: '阶段数',
      dataIndex: 'stages',
      width: 80,
      render: (stages: unknown) => {
        const count = Array.isArray(stages)
          ? stages.length
          : typeof stages === 'number'
            ? stages
            : '-';
        return <Text>{count}</Text>;
      },
    },
    {
      key: 'environment',
      title: '环境',
      dataIndex: 'environment',
      width: 120,
      render: (env: unknown) => (env ? <Tag>{String(env)}</Tag> : '-'),
    },
    {
      key: 'creator',
      title: '创建者',
      dataIndex: 'creator',
      width: 120,
      ellipsis: true,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (time: unknown) => (time ? dayjs(String(time)).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (time: unknown) => (time ? dayjs(String(time)).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_: unknown, record: Pipeline) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<ColumnHeightOutlined />}
              onClick={() => navigate(`/pipelines/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              disabled={!canEdit}
              onClick={() => navigate(`/pipelines/${record.id}/edit`)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="查看运行记录">
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/pipelines/${record.id}/runs`)}
            >
              运行记录
            </Button>
          </Tooltip>
          <Button
            size="small"
            type="link"
            danger
            onClick={() => {
              Modal.confirm({
                title: '确认删除 Pipeline',
                content: `确定要删除「${record.name}」吗？此操作不可恢复。`,
                okText: '删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: () => handleDelete(record.id),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
  // `actions` 列等未在 DEFAULT_COLUMN_VISIBLE 中的列默认显示
  return columns.filter((col) => columnVisible[col.key] !== false);
};
