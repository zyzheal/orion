import { test, expect } from '@playwright/test';

test.describe('CMDB', () => {
  test('@smoke CMDB 页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/cmdb');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke CI 列表表格渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/cmdb');
    await page.waitForLoadState('networkidle');
    const table = page.getByRole('table').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('@critical 页面标题', async ({ page }) => {
    await page.goto('http://localhost:3000/cmdb');
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title).toMatch(/orion|cmdb/i);
  });
});
