/**
 * 智能体可读的问题分析报告生成器
 * 包含详细的问题描述、原因分析、期望实现、可直接复制的代码
 * 优化版：与 ast-analyzer.ts 集成，生成更准确的报告
 */
import { FrontendInteractionAnalyzer, InteractionScanner } from './ast-analyzer';
import * as fs from 'fs';
import * as path from 'path';

const pagesDir = path.resolve(process.cwd(), 'orion-frontend/src/pages');
const outputDir = path.resolve(process.cwd(), 'docs/reports');

// 问题详细定义 - 智能体友好的修复指南
const ISSUE_DEFINITIONS: Record<string, {
  name: string;
  severity: 'P0' | 'P1';
  description: string;
  why: string;
  correctImplementation: string;
  fixTemplate: string;
  estimatedFixTime: string;
}> = {
  'missing-feedback': {
    name: '操作后缺少反馈提示',
    severity: 'P0',
    description: '异步操作完成后没有 message.success/error 提示',
    why: '用户不知道操作是成功还是失败，困惑系统是否正常工作',
    correctImplementation: `try {
  await api.submit(values);
  message.success('提交成功');
  // 刷新数据或导航
  loadData();
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : '提交失败';
  message.error(msg);
}`,
    fixTemplate: `1. 找到异步函数中的 try-catch 块
2. try 块成功时添加: message.success('操作成功')
3. catch 块添加: message.error(error.message || '操作失败')
4. 成功后执行刷新或导航`,
    estimatedFixTime: '1分钟/处',
  },
  'missing-loading': {
    name: '异步操作缺少 loading 状态',
    severity: 'P0',
    description: '异步操作（API调用）执行时没有显示 loading 状态',
    why: '用户点击按钮后无法感知操作正在进行，可能重复点击或认为系统卡死',
    correctImplementation: `const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.submit(values);
    message.success('提交成功');
  } catch (e) {
    message.error('提交失败');
  } finally {
    setLoading(false);
  }
};

// 按钮使用 loading
<Button loading={loading} onClick={handleSubmit}>提交</Button>`,
    fixTemplate: `1. 在组件顶部添加: const [loading, setLoading] = useState(false)
2. 异步函数开始: setLoading(true)
3. finally 块: setLoading(false)
4. 按钮添加: loading={loading} disabled={loading}`,
    estimatedFixTime: '2分钟/处',
  },
  'missing-empty': {
    name: '列表缺少空状态引导',
    severity: 'P0',
    description: '数据列表为空时没有 Empty 组件引导用户',
    why: '用户看到空白页面不知道是没有数据还是加载失败，也不知道如何添加数据',
    correctImplementation: `<Table
  columns={columns}
  dataSource={data}
  loading={loading}
  locale={{
    emptyText: (
      <Empty
        description="暂无数据"
        extra={<Button type="primary" onClick={handleCreate}>创建</Button>}
      />
    ),
  }}
/>`,
    fixTemplate: `1. 使用 antd Table 的 locale.emptyText 属性
2. 传入 <Empty description="暂无数据" />
3. 添加引导按钮: extra={<Button onClick={...}>创建</Button>}`,
    estimatedFixTime: '2分钟/处',
  },
  'missing-submit': {
    name: '表单缺少提交按钮',
    severity: 'P1',
    description: '表单没有提交按钮或提交逻辑',
    why: '用户填写完表单后无法保存数据',
    correctImplementation: `<Form form={form} onFinish={handleSave}>
  <Form.Item name="title" label="标题">
    <Input />
  </Form.Item>
  <Form.Item>
    <Button type="primary" htmlType="submit" loading={saving}>
      保存
    </Button>
  </Form.Item>
</Form>`,
    fixTemplate: `1. 确认 Form 的 onFinish 处理函数存在
2. 添加 <Button htmlType="submit"> 或 onClick={handleSave}
3. 按钮添加 loading 状态`,
    estimatedFixTime: '2分钟/处',
  },
  'missing-edit': {
    name: '详情页缺少编辑入口',
    severity: 'P1',
    description: '可编辑的详情页没有编辑入口',
    why: '用户无法修改已有数据',
    correctImplementation: `<Space>
  <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
    编辑
  </Button>
  <Button danger onClick={handleDelete}>删除</Button>
</Space>`,
    fixTemplate: `1. 在页面标题区域添加编辑按钮
2. 点击后切换为编辑模式或打开编辑 Drawer
3. 编辑模式使用 Form.Item + Input 替换 Descriptions`,
    estimatedFixTime: '5分钟/处',
  },
  'missing-network-error': {
    name: '缺少网络错误处理',
    severity: 'P0',
    description: '异步操作没有 try-catch 或 catch 中无错误提示',
    why: '网络失败时用户无感知，认为操作成功',
    correctImplementation: `try {
  await api.delete(id);
  message.success('删除成功');
} catch (error: unknown) {
  if (error instanceof Error) {
    message.error(\`网络错误: \${error.message}\`);
  } else {
    message.error('网络错误，请检查网络连接');
  }
}`,
    fixTemplate: `1. 用 try-catch 包裹 await 调用
2. catch 中判断 error instanceof Error
3. 显示友好的错误提示`,
    estimatedFixTime: '1分钟/处',
  },
  'missing-business-error': {
    name: 'catch 块缺少业务错误提示',
    severity: 'P0',
    description: 'catch 块为空或只 console.log，无用户可见提示',
    why: '业务失败但用户不知道，数据不一致',
    correctImplementation: `catch (error: unknown) {
  if (error instanceof Error) {
    message.error(\`操作失败: \${error.message}\`);
  } else {
    message.error('操作失败，请稍后重试');
  }
}`,
    fixTemplate: `1. 在 catch 块中添加 message.error
2. 优先显示后端返回的错误信息
3. 未知错误显示通用提示`,
    estimatedFixTime: '30秒/处',
  },
  'missing-permission-error': {
    name: '缺少权限不足错误处理',
    severity: 'P0',
    description: 'API 返回 403 但前端无处理',
    why: '无权限操作时用户不知道原因',
    correctImplementation: `catch (error: any) {
  if (error?.response?.status === 403) {
    message.error('您没有权限执行此操作');
  } else {
    message.error(error.message || '操作失败');
  }
}`,
    fixTemplate: `1. 在 catch 中检查 error.response.status === 403
2. 显示权限不足提示
3. 可引导用户申请权限`,
    estimatedFixTime: '1分钟/处',
  },
  'missing-timeout': {
    name: '缺少请求超时处理',
    severity: 'P0',
    description: 'API 请求没有 timeout 配置或超时错误处理',
    why: '请求长时间挂起，用户等待无响应',
    correctImplementation: `// 方式1: axios 配置
const res = await axios.get(url, { timeout: 10000 });

// 方式2: AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);
try {
  const res = await fetch(url, { signal: controller.signal });
} catch (error) {
  if (error.name === 'AbortError') {
    message.error('请求超时，请稍后重试');
  }
}`,
    fixTemplate: `1. 为 axios 请求配置 timeout: 10000
2. catch 中检测超时错误并提示`,
    estimatedFixTime: '2分钟/处',
  },
  'missing-undo': {
    name: '危险操作缺少确认机制',
    severity: 'P1',
    description: '删除等危险操作没有二次确认',
    why: '用户可能误点击导致数据丢失',
    correctImplementation: `<Popconfirm
  title="确认删除？"
  description="此操作不可撤销"
  onConfirm={handleDelete}
  okText="确认"
  cancelText="取消"
>
  <Button danger icon={<DeleteOutlined />}>删除</Button>
</Popconfirm>`,
    fixTemplate: `1. 用 <Popconfirm> 包裹危险按钮
2. title 写清楚操作后果
3. onConfirm 中执行删除`,
    estimatedFixTime: '1分钟/处',
  },
  'missing-skeleton': {
    name: '数据加载缺少骨架屏',
    severity: 'P1',
    description: '数据加载时页面空白',
    why: '加载体验差，用户以为页面出错',
    correctImplementation: `if (loading) {
  return (
    <Card>
      <Skeleton active paragraph={{ rows: 4 }} />
    </Card>
  );
}`,
    fixTemplate: `1. 在 loading 状态返回 <Skeleton>
2. 骨架样式与实际内容匹配
3. 添加 active 动画效果`,
    estimatedFixTime: '3分钟/处',
  },
  'missing-empty-search': {
    name: '搜索功能缺少空结果提示',
    severity: 'P1',
    description: '搜索无结果时页面空白',
    why: '用户不知道是没有匹配结果还是搜索失败',
    correctImplementation: `{searchResults.length === 0 && searchQuery && (
  <Empty
    description={\`未找到与"\${searchQuery}"相关的结果\`}
    extra={<Button onClick={resetSearch}>清除搜索</Button>}
  />
)}`,
    fixTemplate: `1. 在搜索结果为空时显示 <Empty>
2. description 中包含搜索关键词
3. 提供清除搜索的按钮`,
    estimatedFixTime: '2分钟/处',
  },
};

