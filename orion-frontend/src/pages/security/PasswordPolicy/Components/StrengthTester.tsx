/**
 * PasswordPolicy strength tester
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import React from 'react';
import { Card, Divider, Input, Progress, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { COMMON_STYLE } from '../helpers';

const { Text } = Typography;
const { Password } = Input;

interface StrengthTesterProps {
  testPassword: string;
  onTestPasswordChange: (v: string) => void;
  strength: { score: number; label: string; color: string };
  checkItems: Array<{ label: string; pass: boolean }>;
}

export const StrengthTester: React.FC<StrengthTesterProps> = ({
  testPassword,
  onTestPasswordChange,
  strength,
  checkItems,
}) => (
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
        onChange={(e) => onTestPasswordChange(e.target.value)}
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
          trailColor={colors.neutral[100]}
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
          key={String(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `${spacing.xs}px 0`,
            fontSize: 13,
          }}
        >
          {item.pass ? (
            <CheckCircleOutlined style={{ color: COMMON_STYLE.success, marginRight: 8 }} />
          ) : (
            <CloseCircleOutlined style={{ color: COMMON_STYLE.error, marginRight: 8 }} />
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
);
