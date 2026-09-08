/**
 * I18nManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { useState, useEffect, useCallback } from 'react';
import { message, Form } from 'antd';
import {
  listLocales,
  createLocale,
  getTranslations,
  setTranslation,
  deleteTranslation,
  type I18nLocale,
} from '@/api/i18n';

export const useI18nState = () => {
  const [locales, setLocales] = useState<I18nLocale[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<string>('');
  const [localeModalVisible, setLocaleModalVisible] = useState(false);
  const [translationModalVisible, setTranslationModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('locales');
  const [localeForm] = Form.useForm();
  const [translationForm] = Form.useForm();

  const fetchLocales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLocales();
      setLocales(res.data ?? []);
      if (res.data?.length && !selectedLocale) {
        setSelectedLocale(res.data[0].code);
      }
    } catch {
      message.error('获取语言列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedLocale]);

  const fetchTranslations = useCallback(async () => {
    if (!selectedLocale) return;
    setLoading(true);
    try {
      const res = await getTranslations(selectedLocale);
      setTranslations(res.data ?? {});
    } catch {
      message.error('获取翻译失败');
    } finally {
      setLoading(false);
    }
  }, [selectedLocale]);

  useEffect(() => {
    fetchLocales();
  }, [fetchLocales]);

  useEffect(() => {
    if (selectedLocale) {
      fetchTranslations();
    }
  }, [selectedLocale, fetchTranslations]);

  const handleCreateLocale = async () => {
    try {
      const values = await localeForm.validateFields();
      await createLocale(values);
      message.success('语言创建成功');
      setLocaleModalVisible(false);
      localeForm.resetFields();
      fetchLocales();
    } catch {
      message.error('创建失败');
    }
  };

  const handleSetTranslation = async () => {
    try {
      const values = await translationForm.validateFields();
      await setTranslation({
        localeCode: selectedLocale,
        namespace: values.namespace ?? 'default',
        key: values.key,
        value: values.value,
      });
      message.success('翻译保存成功');
      setTranslationModalVisible(false);
      translationForm.resetFields();
      fetchTranslations();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteTranslation = async (key: string) => {
    try {
      const parts = key.split('.');
      const namespace = parts.length > 1 ? parts[0] : 'default';
      const actualKey = parts.length > 1 ? parts.slice(1).join('.') : key;
      await deleteTranslation(selectedLocale, namespace, actualKey);
      message.success('删除成功');
      fetchTranslations();
    } catch {
      message.error('删除失败');
    }
  };

  const handleEditTranslation = (key: string, value: string) => {
    translationForm.setFieldsValue({
      namespace: key.split('.').length > 1 ? key.split('.')[0] : 'default',
      key: key.split('.').length > 1 ? key.split('.').slice(1).join('.') : key,
      value,
    });
    setTranslationModalVisible(true);
  };

  return {
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
  };
};
