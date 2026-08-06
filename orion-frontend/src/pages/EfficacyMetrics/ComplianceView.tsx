import React from 'react';
import EmptyView from './EmptyView';

const ComplianceView: React.FC = () => (
  <EmptyView
    title="合规域 — 即将上线"
    description="合规率、SLA 达成、API 合同合规等功能正在建设中。Phase 2 完成后将提供全面合规度量能力。"
    redirect="/efficacy-metrics"
  />
);

export default ComplianceView;
