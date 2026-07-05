/**
 * Fixup script for Phase 1.3 Migration
 *
 * Fixes broken error constructors where string messages lost their quotes:
 *   new NotFoundError(Agent not found)  →  new NotFoundError('Agent not found')
 *   new OrionError(Failed to get stats, ErrorCode.INTERNAL_ERROR)  →  new OrionError('Failed to get stats', ErrorCode.INTERNAL_ERROR)
 *
 * But keeps variable references unchanged:
 *   new OrionError(error.message, ErrorCode.INTERNAL_ERROR)  ✓
 *
 * Usage: npx tsx scripts/fixup-route-errors.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTE_FILES_DIR = path.resolve(__dirname, '../src/api');

/**
 * Fix OrionError constructor calls that have unquoted string messages.
 * The pattern is: `new ErrorClass(STRING_LITERAL_WITH_SPACES, ...)`
 * where STRING_LITERAL_WITH_SPACES contains spaces (so it's not a variable reference).
 */
function fixConstructorCalls(content: string): string {
  // Fix `new ErrorClassName(unquoted string here)` - where the first arg has spaces and isn't a known variable
  return content.replace(
    /new (OrionError|ValidationError|NotFoundError|UnauthorizedError|ForbiddenError|ConflictError|BusinessError|ServiceUnavailableError)\(([^)]+)\)/g,
    (match, className: string, args: string) => {
      // Split args by comma (respecting nesting)
      const parts = splitArgs(args);
      if (parts.length === 0) return match;

      const firstArg = parts[0].trim();

      // If first arg is already quoted, is a variable (has dots or is an identifier), or is an ErrorCode enum, keep as is
      if (
        (firstArg.startsWith("'") && firstArg.endsWith("'")) ||
        (firstArg.startsWith('"') && firstArg.endsWith('"')) ||
        /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(firstArg) ||
        /^ErrorCode\./.test(firstArg)
      ) {
        return match;
      }

      // Check if it looks like a variable reference with dots
      if (firstArg.includes('.') && /^[a-zA-Z_$][a-zA-Z0-9_.]*$/.test(firstArg)) {
        return match;
      }

      // Check if it's a ternary expression
      if (firstArg.includes('?')) {
        return match;
      }

      // It's an unquoted string literal - add quotes
      const fixedFirst = `'${firstArg}'`;
      const remaining = parts.slice(1).join(',');
      return `new ${className}(${fixedFirst}${remaining ? ', ' + remaining : ''})`;
    }
  );
}

/**
 * Split constructor arguments respecting string literals and object literals
 */
function splitArgs(args: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let stringChar = '';

  for (const ch of args) {
    if (inString) {
      current += ch;
      if (ch === stringChar) {
        inString = false;
      }
    } else if (ch === "'" || ch === '"') {
      current += ch;
      inString = true;
      stringChar = ch;
    } else if (ch === '(' || ch === '{') {
      current += ch;
      depth++;
    } else if (ch === ')' || ch === '}') {
      current += ch;
      depth--;
    } else if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
}

function processFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  content = fixConstructorCalls(content);

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function main() {
  const allFiles = fs.readdirSync(ROUTE_FILES_DIR);
  const files = allFiles
    .filter(f => f.endsWith('-routes.ts') && !f.includes('__tests__'))
    .map(f => path.join(ROUTE_FILES_DIR, f));

  let fixedFiles = 0;

  for (const file of files) {
    try {
      if (processFile(file)) {
        console.log(`  Fixed: ${path.basename(file)}`);
        fixedFiles++;
      }
    } catch (err) {
      console.error(`  ERROR: ${path.basename(file)}: ${err}`);
    }
  }

  console.log(`\nFixed ${fixedFiles} files`);
}

main();
