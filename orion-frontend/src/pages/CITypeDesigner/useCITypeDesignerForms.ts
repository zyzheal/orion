import { useEffect } from 'react';
import { Form } from 'antd';
import type { useCITypeDesignerState } from './useCITypeDesignerState';

type State = ReturnType<typeof useCITypeDesignerState>;

interface Props {
  state: State;
}

export function useCITypeDesignerForms({ state }: Props) {
  const {
    editingType, typeModalVisible,
    editingAttr, attrModalVisible,
    validatingType, validateModalVisible,
    handleSaveType, handleSaveAttr, handleValidate,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [typeForm] = Form.useForm();
  const [attrForm] = Form.useForm();
  const [validateForm] = Form.useForm();

  useEffect(() => {
    if (editingType) {
      typeForm.setFieldsValue({
        name: editingType.name,
        displayName: editingType.displayName,
        description: editingType.description,
        icon: editingType.icon,
        category: editingType.category,
      });
    } else {
      typeForm.resetFields();
    }
  }, [editingType, typeModalVisible, typeForm]);

  useEffect(() => {
    if (editingAttr) {
      attrForm.setFieldsValue({
        attrKey: editingAttr.attrKey,
        displayName: editingAttr.displayName,
        attrType: editingAttr.attrType,
        required: editingAttr.required,
        defaultValue: editingAttr.defaultValue,
        options: (() => {
          try {
            return JSON.parse(editingAttr.options || '[]').join('\n');
          } catch {
            return '';
          }
        })(),
        validationRule: editingAttr.validationRule,
        sortOrder: editingAttr.sortOrder,
      });
    } else {
      attrForm.resetFields();
      attrForm.setFieldsValue({ attrType: 'string', required: false, sortOrder: 0 });
    }
  }, [editingAttr, attrModalVisible, attrForm]);

  useEffect(() => {
    validateForm.resetFields();
  }, [validatingType, validateModalVisible, validateForm]);

  // ---- Form wrapper handlers (validateFields + call hook handler with values) ----
  const handleSaveTypeWrapper = async () => {
    try {
      const values = await typeForm.validateFields();
      await handleSaveType(values);
    } catch {
      // Form validation error - do nothing
    }
  };

  const handleSaveAttrWrapper = async () => {
    try {
      const values = await attrForm.validateFields();
      await handleSaveAttr(values);
    } catch {
      // Form validation error
    }
  };

  const handleValidateWrapper = async () => {
    try {
      const values = await validateForm.validateFields();
      await handleValidate(values);
    } catch {
      // Form validation error
    }
  };

  return {
    typeForm, attrForm, validateForm,
    handleSaveTypeWrapper, handleSaveAttrWrapper, handleValidateWrapper,
  };
}

export type CITypeDesignerForms = ReturnType<typeof useCITypeDesignerForms>;
