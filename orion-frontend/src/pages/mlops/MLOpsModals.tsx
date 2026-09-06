/**
 * MLOps Page - Modals & Drawers
 * All dialogs used by the experiments / models / training jobs tabs.
 */
import React from 'react';
import { Button, Drawer, Form, Input, Modal, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MLExperimentRun } from '@/api/mlops';
import {
  DATASET_RULES,
  EXPERIMENT_NAME_RULES,
  MODEL_NAME_RULES,
  MODEL_TYPE_OPTIONS,
} from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

// ============================================================================
// Shared experiment form body (used by both the create and edit modals)
// ============================================================================

const ExperimentFormBody: React.FC<{ form: FormInstance }> = ({ form }) => (
  <Form form={form} layout="vertical">
    <Form.Item label="名称" name="name" rules={EXPERIMENT_NAME_RULES}>
      <Input placeholder="实验名称" />
    </Form.Item>
    <Form.Item label="描述" name="description">
      <Input.TextArea rows={2} placeholder="实验描述" />
    </Form.Item>
    <Form.Item label="项目" name="project">
      <Input placeholder="所属项目" />
    </Form.Item>
    <Form.Item label="模型类型" name="modelType">
      <Select placeholder="选择模型类型" options={MODEL_TYPE_OPTIONS} />
    </Form.Item>
  </Form>
);

// ============================================================================
// Experiments modals (create / edit / runs drawer)
// ============================================================================

interface ExperimentsModalsProps {
  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  creating: boolean;
  createForm: FormInstance;
  handleCreate: (values: any) => void;

  editModalOpen: boolean;
  setEditModalOpen: (v: boolean) => void;
  editing: boolean;
  editForm: FormInstance;
  handleSaveEdit: (values: any) => void;

  runsDrawerOpen: boolean;
  setRunsDrawerOpen: (v: boolean) => void;
  currentRuns: MLExperimentRun[];
  currentRunsLoading: boolean;
  runsColumns: ColumnsType<MLExperimentRun>;
}

export const ExperimentsModals: React.FC<ExperimentsModalsProps> = (props) => (
  <>
    {/* Create Modal */}
    <Modal
      title="创建实验"
      open={props.createModalOpen}
      onCancel={() => props.setCreateModalOpen(false)}
      onOk={() => props.createForm.submit()}
      confirmLoading={props.creating}
      okText="创建"
      cancelText="取消"
    >
      <ExperimentFormBody form={props.createForm} />
    </Modal>

    {/* Edit Modal */}
    <Modal
      title="编辑实验"
      open={props.editModalOpen}
      onCancel={() => props.setEditModalOpen(false)}
      onOk={() => props.editForm.submit()}
      confirmLoading={props.editing}
      okText="保存"
      cancelText="取消"
    >
      <ExperimentFormBody form={props.editForm} />
    </Modal>

    {/* Runs Drawer */}
    <Drawer
      title="实验运行记录"
      placement="right"
      width={600}
      open={props.runsDrawerOpen}
      onClose={() => props.setRunsDrawerOpen(false)}
    >
      <Table
        columns={props.runsColumns}
        dataSource={props.currentRuns}
        rowKey="id"
        loading={props.currentRunsLoading}
        pagination={false}
        locale={{ emptyText: '暂无运行记录' }}
      />
    </Drawer>
  </>
);

// ============================================================================
// Model registry modal
// ============================================================================

interface ModelRegistryModalsProps {
  registerModalOpen: boolean;
  setRegisterModalOpen: (v: boolean) => void;
  registering: boolean;
  registerForm: FormInstance;
  handleRegister: (values: any) => void;
}

export const ModelRegistryModals: React.FC<ModelRegistryModalsProps> = (props) => (
  <Modal
    title="注册模型"
    open={props.registerModalOpen}
    onCancel={() => props.setRegisterModalOpen(false)}
    onOk={() => props.registerForm.submit()}
    confirmLoading={props.registering}
    okText="注册"
    cancelText="取消"
  >
    <Form form={props.registerForm} layout="vertical" onFinish={props.handleRegister}>
      <Form.Item label="名称" name="name" rules={MODEL_NAME_RULES}>
        <Input placeholder="模型名称" />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={2} placeholder="模型描述" />
      </Form.Item>
      <Form.Item label="Artifact 的路径" name="artifactPath">
        <Input placeholder="模型存储路径" />
      </Form.Item>
      <Form.Item label="实验 ID" name="experimentId">
        <Input placeholder="关联的实验 ID" />
      </Form.Item>
    </Form>
  </Modal>
);

// ============================================================================
// Training jobs modal
// ============================================================================

interface TrainingJobsModalsProps {
  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  creating: boolean;
  createForm: FormInstance;
  handleCreate: (values: any) => void;
}

export const TrainingJobsModals: React.FC<TrainingJobsModalsProps> = (props) => (
  <Modal
    title="创建训练任务"
    open={props.createModalOpen}
    onCancel={() => props.setCreateModalOpen(false)}
    onOk={() => props.createForm.submit()}
    confirmLoading={props.creating}
    okText="创建"
    cancelText="取消"
  >
    <Form form={props.createForm} layout="vertical" onFinish={props.handleCreate}>
      <Form.Item label="数据集" name="dataset" rules={DATASET_RULES}>
        <Input placeholder="数据集名称或路径" />
      </Form.Item>
      <Form.Item label="实验 ID" name="experimentId">
        <Input placeholder="关联的实验 ID" />
      </Form.Item>
    </Form>
  </Modal>
);
