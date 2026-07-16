/**
 * Phase 1.3 Migration Script
 *
 * Converts manual error returns in route files:
 *   reply.code(XXX).send({ error: '...', ... })
 *   reply.status(XXX).send({ error: '...', ... })
 * to:
 *   handleError(reply, new AppropriateErrorSubclass(...))
 *
 * Usage: npx tsx scripts/migrate-route-errors.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTE_FILES_DIR = path.resolve(__dirname, '../src/api');

// Status code to error class mapping
function getErrorClass(statusCode: number): string {
  switch (statusCode) {
    case 400: case 422: return 'ValidationError';
    case 401: return 'UnauthorizedError';
    case 403: return 'ForbiddenError';
    case 404: return 'NotFoundError';
    case 409: return 'ConflictError';
    case 500: return 'OrionError';
    case 503: return 'ServiceUnavailableError';
    default: return 'OrionError';
  }
}

function getErrorCodeFromClass(className: string): string {
  switch (className) {
    case 'ValidationError': return 'ErrorCode.VALIDATION_ERROR';
    case 'UnauthorizedError': return 'ErrorCode.UNAUTHORIZED';
    case 'ForbiddenError': return 'ErrorCode.FORBIDDEN';
    case 'NotFoundError': return 'ErrorCode.NOT_FOUND';
    case 'ConflictError': return 'ErrorCode.CONFLICT';
    case 'BusinessError': return 'ErrorCode.BUSINESS_ERROR';
    case 'ServiceUnavailableError': return 'ErrorCode.SERVICE_UNAVAILABLE';
    default: return 'ErrorCode.INTERNAL_ERROR';
  }
}

/**
 * Format error message from send content for use in replacement.
 * Returns quoted string for string literals, variable name for variables.
 */
function formatErrorMessage(sendContent: string): string {
  // Check for string literal in error field
  const stringMatch = sendContent.match(/error:\s*'([^']*?)'/);
  if (stringMatch) return `'${stringMatch[1]}'`;

  // Check for variable in error field
  const varMatch = sendContent.match(/error:\s*(\w+\.message|err\.message|error\.message)/);
  if (varMatch) return varMatch[1];

  // Check message field as fallback (string)
  const msgStringMatch = sendContent.match(/message:\s*'([^']*?)'/);
  if (msgStringMatch) return `'${msgStringMatch[1]}'`;

  // Check message field as fallback (variable)
  const msgVarMatch = sendContent.match(/message:\s*(\w+\.message|err\.message|error\.message)/);
  if (msgVarMatch) return msgVarMatch[1];

  // Check error as object variable
  const errorObjMatch = sendContent.match(/error:\s*(\w+)/);
  if (errorObjMatch) return errorObjMatch[1];

  return "'Unknown error'";
}

/**
 * Check if a .send() call looks like an error response
 */
function isErrorSend(sendContent: string): boolean {
  return (
    sendContent.includes("error:") ||
    sendContent.includes("success: false") ||
    sendContent.includes("'NOT_FOUND'") ||
    sendContent.includes("'ERROR'") ||
    sendContent.includes("'INTERNAL_ERROR'") ||
    sendContent.includes("'VALIDATION_ERROR'") ||
    sendContent.includes("'SERVICE_UNAVAILABLE'") ||
    sendContent.includes("'FORBIDDEN'") ||
    sendContent.includes("'UNAUTHORIZED'") ||
    sendContent.includes("'CONFLICT'")
  );
}

/**
 * Check if a .send() call looks like a success response
 */
function isSuccessSend(sendContent: string): boolean {
  return (
    sendContent.includes("success: true") ||
    (sendContent.includes("data:") && !sendContent.includes("error:"))
  );
}

/**
 * Build replacement for a single-line error return
 */
