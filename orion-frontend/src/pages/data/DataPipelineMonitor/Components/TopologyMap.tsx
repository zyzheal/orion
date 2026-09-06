/**
 * TopologyMap - SVG 管道拓扑图
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import React from 'react';
import { Card, Space, Typography } from 'antd';
import { colors, spacing, themeVars } from '@/tokens';
import { MOCK_TOPOLOGY_NODES, MOCK_TOPOLOGY_EDGES } from '../mockData';
import { NODE_STATUS_COLOR, NODE_POSITIONS } from '../constants';

const { Text } = Typography;

const TopologyMap: React.FC = () => (
  <Card title="管道拓扑图">
    <div
      style={{
        width: '100%',
        height: 460,
        position: 'relative',
        background: themeVars.bgSecondary,
        borderRadius: spacing.sm,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
        viewBox="0 0 560 460"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={colors.neutral[400]} />
          </marker>
        </defs>
        {MOCK_TOPOLOGY_EDGES.map((edge, i) => {
          const srcPos = NODE_POSITIONS[edge.source];
          const tgtPos = NODE_POSITIONS[edge.target];
          if (!srcPos || !tgtPos) return null;
          return (
            <line
              key={String(i)}
              x1={srcPos[0] + 80}
              y1={srcPos[1] + 25}
              x2={tgtPos[0]}
              y2={tgtPos[1] + 25}
              stroke={colors.neutral[400]}
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
              opacity="0.5"
            />
          );
        })}
      </svg>
      {MOCK_TOPOLOGY_NODES.map((node) => {
        const pos = NODE_POSITIONS[node.id];
        if (!pos) return null;
        const color = NODE_STATUS_COLOR[node.status] || colors.neutral[400];
        const border =
          node.type === 'source'
            ? '3px solid'
            : node.type === 'transform'
              ? '2px dashed'
              : '3px solid';
        const bgColor = color + '18';
        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: pos[0],
              top: pos[1],
              width: 78,
              height: 50,
              backgroundColor: bgColor,
              border: `${border} ${color}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              lineHeight: 1.3,
              color: colors.neutral[700],
              textAlign: 'center',
              boxShadow:
                node.status === 'error'
                  ? `0 0 12px ${colors.error[500]}66`
                  : node.status === 'running'
                    ? `0 0 8px ${colors.success[500]}44`
                    : 'none',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 500 }}>{node.label}</Text>
          </div>
        );
      })}
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space size="small">
          <LegendSwatch bg={colors.success[500]} label="运行中" />
          <LegendSwatch bg={colors.error[500]} label="异常" />
          <LegendSwatch bg={colors.neutral[400]} label="空闲" />
        </Space>
        <Space size="small">
          <LegendSwatch
            bg="transparent"
            border={`3px solid ${colors.neutral[500]}`}
            label="源"
          />
          <LegendSwatch
            bg="transparent"
            border={`2px dashed ${colors.neutral[500]}`}
            label="转换"
          />
          <LegendSwatch
            bg={colors.neutral[100]}
            border={`3px solid ${colors.neutral[500]}`}
            label="目标"
          />
        </Space>
      </div>
    </div>
  </Card>
);

interface LegendSwatchProps {
  bg: string;
  border?: string;
  label: string;
}

const LegendSwatch: React.FC<LegendSwatchProps> = ({ bg, border, label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 3,
        backgroundColor: bg,
        border: border || 'none',
        display: 'inline-block',
      }}
    />
    <Text type="secondary" style={{ fontSize: 10 }}>
      {label}
    </Text>
  </span>
);

export default TopologyMap;
