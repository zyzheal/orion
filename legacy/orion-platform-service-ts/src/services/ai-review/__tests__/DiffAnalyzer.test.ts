/**
 * DiffAnalyzer 测试
 */

import { DiffAnalyzer } from '../DiffAnalyzer';

describe('DiffAnalyzer', () => {
  let analyzer: DiffAnalyzer;

  beforeEach(() => {
    analyzer = new DiffAnalyzer();
  });

  describe('parseDiff', () => {
    it('应该解析空 diff', () => {
      const result = analyzer.parseDiff('');
      expect(result.files).toHaveLength(0);
      expect(result.changedLines).toHaveLength(0);
      expect(result.totalAdditions).toBe(0);
      expect(result.totalDeletions).toBe(0);
    });

    it('应该解析单个文件的 diff', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,5 @@ function hello() {
   console.log('hello');
+  console.log('world');
+  console.log('test');
 }
`;

      const result = analyzer.parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].newPath).toBe('src/app.ts');
      expect(result.files[0].additions).toBe(2);
      expect(result.files[0].deletions).toBe(0);
      expect(result.changedLines).toHaveLength(2);
      expect(result.totalAdditions).toBe(2);
    });

    it('应该解析多个文件的 diff', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import express from 'express';
+import cors from 'cors';

 const app = express();
diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -5,3 +5,4 @@ export const config = {
   port: 3000,
+  debug: true,
 };
`;

      const result = analyzer.parseDiff(diff);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].newPath).toBe('src/app.ts');
      expect(result.files[1].newPath).toBe('src/config.ts');
      expect(result.totalAdditions).toBe(2);
    });

    it('应该正确解析新增文件', () => {
      const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,2 @@
+export const NEW = true;
+export const VERSION = '1.0.0';
`;

      const result = analyzer.parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].isNewFile).toBe(true);
      expect(result.files[0].additions).toBe(2);
    });

    it('应该正确解析删除文件', () => {
      const diff = `diff --git a/src/old-file.ts b/src/old-file.ts
deleted file mode 100644
--- a/src/old-file.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const OLD = true;
-export const VERSION = '0.9.0';
`;

      const result = analyzer.parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].isDeletedFile).toBe(true);
      expect(result.files[0].deletions).toBe(2);
    });

    it('应该解析包含添加和删除的 hunk', () => {
      const diff = `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,4 +10,5 @@ function add(a, b) {
-  return a + b;
+  return Number(a) + Number(b);
 }
+
+// TODO: Add validation
`;

      const result = analyzer.parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].additions).toBe(3);
      expect(result.files[0].deletions).toBe(1);
    });

    it('应该正确提取变更行', () => {
      const diff = `diff --git a/src/handler.ts b/src/handler.ts
--- a/src/handler.ts
+++ b/src/handler.ts
@@ -5,3 +5,4 @@ export function handle() {
   const result = process();
+  console.log(result);
+  eval(result);
   return result;
`;

      const result = analyzer.parseDiff(diff);

      expect(result.changedLines).toHaveLength(2);
      expect(result.changedLines[0].content).toBe("  console.log(result);");
      expect(result.changedLines[0].lineNumber).toBe(6);
      expect(result.changedLines[1].content).toBe("  eval(result);");
    });
  });

  describe('getChangedFiles', () => {
    it('应该返回变更的文件列表', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
+const a = 1;
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1 +1,2 @@
+const b = 2;
`;

      const files = analyzer.getChangedFiles(diff);
      expect(files).toEqual(['src/a.ts', 'src/b.ts']);
    });
  });

  describe('getChangedLines', () => {
    it('应该返回指定文件的变更行', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
+const a = 1;
+const a2 = 2;
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1 +1,2 @@
+const b = 1;
`;

      const lines = analyzer.getChangedLines(diff, 'src/a.ts');
      expect(lines).toHaveLength(2);
      expect(lines[0].filePath).toBe('src/a.ts');
    });

    it('应该返回空数组当文件不存在时', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
+const a = 1;
`;

      const lines = analyzer.getChangedLines(diff, 'src/nonexistent.ts');
      expect(lines).toHaveLength(0);
    });
  });

  describe('extractPatterns', () => {
    it('应该检测指定的代码模式', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,3 @@
+console.log('debug info');
+eval(userInput);
+const password = 'secret123';
`;

      const patterns = [
        { name: 'console-log', regex: /console\.log/, fileExtensions: ['ts'] },
        { name: 'eval', regex: /eval\s*\(/, fileExtensions: ['ts'] },
      ];

      const matches = analyzer.extractPatterns(diff, patterns);

      expect(matches).toHaveLength(2);
      expect(matches.find((m) => m.patternName === 'console-log')).toBeDefined();
      expect(matches.find((m) => m.patternName === 'eval')).toBeDefined();
    });

    it('应该根据文件扩展名过滤', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,2 @@
+console.log('debug');
diff --git a/src/config.json b/src/config.json
--- a/src/config.json
+++ b/src/config.json
@@ -1 +1,2 @@
+  "debug": true,
`;

      const patterns = [
        { name: 'debug', regex: /debug/, fileExtensions: ['ts'] },
      ];

      const matches = analyzer.extractPatterns(diff, patterns);

      expect(matches).toHaveLength(1);
      expect(matches[0].filePath).toBe('src/app.ts');
    });
  });

  describe('getFileStats', () => {
    it('应该返回每个文件的变更统计', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,4 @@
+line1
+line2
+line3
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,3 +1 @@
-old1
-old2
`;

      const stats = analyzer.getFileStats(diff);

      expect(stats['src/a.ts']).toEqual({ additions: 3, deletions: 0 });
      expect(stats['src/b.ts']).toEqual({ additions: 0, deletions: 2 });
    });
  });
});
