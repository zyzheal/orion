/**
 * AdaptiveTimeoutTab.tsx - 自适应超时 Tab
 * 抽取自 autonomous-pipeline/AutonomousPipelinePage.tsx (P2-9 Phase 73)
 */
import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Input,
  Form,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Typography,
} from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  getTimeoutForStage,
  recordExecution,
  type TimeoutConfig,
} from '@/api/autonomous-pipeline';

const { Text } = Typography;

const AdaptiveTimeoutTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [timeoutConfig, setTimeoutConfig] = useState<TimeoutConfig | null>(null);
  const [stageName, setStageName] = useState('');
  const [executionForm] = Form.useForm();
  const [recordLoading, setRecordLoading] = useState(false);

  const loadTimeout = async () => {
    if (!stageName) {
      message.warning('请输入 Stage 名称');
      return;
    }
    setLoading(true);
    try {
      const res = await getTimeoutForStage(stageName);
      setTimeoutConfig(res.data || null);
    } catch (error: unknown) {
      message.error(`加载超时配置失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordExecution = async () => {
    try {
      const values = await executionForm.validateFields();
      setRecordLoading(true);
      await recordExecution({
        pipelineId: values.pipelineId || 'demo-pipeline',
        stageName: values.stageName,
        durationMs: values.durationMs,
        status: values.status,
      });
      message.success('执行数据已记录');
      executionForm.resetFields();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`记录执行数据失败: ${(error as Error).message}`);
      }
    } finally {
      setRecordLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Query Timeout */}
      <Card title="自适应超时配置">
        <Space>
          <Input
            placeholder="Stage 名称 (如: build, test, deploy)"
            style={{ width: 300 }}
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            onPressEnter={loadTimeout}
          />
          <Button
            type="primary"
            icon={<ClockCircleOutlined />}
            onClick={loadTimeout}
            loading={loading}
          >
            查询建议超时
          </Button>
        </Space>
      </Card>

      {timeoutConfig && (
        <Card title={`超时配置: ${timeoutConfig.stageName}`}>
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="建议超时"
                  value={timeoutConfig.suggestedTimeoutMs}
                  suffix="ms"
                  valueStyle={{ color: colors.primary[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="历史平均" value={timeoutConfig.historicalAvgMs} suffix="ms" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="P95" value={timeoutConfig.percentile95Ms} suffix="ms" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="P99" value={timeoutConfig.percentile99Ms} suffix="ms" />
              </Card>
            </Col>
          </Row>
          <div style={{ marginTop: spacing.md }}>
            <Text type="secondary">样本数: {timeoutConfig.sampleSize}</Text>
          </div>
        </Card>
      )}

      {/* Record Execution */}
      <Card title="记录执行数据">
        <Form form={executionForm} layout="vertical" onFinish={handleRecordExecution}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="stageName" label="Stage 名称" rules={[{ required: true }]}>
                <Input placeholder="如: build" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="durationMs" label="执行时间 (ms)" rules={[{ required: true }]}>
                <Input type="number" placeholder="5000" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="执行状态" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '成功', value: 'success' },
                    { label: '失败', value: 'failure' },
                    { label: '超时', value: 'timeout' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pipelineId" label="Pipeline ID">
                <Input placeholder="默认: demo-pipeline" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={recordLoading}>
              记录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
};

export default AdaptiveTimeoutTab;
