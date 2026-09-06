/**
 * ProfileTab.tsx - 基本资料 Tab
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import React from 'react';
import { Card, Form, Input, Button, Avatar, Upload, Space } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import type { UserInfo } from '@/api/types';
import type { ProfileFormValues } from '../constants';

interface ProfileTabProps {
  form: ReturnType<typeof Form.useForm<ProfileFormValues>>[0];
  user: UserInfo | null | undefined;
  loading: boolean;
  onFinish: (values: ProfileFormValues) => Promise<void>;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ form, user, loading, onFinish }) => (
  <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        displayName: user?.username || '',
        email: user?.email || '',
      }}
    >
      <Form.Item label="头像">
        <Space align="center">
          <Avatar
            size={80}
            src={user?.avatar}
            icon={<UserOutlined />}
            style={{ borderRadius: radius.full }}
          />
          <Upload showUploadList={false}>
            <Button icon={<UploadOutlined />}>更换头像</Button>
          </Upload>
        </Space>
      </Form.Item>

      <Form.Item
        name="displayName"
        label="显示名称"
        rules={[{ required: true, message: '请输入显示名称' }]}
      >
        <Input placeholder="请输入显示名称" />
      </Form.Item>

      <Form.Item name="email" label="邮箱">
        <Input disabled placeholder="邮箱不可修改" />
      </Form.Item>

      <Form.Item name="phone" label="手机号">
        <Input placeholder="请输入手机号" />
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
          保存修改
        </Button>
      </Form.Item>
    </Form>
  </Card>
);
