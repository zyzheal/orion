/**
 * TemporalCorrelationTab.tsx - 时间关联分析 Tab（自包含）
 * 抽取自 observability/RootCausePage.tsx (P2-9 Phase 70)
 */
import React, { useState } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Input,
  Form,
  Text,
  Divider,
  Statistic,
  Row,
  Col,
  List,
  message,
} from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { analyzeTemporalCorrelation, type TemporalCorrelationResult } from '@/api/observability';
import { colors } from '@/tokens/colors';

const TemporalCorrelationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TemporalCorrelationResult | null>(null);
  const [alertsJson, setAlertsJson] = useState('');

  const handleAnalyze = async () => {
    if (!alertsJson) {
      message.warning('请输入告警 JSON 数据');
      return;
    }
    try {
      const alerts = JSON.parse(alertsJson);
      setLoading(true);
      const res = await analyzeTemporalCorrelation(alerts);
      const rawData = res.data?.data;
      setResult((rawData as unknown as TemporalCorrelationResult) || null);
      message.success('时间关联分析完成');
    } catch (error: unknown) {
      message.error(`分析失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="时间关联分析">
        <Text type="secondary">分析在特定时间窗口内聚集的告警，识别告警爆发（burst）</Text>
        <Divider />
        <Form layout="vertical">
          <Form.Item label="告警数据（JSON 格式）">
            <Input.TextArea
              rows={6}
              placeholder={`[
  {"id": "a1", "name": "CPU High", "service": "api-gateway", "severity": "critical", "firedAt": "2026-05-05T10:00:00Z", "message": "..."}
]`}
              value={alertsJson}
              onChange={(e) => setAlertsJson(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<ClockCircleOutlined />}
              onClick={handleAnalyze}
              loading={loading}
            >
              分析时间关联
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <Card title="分析结果">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="关联告警数" value={result.correlatedAlerts.length} />
            </Col>
            <Col span={8}>
              <Statistic title="时间窗口内告警数" value={result.timeCluster.alertCount} />
            </Col>
            <Col span={8}>
              <Statistic
                title="告警爆发检测"
                value={result.burstDetected ? '是' : '否'}
                valueStyle={{
                  color: result.burstDetected ? colors.error[400] : colors.success[500],
                }}
              />
            </Col>
          </Row>
          <Divider />
          <List
            dataSource={result.correlatedAlerts}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={item.severity === 'critical' ? 'error' : 'warning'}>
                        {item.severity}
                      </Tag>
                      {item.name}
                    </Space>
                  }
                  description={
                    <Space direction="vertical">
                      <Text>服务: {item.service}</Text>
                      <Text type="secondary">{item.correlationReason}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
};

export default TemporalCorrelationTab;
