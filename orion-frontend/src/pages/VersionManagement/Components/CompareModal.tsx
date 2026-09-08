import { Button, Empty, Modal, Spin } from 'antd';
import { componentRadius, spacing, themeVars } from '@/tokens';
import type { VersionDiff } from '@/api/artifactVersions';

interface Props {
  open: boolean;
  onClose: () => void;
  diffLoading: boolean;
  diffResult: VersionDiff | null;
}

export function CompareModal({ open, onClose, diffLoading, diffResult }: Props) {
  return (
    <Modal
      title="版本对比"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={800}
      style={{ borderRadius: componentRadius.modal }}
    >
      {diffLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl }}>
          <Spin tip="对比中..." />
        </div>
      ) : diffResult ? (
        <pre
          style={{
            background: themeVars.bgSecondary,
            padding: spacing.md,
            borderRadius: componentRadius.input,
            maxHeight: 500,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(diffResult, null, 2)}
        </pre>
      ) : (
        <Empty description="无对比结果" />
      )}
    </Modal>
  );
}
