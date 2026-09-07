/**
 * FlowVersions VersionDetailModal
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Modal, Descriptions, Space, Button, Popconfirm } from 'antd';
import type { CSSProperties } from 'react';
import { RollbackOutlined } from '@ant-design/icons';
import type { LowcodeFlow, LowcodeFlowVersion } from '@/api/lowcode';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

interface VersionDetailModalProps {
  open: boolean;
  selectedFlow: LowcodeFlow | null;
  selectedVersion: LowcodeFlowVersion | null;
  onRestore: (version: LowcodeFlowVersion) => void;
  onClose: () => void;
}

const preStyle: CSSProperties = {
  maxHeight: 200,
  overflow: 'auto',
  background: colors.neutral[100],
  padding: spacing.sm,
  borderRadius: 8,
  fontSize: 12,
};

export const VersionDetailModal = ({
  open,
  selectedFlow,
  selectedVersion,
  onRestore,
  onClose,
}: VersionDetailModalProps) => (
  <Modal
    title={`版本详情: ${selectedVersion?.version}`}
    open={open}
    onCancel={onClose}
    width={700}
    footer={
      <Space>
        <Button onClick={onClose}>关闭</Button>
        {selectedFlow && selectedVersion && (
          <Popconfirm
            title="恢复到此版本"
            description="恢复后将用该版本的节点/连线覆盖当前流程，确定吗？"
            onConfirm={() => {
              onRestore(selectedVersion);
              onClose();
            }}
            okText="恢复"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<RollbackOutlined />}>恢复此版本</Button>
          </Popconfirm>
        )}
      </Space>
    }
  >
    {selectedVersion && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="版本ID">{selectedVersion.id}</Descriptions.Item>
        <Descriptions.Item label="版本号">{selectedVersion.version}</Descriptions.Item>
        <Descriptions.Item label="变更说明">{selectedVersion.changeLog || '无'}</Descriptions.Item>
        <Descriptions.Item label="创建人">{selectedVersion.createdBy}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(selectedVersion.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="节点快照">
          <pre style={preStyle}>{JSON.stringify(selectedVersion.snapshot?.nodes || [], null, 2)}</pre>
        </Descriptions.Item>
        <Descriptions.Item label="连线快照">
          <pre style={preStyle}>{JSON.stringify(selectedVersion.snapshot?.edges || [], null, 2)}</pre>
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
