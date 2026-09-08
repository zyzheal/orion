/**
 * CreateCollectionModal.tsx - 创建向量集合弹窗
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { DIMENSION_OPTIONS, INDEX_TYPE_OPTIONS, METRIC_OPTIONS } from '../constants';

interface CreateCollectionModalProps {
  open: boolean;
  confirmLoading: boolean;
  onCancel: () => void;
  onFinish: (values: any) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  open,
  confirmLoading,
  onCancel,
  onFinish,
}) => (
  <Modal
    title="创建向量集合"
    open={open}
    onCancel={onCancel}
    onOk={() => {
      // form.submit handled internally by Modal.okButton via Form
    }}
    confirmLoading={confirmLoading}
    width={560}
    destroyOnClose
  >
    <Form layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="name"
        label="集合名称 (唯一标识)"
        rules={[{ required: true, message: '请输入集合名称' }]}
      >
        <Input placeholder="如: my-knowledge-base" />
      </Form.Item>
      <Form.Item
        name="displayName"
        label="显示名称"
        rules={[{ required: true, message: '请输入显示名称' }]}
      >
        <Input placeholder="如: 我的知识库" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="集合描述..." />
      </Form.Item>
      <Form.Item
        name="dimensions"
        label="向量维度"
        rules={[{ required: true, message: '请输入向量维度' }]}
        initialValue={1536}
      >
        <Select options={DIMENSION_OPTIONS} />
      </Form.Item>
      <Form.Item name="indexType" label="索引类型" initialValue="hnsw">
        <Select options={INDEX_TYPE_OPTIONS} />
      </Form.Item>
      <Form.Item name="distanceMetric" label="距离度量" initialValue="cosine">
        <Select options={METRIC_OPTIONS} />
      </Form.Item>
    </Form>
  </Modal>
);
