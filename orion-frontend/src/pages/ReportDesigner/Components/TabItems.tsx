import type { TabsProps } from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { ReportsTab } from '../ReportsTab';
import { DataSourcesTab } from '../DataSourcesTab';
import { SchedulesTab } from '../SchedulesTab';
import { ExecutionsTab } from '../ExecutionsTab';
import type { useReportDesignerState } from '../useReportDesignerState';

type State = ReturnType<typeof useReportDesignerState>;

const categoryOptions = [
  { value: 'operations', label: '运维报表' },
  { value: 'performance', label: '性能报表' },
  { value: 'business', label: '业务报表' },
  { value: 'security', label: '安全报表' },
  { value: 'custom', label: '自定义' },
];

interface Props {
  state: State;
}

export function buildTabItems({ state: s }: Props): TabsProps['items'] {
  return [
    {
      key: 'reports',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 6 }} />
          报表列表
        </span>
      ),
      children: (
        <ReportsTab
          reports={s.reports}
          loading={s.loading}
          categoryFilter={s.categoryFilter}
          onCategoryChange={s.setCategoryFilter}
          onRefresh={s.fetchReports}
          onCreate={s.handleCreateReport}
          handlePreviewReport={s.handlePreviewReport}
          handleExecuteReport={s.handleExecuteReport}
          handleEditReport={s.handleEditReport}
          handleDeleteReport={s.handleDeleteReport}
          categoryOptions={categoryOptions}
        />
      ),
    },
    {
      key: 'datasources',
      label: (
        <span>
          <DatabaseOutlined style={{ marginRight: 6 }} />
          数据源管理
        </span>
      ),
      children: (
        <DataSourcesTab
          datasources={s.datasources}
          loading={s.loading}
          onRefresh={s.fetchDatasources}
          onCreate={s.handleCreateDatasource}
          handleEditDatasource={s.handleEditDatasource}
          handleDeleteDatasource={s.handleDeleteDatasource}
        />
      ),
    },
    {
      key: 'schedules',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 6 }} />
          定时调度
        </span>
      ),
      children: (
        <SchedulesTab
          schedules={s.schedules}
          loading={s.loading}
          onRefresh={s.fetchSchedules}
          onCreate={s.handleCreateSchedule}
          handleEditSchedule={s.handleEditSchedule}
          handleDeleteSchedule={s.handleDeleteSchedule}
        />
      ),
    },
    {
      key: 'executions',
      label: (
        <span>
          <PlayCircleOutlined style={{ marginRight: 6 }} />
          执行历史
        </span>
      ),
      children: (
        <ExecutionsTab executions={s.executions} loading={s.loading} onRefresh={s.fetchExecutions} />
      ),
    },
  ];
}

export { categoryOptions };
