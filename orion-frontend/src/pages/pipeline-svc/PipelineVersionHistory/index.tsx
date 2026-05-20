/**
 * Pipeline Version History Page
 * 版本历史记录与对比,支持版本回滚、基线标记、版本对比。
 *
 * 样式已统一为 Design Token 规范。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tag, Modal, message, Empty } from 'antd';
import { spacing } from '@/tokens';
import { ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { pipelineVersionsApi, PipelineVersion } from '@/api/pipeline-versions';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import YamlDiffViewer from './YamlDiffViewer';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const PipelineVersionHistory: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{
    versionA: PipelineVersion | null;
    versionB: PipelineVersion | null;
  }>({ versionA: null, versionB: null });
  const [diffLoading, setDiffLoading] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const response = await pipelineVersionsApi.list(pipelineId);
      setVersions((response.data as PipelineVersion[]) || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载版本历史失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRollback = (version: PipelineVersion) => {
    Modal.confirm({
      title: '版本回滚',
      content: `确认回滚到版本 v${version.version}？此操作将修改当前 Pipeline 配置。`,
      okText: '确认回滚',
      cancelText: '取消',
      onOk: async () => {
        try {
          await pipelineVersionsApi.rollback(pipelineId!, version.id);
          message.success('回滚成功');
          loadVersions();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '回滚失败';
          message.error(msg);
        }
      },
    });
  };

  const handleSetBaseline = async (version: PipelineVersion) => {
    try {
      await pipelineVersionsApi.setBaseline(pipelineId!, version.id, !version.is_baseline);
      message.success(version.is_baseline ? '已取消基线' : '已设为基线');
      loadVersions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      message.error(msg);
    }
  };

  const handleDiff = async () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('请选择两个版本进行对比');
      return;
    }
    setDiffLoading(true);
    try {
      // 获取两个版本的完整数据 (包含 yaml_definition)
      const [vA, vB] = await Promise.all([
        pipelineVersionsApi.get(pipelineId!, selectedRowKeys[0] as string),
        pipelineVersionsApi.get(pipelineId!, selectedRowKeys[1] as string),
      ]);
      setDiffVersions({ versionA: vA, versionB: vB });
      setDiffModalVisible(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '版本对比失败';
      message.error(msg);
    } finally {
      setDiffLoading(false);
    }
  };

  const columns: TableColumn<PipelineVersion>[] = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          v{String(v)}
        </Tag>
      ),
    },
    {
      key: 'change_summary',
      title: '变更摘要',
      dataIndex: 'change_summary',
      ellipsis: true,
      render: (summary: unknown) =>
        (summary as string) || <Text type="secondary">无</Text>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: (tags: unknown) => (
        <Space wrap>
          {(tags as string[]).map((t) => (
            <Tag key={t} color="default">
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'is_baseline',
      title: '基线',
      dataIndex: 'is_baseline',
      width: 80,
      render: (isBaseline: unknown) =>
        isBaseline ? <StatusBadge status="success" size="small" /> : '-',
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      sortable: true,
      render: (date: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(date as string).fromNow()}
        </Text>
      ),
    },
    {
      key: 'created_by',
      title: '创建人',
      dataIndex: 'created_by',
      width: 120,
      render: (by: unknown) => <Text code>{(by as string) || '-'}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: PipelineVersion) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleRollback(record)}>
            回滚
          </Button>
          <Button type="link" size="small" onClick={() => handleSetBaseline(record)}>
            {record.is_baseline ? '取消基线' : '设为基线'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            版本历史
          </Title>
          <Text type="secondary">
            共 {versions.length} 个版本
            {selectedRowKeys.length === 2 && ' (已选 2 个版本)'}
          </Text>
        </div>
        <Space>
          <Button
            icon={<SwapOutlined />}
            onClick={handleDiff}
            disabled={selectedRowKeys.length !== 2}
            loading={diffLoading}
          >
            版本对比
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <CardPanel>
        {versions.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <Empty description="暂无版本记录" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={versions}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          />
        )}
      </CardPanel>

      <YamlDiffViewer
        yamlA={diffVersions.versionA?.yaml_definition || ''}
        yamlB={diffVersions.versionB?.yaml_definition || ''}
        versionA={diffVersions.versionA?.version?.toString() || ''}
        versionB={diffVersions.versionB?.version?.toString() || ''}
        visible={diffModalVisible}
        onClose={() => setDiffModalVisible(false)}
      />
    </div>
  );
};

export default PipelineVersionHistory;
