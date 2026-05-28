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
      m.includes('no associated') || m.includes('not injected') || m.includes('baseline') || m.includes('not found')) {
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
      m.includes('cannot run') || m.includes('must have') || m.includes('is not completed') || m.includes('cannot retrieve')) {
    return 'VALIDATION_ERROR';
  }
  return 'OPERATION_FAILED';
}

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf-8'); } catch { continue; }
  if (!content.includes('throw new Error')) continue;

  const hasOrionErrorImport = content.includes('OrionError') && /import.*OrionError.*from/.test(content);
  const lines = content.split('\n');
  const newLines = [];
  let replacements = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const throwMatch = line.match(/^(\s*)throw new Error\(\s*$/);

    if (throwMatch) {
      const indent = throwMatch[1];
      // Collect the message from next lines
      let msgLines = [];
      let j = i + 1;
      let foundClose = false;

      while (j < lines.length && j < i + 10) {
        const nextLine = lines[j].trim();
        if (nextLine === ');' || nextLine === ')') {
          foundClose = true;
          break;
        }
        msgLines.push(lines[j]);
        j++;
      }

      if (foundClose && msgLines.length > 0) {
        // Join message lines and extract the string
        const fullMsg = msgLines.join('\n').trim();

        // Try to extract string content
        let msgContent = '';
        const singleStrMatch = fullMsg.match(/^(['"])(.*)\1;?$/s);
        const templateMatch = fullMsg.match(/^`(.*)`;?$/s);
        const concatMatch = fullMsg.match(/(['"])([^'"]*)\1\s*\+\s*\n\s*(['"])([^'"]*)\3/s);

        if (singleStrMatch) {
          msgContent = singleStrMatch[2];
        } else if (templateMatch) {
          msgContent = templateMatch[1];
        } else if (concatMatch) {
          // String concatenation
          const parts = [];
          const strRegex = /['"]([^'"]*)['"]/g;
          let m;
          while ((m = strRegex.exec(fullMsg)) !== null) {
            parts.push(m[1]);
          }
          msgContent = parts.join('');
        } else {
          // Complex expression, keep as-is
          const errorCode = classifyError(fullMsg);
          newLines.push(`${indent}throw new OrionError('${errorCode}', ${fullMsg})`);
          i = j + 1;
          replacements++;
          continue;
        }

        const errorCode = classifyError(msgContent);
        newLines.push(`${indent}throw new OrionError('${errorCode}', '${msgContent.replace(/'/g, "\\'")}')`);
        i = j + 1; // Skip past the closing );
        replacements++;
      } else {
        // Can't parse, keep original
        newLines.push(line);
        i++;
      }
    } else {
      newLines.push(line);
      i++;
    }
  }

  if (replacements > 0) {
    let result = newLines.join('\n');

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
