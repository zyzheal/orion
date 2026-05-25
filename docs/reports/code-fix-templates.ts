/**
 * Orion 前端代码质量修复模板
 * 包含 5 类问题的修复代码模板
 */

// ============ 1. Loading 状态修复模板 ============

/**
 * 模板 1: 添加 Loading 状态
 * 适用于: 缺少 loading 状态的问题
 */
export const loadingStateFixTemplate = `
// 修复前
const {lineNumber} {methodName} = async () => {
  const response = await api.call();
  // 处理响应
};

// 修复后
const [loading, setLoading] = useState(false);

const {methodName} = async () => {
  setLoading(true);
  try {
    const response = await api.call();
    // 处理响应
  } catch (error) {
    message.error('操作失败');
  } finally {
    setLoading(false);
  }
};

// Button 使用
<Button loading={loading} onClick={methodName}>
  提交
</Button>
`;

/**
 * 模板 2: Button 内联 loading
 * 适用于: 简单场景
 */
export const buttonLoadingFixTemplate = `
// 修复前
<Button onClick={handleSubmit}>提交</Button>

// 修复后
<Button onClick={async () => {
  setLoading(true);
  try {
    await handleSubmit();
    message.success('成功');
  } catch {
    message.error('失败');
  } finally {
    setLoading(false);
  }
}} loading={loading}>提交</Button>
`;


// ============ 2. 操作反馈修复模板 ============

/**
 * 模板 3: 添加成功/失败反馈
 * 适用于: 缺少操作反馈的问题
 */
export const feedbackFixTemplate = `
// 修复前
const handleSubmit = async () => {
  await api.save(data);
  // 无反馈
};

// 修复后
const handleSubmit = async () => {
  try {
    await api.save(data);
    message.success('保存成功');
  } catch (error) {
    message.error('保存失败: ' + error.message);
  }
};

// 或使用 Ant Design Form
form.onFinish = async (values) => {
  try {
    await api.save(values);
    message.success('保存成功');
    onSuccess?.();
  } catch (error) {
    message.error('保存失败: ' + error.message);
  }
};
`;


// ============ 3. 类型安全修复模板 ============

/**
 * 模板 4: 定义 API 响应类型
 * 适用于: as any 类型断言
 */
export const typeSafetyFixTemplate = `
// 修复前
const data = response.data as any;

// 修复后 - 定义类型
interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

// 使用
const response = await api.getUser();
const data = (response.data as ApiResponse<UserData>).data;

// 修复前 2
const result = data as any;

// 修复后 2 - 使用 unknown + 类型守卫
function isUserData(data: unknown): data is UserData {
  return typeof data === 'object' && data !== null && 'id' in data;
}

if (isUserData(data)) {
  console.log(data.id);
}
`;


// ============ 4. 表单提交按钮修复模板 ============

/**
 * 模板 5: 添加表单提交按钮
 * 适用于: 缺少提交按钮的问题
 */
export const formSubmitFixTemplate = `
// 修复前
<Form layout="vertical">
  <Form.Item label="名称" name="name">
    <Input />
  </Form.Item>
  {/* 无提交按钮 */}
</Form>

// 修复后
<Form layout="vertical" form={form} onFinish={onSubmit}>
  <Form.Item label="名称" name="name" rules={[{ required: true }]}>
    <Input />
  </Form.Item>

  <Form.Item>
    <Space>
      <Button type="primary" htmlType="submit" loading={loading}>
        提交
      </Button>
      <Button onClick={onCancel}>取消</Button>
    </Space>
  </Form.Item>
</Form>
`;

/**
 * 模板 6: Modal 表单提交
 */
export const modalFormFixTemplate = `
// 修复前
<Modal open={open} onCancel={onClose}>
  <Form>
    <Form.Item label="名称">
      <Input />
    </Form.Item>
  </Form>
</Modal>

// 修复后
<Modal
  open={open}
  onCancel={onClose}
  footer={[
    <Button key="cancel" onClick={onClose}>
      取消
    </Button>,
    <Button key="submit" type="primary" htmlType="submit" loading={loading}>
      确定
    </Button>,
  ]}
>
  <Form layout="vertical" form={form} onFinish={onSubmit}>
    <Form.Item label="名称" name="name" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
  </Form>
</Modal>
`;


// ============ 5. Design Token 修复模板 ============

/**
 * 模板 7: 使用 Design Token 替换硬编码颜色
 * 适用于: 硬编码颜色问题
 */
