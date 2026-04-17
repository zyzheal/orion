/**
 * Pipeline Detail Page (TASK-905)
 * Pipeline detail view with stages/timeline/logs and re-run actions.
 *
 * Features:
 * - Pipeline info header
 * - Stage timeline/progress visualization
 * - Log viewer section
 * - Re-run trigger button
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Descriptions, Tabs, Badge, message } from 'antd';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { getPipelineRun, retryPipelineRun } from '@/api/pipelines';
import { mockPipelines } from '@/pages/__mocks__/mockData';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Status color map for stages
const stageStatusColors: Record<string, string> = {
  success: '#52c41a',
  running: '#1890ff',
  failed: '#f5222d',
  pending: '#d9d9d9',
  warning: '#faad14',
  cancelled: '#8c8c8c',
};

const PipelineDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('stages');
  const [isRerunning, setIsRerunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<any>(null);

  // Load pipeline detail from API
  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      try {
        const response = await getPipelineRun(id!);
        const apiData = response.data.data;
        setPipeline(apiData || mockPipelines[0]);
      } catch (error) {
        message.error('加载 Pipeline 详情失败');
        console.error('Failed to load pipeline detail:', error);
        // Fallback to mock data
        setPipeline(mockPipelines[0]);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPipeline();
    }
  }, [id]);

  // Calculate progress percentage
  const totalStages = pipeline.stages?.length || 0;
  const completedStages = pipeline.stages?.filter((s) => s.status === 'success').length || 0;
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
      setPipeline(response.data.data);
    } catch (error) {
      message.error('重新运行失败');
      console.error('Failed to rerun pipeline:', error);
    } finally {
      setIsRerunning(false);
    }
  };

  const triggerLabel: Record<string, string> = {
    manual: '手动触发',
    push: 'Push 触发',
    schedule: '定时触发',
    api: 'API 触发',
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Back button and page title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
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
          <Title level={3} style={{ margin: 0 }}>
            {pipeline.name} #{pipeline.runNumber}
          </Title>
          <Text type="secondary">
            {pipeline.commit && <Tag color="default" style={{ marginRight: 8 }}>{pipeline.commit}</Tag>}
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
      {loading || !pipeline ? (
        <CardPanel>Loading...</CardPanel>
      ) : (
        <CardPanel>
          <Descriptions
            column={4}
            size="small"
            bordered
            labelStyle={{ width: 120 }}
          >
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
                <Text type="secondary">{dayjs(pipeline.startTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {pipeline.endTime ? (
                <Text type="secondary">{dayjs(pipeline.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
              ) : (
                <Text type="secondary">-</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">
              {formatDuration(pipeline.duration)}
            </Descriptions.Item>
            <Descriptions.Item label="进度">
              <Space>
                <Badge
                  status="processing"
                  text={`${completedStages}/${totalStages} 阶段完成`}
                />
                <Text type="secondary">({progressPercent}%)</Text>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </CardPanel>
      )}

      {/* Tabbed content: Stages / Logs */}
      {loading || !pipeline ? null : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 16 }}
        >
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
                {pipeline.stages?.map((stage, index) => (
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
                          backgroundColor: stageStatusColors[stage.status] || '#d9d9d9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          boxShadow:
                            stage.status === 'running'
                              ? '0 0 0 4px rgba(24,144,255,0.2)'
                              : 'none',
                          animation:
                            stage.status === 'running'
                              ? 'status-pulse 1.5s ease-in-out infinite'
                              : 'none',
                        }}
                      >
                        {stage.status === 'success' ? '\u2713' : stage.status === 'failed' ? '\u2717' : index + 1}
                      </div>
                      <Text
                        style={{
                          fontSize: 11,
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
                        <Text type="secondary" style={{ fontSize: 10 }}>
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
                              ? '#f0f0f0'
                              : stageStatusColors[pipeline.stages![index].status] || '#d9d9d9',
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
                  {pipeline.stages.map((stage, index) => (
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
                        stage.duration && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            耗时: {formatDuration(stage.duration)}
                          </Text>
                        )
                      }
                    >
                      {/* Steps within the stage */}
                      {stage.steps && stage.steps.length > 0 && (
                        <Space direction="vertical" size={4}>
                          {stage.steps.map((step) => (
                            <div
                              key={step.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                              }}
                            >
                              <StatusBadge status={step.status} size="small" variant="subtle" />
                              <Text>{step.name}</Text>
                              {step.duration && (
                                <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
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
                background: '#1e1e1e',
                borderRadius: 6,
                padding: 16,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
                maxHeight: 500,
                overflowY: 'auto',
                color: '#d4d4d4',
              }}
            >
              {pipeline.stages?.map((stage) => (
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
                    [{dayjs(stage.startTime || pipeline.startTime).format('HH:mm:ss')}]
                    {' '}=== Stage: {stage.name} ===
                  </div>
                  {/* Stage logs */}
                  {stage.logs && stage.logs.length > 0 ? (
                    stage.logs.map((log, index) => (
                      <div key={index} style={{ paddingLeft: 16 }}>
                        {log.includes('FAIL') ? (
                          <span style={{ color: '#f44747' }}>{log}</span>
                        ) : log.includes('passed') || log.includes('successful') || log.includes('Success') ? (
                          <span style={{ color: '#6a9955' }}>{log}</span>
                        ) : (
                          log
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ paddingLeft: 16, color: '#666' }}>
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
                    backgroundColor: '#d4d4d4',
                    animation: 'blink 1s step-end infinite',
                  }}
                />
              )}
            </div>
          </CardPanel>
        </TabPane>
      </Tabs>
      )}
    </div>
  );
};

export default PipelineDetail;
