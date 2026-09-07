/**
 * ApkCredentials page header
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Typography, Button } from 'antd';
import { KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ApkCredentialsHeaderProps {
  onAdd: () => void;
}

export const ApkCredentialsHeader: React.FC<ApkCredentialsHeaderProps> = ({ onAdd }) => (
  <div
    style={{
      marginBottom: spacing.lg,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <KeyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        APK 上传凭证管理
      </Title>
      <Text type="secondary">
        配置各大应用市场的上传凭证，支持华为、小米、OPPO、VIVO、荣耀、腾讯应用宝、Google
        Play、三星、蒲公英、fir.im
      </Text>
    </div>
    <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
      添加凭证
    </Button>
  </div>
);
