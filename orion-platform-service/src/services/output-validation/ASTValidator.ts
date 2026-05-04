// orion-platform-service/src/services/output-validation/ASTValidator.ts
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ASTValidationResult {
  valid: boolean;
  errors?: string[];
}

export class ASTValidator {
  /**
   * Validates code syntax using AST parsing heuristics
   * In production, would use TypeScript compiler API for TS/JS,
   * Python's ast module, or go/parser for Go
   */
  validate(code: string, language: 'typescript' | 'javascript' | 'python' | 'go'): ASTValidationResult {
    try {
      // Check for empty code first
      if (!code || code.trim().length === 0) {
        return { valid: false, errors: ['Empty code content'] };
      }

      if (language === 'typescript' || language === 'javascript') {
        return this.validateTypeScript(code);
      }

      if (language === 'python') {
        return this.validatePython(code);
      }

      if (language === 'go') {
        return this.validateGo(code);
      }

      // Simple heuristic validation for other languages
      return this.validateHeuristic(code);
    } catch (error) {
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  private validateTypeScript(code: string): ASTValidationResult {
    const errors: string[] = [];

    // Check for unclosed braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces');
    }

    // Check for unclosed parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unmatched parentheses');
    }

    // Check for unclosed brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched brackets');
    }

    // Check for unclosed template literals
    const openBackticks = (code.match(/`/g) || []).length;
    if (openBackticks % 2 !== 0) {
      errors.push('Unmatched template literal');
    }

    // Check for missing semicolons in obvious places (simplified)
    // This is a heuristic and may have false positives
    const obviousMissingSemicolon = code.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^;\n]+$/m);
    if (obviousMissingSemicolon) {
      // Not adding error as this could be valid in many contexts
    }

    // Check for missing operands after operators
    if (code.match(/\+\s*\}/) || code.match(/\-\s*\}/) || code.match(/\*\s*\}/)) {
      errors.push('Missing operand after operator');
    }

    // Check for missing operand after return in certain patterns
    if (code.match(/return\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\+\s*\}/)) {
      errors.push('Incomplete expression after return');
    }

    // Check for empty code blocks that might indicate issues
    if (code.match(/function\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)\s*\{\s*\}/)) {
      // Empty function is valid, skip
    }

    // Check for invalid function declarations
    if (code.match(/function\s*\(/) && !code.match(/function\s*[a-zA-Z_]/)) {
      errors.push('Invalid function declaration');
    }

    logger.debug(`[ASTValidator] TypeScript validation: ${errors.length === 0 ? 'PASS' : 'FAIL'}`);

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  private validatePython(code: string): ASTValidationResult {
    const errors: string[] = [];

    // Check for unclosed braces/brackets/parens
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unmatched parentheses');
    }

    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched brackets');
    }

    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces');
    }

    // Check for consistent indentation (simplified)
    const lines = code.split('\n');
    let indentStack: number[] = [0];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);
      if (indent === -1) continue; // Empty line

      const currentIndent = indentStack[indentStack.length - 1] || 0;

      if (indent > currentIndent) {
        indentStack.push(indent);
      } else if (indent < currentIndent) {
        // Pop until we find matching indent
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
          indentStack.pop();
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          errors.push(`Inconsistent indentation at line ${i + 1}`);
        }
      }
    }

    // Check for missing colons after def/class/if/else/for/while
    const keywordsRequiringColon = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with'];
    for (const keyword of keywordsRequiringColon) {
      const pattern = new RegExp(`^\\s*${keyword}\\b[^:]*$`, 'm');
      if (code.match(pattern)) {
        errors.push(`Missing colon after '${keyword}'`);
      }
    }

    logger.debug(`[ASTValidator] Python validation: ${errors.length === 0 ? 'PASS' : 'FAIL'}`);

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  private validateGo(code: string): ASTValidationResult {
    const errors: string[] = [];

    // Check for unclosed braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces');
    }

    // Check for unclosed parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unmatched parentheses');
    }

    // Check for unclosed brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched brackets');
    }

    // Go requires proper package declaration
    if (code.length > 0 && !code.match(/package\s+\w+/)) {
      // This might be a snippet, not a full file
    }

    logger.debug(`[ASTValidator] Go validation: ${errors.length === 0 ? 'PASS' : 'FAIL'}`);

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  private validateHeuristic(code: string): ASTValidationResult {
    const errors: string[] = [];

    if (code.length === 0) {
      errors.push('Empty code content');
    }

    // Basic bracket matching
    const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
    for (const [open, close] of pairs) {
      const openCount = (code.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closeCount = (code.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (openCount !== closeCount) {
        errors.push(`Unmatched '${open}' and '${close}'`);
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }
}