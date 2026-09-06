/**
 * SLAModals.tsx - SLA Management 2 个 Modal
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 * Def Modal (Create/Edit) + Tracking Modal
 * 2 个 Form 实例由主页面通过 props 传入
 * onOk 调用主页面 wrapper (validateFields + hook handler + resetFields)
 */
import React from 'react';
import { Modal, Form, Input, Select, Row, Col, InputNumber, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { SLADefinition } from '@/api/sla';
import {
  TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  TARGET_UNIT_OPTIONS,
  ENTITY_TYPE_OPTIONS,
} from './config';

// ============================================================================
// Props
// ============================================================================

export interface SLAModalsProps {
  // Def Modal
  defModalVisible: boolean;
  setDefModalVisible: (v: boolean) => void;
  editingDef: SLADefinition | null;
  setEditingDef: (v: SLADefinition | null) => void;
  defForm: FormInstance;
  handleSaveDefinition: () => void | Promise<void>;
  // Tracking Modal
  trackingModalVisible: boolean;
  setTrackingModalVisible: (v: boolean) => void;
  trackingForm: FormInstance;
  handleCreateTracking: () => void | Promise<void>;
  definitions: SLADefinition[];
}

// ============================================================================
// Component
// ============================================================================

export const SLAModals: React.FC<SLAModalsProps> = (props) => {
  const {
    defModalVisible,
    setDefModalVisible,
    editingDef,
    setEditingDef,
    defForm,
    handleSaveDefinition,
    trackingModalVisible,
    setTrackingModalVisible,
    trackingForm,
    handleCreateTracking,
    definitions,
  } = props;

  return (
    <>
      <Modal
        title={editingDef ? '编辑 SLA 定义' : '创建 SLA 定义'}
        open={defModalVisible}
        onCancel={() => {
          setDefModalVisible(false);
          setEditingDef(null);
          defForm.resetFields();
        }}
        onOk={handleSaveDefinition}
        width={600}
        destroyOnClose
        okText={editingDef ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={defForm} layout="vertical" initialValues={{ business_hours_only: false }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 SLA 名称' }]}>
            <Input placeholder="例如: P1 事件响应 SLA" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="SLA 定义的详细描述" />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select placeholder="选择类型" options={[TYPE_OPTIONS].slice()} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级">
                <Select placeholder="选择优先级" allowClear options={[PRIORITY_OPTIONS].slice()} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item name="target_value" label="目标值" rules={[{ required: true, message: '请输入目标值' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="例如: 30" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_unit" label="目标单位" rules={[{ required: true, message: '请选择单位' }]}>
                <Select placeholder="选择单位" options={[TARGET_UNIT_OPTIONS].slice()} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="category" label="分类">
            <Input placeholder="例如: incident, change, request" />
          </Form.Item>
          <Form.Item name="business_hours_only" label="仅工作时间" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建追踪记录"
        open={trackingModalVisible}
        onCancel={() => {
          setTrackingModalVisible(false);
          trackingForm.resetFields();
        }}
        onOk={handleCreateTracking}
        width={520}
        destroyOnClose
        okText="创建"
        cancelText="取消"
      >
        <Form form={trackingForm} layout="vertical">
          <Form.Item name="sla_definition_id" label="SLA 定义" rules={[{ required: true, message: '请选择 SLA 定义' }]}>
            <Select
              placeholder="选择 SLA 定义"
              showSearch
              optionFilterProp="label"
              options={definitions.map((d) => ({
                label: `${d.name} (${d.target_value} ${d.target_unit})`,
                value: d.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="entity_type" label="实体类型" rules={[{ required: true, message: '请选择实体类型' }]}>
            <Select placeholder="选择实体类型" options={[ENTITY_TYPE_OPTIONS].slice()} />
          </Form.Item>
          <Form.Item name="entity_id" label="实体 ID" rules={[{ required: true, message: '请输入实体 ID' }]}>
            <Input placeholder="关联的事件/请求/变更 ID" />
          </Form.Item>
          <Form.Item name="target_time" label="目标时间" rules={[{ required: true, message: '请输入目标时间' }]}>
            <Input placeholder="ISO 格式，例如: 2026-06-15T18:00:00Z" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
