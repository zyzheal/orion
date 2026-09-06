/**
 * DetailBreakerModal.tsx - 熔断器详情弹窗
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import React from 'react';
import { Modal, Button, Tag, Descriptions } from 'antd';
import dayjs from 'dayjs';
import type { CircuitBreakerConfig } from '@/api/circuit-breaker';
import { stateColor, stateIcon, stateLabel } from './constants';

interface DetailBreakerModalProps {
  visible: boolean;
  selectedBreaker: CircuitBreakerConfig | null;
  onClose: () => void;
}

export const DetailBreakerModal: React.FC<DetailBreakerModalProps> = ({
  visible,
  selectedBreaker,
  onClose,
}) => (
  <Modal
    title={selectedBreaker ? `熔断器详情: ${selectedBreaker.name}` : '详情'}
    open={visible}
    onCancel={onClose}
    footer={[
      <Button key="close" onClick={onClose}>
        关闭
      </Button>,
    ]}
    width={650}
  >
    {selectedBreaker && (
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="名称">{selectedBreaker.name}</Descriptions.Item>
        <Descriptions.Item label="服务">{selectedBreaker.service}</Descriptions.Item>
        <Descriptions.Item label="端点">{selectedBreaker.endpoint || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag
            color={stateColor[selectedBreaker.state]}
            icon={stateIcon[selectedBreaker.state]}
          >
            {stateLabel[selectedBreaker.state]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="失败阈值">
          {selectedBreaker.failureThreshold}
        </Descriptions.Item>
        <Descriptions.Item label="恢复阈值">
          {selectedBreaker.successThreshold}
        </Descriptions.Item>
        <Descriptions.Item label="超时时间">
          {selectedBreaker.timeoutSeconds}s
        </Descriptions.Item>
        <Descriptions.Item label="半开最大请求">
          {selectedBreaker.halfOpenMaxRequests}
        </Descriptions.Item>
        <Descriptions.Item label="当前失败数">{selectedBreaker.failureCount}</Descriptions.Item>
        <Descriptions.Item label="当前成功数">{selectedBreaker.successCount}</Descriptions.Item>
        <Descriptions.Item label="总请求数">{selectedBreaker.totalRequests}</Descriptions.Item>
        <Descriptions.Item label="总失败数">{selectedBreaker.totalFailures}</Descriptions.Item>
        <Descriptions.Item label="启用">
          {selectedBreaker.enabled ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="最后状态变更">
          {selectedBreaker.lastStateChange
            ? dayjs(selectedBreaker.lastStateChange).format('YYYY-MM-DD HH:mm')
            : '-'}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
