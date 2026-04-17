/**
 * AgentRunDetail Page
 * - Status banner: run status + progress
 * - Decision timeline: step-by-step agent decisions (action, input, output, reasoning)
 * - Approval records: status and approver at each approval gate
 * - Final result: PR URL, fix summary, failure reason
 * - Actions: cancel, retry, replay
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Descriptions,
  Divider,
  Collapse,
  Card,
  message,
  Progress,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SyncOutlined,
  FileTextOutlined,
  CodeOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import Timeline, { type TimelineEvent } from '@/components/Timeline';
import {
  getAgentRun,
  getAgentRunDecisions,
  getAgentApprovals,
  cancelAgentRun,
  retryAgentRun,
  type AgentRun,
  type AgentDecision,
  type AgentApproval,
} from '@/api/agents';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const statusToBadge: Record<string, 'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'> = {
  running: 'running',
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
  waiting_approval: 'warning',
};

const actionIconMap: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />,
  write_code: <CodeOutlined />,
  run_test: <ExperimentOutlined />,
  create_pr: <SyncOutlined />,
  request_approval: <WarningOutlined />,
};

// ============================================================================
// AgentRunDetail Component
// ============================================================================

const AgentRunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (runId: string) => {
    setLoading(true);
    try {
      const [runRes, decisionsRes, approvalsRes] = await Promise.all([
        getAgentRun(runId).catch(() => ({ data: { data: null } })),
        getAgentRunDecisions(runId).catch(() => ({ data: { data: [] } })),
        getAgentApprovals({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
      ]);
      setRun(runRes.data?.data || null);
      setDecisions(decisionsRes.data?.data || []);
      setApprovals((approvalsRes.data?.data || []).filter((a: AgentApproval) => a.runId === runId));
    } catch (err: any) {
      console.error('Failed to load run data:', err);
      message.error('加载运行数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!run) return;
    setActionLoading('cancel');
    try {
      await cancelAgentRun(run.id);
      message.success('运行已取消');
      await loadData(run.id);
    } catch (err: any) {
      message.error(`取消失败：${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async () => {
    if (!run) return;
    setActionLoading('retry');
    try {
      await retryAgentRun(run.id);
      message.success('运行已重试');
      await loadData(run.id);
    } catch (err: any) {
      message.error(`重试失败：${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!run) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <div>
            <Text type="secondary">未找到该运行记录</Text>
            <br />
            <Button type="link" onClick={() => navigate('/agents/dashboard')}>
              返回仪表盘
            </Button>
          </div>
        )}
      </div>
    );
  }

  const progress = run.totalSteps > 0 ? Math.round((run.currentStep / run.totalSteps) * 100) : 0;
  const isRunning = run.status === 'running';
  const duration = run.completedAt
    ? dayjs(run.completedAt).diff(dayjs(run.startedAt), 'second')
    : dayjs().diff(dayjs(run.startedAt), 'second');

  // Build timeline events from decisions
  const timelineEvents: TimelineEvent[] = decisions
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((decision) => {
      let status: 'success' | 'failed' | 'warning' | 'running' | 'pending' = 'success';
      if (decision.error) status = 'failed';
      else if (decision.action === 'request_approval') status = 'warning';

      const descriptionParts: string[] = [];
      if (decision.reasoning) descriptionParts.push(decision.reasoning);
      if (decision.actionInput && Object.keys(decision.actionInput).length > 0) {
        descriptionParts.push(`输入: ${JSON.stringify(decision.actionInput)}`);
      }
      if (decision.actionOutput && Object.keys(decision.actionOutput).length > 0) {
        descriptionParts.push(`输出: ${JSON.stringify(decision.actionOutput)}`);
      }
      if (decision.error) descriptionParts.push(`错误: ${decision.error}`);

      return {
        id: decision.id,
        time: decision.createdAt,
        title: `步骤 ${decision.stepNumber}: ${decision.action}`,
        description: descriptionParts.join('\n'),
        status,
        icon: actionIconMap[decision.action] || <ThunderboltOutlined />,
      };
    });

  return (
    <div style={{ padding: 0 }} data-testid="agent-run-detail-page">
      {/* Breadcrumb / back */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/agents/dashboard')}
          style={{ padding: 0 }}
        >
          返回 Agent 仪表盘
        </Button>
      </div>

      {/* Status banner */}
      <Card
        style={{
          marginBottom: 24,
          borderLeft: `4px solid ${
            run.status === 'completed' ? '#52c41a' :
            run.status === 'failed' ? '#f5222d' :
            run.status === 'running' ? '#1890ff' :
            run.status === 'waiting_approval' ? '#faad14' : '#8c8c8c'
          }`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Title level={4} style={{ margin: 0 }}>
                运行 {run.id.slice(0, 8)}...
              </Title>
              <StatusBadge status={statusToBadge[run.status] || 'unknown'} />
            </Space>
            <Text type="secondary">
              触发事件: <Tag>{run.triggerEvent}</Tag>
              {run.currentAgent && ` · 当前 Agent: ${run.currentAgent.slice(0, 8)}`}
              &nbsp;· 耗时: {duration}s
            </Text>
          </div>
          <Space>
            {isRunning && (
              <Button
                danger
                icon={<PauseCircleOutlined />}
                loading={actionLoading === 'cancel'}
                onClick={handleCancel}
              >
                取消运行
              </Button>
            )}
            {(run.status === 'failed' || run.status === 'cancelled') && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={actionLoading === 'retry'}
                onClick={handleRetry}
              >
                重试
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => id && loadData(id)} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16 }}>
          <Space>
            <Text style={{ fontSize: 12 }}>进度</Text>
            <Progress
              percent={progress}
              size="small"
              style={{ width: 300 }}
              strokeColor={{
                '0%': '#1890ff',
                '100%': '#52c41a',
              }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {run.currentStep} / {run.totalSteps} 步骤
            </Text>
          </Space>
        </div>
      </Card>

      {/* Run metadata */}
      <Card title="运行信息" size="small" style={{ marginBottom: 24 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="运行 ID">
            <Text code>{run.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="工作流 ID">
            {run.workflowId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="触发事件">
            <Tag>{run.triggerEvent}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {dayjs(run.startedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {run.completedAt ? dayjs(run.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="超时时间">
            {run.timeoutAt ? dayjs(run.timeoutAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* Trigger payload */}
        {run.triggerPayload && Object.keys(run.triggerPayload).length > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Title level={5}>触发载荷</Title>
            <pre style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 200,
            }}>
              {JSON.stringify(run.triggerPayload, null, 2)}
            </pre>
          </>
        )}
      </Card>

      {/* Decision timeline */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            决策时间线
          </Space>
        }
        size="small"
        style={{ marginBottom: 24 }}
      >
        {decisions.length > 0 ? (
          <Timeline events={timelineEvents} mode="left" />
        ) : (
          <Text type="secondary">暂无决策记录</Text>
        )}
      </Card>

      {/* Decision details (collapsible) */}
      {decisions.length > 0 && (
        <Card title="决策详情" size="small" style={{ marginBottom: 24 }}>
          <Collapse accordion>
            {decisions
              .sort((a, b) => a.stepNumber - b.stepNumber)
              .map((decision) => (
                <Panel
                  key={decision.id}
                  header={
                    <Space>
                      {actionIconMap[decision.action] || <ThunderboltOutlined />}
                      <Text strong>步骤 {decision.stepNumber}: {decision.action}</Text>
                      {decision.error && (
                        <Tag color="red">错误</Tag>
                      )}
                    </Space>
                  }
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Agent ID">
                      <Text code>{decision.agentId}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="操作">{decision.action}</Descriptions.Item>
                    <Descriptions.Item label="输入">
                      <pre style={{ margin: 0, fontSize: 12, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                        {JSON.stringify(decision.actionInput, null, 2)}
                      </pre>
                    </Descriptions.Item>
                    {decision.actionOutput && (
                      <Descriptions.Item label="输出">
                        <pre style={{ margin: 0, fontSize: 12, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                          {JSON.stringify(decision.actionOutput, null, 2)}
                        </pre>
                      </Descriptions.Item>
                    )}
                    {decision.toolResult && (
                      <Descriptions.Item label="工具结果">
                        <pre style={{ margin: 0, fontSize: 12, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                          {JSON.stringify(decision.toolResult, null, 2)}
                        </pre>
                      </Descriptions.Item>
                    )}
                    {decision.reasoning && (
                      <Descriptions.Item label="推理过程">
                        <Paragraph style={{ margin: 0 }}>{decision.reasoning}</Paragraph>
                      </Descriptions.Item>
                    )}
                    {decision.error && (
                      <Descriptions.Item label="错误">
                        <Alert message={decision.error} type="error" showIcon style={{ fontSize: 12 }} />
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="创建时间">
                      {dayjs(decision.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  </Descriptions>
                </Panel>
              ))}
          </Collapse>
        </Card>
      )}

      {/* Approval records */}
      {approvals.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              审批记录
            </Space>
          }
          size="small"
          style={{ marginBottom: 24 }}
        >
          {approvals.map((approval) => (
            <Card key={approval.id} size="small" style={{ marginBottom: 8 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="操作">{approval.action}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Badge
                    status={
                      approval.status === 'approved' ? 'success' :
                      approval.status === 'rejected' ? 'error' : 'warning'
                    }
                    text={
                      approval.status === 'approved' ? '已通过' :
                      approval.status === 'rejected' ? '已拒绝' : '待审批'
                    }
                  />
                </Descriptions.Item>
                <Descriptions.Item label="原因">{approval.reason || '-'}</Descriptions.Item>
                <Descriptions.Item label="审批人">{approval.approvedBy || '-'}</Descriptions.Item>
                {approval.rejectionReason && (
                  <Descriptions.Item label="拒绝原因">
                    <Text type="danger">{approval.rejectionReason}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="创建时间">
                  {dayjs(approval.createdAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ))}
        </Card>
      )}

      {/* Final result */}
      {run.result && Object.keys(run.result).length > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              运行结果
            </Space>
          }
          size="small"
        >
          {run.result.prUrl && (
            <Alert
              message="PR 已创建"
              description={
                <a href={run.result.prUrl as string} target="_blank" rel="noopener noreferrer">
                  {run.result.prUrl}
                </a>
              }
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          {run.result.summary && (
            <Paragraph>{run.result.summary as string}</Paragraph>
          )}
          {run.result.errorMessage && (
            <Alert
              message="失败原因"
              description={run.result.errorMessage as string}
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 300,
          }}>
            {JSON.stringify(run.result, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default AgentRunDetail;
