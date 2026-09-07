/**
 * UEBA Detection Config Card
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import React from 'react';
import { Card, Space, Form, Row, Col, InputNumber, Radio, Select, Button, Tooltip } from 'antd';
import { SettingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { plainCardStyle, commonStyle } from '../constants';
import type { DetectionConfig } from '../types';

const { Option } = Select;

interface DetectionConfigCardProps {
  configForm: import('antd').FormInstance;
  config: DetectionConfig;
}

export const DetectionConfigCard: React.FC<DetectionConfigCardProps> = ({
  configForm,
  config,
}) => (
  <Card
    title={
      <Space>
        <SettingOutlined />
        <span>检测模型配置</span>
      </Space>
    }
    style={plainCardStyle}
  >
    <Form
      form={configForm}
      layout="horizontal"
      initialValues={config}
      style={{ maxWidth: 700, margin: '0 auto' }}
    >
      <Row gutter={[spacing.lg, spacing.md]}>
        <Col span={8}>
          <Form.Item label="检测方法" name="method">
            <Radio.Group>
              <Radio value="IQR">IQR</Radio>
              <Radio value="3σ">3σ</Radio>
              <Radio value="Z-Score">Z-Score</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="阈值灵敏度"
            name="sensitivity"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.reject(new Error('请输入灵敏度值'));
                  if (value < 1 || value > 10)
                    return Promise.reject(new Error('灵敏度必须在 1-10 之间'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="级" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="基线学习周期" name="baselineDays">
            <Select placeholder="选择基线学习周期">
              <Option value={7}>7天</Option>
              <Option value={14}>14天</Option>
              <Option value={30}>30天</Option>
              <Option value={90}>90天</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item style={{ textAlign: 'right', marginTop: spacing.sm }}>
        <Tooltip title="检测模型保存 API 开发中">
          <Button
            type="primary"
            icon={<ExclamationCircleOutlined />}
            disabled
            style={{
              backgroundColor: commonStyle.neutral,
              borderColor: commonStyle.neutral,
              minWidth: 120,
            }}
          >
            保存配置
          </Button>
        </Tooltip>
      </Form.Item>
    </Form>
  </Card>
);
