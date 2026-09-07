/**
 * TenantQuotaPage CreateEdit Modal
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Modal, Form, Input, Select, Row, Col } from 'antd';
import type { QuotaPlan } from '@/api/tenantQuota';

const { Option } = Select;
const { TextArea } = Input;

interface CreateEditModalProps {
  selectedPlan: QuotaPlan | null;
  modalOpen: boolean;
  form: import('antd').FormInstance;
  handleSubmit: () => void;
  setModalOpen: (v: boolean) => void;
}

export const CreateEditModal: React.FC<CreateEditModalProps> = ({
  selectedPlan,
  modalOpen,
  form,
  handleSubmit,
  setModalOpen,
}) => (
  <Modal
    title={selectedPlan ? '编辑配额计划' : '新建配额计划'}
    open={modalOpen}
    onOk={handleSubmit}
    onCancel={() => setModalOpen(false)}
    width={600}
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="计划名称"
        rules={[{ required: true, message: '请输入计划名称' }]}
      >
        <Input placeholder="e.g. 企业版" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <TextArea rows={2} />
      </Form.Item>
      <Form.Item name="slaTier" label="SLA 等级">
        <Select>
          <Option value="basic">基础</Option>
          <Option value="standard">标准</Option>
          <Option value="enterprise">企业</Option>
        </Select>
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="apiRateLimitPerMin" label="API/min">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="apiRateLimitPerHour" label="API/hour">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxCIs" label="最大 CI 任务数">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxUsers" label="最大用户数">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxStorageMB" label="最大存储(MB)">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxPipelines" label="最大流水线数">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxConcurrentJobs" label="最大并发任务">
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxAlertsPerDay" label="每日最大告警">
            <Input type="number" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