export const designTokenFixTemplate = `
// 修复前
<div style={{ color: '#3370E6' }}>主色文字</div>
<div style={{ color: '#52c41a' }}>成功文字</div>
<div style={{ color: '#f5222d' }}>错误文字</div>
<div style={{ background: '#ffffff' }}>白色背景</div>

// 修复后 - 导入 Design Token
import { colors, spacing, componentRadius } from '@/tokens';

// 使用 Token
<div style={{ color: colors.primary[500] }}>主色文字</div>
<div style={{ color: colors.success[500] }}>成功文字</div>
<div style={{ color: colors.error[500] }}>错误文字</div>
<div style={{ background: colors.light.bg.primary }}>白色背景</div>

// 修复前 2 - CSS 样式
<style>{`
  .primary { color: #3370E6; }
  .success { color: #52c41a; }
`}</style>

// 修复后 2 - 使用 Token
<style>{`
  .primary { color: ${colors.primary[500]}; }
  .success { color: ${colors.success[500]}; }
`}</style>
`;

/**
 * 模板 8: 使用 Design Token 替换硬编码间距
 */
export const spacingTokenFixTemplate = `
// 修复前
<div style={{ margin: '8px', padding: '16px' }}>内容</div>
<div style={{ marginBottom: '24px' }}>区块</div>

// 修复后
import { spacing } from '@/tokens';

<div style={{ margin: spacing.sm, padding: spacing.md }}>内容</div>
<div style={{ marginBottom: spacing.lg }}>区块</div>

// 常用对应关系
// spacing.xs = '4px'  → 极小间距
// spacing.sm = '8px'  → 小间距 (原 8px)
// spacing.md = '16px' → 中间距 (原 16px)
// spacing.lg = '24px' → 大间距 (原 24px)
`;

/**
 * 模板 9: 组件圆角 Token
 */
export const radiusTokenFixTemplate = `
// 修复前
<div style={{ borderRadius: '4px' }}>小圆角</div>
<div style={{ borderRadius: '8px' }}>中圆角</div>
<div style={{ borderRadius: '12px' }}>大圆角</div>

// 修复后
import { componentRadius } from '@/tokens';

<div style={{ borderRadius: componentRadius.button }}>按钮圆角</div>
<div style={{ borderRadius: componentRadius.card }}>卡片圆角</div>
<div style={{ borderRadius: componentRadius.modal }}>弹窗圆角</div>

// 常用对应关系
// componentRadius.button  = '6px'  → 按钮
// componentRadius.input   = '6px'  → 输入框
// componentRadius.card    = '12px' → 卡片
// componentRadius.modal   = '16px' → 弹窗
// componentRadius.tag     = '6px'  → 标签
// componentRadius.dropdown = '10px' → 下拉菜单
`;


// ============ 6. 修复自动化脚本 ============

/**
 * 批量修复脚本 - 缺少 loading 状态
 */
export const autoFixLoadingScript = `
// 脚本: 自动添加 loading 状态
// 使用方式: 运行脚本选择目标文件

import * as fs from 'fs';
import * as path from 'path';

function addLoadingState(filePath: string, methodName: string) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 1. 检查是否有 useState
  if (!content.includes('useState')) {
    // 添加 import
    const newContent = content.replace(
      "import React",
      "import React, { useState }"
    );
    fs.writeFileSync(filePath, newContent);
  }

  // 2. 在函数前添加 loading state
  const loadingState = \`const [loading, setLoading] = useState(false);\`;
  // ... 具体实现略
}

console.log('Loading 状态修复工具');
console.log('使用方法: node fix-loading.js <文件路径> <方法名>');
`;


// ============ 7. 详情页编辑入口模板 ============

/**
 * 模板 10: 详情页添加编辑按钮
 * 适用于: 缺少编辑入口的问题
 */
export const detailPageEditTemplate = `
// 修复前
const DetailPage = () => {
  return (
    <div>
      <Descriptions>
        <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
      </Descriptions>
    </div>
  );
};

// 修复后
const DetailPage = () => {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setEditing(!editing)}
        >
          {editing ? '取消编辑' : '编辑'}
        </Button>
      </Space>

      {editing ? (
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" initialValue={data.name}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSave}>
                保存
              </Button>
              <Button onClick={() => setEditing(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      ) : (
        <Descriptions>
          <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
        </Descriptions>
      )}
    </div>
  );
};
`;


// ============ 工具函数 ============

/**
 * 生成修复建议报告
 */
export function generateFixReport(issues: any[]): string {
  const byType = groupBy(issues, 'type');

  let report = '# 代码质量修复报告\n\n';

  report += '## 问题统计\n\n';
  for (const [type, list] of Object.entries(byType)) {
    report += `- ${getTypeName(type)}: ${list.length} 个\n`;
  }

  report += '\n## 修复建议\n\n';
  for (const [type, list] of Object.entries(byType)) {
    report += `### ${getTypeName(type)}\n\n`;
    report += getFixTemplate(type);
    report += '\n---\n';
  }

  return report;
}

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

function getTypeName(type: string): string {
  const names: Record<string, string> = {
    'missing-loading': '缺少 Loading 状态',
    'missing-feedback': '缺少操作反馈',
    'as-any': '类型断言 as any',
    'missing-submit': '缺少提交按钮',
    'missing-edit': '缺少编辑入口',
    'hardcoded-color': '硬编码颜色',
  };
  return names[type] || type;
}

function getFixTemplate(type: string): string {
  const templates: Record<string, string> = {
    'missing-loading': loadingStateFixTemplate,
    'missing-feedback': feedbackFixTemplate,
    'as-any': typeSafetyFixTemplate,
    'missing-submit': formSubmitFixTemplate,
    'missing-edit': detailPageEditTemplate,
    'hardcoded-color': designTokenFixTemplate,
  };
  return templates[type] || '// 未找到模板';
}