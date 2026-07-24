/**
 * ChangeAnalyzer Tests
 */

import { ChangeAnalyzer } from '../ChangeAnalyzer';
import { ProgrammingLanguage } from '../types';

describe('ChangeAnalyzer', () => {
  let analyzer: ChangeAnalyzer;

  beforeEach(() => {
    analyzer = new ChangeAnalyzer();
  });

  describe('analyzeChange', () => {
    it('should parse TypeScript function addition', async () => {
      const diff = `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,0 +1,10 @@
+export function calculateSum(a: number, b: number): number {
+  return a + b;
+}`;

      const result = await analyzer.analyzeChange(diff, 'src/utils.ts', 'typescript');

      expect(result.filePath).toBe('src/utils.ts');
      expect(result.language).toBe('typescript');
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changedSymbols.length).toBeGreaterThan(0);

      const funcSymbol = result.changedSymbols.find(s => s.name === 'calculateSum');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.type).toBe('function');
      expect(funcSymbol?.isNew).toBe(true);
      expect(funcSymbol?.parameters?.length).toBe(2);
    });

    it('should parse TypeScript class addition', async () => {
      const diff = `diff --git a/src/UserService.ts b/src/UserService.ts
--- a/src/UserService.ts
+++ b/src/UserService.ts
@@ -1,0 +1,20 @@
+export class UserService {
+  private users: Map<string, User>;
+
+  constructor() {
+    this.users = new Map();
+  }
+
+  async getUser(id: string): Promise<User | null> {
+    return this.users.get(id) || null;
+  }
+}`;

      const result = await analyzer.analyzeChange(diff, 'src/UserService.ts', 'typescript');

      const classSymbol = result.changedSymbols.find(s => s.name === 'UserService');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.type).toBe('class');
      expect(classSymbol?.isNew).toBe(true);

      const methodSymbol = result.changedSymbols.find(s => s.name === 'getUser');
      expect(methodSymbol).toBeDefined();
      expect(methodSymbol?.type).toBe('method');
    });

    it('should parse Python function addition', async () => {
      const diff = `diff --git a/app/utils.py b/app/utils.py
--- a/app/utils.py
+++ b/app/utils.py
@@ -1,0 +1,10 @@
+def calculate_sum(a: int, b: int) -> int:
+    """Calculate the sum of two numbers."""
+    return a + b`;

      const result = await analyzer.analyzeChange(diff, 'app/utils.py', 'python');

      expect(result.language).toBe('python');
      const funcSymbol = result.changedSymbols.find(s => s.name === 'calculate_sum');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.type).toBe('function');
    });

    it('should parse Go function addition', async () => {
      const diff = `diff --git a/main.go b/main.go
--- a/main.go
+++ b/main.go
@@ -1,0 +1,10 @@
+func CalculateSum(a int, b int) int {
+    return a + b
+}`;

      const result = await analyzer.analyzeChange(diff, 'main.go', 'go');

      expect(result.language).toBe('go');
      const funcSymbol = result.changedSymbols.find(s => s.name === 'CalculateSum');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.type).toBe('function');
    });

    it('should parse Java class addition', async () => {
      const diff = `diff --git a/src/main/java/UserService.java b/src/main/java/UserService.java
--- a/src/main/java/UserService.java
+++ b/src/main/java/UserService.java
@@ -1,0 +1,20 @@
+public class UserService {
+    private Map<String, User> users;
+
+    public UserService() {
+        this.users = new HashMap<>();
+    }
+
+    public User getUser(String id) {
+        return users.get(id);
+    }
+}`;

      const result = await analyzer.analyzeChange(diff, 'src/main/java/UserService.java', 'java');

      expect(result.language).toBe('java');
      const classSymbol = result.changedSymbols.find(s => s.name === 'UserService');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.type).toBe('class');
    });

    it('should calculate complexity score', async () => {
      const diff = `diff --git a/src/complex.ts b/src/complex.ts
--- a/src/complex.ts
+++ b/src/complex.ts
@@ -1,0 +1,50 @@
+export function complexFunction(a: number, b: string, c: boolean): Result {
+  // Lots of logic here
+  if (a > 0) {
+    return processA(a);
+  }
+  // More branches
+  return processB(b);
+}`;

      const result = await analyzer.analyzeChange(diff, 'src/complex.ts', 'typescript');

      expect(result.impactScope.complexityScore).toBeGreaterThan(0);
      expect(result.impactScope.complexityScore).toBeLessThanOrEqual(100);
    });

    it('should calculate risk score', async () => {
      const diff = `diff --git a/src/risky.ts b/src/risky.ts
--- a/src/risky.ts
+++ b/src/risky.ts
@@ -10,5 +10,10 @@
 export function riskyFunction(): void {
-  // Old implementation
+  // New implementation with async
+  async helper();
 }`;

      const result = await analyzer.analyzeChange(diff, 'src/risky.ts', 'typescript');

      expect(result.impactScope.riskScore).toBeGreaterThan(0);
      expect(result.impactScope.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript from .ts extension', () => {
      expect(ChangeAnalyzer.detectLanguage('src/utils.ts')).toBe('typescript');
    });

    it('should detect TypeScript from .tsx extension', () => {
      expect(ChangeAnalyzer.detectLanguage('src/component.tsx')).toBe('typescript');
    });

    it('should detect JavaScript from .js extension', () => {
      expect(ChangeAnalyzer.detectLanguage('src/utils.js')).toBe('javascript');
    });

    it('should detect Python from .py extension', () => {
      expect(ChangeAnalyzer.detectLanguage('app/utils.py')).toBe('python');
    });

    it('should detect Go from .go extension', () => {
      expect(ChangeAnalyzer.detectLanguage('main.go')).toBe('go');
    });

    it('should detect Java from .java extension', () => {
      expect(ChangeAnalyzer.detectLanguage('src/UserService.java')).toBe('java');
    });

    it('should return null for unknown extensions', () => {
      expect(ChangeAnalyzer.detectLanguage('config.json')).toBeNull();
      expect(ChangeAnalyzer.detectLanguage('README.md')).toBeNull();
    });
  });

  describe('parseTypeScriptParams', () => {
    it('should parse simple parameters', async () => {
      const diff = `+export function test(a: number, b: string): void {}`;
      const result = await analyzer.analyzeChange(diff, 'test.ts', 'typescript');

      const func = result.changedSymbols.find(s => s.name === 'test');
      expect(func?.parameters?.length).toBe(2);
      expect(func?.parameters?.[0]?.name).toBe('a');
      expect(func?.parameters?.[0]?.type).toBe('number');
      expect(func?.parameters?.[1]?.name).toBe('b');
      expect(func?.parameters?.[1]?.type).toBe('string');
    });

    it('should parse optional parameters', async () => {
      const diff = `+export function test(a: number, b?: string): void {}`;
      const result = await analyzer.analyzeChange(diff, 'test.ts', 'typescript');

      const func = result.changedSymbols.find(s => s.name === 'test');
      expect(func?.parameters?.[1]?.optional).toBe(true);
    });

    it('should parse parameters with default values', async () => {
      const diff = `+export function test(a: number = 10): void {}`;
      const result = await analyzer.analyzeChange(diff, 'test.ts', 'typescript');

      const func = result.changedSymbols.find(s => s.name === 'test');
      expect(func?.parameters?.[0]?.defaultValue).toBe('10');
    });
  });

  describe('generateTestRecommendations', () => {
    it('should generate recommendations for functions', async () => {
      const diff = `+export function calculate(a: number, b: number): number { return a + b; }`;
      const result = await analyzer.analyzeChange(diff, 'test.ts', 'typescript');

      const func = result.changedSymbols.find(s => s.name === 'calculate');
      expect(func?.testRecommendations).toBeDefined();
      expect(func?.testRecommendations?.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for classes', async () => {
      const diff = `+export class UserService {}`;
      const result = await analyzer.analyzeChange(diff, 'test.ts', 'typescript');

      const cls = result.changedSymbols.find(s => s.name === 'UserService');
      expect(cls?.testRecommendations).toBeDefined();
      expect(cls?.testRecommendations?.length).toBeGreaterThan(0);
    });
  });
});