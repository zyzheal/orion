/**
 * PluginCreateModal Component
 * Form to install a new plugin from available plugins
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Space, message } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { getAvailablePlugins, installPlugin, type Plugin } from '@/api/plugins';

// ============================================================================
// Props
// ============================================================================

interface PluginCreateModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

// ============================================================================
// Component
// ============================================================================

const PluginCreateModal: React.FC<PluginCreateModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [installing, setInstalling] = useState(false);
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>([]);

  // Load available plugins when modal opens
  useEffect(() => {
    if (open) {
      getAvailablePlugins({})
        .then((res) => {
          setAvailablePlugins(res.data?.data || []);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) {
            message.error(`加载可用插件失败：${err.message}`);
          } else {
            message.error('加载可用插件失败，请稍后重试');
          }
        });
    }
  }, [open]);

  const handleInstall = async () => {
    try {
      const values = await form.validateFields();
      setInstalling(true);

      await installPlugin(values.pluginId, {
        version: values.version !== 'latest' ? values.version : undefined,
      });

      message.success(`插件 ${values.pluginId} 安装成功`);
      form.resetFields();
      setInstalling(false);
      onSuccess();
    } catch (err: unknown) {
      setInstalling(false);
      const errObj = err as { response?: { status?: number }; errorFields?: unknown };
      if (errObj.response?.status === 400) return;
      if (errObj.errorFields) return;
      if (err instanceof Error) {
        message.error(`安装失败：${err.message}`);
      } else {
        message.error('安装失败，请稍后重试');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CloudDownloadOutlined />
          安装插件
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleInstall}
      confirmLoading={installing}
      okText="安装"
      cancelText="取消"
      data-testid="install-plugin-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="选择插件"
          name="pluginId"
          rules={[{ required: true, message: '请选择插件' }]}
        >
          <Select placeholder="选择要安装的插件" data-testid="plugin-select">
            {availablePlugins.map((plugin) => (
              <Select.Option key={plugin.id} value={plugin.id}>
                {plugin.name} ({plugin.version})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="版本"
          name="version"
          rules={[{ required: true, message: '请选择版本' }]}
          initialValue="latest"
        >
          <Select data-testid="plugin-version-select">
            <Select.Option value="latest">最新版本</Select.Option>
            <Select.Option value="stable">稳定版本</Select.Option>
            <Select.Option value="beta">测试版本</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PluginCreateModal;
