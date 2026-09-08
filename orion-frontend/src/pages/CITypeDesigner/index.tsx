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
 *
 * P2-9 Phase 257 重构: 289 -> 90 行 (-69%), 新增:
 *   useCITypeDesignerForms.ts  — 3 Form.useForm + 3 useEffect + 3 wrapper handlers
 *   Components/TabItems.tsx    — 3 tabs items (types/attributes/versions)
 */
import { Typography, Tabs } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useCITypeDesignerState } from './useCITypeDesignerState';
import { useCITypeDesignerForms } from './useCITypeDesignerForms';
import {
  categoryOptions,
  attrTypeOptions,
  categoryColorMap,
} from './CITypeDesignerColumns';
import { CITypeDesignerModals } from './CITypeDesignerModals';
import { buildTabItems } from './Components/TabItems';

const { Title } = Typography;

export default function CITypeDesignerPage() {
  const state = useCITypeDesignerState();
  const {
    typeForm, attrForm, validateForm,
    handleSaveTypeWrapper, handleSaveAttrWrapper, handleValidateWrapper,
  } = useCITypeDesignerForms({ state });

  const tabItems = buildTabItems({ state });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        CI 类型管理
      </Title>

      <Tabs activeKey={state.activeTab} onChange={state.setActiveTab} items={tabItems} />

      <CITypeDesignerModals
        ciTypes={state.ciTypes}
        setCITypes={state.setCITypes}
        typesLoading={state.typesLoading}
        setTypesLoading={state.setTypesLoading}
        typeModalVisible={state.typeModalVisible}
        setTypeModalVisible={state.setTypeModalVisible}
        typeConfirmLoading={state.typeConfirmLoading}
        setTypeConfirmLoading={state.setTypeConfirmLoading}
        editingType={state.editingType}
        setEditingType={state.setEditingType}
        typeForm={typeForm}
        handleSaveType={handleSaveTypeWrapper}
        handleDeleteType={state.handleDeleteType}
        detailDrawerVisible={state.detailDrawerVisible}
        setDetailDrawerVisible={state.setDetailDrawerVisible}
        selectedType={state.selectedType}
        setSelectedType={state.setSelectedType}
        selectedTypeId={state.selectedTypeId}
        setSelectedTypeId={state.setSelectedTypeId}
        attributes={state.attributes}
        setAttributes={state.setAttributes}
        attrsLoading={state.attrsLoading}
        setAttrsLoading={state.setAttrsLoading}
        attrModalVisible={state.attrModalVisible}
        setAttrModalVisible={state.setAttrModalVisible}
        editingAttr={state.editingAttr}
        setEditingAttr={state.setEditingAttr}
        attrForm={attrForm}
        handleSaveAttr={handleSaveAttrWrapper}
        handleDeleteAttr={state.handleDeleteAttr}
        versions={state.versions}
        setVersions={state.setVersions}
        versionsLoading={state.versionsLoading}
        setVersionsLoading={state.setVersionsLoading}
        validateModalVisible={state.validateModalVisible}
        setValidateModalVisible={state.setValidateModalVisible}
        validatingType={state.validatingType}
        setValidatingType={state.setValidatingType}
        validateForm={validateForm}
        validationResult={state.validationResult}
        setValidationResult={state.setValidationResult}
        handleValidate={handleValidateWrapper}
        handleCreateVersion={state.handleCreateVersion}
        handleRollback={state.handleRollback}
        activeTab={state.activeTab}
        setActiveTab={state.setActiveTab}
        categoryFilter={state.categoryFilter}
        setCategoryFilter={state.setCategoryFilter}
        versionTypeId={state.versionTypeId}
        setVersionTypeId={state.setVersionTypeId}
        categoryOptions={categoryOptions}
        attrTypeOptions={attrTypeOptions}
        categoryColorMap={categoryColorMap}
      />
    </div>
  );
}
