/**
 * Batch Command Execution for CMDB
 * 批量命令执行、执行历史、脚本模板、定时任务、文件上传
 *
 * 2026-05-19: 从 orion-visor-ui 批量执行模块迁移至 CMDB
 * 2026-05-20: 新增定时任务、文件上传 Tab
 * 2026-09-02: 提取列定义至 BatchExecColumns.tsx, 配置至 BatchExecConfig.tsx (P2-9)
 * 2026-08-26: 提取 4 Tab 组件至 Components/ (P2-9 Phase 112)
 */
import React, { useState, useEffect } from 'react';
import { Tabs, message } from 'antd';
import {
  PlayCircleOutlined,
  ScheduleOutlined,
  UploadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listCommandLogs } from '@/api/visor-exec';
import { type ExecRecord } from './BatchExecColumns';
import { BATCH_EXEC_TAB_KEYS, renderStatsRow } from './BatchExecConfig';
import { CommandExecTab } from './Components/CommandExecTab';
import { ScriptTemplateTab, type ScriptTemplate } from './Components/ScriptTemplateTab';
import { CronJobTab } from './Components/CronJobTab';
import { FileUploadTab } from './Components/FileUploadTab';

const BatchExecPage: React.FC = () => {
  const [execStats, setExecStats] = useState({ total: 0, success: 0, partial: 0, failed: 0 });
  // 跨 Tab 通信：脚本模板"使用"按钮填充命令表单
  const [pendingTemplateContent, setPendingTemplateContent] = useState<string | null>(null);
  const [pendingTemplateName, setPendingTemplateName] = useState<string | null>(null);

  const handleUseTemplate = (tpl: ScriptTemplate) => {
    setPendingTemplateContent(tpl.content);
    setPendingTemplateName(tpl.name);
    message.success(`已加载模板「${tpl.name}」到命令表单，请切换到"命令执行"Tab`);
  };

  useEffect(() => {
    listCommandLogs(1, 100)
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        const items = (data?.items ?? []) as ExecRecord[];
        setExecStats({
          total: items.length,
          success: items.filter((r) => r.status === 'success').length,
          partial: items.filter((r) => r.status === 'partial').length,
          failed: items.filter((r) => r.status === 'failed').length,
        });
      })
      .catch(() => {});
  }, []);

  const tabItems = [
    {
      key: BATCH_EXEC_TAB_KEYS.exec,
      label: (
        <span>
          <PlayCircleOutlined /> 命令执行
        </span>
      ),
      children: (
        <CommandExecTab
          pendingContent={pendingTemplateContent}
          pendingName={pendingTemplateName}
          onContentApplied={() => setPendingTemplateContent(null)}
        />
      ),
    },
    {
      key: BATCH_EXEC_TAB_KEYS.templates,
      label: (
        <span>
          <FileTextOutlined /> 脚本模板
        </span>
      ),
      children: <ScriptTemplateTab onUseTemplate={handleUseTemplate} />,
    },
    {
      key: BATCH_EXEC_TAB_KEYS.cron,
      label: (
        <span>
          <ScheduleOutlined /> 定时任务
        </span>
      ),
      children: <CronJobTab />,
    },
    {
      key: BATCH_EXEC_TAB_KEYS.upload,
      label: (
        <span>
          <UploadOutlined /> 文件上传
        </span>
      ),
      children: <FileUploadTab />,
    },
  ];

  return (
    <div>
      {renderStatsRow(execStats)}

      <Tabs defaultActiveKey="exec" items={tabItems} size="large" />
    </div>
  );
};

export default BatchExecPage;