function buildInlineReplacement(
  fullMatch: string,
  statusCode: number,
  sendContent: string
): string | null {
  const errorClass = getErrorClass(statusCode);
  const errorMsg = formatErrorMessage(sendContent);

  if (errorClass === 'OrionError') {
    const errorCode = getErrorCodeFromClass(errorClass);
    return `handleError(reply, new OrionError(${errorMsg}, ${errorCode}))`;
  } else {
    return `handleError(reply, new ${errorClass}(${errorMsg}))`;
  }
}

/**
 * Process a single file and return the number of replacements made
 */
function processFile(filePath: string): { replacements: number; skipped: number } {
  let content = fs.readFileSync(filePath, 'utf-8');
  let replacements = 0;
  let skipped = 0;

  const lines = content.split('\n');
  const newLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip non-reply lines
    if (!line.includes('reply.') || !line.includes('.send(')) {
      newLines.push(line);
      i++;
      continue;
    }

    // Check for success responses (2xx + data) - skip them
    if (line.includes('success: true') || line.includes('status(20') || line.includes('code(20')) {
      newLines.push(line);
      i++;
      continue;
    }

    // Single line pattern: reply.status(XXX).send({...})
    // Must have an error or success: false indicator
    const inlineMatch = line.match(/(return\s+|await\s+)?(reply\.(?:status|code)\((\d{3})\)\.send\((.+)\))(;?)/);
    if (inlineMatch && isErrorSend(inlineMatch[4])) {
      const prefix = inlineMatch[1] || '';
      const statusCode = parseInt(inlineMatch[3], 10);
      const sendContent = inlineMatch[4];
      const semicolon = inlineMatch[5] || '';

      if (statusCode && sendContent) {
        const replacement = buildInlineReplacement(inlineMatch[2], statusCode, sendContent);
        if (replacement) {
          newLines.push(`${prefix}${replacement}${semicolon}`);
          replacements++;
          i++;
          continue;
        }
      }
    }

    // Multi-line pattern: reply.status(xxx).send({ then content on following lines
    if ((line.includes('reply.status(') || line.includes('reply.code(')) && line.includes('.send({') && !line.includes('})')) {
      // Collect lines until we find closing })
      let combined = line;
      let j = i + 1;
      let foundClose = false;
      while (j < lines.length) {
        combined += '\n' + lines[j];
        if (lines[j].includes('})') || lines[j].includes('});')) {
          foundClose = true;
          break;
        }
        j++;
      }

      if (foundClose && isErrorSend(combined)) {
        // Check status code
        const statusMatch = combined.match(/reply\.(?:status|code)\((\d{3})\)/);
        if (statusMatch) {
          const statusCode = parseInt(statusMatch[1], 10);
          const errorClass = getErrorClass(statusCode);
          const errorMsg = formatErrorMessage(combined);
          const returnPrefix = line.match(/^\s*return\s+/) ? 'return ' : '';

          let handleErrorCall: string;

          if (errorClass === 'OrionError') {
            const errorCode = getErrorCodeFromClass(errorClass);
            handleErrorCall = `${returnPrefix}handleError(reply, new OrionError(${errorMsg}, ${errorCode}))`;
          } else if (errorClass === 'NotFoundError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new NotFoundError(${errorMsg}))`;
          } else if (errorClass === 'ValidationError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new ValidationError(${errorMsg}))`;
          } else if (errorClass === 'ServiceUnavailableError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new ServiceUnavailableError(${errorMsg}))`;
          } else if (errorClass === 'ForbiddenError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new ForbiddenError(${errorMsg}))`;
          } else if (errorClass === 'UnauthorizedError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new UnauthorizedError(${errorMsg}))`;
          } else if (errorClass === 'ConflictError') {
            handleErrorCall = `${returnPrefix}handleError(reply, new ConflictError(${errorMsg}))`;
          } else {
            handleErrorCall = `${returnPrefix}handleError(reply, new OrionError(${errorMsg}, ErrorCode.INTERNAL_ERROR))`;
          }

          newLines.push(handleErrorCall);
          replacements++;
          i = j + 1;
          continue;
        }
      }
    }

    // If we get here, the line wasn't transformed
    newLines.push(line);
    i++;
  }

  if (replacements > 0) {
    let finalContent = newLines.join('\n');

    // Check if import already has handleError
    const hasHandleErrorImport = /import\s+\{[^}]*handleError[^}]*\}\s+from\s+['"]\.\.\/errors['"]/.test(finalContent);
    const hasErrorsImport = /from\s+['"]\.\.\/errors['"]/.test(finalContent);

    if (!hasHandleErrorImport) {
      // Determine which error classes are used in the file
      const usedClasses: string[] = [];
      const classChecks = [
        { name: 'OrionError', pattern: /new OrionError\(/ },
        { name: 'ValidationError', pattern: /new ValidationError\(/ },
        { name: 'NotFoundError', pattern: /new NotFoundError\(/ },
        { name: 'UnauthorizedError', pattern: /new UnauthorizedError\(/ },
        { name: 'ForbiddenError', pattern: /new ForbiddenError\(/ },
        { name: 'ConflictError', pattern: /new ConflictError\(/ },
        { name: 'BusinessError', pattern: /new BusinessError\(/ },
        { name: 'ServiceUnavailableError', pattern: /new ServiceUnavailableError\(/ },
        { name: 'ErrorCode', pattern: /ErrorCode\./ },
        { name: 'handleError', pattern: /handleError\(/ },
      ];

      for (const check of classChecks) {
        if (check.pattern.test(finalContent)) {
          usedClasses.push(check.name);
        }
      }

      if (usedClasses.length > 0 && usedClasses.includes('handleError')) {
        if (hasErrorsImport) {
          // Add handleError and other missing classes to existing import
          finalContent = finalContent.replace(
            /(import\s+\{)([^}]*?)(\}\s+from\s+['"]\.\.\/errors['"])/,
            (match, open, middle, close) => {
              const existing = middle.split(',').map(s => s.trim());
              const needed = usedClasses.filter(c => !existing.includes(c));
              if (needed.length > 0) {
                return `${open}${middle}, ${needed.join(', ')}${close}`;
              }
              return match;
            }
          );
        } else {
          // Add new import line after last import
          // Find the position after the last import statement
          const importLines = finalContent.match(/^import .+$/gm);
          let insertPos = 0;
          if (importLines && importLines.length > 0) {
            const lastImport = importLines[importLines.length - 1];
            insertPos = finalContent.indexOf(lastImport) + lastImport.length + 1;
          }

          const importStmt = `import { ${usedClasses.join(', ')} } from '../errors';\n`;
          finalContent = finalContent.slice(0, insertPos) + importStmt + finalContent.slice(insertPos);
        }
      }
    }

    // Write back
    fs.writeFileSync(filePath, finalContent, 'utf-8');
  }

  return { replacements, skipped };
}

// Main execution
function main() {
  const allFiles = fs.readdirSync(ROUTE_FILES_DIR);
  const files = allFiles
    .filter(f => f.endsWith('-routes.ts') && !f.includes('__tests__'))
    .map(f => path.join(ROUTE_FILES_DIR, f));
  console.log(`Found ${files.length} route files to process`);

  let totalReplacements = 0;
  let totalSkipped = 0;
  let processedFiles = 0;

  for (const file of files) {
    try {
      const result = processFile(file);
      if (result.replacements > 0) {
        console.log(`  ${path.basename(file)}: ${result.replacements} replacements`);
        processedFiles++;
      }
      totalReplacements += result.replacements;
      totalSkipped += result.skipped;
    } catch (err) {
      console.error(`  ERROR processing ${path.basename(file)}: ${err}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Files modified: ${processedFiles}`);
  console.log(`  Total replacements: ${totalReplacements}`);
  console.log(`  Skipped: ${totalSkipped}`);
}

main();
