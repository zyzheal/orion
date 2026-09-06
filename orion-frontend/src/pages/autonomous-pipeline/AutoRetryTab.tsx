/**
 * AutoRetryTab.tsx - 自动重试 Tab
 * 抽取自 autonomous-pipeline/AutonomousPipelinePage.tsx (P2-9 Phase 73)
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Form,
  Input,
  message,
  Statistic,
  Row,
  Col,
  Progress,
  Typography,
} from 'antd';
import { RedoOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import {
  getRetryStats,
  configureRetry,
  type RetryStats,
  type RetryConfig,
} from '@/api/autonomous-pipeline';

const { Text } = Typography;

const AutoRetryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [retryStats, setRetryStats] = useState<RetryStats | null>(null);
  const [pipelineId, setPipelineId] = useState('');
  const [retryForm] = Form.useForm();
  const [retryConfigLoading, setRetryConfigLoading] = useState(false);

  const loadRetryStats = async () => {
    if (!pipelineId) {
      message.warning('请输入 Pipeline ID');
      return;
    }
    setLoading(true);
    try {
      const res = await getRetryStats(pipelineId);
      setRetryStats(res.data || null);
    } catch (error: unknown) {
      message.error(`加载重试统计失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureRetry = async () => {
    try {
      const values = await retryForm.validateFields();
      setRetryConfigLoading(true);
      const payload: RetryConfig = {
        pipelineId: values.pipelineId,
        maxRetries: values.maxRetries,
        backoffMultiplier: values.backoffMultiplier,
        initialDelayMs: values.initialDelayMs,
        maxDelayMs: values.maxDelayMs,
        retryableErrors: (values.retryableErrors as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
      };
      await configureRetry(payload);
      message.success('重试策略配置成功');
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`配置重试策略失败: ${(error as Error).message}`);
      }
    } finally {
      setRetryConfigLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Retry Stats */}
      <Card title="重试统计">
        <Space>
          <Input
            placeholder="Pipeline ID"
            style={{ width: 260 }}
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            onPressEnter={loadRetryStats}
          />
          <Button type="primary" icon={<RedoOutlined />} onClick={loadRetryStats} loading={loading}>
            查询重试统计
          </Button>
        </Space>
      </Card>

      {retryStats && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总重试次数"
                  value={retryStats.totalRetries}
                  prefix={<RedoOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="重试成功率"
                  value={retryStats.successRate}
                  suffix="%"
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="成功重试"
                  value={retryStats.successfulRetries}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="失败重试"
                  value={retryStats.failedRetries}
                  valueStyle={{ color: colors.error[400] }}
                />
              </Card>
            </Col>
          </Row>

          {retryStats.history && retryStats.history.length > 0 && (
            <Card title="重试历史趋势">
              <Table
                dataSource={retryStats.history}
                rowKey="date"
                size="small"
                pagination={false}
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date' },
                  { title: '重试次数', dataIndex: 'retries', key: 'retries' },
                  {
                    title: '成功次数',
                    dataIndex: 'successes',
                    key: 'successes',
                    render: (v: number) => <Text style={{ color: colors.success[500] }}>{v}</Text>,
                  },
                  {
                    title: '成功率',
                    key: 'rate',
                    render: (_: unknown, record: { retries: number; successes: number }) => (
                      <Progress
                        percent={
                          record.retries > 0
                            ? Math.round((record.successes / record.retries) * 100)
                            : 0
                        }
                        size="small"
                        style={{ width: 100 }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Space>
      )}

      {/* Configure Retry */}
      <Card title="配置重试策略">
        <Form form={retryForm} layout="vertical" onFinish={handleConfigureRetry}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="pipelineId" label="Pipeline ID" rules={[{ required: true }]}>
                <Input placeholder="如: main-build" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="maxRetries"
                label="最大重试次数"
                rules={[{ required: true }]}
                initialValue={3}
              >
                <Input type="number" min={0} max={10} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="backoffMultiplier" label="退避倍数" initialValue={2}>
                <Input type="number" min={1} step={0.5} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="initialDelayMs" label="初始延迟 (ms)" initialValue={1000}>
                <Input type="number" min={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={4}>
              <Form.Item name="maxDelayMs" label="最大延迟 (ms)" initialValue={30000}>
                <Input type="number" min={1000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="retryableErrors" label="可重试错误代码 (逗号分隔)">
                <Input placeholder="如: TIMEOUT, NETWORK_ERROR, E500" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={retryConfigLoading}
              icon={<RedoOutlined />}
            >
              保存重试策略
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
};

export default AutoRetryTab;
