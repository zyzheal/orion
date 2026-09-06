/**
 * TraceToolbar.tsx - Waterfall 工具栏（Search + 缩放 + 刷新）
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React from 'react';
import { Typography, Space, Tooltip, Button, Input } from 'antd';
import {
  EyeOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import { HEADER_HEIGHT } from './TraceDetailConfig';

const { Text } = Typography;
const { Search } = Input;

export interface TraceToolbarProps {
  zoom: number;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRefresh: () => void;
}

export const TraceToolbar: React.FC<TraceToolbarProps> = ({
  zoom,
  searchTerm,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onRefresh,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${spacing.md}`,
      height: HEADER_HEIGHT,
    }}
  >
    <Text style={{ fontSize: 13, marginRight: spacing.md, flexShrink: 0 }}>
      <EyeOutlined style={{ marginRight: 4 }} />
      Waterfall
    </Text>

    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      <Search
        placeholder="搜索 span 名称 / 服务 / ID"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ width: 220 }}
        allowClear
      />
    </div>

    <Space size="small">
      <Tooltip title="缩小">
        <Button size="small" icon={<ZoomOutOutlined />} onClick={onZoomOut} />
      </Tooltip>
      <Text
        style={{ fontSize: 11, color: colors.neutral[500], width: 60, textAlign: 'center' }}
      >
        {Math.round(zoom * 100)}%
      </Text>
      <Tooltip title="放大">
        <Button size="small" icon={<ZoomInOutlined />} onClick={onZoomIn} />
      </Tooltip>
      <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />
    </Space>
  </div>
);
