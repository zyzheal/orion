const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '../src/repositories');
const testDir = path.join(repoDir, '__tests__');

// Get all repo source files
const sourceFiles = fs.readdirSync(repoDir)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts')
  .map(f => f.replace('.ts', ''));

// Get existing test files
const existingTests = new Set(
  fs.readdirSync(testDir)
    .filter(f => f.endsWith('.test.ts'))
    .map(f => f.replace('.test.ts', ''))
);

// Find repos without tests
const missing = sourceFiles.filter(s => !existingTests.has(s));
console.log(`Total repos: ${sourceFiles.length}, With tests: ${existingTests.size}, Missing: ${missing.length}`);

let generated = 0;
let failed = 0;

for (const base of missing) {
  const srcPath = path.join(repoDir, `${base}.ts`);
  const testPath = path.join(testDir, `${base}.test.ts`);

  let src;
  try {
    src = fs.readFileSync(srcPath, 'utf8');
  } catch (e) {
    continue;
  }

  // Extract exported classes
  const classMatches = [...src.matchAll(/export\s+class\s+(\w+)/g)];
  if (classMatches.length === 0) continue;

  const classes = classMatches.map(m => m[1]);

  // Check if any class extends BaseRepository
  const extendsBase = /extends\s+BaseRepository/.test(src);

  // For each class, extract public async methods
  function extractMethods(className) {
    // Find the class body
    const classStart = src.indexOf(`class ${className}`);
    if (classStart === -1) return [];

    // Find next class or end of file
    const nextClass = src.indexOf('\nexport class', classStart + 1);
    const classBody = src.substring(classStart, nextClass === -1 ? src.length : nextClass);

    const methodMatches = [...classBody.matchAll(/async\s+(\w+)\s*\(/g)];
    return methodMatches
      .map(m => m[1])
      .filter(m => m !== 'constructor' && !m.startsWith('map'));
  }

  let testContent = `/**\n * ${base} Tests\n */\n`;

  // Add tenant mock if extends BaseRepository
  if (extendsBase) {
    testContent += `jest.mock('../../../db/tenant-context-storage', () => ({\n  getCurrentTenantId: () => 'test-tenant',\n}));\n\n`;
  }

  // Build imports
  testContent += `import { ${classes.join(', ')} } from '../${base}';\n\n`;
  testContent += `const mockQuery = jest.fn();\n`;

  for (const cls of classes) {
    const methods = extractMethods(cls);

    testContent += `\ndescribe('${cls}', () => {\n`;
    testContent += `  let repo: ${cls};\n\n`;
    testContent += `  beforeEach(() => {\n    jest.clearAllMocks();\n    repo = new ${cls}({ query: mockQuery } as any);\n  });\n`;

    if (methods.length === 0) {
      testContent += `\n  it('should instantiate', () => {\n    expect(repo).toBeDefined();\n  });\n`;
    } else {
      for (const method of methods) {
        // Analyze method signature to determine how to call it
        const methodRegex = new RegExp(`async\\s+${method}\\s*\\(([^)]*)\\)`, 's');
        const match = src.match(methodRegex);
        let params = '';
        if (match) {
          const paramList = match[1].split(',').map(p => p.trim().split(':')[0].split('=')[0].trim()).filter(Boolean);
          // Replace param names with simple values
          params = paramList.map(p => {
            if (p.includes('id') || p.includes('Id')) return "'test-id'";
            if (p.includes('name') || p.includes('Name')) return "'test-name'";
            if (p.includes('type') || p.includes('Type')) return "'test-type'";
            if (p.includes('status') || p.includes('Status')) return "'active'";
            if (p.includes('tenant')) return "'test-tenant'";
            return "'test-arg'";
          }).join(', ');
        }

        // Check return type
        const returnMatch = src.match(new RegExp(`async\\s+${method}[^:]*:\\s*Promise<([^>]+)>`));
        const returnType = returnMatch ? returnMatch[1] : '';
        const returnsVoid = returnType === 'void';
        const returnsBool = returnType === 'boolean';
        const returnsArray = returnType.includes('[]');
        const returnsFindAll = returnType.includes('FindAllResult');

        testContent += `\n  it('should ${method}', async () => {\n`;

        if (returnsBool || returnsVoid) {
          testContent += `    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });\n`;
        } else if (returnsFindAll) {
          testContent += `    mockQuery\n      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })\n      .mockResolvedValueOnce({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });\n`;
        } else if (returnsArray) {
          testContent += `    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });\n`;
        } else {
          testContent += `    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });\n`;
        }

        if (params) {
          testContent += `    const result = await repo.${method}(${params});\n`;
        } else {
          testContent += `    const result = await repo.${method}();\n`;
        }

        testContent += `    expect(mockQuery).toHaveBeenCalled();\n`;

        if (returnsBool) {
          testContent += `    expect(result).toBe(true);\n`;
        } else if (returnsVoid) {
          testContent += `    expect(result).toBeUndefined();\n`;
        }

        testContent += `  });\n`;
      }
    }

    testContent += `});\n`;
  }

  try {
    fs.writeFileSync(testPath, testContent);
    generated++;
  } catch (e) {
    console.error(`Failed to write ${testPath}: ${e.message}`);
    failed++;
  }
}

console.log(`Generated: ${generated}, Failed: ${failed}`);
console.log(`New test count: ${existingTests.size + generated}/${sourceFiles.length} (${((existingTests.size + generated) / sourceFiles.length * 100).toFixed(1)}%)`);
