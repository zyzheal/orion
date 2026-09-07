/**
 * NotificationCenter pagination bars (top + bottom)
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Pagination } from 'antd';
import { colors, spacing } from '@/tokens';

interface PaginationBarProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number, size: number) => void;
  position: 'top' | 'bottom';
}

export const PaginationBar = ({ current, total, pageSize, onChange, position }: PaginationBarProps) => {
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
        <span style={{ fontSize: 13, color: colors.neutral[600] }}>
          共 {total} 条通知，每页 {pageSize} 条
        </span>
        <Pagination
          current={current}
          total={total}
          pageSize={pageSize}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={['10', '20', '50', '100']}
          onChange={onChange}
          onShowSizeChange={onChange}
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
        borderTop: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <Pagination
        current={current}
        total={total}
        pageSize={pageSize}
        showSizeChanger
        showQuickJumper
        pageSizeOptions={['10', '20', '50', '100']}
        showTotal={(t) => `共 ${t} 条通知`}
        onChange={onChange}
        onShowSizeChange={onChange}
      />
    </div>
  );
};
