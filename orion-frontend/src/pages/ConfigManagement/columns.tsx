import type { ConfigItem } from '@/api/config';
import { Space, Tag, Button } from 'antd';
import { FileTextOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  ENVIRONMENT_FILTERS,
  STATUS_COLOR_MAP,
  STATUS_LABEL_MAP,
} from './config';

export interface TableColumnsProps {
  onEdit: (record: ConfigItem) => void;
  onDelete: (id: string) => void;
  onApproval: (id: string) => void;
  onViewDetail: (record: ConfigItem) => void;
}

/** 构建配置列表表格列定义 */
export const buildConfigColumns = (props: TableColumnsProps) => {
  const { onEdit, onDelete, onApproval, onViewDetail } = props;

  return [
    {
      title: '配置键',
      dataIndex: 'key',
      key: 'key',
      render: (text: string, record: ConfigItem) => (
        <Space>
          <FileTextOutlined />
          <strong>{text}</strong>
          {record.sensitive && <Tag color="red">敏感</Tag>}
          {record.encrypted && <Tag color="purple">加密</Tag>}
        </Space>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: unknown, record: ConfigItem) =>
        record.sensitive ? '***' : JSON.stringify(value)?.slice(0, 50),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      filters: ENVIRONMENT_FILTERS,
      onFilter: (value: unknown, record: ConfigItem) => record.environment === value,
      render: (env: string) => <Tag color={env === 'production' ? 'red' : 'blue'}>{env}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLOR_MAP[status] || 'default'}>
          {STATUS_LABEL_MAP[status] || status}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ConfigItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => onViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record.id)}
          >
            删除
          </Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" onClick={() => onApproval(record.id)}>
              提交审批
            </Button>
          )}
        </Space>
      ),
    },
  ];
};
