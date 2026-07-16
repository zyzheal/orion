/**
 * Fixup script for Phase 1.3 Migration - Part 2
 *
 * Fixes:
 * 1. Import statements that got inserted in the middle of multi-line imports
 * 2. Leftover closing braces from multi-line send pattern removals
 *
 * Usage: npx tsx scripts/fixup2-route-errors.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTE_FILES_DIR = path.resolve(__dirname, '../src/api');

const KNOWN_FILES_NEEDING_FIXES: Record<string, (content: string) => string> = {
  'diagnostic-routes.ts': (content) => {
    // Fix: import { import { X } from '../errors'; \n FastifyInstance...
    // to: import { FastifyInstance... from 'fastify'; \n import { X } from '../errors';
    content = content.replace(
      /import \{ import \{([^}]+)\} from '\.\.\/errors';\n(FastifyInstance[^;]+from 'fastify';)/,
      "import { $2\nimport { $1} from '../errors';"
    );
    return content;
  },
  'eventbus-routes.ts': (content) => {
    content = content.replace(
      /import \{ import \{([^}]+)\} from '\.\.\/errors';\n(FastifyInstance[^;]+from 'fastify';)/,
      "import { $2\nimport { $1} from '../errors';"
    );
    return content;
  },
  'product-line-routes.ts': (content) => {
    content = content.replace(
      /import \{ import \{([^}]+)\} from '\.\.\/errors';\n(FastifyInstance[^;]+from 'fastify';)/,
      "import { $2\nimport { $1} from '../errors';"
    );
    return content;
  },
  'test-selector-routes.ts': (content) => {
    content = content.replace(
      /import \{ import \{([^}]+)\} from '\.\.\/errors';\n(FastifyInstance[^;]+from 'fastify';\n)\nimport pino/,
      "import { $2\nimport { $1} from '../errors';\nimport pino"
    );
    return content;
  },
  'workflow-trigger-routes.ts': (content) => {
    // Fix: import was inserted into the middle of import type { ... } block
    // Remove the misplaced import and the duplicate line
    content = content.replace(
      /const logger = pino\(\{ name: 'workflow-trigger-routes' \}\);\nimport type \{\nimport \{([^}]+)\} from '\.\.\/errors';\n/,
      "import { $1} from '../errors';\n\nconst logger = pino({ name: 'workflow-trigger-routes' });\nimport type {\n"
    );
    return content;
  },
  'workflow-task-routes.ts': (content) => {
    // Fix leftover `});` after handleError calls - pattern:
    //   return handleError(reply, new XXX('...'))
    //   });
    // Should be just the handleError call
    content = content.replace(
      /(return handleError\([^;]+\))\n\s+}\}\);/g,
      '$1;'
    );
    content = content.replace(
      /(return handleError\([^;]+\))\n\s+\}\);/g,
      '$1;'
    );
    // Also fix catch blocks that now end with handleError
    content = content.replace(
      /}( catch \(error\) \{)/g,
      '} catch (error) {'
    );
    return content;
  },
};

function main() {
  const allFiles = fs.readdirSync(ROUTE_FILES_DIR);
  const files = allFiles
    .filter(f => f.endsWith('-routes.ts') && !f.includes('__tests__'))
    .map(f => path.join(ROUTE_FILES_DIR, f));

  let fixedFiles = 0;

  for (const file of files) {
    const basename = path.basename(file);
    const fixer = KNOWN_FILES_NEEDING_FIXES[basename];
    if (!fixer) continue;

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fixed = fixer(content);
      if (fixed !== content) {
        fs.writeFileSync(file, fixed, 'utf-8');
        console.log(`  Fixed: ${basename}`);
        fixedFiles++;
      }
    } catch (err) {
      console.error(`  ERROR: ${basename}: ${err}`);
    }
  }

  console.log(`\nFixed ${fixedFiles} files`);
}

main();
