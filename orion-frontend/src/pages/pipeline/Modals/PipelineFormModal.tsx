/**
 * PipelineFormModal.tsx - 数据管道创建/编辑弹窗
 * 抽取自 PipelineManagementPage.tsx (P2-9 Phase 90)
 */
import React from 'react';
import { Modal, Form, Input, Row, Col, type FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { DataPipeline, CreateDataPipelineRequest } from '@/api/data-pipeline';

interface PipelineFormModalProps {
  open: boolean;
  editingPipeline: DataPipeline | null;
  loading: boolean;
  form: FormInstance<CreateDataPipelineRequest>;
  onCancel: () => void;
  onFinish: (values: CreateDataPipelineRequest) => void;
}

export const PipelineFormModal: React.FC<PipelineFormModalProps> = ({
  open,
  editingPipeline,
  loading,
  form,
  onCancel,
  onFinish,
}) => (
  <Modal
    title={editingPipeline ? '编辑数据管道' : '创建数据管道'}
    open={open}
    onCancel={onCancel}
    onOk={() => form.validateFields().then(() => form.submit())}
    confirmLoading={loading}
    width={700}
    okText={editingPipeline ? '保存' : '创建'}
    cancelText="取消"
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="管道名称"
        name="name"
        rules={[{ required: true, message: '请输入管道名称' }]}
      >
        <Input placeholder="如: user_analytics_etl" />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={2} placeholder="管道描述" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item label="源表" name="sourceTable">
            <Input placeholder="源表名称" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="目标表" name="targetTable">
            <Input placeholder="目标表名称" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="转换脚本" name="transformationScript">
        <Input.TextArea rows={4} placeholder="SQL 或脚本内容" />
      </Form.Item>
      <Form.Item label="调度表达式 (Cron)" name="schedule">
        <Input placeholder="如: 0 */6 * * * (每6小时执行一次)" />
      </Form.Item>
    </Form>
  </Modal>
);
