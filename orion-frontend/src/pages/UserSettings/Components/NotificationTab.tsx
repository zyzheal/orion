/**
 * NotificationTab.tsx - 通知偏好 Tab
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import React from 'react';
import { Card, Form, Input, Button, Switch, Divider, Select } from 'antd';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import {
  type NotificationFormValues,
  NOTIFICATION_FREQUENCY_OPTIONS,
} from '../constants';

interface NotificationTabProps {
  form: ReturnType<typeof Form.useForm<NotificationFormValues>>[0];
  loading: boolean;
  onFinish: (values: NotificationFormValues) => Promise<void>;
}

export const NotificationTab: React.FC<NotificationTabProps> = ({ form, loading, onFinish }) => (
  <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="emailEnabled" label="邮件通知" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item name="inAppEnabled" label="站内信" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Divider />

      <Form.Item name="webhookEnabled" label="Webhook 推送" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item name="webhookUrl" label="Webhook URL">
        <Input
          placeholder="请输入 Webhook URL"
          disabled={!form.getFieldValue('webhookEnabled')}
        />
      </Form.Item>

      <Form.Item name="notifyFrequency" label="通知频率">
        <Select placeholder="请选择通知频率" options={NOTIFICATION_FREQUENCY_OPTIONS} />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          style={{
            backgroundColor: colors.primary[500],
            borderColor: colors.primary[500],
            borderRadius: radius.sm,
          }}
        >
          保存偏好
        </Button>
      </Form.Item>
    </Form>
  </Card>
);
