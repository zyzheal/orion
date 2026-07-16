const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '../src/services');
const docsServicesDir = path.join(__dirname, '../../docs/services');

// 获取所有服务目录和文件
function getServiceEntries() {
  const entries = fs.readdirSync(servicesDir, { withFileTypes: true });
  const services = [];

  for (const entry of entries) {
    if (entry.name === '__tests__') continue;

    const fullPath = path.join(servicesDir, entry.name);
    if (entry.isDirectory()) {
      services.push({ name: entry.name, type: 'dir', path: fullPath });
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // 单文件服务（如 agent-profile-service.ts）
      const serviceName = entry.name.replace(/\.ts$/, '');
      services.push({ name: serviceName, type: 'file', path: fullPath });
    }
  }

  return services.sort((a, b) => a.name.localeCompare(b.name));
}

// 计算目录代码行数
function countLines(dir) {
  let total = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        total += content.split('\n').length;
      } catch (e) { /* skip */ }
    } else if (fs.statSync(filePath).isDirectory()) {
      total += countLines(filePath);
    }
  }
  return total;
}

// 获取目录下所有 ts 文件
function getTsFiles(dir) {
  let files = [];
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        files = files.concat(getTsFiles(fullPath));
      } else if (entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) { /* skip */ }
  return files;
}

// 检查单文件的代码行数
function countFileLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (e) {
    return 0;
  }
}

// 检查是否有 barrel export
function hasBarrelExport(servicePath, serviceType) {
  if (serviceType === 'file') {
    // 单文件服务没有 barrel export
    return false;
  }
  return fs.existsSync(path.join(servicePath, 'index.ts'));
}

// 检查是否有测试文件
function hasTest(servicePath, serviceName, serviceType) {
  if (serviceType === 'file') {
    // 检查同目录下是否有对应测试文件
    const testFile = path.join(servicesDir, `${serviceName}.test.ts`);
    return fs.existsSync(testFile);
  }
  // 检查目录下是否有 *.test.ts 或 *.spec.ts
  const tsFiles = getTsFiles(servicePath);
  return tsFiles.some(f => /\.(test|spec)\.ts$/.test(f));
}

// 检查是否有 PostgreSQL Repository
function hasPostgresRepo(servicePath, serviceName, serviceType) {
  const files = serviceType === 'file'
    ? [servicePath]
    : getTsFiles(servicePath);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      if (/Repository/.test(content) && /createQueryBuilder|query\(|pool\.query/.test(content)) {
        return true;
      }
      if (/extends\s+\w*Repository/.test(content)) {
        return true;
      }
      if (/postgres|PostgreSQL|pg\./i.test(content)) {
        return true;
      }
    } catch (e) { /* skip */ }
  }
  return false;
}

// 检查反模式
function checkAntipatterns(servicePath, serviceType) {
  const files = serviceType === 'file'
    ? [servicePath]
    : getTsFiles(servicePath);

  let hasConsoleWarn = false;
  let hasThrowNewError = false;
  let fileCount = 0;

  for (const file of files) {
    fileCount++;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      if (/console\.warn/.test(content)) hasConsoleWarn = true;
      if (/throw\s+new\s+Error\b/.test(content)) hasThrowNewError = true;
    } catch (e) { /* skip */ }
  }

  return { hasConsoleWarn, hasThrowNewError, fileCount };
}

// 检查是否有对应 docs 设计文档
function hasDesignDoc(serviceName) {
  // 检查 docs/services/ 下是否有对应目录或文件
  const docDir = path.join(docsServicesDir, serviceName);
  if (fs.existsSync(docDir)) {
    const files = fs.readdirSync(docDir);
    return files.filter(f => f.endsWith('.md')).length > 0;
  }

  // 检查是否有匹配的设计文档
  const docsDir = path.join(__dirname, '../../docs');
  try {
    const allDocs = fs.readdirSync(docsDir);
    const matched = allDocs.filter(f =>
      f.includes(serviceName) && f.endsWith('.md')
    );
    // 排除非设计文档
    return matched.filter(f =>
      !['README.md', 'INDEX.md'].includes(f)
    ).length > 0;
  } catch (e) {
    return false;
  }
}

