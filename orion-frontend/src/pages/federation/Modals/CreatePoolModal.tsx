/**
 * CreatePoolModal.tsx - 创建资源池弹窗
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Select, type FormInstance } from 'antd';
import type { FederationCluster } from '@/api/federation';

interface PoolFormValues {
  name: string;
  clusterId: string;
  cpuCores: number;
  memoryMb: number;
}

interface CreatePoolModalProps {
  open: boolean;
  form: FormInstance<PoolFormValues>;
  clusters: FederationCluster[];
  onCancel: () => void;
  onFinish: (values: PoolFormValues) => void;
}

export const CreatePoolModal: React.FC<CreatePoolModalProps> = ({ open, form, clusters, onCancel, onFinish }) => (
  <Modal title="创建资源池" open={open} onCancel={onCancel} onOk={() => form.submit()} width={600}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="资源池名称" />
      </Form.Item>
      <Form.Item
        label="目标集群"
        name="clusterId"
        rules={[{ required: true, message: '请选择集群' }]}
      >
        <Select options={clusters.map((c) => ({ label: c.name, value: c.id }))} />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="CPU 核心数"
            name="cpuCores"
            rules={[{ required: true, message: '请输入 CPU 核心数' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="如: 16" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="内存 (MB)"
            name="memoryMb"
            rules={[{ required: true, message: '请输入内存' }]}
          >
            <InputNumber min={1024} step={1024} style={{ width: '100%' }} placeholder="如: 32768" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
