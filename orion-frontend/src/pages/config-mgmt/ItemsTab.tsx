/**
 * ItemsTab - 配置项管理 Tab
 */
import React from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Divider,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ConfigItem } from '@/api/distributedConfig';
import { useItemColumns } from './columns';

const { Text } = Typography;
const { Option } = Select;

export interface ItemsTabProps {
  loading: boolean;
  items: ConfigItem[];
  namespaces: any[];
  groups: any[];
  selectedNamespace: string | undefined;
  setSelectedNamespace: (v: string | undefined) => void;
  selectedGroup: string | undefined;
  setSelectedGroup: (v: string | undefined) => void;
  itemModalOpen: boolean;
  setItemModalOpen: (v: boolean) => void;
  editingItem: ConfigItem | null;
  setEditingItem: (v: ConfigItem | null) => void;
  itemForm: ReturnType<typeof Form.useForm>[0];
  nsModalOpen: boolean;
  setNsModalOpen: (v: boolean) => void;
  groupForm: ReturnType<typeof Form.useForm>[0];
  loadItems: () => void;
  handleCreateItem: (values: any) => void;
  handleUpdateItem: (id: string, values: any) => void;
  handleDeleteItem: (id: string) => void;
  handleViewHistory: (item: ConfigItem) => void;
  handleCreateGroup: (values: any) => void;
}

export const ItemsTab: React.FC<ItemsTabProps> = ({
  loading,
  items,
  namespaces,
  groups,
  selectedNamespace,
  setSelectedNamespace,
  selectedGroup,
  setSelectedGroup,
  itemModalOpen,
  setItemModalOpen,
  editingItem,
  setEditingItem,
  itemForm,
  nsModalOpen,
  setNsModalOpen,
  groupForm,
  loadItems,
  handleCreateItem,
  handleUpdateItem,
  handleDeleteItem,
  handleViewHistory,
  handleCreateGroup,
}) => {
  const columns = useItemColumns({
    onEdit: (record) => {
      setEditingItem(record);
      itemForm.setFieldsValue({
        value: record.value,
        valueType: record.valueType,
        encrypted: record.encrypted,
        description: record.description,
      });
      setItemModalOpen(true);
    },
    onHistory: handleViewHistory,
    onDelete: handleDeleteItem,
  });

  return (
    <Card
      title="配置项列表"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} size="small" onClick={loadItems} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingItem(null);
              itemForm.resetFields();
              setItemModalOpen(true);
            }}
          >
            新增配置
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: spacing.md }} size={spacing.sm}>
        <Text type="secondary">命名空间：</Text>
        <Select
          style={{ width: 160 }}
          value={selectedNamespace}
          onChange={setSelectedNamespace}
          allowClear
          placeholder="选择命名空间"
        >
          {namespaces.map((n) => (
            <Option key={n.id} value={n.id}>
              {n.name}
            </Option>
          ))}
        </Select>
        <Text type="secondary">分组：</Text>
        <Select
          style={{ width: 180 }}
          value={selectedGroup}
          onChange={setSelectedGroup}
          allowClear
          placeholder="选择分组"
        >
          {groups.map((g) => (
            <Option key={g.id} value={g.id}>
              {g.name}
            </Option>
          ))}
        </Select>
        <Divider type="vertical" style={{ height: 24 }} />
        <Space>
          <Text type="secondary">新建命名空间：</Text>
          <Button size="small" onClick={() => setNsModalOpen(true)}>
            创建
          </Button>
          <Text type="secondary">新建分组：</Text>
          <Button
            size="small"
            onClick={() => {
              if (!selectedNamespace) {
                message.warning('请先选择命名空间');
                return;
              }
              groupForm.setFieldsValue({ namespaceId: selectedNamespace });
              Modal.confirm({
                title: '新建配置分组',
                content: (
                  <Form form={groupForm} layout="vertical">
                    <Form.Item name="name" label="分组名称" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                      <Input />
                    </Form.Item>
                  </Form>
                ),
                onOk: () =>
                  groupForm.validateFields().then((values) => handleCreateGroup(values)),
              });
              groupForm.resetFields();
            }}
          >
            创建
          </Button>
        </Space>
      </Space>
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small"
      />
    </Card>
  );
};
