/**
 * Full pipeline benchmark: parse + 24 detectors + cross-validation + aggregation
 */
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const rootPath = 'orion-frontend/src/pages/';
const allFiles: string[] = [];

function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory() && !/node_modules|dist|build|\.git/.test(entry.name)) {
      walk(fullPath);
    } else if (entry.name.endsWith('.tsx')) {
      allFiles.push(fullPath);
    }
  }
}
walk(rootPath);

const testFiles = allFiles.slice(0, 50);

console.log(`\n=== Full Pipeline Benchmark (24 detectors) ===`);
console.log(`Scanning ${testFiles.length} files out of ${allFiles.length} total\n`);

// ── Phase 1: Parse + AST build ──
let t0 = performance.now();
const sourceFiles = testFiles.map(f => {
  try {
    const content = fs.readFileSync(f, 'utf-8');
    const sf = ts.createSourceFile(f, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return { file: f, sourceFile: sf, size: content.length };
  } catch { return null; }
}).filter(Boolean);
const parseTime = performance.now() - t0;
console.log(`Phase 1 - Parse: ${parseTime.toFixed(1)}ms (${(parseTime / sourceFiles.length).toFixed(2)}ms/file)`);

// ── Phase 2: Simulate full detector workload ──
// Each file gets 12 legacy traversals + 1 shared single-pass (12 detectors)
t0 = performance.now();
for (const { sourceFile } of sourceFiles) {
  // Simulate 12 legacy detectors (each does full traversal)
  for (let d = 0; d < 12; d++) {
    const visit = (node: ts.Node) => {
      // Each detector checks a few patterns
      ts.isFunctionDeclaration(node);
      ts.isJsxElement(node);
      ts.isCallExpression(node);
      ts.isAwaitExpression(node);
      ts.isClassDeclaration(node);
      ts.isTryStatement(node);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  // Single-pass: 12 detectors share 1 traversal
  const visit = (node: ts.Node) => {
    for (let d = 0; d < 12; d++) {
      ts.isFunctionDeclaration(node);
      ts.isJsxAttribute(node);
      ts.isCallExpression(node);
      ts.isAwaitExpression(node);
      ts.isPropertyAccessExpression(node);
      ts.isIdentifier(node);
      ts.isStringLiteral(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}
const detectTime = performance.now() - t0;
console.log(`Phase 2 - Detect (12 legacy + 12 single-pass): ${detectTime.toFixed(1)}ms (${(detectTime / sourceFiles.length).toFixed(2)}ms/file)`);

// ── Phase 3: Cross-validation (regex-based content scan) ──
t0 = performance.now();
for (const { file } of sourceFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  // Simulate cross-validator patterns
  /axios\.interceptors\.use|response\.use/.test(content);
  /ErrorBoundary|withErrorBoundary/.test(content);
  /can\(|hasPermission|usePermission/.test(content);
  /emptyText.*Empty|global.*empty/.test(content);
  /BaseProps|BaseComponentProps/.test(content);
}
const cvTime = performance.now() - t0;
console.log(`Phase 3 - Cross-validation (regex scan): ${cvTime.toFixed(1)}ms`);

// ── Totals ──
const totalTime = parseTime + detectTime + cvTime;
const perFile = totalTime / sourceFiles.length;

console.log(`\n┌─ Total Pipeline Time (${sourceFiles.length} files) ─┐`);
console.log(`│  Parse + Detect + CV:  ${totalTime.toFixed(1).padStart(18)}ms │`);
console.log(`│  Per file:             ${perFile.toFixed(2).padStart(18)}ms │`);
console.log(`│  Project (${allFiles.length} files):      ${(perFile * allFiles.length / 1000).toFixed(1).padStart(17)}s │`);
console.log('└──────────────────────────────────────────┘');

// ── Bottleneck analysis ──
console.log(`\nBottleneck breakdown:`);
console.log(`  Parse:      ${(parseTime / totalTime * 100).toFixed(1)}%`);
console.log(`  Detect:     ${(detectTime / totalTime * 100).toFixed(1)}%`);
console.log(`  Cross-val:  ${(cvTime / totalTime * 100).toFixed(1)}%`);
console.log(`  Legacy detectors: ~${(detectTime * 12/13).toFixed(0)}ms (${(detectTime * 12/13 / totalTime * 100).toFixed(1)}%)`);
console.log(`  Single-pass:  ~${(detectTime * 1/13).toFixed(0)}ms (${(detectTime * 1/13 / totalTime * 100).toFixed(1)}%)`);
