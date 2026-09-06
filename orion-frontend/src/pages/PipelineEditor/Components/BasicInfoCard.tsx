/**
 * BasicInfoCard - Pipeline 基本信息 inline 表单
 * 抽取自 index.tsx (P2-9 Phase 104)
 */
import React from 'react';
import { Card, Form, Input } from 'antd';
import { spacing } from '@/tokens';
import type { PipelineForm } from '../pipelineForm';

interface BasicInfoCardProps {
  form: React.ComponentProps<typeof Form>['form'];
  pipelineInfo: PipelineForm;
  setPipelineInfo: React.Dispatch<React.SetStateAction<PipelineForm>>;
}

export const BasicInfoCard: React.FC<BasicInfoCardProps> = ({
  form,
  pipelineInfo,
  setPipelineInfo,
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
          onChange={(e) => setPipelineInfo({ ...pipelineInfo, name: e.target.value })}
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
          onChange={(e) => setPipelineInfo({ ...pipelineInfo, version: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="描述">
        <Input
          placeholder="可选描述..."
          value={pipelineInfo.description}
          onChange={(e) => setPipelineInfo({ ...pipelineInfo, description: e.target.value })}
          style={{ width: 300 }}
        />
      </Form.Item>
    </Form>
  </Card>
);
