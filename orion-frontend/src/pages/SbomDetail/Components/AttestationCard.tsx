/**
 * SBOM attestation card
 * 抽取自 index.tsx (P2-9 Phase 162)
 */
import { Card, Descriptions } from 'antd';
import StatusBadge from '@/components/StatusBadge';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { SbomAttestation } from '../types';

interface AttestationCardProps {
  attestation: SbomAttestation;
}

export const AttestationCard = ({ attestation }: AttestationCardProps) => (
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
        {attestation.verifiedAt
          ? dayjs(attestation.verifiedAt).format('YYYY-MM-DD HH:mm')
          : '-'}
      </Descriptions.Item>
    </Descriptions>
  </Card>
);
