/**
 * useCITypeDesignerState.ts - CI Type Designer 状态 Hook
 * 抽取自 CITypeDesigner/index.tsx (P2-9 Phase 52)
 * 全部 state + 3 fetchers + 3 useEffects + 14 handlers (Type/Attr/Version/Validate)
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values/ID
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  listCITypes,
  getCIType,
  createCIType,
  updateCIType,
  deleteCIType,
  getCITypeAttributes,
  setCITypeAttributes,
  validateCIInstance,
  createCITypeVersion,
  getCITypeVersions,
  rollbackCIType,
  type CIType,
  type CIAttribute,
  type CITypeVersion,
  type CreateCITypeInput,
  type UpdateCITypeInput,
  type CreateCIAttributeInput,
} from '@/api/ci-types';

// ============================================================================
// Types
// ============================================================================

export interface SaveTypeInput {
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  category?: string;
}

export interface SaveAttrInput {
  attrKey?: string;
  displayName?: string;
  attrType?: string;
  required?: boolean;
  defaultValue?: string;
  options?: string;
  validationRule?: string;
  sortOrder?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export interface SaveValidateInput {
  instanceData: string;
}

// ============================================================================
// Helpers
// ============================================================================

const toInput = (a: CIAttribute): CreateCIAttributeInput => ({
  attrKey: a.attrKey,
  displayName: a.displayName ?? undefined,
  attrType: a.attrType ?? undefined,
  required: a.required,
  defaultValue: a.defaultValue ?? undefined,
  options: (() => {
    try {
      return JSON.parse(a.options || '[]');
    } catch {
      return [];
    }
  })(),
  validationRule: a.validationRule ?? undefined,
  sortOrder: a.sortOrder,
});

// ============================================================================
// Hook
// ============================================================================

export const useCITypeDesignerState = () => {
  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<string>('types');

  // --- Types state ---
  const [ciTypes, setCITypes] = useState<CIType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  // Type modal
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [typeConfirmLoading, setTypeConfirmLoading] = useState(false);
  const [editingType, setEditingType] = useState<CIType | null>(null);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<CIType | null>(null);

  // --- Attributes state ---
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [attributes, setAttributes] = useState<CIAttribute[]>([]);
  const [attrsLoading, setAttrsLoading] = useState(false);
  const [attrModalVisible, setAttrModalVisible] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CIAttribute | null>(null);

  // --- Versions state ---
  const [versionTypeId, setVersionTypeId] = useState<string | undefined>(undefined);
  const [versions, setVersions] = useState<CITypeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // --- Validation state ---
  const [validateModalVisible, setValidateModalVisible] = useState(false);
  const [validatingType, setValidatingType] = useState<CIType | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // ============================================================================
  // Fetchers
  // ============================================================================

  const fetchCITypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const res = await listCITypes({ category: categoryFilter });
      setCITypes(res.data ?? []);
    } catch {
      message.error('获取 CI 类型列表失败');
    } finally {
      setTypesLoading(false);
    }
  }, [categoryFilter]);

  const fetchAttributes = useCallback(async (typeId: string) => {
    setAttrsLoading(true);
    try {
      const res = await getCITypeAttributes(typeId);
      setAttributes(res.data ?? []);
    } catch {
      message.error('获取属性列表失败');
    } finally {
      setAttrsLoading(false);
    }
  }, []);

  const fetchVersions = useCallback(async (typeId: string) => {
    setVersionsLoading(true);
    try {
      const res = await getCITypeVersions(typeId);
      setVersions(res.data ?? []);
    } catch {
      message.error('获取版本历史失败');
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCITypes();
  }, [fetchCITypes]);

  useEffect(() => {
    if (selectedTypeId) {
      fetchAttributes(selectedTypeId);
    }
  }, [selectedTypeId, fetchAttributes]);

  useEffect(() => {
    if (versionTypeId) {
      fetchVersions(versionTypeId);
    }
  }, [versionTypeId, fetchVersions]);

  // ============================================================================
  // Type Handlers
  // ============================================================================

  const handleCreateType = () => {
    setEditingType(null);
    setTypeModalVisible(true);
  };

  const handleEditType = (record: CIType) => {
    setEditingType(record);
    setTypeModalVisible(true);
  };

  const handleSaveType = async (values: SaveTypeInput) => {
    setTypeConfirmLoading(true);
    try {
      if (editingType) {
        const input: UpdateCITypeInput = {
          displayName: values.displayName,
          description: values.description,
          icon: values.icon,
          category: values.category,
        };
        await updateCIType(editingType.id, input);
        message.success('CI 类型更新成功');
      } else {
        const input: CreateCITypeInput = {
          name: values.name as string,
          displayName: values.displayName,
          description: values.description,
          icon: values.icon,
          category: values.category,
        };
        await createCIType(input);
        message.success('CI 类型创建成功');
      }
      setTypeModalVisible(false);
      fetchCITypes();
    } catch {
      message.error('保存失败');
    } finally {
      setTypeConfirmLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    try {
      await deleteCIType(id);
      message.success('删除成功');
      fetchCITypes();
      if (selectedTypeId === id) {
        setSelectedTypeId(undefined);
        setAttributes([]);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewDetail = async (record: CIType) => {
    try {
      const res = await getCIType(record.id);
      setSelectedType(res.data);
      setDetailDrawerVisible(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  // ============================================================================
  // Attribute Handlers
  // ============================================================================

  const handleCreateAttr = () => {
    setEditingAttr(null);
    setAttrModalVisible(true);
  };

  const handleEditAttr = (record: CIAttribute) => {
    setEditingAttr(record);
    setAttrModalVisible(true);
  };

  const handleSaveAttr = async (values: SaveAttrInput) => {
    if (!selectedTypeId) return;
    try {
      const options = values.options
        ? (values.options as string)
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined;

      const newAttr: CreateCIAttributeInput = {
        attrKey: values.attrKey as string,
        displayName: values.displayName,
        attrType: values.attrType,
        required: values.required ?? false,
        defaultValue: values.defaultValue,
        options,
        validationRule: values.validationRule,
        sortOrder: values.sortOrder ?? 0,
      };

      let updatedAttrs: CreateCIAttributeInput[];
      if (editingAttr) {
        updatedAttrs = attributes.map((a) => (a.id === editingAttr.id ? newAttr : toInput(a)));
      } else {
        updatedAttrs = [...attributes.map(toInput), newAttr];
      }

      await setCITypeAttributes(selectedTypeId, updatedAttrs);
      message.success(editingAttr ? '属性更新成功' : '属性添加成功');
      setAttrModalVisible(false);
      fetchAttributes(selectedTypeId);
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteAttr = async (record: CIAttribute) => {
    if (!selectedTypeId) return;
    try {
      const remaining = attributes
        .filter((a) => a.id !== record.id)
        .map((a) => toInput(a));
      await setCITypeAttributes(selectedTypeId, remaining);
      message.success('属性删除成功');
      fetchAttributes(selectedTypeId);
    } catch {
      message.error('删除失败');
    }
  };

  // ============================================================================
  // Version Handlers
  // ============================================================================

  const handleCreateVersion = async () => {
    if (!versionTypeId) return;
    try {
      await createCITypeVersion(versionTypeId);
      message.success('版本快照创建成功');
      fetchVersions(versionTypeId);
    } catch {
      message.error('创建版本失败');
    }
  };

  const handleRollback = async (version: CITypeVersion) => {
    if (!versionTypeId) return;
    try {
      await rollbackCIType(versionTypeId, version.id);
      message.success(`已回滚到版本 ${version.version}`);
      fetchVersions(versionTypeId);
      fetchCITypes();
    } catch {
      message.error('回滚失败');
    }
  };

  // ============================================================================
  // Validation Handlers
  // ============================================================================

  const handleOpenValidate = (record: CIType) => {
    setValidatingType(record);
    setValidationResult(null);
    setValidateModalVisible(true);
  };

  const handleValidate = async (values: SaveValidateInput) => {
    if (!validatingType) return;
    try {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(values.instanceData);
      } catch {
        message.error('JSON 格式不正确');
        return;
      }
      const res = await validateCIInstance(validatingType.id, data);
      setValidationResult(res.data);
    } catch {
      message.error('校验请求失败');
    }
  };

  return {
    // Tab
    activeTab, setActiveTab,
    // Types
    ciTypes, setCITypes,
    typesLoading, setTypesLoading,
    categoryFilter, setCategoryFilter,
    typeModalVisible, setTypeModalVisible,
    typeConfirmLoading, setTypeConfirmLoading,
    editingType, setEditingType,
    detailDrawerVisible, setDetailDrawerVisible,
    selectedType, setSelectedType,
    // Attributes
    selectedTypeId, setSelectedTypeId,
    attributes, setAttributes,
    attrsLoading, setAttrsLoading,
    attrModalVisible, setAttrModalVisible,
    editingAttr, setEditingAttr,
    // Versions
    versionTypeId, setVersionTypeId,
    versions, setVersions,
    versionsLoading, setVersionsLoading,
    // Validation
    validateModalVisible, setValidateModalVisible,
    validatingType, setValidatingType,
    validationResult, setValidationResult,
    // Fetchers
    fetchCITypes,
    fetchAttributes,
    fetchVersions,
    // Type handlers
    handleCreateType,
    handleEditType,
    handleSaveType,
    handleDeleteType,
    handleViewDetail,
    // Attribute handlers
    handleCreateAttr,
    handleEditAttr,
    handleSaveAttr,
    handleDeleteAttr,
    // Version handlers
    handleCreateVersion,
    handleRollback,
    // Validation handlers
    handleOpenValidate,
    handleValidate,
  };
};
