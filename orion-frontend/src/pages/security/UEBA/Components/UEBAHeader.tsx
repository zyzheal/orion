/**
 * UEBA Header
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import React from 'react';
import { Typography, Divider } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';
import { commonStyle } from '../constants';

const { Title, Text } = Typography;

export const UEBAHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <UserSwitchOutlined style={{ marginRight: 12, color: commonStyle.error }} />
      UEBA 用户行为异常检测
    </Title>
    <Text type="secondary">行为基线学习 · 离群值检测 · 风险评分</Text>
    <Divider />
  </>
);
