/**
 * Builder Image List Page
 * CRUD table for builder images with search, filters, modal form, and actions.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  message,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined, PictureOutlined,} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getBuilderImages,
  createBuilderImage,
  updateBuilderImage,
  deleteBuilderImage,
  deprecateBuilderImage,
  restoreBuilderImage,
  type BuilderImage,
  type BuilderImageInput,
  type UpdateBuilderImageInput,
} from '@/api/build-env';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BuilderImageList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<BuilderImage | null>(null);
  const [form] = Form.useForm<BuilderImageInput>();

  const loadImages = async () => {
    setLoading(true);
    try {
      const response = await getBuilderImages();
      const apiData = response.data;
      setImages(Array.isArray(apiData) ? apiData : (apiData as { items?: unknown[] })?.items ?? []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载构建镜像失败：${error.message}`);
      } else {
        message.error('加载构建镜像失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const filteredImages = useMemo(() => {
    return images.filter((image) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [image.name, image.type, image.baseImage, image.version]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const typeFilter = filters.type;
      if (typeFilter && typeFilter !== 'all' && image.type !== typeFilter) return false;
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && image.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, filters, images]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingImage) {
        const updateData: UpdateBuilderImageInput = {
          name: values.name,
          baseImage: values.baseImage,
          version: values.version,
        };
        await updateBuilderImage(editingImage.id, updateData);
        message.success('Builder image updated');
      } else {
        await createBuilderImage(values);
        message.success('Builder image created');
      }
      setModalOpen(false);
      setEditingImage(null);
      form.resetFields();
      loadImages();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (err.errorFields) return;
      if (error instanceof Error) {
        message.error(`保存构建镜像失败：${error.message}`);
      } else {
        message.error('保存构建镜像失败，请稍后重试');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBuilderImage(id);
      message.success('Builder image deleted');
      loadImages();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除构建镜像失败：${error.message}`);
      } else {
        message.error('删除构建镜像失败，请稍后重试');
      }
    }
  };

  const handleToggleDeprecated = async (image: BuilderImage) => {
    try {
      if (image.status === 'deprecated') {
        await restoreBuilderImage(image.id);
        message.success('Builder image restored');
      } else {
        await deprecateBuilderImage(image.id);
        message.success('Builder image deprecated');
      }
      loadImages();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新状态失败：${error.message}`);
      } else {
        message.error('更新状态失败，请稍后重试');
      }
    }
  };

  const openCreateModal = () => {
    setEditingImage(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (image: BuilderImage) => {
    setEditingImage(image);
    form.setFieldsValue({
      name: image.name,
      type: image.type,
      baseImage: image.baseImage,
      version: image.version,
    });
    setModalOpen(true);
  };

  const filterDefs: FilterDefinition[] = [
    {
      key: 'type',
      label: 'Type',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Node.js', value: 'nodejs' },
        { label: 'Go', value: 'go' },
        { label: 'Java', value: 'java' },
        { label: 'Python', value: 'python' },
        { label: 'Custom', value: 'custom' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Deprecated', value: 'deprecated' },
        { label: 'Building', value: 'building' },
      ],
    },
  ];

  const columns: TableColumn<BuilderImage>[] = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (_value, record) => (
        <Text strong style={{ color: colors.primary[500] }}>
          {record.name}
        </Text>
      ),
    },
    {
      key: 'type',
      title: 'Type',
      dataIndex: 'type',
      width: 120,
      render: (value) => {
        const colorMap: Record<string, string> = {
          nodejs: 'green',
          go: 'cyan',
          java: 'orange',
          python: 'blue',
          custom: 'purple',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      key: 'baseImage',
      title: 'Base Image',
      dataIndex: 'baseImage',
      width: 250,
      render: (value) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'version',
      title: 'Version',
      dataIndex: 'version',
      width: 100,
      render: (value) => <Text>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (value) => {
        const statusMap: Record<string, unknown> = {
          active: 'success',
          deprecated: 'warning',
          building: 'running',
        };
        return <StatusBadge status={statusMap[String(value)] || 'unknown'} size="small" />;
      },
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      dataIndex: 'updatedAt',
      width: 140,
      sortable: true,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 180,
      render: (_: unknown, record: BuilderImage) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEditModal(record)}>
            Edit
          </Button>
          <Button type="link" size="small" onClick={() => handleToggleDeprecated(record)}>
            {record.status === 'deprecated' ? 'Restore' : 'Deprecate'}
          </Button>
          <Popconfirm
            title="Delete this builder image?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button type="link" size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <PictureOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Builder Images
          </Title>
          <Text type="secondary">{filteredImages.length} builder images</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadImages} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Add Image
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="Search by name, type, base image..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredImages}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      <Modal
        title={editingImage ? 'Edit Builder Image' : 'Add Builder Image'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setEditingImage(null);
          form.resetFields();
        }}
        okText={editingImage ? 'Update' : 'Create'}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. node-builder" />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: 'Please select a type' }]}
          >
            <Select placeholder="Select type">
              <Select.Option value="nodejs">Node.js</Select.Option>
              <Select.Option value="go">Go</Select.Option>
              <Select.Option value="java">Java</Select.Option>
              <Select.Option value="python">Python</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="baseImage"
            label="Base Image"
            rules={[{ required: true, message: 'Please enter a base image' }]}
          >
            <Input placeholder="e.g. node:20-alpine" />
          </Form.Item>
          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: true, message: 'Please enter a version' }]}
          >
            <Input placeholder="e.g. 1.0.0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BuilderImageList;
