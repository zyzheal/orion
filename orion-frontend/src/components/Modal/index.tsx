/**
 * Modal Component
 * - Confirm/Info/Error variants
 * - Async close handling
 * - Wraps Ant Design Modal with preset configurations
 */
import React, { useState, useCallback } from 'react';
import { Modal as AntModal } from 'antd';
import {
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

// ============================================================================
// Types
// ============================================================================

export type ModalType = 'confirm' | 'info' | 'error' | 'warning' | 'success';

export interface OrionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Modal title */
  title: React.ReactNode;
  /** Modal content */
  content: React.ReactNode;
  /** OK button handler (supports async) */
  onOk?: () => void | Promise<void>;
  /** Cancel button handler */
  onCancel?: () => void;
  /** Modal type determines icon and button text */
  type?: ModalType;
  /** OK button text */
  okText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Whether to show cancel button */
  showCancel?: boolean;
  /** Whether the modal is closable by clicking mask */
  maskClosable?: boolean;
  /** Whether to destroy modal on close */
  destroyOnClose?: boolean;
  /** Modal width */
  width?: number | string;
  /** Loading state for OK button */
  confirmLoading?: boolean;
  /** Center the buttons */
  centered?: boolean;
  /** Custom icon */
  icon?: React.ReactNode;
}

// ============================================================================
// Icon mapping
// ============================================================================

const iconMap: Record<ModalType, React.ReactNode> = {
  confirm: <QuestionCircleOutlined style={{ color: '#faad14', fontSize: 22 }} />,
  info: <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 22 }} />,
  error: <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 22 }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 22 }} />,
  success: (
    <span style={{ color: '#52c41a', fontSize: 22 }}>
      <svg viewBox="64 64 896 896" width="22" height="22" fill="currentColor">
        <path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" />
      </svg>
    </span>
  ),
};

const defaultTexts: Record<ModalType, { ok: string; cancel: string }> = {
  confirm: { ok: 'Confirm', cancel: 'Cancel' },
  info: { ok: 'OK', cancel: '' },
  error: { ok: 'OK', cancel: '' },
  warning: { ok: 'OK', cancel: '' },
  success: { ok: 'OK', cancel: '' },
};

// ============================================================================
// Component
// ============================================================================

function OrionModal({
  visible,
  title,
  content,
  onOk,
  onCancel,
  type = 'confirm',
  okText,
  cancelText,
  showCancel = true,
  maskClosable = true,
  destroyOnClose = false,
  width = 520,
  confirmLoading = false,
  centered = true,
  icon: customIcon,
}: OrionModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = confirmLoading || internalLoading;

  const handleOk = useCallback(async () => {
    if (!onOk) return;
    setInternalLoading(true);
    try {
      await onOk();
    } finally {
      setInternalLoading(false);
    }
  }, [onOk]);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const resolvedOkText = okText || defaultTexts[type].ok;
  const resolvedCancelText = cancelText || defaultTexts[type].cancel;

  return (
    <AntModal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {customIcon || iconMap[type]}
          <span>{title}</span>
        </div>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={resolvedOkText}
      cancelText={resolvedCancelText}
      okButtonProps={{ loading: isLoading }}
      cancelButtonProps={{
        disabled: isLoading,
        style: showCancel ? undefined : { display: 'none' },
      }}
      confirmLoading={isLoading}
      maskClosable={maskClosable}
      destroyOnClose={destroyOnClose}
      width={width}
      centered={centered}
      closable
      data-testid="orion-modal"
    >
      <div style={{ marginLeft: customIcon || iconMap[type] ? 30 : 0 }}>{content}</div>
    </AntModal>
  );
}

export default OrionModal;
