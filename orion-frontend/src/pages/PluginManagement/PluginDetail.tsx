/**
 * PluginDetail Drawer Component
 * Displays plugin metadata, configuration form, and permissions
 */
import React, { useState } from 'react';
import {
  Typography,
  Badge,
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Descriptions,
  Divider,
  Space,
  Tag,
} from 'antd';
import {
  type ApiPlugin,
  type PluginConfig,
  categoryLabels,
  healthStatusLabels,
} from './types';
import { healthConfig } from './constants';
import { colors } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Props
// ============================================================================

interface PluginDetailDrawerProps {
  plugin: ApiPlugin | null;
  open: boolean;
  onClose: () => void;
  onSaveConfig?: (config: PluginConfig) => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

const PluginDetailDrawer: React.FC<PluginDetailDrawerProps> = ({
  plugin,
  open,
  onClose,
  onSaveConfig,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  if (!plugin) return null;

  const health = healthConfig[plugin.healthStatus || 'healthy'] || healthConfig.healthy;

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSaveConfig?.(values);
      setSaving(false);
    } catch {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={`插件详情 - ${plugin.name}`}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      data-testid="plugin-detail-drawer"
    >
      {/* Plugin metadata */}
      <Descriptions
        title="基本信息"
        column={1}
        bordered
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Descriptions.Item label="插件名称">{plugin.name}</Descriptions.Item>
        <Descriptions.Item label="当前版本">{plugin.version}</Descriptions.Item>
        {plugin.latestVersion && (
          <Descriptions.Item label="最新版本">
            <Badge
              count="可更新"
              style={{ backgroundColor: colors.primary[500] }}
            >
              <Tag color="blue">{plugin.latestVersion}</Tag>
            </Badge>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="描述">{plugin.description}</Descriptions.Item>
        <Descriptions.Item label="作者">{plugin.author}</Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color="cyan">
            {plugin.category ? categoryLabels[plugin.category] : plugin.type}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="安装时间">
          {plugin.installedAt ? dayjs(plugin.installedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="健康状态">
          <Space>
            <span style={{ color: health.color }}>{health.icon}</span>
            <Text style={{ color: health.color }}>
              {plugin.healthStatus ? healthStatusLabels[plugin.healthStatus] : '未知'}
            </Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Badge
            status={plugin.state === 'ACTIVE' ? 'success' : 'default'}
            text={plugin.state === 'ACTIVE' ? '运行中' : plugin.state}
          />
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* Configuration form */}
      <Title level={5}>配置项</Title>
      <Form
        form={form}
        layout="vertical"
        initialValues={plugin.config || {}}
        style={{ marginBottom: 24 }}
      >
        {plugin.configSchema && Object.entries(plugin.configSchema).map(([key, field]) => (
          <Form.Item
            key={key}
            label={(field as { description?: string }).description || key}
            name={key}
            rules={[{ required: (field as { required?: boolean }).required }]}
            initialValue={(field as { default?: unknown }).default}
          >
            {(field as { type?: string }).type === 'boolean' ? (
              <Switch />
            ) : (field as { enum?: string[] }).enum ? (
              <Select>
                {(field as { enum: string[] }).enum.map((val) => (
                  <Select.Option key={val} value={val}>{val}</Select.Option>
                ))}
              </Select>
            ) : (
              <Input placeholder={`输入 ${key} 的值`} />
            )}
          </Form.Item>
        ))}
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSaveConfig}
            loading={saving}
          >
            保存配置
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      {/* Permissions list */}
      {plugin.permissions && plugin.permissions.length > 0 && (
        <>
          <Title level={5}>权限列表</Title>
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              {plugin.permissions.map((perm) => (
                <Tag key={perm} color="geekblue">
                  {perm}
                </Tag>
              ))}
            </Space>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default PluginDetailDrawer;
