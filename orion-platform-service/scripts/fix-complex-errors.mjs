import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const files = execSync(
  `grep -rl "throw new Error" src/ --include="*.ts" | grep -v "__tests__" | grep -v ".test.ts"`,
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;
let filesModified = 0;

function classifyError(msg) {
  const m = msg.toLowerCase();
  if (m.includes('not found') || m.includes('missing') || m.includes('unknown') || m.includes('no such') ||
      m.includes('does not exist') || m.includes('no debug') || m.includes('no pipeline') || m.includes('no deployment') ||
      m.includes('no snapshot') || m.includes('no approval') || m.includes('no pending') || m.includes('not completed') ||
      m.includes('no associated') || m.includes('not injected') || m.includes('baseline')) {
    return 'NOT_FOUND';
  }
  if (m.includes('already exists') || m.includes('duplicate') || m.includes('conflict') || m.includes('already registered') ||
      m.includes('already been') || m.includes('already approved') || m.includes('already running') || m.includes('already reached') ||
      m.includes('already enabled') || m.includes('already disabled')) {
    return 'VALIDATION_ERROR';
  }
  if (m.includes('not configured') || m.includes('not available') || m.includes('connection') || m.includes('database not') ||
      m.includes('not initialized') || m.includes('not healthy') || m.includes('failed to connect') || m.includes('unavailable') ||
      m.includes('not set up') || m.includes('service unavailable') || m.includes('not injected')) {
    return 'SERVICE_UNAVAILABLE';
  }
  if (m.includes('invalid') || m.includes('denied') || m.includes('reject') || m.includes('not valid') || m.includes('not allowed') ||
      m.includes('unauthorized') || m.includes('forbidden') || m.includes('permission') || m.includes('unsupported') ||
      m.includes('cannot be') || m.includes('must be') || m.includes('must match') || m.includes('at least') || m.includes('is required') ||
      m.includes('disabled') || m.includes('not supported') || m.includes('exceeded') || m.includes('limit') || m.includes('missing required') ||
      m.includes('cannot run') || m.includes('must have')) {
    return 'VALIDATION_ERROR';
  }
  return 'OPERATION_FAILED';
}

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf-8'); } catch { continue; }
  if (!content.includes('throw new Error')) continue;

  const hasOrionErrorImport = content.includes('OrionError') && /import.*OrionError.*from/.test(content);
  let result = content;
  let replacements = 0;

  // Pattern 1: throw new Error(\n  '...' + \n  '...'\n)
  // Multi-line string concatenation
  result = result.replace(
    /throw new Error\(\s*\n(\s*['"][^'"]*['"]\s*\+\s*\n)*\s*['"][^'"]*['"]\s*\n\s*\)/g,
    (match) => {
      // Extract all string parts and concatenate
      const parts = [];
      const strRegex = /['"]([^'"]*)['"]/g;
      let m;
      while ((m = strRegex.exec(match)) !== null) {
        parts.push(m[1]);
      }
      const fullMsg = parts.join('');
      const errorCode = classifyError(fullMsg);
      replacements++;
      return `throw new OrionError('${errorCode}', '${fullMsg}')`;
    }
  );

  // Pattern 2: throw new Error(\n  `...`\n) - template literal spanning lines
  result = result.replace(
    /throw new Error\(\s*\n\s*`([^`]*)`\s*\n\s*\)/g,
    (match, msg) => {
      const errorCode = classifyError(msg);
      replacements++;
      return `throw new OrionError('${errorCode}', \`${msg}\`)`;
    }
  );

  // Pattern 3: throw new Error(\n  '...'\n) - single string on next line
  result = result.replace(
    /throw new Error\(\s*\n\s*(['"][^'"]*['"])\s*\n\s*\)/g,
    (match, msg) => {
      const errorCode = classifyError(msg);
      replacements++;
      return `throw new OrionError('${errorCode}', ${msg})`;
    }
  );

  // Pattern 4: throw new Error(expr) where expr is a variable or complex expression
  result = result.replace(
    /throw new Error\((\w+(?:\.\w+)*(?:\s*\|\|\s*\w+(?:\.\w+)*)*)\)/g,
    (match, expr) => {
      replacements++;
      return `throw new OrionError('OPERATION_FAILED', ${expr})`;
    }
  );

  if (replacements > 0) {
    if (!hasOrionErrorImport) {
      const importLines = result.split('\n');
      let lastImportIdx = -1;
      for (let j = 0; j < importLines.length; j++) {
        if (importLines[j].match(/^import\s+/)) lastImportIdx = j;
      }
      const depth = file.split('/').length - 2;
      const relPath = '../'.repeat(depth) + 'errors';
      const importLine = `import { OrionError } from '${relPath}';`;
      if (lastImportIdx >= 0) {
        importLines.splice(lastImportIdx + 1, 0, importLine);
      } else {
        importLines.unshift(importLine);
      }
      result = importLines.join('\n');
    }

    writeFileSync(file, result, 'utf-8');
    totalReplacements += replacements;
    filesModified++;
    console.log(`  ${file}: ${replacements} replacements`);
  }
}

console.log(`\nTotal: ${totalReplacements} replacements in ${filesModified} files`);
