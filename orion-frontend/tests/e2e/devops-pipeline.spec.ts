import { test, expect } from '@playwright/test';

test.describe('DevOps Pipeline', () => {
  test('@smoke 流水线列表页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 流水线运行列表页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/pipeline-runs');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 流水线监控页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/monitor');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 流水线模板页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/pipeline-templates');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@critical 流水线列表页面标题', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines');
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title).toMatch(/orion|pipeline/i);
  });

  test('@smoke 流水线表格渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines');
    await page.waitForLoadState('networkidle');
    const table = page.getByRole('table').first();
    await expect(table).toBeVisible({ timeout: 15000 });
  });

  test('@smoke 数据流水线页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/data-pipeline');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 15000 });
  });
});
