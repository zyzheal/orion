/**
 * 工作流画布表格列定义
 *
 * 从 WorkflowCanvas.tsx 中提取的表格列配置。
 * 由于列的 render 回调需要组件上下文，提供工厂函数创建列数组，
 * 将依赖项通过参数传入。
 */
import type { ColumnsType } from 'antd/es/table';
import { Button } from 'antd';
import { colors } from '@/tokens';

// ==================== 类型定义 ====================

export interface InputVariableMapping {
  sourceNode: string;
  sourceVar: string;
  localVar: string;
}

export interface OutputVariable {
  name: string;
  description: string;
}

export interface UpstreamNode {
  id: string;
  name: string;
}

// ==================== 输入变量映射表格列 ====================

/**
 * 创建输入变量映射表格的列定义
 * @param upstream 上游节点列表（用于渲染源节点名称）
 * @param onRemove 删除映射的回调（接收行索引）
 */
export const makeInputMappingColumns = (
  upstream: UpstreamNode[],
  onRemove: (index: number) => void,
): ColumnsType<InputVariableMapping> => [
  {
    title: '源节点',
    dataIndex: 'sourceNode',
    render: (nodeId: string) => {
      const node = upstream.find((n) => n.id === nodeId);
      return node ? `${node.name} (${nodeId})` : nodeId;
    },
  },
  { title: '源变量', dataIndex: 'sourceVar' },
  { title: '本地变量', dataIndex: 'localVar' },
  {
    title: '操作',
    render: (_: unknown, __: InputVariableMapping, index: number) => (
      <Button
        type="link"
        danger
        size="small"
        onClick={() => onRemove(index)}
      >
        删除
      </Button>
    ),
  },
];

// ==================== 输出变量表格列 ====================

/**
 * 创建输出变量表格的列定义
 * @param onRemove 删除变量的回调（接收行索引）
 */
export const makeOutputVariableColumns = (
  onRemove: (index: number) => void,
): ColumnsType<OutputVariable> => [
  { title: '变量名', dataIndex: 'name' },
  { title: '描述', dataIndex: 'description' },
  {
    title: '操作',
    render: (_: unknown, __: OutputVariable, index: number) => (
      <Button
        type="link"
        danger
        size="small"
        onClick={() => onRemove(index)}
      >
        删除
      </Button>
    ),
  },
];

// ==================== 共享样式 ====================

export const tableAddRowStyle = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
};

export const selectWidthMd = 150;
export const inputWidthSm = 120;

// 工具栏分隔线样式（用于画布无节点/有节点两种空状态）
export const toolbarDividerStyle = {
  padding: '12px 16px',
  borderBottom: `1px solid ${colors.neutral[200]}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const emptyContainerStyle = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const emptyColumnContainerStyle = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
};
