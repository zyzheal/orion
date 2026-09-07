/**
 * EnvProfiles EnvironmentListModal
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { Modal, Typography, Button, Space, Tag } from 'antd';
import { spacing } from '@/tokens';
import type { EnvProfile } from '@/api/env-profiles';

const { Text } = Typography;

interface EnvironmentListModalProps {
  selectedProfile: EnvProfile | null;
  environments: string[];
  envLoading: boolean;
  envError: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export const EnvironmentListModal = ({
  selectedProfile,
  environments,
  envLoading,
  envError,
  onClose,
  onRetry,
}: EnvironmentListModalProps) => (
  <Modal
    title={selectedProfile ? `${selectedProfile.name} — 环境列表` : '环境列表'}
    open={!!selectedProfile && !envLoading}
    onCancel={onClose}
    footer={null}
  >
    {envError ? (
      <div style={{ textAlign: 'center', padding: spacing.lg }}>
        <Text type="danger">{envError}</Text>
        <div style={{ marginTop: spacing.md }}>
          <Button onClick={onRetry}>重试</Button>
        </div>
      </div>
    ) : environments.length > 0 ? (
      <Space wrap>
        {environments.map((env) => (
          <Tag key={env} color="blue">
            {env}
          </Tag>
        ))}
      </Space>
    ) : (
      <Text type="secondary">暂无环境配置</Text>
    )}
  </Modal>
);
