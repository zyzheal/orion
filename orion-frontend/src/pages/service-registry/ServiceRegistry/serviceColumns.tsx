/**
 * ServiceRegistry table columns
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import { Space, Tag, Button, Tooltip, Typography, Modal, message } from 'antd';
import { DeleteOutlined, HeartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { TableColumn } from '@/components/Table';
import type { ServiceInfo } from '@/api/service-registry';
import { colors, spacing } from '@/tokens';
import { HEALTH_STATUS_CONFIG, PROTOCOL_COLOR_MAP } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface BuildColumnsDeps {
  deregisteringId: string | null;
  deregisterLoading: boolean;
  handleDeregister: (record: ServiceInfo) => void;
  loadServices: () => void;
}

export const buildServiceColumns = (
  deps: BuildColumnsDeps
): TableColumn<ServiceInfo>[] => [
  {
    key: 'name',
    title: '服务名',
    dataIndex: 'name',
    width: 180,
    render: (_value: unknown, record) =>
      record ? (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: colors.primary[500] }}>
            {record.name}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.serviceId}
          </Text>
        </Space>
      ) : null,
  },
  {
    key: 'address',
    title: '地址',
    dataIndex: 'address',
    width: 160,
    render: (value: unknown) => <Text code>{String(value)}</Text>,
  },
  {
    key: 'port',
    title: '端口',
    dataIndex: 'port',
    width: 90,
    render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
  },
  {
    key: 'protocol',
    title: '协议',
    dataIndex: 'protocol',
    width: 100,
    render: (value: unknown) => {
      const protocol = String(value || 'http');
      return (
        <Tag color={PROTOCOL_COLOR_MAP[protocol] || 'default'}>
          {protocol.toUpperCase()}
        </Tag>
      );
    },
  },
  {
    key: 'version',
    title: '版本',
    dataIndex: 'version',
    width: 100,
    render: (value: unknown) => <Text type="secondary">{String(value || '-')}</Text>,
  },
  {
    key: 'health',
    title: '健康状态',
    dataIndex: 'health',
    width: 120,
    render: (value: unknown) => {
      const health = String(value || 'unknown');
      const config = HEALTH_STATUS_CONFIG[health] || HEALTH_STATUS_CONFIG.unknown;
      return (
        <Tag color={config.color} icon={config.icon}>
          {config.label}
        </Tag>
      );
    },
  },
  {
    key: 'lastHeartbeat',
    title: '最后心跳',
    dataIndex: 'lastHeartbeat',
    width: 160,
    render: (value: unknown) => {
      const time = String(value || '');
      if (!time) return <Text type="secondary">暂无</Text>;
      return (
        <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary">{dayjs(time).fromNow()}</Text>
        </Tooltip>
      );
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    fixed: 'right',
    render: (_: unknown, record) => {
      if (!record) return null;
      const isBusy = deps.deregisteringId === record.id;
      return (
        <Space size="small">
          <Tooltip title="发送心跳">
            <Button
              type="link"
              size="small"
              icon={<HeartOutlined />}
              onClick={async () => {
                try {
                  // 使用 fetch 直接调用心跳接口，因为 API client 未导出 heartbeat
                  const { api } = await import('@/api/client');
                  await api.post(`/service-registry/services/${record.id}/heartbeat`);
                  message.success(`心跳已发送：${record.name}`);
                  deps.loadServices();
                } catch (error: unknown) {
                  if (error instanceof Error) {
                    message.error(`发送心跳失败：${error.message}`);
                  } else {
                    message.error('发送心跳失败，请稍后重试');
                  }
                }
              }}
            >
              心跳
            </Button>
          </Tooltip>
          <Tooltip title="取消注册">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={isBusy && deps.deregisterLoading}
              disabled={isBusy}
              onClick={() => {
                Modal.confirm({
                  title: '确认取消注册',
                  content: `确定要取消注册服务 "${record.name}" 吗？此操作不可恢复。`,
                  okText: '确认取消注册',
                  okType: 'danger',
                  cancelText: '再想想',
                  onOk: () => deps.handleDeregister(record),
                });
              }}
            >
              取消注册
            </Button>
          </Tooltip>
        </Space>
      );
    },
  },
];
