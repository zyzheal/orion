const fs = require('fs');

const files = [
  { path: 'src/services/integration/ConnectorRegistry.ts', category: null },
  { path: 'src/services/code-repo/WebhookService.ts', category: null },
  { path: 'src/services/disaster-recovery/BackupRestoreService.ts', category: null },
  { path: 'src/services/developer-portal/APISubscriptionService.ts', category: null },
  { path: 'src/services/federation/ClusterHealthMonitor.ts', category: 'cluster-health-monitor' },
];

for (const { path: file, category } of files) {
  let content = fs.readFileSync(file, 'utf8');

  // If ClusterHealthMonitor, add logger import
  if (category && !content.includes("createLogger('cluster-health-monitor')")) {
    // Add after the last import
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') && lines[i].includes(';')) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0,
        "import { createLogger } from '../../utils/logger';",
        '',
        "const logger = createLogger('cluster-health-monitor');",
        ''
      );
    }
    content = lines.join('\n');
  }

  // Pattern 1: .catch((err) => console.warn('[Tag] msg:', err))
  content = content.replace(
    /\.catch\(\(err\)\s*=>\s*console\.warn\(\[([^\]]+)\]\s+([^,]+),\s*err\)\)/g,
    (match, tag, msg) => `.catch((err) => logger.warn({ err }, '${tag} ${msg.trim()}'))`
  );

  // Pattern 2: console.warn('[Tag] msg:', err)  (standalone)
  content = content.replace(
    /console\.warn\(\[([^\]]+)\]\s+([^,]+),\s*err\)/g,
    (match, tag, msg) => `logger.warn({ err }, '${tag} ${msg.trim()}')`
  );

  // Pattern 3: console.log([Tag] msg, err)  (standalone log)
  content = content.replace(
    /console\.log\(`\[([^\]]+)\]\s+([^`]+)\`\)/g,
    (match, tag, msg) => `logger.info('${tag} ${msg.trim()}')`
  );

  // Pattern 4: console.log('[Tag] msg:', err)
  content = content.replace(
    /console\.log\(\[([^\]]+)\]\s+([^,]+),\s*err\)/g,
    (match, tag, msg) => `logger.warn({ err }, '${tag} ${msg.trim()}')`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated: ' + file);
}

console.log('All files updated');
