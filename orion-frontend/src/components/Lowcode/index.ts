/**
 * @orion-lc-ui — Low-Code UI Component Library
 * 低代码平台 UI 组件库，统一导出所有 workflow designer 组件
 */

export { default as NodePalette } from './NodePalette';
export type { NodePaletteProps } from './NodePalette';

export { default as NodeProperties } from './NodeProperties';
export type { NodePropertiesProps } from './NodeProperties';

export { default as WorkflowCanvas } from './WorkflowCanvas';
export type { WorkflowCanvasProps } from './WorkflowCanvas';

export { default as ApprovalNode } from './ApprovalNode';

export type {
  WorkflowCanvasNode,
  WorkflowCanvasEdge,
  WorkflowCanvasData,
  WorkflowNodeType,
  NodeTypeInfo,
  ApprovalMode,
  ApproverType,
  TimeoutAction,
  ApproverConfig,
  TimeoutConfig,
  ApprovalNodeConfig,
  ApprovalNodeStatus,
} from './types';

export {
  nodeTypeConfig,
  approvalModeLabels,
  approvalModeShortLabels,
  timeoutActionLabels,
  approverTypeLabels,
  defaultApprovalNodeConfig,
  createDefaultNodeConfig,
} from './types';
