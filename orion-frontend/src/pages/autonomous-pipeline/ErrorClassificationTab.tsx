/**
 * ErrorClassificationTab.tsx - 错误分类 Tab
 * 抽取自 autonomous-pipeline/AutonomousPipelinePage.tsx (P2-9 Phase 73)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  message,
  Descriptions,
  Statistic,
  Row,
  Col,
  Progress,
} from 'antd';
import {
  RobotOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { getErrorStats, classifyError, type ErrorClassification, type ErrorStats } from '@/api/autonomous-pipeline';
import { categoryColorMap, severityColorMap } from './constants';

const { Text } = Typography;

const ErrorClassificationTab: React.FC = () => {
  const [_loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [classifyForm] = Form.useForm();
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [lastClassification, setLastClassification] = useState<ErrorClassification | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await getErrorStats({ days: 7 });
      setStats(res.data || null);
    } catch (error: unknown) {
      message.error(`加载错误统计失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClassify = async () => {
    try {
      const values = await classifyForm.validateFields();
      setClassifyLoading(true);
      const res = await classifyError({
        pipelineId: values.pipelineId || 'demo-pipeline',
        runId: values.runId || 'demo-run',
        stageName: values.stageName,
        errorMessage: values.errorMessage,
        errorCode: values.errorCode,
      });
      setLastClassification(res.data || null);
      message.success('错误分类完成');
      loadStats();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`错误分类失败: ${(error as Error).message}`);
      }
    } finally {
      setClassifyLoading(false);
    }
  };

  const topErrorsColumns = [
    {
      title: '错误代码',
      dataIndex: 'errorCode',
      key: 'errorCode',
      width: 120,
    },
    {
      title: '错误信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (v: number) => <Text strong>{v}</Text>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {stats && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误总数"
                value={stats.total}
                prefix={<WarningOutlined style={{ color: colors.error[400] }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可重试比例"
                value={stats.retryablePercent}
                suffix="%"
                valueStyle={{ color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="高/严重"
                value={(stats.bySeverity?.high || 0) + (stats.bySeverity?.critical || 0)}
                valueStyle={{ color: colors.error[400] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误类别数"
                value={Object.keys(stats.byCategory || {}).length}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="错误分类器">
        <Form form={classifyForm} layout="vertical" onFinish={handleClassify}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="stageName" label="Stage 名称" rules={[{ required: true }]}>
                <Input placeholder="如: build, test, deploy" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="errorCode" label="错误代码">
                <Input placeholder="如: E001, TIMEOUT_001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pipelineId" label="Pipeline ID">
                <Input placeholder="默认: demo-pipeline" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="errorMessage" label="错误信息" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="粘贴完整的错误日志..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={classifyLoading}
              icon={<RobotOutlined />}
            >
              分类错误
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {lastClassification && (
        <Card title="分类结果">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="错误类别">
              <Tag color={categoryColorMap[lastClassification.category]}>
                {lastClassification.category}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={severityColorMap[lastClassification.severity]}>
                {lastClassification.severity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="是否可重试">
              <Tag color={lastClassification.isRetryable ? 'success' : 'default'}>
                {lastClassification.isRetryable ? '可重试' : '不可重试'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="置信度">
              <Progress
                percent={Math.round(lastClassification.confidence * 100)}
                size="small"
                style={{ width: 100 }}
              />
            </Descriptions.Item>
            <Descriptions.Item label="建议操作" span={2}>
              {lastClassification.suggestedAction}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {stats && stats.topErrors && stats.topErrors.length > 0 && (
        <Card title="Top 错误排行">
          <Table
            columns={topErrorsColumns}
            dataSource={stats.topErrors}
            rowKey="errorCode"
            size="small"
            pagination={false}
          />
        </Card>
      )}
    </Space>
  );
};

export default ErrorClassificationTab;
