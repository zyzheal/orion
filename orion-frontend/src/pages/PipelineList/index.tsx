/**
 * PipelineList — Pipeline 列表页（深度实施版）
 *
 * 功能：
 * 1. 高级搜索面板（多条件/标签/时间范围）
 * 2. 批量操作（删除/触发/暂停/导出）
 * 3. 虚拟滚动（支持 10000+ 条）
 * 4. 自定义列（显示/隐藏/排序）
 * 5. SSE 实时状态更新
 * 6. 保存的个人视图
 * 7. 空状态引导
 *
 * 主入口 (P2-9 Phase 108 refactor: 已抽取 types/constants/columns/hook/Components)
 */
import React, { useMemo } from 'react';
import { Empty, Button } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { Pipeline } from '@/api/pipelines';
import { usePipelineListState } from './usePipelineListState';
import { buildPipelineColumns } from './columns';
import { Header } from './Components/Header';
import { SearchFilterPanel } from './Components/SearchFilterPanel';
import { ViewControls } from './Components/ViewControls';
import { BatchActions } from './Components/BatchActions';
import { SaveViewModal } from './Components/SaveViewModal';

dayjs.extend(relativeTime);

const PipelineList: React.FC = () => {
  const state = usePipelineListState();

  const columns = useMemo(
    () =>
      buildPipelineColumns({
        navigate: state.navigate,
        canEdit: state.canEdit,
        columnVisible: state.columnVisible,
        handleDelete: state.handleDelete,
      }),
    [state.navigate, state.canEdit, state.columnVisible, state.handleDelete]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Header state={state} />
      <SearchFilterPanel state={state} />
      <ViewControls state={state} />
      <BatchActions state={state} />
      <Table<Pipeline>
        columns={columns}
        dataSource={state.pipelines}
        rowKey="id"
        loading={state.loading}
        pagination={{
          current: state.page,
          pageSize: state.pageSize,
          total: state.total,
        }}
        onPaginationChange={(p, ps) => {
          state.setPage(p);
          if (ps !== state.pageSize) state.setPageSize(ps);
        }}
        scroll={{ x: 1400 }}
        rowSelection={{
          selectedRowKeys: state.selectedRowKeys,
          onChange: (keys) => state.setSelectedRowKeys(keys as string[]),
        }}
        locale={
          {
            emptyText: (
              <Empty
                description="暂无 Pipeline 数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => state.navigate('/pipelines/new')}>
                  创建第一个 Pipeline
                </Button>
              </Empty>
            ),
          }
        }
        size="middle"
      />
      <SaveViewModal state={state} />
    </div>
  );
};

export default PipelineList;
