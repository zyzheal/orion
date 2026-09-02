/**
 * Deploy Modals & Drawers
 * Extracted from DeployPage.tsx to reduce main component size.
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Button,
  Drawer,
  Descriptions,
  Row,
  Col,
  Statistic,
  Steps,
  Timeline,
  Space,
  Tag,
  Progress,
  DatePicker,
  Switch,
  Card,
  Typography,
} from 'antd';
import type { Deployment } from '@/api/deployments';
import type { HealthCheckResult } from '@/api/deployments';
import {
  type ReleaseNotes,
  type ReleaseNotesChange,
} from '@/api/deploy';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  RollbackOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  envColorMap,
  envLabelMap,
  statusColorMap,
  statusIconMap,
  statusLabelMap,
  strategyColorMap,
  strategyLabelMap,
  ProgressiveDeployment,
} from './config';

const { Title, Text } = Typography;

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface DeployModalsProps {
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  createForm: FormInstance;
  handleCreate: () => void;
  submitting: boolean;

  emergencyModalVisible: boolean;
  setEmergencyModalVisible: (v: boolean) => void;
  emergencyForm: FormInstance;
  handleEmergencyDeploy: () => void;
  emergencyLoading: boolean;

  deployWindowModalVisible: boolean;
  setDeployWindowModalVisible: (v: boolean) => void;
  deployWindowForm: FormInstance;
  handleCreateDeployWindow: () => void;
  deployWindowSubmitting: boolean;

  progressiveDeployModalVisible: boolean;
  setProgressiveDeployModalVisible: (v: boolean) => void;
  progressiveDeployForm: FormInstance;
  handleCreateProgressiveDeploy: () => void;
  progressiveDeploySubmitting: boolean;

  selectedProgressiveDeploy: ProgressiveDeployment | null;
  progressiveDetailVisible: boolean;
  setProgressiveDetailVisible: (v: boolean) => void;
  handleAdvanceStage: (id: string) => void;
  handleRollbackProgressive: (id: string) => void;

  selectedDeployment: Deployment | null;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;

  releaseNotes: ReleaseNotes | null;
  releaseNotesLoading: boolean;
  generatingNotes: boolean;
  handleGenerateReleaseNotes: () => void;
}

export const DeployModals: React.FC<DeployModalsProps> = (props) => (
  <>
      {/* Create Deployment Modal */}
      <Modal
        title="创建部署任务"
        open={props.createModalVisible}
        onCancel={() => props.setCreateModalVisible(false)}
        onOk={props.handleCreate}
        confirmLoading={props.submitting}
        width={600}
        destroyOnClose
      >
        <Form form={props.createForm} layout="vertical">
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="如: 1.2.3" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="目标环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              options={[
                { label: '开发', value: 'dev' },
                { label: '预发', value: 'staging' },
                { label: '生产', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="strategy"
            label="部署策略"
            rules={[{ required: true, message: '请选择策略' }]}
          >
            <Select
              options={[
                { label: '蓝绿部署', value: 'blue-green' },
                { label: '金丝雀', value: 'canary' },
                { label: '滚动部署', value: 'rolling' },
                { label: '重建部署', value: 'recreate' },
              ]}
            />
          </Form.Item>
          <Form.Item name="pipelineRunId" label="Pipeline Run ID">
            <Input placeholder="可选，关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="可选，Git commit hash" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergency Deploy Modal */}
      <Modal
        title={
          <>
            <ThunderboltOutlined style={{ marginRight: spacing.sm, color: colors.error[400] }} />
            紧急部署
          </>
        }
        open={props.emergencyModalVisible}
        onCancel={() => props.setEmergencyModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Alert
          message="紧急部署将绕过部署窗口限制"
          description="此操作需要审批并记录审计日志，请确认紧急部署的必要性"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Form form={props.emergencyForm} layout="vertical">
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="如: 1.2.4-hotfix" />
          </Form.Item>
          <Form.Item
            name="pipelineRunId"
            label="Pipeline Run ID"
            rules={[{ required: true, message: '请输入 Pipeline Run ID' }]}
          >
            <Input placeholder="关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="Git commit hash" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="紧急原因"
            rules={[{ required: true, message: '请说明紧急部署原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细说明紧急部署原因..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              danger
              block
              onClick={props.handleEmergencyDeploy}
              loading={props.emergencyLoading}
            >
              确认提交紧急部署
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Deploy Window Create Modal */}
      <Modal
        title={
          <>
            <ClockCircleOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
            创建部署窗口
          </>
        }
        open={props.deployWindowModalVisible}
        onCancel={() => props.setDeployWindowModalVisible(false)}
        onOk={() => props.deployWindowForm.submit()}
        confirmLoading={props.deployWindowSubmitting}
        width={600}
        destroyOnClose
      >
        <Form form={props.deployWindowForm} layout="vertical" onFinish={props.props.handleCreateDeployWindow}>
          <Form.Item
            name="name"
            label="窗口名称"
            rules={[{ required: true, message: '请输入窗口名称' }]}
          >
            <Input placeholder="如: 生产窗口-工作日" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="目标环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              options={[
                { label: '开发', value: 'dev' },
                { label: '预发', value: 'staging' },
                { label: '生产', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label="结束时间"
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="recurring" label="循环执行" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.recurring !== curr.recurring}>
            {({ getFieldValue }) =>
              getFieldValue('recurring') ? (
                <Form.Item
                  name="recurringPattern"
                  label="循环模式"
                  rules={[{ required: true, message: '请选择循环模式' }]}
                >
                  <Select
                    options={[
                      { label: '每日', value: 'daily' },
                      { label: '每周', value: 'weekly' },
                      { label: '每月', value: 'monthly' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述此部署窗口的用途..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Progressive Deploy Create Modal */}
      <Modal
        title={
          <>
            <RiseOutlined style={{ marginRight: spacing.sm, color: colors.success[500] }} />
            创建渐进式部署
          </>
        }
        open={props.progressiveDeployModalVisible}
        onCancel={() => props.setProgressiveDeployModalVisible(false)}
        onOk={() => props.progressiveDeployForm.submit()}
        confirmLoading={props.progressiveDeploySubmitting}
        width={600}
        destroyOnClose
      >
        <Alert
          message="渐进式部署将分阶段逐步增加流量"
          description="流量将按 Canary (5%) → 25% → 50% → 75% → 100% 逐步推进，每个阶段需要确认后推进到下一阶段"
          type="info"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Form
          form={props.progressiveDeployForm}
          layout="vertical"
          onFinish={props.props.handleCreateProgressiveDeploy}
        >
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="如: 2.1.0" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="目标环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              options={[
                { label: '开发', value: 'dev' },
                { label: '预发', value: 'staging' },
                { label: '生产', value: 'prod' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Progressive Deploy Detail Drawer */}
      <Drawer
        title={
          props.selectedProgressiveDeploy
            ? `${props.selectedProgressiveDeploy.appName} v${props.selectedProgressiveDeploy.version} - 渐进式部署`
            : '渐进式部署详情'
        }
        open={props.progressiveDetailVisible}
        onClose={() => props.setProgressiveDetailVisible(false)}
        width={800}
        destroyOnClose
      >
        {props.selectedProgressiveDeploy && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="应用">
                {props.selectedProgressiveDeploy.appName}
              </Descriptions.Item>
              <Descriptions.Item label="版本">
                v{props.selectedProgressiveDeploy.version}
              </Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={envColorMap[props.selectedProgressiveDeploy.environment]}>
                  {envLabelMap[props.selectedProgressiveDeploy.environment] ||
                    props.selectedProgressiveDeploy.environment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const sMap: Record<string, { color: string; label: string }> = {
                    pending: { color: 'default', label: '等待中' },
                    running: { color: 'blue', label: '进行中' },
                    completed: { color: 'green', label: '已完成' },
                    rolled_back: { color: 'gold', label: '已回滚' },
                    failed: { color: 'red', label: '失败' },
                  };
                  const cfg = sMap[props.selectedProgressiveDeploy.status] || {
                    color: 'default',
                    label: props.selectedProgressiveDeploy.status,
                  };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {props.selectedProgressiveDeploy.createdAt}
              </Descriptions.Item>
            </Descriptions>

            {/* Stage Progress */}
            <Card size="small" title="部署阶段">
              <Steps
                direction="vertical"
                current={props.selectedProgressiveDeploy.currentStage}
                items={props.selectedProgressiveDeploy.stages.map((stage) => ({
                  title: stage.name,
                  description: (
                    <div>
                      <Tag
                        color={
                          stage.status === 'completed'
                            ? 'green'
                            : stage.status === 'running'
                              ? 'blue'
                              : stage.status === 'failed'
                                ? 'red'
                                : 'default'
                        }
                      >
                        {stage.status === 'completed'
                          ? '已完成'
                          : stage.status === 'running'
                            ? '进行中'
                            : stage.status === 'failed'
                              ? '失败'
                              : '等待中'}
                      </Tag>
                      <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                        流量 {stage.trafficPercent}%
                      </Text>
                      {stage.startedAt && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            开始: {stage.startedAt}
                          </Text>
                        </div>
                      )}
                      {stage.completedAt && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            完成: {stage.completedAt}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                  status:
                    stage.status === 'completed'
                      ? 'finish'
                      : stage.status === 'running'
                        ? 'process'
                        : stage.status === 'failed'
                          ? 'error'
                          : 'wait',
                }))}
              />
            </Card>

            {/* Overall Progress */}
            <Card size="small" title="总体进度">
              {(() => {
                const completed = props.selectedProgressiveDeploy.stages.filter(
                  (s) => s.status === 'completed'
                ).length;
                const percent = Math.round(
                  (completed / props.selectedProgressiveDeploy.stages.length) * 100
                );
                return (
                  <Progress
                    percent={percent}
                    status={
                      props.selectedProgressiveDeploy.status === 'rolled_back'
                        ? 'exception'
                        : props.selectedProgressiveDeploy.status === 'completed'
                          ? 'success'
                          : 'active'
                    }
                    strokeWidth={12}
                  />
                );
              })()}
            </Card>

            {/* Actions */}
            {props.selectedProgressiveDeploy.status === 'running' && (
              <Space>
                <Button
                  type="primary"
                  icon={<RiseOutlined />}
                  onClick={() => props.handleAdvanceStage(props.selectedProgressiveDeploy.id)}
                >
                  推进到下一阶段
                </Button>
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => props.handleRollbackProgressive(props.selectedProgressiveDeploy.id)}
                >
                  回滚部署
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={
          props.selectedDeployment
            ? `${props.selectedDeployment.appName} v${props.selectedDeployment.version}`
            : '部署详情'
        }
        open={props.detailDrawerVisible}
        onClose={() => props.setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {props.selectedDeployment && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="应用">{props.selectedDeployment.appName}</Descriptions.Item>
              <Descriptions.Item label="版本">v{props.selectedDeployment.version}</Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={envColorMap[props.selectedDeployment.environment]}>
                  {envLabelMap[props.selectedDeployment.environment] || props.selectedDeployment.environment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="策略">
                <Tag color={strategyColorMap[props.selectedDeployment.strategy]}>
                  {strategyLabelMap[props.selectedDeployment.strategy] || props.selectedDeployment.strategy}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={statusColorMap[props.selectedDeployment.status]}
                  icon={statusIconMap[props.selectedDeployment.status]}
                >
                  {statusLabelMap[props.selectedDeployment.status] || props.selectedDeployment.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发人">
                {props.selectedDeployment.triggeredBy || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Commit">
                {props.selectedDeployment.commit ? (
                  <Text copyable style={{ fontFamily: 'monospace' }}>
                    {props.selectedDeployment.commit}
                  </Text>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Pipeline Run">
                {props.selectedDeployment.pipelineRunId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {props.selectedDeployment.startTime
                  ? dayjs(props.selectedDeployment.startTime).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {props.selectedDeployment.endTime
                  ? dayjs(props.selectedDeployment.endTime).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Deployment Stages */}
            {props.selectedDeployment.stages && props.selectedDeployment.stages.length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <Title level={5}>部署阶段</Title>
                <Steps
                  direction="vertical"
                  current={
                    props.selectedDeployment.status === 'success'
                      ? props.selectedDeployment.stages.length
                      : props.selectedDeployment.stages.findIndex((s) => s.status === 'failed') >= 0
                        ? props.selectedDeployment.stages.findIndex((s) => s.status === 'failed')
                        : props.selectedDeployment.stages.findIndex((s) => s.status === 'running')
                  }
                  items={props.selectedDeployment.stages.map((stage) => ({
                    title: stage.name,
                    description: (
                      <div>
                        <Tag color={statusColorMap[stage.status] || 'default'}>
                          {statusLabelMap[stage.status] || stage.status}
                        </Tag>
                        {stage.duration && (
                          <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                            {stage.duration}s
                          </Text>
                        )}
                        {stage.details && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {stage.details}
                            </Text>
                          </div>
                        )}
                      </div>
                    ),
                    status:
                      stage.status === 'success'
                        ? 'finish'
                        : stage.status === 'failed'
                          ? 'error'
                          : 'process',
                  }))}
                />
              </div>
            )}

            {/* Health Checks */}
            {props.selectedDeployment.healthChecks && props.selectedDeployment.healthChecks.length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <Title level={5}>健康检查</Title>
                <Timeline>
                  {props.selectedDeployment.healthChecks.map((check: HealthCheckResult, idx: number) => (
                    <Timeline.Item
                      key={String(idx)}
                      color={
                        check.status === 'healthy'
                          ? 'green'
                          : check.status === 'unhealthy'
                            ? 'red'
                            : 'orange'
                      }
                    >
                      <Text strong>{check.name}</Text>
                      <Tag
                        color={check.status === 'healthy' ? 'green' : 'orange'}
                        style={{ marginLeft: spacing.sm }}
                      >
                        {check.status}
                      </Tag>
                      {check.message && (
                        <div>
                          <Text type="secondary">{check.message}</Text>
                        </div>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}

            {/* Release Notes */}
            <div style={{ marginTop: spacing.lg }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.md,
                }}
              >
                <Title level={5} style={{ margin: 0 }}>
                  版本说明
                </Title>
                {!props.releaseNotes && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CloudUploadOutlined />}
                    onClick={props.handleGenerateReleaseNotes}
                    loading={props.generatingNotes}
                  >
                    生成版本说明
                  </Button>
                )}
              </div>

              {props.props.releaseNotesLoading && (
                <Card size="small">
                  <Text type="secondary">加载中...</Text>
                </Card>
              )}

              {!props.props.releaseNotesLoading && props.releaseNotes && (
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* Summary */}
                    <Alert message={props.releaseNotes.summary} type="info" showIcon />

                    {/* Metrics */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">总 Commits</Text>}
                          value={props.releaseNotes.metrics.totalCommits}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">变更数</Text>}
                          value={props.releaseNotes.metrics.totalChanges}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">新功能</Text>}
                          value={props.releaseNotes.metrics.features}
                          valueStyle={{ color: colors.success[500] }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">Bug 修复</Text>}
                          value={props.releaseNotes.metrics.fixes}
                          valueStyle={{ color: colors.primary[500] }}
                        />
                      </Col>
                    </Row>

                    {props.releaseNotes.metrics.breakingChanges > 0 && (
                      <Alert
                        message={`包含 ${props.releaseNotes.metrics.breakingChanges} 个 Breaking Changes`}
                        type="warning"
                        showIcon
                      />
                    )}

                    {/* Changes List */}
                    {props.releaseNotes.changes.length > 0 && (
                      <div>
                        <Text strong>变更详情</Text>
                        <div style={{ marginTop: spacing.sm }}>
                          {props.releaseNotes.changes.map((change: ReleaseNotesChange, idx: number) => (
                            <Card
                              key={String(idx)}
                              size="small"
                              style={{ marginBottom: spacing.sm }}
                              type={change.type === 'breaking' ? 'inner' : undefined}
                            >
                              <Space direction="vertical" style={{ width: '100%' }} size={0}>
                                <div
                                  style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}
                                >
                                  <Tag
                                    color={
                                      change.type === 'feature'
                                        ? 'green'
                                        : change.type === 'fix'
                                          ? 'blue'
                                          : change.type === 'breaking'
                                            ? 'red'
                                            : change.type === 'improvement'
                                              ? 'cyan'
                                              : 'default'
                                    }
                                  >
                                    {change.type}
                                  </Tag>
                                  <Text>{change.description}</Text>
                                </div>
                                <Space size="small">
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {change.commit.slice(0, 7)}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    by {change.author}
                                  </Text>
                                  {change.prNumber && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      #{change.prNumber}
                                    </Text>
                                  )}
                                </Space>
                              </Space>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual Notes */}
                    {props.releaseNotes.notes && (
                      <div>
                        <Text strong>补充说明</Text>
                        <div style={{ marginTop: spacing.xs }}>
                          <Text type="secondary">{props.releaseNotes.notes}</Text>
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        生成时间: {dayjs(props.releaseNotes.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </div>
                  </Space>
                </Card>
              )}

              {!props.props.releaseNotesLoading && !props.releaseNotes && (
                <Alert
                  message="暂无版本说明"
                  description="点击上方按钮从 Git 提交历史自动生成版本说明"
                  type="info"
                  showIcon
                />
              )}
            </div>
          </>
        )}
      </Drawer>
  </>
);
