/**
 * WorkflowCanvas — 输入变量映射 & 输出变量 面板
 *
 * 从 WorkflowCanvas.tsx 抽离的两个 Table + 添加行 UI。
 * 列定义来自 WorkflowCanvasColumns.tsx（工厂函数模式）。
 */
import React from 'react';
import { Button, Form, Input, Select, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  makeInputMappingColumns,
  makeOutputVariableColumns,
  selectWidthMd,
  inputWidthSm,
  tableAddRowStyle,
  type InputVariableMapping,
  type OutputVariable,
  type UpstreamNode,
} from './WorkflowCanvasColumns';

const { Text } = Typography;

// ==================== 输入变量映射面板 ====================

interface InputVariableMappingPanelProps {
  visible: boolean;
  mappings: InputVariableMapping[];
  upstream: UpstreamNode[];
  newMappingSourceNode: string;
  newMappingSourceVar: string;
  newMappingLocalVar: string;
  setNewMappingSourceNode: (v: string) => void;
  setNewMappingSourceVar: (v: string) => void;
  setNewMappingLocalVar: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const InputVariableMappingPanel: React.FC<InputVariableMappingPanelProps> = (props) => {
  if (!props.visible) return null;

  return (
    <div>
      <Text strong>输入变量映射</Text>
      <Table
        size="small"
        dataSource={props.mappings}
        pagination={false}
        columns={makeInputMappingColumns(props.upstream, props.onRemove)}
      />
      <Form.Item>
        <div style={tableAddRowStyle}>
          <Select
            value={props.newMappingSourceNode}
            onChange={props.setNewMappingSourceNode}
            placeholder="源节点"
            style={{ width: selectWidthMd }}
            options={props.upstream.map((n) => ({ label: n.name, value: n.id }))}
          />
          <Input
            value={props.newMappingSourceVar}
            onChange={(e) => props.setNewMappingSourceVar(e.target.value)}
            placeholder="源变量"
            style={{ width: inputWidthSm }}
          />
          <Input
            value={props.newMappingLocalVar}
            onChange={(e) => props.setNewMappingLocalVar(e.target.value)}
            placeholder="本地变量"
            style={{ width: inputWidthSm }}
          />
          <Button icon={<PlusOutlined />} onClick={props.onAdd}>
            添加
          </Button>
        </div>
      </Form.Item>
    </div>
  );
};

// ==================== 输出变量面板 ====================

interface OutputVariablesPanelProps {
  variables: OutputVariable[];
  newOutputName: string;
  newOutputDesc: string;
  setNewOutputName: (v: string) => void;
  setNewOutputDesc: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const OutputVariablesPanel: React.FC<OutputVariablesPanelProps> = (props) => (
  <div>
    <Text strong>输出变量</Text>
    <Table
      size="small"
      dataSource={props.variables}
      pagination={false}
      columns={makeOutputVariableColumns(props.onRemove)}
    />
    <Form.Item>
      <div style={tableAddRowStyle}>
        <Input
          value={props.newOutputName}
          onChange={(e) => props.setNewOutputName(e.target.value)}
          placeholder="变量名"
          style={{ width: selectWidthMd }}
        />
        <Input
          value={props.newOutputDesc}
          onChange={(e) => props.setNewOutputDesc(e.target.value)}
          placeholder="描述"
          style={{ width: selectWidthMd }}
        />
        <Button icon={<PlusOutlined />} onClick={props.onAdd}>
          添加
        </Button>
      </div>
    </Form.Item>
  </div>
);
