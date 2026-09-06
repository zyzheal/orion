/**
 * SchedulesTab.tsx - 定时调度 Tab
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 刷新/创建按钮 + 调度 Table (cron/export format/recipients)
 */
import React from 'react';
import { Card, Table, Button, Row, Col, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ReportSchedule } from '@/api/reports';
import { useScheduleColumns } from './ReportDesignerColumns';

interface SchedulesTabProps {
  schedules: ReportSchedule[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  handleEditSchedule: (r: ReportSchedule) => void;
  handleDeleteSchedule: (id: string) => void;
}

export const SchedulesTab: React.FC<SchedulesTabProps> = (props) => {
  const {
    schedules,
    loading,
    onRefresh,
    onCreate,
    handleEditSchedule,
    handleDeleteSchedule,
  } = props;

  const scheduleColumns = useScheduleColumns({ handleEditSchedule, handleDeleteSchedule });

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Row justify="space-between" style={{ marginBottom: spacing.md }}>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            创建调度
          </Button>
        </Col>
      </Row>
      <Table
        columns={scheduleColumns}
        dataSource={schedules}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无调度任务，点击上方按钮创建" /> }}
      />
    </Card>
  );
};

export default SchedulesTab;
