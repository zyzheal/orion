/**
 * ServiceCatalog table column builders
 */
import { Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceCatalog, SLABreach } from '@/api/service-catalog';
import { SLA_STATUS_MAP } from './constants';

const { Text } = Typography;

interface CatalogColumnDeps {
  handleViewDetail: (record: ServiceCatalog) => Promise<void>;
  handleEdit: (record: ServiceCatalog) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

export function buildCatalogColumns(
  deps: CatalogColumnDeps,
): ColumnsType<ServiceCatalog> {
  const { handleViewDetail, handleEdit, handleDelete } = deps;
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      width: '20%',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: '10%',
      render: (enabled: boolean) =>
        enabled ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '18%',
      render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: '18%',
      render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: '14%',
      render: (_: unknown, record: ServiceCatalog) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此服务目录项？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export function buildSlaColumns(): ColumnsType<SLABreach> {
  return [
    { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: '20%' },
    { title: '服务', dataIndex: 'service', key: 'service', width: '15%' },
    { title: 'SLA 目标(ms)', dataIndex: 'slaTargetMs', key: 'slaTargetMs', width: '15%' },
    { title: '实际(ms)', dataIndex: 'actualMs', key: 'actualMs', width: '12%' },
    {
      title: '超时(ms)',
      dataIndex: 'overdueMs',
      key: 'overdueMs',
      width: '12%',
      render: (val: number) => <Text type="danger">{val.toLocaleString()}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status: string) => {
        const info = SLA_STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
  ];
}
