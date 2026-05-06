import React from 'react';
import { Typography, Card } from 'antd';

const { Title, Text } = Typography;

const BudgetGuardPage: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Card>
      <Title level={4}>Budget Guard</Title>
      <Text type="secondary">Budget guard configuration page (stub)</Text>
    </Card>
  </div>
);

export default BudgetGuardPage;
