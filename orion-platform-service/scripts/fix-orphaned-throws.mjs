import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const files = execSync(
  `grep -rl "throw new Error" src/ --include="*.ts" | grep -v "__tests__" | grep -v ".test.ts"`,
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;
let filesModified = 0;

// Map of file:line to appropriate error messages
const errorMessages = {
  'src/services/pipeline/SecretsService.ts:469': { code: 'VALIDATION_ERROR', msg: 'Invalid secret name format' },
  'src/services/pipeline/SharedActionService.ts:115': { code: 'VALIDATION_ERROR', msg: 'Version must not be a default branch' },
  'src/services/self-healing/HealingDecisionMaker.ts:238': { code: 'VALIDATION_ERROR', msg: 'Approval request is not pending' },
  'src/services/plugin-spi/PluginRegistry.ts:297': { code: 'VALIDATION_ERROR', msg: 'Platform version below minimum required' },
  'src/services/plugin-spi/PluginRegistry.ts:303': { code: 'VALIDATION_ERROR', msg: 'Platform version above maximum supported' },
  'src/services/plugin-spi/PluginLifecycleManager.ts:101': { code: 'VALIDATION_ERROR', msg: 'Plugin is already installed and enabled' },
  'src/services/plugin-spi/PluginLifecycleManager.ts:146': { code: 'VALIDATION_ERROR', msg: 'Platform version below minimum required' },
  'src/services/plugin-spi/PluginLifecycleManager.ts:317': { code: 'VALIDATION_ERROR', msg: 'Platform version above maximum supported' },
  'src/services/plugin-spi/PluginLifecycleManager.ts:398': { code: 'VALIDATION_ERROR', msg: 'Plugin is already enabled' },
  'src/services/plugin-executor-service.ts:1030': { code: 'OPERATION_FAILED', msg: 'Plugin execution failed' },
  'src/services/ai/ModelVersionService.ts:132': { code: 'VALIDATION_ERROR', msg: 'Invalid model version' },
  'src/services/ephemeral-env-service.ts:69': { code: 'VALIDATION_ERROR', msg: 'Invalid environment configuration' },
  'src/services/cross-domain-orchestration/DomainConnector.ts:256': { code: 'VALIDATION_ERROR', msg: 'Invalid domain configuration' },
  'src/services/smart-deploy/RollbackService.ts:67': { code: 'NOT_FOUND', msg: 'Deployment not found' },
  'src/services/smart-deploy/RollbackService.ts:72': { code: 'VALIDATION_ERROR', msg: 'Deployment is not in failed state' },
  'src/services/smart-deploy/RollbackService.ts:163': { code: 'NOT_FOUND', msg: 'Rollback snapshot not found' },
  'src/services/config-mgmt/ConfigDiffService.ts:133': { code: 'VALIDATION_ERROR', msg: 'Invalid configuration format' },
  'src/services/config-mgmt/ConfigDiffService.ts:136': { code: 'VALIDATION_ERROR', msg: 'Configuration comparison failed' },
};

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf-8'); } catch { continue; }
  if (!content.includes('throw new Error')) continue;

  const hasOrionErrorImport = content.includes('OrionError') && /import.*OrionError.*from/.test(content);
  const lines = content.split('\n');
  const newLines = [];
  let replacements = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const throwMatch = line.match(/^(\s*)throw new Error\(\s*$/);

    if (throwMatch) {
      const indent = throwMatch[1];
      const key = `${file}:${i + 1}`;
      const errorInfo = errorMessages[key];

      if (errorInfo) {
        // Replace the throw new Error( with OrionError
        newLines.push(`${indent}throw new OrionError(ErrorCode.${errorInfo.code}, '${errorInfo.msg}');`);
        // Skip the next line if it's just a closing paren or empty
        if (i + 1 < lines.length && (lines[i + 1].trim() === ');' || lines[i + 1].trim() === ')' || lines[i + 1].trim() === '')) {
          i++; // Skip the closing paren line
        }
        replacements++;
      } else {
        // Unknown orphaned throw, try to infer from context
        let contextMsg = 'Operation failed';
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevLine = lines[j];
          if (prevLine.includes('not found') || prevLine.includes('missing')) {
            contextMsg = 'Resource not found';
            break;
          }
          if (prevLine.includes('already') || prevLine.includes('duplicate')) {
            contextMsg = 'Resource already exists';
            break;
          }
          if (prevLine.includes('invalid') || prevLine.includes('format')) {
            contextMsg = 'Invalid input';
            break;
          }
        }

        newLines.push(`${indent}throw new OrionError(ErrorCode.OPERATION_FAILED, '${contextMsg}');`);
        // Skip the next line if it's just a closing paren or empty
        if (i + 1 < lines.length && (lines[i + 1].trim() === ');' || lines[i + 1].trim() === ')' || lines[i + 1].trim() === '')) {
          i++; // Skip the closing paren line
        }
        replacements++;
      }
    } else {
      newLines.push(line);
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

    // Ensure ErrorCode is imported
    if (!result.includes('ErrorCode') && result.includes('ErrorCode.')) {
      result = result.replace(
        /import \{ OrionError \} from '([^']+)';/,
        "import { OrionError, ErrorCode } from '$1';"
      );
    }

    writeFileSync(file, result, 'utf-8');
    totalReplacements += replacements;
    filesModified++;
    console.log(`  ${file}: ${replacements} replacements`);
  }
}

console.log(`\nTotal: ${totalReplacements} replacements in ${filesModified} files`);
