/**
 * ChangeRequestManagement Modals & Drawers
 */
import React from 'react';
import { Modal,
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Typography,
  DatePicker,
  Row,
  Col, Badge, Descriptions
} from 'antd';
import { ClockCircleOutlined, BulbOutlined, CheckOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PlayCircleOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import type {
  ChangeRequest,
  ChangeRiskAnalysis,
  ChangeApproval,
  ChangeExecution,
} from '@/api/change-requests';
import {
  riskLevelColor,
  riskLevelLabel,
  statusColor,
  statusLabel,
  changeTypeLabel,
  impactScopeLabel,
} from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];
const { Title, Text } = Typography;
const { TextArea } = Input;

interface ChangeRequestManagementModalsProps {
  renderExecutionProgress: () => React.ReactNode;
  modalVisible: boolean;
  setModalVisible: (v: boolean) => void;
  confirmLoading: boolean;
  editingRequest: ChangeRequest | null;
  setEditingRequest: (v: ChangeRequest | null) => void;
  handleSave: () => void;
  handleCreate: () => void;
  form: FormInstance;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedRequest: ChangeRequest | null;
  setSelectedRequest: (v: ChangeRequest | null) => void;
  riskAnalysis: ChangeRiskAnalysis | null;
  riskLoading: boolean;
  setRiskLoading: (v: boolean) => void;
  handleAIRisk: (record: ChangeRequest) => void;
  approvalChain: ChangeApproval[];
  approvalLoading: boolean;
  actionModalVisible: boolean;
  setActionModalVisible: (v: boolean) => void;
  actionType: 'approve' | 'reject';
  setActionType: (v: 'approve' | 'reject') => void;
  actionApprovalId: string;
  setActionApprovalId: (v: string) => void;
  actionComment: string;
  setActionComment: (v: string) => void;
  actionLoading: boolean;
  handleSubmitAction: () => void;
  fetchRisk: (id: string) => void;
  handleEdit: (record: any) => void;
  handleStartExecution: (record: any) => void;
  handleViewExecution: (record: any) => void;
  renderApprovalTimeline: () => React.ReactNode;
  executionDrawerVisible: boolean;
  setExecutionDrawerVisible: (v: boolean) => void;
  executionSteps: ChangeExecution[];
  executionLoading: boolean;
  selectedExecutionRequest: ChangeRequest | null;
  handleSubmitForApproval: (id: string) => void;
  handleDelete: (id: string) => void;
}

