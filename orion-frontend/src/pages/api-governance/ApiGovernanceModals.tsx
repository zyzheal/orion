/**
 * ApiGovernanceModals.tsx - API Governance 弹窗组件
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 * 5 个 Modal: CreateContract / CreateRule / VerifyContract / RegisterVersion / DeprecateVersion
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { GovernanceContract } from '@/api/api-governance';
import type {
  VerifyInput,
  RegisterVersionInput,
  DeprecateVersionInput,
} from './useApiGovernanceState';

const { TextArea } = Input;

export interface CreateContractModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: any) => void;
}

export const CreateContractModal: React.FC<CreateContractModalProps> = ({
  open,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal title="Create API Contract" open={open} onCancel={onCancel} onOk={() => form.submit()}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="Contract Name" name="name" required>
        <Input placeholder="user-service-api" />
      </Form.Item>
      <Form.Item label="Version" name="version" required>
        <Input placeholder="1.0.0" />
      </Form.Item>
      <Form.Item label="Spec Type" name="spec_type" required>
        <Select
          options={[
            { value: 'openapi', label: 'OpenAPI / Swagger' },
            { value: 'graphql', label: 'GraphQL' },
            { value: 'grpc', label: 'gRPC' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <TextArea rows={2} />
      </Form.Item>
    </Form>
  </Modal>
);

export interface CreateRuleModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: any) => void;
}

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  open,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="Create Governance Rule"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="Rule Name" name="name" required>
        <Input placeholder="naming-convention" />
      </Form.Item>
      <Form.Item label="Category" name="category" required>
        <Select
          options={[
            { value: 'naming', label: 'Naming Convention' },
            { value: 'versioning', label: 'Versioning' },
            { value: 'security', label: 'Security' },
            { value: 'performance', label: 'Performance' },
            { value: 'documentation', label: 'Documentation' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Severity" name="severity" required>
        <Select
          options={[
            { value: 'error', label: 'Error' },
            { value: 'warning', label: 'Warning' },
            { value: 'info', label: 'Info' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <TextArea rows={2} />
      </Form.Item>
    </Form>
  </Modal>
);

export interface VerifyContractModalProps {
  open: boolean;
  form: FormInstance;
  selectedContract: GovernanceContract | null;
  onCancel: () => void;
  onSubmit: (values: VerifyInput) => void;
}

export const VerifyContractModal: React.FC<VerifyContractModalProps> = ({
  open,
  form,
  selectedContract,
  onCancel,
  onSubmit,
}) => (
  <Modal title="Verify Contract" open={open} onCancel={onCancel} onOk={() => form.submit()}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="Contract">
        <Input value={selectedContract?.name} disabled />
      </Form.Item>
      <Form.Item label="Endpoint" name="endpoint">
        <Input placeholder={selectedContract?.path || '/api/v1/...'} />
      </Form.Item>
      <Form.Item label="Method" name="method" initialValue="GET">
        <Select
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'DELETE', label: 'DELETE' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Actual Response (JSON)" name="actualResponse">
        <TextArea rows={4} placeholder='{"id": "123", "name": "example"}' />
      </Form.Item>
    </Form>
  </Modal>
);

export interface RegisterVersionModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: RegisterVersionInput) => void;
}

export const RegisterVersionModal: React.FC<RegisterVersionModalProps> = ({
  open,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="Register API Version"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="API Name" name="apiName" required>
        <Input placeholder="user-service" />
      </Form.Item>
      <Form.Item label="Version" name="version" required>
        <Input placeholder="v1.2.0" />
      </Form.Item>
      <Form.Item label="Status" name="status" initialValue="active">
        <Select
          options={[
            { value: 'active', label: 'Active' },
            { value: 'deprecated', label: 'Deprecated' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Changelog" name="changelog">
        <TextArea rows={3} />
      </Form.Item>
    </Form>
  </Modal>
);

export interface DeprecateVersionModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: DeprecateVersionInput) => void;
}

export const DeprecateVersionModal: React.FC<DeprecateVersionModalProps> = ({
  open,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="Deprecate API Version"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="Version ID" name="versionId" required>
        <Input disabled />
      </Form.Item>
      <Form.Item label="Replacement Version" name="replacementVersion">
        <Input placeholder="v2.1.0" />
      </Form.Item>
      <Form.Item label="Retirement Date" name="retirementDate">
        <Input type="date" />
      </Form.Item>
    </Form>
  </Modal>
);
