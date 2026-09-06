/**
 * 运维工具 - 系统配置 Tab (主题/许可证/模块/线程池)
 */
import React from 'react';
import { Card, Table, Button, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { licenseColumns, threadPoolColumns } from '../columns';
import type { TableColumnsType } from 'antd';
import type { ThemeConfig, LicenseInfo, SystemModule, ThreadPool } from '@/api/ops-tools';

interface ConfigTabProps {
  themeColumns: TableColumnsType<ThemeConfig>;
  themes: ThemeConfig[];
  themeLoading: boolean;
  onNewTheme: () => void;
  licenses: LicenseInfo[];
  moduleColumns: TableColumnsType<SystemModule>;
  modules: SystemModule[];
  moduleLoading: boolean;
  threadPools: ThreadPool[];
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  themeColumns,
  themes,
  themeLoading,
  onNewTheme,
  licenses,
  moduleColumns,
  modules,
  moduleLoading,
  threadPools,
}) => (
  <div>
    <Card
      title="主题管理"
      extra={
        <Button icon={<PlusOutlined />} onClick={onNewTheme}>
          新建主题
        </Button>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Table
        columns={themeColumns}
        dataSource={themes}
        loading={themeLoading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 5 }}
      />
    </Card>

    <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
      <Col span={12}>
        <Card title="许可证管理">
          <Table
            columns={licenseColumns}
            dataSource={licenses}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="系统模块">
          <Table
            columns={moduleColumns}
            dataSource={modules}
            loading={moduleLoading}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </Col>
    </Row>

    <Card title="线程池状态">
      <Table
        columns={threadPoolColumns}
        dataSource={threadPools}
        rowKey="name"
        size="middle"
        pagination={{ pageSize: 5 }}
      />
    </Card>
  </div>
);
