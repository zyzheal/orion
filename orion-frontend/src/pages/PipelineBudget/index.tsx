/**
 * Pipeline Budget Page
 * Phase 1 - Budget configuration and monitoring UI
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pipelineBudgetApi, BudgetConfig, BudgetUsage } from '../../api/pipeline-budget';
import { Card, Form, InputNumber, Select, Button, Progress, Statistic, Row, Col, Alert, message } from 'antd';
import { DollarOutlined, ClockCircleOutlined, CloudOutlined } from '@ant-design/icons';

const PipelineBudget: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [config, setConfig] = useState<BudgetConfig>({});
  const [usage, setUsage] = useState<BudgetUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadBudget();
  }, [pipelineId]);

  const loadBudget = async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const budgetConfig = await pipelineBudgetApi.get(pipelineId);
      setConfig(budgetConfig);
      form.setFieldsValue(budgetConfig);
    } catch (error) {
      message.error('Failed to load budget config');
    }
    setLoading(false);
  };

  const handleSave = async (values: BudgetConfig) => {
    try {
      await pipelineBudgetApi.set(pipelineId!, values);
      message.success('Budget configuration saved');
      loadBudget();
    } catch (error) {
      message.error('Failed to save budget');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        <Col span={12}>
          <Card title={<><DollarOutlined /> Budget Configuration</>} loading={loading}>
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Card type="inner" title="Time Budget">
                <Form.Item label="Max Duration (minutes)" name={['time_budget', 'maxDurationMs']}>
                  <InputNumber min={1} max={120} />
                </Form.Item>
                <Form.Item label="Warning Threshold (%)" name={['time_budget', 'warningPercent']}>
                  <InputNumber min={50} max={100} />
                </Form.Item>
                <Form.Item label="Policy" name={['time_budget', 'policy']}>
                  <Select options={[
                    { value: 'warn', label: 'Warn Only' },
                    { value: 'block', label: 'Block Execution' },
                    { value: 'rollback', label: 'Rollback' },
                  ]} />
                </Form.Item>
              </Card>

              <Card type="inner" title="Cost Budget">
                <Form.Item label="Max Cost (cents)" name={['cost_budget', 'maxCostCents']}>
                  <InputNumber min={0} />
                </Form.Item>
                <Form.Item label="Warning Threshold (%)" name={['cost_budget', 'warningPercent']}>
                  <InputNumber min={50} max={100} />
                </Form.Item>
                <Form.Item label="Policy" name={['cost_budget', 'policy']}>
                  <Select options={[
                    { value: 'warn', label: 'Warn Only' },
                    { value: 'block', label: 'Block Execution' },
                  ]} />
                </Form.Item>
              </Card>

              <Button type="primary" htmlType="submit">Save Configuration</Button>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          <Card title={<><ClockCircleOutlined /> Budget Usage</>}>
            {usage?.alerts?.map((alert, i) => (
              <Alert key={i} type={alert.level === 'critical' ? 'error' : 'warning'} message={alert.message} />
            ))}
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Statistic title="Time Used" value={usage?.time_percent || 0} suffix="%" />
                <Progress percent={usage?.time_percent || 0} status={usage?.time_percent > 80 ? 'exception' : 'normal'} />
              </Col>
              <Col span={8}>
                <Statistic title="Cost Used" value={usage?.cost_percent || 0} suffix="%" />
                <Progress percent={usage?.cost_percent || 0} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PipelineBudget;