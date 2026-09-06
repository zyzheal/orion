/**
 * FeatureFlagModals.tsx - Feature Flags 4 个 Modal
 * 抽取自 FeatureFlagsPage.tsx (P2-9 Phase 54)
 * Create Modal / Edit Modal / Evaluate Modal / Detail Modal
 * 4 个 Form 实例由主页面通过 props 传入
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Row,
  Col,
  Alert,
  Button,
  Descriptions,
  Tag,
} from 'antd';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { FeatureFlag } from '@/api/feature-flags';
import {
  FLAG_TYPE_OPTIONS,
  STRATEGY_OPTIONS,
  typeColor,
  typeLabel,
  strategyLabel,
} from './FeatureFlagColumns';
// Types imported via useFeatureFlagsState (handlers wrapped by main page)

const { TextArea } = Input;

// ============================================================================
// Props
// ============================================================================

export interface FeatureFlagModalsProps {
  // Create Modal
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  createForm: React.ComponentProps<typeof Form>['form'];
  handleCreate: () => void | Promise<void>;
  // Edit Modal
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editingFlag: FeatureFlag | null;
  setEditingFlag: (v: FeatureFlag | null) => void;
  editForm: React.ComponentProps<typeof Form>['form'];
  handleEdit: () => void | Promise<void>;
  // Evaluate Modal
  evaluateModalVisible: boolean;
  setEvaluateModalVisible: (v: boolean) => void;
  evaluatingFlag: FeatureFlag | null;
  setEvaluatingFlag: (v: FeatureFlag | null) => void;
  evaluateForm: React.ComponentProps<typeof Form>['form'];
  handleEvaluate: () => void | Promise<void>;
  evaluationResult: string | null;
  // Detail Modal
  detailModalVisible: boolean;
  setDetailModalVisible: (v: boolean) => void;
  selectedFlag: FeatureFlag | null;
  setSelectedFlag: (v: FeatureFlag | null) => void;
  // Shared
  submitting: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const FeatureFlagModals: React.FC<FeatureFlagModalsProps> = (props) => {
  const {
    createModalVisible,
    setCreateModalVisible,
    createForm,
    handleCreate,
    editModalVisible,
    setEditModalVisible,
    setEditingFlag,
    editForm,
    handleEdit,
    evaluateModalVisible,
    setEvaluateModalVisible,
    evaluatingFlag,
    setEvaluatingFlag,
    evaluateForm,
    handleEvaluate,
    evaluationResult,
    detailModalVisible,
    setDetailModalVisible,
    selectedFlag,
    setSelectedFlag,
    submitting,
  } = props;

  return (
    <>
      {/* Create Modal */}
      <Modal
        title="创建特性开关"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={650}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="开关名称" rules={[{ required: true }]}>
            <Input placeholder="如: 新功能预览" />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input placeholder="new_feature_preview" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="type"
                label="类型"
                rules={[{ required: true }]}
                initialValue="boolean"
              >
                <Select>
                  {FLAG_TYPE_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>
                      {o.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="strategy"
                label="策略"
                rules={[{ required: true }]}
                initialValue="default"
              >
                <Select>
                  {STRATEGY_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>
                      {o.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="defaultValue"
                label="默认值"
                rules={[{ required: true }]}
                initialValue="false"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tenantId" label="租户 ID (租户策略时填写)">
                <Input placeholder="tenant-xxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="percentage" label="灰度百分比 (百分比策略时填写)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input placeholder="admin, beta-tester" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Select>
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑特性开关"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingFlag(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={650}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="开关名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <Select>
                  {FLAG_TYPE_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>
                      {o.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="strategy" label="策略" rules={[{ required: true }]}>
                <Select>
                  {STRATEGY_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>
                      {o.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defaultValue" label="默认值" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tenantId" label="租户 ID">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="percentage" label="灰度百分比">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Evaluate Modal */}
      <Modal
        title={`评估特性开关: ${evaluatingFlag?.name || ''}`}
        open={evaluateModalVisible}
        onCancel={() => {
          setEvaluateModalVisible(false);
          setEvaluatingFlag(null);
        }}
        onOk={handleEvaluate}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={evaluateForm} layout="vertical">
          <Form.Item name="tenantId" label="租户 ID">
            <Input placeholder="tenant-xxx" />
          </Form.Item>
          <Form.Item name="userId" label="用户 ID">
            <Input placeholder="user-xxx" />
          </Form.Item>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input placeholder="admin, beta-tester" />
          </Form.Item>
        </Form>
        {evaluationResult !== null && (
          <Alert
            message="评估结果"
            description={evaluationResult}
            type="info"
            showIcon
            style={{ marginTop: spacing[4] }}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selectedFlag ? `特性开关详情: ${selectedFlag.name}` : '详情'}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedFlag(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailModalVisible(false);
              setSelectedFlag(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedFlag && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedFlag.name}</Descriptions.Item>
            <Descriptions.Item label="Key">{selectedFlag.key}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={typeColor[selectedFlag.type]}>{typeLabel[selectedFlag.type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="策略">
              {strategyLabel[selectedFlag.strategy]}
            </Descriptions.Item>
            <Descriptions.Item label="默认值">{selectedFlag.defaultValue}</Descriptions.Item>
            <Descriptions.Item label="启用">{selectedFlag.enabled ? '是' : '否'}</Descriptions.Item>
            {selectedFlag.tenantId && (
              <Descriptions.Item label="租户 ID">{selectedFlag.tenantId}</Descriptions.Item>
            )}
            {selectedFlag.percentage !== undefined && (
              <Descriptions.Item label="灰度百分比">{selectedFlag.percentage}%</Descriptions.Item>
            )}
            <Descriptions.Item label="评估次数">{selectedFlag.evaluationCount}</Descriptions.Item>
            <Descriptions.Item label="最后评估">
              {selectedFlag.lastEvaluatedAt
                ? dayjs(selectedFlag.lastEvaluatedAt).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedFlag.description || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
};
