import type { TabsProps } from 'antd';
import { TypesTab } from '../TypesTab';
import { AttributesTab } from '../AttributesTab';
import { VersionsTab } from '../VersionsTab';
import type { useCITypeDesignerState } from '../useCITypeDesignerState';

type State = ReturnType<typeof useCITypeDesignerState>;

interface Props {
  state: State;
}

export function buildTabItems({ state: s }: Props): TabsProps['items'] {
  return [
    {
      key: 'types',
      label: '类型列表',
      children: (
        <TypesTab
          ciTypes={s.ciTypes}
          typesLoading={s.typesLoading}
          categoryFilter={s.categoryFilter}
          onCategoryChange={s.setCategoryFilter}
          onRefresh={s.fetchCITypes}
          onCreate={s.handleCreateType}
          handleViewDetail={s.handleViewDetail}
          handleEditType={s.handleEditType}
          handleOpenValidate={s.handleOpenValidate}
          handleDeleteType={s.handleDeleteType}
        />
      ),
    },
    {
      key: 'attributes',
      label: '属性管理',
      children: (
        <AttributesTab
          ciTypes={s.ciTypes}
          selectedTypeId={s.selectedTypeId}
          onSelectType={s.setSelectedTypeId}
          attributes={s.attributes}
          attrsLoading={s.attrsLoading}
          onRefresh={() => (s.selectedTypeId ? s.fetchAttributes(s.selectedTypeId) : undefined)}
          onCreate={s.handleCreateAttr}
          handleEditAttr={s.handleEditAttr}
          handleDeleteAttr={s.handleDeleteAttr}
        />
      ),
    },
    {
      key: 'versions',
      label: '版本历史',
      children: (
        <VersionsTab
          ciTypes={s.ciTypes}
          versionTypeId={s.versionTypeId}
          onVersionTypeChange={s.setVersionTypeId}
          versions={s.versions}
          versionsLoading={s.versionsLoading}
          onRefresh={() => (s.versionTypeId ? s.fetchVersions(s.versionTypeId) : undefined)}
          onCreateVersion={s.handleCreateVersion}
          handleRollback={s.handleRollback}
        />
      ),
    },
  ];
}
