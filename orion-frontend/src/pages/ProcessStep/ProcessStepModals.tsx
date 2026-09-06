/**
 * ProcessStep Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Timeline,
  Descriptions,
  Row,
  Col,
  Empty,
  Badge,
  Tooltip,
  Typography,
  Switch,
} from 'antd';

const { Title, Text } = Typography;
const {TextArea} = Input;
import {DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  RocketOutlined,
  ApartmentOutlined, PlusOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';
import type {
  ProcessDefinition,
  ProcessInstance,
  ProcessStepInstance,
} from '@/api/process-steps';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface ProcessStepModalsProps {
  definitions: ProcessDefinition[];
  editingDef: ProcessDefinition | null;
  defModalOpen: boolean;
  defModalLoading: boolean;
  setDefModalOpen: (v: boolean) => void;
  defForm: FormInstance;
  handleSaveDef: () => void;
  handleCreateDef: () => void;
  setEditingDef: (v: ProcessDefinition | null) => void;
  startModalOpen: boolean;
  startModalLoading: boolean;
  startForm: FormInstance;
  handleConfirmStart: () => void;
  setStartModalOpen: (v: boolean) => void;
  detailDrawerOpen: boolean;
  setDetailDrawerOpen: (v: boolean) => void;
  detailInstance: ProcessInstance | null;
  stepHistory: ProcessStepInstance[];
  stepLoading: boolean;
  handleAdvanceStep: (instanceId: string, stepId: string, action: string) => void;
  defDetailOpen: boolean;
  setDefDetailOpen: (v: boolean) => void;
  defDetail: ProcessDefinition | null;
  handleStartInstance: (defId: string) => void;
  handleEditDef: (def: ProcessDefinition) => void;
  getAllowedActions: (status: string) => string[];
  getTimelineColor: (status: string) => string;
  stepTypeLabel: Record<string, string>;
  statusColor: Record<string, string>;
  statusLabel: Record<string, string>;
  actionLabel: Record<string, string>;
  actionIcon: Record<string, React.ReactNode>;
}

export const ProcessStepModals: React.FC<ProcessStepModalsProps> = (props) => (
  <>
      {/* ==================== Definition Form Modal ==================== */}
      <Modal
        title={props.editingDef ? '编辑流程定义' : '新建流程定义'}
        open={props.defModalOpen}
        onOk={props.handleSaveDef}
        onCancel={() => props.setDefModalOpen(false)}
        confirmLoading={props.defModalLoading}
        width={640}
      >
        <Form form={props.defForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入流程定义名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="entityType"
                label="实体类型"
                rules={[{ required: true, message: '请选择实体类型' }]}
              >
                <Select
                  placeholder="选择实体类型"
                  options={[
                    { label: '工单', value: 'ticket' },
                    { label: '变更', value: 'change' },
                    { label: '发布', value: 'release' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="流程步骤">
            <Form.List name="steps">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'name']} noStyle>
                          <Input placeholder={`步骤 ${index + 1} 名称`} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'type']} noStyle>
                          <Select
                            placeholder="类型"
                            options={Object.entries(props.stepTypeLabel).map(([k, v]) => ({
                              label: v,
                              value: k,
                            }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'handler']} noStyle>
                          <Input placeholder="处理器 (可选)" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        {fields.length > 1 && (
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        )}
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                    添加步骤
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Start Instance Modal ==================== */}
      <Modal
        title="启动流程实例"
        open={props.startModalOpen}
        onOk={props.handleConfirmStart}
        onCancel={() => props.setStartModalOpen(false)}
        confirmLoading={props.startModalLoading}
      >
        <Form form={props.startForm} layout="vertical">
          <Form.Item
            name="definitionId"
            label="流程定义"
            rules={[{ required: true, message: '请选择流程定义' }]}
          >
            <Select
              placeholder="选择流程定义"
              showSearch
              optionFilterProp="label"
              options={props.definitions.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="entityType" label="实体类型">
            <Select
              placeholder="选择实体类型"
              options={[
                { label: '工单', value: 'ticket' },
                { label: '变更', value: 'change' },
                { label: '发布', value: 'release' },
              ]}
            />
          </Form.Item>
          <Form.Item name="entityId" label="实体ID">
            <Input placeholder="输入关联实体ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Instance Detail Drawer ==================== */}
      <Drawer
        title="流程实例详情"
        open={props.detailDrawerOpen}
        onClose={() => props.setDetailDrawerOpen(false)}
        width={600}
      >
        {props.detailInstance && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="实例ID">{props.detailInstance.id}</Descriptions.Item>
              <Descriptions.Item label="定义ID">{props.detailInstance.definitionId}</Descriptions.Item>
              <Descriptions.Item label="实体类型">{props.detailInstance.entityType}</Descriptions.Item>
              <Descriptions.Item label="实体ID">{props.detailInstance.entityId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={props.statusColor[props.detailInstance.status]}>
                  {props.statusLabel[props.detailInstance.status] || props.detailInstance.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前步骤">
                {props.detailInstance.currentStepId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(props.detailInstance.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {props.detailInstance.completedAt
                  ? dayjs(props.detailInstance.completedAt).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <HistoryOutlined style={{ marginRight: 8 }} /> 步骤历史
            </Title>

            {props.stepLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : props.stepHistory.length === 0 ? (
              <Empty description="暂无步骤记录" />
            ) : (
              <Timeline
                items={props.stepHistory.map((step) => {
                  const canAdvance = ![
                    'success',
                    'failed',
                    'close',
                    'skip',
                    'aborted',
                    'rejected',
                  ].includes(step.status);
                  const allowedActions = props.getAllowedActions(step.status);

                  return {
                    color: props.getTimelineColor(step.status),
                    children: (
                      <div key={step.id}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Space>
                            <Text strong>{step.stepName}</Text>
                            <Tag color={props.statusColor[step.status]}>
                              {props.statusLabel[step.status] || step.status}
                            </Tag>
                            {step.stepType && (
                              <Tag>{props.stepTypeLabel[step.stepType] || step.stepType}</Tag>
                            )}
                          </Space>
                          {canAdvance && allowedActions.length > 0 && (
                            <Space size={4}>
                              {allowedActions.map((action) => (
                                <Tooltip key={action} title={props.actionLabel[action]}>
                                  <Button
                                    size="small"
                                    type={
                                      action === 'success'
                                        ? 'primary'
                                        : action === 'failed'
                                          ? 'primary'
                                          : 'default'
                                    }
                                    danger={
                                      action === 'failed' ||
                                      action === 'aborted' ||
                                      action === 'rejected'
                                    }
                                    icon={props.actionIcon[action]}
                                    onClick={() =>
                                      props.handleAdvanceStep(props.detailInstance.id, step.stepId, action)
                                    }
                                  >
                                    {props.actionLabel[action]}
                                  </Button>
                                </Tooltip>
                              ))}
                            </Space>
                          )}
                        </div>
                        {step.operator && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            操作人: {step.operator}
                          </Text>
                        )}
                        {step.comment && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              备注: {step.comment}
                            </Text>
                          </div>
                        )}
                        {step.startedAt && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            开始: {dayjs(step.startedAt).format('HH:mm:ss')}
                            {step.completedAt &&
                              ` | 完成: ${dayjs(step.completedAt).format('HH:mm:ss')}`}
                          </Text>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </>
        )}
      </Drawer>

      {/* ==================== Definition Detail Drawer ==================== */}
      <Drawer
        title="流程定义详情"
        open={props.defDetailOpen}
        onClose={() => props.setDefDetailOpen(false)}
        width={560}
      >
        {props.defDetail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="名称">{props.defDetail.name}</Descriptions.Item>
              <Descriptions.Item label="版本">v{props.defDetail.version}</Descriptions.Item>
              <Descriptions.Item label="实体类型">{props.defDetail.entityType}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge
                  status={props.defDetail.enabled ? 'success' : 'default'}
                  text={props.defDetail.enabled ? '启用' : '禁用'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {props.defDetail.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(props.defDetail.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <ApartmentOutlined style={{ marginRight: 8 }} /> 流程步骤
            </Title>

            {props.defDetail.steps.length === 0 ? (
              <Empty description="暂无步骤" />
            ) : (
              <Timeline
                items={props.defDetail.steps.map((step) => ({
                  children: (
                    <div key={step.id}>
                      <Text strong>{step.name}</Text>
                      {step.type && (
                        <Tag style={{ marginLeft: 8 }}>{props.stepTypeLabel[step.type] || step.type}</Tag>
                      )}
                      {step.handler && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          处理器: {step.handler}
                        </Text>
                      )}
                    </div>
                  ),
                }))}
              />
            )}

            <div style={{ marginTop: spacing.md }}>
              <Space>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={() => {
                    props.setDefDetailOpen(false);
                    props.handleStartInstance(props.defDetail.id);
                  }}
                >
                  启动实例
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    props.setDefDetailOpen(false);
                    props.handleEditDef(props.defDetail);
                  }}
                >
                  编辑
                </Button>
              </Space>
            </div>
          </>
        )}
      </Drawer>
  </>
);
