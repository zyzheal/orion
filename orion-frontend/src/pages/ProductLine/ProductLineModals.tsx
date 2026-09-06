/**
 * ProductLine Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Tabs,
} from 'antd';
import type {
  ProductLine,
  ReleaseTrain,
  HotfixChannel,
} from '@/api/product-lines';
import { branchModeOptions, envOptions, gitProviderOptions } from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface ProductLineModalsProps {
  productLines: ProductLine[];
  releaseTrains: ReleaseTrain[];
  hotfixChannels: HotfixChannel[];
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editingPL: ProductLine | null;
  setEditingPL: (v: ProductLine | null) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedPL: ProductLine | null;
  setSelectedPL: (v: ProductLine | null) => void;
  rtModalVisible: boolean;
  setRtModalVisible: (v: boolean) => void;
  hfModalVisible: boolean;
  setHfModalVisible: (v: boolean) => void;
  createForm: FormInstance;
  editForm: FormInstance;
  rtForm: FormInstance;
  hfForm: FormInstance;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleCreateRT: () => void;
  handleCreateHF: () => void;
  detailTabItems: React.ReactNode;
}

export const ProductLineModals: React.FC<ProductLineModalsProps> = (props) => (
  <>
          {/* Create Modal */}
          <Modal
            title="创建产品线"
            open={props.createModalVisible}
            onCancel={() => props.setCreateModalVisible(false)}
            onOk={props.handleCreate}
            confirmLoading={props.submitting}
            width={640}
            destroyOnClose
          >
            <Form form={props.createForm} layout="vertical">
              <Form.Item
                name="name"
                label="名称 (唯一标识)"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="如: core-platform" />
              </Form.Item>
              <Form.Item
                name="displayName"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="如: 核心平台" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} placeholder="产品线描述..." />
              </Form.Item>
              <Form.Item
                name="gitUrl"
                label="Git 仓库地址"
                rules={[
                  { required: true, message: '请输入仓库地址' },
                  {
                    pattern: /^https?:\/\/.+/,
                    message: '请输入合法的 HTTP/HTTPS 仓库地址',
                  },
                ]}
              >
                <Input placeholder="https://github.com/org/repo" />
              </Form.Item>
              <Form.Item name="gitProvider" label="Git Provider">
                <Select options={gitProviderOptions} defaultValue="github" />
              </Form.Item>
              <Form.Item name="gitDefaultBranch" label="默认分支">
                <Input placeholder="main" defaultValue="main" />
              </Form.Item>
              <Form.Item name="branchMode" label="分支模式" rules={[{ required: true }]}>
                <Select options={branchModeOptions} defaultValue="gitflow" />
              </Form.Item>
              <Form.Item name="defaultEnvironment" label="默认环境">
                <Select options={envOptions} defaultValue="dev" />
              </Form.Item>
              <Form.Item name="tenantId" label="租户 ID (可选)">
                <Input placeholder="tenant-id" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Edit Modal */}
          <Modal
            title="编辑产品线"
            open={props.editModalVisible}
            onCancel={() => props.setEditModalVisible(false)}
            onOk={props.handleEdit}
            confirmLoading={props.submitting}
            width={640}
            destroyOnClose
          >
            <Form form={props.editForm} layout="vertical">
              <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="branchMode" label="分支模式">
                <Select options={branchModeOptions} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title={props.selectedPL ? `${props.selectedPL.displayName} (${props.selectedPL.name})` : '详情'}
            open={props.detailDrawerVisible}
            onClose={() => props.setDetailDrawerVisible(false)}
            width={800}
            destroyOnClose
          >
            <Tabs items={props.detailTabItems} />
          </Drawer>

          {/* Create Release Train Modal */}
          <Modal
            title="创建发布列车"
            open={props.rtModalVisible}
            onCancel={() => props.setRtModalVisible(false)}
            onOk={props.handleCreateRT}
            confirmLoading={props.submitting}
          >
            <Form form={props.rtForm} layout="vertical">
              <Form.Item name="rtName" label="名称" rules={[{ required: true }]}>
                <Input placeholder="如: Weekly Release" />
              </Form.Item>
              <Form.Item name="rtSchedule" label="调度 (Cron 表达式)" rules={[{ required: true }]}>
                <Input placeholder="0 10 * * 4" />
              </Form.Item>
              <Form.Item name="rtSourceBranch" label="源分支">
                <Input placeholder="develop" defaultValue="develop" />
              </Form.Item>
              <Form.Item name="rtTargetBranch" label="目标分支">
                <Input placeholder="main" defaultValue="main" />
              </Form.Item>
              <Form.Item name="rtApprovalRequired" label="需要审批" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="rtAutoPromote" label="自动晋升" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="rtApprovers" label="审批人 (逗号分隔)">
                <Input placeholder="tech-lead, qa-lead" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Create Hotfix Channel Modal */}
          <Modal
            title="创建 Hotfix 通道"
            open={props.hfModalVisible}
            onCancel={() => props.setHfModalVisible(false)}
            onOk={props.handleCreateHF}
            confirmLoading={props.submitting}
          >
            <Form form={props.hfForm} layout="vertical">
              <Form.Item name="hfName" label="名称" rules={[{ required: true }]}>
                <Input placeholder="如: Production Hotfix" />
              </Form.Item>
              <Form.Item name="hfBranchPattern" label="分支匹配模式">
                <Input placeholder="^hotfix/.*$" defaultValue="^hotfix/.*$" />
              </Form.Item>
              <Form.Item name="hfEnabled" label="启用" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfApprovalRequired" label="需要审批" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfApprovalTimeout" label="审批超时 (分钟)">
                <Input type="number" defaultValue={30} />
              </Form.Item>
              <Form.Item name="hfAutoMerge" label="自动合并" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="hfNotifyOnCall" label="通知值班" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfMaxDuration" label="最大持续时间 (分钟)">
                <Input type="number" defaultValue={60} />
              </Form.Item>
            </Form>
          </Modal>
  </>
);
