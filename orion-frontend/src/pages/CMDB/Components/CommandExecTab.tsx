/**
 * CommandExecTab - 命令执行 Tab
 * 抽取自 BatchExecPage.tsx (P2-9 Phase 112)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  type TableProps,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  Descriptions,
  Drawer,
  message,
  Empty,
  Typography,
} from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import { executeCommand, listCommandLogs } from '@/api/visor-exec';
import { spacing, colors } from '@/tokens';
import { type ExecRecord, buildExecColumns } from '../BatchExecColumns';
import { EXEC_STATUS_COLOR_MAP, EXEC_STATUS_LABEL_MAP } from '../BatchExecConfig';

const { Text } = Typography;
const { TextArea } = Input;

export const CommandExecTab: React.FC<{
  pendingContent?: string | null;
  pendingName?: string | null;
  onContentApplied?: () => void;
}> = ({ pendingContent, pendingName, onContentApplied }) => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [execRecords, setExecRecords] = useState<ExecRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingResult, setViewingResult] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExecRecord | null>(null);
  const [form] = Form.useForm();

  const loadRecords = () => {
    setLoading(true);
    listCommandLogs(1, 50)
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        const items = (data?.items ?? []) as ExecRecord[];
        setExecRecords(items);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载执行记录失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts(res.data ?? []))
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载主机列表失败：${msg}`);
        setHosts([]);
      });
    loadRecords();
  }, []);

  // 应用从脚本模板 Tab 加载的内容
  useEffect(() => {
    if (pendingContent) {
      form.setFieldsValue({ command: pendingContent });
      message.success(`已应用模板「${pendingName || '未知'}」到命令表单`);
      onContentApplied?.();
    }
  }, [pendingContent, pendingName, form, onContentApplied]);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const res = await executeCommand({
        command: values.command,
        hostIds: values.hosts,
      });
      const result = res.data as ExecRecord;
      setExecRecords((prev) => [result, ...prev]);
      message.success(`命令已提交到 ${values.hosts.length} 台主机`);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`执行失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const execColumns: TableProps<ExecRecord>['columns'] = buildExecColumns({
    onViewResult: (record) => {
      setSelectedRecord(record);
      setViewingResult(true);
    },
  });

  return (
    <div>
      <Card title="执行命令" size="small" style={{ marginBottom: spacing.md }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="hosts"
            label="目标主机"
            rules={[{ required: true, message: '请选择目标主机' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择主机（可多选）..."
              maxTagCount="responsive"
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Form.Item>
          <Form.Item
            name="command"
            label="命令"
            rules={[{ required: true, message: '请输入要执行的命令' }]}
          >
            <TextArea
              rows={4}
              placeholder="$ 输入要执行的命令，如: df -h"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={submitting}
            >
              执行命令
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={loadRecords} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={execColumns}
        dataSource={execRecords}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无执行记录，请先执行命令" /> }}
      />

      <Drawer
        title="执行结果"
        placement="right"
        width={700}
        open={viewingResult}
        onClose={() => {
          setViewingResult(false);
          setSelectedRecord(null);
        }}
      >
        {selectedRecord && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="执行ID">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={EXEC_STATUS_COLOR_MAP[selectedRecord.status]}>
                  {EXEC_STATUS_LABEL_MAP[selectedRecord.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标主机" span={2}>
                <Space wrap>
                  {selectedRecord.hostnames.map((name, i) => (
                    <Tag key={String(i)}>{name}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="命令" span={2}>
                <Text code>{selectedRecord.command}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{selectedRecord.startTime}</Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedRecord.endTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="操作人">{selectedRecord.operator}</Descriptions.Item>
            </Descriptions>

            {selectedRecord.output && (
              <div style={{ marginBottom: spacing.md }}>
                <Text strong>标准输出:</Text>
                <pre
                  style={{
                    background: colors.neutral[50],
                    padding: spacing[3],
                    borderRadius: 6,
                    fontSize: 12,
                    maxHeight: 300,
                    overflow: 'auto',
                    marginTop: spacing.sm,
                  }}
                >
                  {selectedRecord.output}
                </pre>
              </div>
            )}
            {selectedRecord.errorOutput && (
              <div>
                <Text strong type="danger">
                  标准错误:
                </Text>
                <pre
                  style={{
                    background: colors.error[50],
                    padding: spacing[3],
                    borderRadius: 6,
                    fontSize: 12,
                    maxHeight: 300,
                    overflow: 'auto',
                    marginTop: spacing.sm,
                  }}
                >
                  {selectedRecord.errorOutput}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
