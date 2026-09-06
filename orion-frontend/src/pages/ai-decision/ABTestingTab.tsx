/**
 * ABTestingTab.tsx - A/B 测试 Tab
 * 抽取自 AIDecisionPage.tsx (P2-9 Phase 84)
 */
import React, { useState } from 'react';
import {
  Typography,
  Card,
  Space,
  Button,
  Input,
  Tag,
  Descriptions,
  Progress,
  Row,
  Col,
  message,
} from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import { ExperimentOutlined } from '@ant-design/icons';
import { getABTestResults, type ABTestResult } from '@/api/ai-decision';

const { Text } = Typography;

export const ABTestingTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ABTestResult | null>(null);
  const [modelName, setModelName] = useState('');

  const loadABTest = async () => {
    if (!modelName) {
      message.warning('请输入模型名称');
      return;
    }
    setLoading(true);
    try {
      const res = await getABTestResults(modelName);
      setResults(res.data || null);
    } catch (error: unknown) {
      message.error(`加载 A/B 测试结果失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card size="small">
        <Space>
          <Input
            placeholder="输入模型名称 (如: pipeline-decision)"
            style={{ width: 300 }}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            onPressEnter={loadABTest}
          />
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={loadABTest}
            loading={loading}
          >
            查询 A/B 测试
          </Button>
        </Space>
      </Card>

      {results && (
        <>
          <Card title="A/B 测试结果对比">
            <Row gutter={16}>
              <Col span={11}>
                <Card title="Variant A" size="small" style={{ borderColor: colors.primary[500] }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="模型 ID">{results.variantA.modelId}</Descriptions.Item>
                    <Descriptions.Item label="流量分配">
                      {results.variantA.trafficPercent}%
                    </Descriptions.Item>
                    <Descriptions.Item label="成功率">
                      {(results.variantA.successRate * 100).toFixed(1)}%
                    </Descriptions.Item>
                    <Descriptions.Item label="平均延迟">
                      {results.variantA.avgLatency}ms
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col
                span={2}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text type="secondary" style={{ fontSize: 24 }}>
                  VS
                </Text>
              </Col>
              <Col span={11}>
                <Card title="Variant B" size="small" style={{ borderColor: colors.purple[500] }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="模型 ID">{results.variantB.modelId}</Descriptions.Item>
                    <Descriptions.Item label="流量分配">
                      {results.variantB.trafficPercent}%
                    </Descriptions.Item>
                    <Descriptions.Item label="成功率">
                      {(results.variantB.successRate * 100).toFixed(1)}%
                    </Descriptions.Item>
                    <Descriptions.Item label="平均延迟">
                      {results.variantB.avgLatency}ms
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          </Card>

          <Card size="small">
            <Space>
              <Tag color={results.winner === 'A' ? 'blue' : results.winner === 'B' ? 'purple' : 'default'}>
                胜出方: {results.winner === 'inconclusive' ? '无明显胜出' : `Variant ${results.winner}`}
              </Tag>
              <Text type="secondary">置信度: {(results.confidence * 100).toFixed(1)}%</Text>
              <Progress percent={Math.round(results.confidence * 100)} size="small" style={{ width: 120 }} />
            </Space>
          </Card>
        </>
      )}

      {!results && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <ExperimentOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <Text type="secondary" style={{ display: 'block', marginTop: spacing.md }}>
              输入模型名称并查询 A/B 测试结果
            </Text>
          </div>
        </Card>
      )}
    </Space>
  );
};
