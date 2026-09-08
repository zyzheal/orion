/**
 * i18n Management Page
 *
 * Features:
 * - Locale management (create, list)
 * - Translation key-value management
 *
 * 拆分自 index.tsx (P2-9 Phase 197)
 */
import { useMemo } from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import { useI18nState } from './useI18nState';
import { buildLocaleColumns, buildTranslationColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { LocalesTab } from './Components/LocalesTab';
import { TranslationsTab } from './Components/TranslationsTab';
import { LocaleModal } from './Components/LocaleModal';
import { TranslationModal } from './Components/TranslationModal';

export default function I18nManagementPage() {
  const {
    locales,
    translations,
    loading,
    selectedLocale,
    setSelectedLocale,
    localeModalVisible,
    setLocaleModalVisible,
    translationModalVisible,
    setTranslationModalVisible,
    activeTab,
    setActiveTab,
    localeForm,
    translationForm,
    fetchLocales,
    fetchTranslations,
    handleCreateLocale,
    handleSetTranslation,
    handleDeleteTranslation,
    handleEditTranslation,
  } = useI18nState();

  const localeColumns = useMemo(() => buildLocaleColumns(), []);
  const translationColumns = useMemo(
    () => buildTranslationColumns({ onEdit: handleEditTranslation, onDelete: handleDeleteTranslation }),
    [handleEditTranslation, handleDeleteTranslation]
  );

  const translationEntries = Object.entries(translations).map(([key, value]) => ({ key, value }));

  const handleLocaleSelect = (code: string) => {
    setSelectedLocale(code);
    setActiveTab('translations');
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'locales',
            label: '语言管理',
            children: (
              <LocalesTab
                locales={locales}
                loading={loading}
                columns={localeColumns}
                onRefresh={fetchLocales}
                onAdd={() => setLocaleModalVisible(true)}
                onSelect={handleLocaleSelect}
              />
            ),
          },
          {
            key: 'translations',
            label: '翻译管理',
            children: (
              <TranslationsTab
                locales={locales}
                selectedLocale={selectedLocale}
                translations={translationEntries}
                loading={loading}
                columns={translationColumns}
                onLocaleChange={setSelectedLocale}
                onRefresh={fetchTranslations}
                onAdd={() => setTranslationModalVisible(true)}
              />
            ),
          },
        ]}
      />

      <LocaleModal
        open={localeModalVisible}
        form={localeForm}
        onOk={handleCreateLocale}
        onCancel={() => setLocaleModalVisible(false)}
      />

      <TranslationModal
        open={translationModalVisible}
        form={translationForm}
        onOk={handleSetTranslation}
        onCancel={() => setTranslationModalVisible(false)}
      />
    </div>
  );
}
