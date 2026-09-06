/**
 * CreateJobModal.tsx - 提交跨集群作业弹窗
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */
import React from 'react';
import { Modal, Form, Input, Select, type FormInstance } from 'antd';
import type { FederationCluster } from '@/api/federation';

interface JobFormValues {
  name: string;
  targetClusters: string[];
}

interface CreateJobModalProps {
  open: boolean;
  form: FormInstance<JobFormValues>;
  clusters: FederationCluster[];
  onCancel: () => void;
  onFinish: (values: JobFormValues) => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ open, form, clusters, onCancel, onFinish }) => (
  <Modal title="提交跨集群作业" open={open} onCancel={onCancel} onOk={() => form.submit()} width={600}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="作业名称"
        name="name"
        rules={[{ required: true, message: '请输入作业名称' }]}
      >
        <Input placeholder="作业名称" />
      </Form.Item>
      <Form.Item
        label="目标集群"
        name="targetClusters"
        rules={[{ required: true, message: '请选择目标集群' }]}
      >
        <Select mode="multiple" options={clusters.map((c) => ({ label: c.name, value: c.id }))} />
      </Form.Item>
    </Form>
  </Modal>
);
