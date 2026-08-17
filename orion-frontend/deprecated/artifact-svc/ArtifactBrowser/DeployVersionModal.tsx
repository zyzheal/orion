/**
 * Deploy Version Modal - Trigger deployment of a specific artifact version
 */
import React from 'react';
import { Modal, Form, Select, Input, Typography, Tag, Space } from 'antd';
import type { ArtifactVersion } from '@/api/artifactVersions';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface DeployVersionModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: { environment: string; deployedBy: string }) => Promise<void>;
  version: ArtifactVersion | null;
  submitting: boolean;
  form: any;
}

const DeployVersionModal: React.FC<DeployVersionModalProps> = ({
  open,
  onCancel,
  onOk,
  version,
  submitting,
  form,
}) => {
  const environmentOptions = [
    { label: 'Development', value: 'dev' },
    { label: 'Staging', value: 'staging' },
    { label: 'Production', value: 'production' },
  ];

  return (
    <Modal
      title="部署版本"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
    >
      {version && (
        <div style={{ marginBottom: spacing.md }}>
          <Space direction="vertical" size={4}>
            <Text>
              版本: <Text strong>{version.version}</Text>
            </Text>
            <Text>
              制品: {version.artifactName}
            </Text>
            {version.commitSha && (
              <Text>
                Commit: <Text code style={{ fontSize: 11 }}>{version.commitSha.slice(0, 7)}</Text>
              </Text>
            )}
            {version.branch && (
              <Text>
                分支: <Tag color="geekblue">{version.branch}</Tag>
              </Text>
            )}
            <Text type="secondary">
              创建时间: {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Space>
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={onOk}>
        <Form.Item
          name="environment"
          label="目标环境"
          rules={[{ required: true, message: '请选择目标环境' }]}
        >
          <Select options={environmentOptions} placeholder="选择环境" />
        </Form.Item>
        <Form.Item
          name="deployedBy"
          label="操作人"
          rules={[{ required: true, message: '请输入操作人' }]}
        >
          <Input placeholder="用户名" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DeployVersionModal;
