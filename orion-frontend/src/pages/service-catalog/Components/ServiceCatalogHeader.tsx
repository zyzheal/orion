/**
 * ServiceCatalog header
 */
import React from 'react';
import { Typography } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

export const ServiceCatalogHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <CloudServerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      服务目录
    </Title>
    <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
      管理可复用的服务模板、元数据，监控服务请求 SLA 合规
    </Text>
  </>
);
