/**
 * ReleasesTab - 发布记录 Tab（含回滚发布确认 Modal）
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
import { RollbackOutlined } from '@ant-design/icons';
import type { ConfigRelease } from '@/api/distributedConfig';
import { releaseColumns } from './columns';

const { Option } = Select;
const { TextArea } = Input;

export interface ReleasesTabProps {
  releases: ConfigRelease[];
  selectedEnv: string;
  setSelectedEnv: (v: string) => void;
  rollbackForm: ReturnType<typeof Form.useForm>[0];
  handleRollback: (values: { snapshotId: string; reason?: string }) => void;
}

export const ReleasesTab: React.FC<ReleasesTabProps> = ({
  releases,
  selectedEnv,
  setSelectedEnv,
  rollbackForm,
  handleRollback,
}) => (
  <Card
    title="发布记录"
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
          icon={<RollbackOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '回滚发布',
              content: (
                <Form form={rollbackForm} layout="vertical">
                  <Form.Item
                    name="snapshotId"
                    label="目标快照 ID"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="请输入快照 ID" />
                  </Form.Item>
                  <Form.Item name="reason" label="回滚原因">
                    <TextArea rows={2} />
                  </Form.Item>
                </Form>
              ),
              onOk: () =>
                rollbackForm.validateFields().then((values) => handleRollback(values as any)),
            });
            rollbackForm.resetFields();
          }}
        >
          回滚
        </Button>
      </Space>
    }
  >
    <Table
      columns={releaseColumns}
      dataSource={releases}
      rowKey="id"
      pagination={{ pageSize: 10 }}
      size="small"
    />
  </Card>
);
