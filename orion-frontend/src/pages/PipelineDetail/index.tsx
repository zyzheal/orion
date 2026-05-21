/**
 * Pipeline Detail Page (TASK-905)
 * Pipeline detail view with stages/timeline/logs and re-run actions.
 *
 * Features:
 * - Pipeline info header with latest run data
 * - Stage timeline/progress visualization
 * - Log viewer section
 * - Re-run trigger button (full pipeline)
 * - Per-stage retry ("从该阶段重跑") for failed/completed runs
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tag, Card, Descriptions, Tabs, Badge, message, Result, Table, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing, componentSpacing } from '@/tokens';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  ApartmentOutlined,
  SwapOutlined,
  HistoryOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { DAGGraph } from '@/components/DAGGraph';
import PipelineErrorDetail from '@/components/pipeline/PipelineErrorDetail';
import {
  getPipeline,
  getPipelineRuns,
  triggerPipeline,
} from '@/api/pipelines';
import {
  getPipelineRunDetail,
  retryFromStage,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

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

/**
 * Task output variable — represents a variable produced by a task/stage
 * and optionally propagated to downstream stages.
 */
interface TaskOutput {
  key: string;
  stageName: string;
  taskName: string;
  variableName: string;
  variableValue: string;
  propagatedTo: string[];
}

/**
 * Mock task outputs data.
 * TODO: Replace with real API integration once backend exposes
 * /v1/pipeline-runs/:runId/outputs or similar endpoint.
 */
const mockTaskOutputs: TaskOutput[] = [
  {
    key: '1',
    stageName: 'Build',
    taskName: 'npm-build',
    variableName: 'BUILD_OUTPUT_DIR',
    variableValue: 'dist/',
    propagatedTo: ['Test', 'Package'],
  },
  {
    key: '2',
    stageName: 'Build',
    taskName: 'npm-build',
    variableName: 'BUILD_VERSION',
    variableValue: '1.2.3-abc1234',
    propagatedTo: ['Test', 'Deploy'],
  },
  {
    key: '3',
    stageName: 'Test',
    taskName: 'unit-test',
    variableName: 'COVERAGE_PERCENT',
    variableValue: '87.5',
    propagatedTo: ['Quality Gate'],
  },
  {
    key: '4',
    stageName: 'Test',
    taskName: 'integration-test',
    variableName: 'TEST_REPORT_URL',
    variableValue: 'https://reports.example.com/run-42',
    propagatedTo: [],
  },
  {
    key: '5',
    stageName: 'Package',
    taskName: 'docker-build',
    variableName: 'IMAGE_TAG',
    variableValue: 'registry.example.com/app:1.2.3-abc1234',
    propagatedTo: ['Deploy'],
  },
  {
    key: '6',
    stageName: 'Deploy',
    taskName: 'k8s-deploy',
    variableName: 'DEPLOYED_NAMESPACE',
    variableValue: 'production',
    propagatedTo: [],
  },
];

/**
 * TaskOutputsTable — renders a table of task output variables
 * with propagation information.
 *
 * Currently uses mock data; ready for API integration.
 */
