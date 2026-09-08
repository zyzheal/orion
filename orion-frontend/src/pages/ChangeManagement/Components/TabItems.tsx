import type { TabsProps } from 'antd';
import { EyeOutlined, SwapOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import { RequestsTab } from '../RequestsTab';
import { ChangeDetailPanel } from '../ChangeDetailPanel';
import { RFCsTab } from '../RFCsTab';
import { CABsTab } from '../CABsTab';
import type { useChangeManagementState } from '../useChangeManagementState';
import type { useChangeFormWrappers } from '../useChangeFormWrappers';

type State = ReturnType<typeof useChangeManagementState>;
type Wrappers = ReturnType<typeof useChangeFormWrappers>;

interface Props {
  state: State;
  wrappers: Wrappers;
  changeColumns: any;
  rfcColumns: any;
  cabColumns: any;
}

export function buildTabItems(p: Props): TabsProps['items'] {
  const { state: s, wrappers: w, changeColumns, rfcColumns, cabColumns } = p;
  return [
    {
      key: 'requests',
      label: (
        <span>
          <SwapOutlined />
          变更请求
        </span>
      ),
      children: (
        <RequestsTab
          changes={s.changes}
          loading={s.loading}
          total={s.total}
          page={s.page}
          pageSize={s.pageSize}
          filterStatus={s.filterStatus}
          filterType={s.filterType}
          filterPriority={s.filterPriority}
          changeColumns={changeColumns}
          onFilterStatusChange={(v) => {
            s.setFilterStatus(v || undefined);
            s.setPage(1);
          }}
          onFilterTypeChange={(v) => {
            s.setFilterType(v || undefined);
            s.setPage(1);
          }}
          onFilterPriorityChange={(v) => {
            s.setFilterPriority(v || undefined);
            s.setPage(1);
          }}
          onRefresh={s.loadChanges}
          onCreate={w.openCreateModal}
          onPageChange={(pg, ps) => {
            s.setPage(pg);
            s.setPageSize(ps);
          }}
        />
      ),
    },
    {
      key: 'detail',
      label: (
        <span>
          <EyeOutlined />
          变更详情
        </span>
      ),
      children: (
        <ChangeDetailPanel
          change={s.selectedChange}
          detailLoading={s.detailLoading}
          riskLoading={s.riskLoading}
          riskAnalysis={s.riskAnalysis}
          timeline={s.timeline}
          timelineLoading={s.timelineLoading}
          onRiskAnalysis={s.handleRiskAnalysis}
          onEdit={w.handleOpenEditModalWrapper}
          onStatusChange={s.handleStatusChange}
          onAddEvent={w.openAddEventModal}
        />
      ),
    },
    {
      key: 'rfc',
      label: (
        <span>
          <FileTextOutlined />
          RFC 管理
        </span>
      ),
      children: (
        <RFCsTab
          rfcs={s.rfcs}
          rfcLoading={s.rfcLoading}
          rfcTotal={s.rfcTotal}
          rfcPage={s.rfcPage}
          pageSize={s.pageSize}
          rfcColumns={rfcColumns}
          onCreate={w.openRfcModal}
          onPageChange={s.setRfcPage}
        />
      ),
    },
    {
      key: 'cab',
      label: (
        <span>
          <TeamOutlined />
          CAB 会议
        </span>
      ),
      children: (
        <CABsTab
          cabMeetings={s.cabMeetings}
          cabLoading={s.cabLoading}
          cabTotal={s.cabTotal}
          cabPage={s.cabPage}
          pageSize={s.pageSize}
          cabColumns={cabColumns}
          onCreate={w.openCabModal}
          onPageChange={s.setCabPage}
        />
      ),
    },
  ];
}
