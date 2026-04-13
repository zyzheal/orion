/**
 * StageModal - Stage 配置弹窗
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Space, Typography, Divider } from 'antd';
import type { StageConfig } from './index';

const { Title } = Typography;
const { TextArea } = Input;

const STAGE_TYPES = [
  { label: '🔨 构建 (Build)', value: 'build' },
  { label: '🧪 测试 (Test)', value: 'test' },
  { label: '🔍 代码扫描 (Scan)', value: 'scan' },
  { label: '🚀 部署 (Deploy)', value: 'deploy' },
  { label: '📢 通知 (Notify)', value: 'notify' },
  { label: '⚙️ 自定义 (Custom)', value: 'custom' },
];

interface StageModalProps {
  visible: boolean;
  stage: StageConfig | null;
  availableDependencies: { label: string; value: string }[];
  onSave: (values: StageConfig) => void;
  onCancel: () => void;
}

const StageModal: React.FC<StageModalProps> = ({
  visible,
  stage,
  availableDependencies,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (stage) {
      form.setFieldsValue({
        name: stage.name,
        type: stage.type,
        timeout: stage.timeout,
        retryCount: stage.retryCount,
        dependsOn: stage.dependsOn,
        script: stage.config?.script || '',
        command: stage.config?.command || '',
        image: stage.config?.image || '',
        env: stage.config?.env || '',
      });
    } else {
      form.resetFields();
    }
  }, [stage, form, visible]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const stageConfig: StageConfig = {
        id: stage?.id || `stage-${Date.now()}`,
        name: values.name,
        type: values.type,
        timeout: values.timeout,
        retryCount: values.retryCount,
        dependsOn: values.dependsOn,
        config: {
          script: values.script,
          command: values.command,
          image: values.image,
          env: values.env,
        },
      };
      onSave(stageConfig);
    } catch (error) {
      // 验证失败，不处理
    }
  };

  return (
    <Modal
      title={stage ? '编辑阶段' : '添加阶段'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={600}
      okText="保存"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{
          timeout: 300,
          retryCount: 0,
        }}
      >
        <Form.Item
          label="阶段名称"
          name="name"
          rules={[
            { required: true, message: '请输入阶段名称' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
          ]}
        >
          <Input placeholder="例如：build-app" maxLength={50} showCount />
        </Form.Item>

        <Form.Item
          label="阶段类型"
          name="type"
          rules={[{ required: true, message: '请选择阶段类型' }]}
        >
          <Select
            placeholder="选择类型"
            options={STAGE_TYPES}
          />
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>高级设置</Divider>

        <Form.Item
          label="超时时间 (秒)"
          name="timeout"
          tooltip="超过此时间后阶段将被终止"
        >
          <InputNumber
            min={0}
            max={7200}
            step={60}
            style={{ width: '100%' }}
            placeholder="默认 300 秒"
            formatter={(value) => `${value}s`}
            parser={(value) => Number(value?.replace('s', ''))}
          />
        </Form.Item>

        <Form.Item
          label="重试次数"
          name="retryCount"
          tooltip="失败后自动重试的次数"
        >
          <InputNumber
            min={0}
            max={5}
            style={{ width: '100%' }}
            placeholder="默认 0 次"
          />
        </Form.Item>

        <Form.Item
          label="依赖阶段"
          name="dependsOn"
          tooltip="当前阶段执行前需要完成的阶段"
        >
          <Select
            mode="multiple"
            placeholder="选择依赖的阶段"
            options={availableDependencies}
            maxTagCount="responsive"
            allowClear
          />
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>执行配置</Divider>

        <Form.Item
          label="脚本内容"
          name="script"
          tooltip="Shell 脚本内容"
        >
          <TextArea
            rows={4}
            placeholder="#!/bin/bash&#10;echo 'Hello, World!'"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label="执行命令"
          name="command"
          tooltip="直接执行的命令"
          dependencies={['script']}
          rules={[
            {
              validator: (_, value) => {
                const script = form.getFieldValue('script');
                if (!value && !script) {
                  return Promise.resolve(); // 两者都为空也可以
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="例如：npm run build" />
        </Form.Item>

        <Form.Item
          label="Docker 镜像"
          name="image"
          tooltip="执行此阶段的 Docker 镜像"
        >
          <Input placeholder="例如：node:18-alpine" />
        </Form.Item>

        <Form.Item
          label="环境变量"
          name="env"
          tooltip="格式：KEY=VALUE，每行一个"
        >
          <TextArea
            rows={3}
            placeholder="NODE_ENV=production&#10;API_URL=https://api.example.com"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StageModal;
