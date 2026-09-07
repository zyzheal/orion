/**
 * PasswordPolicy config form
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import React from 'react';
import { Button, Card, Col, Form, InputNumber, Row, Space, Switch, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { COMMON_STYLE } from '../helpers';

interface PolicyConfigFormProps {
  form: FormInstance;
}

export const PolicyConfigForm: React.FC<PolicyConfigFormProps> = ({ form }) => (
  <Card
    title={
      <Space>
        <KeyOutlined />
        <span>策略参数</span>
      </Space>
    }
    style={{
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSpecial: true,
        disableConsecutive: true,
        disableRepeated: true,
        bcryptRounds: 12,
        expireDays: 90,
        historyCount: 5,
        lockFailures: 5,
        lockDurationMin: 30,
      }}
      style={{ marginTop: spacing.sm }}
    >
      <Row gutter={[spacing.md, spacing.md]}>
        <Col span={12}>
          <Form.Item label="最小长度" name="minLength" rules={[{ required: true, message: '请输入最小长度' }]}>
            <InputNumber min={4} max={64} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="最大长度" name="maxLength" rules={[{ required: true, message: '请输入最大长度' }]}>
            <InputNumber min={8} max={256} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="需要大写字母" name="requireUppercase" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="需要小写字母" name="requireLowercase" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="需要数字" name="requireDigit" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="需要特殊字符" name="requireSpecial" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label='禁用连续字符（如 "aaa"）' name="disableConsecutive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label='禁用重复字符（如 "111"）' name="disableRepeated" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="bcrypt 轮数" name="bcryptRounds" tooltip="影响密码哈希计算的安全性与性能">
            <InputNumber min={8} max={31} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="密码过期天数" name="expireDays" tooltip="0 表示永不过期">
            <InputNumber min={0} max={3650} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="密码历史保留数量" name="historyCount">
            <InputNumber min={0} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="锁定账户失败次数" name="lockFailures">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="锁定持续时间（分钟）" name="lockDurationMin">
            <InputNumber min={1} max={1440} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item style={{ marginTop: spacing.lg, textAlign: 'right' }}>
        <Tooltip title="密码策略保存 API 开发中">
          <Button
            type="primary"
            icon={<KeyOutlined />}
            disabled
            style={{
              backgroundColor: COMMON_STYLE.neutral,
              borderColor: COMMON_STYLE.neutral,
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
