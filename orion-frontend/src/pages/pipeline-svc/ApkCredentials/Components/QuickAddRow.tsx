/**
 * ApkCredentials quick-add row
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Divider, Space, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { MarketOption } from '../types';

interface QuickAddRowProps {
  unconfiguredMarkets: MarketOption[];
  onAdd: (market: string) => void;
}

export const QuickAddRow: React.FC<QuickAddRowProps> = ({ unconfiguredMarkets, onAdd }) => {
  if (unconfiguredMarkets.length === 0) return null;
  return (
    <>
      <Divider>快速添加</Divider>
      <Space wrap>
        {unconfiguredMarkets.map((market) => (
          <Button
            key={market.value}
            icon={<PlusOutlined />}
            onClick={() => onAdd(market.value)}
          >
            添加 {market.label}
          </Button>
        ))}
      </Space>
    </>
  );
};
