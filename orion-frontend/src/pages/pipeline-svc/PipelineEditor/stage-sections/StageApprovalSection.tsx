/**
 * StageApprovalSection - 审批配置区块
 */
import React from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Switch,
  Tag,
} from 'antd';
import { DeleteOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ApprovalConfig } from '../types';

interface StageApprovalSectionProps {
  value: ApprovalConfig;
  onChange: (value: ApprovalConfig) => void;
}

const StageApprovalSection: React.FC<StageApprovalSectionProps> = ({ value, onChange }) => {
  const addApprover = () => onChange({ ...value, approvers: [...value.approvers, ''] });

  const removeApprover = (index: number) =>
    onChange({
      ...value,
      approvers: value.approvers.filter((_, i) => i !== index),
    });

  const updateApprover = (index: number, approver: string) =>
    onChange({
      ...value,
      approvers: value.approvers.map((a, i) => (i === index ? approver : a)),
    });

  return (
    <>
      <Divider orientation="left" orientationMargin={0}>
        <Space>
          <UserOutlined />
          <span>审批配置</span>
        </Space>
      </Divider>

      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Form.Item label="启用审批" valuePropName="checked">
          <Switch
            checked={value.enabled}
            onChange={(checked) => onChange({ ...value, enabled: checked })}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        </Form.Item>

        {value.enabled && (
          <>
            <Form.Item label="审批人" required tooltip="输入审批人的用户名或邮箱">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {value.approvers.map((approver, index) => (
                  <Space key={String(index)} style={{ width: '100%' }}>
                    <Input
                      value={approver}
                      onChange={(e) => updateApprover(index, e.target.value)}
                      placeholder="输入审批人用户名或邮箱"
                      prefix={<UserOutlined />}
                      style={{ flex: 1 }}
                    />
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeApprover(index)}
                      disabled={value.approvers.length === 0}
                    />
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={addApprover} block>
                  添加审批人
                </Button>
              </Space>
            </Form.Item>

            <Form.Item label="审批模式">
              <Radio.Group
                value={value.mode}
                onChange={(e) => onChange({ ...value, mode: e.target.value })}
              >
                <Radio value="any">
                  <Space>
                    <Tag color="success">任一审批</Tag>
                    <span>任意一个审批人通过即可</span>
                  </Space>
                </Radio>
                <Radio value="unanimous">
                  <Space>
                    <Tag color="processing">全部审批</Tag>
                    <span>所有审批人都必须通过</span>
                  </Space>
                </Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="审批超时 (小时)" tooltip="审批人超过此时间未处理将触发超时动作">
              <InputNumber
                min={1}
                max={168}
                value={value.timeout}
                onChange={(value2) => onChange({ ...value, timeout: value2 || 24 })}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="超时动作">
              <Radio.Group
                value={value.timeoutAction}
                onChange={(e) =>
                  onChange({
                    ...value,
                    timeoutAction: e.target.value,
                  })
                }
              >
                <Radio value="reject">
                  <Tag color="error">自动拒绝</Tag>
                </Radio>
                <Radio value="approve">
                  <Tag color="success">自动通过</Tag>
                </Radio>
              </Radio.Group>
            </Form.Item>
          </>
        )}

        {!value.enabled && (
          <div style={{ padding: '8px 0', color: colors.neutral[500] }}>
            启用后可配置审批人、审批模式和超时处理策略
          </div>
        )}
      </Card>
    </>
  );
};

export default StageApprovalSection;
