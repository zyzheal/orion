/**
 * Password Policy Configurable Page
 * 密码策略可配置页面 - P4-08
 * 纯前端 Mock 数据，包含密码策略配置、强度测试器、密码历史
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Row,
  Col,
  Progress,
  Table,
  Typography,
  message,
  Space,
  Divider,
  Tag,
} from 'antd';
import {
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;
const { Text } = Typography;
const { Password } = Input;

const commonStyle = {
  primary: colors.primary[500],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  neutral: colors.neutral[500],
};

/**
 * 密码强度计算逻辑
 */
const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score += 20;
  else if (password.length >= 6) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 5;

  let label = '弱';
  let color: string = colors.error[500];
  if (score >= 80) {
    label = '非常强';
    color = colors.success[500];
  } else if (score >= 60) {
    label = '强';
    color = colors.info[500];
  } else if (score >= 40) {
    label = '一般';
    color = colors.warning[500];
  }

  return { score, label, color };
};

/**
 * 检查密码中是否包含连续字符（如 "aaa"）
 */
const hasConsecutiveChars = (password: string, threshold = 3): boolean => {
  for (let i = 0; i <= password.length - threshold; i++) {
    const slice = password.slice(i, i + threshold);
    if (slice.split('').every((ch) => ch === slice[0])) return true;
  }
  return false;
};

/**
 * 简单字典单词检测
 */
const commonWords = ['password', 'admin', '123456', 'qwerty', 'letmein', 'welcome', 'monkey', 'dragon'];
const containsDictionaryWord = (password: string): boolean => {
  const lower = password.toLowerCase();
  return commonWords.some((word) => lower.includes(word));
};

/**
 * Mock 密码历史数据
 */
const mockHistoryData = [
  { key: '1', username: 'zhangsan', updatedAt: '2026-08-07 14:23:10', oldHash: '2b$12$abcdef1234567890', status: '正常' },
  { key: '2', username: 'lisi', updatedAt: '2026-08-06 09:45:33', oldHash: '2b$12$123456abcdef7890', status: '正常' },
  { key: '3', username: 'wangwu', updatedAt: '2026-08-05 17:12:08', oldHash: '2b$12$fedcba0987654321', status: '正常' },
  { key: '4', username: 'zhaoliu', updatedAt: '2026-08-04 11:30:55', oldHash: '2b$12$aabbcc1122334455', status: '过期' },
  { key: '5', username: 'qianqi', updatedAt: '2026-08-03 08:05:22', oldHash: '2b$12$xxyyzz6677889900', status: '过期' },
];

const PasswordPolicyPage: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [testPassword, setTestPassword] = useState('');
  const [strength, setStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: '弱',
    color: colors.error[500],
  });

  useEffect(() => {
    if (!testPassword) {
      setStrength({ score: 0, label: '弱', color: colors.error[500] });
    } else {
      setStrength(calculatePasswordStrength(testPassword));
    }
  }, [testPassword]);

  const handleSave = async () => {
    try {
      await form.validateFields();
      setSaving(true);
      // Mock 保存操作
      await new Promise((resolve) => setTimeout(resolve, 500));
      message.success('密码策略保存成功');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 密码检查项列表
   */
  const checkItems: Array<{ label: string; pass: boolean }> = [
    {
      label: `长度 >= ${form.getFieldValue('minLength') || 8} 字符`,
      pass: testPassword.length >= (form.getFieldValue('minLength') || 8),
    },
    {
      label: '包含大写字母',
      pass: /[A-Z]/.test(testPassword),
    },
    {
      label: '包含小写字母',
      pass: /[a-z]/.test(testPassword),
    },
    {
      label: '包含数字',
      pass: /[0-9]/.test(testPassword),
    },
    {
      label: '包含特殊字符',
      pass: /[^A-Za-z0-9]/.test(testPassword),
    },
    {
      label: '无连续重复字符（如 "aaa"）',
      pass: !hasConsecutiveChars(testPassword),
    },
    {
      label: '非常见字典单词',
      pass: !containsDictionaryWord(testPassword),
    },
  ];

  /**
   * 密码历史表格列定义
   */
  const historyColumns: ColumnsType<any> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '修改时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
    },
    {
      title: '旧密码哈希（前缀）',
      dataIndex: 'oldHash',
      key: 'oldHash',
      render: (hash: string) => <code style={{ fontSize: 12 }}>{hash}</code>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) =>
        status === '正常' ? (
          <Tag color={colors.success[500]}>正常</Tag>
        ) : (
          <Tag color={colors.warning[500]}>过期</Tag>
        ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <LockOutlined style={{ marginRight: 12, color: commonStyle.primary }} />
        密码策略配置
      </Title>
      <Text type="secondary">密码强度 · 过期策略 · 历史密码 · bcrypt 轮数</Text>

      <Divider />

      <Row gutter={[spacing.lg, spacing.lg]}>
        {/* 左侧：密码策略配置表单 */}
        <Col span={14}>
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
                  <Form.Item
                    label="最小长度"
                    name="minLength"
                    rules={[{ required: true, message: '请输入最小长度' }]}
                  >
                    <InputNumber min={4} max={64} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="最大长度"
                    name="maxLength"
                    rules={[{ required: true, message: '请输入最大长度' }]}
                  >
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
                  <Form.Item
                    label="禁用连续字符（如 &quot;aaa&quot;）"
                    name="disableConsecutive"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="禁用重复字符（如 &quot;111&quot;）"
                    name="disableRepeated"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="bcrypt 轮数"
                    name="bcryptRounds"
                    tooltip="影响密码哈希计算的安全性与性能"
                  >
                    <InputNumber min={8} max={31} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="密码过期天数"
                    name="expireDays"
                    tooltip="0 表示永不过期"
                  >
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
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  loading={saving}
                  onClick={handleSave}
                  style={{
                    backgroundColor: commonStyle.primary,
                    borderColor: commonStyle.primary,
                    minWidth: 120,
                  }}
                >
                  保存配置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧：密码强度测试器 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>密码强度测试</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: spacing.md }}>
              <Text style={{ fontSize: 14 }}>输入密码测试强度：</Text>
              <Password
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="请输入测试密码"
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            {testPassword && (
              <>
                <div style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: strength.color,
                    }}
                  >
                    {strength.score}%
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: strength.color,
                      marginLeft: 8,
                    }}
                  >
                    {strength.label}
                  </Text>
                </div>
                <Progress
                  percent={strength.score}
                  strokeColor={strength.color}
                  trailColor="#f0f0f0"
                  showInfo={false}
                  style={{ marginBottom: spacing.md }}
                />
              </>
            )}

            <Divider style={{ margin: `${spacing.sm} 0` }} />

            <div>
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                检查项明细
              </Text>
              {checkItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: `${spacing.xs}px 0`,
                    fontSize: 13,
                  }}
                >
                  {item.pass ? (
                    <CheckCircleOutlined style={{ color: commonStyle.success, marginRight: 8 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: commonStyle.error, marginRight: 8 }} />
                  )}
                  <Text
                    style={{
                      color: item.pass ? colors.neutral[900] : colors.neutral[500],
                    }}
                  >
                    {item.label}
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部：密码历史 */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>密码修改历史（最近记录）</span>
          </Space>
        }
        style={{
          marginTop: spacing.lg,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Table
          columns={historyColumns}
          dataSource={mockHistoryData}
          rowKey="key"
          size="middle"
          pagination={{ pageSize: 5, showSizeChanger: false }}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </div>
  );
};

export default PasswordPolicyPage;
