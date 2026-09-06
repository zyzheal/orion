/**
 * Problem Modals
 * Extracted from Problem/index.tsx to reduce main component size.
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
} from 'antd';
import { spacing } from '@/tokens';
import {
  severityOptions,
  knownErrorStatusOptions,
} from './config';

const { TextArea } = Input;

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface ProblemModalsProps {
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  createForm: FormInstance;
  handleCreate: () => void;

  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editForm: FormInstance;
  handleEdit: () => void;

  linkIncidentModalVisible: boolean;
  setLinkIncidentModalVisible: (v: boolean) => void;
  linkForm: FormInstance;
  handleLinkIncident: () => void;
  linkingLoading: boolean;

  linkChangeModalVisible: boolean;
  setLinkChangeModalVisible: (v: boolean) => void;
  handleLinkChange: () => void;

  kedbModalVisible: boolean;
  setKedbModalVisible: (v: boolean) => void;
  kedbForm: FormInstance;
  handleCreateKnownError: () => void;

  kedbEditModalVisible: boolean;
  setKedbEditModalVisible: (v: boolean) => void;
  kedbEditForm: FormInstance;
  handleEditKnownError: () => void;
  setEditingKnownError: (v: import("@/api/problem").KnownError | null) => void;
}

export const ProblemModals: React.FC<ProblemModalsProps> = (props) => (
  <>
        {/* Create Problem Modal */}
        <Modal
          title="新建问题"
          open={props.createModalVisible}
          onOk={props.handleCreate}
          onCancel={() => {
            props.setCreateModalVisible(false);
            props.createForm.resetFields();
          }}
          okText="创建"
          cancelText="取消"
          width={640}
          destroyOnClose
        >
          <Form form={props.createForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="title"
              label="问题标题"
              rules={[{ required: true, message: '请输入问题标题' }]}
            >
              <Input placeholder="简要描述问题" />
            </Form.Item>
            <Form.Item name="description" label="问题描述">
              <TextArea rows={3} placeholder="详细描述问题现象" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item
                  name="severity"
                  label="严重级别"
                  rules={[{ required: true, message: '请选择严重级别' }]}
                >
                  <Select
                    placeholder="选择级别"
                    options={severityOptions}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category" label="分类">
                  <Input placeholder="问题分类" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="分配给" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>

        {/* Edit Problem Modal */}
        <Modal
          title="编辑问题"
          open={props.editModalVisible}
          onOk={props.handleEdit}
          onCancel={() => {
            props.setEditModalVisible(false);
            props.editForm.resetFields();
          }}
          okText="保存"
          cancelText="取消"
          width={720}
          destroyOnClose
        >
          <Form form={props.editForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="title"
              label="问题标题"
              rules={[{ required: true, message: '请输入问题标题' }]}
            >
              <Input placeholder="简要描述问题" />
            </Form.Item>
            <Form.Item name="description" label="问题描述">
              <TextArea rows={3} placeholder="详细描述问题现象" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item
                  name="severity"
                  label="严重级别"
                  rules={[{ required: true, message: '请选择严重级别' }]}
                >
                  <Select
                    placeholder="选择级别"
                    options={severityOptions}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category" label="分类">
                  <Input placeholder="问题分类" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="分配给" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="root_cause" label="根因分析">
              <TextArea rows={2} placeholder="问题的根本原因" />
            </Form.Item>
            <Form.Item name="workaround" label="临时解决方案">
              <TextArea rows={2} placeholder="临时规避方案" />
            </Form.Item>
            <Form.Item name="resolution" label="永久解决方案">
              <TextArea rows={2} placeholder="永久修复方案" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Link Incident Modal */}
        <Modal
          title="关联事件"
          open={props.linkIncidentModalVisible}
          onOk={props.handleLinkIncident}
          onCancel={() => {
            props.setLinkIncidentModalVisible(false);
            props.linkForm.resetFields();
          }}
          okText="关联"
          cancelText="取消"
          confirmLoading={props.linkingLoading}
          width={480}
          destroyOnClose
        >
          <Form form={props.linkForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="id"
              label="事件 ID"
              rules={[{ required: true, message: '请输入事件 ID' }]}
            >
              <Input placeholder="输入要关联的事件 ID" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Link Change Modal */}
        <Modal
          title="关联变更"
          open={props.linkChangeModalVisible}
          onOk={props.handleLinkChange}
          onCancel={() => {
            props.setLinkChangeModalVisible(false);
            props.linkForm.resetFields();
          }}
          okText="关联"
          cancelText="取消"
          confirmLoading={props.linkingLoading}
          width={480}
          destroyOnClose
        >
          <Form form={props.linkForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="id"
              label="变更 ID"
              rules={[{ required: true, message: '请输入变更 ID' }]}
            >
              <Input placeholder="输入要关联的变更 ID" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Create Known Error Modal */}
        <Modal
          title="新建已知错误"
          open={props.kedbModalVisible}
          onOk={props.handleCreateKnownError}
          onCancel={() => {
            props.setKedbModalVisible(false);
            props.kedbForm.resetFields();
          }}
          okText="创建"
          cancelText="取消"
          width={640}
          destroyOnClose
        >
          <Form form={props.kedbForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="已知错误标题" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <TextArea rows={2} placeholder="详细描述" />
            </Form.Item>
            <Form.Item name="symptoms" label="症状">
              <TextArea rows={2} placeholder="可观测到的症状" />
            </Form.Item>
            <Form.Item name="root_cause" label="根因">
              <TextArea rows={2} placeholder="根本原因" />
            </Form.Item>
            <Form.Item name="workaround" label="临时方案">
              <TextArea rows={2} placeholder="临时解决方案" />
            </Form.Item>
            <Form.Item name="keywords" label="关键词" help="多个关键词用逗号分隔">
              <Input placeholder="关键词1, 关键词2, ..." />
            </Form.Item>
            <Form.Item name="problem_id" label="关联问题 ID">
              <Input placeholder="可选：关联的问题 ID" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Known Error Modal */}
        <Modal
          title="编辑已知错误"
          open={props.kedbEditModalVisible}
          onOk={props.handleEditKnownError}
          onCancel={() => {
            props.setKedbEditModalVisible(false);
            props.kedbEditForm.resetFields();
            props.setEditingKnownError(null);
          }}
          okText="保存"
          cancelText="取消"
          width={640}
          destroyOnClose
        >
          <Form form={props.kedbEditForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="已知错误标题" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <TextArea rows={2} placeholder="详细描述" />
            </Form.Item>
            <Form.Item name="symptoms" label="症状">
              <TextArea rows={2} placeholder="可观测到的症状" />
            </Form.Item>
            <Form.Item name="root_cause" label="根因">
              <TextArea rows={2} placeholder="根本原因" />
            </Form.Item>
            <Form.Item name="workaround" label="临时方案">
              <TextArea rows={2} placeholder="临时解决方案" />
            </Form.Item>
            <Form.Item name="keywords" label="关键词" help="多个关键词用逗号分隔">
              <Input placeholder="关键词1, 关键词2, ..." />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                options={knownErrorStatusOptions}
              />
            </Form.Item>
          </Form>
        </Modal>
  </>
);
