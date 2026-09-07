/**
 * PR Trigger create/edit modal
 */
import React from 'react';
import { Divider, Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { PRTriggerRule } from '@/api/prTriggers';
import PRTriggerConfig from '@/components/PRTriggerConfig';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';
import type { PRTriggerFormValues } from '../types';

interface PRTriggerModalProps {
  open: boolean;
  editingRule: PRTriggerRule | null;
  form: FormInstance<PRTriggerFormValues>;
  pipelines: Array<{ label: string; value: string }>;
  prConfig: Partial<PRTriggerConfigType>;
  onPrConfigChange: (v: Partial<PRTriggerConfigType>) => void;
  onOk: () => void;
  onCancel: () => void;
}

export const PRTriggerModal: React.FC<PRTriggerModalProps> = ({
  open,
  editingRule,
  form,
  pipelines,
  prConfig,
  onPrConfigChange,
  onOk,
  onCancel,
}) => (
  <Modal
    title={editingRule ? '编辑 PR 触发规则' : '添加 PR 触发规则'}
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    width={900}
  >
    <Form form={form} layout="vertical" requiredMark>
      <Form.Item
        label="目标流水线"
        name="pipelineId"
        rules={[{ required: true, message: '请选择流水线' }]}
      >
        <Select
          placeholder="选择流水线"
          options={pipelines}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      <Form.Item
        label="仓库"
        name="repository"
        rules={[{ required: true, message: '请输入仓库名称' }]}
        tooltip="格式: owner/repo"
      >
        <Input placeholder="例如: myorg/myapp" />
      </Form.Item>
    </Form>

    <Divider orientation="left" orientationMargin={0}>
      触发规则配置
    </Divider>

    <PRTriggerConfig value={prConfig} onChange={onPrConfigChange} />
  </Modal>
);
