import { useEffect } from 'react';
import { Form } from 'antd';
import type { useReportDesignerState } from './useReportDesignerState';

type State = ReturnType<typeof useReportDesignerState>;

interface Props {
  state: State;
}

export function useReportDesignerForms({ state }: Props) {
  const {
    editingReport, reportModalVisible,
    editingDatasource, datasourceModalVisible,
    editingSchedule, scheduleModalVisible,
    handleSaveReport, handleSaveDatasource, handleSaveSchedule,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [reportForm] = Form.useForm();
  const [datasourceForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();

  useEffect(() => {
    if (editingReport) {
      reportForm.setFieldsValue({
        name: editingReport.name,
        description: editingReport.description,
        category: editingReport.category,
        enabled: editingReport.enabled,
      });
    } else {
      reportForm.resetFields();
    }
  }, [editingReport, reportModalVisible, reportForm]);

  useEffect(() => {
    if (editingDatasource) {
      datasourceForm.setFieldsValue({
        name: editingDatasource.name,
        type: editingDatasource.type,
        connectionConfig: JSON.stringify(editingDatasource.connectionConfig, null, 2),
        enabled: editingDatasource.enabled,
      });
    } else {
      datasourceForm.resetFields();
      datasourceForm.setFieldsValue({ type: 'sql', enabled: true });
    }
  }, [editingDatasource, datasourceModalVisible, datasourceForm]);

  useEffect(() => {
    if (editingSchedule) {
      scheduleForm.setFieldsValue({
        reportId: editingSchedule.reportId,
        cronExpression: editingSchedule.cronExpression,
        exportFormat: editingSchedule.exportFormat,
        recipients: editingSchedule.recipients.join(','),
        enabled: editingSchedule.enabled,
      });
    } else {
      scheduleForm.resetFields();
      scheduleForm.setFieldsValue({ exportFormat: 'pdf', enabled: true });
    }
  }, [editingSchedule, scheduleModalVisible, scheduleForm]);

  // ---- Form wrapper handlers (validateFields + resetFields + call hook handler) ----
  const handleSaveReportWrapper = async () => {
    try {
      const values = await reportForm.validateFields();
      await handleSaveReport(values);
    } catch {
      // Form validation error - do nothing
    }
  };

  const handleSaveDatasourceWrapper = async () => {
    try {
      const values = await datasourceForm.validateFields();
      await handleSaveDatasource(values);
    } catch {
      // Form validation error
    }
  };

  const handleSaveScheduleWrapper = async () => {
    try {
      const values = await scheduleForm.validateFields();
      await handleSaveSchedule(values);
    } catch {
      // Form validation error
    }
  };

  return {
    reportForm, datasourceForm, scheduleForm,
    handleSaveReportWrapper, handleSaveDatasourceWrapper, handleSaveScheduleWrapper,
  };
}

export type ReportDesignerForms = ReturnType<typeof useReportDesignerForms>;
