/**
 * RootCauseAnalysisTab
 * 根因分析 Tab（抽取自 ObservabilityPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  message,
  Card,
  Descriptions,
  Modal,
  Timeline,
  Progress,
  Typography,
} from 'antd';
import {
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getRootCauseAnalyses,
  triggerRCA,
  getRootCauseAnalysis,
  type RootCauseAnalysis as RCAType,
} from '@/api/observability';
import { useQuery } from '@/providers/QueryProvider';
import { rcaStatusColorMap } from './constants';

const { Text } = Typography;

export const RootCauseAnalysisTab: React.FC = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<RCAType | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [triggerForm] = Form.useForm();
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const {
    data: analyses = [],
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery<RCAType[]>({
    queryKey: ['root-cause-analyses'],
    queryFn: async () => {
      const res = await getRootCauseAnalyses();
      return res.data?.analyses || [];
    },
    staleTime: 30_000,
  });

  const loadAnalyses = () => {
    void refetch();
  };

  const loading = isLoading;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.error(`加载根因分析列表失败: ${queryError instanceof Error ? queryError.message : ''}`);
    }
  }, [isError, queryError]);

  const handleTrigger = async () => {
    try {
      const values = await triggerForm.validateFields();
      setTriggerLoading(true);
      await triggerRCA({
        incidentId: values.incidentId,
        serviceIds: values.serviceIds
          ? (values.serviceIds as string).split(',').map((s: string) => s.trim())
          : undefined,
      });
      message.success('根因分析已触发');
      triggerForm.resetFields();
      loadAnalyses();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`触发失败: ${(error as Error).message}`);
      }
    } finally {
      setTriggerLoading(false);
    }
  };

  const viewDetail = async (analysis: RCAType) => {
    setSelectedAnalysis(analysis);
    setDrawerVisible(true);
    setDetailLoading(true);
    try {
      const res = await getRootCauseAnalysis(analysis.id);
      setSelectedAnalysis(res.data || analysis);
    } catch {
      // fallback to existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '事件 ID', dataIndex: 'incidentId', key: 'incidentId', width: 140 },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={rcaStatusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '根因服务',
      key: 'rootCause',
      width: 140,
      render: (_: unknown, record: RCAType) => record.rootCause?.service || '-',
    },
    {
      title: '置信度',
      key: 'confidence',
      width: 100,
      render: (_: unknown, record: RCAType) =>
        record.rootCause ? `${Math.round(record.rootCause.confidence * 100)}%` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: RCAType) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Trigger RCA */}
      <Card title="触发根因分析">
        <Form form={triggerForm} layout="inline" onFinish={handleTrigger}>
          <Form.Item name="incidentId" label="事件 ID" rules={[{ required: true }]}>
            <Input placeholder="如: INC-001" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="serviceIds" label="涉及服务 (逗号分隔)">
            <Input placeholder="如: api-gateway, auth-service" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={triggerLoading}
              icon={<SearchOutlined />}
            >
              触发分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Analysis List */}
      <Card title="根因分析列表">
        <Table
          columns={columns}
          dataSource={analyses}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="根因分析详情"
        open={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {detailLoading ? (
          <PageSkeleton rows={4} />
        ) : selectedAnalysis ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="事件 ID">{selectedAnalysis.incidentId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={rcaStatusColorMap[selectedAnalysis.status]}>
                  {selectedAnalysis.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {new Date(selectedAnalysis.startTime).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedAnalysis.endTime
                  ? new Date(selectedAnalysis.endTime).toLocaleString()
                  : '进行中'}
              </Descriptions.Item>
            </Descriptions>

            {selectedAnalysis.rootCause && (
              <Card
                size="small"
                title="根因"
                style={{ borderLeft: `3px solid ${colors.error[400]}` }}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="服务">
                    {selectedAnalysis.rootCause.service}
                  </Descriptions.Item>
                  <Descriptions.Item label="组件">
                    {selectedAnalysis.rootCause.component}
                  </Descriptions.Item>
                  <Descriptions.Item label="描述">
                    {selectedAnalysis.rootCause.description}
                  </Descriptions.Item>
                  <Descriptions.Item label="置信度">
                    <Progress
                      percent={Math.round(selectedAnalysis.rootCause.confidence * 100)}
                      size="small"
                      style={{ width: 120 }}
                    />
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {selectedAnalysis.contributingFactors &&
              selectedAnalysis.contributingFactors.length > 0 && (
                <Card size="small" title="贡献因素">
                  <Table
                    dataSource={selectedAnalysis.contributingFactors}
                    rowKey="service"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '服务', dataIndex: 'service', key: 'service' },
                      { title: '指标', dataIndex: 'metric', key: 'metric' },
                      {
                        title: '影响度',
                        dataIndex: 'impact',
                        key: 'impact',
                        render: (v: number) => (
                          <Progress
                            percent={Math.round(v * 100)}
                            size="small"
                            style={{ width: 100 }}
                          />
                        ),
                      },
                      { title: '描述', dataIndex: 'description', key: 'description' },
                    ]}
                  />
                </Card>
              )}

            {selectedAnalysis.timeline && selectedAnalysis.timeline.length > 0 && (
              <Card size="small" title="事件时间线">
                <Timeline>
                  {selectedAnalysis.timeline.map((item, i) => (
                    <Timeline.Item key={String(i)}>
                      <Text strong>{item.service}</Text>
                      <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                      <div>{item.event}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            {selectedAnalysis.recommendations && selectedAnalysis.recommendations.length > 0 && (
              <Card size="small" title="建议措施">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {selectedAnalysis.recommendations.map((r, i) => (
                    <li key={String(i)}>
                      <Text>{r}</Text>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </Space>
        ) : (
          <Text type="secondary">无法加载分析详情</Text>
        )}
      </Modal>
    </Space>
  );
};
