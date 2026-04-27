/**
 * CreateCollectionModal - Modal for creating a new vector collection
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import type { VectorCollection } from '@/api/vector-store';
import { createCollection } from '@/api/vector-store';

interface CreateCollectionModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  collections: VectorCollection[];
  onCollectionsChange: (collections: VectorCollection[]) => void;
}

const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  open,
  onCancel,
  onSuccess,
  collections: _collections,
  onCollectionsChange: _onCollectionsChange,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createCollection({
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        dimensions: parseInt(values.dimensions) || 1536,
        indexType: values.indexType || 'hnsw',
        distanceMetric: values.distanceMetric || 'cosine',
      });
      message.success('集合创建成功');
      setSubmitting(false);
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '创建失败';
      message.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="创建向量集合"
      open={open}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={submitting}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="集合名称 (唯一标识)" rules={[{ required: true, message: '请输入集合名称' }]}>
          <Input placeholder="如: my-knowledge-base" />
        </Form.Item>
        <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
          <Input placeholder="如: 我的知识库" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="集合描述..." />
        </Form.Item>
        <Form.Item
          name="dimensions"
          label="向量维度"
          rules={[{ required: true, message: '请输入向量维度' }]}
          tooltip="OpenAI embeddings 使用 1536 维度"
        >
          <Select options={[
            { label: '384 (all-MiniLM)', value: '384' },
            { label: '768 (BGE-base)', value: '768' },
            { label: '1024 (BGE-large)', value: '1024' },
            { label: '1536 (OpenAI/Ada)', value: '1536' },
            { label: '3072 (GTE-large)', value: '3072' },
          ]} />
        </Form.Item>
        <Form.Item name="indexType" label="索引类型" initialValue="hnsw">
          <Select options={[
            { label: 'HNSW (推荐)', value: 'hnsw' },
            { label: 'IVF_FLAT', value: 'ivf_flat' },
            { label: 'FLAT (精确)', value: 'flat' },
            { label: 'Annoy', value: 'annoy' },
          ]} />
        </Form.Item>
        <Form.Item name="distanceMetric" label="距离度量" initialValue="cosine">
          <Select options={[
            { label: '余弦相似度', value: 'cosine' },
            { label: '欧氏距离', value: 'euclidean' },
            { label: '点积', value: 'dot_product' },
          ]} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateCollectionModal;
