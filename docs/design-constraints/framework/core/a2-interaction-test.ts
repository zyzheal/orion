/**
 * A2 交互逻辑检测器测试
 * 验证新增的 10 项检测功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { FrontendInteractionAnalyzer, InteractionIssue } from './ast-analyzer';

// 测试用的示例代码
const testCases = {
  // 缺少网络错误处理
  missingNetworkError: `
import { useState } from 'react';
const Page = () => {
  const handleSave = async () => {
    const res = await saveApi(data);
    setData(res);
  };
  return <Button onClick={handleSave}>保存</Button>;
};
`,

  // 缺少业务错误提示
  missingBusinessError: `
const handleSubmit = async () => {
  try {
    await api.create(data);
  } catch (e) {
    console.log(e);
  }
};
`,

  // 缺少权限提示
  missingPermission: `
const loadData = async () => {
  const res = await userApi.getList();
  setList(res);
};
`,

  // 有完整错误处理的示例
  goodErrorHandling: `
const handleSave = async () => {
  try {
    const res = await api.update(data);
    message.success('保存成功');
  } catch (err: any) {
    if (err.response?.status === 403) {
      message.error('无权限操作');
    } else if (err.code === 'TIMEOUT') {
      message.error('请求超时，请重试');
    } else {
      message.error(err.message || '操作失败');
    }
  }
};
`,

  // 缺少乐观锁
  missingOptimisticLock: `
const EditPage = () => {
  const handleUpdate = async () => {
    await api.update({ id, name: newName });
  };
  return <Form><Input /></Form>;
};
`,

  // 有骨架屏
  goodSkeleton: `
const ListPage = () => {
  const { loading } = useRequest(getList);
  if (loading) return <Skeleton active />;
  return <List dataSource={data} />;
};
`,

  // 缺少空搜索结果
  missingEmptySearch: `
const SearchPage = () => {
  const handleSearch = (v) => setKeyword(v);
  return <Search onSearch={handleSearch} />;
};
`,

  // 有状态机
  goodStateMachine: `
import { useMachine } from '@xstate/react';
const Page = () => {
  const [state, send] = useMachine(workflowMachine);
  return <div>{state.value}</div>;
};
`,

  // 有动画
  goodAnimation: `
const ExpandPanel = () => {
  const [expanded, setExpanded] = useState(false);
  return <div style={{ transition: 'all 0.3s ease' }} />;
};
`,
};

async function runTests() {
  console.log('🧪 A2 交互逻辑检测器测试\n');

  const results: { name: string; issues: InteractionIssue[] }[] = [];

  // 创建临时测试文件并分析
  for (const [name, code] of Object.entries(testCases)) {
    const tempFile = path.join(__dirname, `test-${name}.tsx`);
    fs.writeFileSync(tempFile, code);

    try {
      const analyzer = new FrontendInteractionAnalyzer(tempFile);
      const result = analyzer.analyze();
      results.push({ name, issues: result.issues });
      console.log(`📄 ${name}:`);
      console.log(`   发现问题: ${result.issues.length} 个`);
      result.issues.forEach(issue => {
        console.log(`   - [${issue.severity}] ${issue.type}: ${issue.message}`);
        console.log(`     建议: ${issue.suggestion}`);
      });
      console.log('');
    } catch (e) {
      console.error(`❌ ${name}: 分析失败`, e);
    } finally {
      fs.unlinkSync(tempFile);
    }
  }

  // 汇总统计
  console.log('📊 测试结果汇总:');
  console.log('='.repeat(50));

  const typeCount: Record<string, number> = {};
  for (const { issues } of results) {
    for (const issue of issues) {
      typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(typeCount)) {
    console.log(`  ${type}: ${count} 个`);
  }

  // A2 覆盖率计算
  const allTypes = [
    'missing-feedback', 'missing-loading', 'missing-empty',
    'missing-submit', 'missing-edit', 'missing-state-machine',
    'missing-animation', 'missing-network-error', 'missing-business-error',
    'missing-permission-error', 'missing-timeout', 'missing-optimistic-lock',
    'missing-concurrent-edit', 'missing-undo', 'missing-skeleton',
    'missing-empty-search'
  ];

  const detectedTypes = Object.keys(typeCount);
  const coverage = (detectedTypes.length / allTypes.length * 100).toFixed(1);
  console.log(`\n✅ A2 检测覆盖率: ${coverage}% (${detectedTypes.length}/${allTypes.length})`);

  // P0 覆盖率
  const p0Types = ['missing-network-error', 'missing-business-error', 'missing-permission-error',
                   'missing-timeout', 'missing-optimistic-lock', 'missing-concurrent-edit'];
  const p0Detected = p0Types.filter(t => detectedTypes.includes(t));
  const p0Coverage = (p0Detected.length / p0Types.length * 100).toFixed(1);
  console.log(`✅ P0 检测覆盖率: ${p0Coverage}% (${p0Detected.length}/${p0Types.length})`);
}

// 运行测试
runTests().catch(console.error);