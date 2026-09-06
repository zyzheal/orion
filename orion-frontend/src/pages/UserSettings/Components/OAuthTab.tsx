/**
 * OAuthTab.tsx - 第三方登录 Tab
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import React from 'react';
import { Card, Button, Row, Col, Space, Typography } from 'antd';
import { GithubOutlined, GitlabOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import type { OAuthBinding } from '../constants';

const { Text } = Typography;

interface OAuthTabProps {
  oauthBindings: OAuthBinding[];
  onBind: (provider: string) => void;
}

export const OAuthTab: React.FC<OAuthTabProps> = ({ oauthBindings, onBind }) => (
  <div style={{ maxWidth: 600 }}>
    <Row gutter={[16, 16]}>
      {oauthBindings.map((binding) => (
        <Col span={24} key={binding.provider}>
          <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space>
                  {binding.provider === 'github' ? (
                    <GithubOutlined style={{ fontSize: 24 }} />
                  ) : (
                    <GitlabOutlined style={{fontSize: 24}} />
                  )}
                  <Text strong style={{ textTransform: 'capitalize' }}>
                    {binding.provider}
                  </Text>
                </Space>
              </Col>
              <Col>
                {binding.bound ? (
                  <Space>
                    <Text type="success">已绑定</Text>
                    <Button danger size="small">
                      解绑
                    </Button>
                  </Space>
                ) : (
                  <Button
                    type="primary"
                    onClick={() => onBind(binding.provider)}
                    style={{
                      backgroundColor: colors.primary[500],
                      borderColor: colors.primary[500],
                      borderRadius: radius.sm,
                    }}
                  >
                    绑定
                  </Button>
                )}
              </Col>
            </Row>
          </Card>
        </Col>
      ))}
    </Row>
  </div>
);
