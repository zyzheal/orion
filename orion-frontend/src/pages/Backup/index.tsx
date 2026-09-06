/**
 * Backup Management Page
 * 数据备份与恢复管理
 * 8 文件拆分: types.ts + constants.tsx + useBackupState.ts + BackupColumns.tsx + ExpandedRow.tsx + index.tsx
 * 抽取自 705 行原始文件 (P2-9 Phase 68)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { useBackupState } from './useBackupState';
import { useBackupColumns } from './BackupColumns';
import { ExpandedRow } from './ExpandedRow';
import { typeLabelMap, filterDefs, formatSize } from './constants';
import type { BackupPlanItem } from './types';

const { Title, Text } = Typography;

const BackupManagement: React.FC = () => {
  const {
    loading,
    stats,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    restoreModalVisible,
    setRestoreModalVisible,
    selectedRecord,
    expandedRecords,
    submitting,
    loadData,
    loadStats,
    filteredData,
    handleCreate,
    handleExecute,
    handleDeletePlan,
    handleDeleteRecord,
    handleRestore,
    openRestore,
    toggleRecords,
  } = useBackupState();

  const [createForm] = Form.useForm();

  const columns = useBackupColumns({
    handleExecute,
    handleDeletePlan,
    toggleRecords,
    expandedRecords,
    submitting,
  });

  // Form wrapper: validateFields + delegate to hook handler
  const handleCreateWrapper = async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
      createForm.resetFields();
    } catch {
      // validation error - do nothing
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SaveOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Backup Management
          </Title>
          <Text type="secondary">数据备份与恢复</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建备份
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      {stats && (
        <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
          <Col span={6}>
            <MetricCard
              title="备份总数"
              value={stats.total}
              icon={<CloudServerOutlined style={{ fontSize: 20, color: colors.primary[500] }} />}
              color={colors.primary[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="成功"
              value={stats.successful}
              icon={<CheckCircleOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
              color={colors.success[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="失败"
              value={stats.failed}
              icon={<CloseCircleOutlined style={{ fontSize: 20, color: colors.error[500] }} />}
              color={colors.error[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="上次备份"
              value={stats.lastBackupTime ? dayjs(stats.lastBackupTime).fromNow() : '暂无数据'}
              icon={<ClockCircleOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
              color={colors.warning[500]}
            />
          </Col>
        </Row>
      )}

      {/* Plan List */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索计划名称..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          expandable={{
            expandedRowKeys: Object.keys(expandedRecords).filter((k) => expandedRecords[k]),
            expandedRowRender: (record: BackupPlanItem) => (
              <ExpandedRow
                records={expandedRecords[record.id] || []}
                openRestore={openRestore}
                handleDeleteRecord={handleDeleteRecord}
                planId={record.id}
              />
            ),
            expandRowByClick: true,
          }}
        />
      </Card>

      {/* Create Plan Modal */}
      <Modal
        title="创建备份计划"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateWrapper}
        confirmLoading={submitting}
        width={520}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
          >
            <Input placeholder="如: daily-db-backup" />
          </Form.Item>
          <Form.Item
            name="type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
            initialValue="full"
          >
            <Select>
              <Select.Option value="full">全量备份</Select.Option>
              <Select.Option value="incremental">增量备份</Select.Option>
              <Select.Option value="differential">差异备份</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="retentionDays"
            label="保留天数"
            initialValue={7}
            rules={[{ required: true, message: '请输入保留天数' }]}
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>
          <Form.Item name="schedule" label="Cron 调度表达式">
            <Input placeholder="如: 0 2 * * *（每天凌晨2点）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        title="确认恢复"
        open={restoreModalVisible}
        onCancel={() => setRestoreModalVisible(false)}
        onOk={handleRestore}
        confirmLoading={submitting}
        width={480}
      >
        {selectedRecord && (
          <div>
            <Alert
              message="恢复操作警告"
              description="恢复备份将覆盖当前数据。此操作不可逆，请确认后再执行。"
              type="warning"
              showIcon
              style={{ marginBottom: spacing.md }}
            />
            <Card size="small">
              <Space direction="vertical" size={8}>
                <div>
                  <Text type="secondary">备份 ID: </Text>
                  <Text strong>{selectedRecord.id}</Text>
                </div>
                <div>
                  <Text type="secondary">备份类型: </Text>
                  <Tag color="blue">{typeLabelMap[selectedRecord.type]}</Tag>
                </div>
                <div>
                  <Text type="secondary">创建时间: </Text>
                  <Text>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </div>
                <div>
                  <Text type="secondary">备份大小: </Text>
                  <Text>{formatSize(selectedRecord.size)}</Text>
                </div>
              </Space>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BackupManagement;
