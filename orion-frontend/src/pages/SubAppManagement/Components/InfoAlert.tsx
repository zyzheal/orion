/**
 * InfoAlert - 页面提示信息
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Alert } from 'antd';
import { spacing } from '@/tokens';

export const InfoAlert: React.FC = () => (
  <Alert
    message="页面化管理"
    description="子应用配置通过页面管理，保存后立即生效。3个子应用已预配置：数据库管理、知识库、监控中心。"
    type="info"
    showIcon
    style={{ marginBottom: spacing.md }}
  />
);
