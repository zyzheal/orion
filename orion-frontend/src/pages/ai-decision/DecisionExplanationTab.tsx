/**
 * DecisionExplanationTab.tsx - 决策解释 Tab
 * 抽取自 AIDecisionPage.tsx (P2-9 Phase 84)
 */
import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Form,
  Input,
  Select,
  Table,
  Tag,
  Descriptions,
  Progress,
  Row,
  Col,
  message,
} from 'antd';
import { spacing } from '@/tokens';
import { InfoCircleOutlined } from '@ant-design/icons';
import { explainDecision, type DecisionExplanation } from '@/api/ai-decision';
import { decisionColorMap } from './constants';

export const DecisionExplanationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<DecisionExplanation | null>(null);
  const [form] = Form.useForm();

  const handleExplain = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const features = (values.features as string)
        .split(',')
        .map((s: string) => ({ name: s.trim(), value: Math.random() }))
        .filter((f: { name: string }) => f.name);
      const res = await explainDecision({
        decisionId: values.decisionId || 'demo-decision',
        decisionType: values.decisionType,
        decision: values.decision,
        features,
        confidence: values.confidence,
      });
      setExplanation(res.data || null);
      message.success('决策解释已生成');
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`生成解释失败: ${(error as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="生成决策解释">
        <Form form={form} layout="vertical" onFinish={handleExplain}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="decisionType" label="决策类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Pipeline 执行', value: 'pipeline_execution' },
                    { label: '部署决策', value: 'deployment' },
                    { label: '质量门禁', value: 'quality_gate' },
                    { label: '成本门禁', value: 'cost_gate' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="decision" label="决策结果" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '通过 (pass)', value: 'pass' },
                    { label: '拒绝 (fail)', value: 'fail' },
                    { label: '警告 (warn)', value: 'warn' },
                    { label: '人工审查 (manual_review)', value: 'manual_review' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="confidence" label="置信度 (0-1)">
                <Input type="number" min={0} max={1} step={0.01} placeholder="0.85" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="features" label="特征名称 (逗号分隔)">
            <Input placeholder="如: build_duration, test_coverage, error_count" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<InfoCircleOutlined />}>
              生成解释
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {explanation && (
        <Card title="决策解释结果">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="决策类型">{explanation.decisionType}</Descriptions.Item>
            <Descriptions.Item label="决策结果">
              <Tag color={decisionColorMap[explanation.decision]}>{explanation.decision}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="置信度">
              <Progress percent={Math.round(explanation.confidence * 100)} size="small" style={{ width: 120 }} />
            </Descriptions.Item>
            <Descriptions.Item label="解释说明" span={2}>
              {explanation.explanation}
            </Descriptions.Item>
          </Descriptions>

          {explanation.factors && explanation.factors.length > 0 && (
            <Card size="small" title="影响因素" style={{ marginTop: spacing.md }}>
              <Table
                dataSource={explanation.factors}
                rowKey="name"
                size="small"
                pagination={false}
                columns={[
                  { title: '因素', dataIndex: 'name', key: 'name' },
                  {
                    title: '重要性',
                    dataIndex: 'importance',
                    key: 'importance',
                    render: (v: number) => (
                      <Progress percent={Math.round(v * 100)} size="small" style={{ width: 100 }} />
                    ),
                  },
                  {
                    title: '方向',
                    dataIndex: 'direction',
                    key: 'direction',
                    render: (v: string) => (
                      <Tag color={v === 'positive' ? 'success' : v === 'negative' ? 'error' : 'default'}>
                        {v}
                      </Tag>
                    ),
                  },
                  { title: '说明', dataIndex: 'description', key: 'description' },
                ]}
              />
            </Card>
          )}
        </Card>
      )}
    </Space>
  );
};