// 主分析逻辑
function analyzeServices() {
  const services = getServiceEntries();
  const results = [];

  for (const service of services) {
    const lines = service.type === 'file'
      ? countFileLines(service.path)
      : countLines(service.path);

    const antipatterns = checkAntipatterns(service.path, service.type);
    const hasBarrel = hasBarrelExport(service.path, service.type);
    const hasTestFile = hasTest(service.path, service.name, service.type);
    const hasRepo = hasPostgresRepo(service.path, service.name, service.type);
    const hasDoc = hasDesignDoc(service.name);

    // 质量评级
    let grade = 'A';
    const issues = [];

    if (!hasBarrel && service.type === 'dir') {
      issues.push('缺少 barrel export');
    }
    if (!hasTestFile) {
      issues.push('无单元测试');
    }
    if (!hasRepo) {
      issues.push('未使用 PostgreSQL Repository');
    }
    if (antipatterns.hasConsoleWarn) {
      issues.push('存在 console.warn');
    }
    if (antipatterns.hasThrowNewError) {
      issues.push('存在 throw new Error');
    }

    if (issues.length >= 4) grade = 'D';
    else if (issues.length >= 3) grade = 'C';
    else if (issues.length >= 1) grade = 'B';

    results.push({
      name: service.name,
      type: service.type,
      fileCount: antipatterns.fileCount,
      lines,
      hasBarrel,
      hasTestFile,
      hasRepo,
      hasDoc,
      antipatterns,
      grade,
      issues
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// 生成报告
function generateReport(results) {
  const total = results.length;
  const analyzed = results.filter(r => r.hasDoc).length;
  const unanalyzed = total - analyzed;

  const noBarrel = results.filter(r => !r.hasBarrel).length;
  const noTest = results.filter(r => !r.hasTestFile).length;
  const noRepo = results.filter(r => !r.hasRepo).length;
  const noDoc = results.filter(r => !r.hasDoc).length;

  let report = '# 服务深度分析报告 (Task 4.65)\n\n';
  report += `生成时间: ${new Date().toISOString()}\n\n`;
  report += '---\n\n';

  report += '## 统计概览\n\n';
  report += `- **总服务数**: ${total}\n`;
  report += `- **有设计文档**: ${analyzed}\n`;
  report += `- **无设计文档**: ${unanalyzed} (${(unanalyzed/total*100).toFixed(1)}%)\n`;
  report += `- **缺少 barrel export**: ${noBarrel}\n`;
  report += `- **无单元测试**: ${noTest}\n`;
  report += `- **未使用 PostgreSQL Repository**: ${noRepo}\n\n`;

  report += '---\n\n';
  report += '## 未分析服务清单 (无设计文档)\n\n';

  const unanalyzedServices = results.filter(r => !r.hasDoc);
  if (unanalyzedServices.length === 0) {
    report += '所有服务均有对应设计文档。\n\n';
  } else {
    report += '| 服务名 | 类型 | 文件数 | 代码行数 | Repository | 测试 | 质量 | 主要问题 |\n';
    report += '|--------|------|--------|----------|------------|------|------|----------|\n';

    for (const s of unanalyzedServices) {
      const repoStatus = s.hasRepo ? '✅' : '❌';
      const testStatus = s.hasTestFile ? '✅' : '❌';
      const issuesStr = s.issues.length > 0 ? s.issues.join(', ') : '-';
      report += `| ${s.name} | ${s.type === 'dir' ? '目录' : '文件'} | ${s.fileCount} | ${s.lines} | ${repoStatus} | ${testStatus} | ${s.grade} | ${issuesStr} |\n`;
    }
  }

  report += '\n---\n\n';
  report += '## 有设计文档但实现不足的服务\n\n';

  const analyzedWithIssues = results.filter(r => r.hasDoc && r.issues.length > 0);
  if (analyzedWithIssues.length === 0) {
    report += '所有有设计文档的服务实现质量良好。\n\n';
  } else {
    report += '| 服务名 | 文件数 | 代码行数 | 质量 | 主要问题 |\n';
    report += '|--------|--------|----------|------|----------|\n';

    for (const s of analyzedWithIssues) {
      const issuesStr = s.issues.join(', ');
      report += `| ${s.name} | ${s.fileCount} | ${s.lines} | ${s.grade} | ${issuesStr} |\n`;
    }
  }

  report += '\n---\n\n';
  report += '## 关键发现\n\n';

  // Top 5 最需要关注的服务（按代码行数和问题数综合排序）
  const sortedByConcern = [...results].sort((a, b) => {
    const scoreA = a.lines + (a.issues.length * 1000);
    const scoreB = b.lines + (b.issues.length * 1000);
    return scoreB - scoreA;
  });

  report += '### 最需要关注的服务 (Top 5)\n\n';
  for (let i = 0; i < Math.min(5, sortedByConcern.length); i++) {
    const s = sortedByConcern[i];
    report += `${i + 1}. **${s.name}** (${s.lines} 行, ${s.issues.length} 个问题)\n`;
  }

  report += '\n### 共同问题模式\n\n';
  if (noBarrel > 0) report += `- ${noBarrel} 个服务缺少 barrel export，影响模块化引用\n`;
  if (noTest > 0) report += `- ${noTest} 个服务无单元测试，代码质量难以保证\n`;
  if (noRepo > 0) report += `- ${noRepo} 个服务未使用 PostgreSQL Repository，仍使用 Map 存储\n`;
  if (noDoc > 0) report += `- ${noDoc} 个服务无设计文档，架构决策未记录\n`;

  report += '\n### 建议的后续行动\n\n';
  report += '1. **优先级 P0**: 为代码行数 > 5000 且无 Repository 的服务添加 PostgreSQL 支持\n';
  report += '2. **优先级 P1**: 补充 barrel export，统一模块引用方式\n';
  report += '3. **优先级 P1**: 为核心服务补充单元测试\n';
  report += '4. **优先级 P2**: 为未分析服务补充设计文档\n';
  report += '5. **优先级 P2**: 消除 console.warn 和 throw new Error 反模式\n';

  return report;
}

// 执行分析
const results = analyzeServices();
const report = generateReport(results);

// 保存报告
const reportPath = path.join(__dirname, '../../docs/analysis/service-deep-analysis-2026-07-04.md');
fs.writeFileSync(reportPath, report);

console.log(`分析完成！共 ${results.length} 个服务`);
console.log(`报告已保存到: ${reportPath}`);

// 输出摘要
const unanalyzed = results.filter(r => !r.hasDoc);
console.log(`\n未分析服务: ${unanalyzed.length}`);
unanalyzed.slice(0, 10).forEach(s => {
  console.log(`  - ${s.name}: ${s.lines} 行, ${s.fileCount} 文件`);
});
