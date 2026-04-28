/**
 * PageSkeleton - 统一页面加载骨架屏
 *
 * 替代传统的 Spin 加载动画，提供结构感知的骨架屏，
 * 模拟页面真实布局（统计卡片 + 搜索栏 + 表格），提升感知性能。
 *
 * 使用方式:
 *   <PageSkeleton cards={4} rows={8} />
 *   <PageSkeleton cards={3} rows={10} searchBar />
 *   <PageSkeleton rows={5} /> {/* 无统计卡片 *\/}
 */
import React, { useMemo } from 'react';
import { Skeleton, Row, Col, Space } from 'antd';

export interface PageSkeletonProps {
  /** 统计卡片数量 (默认 0) */
  cards?: number;
  /** 表格骨架行数 (默认 8) */
  rows?: number;
  /** 是否显示搜索栏骨架 (默认 true) */
  searchBar?: boolean;
  /** 是否显示页面标题骨架 (默认 true) */
  header?: boolean;
  /** 卡片骨架行数列配置 (默认 { rows: 1, width: '60%' }) */
  cardLines?: { rows?: number; width?: string };
  /** 动画开关 (默认开启) */
  animated?: boolean;
}

/** 单个统计卡片骨架 */
const StatCardSkeleton: React.FC<{
  rows?: number;
  width?: string;
  animated?: boolean;
}> = React.memo(({ rows = 1, width = '60%', animated = true }) => (
  <Skeleton
    active={animated}
    title={false}
    paragraph={{
      rows,
      width: Array.isArray(width) ? width : [width],
    }}
  />
));
StatCardSkeleton.displayName = 'StatCardSkeleton';

/** 搜索/筛选栏骨架 */
const SearchBarSkeleton: React.FC<{ animated?: boolean }> = React.memo(({ animated = true }) => (
  <div
    style={{
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      marginBottom: 16,
    }}
  >
    <Skeleton.Input
      active={animated}
      size="large"
      style={{ width: 280, height: 32, borderRadius: 6 }}
    />
    <Skeleton.Input active={animated} size="small" style={{ width: 120, height: 32 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 120, height: 32 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 80, height: 32 }} />
  </div>
));
SearchBarSkeleton.displayName = 'SearchBarSkeleton';

/** 页面标题骨架 */
const HeaderSkeleton: React.FC<{ animated?: boolean }> = React.memo(({ animated = true }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
    }}
  >
    <div>
      <Skeleton.Input
        active={animated}
        size="small"
        style={{ width: 160, height: 28, marginBottom: 8 }}
      />
      <Skeleton.Input active={animated} size="small" style={{ width: 240, height: 16 }} />
    </div>
    <Space>
      <Skeleton.Button active={animated} size="default" style={{ width: 80, height: 32 }} />
      <Skeleton.Button active={animated} size="default" style={{ width: 100, height: 32 }} />
    </Space>
  </div>
));
HeaderSkeleton.displayName = 'HeaderSkeleton';

/** 表格骨架行 */
const TableSkeletonRow: React.FC<{ animated?: boolean }> = React.memo(({ animated = true }) => (
  <div
    style={{
      display: 'flex',
      gap: 24,
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-light, transparent)',
    }}
  >
    <Skeleton.Input active={animated} size="small" style={{ width: 140, height: 16 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 80, height: 20 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 70, height: 20 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 60, height: 20 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 80, height: 16 }} />
    <Skeleton.Input active={animated} size="small" style={{ width: 120, height: 16 }} />
    <Skeleton.Button active={animated} size="small" style={{ width: 160, height: 24 }} />
  </div>
));
TableSkeletonRow.displayName = 'TableSkeletonRow';

// ---- Main Component ----

const PageSkeleton: React.FC<PageSkeletonProps> = React.memo(
  ({ cards = 0, rows = 8, searchBar = true, header = true, cardLines, animated = true }) => {
    const statCardSkeletons = useMemo(
      () =>
        Array.from({ length: cards }, (_, i) => (
          <Col key={`stat-${i}`} xs={24} sm={12} md={8} lg={6} xl={4}>
            <div style={{ padding: 16 }}>
              <StatCardSkeleton
                rows={cardLines?.rows ?? 1}
                width={cardLines?.width ?? '60%'}
                animated={animated}
              />
            </div>
          </Col>
        )),
      [cards, animated, cardLines]
    );

    const tableRows = useMemo(
      () =>
        Array.from({ length: rows }, (_, i) => (
          <TableSkeletonRow key={`row-${i}`} animated={animated} />
        )),
      [rows, animated]
    );

    return (
      <div className="orion-page-skeleton" data-testid="page-skeleton">
        {header && <HeaderSkeleton animated={animated} />}

        {cards > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>{statCardSkeletons}</Row>
          </div>
        )}

        <div
          style={{
            background: 'var(--bg-tertiary, transparent)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--border-light, transparent)',
          }}
        >
          {searchBar && <SearchBarSkeleton animated={animated} />}
          <div>{tableRows}</div>
        </div>
      </div>
    );
  }
);

PageSkeleton.displayName = 'PageSkeleton';

export default PageSkeleton;
