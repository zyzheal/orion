/**
 * PaginationBar - 分页栏 (顶部 + 底部)
 * 抽取自 index.tsx (P2-9 Phase 121)
 */
import React from 'react';
import { Pagination } from 'antd';
import { colors, spacing } from '@/tokens';
import { PAGE_SIZE_OPTIONS } from '../config';
import type { NotificationCenterState } from '../useNotificationCenterState';

interface PaginationBarProps {
  state: NotificationCenterState;
  position: 'top' | 'bottom';
}

export const PaginationBar: React.FC<PaginationBarProps> = ({ state, position }) => {
  const { total, currentPage, pageSize, handlePageChange } = state;

  if (total === 0) return null;

  if (position === 'top') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
          padding: '8px 12px',
          background: colors.neutral[50],
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 13, color: colors.neutral[600] as string }}>
          共 {total} 条通知，第 {currentPage} 页
        </span>
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onChange={handlePageChange}
          onShowSizeChange={handlePageChange}
          size="small"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        padding: '16px 0',
        borderTop: `1px solid ${colors.neutral[200] as string}`,
      }}
    >
      <Pagination
        current={currentPage}
        total={total}
        pageSize={pageSize}
        showSizeChanger
        showQuickJumper
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        showTotal={(t) => `共 ${t} 条通知`}
        onChange={handlePageChange}
        onShowSizeChange={handlePageChange}
      />
    </div>
  );
};
