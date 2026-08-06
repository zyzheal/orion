import React from 'react';
import EmptyView from './EmptyView';

const ManagementView: React.FC = () => (
  <EmptyView
    title="管理域 — 即将上线"
    description="团队/产品线效能对标、开发者画像等功能正在建设中。Phase 2 完成后将提供跨团队研效横向对比能力。"
    redirect="/efficacy-metrics"
  />
);

export default ManagementView;
