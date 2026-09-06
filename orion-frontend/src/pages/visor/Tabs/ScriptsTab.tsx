/**
 * ScriptsTab.tsx - 脚本执行 Tab
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import React, { useMemo } from 'react';
import { Card, Form, Select, Input, Button, Modal, Descriptions, Tag, Typography } from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { Host, ScriptExecution } from '@/api/visor';
import type { ScriptFormValues } from '../useVisorState';
import { makeScriptColumns } from '../columns';
import { scriptStatusColorMap, scriptStatusLabelMap } from '../constants';

const { Text } = Typography;

interface ScriptsTabProps {
  hosts: Host[];
  scripts: ScriptExecution[];
  scriptLoading: boolean;
  scriptForm: ReturnType<typeof Form.useForm<ScriptFormValues>>[0];
  scriptExecuting: boolean;
  scriptResult: ScriptExecution | null;
  viewingResult: boolean;
  loadScripts: () => void;
  handleExecuteScript: () => void;
  handleViewScriptResult: (id: string) => void;
  closeScriptResult: () => void;
}

export const ScriptsTab: React.FC<ScriptsTabProps> = (props) => {
  const scriptColumns = useMemo(
    () => makeScriptColumns(props.handleViewScriptResult),
    [props.handleViewScriptResult]
  );

  return (
    <div>
      {/* Script Execution Form */}
      <Card title="执行脚本" size="small" style={{ marginBottom: spacing.md }}>
        <Form form={props.scriptForm} layout="vertical">
          <Form.Item
            name="hostId"
            label="目标主机"
            rules={[{ required: true, message: '请选择目标主机' }]}
          >
            <Select
              placeholder="选择主机..."
              options={props.hosts
                .filter((h) => h.status === 'online')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.id }))}
            />
          </Form.Item>
          <Form.Item
            name="script"
            label="脚本内容"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder={'#!/bin/bash\necho "Hello World"'}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={props.handleExecuteScript}
              loading={props.scriptExecuting}
            >
              执行脚本
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Script History */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={props.loadScripts} loading={props.scriptLoading}>
          刷新
        </Button>
      </div>
      <Table
        columns={scriptColumns}
        dataSource={props.scripts}
        loading={props.scriptLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Script Result Modal */}
      <Modal
        title="脚本执行结果"
        open={props.viewingResult}
        onCancel={props.closeScriptResult}
        footer={
          <Button onClick={props.closeScriptResult}>关闭</Button>
        }
        width={700}
      >
        {props.scriptResult && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="执行ID">{props.scriptResult.id.slice(0, 8)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={scriptStatusColorMap[props.scriptResult.status]}>
                  {scriptStatusLabelMap[props.scriptResult.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="退出码">
                {props.scriptResult.exitCode != null ? props.scriptResult.exitCode : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {props.scriptResult.startedAt || '-'}
              </Descriptions.Item>
            </Descriptions>
            {props.scriptResult.stdout && (
              <div style={{ marginBottom: spacing.sm }}>
                <Text strong>标准输出:</Text>
                <pre
                  style={{
                    background: colors.neutral[50],
                    padding: spacing[3],
                    borderRadius: 4,
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {props.scriptResult.stdout}
                </pre>
              </div>
            )}
            {props.scriptResult.stderr && (
              <div>
                <Text strong type="danger">
                  标准错误:
                </Text>
                <pre
                  style={{
                    background: colors.error[50],
                    padding: spacing[3],
                    borderRadius: 4,
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {props.scriptResult.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
