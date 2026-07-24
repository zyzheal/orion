#!/usr/bin/env npx ts-node

/**
 * 批量导入本地文档到 PandaWiki
 * 用法: npx ts-node scripts/import-docs-to-pandawiki.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PANDAWIKI_API = 'http://localhost:8090';
const KB_ID = 'kb-orion-design';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3Nzk0NjAyOTAsImlkIjoiYWRtaW4tMDAxIn0.7ivWARN91cSQOqMOUri1u71QAUBsXSBHOjf4300AxfU';

const DOCS_DIR = '/Users/heal/orion-design/docs';

// 目录到分类的映射
const CATEGORY_MAP: Record<string, string> = {
  'architecture': '架构设计',
  'frontend': '前端设计',
  'services': '后端服务',
  'superpowers': 'AI 能力',
  'review': '设计评审',
  'ai': 'AI 集成',
  'sre': '可观测性',
  'security': '安全设计',
  'adr': '架构决策',
  'db': '数据库设计',
  'integration': '系统集成',
  'event-bus': '事件总线',
  'collaboration': '协作工具',
  'knowledge': '知识管理',
  'reports': '分析报告',
  'workflow': '工作流',
  'cicd': '持续集成',
  'requirements': '需求文档',
  'design-constraints': '设计约束',
  'mcp': 'MCP 协议',
};

// API 请求封装
async function apiRequest(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch(`${PANDAWIKI_API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// 获取或创建分类
async function getOrCreateNav(name: string, position: number): Promise<string> {
  // 查找现有分类
  const listRes = await apiRequest(`/api/v1/nav/list?kb_id=${KB_ID}`);
  const navs = listRes.data || [];
  const existing = navs.find((n: any) => n.name === name);

  if (existing) {
    console.log(`  找到分类: ${name} (${existing.id})`);
    return existing.id;
  }

  // 创建新分类
  const createRes = await apiRequest('/api/v1/nav/add', 'POST', {
    kb_id: KB_ID,
    name,
    position,
  });

  if (createRes.success) {
    console.log(`  创建分类: ${name}`);
    // 获取新创建的分类ID
    const newList = await apiRequest(`/api/v1/nav/list?kb_id=${KB_ID}`);
    const newNav = newList.data?.find((n: any) => n.name === name);
    return newNav?.id;
  }

  throw new Error(`创建分类失败: ${name}`);
}

// 读取 Markdown 文件
function readMarkdownFile(filePath: string): string {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 调整图片路径
  content = content.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, imgPath) => {
    // 相对路径转换为绝对路径
    const absPath = path.resolve(path.dirname(filePath), imgPath);
    return `![${alt}](file://${absPath})`;
  });

  // 添加文档元信息
  const fileName = path.basename(filePath, '.md');
  const relativePath = path.relative(DOCS_DIR, filePath);

  const metaHeader = `\n---\n来源: ${relativePath}\n导入时间: ${new Date().toISOString()}\n---\n\n`;

  return metaHeader + content;
}

// 创建文档节点
async function createDocument(title: string, content: string, navId: string, position: number) {
  // 截取内容前5000字符作为预览
  const preview = content.slice(0, 5000);

  // 直接插入数据库
  const nodeId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const sql = `
    INSERT INTO nodes (id, kb_id, nav_id, type, name, content, status, position, created_at, updated_at, creator_id, editor_id)
    VALUES (
      '${nodeId}',
      '${KB_ID}',
      '${navId}',
      1,
      '${title.replace(/'/g, "''")}',
      '${content.replace(/'/g, "''")}',
      2,
      ${position},
      NOW(),
      NOW(),
      'admin-001',
      'admin-001'
    )
  `;

  execSync(`docker exec orion-knowledge-pg psql -U knowledge -d orion_knowledge -c "${sql}"`, {
    stdio: 'pipe',
  });

  return nodeId;
}

// 主函数
async function main() {
  console.log('=== 开始批量导入文档到 PandaWiki ===\n');

  // 确保知识库存在
  const kbList = await apiRequest('/api/v1/knowledge_base/list');
  if (!kbList.data?.find((kb: any) => kb.id === KB_ID)) {
    console.error('知识库不存在，请先创建');
    process.exit(1);
  }
  console.log(`知识库: ${KB_ID}\n`);

  // 获取所有分类
  const navList = await apiRequest(`/api/v1/nav/list?kb_id=${KB_ID}`);
  const existingNavs = navList.data || [];

  // 创建目录到分类ID的映射
  const navIdMap: Record<string, string> = {};

  // 处理每个文档目录
  let totalDocs = 0;
  let successDocs = 0;

  for (const [dirName, categoryName] of Object.entries(CATEGORY_MAP)) {
    const dirPath = path.join(DOCS_DIR, dirName);

    if (!fs.existsSync(dirPath)) {
      console.log(`跳过不存在的目录: ${dirName}`);
      continue;
    }

    // 获取或创建分类
    let navId = navIdMap[dirName];
    if (!navId) {
      const existingNav = existingNavs.find((n: any) => n.name === categoryName);
      if (existingNav) {
        navId = existingNav.id;
      } else {
        const pos = Object.keys(CATEGORY_MAP).indexOf(dirName) + 1;
        navId = await getOrCreateNav(categoryName, pos);
      }
      navIdMap[dirName] = navId;
    }

    // 获取该目录下的所有 .md 文件
    const mdFiles = execSync(`find "${dirPath}" -name "*.md" -type f`, { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.trim());

    if (mdFiles.length === 0) continue;

    console.log(`\n📁 ${categoryName}: ${mdFiles.length} 个文档`);

    for (let i = 0; i < mdFiles.length; i++) {
      const filePath = mdFiles[i];
      const fileName = path.basename(filePath, '.md');

      try {
        const content = readMarkdownFile(filePath);
        await createDocument(fileName, content, navId, i + 1);
        successDocs++;
      } catch (err: any) {
        console.error(`  ❌ 导入失败: ${fileName} - ${err.message}`);
      }

      totalDocs++;

      // 进度提示
      if (totalDocs % 50 === 0) {
        console.log(`  已处理 ${totalDocs} 个文档...`);
      }
    }
  }

  console.log(`\n=== 导入完成 ===`);
  console.log(`总文档数: ${totalDocs}`);
  console.log(`成功导入: ${successDocs}`);
  console.log(`失败: ${totalDocs - successDocs}`);
}

main().catch(console.error);