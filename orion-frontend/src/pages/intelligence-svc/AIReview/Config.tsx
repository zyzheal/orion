/**
 * AI Review - Config
 * AI Review configuration management
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Form, Input, Button, Select, message, Divider, Space } from 'antd';
import { spacing } from '@/tokens';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { getReviewConfig, updateReviewConfig } from '@/api/ai-review';
import type { AIReviewConfig } from '@/api/ai-review';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AIReviewConfig: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await getReviewConfig();
      const config = res.data.data;
      if (config) {
        form.setFieldsValue(config);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载配置失败：${error.message}`);
      } else {
        message.error('加载配置失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (values: AIReviewConfig) => {
    setSaving(true);
    try {
      await updateReviewConfig(values);
      message.success('配置已保存');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存配置失败：${error.message}`);
      } else {
        message.error('保存配置失败，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadConfig();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            评审配置
          </Title>
          <Text type="secondary">配置 AI Review 的模型、提示模板和评审范围</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset} loading={loading}>
            重置
          </Button>
        </Space>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={loading}
          initialValues={{ model: 'gpt-4', reviewScope: 'diff' }}
        >
          <Form.Item
            name="model"
            label="AI 模型"
            rules={[{ required: true, message: '请选择 AI 模型' }]}
          >
            <Select placeholder="选择模型">
              <Select.Option value="gpt-4">GPT-4</Select.Option>
              <Select.Option value="gpt-4-turbo">GPT-4 Turbo</Select.Option>
              <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
              <Select.Option value="claude-3-opus">Claude 3 Opus</Select.Option>
              <Select.Option value="claude-3-sonnet">Claude 3 Sonnet</Select.Option>
              <Select.Option value="claude-3-haiku">Claude 3 Haiku</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reviewScope"
            label="评审范围"
            rules={[{ required: true, message: '请选择评审范围' }]}
          >
            <Select>
              <Select.Option value="diff">仅 Diff</Select.Option>
              <Select.Option value="files">修改的文件</Select.Option>
              <Select.Option value="full">完整仓库</Select.Option>
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item
            name="promptTemplate"
            label="提示模板"
            rules={[{ required: true, message: '请输入提示模板' }]}
          >
            <TextArea
              rows={12}
              placeholder="请输入 AI Review 的提示模板..."
              style={{ fontFamily: 'monospace', fontSize: spacing[3] }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Config Tips */}
      <Card title="配置说明" style={{ marginTop: 16 }}>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            <Text strong>AI 模型：</Text>选择用于代码评审的 AI
            模型，不同模型在速度和准确性上有所差异
          </li>
          <li>
            <Text strong>评审范围：</Text>决定 AI 审查的代码范围，Diff
            模式只审查变更行，完整仓库模式审查整个代码库
          </li>
          <li>
            <Text strong>提示模板：</Text>自定义 AI 评审的提示词，可用变量包括 {'{'}diff{'}'}, {'{'}
            file{'}'}, {'{'}language{'}'} 等
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default AIReviewConfig;
