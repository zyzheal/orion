/**
 * ScriptVersions state hook
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { useState, useMemo } from 'react';
import { Form, Modal, message } from 'antd';
import {
  getScriptVersions,
  createScriptVersion,
  deleteScriptVersion,
  diffScriptVersions,
  type ScriptVersion,
  type ScriptVersionDiff,
} from '@/api/script-versions';

export const useScriptVersionsState = () => {
  const [loading, setLoading] = useState(false);
  const [scriptId, setScriptId] = useState('default-script');
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffData, setDiffData] = useState<ScriptVersionDiff | null>(null);
  const [diffV1, setDiffV1] = useState('');
  const [diffV2, setDiffV2] = useState('');
  const [form] = Form.useForm();

  const versionList = useMemo(() => versions.map((v) => v.version), [versions]);

  const loadVersions = async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const res = await getScriptVersions(scriptId);
      setVersions(res.data || []);
    } catch {
      message.error('加载版本列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleDelete = (record: ScriptVersion) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除版本 "${record.version}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteScriptVersion(scriptId, record.version);
          message.success('删除成功');
          loadVersions();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let parameters: Record<string, unknown> = {};
      if (values.parameters) {
        try {
          parameters =
            typeof values.parameters === 'string'
              ? JSON.parse(values.parameters)
              : values.parameters;
        } catch {
          message.error('Parameters 必须是合法 JSON');
          return;
        }
      }
      await createScriptVersion(scriptId, {
        version: values.version,
        content: values.content,
        parameters,
        changeDescription: values.changeDescription,
        createdBy: values.createdBy || 'system',
      });
      message.success('创建版本成功');
      setModalVisible(false);
      loadVersions();
    } catch {
      // validation failed
    }
  };

  const handleDiff = async () => {
    if (!diffV1 || !diffV2) {
      message.error('请选择两个版本进行对比');
      return;
    }
    try {
      const res = await diffScriptVersions(scriptId, diffV1, diffV2);
      setDiffData(res.data || null);
      message.success('对比完成');
    } catch {
      message.error('对比失败');
    }
  };

  const openDiff = () => {
    setDiffVisible(true);
    setDiffData(null);
    setDiffV1('');
    setDiffV2('');
  };

  const closeCreate = () => setModalVisible(false);
  const closeDiff = () => setDiffVisible(false);

  return {
    loading,
    scriptId,
    versions,
    modalVisible,
    diffVisible,
    diffData,
    diffV1,
    diffV2,
    form,
    versionList,
    setScriptId,
    setDiffV1,
    setDiffV2,
    loadVersions,
    handleCreate,
    handleDelete,
    handleSubmit,
    handleDiff,
    openDiff,
    closeCreate,
    closeDiff,
  };
};