export const ChangeRequestManagementModals: React.FC<ChangeRequestManagementModalsProps> = (props) => (
  <>
      {/* ==================== Create/Edit Modal ==================== */}
      <Modal
        title={props.editingRequest ? '编辑变更请求' : '创建变更请求'}
        open={props.modalVisible}
        onOk={props.handleSave}
        confirmLoading={props.confirmLoading}
        onCancel={() => props.setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form form={props.form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入变更标题' }]}
          >
            <Input placeholder="输入变更请求标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="详细描述变更内容" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="changeType"
                label="变更类型"
                rules={[{ required: true, message: '请选择变更类型' }]}
              >
                <Select placeholder="选择变更类型">
                  <Select.Option value="standard">标准变更</Select.Option>
                  <Select.Option value="normal">普通变更</Select.Option>
                  <Select.Option value="emergency">紧急变更</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="riskLevel" label="风险等级">
                <Select placeholder="选择风险等级">
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="critical">严重</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="impactScope" label="影响范围">
                <Select placeholder="选择影响范围">
                  <Select.Option value="minor">轻微</Select.Option>
                  <Select.Option value="major">重大</Select.Option>
                  <Select.Option value="significant">显著</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="rollbackPlan" label="回滚方案">
            <TextArea rows={2} placeholder="描述回滚方案" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scheduledStart" label="计划开始时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择开始时间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduledEnd" label="计划结束时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择结束时间" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ==================== Detail Drawer ==================== */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            <span>{props.selectedRequest?.title ?? '变更详情'}</span>
          </Space>
        }
        open={props.detailDrawerVisible}
        onClose={() => props.setDetailDrawerVisible(false)}
        width={640}
      >
        {props.selectedRequest && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
              <Descriptions.Item label="状态" span={2}>
                <Badge
                  status={statusColor[props.selectedRequest.status] as any}
                  text={statusLabel[props.selectedRequest.status]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="变更类型">
                <Tag>{changeTypeLabel[props.selectedRequest.changeType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevelColor[props.selectedRequest.riskLevel]}>
                  {riskLevelLabel[props.selectedRequest.riskLevel]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="影响范围">
                {props.selectedRequest.impactScope ? impactScopeLabel[props.selectedRequest.impactScope] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {props.selectedRequest.createdBy ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(props.selectedRequest.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {props.selectedRequest.description ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="回滚方案" span={2}>
                {props.selectedRequest.rollbackPlan ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划开始">
                {props.selectedRequest.scheduledStart
                  ? dayjs(props.selectedRequest.scheduledStart).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划结束">
                {props.selectedRequest.scheduledEnd
                  ? dayjs(props.selectedRequest.scheduledEnd).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Approval Chain Section */}
            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <CheckOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              审批链
            </Title>
            {props.renderApprovalTimeline()}

            {/* AI Risk Analysis Section (TR-03) */}
            <div
              style={{
                marginTop: spacing.lg,
                borderTop: `1px solid ${colors.neutral[200]}`,
                paddingTop: spacing.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <Title level={4} style={{ marginBottom: 0 }}>
                  <BulbOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
                  AI 风险评估
                </Title>
                <Button
                  size="small"
                  loading={props.riskLoading}
                  onClick={() => props.fetchRisk(props.selectedRequest.id)}
                >
                  {props.riskAnalysis ? '重新评估' : '开始评估'}
                </Button>
              </div>

              {props.riskLoading && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text type="secondary">正在分析变更风险…</Text>
                </div>
              )}

              {!props.riskLoading && !props.riskAnalysis && (
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  点击"开始评估"，基于变更类型、优先级、关键词与历史完成率生成风险评分。
                </Text>
              )}

              {!props.riskLoading && props.riskAnalysis && (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ fontSize: spacing[4] }}>
                      {props.riskAnalysis.risk_score}
                    </Text>
                    <Tag
                      color={
                        props.riskAnalysis.risk_level === 'high'
                          ? 'red'
                          : props.riskAnalysis.risk_level === 'medium'
                            ? 'orange'
                            : 'green'
                      }
                      style={{ fontWeight: 600 }}
                    >
                      {props.riskAnalysis.risk_level === 'high'
                        ? '高风险'
                        : props.riskAnalysis.risk_level === 'medium'
                          ? '中风险'
                          : '低风险'}
                    </Tag>
                  </div>

                  {props.riskAnalysis.factors && props.riskAnalysis.factors.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        评估因素
                      </Text>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                        {props.riskAnalysis.factors.map((f, idx) => (
                          <li key={String(idx)}>
                            <Text style={{ fontSize: spacing[3] }}>
                              {f.name}（权重 {f.weight}）— {f.reason}
                            </Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {props.riskAnalysis.suggestions && props.riskAnalysis.suggestions.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        建议
                      </Text>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                        {props.riskAnalysis.suggestions.map((s, idx) => (
                          <li key={String(idx)}>
                            <Text style={{ fontSize: spacing[3] }}>{s}</Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Space>
              )}
            </div>

            {/* Action Buttons for draft */}
            {props.selectedRequest.status === 'draft' && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Space>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      props.setDetailDrawerVisible(false);
                      props.handleEdit(props.selectedRequest);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => {
                      props.handleSubmitForApproval(props.selectedRequest.id);
                      props.setDetailDrawerVisible(false);
                    }}
                  >
                    提交审批
                  </Button>
                </Space>
              </div>
            )}

            {/* Execution Button for approved */}
            {props.selectedRequest.status === 'approved' && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    props.handleStartExecution(props.selectedRequest);
                    props.setDetailDrawerVisible(false);
                  }}
                >
                  开始执行
                </Button>
              </div>
            )}

            {/* View Execution for implementing/completed */}
            {(props.selectedRequest.status === 'implementing' ||
              props.selectedRequest.status === 'completed') && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    props.setDetailDrawerVisible(false);
                    props.handleViewExecution(props.selectedRequest);
                  }}
                >
                  查看执行进度
                </Button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ==================== Approve/Reject Modal ==================== */}
      <Modal
        title={props.actionType === 'approve' ? '审批通过' : '拒绝变更'}
        open={props.actionModalVisible}
        onOk={props.handleSubmitAction}
        onCancel={() => props.setActionModalVisible(false)}
        confirmLoading={props.actionLoading}
        okText={props.actionType === 'approve' ? '确认通过' : '确认拒绝'}
        okButtonProps={props.actionType === 'reject' ? { danger: true } : {}}
        destroyOnClose
      >
        <div style={{ marginTop: spacing.md }}>
          <Text style={{ display: 'block', marginBottom: spacing.sm }}>
            {props.actionType === 'approve' ? '请确认审批通过此变更请求:' : '请填写拒绝原因:'}
          </Text>
          <TextArea
            rows={3}
            placeholder={props.actionType === 'approve' ? '审批备注（可选）' : '请输入拒绝原因'}
            value={props.actionComment}
            onChange={(e) => props.setActionComment(e.target.value)}
          />
        </div>
      </Modal>

      {/* ==================== Execution Progress Drawer ==================== */}
      <Drawer
        title={
          <Space>
            <PlayCircleOutlined style={{ color: colors.primary[500] }} />
            <span>执行进度 - {props.selectedExecutionRequest?.title}</span>
          </Space>
        }
        open={props.executionDrawerVisible}
        onClose={() => props.setExecutionDrawerVisible(false)}
        width={640}
      >
        {props.selectedExecutionRequest && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
              <Descriptions.Item label="状态" span={2}>
                <Badge
                  status={statusColor[props.selectedExecutionRequest.status] as any}
                  text={statusLabel[props.selectedExecutionRequest.status]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="变更类型">
                {changeTypeLabel[props.selectedExecutionRequest.changeType]}
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevelColor[props.selectedExecutionRequest.riskLevel]}>
                  {riskLevelLabel[props.selectedExecutionRequest.riskLevel]}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <ClockCircleOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              步骤执行详情
            </Title>
            {props.renderExecutionProgress()}
          </>
        )}
      </Drawer>
  </>
);
