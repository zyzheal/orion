/**
 * useSLAFormHandlers.ts - SLA 表单处理 Hook
 * 抽取自 index.tsx (P2-9 Phase 238)
 */
import { useEffect } from 'react';
import { Form } from 'antd';
import { useSLAState } from './useSLAState';

export type SLAState = ReturnType<typeof useSLAState>;
type FormInstance = ReturnType<typeof Form.useForm>[0];

interface Props {
  state: SLAState;
  defForm: FormInstance;
  trackingForm: FormInstance;
}

export function useSLAFormHandlers({ state: s, defForm, trackingForm }: Props) {
  // Set/reset form fields when Def modal opens
  useEffect(() => {
    if (!s.defModalVisible) return;
    if (s.editingDef) {
      defForm.setFieldsValue({
        name: s.editingDef.name,
        description: s.editingDef.description,
        type: s.editingDef.type,
        target_value: s.editingDef.target_value,
        target_unit: s.editingDef.target_unit,
        business_hours_only: s.editingDef.business_hours_only,
        priority: s.editingDef.priority,
        category: s.editingDef.category,
      });
    } else {
      defForm.resetFields();
      defForm.setFieldsValue({ business_hours_only: false });
    }
  }, [s.defModalVisible, s.editingDef, defForm]);

  // Reset tracking form when modal opens
  useEffect(() => {
    if (s.trackingModalVisible) {
      trackingForm.resetFields();
    }
  }, [s.trackingModalVisible, trackingForm]);

  // Save definition wrapper: validateFields + handleSaveDefinition + resetFields
  const handleSaveDefinitionWrapper = async () => {
    try {
      const values = await defForm.validateFields() as any;
      await s.handleSaveDefinition(values);
      defForm.resetFields();
    } catch {
      // Form validation error
    }
  };

  // Create tracking wrapper: validateFields + handleCreateTracking + resetFields
  const handleCreateTrackingWrapper = async () => {
    try {
      const values = await trackingForm.validateFields() as any;
      await s.handleCreateTracking(values);
      trackingForm.resetFields();
    } catch {
      // Form validation error
    }
  };

  const handleOpenCreateTrackingModal = () => {
    s.setTrackingModalVisible(true);
  };

  return {
    handleSaveDefinitionWrapper,
    handleCreateTrackingWrapper,
    handleOpenCreateTrackingModal,
  };
}
