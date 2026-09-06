/**
 * OnboardingModal.tsx - 新手引导 Modal
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import React from 'react';
import { Modal, Typography, Button } from 'antd';
import { spacing } from '@/tokens';
import { ONBOARDING_STEPS } from '@/constants/dora-guidance';

const { Title, Text } = Typography;

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onClose }) => (
  <Modal
    title="效能看板入门指南"
    open={visible}
    onCancel={onClose}
    footer={[
      <Button key="skip" onClick={onClose}>
        以后再说
      </Button>,
      <Button key="start" type="primary" onClick={onClose}>
        开始使用
      </Button>,
    ]}
    width={600}
  >
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      {ONBOARDING_STEPS.map((step, index) => (
        <div
          key={String(index)}
          style={{
            padding: '16px 0',
            borderBottom:
              index < ONBOARDING_STEPS.length - 1 ? '1px solid colors.neutral[200]' : 'none',
          }}
        >
          <Title level={5} style={{ marginBottom: spacing.sm }}>
            {index + 1}. {step.title}
          </Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{step.content}</Text>
        </div>
      ))}
    </div>
  </Modal>
);
