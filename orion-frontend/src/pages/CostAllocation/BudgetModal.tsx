/**
 * BudgetModal.tsx - 预算创建/编辑弹窗
 * 抽取自 CostAllocation/index.tsx (P2-9 Phase 72)
 */
import React from 'react';
import { Modal, Form, Input, Select, Row, Col, InputNumber, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { FinopsBudget } from '@/api/cost-allocation';

interface BudgetModalProps {
  open: boolean;
  form: FormInstance;
  editingBudget: FinopsBudget | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  open,
  form,
  editingBudget,
  confirmLoading,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title={editingBudget ? '编辑预算' : '创建预算'}
      open={open}
      onOk={onOk}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="预算名称"
          rules={[{ required: true, message: '请输入预算名称' }]}
        >
          <Input placeholder="例如：生产集群-计算预算" style={{ height: 36 }} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="scopeType"
              label="范围类型"
              rules={[{ required: true, message: '请选择范围类型' }]}
            >
              <Select placeholder="选择范围类型" style={{ height: 36 }}>
                <Select.Option value="cluster">集群</Select.Option>
                <Select.Option value="namespace">命名空间</Select.Option>
                <Select.Option value="team">团队</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="scopeValue"
              label="范围值"
              rules={[{ required: true, message: '请输入范围值' }]}
            >
              <Input placeholder="例如：prod-cluster" style={{ height: 36 }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="monthlyLimit"
              label="月度限额"
              rules={[{ required: true, message: '请输入月度限额' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%', height: 36 }}
                placeholder="例如：50000"
                addonAfter="CNY"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="alertThreshold" label="告警阈值 (%)">
              <InputNumber
                min={1}
                max={100}
                style={{ width: '100%', height: 36 }}
                placeholder="80"
                addonAfter="%"
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="currency" label="币种">
              <Select style={{ height: 36 }}>
                <Select.Option value="CNY">CNY (人民币)</Select.Option>
                <Select.Option value="USD">USD (美元)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
