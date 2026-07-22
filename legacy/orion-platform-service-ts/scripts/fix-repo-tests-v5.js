const fs = require('fs');
const path = require('path');

const testDir = path.resolve(__dirname, '../src/repositories/__tests__');
const repoDir = path.resolve(__dirname, '../src/repositories');

// Repos that need { query: mockQuery } as any constructor (DatabasePool-based)
const poolRepos = [
  'BranchPolicyRepository', 'CodeOwnershipRepository', 'ConfigApprovalRepository',
  'DeploymentStepTrackerRepository', 'DeploymentStrategyRepository',
  'ExecutionTimelineRepository', 'GitOpsRepository', 'LLMTraceRepository',
  'SubPipelineRepository', 'WorkflowTaskRepository',
];

for (const repo of poolRepos) {
  const srcPath = path.join(repoDir, `${repo}.ts`);
  const testPath = path.join(testDir, `${repo}.test.ts`);
  if (!fs.existsSync(srcPath)) continue;

  const src = fs.readFileSync(srcPath, 'utf8');
  const classMatches = [...src.matchAll(/export\s+class\s+(\w+)/g)];
  const classes = classMatches.map(m => m[1]);

  let content = `import { ${classes.join(', ')} } from '../${repo}';\n\n`;

  for (const cls of classes) {
    const classStart = src.indexOf(`class ${cls}`);
    const nextClass = src.indexOf('\nexport class', classStart + 1);
    const classBody = src.substring(classStart, nextClass === -1 ? src.length : nextClass);

    // Get simple methods (single string/number params only)
    const methodMatches = [...classBody.matchAll(/async\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{|]+?))?\s*\{/g)];
    const simpleMethods = [];

    for (const m of methodMatches) {
      const name = m[1];
      const paramsStr = m[2];
      const retType = (m[3] || '').trim();
      if (name === 'mapRowToEntity' || name === 'constructor') continue;

      const params = paramsStr.split(',').map(p => p.trim()).filter(Boolean);
      const allSimple = params.every(p => {
        const type = p.includes(':') ? p.split(':')[1].split('=')[0].trim() : '';
        return !type.includes('[]') && !type.includes('Record') && !type.includes('Partial')
          && !type.includes('Input') && !type.includes('Update') && !type.includes('Create')
          && !type.includes('Omit') && !type.includes('Array') && !type.includes('{');
      });

      if (allSimple && params.length <= 3) {
        simpleMethods.push({ name, params, retType });
      }
    }

    content += `describe('${cls}', () => {\n`;
    content += `  const mockQuery = jest.fn();\n`;
    content += `  let repo: ${cls};\n\n`;
    content += `  beforeEach(() => {\n    jest.clearAllMocks();\n`;
    content += `    repo = new ${cls}({ query: mockQuery } as any);\n`;
    content += `  });\n\n`;

    content += `  it('should instantiate', () => { expect(repo).toBeDefined(); });\n`;

    for (const method of simpleMethods.slice(0, 5)) {
      const callArgs = method.params.map(p => {
        const name = p.split(':')[0].split('=')[0].trim();
        if (name.includes('id') || name.includes('Id')) return "'test-id'";
        if (name.includes('tenant')) return "'test-tenant'";
        if (name.includes('name') || name.includes('Name')) return "'test-name'";
        if (name.includes('type') || name.includes('Type')) return "'test-type'";
        if (name.includes('status')) return "'active'";
        return "'test-arg'";
      }).join(', ');

      const returnsVoid = method.retType.includes('void');
      const returnsBool = method.retType.includes('boolean');

      content += `\n  it('should ${method.name}', async () => {\n`;
      if (returnsBool) {
        content += `    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });\n`;
      } else if (returnsVoid) {
        content += `    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });\n`;
      } else {
        content += `    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });\n`;
      }
      content += `    await repo.${method.name}(${callArgs});\n`;
      content += `    expect(mockQuery).toHaveBeenCalled();\n`;
      content += `  });\n`;
    }

    content += `});\n\n`;
  }

  fs.writeFileSync(testPath, content);
  console.log(`Fixed: ${repo}`);
}

// Also fix PortalDocumentRepository - restore the manual version
const portalContent = `/**
 * PortalDocumentRepository Tests
 */
import { PortalDocumentRepository } from '../PortalDocumentRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: PortalDocumentRepository;

const sampleRow = {
  id: 'doc-1', tenant_id: 'test-tenant', title: 'API Guide', slug: 'api-guide',
  content: '{"blocks":[]}', type: 'guide', category: 'api', tags: '["reference"]',
  author: 'admin', status: 'published', version: 3, view_count: 100, helpful_yes: 10, helpful_no: 1,
  created_at: new Date(), updated_at: new Date(), published_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new PortalDocumentRepository({ query: mockQuery } as any);
});

describe('PortalDocumentRepository', () => {
  it('should find by slug', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findBySlug('test-tenant', 'api-guide');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('slug = $2'),
      expect.arrayContaining(['test-tenant', 'api-guide']),
    );
  });

  it('should search documents', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.search('test-tenant', 'API');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('to_tsvector'),
      expect.arrayContaining(['test-tenant']),
    );
  });

  it('should increment view count', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.incrementViewCount('doc-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('view_count'),
      ['doc-1'],
    );
  });

  it('should get categories', async () => {
    mockQuery.mockResolvedValue({ rows: [{ category: 'api', count: '5' }], rowCount: 1 });
    const result = await repo.getCategories('test-tenant');
    expect(result[0].category).toBe('api');
  });
});
`;
fs.writeFileSync(path.join(testDir, 'PortalDocumentRepository.test.ts'), portalContent);
console.log('Fixed: PortalDocumentRepository');

console.log('Done');
