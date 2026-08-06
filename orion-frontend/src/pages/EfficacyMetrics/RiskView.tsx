import React from 'react';
import EmptyView from './EmptyView';

const RiskView: React.FC = () => (
  <EmptyView
    title="风险看板 — 即将上线"
    description="风险+技术债务+质量门禁聚合等功能正在建设中。Phase 2 完成后将提供一站式风险度量能力。"
    redirect="/efficacy-metrics"
  />
);

export default RiskView;