// AST issue type → checker ID mapping for report compatibility
const ISSUE_TYPE_TO_CHECKER_ID: Record<string, string> = {
  'missing-feedback': 'A2-02',
  'missing-loading': 'A2-12',
  'missing-empty': 'A2-14',
  'missing-submit': 'A2-15',
  'missing-edit': 'A2-16',
  'missing-network-error': 'A2-05',
  'missing-business-error': 'A2-06',
  'missing-permission-error': 'A2-07',
  'missing-timeout': 'A2-08',
  'missing-undo': 'A3-16',
  'missing-skeleton': 'A2-13',
  'missing-empty-search': 'A2-17',
};

async function generateSmartReport() {
  const dirs = fs.readdirSync(pagesDir).filter(d => {
    return fs.statSync(path.join(pagesDir, d)).isDirectory() && !d.startsWith('_');
  });

  // 收集问题 - 使用 AST 分析器
  const allIssues: Array<{
    module: string;
    file: string;
    line: number;
    code: string;
    type: string;
    message: string;
  }> = [];

  console.log('正在使用 AST 分析器深度扫描...\n');

  // 使用 InteractionScanner 扫描所有页面
  const scanner = new InteractionScanner(pagesDir);
  const results = await scanner.scan(200); // 最多扫描 200 个文件

  for (const issue of results) {
    if (issue.type in ISSUE_DEFINITIONS) {
      // 从文件路径提取模块名
      const relativePath = issue.file.replace(pagesDir + '/', '');
      const moduleName = relativePath.split('/')[0];

      // 尝试从源文件获取问题行附近的代码上下文
      let codeContext = '';
      try {
        const fileContent = fs.readFileSync(issue.file, 'utf-8');
        const lines = fileContent.split('\n');
        const startLine = Math.max(0, issue.line - 2);
        const endLine = Math.min(lines.length, issue.line + 3);
        codeContext = lines.slice(startLine, endLine).join('\n').trim();
      } catch {
        codeContext = issue.message || '';
      }

      allIssues.push({
        module: moduleName,
        file: path.basename(issue.file),
        line: issue.line,
        code: codeContext.substring(0, 120),
        type: issue.type,
        message: issue.message || ''
      });
    }
  }

  // 生成 Markdown 报告
  let md = `# Orion 前端功能缺失智能分析报告 (AST 深度分析)\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString()}\n`;
  md += `> 扫描页面目录: ${pagesDir}\n`;
  md += `> 发现问题: ${allIssues.length} 个\n\n`;

  // 问题统计
  const typeCount: Record<string, number> = {};
  for (const issue of allIssues) {
    typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;
  }

  md += `## 问题统计\n\n`;
  md += `| 问题类型 | Checker ID | 数量 | 严重性 |\n`;
  md += `|----------|------------|------|--------|\n`;
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    const def = ISSUE_DEFINITIONS[type] || { name: type, severity: 'P1' };
    const checkerId = ISSUE_TYPE_TO_CHECKER_ID[type] || '-';
    md += `| ${type} ${def.name} | ${checkerId} | ${count} | ${def.severity} |\n`;
  }

  // 每种问题的详细说明
  md += `\n## 问题详细说明与修复指南\n\n`;

  for (const [type, def] of Object.entries(ISSUE_DEFINITIONS)) {
    if (!typeCount[type]) continue;

    const issues = allIssues.filter(i => i.type === type);
    const modules = [...new Set(issues.map(i => i.module))];

    md += `### ${type}: ${def.name}\n\n`;
    md += `**严重性**: ${def.severity}\n\n`;
    md += `**问题描述**: ${def.description}\n\n`;
    md += `**为什么是问题**: ${def.why}\n\n`;
    md += `**涉及模块**: ${modules.join(', ')}\n\n`;
    md += `**正确实现示例**:\n`;
    md += `\`\`\`typescript\n${def.correctImplementation}\n\`\`\`\n\n`;
    md += `**修复步骤**:\n${def.fixTemplate}\n\n`;
    md += `---\n\n`;
  }

  // 各模块问题列表
  md += `## 各模块问题清单\n\n`;

  const moduleIssues: Record<string, typeof allIssues> = {};
  for (const issue of allIssues) {
    if (!moduleIssues[issue.module]) moduleIssues[issue.module] = [];
    moduleIssues[issue.module].push(issue);
  }

  for (const [module, issues] of Object.entries(moduleIssues).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
    md += `### ${module}\n\n`;
    md += `**问题数**: ${issues.length}\n\n`;

    // 按文件分组
    const fileIssues: Record<string, typeof issues> = {};
    for (const issue of issues) {
      if (!fileIssues[issue.file]) fileIssues[issue.file] = [];
      fileIssues[issue.file].push(issue);
    }

    for (const [file, fileIssueList] of Object.entries(fileIssues)) {
      md += `#### ${file}\n`;
      for (const issue of fileIssueList.slice(0, 5)) {
        const def = ISSUE_DEFINITIONS[issue.type] || { name: issue.type };
        const checkerId = ISSUE_TYPE_TO_CHECKER_ID[issue.type] || '';
        md += `- **${issue.type}**${checkerId ? ` (${checkerId})` : ''} (行${issue.line}): ${def.name}\n`;
        if (issue.message) {
          md += `  - ${issue.message}\n`;
        }
        if (issue.code) {
          md += `  \`\`\`typescript\n  ${issue.code}\n  \`\`\`\n`;
        }
      }
      if (fileIssueList.length > 5) {
        md += `- ...还有 ${fileIssueList.length - 5} 处\n`;
      }
      md += `\n`;
    }
  }

  // 保存 Markdown 报告
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.resolve(outputDir, 'smart-analysis-report.md');
  fs.writeFileSync(reportPath, md);
  console.log(`报告已保存: ${reportPath}\n`);

  // 保存 JSON 报告（供智能体程序化消费）
  const jsonReport = {
    generatedAt: new Date().toISOString(),
    scanDir: pagesDir,
    totalIssues: allIssues.length,
    stats: typeCount,
    issues: allIssues.map(i => ({
      type: i.type,
      checkerId: ISSUE_TYPE_TO_CHECKER_ID[i.type] || null,
      severity: ISSUE_DEFINITIONS[i.type]?.severity || 'P1',
      module: i.module,
      file: i.file,
      line: i.line,
      code: i.code,
      message: i.message,
      fixTemplate: ISSUE_DEFINITIONS[i.type]?.correctImplementation || '',
    })),
  };
  const jsonReportPath = path.resolve(outputDir, 'smart-analysis-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`JSON 报告已保存: ${jsonReportPath}\n`);

  // 控制台输出
  console.log(md);
}

generateSmartReport();
