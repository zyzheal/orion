/**
 * TokensTab.tsx - API Token Tab
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import React, { useMemo } from 'react';
import { Card, Table, Button, Space } from 'antd';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens';
import type { UserToken } from '@/api/user';
import { buildTokenColumns } from '../columns';

interface TokensTabProps {
  tokens: UserToken[];
  loading: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export const TokensTab: React.FC<TokensTabProps> = ({ tokens, loading, onCreate, onDelete }) => {
  const tokenColumns = useMemo(() => buildTokenColumns(onDelete), [onDelete]);

  return (
    <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
      <Space style={{ marginBottom: spacing.md }}>
        <Button
          type="primary"
          onClick={onCreate}
          loading={loading}
          style={{
            backgroundColor: colors.primary[500],
            borderColor: colors.primary[500],
            borderRadius: radius.sm,
          }}
        >
          创建 Token
        </Button>
      </Space>
      <Table
        columns={tokenColumns}
        dataSource={tokens}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无 Token，请点击上方按钮创建' }}
      />
    </Card>
  );
};
