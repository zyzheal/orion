/**
 * CreateExperimentModal.tsx - 创建混沌实验弹窗
 * 抽取自 ChaosEngineering/index.tsx (P2-9 Phase 91)
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Alert,
  Row,
  Col,
  type FormInstance,
} from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import { faultTypeConfig } from '../constants';

interface CreateExperimentFormValues {
  name: string;
  description?: string;
  serviceId?: string;
  environment: string;
  faultTypes: string[];
  duration?: number;
  severity?: string;
  labels?: string;
  steadyState?: string;
}

interface CreateExperimentModalProps {
  open: boolean;
  submitting: boolean;
  form: FormInstance<CreateExperimentFormValues>;
  onCancel: () => void;
  onFinish: (values: CreateExperimentFormValues) => void;
}

export const CreateExperimentModal: React.FC<CreateExperimentModalProps> = ({
  open,
  submitting,
  form,
  onCancel,
  onFinish,
}) => (
  <Modal
    title={
      <>
        <ExperimentOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        创建混沌实验
      </>
    }
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    width={640}
    destroyOnClose
  >
    <Alert
      message="混沌实验将在指定环境中注入故障"
      description="请确保实验范围正确，生产环境实验需要额外审批"
      type="warning"
      showIcon
      style={{ marginBottom: spacing.md }}
    />
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="name"
        label="实验名称"
        rules={[{ required: true, message: '请输入实验名称' }]}
      >
        <Input placeholder="如: API 服务延迟注入实验" />
      </Form.Item>
      <Form.Item name="description" label="实验描述">
        <Input.TextArea rows={2} placeholder="描述实验目的和预期效果..." />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="environment"
            label="目标环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              options={[
                { value: 'staging', label: '预发环境' },
                { value: 'production', label: '生产环境（需要审批）' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="serviceId" label="目标服务 (可选)">
            <Input placeholder="如: api-service" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="faultTypes"
        label="故障类型"
        rules={[{ required: true, message: '请选择至少一种故障类型' }]}
      >
        <Select
          mode="multiple"
          placeholder="选择故障注入类型"
          options={Object.entries(faultTypeConfig).map(([k, v]) => ({
            value: k,
            label: v.label,
          }))}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="duration" label="故障持续时间 (秒)" initialValue={60}>
            <InputNumber min={10} max={600} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="severity" label="严重程度" initialValue="medium">
            <Select
              options={[
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="labels" label="目标标签 (JSON, 可选)">
        <Input.TextArea rows={2} placeholder='如: {"app": "api-service"}' />
      </Form.Item>
      <Form.Item name="steadyState" label="稳态假设 (可选)">
        <Input.TextArea rows={2} placeholder="描述系统在故障注入前应具备的稳态特征..." />
      </Form.Item>
    </Form>
  </Modal>
);
