/**
 * FileUploadTab - 文件上传 Tab
 * 抽取自 BatchExecPage.tsx (P2-9 Phase 112)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  type TableProps,
  Button,
  Space,
  Input,
  Select,
  Upload,
  message,
  Empty,
  Typography,
} from 'antd';
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import {
  type UploadTask,
  uploadFile,
  listUploadTasks,
  cancelUploadTask,
} from '@/api/visor-exec';
import { spacing, colors } from '@/tokens';
import { buildUploadColumns } from '../BatchExecColumns';

const { Text } = Typography;

export const FileUploadTab: React.FC = () => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState('/tmp');

  const loadUploadTasks = () => {
    setLoading(true);
    listUploadTasks()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        setUploadTasks((data?.items ?? []) as UploadTask[]);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载上传任务失败：${msg}`);
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
    loadUploadTasks();
  }, []);

  const handleUpload = async (file: File) => {
    if (selectedHosts.length === 0) {
      message.warning('请先选择目标主机');
      return false;
    }
    try {
      const res = await uploadFile(file, selectedHosts, targetPath);
      const newTask = res.data as UploadTask;
      setUploadTasks((prev) => [newTask, ...prev]);
      message.success(`文件 ${file.name} 已开始上传`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`上传失败：${msg}`);
    }
    return false; // 阻止默认上传行为
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelUploadTask(id);
      setUploadTasks((prev) => prev.filter((t) => t.id !== id));
      message.info('上传任务已取消');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`取消失败：${msg}`);
    }
  };

  const uploadColumns: TableProps<UploadTask>['columns'] = buildUploadColumns({
    onCancel: handleCancel,
  });

  return (
    <div>
      {/* Upload Form */}
      <Card title="文件上传" size="small" style={{ marginBottom: spacing.md }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space>
            <Text>目标主机：</Text>
            <Select
              mode="multiple"
              style={{ width: 300 }}
              placeholder="选择目标主机..."
              value={selectedHosts}
              onChange={setSelectedHosts}
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Space>
          <Space>
            <Text>目标路径：</Text>
            <Input
              style={{ width: 300 }}
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/tmp"
            />
          </Space>
          <Upload.Dragger multiple beforeUpload={handleUpload} maxCount={10} showUploadList={false}>
            <p style={{ fontSize: 16 }}>
              <UploadOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
            </p>
            <Text type="secondary">点击或拖拽文件到此区域上传</Text>
          </Upload.Dragger>
        </Space>
      </Card>

      {/* Upload Tasks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text strong>上传任务列表</Text>
        <Button icon={<ReloadOutlined />} onClick={loadUploadTasks} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={uploadColumns}
        dataSource={uploadTasks}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无上传任务" /> }}
      />
    </div>
  );
};
