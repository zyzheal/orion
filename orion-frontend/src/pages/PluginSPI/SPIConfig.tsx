/**
 * SPIConfig Component
 * SPI configuration table with add/edit/delete modal
 */
import React from 'react';
import { Typography, Space, Tag, Badge, Button, Tooltip, Modal, Form, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { spacing } from '@/tokens';
import { type SPIConfig, spiTypeLabelMap, fallbackStrategies } from './types';

const { Text } = Typography;

// ============================================================================
// Props
// ============================================================================

interface SPIConfigProps {
  spiConfigs: SPIConfig[];
  loading: boolean;
  configModalVisible: boolean;
  editingConfig: SPIConfig | null;
  submitting: boolean;
  configForm: any; // FormInstance
  onOpenAddConfig: () => void;
  onOpenEditConfig: (config: SPIConfig) => void;
  onCloseConfigModal: () => void;
  onSaveConfig: () => void;
  onDeleteConfig: (id: string) => void;
}

// ============================================================================
// Component
// ============================================================================

const SPIConfig: React.FC<SPIConfigProps> = ({
  spiConfigs,
  loading,
  configModalVisible,
  editingConfig,
  submitting,
  configForm,
  onOpenAddConfig,
  onOpenEditConfig,
  onCloseConfigModal,
  onSaveConfig,
  onDeleteConfig,
}) => {
  // Table columns
  const columns: TableColumn<SPIConfig>[] = [
    {
      key: 'spiType',
      title: 'SPI 类型',
      dataIndex: 'spiType',
      width: 150,
      render: (value: unknown) => (
        <Tag color="purple">{spiTypeLabelMap[String(value)] || String(value)}</Tag>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      width: 80,
      render: (_: unknown, record: SPIConfig) => (
        <Badge
          status={record.enabled ? 'success' : 'default'}
          text={record.enabled ? '已启用' : '已禁用'}
        />
      ),
    },
    {
      key: 'maxPlugins',
      title: '最大插件数',
      dataIndex: 'maxPlugins',
      width: 100,
    },
    {
      key: 'timeout',
      title: '超时时间',
      dataIndex: 'timeout',
      width: 100,
      render: (value: unknown) => <Text>{`${value}ms`}</Text>,
    },
    {
      key: 'fallbackStrategy',
      title: '回退策略',
      dataIndex: 'fallbackStrategy',
      width: 120,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: SPIConfig) => (
        <Space size="small">
          <Tooltip title="编辑配置">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onOpenEditConfig(record)}
            />
          </Tooltip>
          <Tooltip title="删除配置">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDeleteConfig(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: spacing[4] }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onOpenAddConfig}>
          添加 SPI 配置
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={spiConfigs}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* SPI Config Modal */}
      <Modal
        title={editingConfig ? '编辑 SPI 配置' : '添加 SPI 配置'}
        open={configModalVisible}
        onCancel={onCloseConfigModal}
        onOk={onSaveConfig}
        confirmLoading={submitting}
        width={520}
        destroyOnClose
      >
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="spiType"
            label="SPI 类型"
            rules={[{ required: true, message: '请选择 SPI 类型' }]}
          >
            <Select>
              {Object.entries(spiTypeLabelMap).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Select>
              <Select.Option value={true}>已启用</Select.Option>
              <Select.Option value={false}>已禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="maxPlugins"
            label="最大插件数"
            rules={[{ required: true, message: '请输入最大插件数' }]}
            initialValue={10}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            name="timeout"
            label="超时时间 (毫秒)"
            rules={[{ required: true, message: '请输入超时时间' }]}
            initialValue={5000}
          >
            <Input type="number" min={100} step={100} />
          </Form.Item>
          <Form.Item
            name="fallbackStrategy"
            label="回退策略"
            rules={[{ required: true, message: '请选择回退策略' }]}
            initialValue="reject"
          >
            <Select>
              {fallbackStrategies.map((s) => (
                <Select.Option key={s.value} value={s.value}>
                  {s.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SPIConfig;
