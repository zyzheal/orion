/**
 * CollectionDetail - Detail drawer for a vector collection
 * Shows basic info and document list tabs
 */
import React, { useState, useMemo } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Spin, Form, Input, Select, Button, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Table from 'antd/es/table';
import { Typography, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { VectorCollection, VectorDocument } from '@/api/vector-store';
import dayjs from 'dayjs';
import { statusColorMap, indexTypeLabelMap, metricLabelMap } from './utils';
import { spacing, colors } from '@/tokens';

const { Paragraph, Text } = Typography;

interface CollectionDetailProps {
  collection: VectorCollection | null;
  open: boolean;
  onClose: () => void;
  documents: VectorDocument[];
  docsLoading: boolean;
  onDeleteDoc: (id: string) => void;
  onUpdateCollection?: (name: string, data: { displayName?: string; description?: string; dimensions?: number; indexType?: string; distanceMetric?: string }) => Promise<void>;
}

const CollectionDetail: React.FC<CollectionDetailProps> = ({
  collection,
  open,
  onClose,
  documents,
  docsLoading,
  onDeleteDoc,
  onUpdateCollection,
}) => {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // 进入编辑模式时，用当前集合数据填充表单
  const enterEditMode = () => {
    if (!collection) return;
    form.setFieldsValue({
      displayName: collection.displayName,
      description: collection.description || '',
      dimensions: collection.dimensions,
      indexType: collection.indexType,
      distanceMetric: collection.distanceMetric,
    });
    setEditing(true);
  };

  // 保存集合配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (!collection || !onUpdateCollection) {
        message.error('更新功能暂未就绪');
        setEditing(false);
        setSaving(false);
        return;
      }
      await onUpdateCollection(collection.name, values);
      message.success(`集合 "${collection.displayName}" 更新成功`);
      setEditing(false);
    } catch (err: unknown) {
      if (err instanceof Error && 'errorFields' in err) return;
      const msg = err instanceof Error ? err.message : '更新失败';
      message.error(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditing(false);
    form.resetFields();
  };

  const docColumns: ColumnsType<VectorDocument> = useMemo(
    () => [
      {
        title: '文档内容',
        dataIndex: 'content',
        key: 'content',
        ellipsis: true,
        render: (val: string) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13 }}>
              {val}
            </Paragraph>
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (val: string) => (
          <Tag color={statusColorMap[val] || 'default'}>
            {val === 'active' ? '就绪' : val === 'processing' ? '处理中' : '失败'}
          </Tag>
        ),
      },
      {
        title: '维度',
        dataIndex: 'dimensions',
        key: 'dimensions',
        width: 80,
        render: (val: number) => (
          <Text code style={{ fontSize: 12 }}>
            {val}
          </Text>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (val: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(val).fromNow()}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_: unknown, record: VectorDocument) => (
          <Popconfirm
            title="确认删除该文档？"
            onConfirm={() => {
              setDeletingDocId(record.id);
              onDeleteDoc(record.id);
              setTimeout(() => setDeletingDocId(null), 500);
            }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingDocId === record.id}
            />
          </Popconfirm>
        ),
      },
    ],
    [onDeleteDoc, deletingDocId]
  );

  // 编辑表单
  const editFormContent = useMemo(() => (
    <Form
      form={form}
      layout="vertical"
      style={{ marginTop: spacing.md }}
      initialValues={{
        indexType: 'hnsw',
        distanceMetric: 'cosine',
      }}
    >
      <Form.Item label="显示名称" name="displayName" rules={[{ required: true, message: '请输入显示名称' }]}>
        <Input placeholder="集合显示名称" />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={2} placeholder="集合描述..." />
      </Form.Item>
      <Form.Item label="向量维度" name="dimensions" rules={[{ required: true, message: '请输入向量维度' }]}>
        <Select
          options={[
            { label: '384 (all-MiniLM)', value: 384 },
            { label: '768 (BGE-base)', value: 768 },
            { label: '1024 (BGE-large)', value: 1024 },
            { label: '1536 (OpenAI/Ada)', value: 1536 },
            { label: '3072 (GTE-large)', value: 3072 },
          ]}
        />
      </Form.Item>
      <Form.Item label="索引类型" name="indexType">
        <Select
          options={[
            { label: 'HNSW (推荐)', value: 'hnsw' },
            { label: 'IVF_FLAT', value: 'ivf_flat' },
            { label: 'FLAT (精确)', value: 'flat' },
            { label: 'Annoy', value: 'annoy' },
          ]}
        />
      </Form.Item>
      <Form.Item label="距离度量" name="distanceMetric">
        <Select
          options={[
            { label: '余弦相似度', value: 'cosine' },
            { label: '欧氏距离', value: 'euclidean' },
            { label: '点积', value: 'dot_product' },
          ]}
        />
      </Form.Item>
    </Form>
  ), [form]);

  const detailTabs = useMemo(() => {
    if (!collection) return [];
    const c = collection;

    // 基本信息 Tab 内容
    const infoContent = editing ? (
      <div>
        {editFormContent}
        <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
          <Button icon={<CloseOutlined />} onClick={handleCancelEdit} disabled={saving}>
            取消
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存
          </Button>
        </div>
      </div>
    ) : (
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="集合名称">{c.name}</Descriptions.Item>
        <Descriptions.Item label="显示名称">{c.displayName}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {c.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="文档数量">
          {c.documentCount.toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="向量维度">{c.dimensions}</Descriptions.Item>
        <Descriptions.Item label="索引类型">
          {indexTypeLabelMap[c.indexType] || c.indexType}
        </Descriptions.Item>
        <Descriptions.Item label="距离度量">
          {metricLabelMap[c.distanceMetric] || c.distanceMetric}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[c.status]}>
            {c.status === 'active' ? '活跃' : c.status === 'creating' ? '创建中' : '错误'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(c.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(c.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
      </Descriptions>
    );

    return [
      {
        key: 'info',
        label: '基本信息',
        children: infoContent,
      },
      {
        key: 'documents',
        label: '文档列表',
        children: (
          <Spin spinning={docsLoading}>
            <Table<VectorDocument>
              columns={docColumns}
              dataSource={documents}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Spin>
        ),
      },
    ];
  }, [collection, documents, docsLoading, editing, form, saving, editFormContent, docColumns]);

  return (
    <Drawer
      title={
        <Space>
          {collection ? `${collection.displayName}` : '集合详情'}
          {!editing && onUpdateCollection && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={enterEditMode}
              style={{ marginLeft: spacing.sm }}
            >
              编辑
            </Button>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={800}
      destroyOnClose
    >
      <Tabs items={detailTabs} />
    </Drawer>
  );
};

export default CollectionDetail;
