/**
 * CreateClusterModal.tsx - 注册集群弹窗
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */
import React from 'react';
import { Modal, Form, Input, Select, type FormInstance } from 'antd';

interface ClusterFormValues {
  name: string;
  provider: string;
  region: string;
  endpoint?: string;
}

interface CreateClusterModalProps {
  open: boolean;
  form: FormInstance<ClusterFormValues>;
  onCancel: () => void;
  onFinish: (values: ClusterFormValues) => void;
}

export const CreateClusterModal: React.FC<CreateClusterModalProps> = ({ open, form, onCancel, onFinish }) => (
  <Modal title="注册集群" open={open} onCancel={onCancel} onOk={() => form.submit()} width={600}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="集群名称"
        name="name"
        rules={[{ required: true, message: '请输入集群名称' }]}
      >
        <Input placeholder="如: cluster-us-east-1" />
      </Form.Item>
      <Form.Item
        label="提供商"
        name="provider"
        rules={[{ required: true, message: '请选择提供商' }]}
      >
        <Select
          options={[
            { label: 'AWS EKS', value: 'aws' },
            { label: 'Azure AKS', value: 'azure' },
            { label: 'GCP GKE', value: 'gcp' },
            { label: '阿里云 ACK', value: 'aliyun' },
            { label: '自建 K8s', value: 'self-hosted' },
          ]}
        />
      </Form.Item>
      <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
        <Input placeholder="如: us-east-1" />
      </Form.Item>
      <Form.Item label="端点" name="endpoint">
        <Input placeholder="https://k8s-api.example.com" />
      </Form.Item>
    </Form>
  </Modal>
);
