/**
 * BasicInfoCard.tsx - Pipeline 基本信息表单
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Card, Form, Input } from 'antd';
import { spacing } from '@/tokens';
import type { PipelineForm } from '../pipelineForm';

interface BasicInfoCardProps {
  form: ReturnType<typeof Form.useForm<any>>[0];
  pipelineInfo: PipelineForm;
  onInfoChange: (info: PipelineForm) => void;
}

export const BasicInfoCard: React.FC<BasicInfoCardProps> = ({
  form,
  pipelineInfo,
  onInfoChange,
}) => (
  <Card style={{ marginBottom: spacing.lg }} title="基本信息">
    <Form form={form} layout="inline" requiredMark>
      <Form.Item
        label="名称"
        name="name"
        rules={[{ required: true, message: '请输入 Pipeline 名称' }]}
      >
        <Input
          placeholder="例如：build-deploy-pipeline"
          style={{ width: 250 }}
          value={pipelineInfo.name}
          onChange={(e) => onInfoChange({ ...pipelineInfo, name: e.target.value })}
        />
      </Form.Item>
      <Form.Item
        label="版本"
        name="version"
        rules={[{ required: true, message: '请输入版本号' }]}
      >
        <Input
          placeholder="例如：1.0.0"
          style={{ width: 120 }}
          value={pipelineInfo.version}
          onChange={(e) => onInfoChange({ ...pipelineInfo, version: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="描述" style={{ flex: 1 }} >
        <Input
          placeholder="可选描述..."
          value={pipelineInfo.description}
          onChange={(e) => onInfoChange({ ...pipelineInfo, description: e.target.value })}
          style={{ width: 300 }}
        />
      </Form.Item>
    </Form>
  </Card>
);
