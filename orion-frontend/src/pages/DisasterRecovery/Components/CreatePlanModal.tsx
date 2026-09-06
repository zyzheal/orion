/**
 * Components/CreatePlanModal.tsx - 新建灾备计划 Modal
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import React from 'react';
import { Modal, Form, Select, InputNumber } from 'antd';

interface CreatePlanModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => Promise<void>;
  confirmLoading: boolean;
  createForm: ReturnType<typeof Form.useForm>[0];
}

export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({
  open,
  onCancel,
  onOk,
  confirmLoading,
  createForm,
}) => (
  <Modal
    title="新建灾备计划"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={confirmLoading}
    width={520}
    okText="创建"
    cancelText="取消"
  >
    <Form form={createForm} layout="vertical" style={{ marginTop: 8 }}>
      <Form.Item
        label="服务名称"
        name="serviceName"
        rules={[{ required: true, message: '请选择服务名称' }]}
      >
        <Select
          placeholder="选择服务"
          options={[
            { value: 'api-gateway', label: 'api-gateway' },
            { value: 'user-service', label: 'user-service' },
            { value: 'db-primary', label: 'db-primary' },
            { value: 'cache-cluster', label: 'cache-cluster' },
            { value: 'pipeline-engine', label: 'pipeline-engine' },
            { value: 'monitor-svc', label: 'monitor-svc' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="RTO（分钟）"
        name="rto"
        rules={[{ required: true, message: '请输入 RTO 目标' }]}
      >
        <InputNumber
          min={1}
          max={600}
          style={{ width: '100%' }}
          placeholder="恢复时间目标（分钟）"
        />
      </Form.Item>
      <Form.Item
        label="RPO（分钟）"
        name="rpo"
        rules={[{ required: true, message: '请输入 RPO 目标' }]}
      >
        <InputNumber
          min={0}
          max={1440}
          style={{ width: '100%' }}
          placeholder="恢复点目标（分钟）"
        />
      </Form.Item>
      <Form.Item
        label="灾备级别"
        name="drLevel"
        initialValue="active-passive"
        rules={[{ required: true, message: '请选择灾备级别' }]}
      >
        <Select
          placeholder="选择灾备级别"
          options={[
            { value: 'active-active', label: '多活 (Active-Active)' },
            { value: 'active-passive', label: '主备 (Active-Passive)' },
            { value: 'backup-restore', label: '备份恢复 (Backup-Restore)' },
          ]}
        />
      </Form.Item>
    </Form>
  </Modal>
);
