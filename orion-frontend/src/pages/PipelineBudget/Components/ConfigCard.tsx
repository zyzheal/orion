/**
 * PipelineBudget configuration card (time/cost/compute)
 */
import React from 'react';
import { Button, Card, Col, Form, InputNumber, Row, Select, Space } from 'antd';
import {
  ClockCircleOutlined,
  CloudOutlined,
  DollarOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { BudgetConfig } from '../types';
import { COST_POLICY_OPTIONS, TIME_POLICY_OPTIONS } from '../constants';

interface ConfigCardProps {
  form: FormInstance;
  config: BudgetConfig | null;
  saving: boolean;
  onSave: (values: BudgetConfig) => Promise<void>;
  onReset: () => void;
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  form,
  config,
  saving,
  onSave,
  onReset,
}) => (
  <Card
    title={
      <>
        <SaveOutlined style={{ marginRight: spacing.sm }} />
        预算配置
      </>
    }
    extra={
      <Space>
        <Button onClick={onReset} disabled={!config}>
          重置
        </Button>
      </Space>
    }
  >
    <Form form={form} layout="vertical" onFinish={onSave}>
      {/* Time Budget */}
      <Card
        type="inner"
        title={
          <>
            <ClockCircleOutlined style={{ marginRight: 6 }} />
            时间预算
          </>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="最大执行时长 (分钟)"
              name={['time_budget', 'maxDurationMs']}
              rules={[{ required: true, message: '请输入最大时长' }]}
              getValueFromEvent={(e: unknown) => (typeof e === 'number' ? e * 60 * 1000 : e)}
              getValueProps={(value: unknown) => ({
                value: value ? Math.round((value as number) / 60000) : undefined,
              })}
            >
              <InputNumber
                min={1}
                max={120}
                style={{ width: '100%' }}
                placeholder="如: 30"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="警告阈值 (%)"
              name={['time_budget', 'warningPercent']}
              rules={[{ required: true, message: '请输入警告阈值' }]}
            >
              <InputNumber
                min={50}
                max={100}
                style={{ width: '100%' }}
                placeholder="如: 80"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="超时策略"
          name={['time_budget', 'policy']}
          rules={[{ required: true, message: '请选择超时策略' }]}
        >
          <Select options={TIME_POLICY_OPTIONS} />
        </Form.Item>
      </Card>

      {/* Cost Budget */}
      <Card
        type="inner"
        title={
          <>
            <DollarOutlined style={{ marginRight: 6 }} />
            成本预算
          </>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="最大成本 (元)"
              name={['cost_budget', 'maxCostCents']}
              rules={[{ required: true, message: '请输入最大成本' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="如: 100.00"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="警告阈值 (%)"
              name={['cost_budget', 'warningPercent']}
              rules={[{ required: true, message: '请输入警告阈值' }]}
            >
              <InputNumber
                min={50}
                max={100}
                style={{ width: '100%' }}
                placeholder="如: 80"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="超支策略"
          name={['cost_budget', 'policy']}
          rules={[{ required: true, message: '请选择超支策略' }]}
        >
          <Select options={COST_POLICY_OPTIONS} />
        </Form.Item>
      </Card>

      {/* Compute Budget */}
      <Card
        type="inner"
        title={
          <>
            <CloudOutlined style={{ marginRight: 6 }} />
            计算资源预算
          </>
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="最大 CPU 核心数" name={['compute_budget', 'maxCpu']}>
              <InputNumber
                min={0.1}
                max={64}
                style={{ width: '100%' }}
                placeholder="如: 4"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="最大内存 (GB)" name={['compute_budget', 'maxMemoryGb']}>
              <InputNumber
                min={0.5}
                max={128}
                style={{ width: '100%' }}
                placeholder="如: 8"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Submit */}
      <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing[3] }}>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          保存配置
        </Button>
      </div>
    </Form>
  </Card>
);
