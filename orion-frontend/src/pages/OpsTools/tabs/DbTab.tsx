/**
 * 运维工具 - 数据库工具 Tab
 */
import React from 'react';
import { Card, Table, Button, Row, Col, Statistic, Typography } from 'antd';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { dumpColumns, fragmentColumns } from '../columns';
import type { TableColumnsType } from 'antd';
import type {
  SqlDumpResult,
  DatabaseFragment,
  IndexInfo,
} from '@/api/ops-tools';

const { Text } = Typography;

interface DbTabProps {
  dumps: SqlDumpResult[];
  fragments: DatabaseFragment[];
  indexes: IndexInfo[];
  dumpRunning: boolean;
  indexColumns: TableColumnsType<IndexInfo>;
  onSqlDump: () => void;
  onCreateIndex: () => void;
}

export const DbTab: React.FC<DbTabProps> = ({
  dumps,
  fragments,
  indexes,
  dumpRunning,
  indexColumns,
  onSqlDump,
  onCreateIndex,
}) => (
  <div>
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col span={8}>
        <Card hoverable style={{ height: '100%' }}>
          <Statistic
            title="最近 Dump"
            value={dumps[0]?.filename || '-'}
            valueStyle={{ color: colors.primary[500], fontSize: 14 }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={onSqlDump}
            loading={dumpRunning}
            style={{ marginTop: spacing.md }}
          >
            执行 SQL Dump
          </Button>
        </Card>
      </Col>
      <Col span={8}>
        <Card hoverable style={{ height: '100%' }}>
          <Statistic
            title="碎片表数"
            value={fragments.length}
            valueStyle={{ color: colors.warning[500] }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            建议检查碎片率超过 25% 的表
          </Text>
        </Card>
      </Col>
      <Col span={8}>
        <Card hoverable style={{ height: '100%' }}>
          <Statistic
            title="索引总数"
            value={indexes.length}
            valueStyle={{ color: colors.success[500] }}
          />
          <Button type="link" icon={<PlusOutlined />} onClick={onCreateIndex}>
            新建索引
          </Button>
        </Card>
      </Col>
    </Row>

    <Card title="SQL Dump 历史" style={{ marginBottom: spacing.md }}>
      <Table
        columns={dumpColumns}
        dataSource={dumps}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5 }}
      />
    </Card>

    <Card title="数据库碎片分析" style={{ marginBottom: spacing.md }}>
      <Table
        columns={fragmentColumns}
        dataSource={fragments}
        rowKey="id"
        size="small"
        pagination={false}
      />
    </Card>

    <Card title="索引管理">
      <Table
        columns={indexColumns}
        dataSource={indexes}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  </div>
);
