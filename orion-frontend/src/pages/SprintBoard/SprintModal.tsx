/**
 * SprintModal - Sprint 创建/编辑 弹窗
 * 抽取自 index.tsx Modal (form instance owned by index.tsx)
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Row, Col } from 'antd';
import { spacing } from '@/tokens';
import type { Sprint } from '@/api/sprints';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

type FormInstance = ReturnType<typeof Form.useForm>[0];

export interface SprintModalProps {
  modalVisible: boolean;
  editingSprint: Sprint | null;
  confirmLoading: boolean;
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const SprintModal: React.FC<SprintModalProps> = ({
  modalVisible,
  editingSprint,
  confirmLoading,
  form,
  onOk,
  onCancel,
}) => (
  <Modal
    title={editingSprint ? '编辑 Sprint' : '创建 Sprint'}
    open={modalVisible}
    onOk={onOk}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.sm }}>
      <Form.Item
        name="name"
        label="Sprint 名称"
        rules={[{ required: true, message: '请输入 Sprint 名称' }]}
      >
        <Input placeholder="例如: Sprint 2024-W28" style={{ height: 36 }} />
      </Form.Item>

      <Form.Item name="goal" label="Sprint 目标">
        <TextArea rows={2} placeholder="本次 Sprint 的核心目标" />
      </Form.Item>

      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item
            name="dateRange"
            label="起止日期"
            rules={[{ required: true, message: '请选择起止日期' }]}
          >
            <RangePicker style={{ width: '100%', height: 36 }} format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="capacity" label="容量 (故事点)">
            <InputNumber placeholder="总故事点" min={0} style={{ width: '100%', height: 36 }} />
          </Form.Item>
        </Col>
      </Row>

      {editingSprint && (
        <Form.Item name="status" label="状态">
          <Select
            options={[
              { value: 'planning', label: '规划中' },
              { value: 'active', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
        </Form.Item>
      )}
    </Form>
  </Modal>
);
