/**
 * TemplateMarket - 低代码模板市场页面
 *
 * 功能：
 * - 浏览所有可用模板（支持分类筛选、搜索）
 * - 查看模板详情
 * - 应用模板创建新流程
 * - 发布流程为新模板
 *
 * 拆分 (P2-9 Phase 141): types / constants / useTemplateMarketState / Components/*
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useTemplateMarketState } from './useTemplateMarketState';
import { TemplateMarketHeader } from './Components/TemplateMarketHeader';
import { TemplateFiltersCard } from './Components/TemplateFiltersCard';
import { TemplateGrid } from './Components/TemplateGrid';
import { TemplateDetailModal } from './Components/TemplateDetailModal';
import { ApplyTemplateModal } from './Components/ApplyTemplateModal';
import { PublishTemplateModal } from './Components/PublishTemplateModal';

const TemplateMarketPage: React.FC = () => {
  const state = useTemplateMarketState();

  const categories = Array.from(
    new Set(state.templates.map((t) => t.category).filter(Boolean))
  ) as string[];

  return (
    <div style={{ padding: spacing.lg }}>
      <TemplateMarketHeader onOpenPublish={state.handleOpenPublish} />
      <TemplateFiltersCard
        categories={categories}
        searchText={state.searchText}
        onSearchChange={state.setSearchText}
        categoryFilter={state.categoryFilter}
        onCategoryChange={state.setCategoryFilter}
        total={state.total}
      />
      <TemplateGrid
        templates={state.templates}
        loading={state.loading}
        onViewDetail={state.handleViewDetail}
        onOpenApply={state.handleOpenApply}
        onOpenPublish={state.handleOpenPublish}
      />
      <TemplateDetailModal
        selectedTemplate={state.selectedTemplate}
        visible={state.detailVisible}
        onClose={state.closeDetail}
        onUseTemplate={state.handleOpenApply}
      />
      <ApplyTemplateModal
        templateToApply={state.templateToApply}
        visible={state.applyVisible}
        applying={state.applying}
        form={state.applyForm}
        onClose={state.closeApply}
        onSubmit={state.handleApplyTemplate}
      />
      <PublishTemplateModal
        visible={state.publishVisible}
        publishing={state.publishing}
        flows={state.flows}
        form={state.publishForm}
        onClose={state.closePublish}
        onSubmit={state.handlePublish}
      />
    </div>
  );
};

export default TemplateMarketPage;
