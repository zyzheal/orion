import type { TabsProps } from 'antd';
import { BugOutlined, EyeOutlined, BookOutlined } from '@ant-design/icons';
import { ProblemListTab } from '../ProblemListTab';
import { ProblemDetailTab } from '../ProblemDetailTab';
import { KEDBTab } from '../KEDBTab';
import type { useProblemState } from '../useProblemState';
import type { useProblemHandlers } from '../useProblemHandlers';

type State = ReturnType<typeof useProblemState>;
type Handlers = ReturnType<typeof useProblemHandlers>;

interface Props {
  s: State;
  h: Handlers;
  linkForm: any;
}

export function buildProblemTabItems({ s, h, linkForm }: Props): TabsProps['items'] {
  return [
    {
      key: 'list',
      label: (<span><BugOutlined /> 问题列表</span>),
      children: (
        <ProblemListTab
          problems={s.problems}
          totalProblems={s.totalProblems}
          currentPage={s.currentPage}
          setCurrentPage={s.setCurrentPage}
          pageSize={s.pageSize}
          setPageSize={s.setPageSize}
          loading={s.loading}
          filters={s.filters}
          setFilters={s.setFilters}
          searchQuery={s.searchQuery}
          setSearchQuery={s.setSearchQuery}
          setCreateModalVisible={s.setCreateModalVisible}
          loadProblems={s.loadProblems}
          loadStats={s.loadStats}
          handleViewDetail={s.handleViewDetail}
          handleOpenEditModal={h.handleOpenEditModal}
          handleDelete={s.handleDelete}
        />
      ),
    },
    {
      key: 'detail',
      label: (<span><EyeOutlined /> 问题详情</span>),
      children: (
        <ProblemDetailTab
          selectedProblem={s.selectedProblem}
          detailLoading={s.detailLoading}
          statusUpdating={s.statusUpdating}
          setActiveTab={s.setActiveTab}
          handleStatusTransition={s.handleStatusTransition}
          handleOpenEditModal={h.handleOpenEditModal}
          linkFormReset={linkForm.resetFields}
          setLinkIncidentModalVisible={s.setLinkIncidentModalVisible}
          setLinkChangeModalVisible={s.setLinkChangeModalVisible}
        />
      ),
    },
    {
      key: 'kedb',
      label: (<span><BookOutlined /> 已知错误库</span>),
      children: (
        <KEDBTab
          knownErrors={s.knownErrors}
          kedbLoading={s.kedbLoading}
          kedbTotal={s.kedbTotal}
          kedbPage={s.kedbPage}
          setKedbPage={s.setKedbPage}
          kedbPageSize={s.kedbPageSize}
          setKedbPageSize={s.setKedbPageSize}
          kedbFilters={s.kedbFilters}
          setKedbFilters={s.setKedbFilters}
          setKedbModalVisible={s.setKedbModalVisible}
          loadKnownErrors={s.loadKnownErrors}
          handleOpenKedbEditModal={h.handleOpenKedbEditModal}
          handleDeleteKnownError={s.handleDeleteKnownError}
        />
      ),
    },
  ];
}