const TaskOutputsTable: React.FC = () => {
  const columns: ColumnsType<TaskOutput> = [
    {
      title: '所属阶段',
      dataIndex: 'stageName',
      key: 'stageName',
      width: 140,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 160,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '变量名',
      dataIndex: 'variableName',
      key: 'variableName',
      width: 200,
      render: (text: string) => (
        <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '变量值',
      dataIndex: 'variableValue',
      key: 'variableValue',
      ellipsis: true,
      render: (text: string) => (
        <Text
          code
          style={{
            maxWidth: 300,
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
          }}
          title={text}
        >
          {text}
        </Text>
      ),
    },
    {
      title: '传播至',
      dataIndex: 'propagatedTo',
      key: 'propagatedTo',
      width: 220,
      render: (targets: string[]) =>
        targets.length > 0 ? (
          <Space wrap>
            {targets.map((t) => (
              <Tag key={t} color="green">
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">无</Text>
        ),
    },
  ];

  return (
    <Table<TaskOutput>
      columns={columns}
      dataSource={mockTaskOutputs}
      size="middle"
      pagination={false}
      bordered
      rowKey="key"
    />
  );
};

/**
 * 统一解析 API 响应：兼容后端裸对象和 { data: ... } 包装两种格式
 */
function extractData<T = any>(response: unknown): T | null {
  const res = response as any;
  if (!res) return null;
  // Axios response: res.data is the backend raw response
  const backend = res.data ?? res;
  // Backend may wrap in { data: {...} } or return bare object
  return backend?.data ?? backend;
}

/**
 * 统一解析列表 API 响应
 */
function extractList<T = any>(response: unknown): T[] {
  const res = response as any;
  if (!res) return [];
  const backend = res.data ?? res;
  if (Array.isArray(backend)) return backend;
  if (Array.isArray(backend?.data)) return backend.data;
  if (Array.isArray(backend?.runs)) return backend.runs;
  if (Array.isArray(backend?.items)) return backend.items;
  return [];
}

const PipelineDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('stages');
  const [isRerunning, setIsRerunning] = useState(false);
  const [retryingStageId, setRetryingStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<any>(null);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Load pipeline detail from API
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      setApiError(null);
      try {
        // Fetch pipeline definition
        const pipelineRes = await getPipeline(id!);
        const pipelineData = extractData(pipelineRes);

        if (!pipelineData) {
          setApiError('未找到该 Pipeline');
          return;
        }

        // Fetch latest runs for this pipeline
        let latestRun = null;
        let runStages = [];
        let runsCount = 0;
        try {
          const runsRes = await getPipelineRuns(id!);
          const runsData = extractList(runsRes);
          runsCount = runsData.length;
          if (runsData.length > 0) {
            latestRun = runsData[0];
            // Fetch full run detail including stages and tasks
            try {
              const runDetailRes = await getPipelineRunDetail(latestRun.id);
              const runDetail = extractData(runDetailRes);
              if (runDetail) {
                const rawStages = runDetail.stages || [];
                const rawTasks = runDetail.tasks || [];
                // Merge tasks into stages as steps
                runStages = rawStages.map((stage: any) => {
                  const stageTasks = rawTasks.filter((t: any) => t.stageId === stage.id);
                  const durationSec = stage.durationMs ? parseInt(stage.durationMs) / 1000 : undefined;
                  return {
                    ...stage,
                    duration: durationSec,
                    steps: stageTasks.map((t: any) => ({
                      ...t,
                      duration: t.durationMs ? parseInt(t.durationMs) / 1000 : undefined,
                    })),
                    logs: stageTasks.flatMap((t: any) => t.logs || []),
                  };
                });
                // Merge run detail into latestRun
                latestRun = { ...latestRun, ...runDetail };
              }
            } catch {
              // Run detail endpoint may not be available
            }
          }
        } catch {
          // Runs endpoint may not be fully wired yet
        }

        setPipeline({
          ...pipelineData,
          // Merge latest run data for display
          status: latestRun?.status || 'pending',
          runNumber: runsCount || 1, // 运行号从 1 开始，用运行总数作为当前运行号
          branch: latestRun?.branch || 'main',
          commit: latestRun?.commit,
          author: latestRun?.author || '-',
          trigger: latestRun?.trigger || latestRun?.triggerType || 'manual',
          startTime: latestRun?.startTime || latestRun?.startedAt,
          endTime: latestRun?.endTime || latestRun?.completedAt,
          duration: latestRun?.duration,
          stages: runStages,
        });
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
  const completedStages = pipeline?.stages?.filter((s: any) => s.status === 'success').length || 0;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Format duration — handles both seconds (number) and durationMs (string)
  const formatDuration = (value?: number | string) => {
    if (!value || !pipeline) return '-';
    // If it's a string (durationMs from backend), convert to seconds
    let seconds: number;
    if (typeof value === 'string') {
      seconds = parseInt(value, 10) / 1000;
    } else {
      seconds = value;
    }
    if (!seconds) return '-';
    const dur = dayjs.duration(seconds, 'seconds');
    const minutes = Math.floor(dur.asMinutes());
    const secs = dur.seconds();
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  // Handle re-run
  const handleRerun = async () => {
    try {
      setIsRerunning(true);
      await triggerPipeline(id!);
      message.success('Pipeline 重新运行成功');
      // Reload pipeline runs
      const runsRes = await getPipelineRuns(id!);
      const runsData = extractList(runsRes);
      const latestRun = runsData[0] || null;
      setPipeline((prev: any) => ({
        ...prev,
        status: latestRun?.status || 'running',
        runNumber: latestRun?.runNumber || prev.runNumber + 1,
        stages: latestRun?.stages || [],
      }));
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

  // Handle reload from error detail retry
  const handleReloadPipeline = async () => {
    try {
      const runsRes = await getPipelineRuns(id!);
      const runsData = extractList(runsRes);
      const latestRun = runsData[0] || null;
      setPipeline((prev: any) => ({
        ...prev,
        status: latestRun?.status || prev.status,
        stages: latestRun?.stages || prev.stages,
      }));
    } catch {
      // Silent reload failure — the error detail component handles its own retry
    }
  };

  // Load all runs for this pipeline
  const loadRuns = useCallback(async () => {
    if (!id) return;
    setRunsLoading(true);
    try {
      const response = await getPipelineRuns(id, { pageSize: 50 });
      const data = extractList(response);
      setRuns(data as PipelineRunSummary[]);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  // Load runs when pipeline is loaded
  useEffect(() => {
    if (pipeline?.id) {
      loadRuns();
    }
  }, [pipeline?.id, loadRuns]);

  // Handle retry from a specific stage
  const handleRetryFromStage = (_stageId: string, stageName: string) => {
    Modal.confirm({
      title: '从该阶段重跑',
      content: `确认从阶段「${stageName}」开始重新运行？已完成的前置阶段将不会重新执行。`,
      okText: '确认重跑',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRetryingStageId(_stageId);
          // 使用 retryFromStage 从指定阶段重试
          const res = await retryFromStage(id!, _stageId);
          const newRun = res.data?.data as { id?: string } | undefined;
          message.success(`已从阶段「${stageName}」重新运行`);
          // 跳转到新运行的详情页
          if (newRun?.id) {
            navigate(`/pipelines/${newRun.id}`);
          } else {
            // 回退：刷新当前页面
            const runsRes = await getPipelineRuns(id!);
            const runsData = extractList(runsRes);
            const latestRun = runsData[0] || null;
            if (latestRun) {
              const detailRes = await getPipelineRunDetail(latestRun.id);
              const runDetail = extractData(detailRes);
              if (runDetail) {
                setPipeline(runDetail);
              }
            }
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`从阶段重跑失败：${error.message}`);
          } else {
            message.error('从阶段重跑失败，请稍后重试');
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
    <div style={{ padding: 0, background: colors.light.bg.secondary, minHeight: '100vh' }}>
      {/* 页面头部 - 居中布局 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${componentSpacing.cardPadding.lg} ${componentSpacing.cardPadding.lg} ${componentSpacing.cardPadding.md}`,
          background: colors.light.bg.primary,
          borderBottom: `1px solid ${colors.light.border.light || '#f0f0f0'}`,
          textAlign: 'center',
        }}
      >
        {/* 标题区域 */}
        <div style={{ marginBottom: spacing.sm }}>
          <Space align="center">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/pipelines')}
              disabled={loading}
              size="small"
              style={{ position: 'absolute', left: 0 }}
            >
              返回
            </Button>
            <Title level={2} style={{ marginBottom: 8 }}>
              <ApiOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              {pipeline.name}
            </Title>
            <Tag color="default" style={{ fontSize: 12 }}>
              #{pipeline.runNumber}
            </Tag>
            {pipeline && <StatusBadge status={pipeline.status} size="medium" />}
          </Space>
        </div>

        {/* 元信息区域 */}
        <Space size="middle" wrap style={{ justifyContent: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            分支: <Text code style={{ fontSize: 12 }}>{pipeline.branch}</Text>
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            触发: {triggerLabel[pipeline.trigger] || pipeline.trigger}
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            由 {pipeline.author || '-'} 触发
          </Text>
          {pipeline.commit && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Commit: <Text code style={{ fontSize: 12 }}>{pipeline.commit.slice(0, 7)}</Text>
            </Text>
          )}
        </Space>
      </div>

      {/* 操作按钮区域 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: `${componentSpacing.cardPadding.sm} ${componentSpacing.cardPadding.lg}`,
          background: colors.light.bg.primary,
          borderBottom: `1px solid ${colors.light.border.light || '#f0f0f0'}`,
        }}
      >
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={isRerunning}
          onClick={handleRerun}
          disabled={!pipeline || pipeline.status === 'running' || loading}
        >
          {isRerunning ? '触发中...' : '重新运行'}
        </Button>
      </div>

      {/* Pipeline info card */}
      <div style={{ marginBottom: spacing.md }}>
        <CardPanel>
          <Descriptions column={3} size="small" bordered labelStyle={{ width: 100 }}>
            <Descriptions.Item label="状态">
              <StatusBadge status={pipeline.status} size="small" />
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
      </div>

      {/* Structured error detail for failed pipelines */}
      {pipeline && pipeline.status === 'failed' && id && (
        <PipelineErrorDetail runId={id} onRetry={handleReloadPipeline} />
      )}

      {/* Tabbed content: Stages / Logs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 16 }}>
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
                {pipeline.stages?.map((stage: any, index: number) => (
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
                <div style={{ marginTop: 8 }}>
                  {pipeline.stages.map((stage: any, index: number) => (
                    <Card
                      key={stage.name}
                      size="small"
                      style={{ marginBottom: 8 }}
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
                          {stage.steps.map((step: any) => (
                            <div
                              key={step.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
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
                padding: 16,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: spacing[3],
                lineHeight: 1.6,
                maxHeight: 500,
                overflowY: 'auto',
                color: colors.neutral[300],
              }}
            >
              {pipeline.stages?.map((stage: any) => (
                <div key={stage.name} style={{ marginBottom: 16 }}>
                  {/* Stage header */}
                  <div
                    style={{
                      color: stageStatusColors[stage.status],
                      fontWeight: 600,
                      marginBottom: 8,
                      borderBottom: '1px solid #333',
                      paddingBottom: 4,
                    }}
                  >
                    [{dayjs(stage.startTime || pipeline.startTime).format('HH:mm:ss')}] === Stage:{' '}
                    {stage.name} ===
                  </div>
                  {/* Stage logs */}
                  {stage.logs && stage.logs.length > 0 ? (
                    stage.logs.map((log: any, index: number) => (
                      <div key={index} style={{ paddingLeft: 16 }}>
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
                    <div style={{ paddingLeft: 16, color: colors.neutral[500] }}>
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
                stages={pipeline.stages.map((stage: any, idx: number) => ({
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

        {/* 运行历史 Tab */}
        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              运行历史
              <Badge count={runs.length} style={{ backgroundColor: colors.primary[500] }} />
            </Space>
          }
          key="runs"
        >
          <CardPanel title={`运行历史 (${runs.length} 条)`}>
            <Table
              dataSource={runs}
              loading={runsLoading}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              columns={[
                {
                  title: 'Run ID',
                  dataIndex: 'id',
                  key: 'id',
                  width: 100,
                  render: (id: string) => (
                    <Button type="link" size="small" onClick={() => navigate(`/pipelines/${id}/runs/${id}`)}>
                      {id.slice(0, 8)}...
                    </Button>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status: string) => <StatusBadge status={status as any} />,
                },
                {
                  title: '触发方式',
                  dataIndex: 'triggerType',
                  key: 'triggerType',
                  width: 100,
                  render: (type: string) => {
                    const triggerLabels: Record<string, string> = {
                      manual: '手动',
                      push: 'Push',
                      schedule: '定时',
                      api: 'API',
                    };
                    return <Tag color="blue">{triggerLabels[type] || type || '-'}</Tag>;
                  },
                },
                {
                  title: '开始时间',
                  dataIndex: 'startTime',
                  key: 'startTime',
                  width: 160,
                  render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
                },
                {
                  title: '耗时',
                  dataIndex: 'duration',
                  key: 'duration',
                  width: 100,
                  render: (ms: number) => {
                    if (!ms) return '-';
                    const seconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
                  },
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 120,
                  render: (_: any, record: PipelineRunSummary) => (
                    <Space>
                      <Button type="link" size="small" onClick={() => navigate(`/pipelines/${id}/runs/${record.id}`)}>
                        查看
                      </Button>
                      {record.status === 'failed' && (
                        <Button type="link" size="small" onClick={() => triggerPipeline(id!)}>
                          重跑
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
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
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              以下列出各阶段任务产生的输出变量及其传播目标。当前为演示数据，后续将接入真实 API。
            </Text>
            <TaskOutputsTable />
          </CardPanel>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default PipelineDetail;
