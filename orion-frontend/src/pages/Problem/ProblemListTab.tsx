/**
 * ProblemListTab - 问题列表 Tab
 * 抽取自 index.tsx，包含 SearchFilterBar + Table
 */
import React from 'react';
import { Space, Button } from 'antd';
import Table from '@/components/Table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { Problem } from '@/api/problem';
import { severityOptions, problemStatusOptions } from './config';
import { buildProblemColumns } from './columns';

const problemFilterDefs = [
  { key: 'severity', label: '严重级别', options: severityOptions },
  { key: 'status', label: '状态', options: problemStatusOptions },
];

export interface ProblemListTabProps {
  problems: Problem[];
  totalProblems: number;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageSize: number;
  setPageSize: (ps: number) => void;
  loading: boolean;
  filters: Record<string, string | string[] | undefined>;
  setFilters: (f: Record<string, string | string[] | undefined>) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setCreateModalVisible: (v: boolean) => void;
  loadProblems: () => void;
  loadStats: () => void;
  handleViewDetail: (problem: Problem) => void;
  handleOpenEditModal: (problem: Problem) => void;
  handleDelete: (id: string) => void;
}

export const ProblemListTab: React.FC<ProblemListTabProps> = ({
  problems,
  totalProblems,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  loading,
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  setCreateModalVisible,
  loadProblems,
  loadStats,
  handleViewDetail,
  handleOpenEditModal,
  handleDelete,
}) => {
  const problemColumns = buildProblemColumns({
    handleViewDetail,
    handleOpenEditModal,
    handleDelete,
  });

  return (
    <div>
      <SearchFilterBar
        onSearch={setSearchQuery}
        onFilter={setFilters}
        filters={problemFilterDefs}
        searchPlaceholder="搜索问题标题、描述、分类..."
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadProblems();
                loadStats();
              }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新建问题
            </Button>
          </Space>
        }
      />
      <div style={{ marginTop: spacing.md }}>
        <Table<Problem>
          columns={problemColumns}
          dataSource={problems}
          rowKey="id"
          loading={loading}
          pagination={{ current: currentPage, pageSize, total: totalProblems }}
          showTotal
          pageSizeOptions={[10, 20, 50, 100]}
          onPaginationChange={(p: number, ps: number) => {
            setCurrentPage(p);
            setPageSize(ps);
          }}
        />
      </div>
    </div>
  );
};
