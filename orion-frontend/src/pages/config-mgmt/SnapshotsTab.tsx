/**
 * SnapshotsTab - 快照管理 Tab（含发布配置快照确认 Modal）
 */
import React from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  Space,
  Input,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import type { ConfigSnapshot } from '@/api/distributedConfig';
import { useSnapshotColumns } from './columns';

const { Option } = Select;
const { TextArea } = Input;

export interface SnapshotsTabProps {
  snapshots: ConfigSnapshot[];
  selectedEnv: string;
  setSelectedEnv: (v: string) => void;
  loading: boolean;
  releaseForm: ReturnType<typeof Form.useForm>[0];
  handlePublishSnapshot: () => void;
  handlePublishRelease: (values: {
    snapshotId: string;
    environment: string;
    releaseNote?: string;
  }) => void;
}

export const SnapshotsTab: React.FC<SnapshotsTabProps> = ({
  snapshots,
  selectedEnv,
  setSelectedEnv,
  loading,
  releaseForm,
  handlePublishSnapshot,
  handlePublishRelease,
}) => {
  const columns = useSnapshotColumns({
    onPublish: (record) => {
      releaseForm.setFieldsValue({ snapshotId: record.id, environment: record.environment });
      Modal.confirm({
        title: '发布配置快照',
        content: (
          <Form form={releaseForm} layout="vertical">
            <Form.Item name="releaseNote" label="发布说明">
              <TextArea rows={2} />
            </Form.Item>
          </Form>
        ),
        onOk: () =>
          releaseForm.validateFields().then((values) => handlePublishRelease(values)),
        okButtonProps: { loading: false },
      });
      releaseForm.resetFields();
    },
  });

  return (
    <Card
      title="快照管理"
      extra={
        <Space>
          <Select
            style={{ width: 120 }}
            value={selectedEnv}
            onChange={setSelectedEnv}
            placeholder="环境"
          >
            <Option value="default">default</Option>
            <Option value="development">development</Option>
            <Option value="staging">staging</Option>
            <Option value="production">production</Option>
          </Select>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handlePublishSnapshot}
            loading={loading}
          >
            发布快照
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={snapshots}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        size="small"
      />
    </Card>
  );
};
