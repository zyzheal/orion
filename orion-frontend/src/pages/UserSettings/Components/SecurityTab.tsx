/**
 * SecurityTab.tsx - 安全设置 Tab
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import React from 'react';
import { Card, Form, Input, Button } from 'antd';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import type { PasswordFormValues } from '../constants';

interface SecurityTabProps {
  form: ReturnType<typeof Form.useForm<PasswordFormValues>>[0];
  loading: boolean;
  onFinish: (values: PasswordFormValues) => Promise<void>;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ form, loading, onFinish }) => (
  <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="currentPassword"
        label="当前密码"
        rules={[{ required: true, message: '请输入当前密码' }]}
      >
        <Input.Password placeholder="请输入当前密码" />
      </Form.Item>

      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 8, message: '密码至少需要8位' },
        ]}
      >
        <Input.Password placeholder="请输入新密码（至少8位）" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="确认新密码"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: '请确认新密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password placeholder="请再次输入新密码" />
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
          修改密码
        </Button>
      </Form.Item>
    </Form>
  </Card>
);
