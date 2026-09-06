/**
 * 运维工具 - 批量操作 Tab
 */
import React from 'react';
import type { FormInstance } from 'antd';
import { Card, Table, Button, Form, Input, Row, Col } from 'antd';
import { SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { batchColumns } from '../columns';
import type { BatchOperation } from '@/api/ops-tools';

interface BatchTabProps {
  batchForm: FormInstance;
  batchOps: BatchOperation[];
  batchLoading: boolean;
  batchExecLoading: boolean;
  onExecute: (values: any) => void;
  onRefresh: () => void;
}

export const BatchTab: React.FC<BatchTabProps> = ({
  batchForm,
  batchOps,
  batchLoading,
  batchExecLoading,
  onExecute,
  onRefresh,
}) => (
  <div>
    <Card title="批量命令执行" style={{ marginBottom: spacing.md }}>
      <Form form={batchForm} layout="vertical" onFinish={onExecute}>
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              name="command"
              label="命令"
              rules={[{ required: true, message: '请输入命令' }]}
            >
              <Input placeholder="例如: uptime" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="targetHosts"
              label="目标主机（逗号分隔）"
              rules={[{ required: true, message: '请输入目标主机' }]}
            >
              <Input placeholder="prod-web-01,prod-api-01" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SendOutlined />}
            loading={batchExecLoading}
          >
            执行批量操作
          </Button>
        </Form.Item>
      </Form>
    </Card>

    <Card
      title="执行历史"
      extra={
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      }
    >
      <Table
        columns={batchColumns}
        dataSource={batchOps}
        loading={batchLoading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  </div>
);
