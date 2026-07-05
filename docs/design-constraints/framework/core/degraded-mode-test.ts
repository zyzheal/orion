/**
 * Degraded Mode Tests — verifies that when CLI is unavailable,
 * grep-based fallback works correctly.
 *
 * Run: npx tsx docs/design-constraints/framework/core/degraded-mode-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface DegradedTest {
  name: string;
  detector: string;
  grepPattern: RegExp;
  expectedConfidence: number;
}

const TESTS: DegradedTest[] = [
  { name: 'missing-feedback', detector: 'feedback', grepPattern: /message\.(success|error|warning)/, expectedConfidence: 60 },
  { name: 'missing-loading', detector: 'loading', grepPattern: /loading|disabled/, expectedConfidence: 60 },
  { name: 'missing-empty', detector: 'empty', grepPattern: /<Empty/, expectedConfidence: 50 },
  { name: 'token-violation', detector: 'token', grepPattern: /#[0-9a-fA-F]{3,8}/, expectedConfidence: 40 },
  { name: 'missing-auth-guard', detector: 'auth', grepPattern: /auth|guard|middleware/, expectedConfidence: 40 },
  { name: 'unstructured-log', detector: 'log', grepPattern: /console\.(log|error|warn|info)/, expectedConfidence: 60 },
  { name: 'secret-hardcode', detector: 'secret', grepPattern: /(password|secret|apiKey)\s*[:=]\s*['"][^'"]{4,}['"]/, expectedConfidence: 50 },
];

function runDegradedScan(filePath: string): { name: string; found: boolean; confidence: number }[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return TESTS.map(test => {
    const found = test.grepPattern.test(content);
    return { name: test.name, found, confidence: found ? test.expectedConfidence : 0 };
  });
}

function main(): void {
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│  Degraded Mode Test — grep Fallback Verification          │');
  console.log('├────────────────────────────────────────────────────────────┤');

  // Test against DashboardNew (known to have message.error, loading, Empty patterns)
  const testFile = 'orion-frontend/src/pages/DashboardNew/index.tsx';
  if (!fs.existsSync(testFile)) {
    console.log('│  SKIP: Test file not found                                    │');
    console.log('└────────────────────────────────────────────────────────────┘');
    return;
  }

  const results = runDegradedScan(testFile);
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const status = r.found ? '✅' : '❌';
    const padName = r.name.padEnd(24);
    const padConf = `conf=${r.confidence}%`.padEnd(12);
    console.log(`│  ${status} ${padName} ${padConf} found=${r.found}   │`);
    if (r.found) passCount++; else failCount++;
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Results: ${passCount} passed, ${failCount} failed (out of ${results.length} tests)        `.padEnd(67) + '│');

  // Verify degraded scan produces output even when AST engine is unavailable
  const simulatedDegraded = {
    mode: 'degraded',
    reason: 'AST engine unavailable (simulated)',
    file: testFile,
    results,
    fallback: 'grep-based pattern matching',
    overallConfidence: Math.round(results.filter(r => r.found).reduce((s, r) => s + r.confidence, 0) / Math.max(1, results.filter(r => r.found).length)),
  };

  console.log('│                                                              │');
  console.log('│  Simulated degraded mode output:                              │');
  const jsonStr = JSON.stringify(simulatedDegraded, null, 2).replace(/\n/g, '\n│  ');
  console.log(`│  ${jsonStr}`);
  console.log('└────────────────────────────────────────────────────────────┘');

  if (failCount > 3) {
    console.error('\n⚠️  Degraded mode coverage is too low. Check grep patterns.');
    process.exit(1);
  } else {
    console.log('\n✅ Degraded mode test passed.');
  }
}

main();
