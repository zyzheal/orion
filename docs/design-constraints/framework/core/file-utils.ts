/**
 * 文件工具函数
 * 支持多语言文件扫描：TSX, TS, Go, Python, Java
 */

// @ts-ignore TS2591
import * as fs from 'fs';
// @ts-ignore TS2591
import * as path from 'path';

/** 默认排除的目录 */
const EXCLUDED_DIRS = [
  '.git', '.next', 'node_modules', '__tests__', '__mocks__',
  'coverage', 'dist', 'build', '.venv', 'venv', 'site-packages',
  'vendor', '.idea', '.vscode',
];

/** 排除 *-svc 副本目录 */
const SVC_DIR_PATTERN = /-svc$/;

/**
 * 获取目录下所有 TSX 文件
 */
export function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  traverse(dir, files, ['.tsx'], ['.test.tsx', '.spec.tsx']);
  return files;
}

/**
 * 获取目录下所有 TS 文件（TypeScript 后端）
 */
export function getTsFiles(dir: string): string[] {
  const files: string[] = [];
  traverse(dir, files, ['.ts'], ['.test.ts', '.spec.ts', '.d.ts']);
  return files;
}

/**
 * 获取目录下所有 Go 文件
 */
export function getGoFiles(dir: string): string[] {
  const files: string[] = [];
  traverse(dir, files, ['.go'], ['_test.go']);
  return files;
}

/**
 * 获取目录下所有 Python 文件
 */
export function getPyFiles(dir: string): string[] {
  const files: string[] = [];
  traverse(dir, files, ['.py'], ['conftest.py', 'test_*.py', '__init__.py']);
  return files;
}

/**
 * 获取目录下所有 Java 文件
 */
export function getJavaFiles(dir: string): string[] {
  const files: string[] = [];
  traverse(dir, files, ['.java'], []);
  return files;
}

/**
 * 通用文件扫描
 */
function traverse(dir: string, files: string[], extensions: string[], excludedPatterns: string[]) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        if (SVC_DIR_PATTERN.test(entry.name)) continue;
        traverse(fullPath, files, extensions, excludedPatterns);
      } else if (entry.isFile()) {
        if (!extensions.some(ext => entry.name.endsWith(ext))) continue;
        if (excludedPatterns.some(p => {
          if (p.includes('*')) {
            const pattern = new RegExp('^' + p.replace(/\*/g, '.*') + '$');
            return pattern.test(entry.name);
          }
          return entry.name === p;
        })) continue;
        files.push(fullPath);
      }
    }
  } catch {
    // 忽略访问错误
  }
}

/**
 * 获取指定扩展名的文件（通用版本，支持 .ts + .tsx 等）
 */
export function getFilesWithExtensions(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const excludedPatterns: string[] = [];
  for (const ext of extensions) {
    if (ext === '.ts') {
      excludedPatterns.push('*.test.ts', '*.spec.ts', '*.d.ts');
    } else if (ext === '.tsx') {
      excludedPatterns.push('*.test.tsx', '*.spec.tsx');
    } else if (ext === '.go') {
      excludedPatterns.push('*_test.go');
    } else if (ext === '.py') {
      excludedPatterns.push('conftest.py', 'test_*.py', '__init__.py');
    }
  }
  traverse(dir, files, extensions, excludedPatterns);
  return files;
}
