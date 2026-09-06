/**
 * PerformanceFlameGraphPage (P1-09) - 布局编排
 * 性能火焰图可视化 - CPU / Memory / IO
 *
 * 主页面仅保留: loading/error/empty 状态 + 页头 + Tab + 工具栏 + 主内容布局 + 底部统计卡
 * 状态+加载+9 handler+ResizeObserver 抽到 useFlameGraphState hook
 * SVG 火焰图容器抽到 FlameGraphContainer (含 header/legend/clipPath/rows)
 * 详情面板抽到 FlameDetailPanel，图例抽到 FlameGraphLegend，统计卡抽到 FlameCategoryStats
 *
 * Design Tokens:
 * - 火焰图经典配色: #F5C77E → #E07A5F → #C44536 → #9E2A2B → #821F20
 * - Card 阴影: shadows.sm; 圆角: radius.lg / radius.xs; 间距: spacing.sm/md/lg
 */
import React from 'react';
import { Tabs, Card, Typography, Tooltip, Button, Empty, Space, Tag } from 'antd';
import { spacing, shadows, radius, themeVars } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  FireOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  type FlameGraphType,
  FLAME_GRAPH_DESCRIPTIONS,
  FLAME_GRAPH_UNITS,
} from '@/api/flamegraph';
import {
  DETAIL_PANEL_WIDTH,
  FLAME_COLORS,
  formatValue,
} from './PerformanceFlameGraphConfig';
import { useFlameGraphState } from './useFlameGraphState';
import { FlameGraphContainer } from './FlameGraphContainer';
import { FlameDetailPanel } from './FlameDetailPanel';
import { FlameCategoryStats } from './FlameCategoryStats';

const { Title, Text } = Typography;

const PerformanceFlameGraphPage: React.FC = () => {
  const state = useFlameGraphState();
  const {
    activeType,
    loading,
    error,
    currentProfile,
    profiles,
    zoom,
    selectedFrame,
    selectedDepth,
    flatRows,
    maxDepth,
    effectiveMaxDepth,
    sortedCategories,
    loadProfile,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleTabChange,
    setSelectedFrame,
  } = state;

  const unit = FLAME_GRAPH_UNITS[activeType];
  const description = FLAME_GRAPH_DESCRIPTIONS[activeType];

  // ---- Tab 配置 ----

  const tabItems: { key: FlameGraphType; label: string; count: number }[] = [
    { key: 'cpu', label: 'CPU', count: profiles.cpu?.totalValue ?? 0 },
    { key: 'memory', label: 'Memory', count: profiles.memory?.totalValue ?? 0 },
    { key: 'io', label: 'IO', count: profiles.io?.totalValue ?? 0 },
  ];

  const tabs = tabItems.map((t) => ({
    key: t.key,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
        {t.key === 'cpu' && <FireOutlined />}
        {t.key === 'memory' && <ThunderboltOutlined />}
        {t.key === 'io' && <SwapOutlined />}
        <span>{t.label}</span>
        <Tag style={{ fontSize: 10, padding: '0 4px' }}>{formatValue(t.count)}</Tag>
      </span>
    ),
  }));

  // ---- 渲染 ----

  if (loading) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={{ marginRight: spacing.sm, color: FLAME_COLORS[2] }} />
          性能火焰图
        </Title>
        <Text type="secondary">{description}</Text>
        <Card
          style={{
            marginTop: spacing.md,
            height: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description={<Text type="secondary">加载火焰图数据中...</Text>} />
        </Card>
      </div>
    );
  }

  if (error && !currentProfile) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
          性能火焰图
        </Title>
        <Card>
          <Empty description={<Text type="secondary">{error}</Text>}>
            <Button type="primary" onClick={() => loadProfile(activeType)}>
              重试
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.sm }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={
            {
              marginRight: spacing.sm,
              color: FLAME_COLORS[2],
            } as React.CSSProperties
          } />
          性能火焰图
        </Title>
        <Text type="secondary">{description}</Text>
      </div>

      {/* Tab + 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Tabs
          activeKey={activeType}
          onChange={handleTabChange}
          items={tabs}
          size="small"
          type="card"
          style={{ width: 'auto' }}
        />

        <Space size="small">
          <Tooltip title="缩小">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>
          <Text
            style={{
              fontSize: 11,
              color: colors.neutral[500],
              width: 48,
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </Text>
          <Tooltip title="放大">
            <Button size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>
          <Tooltip title="重置缩放 & 展开全部">
            <Button size="small" icon={<ReloadOutlined />} onClick={handleResetZoom} />
          </Tooltip>
        </Space>
      </div>

      {/* 主内容区 */}
      <div style={{ display: 'flex', gap: spacing.md }}>
        {/* 左侧火焰图 */}
        <FlameGraphContainer
          activeType={activeType}
          unit={unit}
          currentProfile={currentProfile}
          flatRows={flatRows}
          effectiveMaxDepth={effectiveMaxDepth}
          maxDepth={maxDepth}
          zoom={zoom}
          chartWidth={state.chartWidth}
          collapsed={state.collapsed}
          hoveredFrame={state.hoveredFrame}
          selectedFrame={selectedFrame}
          svgRef={state.svgRef}
          containerRef={state.containerRef}
          sortedCategories={sortedCategories}
          isNodeCollapsed={state.isNodeCollapsed}
          handleFrameEnter={state.handleFrameEnter}
          handleFrameLeave={state.handleFrameLeave}
          handleFrameClick={state.handleFrameClick}
          handleWheel={state.handleWheel}
        />

        {/* 右侧详情面板 */}
        <div style={{ width: DETAIL_PANEL_WIDTH, flexShrink: 0 }}>
          {selectedFrame ? (
            <FlameDetailPanel
              frame={selectedFrame}
              depth={selectedDepth}
              totalValue={currentProfile?.totalValue ?? 0}
              allRows={flatRows}
              unit={unit}
              onClose={() => setSelectedFrame(null)}
            />
          ) : (
            <Card
              size="small"
              style={{
                boxShadow: shadows.sm,
                borderRadius: radius.lg,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              bodyStyle={{
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: spacing.sm,
              }}
            >
              <FireOutlined
                style={
                  {
                    fontSize: 32,
                    color: FLAME_COLORS[2],
                    opacity: 0.6,
                  } as React.CSSProperties
                }
              />
              <Text type="secondary" style={{ fontSize: 13 }}>
                点击火焰图节点查看
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                函数详情 / 调用栈 / 占比分析
              </Text>
              {currentProfile && (
                <div
                  style={{
                    width: '100%',
                    marginTop: spacing.md,
                    borderTop: `1px solid ${themeVars.borderLight}`,
                    paddingTop: spacing.sm,
                  }}
                >
                  <Text
                    strong
                    style={
                      {
                        fontSize: 12,
                        display: 'block',
                        marginBottom: spacing.xs,
                      } as React.CSSProperties
                    }
                  >
                    全局统计
                  </Text>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    <Text type="secondary">{unit} 总计</Text>
                    <Text strong>{formatValue(currentProfile.totalValue)}</Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    <Text type="secondary">最大深度</Text>
                    <Text strong>{maxDepth}</Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    <Text type="secondary">总层数</Text>
                    <Text strong>{flatRows.length}</Text>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      {currentProfile && <FlameCategoryStats sortedCategories={sortedCategories} />}
    </div>
  );
};

export default PerformanceFlameGraphPage;
