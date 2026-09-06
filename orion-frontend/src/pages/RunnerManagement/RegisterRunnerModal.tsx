/**
 * RegisterRunnerModal.tsx - 注册/编辑 Runner Modal
 * 抽取自 RunnerManagement/index.tsx (P2-9 Phase 59)
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { spacing } from '@/tokens';
import {
  registerRunner,
  updateRunner,
  type Runner,
} from '@/api/runners';

interface RegisterRunnerModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  runner?: Runner | null;
}

export const RegisterRunnerModal: React.FC<RegisterRunnerModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  runner,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const isEdit = !!runner;

  useEffect(() => {
    if (visible && runner) {
      form.setFieldsValue({
        name: runner.name,
        maxConcurrent: runner.maxConcurrent,
        endpoint: runner.endpoint,
        os: runner.metadata?.os,
        arch: runner.metadata?.arch,
      });
      setLabels(runner.labels || []);
    } else if (visible && !runner) {
      form.resetFields();
      setLabels([]);
    }
  }, [visible, runner, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit && runner) {
        await updateRunner(runner.id, {
          name: values.name,
          labels,
          maxConcurrent: values.maxConcurrent || 1,
          endpoint: values.endpoint,
          metadata: {
            os: values.os,
            arch: values.arch,
          },
        });
        message.success('Runner 更新成功');
      } else {
        await registerRunner({
          name: values.name,
          labels,
          maxConcurrent: values.maxConcurrent || 1,
          endpoint: values.endpoint,
          metadata: {
            os: values.os,
            arch: values.arch,
          },
        });
        message.success('Runner 注册成功');
      }
      form.resetFields();
      setLabels([]);
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`${isEdit ? '更新' : '注册'}失败：${error.message}`);
      } else {
        message.error(`${isEdit ? '更新' : '注册'}失败，请稍后重试`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑 Runner' : '注册 Runner'}
      open={visible}
      onCancel={() => {
        onCancel();
        setLabels([]);
      }}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={isEdit ? '保存' : '注册'}
      cancelText="取消"
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="Runner 名称"
          rules={[{ required: true, message: '请输入 Runner 名称' }]}
        >
          <Input placeholder="例如：runner-build-01" />
        </Form.Item>

        <Form.Item label="标签">
          <Select
            mode="tags"
            placeholder="输入标签后回车，例如：linux, docker, node18"
            value={labels}
            onChange={setLabels}
            tokenSeparators={[',', ' ']}
          />
        </Form.Item>

        <Form.Item
          name="maxConcurrent"
          label="最大并发任务数"
          rules={[{ required: true, message: '请输入最大并发数' }]}
        >
          <InputNumber min={1} max={32} style={{ width: '100%' }} placeholder="默认 1" />
        </Form.Item>

        <Form.Item name="endpoint" label="Runner 端点地址（可选）">
          <Input placeholder="例如：http://runner-01:8080" />
        </Form.Item>

        <Form.Item name="os" label="操作系统（可选）">
          <Select placeholder="选择操作系统">
            <Select.Option value="linux">Linux</Select.Option>
            <Select.Option value="macos">macOS</Select.Option>
            <Select.Option value="windows">Windows</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="arch" label="CPU 架构（可选）">
          <Select placeholder="选择架构">
            <Select.Option value="x86_64">x86_64</Select.Option>
            <Select.Option value="arm64">arm64</Select.Option>
            <Select.Option value="aarch64">aarch64</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};
