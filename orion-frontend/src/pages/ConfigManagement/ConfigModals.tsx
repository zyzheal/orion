/**
 * ConfigModals — 配置管理页的 Modal 与 Drawer
 * 从 index.tsx 提取，便于阅读与维护
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Drawer,
  Descriptions,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  ENVIRONMENT_OPTIONS,
  CATEGORY_OPTIONS,
  STATUS_COLOR_MAP,
  STATUS_LABEL_MAP,
} from './config';
import type { ConfigItem } from '@/api/config';

const { TextArea } = Input;

/** 新建 / 编辑配置弹窗 */
export const ConfigCreateModal: React.FC<{
  open: boolean;
  editingConfig: ConfigItem | null;
  submitting: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  onCancel: () => void;
  onCreate: (values: any) => Promise<void>;
  onClose: () => void;
}> = ({ open, editingConfig, submitting, form, onCreate, onCancel, onClose }) => {
  void onCancel;
  return (
    <Modal
      title={editingConfig ? '编辑配置' : '新建配置'}
      open={open || !!editingConfig}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText={editingConfig ? '保存' : '创建'}
      cancelText="取消"
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item label="配置键" name="key" rules={[{ required: true }]}>
          <Input placeholder="例如：app.name" />
        </Form.Item>
        <Form.Item label="配置值" name="value" rules={[{ required: true }]}>
          <TextArea placeholder='例如：{"key": "value"}' rows={3} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
              <Select options={[ENVIRONMENT_OPTIONS].slice()} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="分类" name="category" rules={[{ required: true }]}>
              <Select options={[CATEGORY_OPTIONS].slice()} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="敏感的配置" name="sensitive" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="加密存储" name="encrypted" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="描述" name="description">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/** 配置详情抽屉 */
export const ConfigDetailDrawer: React.FC<{
  open: boolean;
  selectedConfig: ConfigItem | null;
  onClose: () => void;
}> = ({ open, selectedConfig, onClose }) => (
  <Drawer
    title="配置详情"
    placement="right"
    width={700}
    open={open}
    onClose={onClose}
  >
    {selectedConfig && (
      <Descriptions column={1} bordered>
        <Descriptions.Item label="ID">{selectedConfig.id}</Descriptions.Item>
        <Descriptions.Item label="配置键">{selectedConfig.key}</Descriptions.Item>
        <Descriptions.Item label="配置值">
          <pre>{JSON.stringify(selectedConfig.value, null, 2)}</pre>
        </Descriptions.Item>
        <Descriptions.Item label="版本">{selectedConfig.version}</Descriptions.Item>
        <Descriptions.Item label="环境">{selectedConfig.environment}</Descriptions.Item>
        <Descriptions.Item label="分类">{selectedConfig.category}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={STATUS_COLOR_MAP[selectedConfig.status] || 'default'}>
            {STATUS_LABEL_MAP[selectedConfig.status] || selectedConfig.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="敏感">
          {selectedConfig.sensitive ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="加密">
          {selectedConfig.encrypted ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="创建者">{selectedConfig.createdBy}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(selectedConfig.createdAt).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="更新者">{selectedConfig.updatedBy}</Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(selectedConfig.updatedAt).toLocaleString()}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Drawer>
);
