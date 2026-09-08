import { Modal, Alert, Card, Space, Typography, Tag } from 'antd';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { typeLabelMap, formatSize } from '../constants';
import type { BackupRecord } from '../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  confirmLoading: boolean;
  selectedRecord: BackupRecord | null;
}

export function RestoreModal({ open, onCancel, onOk, confirmLoading, selectedRecord }: Props) {
  return (
    <Modal
      title="确认恢复"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      width={480}
    >
      {selectedRecord && (
        <div>
          <Alert
            message="恢复操作警告"
            description="恢复备份将覆盖当前数据。此操作不可逆，请确认后再执行。"
            type="warning"
            showIcon
            style={{ marginBottom: spacing.md }}
          />
          <Card size="small">
            <Space direction="vertical" size={8}>
              <div>
                <Text type="secondary">备份 ID: </Text>
                <Text strong>{selectedRecord.id}</Text>
              </div>
              <div>
                <Text type="secondary">备份类型: </Text>
                <Tag color="blue">{typeLabelMap[selectedRecord.type]}</Tag>
              </div>
              <div>
                <Text type="secondary">创建时间: </Text>
                <Text>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </div>
              <div>
                <Text type="secondary">备份大小: </Text>
                <Text>{formatSize(selectedRecord.size)}</Text>
              </div>
            </Space>
          </Card>
        </div>
      )}
    </Modal>
  );
}
