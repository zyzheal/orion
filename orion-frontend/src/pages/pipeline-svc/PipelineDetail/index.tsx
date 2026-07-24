/**
 * Pipeline Detail Page (TASK-905)
 * Pipeline detail view with stages/timeline/logs and re-run actions.
 *
 * P0-3 Fix: Removed silent mock fallback. On API failure, displays error
 * message and allows retry instead of silently showing mock data.
 * Mock data is kept only in test files.
 *
 * Features:
 * - Pipeline info header
 * - Stage timeline/progress visualization
 * - Log viewer section
 * - Re-run trigger button (full pipeline)
 * - Per-stage retry ("从该阶段重跑") for failed/completed runs
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Descriptions, Tabs, Badge, message, Result, Modal, Empty } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  ApartmentOutlined,
  SwapOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { DAGGraph } from '@/components/DAGGraph';
import { getPipelineRun, retryPipelineRun } from '@/api/pipelines';
import { retryFromStage } from '@/api/pipelineRuns';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

// Typed domain interfaces for pipeline detail
interface StepDetail {
  name: string;
  status: string;
  duration?: number;
}

interface StageDetail {
  name: string;
  id?: string;
  status: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  type?: string;
  dependsOn?: string[];
  steps?: StepDetail[];
  logs?: string[];
}

interface PipelineDetailModel {
  id: string;
  name: string;
  runNumber: number;
  status: string;
  branch: string;
  commit?: string;
  version?: string;
  author?: string;
  trigger?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  stages?: StageDetail[];
  context?: Record<string, unknown>;
  pipelineVersion?: string;
}

interface APIFlattenedResponse {
  run: Partial<PipelineDetailModel>;
  stages: StageDetail[];
}

interface RetryStageResponse {
  id?: string;
  run?: { id?: string };
}

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Status color map for stages
const stageStatusColors: Record<string, string> = {
  success: colors.success[500],
  running: colors.primary[500],
  failed: colors.error[500],
  pending: colors.neutral[300],
  warning: colors.warning[500],
  cancelled: colors.neutral[400],
};

// TaskOutputsTable removed - outputs tab now shows Empty state pending API integration

const PipelineDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('stages');
  const [isRerunning, setIsRerunning] = useState(false);
  const [retryingStageId, setRetryingStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineDetailModel | null>(null);

  // Load pipeline detail from API
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const response = await getPipelineRun(id!);
        // response-wrapper wraps bare {run, stages, tasks} into {success, data: {run, stages, tasks}, meta, _legacy}
        const wrapperData = response.data as { data?: unknown };
        const apiData = wrapperData?.data ?? wrapperData;
        if (apiData && (apiData instanceof Object) && ('run' in apiData || 'stages' in apiData)) {
          const run = (apiData as APIFlattenedResponse).run || apiData;
          const flattened = {
            ...run,
            branch: (run as PipelineDetailModel).context?.branch || (run as PipelineDetailModel).branch || 'main',
            commit: (run as PipelineDetailModel).context?.commitSha || (run as PipelineDetailModel).commit || '-',
            version: (run as PipelineDetailModel).context?.version || (run as PipelineDetailModel).pipelineVersion,
            stages: (apiData as APIFlattenedResponse).stages || [],
          };
          setPipeline(flattened);
        } else {
          setApiError('未找到该 Pipeline 运行记录');
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '加载失败，请稍后重试';
        setApiError(errorMsg);
        message.error(`加载 Pipeline 详情失败：${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPipeline();
    }
  }, [id]);

  // Calculate progress percentage
  const totalStages = pipeline?.stages?.length || 0;
  const completedStages = pipeline?.stages?.filter((s: StageDetail) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds || !pipeline) return '-';
    const dur = dayjs.duration(seconds, 'seconds');
    const minutes = Math.floor(dur.asMinutes());
    const secs = dur.seconds();
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  // Handle re-run
  const handleRerun = async () => {
    try {
      await retryPipelineRun(id!);
      message.success('Pipeline 重新运行成功');
      // Reload pipeline detail after re-run
      const response = await getPipelineRun(id!);
      const wrapperData = response.data as { data?: unknown };
      const apiData = wrapperData?.data ?? wrapperData;
      if (apiData && (apiData instanceof Object) && ('run' in apiData || 'stages' in apiData)) {
        const run = (apiData as APIFlattenedResponse).run || apiData;
        const flattened = {
          ...run,
          branch: (run as PipelineDetailModel).context?.branch || (run as PipelineDetailModel).branch || 'main',
          commit: (run as PipelineDetailModel).context?.commitSha || (run as PipelineDetailModel).commit || '-',
          version: (run as PipelineDetailModel).context?.version || (run as PipelineDetailModel).pipelineVersion,
          stages: (apiData as APIFlattenedResponse).stages || [],
        };
        setPipeline(flattened);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`重新运行 Pipeline 失败：${error.message}`);
      } else {
        message.error('重新运行 Pipeline 失败，请稍后重试');
      }
    } finally {
      setIsRerunning(false);
    }
  };

  // Handle retry from a specific stage
  const handleRetryFromStage = (stageId: string, stageName: string) => {
    Modal.confirm({
      title: '从该阶段重跑',
      content: `确认从阶段「${stageName}」开始重新运行？已完成的前置阶段将不会重新执行。`,
      okText: '确认重跑',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRetryingStageId(stageId);
          const response = await retryFromStage(id!, stageId);
          const newRun = response.data as { id?: string; run?: { id?: string } };
          message.success(`已从阶段「${stageName}」重新运行`);
          // Redirect to the new run's detail page
          if (newRun?.id || newRun?.run?.id) {
            const runId = newRun.id || newRun.run?.id;
            navigate(`/pipelines/runs/${runId}`);
          } else {
            // Fallback: reload current page to see updated status
            const reloadResp = await getPipelineRun(id!);
            const reloaded = reloadResp.data as { run?: unknown; stages?: unknown };
            const run = reloaded?.run as { id?: string; context?: { branch?: string; commitSha?: string }; branch?: string; commit?: string; pipelineVersion?: string };
            setPipeline({
              ...run,
              branch: run.context?.branch || run.branch || 'main',
              commit: run.context?.commitSha || run.commit || '-',
              stages: reloaded?.stages as unknown[],
            });
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`从阶段「${stageName}」重跑失败：${error.message}`);
          } else {
            message.error(`从阶段「${stageName}」重跑失败，请稍后重试`);
          }
        } finally {
          setRetryingStageId(null);
        }
      },
    });
  };

  const triggerLabel: Record<string, string> = {
    manual: '手动触发',
    push: 'Push 触发',
    schedule: '定时触发',
    api: 'API 触发',
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <CardPanel>Loading...</CardPanel>
      </div>
    );
  }

  // Error state
  if (apiError && !pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={apiError}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Back button and page title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/pipelines')}
          disabled={loading}
        >
          返回列表
        </Button>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}>
            <ApiOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {pipeline.name} #{pipeline.runNumber}
          </Title>
          <Text type="secondary">
            {pipeline.commit && (
              <Tag color="default" style={{ marginRight: spacing.sm }}>
                {pipeline.commit}
              </Tag>
            )}
            分支: {pipeline.branch}
          </Text>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Space>
            {pipeline && <StatusBadge status={pipeline.status} size="medium" />}
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={isRerunning}
              onClick={handleRerun}
              disabled={!pipeline || pipeline.status === 'running' || loading}
            >
              {isRerunning ? '触发中...' : '重新运行'}
            </Button>
          </Space>
        </div>
      </div>

      {/* Pipeline info card */}
      <CardPanel>
        <Descriptions column={4} size="small" bordered labelStyle={{ width: 120 }}>
          <Descriptions.Item label="状态">
            <StatusBadge status={pipeline.status} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="分支">
            <Tag color="blue">{pipeline.branch}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="触发人">
            <Text code>{pipeline.author}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="触发方式">
            <Tag>{triggerLabel[pipeline.trigger] || pipeline.trigger}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            <Space>
              <ClockCircleOutlined />
              <Text type="secondary">
                {dayjs(pipeline.startTime).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {pipeline.endTime ? (
              <Text type="secondary">{dayjs(pipeline.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">{formatDuration(pipeline.duration)}</Descriptions.Item>
          <Descriptions.Item label="进度">
            <Space>
              <Badge status="processing" text={`${completedStages}/${totalStages} 阶段完成`} />
              <Text type="secondary">({progressPercent}%)</Text>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </CardPanel>

      {/* Tabbed content: Stages / Logs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: spacing.md }}>
        <TabPane
          tab={
            <Space>
              <PlayCircleOutlined />
              阶段详情
            </Space>
          }
          key="stages"
        >
          {/* Stage timeline visualization */}
          <CardPanel title="执行阶段">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {/* Stage progress bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 0',
                }}
              >
                {pipeline.stages?.map((stage: StageDetail, index: number) => (
                  <React.Fragment key={stage.name}>
                    {/* Stage node */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: stageStatusColors[stage.status] || colors.neutral[300],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: colors.neutral[0],
                          fontSize: spacing[4],
                          fontWeight: 600,
                          boxShadow:
                            stage.status === 'running' ? '0 0 0 4px rgba(24,144,255,0.2)' : 'none',
                          animation:
                            stage.status === 'running'
                              ? 'status-pulse 1.5s ease-in-out infinite'
                              : 'none',
                        }}
                      >
                        {stage.status === 'success'
                          ? '\u2713'
                          : stage.status === 'failed'
                            ? '\u2717'
                            : index + 1}
                      </div>
                      <Text
                        style={{
                          fontSize: spacing[2],
                          textAlign: 'center',
                          maxWidth: 80,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={stage.name}
                      >
                        {stage.name}
                      </Text>
                      {stage.duration && (
                        <Text type="secondary" style={{ fontSize: spacing[2] }}>
                          {formatDuration(stage.duration)}
                        </Text>
                      )}
                    </div>
                    {/* Connector line */}
                    {index < (pipeline.stages?.length || 0) - 1 && (
                      <div
                        style={{
                          flex: 1,
                          height: 3,
                          backgroundColor:
                            pipeline.stages![index + 1].status === 'pending'
                              ? colors.light.border.light
                              : stageStatusColors[pipeline.stages![index].status] ||
                                colors.neutral[300],
                          borderRadius: 2,
                          marginTop: -16,
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Stage details table */}
              {pipeline.stages && pipeline.stages.length > 0 && (
                <div style={{ marginTop: spacing.sm }}>
                  {pipeline.stages.map((stage: StageDetail, index: number) => (
                    <Card
                      key={stage.name}
                      size="small"
                      style={{ marginBottom: spacing.sm }}
                      title={
                        <Space>
                          <StatusBadge status={stage.status} size="small" />
                          <Text strong>
                            {index + 1}. {stage.name}
                          </Text>
                        </Space>
                      }
                      extra={
                        <Space>
                          {stage.duration && (
                            <Text type="secondary" style={{ fontSize: spacing[3] }}>
                              耗时: {formatDuration(stage.duration)}
                            </Text>
                          )}
                          {/* Per-stage retry button: only show for failed/completed runs */}
                          {(pipeline.status === 'failed' || pipeline.status === 'success') && (
                            <Button
                              type="link"
                              size="small"
                              icon={<ReloadOutlined />}
                              loading={retryingStageId === stage.id || retryingStageId === stage.name}
                              onClick={() =>
                                handleRetryFromStage(stage.id || stage.name, stage.name)
                              }
                            >
                              从该阶段重跑
                            </Button>
                          )}
                        </Space>
                      }
                    >
                      {/* Steps within the stage */}
                      {stage.steps && stage.steps.length > 0 && (
                        <Space direction="vertical" size={4}>
                          {stage.steps.map((step: StepDetail) => (
                            <div
                              key={step.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.sm,
                                fontSize: spacing[3],
                              }}
                            >
                              <StatusBadge status={step.status} size="small" variant="subtle" />
                              <Text>{step.name}</Text>
                              {step.duration && (
                                <Text
                                  type="secondary"
                                  style={{ fontSize: spacing[2], marginLeft: 'auto' }}
                                >
                                  {formatDuration(step.duration)}
                                </Text>
                              )}
                            </div>
                          ))}
                        </Space>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </Space>
          </CardPanel>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <CodeOutlined />
              执行日志
            </Space>
          }
          key="logs"
        >
          {/* Log viewer */}
          <CardPanel title="日志输出">
            <div
              style={{
                background: colors.neutral[900],
                borderRadius: 6,
                padding: spacing.md,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: spacing[3],
                lineHeight: 1.6,
                maxHeight: 500,
                overflowY: 'auto',
                color: colors.neutral[300],
              }}
            >
              {pipeline.stages?.map((stage: StageDetail) => (
                <div key={stage.name} style={{ marginBottom: spacing.md }}>
                  {/* Stage header */}
                  <div
                    style={{
                      color: stageStatusColors[stage.status],
                      fontWeight: 600,
                      marginBottom: spacing.sm,
                      borderBottom: '1px solid colors.neutral[800]',
                      paddingBottom: 4,
                    }}
                  >
                    [{dayjs(stage.startTime || pipeline.startTime).format('HH:mm:ss')}] === Stage:{' '}
                    {stage.name} ===
                  </div>
                  {/* Stage logs */}
                  {stage.logs && stage.logs.length > 0 ? (
                    stage.logs.map((log: string, index: number) => (
                      <div key={index} style={{ paddingLeft: spacing.md }}>
                        {log.includes('FAIL') ? (
                          <span style={{ color: colors.error[500] }}>{log}</span>
                        ) : log.includes('passed') ||
                          log.includes('successful') ||
                          log.includes('Success') ? (
                          <span style={{ color: colors.success[600] }}>{log}</span>
                        ) : (
                          log
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ paddingLeft: spacing.md, color: colors.neutral[500] }}>
                      {stage.status === 'pending' ? '[Waiting to start...]' : '[No logs available]'}
                    </div>
                  )}
                </div>
              ))}
              {/* Cursor indicator */}
              {pipeline.status === 'running' && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    backgroundColor: colors.neutral[300],
                    animation: 'blink 1s step-end infinite',
                  }}
                />
              )}
            </div>
          </CardPanel>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <ApartmentOutlined />
              DAG 视图
            </Space>
          }
          key="dag"
        >
          {/* DAG visualization */}
          <CardPanel title="依赖关系图">
            {pipeline.stages && pipeline.stages.length > 0 ? (
              <DAGGraph
                stages={pipeline.stages.map((stage: StageDetail, idx: number) => ({
                  id: `stage-${idx}`,
                  name: stage.name,
                  type: stage.type || 'custom',
                  status: stage.status || 'pending',
                  duration: stage.duration,
                  dependsOn: stage.dependsOn || [],
                  steps: stage.steps,
                  startTime: stage.startTime,
                  endTime: stage.endTime,
                }))}
                height={400}
                showMiniMap={true}
                onNodeClick={(nodeId, data) => {
                  console.log('Clicked node:', nodeId, data);
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">暂无阶段数据</Text>
              </div>
            )}
          </CardPanel>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <SwapOutlined />
              任务输出
            </Space>
          }
          key="outputs"
        >
          {/* Task outputs / variable propagation table */}
          <CardPanel title="任务输出与变量传播">
            <Empty description="任务输出变量传播功能即将上线" />
          </CardPanel>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default PipelineDetail;
