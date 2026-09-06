/**
 * constants.ts - DBA 状态/类型颜色映射
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import type { SqlOrder, DataSource } from '@/api/dba';

export const orderStatusColorMap: Record<SqlOrder['status'], string> = {
  pending: 'blue',
  approved: 'green',
  rejected: 'red',
  executing: 'orange',
  completed: 'cyan',
  failed: 'magenta',
};

export const orderStatusLabelMap: Record<SqlOrder['status'], string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  executing: '执行中',
  completed: '已完成',
  failed: '失败',
};

export const sqlTypeColorMap: Record<SqlOrder['type'], string> = {
  query: 'purple',
  insert: 'blue',
  update: 'orange',
  delete: 'red',
  ddl: 'cyan',
};

export const sqlTypeLabelMap: Record<SqlOrder['type'], string> = {
  query: '查询',
  insert: '插入',
  update: '更新',
  delete: '删除',
  ddl: 'DDL',
};

export const dbTypeLabelMap: Record<DataSource['type'], string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  mongodb: 'MongoDB',
};

export const orderStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '待审批', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '执行中', value: 'executing' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
];

export const sqlTypeOptions = [
  { label: '查询 (SELECT)', value: 'query' },
  { label: '插入 (INSERT)', value: 'insert' },
  { label: '更新 (UPDATE)', value: 'update' },
  { label: '删除 (DELETE)', value: 'delete' },
  { label: 'DDL (CREATE/ALTER/DROP)', value: 'ddl' },
];

export const dbTypeOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'Redis', value: 'redis' },
  { label: 'MongoDB', value: 'mongodb' },
];
