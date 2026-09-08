import { useMemo } from 'react';
import { Form } from 'antd';
import dayjs from 'dayjs';
import type { Sprint } from '@/api/sprints';
import type { useSprintBoardState } from './useSprintBoardState';
import { buildSprintColumns, buildBacklogColumns } from './SprintColumns';

type State = ReturnType<typeof useSprintBoardState>;

interface Props {
  state: State;
}

export function useSprintBoardForms({ state: s }: Props) {
  // Form instance owned here so SprintModal can use it and this wrapper can validateFields
  const [form] = Form.useForm();

  // ── Wrapper handlers that call form.validateFields() / setFieldsValue() ──

  const handleOpenCreate = () => {
    s.setEditingSprint(null);
    form.resetFields();
    s.setModalVisible(true);
  };

  const handleOpenEdit = (record: Sprint) => {
    s.setEditingSprint(record);
    form.setFieldsValue({
      name: record.name,
      goal: record.goal,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
      capacity: record.capacity,
      status: record.status,
    });
    s.setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await s.handleSave(values);
      form.resetFields();
    } catch {}
  };

  const sprintColumns = useMemo(
    () =>
      buildSprintColumns({
        handleActivate: s.handleActivate,
        handleComplete: s.handleComplete,
        handleEdit: handleOpenEdit,
        handleDelete: s.handleDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.handleActivate, s.handleComplete, s.handleDelete]
  );

  const backlogColumns = useMemo(
    () => buildBacklogColumns({ selectedSprintId: s.selectedSprintId, handleAddToSprint: s.handleAddToSprint }),
    [s.selectedSprintId, s.handleAddToSprint]
  );

  return {
    form,
    handleOpenCreate, handleOpenEdit, handleSave,
    sprintColumns, backlogColumns,
  };
}

export type SprintBoardForms = ReturnType<typeof useSprintBoardForms>;
