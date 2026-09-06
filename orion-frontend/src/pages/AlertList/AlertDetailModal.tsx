/**
 * AlertDetailModal.tsx - 告警详情 Modal
 * 抽取自 AlertList/index.tsx (P2-9 Phase 64)
 */
import React from 'react';
import { Modal, Button, Tag, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { severityConfig, statusConfig } from './constants';
import type { Alert } from '@/types/pages';

const { Text } = Typography;

interface AlertDetailModalProps {
  open: boolean;
  alert: Alert | null;
  onClose: () => void;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  open,
  alert,
  onClose,
  onAcknowledge,
  onResolve,
}) => (
  <Modal
    title="告警详情"
    open={open}
    onCancel={onClose}
    footer={[
      alert && alert.status === 'active' && (
        <Button
          key="acknowledge"
          icon={<CheckOutlined />}
          onClick={() => {
            onAcknowledge(alert.id);
            onClose();
          }}
        >
          确认告警
        </Button>
      ),
      alert && (alert.status === 'active' || alert.status === 'acknowledged') && (
        <Button
          key="resolve"
          type="primary"
          danger
          icon={<CloseOutlined />}
          onClick={() => {
            onResolve(alert.id);
            onClose();
          }}
        >
          解决告警
        </Button>
      ),
      <Button key="close" onClick={onClose}>
        关闭
      </Button>,
    ]}
    width={600}
  >
    {alert && (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            padding: '12px 16px',
            background:
              alert.severity === 'critical'
                ? 'rgba(245, 34, 45, 0.06)'
                : alert.severity === 'warning'
                  ? 'rgba(250, 140, 22, 0.06)'
                  : 'rgba(24, 144, 255, 0.06)',
            borderRadius: 6,
          }}
        >
          <Tag
            color={severityConfig[alert.severity].color}
            style={{ fontWeight: 600 }}
          >
            {severityConfig[alert.severity].icon} {severityConfig[alert.severity].label}
          </Tag>
          <Tag color={statusConfig[alert.status].color}>
            {statusConfig[alert.status].label}
          </Tag>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>指标名称</Text>
          <div>
            <Text strong style={{ fontSize: spacing[4] }}>{alert.metric}</Text>
          </div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>告警消息</Text>
          <div>
            <Text>{alert.message}</Text>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>当前值</Text>
            <div>
              <Text strong style={{ color: colors.error[600], fontSize: spacing[5] }}>
                {alert.value}
              </Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>阈值</Text>
            <div>
              <Text>{alert.threshold}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>来源</Text>
            <div>
              <Text code>{alert.source}</Text>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>首次触发</Text>
            <div>
              <Text style={{ fontSize: spacing[3] }}>
                {dayjs(alert.firstTriggered).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>最后更新</Text>
            <div>
              <Text style={{ fontSize: spacing[3] }}>
                {dayjs(alert.lastUpdated).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          </div>
        </div>

        {alert.acknowledgedBy && (
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>确认信息</Text>
            <div>
              <Text>
                由 <Text code>{alert.acknowledgedBy}</Text> 于{' '}
                {dayjs(alert.acknowledgedAt).format('YYYY-MM-DD HH:mm:ss')} 确认
              </Text>
            </div>
          </div>
        )}

        {alert.resolvedBy && (
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>解决信息</Text>
            <div>
              <Text>
                由 <Text code>{alert.resolvedBy}</Text> 于{' '}
                {dayjs(alert.resolvedAt).format('YYYY-MM-DD HH:mm:ss')} 解决
              </Text>
            </div>
          </div>
        )}
      </Space>
    )}
  </Modal>
);
