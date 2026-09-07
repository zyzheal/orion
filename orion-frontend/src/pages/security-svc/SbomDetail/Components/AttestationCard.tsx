/**
 * SBOM Attestation card
 */
import React from 'react';
import { Card, Descriptions } from 'antd';
import StatusBadge from '@/components/StatusBadge';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

interface AttestationCardProps {
  attestation: any;
}

export const AttestationCard: React.FC<AttestationCardProps> = ({ attestation }) =>
  attestation ? (
    <Card title="签名证明" style={{ marginBottom: spacing.lg }}>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="签名类型">{attestation.attestationType}</Descriptions.Item>
        <Descriptions.Item label="验证状态">
          <StatusBadge status={attestation.verified ? 'success' : 'warning'} size="small" />
        </Descriptions.Item>
        <Descriptions.Item label="签名时间">
          {dayjs(attestation.signedAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="验证时间">
          {attestation.verifiedAt ? dayjs(attestation.verifiedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  ) : null;
