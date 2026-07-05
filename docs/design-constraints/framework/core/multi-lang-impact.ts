/**
 * Multi-language Dependency Analyzer — extends dependency impact to Go, Python, Java.
 *
 * Usage:
 *   const analyzer = new MultiLangDepAnalyzer(rootDir);
 *   const report = analyzer.analyze(targetFile);
 */

import * as fs from 'fs';
import * as path from 'path';
import { getGoFiles, getPyFiles, getJavaFiles, getTsFiles } from './file-utils';

export interface MultiLangDepReport {
  targetFile: string;
  language: 'typescript' | 'go' | 'python' | 'java';
  directDependents: string[];
  totalAffected: number;
  crossLanguageCalls: CrossLanguageCall[];
}

interface CrossLanguageCall {
  from: string;
  fromLang: string;
  to: string;
  toLang: string;
  pattern: string;
}

export class MultiLangDepAnalyzer {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  analyze(targetFile: string): MultiLangDepReport {
    const ext = path.extname(targetFile).toLowerCase();
    let language: MultiLangDepReport['language'] = 'typescript';
    if (ext === '.go') language = 'go';
    else if (ext === '.py') language = 'python';
    else if (ext === '.java') language = 'java';

    const targetBase = path.basename(targetFile).replace(/\.[^.]+$/, '');
    let allFiles: string[] = [];
    let importPattern: RegExp;

    switch (language) {
      case 'typescript':
        allFiles = getTsFiles(this.rootDir);
        importPattern = new RegExp(`from\\s+['"].*?${targetBase}['"]|import\\s+.*?from\\s+['"].*?${targetBase}['"]`, 'g');
        break;
      case 'go':
        allFiles = getGoFiles(this.rootDir);
        importPattern = new RegExp(`"${targetBase}"|import\\s+.*?${targetBase}`, 'g');
        break;
      case 'python':
        allFiles = getPyFiles(this.rootDir);
        importPattern = new RegExp(`from\\s+.*?${targetBase}\\s+import|import\\s+.*?${targetBase}`, 'g');
        break;
      case 'java':
        allFiles = getJavaFiles(this.rootDir);
        importPattern = new RegExp(`import\\s+.*?${targetBase}`, 'g');
        break;
    }

    const directDependents = allFiles
      .filter(f => f !== targetFile)
      .filter(f => {
        try {
          const content = fs.readFileSync(f, 'utf-8');
          return importPattern.test(content);
        } catch {
          return false;
        }
      });

    // Cross-language detection
    const crossCalls: CrossLanguageCall[] = [];
    const serviceDirs = ['orion-ai-service', 'orion-visor', 'orion-knowledge'];
    for (const svcDir of serviceDirs) {
      const svcPath = path.join(this.rootDir, svcDir);
      if (!fs.existsSync(svcPath)) continue;

      const pyFiles = getPyFiles(svcPath);
      for (const f of pyFiles) {
        try {
          const content = fs.readFileSync(f, 'utf-8');
          if (new RegExp(targetBase, 'i').test(content)) {
            crossCalls.push({
              from: f,
              fromLang: 'python',
              to: targetFile,
              toLang: language,
              pattern: `references ${targetBase}`,
            });
          }
        } catch { /* skip */ }
      }
    }

    return {
      targetFile,
      language,
      directDependents,
      totalAffected: directDependents.length + crossCalls.length,
      crossLanguageCalls: crossCalls,
    };
  }
}
