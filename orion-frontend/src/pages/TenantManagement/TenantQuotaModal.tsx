/**
 * TenantQuotaModal.tsx - 配额配置 Modal
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import React from 'react';
import { Modal, Form, InputNumber, Row, Col, Descriptions } from 'antd';
import { spacing } from '@/tokens';
import type { TenantQuota } from '@/api/tenant';

export interface TenantQuotaModalProps {
  open: boolean;
  onClose: () => void;
  quota: TenantQuota | null;
  updating: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  handleUpdateQuota: (values: any) => void | Promise<void>;
}

export const TenantQuotaModal: React.FC<TenantQuotaModalProps> = ({
  open,
  onClose,
  quota,
  updating,
  form,
  handleUpdateQuota,
}) => (
  <Modal
    title="配置租户配额"
    open={open}
    onCancel={onClose}
    onOk={() => form.submit()}
    confirmLoading={updating}
    width={600}
  >
    <Descriptions size="small" column={1} style={{ marginBottom: spacing.md }}>
      <Descriptions.Item label="说明">
        配额控制租户可使用的资源上限。修改后立即生效，影响 Pipeline 创建、运行、Runner
        部署等。
      </Descriptions.Item>
    </Descriptions>
    <Form
      form={form}
      layout="vertical"
      initialValues={quota || {}}
      onFinish={handleUpdateQuota}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="最大 Pipeline 数"
            name="maxPipelines"
            tooltip="租户最多可创建的 Pipeline 数量"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="每日最大运行次数"
            name="maxPipelineRunsPerDay"
            tooltip="租户的 Pipeline 每日最多可运行次数"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="最大并发运行数"
            name="maxConcurrentRuns"
            tooltip="同时最多运行的 Pipeline 数量"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="最大 Runner 数"
            name="maxRunners"
            tooltip="最多可部署的 Runner Pod 数量"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="最大 CPU 核心数"
            name="maxCpuCores"
            tooltip="所有 Runner 的 CPU 核心数总和上限"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="最大内存 (GB)"
            name="maxMemoryGb"
            tooltip="所有 Runner 的内存总和上限"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="最大存储 (GB)"
            name="maxStorageGb"
            tooltip="租户可用的最大存储空间"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="最大 Namespace 数"
            name="maxNamespaces"
            tooltip="最多可从池中分配的 Namespace 数量"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
