/**
 * CI Type Designer Page
 *
 * Features:
 * - CI Type list with category filter and CRUD
 * - Attribute management for selected type
 * - Version history with rollback capability
 * - Instance data validation against type schema
 *
 * P2-9 Phase 52 重构:
 * - 全部 state + 3 fetchers + 14 handlers 抽入 useCITypeDesignerState.ts
 * - 3 表格列 builder + 常量 抽入 CITypeDesignerColumns.tsx
 * - 3 Tabs (types/attributes/versions) 各自抽成独立组件
 * - 主页面仅保留 layout + 3 Form.useForm + form setFieldsValue useEffects + form wrapper handlers
 */
import { useEffect } from 'react';
import { Typography, Tabs, Form } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useCITypeDesignerState } from './useCITypeDesignerState';
import {
  categoryOptions,
  attrTypeOptions,
  categoryColorMap,
} from './CITypeDesignerColumns';
import { TypesTab } from './TypesTab';
import { AttributesTab } from './AttributesTab';
import { VersionsTab } from './VersionsTab';
import { CITypeDesignerModals } from './CITypeDesignerModals';

const { Title } = Typography;

export default function CITypeDesignerPage() {
  const state = useCITypeDesignerState();
  const {
    activeTab,
    setActiveTab,
    ciTypes,
    setCITypes,
    typesLoading,
    setTypesLoading,
    categoryFilter,
    setCategoryFilter,
    typeModalVisible,
    setTypeModalVisible,
    typeConfirmLoading,
    setTypeConfirmLoading,
    editingType,
    setEditingType,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedType,
    setSelectedType,
    selectedTypeId,
    setSelectedTypeId,
    attributes,
    setAttributes,
    attrsLoading,
    setAttrsLoading,
    attrModalVisible,
    setAttrModalVisible,
    editingAttr,
    setEditingAttr,
    versionTypeId,
    setVersionTypeId,
    versions,
    setVersions,
    versionsLoading,
    setVersionsLoading,
    validateModalVisible,
    setValidateModalVisible,
    validatingType,
    setValidatingType,
    validationResult,
    setValidationResult,
    fetchCITypes,
    fetchAttributes,
    fetchVersions,
    handleCreateType,
    handleEditType,
    handleSaveType,
    handleDeleteType,
    handleViewDetail,
    handleCreateAttr,
    handleEditAttr,
    handleSaveAttr,
    handleDeleteAttr,
    handleCreateVersion,
    handleRollback,
    handleOpenValidate,
    handleValidate,
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

  const tabItems = [
    {
      key: 'types',
      label: '类型列表',
      children: (
        <TypesTab
          ciTypes={ciTypes}
          typesLoading={typesLoading}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          onRefresh={fetchCITypes}
          onCreate={handleCreateType}
          handleViewDetail={handleViewDetail}
          handleEditType={handleEditType}
          handleOpenValidate={handleOpenValidate}
          handleDeleteType={handleDeleteType}
        />
      ),
    },
    {
      key: 'attributes',
      label: '属性管理',
      children: (
        <AttributesTab
          ciTypes={ciTypes}
          selectedTypeId={selectedTypeId}
          onSelectType={setSelectedTypeId}
          attributes={attributes}
          attrsLoading={attrsLoading}
          onRefresh={() => (selectedTypeId ? fetchAttributes(selectedTypeId) : undefined)}
          onCreate={handleCreateAttr}
          handleEditAttr={handleEditAttr}
          handleDeleteAttr={handleDeleteAttr}
        />
      ),
    },
    {
      key: 'versions',
      label: '版本历史',
      children: (
        <VersionsTab
          ciTypes={ciTypes}
          versionTypeId={versionTypeId}
          onVersionTypeChange={setVersionTypeId}
          versions={versions}
          versionsLoading={versionsLoading}
          onRefresh={() => (versionTypeId ? fetchVersions(versionTypeId) : undefined)}
          onCreateVersion={handleCreateVersion}
          handleRollback={handleRollback}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        CI 类型管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <CITypeDesignerModals
        ciTypes={ciTypes}
        setCITypes={setCITypes}
        typesLoading={typesLoading}
        setTypesLoading={setTypesLoading}
        typeModalVisible={typeModalVisible}
        setTypeModalVisible={setTypeModalVisible}
        typeConfirmLoading={typeConfirmLoading}
        setTypeConfirmLoading={setTypeConfirmLoading}
        editingType={editingType}
        setEditingType={setEditingType}
        typeForm={typeForm}
        handleSaveType={handleSaveTypeWrapper}
        handleDeleteType={handleDeleteType}
        detailDrawerVisible={detailDrawerVisible}
        setDetailDrawerVisible={setDetailDrawerVisible}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedTypeId={selectedTypeId}
        setSelectedTypeId={setSelectedTypeId}
        attributes={attributes}
        setAttributes={setAttributes}
        attrsLoading={attrsLoading}
        setAttrsLoading={setAttrsLoading}
        attrModalVisible={attrModalVisible}
        setAttrModalVisible={setAttrModalVisible}
        editingAttr={editingAttr}
        setEditingAttr={setEditingAttr}
        attrForm={attrForm}
        handleSaveAttr={handleSaveAttrWrapper}
        handleDeleteAttr={handleDeleteAttr}
        versions={versions}
        setVersions={setVersions}
        versionsLoading={versionsLoading}
        setVersionsLoading={setVersionsLoading}
        validateModalVisible={validateModalVisible}
        setValidateModalVisible={setValidateModalVisible}
        validatingType={validatingType}
        setValidatingType={setValidatingType}
        validateForm={validateForm}
        validationResult={validationResult}
        setValidationResult={setValidationResult}
        handleValidate={handleValidateWrapper}
        handleCreateVersion={handleCreateVersion}
        handleRollback={handleRollback}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        versionTypeId={versionTypeId}
        setVersionTypeId={setVersionTypeId}
        categoryOptions={categoryOptions}
        attrTypeOptions={attrTypeOptions}
        categoryColorMap={categoryColorMap}
      />
    </div>
  );
}
