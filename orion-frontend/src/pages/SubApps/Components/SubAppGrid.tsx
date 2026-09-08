/**
 * SubAppGrid.tsx - 子系统卡片网格
 * 抽取自 index.tsx (P2-9 Phase 225)
 */
import React from 'react';
import { Row, Col } from 'antd';
import { SubAppCardView } from './SubAppCardView';
import type { SubAppCard } from '../constants';

interface Props {
  apps: SubAppCard[];
  onNavigate: (path: string) => void;
}

export const SubAppGrid: React.FC<Props> = ({ apps, onNavigate }) => (
  <Row gutter={[24, 24]}>
    {apps.map((app) => (
      <Col xs={24} sm={12} md={8} key={app.key}>
        <SubAppCardView app={app} onNavigate={onNavigate} />
      </Col>
    ))}
  </Row>
);
