import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Find all non-test files with throw new Error
const files = execSync(
  `grep -rl "throw new Error" src/ --include="*.ts" | grep -v "__tests__" | grep -v ".test.ts"`,
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;
let filesModified = 0;

function classifyError(msg) {
  const m = msg.toLowerCase();
  if (m.includes('not found') || m.includes('missing') || m.includes('unknown') || m.includes('no such') || m.includes('does not exist') || m.includes('no debug state') || m.includes('no pipeline') || m.includes('no deployment') || m.includes('no snapshot') || m.includes('no approval') || m.includes('no pending')) {
    return 'NOT_FOUND';
  }
  if (m.includes('already exists') || m.includes('duplicate') || m.includes('conflict') || m.includes('already registered') || m.includes('already been') || m.includes('already approved') || m.includes('already running')) {
    return 'VALIDATION_ERROR';
  }
  if (m.includes('not configured') || m.includes('not available') || m.includes('connection') || m.includes('database not') || m.includes('not initialized') || m.includes('not healthy') || m.includes('failed to connect') || m.includes('unavailable')) {
    return 'SERVICE_UNAVAILABLE';
  }
  if (m.includes('invalid') || m.includes('denied') || m.includes('reject') || m.includes('not valid') || m.includes('not allowed') || m.includes('unauthorized') || m.includes('forbidden') || m.includes('permission') || m.includes('unsupported') || m.includes('cannot be') || m.includes('must be') || m.includes('must match') || m.includes('at least') || m.includes('is required')) {
    return 'VALIDATION_ERROR';
  }
  if (m.includes('timeout') || m.includes('timed out') || m.includes('failed') || m.includes('error') || m.includes('unable') || m.includes('cannot')) {
    return 'OPERATION_FAILED';
  }
  return 'OPERATION_FAILED';
}

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch { continue; }

  if (!content.includes('throw new Error')) continue;

  // Check if OrionError is already imported
  const hasOrionErrorImport = /import\s+\{[^}]*OrionError[^}]*\}\s+from\s+['"].*errors/.test(content) ||
                               /import\s+\{[^}]*OrionError[^}]*\}\s+from\s+['"]\.\.\/errors/.test(content);

  // Replace throw new Error(...) - handle multi-line with template literals
  // Pattern: throw new Error( ... ) where ... can span multiple lines
  let result = content;
  let replacements = 0;

  // Use a state machine approach to find and replace throw new Error(...)
  const lines = result.split('\n');
  const newLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a throw new Error
    const throwMatch = line.match(/^(\s*)throw new Error\(/);
    if (throwMatch) {
      const indent = throwMatch[1];
      // Collect the full throw statement (may span multiple lines)
      let fullStatement = line;
      let parenDepth = 0;
      let startLine = i;

      // Count parens to find the end
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '(') parenDepth++;
          if (ch === ')') parenDepth--;
        }
        if (j > i) fullStatement += '\n' + lines[j];
        if (parenDepth === 0) {
          i = j;
          break;
        }
        if (j === lines.length - 1) {
          // Couldn't find matching paren, skip
          newLines.push(line);
          i++;
          continue;
        }
      }

      if (parenDepth !== 0) {
        newLines.push(line);
        i++;
        continue;
      }

      // Extract the error message
      // Match: throw new Error("...") or throw new Error(`...`) or throw new Error('...')
      const msgMatch = fullStatement.match(/throw new Error\((['"`])([\s\S]*?)\1\)/);
      if (msgMatch) {
        const quote = msgMatch[1];
        const msg = msgMatch[2];
        const errorCode = classifyError(msg);

        // Build the replacement
        const newThrow = `${indent}throw new OrionError('${errorCode}', ${quote}${msg}${quote})`;
        newLines.push(newThrow);
        replacements++;
      } else {
        // Complex expression, skip
        newLines.push(line);
      }
      i++;
    } else {
      newLines.push(line);
      i++;
    }
  }

  if (replacements > 0) {
    result = newLines.join('\n');

    // Add import if needed
    if (!hasOrionErrorImport) {
      // Find the right place to add import
      const importLines = result.split('\n');
      let lastImportIdx = -1;
      for (let j = 0; j < importLines.length; j++) {
        if (importLines[j].match(/^import\s+/)) {
          lastImportIdx = j;
        }
      }

      // Calculate relative path to errors/
      const depth = file.split('/').length - 2; // src/services/foo.ts -> depth 2
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
