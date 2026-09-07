/**
 * service-portal columns
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Button, Space, Tag, Typography, Popconfirm } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceInfo } from '@/api/service-registry';
import { HEALTH_STATUS } from './constants';

const { Text } = Typography;

interface ColumnsDeps {
  onDetail: (record: ServiceInfo) => void;
  onDeregister: (id: string) => void;
}

export const buildServiceColumns = ({ onDetail, onDeregister }: ColumnsDeps): ColumnsType<ServiceInfo> => [
  {
    title: '服务名称',
    dataIndex: 'name',
    key: 'name',
    width: '18%',
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '服务 ID',
    dataIndex: 'serviceId',
    key: 'serviceId',
    width: '15%',
    render: (val: string) => <Text code>{val}</Text>,
  },
  {
    title: '地址',
    dataIndex: 'address',
    key: 'address',
    width: '15%',
    render: (addr: string, record: ServiceInfo) => `${addr}:${record.port}`,
  },
  {
    title: '协议',
    dataIndex: 'protocol',
    key: 'protocol',
    width: '10%',
    render: (val: string | undefined) => (val ? <Tag>{val.toUpperCase()}</Tag> : '-'),
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: '10%',
    render: (val: string | undefined) => val || '-',
  },
  {
    title: '健康状态',
    dataIndex: 'health',
    key: 'health',
    width: '12%',
    render: (health: string) => {
      const info = HEALTH_STATUS[health] || HEALTH_STATUS.unknown;
      return (
        <Tag icon={info.icon} color={info.color}>
          {info.label}
        </Tag>
      );
    },
  },
  {
    title: '操作',
    key: 'action',
    width: '20%',
    render: (_: unknown, record: ServiceInfo) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onDetail(record)}
        >
          详情
        </Button>
        <Popconfirm
          title="确认注销此服务？"
          onConfirm={() => onDeregister(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            注销
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
