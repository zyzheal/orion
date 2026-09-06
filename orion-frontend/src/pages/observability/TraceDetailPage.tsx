/**
 * TraceDetailPage (P1-08) - Trace 详情可视化
 *
 * 拆分结构（P2-9 Phase 43）:
 * - TraceDetailConfig.ts: 常量 + 工具函数（spanDurationMs/isSpanError/buildSpanTree 等）
 * - TraceDetailColumns.tsx: SpanDetailPopover + TreeNodeRow
 * - TimeAxis.tsx: SVG 时间轴刻度
 * - TraceHeader.tsx: 页头 + 3 张基本信息卡 + Trace ID 行
 * - TraceToolbar.tsx: Waterfall 工具栏（Search + 缩放 + 刷新）
 * - WaterfallChart.tsx: SVG 网格 + Span 条 + Tree 列 + 时间轴
 * - TraceLegend.tsx: 图例（服务颜色 + Error + Search match）
 * - TraceServiceStats.tsx: 按服务统计的 Span 卡片
 * - useTraceState.ts: 全部状态 + 加载器 + 树计算 + 缩放/搜索/交互
 * - TraceDetailPage.tsx: Loading/Error/Empty + 布局编排
 */
import React from 'react';
import { Typography, Card, Button, Empty } from 'antd';
import { spacing, shadows, radius, themeVars } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTraceState } from './useTraceState';
import { HEADER_HEIGHT } from './TraceDetailConfig';
import { TraceHeader } from './TraceHeader';
import { TraceToolbar } from './TraceToolbar';
import { WaterfallChart } from './WaterfallChart';
import { TraceLegend } from './TraceLegend';
import { TraceServiceStats } from './TraceServiceStats';
import PageSkeleton from '@/components/PageSkeleton';

const { Title, Text } = Typography;

const TraceDetailPage: React.FC = () => {
  const state = useTraceState();
  const {
    loading,
    detail,
    error,
    zoom,
    searchTerm,
    matchingSpanIds,
    flatSpans,
    visibleSpans,
    chartRef,
    chartWidth,
    totalDurationMs,
    traceStartMs,
    serviceColorMap,
    effectiveDurationMs,
    pxPerMs,
    svgHeight,
    collapsed,
    hoveredSpanId,
    selectedSpanId,
    hoverY,
    loadTrace,
    setSearchTerm,
    handleSpanEnter,
    handleSpanLeave,
    handleSelect,
    handleToggle,
    handleZoomIn,
    handleZoomOut,
    handleWheelZoom,
  } = state;

  if (loading) {
    return <PageSkeleton rows={8} />;
  }

  if (error && !detail) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClockCircleOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
          Trace 详情
        </Title>
        <Card>
          <Empty description={<Text type="secondary">{error}</Text>}>
            <Button type="primary" onClick={() => loadTrace('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')}>
              重试
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClockCircleOutlined style={{ marginRight: spacing.sm }} />
          Trace 详情
        </Title>
        <Empty description="请选择或输入 Trace ID">
          <Button type="primary">加载 Trace</Button>
        </Empty>
      </div>
    );
  }

  const rootSpan = flatSpans.find((n) => !n.span.parentId) || flatSpans[0];

  return (
    <div>
      <TraceHeader detail={detail} rootStatusCode={rootSpan?.span.statusCode || 'OK'} />

      <Card
        style={{
          boxShadow: shadows.sm,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div
          style={{
            borderBottom: `1px solid ${themeVars.borderDefault}`,
            backgroundColor: themeVars.bgSecondary,
            height: HEADER_HEIGHT,
          }}
        >
          <TraceToolbar
            zoom={zoom}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRefresh={() => loadTrace(detail.traceId)}
          />
        </div>

        <WaterfallChart
          chartRef={chartRef}
          visibleSpans={visibleSpans}
          flatSpans={flatSpans}
          chartWidth={chartWidth}
          totalDurationMs={totalDurationMs}
          traceStartMs={traceStartMs}
          serviceColorMap={serviceColorMap}
          zoom={zoom}
          effectiveDurationMs={effectiveDurationMs}
          pxPerMs={pxPerMs}
          svgHeight={svgHeight}
          collapsed={collapsed}
          hoveredSpanId={hoveredSpanId}
          selectedSpanId={selectedSpanId}
          hoverY={hoverY}
          searchTerm={searchTerm}
          matchingSpanIds={matchingSpanIds}
          onSpanEnter={handleSpanEnter}
          onSpanLeave={handleSpanLeave}
          onSelect={handleSelect}
          onToggle={handleToggle}
          onWheelZoom={handleWheelZoom}
        />
      </Card>

      <TraceLegend serviceColorMap={serviceColorMap} />

      <TraceServiceStats
        detail={detail}
        flatSpans={flatSpans}
        serviceColorMap={serviceColorMap}
      />
    </div>
  );
};

export default TraceDetailPage;
