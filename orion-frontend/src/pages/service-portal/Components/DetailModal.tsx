/**
 * service-portal DetailModal
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Modal, Descriptions, Typography, Tag, Empty } from 'antd';
import type { ServiceInfo, ServiceHealth } from '@/api/service-registry';
import { HEALTH_STATUS } from '../constants';

const { Title, Text } = Typography;

interface DetailModalProps {
  open: boolean;
  service: ServiceInfo | null;
  health: ServiceHealth | null;
  healthLoading: boolean;
  onClose: () => void;
}

export const DetailModal = ({ open, service, health, healthLoading, onClose }: DetailModalProps) => (
  <Modal
    title={service ? service.name : '服务详情'}
    open={open}
    onCancel={onClose}
    footer={null}
    width={640}
    destroyOnClose
  >
    {service && (
      <>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="名称">{service.name}</Descriptions.Item>
          <Descriptions.Item label="服务 ID">
            <Text code>{service.serviceId}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="地址">
            {service.address}:{service.port}
          </Descriptions.Item>
          <Descriptions.Item label="协议">
            {service.protocol?.toUpperCase() || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="版本">{service.version || '-'}</Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {service.registeredAt
              ? new Date(service.registeredAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="心跳">
            {service.lastHeartbeat
              ? new Date(service.lastHeartbeat).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="健康状态">
            <Tag icon={HEALTH_STATUS[service.health]?.icon} color={HEALTH_STATUS[service.health]?.color}>
              {HEALTH_STATUS[service.health]?.label || '未知'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        <Title level={5}>健康详情</Title>
        {healthLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>
        ) : health ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="状态">
              <Tag icon={HEALTH_STATUS[health.status]?.icon} color={HEALTH_STATUS[health.status]?.color}>
                {HEALTH_STATUS[health.status]?.label || '未知'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="延迟 (ms)">{health.latencyMs}</Descriptions.Item>
            <Descriptions.Item label="错误率">{health.errorRate}%</Descriptions.Item>
            <Descriptions.Item label="最后检查">
              {new Date(health.lastChecked).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="暂无健康数据" />
        )}
      </>
    )}
  </Modal>
);
