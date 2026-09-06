/**
 * StageTimeoutSection - 超时策略配置区块
 */
import React from 'react';
import { Card, Divider, Form, InputNumber, Radio, Space, Switch, Tag } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TimeoutConfig } from '../types';

interface StageTimeoutSectionProps {
  value: TimeoutConfig;
  onChange: (value: TimeoutConfig) => void;
}

const StageTimeoutSection: React.FC<StageTimeoutSectionProps> = ({ value, onChange }) => (
  <>
    <Divider orientation="left" orientationMargin={0}>
      <Space>
        <ClockCircleOutlined />
        <span>超时策略配置</span>
      </Space>
    </Divider>

    <Card size="small" style={{ marginBottom: spacing.md }} className="orion-stage-timeout-config">
      <Form.Item label="启用超时策略" valuePropName="checked">
        <Switch
          checked={value.enabled}
          onChange={(checked) => onChange({ ...value, enabled: checked })}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      </Form.Item>

      {value.enabled && (
        <>
          <Form.Item label="超时时长 (秒)" tooltip="阶段执行超过此时间将触发超时策略">
            <InputNumber
              min={1}
              max={7200}
              step={60}
              value={value.duration}
              onChange={(value2) => onChange({ ...value, duration: value2 || 300 })}
              style={{ width: '100%' }}
              placeholder="默认 300 秒"
            />
          </Form.Item>

          <Form.Item label="超时后动作">
            <Radio.Group
              value={value.action}
              onChange={(e) => onChange({ ...value, action: e.target.value })}
            >
              <Space direction="vertical">
                <Radio value="fail">
                  <Space>
                    <Tag color="error">失败</Tag>
                    <span>标记阶段为失败</span>
                  </Space>
                </Radio>
                <Radio value="skip">
                  <Space>
                    <Tag color="warning">跳过</Tag>
                    <span>跳过当前阶段继续后续阶段</span>
                  </Space>
                </Radio>
                <Radio value="retry">
                  <Space>
                    <Tag color="processing">重试</Tag>
                    <span>自动重试指定次数</span>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {value.action === 'retry' && (
            <Form.Item label="重试次数">
              <InputNumber
                min={1}
                max={5}
                value={value.retryCount}
                onChange={(value2) => onChange({ ...value, retryCount: value2 || 1 })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        </>
      )}

      {!value.enabled && (
        <div style={{ padding: '8px 0', color: colors.neutral[500] }}>
          启用后可配置超时时长和超时后的动作（失败/跳过/重试）
        </div>
      )}
    </Card>
  </>
);

export default StageTimeoutSection;
