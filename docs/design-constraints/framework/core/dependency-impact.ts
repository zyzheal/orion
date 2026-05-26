/**
 * Dependency Impact Analyzer — scans import graph to quantify
 * "if I change this file, what breaks?"
 *
 * Usage:
 *   const analyzer = new DependencyImpactAnalyzer(targetFile, rootDir);
 *   const report = analyzer.analyze();
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface DependencyReport {
  targetFile: string;
  directDependents: string[];    // files that directly import target
  indirectDependents: string[];  // 2nd-order dependents
  frontendCallers: string[];     // frontend pages calling this API
  totalAffected: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class DependencyImpactAnalyzer {
  private targetFile: string;
  private rootDir: string;
  private allTsFiles: string[] = [];

  constructor(targetFile: string, rootDir: string) {
    this.targetFile = targetFile;
    this.rootDir = rootDir;
    this.allTsFiles = this.collectTsFiles(rootDir);
  }

  analyze(): DependencyReport {
    const targetBase = this.getBasename(this.targetFile);

    // Direct dependents: files that import this target
    const directDependents = this.allTsFiles
      .filter(f => f !== this.targetFile)
      .filter(f => this.fileImportsTarget(f, targetBase));

    // 2nd-order: files that import any direct dependent
    const indirectDependents = new Set<string>();
    for (const dep of directDependents) {
      const depBase = this.getBasename(dep);
      for (const f of this.allTsFiles) {
        if (f !== dep && f !== this.targetFile && !directDependents.includes(f)) {
          if (this.fileImportsTarget(f, depBase)) {
            indirectDependents.add(f);
          }
        }
      }
    }

    // Frontend callers: tsx files referencing the API path
    const frontendCallers = this.findFrontendCallers(targetBase);

    const totalAffected = directDependents.length + indirectDependents.size + frontendCallers.length;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalAffected > 10) riskLevel = 'high';
    else if (totalAffected > 3) riskLevel = 'medium';

    return {
      targetFile: this.targetFile,
      directDependents,
      indirectDependents: Array.from(indirectDependents),
      frontendCallers,
      totalAffected,
      riskLevel,
    };
  }

  private collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...this.collectTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private get basenameCache = new Map<string, string>();

  private getBasename(file: string): string {
    if (this.basenameCache.has(file)) return this.basenameCache.get(file)!;
    const base = path.basename(file).replace(/\.(ts|tsx)$/, '');
    this.basenameCache.set(file, base);
    return base;
  }

  private fileImportsTarget(file: string, targetBase: string): boolean {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // Match import statements referencing the target
      const importRegex = new RegExp(`from\\s+['"].*?${targetBase}['"]`, 'g');
      return importRegex.test(content);
    } catch {
      return false;
    }
  }

  private findFrontendCallers(targetBase: string): string[] {
    const frontendDir = path.join(this.rootDir, 'orion-frontend', 'src');
    if (!fs.existsSync(frontendDir)) return [];

    const tsxFiles = this.allTsFiles.filter(f => f.startsWith(frontendDir));
    return tsxFiles.filter(f => {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        // Check for API client calls referencing the target
        const apiRegex = new RegExp(targetBase, 'i');
        return apiRegex.test(content);
      } catch {
        return false;
      }
    });
  }
}
